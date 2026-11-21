import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareHandoff} from './route.mjs';
import {parseHandoff} from './contract.mjs';
import {readIssueCommentLedger} from './comment-ledger.mjs';

// No agent or PC source is executed here. The broker only validates structured
// reports and records a durable routing decision in the original queue Issue.
const API = 'https://api.github.com';
const REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';

function assertEvent(event, env) {
  const validIntake = event.action === 'opened' ||
    (event.action === 'labeled' && event.label?.name === 'agent-handoff');
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_ACTOR !== 'ansqhd5774-Choi' ||
      env.GITHUB_EVENT_NAME !== 'issues' || !validIntake ||
      event.repository?.private !== true || event.issue?.user?.login !== 'ansqhd5774-Choi' ||
      !event.issue.labels?.some((label) => label.name === 'agent-handoff') ||
      !Number.isSafeInteger(event.issue.number)) throw new Error('HANDOFF_EVENT_NOT_ALLOWED');
}

async function api(path, {method = 'GET', body} = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN_UNAVAILABLE');
  const response = await fetch(`${API}${path}`, {
    method, headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})
  });
  if (!response.ok) throw new Error(`GITHUB_API_${response.status}_STOP`);
  return response.status === 204 ? null : response.json();
}

async function listPreviousBodies(currentIssue, currentBody) {
  // The fingerprint includes requestId. Search only this request, not every
  // unrelated historic Incident. Search may lag, so reconcile the newest
  // labelled page as well. A missing/incomplete search is not an empty ledger.
  const requestId = parseHandoff(currentBody).origin.requestId;
  const q = 'repo:' + REPOSITORY +
    ' is:issue label:agent-handoff in:body "' + requestId + '"';
  const searched = await api('/search/issues?q='+encodeURIComponent(q)+'&per_page=100');
  if (searched?.incomplete_results !== false ||
      !Number.isSafeInteger(searched.total_count) ||
      searched.total_count < 0 || searched.total_count > 100 ||
      !Array.isArray(searched.items) ||
      searched.items.length !== searched.total_count)
    throw new Error('HANDOFF_SEARCH_INCOMPLETE_STOP');
  const recent = await api('/repos/'+REPOSITORY+
    '/issues?state=all&labels=agent-handoff&sort=created&direction=desc&per_page=100');
  if (!Array.isArray(recent) || recent.length > 100)
    throw new Error('HANDOFF_RECENT_INVENTORY_INVALID');
  // If 100 newer issues have displaced the triggering Issue, search-index
  // latency cannot be safely reconciled by the direct recent window.
  if (recent.length === 100 &&
      recent.at(-1)?.number >= currentIssue)
    throw new Error('HANDOFF_RECENT_WINDOW_INCOMPLETE');
  const bodies = [];
  const visited = new Set();
  for (const issue of [...searched.items, ...recent]) {
    if (!Number.isSafeInteger(issue?.number) ||
        issue.number >= currentIssue || visited.has(issue.number) ||
        issue.pull_request ||
        !['ansqhd5774-Choi', 'github-actions[bot]'].includes(issue.user?.login) ||
        !issue.labels?.some(label => label.name === 'agent-handoff') ||
        typeof issue.body !== 'string') continue;
    visited.add(issue.number);
    let prior;
    try {prior = parseHandoff(issue.body);} catch {continue;}
    if (prior.origin.requestId === requestId) bodies.push(issue.body);
  }
  return bodies;
}
async function hasVerifiedComment(issueNumber, expectedBody) {
  // A full per-Issue receipt ledger, not the first 400 comments, is needed
  // to detect competing route decisions before marking an Issue routed.
  const issueUrl = `${API}/repos/${REPOSITORY}/issues/${issueNumber}`;
  const comments=await readIssueCommentLedger(page=>api(
    `/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`));
  let matching=0;
  for(const item of comments){
    if(item.user?.login!=='github-actions[bot]'||
       typeof item.body!=='string')continue;
    const completeRoute=item.body.startsWith('HANDOFF_ROUTED\nincidentId: ')||
      item.body.startsWith('HANDOFF_DUPLICATE_REUSED\nfingerprint: ');
    if(!completeRoute)continue;
    if(item.issue_url!==issueUrl||item.body!==expectedBody)
      throw new Error('HANDOFF_COMMENT_CONFLICT_STOP');
    if(++matching>1)throw new Error('HANDOFF_COMMENT_DUPLICATE_STOP');
  }
  return matching===1;
}
function exactOwnerIssue(current, original, stateLabel) {
  return current?.number === original.number &&
    current.user?.login === 'ansqhd5774-Choi' &&
    current.title === original.title && current.body === original.body &&
    current.labels?.some(label => label.name === 'agent-handoff') &&
    (stateLabel == null || current.labels.some(label => label.name === stateLabel));
}

export async function main(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  assertEvent(event, env);
  const outcome = prepareHandoff(event.issue.body, await listPreviousBodies(event.issue.number, event.issue.body));
  const duplicate = outcome.state === 'DUPLICATE_REUSED';
  const stateLabel = duplicate ? 'handoff-duplicate' : 'handoff-agent-pending';
  // The owner-origin route must enforce the same exclusive disposition as
  // the bot-origin route; otherwise a duplicate can remain in the repair lane.
  const oppositeLabel = duplicate ? 'handoff-agent-pending' : 'handoff-duplicate';
  const assertExclusive = issue => {
    if (issue?.labels?.some(label => label.name === oppositeLabel))
      throw new Error('HANDOFF_LABEL_CONFLICT_STOP');
  };
  const marker = duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED';
  const route = `/repos/${REPOSITORY}/issues/${event.issue.number}`;
  const initial = await api(route);
  if (!exactOwnerIssue(initial, event.issue))
    throw new Error('HANDOFF_ISSUE_DRIFT_STOP');
  if (initial.state !== 'open') throw new Error('HANDOFF_ISSUE_CLOSED_STOP');
  assertExclusive(initial);
  // Never mistake an existing label for proof of the bot result receipt.
  const lines = duplicate
    ? ['HANDOFF_DUPLICATE_REUSED', `fingerprint: ${outcome.fingerprint}`, 'newAgentDispatches: 0', 'PC retries: 0']
    : ['HANDOFF_ROUTED', `incidentId: ${outcome.incidentId}`, `fingerprint: ${outcome.fingerprint}`,
      `role: ${outcome.role}`, `state: ${outcome.state}`, `checkpoint: ${outcome.checkpoint}`,
      'PC retries: 0', 'operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'];
  const receiptBody = lines.join('\n');
  const alreadyRecorded = await hasVerifiedComment(event.issue.number, receiptBody);
  if (!alreadyRecorded) {
    // A coordinator may have disposed the Incident during comment inventory.
    // Recheck before writing a new routing receipt; never replay a closed Issue.
    const prePost = await api(route);
    if (!exactOwnerIssue(prePost, event.issue))
      throw new Error('HANDOFF_ISSUE_DRIFT_STOP');
    if (prePost.state !== 'open') throw new Error('HANDOFF_ISSUE_CLOSED_STOP');
    assertExclusive(prePost);
    try {
      await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/comments`,
        {method: 'POST', body: {body: receiptBody}});
    } catch {
      // POST may have succeeded even if its response was lost. No blind retry.
      if (!await hasVerifiedComment(event.issue.number, receiptBody))
        throw new Error('HANDOFF_COMMENT_POST_OUTCOME_UNKNOWN');
    }
    if (!await hasVerifiedComment(event.issue.number, receiptBody))
      throw new Error('HANDOFF_COMMENT_READBACK_STOP');
  }
  const current = await api(route);
  if (!exactOwnerIssue(current, event.issue))
    throw new Error('HANDOFF_ISSUE_DRIFT_STOP');
  if (current.state !== 'open') throw new Error('HANDOFF_ISSUE_CLOSED_STOP');
  assertExclusive(current);
  if (!current.labels.some(label => label.name === stateLabel)) {
    try {
      await api(route+'/labels', {method:'POST', body:{labels:[stateLabel]}});
    } catch {
      const afterUncertain = await api(route);
      if (!exactOwnerIssue(afterUncertain, event.issue, stateLabel))
        throw new Error('HANDOFF_LABEL_POST_OUTCOME_UNKNOWN');
      if (afterUncertain.state !== 'open') throw new Error('HANDOFF_ISSUE_CLOSED_STOP');
      assertExclusive(afterUncertain);
    }
  }
  const after = await api(route);
  if (!exactOwnerIssue(after, event.issue, stateLabel))
    throw new Error('HANDOFF_LABEL_READBACK_STOP');
  if (after.state !== 'open') throw new Error('HANDOFF_ISSUE_CLOSED_STOP');
  assertExclusive(after);
  process.stdout.write(`${alreadyRecorded ? 'HANDOFF_ALREADY_RECORDED' : duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED_PENDING_AGENT'}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
