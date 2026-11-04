import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const TASK_NAME = 'ZGMINI-PC-MarketParquet-ETF';
const SOURCE = 'MARKETPARQUET_ETF_DAILY_SPLIT_ADJUSTED';
const DATES = ['2026-10-30', '2026-11-02', '2026-11-03'];
const PARQUET_MAX = 128 * 1024 * 1024;
const JSON_MAX = 128 * 1024;

function csvFields(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else value += char;
  }
  if (quoted) throw Error('CSV_UNCLOSED_QUOTE');
  fields.push(value);
  return fields;
}

export function queryMarketParquetTask() {
  const binary = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'schtasks.exe');
  return execFileSync(binary, ['/Query', '/TN', TASK_NAME, '/V', '/FO', 'CSV', '/NH'], {
    encoding: 'utf8', windowsHide: true, timeout: 12000, maxBuffer: 65536,
  });
}

function taskSummary(raw) {
  const line = String(raw).trim().split(/\r?\n/).find((s) => s.trim().startsWith('"'));
  if (!line) return { state: 'UNKNOWN', reason: 'TASK_CSV_EMPTY_OR_UNDECODABLE' };
  try {
    const fields = csvFields(line);
    if (fields.length < 7 || !fields[1].toLowerCase().includes(TASK_NAME.toLowerCase()))
      return { state: 'UNKNOWN', reason: 'TASK_CSV_SCHEMA_MISMATCH' };
    const bounded = (v) => /^[\w\s/:.\-가-힣()]{1,96}$/.test(v) ? v : null;
    return {
      state: 'QUERIED',
      lastRun: bounded(fields[5]) || 'UNPARSEABLE',
      lastResult: bounded(fields[6]) || 'UNPARSEABLE',
      schedulerStatus: bounded(fields[3]) || 'UNPARSEABLE',
    };
  } catch { return { state: 'UNKNOWN', reason: 'TASK_CSV_PARSE_FAILED' }; }
}

function exactRoot(dataRoot, allowFixtureRoot) {
  if (!allowFixtureRoot && !/^E:[\\/]ZGmini[\\/]data[\\/]?$/i.test(dataRoot))
    throw Error('UNAPPROVED_DATA_ROOT');
  return path.resolve(dataRoot);
}

function safeFilePath(root, relative) {
  const file = path.resolve(root, relative);
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('PATH_OUTSIDE_ROOT');
  let cursor = root;
  for (const segment of rel.split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) return null;
    if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('SYMLINK_BLOCKED');
  }
  if (!fs.statSync(file).isFile()) throw Error('NOT_REGULAR_FILE');
  return file;
}

function readJson(root, relative) {
  const file = safeFilePath(root, relative);
  if (!file) return null;
  if (fs.statSync(file).size > JSON_MAX) throw Error('JSON_TOO_LARGE');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function digestParquet(root, relative) {
  const file = safeFilePath(root, relative);
  if (!file) return null;
  const length = fs.statSync(file).size;
  if (length < 8 || length > PARQUET_MAX) throw Error('PARQUET_SIZE_INVALID');
  const fd = fs.openSync(file, 'r');
  try {
    const signature = Buffer.alloc(4);
    fs.readSync(fd, signature, 0, 4, 0);
    if (signature.toString('ascii') !== 'PAR1') throw Error('PARQUET_HEADER_INVALID');
    fs.readSync(fd, signature, 0, 4, length - 4);
    if (signature.toString('ascii') !== 'PAR1') throw Error('PARQUET_FOOTER_INVALID');
    const sha = createHash('sha256');
    const chunk = Buffer.alloc(64 * 1024);
    let position = 0;
    while (position < length) {
      const read = fs.readSync(fd, chunk, 0, Math.min(chunk.length, length - position), position);
      if (!read) throw Error('PARQUET_EARLY_EOF');
      sha.update(chunk.subarray(0, read));
      position += read;
    }
    return { sizeBytes: length, sha256: sha.digest('hex') };
  } finally { fs.closeSync(fd); }
}

function checkpointSummary(value) {
  if (!value || typeof value !== 'object') return { state: 'MISSING' };
  const upper = (v) => typeof v === 'string' && /^[A-Z0-9_:-]{1,80}$/.test(v) ? v : null;
  const date = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const time = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]{1,30}$/.test(v) ? v : null;
  return {
    state: 'PRESENT', status: upper(value.status),
    at: time(value.at), date: date(value.date),
    providerCalls: Number.isSafeInteger(value.providerCalls) && value.providerCalls >= 0 ? value.providerCalls : null,
  };
}

export function inspectMarketParquetR165R167(dataRoot, { queryTaskCsv = queryMarketParquetTask, allowFixtureRoot = false } = {}) {
  const root = exactRoot(dataRoot, allowFixtureRoot);
  const prefix = 'theme-market-history-r131';
  let scheduler;
  try { scheduler = taskSummary(queryTaskCsv()); }
  catch { scheduler = { state: 'UNKNOWN', reason: 'TASK_QUERY_UNAVAILABLE' }; }

  const history = DATES.map((date) => {
    try {
      const parquet = digestParquet(root, path.join(prefix, 'marketparquet-r165', `etf_daily_${date}.parquet`));
      const audit = readJson(root, path.join(prefix, 'marketparquet-r167', `etf_daily_${date}.audit.json`));
      if (!parquet) return { date, parquet: 'MISSING', audit: audit ? 'PRESENT' : 'MISSING', verified: false };
      if (!audit) return { date, parquet: 'PRESENT', audit: 'MISSING', verified: false };
      const verified = audit.date === date && audit.sha256 === parquet.sha256 && audit.complete === true && audit.source === SOURCE;
      return { date, parquet: 'PRESENT', audit: 'PRESENT', verified, reason: verified ? null : 'AUDIT_MISMATCH' };
    } catch (error) {
      return { date, verified: false, reason: /^[A-Z_]+$/.test(error.message) ? error.message : 'READ_FAILED' };
    }
  });
  const checkpoints = {};
  for (const [name, file] of [
    ['primary', 'R181_PRIMARY_LAST_RUN.json'],
    ['secondary', 'ZGMINI_R167_LAST_RUN.json'],
  ]) {
    try { checkpoints[name] = checkpointSummary(readJson(root, path.join(prefix, 'marketparquet-r167', file))); }
    catch { checkpoints[name] = { state: 'UNREADABLE' }; }
  }
  return {
    operation: 'marketparquet-r165-r167-readonly', status: 'PASS',
    code: 'MARKETPARQUET_READONLY_DIAGNOSTIC_COMPLETED',
    provenance: 'SCHEDULED_TASK_QUERY_AND_LOCAL_FILE_READONLY',
    task: TASK_NAME, scheduler, history, checkpoints,
    operationalWrites: 0, providerCalls: 0, d1Writes: 0, sqliteOpened: false,
  };
}
