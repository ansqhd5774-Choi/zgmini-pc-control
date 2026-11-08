// Opt-in transport candidate: a GitHub PR comment is only an event to watch,
// never proof that a separate ChatGPT conversation has actually resumed.
// Importing this file performs no I/O or automatic agent/PC execution.
import {parseHandoff, fingerprintHandoff, routeHandoff} from './contract.mjs';

export const CHAT_WAKE_MARKER = 'ZGMINI_CHAT_HANDOFF_WAKE_V1';
const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const BOT = 'github-actions[bot]';

function validBinding(binding, role) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding) ||
      Object.keys(binding).sort().join(',') !==
        'enabled,pullRequestNumber,repository,targetChatId,targetRole' ||
      binding.enabled !== true || binding.repository !== REPO ||
      !Number.isSafeInteger(binding.pullRequestNumber) || binding.pullRequestNumber < 1 ||
      typeof binding.targetChatId !== 'string' ||
      !/^[a-z][a-z0-9-]{2,79}$/.test(binding.targetChatId) ||
      binding.targetRole !== role) {
    throw new Error('CHAT_PR_WAKE_BINDING_NOT_APPROVED');
  }
  return Object.freeze({...binding});
}

function receipt(inventory, binding, expected) {
  // Caller must fully page/read back the actual *target* PR's comments.
  if (!inventory || typeof inventory !== 'object' ||
      inventory.complete !== true || inventory.repository !== binding.repository ||
      inventory.pullRequestNumber !== binding.pullRequestNumber ||
      !Array.isArray(inventory.comments) || inventory.comments.length > 400) {
    throw new Error('CHAT_PR_WAKE_COMMENT_INVENTORY_INCOMPLETE');
  }
  const found = inventory.comments.filter(item =>
    item?.user?.login === BOT && Number.isSafeInteger(item.id) && item.id > 0 &&
    typeof item.body === 'string' && item.body.split('\n').length === expected.length &&
    item.body.split('\n').every((line, index) => line === expected[index]));
  if (found.length > 1) throw new Error('CHAT_PR_WAKE_MULTIPLE_RECEIPTS_STOP');
  return found[0]?.id ?? null;
}

/**
 * Posts minimal, bounded incident metadata to one explicitly mapped PR inbox.
 * The two callbacks belong to an approved caller; this module opens no tokens.
 * Status remains CHAT_ACK_UNKNOWN even if GitHub readback confirms the comment.
 */
export async function recordPrWakeEvent({body, queueIssueNumber, binding,
  readPrComments, postPrComment}) {
  const handoff = parseHandoff(typeof body === 'string' ? body : JSON.stringify(body));
  if (!Number.isSafeInteger(queueIssueNumber) || queueIssueNumber < 1 ||
      typeof readPrComments !== 'function' || typeof postPrComment !== 'function') {
    throw new Error('CHAT_PR_WAKE_INPUT_INVALID');
  }
  const target = validBinding(binding, routeHandoff(handoff).role);
  const fingerprint = fingerprintHandoff(handoff);
  const lines = [CHAT_WAKE_MARKER,
    `incidentId: ${handoff.incidentId}`,
    `fingerprint: ${fingerprint}`,
    `queueIssue: ${queueIssueNumber}`,
    `targetRole: ${target.targetRole}`,
    `targetChatId: ${target.targetChatId}`,
    'effect: METADATA_ONLY',
    'pcRetries: 0'];
  const find = async () => receipt(await readPrComments(target), target, lines);
  let commentId = await find();
  let posted = false;
  if (commentId === null) {
    try { await postPrComment(target, lines.join('\n')); } catch { /* verify the uncertain POST */ }
    commentId = await find();
    posted = true;
  }
  if (commentId === null) throw new Error('CHAT_PR_WAKE_READBACK_STOP');
  return Object.freeze({state: 'PR_EVENT_RECORDED_CHAT_ACK_UNKNOWN',
    queueIssueNumber, pullRequestNumber: target.pullRequestNumber, commentId,
    fingerprint, posted, automaticPcRetries: 0, actualChatResumeVerified: false});
}
