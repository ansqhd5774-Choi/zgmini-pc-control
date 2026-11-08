// Source-only result-return candidate. A verified PR/run and GitHub comment
// are *not* evidence of Windows application or an actual ChatGPT chat resume.
import {parseHandoff} from './contract.mjs';
import {parseAgentResult, resultDigest, verifyAgentResult} from './result-contract.mjs';

export const CHAT_RESULT_RETURN_MARKER = 'ZGMINI_CHAT_RESULT_RETURN_V1';
const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const BOT = 'github-actions[bot]';

function inventoryRows(inventory, type, number) {
  if (!inventory || inventory.complete !== true || inventory.repository !== REPO ||
      inventory[type === 'issue' ? 'issueNumber' : 'pullRequestNumber'] !== number ||
      !Array.isArray(inventory.comments) || inventory.comments.length > 400) {
    throw new Error('CHAT_RESULT_RETURN_INVENTORY_INCOMPLETE');
  }
  return inventory.comments;
}

function findReceipt(rows, required, {exact = false} = {}) {
  const matches = rows.filter(item => {
    if (item?.user?.login !== BOT || !Number.isSafeInteger(item.id) || item.id < 1 ||
        typeof item.body !== 'string') return false;
    const lines = item.body.split('\n');
    return exact
      ? lines.length === required.length && lines.every((line, i) => line === required[i])
      : lines[0] === required[0] && required.every(line => lines.includes(line));
  });
  if (matches.length > 1) throw new Error('CHAT_RESULT_RETURN_MULTIPLE_RECEIPTS_STOP');
  return matches[0]?.id ?? null;
}

function returnBinding(binding, originChatId) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding) ||
      Object.keys(binding).sort().join(',') !== 'enabled,pullRequestNumber,repository,targetChatId' ||
      binding.enabled !== true || binding.repository !== REPO ||
      !Number.isSafeInteger(binding.pullRequestNumber) || binding.pullRequestNumber < 1 ||
      binding.targetChatId !== originChatId) {
    throw new Error('CHAT_RESULT_RETURN_BINDING_NOT_APPROVED');
  }
  return Object.freeze({...binding});
}

/**
 * A result is returnable only after its existing GitHub result-broker receipt
 * and matching PR/Actions evidence have both been independently verified.
 * All GitHub reads/writes are injected and nothing calls ChatGPT or the PC.
 */
export async function recordPrResultReturn({handoffBody, resultBody, pr, run,
  queueIssueNumber, binding, readResultIssueComments, readPrComments, postPrComment}) {
  const handoff = parseHandoff(typeof handoffBody === 'string'
    ? handoffBody : JSON.stringify(handoffBody));
  const result = parseAgentResult(typeof resultBody === 'string'
    ? resultBody : JSON.stringify(resultBody));
  if (!Number.isSafeInteger(queueIssueNumber) || queueIssueNumber < 1 ||
      typeof readResultIssueComments !== 'function' ||
      typeof readPrComments !== 'function' || typeof postPrComment !== 'function') {
    throw new Error('CHAT_RESULT_RETURN_INPUT_INVALID');
  }
  const target = returnBinding(binding, handoff.origin.chatId);
  const verified = verifyAgentResult(handoff, result, pr, run);
  const digest = resultDigest(result);
  const issueRows = inventoryRows(await readResultIssueComments(queueIssueNumber), 'issue', queueIssueNumber);
  const resultIssueCommentId = findReceipt(issueRows, [
    'HANDOFF_RESULT_RECORDED', `resultId: ${result.resultId}`,
    `digest: ${digest}`, `incidentId: ${result.incidentId}`,
    `fingerprint: ${result.fingerprint}`, `state: ${verified.state}`]);
  if (resultIssueCommentId === null) throw new Error('CHAT_RESULT_RETURN_SOURCE_RECEIPT_STOP');

  const lines = [CHAT_RESULT_RETURN_MARKER,
    `resultId: ${result.resultId}`, `digest: ${digest}`,
    `incidentId: ${result.incidentId}`, `fingerprint: ${result.fingerprint}`,
    `queueIssue: ${queueIssueNumber}`, `resultIssueCommentId: ${resultIssueCommentId}`,
    `originChatId: ${handoff.origin.chatId}`,
    `verification: ${verified.state}`,
    'effect: METADATA_ONLY', 'pcRetries: 0'];
  const find = async () => findReceipt(
    inventoryRows(await readPrComments(target), 'pr', target.pullRequestNumber),
    lines, {exact: true});
  let prCommentId = await find();
  let posted = false;
  if (prCommentId === null) {
    try { await postPrComment(target, lines.join('\n')); } catch { /* response may be lost */ }
    prCommentId = await find();
    posted = true;
  }
  if (prCommentId === null) throw new Error('CHAT_RESULT_RETURN_PR_READBACK_STOP');
  return Object.freeze({state: 'RESULT_PR_EVENT_RECORDED_CHAT_ACK_UNKNOWN',
    resultIssueCommentId, prCommentId, pullRequestNumber: target.pullRequestNumber,
    posted, verifiedState: verified.state, actualChatResumeVerified: false,
    operationalWrites: 0, automaticPcRetries: 0});
}
