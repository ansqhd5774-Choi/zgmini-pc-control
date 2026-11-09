import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertCompletedPcJobEvent, findOriginalIssueNumber, processCompletedPcJob} from
  '../agent-handoff/pc-failure-producer.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const runId = 42423158559;
const attempt = 1;
const owner = 'ansqhd5774-Choi';
const bot = 'github-actions[bot]';
const request = () => ({schema: 'ZGMINI_PC_JOB_V1', requestId: 'pc-abcd1234-1234',
  chatId: 'chat-1234', operation: 'core-status',
  sourceRepository: 'ansqhd5774-Choi/zgmini', sourceBranch: 'main', sourceSha: 'a'.repeat(40)});
const issue = () => ({repository: repo, number: 1009, user: {login: owner},
  labels: [{name: 'pc-job'}], body: JSON.stringify(request())});
const event = () => ({action: 'completed', repository: {full_name: repo, private: true},
  workflow_run: {name: 'ZGMINI PC Job', event: 'issues', actor: {login: owner},
    head_repository: {full_name: repo}, id: runId, run_attempt: attempt,
    created_at: '2026-11-08T22:00:00Z'}});
const report = (status = 'FAIL') => ({schema: 'ZGMINI_PC_RESULT_V1',
  jobId: `run-${runId}-${attempt}-seat-4`, requestId: request().requestId,
  chatId: request().chatId, seat: 4, controlRepository: repo,
  controlSourceSha: 'b'.repeat(40), sourceRepository: request().sourceRepository,
  sourceBranch: request().sourceBranch, requestedSourceSha: request().sourceSha,
  operation: request().operation, status, code: 'CONTROLLER_IMPORT_FAILED',
  lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', finishedAt: '2026-11-08T23:00:00Z'});
const comments = () => [{user: {login: bot}, body: `<!-- zgmini-pc-result:${runId}:${attempt}:4 -->\nverified`,
  issue_url: `https://api.github.com/repos/${repo}/issues/1009`}];
const fixture = (status = 'FAIL') => {
  const issues = [];
  let posts = 0;
  const io = {
    readReport: async p => p.endsWith('seat-4.json') ? report(status) : null,
    readComments: async () => comments(),
    readIssue: async n => n === 1009 ? issue() : issues.find(x => x.number === n),
    listHandoffs: async () => ({repository: repo, complete: true, issues: structuredClone(issues)}),
    createHandoff: async candidate => {
      posts++;
      const item = {repository: repo, number: 2003, body: candidate.body,
        user: {login: bot}, labels: [{name: 'agent-handoff'}]};
      issues.push(item);
      return item;
    }
  };
  return {io, issues, get posts() { return posts; }};
};

test('completed six-seat run emits exactly one sanitized handoff for one confirmed FAIL', async () => {
  const f = fixture();
  const result = await processCompletedPcJob(event(), f.io);
  assert.equal(result.state, 'SCAN_COMPLETED');
  assert.equal(result.reportsObserved, 1);
  assert.equal(result.confirmedFailures, 1);
  assert.equal(result.newIssues, 1);
  assert.equal(result.pcOperationalWrites, 0);
  assert.equal(result.automaticPcRetries, 0);
  assert.equal(f.posts, 1);
  assert.equal(f.issues.length, 1);
  assert.doesNotMatch(f.issues[0].body, /GITHUB_TOKEN|rawPayload|password/);
  const repeated = await processCompletedPcJob(event(), f.io);
  assert.equal(repeated.reusedIssues, 1);
  assert.equal(repeated.newIssues, 0);
  assert.equal(f.posts, 1);
});

test('STATE_UNKNOWN, BLOCKED and PASS are non-eligible and never generate Issues', async () => {
  for (const state of ['STATE_UNKNOWN', 'BLOCKED', 'PASS']) {
    const f = fixture(state);
    const outcome = await processCompletedPcJob(event(), f.io);
    assert.equal(outcome.confirmedFailures, 0);
    assert.equal(outcome.newIssues, 0);
    assert.equal(f.posts, 0);
  }
});

test('deliberate failure-proof and timeout-proof FAIL reports do not stop intake', async () => {
  for (const operation of ['failure-proof', 'timeout-proof']) {
    const f = fixture();
    f.io.readReport = async p => p.endsWith('seat-4.json') ?
      {...report('FAIL'), operation} : null;
    const originalReadIssue = f.io.readIssue;
    f.io.readIssue = async n => n === 1009 ?
      {...issue(), body: JSON.stringify({...request(), operation})} : originalReadIssue(n);
    const outcome = await processCompletedPcJob(event(), f.io);
    assert.equal(outcome.state, 'SCAN_COMPLETED');
    assert.equal(outcome.confirmedFailures, 0);
    assert.equal(outcome.newIssues, 0);
    assert.equal(f.posts, 0);
  }
});

test('a fixture-labelled result cannot hide a genuine owner operation mismatch', async () => {
  for (const operation of ['failure-proof', 'timeout-proof']) {
    const f = fixture();
    f.io.readReport = async p => p.endsWith('seat-4.json') ?
      {...report('FAIL'), operation} : null;
    await assert.rejects(processCompletedPcJob(event(), f.io), /OPERATION_MISMATCH_STOP/);
    assert.equal(f.posts, 0);
  }
});

test('a completed pc-job without a published JSON is unknown, not successful intake', async () => {
  const f = fixture(); f.io.readReport = async () => null;
  const outcome = await processCompletedPcJob(event(), f.io);
  assert.equal(outcome.state, 'NO_PUBLISHED_RESULTS');
  assert.equal(outcome.reportsObserved, 0);
  assert.equal(outcome.newIssues, 0);
  assert.equal(f.posts, 0);
});

test('missing bot receipt remains pending without speculative issue creation', async () => {
  const f = fixture(); f.io.readComments = async () => [];
  const outcome = await processCompletedPcJob(event(), f.io);
  assert.equal(outcome.state, 'PARTIAL_RECEIPT_PENDING');
  assert.equal(outcome.missingReceipts, 1);
  assert.equal(f.posts, 0);
});

test('event identity and receipt origin spoofing stop', async () => {
  for (const modify of [
    e => { e.workflow_run.actor.login = 'attacker'; },
    e => { e.workflow_run.name = 'other'; },
    e => { e.repository.private = false; },
    e => { e.workflow_run.head_repository.full_name = 'other/repo'; }
  ]) {
    const candidate = event(); modify(candidate);
    assert.throws(() => assertCompletedPcJobEvent(candidate), /EVENT_NOT_ALLOWED/);
  }
  assert.equal(findOriginalIssueNumber(comments(), {runId, attempt, seat: 4}), 1009);
  const forged = comments(); forged[0].user.login = owner;
  assert.equal(findOriginalIssueNumber(forged, {runId, attempt, seat: 4}), null);
  assert.throws(() => findOriginalIssueNumber([...comments(), ...comments()],
    {runId, attempt, seat: 4}), /DUPLICATE_RECEIPTS/);
});

test('report/source/provenance drift stops before posting', async () => {
  const f = fixture();
  f.io.readReport = async p => p.endsWith('seat-4.json') ?
    {...report(), sourceBranch: 'unapproved'} : null;
  await assert.rejects(processCompletedPcJob(event(), f.io), /SOURCE_BRANCH_MISMATCH_STOP/);
  assert.equal(f.posts, 0);
});

test('lost POST response reconciles existing issue and never blindly posts twice', async () => {
  const f = fixture();
  const create = f.io.createHandoff;
  f.io.createHandoff = async candidate => { await create(candidate); throw new Error('response lost'); };
  const outcome = await processCompletedPcJob(event(), f.io);
  assert.equal(outcome.reusedIssues, 1);
  assert.equal(outcome.newIssues, 0);
  assert.equal(f.posts, 1);
});

test('failed readback stops instead of claiming enqueue success', async () => {
  const f = fixture();
  const read = f.io.readIssue;
  f.io.readIssue = async n => n === 2003 ? {...await read(n), body: '{}'} : read(n);
  await assert.rejects(processCompletedPcJob(event(), f.io), /CREATE_READBACK_STOP/);
  assert.equal(f.posts, 1);
});

test('the new workflow remains opt-in, single-writer and self-hosted', () => {
  const yaml = readFileSync(new URL('../.github/workflows/agent-handoff-pc-failure-intake.yml',
    import.meta.url), 'utf8');
  assert.match(yaml, /workflow_run:\s*\n\s*workflows: \[ZGMINI PC Job\]/);
  assert.match(yaml, /types: \[completed\]/);
  assert.match(yaml, /vars\.ZGMINI_PC_HANDOFF_INTAKE_ENABLED == 'true'/);
  assert.doesNotMatch(yaml, /if: >-\s*\n\s*false &&/);
  assert.match(yaml, /group: agent-handoff-pc-failure-intake/);
  assert.match(yaml, /runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
  assert.match(yaml, /run: E:\\ZGmini\\runtime\\node\.exe/);
  assert.doesNotMatch(yaml, /runs-on: ubuntu-latest|actions\/setup-node/);
});
