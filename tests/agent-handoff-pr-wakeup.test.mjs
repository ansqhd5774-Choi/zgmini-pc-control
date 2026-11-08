import test from 'node:test';
import assert from 'node:assert/strict';
import {recordPrWakeEvent, CHAT_WAKE_MARKER} from '../agent-handoff/pr-wakeup.mjs';

const handoff = () => ({schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
  origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009,
    requestId: 'pc-123456789abc', chatId: 'chat-theme1', branch: 'codex/theme',
    sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
  failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP',
    lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}});
const binding = () => ({enabled: true, repository: 'ansqhd5774-Choi/zgmini-pc-control',
  pullRequestNumber: 934, targetChatId: 'chat-process-owner', targetRole: 'COMMON_PROCESS_OWNER'});

function harness() {
  let id = 0;
  const comments = [];
  let complete = true;
  const readPrComments = async (target) => ({repository: target.repository,
    pullRequestNumber: target.pullRequestNumber, complete, comments: [...comments]});
  const postPrComment = async (_target, body) => {
    comments.push({id: ++id, user: {login: 'github-actions[bot]'}, body});
  };
  return {comments, readPrComments, postPrComment, setComplete: value => {complete = value;}};
}

test('explicit private PR binding records an event but never claims chat reception', async () => {
  const h = harness();
  const input = {body: handoff(), queueIssueNumber: 1200, binding: binding(), ...h};
  const r = await recordPrWakeEvent(input);
  assert.equal(r.state, 'PR_EVENT_RECORDED_CHAT_ACK_UNKNOWN');
  assert.equal(r.actualChatResumeVerified, false);
  assert.equal(r.automaticPcRetries, 0);
  assert.equal(r.posted, true);
  assert.equal(h.comments[0].body.split('\n')[0], CHAT_WAKE_MARKER);
  assert.equal(h.comments[0].body.includes('rawError'), false);
  const duplicate = await recordPrWakeEvent(input);
  assert.equal(duplicate.posted, false);
  assert.equal(duplicate.commentId, r.commentId);
  assert.equal(h.comments.length, 1);
});

test('lost POST response is recovered through exact PR comment readback', async () => {
  const h = harness();
  const postPrComment = async (t, body) => {await h.postPrComment(t, body); throw new Error('network response lost');};
  const r = await recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), readPrComments: h.readPrComments, postPrComment});
  assert.equal(r.commentId, 1);
  assert.equal(r.actualChatResumeVerified, false);
});

test('missing or incomplete target-PR receipt fails closed', async () => {
  const h = harness();
  h.setComplete(false);
  await assert.rejects(recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), ...h}), /INVENTORY_INCOMPLETE/);
  h.setComplete(true);
  const noPost = async () => {};
  await assert.rejects(recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), readPrComments: h.readPrComments, postPrComment: noPost}), /READBACK_STOP/);
});

test('wrong repository, disabled mapping, or target role is rejected before I/O', async () => {
  const h = harness();
  for (const change of [{enabled: false}, {repository: 'ansqhd5774-Choi/zgmini'},
    {targetRole: 'ORIGIN_FUNCTION_OWNER'}]) {
    await assert.rejects(recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
      binding: {...binding(), ...change}, ...h}), /BINDING_NOT_APPROVED/);
  }
  assert.equal(h.comments.length, 0);
});

test('spoofed comment or wrong PR inventory never proves receipt', async () => {
  const h = harness();
  const original = h.readPrComments;
  const wrongScope = async target => ({...await original(target), pullRequestNumber: 777});
  await assert.rejects(recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), readPrComments: wrongScope, postPrComment: h.postPrComment}),
  /INVENTORY_INCOMPLETE/);
  h.comments.push({id: 1, user: {login: 'attacker'}, body: CHAT_WAKE_MARKER});
  await assert.rejects(recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), readPrComments: original, postPrComment: async () => {}}), /READBACK_STOP/);
});

test('multiple matching authoritative receipts are uncertain, not success', async () => {
  const h = harness();
  await recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), ...h});
  h.comments.push({...h.comments[0], id: 2});
  await assert.rejects(recordPrWakeEvent({body: handoff(), queueIssueNumber: 1200,
    binding: binding(), ...h}), /MULTIPLE_RECEIPTS_STOP/);
});
