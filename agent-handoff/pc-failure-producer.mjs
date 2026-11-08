// SOURCE_ONLY, not deployed. When enabled, runs as a bounded metadata-only
// workflow_run on the approved self-hosted runner. No PC job is retried.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {preparePcFailureHandoff, reconcileHandoffInventory,
  isExpectedFailureProof} from './pc-result-to-incident.mjs';

const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const BOT = 'github-actions[bot]';
const API = `https://api.github.com/repos/${REPO}`;
const MAX_PAGES = 5;
const MAX_BYTES = 65536;

function stop(code) { throw new Error(`PC_HANDOFF_PRODUCER_${code}`); }
const issueNumber = number => Number.isSafeInteger(number) && number > 0;

export function assertCompletedPcJobEvent(event) {
  const run = event?.workflow_run;
  if (event?.action !== 'completed' || event.repository?.full_name !== REPO ||
      event.repository?.private !== true || run?.name !== 'ZGMINI PC Job' ||
      run?.event !== 'issues' || run?.actor?.login !== OWNER ||
      run?.head_repository?.full_name !== REPO ||
      !issueNumber(run.id) || !Number.isSafeInteger(run.run_attempt) ||
      run.run_attempt < 1 || run.run_attempt > 999 ||
      typeof run.created_at !== 'string' ||
      !Number.isFinite(Date.parse(run.created_at))) stop('EVENT_NOT_ALLOWED');
  return {runId: run.id, attempt: run.run_attempt, since: run.created_at};
}

const marker = (runId, attempt, seat) =>
  `<!-- zgmini-pc-result:${runId}:${attempt}:${seat} -->`;

/**
 * Receive only a bounded, complete issue-comment inventory from GitHub.
 * Never use a comment body as an instruction or a substitute for the report.
 */
export function findOriginalIssueNumber(comments, {runId, attempt, seat}) {
  if (!Array.isArray(comments) || comments.length > MAX_PAGES * 100) {
    stop('COMMENT_INVENTORY_INCOMPLETE');
  }
  const exact = marker(runId, attempt, seat);
  const matches = comments.filter(x => x?.user?.login === BOT &&
    typeof x.body === 'string' && x.body.split('\n')[0] === exact &&
    typeof x.issue_url === 'string');
  if (matches.length > 1) stop('DUPLICATE_RECEIPTS');
  if (!matches.length) return null;
  const suffix = matches[0].issue_url.match(
    /^https:\/\/api\.github\.com\/repos\/ansqhd5774-Choi\/zgmini-pc-control\/issues\/([1-9][0-9]*)$/);
  const number = suffix ? Number(suffix[1]) : 0;
  if (!issueNumber(number)) stop('RECEIPT_ISSUE_INVALID');
  return number;
}

/**
 * A caller supplies GitHub I/O; no credentials or PC execution are available
 * to the converter. Only confirmed failure status can produce a new Issue.
 * Return states remain honest when uploads/receipts are absent.
 */
export async function processCompletedPcJob(event, {
  readReport, readComments, readIssue, listHandoffs, createHandoff
}) {
  const run = assertCompletedPcJobEvent(event);
  if ([readReport, readComments, readIssue, listHandoffs, createHandoff]
    .some(fn => typeof fn !== 'function')) stop('IO_NOT_CONFIGURED');
  const result = {state: 'SCAN_COMPLETED', runId: run.runId, attempt: run.attempt,
    reportsObserved: 0, confirmedFailures: 0, newIssues: 0, reusedIssues: 0,
    missingReceipts: 0, pcOperationalWrites: 0, automaticPcRetries: 0};
  let comments = null;
  for (let seat = 1; seat <= 6; seat++) {
    const resultPath = `results/${run.runId}-${run.attempt}-seat-${seat}.json`;
    const report = await readReport(resultPath);
    if (report === null) continue;
    result.reportsObserved++;
    // No Issue is created from BLOCKED, STATE_UNKNOWN or successful results.
    if (!['FAIL', 'RUNTIME_FAILED'].includes(report.status) ||
        isExpectedFailureProof(report.operation)) continue;
    result.confirmedFailures++;
    comments ??= await readComments(run.since);
    const original = findOriginalIssueNumber(comments, {...run, seat});
    if (original === null) { result.missingReceipts++; continue; }
    const originIssue = await readIssue(original);
    const prepared = preparePcFailureHandoff({originIssue, report, resultPath});
    if (prepared.state !== 'READY_TO_ENQUEUE') stop('STATE_DRIFT');
    const inventory = await listHandoffs();
    const decision = reconcileHandoffInventory(prepared, inventory);
    if (decision.state === 'REUSE_EXISTING') { result.reusedIssues++; continue; }
    let created;
    try { created = await createHandoff(prepared); }
    catch {
      // Lost POST response: read the ledger once, never blindly POST again.
      const after = reconcileHandoffInventory(prepared, await listHandoffs());
      if (after.state !== 'REUSE_EXISTING') stop('POST_OUTCOME_UNKNOWN');
      result.reusedIssues++;
      continue;
    }
    if (!issueNumber(created?.number)) stop('CREATE_RECEIPT_INVALID');
    const verified = await readIssue(created.number);
    if (verified?.repository !== REPO || verified?.user?.login !== BOT ||
        verified.body !== prepared.body ||
        !verified.labels?.some(x => x.name === 'agent-handoff')) {
      stop('CREATE_READBACK_STOP');
    }
    result.newIssues++;
  }
  if (!result.reportsObserved) result.state = 'NO_PUBLISHED_RESULTS';
  else if (result.confirmedFailures && result.missingReceipts) result.state = 'PARTIAL_RECEIPT_PENDING';
  return Object.freeze(result);
}

// Metadata-only adapter, never invoked by a pc-job Controller.
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

async function completePages(endpoint, label) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const part = await request(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(part)) stop(`${label}_INVENTORY_INVALID`);
    rows.push(...part);
    if (part.length < 100) return rows;
  }
  stop(`${label}_INVENTORY_LIMIT`);
}

export async function main(env = process.env) {
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_EVENT_NAME !== 'workflow_run' ||
      !env.GITHUB_EVENT_PATH) stop('ENVIRONMENT_NOT_ALLOWED');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const report = await processCompletedPcJob(event, {
    readReport: async resultPath => {
      const content = await request(`contents/${resultPath}?ref=main`, {missingOk: true});
      if (content === null) return null;
      if (content.encoding !== 'base64' || typeof content.content !== 'string' ||
          content.size > MAX_BYTES) stop('RESULT_CONTENT_INVALID');
      const decoded = Buffer.from(content.content.replace(/\s/g, ''), 'base64');
      if (decoded.length > MAX_BYTES) stop('RESULT_SIZE_STOP');
      return JSON.parse(decoded.toString('utf8'));
    },
    readComments: async since => completePages(
      `issues/comments?since=${encodeURIComponent(since)}`, 'COMMENT'),
    readIssue: async number => {
      const item = await request(`issues/${number}`);
      return {...item, repository: REPO};
    },
    listHandoffs: async () => ({repository: REPO, complete: true,
      issues: (await completePages('issues?state=all&labels=agent-handoff', 'HANDOFF'))
        .filter(x => !x.pull_request).map(x => ({...x, repository: REPO}))}),
    createHandoff: async prepared => request('issues', {method: 'POST',
      body: {title: `agent-handoff ${prepared.incidentId}`,
        labels: ['agent-handoff'], body: prepared.body}})
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (['PARTIAL_RECEIPT_PENDING', 'NO_PUBLISHED_RESULTS'].includes(report.state)) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
