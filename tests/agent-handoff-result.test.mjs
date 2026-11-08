import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseHandoff, fingerprintHandoff} from '../agent-handoff/contract.mjs';
import {parseAgentResult, resultDigest, verifyAgentResult} from '../agent-handoff/result-contract.mjs';
import {main as runResultBroker, assertWorkflowResultRepository} from '../agent-handoff/result-broker.mjs';

function setup() {
  const handoff = parseHandoff(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
    origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009, requestId: 'pc-123456789abc',
      chatId: 'chat-theme1', branch: 'codex/theme', sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
    failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP', lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}}));
  const result = {schema: 'ZGMINI_AGENT_HANDOFF_RESULT_V1', resultId: 'result-123456789abc',
    incidentId: handoff.incidentId, fingerprint: fingerprintHandoff(handoff),
    pullRequest: {repository: 'ansqhd5774-Choi/zgmini-pc-control', number: 920, headSha: 'b'.repeat(40)},
    testRun: {repository: 'ansqhd5774-Choi/zgmini-pc-control', runId: 42450377234, headSha: 'b'.repeat(40)}};
  const pr = {number: 920, head: {sha: 'b'.repeat(40), repo: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}},
    base: {repo: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}}, state: 'open'};
  const run = {id: 42450377234, head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success',
    repository: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}};
  return {handoff, result, pr, run};
}

test('provenance may establish reviewed evidence, never runtime or owner session success', () => {
  const {handoff, result, pr, run} = setup();
  assert.deepEqual(verifyAgentResult(handoff, parseAgentResult(JSON.stringify(result)), pr, run),
    {state: 'RUNTIME_VERIFICATION_PENDING', ownerAcknowledged: false,
      confirmed: ['PR_HEAD_SHA', 'GITHUB_ACTION_CONCLUSION'], operationalWrites: 0});
});
test('rejects additional raw content, URL and secret fields', () => {
  const {result} = setup();
  for (const field of ['token', 'rawError', 'url']) {
    const input = structuredClone(result); input[field] = 'not permitted';
    assert.throws(() => parseAgentResult(JSON.stringify(input)), /RESULT_FIELDS_INVALID/);
  }
});
test('rejects mismatched handoff origin and fingerprint', () => {
  const {handoff, result, pr, run} = setup();
  const bad = structuredClone(result); bad.fingerprint = '0'.repeat(64);
  assert.throws(() => verifyAgentResult(handoff, bad, pr, run), /RESULT_ORIGIN_MISMATCH_STOP/);
});
test('rejects PR substitution or wrong repository', () => {
  const {handoff, result, pr, run} = setup();
  const bad = structuredClone(pr); bad.head.sha = 'c'.repeat(40);
  assert.throws(() => verifyAgentResult(handoff, result, bad, run), /RESULT_PR_PROVENANCE_STOP/);
  const wrong = structuredClone(result); wrong.pullRequest.repository = 'ansqhd5774-Choi/zgmini';
  assert.throws(() => verifyAgentResult(handoff, wrong, pr, run), /RESULT_OWNER_REPOSITORY_STOP/);
});
test('repo-scoped workflow refuses cross-repo result without configured GitHub App permissions', () => {
  const {result} = setup();
  assert.doesNotThrow(() => assertWorkflowResultRepository(result));
  const otherRepo = structuredClone(result);
  otherRepo.pullRequest.repository = 'ansqhd5774-Choi/zgmini';
  otherRepo.testRun.repository = 'ansqhd5774-Choi/zgmini';
  assert.throws(() => assertWorkflowResultRepository(otherRepo), /RESULT_CROSS_REPO_AUTH_NOT_CONFIGURED/);
});
test('rejects failed or different-SHA GitHub run', () => {
  const {handoff, result, pr, run} = setup();
  const failed = structuredClone(run); failed.conclusion = 'failure';
  assert.throws(() => verifyAgentResult(handoff, result, pr, failed), /RESULT_TEST_RUN_PROVENANCE_STOP/);
  const mismatched = structuredClone(run); mismatched.head_sha = 'c'.repeat(40);
  assert.throws(() => verifyAgentResult(handoff, result, pr, mismatched), /RESULT_TEST_RUN_PROVENANCE_STOP/);
});
test('rejects oversized results and malformed IDs', () => {
  const {result} = setup();
  assert.throws(() => parseAgentResult('x'.repeat(4097)), /RESULT_BODY_SIZE_STOP/);
  const invalid = structuredClone(result); invalid.resultId = 'bad';
  assert.throws(() => parseAgentResult(JSON.stringify(invalid)), /RESULT_ID_INVALID/);
});
test('result digest fixes exact result payload for collision detection', () => {
  const {result} = setup();
  const changed = structuredClone(result); changed.testRun.runId += 1;
  assert.notEqual(resultDigest(parseAgentResult(JSON.stringify(result))), resultDigest(parseAgentResult(JSON.stringify(changed))));
});

async function simulate({lostComment = false, collision = false, unauthorized = false,
  retryReturn = false} = {}) {
  const {handoff, result, pr, run} = setup();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-handoff-result-'));
  const eventPath = path.join(temp, 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify({action: 'created', repository: {private: true},
    issue: {number: 2001, labels: [{name: 'agent-handoff'}], user: {login: 'ansqhd5774-Choi'},
      body: JSON.stringify(handoff)}, comment: {body: JSON.stringify(result), user: {login: 'ansqhd5774-Choi'}}}));
  const originalToken = process.env.GITHUB_TOKEN;
  const originalFetch = globalThis.fetch;
  const seen = [];
  const comments = collision ? [{user: {login: 'github-actions[bot]'},
    body: `HANDOFF_RESULT_RECORDED\nresultId: ${result.resultId}\ndigest: ${'0'.repeat(64)}`}]: [];
  process.env.GITHUB_TOKEN = 'unit-test-nonsecret';
  globalThis.fetch = async (url, request = {}) => {
    const uri = new URL(url);
    const method = request.method ?? 'GET';
    let value;
    if (uri.pathname.endsWith('/issues/2001/comments') && method === 'GET') value = comments;
    else if (uri.pathname.endsWith('/issues/2001/comments') && method === 'POST') {
      seen.push('comment');
      if (!lostComment) comments.push({user: {login: 'github-actions[bot]'}, body: JSON.parse(request.body).body});
      value = {id: 1};
    } else if (uri.pathname.endsWith('/pulls/920')) value = pr;
    else if (uri.pathname.endsWith('/actions/runs/42450377234')) value = run;
    else throw new Error(`unexpected GitHub API ${uri.pathname}`);
    return {ok: true, status: 200, json: async () => value};
  };
  const env = {GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: 'ansqhd5774-Choi/zgmini-pc-control',
    GITHUB_EVENT_NAME: 'issue_comment', GITHUB_ACTOR: unauthorized ? 'unknown-user' : 'ansqhd5774-Choi'};
  try {
    if (unauthorized) await assert.rejects(runResultBroker(env), /RESULT_EVENT_NOT_ALLOWED/);
    else if (collision) await assert.rejects(runResultBroker(env), /RESULT_ID_COLLISION_STOP/);
    else if (lostComment) await assert.rejects(runResultBroker(env), /RESULT_COMMENT_READBACK_STOP/);
    else if (retryReturn) {
      let calls = 0;
      const returnPrEvent = async (received) => {
        calls++;
        assert.equal(received.queueIssueNumber, 2001);
        assert.equal(received.result.resultId, result.resultId);
        assert.equal(received.handoff.incidentId, handoff.incidentId);
        assert.equal(received.pr.number, 920);
        if (calls === 1) throw new Error('CHAT_PR_RETURN_READBACK_STOP');
      };
      await assert.rejects(runResultBroker(env, {returnPrEvent}), /CHAT_PR_RETURN_READBACK_STOP/);
      await runResultBroker(env, {returnPrEvent});
      assert.equal(calls, 2);
      assert.deepEqual(seen, ['comment'], 'a return retry must not duplicate the result Issue comment');
    } else { await runResultBroker(env); await runResultBroker(env); assert.deepEqual(seen, ['comment']); }
    if (unauthorized || collision) assert.deepEqual(seen, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    fs.rmSync(temp, {recursive: true, force: true});
  }
}
test('result broker records one verified comment and remains idempotent', async () => simulate());
test('result broker fails closed if GitHub result comment disappears', async () => simulate({lostComment: true}));
test('result broker blocks same ID with different payload', async () => simulate({collision: true}));
test('result broker rejects untrusted issue comment actor', async () => simulate({unauthorized: true}));
test('opt-in origin PR return recovers after uncertainty without reposting result',
  async () => simulate({retryReturn: true}));
test('result broker rejects a non-function return path before reading the event', async () => {
  await assert.rejects(runResultBroker({}, {returnPrEvent: true}), /RETURN_CALLBACK_INVALID/);
});
