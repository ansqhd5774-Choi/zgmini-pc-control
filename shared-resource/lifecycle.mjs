// SOURCE_ONLY common lifecycle contract. This module performs no PC, GitHub,
// lease, task, source or network operations. A caller must authenticate the
// immutable result pair and its origin before constructing a wait record.
import {createHash} from 'node:crypto';

export const RESOURCE_WAIT_SCHEMA = 'ZGMINI_SHARED_RESOURCE_WAIT_V1';
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
// Existing pc-job uses non-UUID "pc-" IDs, while Writer B uses UUIDs.
const REQUEST_ID = /^[a-z0-9][a-z0-9-]{7,79}$/;
const CHAT_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const RESOURCE = /^[a-z][a-z0-9-]{2,63}(?:\/[a-z][a-z0-9-]{2,63})?$/;
const CODE = /^[A-Z][A-Z0-9_]{3,95}$/;
const RESULT = /^results\/[a-z0-9][a-z0-9._-]{0,180}\.(json|txt)$/;
const REPO = /^[a-zA-Z0-9_.-]{1,60}\/[a-zA-Z0-9_.-]{1,100}$/;
const stop = code => {throw new Error('SHARED_RESOURCE_' + code);};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const approvalHash = origin => origin?.manifestSha256 ??
  origin?.approvalFingerprintSha256;

/**
 * One record per verified original request; multiple requests may share an
 * intentKey and a resourceKey. Never use an Issue comment as a PC lock.
 */
export function prepareResourceWait({resourceKey, origin, evidence, safePoint,
  releaseCondition, recovery}) {
  if (!RESOURCE.test(resourceKey ?? '') ||
      !origin || !REPO.test(origin.repository ?? '') ||
      !Number.isSafeInteger(origin.issueNumber) || origin.issueNumber < 1 ||
      !REQUEST_ID.test(origin.requestId ?? '') ||
      !CHAT_ID.test(origin.chatId ?? '') ||
      !SHA40.test(origin.sourceSha ?? '') ||
      !SHA64.test(approvalHash(origin) ?? '') ||
      (origin.manifestSha256 != null && origin.approvalFingerprintSha256 != null) ||
      !evidence || !Number.isSafeInteger(evidence.runId) ||
      evidence.runId < 1 || !CODE.test(evidence.code ?? '') ||
      !CODE.test(evidence.status ?? '') ||
      !RESULT.test(evidence.resultJsonPath ?? '') ||
      !RESULT.test(evidence.resultTxtPath ?? '') ||
      evidence.resultJsonPath.slice(0, -5) !== evidence.resultTxtPath.slice(0, -4) ||
      evidence.resultPairReadbackVerified !== true ||
      !CODE.test(releaseCondition ?? '')) stop('WAIT_EVIDENCE_INVALID');
  // A completed pc-job Issue consumes its one-shot execution opportunity,
  // even without operational writes. Depending on the busy point, the
  // Controller may exit before acquiring a lease or recording its ledger.
  // It must not reuse Writer B's truly unclaimed preclaim status.
  if (!['UNCLAIMED_UNTOUCHED', 'REQUEST_CONSUMED_PREWORKER_UNTOUCHED',
        'CLAIMED_ORIGINAL_VERIFIED'].includes(safePoint) ||
      (safePoint !== 'CLAIMED_ORIGINAL_VERIFIED' && recovery != null) ||
      (safePoint === 'CLAIMED_ORIGINAL_VERIFIED' && recovery !== 'ORIGINAL_VERIFIED'))
    stop('SAFE_POINT_UNPROVEN');
  const identity = [origin.repository, origin.issueNumber, origin.requestId, resourceKey];
  const record = {
    schema: RESOURCE_WAIT_SCHEMA,
    waitId: 'resource-wait-' + digest(identity).slice(0, 24),
    intentKey: 'resource-intent-' +
      digest([resourceKey, approvalHash(origin), origin.sourceSha]).slice(0, 24),
    state: 'WAITING_SHARED_RESOURCE',
    resourceKey,
    origin: Object.freeze({...origin}),
    evidence: Object.freeze({...evidence}),
    safePoint,
    releaseCondition,
    originalStateVerified: safePoint === 'CLAIMED_ORIGINAL_VERIFIED',
    automaticPcRetries: 0,
    ownerReceipt: 'UNKNOWN',
    resume: 'OWNER_REPLAN_NEW_AUTHORIZED_REQUEST_ONLY',
  };
  return Object.freeze(record);
}

/** The inventory must be complete and derived from authenticated readback. */
export function reconcileResourceWait(candidate, inventory) {
  if (candidate?.schema !== RESOURCE_WAIT_SCHEMA ||
      candidate.state !== 'WAITING_SHARED_RESOURCE' ||
      !inventory || inventory.complete !== true ||
      !Array.isArray(inventory.records) || inventory.records.length > 500)
    stop('INVENTORY_UNVERIFIED');
  const matches = inventory.records.filter(r => r?.waitId === candidate.waitId);
  if (matches.length > 1) stop('DUPLICATE_WAIT_STOP');
  if (matches.length === 1) {
    if (JSON.stringify(matches[0]) !== JSON.stringify(candidate))
      stop('WAIT_CONFLICT_STOP');
    return Object.freeze({state: 'REUSE_EXISTING', waitId: candidate.waitId,
      automaticPcRetries: 0});
  }
  return Object.freeze({state: 'CREATE_CANDIDATE_ONLY',
    waitId: candidate.waitId, automaticPcRetries: 0});
}

/**
 * Source-only recheck. There is no authenticated runtime release observation
 * adapter yet. A caller-supplied VERIFIED_RELEASED string and copied SHA
 * values are NOT proof of a free lease, safe Core window or current source.
 * Until a resource-specific verified readback adapter is implemented, this
 * function must never grant READY_FOR_OWNER_REPLAN or authorize execution.
 */
export function reviewResourceWait(candidate, check) {
  if (candidate?.schema !== RESOURCE_WAIT_SCHEMA ||
      candidate.state !== 'WAITING_SHARED_RESOURCE' || !check ||
      !['VERIFIED_RELEASED', 'STILL_BUSY', 'UNVERIFIED'].includes(check.release) ||
      (check.sourceSha != null && !SHA40.test(check.sourceSha)) ||
      (check.manifestSha256 != null && !SHA64.test(check.manifestSha256)) ||
      (check.approvalFingerprintSha256 != null &&
       !SHA64.test(check.approvalFingerprintSha256)))
    stop('RECHECK_INVALID');
  if (check.release !== 'VERIFIED_RELEASED')
    return Object.freeze({state: 'WAITING_SHARED_RESOURCE',
      waitId: candidate.waitId, automaticPcRetries: 0});
  // Fail closed even when source/approval match the old wait: neither was
  // read back from the CURRENT running PC by this pure module.
  return Object.freeze({state: 'RECHECK_EVIDENCE_PENDING',
    waitId: candidate.waitId, automaticPcRetries: 0,
    ownerReceipt: 'UNKNOWN',
    nextAction: 'VERIFY_RESOURCE_RELEASE_CURRENT_SOURCE_AND_APPROVAL'});
}


/**
 * SOURCE-ONLY evidence coverage for a historical resource wait.
 *
 * Inputs are candidate readbacks, NOT independently authenticated by this
 * pure function. The caller must verify original GitHub Issue/Run/bot receipt
 * and both immutable result pairs, then current Windows source and approval.
 * Even a complete candidate is NOT proof of lease ownership/release and must
 * never authorize a PC job or a new owner request by itself.
 *
 * Writer B 'origin.sourceSha' pins the CONTROL workflow commit; pc-job
 * 'origin.sourceSha' pins the REQUESTED feature commit. The observed Windows
 * 'configSourceSha' is a third, separate source domain.
 */
export function summarizeResourceRecheckEvidence(wait, {
  originReadback, releaseObservation, currentApproval
} = {}) {
  if (wait?.schema !== RESOURCE_WAIT_SCHEMA ||
      wait.state !== 'WAITING_SHARED_RESOURCE' ||
      !/^resource-wait-[a-f0-9]{24}$/.test(wait.waitId ?? '') ||
      wait.automaticPcRetries !== 0) stop('RECHECK_WAIT_INVALID');
  const missing = [];
  const writerApproval = typeof wait.origin.manifestSha256 === 'string';
  const originSourceMatches = writerApproval ?
    originReadback?.controlSourceSha === wait.origin.sourceSha :
    originReadback?.requestedSourceSha === wait.origin.sourceSha &&
      SHA40.test(originReadback?.controlSourceSha ?? '');
  const originApprovalMatches = writerApproval ?
    originReadback?.manifestSha256 === wait.origin.manifestSha256 :
    originReadback?.approvalFingerprintSha256 ===
      wait.origin.approvalFingerprintSha256;
  const exactOrigin = originReadback &&
    originReadback.repository === wait.origin.repository &&
    originReadback.issueNumber === wait.origin.issueNumber &&
    originReadback.requestId === wait.origin.requestId &&
    originReadback.runId === wait.evidence.runId &&
    originReadback.status === wait.evidence.status &&
    originReadback.code === wait.evidence.code &&
    originReadback.resultJsonPath === wait.evidence.resultJsonPath &&
    originReadback.resultTxtPath === wait.evidence.resultTxtPath &&
    originSourceMatches && originApprovalMatches &&
    originReadback.botReceiptReadbackVerified === true &&
    originReadback.resultPairReadbackVerified === true;
  if (!exactOrigin) missing.push('ORIGINAL_ISSUE_RUN_RESULT_PAIR');

  // The A diagnostic is a two-sample Windows candidate, not a release grant.
  const observation = releaseObservation;
  const observed = observation &&
    observation.operation === 'shared-resource-release-readonly' &&
    Number.isSafeInteger(observation.runId) && observation.runId > 0 &&
    observation.runId !== wait.evidence.runId &&
    RESULT.test(observation.resultJsonPath ?? '') &&
    RESULT.test(observation.resultTxtPath ?? '') &&
    observation.resultJsonPath.slice(0, -5) ===
      observation.resultTxtPath.slice(0, -4) &&
    observation.resultPairReadbackVerified === true &&
    observation.status === 'PASS' &&
    observation.code === 'SHARED_RESOURCE_READONLY_SNAPSHOT' &&
    observation.resourceKey === wait.resourceKey &&
    observation.resourceState === 'CANDIDATE_CLEAR_NOT_AUTHORIZED' &&
    SHA40.test(observation.observedConfigSourceSha ?? '') &&
    observation.releaseVerified === false &&
    observation.ownerReplanAuthorized === false;
  if (!observed) missing.push('WINDOWS_READONLY_RELEASE_CANDIDATE');

  const current = currentApproval;
  const currentApprovalHash = writerApproval ?
    current?.manifestSha256 : current?.approvalFingerprintSha256;
  const approved = current &&
    current.currentReadbackVerified === true &&
    SHA40.test(current.controlSourceSha ?? '') &&
    SHA40.test(current.runtimeConfigSourceSha ?? '') &&
    SHA40.test(current.approvedRuntimeConfigSourceSha ?? '') &&
    SHA64.test(currentApprovalHash ?? '') &&
    current.runtimeConfigSourceSha === current.approvedRuntimeConfigSourceSha &&
    (!observed ||
      current.runtimeConfigSourceSha === observation.observedConfigSourceSha);
  if (!approved) missing.push('CURRENT_SOURCE_AND_APPROVAL_READBACK');

  const approvalChanged = approved &&
    currentApprovalHash !== approvalHash(wait.origin);
  const state = approvalChanged && exactOrigin ?
    'SOURCE_DRIFT_REVIEW' : 'RECHECK_EVIDENCE_PENDING';
  return Object.freeze({
    state, waitId: wait.waitId, resourceKey: wait.resourceKey,
    missing: Object.freeze(missing),
    historicalApprovalChanged: Boolean(approvalChanged),
    historicalManifestChanged: Boolean(writerApproval && approvalChanged),
    releaseVerified: false, ownerReplanAuthorized: false,
    ownerReceipt: 'UNKNOWN', automaticPcRetries: 0,
    nextAction: state === 'SOURCE_DRIFT_REVIEW' ?
      'OWNER_REVIEW_NEW_APPROVAL_AND_RELEASE_EVIDENCE' :
      'VERIFY_RELEASE_OWNERSHIP_AND_RUNTIME_AUTHORIZATION'
  });
}
