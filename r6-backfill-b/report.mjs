// Sanitized local report projection. No GitHub upload or provider access here.
import { R6_ONE_SHOT } from "./contract.mjs";

const ALLOWED_STATUS = new Set(["SUCCESS", "PARTIAL", "FAIL", "NOOP", "BLOCKED", "STATE_UNKNOWN"]);
const ALLOWED_GROUP_STATUS = new Set([...ALLOWED_STATUS, "SKIPPED_BLS_BUDGET", "SKIPPED_LOCKED"]);
const code = input => typeof input === "string" && /^[A-Z][A-Z0-9_]{0,99}$/.test(input)
  ? input : "R6_B_UNCLASSIFIED";
const safeRequestId = input => typeof input === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input)
  ? input : null;
const count = (input, max) => Number.isSafeInteger(input) && input >= 0 && input <= max
  ? input : null;

export function sanitizeR6BackfillResult({ requestId, status, failureCode, groupResults = [],
  providerRequests = 0, blsRequests = 0, dolRequests = 0,
  d1Writes = null, schedulerWrites = null } = {}) {
  const validGroupResults = Array.isArray(groupResults) && groupResults.length <= 6 &&
    new Set(groupResults.map(x => x?.groupName)).size === groupResults.length &&
    groupResults.every(x => Object.hasOwn(R6_ONE_SHOT.groups, x?.groupName) &&
      ALLOWED_GROUP_STATUS.has(x?.status) &&
      count(x?.providerRequests, x.groupName === "DOL_UI_WEEKLY_CLAIMS"
        ? R6_ONE_SHOT.maxDolRequests : R6_ONE_SHOT.groups[x.groupName]) !== null);
  const validCounts = count(providerRequests, 20) !== null &&
    count(blsRequests, 18) !== null && count(dolRequests, 2) !== null &&
    providerRequests === blsRequests + dolRequests &&
    (validGroupResults && groupResults.reduce((sum, x) => sum + x.providerRequests, 0) === providerRequests) &&
    (!validGroupResults ||
      groupResults.filter(x => x.groupName === "DOL_UI_WEEKLY_CLAIMS")
        .reduce((sum, x) => sum + x.providerRequests, 0) === dolRequests);
  if (!validGroupResults || !validCounts || !ALLOWED_STATUS.has(status) ||
    (status === "SUCCESS" && (groupResults.length === 0 ||
      groupResults.some(x => x.status !== "SUCCESS"))) ||
    (status === "NOOP" && providerRequests !== 0) ||
    d1Writes !== 0 || schedulerWrites !== 0 || !safeRequestId(requestId)) {
    return { schema: "ZGMINI_R6_BACKFILL_B_RESULT_V1", requestId: safeRequestId(requestId),
      status: "STATE_UNKNOWN", code: "R6_B_RESULT_SCOPE_STOP", providerRequests: null,
      groupResults: [], d1Writes: null, schedulerWrites: null, effectsVerified: false };
  }
  return {
    schema: "ZGMINI_R6_BACKFILL_B_RESULT_V1", requestId,
    status, code: code(failureCode ?? (status === "SUCCESS" ? "R6_B_BACKFILL_STORED" : "R6_B_NOT_COMPLETE")),
    providerRequests, blsRequests, dolRequests,
    groupResults: groupResults.map(x => ({
      groupName: x.groupName, status: x.status, providerRequests: x.providerRequests,
      ...(x.failureCode ? { failureCode: code(x.failureCode) } : {}),
    })),
    d1Writes: 0, schedulerWrites: 0, effectsVerified: true,
  };
}
