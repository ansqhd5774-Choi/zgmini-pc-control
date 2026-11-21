import {parseHandoff, fingerprintHandoff, routeHandoff} from './contract.mjs';
import {sortAdvisoryQueue} from './queue-priority.mjs';

export const HANDOFF_REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';
export const HANDOFF_OWNER = 'ansqhd5774-Choi';
export const HANDOFF_BOT = 'github-actions[bot]';
export const SELECTION_MARKER = 'HANDOFF_SELECTOR_CANDIDATE_V1';
const STATES = new Set(['open']);
const selectedLabel = label => label?.name === 'agent-handoff' || label?.name === 'handoff-agent-pending';
const number = n => Number.isSafeInteger(n) && n > 0;
const exactIssueUrl = n => 'https://api.github.com/repos/' + HANDOFF_REPOSITORY + '/issues/' + n;

function botReceipt(issue, request, routed) {
  return [
    'HANDOFF_ROUTED',
    'incidentId: ' + request.incidentId,
    'fingerprint: ' + routed.fingerprint,
    'role: ' + routed.role,
    'state: AWAITING_AGENT_CONFIGURATION',
    'checkpoint: ' + request.origin.checkpoint,
    'PC retries: 0',
    'operationalWrites: 0',
    'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'
  ].join('\n');
}

export function selectionReceipt(request, fingerprint) {
  return [
    SELECTION_MARKER,
    'incidentId: ' + request.incidentId,
    'fingerprint: ' + fingerprint,
    'selection: VERIFIED_CANDIDATE_ONLY',
    'automaticAiExecution: NOT_CONFIGURED',
    'pcOperationalWrites: 0',
    'automaticPcRetries: 0'
  ].join('\n');
}

// This is an authenticated metadata selector, NOT a code execution or AI agent.
// Only a GitHub bot's exact route receipt can authorize a candidate record.
export function assessIncident(issue, comments) {
  if (!issue || !number(issue.number) || !STATES.has(issue.state) ||
      issue.pull_request || !Array.isArray(issue.labels) ||
      !issue.labels.some(x => x?.name === 'agent-handoff') ||
      !issue.labels.some(x => x?.name === 'handoff-agent-pending') ||
      issue.labels.some(x => x?.name === 'handoff-duplicate')) {
    return {state: 'NOT_PENDING'};
  }
  if (!Array.isArray(comments)) {
    return {state: 'COMMENT_INVENTORY_INVALID'};
  }
  if (![HANDOFF_OWNER, HANDOFF_BOT].includes(issue.user?.login) ||
      typeof issue.body !== 'string') return {state: 'UNTRUSTED_ISSUE'};
  let request;
  try { request = parseHandoff(issue.body); }
  catch { return {state: 'INVALID_CONTRACT'}; }
  // The intake broker already accepts owner-authored descriptive Issue titles.
  // Keep the canonical title mandatory for bot-created Issues. For an owner
  // Issue, the authenticated exact bot route below binds incidentId, body
  // fingerprint and role, so title text is not the authorization proof.
  const botCreated=issue.user.login===HANDOFF_BOT;
  if (issue.repository !== HANDOFF_REPOSITORY ||
      typeof issue.title !== 'string' || !issue.title.trim() ||
      issue.title.length > 256 ||
      (botCreated && issue.title !== 'agent-handoff ' + request.incidentId))
    return {state: 'ISSUE_IDENTITY_MISMATCH'};
  const routed = routeHandoff(request);
  const fingerprint = fingerprintHandoff(request);
  if (routed.fingerprint !== fingerprint) return {state: 'FINGERPRINT_MISMATCH'};
  const url = exactIssueUrl(issue.number);
  const routing = comments.filter(c => c?.user?.login === HANDOFF_BOT &&
    (c.body?.startsWith('HANDOFF_ROUTED\n') ||
     c.body?.startsWith('HANDOFF_DUPLICATE_REUSED\n')));
  if (routing.length !== 1 || routing[0].issue_url !== url ||
      routing[0].body !== botReceipt(issue, request, routed))
    return {state: 'ROUTE_RECEIPT_UNVERIFIED'};
  const receipt = selectionReceipt(request, fingerprint);
  const existing = comments.filter(c => c?.user?.login === HANDOFF_BOT &&
    c.body?.startsWith(SELECTION_MARKER + '\n'));
  if (existing.length > 1 || existing.some(c => c.issue_url !== url || c.body !== receipt))
    return {state: 'SELECTION_RECEIPT_CONFLICT'};
  if (existing.length === 1) return {state: 'ALREADY_SELECTED'};
  if (comments.some(c => c?.user?.login === HANDOFF_BOT &&
    (c.body?.startsWith('HANDOFF_RESULT_RECORDED') ||
     c.body?.startsWith('RUNTIME_VERIFICATION_PENDING'))))
    return {state: 'RESULT_ALREADY_PRESENT'};
  return Object.freeze({state: 'READY', issueNumber: issue.number,
    incidentId: request.incidentId, fingerprint, receipt});
}

export function orderedPendingIssues(issues, nowMs=Date.now()) {
  // Priority is advisory ordering, never authority for actual incident selection.
  // assessIncident() still requires exact GitHub bot routing evidence.
  return sortAdvisoryQueue(issues,nowMs);
}

// One authenticated selection at a time, maximum 10 per bounded pass.
export async function processQueue(issues, {readComments, readIssue, recordReceipt}, limit=10) {
  if (![readComments, readIssue, recordReceipt].every(x => typeof x === 'function') ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 10)
    throw Error('HANDOFF_SELECTOR_INPUT_INVALID');
  const summary = {scanned: 0, selected: 0, alreadySelected: 0,
    deferred: 0, pcOperationalWrites: 0, automaticPcRetries: 0,
    automaticAiExecutions: 0, selectedIssues: []};
  for (const issue of orderedPendingIssues(issues)) {
    if (summary.selected >= limit) break;
    if (!issue.labels?.some(selectedLabel)) continue;
    summary.scanned++;
    const comments = await readComments(issue.number);
    const verdict = assessIncident(issue, comments);
    if (verdict.state === 'ALREADY_SELECTED') {summary.alreadySelected++; continue;}
    if (verdict.state !== 'READY') {summary.deferred++; continue;}
    // Re-read the authoritative issue and bot receipt immediately before write.
    const current = await readIssue(issue.number);
    if (JSON.stringify({body:current?.body,labels:current?.labels?.map(x=>x.name).sort(),
      state:current?.state,title:current?.title,user:current?.user?.login}) !==
        JSON.stringify({body:issue.body,labels:issue.labels.map(x=>x.name).sort(),
          state:issue.state,title:issue.title,user:issue.user?.login}))
      throw Error('HANDOFF_SELECTOR_ISSUE_DRIFT_STOP');
    const still = assessIncident({...current, repository: HANDOFF_REPOSITORY}, await readComments(issue.number));
    if (still.state === 'ALREADY_SELECTED') {summary.alreadySelected++; continue;}
    if (still.state !== 'READY' || still.receipt !== verdict.receipt)
      throw Error('HANDOFF_SELECTOR_PREWRITE_CONFLICT_STOP');
    try { await recordReceipt(issue.number, verdict.receipt); }
    catch {
      // Lost acknowledgement is reconciled by a GET, never blindly POST again.
      const afterUnknown = assessIncident({...await readIssue(issue.number), repository: HANDOFF_REPOSITORY},
        await readComments(issue.number));
      if (afterUnknown.state !== 'ALREADY_SELECTED')
        throw Error('HANDOFF_SELECTOR_POST_OUTCOME_UNKNOWN');
    }
    const after = assessIncident({...await readIssue(issue.number), repository: HANDOFF_REPOSITORY},
      await readComments(issue.number));
    if (after.state !== 'ALREADY_SELECTED')
      throw Error('HANDOFF_SELECTOR_READBACK_STOP');
    summary.selected++;
    summary.selectedIssues.push(issue.number);
  }
  return Object.freeze(summary);
}
