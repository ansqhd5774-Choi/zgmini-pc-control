import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareHandoff} from './route.mjs';

// No agent or PC source is executed here. The broker only validates structured
// reports and records a durable routing decision in the original queue Issue.
const API = 'https://api.github.com';
const REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';

function assertEvent(event, env) {
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_ACTOR !== 'ansqhd5774-Choi' ||
      env.GITHUB_EVENT_NAME !== 'issues' || event.action !== 'opened' ||
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

export async function main(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  assertEvent(event, env);
  // A re-run of the same GitHub event must not create another report.
  const current = await api(`/repos/${REPOSITORY}/issues/${event.issue.number}`);
  if (current.labels?.some((label) => ['handoff-agent-pending', 'handoff-duplicate'].includes(label.name))) {
    process.stdout.write('HANDOFF_ALREADY_RECORDED\n');
    return;
  }
  const outcome = prepareHandoff(event.issue.body, await listPreviousBodies(event.issue.number));
  const duplicate = outcome.state === 'DUPLICATE_REUSED';
  const stateLabel = duplicate ? 'handoff-duplicate' : 'handoff-agent-pending';
  await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/labels`, {method: 'POST', body: {labels: [stateLabel]}});
  const lines = duplicate
    ? ['HANDOFF_DUPLICATE_REUSED', `fingerprint: ${outcome.fingerprint}`, 'newAgentDispatches: 0', 'PC retries: 0']
    : ['HANDOFF_ROUTED', `incidentId: ${outcome.incidentId}`, `fingerprint: ${outcome.fingerprint}`,
      `role: ${outcome.role}`, `state: ${outcome.state}`, `checkpoint: ${outcome.checkpoint}`,
      'PC retries: 0', 'operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'];
  await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/comments`, {method: 'POST', body: {body: lines.join('\n')}});
  process.stdout.write(`${duplicate ? 'HANDOFF_DUPLICATE_REUSED' : 'HANDOFF_ROUTED_PENDING_AGENT'}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
