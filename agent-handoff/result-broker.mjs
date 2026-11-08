import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseHandoff} from './contract.mjs';
import {parseAgentResult, resultDigest, verifyAgentResult} from './result-contract.mjs';

const REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';
const API = 'https://api.github.com';

export function assertWorkflowResultRepository(result) {
  // The repository-scoped GITHUB_TOKEN cannot read another private repo's
  // PR/Actions metadata. A multi-repo GitHub App is a separate permission step.
  if (result.pullRequest.repository !== REPOSITORY || result.testRun.repository !== REPOSITORY) {
    throw new Error('RESULT_CROSS_REPO_AUTH_NOT_CONFIGURED');
  }
}

async function api(resource, {method = 'GET', body} = {}) {
  if (!process.env.GITHUB_TOKEN) throw new Error('RESULT_GITHUB_TOKEN_STOP');
  const response = await fetch(`${API}${resource}`, {method,
    headers: {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})});
  if (!response.ok) throw new Error(`RESULT_GITHUB_API_${response.status}_STOP`);
  return response.status === 204 ? null : response.json();
}

async function inspectExistingResult(issueNumber, resultId, digest) {
  for (let page = 1; page <= 4; page++) {
    const rows = await api(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error('RESULT_COMMENT_LEDGER_STOP');
    for (const row of rows) {
      if (row.user?.login !== 'github-actions[bot]' || typeof row.body !== 'string' ||
          !row.body.startsWith('HANDOFF_RESULT_RECORDED\n')) continue;
      const lines = row.body.split('\n');
      if (!lines.includes(`resultId: ${resultId}`)) continue;
      if (!lines.includes(`digest: ${digest}`)) throw new Error('RESULT_ID_COLLISION_STOP');
      return true;
    }
    if (rows.length < 100) return false;
  }
  throw new Error('RESULT_COMMENT_SCAN_LIMIT_STOP');
}

function authorize(event, env) {
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_EVENT_NAME !== 'issue_comment' ||
      env.GITHUB_ACTOR !== 'ansqhd5774-Choi' || event.action !== 'created' ||
      event.repository?.private !== true || event.issue?.pull_request ||
      event.issue?.user?.login !== 'ansqhd5774-Choi' ||
      event.comment?.user?.login !== 'ansqhd5774-Choi' ||
      !event.issue?.labels?.some((label) => label.name === 'agent-handoff') ||
      !Number.isSafeInteger(event.issue.number)) throw new Error('RESULT_EVENT_NOT_ALLOWED');
}

export async function main(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) throw new Error('RESULT_EVENT_PATH_STOP');
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  authorize(event, env);
  const handoff = parseHandoff(event.issue.body);
  const result = parseAgentResult(event.comment.body);
  assertWorkflowResultRepository(result);
  const digest = resultDigest(result);
  if (await inspectExistingResult(event.issue.number, result.resultId, digest)) {
    process.stdout.write('HANDOFF_RESULT_ALREADY_RECORDED\n');
    return;
  }
  const repo = result.pullRequest.repository;
  const [pr, run] = await Promise.all([
    api(`/repos/${repo}/pulls/${result.pullRequest.number}`),
    api(`/repos/${repo}/actions/runs/${result.testRun.runId}`)
  ]);
  const verified = verifyAgentResult(handoff, result, pr, run);
  const comment = [
    'HANDOFF_RESULT_RECORDED', `resultId: ${result.resultId}`, `digest: ${digest}`,
    `incidentId: ${result.incidentId}`, `fingerprint: ${result.fingerprint}`,
    `origin: ${handoff.origin.repository}#${handoff.origin.issueNumber}`,
    `pr: ${repo}#${result.pullRequest.number}`, `prHeadSha: ${result.pullRequest.headSha}`,
    `testRunId: ${result.testRun.runId}`, `state: ${verified.state}`,
    'ChatGPT owner received: UNKNOWN', 'Windows/D1/API/UI verification: NOT_VERIFIED',
    'PC retries: 0', 'operationalWrites: 0'
  ].join('\n');
  await api(`/repos/${REPOSITORY}/issues/${event.issue.number}/comments`, {method: 'POST', body: {body: comment}});
  if (!await inspectExistingResult(event.issue.number, result.resultId, digest)) throw new Error('RESULT_COMMENT_READBACK_STOP');
  process.stdout.write('HANDOFF_RESULT_RECORDED_PENDING_RUNTIME\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
