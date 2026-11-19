import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {HANDOFF_REPOSITORY, HANDOFF_OWNER, processQueue} from './queue-selector.mjs';
import {collectBoard} from './queue-board-runner.mjs';
import {ownerExecutionPlan} from './queue-board.mjs';

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

async function pages(resource, cap) {
  const all = [];
  for (let page=1; page<=cap; page++) {
    const rows = await request(resource + (resource.includes('?')?'&':'?') +
      'per_page=100&page=' + page);
    if (!Array.isArray(rows)) throw Error('HANDOFF_SELECTOR_INVALID_PAGE');
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw Error('HANDOFF_SELECTOR_INCOMPLETE_INVENTORY');
}

export async function main(env=process.env) {
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateTrigger(event, env);
  const issues = (await pages('issues?state=open&labels=agent-handoff%2Chandoff-agent-pending',5))
    .filter(i=>!i.pull_request).map(i=>({...i,repository:HANDOFF_REPOSITORY}));
  const result = await processQueue(issues,{
    readComments: n=>pages('issues/'+n+'/comments',4),
    readIssue: async n=>({...await request('issues/'+n),repository:HANDOFF_REPOSITORY}),
    recordReceipt: (n,body)=>request('issues/'+n+'/comments',{method:'POST',body:{body}})
  });
  // Re-read current authoritative progress after selection. selected=0 does
  // not mean NO_WORK when an earlier selection still has no owner receipt.
  const board=await collectBoard({
    listIssues:()=>pages('issues?state=open&labels=agent-handoff%2Chandoff-agent-pending',2),
    readComments:n=>pages('issues/'+n+'/comments',4),
    readIssue:async n=>({...await request('issues/'+n),repository:HANDOFF_REPOSITORY}),
  },Date.now());
  const execution=ownerExecutionPlan(board);
  const output={...result,state:execution.state,execution,
    pcRuntimeVerified:false};
  process.stdout.write(JSON.stringify(output)+'\n');
  return output;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
