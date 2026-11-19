// Metadata-only Writer B workflow_run on the approved isolated runner.
// Only verified failure evidence may create and directly route a bot Incident;
// no installer, Controller, PC job, or recovery action is executed.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertCompletedWriterBEvent, findWriterBReceipt,
  prepareWriterBFailureHandoff} from './writer-b-result-to-incident.mjs';
import {reconcileHandoffInventory} from './pc-result-to-incident.mjs';
import {persistResourceWait} from './resource-wait-ledger.mjs';
import {routeVerifiedBotIssue} from './bot-direct-route.mjs';
import {parseHandoff} from './contract.mjs';

const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const BOT = 'github-actions[bot]';
const API = `https://api.github.com/repos/${REPO}`;
const MAX_PAGES = 5;
const MAX_QUEUE_PAGES = 20;
const MAX_REPORT_BYTES = 65536;
const MAX_MANIFEST_BYTES = 131072;
const MANIFEST_PATH = /^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;

const stop = code => { throw new Error(`WRITER_B_HANDOFF_PRODUCER_${code}`); };
const positive = value => Number.isSafeInteger(value) && value > 0;
const rejectedWriterBReceipt = runId =>
  `<!-- zgmini-writer-b-request-rejected:${runId} -->\n` +
  'Writer B request: **REJECTED_BEFORE_PC** (WRITER_B_REQUEST_CONTRACT_STOP)\n' +
  'PC_INSTALL: NOT_EXECUTED; RESULT_PAIR: NOT_CREATED_INVALID_REQUEST\n' +
  `RUN_ID: ${runId}; RETRY: NO_REEXECUTE\n`;

// A contract rejection is deliberately emitted instead of a Writer B result
// pair. Verify the exact source reporter contract, bot author and origin URL.
function hasVerifiedRejection(comments, runId) {
  const expected = rejectedWriterBReceipt(runId);
  const matches = comments.filter(c =>
    c?.user?.login === BOT && c.body === expected &&
    /^https:\/\/api\.github\.com\/repos\/ansqhd5774-Choi\/zgmini-pc-control\/issues\/[1-9][0-9]*$/.test(c.issue_url ?? ''));
  if (matches.length > 1) stop('REJECTION_RECEIPT_DUPLICATE');
  return matches.length === 1;
}


function authorizedManifestPath(originIssue) {
  if (originIssue?.repository !== REPO ||
      originIssue.user?.login !== OWNER ||
      originIssue.title !== 'pc-writer-source-install' ||
      !originIssue.labels?.some(x => x.name === 'pc-writer-b-install') ||
      typeof originIssue.body !== 'string' || originIssue.body.length > 8192)
    stop('ORIGIN_NOT_AUTHORIZED');
  let request;
  try { request = JSON.parse(originIssue.body); }
  catch { stop('ORIGIN_BODY_INVALID'); }
  if (request?.schema !== 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1' ||
      request.operation !== 'pc-writer-source-install' ||
      request.controlRepository !== REPO ||
      !MANIFEST_PATH.test(request.approvalManifestPath ?? ''))
    stop('ORIGIN_MANIFEST_PATH_INVALID');
  return request.approvalManifestPath;
}

/** A verified completed Writer B run can generate *at most one* incident. */
export async function processCompletedWriterB(event, {
  readComments, readIssue, readFile, listHandoffs, createHandoff, getSourceJobs,
  listResourceWaitComments, createResourceWaitComment, readResourceWaitComment,
  routeHandoff
}) {
  const run = assertCompletedWriterBEvent(event);
  if ([readComments, readIssue, readFile, listHandoffs, createHandoff, getSourceJobs]
    .some(fn => typeof fn !== 'function')) stop('IO_NOT_CONFIGURED');
  const initial = {state: 'SCAN_COMPLETED', runId: run.runId,
    originalIssues: 0, verifiedResults: 0, confirmedFailures: 0,
    newIssues: 0, reusedIssues: 0, routesRecorded: 0, routesReused: 0,
    pcOperationalWrites: 0, automaticPcRetries: 0};

  // The source workflow fires on all owner-opened Issues. Most runs have a
  // skipped Writer B job, so absence of its exact bot receipt is not failure.
  // The source workflow multiplexes unrelated approved operations. Check the
  // exact Writer B reporter step before reading repository-wide comments.
  const sourceJobs=await getSourceJobs(run.runId);
  if(!Array.isArray(sourceJobs)||sourceJobs.length!==1||
    sourceJobs[0]?.name!=='writer-source-approved-b'||
    !Array.isArray(sourceJobs[0]?.steps))stop('SOURCE_JOBS_UNVERIFIED');
  const reportSteps=sourceJobs[0].steps.filter(x=>
    x?.name==='Create-only sanitized result and originating Issue comment');
  if(reportSteps.length!==1)stop('SOURCE_REPORT_STEP_UNVERIFIED');
  if(reportSteps[0].conclusion==='skipped')
    return Object.freeze({...initial,state:
      sourceJobs[0].conclusion==='success'?'UNRELATED_SOURCE_OPERATION':
      'SOURCE_REPORT_STATE_UNKNOWN'});
  if(reportSteps[0].conclusion!=='success'&&
     reportSteps[0].conclusion!=='failure'&&
     reportSteps[0].conclusion!=='cancelled')
    return Object.freeze({...initial,state:'SOURCE_REPORT_STATE_UNKNOWN'});
  const comments = await readComments(run.since,run.runId);
  const receipt = findWriterBReceipt(comments, run.runId);
  if (!receipt) {
    // Invalid Writer B admission emits a distinct authenticated rejection
    // receipt but no install result pair. Never mark that safe refusal broken.
    if (hasVerifiedRejection(comments, run.runId))
      return Object.freeze({...initial, state: 'REJECTED_BEFORE_PC'});
    // A completed Writer B job cannot silently succeed without either
    // reporter receipt. Keep failures visible without PC retries or guesses.
    if (['failure', 'timed_out'].includes(event.workflow_run.conclusion))
      stop('FAILED_RUN_RECEIPT_ABSENT');
    if (event.workflow_run.conclusion === 'success')
      stop('SUCCESSFUL_RUN_RECEIPT_ABSENT');
    // Unrelated Issue events may legitimately skip the Writer B source job.
    return Object.freeze({...initial, state: 'NO_VERIFIED_WRITER_B_RECEIPT'});
  }

  const originIssue = await readIssue(receipt.issueNumber);
  const manifestPath = authorizedManifestPath(originIssue);
  const resultPath = `results/writer-b-source-install-${receipt.requestId}`;
  const [resultJson, resultTxt, manifestJson] = await Promise.all([
    readFile(`${resultPath}.json`, 'main', MAX_REPORT_BYTES),
    readFile(`${resultPath}.txt`, 'main', MAX_REPORT_BYTES),
    readFile(manifestPath, run.controlSourceSha, MAX_MANIFEST_BYTES)
  ]);
  // Never treat a failed readback as a successful empty/unknown result.
  if (!resultJson || !resultTxt || !manifestJson) stop('EVIDENCE_PAIR_INCOMPLETE');
  const prepared = prepareWriterBFailureHandoff({event, originIssue, receipt,
    resultJson, resultTxt, manifestJson});
  const observed = {...initial, originalIssues: 1, verifiedResults: 1};
  if (prepared.state === 'SETUP_REVIEW_REQUIRED') return Object.freeze({...observed,
    state: 'SETUP_REVIEW_REQUIRED', reportStatus: prepared.reportStatus});
  if (prepared.state === 'NOT_ELIGIBLE') return Object.freeze({...observed,
    state: 'NOT_ELIGIBLE', reportStatus: prepared.reportStatus});
  // A normal busy/idle deferral belongs in the existing #68 coordination
  // ledger, NOT a repair Incident. Reuse exact immutable evidence/receipt.
  if (prepared.state === 'WAITING_SHARED_RESOURCE') {
    const ledger=await persistResourceWait(prepared.wait,{
      listComments:listResourceWaitComments,
      postComment:createResourceWaitComment,
      getComment:readResourceWaitComment});
    return Object.freeze({...observed, ...ledger,
      resourceKey:prepared.wait.resourceKey,
      reportStatus:prepared.reportStatus, automaticPcRetries:0});
  }
  if (prepared.state !== 'READY_TO_ENQUEUE') stop('ADAPTER_STATE_INVALID');
  observed.confirmedFailures = 1;
  const confirmRoute = async number => {
    if (typeof routeHandoff !== 'function') stop('ROUTE_NOT_CONFIGURED');
    const routed = await routeHandoff(prepared, number);
    if (routed?.state === 'ROUTE_RECORDED') observed.routesRecorded++;
    else if (routed?.state === 'ROUTE_REUSED') observed.routesReused++;
    else stop('ROUTE_RESULT_INVALID');
  };
  const decision = reconcileHandoffInventory(prepared, await listHandoffs(prepared,event.workflow_run.created_at));
  if (decision.state === 'REUSE_EXISTING') {
    if (decision.closed) return Object.freeze({...observed,
      state: 'REUSED_CLOSED_EXISTING', reusedIssues: 1});
    await confirmRoute(decision.issueNumber);
    return Object.freeze({...observed, state: 'REUSED_EXISTING', reusedIssues: 1});
  }
  if (decision.state !== 'CREATE_CANDIDATE_ONLY') stop('INVENTORY_STATE_INVALID');
  let created;
  try { created = await createHandoff(prepared); }
  catch {
    // A lost POST response is ambiguous, never automatically re-POST.
    const after = reconcileHandoffInventory(prepared, await listHandoffs());
    if (after.state !== 'REUSE_EXISTING') stop('POST_OUTCOME_UNKNOWN');
    if (after.closed) return Object.freeze({...observed,
      state: 'POST_RECONCILED_CLOSED_EXISTING', reusedIssues: 1});
    await confirmRoute(after.issueNumber);
    return Object.freeze({...observed, state: 'POST_RECONCILED', reusedIssues: 1});
  }
  if (!positive(created?.number)) stop('CREATE_RECEIPT_INVALID');
  const verified = await readIssue(created.number);
  if (verified?.repository !== REPO || verified.user?.login !== BOT ||
      verified.body !== prepared.body ||
      !verified.labels?.some(x => x.name === 'agent-handoff'))
    stop('CREATE_READBACK_STOP');
  await confirmRoute(created.number);
  return Object.freeze({...observed, state: 'ISSUE_CREATED_VERIFIED', newIssues: 1});
}

async function request(resource, {method = 'GET', body, missingOk = false} = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) stop('TOKEN_NOT_CONFIGURED');
  const response = await fetch(`${API}/${resource}`, {method,
    headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(25000)});
  if (missingOk && response.status === 404) return null;
  if (!response.ok) stop(`GITHUB_HTTP_${response.status}`);
  return response.json();
}

async function completePages(endpoint, category, maxPages=MAX_PAGES) {
  const rows = [];
  for (let page = 1; page <= maxPages; page++) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const part = await request(`${endpoint}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(part)) stop(`${category}_INVENTORY_INVALID`);
    rows.push(...part);
    if (part.length < 100) return rows;
  }
  stop(`${category}_INVENTORY_LIMIT`);
}

// Narrow GitHub search by the immutable Run ID. Search is discovery only:
// every returned candidate is re-read from its original Issue and validated.
export async function findRunReceiptComments(runId,{searchIssues,readIssueComments,readRecentComments}){
  if(!positive(runId)||typeof searchIssues!=='function'||
     typeof readIssueComments!=='function')stop('RECEIPT_LOOKUP_CONFIG');
  const result=await searchIssues(runId);
  if(!result||result.incomplete_results!==false||
     !Number.isSafeInteger(result.total_count)||result.total_count<0||
     result.total_count>100||!Array.isArray(result.items)||
     result.items.length!==result.total_count)
    stop('RECEIPT_SEARCH_INCOMPLETE');
  const seen=new Set(),comments=[];
  // Search indexing may trail the source comment. A single newest-first
  // discovery page is a bounded fallback, never an exhaustive global gate.
  let candidates=result.items;
  if(candidates.length===0&&typeof readRecentComments==='function'){
    const recent=await readRecentComments();
    if(!Array.isArray(recent)||recent.length>100)stop('RECENT_COMMENTS_INCOMPLETE');
    const ids=new Set();
    for(const c of recent){
      if(c?.user?.login!==BOT||typeof c.body!=='string'||
         !c.body.includes('RUN_ID: '+runId+'; RETRY: NO_REEXECUTE'))continue;
      const m=c.issue_url?.match(
        /^https:\/\/api\.github\.com\/repos\/ansqhd5774-Choi\/zgmini-pc-control\/issues\/([1-9][0-9]*)$/);
      if(m)ids.add(Number(m[1]));
    }
    candidates=await Promise.all([...ids].map(n=>Promise.resolve({
      number:n,title:'pc-writer-source-install',
      labels:[{name:'pc-writer-b-install'}]})));
  }
  for(const issue of candidates){
    if(!positive(issue?.number)||issue.pull_request||
       seen.has(issue.number)||issue.title!=='pc-writer-source-install'||
       !issue.labels?.some(x=>x.name==='pc-writer-b-install'))
      continue;
    seen.add(issue.number);
    const rows=await readIssueComments(issue.number);
    if(!Array.isArray(rows))stop('RECEIPT_ISSUE_COMMENTS_INVALID');
    comments.push(...rows.filter(x=>
      typeof x?.body==='string'&&
      x.body.includes('RUN_ID: '+runId+'; RETRY: NO_REEXECUTE')));
    if(comments.length>500)stop('RECEIPT_MATCH_LIMIT');
  }
  return comments;
}
// Query the immutable requestId, not every historical Incident.
// GitHub search may lag new writes; a newest-first direct Issue page covers
// recent candidates, and an unbounded same-run window fails closed.
export async function scopedWriterBIncidents(prepared,runCreatedAt,{
  searchIssues,listRecentIssues,readIssue
}){
  if(prepared?.state!=='READY_TO_ENQUEUE'||
     [searchIssues,listRecentIssues,readIssue].some(x=>typeof x!=='function')||
     !Number.isFinite(Date.parse(runCreatedAt)))stop('SCOPED_INCIDENT_IO');
  const requestId=parseHandoff(prepared.body).origin.requestId;
  const search=await searchIssues(requestId);
  if(!search||search.incomplete_results!==false||
     !Number.isSafeInteger(search.total_count)||search.total_count<0||
     search.total_count>100||!Array.isArray(search.items)||
     search.items.length!==search.total_count)
    stop('SCOPED_INCIDENT_SEARCH_INCOMPLETE');
  const recent=await listRecentIssues();
  if(!Array.isArray(recent)||recent.length>100)
    stop('SCOPED_INCIDENT_RECENT_INVALID');
  // If 100 newer issues exist since the source run, the recent window is
  // insufficient to cover an index-lagged duplicate. Never infer absence.
  if(recent.length===100&&
     Date.parse(recent.at(-1)?.created_at||'')>Date.parse(runCreatedAt))
    stop('SCOPED_INCIDENT_RECENT_WINDOW_INCOMPLETE');
  const candidates=new Map();
  for(const row of [...search.items,...recent]){
    if(!positive(row?.number)||row.pull_request)continue;
    candidates.set(row.number,row);
  }
  const verified=[];
  for(const n of candidates.keys()){
    const issue=await readIssue(n);
    if(!issue||issue.number!==n||
       ![OWNER,BOT].includes(issue.user?.login)||
       !issue.labels?.some(x=>x.name==='agent-handoff')||
       typeof issue.body!=='string')continue;
    let parsed;try{parsed=parseHandoff(issue.body);}catch{continue;}
    if(parsed.origin.requestId===requestId)verified.push({...issue,repository:REPO});
  }
  return {repository:REPO,complete:true,issues:verified};
}
async function fileReadback(filePath, ref, maxBytes) {
  const content = await request(`contents/${filePath}?ref=${ref}`, {missingOk: true});
  if (!content) return null;
  if (content.encoding !== 'base64' || typeof content.content !== 'string' ||
      !Number.isSafeInteger(content.size) || content.size < 0 ||
      content.size > maxBytes) stop('RESULT_CONTENT_INVALID');
  const decoded = Buffer.from(content.content.replace(/\s/g, ''), 'base64');
  if (decoded.length !== content.size || decoded.length > maxBytes)
    stop('RESULT_SIZE_MISMATCH');
  return Object.freeze({path: filePath, ref, content: decoded.toString('utf8')});
}

export async function main(env = process.env) {
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_EVENT_NAME !== 'workflow_run' ||
      !env.GITHUB_EVENT_PATH) stop('ENVIRONMENT_NOT_ALLOWED');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const listScopedHandoffs=(prepared,createdAt)=>
    scopedWriterBIncidents(prepared,createdAt,{
      searchIssues:async requestId=>{
        const q='repo:'+REPO+' is:issue label:agent-handoff in:body "'+requestId+'"';
        const res=await fetch('https://api.github.com/search/issues?q='+
          encodeURIComponent(q)+'&per_page=100',{headers:{
            Authorization:'Bearer '+process.env.GITHUB_TOKEN,
            Accept:'application/vnd.github+json',
            'X-GitHub-Api-Version':'2022-11-28'},
            signal:AbortSignal.timeout(25000)});
        if(!res.ok)stop('SCOPED_INCIDENT_HTTP_'+res.status);
        return res.json();
      },
      listRecentIssues:()=>request(
        'issues?state=all&labels=agent-handoff&sort=created&direction=desc&per_page=100'),
      readIssue:n=>request('issues/'+n)
    });
  const result = await processCompletedWriterB(event, {
    getSourceJobs: async id => {
      const result=await request(`actions/runs/${id}/jobs?per_page=100`);
      if(!Array.isArray(result?.jobs)||result.jobs.length!==1)
        stop('SOURCE_JOBS_INCOMPLETE');
      return result.jobs;
    },
    readComments: (_since,id)=>findRunReceiptComments(id,{
      searchIssues:async runId=>{
        const q='repo:'+REPO+' is:issue in:comments "RUN_ID: '+runId+'"';
        const url='https://api.github.com/search/issues?q='+
          encodeURIComponent(q)+'&per_page=100';
        const res=await fetch(url,{headers:{
          Authorization:'Bearer '+process.env.GITHUB_TOKEN,
          Accept:'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28'},
          signal:AbortSignal.timeout(25000)});
        if(!res.ok)stop('RECEIPT_SEARCH_HTTP_'+res.status);
        return res.json();
      },
      readIssueComments:n=>completePages('issues/'+n+'/comments','ORIGIN_COMMENTS'),
      readRecentComments:async()=>{
        const rows=await request('issues/comments?sort=created&direction=desc&per_page=100');
        if(!Array.isArray(rows)||rows.length>100)stop('RECENT_COMMENTS_INVALID');
        return rows;
      }
    }),
    readIssue: async issue => ({...await request(`issues/${issue}`), repository: REPO}),
    readFile: fileReadback,
    listHandoffs:listScopedHandoffs,
    createHandoff: async prepared => request('issues', {method: 'POST',
      body: {title: `agent-handoff ${prepared.incidentId}`,
        labels: ['agent-handoff'], body: prepared.body}}),
    routeHandoff: (prepared, number) => routeVerifiedBotIssue(prepared, number, {
      readIssue: async n => ({...await request(`issues/${n}`), repository: REPO}),
      listHandoffs:()=>listScopedHandoffs(prepared,event.workflow_run.created_at),
      listIssueComments: n => completePages(`issues/${n}/comments`, 'ROUTE_COMMENTS', 4),
      postIssueComment: (n, body) => request(`issues/${n}/comments`, {method:'POST', body:{body}}),
      addIssueLabel: (n, label) => request(`issues/${n}/labels`, {method:'POST', body:{labels:[label]}})
    }),
    listResourceWaitComments: () => completePages('issues/68/comments',
      'RESOURCE_WAIT', MAX_QUEUE_PAGES),
    createResourceWaitComment: body => request('issues/68/comments',
      {method:'POST',body:{body}}),
    readResourceWaitComment: id => request(`issues/comments/${id}`)
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
