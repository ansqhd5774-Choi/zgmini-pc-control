// Optional W02 independent support: reconcile already-supplied evidence ONLY.
// No network, filesystem, SQLite, Cloudflare, APIs, GitHub jobs, or side effects.
// Metadata coincidence is never proof of D1 body identity or deployed PC/mobile UI.
import {reviewTreasuryAuditReceipt} from './treasury-audit-receipt-review.mjs';

const URL = 'https://zgmini.kr/api/release-calendar';
const FINITE_EVENT_LIMIT = 20_000;
const base = (code, status = 'UNVERIFIED') => Object.freeze({
  code, status, d1BodyEqualityVerified: false,
  publicReadOriginAuthenticated: false, // source origin is Owner's evidence, not a JS object
  productionUiVerified: false, featureCompletionApproved: false,
});
const isoMs = str => {
  if (typeof str !== 'string' || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(str)) return null;
  const value = Date.parse(str);
  return Number.isSafeInteger(value) && new Date(value).toISOString() === str ? value : null;
};
/**
 * @param {unknown} receipt JSON from the original, already completed Windows A job.
 * @param {unknown} d1Row Only authorized D1 SELECT metadata: kind/feed_key/snapshot_key/stored_at.
 * @param {unknown} apiResponse Existing authorized GET JSON from the public API URL.
 * @param {object} original Owner-supplied request ID/source SHA + API URL from evidence.
 */
export function reconcileTreasurySameCycle(receipt, d1Row, apiResponse, original = {}) {
  const audit = reviewTreasuryAuditReceipt(receipt, original);
  if (!['REVIEWABLE', 'CORE_ONLY_REVIEWABLE'].includes(audit.status)) {
    return base(audit.code === 'ORIGINAL_REQUEST_IDENTITY_REQUIRED' ? audit.code :
      'RAW_A_RECEIPT_NOT_REVIEWABLE');
  }
  // This URL is supplied by the Owner. It is not independently fetched here.
  if (original.apiUrl !== URL) return base('EXPECTED_PUBLIC_API_ORIGIN_MISSING');
  if (!d1Row || typeof d1Row !== 'object' || Array.isArray(d1Row) ||
      d1Row.kind !== 'output' || d1Row.feed_key !== 'release-calendar' ||
      d1Row.snapshot_key !== 'current' ||
      !Number.isSafeInteger(d1Row.stored_at) || d1Row.stored_at <= 0) {
    return base('D1_EXACT_ROW_METADATA_REQUIRED');
  }
  if (!apiResponse || typeof apiResponse !== 'object' || Array.isArray(apiResponse) ||
      apiResponse.status !== 'READY' ||
      apiResponse.sources?.treasury?.status !== 'READY' ||
      !Array.isArray(apiResponse.events) ||
      apiResponse.events.length === 0 || apiResponse.events.length > FINITE_EVENT_LIMIT) {
    return base('PUBLIC_API_TREASURY_READY_AND_EVENTS_REQUIRED');
  }
  const pub = isoMs(apiResponse.updatedAt);
  const checked = isoMs(apiResponse.sources.treasury.checkedAt);
  if (pub === null || checked === null || pub !== checked)
    return base('PUBLIC_API_TIMESTAMPS_INVALID_OR_STALE');
  if (pub !== d1Row.stored_at) return base('D1_API_STORED_AT_MISMATCH');
  if (pub !== audit.storedAt) return base('PC_PRIVATE_RAW_AND_PUBLIC_CYCLE_MISMATCH');
  const treasuryEvents = apiResponse.events.filter(e => e && typeof e === 'object' && !Array.isArray(e) && e.source === 'treasury').length;
  if (treasuryEvents < 1) return base('PUBLIC_TREASURY_EVENTS_NOT_FOUND');
  return Object.freeze({
    ...base(audit.status === 'CORE_ONLY_REVIEWABLE' ?
        'PC_CORE_AND_D1_API_METADATA_ALIGNED_HISTORY_WAL_UNKNOWN' :
        'PC_D1_API_METADATA_SAME_CYCLE_REVIEWABLE',
      audit.status === 'CORE_ONLY_REVIEWABLE' ? 'CORE_ONLY_METADATA_ALIGNED' : 'METADATA_ALIGNED'),
    asOfDate: audit.toDate,
    storedAt: pub,
    awardedRowsInPrivateInput: audit.storedAwardedCount,
    publiclyDisplayedEvents: apiResponse.events.length,
    publiclyDisplayedTreasuryEvents: treasuryEvents,
    // Raw awarded rows are NOT comparable with auction + announcement events.
    rawAwardedEqualsPublicEventCountRequired: false,
    historyWalIndependentEvidenceMissing: audit.status === 'CORE_ONLY_REVIEWABLE',
    requiresOwnerSourceAndArtifactAuthentication: true,
    requiresOwnerPublicationContentAndUiReview: true,
  });
}
