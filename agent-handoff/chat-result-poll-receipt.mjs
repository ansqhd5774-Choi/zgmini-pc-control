// Read-only account ACK verifier for a result returned to the original chat.
// GitHub account authorship alone never establishes which ChatGPT chat resumed.
import {parseHandoff, fingerprintHandoff} from './contract.mjs';
import {parseAgentResult, resultDigest, verifyAgentResult} from './result-contract.mjs';
import {expectedPrResultReturnLines} from './pr-result-return.mjs';

export const CHAT_RESULT_POLL_ACK_MARKER = 'ZGMINI_CHAT_RESULT_POLL_ACK_V1';
const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const BOT = 'github-actions[bot]';

function inventoryRows(inventory, field, number) {
  if (!inventory || inventory.complete !== true || inventory.repository !== REPO ||
      inventory[field] !== number || !Array.isArray(inventory.comments) ||
      inventory.comments.length > 400) {
    throw new Error('CHAT_RESULT_POLL_INVENTORY_INCOMPLETE');
  }
  return inventory.comments;
}

function exactReceipt(rows, actor, lines, errorPrefix) {
  const matches = rows.filter(row => row?.user?.login === actor &&
    Number.isSafeInteger(row.id) && row.id > 0 && row.body === lines.join('\n'));
  if (matches.length > 1) throw new Error(`${errorPrefix}_MULTIPLE_RECEIPTS_STOP`);
  return matches[0]?.id ?? null;
}

function sourceReceipt(rows, required) {
  const matches = rows.filter(row => row?.user?.login === BOT &&
    Number.isSafeInteger(row.id) && row.id > 0 && typeof row.body === 'string' &&
    row.body.split('\n')[0] === 'HANDOFF_RESULT_RECORDED' &&
    required.every(line => row.body.split('\n').includes(line)));
  if (matches.length > 1) throw new Error('CHAT_RESULT_POLL_MULTIPLE_SOURCE_RECEIPTS_STOP');
  return matches[0]?.id ?? null;
}

export function expectedChatResultPollAckLines({handoffBody, resultBody,
  queueIssueNumber, returnCommentId, binding}) {
  const handoff = parseHandoff(typeof handoffBody === 'string'
    ? handoffBody : JSON.stringify(handoffBody));
  const result = parseAgentResult(typeof resultBody === 'string'
    ? resultBody : JSON.stringify(resultBody));
  if (!Number.isSafeInteger(queueIssueNumber) || queueIssueNumber < 1 ||
      !Number.isSafeInteger(returnCommentId) || returnCommentId < 1 ||
      handoff.incidentId !== result.incidentId ||
      fingerprintHandoff(handoff) !== result.fingerprint ||
      !binding || binding.enabled !== true || binding.repository !== REPO ||
      !Number.isSafeInteger(binding.pullRequestNumber) || binding.pullRequestNumber < 1 ||
      binding.targetChatId !== handoff.origin.chatId) {
    throw new Error('CHAT_RESULT_POLL_ACK_INPUT_INVALID');
  }
  return Object.freeze([
    CHAT_RESULT_POLL_ACK_MARKER,
    `resultId: ${result.resultId}`,
    `digest: ${resultDigest(result)}`,
    `incidentId: ${result.incidentId}`,
    `fingerprint: ${result.fingerprint}`,
    `queueIssue: ${queueIssueNumber}`,
    `returnCommentId: ${returnCommentId}`,
    `originChatId: ${handoff.origin.chatId}`,
    'ack: RESULT_METADATA_RECEIVED_ONLY',
    'pcRetries: 0'
  ]);
}

/**
 * Validates the original result bot receipt, PR+Actions provenance, the exact
 * origin-PR bot return, and an independently authored ChatGPT account ACK.
 * The function only reads evidence; it never runs the PC or claims OWNER_RESUMED.
 */
export async function verifyChatResultPollAck({handoffBody, resultBody, pr, run,
  queueIssueNumber, binding, allowedAckActorLogin,
  readResultIssueComments, readPrComments}) {
  const handoff = parseHandoff(typeof handoffBody === 'string'
    ? handoffBody : JSON.stringify(handoffBody));
  const result = parseAgentResult(typeof resultBody === 'string'
    ? resultBody : JSON.stringify(resultBody));
  if (!Number.isSafeInteger(queueIssueNumber) || queueIssueNumber < 1 ||
      typeof allowedAckActorLogin !== 'string' ||
      !/^[A-Za-z0-9-]{1,39}$/.test(allowedAckActorLogin) ||
      allowedAckActorLogin === BOT ||
      typeof readResultIssueComments !== 'function' ||
      typeof readPrComments !== 'function') {
    throw new Error('CHAT_RESULT_POLL_IO_OR_ACTOR_NOT_APPROVED');
  }
  const verified = verifyAgentResult(handoff, result, pr, run);
  // Run the explicit binding check before accepting any purported return.
  expectedChatResultPollAckLines({handoffBody, resultBody, queueIssueNumber,
    returnCommentId: 1, binding});
  const sourceRows = inventoryRows(await readResultIssueComments(queueIssueNumber),
    'issueNumber', queueIssueNumber);
  const digest = resultDigest(result);
  const resultIssueCommentId = sourceReceipt(sourceRows, [
    `resultId: ${result.resultId}`, `digest: ${digest}`,
    `incidentId: ${result.incidentId}`, `fingerprint: ${result.fingerprint}`,
    `state: ${verified.state}`]);
  if (resultIssueCommentId === null) throw new Error('CHAT_RESULT_POLL_SOURCE_RECEIPT_STOP');

  const returnLines = expectedPrResultReturnLines({handoffBody, resultBody,
    queueIssueNumber, resultIssueCommentId, binding, verification: verified.state});
  const prRows = inventoryRows(await readPrComments(binding),
    'pullRequestNumber', binding.pullRequestNumber);
  const returnCommentId = exactReceipt(prRows, BOT, returnLines, 'CHAT_RESULT_POLL_RETURN');
  if (returnCommentId === null) return Object.freeze({
    state: 'CHAT_RESULT_POLL_RETURN_NOT_FOUND', resultIssueCommentId,
    returnCommentId: null, ackCommentId: null,
    actualChatResumeVerified: false, operationalWrites: 0, automaticPcRetries: 0});

  const ackLines = expectedChatResultPollAckLines({handoffBody, resultBody,
    queueIssueNumber, returnCommentId, binding});
  const ackCommentId = exactReceipt(prRows, allowedAckActorLogin, ackLines,
    'CHAT_RESULT_POLL_ACK');
  return Object.freeze({
    state: ackCommentId === null ? 'CHAT_RESULT_POLL_ACK_PENDING' :
      'CHAT_RESULT_POLL_ACK_COMMENT_VERIFIED_CHAT_REF_UNKNOWN',
    resultIssueCommentId, returnCommentId, ackCommentId,
    pullRequestNumber: binding.pullRequestNumber, digest,
    verifiedState: verified.state,
    actualChatResumeVerified: false, ownerResumed: false,
    operationalWrites: 0, automaticPcRetries: 0
  });
}
