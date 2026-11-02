// Fixed A-grade, read-only ER1 input diagnosis. No provider, SQL, publication,
// arbitrary path argument, or raw EPS/revenue/ticker is exposed to the caller.
import fs from 'node:fs';
import path from 'node:path';

const DAYS = Object.freeze([
  '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
]);
const AS_OF = '2026-11-02'; // Historical, approved batch; do not auto-rebase.
const MAX_DAY_BYTES = 2_000_000;
const TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;
const GROUPS = ['pre', 'after', 'notSupplied'];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const metric = (value, kind) => value === null ||
  (finite(value) && (kind !== 'revenue' || value >= 0));

function safeDirectory(dir) {
  try {
    const info = fs.lstatSync(dir);
    return info.isDirectory() && !info.isSymbolicLink();
  } catch { return false; }
}

// Whole-day structural/conflicting input is quarantined. Malformed individual
// rows are excluded in memory, as in the existing private saved-day adapter.
function readDay(file, day) {
  let stat;
  try { stat = fs.lstatSync(file); } catch { return { kind: 'MISSING' }; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 20 ||
      stat.size > MAX_DAY_BYTES) return { kind: 'INVALID' };
  let saved;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { kind: 'INVALID' }; }
  const { body, storedAt } = saved ?? {};
  if (body?.date !== day || typeof storedAt !== 'string' ||
      !Number.isFinite(Date.parse(storedAt)) ||
      !GROUPS.every(group => Array.isArray(body[group])))
    return { kind: 'INVALID' };

  const records = new Map();
  let invalidRows = 0, rawRows = 0, duplicates = 0;
  for (const group of GROUPS) {
    for (const event of body[group]) {
      rawRows++;
      if (!event || typeof event !== 'object' || Array.isArray(event) ||
          !TICKER.test(event.symbol) ||
          !Object.hasOwn(event, 'eps') || !Object.hasOwn(event, 'revenue') ||
          !metric(event.eps, 'eps') || !metric(event.revenue, 'revenue')) {
        invalidRows++;
        continue;
      }
      const prior = records.get(event.symbol);
      if (prior) {
        if (prior.eps !== event.eps || prior.revenue !== event.revenue)
          return { kind: 'CONFLICT', invalidRows, rawRows, duplicates };
        duplicates++;
        continue;
      }
      records.set(event.symbol, { eps: event.eps, revenue: event.revenue });
    }
  }
  return { kind: 'READ', records, invalidRows, rawRows, duplicates };
}

/**
 * The only input is the controller's already-approved dataRoot. No user job
 * payload may supply paths, day selections, executable code, or network URLs.
 * Counts never establish eligibility or an approved issuer universe.
 */
export function inspectER1SavedInput(dataRoot) {
  const result = {
    status: 'BLOCKED', code: 'ER1_SAVED_INPUT_MISSING',
    dataStatus: 'MISSING', asOf: AS_OF, expectedDayCount: DAYS.length,
    foundDayCount: 0, verifiedDayCount: 0, missingDayCount: 0,
    invalidDayCount: 0, conflictingDayCount: 0,
    rawEventCount: 0, excludedEventCount: 0, duplicateEventCount: 0,
    uniqueSymbols: 0, symbolsWithEPS: 0, symbolsWithRevenue: 0,
    symbolsWithBoth: 0, providerCalls: 0, dbWrites: 0, d1Writes: 0,
    operationalWrites: 0, sqliteOpened: false,
    eligibilityVerified: false, publicationPerformed: false,
  };
  if (typeof dataRoot !== 'string' || !path.isAbsolute(dataRoot)) {
    result.code = 'ER1_DATA_ROOT_NOT_APPROVED'; return result;
  }
  const pcHome = path.join(dataRoot, 'pc-writer');
  const input = path.join(pcHome, 'er1-input');
  const days = path.join(input, 'days');
  // Reject symlinks and junction-like redirections at all controlled levels.
  if (![dataRoot, pcHome, input, days].every(safeDirectory)) return result;

  const merged = new Map();
  for (const day of DAYS) {
    const scan = readDay(path.join(days, `${day}.json`), day);
    if (scan.kind === 'MISSING') { result.missingDayCount++; continue; }
    result.foundDayCount++;
    if (scan.kind === 'INVALID') { result.invalidDayCount++; continue; }
    if (scan.kind === 'CONFLICT') {
      result.conflictingDayCount++; continue;
    }
    result.verifiedDayCount++;
    result.rawEventCount += scan.rawRows;
    result.excludedEventCount += scan.invalidRows;
    result.duplicateEventCount += scan.duplicates;
    for (const [symbol, metrics] of scan.records) {
      const entry = merged.get(symbol) ?? { eps: false, revenue: false };
      if (metrics.eps !== null) entry.eps = true;
      if (metrics.revenue !== null) entry.revenue = true;
      merged.set(symbol, entry);
    }
  }
  result.uniqueSymbols = merged.size;
  for (const found of merged.values()) {
    if (found.eps) result.symbolsWithEPS++;
    if (found.revenue) result.symbolsWithRevenue++;
    if (found.eps && found.revenue) result.symbolsWithBoth++;
  }
  if (!result.verifiedDayCount) {
    result.code = result.foundDayCount ? 'ER1_NO_VALID_SAVED_DAYS' : 'ER1_SAVED_INPUT_MISSING';
    result.dataStatus = result.foundDayCount ? 'INVALID' : 'MISSING';
    return result;
  }
  result.status = 'PASS';
  result.code = 'ER1_SAVED_INPUT_READONLY';
  result.dataStatus = result.missingDayCount || result.invalidDayCount ||
    result.conflictingDayCount || result.excludedEventCount ? 'PARTIAL' : 'READY';
  return result;
}
