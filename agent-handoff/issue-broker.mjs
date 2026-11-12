import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareHandoff} from './route.mjs';

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

async function hasVerifiedComment(issueNumber, expectedBody) {
  // Read back the complete deterministic bot receipt in the exact Issue.
  // A partial marker/fingerprint is not enough to prove delivery.
  const issueUrl = `${API}/repos/${REPOSITORY}/issues/${issueNumber}`;
  for (let page = 1; page <= 4; page++) {
    const comments = await api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(comments)) throw new Error('HANDOFF_COMMENT_LEDGER_INVALID');
    if (comments.some((item) => item.user?.login === 'github-actions[bot]' &&
        item.issue_url === issueUrl && item.body === expectedBody)) return true;
    if (comments.length < 100) return false;
  }
  throw new Error('HANDOFF_COMMENT_SCAN_LIMIT_STOP');
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
  const outcome = prepareHandoff(event.issue.body, await listPreviousBodies(event.issue.number));
  const duplicate = outcome.state === 'DUPLICATE_REUSED';
  const stateLabel = duplicate ? 'handoff-duplicate' : 'handoff-agent-pending';
  const marker = duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED';
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
  const route = `/repos/${REPOSITORY}/issues/${event.issue.number}`;
  const current = await api(route);
  if (!exactOwnerIssue(current, event.issue))
    throw new Error('HANDOFF_ISSUE_DRIFT_STOP');
  if (!current.labels.some(label => label.name === stateLabel)) {
    try {
      await api(route+'/labels', {method:'POST', body:{labels:[stateLabel]}});
    } catch {
      const afterUncertain = await api(route);
      if (!exactOwnerIssue(afterUncertain, event.issue, stateLabel))
        throw new Error('HANDOFF_LABEL_POST_OUTCOME_UNKNOWN');
    }
  }
  const after = await api(route);
  if (!exactOwnerIssue(after, event.issue, stateLabel))
    throw new Error('HANDOFF_LABEL_READBACK_STOP');
  process.stdout.write(`${alreadyRecorded ? 'HANDOFF_ALREADY_RECORDED' : duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED_PENDING_AGENT'}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
