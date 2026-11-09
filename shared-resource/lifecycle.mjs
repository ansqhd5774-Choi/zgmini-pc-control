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
  // PC Controller consumes its request lease/ledger before reaching the
  // worker, even when that worker performs no operational writes. It must not
  // reuse Writer B's truly unclaimed preclaim status.
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
 * This cannot resume execution. The verifier is responsible for checking
 * actual lock release, source bytes and unchanged approval before calling.
 * A true release flag by itself cannot override source/approval drift.
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
  if (check.sourceSha !== candidate.origin.sourceSha ||
      (candidate.origin.manifestSha256 != null ?
        check.manifestSha256 !== candidate.origin.manifestSha256 :
        check.approvalFingerprintSha256 !== candidate.origin.approvalFingerprintSha256))
    return Object.freeze({state: 'SOURCE_DRIFT_REVIEW',
      waitId: candidate.waitId, automaticPcRetries: 0,
      nextAction: 'REVALIDATE_EXACT_SOURCE_AND_APPROVAL'});
  return Object.freeze({state: 'READY_FOR_OWNER_REPLAN',
    waitId: candidate.waitId, automaticPcRetries: 0,
    ownerReceipt: 'UNKNOWN',
    nextAction: 'OWNER_MAY_CREATE_NEW_AUTHORIZED_REQUEST'});
}
