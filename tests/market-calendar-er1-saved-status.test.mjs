import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectER1SavedInput } from
  '../controller/market-calendar-er1-saved-readonly.mjs';

const days = ['2026-10-26', '2026-10-27', '2026-10-28',
  '2026-10-29', '2026-10-30'];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-er1-a-'));
  const dir = path.join(root, 'pc-writer', 'er1-input', 'days');
  fs.mkdirSync(dir, { recursive: true });
  const write = (day, rows, opts = {}) => {
    const saved = { storedAt: '2026-11-02T12:00:00Z',
      body: { date: day, pre: rows, after: [], notSupplied: [], ...opts } };
    fs.writeFileSync(path.join(dir, `${day}.json`), JSON.stringify(saved));
  };
  return { root, dir, write, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('five saved days; one actual EPS/revenue is enough; zero counts as actual', () => {
  const f = fixture();
  try {
    f.write(days[0], [{ symbol: 'AAA', eps: 0, revenue: 0 },
      { symbol: 'BBB', eps: null, revenue: 40 }]);
    f.write(days[1], [{ symbol: 'BBB', eps: -1, revenue: null },
      { symbol: 'CCC', eps: null, revenue: 1 }]);
    for (const d of days.slice(2)) f.write(d, []);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.code, 'ER1_SAVED_INPUT_READONLY');
    assert.equal(r.dataStatus, 'READY');
    assert.equal(r.symbolsWithEPS, 2);
    assert.equal(r.symbolsWithRevenue, 3);
    assert.equal(r.symbolsWithBoth, 2);
    assert.equal(r.verifiedDayCount, 5);
    assert.equal(r.providerCalls, 0); assert.equal(r.d1Writes, 0);
    assert.equal(r.operationalWrites, 0); assert.equal(r.sqliteOpened, false);
    assert.equal(r.eligibilityVerified, false);
    assert.doesNotMatch(JSON.stringify(r), /AAA|BBB|CCC|\"eps\"|\"revenue\"/);
  } finally { f.cleanup(); }
});

test('missing dates do not change a successful read-only diagnosis into runner failure', () => {
  const f = fixture();
  try {
    f.write(days[0], [{ symbol: 'ONLY', eps: 0, revenue: 10 }]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.dataStatus, 'PARTIAL');
    assert.equal(r.missingDayCount, 4);
    assert.equal(r.symbolsWithBoth, 1);
  } finally { f.cleanup(); }
});

test('invalid rows are excluded in memory and never leak raw contents', () => {
  const f = fixture();
  try {
    f.write(days[0], [{ symbol: 'VALID', eps: 2, revenue: 100 },
      { symbol: 'INVALID', eps: 'SECRET_EPS', revenue: 10 },
      { symbol: 'ALSO', eps: null, revenue: null }]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.dataStatus, 'PARTIAL');
    assert.equal(r.excludedEventCount, 1);
    assert.equal(r.uniqueSymbols, 2);
    assert.doesNotMatch(JSON.stringify(r), /SECRET_EPS|INVALID|VALID|ALSO/);
  } finally { f.cleanup(); }
});

test('conflicting same-day actuals quarantine the entire day', () => {
  const f = fixture();
  try {
    f.write(days[0], [{ symbol: 'AAA', eps: 1, revenue: 100 },
      { symbol: 'AAA', eps: 9, revenue: 100 }]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'BLOCKED');
    assert.equal(r.dataStatus, 'INVALID');
    assert.equal(r.conflictingDayCount, 1);
    assert.equal(r.symbolsWithBoth, 0);
  } finally { f.cleanup(); }
});

test('oversized and malformed JSON are bounded and reported without body', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.dir, `${days[0]}.json`), 'x'.repeat(2_000_001));
    fs.writeFileSync(path.join(f.dir, `${days[1]}.json`), 'invalid');
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'BLOCKED');
    assert.equal(r.invalidDayCount, 2);
    assert.equal(r.dataStatus, 'INVALID');
    assert.equal(r.rawEventCount, 0);
  } finally { f.cleanup(); }
});

test('missing directory is a scoped input blocker, not a controller failure', () => {
  const f = fixture();
  try {
    assert.equal(inspectER1SavedInput(path.join(f.root, 'missing')).code,
      'ER1_SAVED_INPUT_MISSING');
    assert.equal(inspectER1SavedInput('relative-data-root').code,
      'ER1_DATA_ROOT_NOT_APPROVED');
  } finally { f.cleanup(); }
});

test('missing approved roster is reported without changing saved-day PASS', () => {
  const f = fixture();
  try {
    for (const d of days) f.write(d, [{ symbol: 'PRIVATE', eps: 0, revenue: 0 }]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.roster.status, 'MISSING');
    assert.equal(r.roster.exists, false);
    assert.equal(r.roster.sha256, null);
    assert.equal(r.eligibilityVerified, false);
    assert.equal(r.roster.eligibilityVerified, false);
  } finally { f.cleanup(); }
});

test('roster raw bytes are hashed, only approved metadata counts leave PC', () => {
  const f = fixture();
  try {
    const roster = {
      version: 1, method: 'ER1_INDEPENDENTLY_APPROVED_ELIGIBLE_ISSUERS_R1',
      asOf: '2026-11-02', universeReviewed: true,
      approvalReference: 'PRIVATE-APPROVAL-123',
      expectedEligibleIssuers: 2,
      members: [{ earningsSymbol: 'SECRET-A', actual: 12.5 },
        { earningsSymbol: 'SECRET-B', actual: 0 }],
    };
    const raw = Buffer.from(JSON.stringify(roster) + '\n', 'utf8');
    fs.writeFileSync(path.join(f.dir, '..', 'er1-approved-issuers.json'), raw);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.roster.status, 'PRESENT_METADATA');
    assert.equal(r.roster.sha256,
      createHash('sha256').update(raw).digest('hex'));
    assert.equal(r.roster.bytes, raw.byteLength);
    assert.equal(r.roster.metadataContractValid, true);
    assert.equal(r.roster.expectedEligibleIssuers, 2);
    assert.equal(r.roster.memberCount, 2);
    assert.equal(r.roster.eligibilityVerified, false);
    assert.doesNotMatch(JSON.stringify(r), /SECRET-A|SECRET-B|PRIVATE-APPROVAL/);
  } finally { f.cleanup(); }
});

test('invalid roster metadata never means approved eligibility', () => {
  const f = fixture();
  try {
    const file = path.join(f.dir, '..', 'er1-approved-issuers.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, members: [] }));
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.roster.status, 'INVALID_METADATA');
    assert.equal(r.roster.metadataContractValid, false);
    assert.equal(r.roster.memberCount, 0);
    assert.equal(r.roster.eligibilityVerified, false);
  } finally { f.cleanup(); }
});
