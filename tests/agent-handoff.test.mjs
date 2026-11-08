import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHandoff, fingerprintHandoff, routeHandoff, transitionHandoff} from '../agent-handoff/contract.mjs';
import {prepareHandoff} from '../agent-handoff/route.mjs';

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
