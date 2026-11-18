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
  const config = value => fs.writeFileSync(path.join(root, 'pc-writer', 'config.json'),
    JSON.stringify(value));
  return { root, dir, write, config,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const binding = {
  source: 'a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e',
  collectionTarget: 'pc', enabled: true,
  account: '1'.repeat(32),
  core: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  history: '11111111-2222-4333-8444-555555555555',
};
const bindingHash = createHash('sha256').update(JSON.stringify([
  binding.account, binding.core, binding.history,
])).digest('hex');

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

test('approved D1 binding fingerprint matches V2, without printing identifiers', () => {
  const f = fixture();
  try {
    f.config({...binding, providerToken: 'SECRET_SHOULD_STAY_LOCAL'});
    for (const day of days) f.write(day, []);
    f.write(days[0], [{symbol:'AAA',eps:0,revenue:1}]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.pcBindingSha256, bindingHash);
    assert.equal(r.collisionCoverage, 'COMPLETE');
    assert.equal(r.knownShareClassCollision, false);
    assert.doesNotMatch(JSON.stringify(r), /SECRET_SHOULD_STAY_LOCAL|aaaa-bbbb|11111111-2222|"account"|"core"/);
  } finally { f.cleanup(); }
});

test('wrong approved source and malformed config fail closed without affecting prior read', () => {
  const f = fixture();
  try {
    for (const day of days) f.write(day, []);
    f.write(days[0], [{symbol:'AAA',eps:1,revenue:1}]);
    f.config({...binding, source:'0'.repeat(40)});
    let r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.pcBindingSha256, null);
    f.config({...binding, account:'INVALID'});
    r = inspectER1SavedInput(f.root);
    assert.equal(r.pcBindingSha256, null);
    fs.writeFileSync(path.join(f.root, 'pc-writer', 'config.json'), '{BAD_JSON');
    r = inspectER1SavedInput(f.root);
    assert.equal(r.pcBindingSha256, null);
    assert.equal(r.providerCalls, 0);
    assert.equal(r.operationalWrites, 0);
  } finally { f.cleanup(); }
});

test('observed GOOG/GOOGL alias conflict detected without ticker disclosures', () => {
  const f = fixture();
  try {
    for (const day of days) f.write(day, []);
    f.write(days[0], [{symbol:'GOOG',eps:1,revenue:100},
      {symbol:'GOOGL',eps:1,revenue:100}]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.knownShareClassCollision, true);
    assert.equal(r.collisionCoverage, 'COMPLETE');
    assert.doesNotMatch(JSON.stringify(r), /GOOG|GOOGL|"eps"|"revenue"/);
  } finally { f.cleanup(); }
});

test('mixed Berkshire class aliases use existing scorer conflict rule', () => {
  const f = fixture();
  try {
    for (const day of days) f.write(day, []);
    f.write(days[0], [{symbol:'BRK.A',eps:1,revenue:100},
      {symbol:'BRK-B',eps:1,revenue:100}]);
    assert.equal(inspectER1SavedInput(f.root).knownShareClassCollision, true);
  } finally { f.cleanup(); }
});

test('same Berkshire class with alternate separators is not a false collision', () => {
  const f = fixture();
  try {
    for (const day of days) f.write(day, []);
    f.write(days[0], [{symbol:'BRK.A',eps:1,revenue:100},
      {symbol:'BRK-A',eps:1,revenue:100}]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.knownShareClassCollision, false);
    assert.equal(r.collisionCoverage, 'COMPLETE');
  } finally { f.cleanup(); }
});

test('incomplete observed days yield partial collision coverage, never a clean full proof', () => {
  const f = fixture();
  try {
    f.write(days[0], [{symbol:'AAA',eps:1,revenue:100}]);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.knownShareClassCollision, false);
    assert.equal(r.collisionCoverage, 'PARTIAL');
  } finally { f.cleanup(); }
});

test('missing config never blocks valid saved days or fabricates a binding hash', () => {
  const f = fixture();
  try {
    for (const day of days) f.write(day, []);
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.pcBindingSha256, null);
    assert.equal(r.collisionCoverage, 'COMPLETE');
  } finally { f.cleanup(); }
});

test('external config symlink and redirected day folder are excluded', () => {
  const f = fixture();
  const external = fixture();
  try {
    for (const day of days) f.write(day, []);
    external.config(binding);
    fs.symlinkSync(path.join(external.root, 'pc-writer', 'config.json'),
      path.join(f.root, 'pc-writer', 'config.json'));
    const r = inspectER1SavedInput(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.pcBindingSha256, null);
    assert.equal(r.operationalWrites, 0);

    fs.renameSync(f.dir, path.join(f.root, 'pc-writer', 'old-days'));
    fs.symlinkSync(path.join(external.root, 'pc-writer', 'er1-input', 'days'), f.dir,
      'dir');
    const blocked = inspectER1SavedInput(f.root);
    assert.equal(blocked.status, 'BLOCKED');
    assert.equal(blocked.code, 'ER1_SAVED_INPUT_MISSING');
  } finally { f.cleanup(); external.cleanup(); }
});
