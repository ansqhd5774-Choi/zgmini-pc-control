import test from 'node:test';
import assert from 'node:assert/strict';
import {HANDOFF_ORIGIN_EVENT} from '../agent-handoff/mcp-event-contract.mjs';
import {inspectSubscribeRequest} from '../agent-handoff/mcp-subscription-contract.mjs';
import {previewOriginReceiptRouting} from '../agent-handoff/mcp-routing-preview.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const secret = `whsec_${Buffer.alloc(32, 7).toString('base64')}`;
const resultBody = [
  'HANDOFF_ORIGIN_RESULT_RECORDED',
  'resultId: result-123456789abc',
  `digest: ${'a'.repeat(64)}`,
  'incidentId: handoff-123456789abc',
  'handoffIssue: 1234',
  'fixPr: ansqhd5774-Choi/zgmini-pc-control#1030',
  `prHeadSha: ${'b'.repeat(40)}`,
  'testRunId: 42596987972',
  'state: RUNTIME_VERIFICATION_PENDING',
  'ChatGPT owner received: UNKNOWN',
  'Windows/D1/API/UI verification: NOT_VERIFIED',
  'PC retries: 0',
  'operationalWrites: 0'
].join('\n');

function origin(issue = 845) {
  return {repository: repo, originIssueNumber: issue,
    comment: {id: 6723684240, user: {login: 'github-actions[bot]'},
      issue_url: `https://api.github.com/repos/${repo}/issues/${issue}`,
      created_at: '2026-11-09T11:42:02Z', body: resultBody}};
}

function preview(issue = 845) {
  return inspectSubscribeRequest({jsonrpc: '2.0', id: 1, method: 'events/subscribe',
    params: {name: HANDOFF_ORIGIN_EVENT, arguments: {repository: repo, originIssueNumber: issue},
      delivery: {mode: 'webhook', url: 'https://receiver.example.com/callback', secret}, cursor: null}},
  {principal: `preview-owner-${issue}`, authorizeOriginIssue: () => true});
}

function route(overrides = {}) {
  return previewOriginReceiptRouting({originReceipt: origin(), subscriptions: [preview()],
    reauthorizeIssue: () => true, ...overrides});
}

test('matching targets the exact origin Issue, not a different Issue', () => {
  const same = preview(), other = preview(846);
  const result = route({subscriptions: [other, same]});
  assert.deepEqual(result.candidateSubscriptionIds, [same.id]);
  assert.equal(result.originIssueNumber, 845);
  assert.equal(result.actualDeliveries, 0);
  assert.equal(result.sourceOnly, true);
});

test('different issue with identical receipt values never selects the old issue subscriber', () => {
  assert.deepEqual(route({originReceipt: origin(846), subscriptions: [preview()]}).candidateSubscriptionIds, []);
});

test('GitHub origin issue provenance mismatch and bot spoofing fail closed', () => {
  assert.throws(() => route({originReceipt: {...origin(), originIssueNumber: 846}}), /MCP_EVENT_COMMENT_ORIGIN_STOP/);
  assert.throws(() => route({originReceipt: {...origin(), comment: {...origin().comment,
    user: {login: 'attacker'}}}}), /MCP_EVENT_BOT_AUTHOR_STOP/);
  assert.throws(() => route({originReceipt: {...origin(), repository: 'foreign/repo'}}), /MCP_EVENT_REPOSITORY_STOP/);
});

test('authorization loss, missing check or async check never creates a candidate', () => {
  assert.deepEqual(route({reauthorizeIssue: () => false}).candidateSubscriptionIds, []);
  assert.deepEqual(route({reauthorizeIssue: async () => true}).candidateSubscriptionIds, []);
  assert.throws(() => route({reauthorizeIssue: null}), /MCP_PREVIEW_INPUT_STOP/);
});

test('repeated preview and repeat result retain one stable event and candidate ID', () => {
  const first = route({subscriptions: [preview(), preview()]});
  const second = route({subscriptions: [preview(), preview()]});
  assert.deepEqual(first, second);
  assert.equal(first.candidateSubscriptionIds.length, 1);
  assert.match(first.eventId, /^evt_[a-f0-9]{64}$/);
});

test('a forged active or extra-field subscription preview is rejected', () => {
  assert.throws(() => route({subscriptions: [{...preview(), deliveryEnabled: true}]}), /MCP_PREVIEW_SUBSCRIPTION_STOP/);
  assert.throws(() => route({subscriptions: [{...preview(), callbackVerified: true}]}), /MCP_PREVIEW_SUBSCRIPTION_STOP/);
  assert.throws(() => route({subscriptions: [{...preview(), instructions: 'resume my chat'}]}), /MCP_PREVIEW_SUBSCRIPTION_STOP/);
});

test('input bounded and output contains no callback, secret, command, or successful delivery', () => {
  assert.throws(() => route({subscriptions: Array(1001).fill(preview())}), /MCP_PREVIEW_INPUT_STOP/);
  const result = route();
  const encoded = JSON.stringify(result);
  for (const forbidden of ['whsec_', 'receiver.example.com', 'resume my chat', 'chatId', 'principal']) {
    assert.equal(encoded.includes(forbidden), false);
  }
  assert.equal(result.callbackVerificationPerformed, false);
  assert.equal(result.expirationVerified, false);
});
