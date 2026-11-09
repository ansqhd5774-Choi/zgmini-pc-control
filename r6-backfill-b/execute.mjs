// INACTIVE, dependency-injected coordinator for a separately approved R6 B job.
// This file has no CLI, network, Windows, GitHub, SQLite or scheduler adapter.
// Its callbacks are NOT an authorization mechanism: the future trusted Windows
// entry must independently validate the immutable approval/source, preserve the
// Core resource lease, and verify every callback's real operation/effects.
import { plannedR6BackfillCost, R6_ONE_SHOT } from './contract.mjs';
import { sanitizeR6BackfillResult } from './report.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GROUPS = Object.freeze(Object.keys(R6_ONE_SHOT.groups));
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/.test(value)
  ? value : 'R6_B_UNCLASSIFIED';
const fail = code => { const error = Error(code); error.code = code; throw error; };
const validCount = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

function validateDuePlans(plans) {
  if (!Array.isArray(plans) || plans.length !== GROUPS.length ||
    new Set(plans.map(x => x?.groupName)).size !== GROUPS.length ||
    !plans.every(x => GROUPS.includes(x?.groupName) && typeof x?.due === 'boolean'))
    fail('R6_B_DUE_PLAN_INVALID');
  // The requested groups always originate from the six fixed-contract groups.
  // Existing BACKFILL successes/attempts must be excluded on a partial resume.
  const dueGroups = plans.filter(x => x.due).map(x => x.groupName);
  return { dueGroups, cost: plannedR6BackfillCost(dueGroups) };
}

function validateCollectionResult(result, dueGroups, cost) {
  const results = result?.groupResults;
  if (!Array.isArray(results) || results.length !== dueGroups.length ||
    new Set(results.map(x => x?.groupName)).size !== results.length ||
    !results.every(x => dueGroups.includes(x?.groupName)))
    fail('R6_B_COLLECTOR_GROUP_SCOPE_STOP');
  let bls = 0, dol = 0;
  for (const row of results) {
    const groupLimit = row.groupName === 'DOL_UI_WEEKLY_CLAIMS' ?
      R6_ONE_SHOT.maxDolRequests : R6_ONE_SHOT.groups[row.groupName];
    if (!['SUCCESS', 'PARTIAL', 'FAIL', 'SKIPPED_BLS_BUDGET', 'SKIPPED_LOCKED'].includes(row.status) ||
      !validCount(row.providerRequests, groupLimit))
      fail('R6_B_COLLECTOR_GROUP_RESULT_INVALID');
    if (row.groupName === 'DOL_UI_WEEKLY_CLAIMS') dol += row.providerRequests;
    else bls += row.providerRequests;
  }
  if (!validCount(result?.providerRequests, cost.total) ||
    result.providerRequests !== bls + dol || bls > cost.bls || dol > cost.dol)
    fail('R6_B_COLLECTOR_REQUEST_COUNT_INVALID');
  const status = results.some(x => x.status === 'FAIL') ? 'FAIL' :
    results.some(x => x.status !== 'SUCCESS') ? 'PARTIAL' : 'SUCCESS';
  // Status may be weaker than the group details, but never accept an aggregate
  // SUCCESS claim when any group is incomplete.
  // With at least one due group, aggregate NOOP is contradictory even if its
  // group rows claim SUCCESS. Never promote that forged aggregate to SUCCESS.
  if (!['SUCCESS', 'PARTIAL', 'FAIL'].includes(result?.status) ||
    (result.status === 'SUCCESS' && status !== 'SUCCESS'))
    fail('R6_B_COLLECTOR_STATUS_INCONSISTENT');
  // A weaker aggregate PARTIAL/FAIL must never be promoted to SUCCESS merely
  // because every individual group row says SUCCESS.
  const reportedStatus = result.status === 'FAIL' ? 'FAIL' :
    result.status === 'PARTIAL' && status === 'SUCCESS' ? 'PARTIAL' : status;
  return { status: reportedStatus, results, bls, dol };
}

function verifyEffects(audit, counts) {
  // No default-zero or inferred effect counts: only the independent trusted B
  // host can assert real provider attempt counts and forbidden-write absence.
  if (audit?.providerRequestsVerified !== true || audit?.localRawDbEffectsVerified !== true ||
    audit?.d1Writes !== 0 || audit?.schedulerWrites !== 0 ||
    audit?.coreSourceWrites !== 0 || audit?.blsRequests !== counts.bls ||
    audit?.dolRequests !== counts.dol)
    fail('R6_B_EFFECTS_NOT_VERIFIED');
}

function stateUnknown(requestId, code) {
  return { schema: 'ZGMINI_R6_BACKFILL_B_RESULT_V1', requestId,
    status: 'STATE_UNKNOWN', code: safeCode(code), providerRequests: null,
    groupResults: [], d1Writes: null, schedulerWrites: null, effectsVerified: false };
}

/**
 * Pure orchestration fixture for an independent, authorized B-grade host.
 * All callbacks are mandatory injected operations, not defaults or a bypass:
 * - verifyApprovedScope: trusted immutable approval SHA and request checks
 * - verifyProtectedHost: installed source, existing DB, exclusive Core lane,
 *   full unregistered-BLS caller coverage + approved shared journal
 * - planDueGroups: existing R6 BACKFILL planner (may initialize SQLite)
 * - inspectQuotaAdmission: due-only 25/24h read-only snapshot admission
 * - claimOneShot: durable, globally unique no-retry claim BEFORE any DB planner
 * - reserveBlsBatch: atomic, durable shared lease reservation
 * - quotaAdapter: installed shared quota instance exposing fetchR6WithLease
 * - collectBackfill: existing runEmploymentR6CollectionStep
 * - auditEffects: trusted post-run provider/DB/D1/Task/source verification
 *
 * No callback before approved scope and protected-host verification may plan
 * or modify the DB. The first planner may initialize SQLite, so the one-shot
 * claim must precede it; its input is the approved request, NOT a due-group
 * result that cannot yet be known. Reservation precedes the lease fetch.
 * Any unknown effect after a claim attempt is STATE_UNKNOWN; never retry/refund.
 */
export async function coordinateR6BackfillOnce({
  requestId, verifyApprovedScope, verifyProtectedHost, planDueGroups,
  inspectQuotaAdmission, claimOneShot, reserveBlsBatch, quotaAdapter,
  collectBackfill, auditEffects,
} = {}) {
  if (!UUID.test(requestId ?? ''))
    return stateUnknown(null, 'R6_B_REQUEST_ID_INVALID');
  const required = [verifyApprovedScope, verifyProtectedHost, planDueGroups,
    inspectQuotaAdmission, claimOneShot, reserveBlsBatch, collectBackfill,
    auditEffects, quotaAdapter?.fetchR6WithLease];
  if (required.some(fn => typeof fn !== 'function'))
    return stateUnknown(requestId, 'R6_B_HOST_CALLBACK_UNAVAILABLE');

  let claimAttempted = false;
  try {
    const approved = await verifyApprovedScope({ requestId });
    if (approved?.status !== 'APPROVED_B_SCOPE_VERIFIED' || approved.requestId !== requestId)
      fail('R6_B_APPROVAL_UNVERIFIED');
    const host = await verifyProtectedHost({ requestId, approved });
    if (host?.status !== 'PROTECTED_HOST_VERIFIED' ||
      host?.coreLaneExclusive !== true || host?.allBlsCallersTracked !== true ||
      host?.sharedJournalVerified !== true)
      fail('R6_B_HOST_OR_SHARED_QUOTA_UNVERIFIED');

    // Even the BACKFILL *planner* may call store.initialize(), which can
    // mutate SQLite before any provider request. A crash at that point must
    // never leave the approval unclaimed and replayable with a new Issue ID.
    // A failed or ambiguous claim callback may already have fsynced its marker.
    claimAttempted = true;
    const claim = await claimOneShot({ requestId, approved });
    if (claim?.status !== 'CLAIMED_NO_RETRY' || claim.requestId !== requestId)
      fail('R6_B_ONESHOT_CLAIM_UNVERIFIED');

    const plans = await planDueGroups({ requestId, mode: 'BACKFILL', groups: [...GROUPS], approved, host });
    const { dueGroups, cost } = validateDuePlans(plans);

    if (cost.total === 0) {
      // NOOP also consumed the approval before the potentially writing planner.
      const counts = { bls: 0, dol: 0 };
      const audit = await auditEffects({ requestId, mode: 'BACKFILL', dueGroups, cost,
        collected: null, noop: true });
      verifyEffects(audit, counts);
      return sanitizeR6BackfillResult({ requestId, status: 'NOOP', failureCode: 'R6_B_NOTHING_DUE',
        groupResults: [], providerRequests: 0, blsRequests: 0, dolRequests: 0,
        d1Writes: 0, schedulerWrites: 0 });
    }

    const admission = await inspectQuotaAdmission({ requestId, plans, dueGroups, cost, approved, host });
    if (admission?.status !== 'READY_FOR_ATOMIC_RECHECK' ||
      admission?.expectedBlsRequests !== cost.bls ||
      admission?.expectedDolRequests !== cost.dol || admission?.allowProviderCalls !== false)
      fail('R6_B_QUOTA_PREFLIGHT_NOT_READY');

    if (cost.bls > 0) {
      const reservation = await reserveBlsBatch({ requestId, count: cost.bls,
        maxDaily: R6_ONE_SHOT.blsUnregistered24hLimit });
      if (reservation?.requestId !== requestId || reservation?.reserved !== cost.bls)
        fail('R6_B_BATCH_RESERVATION_UNVERIFIED');
    }

    const fetchImpl = quotaAdapter.fetchR6WithLease(requestId);
    if (typeof fetchImpl !== 'function') fail('R6_B_LEASE_FETCH_UNAVAILABLE');
    const collected = await collectBackfill({ requestId, mode: 'BACKFILL',
      groups: dueGroups, fetchImpl });
    const verified = validateCollectionResult(collected, dueGroups, cost);
    const audit = await auditEffects({ requestId, mode: 'BACKFILL', dueGroups,
      cost, collected, noop: false });
    verifyEffects(audit, verified);

    return sanitizeR6BackfillResult({ requestId, status: verified.status,
      failureCode: verified.status === 'SUCCESS' ? 'R6_B_BACKFILL_STORED' :
        verified.status === 'PARTIAL' ? 'R6_B_BACKFILL_PARTIAL' : 'R6_B_BACKFILL_FAILED',
      providerRequests: verified.bls + verified.dol,
      blsRequests: verified.bls, dolRequests: verified.dol,
      groupResults: verified.results, d1Writes: 0, schedulerWrites: 0 });
  } catch (error) {
    // The claim attempt may be durable even if the callback threw; the planner
    // can also initialize SQLite. Never imply safe retry after either step.
    const code = safeCode(error?.code ?? error?.message);
    if (claimAttempted) return stateUnknown(requestId, code);
    return { ...stateUnknown(requestId, code), status: 'BLOCKED' };
  }
}
