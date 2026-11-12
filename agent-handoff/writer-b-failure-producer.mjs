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
  readComments, readIssue, readFile, listHandoffs, createHandoff,
  listResourceWaitComments, createResourceWaitComment, readResourceWaitComment,
  routeHandoff
}) {
  const run = assertCompletedWriterBEvent(event);
  if ([readComments, readIssue, readFile, listHandoffs, createHandoff]
    .some(fn => typeof fn !== 'function')) stop('IO_NOT_CONFIGURED');
  const initial = {state: 'SCAN_COMPLETED', runId: run.runId,
    originalIssues: 0, verifiedResults: 0, confirmedFailures: 0,
    newIssues: 0, reusedIssues: 0, routesRecorded: 0, routesReused: 0,
    pcOperationalWrites: 0, automaticPcRetries: 0};

  // The source workflow fires on all owner-opened Issues. Most runs have a
  // skipped Writer B job, so absence of its exact bot receipt is not failure.
  const comments = await readComments(run.since);
  const receipt = findWriterBReceipt(comments, run.runId);
  if (!receipt) {
    // A failed/timed-out source workflow with no authenticated bot receipt is
    // an evidence gap, not a successful empty scan. Never invent an Incident
    // or retry the PC task; make the isolated intake failure observable.
    if (['failure', 'timed_out'].includes(event.workflow_run.conclusion))
      stop('FAILED_RUN_RECEIPT_ABSENT');
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
  const decision = reconcileHandoffInventory(prepared, await listHandoffs());
  if (decision.state === 'REUSE_EXISTING') {
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
  const result = await processCompletedWriterB(event, {
    readComments: since => completePages(
      `issues/comments?since=${encodeURIComponent(since)}`, 'COMMENTS'),
    readIssue: async issue => ({...await request(`issues/${issue}`), repository: REPO}),
    readFile: fileReadback,
    listHandoffs: async () => ({repository: REPO, complete: true,
      issues: (await completePages('issues?state=all&labels=agent-handoff',
        'HANDOFFS')).filter(x => !x.pull_request).map(x => ({...x, repository: REPO}))}),
    createHandoff: async prepared => request('issues', {method: 'POST',
      body: {title: `agent-handoff ${prepared.incidentId}`,
        labels: ['agent-handoff'], body: prepared.body}}),
    routeHandoff: (prepared, number) => routeVerifiedBotIssue(prepared, number, {
      readIssue: async n => ({...await request(`issues/${n}`), repository: REPO}),
      listHandoffs: async () => ({repository: REPO, complete: true,
        issues: (await completePages('issues?state=all&labels=agent-handoff', 'HANDOFFS'))
          .filter(x => !x.pull_request).map(x => ({...x, repository: REPO}))}),
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
