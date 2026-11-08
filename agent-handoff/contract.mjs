import {createHash} from 'node:crypto';

export const HANDOFF_SCHEMA = 'ZGMINI_AGENT_HANDOFF_V1';
export const RESULT_SCHEMA = 'ZGMINI_AGENT_HANDOFF_RESULT_V1';
export const DEFAULT_POLICY = Object.freeze({automaticPcRetries: 0, agentDispatchLimit: 1});

const REPOSITORIES = new Set(['ansqhd5774-Choi/zgmini-pc-control', 'ansqhd5774-Choi/zgmini']);
const FAILURE_KINDS = new Set(['COMMON_CONTROLLER', 'COMMON_RUNNER', 'COMMON_WRITER', 'FEATURE']);
const CHECKPOINTS = new Set(['SOURCE', 'INSTALL', 'COLLECT', 'CALCULATE', 'STORE', 'D1', 'API', 'UI', 'OTHER']);
const STATES = new Set(['QUEUED', 'AWAITING_AGENT_CONFIGURATION', 'ASSIGNED', 'FIX_PROPOSED', 'TESTED', 'APPLIED_VERIFIED', 'RETURNED', 'OWNER_RESUMED', 'BLOCKED']);
const MOVES = Object.freeze({
  QUEUED: ['AWAITING_AGENT_CONFIGURATION', 'ASSIGNED', 'BLOCKED'],
  AWAITING_AGENT_CONFIGURATION: ['ASSIGNED', 'BLOCKED'],
  ASSIGNED: ['FIX_PROPOSED', 'BLOCKED'],
  FIX_PROPOSED: ['TESTED', 'BLOCKED'],
  TESTED: ['APPLIED_VERIFIED', 'BLOCKED'],
  APPLIED_VERIFIED: ['RETURNED', 'BLOCKED'],
  RETURNED: ['OWNER_RESUMED', 'BLOCKED'],
  BLOCKED: [],
  OWNER_RESUMED: []
});

function requireObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name}_OBJECT_REQUIRED`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${name}_UNEXPECTED_FIELD`);
  return value;
}

function requireString(value, re, name) {
  if (typeof value !== 'string' || !re.test(value)) throw new Error(`${name}_INVALID`);
  return value;
}

function requireIssue(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name}_INVALID`);
  return value;
}

function requireRepo(value) {
  if (!REPOSITORIES.has(value)) throw new Error('REPOSITORY_NOT_ALLOWED');
  return value;
}

function requirePath(value) {
  if (typeof value !== 'string' || value.length > 180 || !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(value) ||
      value.split('/').includes('..') || value.includes('...')) throw new Error('FILE_REF_INVALID');
  return value;
}

export function parseHandoff(body) {
  if (typeof body !== 'string' || body.length > 8192) throw new Error('HANDOFF_BODY_SIZE_STOP');
  let input;
  try { input = JSON.parse(body); } catch { throw new Error('HANDOFF_JSON_INVALID'); }
  requireObject(input, 'HANDOFF', ['schema', 'incidentId', 'origin', 'failure']);
  if (input.schema !== HANDOFF_SCHEMA) throw new Error('HANDOFF_SCHEMA_INVALID');
  const incidentId = requireString(input.incidentId, /^handoff-[a-z0-9-]{12,80}$/, 'INCIDENT_ID');
  const origin = requireObject(input.origin, 'ORIGIN', ['repository', 'issueNumber', 'requestId', 'chatId', 'branch', 'sourceSha', 'checkpoint']);
  const failure = requireObject(input.failure, 'FAILURE', ['kind', 'code', 'lastPass', 'firstFail', 'fileRefs', 'evidenceIssueNumber']);
  const repository = requireRepo(origin.repository);
  const issueNumber = requireIssue(origin.issueNumber, 'ORIGIN_ISSUE');
  const requestId = requireString(origin.requestId, /^[a-z0-9-]{8,80}$/, 'REQUEST_ID');
  const chatId = requireString(origin.chatId, /^[a-z0-9-]{4,80}$/, 'CHAT_ID');
  const branch = requireString(origin.branch, /^(?!\/)(?!.*\.\.)(?!.*\/\/)[a-zA-Z0-9_.\/-]{1,160}$/, 'BRANCH');
  const sourceSha = requireString(origin.sourceSha, /^[a-f0-9]{40}$/, 'SOURCE_SHA');
  if (!CHECKPOINTS.has(origin.checkpoint)) throw new Error('CHECKPOINT_INVALID');
  if (!FAILURE_KINDS.has(failure.kind)) throw new Error('FAILURE_KIND_INVALID');
  const code = requireString(failure.code, /^[A-Z][A-Z0-9_]{2,79}$/, 'FAILURE_CODE');
  const lastPass = requireString(failure.lastPass, /^[A-Z][A-Z0-9_]{2,79}$/, 'LAST_PASS');
  const firstFail = requireString(failure.firstFail, /^[A-Z][A-Z0-9_]{2,79}$/, 'FIRST_FAIL');
  if (!Array.isArray(failure.fileRefs) || failure.fileRefs.length > 8 || new Set(failure.fileRefs).size !== failure.fileRefs.length) {
    throw new Error('FILE_REFS_INVALID');
  }
  const fileRefs = failure.fileRefs.map(requirePath);
  const evidenceIssueNumber = failure.evidenceIssueNumber === undefined ? null : requireIssue(failure.evidenceIssueNumber, 'EVIDENCE_ISSUE');
  const clean = {
    schema: HANDOFF_SCHEMA, incidentId,
    origin: {repository, issueNumber, requestId, chatId, branch, sourceSha, checkpoint: origin.checkpoint},
    failure: {kind: failure.kind, code, lastPass, firstFail, fileRefs, evidenceIssueNumber}
  };
  return Object.freeze(clean);
}

export function fingerprintHandoff(item) {
  const {repository, issueNumber, requestId, sourceSha} = item.origin;
  const {code, firstFail} = item.failure;
  return createHash('sha256').update(JSON.stringify([repository, issueNumber, requestId, sourceSha, code, firstFail])).digest('hex');
}

export function routeHandoff(item, {agentConfigured = false} = {}) {
  const role = item.failure.kind === 'FEATURE' ? 'ORIGIN_FUNCTION_OWNER' : 'COMMON_PROCESS_OWNER';
  return Object.freeze({role, state: agentConfigured ? 'ASSIGNED' : 'AWAITING_AGENT_CONFIGURATION',
    fingerprint: fingerprintHandoff(item), automaticPcRetries: DEFAULT_POLICY.automaticPcRetries,
    agentDispatchLimit: DEFAULT_POLICY.agentDispatchLimit, operationalWrites: 0});
}

export function transitionHandoff(from, to, evidence = {}) {
  if (!STATES.has(from) || !STATES.has(to) || !MOVES[from].includes(to)) throw new Error('HANDOFF_STATE_TRANSITION_STOP');
  requireObject(evidence, 'EVIDENCE', ['prIssueNumber', 'testsPassed', 'runtimeVerified', 'ownerAcknowledged']);
  if (to === 'FIX_PROPOSED') requireIssue(evidence.prIssueNumber, 'PR_ISSUE');
  if (to === 'TESTED' && evidence.testsPassed !== true) throw new Error('TEST_PASS_REQUIRED');
  if (to === 'APPLIED_VERIFIED' && evidence.runtimeVerified !== true) throw new Error('RUNTIME_PASS_REQUIRED');
  if (to === 'OWNER_RESUMED' && evidence.ownerAcknowledged !== true) throw new Error('OWNER_ACK_REQUIRED');
  return to;
}
