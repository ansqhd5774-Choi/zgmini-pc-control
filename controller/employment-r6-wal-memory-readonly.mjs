import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SQLITE_MAGIC = 'SQLite format 3';
const MINIMUM_FREE_MIB = 1536;

function isOrdinaryFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/** This function never opens SQLite itself, writes files, or creates sidecars. */
function inspectOneDatabase(file) {
  const info = {
    exists: false,
    headerMode: 'UNKNOWN',
    headerWriteVersion: null,
    headerReadVersion: null,
    walExists: isOrdinaryFile(file + '-wal'),
    shmExists: isOrdinaryFile(file + '-shm'),
    sidecarsRequired: null,
    walSidecarState: null,
    ready: false,
    problem: null,
  };
  let fd;
  try {
    if (!isOrdinaryFile(file)) throw Error('DB_MISSING');
    info.exists = true;
    fd = fs.openSync(file, 'r');
    const header = Buffer.alloc(20);
    if (fs.readSync(fd, header, 0, header.length, 0) !== 20 ||
      header.toString('ascii', 0, 15) !== SQLITE_MAGIC) {
      throw Error('SQLITE_HEADER_INVALID');
    }
    info.headerWriteVersion = header[18];
    info.headerReadVersion = header[19];
    if (![1, 2].includes(header[18]) || ![1, 2].includes(header[19])) {
      throw Error('SQLITE_HEADER_MODE_INVALID');
    }
    const walMode = header[18] === 2 || header[19] === 2;
    info.headerMode = walMode ? 'WAL' : 'ROLLBACK';
    info.sidecarsRequired = walMode;
    info.walSidecarState = !walMode ? 'NOT_REQUIRED'
      : info.walExists && info.shmExists ? 'BOTH_PRESENT'
      : !info.walExists && !info.shmExists ? 'BOTH_ABSENT'
      : info.walExists ? 'WAL_ONLY' : 'SHM_ONLY';
    // Missing sidecars can follow a normal final checkpoint/close.
    // Keep the operational read guard closed: SQLite may create them on open.
    info.ready = !walMode || info.walSidecarState === 'BOTH_PRESENT';
    if (!info.ready) info.problem = info.walSidecarState === 'BOTH_ABSENT'
      ? 'WAL_SIDECARS_ABSENT_UNVERIFIED' : 'WAL_SIDECARS_PARTIAL';
  } catch (error) {
    info.problem = /^(DB_MISSING|SQLITE_HEADER_INVALID|SQLITE_HEADER_MODE_INVALID)$/.test(error.message)
      ? error.message : 'DB_READ_FAILED';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return info;
}

/** `host` comes only from the pinned Controller/Host, not from Issue inputs. */
export function inspectEmploymentR6WalMemoryPreflight({host}) {
  const resource = {
    totalMiB: Math.floor(os.totalmem() / 1048576),
    freeMiB: Math.floor(os.freemem() / 1048576),
    minimumFreeMiB: MINIMUM_FREE_MIB,
  };
  resource.ready = resource.freeMiB >= MINIMUM_FREE_MIB;
  const result = {
    status: 'BLOCKED',
    code: 'R6_DB_PREFLIGHT_FAILED',
    core: null,
    candidate: null,
    resource,
    blockedConditions: [],
    candidateExecuted: false,
    sqliteOpened: false,
    providerCalls: 0,
    d1Writes: 0,
    operationalWrites: 0,
  };
  const dataRoot = host?.dataRoot;
  const candidatePath = host?.employmentR6CandidatePath;
  if (!path.isAbsolute(dataRoot ?? '') || !path.isAbsolute(candidatePath ?? '') ||
    path.basename(candidatePath) !== 'EMPLOYMENT_R6_CANDIDATE.sqlite') {
    result.code = 'R6_HOST_PATH_NOT_APPROVED';
    return result;
  }
  const corePath = path.join(dataRoot, 'pc-writer', 'storage', 'core.sqlite');
  try {
    if (fs.realpathSync(corePath) === fs.realpathSync(candidatePath)) {
      result.code = 'R6_HOST_DATABASE_ALIAS';
      return result;
    }
  } catch {
    // Independent probes below retain which DB is missing/invalid.
  }
  result.core = inspectOneDatabase(corePath);
  result.candidate = inspectOneDatabase(candidatePath);
  for (const [role, db] of [['CORE', result.core], ['CANDIDATE', result.candidate]]) {
    if (!db.ready) result.blockedConditions.push(role + '_' + (db.problem ?? 'DB_NOT_READY'));
  }
  if (!resource.ready) result.blockedConditions.push('RESOURCE_WAIT_MEMORY');
  if (!result.core.ready || !result.candidate.ready) {
    result.code = 'R6_DB_PREFLIGHT_FAILED';
  } else if (!resource.ready) {
    result.code = 'RESOURCE_WAIT_MEMORY';
  } else {
    result.status = 'PASS';
    result.code = 'R6_WAL_MEMORY_PREFLIGHT_READY';
  }
  return result;
}

