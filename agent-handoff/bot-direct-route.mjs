// Metadata-only routing for a handoff Issue created by a verified workflow_run.
// A GITHUB_TOKEN-created Issues event does not start another workflow, so the
// producer must persist its routing receipt in the same isolated CI job.
import {prepareHandoff} from './route.mjs';

const REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const BOT = 'github-actions[bot]';
const positive = n => Number.isSafeInteger(n) && n > 0;
function stop(code) { throw new Error(`HANDOFF_BOT_DIRECT_ROUTE_${code}`); }

export async function routeVerifiedBotIssue(prepared, issueNumber, {
  readIssue, listHandoffs, listIssueComments, postIssueComment, addIssueLabel
}) {
  if (!prepared || prepared.state !== 'READY_TO_ENQUEUE' ||
      typeof prepared.body !== 'string' || !positive(issueNumber) ||
      [readIssue,listHandoffs,listIssueComments,postIssueComment,addIssueLabel]
        .some(fn => typeof fn !== 'function')) stop('INPUT_INVALID');
  const verified = await readIssue(issueNumber);
  if (verified?.repository !== REPOSITORY || verified.number !== issueNumber ||
      verified.user?.login !== BOT ||
      verified.title !== `agent-handoff ${prepared.incidentId}` ||
      verified.body !== prepared.body ||
      !verified.labels?.some(label => label.name === 'agent-handoff')) {
    stop('BOT_ISSUE_READBACK_STOP');
  }
  const inventory = await listHandoffs();
  if (inventory?.repository !== REPOSITORY || inventory.complete !== true ||
      !Array.isArray(inventory.issues) || inventory.issues.length > 500)
    stop('INVENTORY_INCOMPLETE');
  const earlier = inventory.issues.filter(item =>
    item?.repository === REPOSITORY && positive(item.number) &&
    item.number < issueNumber && [OWNER,BOT].includes(item.user?.login) &&
    item.labels?.some(label => label.name === 'agent-handoff') &&
    typeof item.body === 'string').map(item => item.body);
  const outcome = prepareHandoff(verified.body, earlier);
  const duplicate = outcome.state === 'DUPLICATE_REUSED';
  const marker = duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED';
  const stateLabel = duplicate ? 'handoff-duplicate' : 'handoff-agent-pending';
  const lines = duplicate
    ? ['HANDOFF_DUPLICATE_REUSED', `fingerprint: ${outcome.fingerprint}`,
      'newAgentDispatches: 0', 'PC retries: 0']
    : ['HANDOFF_ROUTED', `incidentId: ${outcome.incidentId}`,
      `fingerprint: ${outcome.fingerprint}`, `role: ${outcome.role}`,
      `state: ${outcome.state}`, `checkpoint: ${outcome.checkpoint}`,
      'PC retries: 0', 'operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'];
  const receipt = lines.join('\n');
  const hasReceipt = async () => {
    const comments = await listIssueComments(issueNumber);
    if (!Array.isArray(comments) || comments.length > 400)
      stop('COMMENT_INVENTORY_INCOMPLETE');
    return comments.some(item => item?.user?.login === BOT && item.body === receipt);
  };
  const existed = await hasReceipt();
  if (!existed) {
    try { await postIssueComment(issueNumber, receipt); }
    catch {
      // An ambiguous POST must be reconciled by readback, never blindly retried.
      if (!await hasReceipt()) stop('COMMENT_POST_OUTCOME_UNKNOWN');
    }
    if (!await hasReceipt()) stop('COMMENT_READBACK_STOP');
  }
  const current = await readIssue(issueNumber);
  if (current?.repository !== REPOSITORY || current.number !== issueNumber ||
      current.body !== prepared.body || current.user?.login !== BOT ||
      current.title !== `agent-handoff ${prepared.incidentId}`)
    stop('ISSUE_DRIFT_STOP');
  if (!current.labels?.some(label => label.name === stateLabel)) {
    await addIssueLabel(issueNumber, stateLabel);
    const after = await readIssue(issueNumber);
    if (!after?.labels?.some(label => label.name === stateLabel))
      stop('LABEL_READBACK_STOP');
  }
  return Object.freeze({state: existed ? 'ROUTE_REUSED' : 'ROUTE_RECORDED',
    issueNumber, marker, fingerprint:outcome.fingerprint, pcOperationalWrites:0,
    automaticPcRetries:0, automaticChatWakeups:0});
}
