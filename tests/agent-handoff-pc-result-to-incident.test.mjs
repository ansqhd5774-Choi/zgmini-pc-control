import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePcFailureHandoff, reconcileHandoffInventory} from
  '../agent-handoff/pc-result-to-incident.mjs';
import {parseHandoff} from '../agent-handoff/contract.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const request = () => ({schema: 'ZGMINI_PC_JOB_V1', requestId: 'pc-abc123456789',
  chatId: 'chat-test-1', operation: 'runner-smoke',
  sourceRepository: 'ansqhd5774-Choi/zgmini', sourceBranch: 'main', sourceSha: 'a'.repeat(40)});
const issue = () => ({repository: repo, number: 1009, user: {login: 'ansqhd5774-Choi'},
  labels: [{name: 'pc-job'}], body: JSON.stringify(request())});
const report = () => ({schema: 'ZGMINI_PC_RESULT_V1', jobId: 'run-42423158559-1-seat-4',
  requestId: 'pc-abc123456789', chatId: 'chat-test-1', seat: 4,
  controlRepository: repo, controlSourceSha: 'b'.repeat(40),
  sourceRepository: 'ansqhd5774-Choi/zgmini', sourceBranch: 'main',
  requestedSourceSha: 'a'.repeat(40), operation: 'runner-smoke',
  status: 'FAIL', code: 'RUNNER_IMPORT_STOP', lastPass: 'SOURCE_CHECKED',
  firstFail: 'RUNTIME_IMPORT', finishedAt: '2026-11-08T23:00:00Z'});
const input = () => ({originIssue: issue(), report: report(),
  resultPath: 'results/42423158559-1-seat-4.json'});

test('a consistent confirmed PC failure produces deterministic minimal handoff', () => {
  const first = preparePcFailureHandoff(input());
  const second = preparePcFailureHandoff(input());
  assert.deepEqual(first, second);
  assert.equal(first.state, 'READY_TO_ENQUEUE');
  const body = parseHandoff(first.body);
  assert.equal(body.failure.kind, 'COMMON_RUNNER');
  assert.equal(body.origin.repository, repo);
  assert.equal(body.origin.issueNumber, 1009);
  assert.equal(body.origin.checkpoint, 'OTHER');
  assert.deepEqual(body.failure.fileRefs, []);
  assert.equal(first.fingerprint.length, 64);
});

test('STATE_UNKNOWN, BLOCKED and PASS never become repair incidents', () => {
  for (const status of ['STATE_UNKNOWN', 'BLOCKED', 'PASS']) {
    const candidate = input(); candidate.report.status = status;
    assert.equal(preparePcFailureHandoff(candidate).state, 'NOT_ELIGIBLE');
  }
});

test('spoofed original issue author, repo or pc-job label is refused', () => {
  for (const change of [
    v => { v.originIssue.user.login = 'attacker'; },
    v => { v.originIssue.repository = 'other/repo'; },
    v => { v.originIssue.labels = []; }
  ]) {
    const candidate = input(); change(candidate);
    assert.throws(() => preparePcFailureHandoff(candidate), /PC_HANDOFF_ISSUE_NOT_AUTHORIZED/);
  }
});

test('request/result ID, source, operation and result path mismatch stop', () => {
  for (const change of [
    v => { v.report.requestId = 'pc-other-id'; },
    v => { v.report.chatId = 'chat-forged'; },
    v => { v.report.requestedSourceSha = 'c'.repeat(40); },
    v => { v.report.operation = 'other-operation'; },
    v => { v.report.seat = 5; },
    v => { v.resultPath = 'results/other.json'; }
  ]) {
    const candidate = input(); change(candidate);
    assert.throws(() => preparePcFailureHandoff(candidate), /PC_HANDOFF_.*STOP|PC_HANDOFF_RESULT_PROVENANCE_INVALID/);
  }
});

test('common writer/controller and unknown failure classes retain precise classification', () => {
  for (const [code, expected] of [
    ['CONTROLLER_SOURCE_DRIFT', 'COMMON_CONTROLLER'],
    ['WRITER_CONTRACT_FAIL', 'COMMON_WRITER'],
    ['PROVIDER_TIMEOUT_FAIL', 'FEATURE']
  ]) {
    const candidate = input(); candidate.report.code = code;
    assert.equal(parseHandoff(preparePcFailureHandoff(candidate).body).failure.kind, expected);
  }
});

test('inventory reuses exact incident, refuses collision and incomplete scans', () => {
  const prepared = preparePcFailureHandoff(input());
  const inventory = {repository: repo, complete: true, issues: []};
  assert.equal(reconcileHandoffInventory(prepared, inventory).state, 'CREATE_CANDIDATE_ONLY');
  inventory.issues.push({repository: repo, number: 2001,
    user: {login: 'ansqhd5774-Choi'}, body: prepared.body,
    labels: [{name: 'agent-handoff'}]});
  assert.deepEqual(reconcileHandoffInventory(prepared, inventory),
    {state: 'REUSE_EXISTING', issueNumber: 2001});
  inventory.complete = false;
  assert.throws(() => reconcileHandoffInventory(prepared, inventory), /PC_HANDOFF_INVENTORY_INCOMPLETE/);
  inventory.complete = true;
  inventory.issues.push({...inventory.issues[0], number: 2002});
  assert.throws(() => reconcileHandoffInventory(prepared, inventory), /PC_HANDOFF_DUPLICATE_INCIDENT_STOP/);
});

test('GitHub Actions bot-created incident is accepted for dedup but spoofed origin is not', () => {
  const prepared = preparePcFailureHandoff(input());
  const inventory = {repository: repo, complete: true, issues: [{repository: repo, number: 2003,
    user: {login: 'github-actions[bot]'}, body: prepared.body,
    labels: [{name: 'agent-handoff'}]}]};
  assert.equal(reconcileHandoffInventory(prepared, inventory).state, 'REUSE_EXISTING');
  const forged = input(); forged.originIssue.user.login = 'github-actions[bot]';
  assert.throws(() => preparePcFailureHandoff(forged), /PC_HANDOFF_ISSUE_NOT_AUTHORIZED/);
});
