// Pure decision contract for reconciling a Controller backlog after SWITCHED,
// RECONNECTED and INTAKE_RESUMED. It has no filesystem, network or process I/O.
// The C-grade operator owns a separate exclusive recovery claim and must
// durably record a POSTING intent before any GitHub POST. Decisions here are
// not permission to retry a previously issued request automatically.

const fail = code => {throw Object.assign(new Error(code), {code});};
const need = (condition, code) => {if (!condition) fail(code);};
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isIssueNumber = value => Number.isSafeInteger(value) && value > 0;
const actor = 'ansqhd5774-Choi';
const resultBot = 'github-actions[bot]';
const baseFields = Object.freeze([
  'schema', 'requestId', 'chatId', 'operation',
  'sourceRepository', 'sourceBranch', 'sourceSha',
]);
const preimageFields = Object.freeze(['preimageManifestPath', 'preimageManifestSha256']);

// Matches the intentionally narrow 7-/9-field admission shape proposed by
// PR #1050. This is NOT an independent PC job-operation authorization: the
// installed A-grade worker performs its own operation/source checks.
export function validBacklogOriginalPcJob(body) {
  if (!isObject(body)) return false;
  const keys = Object.keys(body);
  const preimageScoped = body.operation === 'writer-install-preimage-readonly' &&
    keys.length === baseFields.length + preimageFields.length &&
    preimageFields.every(k => Object.hasOwn(body, k));
  const allowed = preimageScoped ? [...baseFields, ...preimageFields] : baseFields;
  if (keys.length !== allowed.length || !allowed.every(k => Object.hasOwn(body, k)) ||
      keys.some(k => !allowed.includes(k))) return false;
  if (preimageScoped && (typeof body.preimageManifestPath !== 'string' ||
    !/^approvals\/writer-preimage\/[a-z0-9][a-z0-9-]{3,79}\.json$/.test(body.preimageManifestPath) ||
    typeof body.preimageManifestSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(body.preimageManifestSha256))) return false;
  return body.schema === 'ZGMINI_PC_JOB_V1' &&
    typeof body.requestId === 'string' && /^[a-z0-9-]{8,80}$/.test(body.requestId);
}

export function verifiedClosedBacklogWindows(backlog, requestId) {
  need(isObject(backlog) && backlog.schema === 'ZGMINI_PC_BACKLOG_V1' &&
    backlog.requestId === requestId, 'POSTSWITCH_BACKLOG_IDENTITY_DRIFT');
  need(isObject(backlog.replays), 'POSTSWITCH_BACKLOG_REPLAYS_INVALID');
  const entries = Object.entries(backlog.replays);
  need(entries.every(([key, row]) => /^\d{1,10}$/.test(key) && isObject(row) &&
    ['POSTING', 'DONE', 'SKIPPED_RESULT_PRESENT'].includes(row.status)),
  'POSTSWITCH_BACKLOG_REPLAYS_INVALID');
  const windows = Array.isArray(backlog.windows) ? backlog.windows :
    [{pausedAt: backlog.pausedAt, resumedAt: backlog.resumedAt}];
  need(windows.length >= 1 && windows.length <= 8,
    'POSTSWITCH_BACKLOG_WINDOWS_INVALID');
  for (const window of windows) {
    const start = Date.parse(window?.pausedAt ?? ''), end = Date.parse(window?.resumedAt ?? '');
    need(Number.isFinite(start) && Number.isFinite(end) && end >= start,
      'POSTSWITCH_BACKLOG_WINDOW_NOT_CLOSED');
  }
  return windows.map(window => ({pausedAt: window.pausedAt, resumedAt: window.resumedAt}));
}

// Equivalent candidate filter to update.mjs::backlogIssueInPause.
export function originalIssueInPause(issue, windows) {
  if (!Array.isArray(windows)) return false;
  const created = Date.parse(issue?.created_at ?? '');
  return isIssueNumber(issue?.number) && !issue.pull_request && issue.user?.login === actor &&
    Array.isArray(issue.labels) && issue.labels.some(x => x?.name === 'pc-job') && Number.isFinite(created) &&
    !String(issue.title ?? '').startsWith('Maintenance replay ') &&
    windows.some(window => created >= Date.parse(window.pausedAt) - 2000 &&
      created <= Date.parse(window.resumedAt));
}

export function originalHasResult(comments) {
  need(Array.isArray(comments), 'POSTSWITCH_BACKLOG_RESULT_READBACK_UNAVAILABLE');
  return comments.some(comment => comment?.user?.login === resultBot &&
    typeof comment.body === 'string' && comment.body.includes('zgmini-pc-result:'));
}

export function exactReplayCandidates(maintenanceRequestId, original, issues) {
  need(Array.isArray(issues) && /^pc-update-[a-f0-9-]{36}$/.test(maintenanceRequestId) &&
    isIssueNumber(original?.number) && typeof original.body === 'string',
  'POSTSWITCH_BACKLOG_REPLAY_READBACK_UNAVAILABLE');
  const marker = `Maintenance replay ${maintenanceRequestId} original #${original.number}`;
  const unique = new Map();
  for (const issue of issues) {
    if (issue?.title !== marker || issue?.body !== original.body ||
      issue?.user?.login !== actor || issue.pull_request ||
      !Array.isArray(issue.labels) || !issue.labels.some(x => x?.name === 'pc-job')) continue;
    need(isIssueNumber(issue.number), 'POSTSWITCH_BACKLOG_REPLAY_ISSUE_INVALID');
    unique.set(issue.number, issue);
  }
  return [...unique.keys()].sort((a, b) => a - b);
}

/**
 * All GitHub pages and result comments MUST already have been read. Caller
 * supplies explicit completeness attestations to prevent an uncertain empty
 * search from authorizing duplicate POST. It must also CAS the original
 * #917 ledger and the owned backlog record at every durable transition.
 *
 * Result.action values:
 *   ALREADY_DONE — uniquely verified existing replay; do not POST.
 *   RESULT_PRESENT — original Issue has a trusted result; do not POST.
 *   LINK_LOST_ACK — existing POSTING has exactly one verified clone; do not POST.
 *   RECORD_RESULT_SKIP — first durable SKIPPED_RESULT_PRESENT record; do not POST.
 *   RECORD_POSTING_THEN_POST_ONCE — no previous attempt; no existing exact clone.
 */
export function planPostSwitchBacklogItem({maintenanceRequestId, original,
  backlog, cloneIssues, originalComments, cloneSearchComplete, resultReadComplete}) {
  const windows = verifiedClosedBacklogWindows(backlog, maintenanceRequestId);
  need(originalIssueInPause(original, windows), 'POSTSWITCH_BACKLOG_ORIGINAL_IDENTITY');
  need(cloneSearchComplete === true && resultReadComplete === true,
    'POSTSWITCH_BACKLOG_READBACK_INCOMPLETE');
  let body;
  try {body = JSON.parse(original.body);} catch {fail('POSTSWITCH_BACKLOG_ORIGINAL_BODY_INVALID');}
  need(validBacklogOriginalPcJob(body), 'POSTSWITCH_BACKLOG_ORIGINAL_REQUEST_INVALID');
  const exact = exactReplayCandidates(maintenanceRequestId, original, cloneIssues);
  const resultPresent = originalHasResult(originalComments);
  const existing = backlog.replays[String(original.number)];
  const common = {originalIssueNumber: original.number,
    originalRequestId: body.requestId, replayTitle:
    `Maintenance replay ${maintenanceRequestId} original #${original.number}`};

  if (existing?.status === 'DONE') {
    need(isIssueNumber(existing.replayIssueNumber) &&
      exact.length === 1 && exact[0] === existing.replayIssueNumber &&
      existing.originalRequestId === body.requestId,
    'POSTSWITCH_BACKLOG_DONE_NOT_VERIFIED');
    return {...common, action:'ALREADY_DONE', replayIssueNumber:exact[0]};
  }
  if (existing?.status === 'SKIPPED_RESULT_PRESENT') {
    need(resultPresent && exact.length === 0,
      'POSTSWITCH_BACKLOG_RESULT_SKIP_NOT_VERIFIED');
    return {...common, action:'RESULT_PRESENT', replayIssueNumber:null};
  }
  if (existing?.status === 'POSTING') {
    // An ACK may have been lost even if the GitHub POST was accepted. No
    // second POST is permitted, including when the readback finds zero.
    need(exact.length === 1 && existing.originalRequestId === body.requestId,
      'POSTSWITCH_BACKLOG_REPLAY_OUTCOME_UNKNOWN');
    return {...common, action:'LINK_LOST_ACK', replayIssueNumber:exact[0]};
  }
  need(existing === undefined, 'POSTSWITCH_BACKLOG_REPLAY_STATE_UNKNOWN');
  need(exact.length === 0, 'POSTSWITCH_BACKLOG_UNTRACKED_CLONE');
  if (resultPresent) return {...common, action:'RECORD_RESULT_SKIP', replayIssueNumber:null};
  return {...common, action:'RECORD_POSTING_THEN_POST_ONCE', replayIssueNumber:null};
}
