import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inspectEmploymentR6WalMemoryPreflight} from '../controller/employment-r6-wal-memory-readonly.mjs';

function fixture(t, coreMode, candidateMode, walFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-r6-wal-fixture-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const core = path.join(root, 'data', 'pc-writer', 'storage', 'core.sqlite');
  const candidate = path.join(root, 'candidate', 'EMPLOYMENT_R6_CANDIDATE.sqlite');
  for (const [file, mode] of [[core, coreMode], [candidate, candidateMode]]) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const header = Buffer.alloc(100);
    header.write('SQLite format 3\0', 0, 'ascii');
    header[18] = header[19] = mode === 'WAL' ? 2 : 1;
    fs.writeFileSync(file, header);
  }
  for (const [role, suffixes] of Object.entries(walFiles)) {
    for (const suffix of suffixes) fs.writeFileSync((role === 'core' ? core : candidate) + suffix, 'fixture');
  }
  const host = {dataRoot: path.join(root, 'data'), employmentR6CandidatePath: candidate};
  return {host, core, candidate};
}

test('ready: both WAL DBs have pre-existing sidecars and no writes occur', t => {
  const f = fixture(t, 'WAL', 'WAL', {'core':['-wal','-shm'], 'candidate':['-wal','-shm']});
  const before = [f.core, f.candidate].map(p => [fs.readFileSync(p), fs.statSync(p).mtimeMs]);
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.core.headerMode, 'WAL');
  assert.equal(r.candidate.headerMode, 'WAL');
  assert.equal(r.core.ready, true);
  assert.equal(r.candidate.ready, true);
  assert.equal(r.resource.minimumFreeMiB, 1536);
  assert.equal(r.sqliteOpened, false);
  assert.equal(r.operationalWrites, 0);
  for (const [index, p] of [f.core, f.candidate].entries()) {
    assert.deepEqual(fs.readFileSync(p), before[index][0]);
    assert.equal(fs.statSync(p).mtimeMs, before[index][1]);
  }
});

test('independent diagnosis retains candidate missing -shm (never collapses to false)', t => {
  const f = fixture(t, 'WAL', 'WAL', {'core':['-wal','-shm'], 'candidate':['-wal']});
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.status, 'BLOCKED');
  assert.equal(r.core.ready, true);
  assert.equal(r.candidate.headerMode, 'WAL');
  assert.equal(r.candidate.walExists, true);
  assert.equal(r.candidate.shmExists, false);
  assert.equal(r.candidate.problem, 'WAL_SIDECARS_PARTIAL');
  assert.equal(r.candidate.walSidecarState, 'WAL_ONLY');
  assert.ok(r.blockedConditions.includes('CANDIDATE_WAL_SIDECARS_PARTIAL'));

  assert.equal(fs.existsSync(f.candidate + '-shm'), false);
});

test('rollback mode does not require sidecars', t => {
  const f = fixture(t, 'ROLLBACK', 'ROLLBACK');
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.core.ready, true);
  assert.equal(r.candidate.ready, true);
  assert.equal(r.core.sidecarsRequired, false);
  assert.equal(r.candidate.walExists, false);
});

test('clean-close-shaped WAL with both sidecars absent is unverified, not DB corruption', t => {
  const f = fixture(t, 'WAL', 'ROLLBACK');
  const before = [f.core, f.candidate].map(p => [fs.readFileSync(p), fs.statSync(p).mtimeMs]);
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.core.headerMode, 'WAL');
  assert.equal(r.core.walSidecarState, 'BOTH_ABSENT');
  assert.equal(r.core.problem, 'WAL_SIDECARS_ABSENT_UNVERIFIED');
  assert.equal(r.core.ready, false);
  assert.equal(r.status, 'BLOCKED');
  assert.equal(r.code, 'R6_DB_PREFLIGHT_FAILED'); // Stable external code.
  assert.ok(r.blockedConditions.includes('CORE_WAL_SIDECARS_ABSENT_UNVERIFIED'));
  assert.equal(r.blockedConditions.includes('RESOURCE_WAIT_MEMORY'), !r.resource.ready);
  assert.equal(r.sqliteOpened, false);
  assert.equal(r.operationalWrites, 0);
  for (const [i, p] of [f.core, f.candidate].entries()) {
    assert.deepEqual(fs.readFileSync(p), before[i][0]);
    assert.equal(fs.statSync(p).mtimeMs, before[i][1]);
  }
  assert.equal(fs.existsSync(f.core + '-wal'), false);
  assert.equal(fs.existsSync(f.core + '-shm'), false);
});

test('WAL sidecars partial shm-only remains blocked with exact reason', t => {
  const f = fixture(t, 'WAL', 'ROLLBACK', {'core':['-shm']});
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.core.walSidecarState, 'SHM_ONLY');
  assert.equal(r.core.problem, 'WAL_SIDECARS_PARTIAL');
  assert.equal(r.core.ready, false);
  assert.ok(r.blockedConditions.includes('CORE_WAL_SIDECARS_PARTIAL'));
  assert.equal(fs.existsSync(f.core + '-wal'), false);
  assert.equal(r.operationalWrites, 0);
});

test('present WAL pair stays eligible independently of memory gate', t => {
  const f = fixture(t, 'WAL', 'ROLLBACK', {'core':['-wal','-shm']});
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.core.walSidecarState, 'BOTH_PRESENT');
  assert.equal(r.core.ready, true);
  assert.equal(r.candidate.walSidecarState, 'NOT_REQUIRED');
  assert.equal(r.blockedConditions.includes('RESOURCE_WAIT_MEMORY'), !r.resource.ready);
  assert.equal(r.code, r.resource.ready ? 'R6_WAL_MEMORY_PREFLIGHT_READY' : 'RESOURCE_WAIT_MEMORY');
  assert.equal(r.candidateExecuted, false);
  assert.equal(r.operationalWrites, 0);
});

test('R6 #741 shape reports sidecar absence and 480MiB shortage together', t => {
  const f = fixture(t, 'WAL', 'ROLLBACK');
  t.mock.method(os, 'freemem', () => 480 * 1048576);
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.status, 'BLOCKED');
  assert.equal(r.code, 'R6_DB_PREFLIGHT_FAILED');
  assert.deepEqual(r.blockedConditions,
    ['CORE_WAL_SIDECARS_ABSENT_UNVERIFIED', 'RESOURCE_WAIT_MEMORY']);
  assert.equal(r.resource.freeMiB, 480);
  assert.equal(r.resource.minimumFreeMiB, 1536);
  assert.equal(r.candidateExecuted, false);
  assert.equal(r.sqliteOpened, false);
  assert.equal(r.operationalWrites, 0);
  assert.equal(fs.existsSync(f.core + '-wal'), false);
  assert.equal(fs.existsSync(f.core + '-shm'), false);
});

test('real SQLite normal WAL final close may remove sidecars; probe does not recreate them', t => {
  const f = fixture(t, 'WAL', 'ROLLBACK');
  fs.unlinkSync(f.core);
  const db = new DatabaseSync(f.core);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE observation(v INTEGER); INSERT INTO observation VALUES(1)');
  db.close();
  assert.equal(fs.existsSync(f.core + '-wal'), false);
  assert.equal(fs.existsSync(f.core + '-shm'), false);
  const before = fs.readFileSync(f.core);
  const beforeMtime = fs.statSync(f.core).mtimeMs;
  const r = inspectEmploymentR6WalMemoryPreflight({host: f.host});
  assert.equal(r.core.walSidecarState, 'BOTH_ABSENT');
  assert.equal(r.core.problem, 'WAL_SIDECARS_ABSENT_UNVERIFIED');
  assert.equal(r.core.ready, false);
  assert.deepEqual(fs.readFileSync(f.core), before);
  assert.equal(fs.statSync(f.core).mtimeMs, beforeMtime);
  assert.equal(fs.existsSync(f.core + '-wal'), false);
  assert.equal(fs.existsSync(f.core + '-shm'), false);
});

