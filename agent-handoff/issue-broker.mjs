import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareHandoff} from './route.mjs';
import {routeHandoffQueueMetadata} from './queue-bridge.mjs';

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

async function listPreviousBodies(currentIssue) {
  const bodies = [];
  // Fail closed at the scan limit. A truncated inventory must not claim that
  // no duplicate exists. The route never retries a PC operation in any case.
  for (let page = 1; page <= 5; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues?state=all&labels=agent-handoff&per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('HANDOFF_LEDGER_INVALID');
    // The lowest issue number wins even when two opens race concurrently.
    for (const issue of rows) if (issue.number < currentIssue && typeof issue.body === 'string') bodies.push(issue.body);
    if (rows.length < 100) return bodies;
  }
  throw new Error('HANDOFF_LEDGER_SCAN_LIMIT_STOP');
}

async function hasVerifiedComment(issueNumber, marker, fingerprint) {
  for (let page = 1; page <= 4; page++) {
    const comments = await api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(comments)) throw new Error('HANDOFF_COMMENT_LEDGER_INVALID');
    if (comments.some((item) => item.user?.login === 'github-actions[bot]' &&
        typeof item.body === 'string' && item.body.startsWith(`${marker}\n`) &&
        item.body.split('\n').includes(`fingerprint: ${fingerprint}`))) return true;
    if (comments.length < 100) return false;
  }
  throw new Error('HANDOFF_COMMENT_SCAN_LIMIT_STOP');
}

async function listCompleteIssueComments(issueNumber) {
  const comments = [];
  for (let page = 1; page <= 4; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('HANDOFF_QUEUE_COMMENT_LEDGER_INVALID');
    comments.push(...rows);
    if (rows.length < 100) return comments;
  }
  throw new Error('HANDOFF_QUEUE_COMMENT_SCAN_LIMIT_STOP');
}

async function listCompletePrComments(target) {
  const comments = [];
  for (let page = 1; page <= 4; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues/${target.pullRequestNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('HANDOFF_PR_COMMENT_LEDGER_INVALID');
    comments.push(...rows);
    if (rows.length < 100) return {repository: REPOSITORY,
      pullRequestNumber: target.pullRequestNumber, complete: true, comments};
  }
  throw new Error('HANDOFF_PR_COMMENT_SCAN_LIMIT_STOP');
}

export async function main(env = process.env, {queue = null, prWakeBinding = null,
  resolvePrWakeBinding = null} = {}) {
  if (resolvePrWakeBinding !== null &&
      (typeof resolvePrWakeBinding !== 'function' || prWakeBinding !== null)) {
    throw new Error('HANDOFF_PR_WAKE_RESOLVER_CONFLICT');
  }
  // The normal CLI still has neither a database nor an event target.  An
  // explicit PR binding cannot silently fall back to the GitHub-only path.
  if ((prWakeBinding !== null || resolvePrWakeBinding !== null) && queue === null) {
    throw new Error('HANDOFF_PR_WAKE_QUEUE_REQUIRED');
  }
  if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  assertEvent(event, env);
  const binding = resolvePrWakeBinding === null ? prWakeBinding :
    resolvePrWakeBinding(event.issue.body);
  if (resolvePrWakeBinding !== null && binding === null) {
    throw new Error('HANDOFF_PR_WAKE_RESOLUTION_REQUIRED');
  }
  // Opt-in dependency injection only. Production main() has no queue object
  // and preserves the existing GitHub-only broker behavior without PC DB IO.
  if (queue !== null) {
    const outcome = await routeHandoffQueueMetadata({queue, body: event.issue.body,
      issueNumber: event.issue.number,
      readComments: listCompleteIssueComments,
      postComment: async (issueNumber, body) => api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments`,
        {method: 'POST', body: {body}}),
      prWakeBinding: binding,
      readPrComments: binding === null ? undefined : listCompletePrComments,
      postPrComment: binding === null ? undefined :
        async (target, body) => api(`/repos/${REPOSITORY}/issues/${target.pullRequestNumber}/comments`,
          {method: 'POST', body: {body}})});
    if (outcome.commentId) {
      const current = await api(`/repos/${REPOSITORY}/issues/${event.issue.number}`);
      if (!current.labels?.some((label) => label.name === 'handoff-agent-pending')) {
        await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/labels`,
          {method: 'POST', body: {labels: ['handoff-agent-pending']}});
      }
    }
    process.stdout.write(`HANDOFF_QUEUE_${outcome.state}\n`);
    return outcome;
  }
  const outcome = prepareHandoff(event.issue.body, await listPreviousBodies(event.issue.number));
  const duplicate = outcome.state === 'DUPLICATE_REUSED';
  const stateLabel = duplicate ? 'handoff-duplicate' : 'handoff-agent-pending';
  const marker = duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED';
  // Never mistake a label for proof that the result comment was delivered.
  // A lost POST response is recovered by reading the original issue ledger.
  const alreadyRecorded = await hasVerifiedComment(event.issue.number, marker, outcome.fingerprint);
  const lines = duplicate
    ? ['HANDOFF_DUPLICATE_REUSED', `fingerprint: ${outcome.fingerprint}`, 'newAgentDispatches: 0', 'PC retries: 0']
    : ['HANDOFF_ROUTED', `incidentId: ${outcome.incidentId}`, `fingerprint: ${outcome.fingerprint}`,
      `role: ${outcome.role}`, `state: ${outcome.state}`, `checkpoint: ${outcome.checkpoint}`,
      'PC retries: 0', 'operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'];
  if (!alreadyRecorded) {
    await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/comments`, {method: 'POST', body: {body: lines.join('\n')}});
    if (!await hasVerifiedComment(event.issue.number, marker, outcome.fingerprint)) throw new Error('HANDOFF_COMMENT_READBACK_STOP');
  }
  const current = await api(`/repos/${REPOSITORY}/issues/${event.issue.number}`);
  if (!current.labels?.some((label) => label.name === stateLabel)) {
    await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/labels`, {method: 'POST', body: {labels: [stateLabel]}});
  }
  process.stdout.write(`${alreadyRecorded ? 'HANDOFF_ALREADY_RECORDED' : duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED_PENDING_AGENT'}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
