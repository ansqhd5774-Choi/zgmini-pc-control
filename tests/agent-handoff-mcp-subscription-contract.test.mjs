import test from 'node:test';
import assert from 'node:assert/strict';
import {HANDOFF_ORIGIN_EVENT} from '../agent-handoff/mcp-event-contract.mjs';
import {
  inspectSubscribeRequest, inspectUnsubscribeRequest
} from '../agent-handoff/mcp-subscription-contract.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const secret = `whsec_${Buffer.alloc(32, 9).toString('base64')}`;
const context = {principal: 'user:authorized-1', authorizeOriginIssue: ({originIssueNumber}) => originIssueNumber === 845};

function request(overrides = {}) {
  return {jsonrpc: '2.0', id: 5, method: 'events/subscribe', params: {
    name: HANDOFF_ORIGIN_EVENT, arguments: {repository: repo, originIssueNumber: 845},
    delivery: {mode: 'webhook', url: 'https://receiver.example.com/callback?opaque=1', secret},
    cursor: null
  }, ...overrides};
}

function withParams(transform) {
  const base = request();
  return request({params: transform(base.params)});
}

test('source-only subscription preview is deterministic, minimal, and cannot deliver', () => {
  const a = inspectSubscribeRequest(request(), context);
  assert.deepEqual(a, inspectSubscribeRequest(request({id: 7}), context));
  assert.match(a.id, /^sub_[a-f0-9]{64}$/);
  assert.equal(a.callbackVerified, false);
  assert.equal(a.persisted, false);
  assert.equal(a.deliveryEnabled, false);
  assert.equal(JSON.stringify(a).includes('whsec_'), false);
  assert.equal(JSON.stringify(a).includes('opaque='), false);
});

test('subscription ID varies by authenticated principal, origin issue and callback', () => {
  const base = inspectSubscribeRequest(request(), context).id;
  assert.notEqual(base, inspectSubscribeRequest(request(), {...context, principal: 'user:authorized-2'}).id);
  assert.notEqual(base, inspectSubscribeRequest(withParams(p => ({...p,
    delivery: {...p.delivery, url: 'https://other.example.com/callback'}})), context).id);
  const otherIssue = withParams(p => ({...p, arguments: {...p.arguments, originIssueNumber: 846}}));
  assert.notEqual(base, inspectSubscribeRequest(otherIssue,
    {...context, authorizeOriginIssue: () => true}).id);
});

test('filter key order and equivalent URLs do not multiply subscriptions', () => {
  const a = inspectSubscribeRequest(request(), context).id;
  const b = inspectSubscribeRequest(withParams(p => ({...p,
    arguments: {originIssueNumber: 845, repository: repo},
    delivery: {...p.delivery, url: 'https://RECEIVER.example.com:443/callback?opaque=1'}})), context).id;
  assert.equal(a, b);
});

test('per-origin authorization is mandatory and fail-closed', () => {
  assert.throws(() => inspectSubscribeRequest(request(), {}), /MCP_SUB_AUTHORIZATION_STOP/);
  assert.throws(() => inspectSubscribeRequest(request(), {...context, authorizeOriginIssue: () => false}), /MCP_SUB_AUTHORIZATION_STOP/);
  assert.throws(() => inspectSubscribeRequest(request(), {...context, authorizeOriginIssue: async () => true}), /MCP_SUB_AUTHORIZATION_STOP/);
  assert.throws(() => inspectSubscribeRequest(withParams(p => ({...p,
    arguments: {...p.arguments, originIssueNumber: 846}})), context), /MCP_SUB_AUTHORIZATION_STOP/);
});

test('reject wrong repository, event name, and unexpected filter keys', () => {
  for (const altered of [
    withParams(p => ({...p, name: 'other.event'})),
    withParams(p => ({...p, arguments: {...p.arguments, repository: 'other/repo'}})),
    withParams(p => ({...p, arguments: {...p.arguments, chatId: 'fake'}})),
    withParams(p => ({...p, arguments: {...p.arguments, originIssueNumber: '845'}}))
  ]) assert.throws(() => inspectSubscribeRequest(altered, context), /MCP_SUB_(EVENT|FILTER)_STOP/);
});

test('enforces signing secret prefix, strict base64 and 24–64 decoded bytes', () => {
  for (const invalid of ['wrong', 'whsec_aaaa', `whsec_${Buffer.alloc(65).toString('base64')}`,
    `whsec_${Buffer.alloc(25).toString('base64').replace(/=$/, '')}`]) {
    assert.throws(() => inspectSubscribeRequest(withParams(p => ({...p,
      delivery: {...p.delivery, secret: invalid}})), context), /MCP_SUB_SECRET_STOP/);
  }
  assert.doesNotThrow(() => inspectSubscribeRequest(withParams(p => ({...p,
    delivery: {...p.delivery, secret: `whsec_${Buffer.alloc(24).toString('base64')}`}})), context));
});

test('refuses non-HTTPS, local, private-IP and userinfo callback URLs', () => {
  for (const url of ['http://receiver.example.com/callback', 'https://localhost/callback',
    'https://127.0.0.1/callback', 'https://10.1.1.1/callback', 'https://[::1]/callback',
    'https://host.internal/callback', 'https://user:pass@receiver.example.com/callback',
    'https://receiver.example.com/callback#fragment']) {
    assert.throws(() => inspectSubscribeRequest(withParams(p => ({...p,
      delivery: {...p.delivery, url}})), context), /MCP_SUB_CALLBACK_STOP/, url);
  }
});

test('unexpected request and delivery keys or replay cursors cannot be admitted', () => {
  for (const altered of [
    {...request(), params: {...request().params, extra: 'bad'}},
    withParams(p => ({...p, delivery: {...p.delivery, fallbackUrl: 'https://evil.test/'}})),
    withParams(p => ({...p, cursor: 'attempt-replay'})),
    {...request(), principal: 'forged'},
    {...request(), method: 'tools/call'}
  ]) assert.throws(() => inspectSubscribeRequest(altered, context), /MCP_SUB_.*_STOP/);
});

test('optional TTL is validated but never granted by source-only inspection', () => {
  assert.doesNotThrow(() => inspectSubscribeRequest(withParams(p => ({...p, ttlMs: 60000})), context));
  assert.throws(() => inspectSubscribeRequest(withParams(p => ({...p, ttlMs: -1})), context), /MCP_SUB_TTL_STOP/);
});

test('unsubscribe uses same identity but neither deletes nor sends anything', () => {
  const sub = inspectSubscribeRequest(request(), context);
  const base = request();
  const unsub = {jsonrpc: '2.0', id: 6, method: 'events/unsubscribe',
    params: {name: base.params.name, arguments: base.params.arguments,
      delivery: {mode: 'webhook', url: base.params.delivery.url}}};
  assert.equal(inspectUnsubscribeRequest(unsub, context).id, sub.id);
  assert.equal(inspectUnsubscribeRequest(unsub, context).persisted, false);
  assert.throws(() => inspectUnsubscribeRequest(unsub, {...context,
    authorizeOriginIssue: () => false}), /MCP_SUB_AUTHORIZATION_STOP/);
  assert.throws(() => inspectUnsubscribeRequest({...unsub, params: {...unsub.params,
    delivery: {...unsub.params.delivery, secret}}}, context), /MCP_SUB_DELIVERY_STOP/);
});
