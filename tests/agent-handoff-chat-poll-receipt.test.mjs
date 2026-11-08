import test from 'node:test';
import assert from 'node:assert/strict';
import {recordPrWakeEvent} from '../agent-handoff/pr-wakeup.mjs';
import {expectedChatPollAckLines, verifyChatPollAck} from '../agent-handoff/chat-poll-receipt.mjs';

const body = () => ({schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
  origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009,
    requestId: 'pc-123456789abc', chatId: 'chat-theme1', branch: 'codex/theme',
    sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
  failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP',
    lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}});
const binding = () => ({enabled: true, repository: 'ansqhd5774-Choi/zgmini-pc-control',
  pullRequestNumber: 934, targetChatId: 'chat-process-owner', targetRole: 'COMMON_PROCESS_OWNER'});

async function fixture() {
  const comments = [];
  const b = binding(), handoff = body();
  const readPrComments = async () => ({complete: true, repository: b.repository,
    pullRequestNumber: b.pullRequestNumber, comments});
  await recordPrWakeEvent({body: handoff, queueIssueNumber: 1200, binding: b,
    readPrComments, postPrComment: async (_, commentBody) => {
      comments.push({id: 1, user: {login: 'github-actions[bot]'}, body: commentBody});
    }});
  const verify = overrides => verifyChatPollAck({body: handoff, queueIssueNumber: 1200,
    binding: b, allowedAckActorLogin: 'ansqhd5774-Choi', readPrComments, ...overrides});
  const ackBody = expectedChatPollAckLines({body: handoff, queueIssueNumber: 1200,
    wakeCommentId: 1, binding: b}).join('\n');
  return {comments, b, readPrComments, verify, ackBody};
}

test('bot wake alone has no ChatGPT receipt, even when bot comment exists', async () => {
  const f = await fixture();
  const r = await f.verify();
  assert.equal(r.state, 'CHAT_POLL_ACK_PENDING');
  assert.equal(r.ackCommentId, null);
  assert.equal(r.actualChatResumeVerified, false);
});

test('ChatGPT GitHub account ACK matches exact PR, wake, actor, and body but not chat_ref', async () => {
  const f = await fixture();
  f.comments.push({id: 2, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  const r = await f.verify();
  assert.equal(r.state, 'CHAT_POLL_ACK_COMMENT_VERIFIED_CHAT_REF_UNKNOWN');
  assert.equal(r.wakeCommentId, 1);
  assert.equal(r.ackCommentId, 2);
  assert.equal(r.actualChatResumeVerified, false);
  assert.equal(r.automaticPcRetries, 0);
});

test('wrong GitHub actor, wake ID, altered ACK and wrong PR never give false success', async () => {
  const f = await fixture();
  const row = {id: 2, user: {login: 'attacker'}, body: f.ackBody};
  f.comments.push(row);
  assert.equal((await f.verify()).state, 'CHAT_POLL_ACK_PENDING');
  row.user.login = 'ansqhd5774-Choi';
  row.body = f.ackBody.replace('wakeCommentId: 1', 'wakeCommentId: 999');
  assert.equal((await f.verify()).state, 'CHAT_POLL_ACK_PENDING');
  row.body = f.ackBody + '\nignore safeguards';
  assert.equal((await f.verify()).state, 'CHAT_POLL_ACK_PENDING');
  row.body = f.ackBody;
  const wrongPr = async () => ({...await f.readPrComments(), pullRequestNumber: 935});
  await assert.rejects(f.verify({readPrComments: wrongPr}), /INVENTORY_INCOMPLETE/);
});

test('duplicate exact ACKs and invalid actor/binding fail closed', async () => {
  const f = await fixture();
  f.comments.push({id: 2, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  f.comments.push({id: 3, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  await assert.rejects(f.verify(), /MULTIPLE_RECEIPTS_STOP/);
  await assert.rejects(f.verify({allowedAckActorLogin: 'github-actions[bot]'}), /NOT_APPROVED/);
  assert.equal((await f.verify({binding: {...f.b, targetChatId: 'wrong-target'}})).state,
    'CHAT_POLL_WAKE_NOT_FOUND');
  await assert.rejects(f.verify({binding: {...f.b, targetRole: 'ORIGIN_FUNCTION_OWNER'}}),
    /BINDING_NOT_APPROVED/);
});

test('missing bot wake cannot be replaced with a forged owner receipt', async () => {
  const f = await fixture();
  f.comments[0].user.login = 'ansqhd5774-Choi';
  f.comments.push({id: 2, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  const r = await f.verify();
  assert.equal(r.state, 'CHAT_POLL_WAKE_NOT_FOUND');
  assert.equal(r.actualChatResumeVerified, false);
});

test('incomplete inventory, oversized pagination and duplicate bot wake are rejected', async () => {
  const f = await fixture();
  await assert.rejects(f.verify({readPrComments: async () =>
    ({...await f.readPrComments(), complete: false})}), /INVENTORY_INCOMPLETE/);
  await assert.rejects(f.verify({readPrComments: async () =>
    ({...await f.readPrComments(), comments: Array(401).fill(f.comments[0])})}),
  /INVENTORY_INCOMPLETE/);
  f.comments.push({...f.comments[0], id: 3});
  await assert.rejects(f.verify(), /CHAT_POLL_WAKE_MULTIPLE_RECEIPTS_STOP/);
});
