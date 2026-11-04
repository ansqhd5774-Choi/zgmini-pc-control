import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectEmploymentR6WalMemoryPreflight} from './employment-r6-wal-memory-readonly.mjs';

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
  assert.equal(r.candidate.problem, 'WAL_SIDECAR_NOT_READY');
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
