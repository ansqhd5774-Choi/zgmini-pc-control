// SOURCE_ONLY: convert a verified, immutable pc-job report into a minimal
// handoff candidate. Nothing here creates Issues, opens SQLite, or retries PC.
import {createHash} from 'node:crypto';
import {parseHandoff, fingerprintHandoff} from './contract.mjs';

const CONTROL_REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const PRODUCER = 'github-actions[bot]';
const SUPPORTED_FAILURES = new Set(['FAIL', 'RUNTIME_FAILED']);
// These allowlisted PC operations deliberately generate failures/timeouts to
// prove the reporter. Their outcomes are not production incidents.
const EXPECTED_FAILURE_FIXTURES = new Set(['failure-proof', 'timeout-proof']);
const CHECKPOINTS = ['SOURCE', 'INSTALL', 'COLLECT', 'CALCULATE', 'STORE', 'D1', 'API', 'UI'];

function stop(message) { throw new Error(`PC_HANDOFF_${message}`); }
const validSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const validCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{2,79}$/.test(value);
const same = (value, expected, name) => { if (value !== expected) stop(`${name}_MISMATCH_STOP`); };

function kindFromCode(code) {
  if (/^(?:CONTROLLER_|CONTROL_|CORE_)/.test(code)) return 'COMMON_CONTROLLER';
  if (/^(?:RUNNER_|SEAT_)/.test(code)) return 'COMMON_RUNNER';
  if (/^(?:WRITER_|WRITE_)/.test(code)) return 'COMMON_WRITER';
  return 'FEATURE';
}

function checkpointFromFirstFail(firstFail) {
  for (const stage of CHECKPOINTS) {
    if (firstFail === stage || firstFail.startsWith(`${stage}_`) ||
        firstFail.endsWith(`_${stage}`)) return stage;
  }
  return 'OTHER';
}

/**
 * `originIssue` must be the GitHub-authenticated original owner pc-job Issue.
 * `report` must be its re-read published results/<run-attempt-seat>.json.
 * This adapter intentionally does not infer report identity from a filename.
 */
export function preparePcFailureHandoff({originIssue, report, resultPath}) {
  if (!originIssue || originIssue.repository !== CONTROL_REPO ||
      originIssue.user?.login !== OWNER || !Number.isSafeInteger(originIssue.number) ||
      originIssue.number < 1 || !Array.isArray(originIssue.labels) ||
      !originIssue.labels.some(x => x.name === 'pc-job') ||
      typeof originIssue.body !== 'string' || originIssue.body.length > 8192) {
    stop('ISSUE_NOT_AUTHORIZED');
  }
  let request;
  try { request = JSON.parse(originIssue.body); }
  catch { stop('REQUEST_JSON_INVALID'); }
  if (!request || request.schema !== 'ZGMINI_PC_JOB_V1' ||
      typeof request.requestId !== 'string' ||
      !/^[a-z0-9-]{8,80}$/.test(request.requestId) ||
      typeof request.chatId !== 'string' || !/^[a-z0-9-]{4,80}$/.test(request.chatId) ||
      !validSha(request.sourceSha) ||
      !['ansqhd5774-Choi/zgmini', CONTROL_REPO].includes(request.sourceRepository)) {
    stop('REQUEST_IDENTITY_INVALID');
  }
  if (!report || report.schema !== 'ZGMINI_PC_RESULT_V1' ||
      report.controlRepository !== CONTROL_REPO ||
      !Number.isSafeInteger(report.seat) || report.seat < 1 || report.seat > 6 ||
      typeof report.jobId !== 'string' ||
      !/^run-[0-9]{1,20}-[0-9]{1,3}-seat-[1-6]$/.test(report.jobId) ||
      !report.jobId.endsWith(`-seat-${report.seat}`) ||
      resultPath !== `results/${report.jobId.slice(4)}.json`) {
    stop('RESULT_PROVENANCE_INVALID');
  }
  same(report.requestId, request.requestId, 'REQUEST_ID');
  same(report.chatId, request.chatId, 'CHAT_ID');
  same(report.operation, request.operation, 'OPERATION');
  same(report.sourceRepository, request.sourceRepository, 'SOURCE_REPOSITORY');
  same(report.sourceBranch, request.sourceBranch, 'SOURCE_BRANCH');
  same(report.requestedSourceSha, request.sourceSha, 'SOURCE_SHA');
  if (!validSha(report.controlSourceSha)) stop('CONTROL_SHA_INVALID');
  if (!Number.isFinite(Date.parse(report.finishedAt)) ||
      typeof report.status !== 'string') stop('RESULT_STATUS_INVALID');

  // An uncertain, blocked or successful observation is NOT proof of a runtime
  // defect. Never silently promote those states to a repair request.
  if (!SUPPORTED_FAILURES.has(report.status) ||
      EXPECTED_FAILURE_FIXTURES.has(request.operation)) {
    return Object.freeze({state: 'NOT_ELIGIBLE', status: report.status,
      originIssueNumber: originIssue.number, resultPath});
  }
  if (!validCode(report.code) || !validCode(report.lastPass) ||
      !validCode(report.firstFail)) stop('FAILURE_FIELDS_INVALID');

  const incidentSeed = JSON.stringify([CONTROL_REPO, originIssue.number,
    request.requestId, request.sourceSha, report.code, report.firstFail]);
  const incidentId = `handoff-${createHash('sha256').update(incidentSeed).digest('hex').slice(0,24)}`;
  const handoff = parseHandoff(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId,
    // The originating pc-job Issue is in the control repository, even when its
    // approved source checkout was from the separate zgmini feature repo.
    origin: {repository: CONTROL_REPO, issueNumber: originIssue.number,
      requestId: request.requestId, chatId: request.chatId,
      branch: request.sourceBranch, sourceSha: request.sourceSha,
      checkpoint: checkpointFromFirstFail(report.firstFail)},
    failure: {kind: kindFromCode(report.code), code: report.code,
      lastPass: report.lastPass, firstFail: report.firstFail,
      fileRefs: [], evidenceIssueNumber: originIssue.number}}));
  return Object.freeze({state: 'READY_TO_ENQUEUE', incidentId,
    fingerprint: fingerprintHandoff(handoff), resultPath,
    originIssueNumber: originIssue.number, body: JSON.stringify(handoff)});
}

/** A complete, author-verified inventory is required before issue creation. */
export function reconcileHandoffInventory(prepared, inventory) {
  if (!prepared || prepared.state !== 'READY_TO_ENQUEUE' ||
      !inventory || inventory.complete !== true ||
      inventory.repository !== CONTROL_REPO || !Array.isArray(inventory.issues) ||
      inventory.issues.length > 500) stop('INVENTORY_INCOMPLETE');
  const matches = inventory.issues.filter(x => {
    if (!x || x.repository !== CONTROL_REPO ||
        ![OWNER, PRODUCER].includes(x.user?.login) ||
        !Number.isSafeInteger(x.number) || x.number < 1 ||
        !x.labels?.some(y => y.name === 'agent-handoff') ||
        typeof x.body !== 'string') return false;
    let item;
    try { item = parseHandoff(x.body); } catch { return false; }
    return item.incidentId === prepared.incidentId;
  });
  if (matches.length > 1) stop('DUPLICATE_INCIDENT_STOP');
  if (matches.length === 1) {
    const candidate = parseHandoff(matches[0].body);
    if (fingerprintHandoff(candidate) !== prepared.fingerprint ||
        JSON.stringify(candidate) !== prepared.body) stop('INCIDENT_COLLISION_STOP');
    return Object.freeze({state: 'REUSE_EXISTING', issueNumber: matches[0].number});
  }
  return Object.freeze({state: 'CREATE_CANDIDATE_ONLY', incidentId: prepared.incidentId});
}
