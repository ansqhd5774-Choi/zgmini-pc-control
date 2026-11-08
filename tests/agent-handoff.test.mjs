import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseHandoff, fingerprintHandoff, routeHandoff, transitionHandoff} from '../agent-handoff/contract.mjs';
import {prepareHandoff} from '../agent-handoff/route.mjs';
import {main as runIssueBroker} from '../agent-handoff/issue-broker.mjs';

const make = () => ({
  schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
  origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009, requestId: 'pc-123456789abc',
    chatId: 'chat-theme1', branch: 'codex/theme-fear-greed-integration-20261025',
    sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
  failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP', lastPass: 'SOURCE_CHECKED',
    firstFail: 'RUNTIME_IMPORT', fileRefs: ['controller/engine.mjs'], evidenceIssueNumber: 908}
});
const json = (item = make()) => JSON.stringify(item);

test('routes common failure to process owner and holds without configured agent', () => {
  const result = prepareHandoff(json());
  assert.equal(result.role, 'COMMON_PROCESS_OWNER');
  assert.equal(result.state, 'AWAITING_AGENT_CONFIGURATION');
  assert.equal(result.automaticPcRetries, 0);
  assert.equal(result.operationalWrites, 0);
});
test('routes feature failure to original owner', () => {
  const item = make(); item.failure.kind = 'FEATURE';
  assert.equal(routeHandoff(parseHandoff(json(item))).role, 'ORIGIN_FUNCTION_OWNER');
});
test('registered agent changes assignment state only, not runtime verification', () => {
  const routed = prepareHandoff(json(), [], {agentConfigured: true});
  assert.equal(routed.state, 'ASSIGNED');
  assert.equal(routed.agentDispatchLimit, 1);
});
test('same failure fingerprint reuses first incident', () => {
  const next = make(); next.incidentId = 'handoff-other4567890';
  const outcome = prepareHandoff(json(next), [json()]);
  assert.equal(outcome.state, 'DUPLICATE_REUSED');
  assert.equal(outcome.newDispatches, 0);
});
test('new source sha yields a different failure fingerprint', () => {
  const revised = make(); revised.origin.sourceSha = 'b'.repeat(40);
  assert.notEqual(fingerprintHandoff(parseHandoff(json())), fingerprintHandoff(parseHandoff(json(revised))));
});
test('rejects raw error strings and unknown keys', () => {
  const item = make(); item.failure.rawError = 'Authorization: secret';
  assert.throws(() => parseHandoff(json(item)), /UNEXPECTED_FIELD/);
});
test('rejects token-like additional origin fields', () => {
  const item = make(); item.origin.token = 'leak';
  assert.throws(() => parseHandoff(json(item)), /UNEXPECTED_FIELD/);
});
test('rejects absolute or parent file paths', () => {
  for (const path of ['E:/ZGmini/token.env', '../private.env', '/etc/passwd', 'a/../b']) {
    const item = make(); item.failure.fileRefs = [path];
    assert.throws(() => parseHandoff(json(item)), /FILE_REF_INVALID/);
  }
});
test('rejects invalid raw branch, sha or issue IDs', () => {
  const cases = [
    (x) => { x.origin.branch = '../main'; },
    (x) => { x.origin.sourceSha = 'bad'; },
    (x) => { x.origin.issueNumber = 0; }
  ];
  for (const change of cases) { const item = make(); change(item); assert.throws(() => parseHandoff(json(item))); }
});
test('rejects non-json, overlarge and unsupported repositories', () => {
  assert.throws(() => parseHandoff('free text'), /JSON_INVALID/);
  assert.throws(() => parseHandoff('x'.repeat(8193)), /BODY_SIZE_STOP/);
  const item = make(); item.origin.repository = 'attacker/repo';
  assert.throws(() => parseHandoff(json(item)), /REPOSITORY_NOT_ALLOWED/);
});
test('requires a PR before marking a proposed fix', () => {
  assert.throws(() => transitionHandoff('ASSIGNED', 'FIX_PROPOSED'), /PR_ISSUE/);
  assert.equal(transitionHandoff('ASSIGNED', 'FIX_PROPOSED', {prIssueNumber: 1022}), 'FIX_PROPOSED');
});
test('does not mark untested or uninstalled fixes as done', () => {
  assert.throws(() => transitionHandoff('FIX_PROPOSED', 'TESTED'), /TEST_PASS_REQUIRED/);
  assert.throws(() => transitionHandoff('TESTED', 'APPLIED_VERIFIED', {testsPassed: true}), /RUNTIME_PASS_REQUIRED/);
  assert.equal(transitionHandoff('TESTED', 'APPLIED_VERIFIED', {runtimeVerified: true}), 'APPLIED_VERIFIED');
});
test('does not equate GitHub comment with owner chat actually resumed', () => {
  assert.throws(() => transitionHandoff('RETURNED', 'OWNER_RESUMED'), /OWNER_ACK_REQUIRED/);
  assert.equal(transitionHandoff('RETURNED', 'OWNER_RESUMED', {ownerAcknowledged: true}), 'OWNER_RESUMED');
});
test('rejects skips, terminal repeats and unknown states', () => {
  assert.throws(() => transitionHandoff('QUEUED', 'OWNER_RESUMED', {ownerAcknowledged: true}), /TRANSITION_STOP/);
  assert.throws(() => transitionHandoff('BLOCKED', 'ASSIGNED'), /TRANSITION_STOP/);
  assert.throws(() => transitionHandoff('OTHER', 'TESTED'), /TRANSITION_STOP/);
});

async function simulateBroker({untrustedActor = false, loseComment = false, existingLabels = []} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-handoff-test-'));
  const eventPath = path.join(tmp, 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify({action: 'opened', repository: {private: true},
    issue: {number: 2001, user: {login: 'ansqhd5774-Choi'}, labels: [{name: 'agent-handoff'}], body: json()}}));
  const previousToken = process.env.GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.GITHUB_TOKEN = 'unit-test-nonsecret';
  const comments = [];
  const labels = [...existingLabels];
  const posts = [];
  globalThis.fetch = async (url, request = {}) => {
    const method = request.method ?? 'GET';
    const uri = new URL(url);
    let value;
    if (uri.pathname.endsWith('/issues') && method === 'GET') value = [];
    else if (uri.pathname.endsWith('/issues/2001/comments') && method === 'GET') value = comments;
    else if (uri.pathname.endsWith('/issues/2001/comments') && method === 'POST') {
      posts.push('comment');
      const body = JSON.parse(request.body).body;
      if (!loseComment) comments.push({user: {login: 'github-actions[bot]'}, body});
      value = {id: 1};
    } else if (uri.pathname.endsWith('/issues/2001/labels') && method === 'POST') {
      posts.push('label');
      labels.push(...JSON.parse(request.body).labels);
      value = labels.map((name) => ({name}));
    } else if (uri.pathname.endsWith('/issues/2001') && method === 'GET') {
      value = {labels: labels.map((name) => ({name}))};
    } else throw new Error(`unexpected request: ${method} ${uri.pathname}`);
    return {ok: true, status: 200, json: async () => value};
  };
  const env = {GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: 'ansqhd5774-Choi/zgmini-pc-control',
    GITHUB_ACTOR: untrustedActor ? 'unknown-user' : 'ansqhd5774-Choi', GITHUB_EVENT_NAME: 'issues'};
  try {
    if (untrustedActor) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_EVENT_NOT_ALLOWED/);
      assert.equal(posts.length, 0);
    } else if (loseComment) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_COMMENT_READBACK_STOP/);
      assert.equal(labels.length, existingLabels.length);
    } else {
      await runIssueBroker(env);
      await runIssueBroker(env);
      assert.deepEqual(posts, ['comment', ...(existingLabels.includes('handoff-agent-pending') ? [] : ['label'])]);
      assert.equal(comments.length, 1);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

test('broker records one comment and one label even if event is rerun', async () => {
  await simulateBroker();
});
test('broker recovers missing comment when status label already exists', async () => {
  await simulateBroker({existingLabels: ['handoff-agent-pending']});
});
test('broker refuses to mark success when comment readback is missing', async () => {
  await simulateBroker({loseComment: true});
});
test('broker refuses issue events from untrusted actors', async () => {
  await simulateBroker({untrustedActor: true});
});
