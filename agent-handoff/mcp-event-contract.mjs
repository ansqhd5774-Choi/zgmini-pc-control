import {createHash} from 'node:crypto';

// SOURCE_ONLY pilot for ChatGPT Work MCP Events. This file does not create an
// MCP server, a subscription, a webhook connection, or a ChatGPT wake-up.
const CONTROL_REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const BOT = 'github-actions[bot]';
export const HANDOFF_ORIGIN_EVENT = 'zgmini.handoff.origin_result_recorded';

const RECEIPT_LINES = [
  'HANDOFF_ORIGIN_RESULT_RECORDED',
  'resultId: ',
  'digest: ',
  'incidentId: ',
  'handoffIssue: ',
  'fixPr: ',
  'prHeadSha: ',
  'testRunId: ',
  'state: RUNTIME_VERIFICATION_PENDING',
  'ChatGPT owner received: UNKNOWN',
  'Windows/D1/API/UI verification: NOT_VERIFIED',
  'PC retries: 0',
  'operationalWrites: 0'
];

function positive(value, code) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}

function parseLine(lines, index, regex, code) {
  const prefix = RECEIPT_LINES[index];
  if (!lines[index].startsWith(prefix)) throw new Error(code);
  const value = lines[index].slice(prefix.length);
  if (!regex.test(value)) throw new Error(code);
  return value;
}

// Caller must fetch the original issue and bot comment through authenticated
// GitHub REST, after result-broker has validated the PR/run/owner provenance.
// This function only enforces the minimal public event *shape* and does not
// replace those upstream authorization/provenance checks.
export function originResultEventFromReceipt({repository, originIssueNumber, comment}) {
  if (repository !== CONTROL_REPO) throw new Error('MCP_EVENT_REPOSITORY_STOP');
  const issueNumber = positive(originIssueNumber, 'MCP_EVENT_ISSUE_STOP');
  if (!comment || comment.user?.login !== BOT) throw new Error('MCP_EVENT_BOT_AUTHOR_STOP');
  if (comment.issue_url !== `https://api.github.com/repos/${CONTROL_REPO}/issues/${issueNumber}`) {
    throw new Error('MCP_EVENT_COMMENT_ORIGIN_STOP');
  }
  const commentId = positive(comment.id, 'MCP_EVENT_COMMENT_ID_STOP');
  if (typeof comment.body !== 'string' || Buffer.byteLength(comment.body, 'utf8') > 2048) {
    throw new Error('MCP_EVENT_RECEIPT_SIZE_STOP');
  }
  const lines = comment.body.split('\n');
  if (lines.length !== RECEIPT_LINES.length ||
      RECEIPT_LINES.some((value, index) => index === 0 || index >= 8
        ? lines[index] !== value : !lines[index].startsWith(value))) {
    throw new Error('MCP_EVENT_RECEIPT_SHAPE_STOP');
  }
  const resultId = parseLine(lines, 1, /^result-[a-z0-9-]{12,80}$/, 'MCP_EVENT_RESULT_ID_STOP');
  const digest = parseLine(lines, 2, /^[a-f0-9]{64}$/, 'MCP_EVENT_DIGEST_STOP');
  const incidentId = parseLine(lines, 3, /^handoff-[a-z0-9-]{12,80}$/, 'MCP_EVENT_INCIDENT_STOP');
  const handoffIssueNumber = positive(Number(parseLine(lines, 4, /^[1-9][0-9]*$/, 'MCP_EVENT_HANDOFF_STOP')), 'MCP_EVENT_HANDOFF_STOP');
  const fix = parseLine(lines, 5, /^ansqhd5774-Choi\/(?:zgmini|zgmini-pc-control)#[1-9][0-9]*$/, 'MCP_EVENT_FIX_PR_STOP');
  const fixPrSha = parseLine(lines, 6, /^[a-f0-9]{40}$/, 'MCP_EVENT_SHA_STOP');
  const testRunId = positive(Number(parseLine(lines, 7, /^[1-9][0-9]*$/, 'MCP_EVENT_RUN_ID_STOP')), 'MCP_EVENT_RUN_ID_STOP');
  if (typeof comment.created_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(comment.created_at) ||
      !Number.isFinite(Date.parse(comment.created_at)) ||
      new Date(comment.created_at).toISOString() !== comment.created_at.replace(/Z$/, '.000Z')) {
    throw new Error('MCP_EVENT_TIMESTAMP_STOP');
  }
  const eventId = `evt_${createHash('sha256').update(
    `${repository}|${issueNumber}|${commentId}|${resultId}|${digest}`
  ).digest('hex')}`;
  const event = {
    eventId,
    name: HANDOFF_ORIGIN_EVENT,
    timestamp: new Date(comment.created_at).toISOString(),
    data: {
      repository,
      originIssueNumber: issueNumber,
      originCommentId: commentId,
      handoffIssueNumber,
      incidentId,
      resultId,
      digest,
      fixPr: fix,
      fixPrHeadSha: fixPrSha,
      testRunId,
      verification: 'RUNTIME_VERIFICATION_PENDING'
    },
    cursor: null
  };
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > 256 * 1024) {
    throw new Error('MCP_EVENT_PAYLOAD_SIZE_STOP');
  }
  return Object.freeze({...event, data: Object.freeze(event.data)});
}

// Read-only metadata that a future authenticated events/list implementation
// can advertise. Subscription authorization, persistent storage, HTTPS
// validation, Standard Webhooks signing, and delivery are deliberately absent.
export const HANDOFF_ORIGIN_EVENT_DEFINITION = Object.freeze({
  name: HANDOFF_ORIGIN_EVENT,
  description: 'A verified repair result was recorded in a ZGMINI origin GitHub issue; runtime application is not verified.',
  delivery: ['webhook'],
  inputSchema: {
    type: 'object',
    properties: {
      repository: {type: 'string', const: CONTROL_REPO},
      originIssueNumber: {type: 'integer', minimum: 1}
    },
    required: ['repository', 'originIssueNumber'],
    additionalProperties: false
  },
  payloadSchema: {
    type: 'object',
    properties: {
      repository: {type: 'string', const: CONTROL_REPO},
      originIssueNumber: {type: 'integer', minimum: 1},
      originCommentId: {type: 'integer', minimum: 1},
      handoffIssueNumber: {type: 'integer', minimum: 1},
      incidentId: {type: 'string', pattern: '^handoff-[a-z0-9-]{12,80}$'},
      resultId: {type: 'string', pattern: '^result-[a-z0-9-]{12,80}$'},
      digest: {type: 'string', pattern: '^[a-f0-9]{64}$'},
      fixPr: {type: 'string', pattern: '^ansqhd5774-Choi/(zgmini|zgmini-pc-control)#[1-9][0-9]*$'},
      fixPrHeadSha: {type: 'string', pattern: '^[a-f0-9]{40}$'},
      testRunId: {type: 'integer', minimum: 1},
      verification: {type: 'string', const: 'RUNTIME_VERIFICATION_PENDING'}
    },
    required: ['repository', 'originIssueNumber', 'originCommentId', 'handoffIssueNumber',
      'incidentId', 'resultId', 'digest', 'fixPr', 'fixPrHeadSha', 'testRunId', 'verification'],
    additionalProperties: false
  }
});
