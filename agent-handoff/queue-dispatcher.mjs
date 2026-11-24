import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {HANDOFF_REPOSITORY, HANDOFF_OWNER, processQueue} from './queue-selector.mjs';
import {collectBoard,validateDirectIntakeFollowup,validateFailureIntakeFollowup} from './queue-board-runner.mjs';
import {ownerExecutionPlan} from './queue-board.mjs';
import {readIssueCommentLedger} from './comment-ledger.mjs';

const API = 'https://api.github.com/repos/' + HANDOFF_REPOSITORY;
const SOURCE_WORKFLOWS = new Set([
  'ZGMINI Agent Handoff Intake',
  'ZGMINI Agent Handoff PC Failure Intake',
  'ZGMINI Agent Handoff Writer B Failure Intake'
]);

export function validateTrigger(event, env) {
  if (env.GITHUB_REPOSITORY !== HANDOFF_REPOSITORY ||
      !env.GITHUB_EVENT_PATH || event?.repository?.private !== true ||
      event.repository.full_name !== HANDOFF_REPOSITORY)
    throw Error('HANDOFF_SELECTOR_EVENT_REJECTED');
  if (env.GITHUB_JOB === 'verify-and-select-after-failure-intake') {
    validateFailureIntakeFollowup(event,env,'verify-and-select-after-failure-intake');
    return;
  }
  if (env.GITHUB_JOB === 'verify-and-select-after-intake') {
    validateDirectIntakeFollowup(event,env,'verify-and-select-after-intake');
    return;
  }
  if (env.GITHUB_EVENT_NAME === 'workflow_run') {
    if (event.action !== 'completed' ||
        !SOURCE_WORKFLOWS.has(event.workflow_run?.name) ||
        event.workflow_run?.conclusion !== 'success' ||
        event.workflow_run?.actor?.login !== HANDOFF_OWNER)
      throw Error('HANDOFF_SELECTOR_WORKFLOW_PROVENANCE_STOP');
  } else if (env.GITHUB_EVENT_NAME === 'push') {
    if (event.ref !== 'refs/heads/main' || event.deleted === true ||
        env.GITHUB_ACTOR !== HANDOFF_OWNER)
      throw Error('HANDOFF_SELECTOR_MAIN_PUSH_ONLY');
  } else if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    if (event.sender?.login !== HANDOFF_OWNER || env.GITHUB_ACTOR !== HANDOFF_OWNER)
      throw Error('HANDOFF_SELECTOR_OWNER_ONLY');
  } else {
    throw Error('HANDOFF_SELECTOR_EVENT_TYPE_REJECTED');
  }
}

async function request(resource, {method='GET', body}={}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Error('HANDOFF_SELECTOR_TOKEN_UNAVAILABLE');
  const response = await fetch(API + '/' + resource, {
    method, headers: {Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw Error('HANDOFF_SELECTOR_GITHUB_HTTP_' + response.status);
  return response.json();
}

export async function pages(resource, cap=100, read=request) {
  const all = [];
  for (let page=1; page<=cap; page++) {
    const rows = await read(resource + (resource.includes('?')?'&':'?') +
      'per_page=100&page=' + page);
    if (!Array.isArray(rows)||rows.length>100) throw Error('HANDOFF_SELECTOR_INVALID_PAGE');
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  const probe=await read(resource+(resource.includes('?')?'&':'?')+
    'per_page=100&page='+(cap+1));
  if(!Array.isArray(probe)||probe.length>100)throw Error('HANDOFF_SELECTOR_INVALID_PAGE');
  if(probe.length===0)return all;
  throw Error('HANDOFF_SELECTOR_INCOMPLETE_INVENTORY');
}

// Selection receipts are durable GitHub writes. An advisory board read failure
// must not retrospectively fail the completed selection or trigger a duplicate
// selection. The independent Queue Control Board keeps its own verification.
export async function finalizeSelection(result, readBoard) {
  if (!result || !Number.isSafeInteger(result.selected) ||
      typeof readBoard !== 'function')
    throw Error('HANDOFF_SELECTOR_FINALIZATION_INPUT_INVALID');
  try {
    const board = await readBoard();
    const execution = ownerExecutionPlan(board);
    return {...result, state: execution.state, execution,
      boardReadback: {state: 'VERIFIED', pendingIssueCount: board.pendingIssueCount},
      pcRuntimeVerified: false};
  } catch (error) {
    // Only fixed, non-sensitive error codes may leave the isolated runner.
    const raw = typeof error?.message === 'string' ? error.message : '';
    const reason = /^HANDOFF_(?:BOARD|SELECTOR)_[A-Z0-9_]{1,90}$/.test(raw)
      ? raw : 'HANDOFF_SELECTOR_BOARD_STATUS_UNAVAILABLE';
    return {...result, state: 'CANDIDATE_SELECTION_COMPLETED_BOARD_UNVERIFIED',
      execution: null, boardReadback: {state: 'UNVERIFIED', reason},
      pcRuntimeVerified: false};
  }
}

// Only the first, pre-write comment read for each Issue may be isolated.
// A failed POST, provenance recheck, or post-write receipt readback still
// stops selection rather than risking a duplicate GitHub write.
export function isolateInitialCommentRead(readComments, onDeferred) {
  if(typeof readComments!=='function'||typeof onDeferred!=='function')
    throw Error('HANDOFF_SELECTOR_COMMENT_READER_INVALID');
  const seen=new Set();
  return async issueNumber=>{
    if(seen.has(issueNumber))return readComments(issueNumber);
    seen.add(issueNumber);
    try {return await readComments(issueNumber);}
    catch(error){
      const code=typeof error?.message==='string'?error.message:'';
      // Repository authorization failures are global, not per-Incident defects.
      if(/^HANDOFF_SELECTOR_GITHUB_HTTP_(401|403)$/.test(code)||
         code==='HANDOFF_SELECTOR_TOKEN_UNAVAILABLE')throw error;
      onDeferred(issueNumber);
      return []; // assessIncident reports missing proof without any GitHub POST
    }
  };
}

export async function main(env=process.env) {
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateTrigger(event, env);
  const issues = (await pages('issues?state=open&labels=agent-handoff%2Chandoff-agent-pending'))
    .filter(i=>!i.pull_request).map(i=>({...i,repository:HANDOFF_REPOSITORY}));
  const commentReadUnavailable=[];
  const result = await processQueue(issues,{
    readComments: isolateInitialCommentRead(
      n=>readIssueCommentLedger(page=>request('issues/'+n+'/comments?per_page=100&page='+page)),
      n=>commentReadUnavailable.push(n)),
    readIssue: async n=>({...await request('issues/'+n),repository:HANDOFF_REPOSITORY}),
    recordReceipt: (n,body)=>request('issues/'+n+'/comments',{method:'POST',body:{body}})
  });
  // Earlier selections still need an owner-status readback when selected=0.
  // Reuse the already fetched pending-issue inventory, but re-read each item's
  // comments and identity; this avoids a redundant global GitHub list request.
  const output=await finalizeSelection({...result,commentReadUnavailable},()=>collectBoard({
    listIssues:async()=>issues,
    readComments:n=>readIssueCommentLedger(page=>request('issues/'+n+'/comments?per_page=100&page='+page)),
    readIssue:async n=>({...await request('issues/'+n),repository:HANDOFF_REPOSITORY}),
  },Date.now()));
  process.stdout.write(JSON.stringify(output)+'\n');
  return output;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
