import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHandoff, fingerprintHandoff} from '../agent-handoff/contract.mjs';
import {parseAgentResult, resultDigest} from '../agent-handoff/result-contract.mjs';
import {recordPrResultReturn, CHAT_RESULT_RETURN_MARKER} from '../agent-handoff/pr-result-return.mjs';

function setup() {
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
  const input = {handoffBody: handoff, resultBody: result, pr, run,
    queueIssueNumber: 2001, binding,
    readResultIssueComments: async issueNumber => ({complete: true,
      repository: 'ansqhd5774-Choi/zgmini-pc-control', issueNumber,
      comments: [...issueComments]}),
    readPrComments: async target => ({complete: true, repository: target.repository,
      pullRequestNumber: target.pullRequestNumber, comments: [...prComments]}),
    postPrComment: async (_target, body) => {
      prComments.push({id: prComments.length + 101, user: {login: 'github-actions[bot]'}, body});
    }};
  return {input, issueComments, prComments};
}

test('returns only a verified result marker to original chat PR; no runtime/AI claim', async () => {
  const {input, prComments} = setup();
  const first = await recordPrResultReturn(input);
  assert.equal(first.state, 'RESULT_PR_EVENT_RECORDED_CHAT_ACK_UNKNOWN');
  assert.equal(first.verifiedState, 'RUNTIME_VERIFICATION_PENDING');
  assert.equal(first.actualChatResumeVerified, false);
  assert.equal(first.operationalWrites, 0);
  assert.equal(first.automaticPcRetries, 0);
  assert.equal(prComments[0].body.split('\n')[0], CHAT_RESULT_RETURN_MARKER);
  assert.equal(prComments[0].body.includes('PR_HEAD_SHA'), false);
  const again = await recordPrResultReturn(input);
  assert.equal(again.posted, false);
  assert.equal(again.prCommentId, first.prCommentId);
  assert.equal(prComments.length, 1);
});

test('result Issue comment is required before posting any PR return event', async () => {
  const {input, issueComments, prComments} = setup();
  issueComments.length = 0;
  await assert.rejects(recordPrResultReturn(input), /SOURCE_RECEIPT_STOP/);
  assert.equal(prComments.length, 0);
});

test('wrong PR or failed GitHub Actions run cannot produce a return event', async () => {
  const {input, prComments} = setup();
  await assert.rejects(recordPrResultReturn({...input,
    run: {...input.run, conclusion: 'failure'}}), /RESULT_TEST_RUN_PROVENANCE_STOP/);
  await assert.rejects(recordPrResultReturn({...input,
    pr: {...input.pr, number: 921}}), /RESULT_PR_PROVENANCE_STOP/);
  assert.equal(prComments.length, 0);
});

test('return target must match original chat, never the process-owner chat', async () => {
  const {input, prComments} = setup();
  await assert.rejects(recordPrResultReturn({...input,
    binding: {...input.binding, targetChatId: 'chat-process-owner'}}), /BINDING_NOT_APPROVED/);
  assert.equal(prComments.length, 0);
});

test('spoofed or incomplete result-source inventory cannot prove delivery', async () => {
  const {input, issueComments, prComments} = setup();
  issueComments[0].user.login = 'attacker';
  await assert.rejects(recordPrResultReturn(input), /SOURCE_RECEIPT_STOP/);
  issueComments[0].user.login = 'github-actions[bot]';
  const badInventory = async issueNumber => ({complete: false,
    repository: 'ansqhd5774-Choi/zgmini-pc-control', issueNumber, comments: issueComments});
  await assert.rejects(recordPrResultReturn({...input, readResultIssueComments: badInventory}),
    /INVENTORY_INCOMPLETE/);
  assert.equal(prComments.length, 0);
});

test('lost PR POST response can be recovered through the original-chat PR readback', async () => {
  const {input, prComments} = setup();
  const result = await recordPrResultReturn({...input,
    postPrComment: async (target, body) => {
      await input.postPrComment(target, body);
      throw new Error('network response lost');
    }});
  assert.equal(result.prCommentId, 101);
  assert.equal(prComments.length, 1);
});

test('PR return absent after POST is not mistaken for ChatGPT resumption', async () => {
  const {input} = setup();
  await assert.rejects(recordPrResultReturn({...input, postPrComment: async () => {}}),
    /PR_READBACK_STOP/);
});
