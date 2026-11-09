// Pure, INACTIVE cutover-quarantine assessment. No filesystem, network, SQLite,
// scheduler or GitHub interaction. This cannot attest real caller coverage:
// only a separately approved Windows host may produce the two independent,
// freshly observed runtime proofs accepted here. Neither a GitHub Issue nor
// this function is an execution authority. The source's shared journal must
// already exist, be sealed and cover every physical BLS attempt since cutover.
import { plannedR6BackfillCost, R6_ONE_SHOT } from './contract.mjs';

export const R6_BLS_CUTOVER_CALLERS = Object.freeze([
  'CORE', 'GROWTH_MONTHLY', 'R4_ONE_YEAR',
]);
const DAY = 24 * 60 * 60 * 1000;
const FRESH = 2 * 60 * 1000;
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const finiteTime = value => typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const sameCallers = values => Array.isArray(values) &&
  values.length === R6_BLS_CUTOVER_CALLERS.length &&
  new Set(values).size === R6_BLS_CUTOVER_CALLERS.length &&
  R6_BLS_CUTOVER_CALLERS.every(value => values.includes(value));
const blocked = (code, cost = { bls: 0, dol: 0, total: 0 }) => Object.freeze({
  schema: 'ZGMINI_R6_BLS_CUTOVER_QUARANTINE_R1',
  status: 'BLOCKED', code, expectedBlsRequests: cost.bls,
  expectedDolRequests: cost.dol, providerRequests: 0,
  allowProviderCalls: false, allowDbWrites: false, executable: false,
});

// reviewedPins must be built inside a reviewed private host from its immutable
// manifest. Never copy it from Issue body, feature checkout or environment.
// Host/journal proof inputs must be independently acquired from real Runtime;
// fixture objects with these fields are only meaningful in unit tests.
export function assessR6BlsCutoverQuarantine({
  now, dueGroups, reviewedPins, hostProof, journalProof,
} = {}) {
  let cost;
  try { cost = plannedR6BackfillCost(dueGroups); }
  catch { return blocked('R6_B_QUARANTINE_GROUP_SCOPE_STOP'); }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    return blocked('R6_B_QUARANTINE_TIME_INVALID', cost);
  if (!cost.bls) return blocked('R6_B_QUARANTINE_NO_BLS_DUE', cost);
  if (!SHA40.test(reviewedPins?.preparedSourceSha ?? '') ||
      !SHA64.test(reviewedPins?.activationManifestSha256 ?? ''))
    return blocked('R6_B_QUARANTINE_REVIEWED_PINS_MISSING', cost);
  if (hostProof?.schema !== 'ZGMINI_BLS_UNREGISTERED_HOST_CUTOVER_PROOF_V1' ||
      hostProof.status !== 'INDEPENDENT_WINDOWS_RUNTIME_COVERAGE_VERIFIED' ||
      hostProof.preparedSourceSha !== reviewedPins.preparedSourceSha ||
      hostProof.activationManifestSha256 !== reviewedPins.activationManifestSha256 ||
      !sameCallers(hostProof.callers) ||
      hostProof.untrackedPcCallers !== 0 ||
      hostProof.externalEgressScope !== 'ALL_UNREGISTERED_BLS_EGRESS_VERIFIED' ||
      hostProof.untrackedExternalCallers !== 0 ||
      hostProof.continuousProtectionVerified !== true ||
      !finiteTime(hostProof.cutoverAt) || !finiteTime(hostProof.observedAt))
    return blocked('R6_B_QUARANTINE_COVERAGE_UNVERIFIED', cost);
  if (journalProof?.schema !== 'ZGMINI_BLS_UNREGISTERED_SHARED_JOURNAL_PROOF_V1' ||
      journalProof.status !== 'ANCHOR_AND_ATOMIC_HISTORY_VERIFIED' ||
      journalProof.preparedSourceSha !== reviewedPins.preparedSourceSha ||
      journalProof.activationManifestSha256 !== reviewedPins.activationManifestSha256 ||
      journalProof.cutoverAt !== hostProof.cutoverAt ||
      journalProof.continuousHistoryVerified !== true ||
      !SHA64.test(journalProof.anchorSha256 ?? '') ||
      !Number.isSafeInteger(journalProof.occupiedSlots24h) ||
      journalProof.occupiedSlots24h < 0 ||
      journalProof.occupiedSlots24h > R6_ONE_SHOT.blsUnregistered24hLimit ||
      !finiteTime(journalProof.observedAt))
    return blocked('R6_B_QUARANTINE_JOURNAL_UNVERIFIED', cost);
  const at = now.getTime();
  const cutover = Date.parse(hostProof.cutoverAt);
  const observations = [Date.parse(hostProof.observedAt), Date.parse(journalProof.observedAt)];
  if (cutover > at || observations.some(value => value < cutover || value > at || at - value > FRESH))
    return blocked('R6_B_QUARANTINE_OBSERVATION_STALE', cost);
  // This conservative 24h no-effect window avoids interpreting an absent old
  // unkeyed call log as zero. Every post-cutover call must be counted in the
  // sealed cross-process journal. No background polling or sleeping here.
  if (at - cutover < DAY)
    return blocked('R6_B_QUARANTINE_24H_NOT_ELAPSED', cost);
  const occupied = journalProof.occupiedSlots24h;
  const remaining = R6_ONE_SHOT.blsUnregistered24hLimit - occupied;
  if (cost.bls > remaining) return Object.freeze({
    ...blocked('R6_B_QUARANTINE_CAPACITY_INSUFFICIENT', cost),
    occupiedSlots24h: occupied, remainingSlots24h: remaining,
  });
  // An atomic reservation under the same journal lock is STILL mandatory,
  // immediately before the physical fetch. This is not an executable grant.
  return Object.freeze({
    schema: 'ZGMINI_R6_BLS_CUTOVER_QUARANTINE_R1',
    status: 'READY_FOR_ATOMIC_RECHECK_NOT_EXECUTABLE',
    code: 'R6_B_QUARANTINE_VERIFIED_READONLY',
    expectedBlsRequests: cost.bls, expectedDolRequests: cost.dol,
    occupiedSlots24h: occupied, remainingSlots24h: remaining,
    providerRequests: 0, allowProviderCalls: false,
    allowDbWrites: false, executable: false,
  });
}
