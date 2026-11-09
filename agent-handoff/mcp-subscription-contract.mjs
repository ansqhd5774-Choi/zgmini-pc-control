import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {HANDOFF_ORIGIN_EVENT} from './mcp-event-contract.mjs';

// SOURCE_ONLY protocol-shape and authorization gate for a possible future
// authenticated MCP Events endpoint. No database, sockets, webhook traffic,
// ChatGPT subscription, or original-chat wake-up is implemented here.
const CONTROL_REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const DENIED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

function fail(code) { throw new Error(code); }

function exactKeys(value, required, optional, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const keys = Object.keys(value);
  if (required.some(key => !Object.hasOwn(value, key)) ||
      keys.some(key => !required.includes(key) && !optional.includes(key))) fail(code);
}

function callbackUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || value.trim() !== value) {
    fail('MCP_SUB_CALLBACK_STOP');
  }
  let url;
  try { url = new URL(value); } catch { fail('MCP_SUB_CALLBACK_STOP'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.hostname.length > 253 || url.hostname.endsWith('.') || isIP(url.hostname) ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(url.hostname) ||
      url.hostname.split('.').some(part => part.startsWith('-') || part.endsWith('-')) ||
      url.hostname === 'localhost' || DENIED_HOST_SUFFIXES.some(s => url.hostname.endsWith(s))) {
    fail('MCP_SUB_CALLBACK_STOP');
  }
  // Canonicalization is for the identity only, NOT an SSRF proof. A deployed
  // server must resolve and check EVERY actual destination IP at connection
  // time, preserve TLS hostname, prevent redirects, and verify the challenge.
  return url.href;
}

function signingSecret(value) {
  if (typeof value !== 'string' || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail('MCP_SUB_SECRET_STOP');
  }
  const encoded = value.slice('whsec_'.length);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 24 || bytes.length > 64 || bytes.toString('base64') !== encoded) {
    fail('MCP_SUB_SECRET_STOP');
  }
}

function inspect(request, {principal, authorizeOriginIssue} = {}, method) {
  exactKeys(request, ['jsonrpc', 'id', 'method', 'params'], [], 'MCP_SUB_REQUEST_STOP');
  if (request.jsonrpc !== '2.0' || request.method !== method ||
      !(typeof request.id === 'string' && request.id.length > 0 && request.id.length <= 80 ||
        Number.isSafeInteger(request.id))) fail('MCP_SUB_REQUEST_STOP');

  const subscribing = method === 'events/subscribe';
  exactKeys(request.params, ['name', 'arguments', 'delivery'],
    subscribing ? ['cursor', 'ttlMs'] : [], 'MCP_SUB_PARAMS_STOP');
  const {name, arguments: filters, delivery} = request.params;
  if (name !== HANDOFF_ORIGIN_EVENT) fail('MCP_SUB_EVENT_STOP');
  exactKeys(filters, ['repository', 'originIssueNumber'], [], 'MCP_SUB_FILTER_STOP');
  if (filters.repository !== CONTROL_REPO ||
      !Number.isSafeInteger(filters.originIssueNumber) || filters.originIssueNumber < 1) {
    fail('MCP_SUB_FILTER_STOP');
  }
  exactKeys(delivery, subscribing ? ['mode', 'url', 'secret'] : ['mode', 'url'],
    [], 'MCP_SUB_DELIVERY_STOP');
  if (delivery.mode !== 'webhook') fail('MCP_SUB_DELIVERY_STOP');
  const url = callbackUrl(delivery.url);
  if (subscribing) {
    signingSecret(delivery.secret);
    if (Object.hasOwn(request.params, 'cursor') && request.params.cursor !== null) {
      fail('MCP_SUB_CURSOR_STOP'); // Event is explicitly non-replayable.
    }
    if (Object.hasOwn(request.params, 'ttlMs') &&
        request.params.ttlMs !== null &&
        (!Number.isSafeInteger(request.params.ttlMs) || request.params.ttlMs < 1000)) {
      fail('MCP_SUB_TTL_STOP');
    }
  }
  // `principal` must come from actual MCP endpoint authentication, never from
  // JSON-RPC params or an event. A future implementation must use actual
  // GitHub identity/permission checks, and recheck during the subscription.
  if (typeof principal !== 'string' || principal.length < 1 || principal.length > 200 ||
      typeof authorizeOriginIssue !== 'function' ||
      authorizeOriginIssue({principal, repository: CONTROL_REPO,
        originIssueNumber: filters.originIssueNumber}) !== true) {
    fail('MCP_SUB_AUTHORIZATION_STOP');
  }
  const id = `sub_${createHash('sha256').update(JSON.stringify([
    principal, url, name, {repository: CONTROL_REPO, originIssueNumber: filters.originIssueNumber}
  ])).digest('hex')}`;
  // No success-shaped JSON-RPC response: callback verification and durable
  // subscription registration have NOT happened. Never return the secret.
  return Object.freeze({id, name, originIssueNumber: filters.originIssueNumber,
    callbackVerified: false, persisted: false, deliveryEnabled: false});
}

export function inspectSubscribeRequest(request, context) {
  return inspect(request, context, 'events/subscribe');
}

export function inspectUnsubscribeRequest(request, context) {
  return inspect(request, context, 'events/unsubscribe');
}
