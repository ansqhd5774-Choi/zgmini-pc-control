import {HANDOFF_ORIGIN_EVENT, originResultEventFromReceipt} from './mcp-event-contract.mjs';

// SOURCE_ONLY simulation of event-to-filter matching. These are preview
// records, NEVER active subscriptions. No webhook, network, store, or ChatGPT
// conversation is contacted. The caller still needs an authenticated GitHub
// readback and result-broker's provenance checks for `originReceipt`.
const CONTROL_REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const PREVIEW_KEYS = ['id', 'name', 'originIssueNumber', 'callbackVerified', 'persisted', 'deliveryEnabled'];

function stop(code) { throw new Error(code); }

function assertPreview(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record) ||
      Object.keys(record).length !== PREVIEW_KEYS.length ||
      PREVIEW_KEYS.some(key => !Object.hasOwn(record, key)) ||
      typeof record.id !== 'string' || !/^sub_[a-f0-9]{64}$/.test(record.id) ||
      record.name !== HANDOFF_ORIGIN_EVENT ||
      !Number.isSafeInteger(record.originIssueNumber) || record.originIssueNumber < 1 ||
      record.callbackVerified !== false || record.persisted !== false ||
      record.deliveryEnabled !== false) {
    stop('MCP_PREVIEW_SUBSCRIPTION_STOP');
  }
}

export function previewOriginReceiptRouting({originReceipt, subscriptions, reauthorizeIssue}) {
  if (!Array.isArray(subscriptions) || subscriptions.length > 1000 ||
      typeof reauthorizeIssue !== 'function') stop('MCP_PREVIEW_INPUT_STOP');
  const event = originResultEventFromReceipt(originReceipt);
  const candidates = new Set();
  for (const subscription of subscriptions) {
    assertPreview(subscription);
    if (subscription.originIssueNumber !== event.data.originIssueNumber) continue;
    // In the real service: look up the authenticated owner + durable record,
    // recheck GitHub permissions and expiration, and abort on revocation.
    // Async/promise checks do not pass this source-only simulation gate.
    if (reauthorizeIssue({subscriptionId: subscription.id,
      repository: CONTROL_REPO, originIssueNumber: event.data.originIssueNumber}) !== true) continue;
    candidates.add(subscription.id);
  }
  return Object.freeze({
    eventId: event.eventId,
    repository: CONTROL_REPO,
    originIssueNumber: event.data.originIssueNumber,
    candidateSubscriptionIds: Object.freeze([...candidates]),
    sourceOnly: true,
    actualDeliveries: 0,
    callbackVerificationPerformed: false,
    expirationVerified: false
  });
}
