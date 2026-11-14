// Optional, SOURCE-ONLY reviewer for an *already completed* W02 approved A job.
// It neither requests nor executes pc-jobs. No filesystem, GitHub, SQLite,
// network, secrets, provider calls, D1 calls, or production writes.
// Do not use REVIEWABLE as proof of actual D1/API/UI equality or 100% completion.

const CONTROL_SHA = '8e2736a62a90798afe159ef4d96a8713265ca021';
const OP = 'source-inventory-runtime-readonly';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DAY = /^20\d\d-\d\d-\d\d$/;
const MAX_TEXT_BYTES = 6 * 1024 * 1024;
const MS_DAY = 86_400_000;
const SCOPE = 'ELIGIBLE_RESULT_COUNT_NOT_FULL_PARSER_REVALIDATION';

const empty = (code, state = 'UNVERIFIED') => Object.freeze({
  status: state,
  code,
  productionEquivalenceVerified: false,
  collectorExecuted: false,
  publisherExecuted: false,
  countsArePublicationEvents: false,
  finalFeatureCompletionApproved: false,
});
function exactDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}
function safeStamp(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000_000;
}
const bounded = (x, max) => Number.isSafeInteger(x) && x > 0 && x <= max;

/**
 * @param {unknown} receipt Existing, downloaded Windows A result JSON, not an Issue body.
 * @param {object} opts The original Issue's requestId and source SHA.
 * @returns {object} Bounded, non-sensitive classification; never reports raw rows.
 */
export function reviewTreasuryAuditReceipt(receipt, opts = {}) {
  if (!opts || typeof opts !== 'object' ||
      typeof opts.expectedRequestId !== 'string' ||
      !/^pc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(opts.expectedRequestId) ||
      !SHA40.test(opts.expectedSourceSha ?? '')) {
    return empty('ORIGINAL_REQUEST_IDENTITY_REQUIRED');
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
      receipt.schema !== 'ZGMINI_PC_RESULT_V1' ||
      receipt.requestId !== opts.expectedRequestId ||
      receipt.sourceRepository !== 'ansqhd5774-Choi/zgmini' ||
      receipt.sourceBranch !== 'main' ||
      receipt.requestedSourceSha !== opts.expectedSourceSha ||
      receipt.operation !== OP ||
      receipt.controlSourceSha !== CONTROL_SHA ||
      receipt.actualExecutionSha !== CONTROL_SHA) {
    return empty('A_RECEIPT_IDENTITY_OR_INSTALLED_SOURCE_MISMATCH');
  }
  if (receipt.status !== 'PASS' ||
      receipt.code !== 'SOURCE_INVENTORY_STORED_READONLY' ||
      receipt.exitCode !== 0 || receipt.firstFail !== null ||
      receipt.operationalWrites !== 0 || receipt.providerCalls !== 0 ||
      receipt.d1Writes !== 0 ||
      receipt.result?.status !== 'PASS' ||
      receipt.result?.code !== 'SOURCE_INVENTORY_STORED_READONLY' ||
      receipt.result?.core?.status !== 'PASS' ||
      receipt.result?.core?.code !== 'STORED_INVENTORY_READONLY' ||
      receipt.result?.operationalWrites !== 0 ||
      receipt.result?.providerCalls !== 0 ||
      receipt.result?.d1Writes !== 0) {
    return empty('A_RECEIPT_STATUS_OR_NO_WRITE_PROOF_MISSING');
  }
  const v = receipt.result.core.treasuryTawsInput;
  if (!v || typeof v !== 'object' || Array.isArray(v))
    return empty('PRIVATE_TAWS_AUDIT_NOT_REPORTED');
  if (v.status === 'NOT_STORED') return empty('PRIVATE_TAWS_INPUT_NOT_STORED');
  if (v.status === 'UNREADABLE_OR_INVALID') return empty('PRIVATE_TAWS_INPUT_CONTRACT_INVALID');
  if (v.status !== 'OBSERVED') return empty('PRIVATE_TAWS_INPUT_STATE_UNKNOWN');

  const start = exactDay(v.fromDate), end = exactDay(v.toDate);
  if (start === null || end === null || end - start !== 364 * MS_DAY ||
      !safeStamp(v.storedAt) ||
      new Date(v.storedAt).toISOString().slice(0, 10) !== v.toDate) {
    return empty('PRIVATE_TAWS_WINDOW_OR_STORAGE_TIME_MISMATCH');
  }
  if (!bounded(v.rawRowCount, 2000) ||
      !bounded(v.storedAwardedCount, 2000) ||
      !bounded(v.eligibleAwardedRows, 2000) ||
      v.storedAwardedCount > v.rawRowCount ||
      v.eligibleAwardedRows > v.rawRowCount ||
      !bounded(v.textBytes, MAX_TEXT_BYTES) ||
      !SHA256.test(v.textSha256 ?? '') ||
      v.scope !== SCOPE ||
      typeof v.eligibleCountMatchesStored !== 'boolean') {
    return empty('PRIVATE_TAWS_AUDIT_FIELDS_INVALID');
  }
  const reallyEqual = v.storedAwardedCount === v.eligibleAwardedRows;
  if (v.eligibleCountMatchesStored !== reallyEqual)
    return empty('PRIVATE_TAWS_COUNT_FLAG_CONTRADICTION');
  if (!reallyEqual) return Object.freeze({
    ...empty('PRIVATE_TAWS_AWARDED_COUNT_MISMATCH'),
    storedAwardedCount: v.storedAwardedCount,
    eligibleAwardedRows: v.eligibleAwardedRows,
  });
  return Object.freeze({
    ...empty('PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE', 'REVIEWABLE'),
    fromDate: v.fromDate,
    toDate: v.toDate,
    storedAt: v.storedAt,
    rawRowCount: v.rawRowCount,
    storedAwardedCount: v.storedAwardedCount,
    eligibleAwardedRows: v.eligibleAwardedRows,
    textSha256: v.textSha256,
    fullParserRetested: false,
    requiresOwnerComparisonWithSamePeriodPublication: true,
  });
}
