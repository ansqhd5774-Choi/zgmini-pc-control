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
test('normalized contract can be safely parsed again for a result handoff', () => {
  const item = make(); delete item.failure.evidenceIssueNumber;
  const once = parseHandoff(json(item));
  assert.deepEqual(parseHandoff(JSON.stringify(once)), once);
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

async function simulateBroker({untrustedActor = false, loseComment = false,
  loseCommentAck = false, loseLabel = false, loseLabelAck = false,
  tamperIssue = false, forgedPartialReceipt = false, existingLabels = [],
  action = 'opened', labelName = 'agent-handoff', expectRejected = false,
  conflictingLabelOnComment = false, conflictingLabelOnLabel = false,
  expectConflictPosts = null, existingBotReceipt = null,
  expectReceiptError = null} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-handoff-test-'));
  const eventPath = path.join(tmp, 'event.json');
  const issueTitle = 'agent-handoff handoff-123456789abc';
  fs.writeFileSync(eventPath, JSON.stringify({action, label: {name: labelName}, repository: {private: true},
    issue: {number: 2001, title:issueTitle, user: {login: 'ansqhd5774-Choi'},
      labels: [{name: 'agent-handoff'}], body: json()}}));
  const previousToken = process.env.GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.GITHUB_TOKEN = 'unit-test-nonsecret';
  const comments = [];
  const issueUrl = 'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/2001';
  if (forgedPartialReceipt) comments.push({
    user:{login:'github-actions[bot]'},issue_url:issueUrl,
    body:'HANDOFF_ROUTED\nfingerprint: '+prepareHandoff(json()).fingerprint
  });
  const outcome = prepareHandoff(json());
  const expectedReceipt = [
    'HANDOFF_ROUTED', 'incidentId: '+outcome.incidentId,
    'fingerprint: '+outcome.fingerprint, 'role: '+outcome.role,
    'state: '+outcome.state, 'checkpoint: '+outcome.checkpoint,
    'PC retries: 0', 'operationalWrites: 0',
    'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'
  ].join('\n');
  const pushBot = body => comments.push({
    user:{login:'github-actions[bot]'},issue_url:issueUrl,body});
  if (existingBotReceipt === 'duplicate-exact') {
    pushBot(expectedReceipt);pushBot(expectedReceipt);
  } else if (existingBotReceipt === 'conflicting-route') {
    pushBot(expectedReceipt.replace('fingerprint: '+outcome.fingerprint,
      'fingerprint: '+'f'.repeat(64)));
  } else if (existingBotReceipt === 'conflicting-duplicate') {
    pushBot(['HANDOFF_DUPLICATE_REUSED', 'fingerprint: '+outcome.fingerprint,
      'newAgentDispatches: 0','PC retries: 0'].join('\n'));
  } else if (existingBotReceipt === 'unrelated-human') {
    comments.push({user:{login:'someone-else'},issue_url:issueUrl,body:expectedReceipt});
  }
  const labels = ['agent-handoff',...existingLabels];
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
      if (!loseComment) comments.push({
        user: {login: 'github-actions[bot]'}, issue_url:issueUrl, body});
      if (conflictingLabelOnComment) labels.push('handoff-duplicate');
      if (loseCommentAck) throw Error('SIMULATED_COMMENT_ACK_LOST');
      value = {id: 1};
    } else if (uri.pathname.endsWith('/issues/2001/labels') && method === 'POST') {
      posts.push('label');
      if (!loseLabel) labels.push(...JSON.parse(request.body).labels);
      if (conflictingLabelOnLabel) labels.push('handoff-duplicate');
      if (loseLabelAck) throw Error('SIMULATED_LABEL_ACK_LOST');
      value = labels.map((name) => ({name}));
    } else if (uri.pathname.endsWith('/issues/2001') && method === 'GET') {
      value = {number:2001,title:issueTitle,
        user:{login:'ansqhd5774-Choi'},
        body:tamperIssue?'TAMPERED':json(),
        labels: labels.map((name) => ({name}))};
    } else throw new Error(`unexpected request: ${method} ${uri.pathname}`);
    return {ok: true, status: 200, json: async () => value};
  };
  const env = {GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: 'ansqhd5774-Choi/zgmini-pc-control',
    GITHUB_ACTOR: untrustedActor ? 'unknown-user' : 'ansqhd5774-Choi', GITHUB_EVENT_NAME: 'issues'};
  try {
    if (untrustedActor || expectRejected) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_EVENT_NOT_ALLOWED/);
      assert.equal(posts.length, 0);
    } else if (expectConflictPosts !== null) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_LABEL_CONFLICT_STOP/);
      assert.deepEqual(posts, expectConflictPosts);
    } else if (expectReceiptError !== null) {
      await assert.rejects(runIssueBroker(env), new RegExp(expectReceiptError));
      assert.deepEqual(posts, []);
    } else if (loseComment) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_COMMENT_READBACK_STOP/);
      assert.equal(labels.length, 1+existingLabels.length);
    } else if (loseLabel) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_LABEL_READBACK_STOP/);
      assert.equal(labels.length,1+existingLabels.length);
    } else if (tamperIssue) {
      await assert.rejects(runIssueBroker(env), /HANDOFF_ISSUE_DRIFT_STOP/);
      assert.equal(posts.filter(x=>x==='label').length,0);
    } else {
      await runIssueBroker(env);
      await runIssueBroker(env);
      assert.deepEqual(posts, ['comment', ...(existingLabels.includes('handoff-agent-pending') ? [] : ['label'])]);
      assert.equal(comments.length, forgedPartialReceipt || existingBotReceipt === 'unrelated-human' ? 2 : 1);
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
test('broker accepts an owner-labeled incident and reruns it exactly once', async () => {
  await simulateBroker({action: 'labeled'});
});
test('broker ignores unrelated labels and unsupported issue actions', async () => {
  await simulateBroker({action: 'labeled', labelName: 'pc-job', expectRejected: true});
  await simulateBroker({action: 'edited', expectRejected: true});
});


test('broker rejects label POST success without durable label readback', async()=>{
  await simulateBroker({loseLabel:true});
});
test('broker reconciles uncertain comment and label acknowledgments without duplicate posts', async()=>{
  await simulateBroker({loseCommentAck:true,loseLabelAck:true});
});
test('broker refuses Issue drift between opened event and routing write',async()=>{
  await simulateBroker({tamperIssue:true});
});
test('broker never accepts only a matching marker/fingerprint as full bot receipt',async()=>{
  await simulateBroker({forgedPartialReceipt:true});
});

test('owner incident already labeled duplicate cannot be routed into pending repair',async()=>{
  await simulateBroker({existingLabels:['handoff-duplicate'],
    expectConflictPosts:[]});
});

test('owner routing stops if opposite label arrives after the bot receipt',async()=>{
  await simulateBroker({conflictingLabelOnComment:true,
    expectConflictPosts:['comment']});
});

test('owner routing refuses final success if duplicate label races with pending label',async()=>{
  await simulateBroker({conflictingLabelOnLabel:true,
    expectConflictPosts:['comment','label']});
});

test('owner broker rejects two identical complete bot route receipts before writes',async()=>{
  await simulateBroker({existingBotReceipt:'duplicate-exact',
    expectReceiptError:'HANDOFF_COMMENT_DUPLICATE_STOP'});
});

test('owner broker rejects a competing completed route decision before writes',async()=>{
  await simulateBroker({existingBotReceipt:'conflicting-route',
    expectReceiptError:'HANDOFF_COMMENT_CONFLICT_STOP'});
});

test('owner broker rejects a competing duplicate disposition before writes',async()=>{
  await simulateBroker({existingBotReceipt:'conflicting-duplicate',
    expectReceiptError:'HANDOFF_COMMENT_CONFLICT_STOP'});
});

test('human quote of a route receipt is not authenticated bot evidence',async()=>{
  await simulateBroker({existingBotReceipt:'unrelated-human'});
});
