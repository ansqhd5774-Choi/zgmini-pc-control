import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {initializeHandoffQueueSchema, createHandoffQueue} from '../agent-handoff/sqlite-queue.mjs';
import {routeHandoffQueueMetadata} from '../agent-handoff/queue-bridge.mjs';
import {main as issueBroker} from '../agent-handoff/issue-broker.mjs';

const incident = (sha = 'a'.repeat(40)) => ({
  schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
  origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009,
    requestId: 'pc-123456789abc', chatId: 'chat-theme1', branch: 'codex/theme',
    sourceSha: sha, checkpoint: 'COLLECT'},
  failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP',
    lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}
});

function harness() {
  const db = new DatabaseSync(':memory:');
  initializeHandoffQueueSchema(db);
  const queue = createHandoffQueue(db);
  const posted = [];
  const comments = [];
  const args = {queue, body: JSON.stringify(incident()), issueNumber: 2001,
    readComments: async () => comments,
    postComment: async (issue, body) => {
      posted.push({issue, body});
      comments.push({id: 101, user: {login: 'github-actions[bot]'}, body});
    }};
  return {db, queue, args, posted, comments};
}

test('queue bridge records an actual read-back comment once and never starts an agent', async () => {
  const {db, queue, args, posted, comments} = harness();
  try {
    const first = await routeHandoffQueueMetadata(args);
    assert.equal(first.state, 'ROUTED_PENDING_AGENT');
    assert.equal(first.commentId, 101);
    assert.equal(first.newDispatches, 0);
    assert.equal(first.automaticPcRetries, 0);
    assert.equal(first.operationalWrites, 0);
    assert.equal(comments.length, 1);
    const again = await routeHandoffQueueMetadata(args);
    assert.equal(again.state, 'ROUTED_PENDING_AGENT');
    assert.equal(again.commentId, 101);
    assert.equal(posted.length, 1);
    assert.equal(queue.read(first.fingerprint).status, 'ROUTED_PENDING_AGENT');
  } finally {db.close();}
});

test('lost GitHub POST response is recovered through a verified comment readback', async () => {
  const {db, queue, args, posted, comments} = harness();
  args.postComment = async (issue, body) => {
    posted.push({issue, body});
    comments.push({id: 202, user: {login: 'github-actions[bot]'}, body});
    throw new Error('GITHUB_POST_RESPONSE_LOST');
  };
  try {
    const result = await routeHandoffQueueMetadata(args);
    assert.equal(result.commentId, 202);
    assert.equal(queue.read(result.fingerprint).status, 'ROUTED_PENDING_AGENT');
    assert.equal(posted.length, 1);
  } finally {db.close();}
});

test('no verified comment means no routed success and no automatic replay', async () => {
  const {db, queue, args, posted} = harness();
  args.postComment = async (issue, body) => {posted.push({issue, body});};
  try {
    await assert.rejects(routeHandoffQueueMetadata(args), /COMMENT_READBACK_STOP/);
    const row = queue.stats();
    assert.equal(row.CLAIMED, 1);
    const again = await routeHandoffQueueMetadata(args);
    assert.equal(again.state, 'CLAIMED');
    assert.equal(posted.length, 1);
  } finally {db.close();}
});

test('spoofed or incomplete comment inventory cannot prove delivery', async () => {
  const {db, queue, args, comments} = harness();
  args.postComment = async (issue, body) => {
    comments.push({id: 1, user: {login: 'unknown-user'}, body});
  };
  try {
    await assert.rejects(routeHandoffQueueMetadata(args), /COMMENT_READBACK_STOP/);
    assert.equal(queue.stats().CLAIMED, 1);
    assert.equal(queue.stats().ROUTED_PENDING_AGENT, 0);
  } finally {db.close();}
});

test('fingerprint-specific claim cannot steal another pending conversation', async () => {
  const {db, queue, args} = harness();
  try {
    const other = queue.enqueue(incident('b'.repeat(40)));
    const current = await routeHandoffQueueMetadata(args);
    assert.equal(queue.read(current.fingerprint).status, 'ROUTED_PENDING_AGENT');
    assert.equal(queue.read(other.fingerprint).status, 'PENDING');
  } finally {db.close();}
});

test('duplicate intake from another Issue is not misreported as a delivered comment', async () => {
  const {db, queue, args, posted} = harness();
  try {
    const first = await routeHandoffQueueMetadata(args);
    const duplicate = incident();
    duplicate.incidentId = 'handoff-abcdef012345';
    const result = await routeHandoffQueueMetadata({...args, issueNumber: 2002,
      body: JSON.stringify(duplicate), readComments: async () => []});
    assert.equal(result.fingerprint, first.fingerprint);
    assert.equal(result.state, 'DUPLICATE_REUSED_NO_CURRENT_ISSUE_RECEIPT');
    assert.equal(result.commentId, null);
    assert.equal(posted.length, 1);
    assert.equal(queue.stats().total, 1);
  } finally {db.close();}
});

test('opt-in PR wake event is recorded only after the Issue receipt is verified', async () => {
  const {db, args, comments} = harness();
  const prComments = [];
  const prWakeBinding = {enabled: true, repository: 'ansqhd5774-Choi/zgmini-pc-control',
    pullRequestNumber: 934, targetChatId: 'chat-process-owner', targetRole: 'COMMON_PROCESS_OWNER'};
  const withPr = {...args, prWakeBinding,
    readPrComments: async target => ({repository: target.repository,
      pullRequestNumber: target.pullRequestNumber, complete: true, comments: [...prComments]}),
    postPrComment: async (_target, body) => {
      assert.equal(comments.length, 1, 'Issue readback must precede PR posting');
      prComments.push({id: 301, user: {login: 'github-actions[bot]'}, body});
    }};
  try {
    const first = await routeHandoffQueueMetadata(withPr);
    assert.equal(first.prEvent.commentId, 301);
    assert.equal(first.prEvent.actualChatResumeVerified, false);
    assert.equal(first.newDispatches, 0);
    const again = await routeHandoffQueueMetadata(withPr);
    assert.equal(again.prEvent.posted, false);
    assert.equal(prComments.length, 1);
  } finally {db.close();}
});

test('uncertain PR delivery can be recovered without repeating Issue or PC actions', async () => {
  const {db, queue, args, posted} = harness();
  let completed = false;
  const prComments = [];
  const withPr = {...args, prWakeBinding: {enabled: true,
    repository: 'ansqhd5774-Choi/zgmini-pc-control', pullRequestNumber: 934,
    targetChatId: 'chat-process-owner', targetRole: 'COMMON_PROCESS_OWNER'},
    readPrComments: async target => ({repository: target.repository,
      pullRequestNumber: target.pullRequestNumber, complete: true, comments: [...prComments]}),
    postPrComment: async (_target, body) => {
      if (completed) prComments.push({id: 301, user: {login: 'github-actions[bot]'}, body});
    }};
  try {
    await assert.rejects(routeHandoffQueueMetadata(withPr), /CHAT_PR_WAKE_READBACK_STOP/);
    assert.equal(queue.stats().ROUTED_PENDING_AGENT, 1);
    completed = true;
    const recovered = await routeHandoffQueueMetadata(withPr);
    assert.equal(recovered.prEvent.commentId, 301);
    assert.equal(posted.length, 1, 'the Issue handoff must not be posted twice');
    assert.equal(recovered.automaticPcRetries, 0);
  } finally {db.close();}
});

test('invalid event parameters are rejected before queue writes', async () => {
  const {db, queue, args} = harness();
  try {
    await assert.rejects(routeHandoffQueueMetadata({...args, issueNumber: 0}), /BRIDGE_IO_INVALID/);
    assert.equal(queue.stats().total, 0);
  } finally {db.close();}
});

test('original Issue broker accepts opt-in injected queue and reads back GitHub comment', async () => {
  const {db, queue} = harness();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-queue-bridge-'));
  const eventPath = path.join(dir, 'event.json');
  const previousToken = process.env.GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  const comments = [];
  const prComments = [];
  const labels = [];
  const posted = [];
  const repository = 'ansqhd5774-Choi/zgmini-pc-control';
  fs.writeFileSync(eventPath, JSON.stringify({action: 'opened', repository: {private: true},
    issue: {number: 2001, user: {login: 'ansqhd5774-Choi'},
      labels: [{name: 'agent-handoff'}], body: JSON.stringify(incident())}}));
  process.env.GITHUB_TOKEN = 'test-only-no-secret';
  globalThis.fetch = async (url, request = {}) => {
    const method = request.method ?? 'GET';
    const uri = new URL(url);
    let data;
    if (uri.pathname.endsWith('/issues/2001/comments') && method === 'GET') data = comments;
    else if (uri.pathname.endsWith('/issues/2001/comments') && method === 'POST') {
      posted.push('comment');
      comments.push({id: 201, user: {login: 'github-actions[bot]'},
        body: JSON.parse(request.body).body});
      data = {id: 201};
    } else if (uri.pathname.endsWith('/issues/934/comments') && method === 'GET') {
      data = prComments;
    } else if (uri.pathname.endsWith('/issues/934/comments') && method === 'POST') {
      assert.equal(comments.length, 1, 'Issue receipt must be read before PR delivery');
      posted.push('pr-comment');
      prComments.push({id: 301, user: {login: 'github-actions[bot]'},
        body: JSON.parse(request.body).body});
      data = {id: 301};
    } else if (uri.pathname.endsWith('/issues/2001') && method === 'GET') {
      data = {labels: labels.map((name) => ({name}))};
    } else if (uri.pathname.endsWith('/issues/2001/labels') && method === 'POST') {
      posted.push('label'); labels.push(...JSON.parse(request.body).labels); data = {labels};
    } else throw new Error(`unexpected ${method} ${uri.pathname}`);
    return {ok: true, status: 200, json: async () => data};
  };
  const env = {GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: repository,
    GITHUB_ACTOR: 'ansqhd5774-Choi', GITHUB_EVENT_NAME: 'issues'};
  const prWakeBinding = {enabled: true, repository, pullRequestNumber: 934,
    targetChatId: 'chat-process-owner', targetRole: 'COMMON_PROCESS_OWNER'};
  try {
    const first = await issueBroker(env, {queue, prWakeBinding});
    assert.equal(first.state, 'ROUTED_PENDING_AGENT');
    assert.equal(first.commentId, 201);
    assert.equal(first.prEvent.commentId, 301);
    assert.equal(first.prEvent.actualChatResumeVerified, false);
    const again = await issueBroker(env, {queue, prWakeBinding});
    assert.equal(again.state, 'ROUTED_PENDING_AGENT');
    assert.equal(again.prEvent.posted, false);
    assert.deepEqual(posted, ['comment', 'pr-comment', 'label']);
    assert.equal(prComments.length, 1);
    assert.equal(queue.stats().ROUTED_PENDING_AGENT, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
    db.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('original Issue broker rejects PR delivery without an explicitly injected queue', async () => {
  await assert.rejects(issueBroker({}, {prWakeBinding: {enabled: true}}),
    /HANDOFF_PR_WAKE_QUEUE_REQUIRED/);
});
