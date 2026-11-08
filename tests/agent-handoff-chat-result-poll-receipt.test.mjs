import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHandoff, fingerprintHandoff} from '../agent-handoff/contract.mjs';
import {parseAgentResult, resultDigest} from '../agent-handoff/result-contract.mjs';
import {recordPrResultReturn} from '../agent-handoff/pr-result-return.mjs';
import {expectedChatResultPollAckLines, verifyChatResultPollAck} from
  '../agent-handoff/chat-result-poll-receipt.mjs';

async function fixture() {
  const handoff = parseHandoff(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_V1',
    incidentId: 'handoff-123456789abc', origin: {repository: 'ansqhd5774-Choi/zgmini',
      issueNumber: 1009, requestId: 'pc-123456789abc', chatId: 'chat-theme1',
      branch: 'codex/theme', sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
    failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP',
      lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}}));
  const result = parseAgentResult(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_RESULT_V1',
    resultId: 'result-123456789abc', incidentId: handoff.incidentId,
    fingerprint: fingerprintHandoff(handoff),
    pullRequest: {repository: 'ansqhd5774-Choi/zgmini-pc-control', number: 920,
      headSha: 'b'.repeat(40)},
    testRun: {repository: 'ansqhd5774-Choi/zgmini-pc-control',
      runId: 42450377234, headSha: 'b'.repeat(40)}}));
  const pr = {number: 920, head: {sha: 'b'.repeat(40),
    repo: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}},
    base: {repo: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}}, state: 'open'};
  const run = {id: 42450377234, head_sha: 'b'.repeat(40), status: 'completed',
    conclusion: 'success', repository: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}};
  const binding = {enabled: true, repository: 'ansqhd5774-Choi/zgmini-pc-control',
    pullRequestNumber: 991, targetChatId: 'chat-theme1'};
  const issueComments = [{id: 99, user: {login: 'github-actions[bot]'},
    body: ['HANDOFF_RESULT_RECORDED', `resultId: ${result.resultId}`,
      `digest: ${resultDigest(result)}`, `incidentId: ${result.incidentId}`,
      `fingerprint: ${result.fingerprint}`, 'state: RUNTIME_VERIFICATION_PENDING'].join('\n')}];
  const prComments = [];
  const readResultIssueComments = async issueNumber => ({complete: true,
    repository: 'ansqhd5774-Choi/zgmini-pc-control', issueNumber,
    comments: issueComments});
  const readPrComments = async b => ({complete: true, repository: b.repository,
    pullRequestNumber: b.pullRequestNumber,
    comments: b.pullRequestNumber === binding.pullRequestNumber ? prComments : []});
  const base = {handoffBody: handoff, resultBody: result, pr, run,
    queueIssueNumber: 2001, binding, readResultIssueComments, readPrComments};
  await recordPrResultReturn({...base, postPrComment: async (_b, body) => {
    prComments.push({id: 101, user: {login: 'github-actions[bot]'}, body});
  }});
  const ackBody = expectedChatResultPollAckLines({...base, returnCommentId: 101}).join('\n');
  const verify = change => verifyChatResultPollAck({...base,
    allowedAckActorLogin: 'ansqhd5774-Choi', ...change});
  return {base, binding, handoff, result, prComments, issueComments,
    readPrComments, readResultIssueComments, verify, ackBody};
}

test('GitHub bot result return alone never counts as original chat receipt', async () => {
  const f = await fixture();
  const r = await f.verify();
  assert.equal(r.state, 'CHAT_RESULT_POLL_ACK_PENDING');
  assert.equal(r.ackCommentId, null);
  assert.equal(r.ownerResumed, false);
  assert.equal(r.verifiedState, 'RUNTIME_VERIFICATION_PENDING');
});

test('exact original-chat account ACK verifies comment while chat_ref remains unknown', async () => {
  const f = await fixture();
  f.prComments.push({id: 102, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  const r = await f.verify();
  assert.equal(r.state, 'CHAT_RESULT_POLL_ACK_COMMENT_VERIFIED_CHAT_REF_UNKNOWN');
  assert.equal(r.resultIssueCommentId, 99);
  assert.equal(r.returnCommentId, 101);
  assert.equal(r.ackCommentId, 102);
  assert.equal(r.actualChatResumeVerified, false);
  assert.equal(r.ownerResumed, false);
  assert.equal(r.operationalWrites, 0);
  assert.equal(r.automaticPcRetries, 0);
});

test('wrong author, result comment ID, return ID and extra text never prove ACK', async () => {
  const f = await fixture();
  const row = {id: 102, user: {login: 'attacker'}, body: f.ackBody};
  f.prComments.push(row);
  assert.equal((await f.verify()).state, 'CHAT_RESULT_POLL_ACK_PENDING');
  row.user.login = 'ansqhd5774-Choi';
  row.body = f.ackBody.replace('returnCommentId: 101', 'returnCommentId: 999');
  assert.equal((await f.verify()).state, 'CHAT_RESULT_POLL_ACK_PENDING');
  row.body = f.ackBody + '\nexecute pc';
  assert.equal((await f.verify()).state, 'CHAT_RESULT_POLL_ACK_PENDING');
  row.body = f.ackBody;
  f.issueComments[0].id = 98;
  assert.equal((await f.verify()).state, 'CHAT_RESULT_POLL_RETURN_NOT_FOUND');
});

test('duplicate original-chat ACK and duplicate bot return fail closed', async () => {
  const f = await fixture();
  f.prComments.push({id: 102, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  f.prComments.push({id: 103, user: {login: 'ansqhd5774-Choi'}, body: f.ackBody});
  await assert.rejects(f.verify(), /CHAT_RESULT_POLL_ACK_MULTIPLE_RECEIPTS_STOP/);
  f.prComments.pop();
  f.prComments.push({...f.prComments[0], id: 104});
  await assert.rejects(f.verify(), /CHAT_RESULT_POLL_RETURN_MULTIPLE_RECEIPTS_STOP/);
});

test('invalid source receipt, wrong target PR, or incomplete inventory fail closed', async () => {
  const f = await fixture();
  f.issueComments[0].user.login = 'attacker';
  await assert.rejects(f.verify(), /SOURCE_RECEIPT_STOP/);
  f.issueComments[0].user.login = 'github-actions[bot]';
  assert.equal((await f.verify({binding: {...f.binding, pullRequestNumber: 992}})).state,
    'CHAT_RESULT_POLL_RETURN_NOT_FOUND');
  await assert.rejects(f.verify({readPrComments: async b =>
    ({...await f.readPrComments(b), complete: false})}), /INVENTORY_INCOMPLETE/);
  await assert.rejects(f.verify({readResultIssueComments: async i =>
    ({...await f.readResultIssueComments(i), comments: Array(401).fill(f.issueComments[0])})}),
  /INVENTORY_INCOMPLETE/);
});

test('failed GitHub Actions, altered origin and wrong account binding are rejected', async () => {
  const f = await fixture();
  await assert.rejects(f.verify({run: {...f.base.run, conclusion: 'failure'}}),
    /RESULT_TEST_RUN_PROVENANCE_STOP/);
  await assert.rejects(f.verify({binding: {...f.binding, targetChatId: 'chat-process-owner'}}),
    /INPUT_INVALID/);
  await assert.rejects(f.verify({allowedAckActorLogin: 'github-actions[bot]'}),
    /NOT_APPROVED/);
});
