// Read-only planning gate. A PASS here is not permission to call providers:
// the real Windows entry must acquire and recheck a shared atomic reservation.
import { plannedR6BackfillCost, R6_ONE_SHOT } from "./contract.mjs";

const blocked = (code, costs = { bls: 0, dol: 0, total: 0 }) => ({
  status: "BLOCKED", code, expectedBlsRequests: costs.bls,
  expectedDolRequests: costs.dol, providerRequests: 0,
  allowProviderCalls: false,
});

export function assessR6BackfillAdmission({
  now = new Date(), dueGroups, globalQuotaLedger,
  quotaObservedAt, allUnregisteredBlsCallersTracked = false,
  r6RunRequests24h = null, r6RequestsCoveredByGlobalLedger = false,
  coreDbExistingAndVerified = false, sourceIdentityVerified = false,
  exclusiveCoreLaneVerified = false, atomicBlsReservationAvailable = false,
} = {}) {
  const costs = plannedR6BackfillCost(dueGroups);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    return blocked("R6_B_TIME_UNVERIFIED", costs);
  if (costs.total === 0)
    return { status: "NOOP", code: "R6_B_NOTHING_DUE", providerRequests: 0, allowProviderCalls: false };
  if (!sourceIdentityVerified || !coreDbExistingAndVerified)
    return blocked("R6_B_PC_SOURCE_OR_DB_UNVERIFIED", costs);
  if (!exclusiveCoreLaneVerified || !atomicBlsReservationAvailable)
    return blocked("R6_B_SHARED_RESERVATION_UNAVAILABLE", costs);
  if (!allUnregisteredBlsCallersTracked || !r6RequestsCoveredByGlobalLedger)
    return blocked("R6_B_QUOTA_COVERAGE_UNVERIFIED", costs);
  const observed = new Date(quotaObservedAt);
  if (!Number.isFinite(observed.getTime()) || observed.getTime() > now.getTime() ||
    now.getTime() - observed.getTime() > 2 * 60_000)
    return blocked("R6_B_QUOTA_SNAPSHOT_STALE", costs);
  const times = globalQuotaLedger?.providers?.BLS?.requestTimes;
  if (!Array.isArray(times) || !times.every(t => Number.isSafeInteger(t) && t <= now.getTime()))
    return blocked("R6_B_QUOTA_LEDGER_INVALID", costs);
  if (!Number.isSafeInteger(r6RunRequests24h) || r6RunRequests24h < 0)
    return blocked("R6_B_R6_RUN_LEDGER_UNVERIFIED", costs);
  const since = now.getTime() - 24 * 60 * 60_000;
  const used = times.filter(t => t >= since).length;
  if (r6RunRequests24h > used)
    return blocked("R6_B_QUOTA_LEDGER_INCONSISTENT", costs);
  const remaining = Math.max(0, R6_ONE_SHOT.blsUnregistered24hLimit - used);
  if (costs.bls > remaining)
    return { ...blocked("R6_B_BLS_QUOTA_INSUFFICIENT", costs),
      usedBlsRequests24h: used, remainingBlsRequests24h: remaining };
  return {
    status: "READY_FOR_ATOMIC_RECHECK",
    code: "R6_B_PREFLIGHT_PASS_NOT_EXECUTED",
    expectedBlsRequests: costs.bls,
    expectedDolRequests: costs.dol,
    expectedTotalRequests: costs.total,
    usedBlsRequests24h: used,
    remainingBlsRequests24h: remaining,
    providerRequests: 0,
    allowProviderCalls: false,
  };
}
