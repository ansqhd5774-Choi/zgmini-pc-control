// SOURCE_ONLY; binds a verified generic resource wait to existing central
// coordinator Issue #68. No lease/Task/source/PC side effects or retries.
import {reconcileResourceWait, RESOURCE_WAIT_SCHEMA} from '../shared-resource/lifecycle.mjs';

const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const QUEUE_ISSUE = 68;
const BOT = 'github-actions[bot]';
const PREFIX = '<!-- zgmini-shared-resource-wait:';
const MAX_COMMENTS = 2000;
const stop = code => {throw new Error('RESOURCE_WAIT_LEDGER_' + code);};
const queueUrl = `https://api.github.com/repos/${REPO}/issues/${QUEUE_ISSUE}`;

export function resourceWaitCommentBody(wait) {
  if (wait?.schema !== RESOURCE_WAIT_SCHEMA ||
      wait.state !== 'WAITING_SHARED_RESOURCE' ||
      !/^resource-wait-[a-f0-9]{24}$/.test(wait.waitId ?? '') ||
      wait.automaticPcRetries !== 0 || wait.ownerReceipt !== 'UNKNOWN')
    stop('CANDIDATE_INVALID');
  return `${PREFIX}${wait.waitId} -->\n`+
    `공용 자원 대기 · ${wait.resourceKey} · 원본 #${wait.origin.issueNumber}\n`+
    `증거: #${wait.origin.issueNumber} / Run ${wait.evidence.runId}; `+
    `자동 PC 재실행 0회; 원담당 대화 수신 미확인\n`+
    `\`\`\`json\n${JSON.stringify(wait)}\n\`\`\`\n`;
}

export function parseResourceWaitComment(comment) {
  if (comment?.user?.login !== BOT || comment.issue_url !== queueUrl ||
      typeof comment.body !== 'string' || comment.body.length > 5000 ||
      !comment.body.startsWith(PREFIX)) return null;
  const match = comment.body.match(/^<!-- zgmini-shared-resource-wait:(resource-wait-[a-f0-9]{24}) -->\n/);
  if (!match) stop('MARKER_INVALID');
  const json = comment.body.match(/\n```json\n([^\r\n]{1,4000})\n```\n$/);
  if (!json) stop('BODY_INVALID');
  let record;
  try {record=JSON.parse(json[1]);}catch{stop('JSON_INVALID');}
  if (record?.schema !== RESOURCE_WAIT_SCHEMA ||
      record.waitId !== match[1] || record.state !== 'WAITING_SHARED_RESOURCE' ||
      record.automaticPcRetries !== 0 ||
      resourceWaitCommentBody(record) !== comment.body)
    stop('READBACK_MISMATCH');
  return record;
}

function inventory(comments) {
  if (!Array.isArray(comments) || comments.length > MAX_COMMENTS)
    stop('INVENTORY_INCOMPLETE');
  return {complete:true, records:comments.map(parseResourceWaitComment).filter(Boolean)};
}

/** The caller supplies complete authenticated GET/list, POST and GET-by-ID. */
export async function persistResourceWait(wait, {listComments, postComment, getComment}) {
  if ([listComments,postComment,getComment].some(x=>typeof x!=='function'))
    stop('IO_NOT_CONFIGURED');
  const body=resourceWaitCommentBody(wait);
  let decision=reconcileResourceWait(wait,inventory(await listComments()));
  if (decision.state==='REUSE_EXISTING')
    return Object.freeze({state:'WAIT_REUSED',waitId:wait.waitId,automaticPcRetries:0});
  if (decision.state!=='CREATE_CANDIDATE_ONLY') stop('DECISION_INVALID');

  let created;
  try {created=await postComment(body);}
  catch {
    // Ambiguous POST: read back once. Never POST again.
    decision=reconcileResourceWait(wait,inventory(await listComments()));
    if (decision.state!=='REUSE_EXISTING')stop('POST_OUTCOME_UNKNOWN');
    return Object.freeze({state:'WAIT_POST_RECONCILED',
      waitId:wait.waitId,automaticPcRetries:0});
  }
  if (!Number.isSafeInteger(created?.id) || created.id<1)
    stop('POST_RECEIPT_INVALID');
  const readback=await getComment(created.id);
  if (readback?.id!==created.id ||
      readback.body!==body || !parseResourceWaitComment(readback))
    stop('POST_READBACK_UNVERIFIED');
  return Object.freeze({state:'WAIT_RECORDED',
    waitId:wait.waitId,commentId:created.id,automaticPcRetries:0});
}
