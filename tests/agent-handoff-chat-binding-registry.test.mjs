import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatBindingRegistry, CHAT_BINDING_REGISTRY_SCHEMA} from
  '../agent-handoff/chat-binding-registry.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const origin = index => ({chatId: `chat-feature-${index}`, inboxPr: 1000 + index});
const config = () => ({schema: CHAT_BINDING_REGISTRY_SCHEMA, repository: repo,
  processOwner: {chatId: 'chat-process-owner', inboxPr: 900},
  origins: Array.from({length: 6}, (_, i) => origin(i + 1))});
const incident = (chatId, kind = 'COMMON_CONTROLLER') => ({
  schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
  origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009,
    requestId: 'pc-123456789abc', chatId, branch: 'codex/theme',
    sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
  failure: {kind, code: 'RUNNER_IMPORT_STOP', lastPass: 'SOURCE_CHECKED',
    firstFail: 'RUNTIME_IMPORT', fileRefs: []}
});

test('all six origins route common failures to one process owner, and results to each origin', () => {
  const registry = createChatBindingRegistry(config());
  for (let i = 1; i <= 6; i++) {
    const body = incident(`chat-feature-${i}`);
    const wake = registry.resolveWake(body);
    const returned = registry.resolveReturn(body);
    assert.equal(wake.targetRole, 'COMMON_PROCESS_OWNER');
    assert.equal(wake.targetChatId, 'chat-process-owner');
    assert.equal(wake.pullRequestNumber, 900);
    assert.equal(returned.targetChatId, `chat-feature-${i}`);
    assert.equal(returned.pullRequestNumber, 1000 + i);
    assert.equal(returned.repository, repo);
  }
});

test('feature failures stay with the registered original chat, without per-feature source code', () => {
  const registry = createChatBindingRegistry(config());
  for (let i = 1; i <= 6; i++) {
    const wake = registry.resolveWake(JSON.stringify(incident(`chat-feature-${i}`, 'FEATURE')));
    assert.equal(wake.targetRole, 'ORIGIN_FUNCTION_OWNER');
    assert.equal(wake.targetChatId, `chat-feature-${i}`);
    assert.equal(wake.pullRequestNumber, 1000 + i);
  }
});

test('unregistered or tampered origin cannot select an arbitrary PR inbox', () => {
  const registry = createChatBindingRegistry(config());
  assert.throws(() => registry.resolveWake(incident('chat-feature-unknown')),
    /CHAT_BINDING_ORIGIN_UNREGISTERED_STOP/);
  assert.throws(() => registry.resolveReturn(incident('chat-feature-unknown')),
    /CHAT_BINDING_ORIGIN_UNREGISTERED_STOP/);
  const withPr = {...incident('chat-feature-1'), extraPrTarget: 9999};
  assert.throws(() => registry.resolveWake(withPr), /HANDOFF_UNEXPECTED_FIELD/);
});

test('duplicate chatId, duplicate PR, and overlap with process owner fail closed', () => {
  const sameChat = config(); sameChat.origins[1].chatId = sameChat.origins[0].chatId;
  assert.throws(() => createChatBindingRegistry(sameChat), /CHAT_BINDING_DUPLICATE_TARGET_STOP/);
  const samePr = config(); samePr.origins[1].inboxPr = samePr.origins[0].inboxPr;
  assert.throws(() => createChatBindingRegistry(samePr), /CHAT_BINDING_DUPLICATE_TARGET_STOP/);
  const processPr = config(); processPr.origins[0].inboxPr = processPr.processOwner.inboxPr;
  assert.throws(() => createChatBindingRegistry(processPr), /CHAT_BINDING_DUPLICATE_TARGET_STOP/);
  const processChat = config(); processChat.origins[0].chatId = processChat.processOwner.chatId;
  assert.throws(() => createChatBindingRegistry(processChat), /CHAT_BINDING_DUPLICATE_TARGET_STOP/);
});

test('invalid repository, schema, unknown fields and malformed targets are rejected', () => {
  const foreignRepo = config(); foreignRepo.repository = 'unknown/repo';
  assert.throws(() => createChatBindingRegistry(foreignRepo), /CHAT_BINDING_REGISTRY_INVALID/);
  const badSchema = config(); badSchema.schema = 'V2';
  assert.throws(() => createChatBindingRegistry(badSchema), /CHAT_BINDING_REGISTRY_INVALID/);
  const extra = config(); extra.token = 'not-permitted';
  assert.throws(() => createChatBindingRegistry(extra), /CHAT_BINDING_REGISTRY_INVALID/);
  const invalidPr = config(); invalidPr.origins[0].inboxPr = 0;
  assert.throws(() => createChatBindingRegistry(invalidPr), /CHAT_BINDING_PARTICIPANT_INVALID/);
  const invalidChat = config(); invalidChat.origins[0].chatId = '../escaped';
  assert.throws(() => createChatBindingRegistry(invalidChat), /CHAT_BINDING_PARTICIPANT_INVALID/);
});

test('registry captures a fixed mapping snapshot and never mutates an input config', () => {
  const source = config();
  const registry = createChatBindingRegistry(source);
  source.origins[0].inboxPr = 9999;
  source.processOwner.inboxPr = 9998;
  assert.equal(registry.resolveWake(incident('chat-feature-1')).pullRequestNumber, 900);
  assert.equal(registry.resolveReturn(incident('chat-feature-1')).pullRequestNumber, 1001);
});
