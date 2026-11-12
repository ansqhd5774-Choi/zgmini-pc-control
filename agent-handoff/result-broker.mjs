import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseHandoff} from './contract.mjs';
import {parseAgentResult, resultDigest, verifyAgentResult} from './result-contract.mjs';
import {centralResultReceipt, originResultReceipt} from './result-receipts.mjs';

const REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';
const PUBLIC_FEATURE_REPOSITORY = 'ansqhd5774-Choi/zgmini';
const API = 'https://api.github.com';
const OWNER = 'ansqhd5774-Choi';
const BOT = 'github-actions[bot]';

export function assertWorkflowResultRepository(result) {
  // Cross-repo reads are restricted to the known public feature repository.
  // Any other private repo would require a separate permission decision.
  if (result.pullRequest.repository !== result.testRun.repository ||
      ![REPOSITORY, PUBLIC_FEATURE_REPOSITORY].includes(result.pullRequest.repository)) {
    throw new Error('RESULT_CROSS_REPO_AUTH_NOT_CONFIGURED');
  }
}

async function publicEvidence(resource) {
  if (!/^\/repos\/ansqhd5774-Choi\/zgmini\/(?:pulls|actions\/runs)\/[1-9][0-9]*$/.test(resource)) {
    throw new Error('RESULT_PUBLIC_READ_SCOPE_STOP');
  }
  // A control-repository GITHUB_TOKEN cannot confer permissions on another
  // repository. These two public metadata reads need no credential.
  const response = await fetch(`${API}${resource}`, {headers: {
    Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}});
  if (!response.ok) throw new Error(`RESULT_PUBLIC_GITHUB_API_${response.status}_STOP`);
  return response.json();
}

async function api(resource, {method = 'GET', body} = {}) {
  if (!process.env.GITHUB_TOKEN) throw new Error('RESULT_GITHUB_TOKEN_STOP');
  const response = await fetch(`${API}${resource}`, {method,
    headers: {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})});
  if (!response.ok) throw new Error(`RESULT_GITHUB_API_${response.status}_STOP`);
  return response.status === 204 ? null : response.json();
}

// A routing receipt is complete only when the persisted bot comment is
// byte-for-byte the expected record in the exact original Issue. An ID/hash
// pair is a collision index, never sufficient proof of delivery.
const receiptIssueUrl = number =>
  `${API}/repos/${REPOSITORY}/issues/${number}`;
function completeReceipt(row, number, expectedBody) {
  return row.user?.login === BOT && row.issue_url === receiptIssueUrl(number) &&
    row.body === expectedBody;
}
async function inspectExistingResult(issueNumber, resultId, digest, expectedBody) {
  let verified = false;
  for (let page = 1; page <= 4; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('RESULT_COMMENT_LEDGER_STOP');
    for (const row of rows) {
      if (row.user?.login !== BOT || typeof row.body !== 'string' ||
          !row.body.startsWith('HANDOFF_RESULT_RECORDED\n')) continue;
      const lines = row.body.split('\n');
      // One handoff Issue represents one incident. A second valid-looking
      // resultId is a competing repair decision, not another first result.
      if (!lines.includes(`resultId: ${resultId}`))
        throw new Error('RESULT_INCIDENT_ALREADY_RECORDED_STOP');
      if (!lines.includes(`digest: ${digest}`)) throw new Error('RESULT_ID_COLLISION_STOP');
      if (!completeReceipt(row, issueNumber, expectedBody))
        throw new Error('RESULT_RECEIPT_BINDING_STOP');
      if (verified) throw new Error('RESULT_RECEIPT_DUPLICATE_STOP');
      verified = true;
    }
    if (rows.length < 100) return verified;
  }
  throw new Error('RESULT_COMMENT_SCAN_LIMIT_STOP');
}

async function inspectOriginReceipt(issueNumber, result, digest, handoffIssueNumber, expectedBody) {
  let verified = false;
  for (let page = 1; page <= 4; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('RESULT_ORIGIN_LEDGER_STOP');
    for (const row of rows) {
      if (row.user?.login !== BOT || typeof row.body !== 'string' ||
          !row.body.startsWith('HANDOFF_ORIGIN_RESULT_RECORDED\n')) continue;
      const lines = row.body.split('\n');
      // The owner review contract accepts one original return. A second
      // resultId would make even an earlier verified return unreadable.
      if (!lines.includes(`resultId: ${result.resultId}`))
        throw new Error('RESULT_ORIGIN_ALREADY_RETURNED_STOP');
      if (!lines.includes(`digest: ${digest}`))
        throw new Error('RESULT_ORIGIN_ID_COLLISION_STOP');
      if (!lines.includes(`incidentId: ${result.incidentId}`) ||
          !lines.includes(`handoffIssue: ${handoffIssueNumber}`))
        throw new Error('RESULT_ORIGIN_RECEIPT_BINDING_STOP');
      if (!completeReceipt(row, issueNumber, expectedBody))
        throw new Error('RESULT_ORIGIN_RECEIPT_BINDING_STOP');
      if (verified) throw new Error('RESULT_ORIGIN_RECEIPT_DUPLICATE_STOP');
      verified = true;
    }
    if (rows.length < 100) return verified;
  }
  throw new Error('RESULT_ORIGIN_LEDGER_SCAN_LIMIT_STOP');
}

async function verifyWriterBSourceAtOrigin(number, requestId, sourceSha, code) {
  let matched = null;
  for (let page = 1; page <= 4; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues/${number}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('RESULT_WRITER_RECEIPT_LEDGER_STOP');
    for (const item of rows) {
      if (item.user?.login !== BOT || typeof item.body !== 'string' || item.body.length > 4096 ||
          item.body.split('\n', 1)[0] !== `<!-- zgmini-writer-b-install:${requestId} -->` ||
          item.issue_url !== `https://api.github.com/repos/${REPOSITORY}/issues/${number}` ||
          !item.body.includes('DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n') ||
          !/^RESULT_CREATED: [0-2]\/2; RESULT_READBACK: 2\/2$/m.test(item.body) ||
          !item.body.includes(` (${code})`)) continue;
      const marker = item.body.match(/^RUN_ID: ([1-9][0-9]{0,17}); RETRY: NO_REEXECUTE$/m);
      if (!marker) continue;
      const runId = Number(marker[1]);
      if (!Number.isSafeInteger(runId) || matched !== null) {
        throw new Error('RESULT_WRITER_RECEIPT_AMBIGUOUS_STOP');
      }
      matched = runId;
    }
    if (rows.length < 100) break;
    if (page === 4) throw new Error('RESULT_WRITER_RECEIPT_SCAN_LIMIT_STOP');
  }
  if (matched === null) throw new Error('RESULT_WRITER_RECEIPT_MISSING_STOP');
  const run = await api(`/repos/${REPOSITORY}/actions/runs/${matched}`);
  if (run?.id !== matched || run?.name !== 'ZGMINI Approved Writer B Source Overlay Once' ||
      run?.head_sha !== sourceSha || run?.head_branch !== 'main' || run?.event !== 'issues' ||
      run?.actor?.login !== OWNER || run?.repository?.full_name !== REPOSITORY ||
      run?.status !== 'completed' || run?.run_attempt !== 1) {
    throw new Error('RESULT_WRITER_SOURCE_PROVENANCE_STOP');
  }
}

// Return only to the authenticated original control Issue, never to arbitrary
// repository/issue targets from an owner-supplied JSON body.
async function verifiedOriginIssue(handoff, handoffIssueNumber) {
  if (handoff.origin.repository !== REPOSITORY ||
      handoff.failure.evidenceIssueNumber !== handoff.origin.issueNumber) return null;
  const number = handoff.origin.issueNumber;
  if (number === handoffIssueNumber) throw new Error('RESULT_ORIGIN_SELF_REFERENCE_STOP');
  const issue = await api(`/repos/${REPOSITORY}/issues/${number}`);
  if (issue?.number !== number || issue?.user?.login !== OWNER || issue?.pull_request ||
      typeof issue.body !== 'string' || issue.body.length > 8192) {
    throw new Error('RESULT_ORIGIN_ISSUE_NOT_AUTHORIZED');
  }
  let request;
  try { request = JSON.parse(issue.body); } catch { throw new Error('RESULT_ORIGIN_REQUEST_JSON_STOP'); }
  const pcJob = issue.labels?.some(x => x.name === 'pc-job') &&
    request?.schema === 'ZGMINI_PC_JOB_V1' &&
    request.sourceSha === handoff.origin.sourceSha &&
    request.sourceBranch === handoff.origin.branch &&
    [REPOSITORY, PUBLIC_FEATURE_REPOSITORY].includes(request.sourceRepository);
  const writerB = issue.title === 'pc-writer-source-install' &&
    issue.labels?.some(x => x.name === 'pc-writer-b-install') &&
    request?.schema === 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1' &&
    request.operation === 'pc-writer-source-install' && request.controlRepository === REPOSITORY;
  if ((!pcJob && !writerB) || request.requestId !== handoff.origin.requestId ||
      request.chatId !== handoff.origin.chatId ||
      (writerB && handoff.failure.kind !== 'COMMON_WRITER')) {
    throw new Error('RESULT_ORIGIN_REQUEST_BINDING_STOP');
  }
  if (writerB) await verifyWriterBSourceAtOrigin(number, request.requestId,
    handoff.origin.sourceSha, handoff.failure.code);
  return number;
}

function authorize(event, env) {
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_EVENT_NAME !== 'issue_comment' ||
      env.GITHUB_ACTOR !== OWNER || event.action !== 'created' ||
      event.repository?.private !== true || event.issue?.pull_request ||
      ![OWNER, BOT].includes(event.issue?.user?.login) ||
      event.comment?.user?.login !== OWNER ||
      !event.issue?.labels?.some((label) => label.name === 'agent-handoff') ||
      !Number.isSafeInteger(event.issue.number)) throw new Error('RESULT_EVENT_NOT_ALLOWED');
}

function assertBotIncidentBinding(event, handoff) {
  // Owner-signed result comments remain mandatory. A bot-created Issue must
  // match the source-only intake shape; this result broker does not claim to
  // independently reprove the original PC run or its Runtime success.
  if (event.issue.user.login !== BOT) return;
  if (event.issue.title !== `agent-handoff ${handoff.incidentId}` ||
      handoff.origin.repository !== REPOSITORY ||
      handoff.failure.evidenceIssueNumber !== handoff.origin.issueNumber) {
    throw new Error('RESULT_BOT_INCIDENT_BINDING_STOP');
  }
}

async function verifiedFeatureSourceRepository(handoff) {
  if (handoff.failure.kind !== 'FEATURE' || handoff.origin.repository !== REPOSITORY) return null;
  const origin = await api(`/repos/${REPOSITORY}/issues/${handoff.origin.issueNumber}`);
  if (origin?.number !== handoff.origin.issueNumber || origin?.user?.login !== OWNER ||
      origin?.pull_request || !origin?.labels?.some(x => x.name === 'pc-job') ||
      typeof origin?.body !== 'string' || origin.body.length > 8192) {
    throw new Error('RESULT_FEATURE_ORIGIN_NOT_AUTHORIZED');
  }
  let request;
  try {request = JSON.parse(origin.body);} catch {throw new Error('RESULT_FEATURE_ORIGIN_JSON_STOP');}
  if (request?.schema !== 'ZGMINI_PC_JOB_V1' ||
      request.requestId !== handoff.origin.requestId ||
      request.chatId !== handoff.origin.chatId ||
      request.sourceSha !== handoff.origin.sourceSha ||
      request.sourceBranch !== handoff.origin.branch ||
      ![REPOSITORY, PUBLIC_FEATURE_REPOSITORY].includes(request.sourceRepository)) {
    throw new Error('RESULT_FEATURE_ORIGIN_BINDING_STOP');
  }
  return request.sourceRepository;
}

export async function main(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) throw new Error('RESULT_EVENT_PATH_STOP');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  authorize(event, env);
  const handoff = parseHandoff(event.issue.body);
  assertBotIncidentBinding(event, handoff);
  const result = parseAgentResult(event.comment.body);
  assertWorkflowResultRepository(result);
  const digest = resultDigest(result);
  const featureSourceRepository = await verifiedFeatureSourceRepository(handoff);
  const repo = result.pullRequest.repository;
  const read = repo === PUBLIC_FEATURE_REPOSITORY ? publicEvidence : api;
  const [pr, run] = await Promise.all([
    read(`/repos/${repo}/pulls/${result.pullRequest.number}`),
    read(`/repos/${repo}/actions/runs/${result.testRun.runId}`)
  ]);
  const verified = verifyAgentResult(handoff, result, pr, run, {featureSourceRepository});
  const originalIssue = await verifiedOriginIssue(handoff, event.issue.number);
  const comment = centralResultReceipt(handoff,result,digest,repo,verified);
  const alreadyRecorded = await inspectExistingResult(
    event.issue.number, result.resultId, digest, comment);
  if (!alreadyRecorded) {
    try {
      await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/comments`,
        {method: 'POST', body: {body: comment}});
    } catch {
      // A POST response may be lost after GitHub stored the comment.
      // Reconcile the exact bot receipt; never blindly post it again.
      if (!await inspectExistingResult(event.issue.number, result.resultId, digest, comment))
        throw new Error('RESULT_COMMENT_POST_OUTCOME_UNKNOWN');
    }
    if (!await inspectExistingResult(event.issue.number, result.resultId, digest, comment))
      throw new Error('RESULT_COMMENT_READBACK_STOP');
  }
  if (originalIssue !== null) {
    const receipt = originResultReceipt(result,digest,repo,verified,event.issue.number);
    const delivered = await inspectOriginReceipt(
      originalIssue, result, digest, event.issue.number, receipt);
    if (!delivered) {
      try {
        await api(`/repos/${REPOSITORY}/issues/${originalIssue}/comments`,
          {method: 'POST', body: {body: receipt}});
      } catch {
        if (!await inspectOriginReceipt(originalIssue, result, digest,
          event.issue.number, receipt))
          throw new Error('RESULT_ORIGIN_POST_OUTCOME_UNKNOWN');
      }
      if (!await inspectOriginReceipt(originalIssue, result, digest,
        event.issue.number, receipt))
        throw new Error('RESULT_ORIGIN_COMMENT_READBACK_STOP');
    }
    process.stdout.write('HANDOFF_RESULT_RETURNED_TO_ORIGIN_PENDING_RUNTIME\n');
    return;
  }
  process.stdout.write(alreadyRecorded ? 'HANDOFF_RESULT_ALREADY_RECORDED\n' : 'HANDOFF_RESULT_RECORDED_PENDING_RUNTIME\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
