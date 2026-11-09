import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResourceWait, reconcileResourceWait, reviewResourceWait, summarizeResourceRecheckEvidence}
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

test('PC Controller consumed request is not a Writer B unclaimed preflight', () => {
  const pc = candidate(1201, 'pc-job-heavy-memory', {
    requestId:'pc-abcd1234-1234', status:'BLOCKED',
    code:'RESOURCE_WAIT_MEMORY',
    safePoint:'REQUEST_CONSUMED_PREWORKER_UNTOUCHED',
    releaseCondition:'HEAVY_MEMORY_AVAILABLE_VERIFIED'});
  assert.equal(pc.safePoint, 'REQUEST_CONSUMED_PREWORKER_UNTOUCHED');
  assert.equal(pc.originalStateVerified, false);
  assert.equal(pc.automaticPcRetries, 0);
  assert.equal(pc.resume, 'OWNER_REPLAN_NEW_AUTHORIZED_REQUEST_ONLY');
  assert.throws(() => candidate(1201, 'pc-job-heavy-memory', {
    safePoint:'REQUEST_CONSUMED_PREWORKER_UNTOUCHED',
    recovery:'ORIGINAL_VERIFIED'}), /SAFE_POINT_UNPROVEN/);
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

test('release hint cannot grant owner replan without authenticated runtime proof', () => {
  const w = candidate();
  assert.equal(reviewResourceWait(w, {release:'STILL_BUSY'}).state,
    'WAITING_SHARED_RESOURCE');
  assert.equal(reviewResourceWait(w, {release:'UNVERIFIED'}).state,
    'WAITING_SHARED_RESOURCE');
  const released = reviewResourceWait(w, {release:'VERIFIED_RELEASED',
    sourceSha:src, manifestSha256:approval});
  assert.equal(released.state, 'RECHECK_EVIDENCE_PENDING');
  assert.equal(released.ownerReceipt, 'UNKNOWN');
  assert.equal(released.automaticPcRetries, 0);
  assert.equal(released.nextAction,
    'VERIFY_RESOURCE_RELEASE_CURRENT_SOURCE_AND_APPROVAL');
  assert.equal(reviewResourceWait(w, {release:'VERIFIED_RELEASED',
    sourceSha:'c'.repeat(40), manifestSha256:approval}).state,
    'RECHECK_EVIDENCE_PENDING');
  assert.equal(reviewResourceWait(w, {release:'VERIFIED_RELEASED',
    sourceSha:src}).state, 'RECHECK_EVIDENCE_PENDING');
  assert.throws(() => reviewResourceWait(w, {release:'FORCE_UNLOCK'}),
    /RECHECK_INVALID/);
});


function recheckInput(wait = candidate()) {
  return {
    originReadback: {
      repository: wait.origin.repository,
      issueNumber: wait.origin.issueNumber,
      requestId: wait.origin.requestId,
      runId: wait.evidence.runId,
      status: wait.evidence.status,
      code: wait.evidence.code,
      resultJsonPath: wait.evidence.resultJsonPath,
      resultTxtPath: wait.evidence.resultTxtPath,
      controlSourceSha: wait.origin.sourceSha,
      manifestSha256: wait.origin.manifestSha256,
      botReceiptReadbackVerified: true,
      resultPairReadbackVerified: true,
    },
    releaseObservation: {
      operation: 'shared-resource-release-readonly',
      runId: 42699990000,
      resultJsonPath: 'results/42699990000-1-seat-2.json',
      resultTxtPath: 'results/42699990000-1-seat-2.txt',
      resultPairReadbackVerified: true,
      status: 'PASS',
      code: 'SHARED_RESOURCE_READONLY_SNAPSHOT',
      resourceKey: wait.resourceKey,
      resourceState: 'CANDIDATE_CLEAR_NOT_AUTHORIZED',
      observedConfigSourceSha: 'c'.repeat(40),
      releaseVerified: false,
      ownerReplanAuthorized: false,
    },
    currentApproval: {
      currentReadbackVerified: true,
      controlSourceSha: 'd'.repeat(40),
      runtimeConfigSourceSha: 'c'.repeat(40),
      approvedRuntimeConfigSourceSha: 'c'.repeat(40),
      manifestSha256: wait.origin.manifestSha256,
    },
  };
}

test('source-only recheck summary remains closed even with consistent candidates', () => {
  const w = candidate();
  const result = summarizeResourceRecheckEvidence(w, recheckInput(w));
  assert.equal(result.state, 'RECHECK_EVIDENCE_PENDING');
  assert.deepEqual(result.missing, []);
  assert.equal(result.releaseVerified, false);
  assert.equal(result.ownerReplanAuthorized, false);
  assert.equal(result.automaticPcRetries, 0);
});

test('different approved manifest is a drift review, never implicit release', () => {
  const w = candidate();
  const input = recheckInput(w);
  input.currentApproval.manifestSha256 = 'e'.repeat(64);
  const result = summarizeResourceRecheckEvidence(w, input);
  assert.equal(result.state, 'SOURCE_DRIFT_REVIEW');
  assert.equal(result.historicalManifestChanged, true);
  assert.equal(result.ownerReplanAuthorized, false);
  assert.equal(result.nextAction, 'OWNER_REVIEW_NEW_APPROVAL_AND_RELEASE_EVIDENCE');
});

test('cross-request, spoofed A operation and result-pair mismatch stay pending', () => {
  const w = candidate();
  const forged = recheckInput(w);
  forged.originReadback.requestId = '9'.repeat(36);
  forged.releaseObservation.operation = 'another-operation';
  forged.releaseObservation.resultTxtPath = 'results/other.txt';
  const result = summarizeResourceRecheckEvidence(w, forged);
  assert.equal(result.state, 'RECHECK_EVIDENCE_PENDING');
  assert.deepEqual(result.missing, [
    'ORIGINAL_ISSUE_RUN_RESULT_PAIR',
    'WINDOWS_READONLY_RELEASE_CANDIDATE'
  ]);
  assert.equal(result.ownerReplanAuthorized, false);
});


test('origin result status and failure code must match the historical wait', () => {
  const w = candidate();
  const forged = recheckInput(w);
  forged.originReadback.status = 'WRITER_B_INSTALLED_VERIFIED';
  forged.originReadback.code = 'OTHER_CODE';
  const result = summarizeResourceRecheckEvidence(w, forged);
  assert.equal(result.state, 'RECHECK_EVIDENCE_PENDING');
  assert.deepEqual(result.missing, ['ORIGINAL_ISSUE_RUN_RESULT_PAIR']);
  assert.equal(result.ownerReplanAuthorized, false);
});

test('unverified source/approval and forged release flag cannot grant readiness', () => {
  const w = candidate();
  const input = recheckInput(w);
  input.releaseObservation.releaseVerified = true;
  input.currentApproval.currentReadbackVerified = false;
  const result = summarizeResourceRecheckEvidence(w, input);
  assert.ok(result.missing.includes('WINDOWS_READONLY_RELEASE_CANDIDATE'));
  assert.ok(result.missing.includes('CURRENT_SOURCE_AND_APPROVAL_READBACK'));
  assert.equal(result.state, 'RECHECK_EVIDENCE_PENDING');
  assert.equal(result.ownerReceipt, 'UNKNOWN');
});

test('Windows config source must match the current approved runtime scope', () => {
  const w = candidate();
  const input = recheckInput(w);
  input.currentApproval.approvedRuntimeConfigSourceSha = 'f'.repeat(40);
  const result = summarizeResourceRecheckEvidence(w, input);
  assert.equal(result.state, 'RECHECK_EVIDENCE_PENDING');
  assert.ok(result.missing.includes('CURRENT_SOURCE_AND_APPROVAL_READBACK'));
});
