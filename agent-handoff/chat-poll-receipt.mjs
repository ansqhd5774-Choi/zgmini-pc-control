// Read-only verifier for an opt-in ordinary ChatGPT Scheduled-task ACK.
// A GitHub comment written as the account owner is not proof of chat execution;
// only separate task run_details.chat_ref can prove which chat actually ran.
import {parseHandoff, fingerprintHandoff, routeHandoff} from './contract.mjs';
import {CHAT_WAKE_MARKER, expectedPrWakeLines} from './pr-wakeup.mjs';

export const CHAT_POLL_ACK_MARKER = 'ZGMINI_CHAT_HANDOFF_POLL_ACK_V1';
const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const BOT = 'github-actions[bot]';

function exactReceipt(rows, actor, lines, code) {
  const matches = rows.filter(comment =>
    comment?.user?.login === actor && Number.isSafeInteger(comment.id) && comment.id > 0 &&
    typeof comment.body === 'string' && comment.body === lines.join('\n'));
  if (matches.length > 1) throw new Error(`${code}_MULTIPLE_RECEIPTS_STOP`);
  return matches[0]?.id ?? null;
}

function checkedInventory(inventory, binding) {
  if (!inventory || inventory.complete !== true || inventory.repository !== REPO ||
      inventory.pullRequestNumber !== binding.pullRequestNumber ||
      !Array.isArray(inventory.comments) || inventory.comments.length > 400) {
    throw new Error('CHAT_POLL_ACK_INVENTORY_INCOMPLETE');
  }
  return inventory.comments;
}

export function expectedChatPollAckLines({body, queueIssueNumber, wakeCommentId, binding}) {
  const handoff = parseHandoff(typeof body === 'string' ? body : JSON.stringify(body));
  if (!Number.isSafeInteger(wakeCommentId) || wakeCommentId < 1) {
    throw new Error('CHAT_POLL_ACK_WAKE_ID_INVALID');
  }
  // This also validates the repository, target role, chat ID, and issue number.
  expectedPrWakeLines({body, queueIssueNumber, binding});
  return Object.freeze([
    CHAT_POLL_ACK_MARKER,
    `incidentId: ${handoff.incidentId}`,
    `fingerprint: ${fingerprintHandoff(handoff)}`,
    `queueIssue: ${queueIssueNumber}`,
    `wakeCommentId: ${wakeCommentId}`,
    `targetChatId: ${binding.targetChatId}`,
    'ack: METADATA_RECEIVED_ONLY',
    'pcRetries: 0'
  ]);
}

/**
 * Verifies a bot wake and a separate GitHub account-owned ACK in the same PR.
 * Does not issue GitHub writes, dispatch AI, or promote a chat's actual receipt.
 * A caller must separately inspect the Scheduled task's run_details.chat_ref.
 */
export async function verifyChatPollAck({body, queueIssueNumber, binding,
  allowedAckActorLogin, readPrComments}) {
  const handoff = parseHandoff(typeof body === 'string' ? body : JSON.stringify(body));
  if (typeof allowedAckActorLogin !== 'string' ||
      !/^[A-Za-z0-9-]{1,39}$/.test(allowedAckActorLogin) ||
      allowedAckActorLogin === BOT || typeof readPrComments !== 'function') {
    throw new Error('CHAT_POLL_ACK_ACTOR_OR_IO_NOT_APPROVED');
  }
  const role = routeHandoff(handoff).role;
  const wakeLines = expectedPrWakeLines({body, queueIssueNumber, binding});
  if (binding.targetRole !== role) throw new Error('CHAT_POLL_ACK_ROLE_STOP');
  const comments = checkedInventory(await readPrComments(binding), binding);
  const wakeCommentId = exactReceipt(comments, BOT, wakeLines, 'CHAT_POLL_WAKE');
  if (wakeCommentId === null) return Object.freeze({state: 'CHAT_POLL_WAKE_NOT_FOUND',
    ackCommentId: null, actualChatResumeVerified: false, automaticPcRetries: 0});

  const ackLines = expectedChatPollAckLines({body, queueIssueNumber, wakeCommentId, binding});
  const ackCommentId = exactReceipt(comments, allowedAckActorLogin, ackLines, 'CHAT_POLL_ACK');
  return Object.freeze({
    state: ackCommentId === null ? 'CHAT_POLL_ACK_PENDING' :
      'CHAT_POLL_ACK_COMMENT_VERIFIED_CHAT_REF_UNKNOWN',
    wakeCommentId, ackCommentId,
    pullRequestNumber: binding.pullRequestNumber,
    fingerprint: fingerprintHandoff(handoff),
    actualChatResumeVerified: false,
    automaticPcRetries: 0,
    operationalWrites: 0
  });
}
