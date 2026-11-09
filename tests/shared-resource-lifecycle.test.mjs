import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResourceWait, reconcileResourceWait, reviewResourceWait}
  from '../shared-resource/lifecycle.mjs';

const uuid = '9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
const chat = 'e94b51bd-0c27-4257-b430-c8f69fa6728e';
const src = 'a'.repeat(40);
const approval = 'b'.repeat(64);
function candidate(issueNumber = 1092, resourceKey = 'writer-source', options = {}) {
  return prepareResourceWait({
    resourceKey, origin: {repository: 'ansqhd5774-Choi/zgmini-pc-control',
      issueNumber, requestId: options.requestId ?? uuid, chatId: chat,
      sourceSha: src, manifestSha256: approval},
    evidence: {runId: 42636354244, status: options.status ?? 'WRITER_B_PREFLIGHT_STOP',
      code: options.code ?? 'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED',
      resultJsonPath: 'results/writer-b-source-install-'+uuid+'.json',
      resultTxtPath: 'results/writer-b-source-install-'+uuid+'.txt',
      resultPairReadbackVerified: true},
    safePoint: options.safePoint ?? 'UNCLAIMED_UNTOUCHED',
    recovery: options.recovery,
    releaseCondition: options.releaseCondition ?? 'CORE_IDLE_WINDOW_VERIFIED',
  });
}

test('verified clean defer yields one source-only waiting record', () => {
  const first = candidate();
  assert.equal(first.state, 'WAITING_SHARED_RESOURCE');
  assert.equal(first.automaticPcRetries, 0);
  assert.equal(first.ownerReceipt, 'UNKNOWN');
  assert.equal(first.originalStateVerified, false);
  assert.deepEqual(candidate(), first);
  assert.deepEqual(reconcileResourceWait(first, {complete: true, records: []}),
    {state: 'CREATE_CANDIDATE_ONLY', waitId: first.waitId, automaticPcRetries: 0});
  assert.equal(reconcileResourceWait(first, {complete: true, records: [first]}).state,
    'REUSE_EXISTING');
});

test('3 different feature requests on same resource stay distinct and share intent', () => {
  const items = [candidate(1092), candidate(1064), candidate(1081)];
  assert.equal(new Set(items.map(x => x.waitId)).size, 3);
  assert.equal(new Set(items.map(x => x.intentKey)).size, 1);
  assert.equal(new Set(items.map(x => x.resourceKey)).size, 1);
  assert.notEqual(candidate(1092, 'controller-install').intentKey, items[0].intentKey);
});

test('post-claim deferral requires exact original restoration proof', () => {
  const safe = candidate(1092, 'writer-source', {
    status: 'WRITER_B_INSTALL_STOP_RESTORED',
    safePoint: 'CLAIMED_ORIGINAL_VERIFIED', recovery: 'ORIGINAL_VERIFIED'});
  assert.equal(safe.originalStateVerified, true);
  assert.throws(() => candidate(1092, 'writer-source', {
    safePoint: 'CLAIMED_ORIGINAL_VERIFIED'}), /SAFE_POINT_UNPROVEN/);
  assert.throws(() => candidate(1092, 'writer-source', {
    recovery: 'ORIGINAL_VERIFIED'}), /SAFE_POINT_UNPROVEN/);
});

test('cannot create waiting records from unverified or spoofed evidence', () => {
  const good = candidate();
  for (const mutation of [
    x => {x.evidence.resultPairReadbackVerified = false;},
    x => {x.evidence.resultTxtPath = 'results/not-same.txt';},
    x => {x.origin.sourceSha = 'bad';},
    x => {x.resourceKey = '../unsafe';},
    x => {x.releaseCondition = 'a bad command';},
  ]) {
    const input = {
      resourceKey: good.resourceKey,
      origin: {...good.origin},
      evidence: {...good.evidence},
      safePoint: good.safePoint,
      releaseCondition: good.releaseCondition,
    };
    mutation(input);
    assert.throws(() => prepareResourceWait(input), /SHARED_RESOURCE_/);
  }
  assert.throws(() => reconcileResourceWait(good, {complete: false, records: []}),
    /INVENTORY_UNVERIFIED/);
  assert.throws(() => reconcileResourceWait(good,
    {complete: true, records: [{...good, safePoint:'CLAIMED_ORIGINAL_VERIFIED'}]}),
    /WAIT_CONFLICT_STOP/);
  assert.throws(() => reconcileResourceWait(good,
    {complete: true, records: [good, good]}), /DUPLICATE_WAIT_STOP/);
});

test('release never retries; drift demands new source approval review', () => {
  const w = candidate();
  assert.equal(reviewResourceWait(w, {release:'STILL_BUSY'}).state,
    'WAITING_SHARED_RESOURCE');
  assert.equal(reviewResourceWait(w, {release:'UNVERIFIED'}).state,
    'WAITING_SHARED_RESOURCE');
  const released = reviewResourceWait(w, {release:'VERIFIED_RELEASED',
    sourceSha:src, manifestSha256:approval});
  assert.equal(released.state, 'READY_FOR_OWNER_REPLAN');
  assert.equal(released.ownerReceipt, 'UNKNOWN');
  assert.equal(released.automaticPcRetries, 0);
  assert.equal(reviewResourceWait(w, {release:'VERIFIED_RELEASED',
    sourceSha:'c'.repeat(40), manifestSha256:approval}).state, 'SOURCE_DRIFT_REVIEW');
  assert.equal(reviewResourceWait(w, {release:'VERIFIED_RELEASED',
    sourceSha:src}).state, 'SOURCE_DRIFT_REVIEW');
  assert.throws(() => reviewResourceWait(w, {release:'FORCE_UNLOCK'}),
    /RECHECK_INVALID/);
});
