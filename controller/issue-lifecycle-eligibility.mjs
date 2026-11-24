/**
 * Pure, offline-only lifecycle eligibility classifier.
 * NOT connected to upload.mjs, GitHub mutations or operating PCs.
 * Every caller must bind trusted issue, approved intent and verified artifacts.
 * Fail closed on ambiguous evidence. This module does not close issues.
 */
const APPROVED = Object.freeze({
  'process-inventory-readonly': new Set([
    'PROCESS_INVENTORY_COLLECTED',
    'CNN_B_RESOURCE_SNAPSHOT_COLLECTED',
    'CNN_B_CORE_READINESS_COLLECTED',
    'CNN_B_PREIMAGE_PINS_COLLECTED',
    'CNN_GIT_PREDICATE_EVIDENCE_COLLECTED',
    'D05_WRITER_CHECKPOINT_OBSERVED'
  ]),
  'core-runtime-source-readonly': new Set(['CORE_RUNTIME_SOURCE_VERIFIED']),
  'fear-greed-archive-status': new Set(['FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS']),
  'release-calendar-runtime-readonly': new Set(['RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY'])
});
const validText = value => typeof value === 'string' && value.length > 0;
const deny = reason => ({eligible:false,reason});
/**
 * @param {object} input
 * @param {object} input.issue - trusted GitHub Issue snapshot
 * @param {object} input.request - validated original request body
 * @param {object} input.result - complete result JSON from pinned remote file
 * @param {object} input.evidence - independently verified artifact and comment details
 * @param {object} input.intent - separate approved intent, NOT derived from the untrusted title
 * @returns {{eligible:boolean,reason:string}}
 */
export function classifyIssueCompletion({issue,request,result,evidence,intent} = {}) {
  if (!issue || !request || !result || !evidence || !intent) return deny('MISSING_INPUT');
  if (issue.state !== 'open' || !Number.isSafeInteger(issue.number) || issue.number < 1) return deny('ISSUE_NOT_OPEN');
  if (intent.autoCloseEnabled !== true) return deny('DEFAULT_OFF');
  if (intent.kind !== 'SINGLE_READONLY_DIAGNOSTIC' || intent.objectiveSatisfied !== true ||
      intent.approvedByIndependentPolicy !== true) return deny('OBJECTIVE_UNVERIFIED');
  if (request.schema !== 'ZGMINI_PC_JOB_V1' &&
      request.schema !== 'ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1') return deny('SCHEMA_NOT_APPROVED');
  if (!validText(request.requestId) || !validText(request.operation) ||
      request.requestId !== result.requestId || request.operation !== result.operation ||
      intent.requestId !== request.requestId) return deny('REQUEST_MISMATCH');
  if (!APPROVED[request.operation]?.has(result.code)) return deny('OPERATION_CODE_NOT_APPROVED');
  if (result.status !== 'PASS' || result.firstFail != null ||
      result.protectedStateUnchanged !== true) return deny('RESULT_NOT_SAFE_PASS');
  if (result.operationalWrites !== 0 || result.providerCalls !== 0 || result.d1Writes !== 0)
    return deny('UNSAFE_SIDE_EFFECTS');
  if (result.reportTransfer?.status === 'SUMMARY_ONLY' || evidence.reportTransfer === 'SUMMARY_ONLY')
    return deny('PARTIAL_EVIDENCE');
  // The deployed PC result contract carries jobId=run-<run>-<attempt>-seat-<seat>, not runId.
  const canonicalJobId = `run-${evidence.runId}-${evidence.attempt}-seat-${evidence.seat}`;
  if (evidence.issueNumber !== issue.number || evidence.requestId !== request.requestId ||
      !/^[0-9]{1,20}$/.test(String(evidence.runId ?? '')) ||
      result.jobId !== canonicalJobId || !Number.isSafeInteger(evidence.attempt) ||
      evidence.attempt < 1 || !Number.isSafeInteger(evidence.seat) || evidence.seat < 1 ||
      evidence.seat > 6) return deny('PROVENANCE_MISMATCH');
  if (evidence.jsonVerified !== true || evidence.txtVerified !== true ||
      evidence.commentVerified !== true || evidence.runConcludedSuccessfully !== true)
    return deny('RECEIPT_NOT_VERIFIED');
  if (intent.requiresRuntimeSourceVerified === true &&
      result.result?.runtimeSourceVerified !== true) return deny('RUNTIME_SOURCE_UNVERIFIED');
  if (intent.requiresCoreLockReleased === true &&
      result.result?.core?.lockPresent !== false) return deny('CORE_LOCK_NOT_RELEASED');
  return {eligible:true,reason:'ELIGIBLE_FOR_HUMAN_REVIEW_ONLY'};
}
export const approvedDiagnosticCodes = Object.freeze(Object.keys(APPROVED));
