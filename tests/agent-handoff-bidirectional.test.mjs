import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHandoffQueue, initializeHandoffQueueSchema} from '../agent-handoff/sqlite-queue.mjs';
import {routeHandoffQueueMetadata} from '../agent-handoff/queue-bridge.mjs';
import {parseHandoff} from '../agent-handoff/contract.mjs';
import {parseAgentResult, resultDigest} from '../agent-handoff/result-contract.mjs';
import {recordPrResultReturn} from '../agent-handoff/pr-result-return.mjs';

test('metadata-only error PR and result PR are routed to distinct configured chats', async () => {
  const repo = 'ansqhd5774-Choi/zgmini-pc-control';
  const db = new DatabaseSync(':memory:');
  initializeHandoffQueueSchema(db);
  const queue = createHandoffQueue(db);
  const handoff = parseHandoff(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_V1',
    incidentId: 'handoff-123456789abc',
    origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009,
      requestId: 'pc-123456789abc', chatId: 'chat-origin', branch: 'codex/theme',
      sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
    failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP',
      lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}}));
  const queueIssueNumber = 2001;
  const issueComments = [];
  const ownerPrComments = [];
  const originPrComments = [];
  const ownerBinding = {enabled: true, repository: repo, pullRequestNumber: 991,
    targetChatId: 'chat-process-owner', targetRole: 'COMMON_PROCESS_OWNER'};
  const originBinding = {enabled: true, repository: repo, pullRequestNumber: 992,
    targetChatId: 'chat-origin'};
  const asBot = (id, body) => ({id, user: {login: 'github-actions[bot]'}, body});
  try {
    const first = await routeHandoffQueueMetadata({queue, body: JSON.stringify(handoff),
      issueNumber: queueIssueNumber, prWakeBinding: ownerBinding,
      readComments: async () => [...issueComments],
      postComment: async (_issue, body) => {issueComments.push(asBot(101, body));},
      readPrComments: async target => ({complete: true, repository: repo,
        pullRequestNumber: target.pullRequestNumber, comments: [...ownerPrComments]}),
      postPrComment: async (_target, body) => {ownerPrComments.push(asBot(201, body));}});
    assert.equal(first.state, 'ROUTED_PENDING_AGENT');
    assert.equal(first.prEvent.pullRequestNumber, 991);
    assert.equal(first.prEvent.actualChatResumeVerified, false);

    const result = parseAgentResult(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_RESULT_V1',
      resultId: 'result-123456789abc', incidentId: handoff.incidentId,
      fingerprint: first.fingerprint,
      pullRequest: {repository: repo, number: 920, headSha: 'b'.repeat(40)},
      testRun: {repository: repo, runId: 42450377234, headSha: 'b'.repeat(40)}}));
    issueComments.push(asBot(102, ['HANDOFF_RESULT_RECORDED',
      `resultId: ${result.resultId}`, `digest: ${resultDigest(result)}`,
      `incidentId: ${result.incidentId}`, `fingerprint: ${result.fingerprint}`,
      'state: RUNTIME_VERIFICATION_PENDING'].join('\n')));
    const pr = {number: 920, head: {sha: 'b'.repeat(40), repo: {full_name: repo}},
      base: {repo: {full_name: repo}}, state: 'open'};
    const run = {id: 42450377234, head_sha: 'b'.repeat(40), status: 'completed',
      conclusion: 'success', repository: {full_name: repo}};
    const returned = await recordPrResultReturn({handoffBody: handoff, resultBody: result,
      pr, run, queueIssueNumber, binding: originBinding,
      readResultIssueComments: async issue => ({complete: true, repository: repo,
        issueNumber: issue, comments: [...issueComments]}),
      readPrComments: async target => ({complete: true, repository: repo,
        pullRequestNumber: target.pullRequestNumber, comments: [...originPrComments]}),
      postPrComment: async (_target, body) => {originPrComments.push(asBot(301, body));}});
    assert.equal(returned.pullRequestNumber, 992);
    assert.equal(returned.verifiedState, 'RUNTIME_VERIFICATION_PENDING');
    assert.equal(returned.actualChatResumeVerified, false);
    assert.equal(queue.stats().ROUTED_PENDING_AGENT, 1);
    assert.equal(ownerPrComments.length, 1);
    assert.equal(originPrComments.length, 1);
    assert.equal(returned.automaticPcRetries, 0);
  } finally {db.close();}
});
