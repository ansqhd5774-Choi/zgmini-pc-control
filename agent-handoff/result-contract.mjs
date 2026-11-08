import {createHash} from 'node:crypto';
import {fingerprintHandoff} from './contract.mjs';

export const HANDOFF_RESULT_SCHEMA = 'ZGMINI_AGENT_HANDOFF_RESULT_V1';
const REPOSITORIES = new Set(['ansqhd5774-Choi/zgmini-pc-control', 'ansqhd5774-Choi/zgmini']);

function obj(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new Error(code);
  return value;
}

function text(value, regex, code) {
  if (typeof value !== 'string' || !regex.test(value)) throw new Error(code);
  return value;
}

function issue(value, code) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}

function repo(value) {
  if (!REPOSITORIES.has(value)) throw new Error('RESULT_REPOSITORY_NOT_ALLOWED');
  return value;
}

export function parseAgentResult(body) {
  if (typeof body !== 'string' || body.length > 4096) throw new Error('RESULT_BODY_SIZE_STOP');
  let input;
  try { input = JSON.parse(body); } catch { throw new Error('RESULT_JSON_INVALID'); }
  obj(input, ['schema', 'resultId', 'incidentId', 'fingerprint', 'pullRequest', 'testRun'], 'RESULT_FIELDS_INVALID');
  if (input.schema !== HANDOFF_RESULT_SCHEMA) throw new Error('RESULT_SCHEMA_INVALID');
  const resultId = text(input.resultId, /^result-[a-z0-9-]{12,80}$/, 'RESULT_ID_INVALID');
  const incidentId = text(input.incidentId, /^handoff-[a-z0-9-]{12,80}$/, 'RESULT_INCIDENT_INVALID');
  const fingerprint = text(input.fingerprint, /^[a-f0-9]{64}$/, 'RESULT_FINGERPRINT_INVALID');
  const pr = obj(input.pullRequest, ['repository', 'number', 'headSha'], 'RESULT_PR_FIELDS_INVALID');
  const run = obj(input.testRun, ['repository', 'runId', 'headSha'], 'RESULT_RUN_FIELDS_INVALID');
  const result = {
    schema: HANDOFF_RESULT_SCHEMA, resultId, incidentId, fingerprint,
    pullRequest: {repository: repo(pr.repository), number: issue(pr.number, 'RESULT_PR_NUMBER_INVALID'),
      headSha: text(pr.headSha, /^[a-f0-9]{40}$/, 'RESULT_PR_SHA_INVALID')},
    testRun: {repository: repo(run.repository), runId: issue(run.runId, 'RESULT_RUN_ID_INVALID'),
      headSha: text(run.headSha, /^[a-f0-9]{40}$/, 'RESULT_RUN_SHA_INVALID')}
  };
  return Object.freeze(result);
}

export function resultDigest(result) {
  return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}

// GitHub API evidence does not establish that Windows/D1/UI runtime changed.
export function verifyAgentResult(handoff, result, pr, run) {
  if (handoff.incidentId !== result.incidentId || fingerprintHandoff(handoff) !== result.fingerprint) {
    throw new Error('RESULT_ORIGIN_MISMATCH_STOP');
  }
  const expectedRepository = handoff.failure.kind === 'FEATURE'
    ? handoff.origin.repository : 'ansqhd5774-Choi/zgmini-pc-control';
  if (result.pullRequest.repository !== expectedRepository || result.testRun.repository !== expectedRepository) {
    throw new Error('RESULT_OWNER_REPOSITORY_STOP');
  }
  if (!pr || pr.number !== result.pullRequest.number || pr.head?.sha !== result.pullRequest.headSha ||
      pr.head?.repo?.full_name !== expectedRepository || pr.base?.repo?.full_name !== expectedRepository ||
      !['open', 'closed'].includes(pr.state)) throw new Error('RESULT_PR_PROVENANCE_STOP');
  if (!run || run.id !== result.testRun.runId || run.head_sha !== result.testRun.headSha ||
      run.head_sha !== pr.head.sha || run.status !== 'completed' || run.conclusion !== 'success' ||
      run.repository?.full_name !== expectedRepository) throw new Error('RESULT_TEST_RUN_PROVENANCE_STOP');
  return Object.freeze({state: 'RUNTIME_VERIFICATION_PENDING', ownerAcknowledged: false,
    confirmed: ['PR_HEAD_SHA', 'GITHUB_ACTION_CONCLUSION'], operationalWrites: 0});
}
