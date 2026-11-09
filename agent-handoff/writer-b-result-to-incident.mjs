// SOURCE_ONLY. Authenticated GitHub GET/readback bytes are supplied by the
// caller. This adapter cannot access the PC, run Writer B, or create Issues.
import {createHash} from 'node:crypto';
import {parseHandoff, fingerprintHandoff} from './contract.mjs';
import {prepareResourceWait} from '../shared-resource/lifecycle.mjs';

const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const BOT = 'github-actions[bot]';
const WORKFLOW = 'ZGMINI Approved Writer B Source Overlay Once';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
// Must also fit the existing handoff V1 failure.code maximum (79 chars).
const CODE = /^WRITER_B_[A-Z0-9_]{1,70}$/;
const MANIFEST = /^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const FAILURES = new Set(['WRITER_B_PREFLIGHT_STOP',
  'WRITER_B_INSTALL_STOP_RESTORED', 'WRITER_B_RECOVERY_REQUIRED']);
const NON_FAILURES = new Set(['WRITER_B_INSTALLED_VERIFIED', 'WRITER_B_STATE_UNKNOWN']);
const SETUP_REVIEW_ONLY = 'WRITER_B_SETUP_STOP';
const EXPECTED_SHARED_BUSY_NOOP = 'WRITER_B_SHARED_INSTALL_BUSY_NOOP_STOP';
const EXPECTED_CORE_IDLE_DEFER = 'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED';
const REQUIRED_KEYS = ['schema', 'requestId', 'chatId', 'operation',
  'controlRepository', 'approvalManifestPath', 'approvalManifestSha256'];
const MAX_COMMENT_ROWS = 500;
const MAX_JSON_BYTES = 65536;
const MAX_TXT_BYTES = 65536;
const MAX_MANIFEST_BYTES = 131072;

const stop = code => { throw new Error(`WRITER_B_HANDOFF_${code}`); };
const isIssue = x => Number.isSafeInteger(x) && x > 0;
const sha256 = x => createHash('sha256').update(x).digest('hex');
const exactKeys = (obj, keys) => obj && typeof obj === 'object' &&
  !Array.isArray(obj) && Object.keys(obj).length === keys.length &&
  keys.every(k => Object.hasOwn(obj, k));

export function assertCompletedWriterBEvent(event) {
  const run = event?.workflow_run;
  if (event?.action !== 'completed' || event.repository?.full_name !== REPO ||
      event.repository.private !== true || run?.name !== WORKFLOW ||
      run.event !== 'issues' || run.actor?.login !== OWNER ||
      run.head_repository?.full_name !== REPO ||
      !isIssue(run.id) || run.run_attempt !== 1 ||
      !SHA40.test(run.head_sha ?? '') ||
      typeof run.head_branch !== 'string' || run.head_branch !== 'main' ||
      typeof run.created_at !== 'string' ||
      !Number.isFinite(Date.parse(run.created_at))) stop('EVENT_NOT_ALLOWED');
  return Object.freeze({runId: run.id, controlSourceSha: run.head_sha,
    controlSourceBranch: run.head_branch, since: run.created_at});
}

function parseReceipt(comment, runId) {
  if (comment?.user?.login !== BOT || typeof comment.body !== 'string' ||
      typeof comment.issue_url !== 'string' || comment.body.length > 4096) return null;
  const firstLine = comment.body.split('\n', 1)[0];
  const marker = firstLine.match(/^<!-- zgmini-writer-b-install:([a-f0-9-]{36}) -->$/);
  if (!marker || !UUID.test(marker[1])) return null;
  const runLine = comment.body.match(/^RUN_ID: ([0-9]{1,18}); RETRY: NO_REEXECUTE$/m);
  if (!runLine || Number(runLine[1]) !== runId) return null;
  const origin = comment.issue_url.match(
    /^https:\/\/api\.github\.com\/repos\/ansqhd5774-Choi\/zgmini-pc-control\/issues\/([1-9][0-9]*)$/);
  const issueNumber = origin ? Number(origin[1]) : 0;
  if (!isIssue(issueNumber)) stop('RECEIPT_ORIGIN_INVALID');
  return Object.freeze({issueNumber, requestId: marker[1], comment});
}

/** Caller must provide a complete, bounded authenticated GitHub comment scan. */
export function findWriterBReceipt(comments, runId) {
  if (!Array.isArray(comments) || comments.length > MAX_COMMENT_ROWS ||
      !isIssue(runId)) stop('RECEIPT_INVENTORY_INVALID');
  const matches = comments.map(x => parseReceipt(x, runId)).filter(Boolean);
  if (matches.length > 1) stop('RECEIPT_DUPLICATE_STOP');
  return matches[0] ?? null;
}

function artifactText(artifact, path, ref, maxBytes) {
  // 'ref' is asserted so the caller cannot silently mix a floating main
  // manifest with the reviewed Writer B control commit.
  if (!artifact || artifact.path !== path || artifact.ref !== ref ||
      typeof artifact.content !== 'string' ||
      Buffer.byteLength(artifact.content) > maxBytes) stop('ARTIFACT_READBACK_INVALID');
  return artifact.content;
}

function oneLine(txt, key, expected) {
  const lines = txt.split(/\r?\n/).filter(x => x.startsWith(`${key}=`));
  if (lines.length !== 1 || lines[0] !== `${key}=${expected}`)
    stop('TXT_RESULT_MISMATCH_STOP');
}

/**
 * Convert only an authenticated, fully read-back Writer B failure into a
 * sanitized V1 handoff candidate. The Writer B reporter does not contain
 * PC lastPass/firstFail, so both MUST remain NOT_RECORDED (not inferred).
 * sourceSha refers to the completed control workflow run's head_sha, NOT
 * Writer B's possibly null local overlay sourceSha or the feature candidate.
 */
export function prepareWriterBFailureHandoff({event, originIssue, receipt,
  resultJson, resultTxt, manifestJson}) {
  const run = assertCompletedWriterBEvent(event);
  if (!originIssue || originIssue.repository !== REPO ||
      originIssue.user?.login !== OWNER || !isIssue(originIssue.number) ||
      originIssue.number !== receipt?.issueNumber ||
      originIssue.title !== 'pc-writer-source-install' ||
      !originIssue.labels?.some(x => x.name === 'pc-writer-b-install') ||
      typeof originIssue.body !== 'string' || originIssue.body.length > 8192)
    stop('ORIGIN_NOT_AUTHORIZED');
  let request;
  try { request = JSON.parse(originIssue.body); }
  catch { stop('ORIGIN_JSON_INVALID'); }
  if (!exactKeys(request, REQUIRED_KEYS) ||
      request.schema !== 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1' ||
      request.operation !== 'pc-writer-source-install' ||
      request.controlRepository !== REPO ||
      !UUID.test(request.requestId ?? '') ||
      request.requestId !== receipt.requestId ||
      !UUID.test(request.chatId ?? '') ||
      !MANIFEST.test(request.approvalManifestPath ?? '') ||
      !SHA64.test(request.approvalManifestSha256 ?? ''))
    stop('ORIGIN_REQUEST_INVALID');
  // Revalidate the receipt supplied by the complete inventory search.
  const verifiedReceipt = parseReceipt(receipt.comment, run.runId);
  if (!verifiedReceipt || verifiedReceipt.issueNumber !== originIssue.number ||
      verifiedReceipt.requestId !== request.requestId)
    stop('RECEIPT_MISMATCH_STOP');

  const manifestBytes = artifactText(manifestJson, request.approvalManifestPath,
    run.controlSourceSha, MAX_MANIFEST_BYTES);
  if (sha256(manifestBytes) !== request.approvalManifestSha256)
    stop('MANIFEST_SHA_MISMATCH_STOP');
  let approved;
  try { approved = JSON.parse(manifestBytes); }
  catch { stop('MANIFEST_JSON_INVALID'); }
  if (approved?.schema !== 'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1' ||
      approved.status !== 'APPROVED_B' ||
      approved.scope !== 'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY' ||
      approved.runCount !== 1 ||
      approved.sourceRepository !== 'ansqhd5774-Choi/zgmini' ||
      !SHA40.test(approved.candidateSourceSha ?? ''))
    stop('MANIFEST_NOT_APPROVED');

  const jsonPath = `results/writer-b-source-install-${request.requestId}.json`;
  const txtPath = `results/writer-b-source-install-${request.requestId}.txt`;
  const jsonBytes = artifactText(resultJson, jsonPath, 'main', MAX_JSON_BYTES);
  const txtBytes = artifactText(resultTxt, txtPath, 'main', MAX_TXT_BYTES);
  let result;
  try { result = JSON.parse(jsonBytes); }
  catch { stop('RESULT_JSON_INVALID'); }
  if (result?.schema !== 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1' ||
      result.requestId !== request.requestId ||
      result.runId !== String(run.runId) ||
      result.retry !== 'READ_ONLY_RECONCILE_NO_REEXECUTE' ||
      !CODE.test(result.code ?? '') ||
      ![...FAILURES, ...NON_FAILURES, SETUP_REVIEW_ONLY].includes(result.status))
    stop('RESULT_IDENTITY_INVALID');
  if ((result.status === 'WRITER_B_INSTALLED_VERIFIED' &&
       result.code !== 'WRITER_B_INSTALL_VERIFIED') ||
      (result.status === 'WRITER_B_STATE_UNKNOWN' &&
       result.code !== 'WRITER_B_RESULT_UNVERIFIED_STOP'))
    stop('RESULT_STATUS_CODE_MISMATCH_STOP');
  for (const [key, value] of [['REQUEST_ID', request.requestId],
    ['STATUS', result.status], ['CODE', result.code], ['RUN_ID', String(run.runId)],
    ['RETRY', result.retry]]) oneLine(txtBytes, key, value);
  // New Writer B reporters preserve exact restoration proof in both formats.
  // Historical reports without this field remain conservative: never infer
  // ORIGINAL_VERIFIED from a RESTORED-looking status alone.
  const recoveryLines = txtBytes.split(/\r?\n/).filter(x => x.startsWith('RECOVERY='));
  if (result.recovery !== undefined) {
    if (!['ORIGINAL_VERIFIED','RECONCILE_EXACT_REQUEST_NO_RETRY',
      'READ_ONLY_RECONCILE_LOCK_AND_SOURCE'].includes(result.recovery) ||
      recoveryLines.length !== 1 || recoveryLines[0] !== `RECOVERY=${result.recovery}`)
      stop('RECOVERY_PROOF_MISMATCH_STOP');
  } else if (recoveryLines.length > 0 && (recoveryLines.length !== 1 ||
      recoveryLines[0] !== 'RECOVERY=NONE')) stop('RECOVERY_PROOF_MISMATCH_STOP');
  if (result.status === 'WRITER_B_INSTALL_STOP_RESTORED' &&
      result.recovery !== undefined && result.recovery !== 'ORIGINAL_VERIFIED')
    stop('RESTORE_PROOF_INVALID');
  if (!verifiedReceipt.comment.body.includes('DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n') ||
      !/^RESULT_CREATED: [0-2]\/2; RESULT_READBACK: 2\/2$/m.test(verifiedReceipt.comment.body) ||
      verifiedReceipt.comment.body.split(/\r?\n/).filter(x =>
        x.startsWith('Writer B evidence: ')).length !== 1 ||
      !verifiedReceipt.comment.body.includes(
        `Writer B evidence: **${result.status}** (${result.code})\n`))
    stop('RECEIPT_READBACK_MISMATCH_STOP');
  // Setup STOP may reflect a rejected approval manifest, not a PC runtime
  // failure. Do not classify it as a shared Writer incident before the full
  // Writer B approval contract is independently revalidated.
  if (result.status === SETUP_REVIEW_ONLY) return Object.freeze({
    state: 'SETUP_REVIEW_REQUIRED', reportStatus: result.status,
    runId: run.runId, originIssueNumber: originIssue.number,
    pcOperationalWrites: 0, automaticPcRetries: 0});
  // Clean resource contention belongs to the shared-resource wait lifecycle,
  // not to the repair incident queue. Preclaim Core idle and shared lock busy
  // are untouched; postclaim Core idle is safe only with ORIGINAL_VERIFIED.
  const preclaimWait = result.status === 'WRITER_B_PREFLIGHT_STOP' &&
    [EXPECTED_SHARED_BUSY_NOOP, EXPECTED_CORE_IDLE_DEFER].includes(result.code);
  const restoredWait = result.status === 'WRITER_B_INSTALL_STOP_RESTORED' &&
    result.code === EXPECTED_CORE_IDLE_DEFER &&
    result.recovery === 'ORIGINAL_VERIFIED';
  if (preclaimWait || restoredWait) {
    const wait = prepareResourceWait({
      resourceKey:'writer-source',
      origin:{repository:REPO,issueNumber:originIssue.number,
        requestId:request.requestId,chatId:request.chatId,
        sourceSha:run.controlSourceSha,manifestSha256:request.approvalManifestSha256},
      evidence:{runId:run.runId,status:result.status,code:result.code,
        resultJsonPath:jsonPath,resultTxtPath:txtPath,
        resultPairReadbackVerified:true},
      safePoint:preclaimWait?'UNCLAIMED_UNTOUCHED':'CLAIMED_ORIGINAL_VERIFIED',
      ...(restoredWait?{recovery:'ORIGINAL_VERIFIED'}:{}),
      releaseCondition:result.code===EXPECTED_SHARED_BUSY_NOOP?
        'SHARED_WRITER_LOCK_RELEASE_VERIFIED':'CORE_IDLE_WINDOW_VERIFIED'});
    return Object.freeze({state:'WAITING_SHARED_RESOURCE',
      wait, reportStatus:result.status, code:result.code,
      runId:run.runId,originIssueNumber:originIssue.number,
      pcOperationalWrites:0,automaticPcRetries:0});
  }
  if (!FAILURES.has(result.status)) return Object.freeze({state: 'NOT_ELIGIBLE',
    reportStatus: result.status, runId: run.runId, originIssueNumber: originIssue.number,
    pcOperationalWrites: 0, automaticPcRetries: 0});

  const incidentSeed = JSON.stringify([REPO, originIssue.number, request.requestId,
    run.controlSourceSha, result.status, result.code]);
  const incidentId = `handoff-${sha256(incidentSeed).slice(0,24)}`;
  const handoff = parseHandoff(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_V1',
    incidentId, origin: {repository: REPO, issueNumber: originIssue.number,
      requestId: request.requestId, chatId: request.chatId,
      branch: run.controlSourceBranch, sourceSha: run.controlSourceSha,
      checkpoint: 'OTHER'},
    failure: {kind: 'COMMON_WRITER', code: result.code,
      lastPass: 'NOT_RECORDED', firstFail: 'NOT_RECORDED',
      fileRefs: [request.approvalManifestPath, jsonPath, txtPath],
      evidenceIssueNumber: originIssue.number}}));
  return Object.freeze({state: 'READY_TO_ENQUEUE', incidentId,
    fingerprint: fingerprintHandoff(handoff), body: JSON.stringify(handoff),
    reportStatus: result.status, runId: run.runId, originIssueNumber: originIssue.number,
    handling: result.status === 'WRITER_B_RECOVERY_REQUIRED' ?
      'READ_ONLY_RECOVERY_RECONCILE_NO_REEXECUTE' : 'SOURCE_DIAGNOSIS_ONLY',
    pcOperationalWrites: 0, automaticPcRetries: 0});
}
