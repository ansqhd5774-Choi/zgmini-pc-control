// Candidate integration between the existing GitHub handoff contract and the
// isolated SQLite metadata queue. No GitHub token, PC operation or worker is
// started by importing this module. An approved caller supplies GitHub I/O.
import {prepareHandoff} from './route.mjs';
import {recordPrWakeEvent} from './pr-wakeup.mjs';

const BOT = 'github-actions[bot]';
const MARKER = 'HANDOFF_ROUTED';

function validatedCommentId(comments, fingerprint, incidentId) {
  if (!Array.isArray(comments) || comments.length > 400) {
    throw new Error('HANDOFF_QUEUE_COMMENT_INVENTORY_INCOMPLETE');
  }
  for (const item of comments) {
    if (item?.user?.login !== BOT || !Number.isSafeInteger(item.id) || item.id < 1 ||
        typeof item.body !== 'string') continue;
    const lines = item.body.split('\n');
    if (lines[0] === MARKER && lines.includes(`fingerprint: ${fingerprint}`) &&
        lines.includes(`incidentId: ${incidentId}`)) return item.id;
  }
  return null;
}

/**
 * Record one GitHub handoff delivery through an explicitly provided queue.
 * `readComments` must return a COMPLETE repository-verified comment inventory,
 * not a cached status or a boolean flag. A lost POST is resolved by readback.
 * No claim timeout causes this function to re-enqueue or re-run a PC job.
 */
export async function routeHandoffQueueMetadata({queue, body, issueNumber,
  readComments, postComment, owner = 'github-handoff-broker', leaseMs = 60_000,
  prWakeBinding = null, readPrComments, postPrComment}) {
  if (!queue || typeof queue.enqueue !== 'function' || typeof queue.claim !== 'function' ||
      typeof queue.markRouted !== 'function') throw new Error('HANDOFF_QUEUE_BRIDGE_REQUIRED');
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1 ||
      typeof readComments !== 'function' || typeof postComment !== 'function') {
    throw new Error('HANDOFF_QUEUE_BRIDGE_IO_INVALID');
  }

  const prepared = prepareHandoff(body);
  const queued = queue.enqueue(body);
  if (queued.fingerprint !== prepared.fingerprint) throw new Error('HANDOFF_QUEUE_FINGERPRINT_STOP');
  const withOptionalPrEvent = async (result) => {
    // An opted-in PR event is permitted only after this Issue's own comment
    // has passed readback, and is idempotent on later broker invocations.
    if (prWakeBinding === null) return result;
    const prEvent = await recordPrWakeEvent({body, queueIssueNumber: issueNumber,
      binding: prWakeBinding, readPrComments, postPrComment});
    return Object.freeze({...result, prEvent});
  };
  if (queued.status !== 'PENDING') {
    // If a label write failed after routing, an idempotent broker invocation
    // can recover that label from the existing verified comment, not re-POST.
    const commentId = queued.status === 'ROUTED_PENDING_AGENT'
      ? validatedCommentId(await readComments(issueNumber), queued.fingerprint, queued.existingIncidentId)
      : null;
    const state = queued.status === 'ROUTED_PENDING_AGENT' && commentId === null
      ? 'DUPLICATE_REUSED_NO_CURRENT_ISSUE_RECEIPT' : queued.status;
    const result = Object.freeze({fingerprint: queued.fingerprint, state,
      commentId, newDispatches: 0, automaticPcRetries: 0, operationalWrites: 0});
    return queued.status === 'ROUTED_PENDING_AGENT' && commentId !== null
      ? withOptionalPrEvent(result) : result;
  }

  // Target by fingerprint: concurrent per-Issue workflows cannot accidentally
  // claim the oldest unrelated incident from another chat.
  const lease = queue.claim(owner, {fingerprint: queued.fingerprint, leaseMs});
  if (!lease) return Object.freeze({fingerprint: queued.fingerprint, state: 'CLAIMED_BY_PEER',
    newDispatches: 0, automaticPcRetries: 0, operationalWrites: 0});

  const findComment = async () => validatedCommentId(await readComments(issueNumber),
    queued.fingerprint, queued.existingIncidentId);
  let commentId = await findComment();
  if (commentId === null) {
    const comment = [MARKER, `incidentId: ${queued.existingIncidentId}`,
      `fingerprint: ${queued.fingerprint}`, `role: ${prepared.role}`,
      `state: ${prepared.state}`, `checkpoint: ${prepared.checkpoint}`,
      'PC retries: 0', 'operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n');
    // A POST can succeed even if its response is lost. Readback decides.
    try { await postComment(issueNumber, comment); } catch { /* readback below */ }
    commentId = await findComment();
  }
  if (commentId === null) throw new Error('HANDOFF_QUEUE_COMMENT_READBACK_STOP');

  const marked = queue.markRouted(lease, {issueNumber, commentId,
    fingerprint: queued.fingerprint, marker: MARKER, verifiedCommentReadback: true});
  if (!marked) throw new Error('HANDOFF_QUEUE_LEASE_LOST_STATE_UNKNOWN');
  return withOptionalPrEvent(Object.freeze({fingerprint: queued.fingerprint, state: 'ROUTED_PENDING_AGENT',
    commentId, newDispatches: 0, automaticPcRetries: 0, operationalWrites: 0}));
}
