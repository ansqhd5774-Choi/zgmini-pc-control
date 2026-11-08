import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {createHandoffQueue, initializeHandoffQueueSchema,
  HANDOFF_QUEUE_RETRIES} from '../agent-handoff/sqlite-queue.mjs';

function incident(id = 'handoff-123456789abc') {
  return {schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: id,
    origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009,
      requestId: 'pc-123456789abc', chatId: 'chat-theme1',
      branch: 'codex/theme', sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
    failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP',
      lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}};
}

function inMemory(clock) {
  const db = new DatabaseSync(':memory:');
  initializeHandoffQueueSchema(db);
  return {db, queue: createHandoffQueue(db, {clock})};
}

test('source-only API never opens a PC database or retries an operation', () => {
  assert.equal(HANDOFF_QUEUE_RETRIES, 0);
  const {db, queue} = inMemory(() => 1_000);
  try {
    const saved = queue.enqueue(incident());
    assert.equal(saved.inserted, true);
    assert.equal(saved.operationalWrites, 0);
    assert.equal(saved.automaticPcRetries, 0);
    assert.equal(queue.read(saved.fingerprint).status, 'PENDING');
    assert.deepEqual(queue.stats(), {PENDING: 1, CLAIMED: 0,
      ROUTED_PENDING_AGENT: 0, STATE_UNKNOWN: 0, total: 1});
  } finally { db.close(); }
});

test('identical failure with a new incident ID is reused; substantive mutation fails closed', () => {
  const {db, queue} = inMemory(() => 1_000);
  try {
    const first = queue.enqueue(JSON.stringify(incident()));
    const again = queue.enqueue(incident());
    assert.equal(again.inserted, false);
    assert.equal(first.fingerprint, again.fingerprint);
    const changed = incident('handoff-abcdef012345');
    const reused = queue.enqueue(changed);
    assert.equal(reused.inserted, false);
    assert.equal(reused.existingIncidentId, 'handoff-123456789abc');
    changed.failure.lastPass = 'DIAGNOSTIC_PASS';
    assert.throws(() => queue.enqueue(changed), /FINGERPRINT_COLLISION_STOP/);
    assert.equal(queue.stats().total, 1);
  } finally { db.close(); }
});

test('different source SHA creates a distinct queued incident', () => {
  const {db, queue} = inMemory(() => 1_000);
  try {
    queue.enqueue(incident());
    const other = incident('handoff-abcdef012345');
    other.origin.sourceSha = 'b'.repeat(40);
    assert.equal(queue.enqueue(other).inserted, true);
    assert.equal(queue.stats().PENDING, 2);
  } finally { db.close(); }
});

test('six independent Runner-like SQLite connections claim a shared incident once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-queue-test-'));
  const filename = path.join(dir, 'handoff-test.sqlite');
  const connections = Array.from({length: 6}, () => new DatabaseSync(filename));
  let now = 1_000;
  try {
    initializeHandoffQueueSchema(connections[0]);
    const queues = connections.map((db) => createHandoffQueue(db, {clock: () => now}));
    for (const db of connections) {
      assert.ok(db.prepare('PRAGMA busy_timeout').get().timeout >= 5000,
        'every independent connection must wait for SQLite writes');
    }
    queues[0].enqueue(incident());
    const claims = queues.map((queue, i) => queue.claim(`worker-${i + 1}`));
    assert.equal(claims.filter(Boolean).length, 1);
    const first = claims.find(Boolean);
    assert.equal(first.generation, 1);
    assert.equal(queues[4].read(first.fingerprint).status, 'CLAIMED');
    now += 60_001;
    assert.equal(queues[4].claim('worker-seven'), null, 'lease timeout must never auto re-run');
    assert.equal(queues[4].markExpiredUnknown(), 1);
    assert.equal(queues[0].read(first.fingerprint).status, 'STATE_UNKNOWN');
    assert.equal(queues[0].claim('worker-one'), null);
  } finally {
    for (const db of connections) db.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('six simultaneous worker threads take at most one SQLite claim', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-queue-concurrent-'));
  const filename = path.join(dir, 'handoff-test.sqlite');
  const db = new DatabaseSync(filename);
  const workers = [];
  const signal = new Int32Array(new SharedArrayBuffer(8));
  try {
    initializeHandoffQueueSchema(db);
    const queue = createHandoffQueue(db, {clock: () => 1_000});
    const saved = queue.enqueue(incident());
    const workerCode = `
      const {parentPort, workerData} = require('node:worker_threads');
      const {DatabaseSync} = require('node:sqlite');
      (async () => {
        const {createHandoffQueue} = await import(workerData.moduleUrl);
        const db = new DatabaseSync(workerData.filename);
        const q = createHandoffQueue(db, {clock: () => 1_000});
        const signal = new Int32Array(workerData.signal);
        Atomics.add(signal, 1, 1);
        Atomics.notify(signal, 1);
        if (Atomics.wait(signal, 0, 0, 15000) === 'timed-out') {
          throw new Error('HANDOFF_TEST_WORKER_START_TIMEOUT');
        }
        try {
          const lease = q.claim('worker-' + workerData.index);
          parentPort.postMessage({ok: true, claimed: !!lease});
        } catch (error) {
          parentPort.postMessage({ok: false, error: error.message});
        } finally { db.close(); }
      })().catch(error => parentPort.postMessage({ok: false, error: error.message}));
    `;
    const results = Array.from({length: 6}, (_, index) => {
      const worker = new Worker(workerCode, {eval: true, workerData: {
        filename, index, signal: signal.buffer,
        moduleUrl: new URL('../agent-handoff/sqlite-queue.mjs', import.meta.url).href}});
      workers.push(worker);
      return new Promise((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
      });
    });
    while (Atomics.load(signal, 1) !== 6) {
      const observed = Atomics.load(signal, 1);
      if (Atomics.wait(signal, 1, observed, 15000) === 'timed-out') {
        throw new Error('HANDOFF_TEST_WORKERS_NOT_READY');
      }
    }
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0, 6);
    const outcomes = await Promise.all(results);
    assert.deepEqual(outcomes.filter(o => !o.ok), [], 'no SQLITE_BUSY or other worker errors');
    assert.equal(outcomes.filter(o => o.claimed).length, 1);
    assert.equal(queue.read(saved.fingerprint).status, 'CLAIMED');
  } finally {
    await Promise.all(workers.map(worker => worker.terminate()));
    db.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('read and claim reject corrupted stored payload bytes', () => {
  const {db, queue} = inMemory(() => 1_000);
  try {
    const saved = queue.enqueue(incident());
    db.prepare('UPDATE zgmini_handoff_queue_v1 SET payload = ? WHERE fingerprint = ?')
      .run('{"corrupt":true}', saved.fingerprint);
    assert.throws(() => queue.read(saved.fingerprint), /PAYLOAD_HASH_MISMATCH_STOP/);
    assert.throws(() => queue.claim('worker-one'), /PAYLOAD_HASH_MISMATCH_STOP/);
    assert.equal(queue.stats().CLAIMED, 1, 'failed post-claim check must not issue a new claim');
    assert.equal(queue.claim('worker-two'), null, 'corrupted claim cannot run twice');
  } finally { db.close(); }
});

test('consistent payload/hash tampering cannot redirect an existing fingerprint or role', () => {
  const {db, queue} = inMemory(() => 1_000);
  try {
    const saved = queue.enqueue(incident());
    const changed = incident();
    changed.origin.sourceSha = 'b'.repeat(40);
    const payload = JSON.stringify(changed);
    const hash = createHash('sha256').update(payload).digest('hex');
    db.prepare('UPDATE zgmini_handoff_queue_v1 SET payload = ?, payload_sha256 = ? WHERE fingerprint = ?')
      .run(payload, hash, saved.fingerprint);
    assert.throws(() => queue.read(saved.fingerprint), /STORED_CONTRACT_MISMATCH_STOP/);
    assert.throws(() => queue.enqueue(incident()), /STORED_CONTRACT_MISMATCH_STOP/);
  } finally { db.close(); }
});

test('live lease may extend; stale tokens cannot extend or close it', () => {
  let now = 1_000;
  const {db, queue} = inMemory(() => now);
  try {
    queue.enqueue(incident());
    const lease = queue.claim('worker-one', {leaseMs: 40});
    now += 20;
    assert.equal(queue.extend({...lease, generation: 2}), false);
    assert.equal(queue.extend(lease, {leaseMs: 80}), true);
    now += 25;
    assert.equal(queue.markExpiredUnknown(), 0, 'the valid extension keeps ownership');
    now += 60;
    assert.equal(queue.extend(lease), false);
    assert.equal(queue.markExpiredUnknown(), 1);
  } finally { db.close(); }
});

test('expired or incorrect lease cannot acknowledge a successful handoff', () => {
  let now = 1_000;
  const {db, queue} = inMemory(() => now);
  try {
    const saved = queue.enqueue(incident());
    const lease = queue.claim('worker-one', {leaseMs: 50});
    const evidence = {issueNumber: 2001, commentId: 123, fingerprint: saved.fingerprint,
      marker: 'HANDOFF_ROUTED', verifiedCommentReadback: true};
    assert.equal(queue.markRouted({...lease, token: '0'.repeat(36)}, evidence), false);
    now += 51;
    assert.equal(queue.extend(lease), false);
    assert.equal(queue.markRouted(lease, evidence), false);
    assert.equal(queue.markExpiredUnknown(), 1);
    assert.equal(queue.markRouted(lease, evidence), false);
    assert.equal(queue.stats().STATE_UNKNOWN, 1);
  } finally { db.close(); }
});

test('readback evidence is mandatory and only records routing, not AI reception', () => {
  const {db, queue} = inMemory(() => 1_000);
  try {
    const saved = queue.enqueue(incident());
    const lease = queue.claim('worker-one');
    const evidence = {issueNumber: 2001, commentId: 123, fingerprint: saved.fingerprint,
      marker: 'HANDOFF_ROUTED', verifiedCommentReadback: true};
    assert.throws(() => queue.markRouted(lease, {...evidence, verifiedCommentReadback: false}),
      /ROUTE_EVIDENCE_REQUIRED/);
    assert.throws(() => queue.markRouted(lease, {...evidence, secret: 'never store'}),
      /ROUTE_EVIDENCE_REQUIRED/);
    assert.equal(queue.markRouted(lease, evidence), true);
    assert.equal(queue.markRouted(lease, evidence), false);
    assert.equal(queue.read(saved.fingerprint).status, 'ROUTED_PENDING_AGENT');
    assert.deepEqual(queue.read(saved.fingerprint).routeEvidence,
      {issueNumber: 2001, commentId: 123, fingerprint: saved.fingerprint, marker: 'HANDOFF_ROUTED'});
    assert.equal(queue.stats().ROUTED_PENDING_AGENT, 1);
    assert.equal(queue.claim('worker-two'), null);
  } finally { db.close(); }
});

test('handoff contract rejects raw secrets, foreign repositories and invalid owners', () => {
  const {db, queue} = inMemory(() => 1_000);
  try {
    const bad = incident();
    bad.failure.rawError = 'Authorization: bearer secret';
    assert.throws(() => queue.enqueue(bad), /UNEXPECTED_FIELD/);
    const foreign = incident();
    foreign.origin.repository = 'unknown/repo';
    assert.throws(() => queue.enqueue(foreign), /REPOSITORY_NOT_ALLOWED/);
    assert.throws(() => queue.claim('E:/PC/root'), /OWNER_INVALID/);
    assert.equal(queue.stats().total, 0);
  } finally { db.close(); }
});
