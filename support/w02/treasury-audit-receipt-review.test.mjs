import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewTreasuryAuditReceipt as review} from './treasury-audit-receipt-review.mjs';

const requestId = 'pc-11111111-2222-4333-8444-555555555555';
const source = '643b7c7c4372ffad552443fc312c6cb1b944e2fc';
const control = '8e2736a62a90798afe159ef4d96a8713265ca021';
const opts = Object.freeze({expectedRequestId: requestId, expectedSourceSha: source});
const stamp = Date.parse('2026-11-09T20:22:39.536Z');
const fixture = () => ({
  schema: 'ZGMINI_PC_RESULT_V1', requestId,
  operation: 'source-inventory-runtime-readonly',
  controlSourceSha: control, actualExecutionSha: control,
  requestedSourceSha: source, sourceRepository: 'ansqhd5774-Choi/zgmini',
  sourceBranch: 'main', status: 'PASS', code: 'SOURCE_INVENTORY_STORED_READONLY',
  exitCode: 0, firstFail: null, providerCalls: 0, d1Writes: 0, operationalWrites: 0, protectedStateUnchanged: true,
  result: {
    status: 'PASS', code: 'SOURCE_INVENTORY_STORED_READONLY',
    providerCalls: 0, d1Writes: 0, operationalWrites: 0,
    core: { status: 'PASS', code: 'STORED_INVENTORY_READONLY', treasuryTawsInput: {
      status: 'OBSERVED', storedAt: stamp, fromDate: '2025-11-10', toDate: '2026-11-09',
      rawRowCount: 852, storedAwardedCount: 436, eligibleAwardedRows: 436,
      eligibleCountMatchesStored: true, textBytes: 3050123,
      textSha256: 'a'.repeat(64),
      scope: 'ELIGIBLE_RESULT_COUNT_NOT_FULL_PARSER_REVALIDATION',
    } },
  },
});
const code = r => review(r, opts).code;

test('valid one-year raw audit is REVIEWABLE, not production equality or completion', () => {
  const out = review(fixture(), opts);
  assert.equal(out.status, 'REVIEWABLE');
  assert.equal(out.code, 'PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE');
  assert.equal(out.storedAwardedCount, 436);
  assert.equal(out.productionEquivalenceVerified, false);
  assert.equal(out.finalFeatureCompletionApproved, false);
  assert.equal(out.fullParserRetested, false);
  assert.equal(out.requiresOwnerComparisonWithSamePeriodPublication, true);
});

test('future changed count is accepted on its own date rather than pinned at 436', () => {
  const r = fixture();
  Object.assign(r.result.core.treasuryTawsInput, {
    fromDate: '2025-11-11', toDate: '2026-11-10',
    storedAt: Date.parse('2026-11-10T01:01:01.000Z'),
    storedAwardedCount: 440, eligibleAwardedRows: 440,
  });
  assert.equal(code(r), 'PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE');
});

test('wrong original request ID rejected before reading body', () => {
  const r = fixture(); r.requestId = 'pc-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  assert.equal(code(r), 'A_RECEIPT_IDENTITY_OR_INSTALLED_SOURCE_MISMATCH');
});

test('missing caller identity rejects otherwise valid result', () => {
  assert.equal(review(fixture()).code, 'ORIGINAL_REQUEST_IDENTITY_REQUIRED');
});

test('control SHA not actual installed controller SHA is rejected', () => {
  const r = fixture(); r.actualExecutionSha = 'b'.repeat(40);
  assert.equal(code(r), 'A_RECEIPT_IDENTITY_OR_INSTALLED_SOURCE_MISMATCH');
});

test('request source on a feature branch rather than main is rejected', () => {
  const r = fixture(); r.sourceBranch = 'feature';
  assert.equal(code(r), 'A_RECEIPT_IDENTITY_OR_INSTALLED_SOURCE_MISMATCH');
});

test('misleading PASS with write evidence is not accepted', () => {
  const r = fixture(); r.d1Writes = 1;
  assert.equal(code(r), 'A_RECEIPT_STATUS_OR_NO_WRITE_PROOF_MISSING');
});

test('sub-DB failed despite overall PASS is not accepted', () => {
  const r = fixture(); r.result.core.status = 'STATE_UNKNOWN';
  assert.equal(code(r), 'A_RECEIPT_STATUS_OR_NO_WRITE_PROOF_MISSING');
});

test('NOT_STORED is a distinct incomplete state', () => {
  const r = fixture(); r.result.core.treasuryTawsInput = { status: 'NOT_STORED' };
  assert.equal(code(r), 'PRIVATE_TAWS_INPUT_NOT_STORED');
});

test('invalid private row is not completion', () => {
  const r = fixture(); r.result.core.treasuryTawsInput = { status: 'UNREADABLE_OR_INVALID' };
  assert.equal(code(r), 'PRIVATE_TAWS_INPUT_CONTRACT_INVALID');
});

test('same-day storage and rolling 365-day window must agree', () => {
  const r = fixture(); r.result.core.treasuryTawsInput.toDate = '2026-11-10';
  assert.equal(code(r), 'PRIVATE_TAWS_WINDOW_OR_STORAGE_TIME_MISMATCH');
});

test('integer awardedCount mismatch remains unverified', () => {
  const r = fixture(); const v = r.result.core.treasuryTawsInput;
  v.eligibleAwardedRows = 435; v.eligibleCountMatchesStored = false;
  assert.equal(code(r), 'PRIVATE_TAWS_AWARDED_COUNT_MISMATCH');
});

test('false flag contradicting same counts must not be accepted', () => {
  const r = fixture(); r.result.core.treasuryTawsInput.eligibleCountMatchesStored = false;
  assert.equal(code(r), 'PRIVATE_TAWS_COUNT_FLAG_CONTRADICTION');
});

test('malformed SHA/dangerously oversized length rejected', () => {
  const r = fixture(); r.result.core.treasuryTawsInput.textSha256 = 'secret';
  assert.equal(code(r), 'PRIVATE_TAWS_AUDIT_FIELDS_INVALID');
  r.result.core.treasuryTawsInput.textSha256 = 'f'.repeat(64);
  r.result.core.treasuryTawsInput.textBytes = 7 * 1024 * 1024;
  assert.equal(code(r), 'PRIVATE_TAWS_AUDIT_FIELDS_INVALID');
});

test('out-of-range impossible dates cannot satisfy rolling window', () => {
  const r = fixture(); r.result.core.treasuryTawsInput.fromDate = '2025-02-30';
  assert.equal(code(r), 'PRIVATE_TAWS_WINDOW_OR_STORAGE_TIME_MISMATCH');
});

test('redacts extraneous private contents from returned classification', () => {
  const r = fixture(); r.result.core.treasuryTawsInput.raw = 'PRIVATE_TREASURY_CUSIP_XX';
  r.result.core.treasuryTawsInput.secretAccessToken = 'PRIVATE_TOKEN';
  const actual = JSON.stringify(review(r, opts));
  assert.doesNotMatch(actual, /PRIVATE_TREASURY_CUSIP_XX|PRIVATE_TOKEN|secretAccessToken/);
  assert.equal(code(r), 'PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE');
});

test('leap year 365-day inclusive window with 364 days accepted', () => {
  const r = fixture(); Object.assign(r.result.core.treasuryTawsInput, {
    fromDate: '2023-03-02', toDate: '2024-02-29',
    storedAt: Date.parse('2024-02-29T13:02:04Z'),
  });
  assert.equal(code(r), 'PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE');
});

test('unrelated history DB WAL absence preserves core evidence without PASS', () => {
  const r = fixture();
  r.status = 'STATE_UNKNOWN'; r.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.firstFail = 'ALLOWLISTED_OPERATION';
  r.result.status = 'STATE_UNKNOWN'; r.result.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.result.history = {status: 'STATE_UNKNOWN', code: 'WAL_SIDECARS_ABSENT_UNVERIFIED'};
  const out = review(r, opts);
  assert.equal(out.status, 'CORE_ONLY_REVIEWABLE');
  assert.equal(out.code, 'PRIVATE_TAWS_CORE_AUDIT_HISTORY_WAL_UNVERIFIED');
  assert.equal(out.storedAwardedCount, 436);
  assert.equal(out.historyDbAuditCompleted, false);
  assert.equal(out.finalFeatureCompletionApproved, false);
  assert.equal(out.productionEquivalenceVerified, false);
});

test('same partial history status but missing approved postcheck cannot pass', () => {
  const r = fixture();
  r.status = 'STATE_UNKNOWN'; r.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.firstFail = 'ALLOWLISTED_OPERATION';
  r.result.status = 'STATE_UNKNOWN'; r.result.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.result.history = {status: 'STATE_UNKNOWN', code: 'WAL_SIDECARS_ABSENT_UNVERIFIED'};
  r.protectedStateUnchanged = false;
  assert.equal(code(r), 'A_RECEIPT_STATUS_OR_NO_WRITE_PROOF_MISSING');
});

test('unrelated history corruption is not the narrow WAL checkpoint exemption', () => {
  const r = fixture();
  r.status = 'STATE_UNKNOWN'; r.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.firstFail = 'ALLOWLISTED_OPERATION';
  r.result.status = 'STATE_UNKNOWN'; r.result.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.result.history = {status: 'STATE_UNKNOWN', code: 'READONLY_QUERY_FAILED'};
  assert.equal(code(r), 'A_RECEIPT_STATUS_OR_NO_WRITE_PROOF_MISSING');
});

test('history-WAL partial with anomalous core counts does not turn into PASS', () => {
  const r = fixture();
  r.status = 'STATE_UNKNOWN'; r.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.firstFail = 'ALLOWLISTED_OPERATION';
  r.result.status = 'STATE_UNKNOWN'; r.result.code = 'SOURCE_INVENTORY_PARTIAL_READONLY';
  r.result.history = {status: 'STATE_UNKNOWN', code: 'WAL_SIDECARS_ABSENT_UNVERIFIED'};
  r.result.core.treasuryTawsInput.eligibleCountMatchesStored = false;
  assert.equal(code(r), 'PRIVATE_TAWS_COUNT_FLAG_CONTRADICTION');
});

test('ordinary PASS also requires protected resource unchanged proof', () => {
  const r = fixture(); delete r.protectedStateUnchanged;
  assert.equal(code(r), 'A_RECEIPT_STATUS_OR_NO_WRITE_PROOF_MISSING');
});
