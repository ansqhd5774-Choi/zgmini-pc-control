import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseHandoff, fingerprintHandoff} from '../agent-handoff/contract.mjs';
import {parseAgentResult, resultDigest, verifyAgentResult} from '../agent-handoff/result-contract.mjs';
import {main as runResultBroker, assertWorkflowResultRepository} from '../agent-handoff/result-broker.mjs';
import {centralResultReceipt, originResultReceipt} from '../agent-handoff/result-receipts.mjs';

function setup() {
  const handoff = parseHandoff(JSON.stringify({schema: 'ZGMINI_AGENT_HANDOFF_V1', incidentId: 'handoff-123456789abc',
    origin: {repository: 'ansqhd5774-Choi/zgmini', issueNumber: 1009, requestId: 'pc-123456789abc',
      chatId: 'chat-theme1', branch: 'codex/theme', sourceSha: 'a'.repeat(40), checkpoint: 'COLLECT'},
    failure: {kind: 'COMMON_CONTROLLER', code: 'RUNNER_IMPORT_STOP', lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', fileRefs: []}}));
  const result = {schema: 'ZGMINI_AGENT_HANDOFF_RESULT_V1', resultId: 'result-123456789abc',
    incidentId: handoff.incidentId, fingerprint: fingerprintHandoff(handoff),
    pullRequest: {repository: 'ansqhd5774-Choi/zgmini-pc-control', number: 920, headSha: 'b'.repeat(40)},
    testRun: {repository: 'ansqhd5774-Choi/zgmini-pc-control', runId: 42450377234, headSha: 'b'.repeat(40)}};
  const pr = {number: 920, head: {sha: 'b'.repeat(40), repo: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}},
    base: {repo: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}}, state: 'open'};
  const run = {id: 42450377234, head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success',
    event: 'pull_request', name: 'ZGMINI Agent Handoff PR Evidence CI',
    repository: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'}};
  return {handoff, result, pr, run};
}

test('provenance may establish reviewed evidence, never runtime or owner session success', () => {
  const {handoff, result, pr, run} = setup();
  assert.deepEqual(verifyAgentResult(handoff, parseAgentResult(JSON.stringify(result)), pr, run),
    {state: 'RUNTIME_VERIFICATION_PENDING', ownerAcknowledged: false,
      confirmed: ['PR_HEAD_SHA', 'GITHUB_ACTION_CONCLUSION'], operationalWrites: 0});
});
test('rejects additional raw content, URL and secret fields', () => {
  const {result} = setup();
  for (const field of ['token', 'rawError', 'url']) {
    const input = structuredClone(result); input[field] = 'not permitted';
    assert.throws(() => parseAgentResult(JSON.stringify(input)), /RESULT_FIELDS_INVALID/);
  }
});
test('rejects mismatched handoff origin and fingerprint', () => {
  const {handoff, result, pr, run} = setup();
  const bad = structuredClone(result); bad.fingerprint = '0'.repeat(64);
  assert.throws(() => verifyAgentResult(handoff, bad, pr, run), /RESULT_ORIGIN_MISMATCH_STOP/);
});
test('rejects PR substitution or wrong repository', () => {
  const {handoff, result, pr, run} = setup();
  const bad = structuredClone(pr); bad.head.sha = 'c'.repeat(40);
  assert.throws(() => verifyAgentResult(handoff, result, bad, run), /RESULT_PR_PROVENANCE_STOP/);
  const wrong = structuredClone(result); wrong.pullRequest.repository = 'ansqhd5774-Choi/zgmini';
  assert.throws(() => verifyAgentResult(handoff, wrong, pr, run), /RESULT_OWNER_REPOSITORY_STOP/);
});
test('workflow accepts only same-repo result evidence from control or public feature repository', () => {
  const {result} = setup();
  assert.doesNotThrow(() => assertWorkflowResultRepository(result));
  const otherRepo = structuredClone(result);
  otherRepo.pullRequest.repository = 'ansqhd5774-Choi/zgmini';
  otherRepo.testRun.repository = 'ansqhd5774-Choi/zgmini';
  assert.doesNotThrow(() => assertWorkflowResultRepository(otherRepo));
  const mixed = structuredClone(otherRepo);
  mixed.testRun.repository = 'ansqhd5774-Choi/zgmini-pc-control';
  assert.throws(() => assertWorkflowResultRepository(mixed), /RESULT_CROSS_REPO_AUTH_NOT_CONFIGURED/);
  const foreign = structuredClone(otherRepo);
  foreign.pullRequest.repository = 'third-party/unknown';
  foreign.testRun.repository = 'third-party/unknown';
  assert.throws(() => assertWorkflowResultRepository(foreign), /RESULT_CROSS_REPO_AUTH_NOT_CONFIGURED/);
});
test('rejects failed or different-SHA GitHub run', () => {
  const {handoff, result, pr, run} = setup();
  const failed = structuredClone(run); failed.conclusion = 'failure';
  assert.throws(() => verifyAgentResult(handoff, result, pr, failed), /RESULT_TEST_RUN_PROVENANCE_STOP/);
  const mismatched = structuredClone(run); mismatched.head_sha = 'c'.repeat(40);
  assert.throws(() => verifyAgentResult(handoff, result, pr, mismatched), /RESULT_TEST_RUN_PROVENANCE_STOP/);
});

test('control repo repair result rejects unrelated successful PR workflows at the same SHA', () => {
  const {handoff,result,pr,run}=setup();
  for(const name of ['C996 R5 Readonly Source Checks','Unrelated Workflow']){
    const unrelated={...run,name};
    assert.throws(()=>verifyAgentResult(handoff,result,pr,unrelated),
      /RESULT_TEST_WORKFLOW_NOT_AUTHORIZED/);
  }
});

test('a successful non-PR workflow with matching SHA is not a repair CI', () => {
  const {handoff,result,pr,run}=setup();
  for(const event of ['push','issues','workflow_dispatch']){
    assert.throws(()=>verifyAgentResult(handoff,result,pr,{...run,event}),
      /RESULT_TEST_WORKFLOW_NOT_AUTHORIZED/);
  }
});

test('the approved control PR CI remains acceptable by its actual workflow name', () => {
  const {handoff,result,pr,run}=setup();
  assert.equal(verifyAgentResult(handoff,result,pr,run).state,
    'RUNTIME_VERIFICATION_PENDING');
});

test('rejects oversized results and malformed IDs', () => {
  const {result} = setup();
  assert.throws(() => parseAgentResult('x'.repeat(4097)), /RESULT_BODY_SIZE_STOP/);
  const invalid = structuredClone(result); invalid.resultId = 'bad';
  assert.throws(() => parseAgentResult(JSON.stringify(invalid)), /RESULT_ID_INVALID/);
});
test('result digest fixes exact result payload for collision detection', () => {
  const {result} = setup();
  const changed = structuredClone(result); changed.testRun.runId += 1;
  assert.notEqual(resultDigest(parseAgentResult(JSON.stringify(result))), resultDigest(parseAgentResult(JSON.stringify(changed))));
});

async function simulate({lostComment = false, collision = false, unauthorized = false,
  botOrigin = false, botBadTitle = false, botForeignOrigin = false,
  botMissingEvidence = false, untrustedIssueAuthor = false,
  invalidOriginalAuthor = false, wrongOriginalRequest = false,
  originPostFailsOnce = false, writerOrigin = false, wrongWriterSource = false,
  centralAckLost = false, originAckLost = false, partialCentral = false,
  partialOrigin = false, priorCentralResult = false, priorOriginResult = false} = {}) {
  let {handoff, result, pr, run} = setup();
  if (botOrigin) {
    const candidate = structuredClone(handoff);
    candidate.origin.repository = botForeignOrigin ? 'ansqhd5774-Choi/zgmini' :
      'ansqhd5774-Choi/zgmini-pc-control';
    if (!botMissingEvidence) candidate.failure.evidenceIssueNumber = candidate.origin.issueNumber;
    if (writerOrigin) {
      candidate.failure.kind = 'COMMON_WRITER';
      candidate.failure.code = 'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP';
      candidate.origin.branch = 'main';
    }
    handoff = parseHandoff(JSON.stringify(candidate));
    result.fingerprint = fingerprintHandoff(handoff);
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-handoff-result-'));
  const eventPath = path.join(temp, 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify({action: 'created', repository: {private: true},
    issue: {number: 2001, title: botBadTitle ? 'incorrect title' :
      `agent-handoff ${handoff.incidentId}`, labels: [{name: 'agent-handoff'}],
      user: {login: untrustedIssueAuthor ? 'untrusted-user' :
        botOrigin ? 'github-actions[bot]' : 'ansqhd5774-Choi'},
      body: JSON.stringify(handoff)}, comment: {body: JSON.stringify(result), user: {login: 'ansqhd5774-Choi'}}}));
  const originalToken = process.env.GITHUB_TOKEN;
  const originalFetch = globalThis.fetch;
  const seen = [];
  const commentIssueUrl = 'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/2001';
  const originIssueUrl = 'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/1009';
  const comments = collision ? [{user: {login: 'github-actions[bot]'},
    issue_url: commentIssueUrl,
    body: `HANDOFF_RESULT_RECORDED\nresultId: ${result.resultId}\ndigest: ${'0'.repeat(64)}`}] :
    partialCentral ? [{user:{login:'github-actions[bot]'},issue_url:commentIssueUrl,
      body:`HANDOFF_RESULT_RECORDED\nresultId: ${result.resultId}\ndigest: ${resultDigest(result)}`}] : [];
  if (priorCentralResult) {
    const prior = {...result, resultId:'result-earlier-repair-0001'};
    const body = centralResultReceipt(handoff,prior,resultDigest(prior),
      'ansqhd5774-Choi/zgmini-pc-control',{state:'RUNTIME_VERIFICATION_PENDING'});
    comments.push({user:{login:'github-actions[bot]'},
      issue_url:commentIssueUrl,body});
  }
  const originComments = writerOrigin ? [{user: {login: 'github-actions[bot]'},
    issue_url: 'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/1009',
    body: [`<!-- zgmini-writer-b-install:${handoff.origin.requestId} -->`,
      `Writer B evidence: **WRITER_B_PREFLIGHT_STOP** (${handoff.failure.code})`,
      'DELIVERY: RESULT_PAIR_READBACK_VERIFIED',
      'RESULT_CREATED: 2/2; RESULT_READBACK: 2/2',
      'RUN_ID: 42570000003; RETRY: NO_REEXECUTE'].join('\n')}] : [];
  if (priorOriginResult) {
    const prior = {...result, resultId:'result-earlier-repair-0001'};
    const body = originResultReceipt(prior,resultDigest(prior),
      'ansqhd5774-Choi/zgmini-pc-control',{state:'RUNTIME_VERIFICATION_PENDING'},2001);
    originComments.push({user:{login:'github-actions[bot]'},
      issue_url:originIssueUrl,body});
  }
  if (partialOrigin) originComments.push({user:{login:'github-actions[bot]'},
    issue_url:originIssueUrl,
    body:`HANDOFF_ORIGIN_RESULT_RECORDED\nresultId: ${result.resultId}\ndigest: ${resultDigest(result)}\nincidentId: ${result.incidentId}\nhandoffIssue: 2001`});
  const originalIssue = {number: 1009,
    user: {login: invalidOriginalAuthor ? 'untrusted-user' : 'ansqhd5774-Choi'},
    title: writerOrigin ? 'pc-writer-source-install' : 'pc-job',
    labels: [{name: writerOrigin ? 'pc-writer-b-install' : 'pc-job'}],
    body: JSON.stringify(writerOrigin ? {schema: 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
      operation: 'pc-writer-source-install', controlRepository: 'ansqhd5774-Choi/zgmini-pc-control',
      requestId: wrongOriginalRequest ? 'pc-wrong-original-request' : handoff.origin.requestId,
      chatId: handoff.origin.chatId} : {schema: 'ZGMINI_PC_JOB_V1',
      requestId: wrongOriginalRequest ? 'pc-wrong-original-request' : handoff.origin.requestId,
      chatId: handoff.origin.chatId, sourceSha: handoff.origin.sourceSha,
      sourceBranch: handoff.origin.branch, sourceRepository: 'ansqhd5774-Choi/zgmini'})};
  let failOriginalPost = originPostFailsOnce;
  process.env.GITHUB_TOKEN = 'unit-test-nonsecret';
  globalThis.fetch = async (url, request = {}) => {
    const uri = new URL(url);
    const method = request.method ?? 'GET';
    let value;
    if (uri.pathname.endsWith('/issues/2001/comments') && method === 'GET') value = comments;
    else if (uri.pathname.endsWith('/issues/2001/comments') && method === 'POST') {
      seen.push('comment');
      if (!lostComment) comments.push({user: {login: 'github-actions[bot]'},
        issue_url: commentIssueUrl, body: JSON.parse(request.body).body});
      if (centralAckLost) return {ok:false,status:503};
      value = {id: 1};
    } else if (uri.pathname.endsWith('/pulls/920')) value = pr;
    else if (uri.pathname.endsWith('/actions/runs/42450377234')) value = run;
    else if (uri.pathname.endsWith('/actions/runs/42570000003')) value = {id: 42570000003,
      name: 'ZGMINI Approved Writer B Source Overlay Once',
      head_sha: wrongWriterSource ? 'c'.repeat(40) : handoff.origin.sourceSha,
      head_branch: 'main', event: 'issues', actor: {login: 'ansqhd5774-Choi'},
      repository: {full_name: 'ansqhd5774-Choi/zgmini-pc-control'},
      run_attempt: 1, status: 'completed'};
    else if (uri.pathname.endsWith('/issues/1009') && method === 'GET') value = originalIssue;
    else if (uri.pathname.endsWith('/issues/1009/comments') && method === 'GET') value = originComments;
    else if (uri.pathname.endsWith('/issues/1009/comments') && method === 'POST') {
      seen.push('origin-comment');
      if (failOriginalPost) {
        failOriginalPost = false;
        return {ok: false, status: 503};
      }
      originComments.push({user: {login: 'github-actions[bot]'},
        issue_url: originIssueUrl, body: JSON.parse(request.body).body});
      if (originAckLost) return {ok:false,status:503};
      value = {id: 2};
    }
    else throw new Error(`unexpected GitHub API ${uri.pathname}`);
    return {ok: true, status: 200, json: async () => value};
  };
  const env = {GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: 'ansqhd5774-Choi/zgmini-pc-control',
    GITHUB_EVENT_NAME: 'issue_comment', GITHUB_ACTOR: unauthorized ? 'unknown-user' : 'ansqhd5774-Choi'};
  try {
    if (unauthorized) await assert.rejects(runResultBroker(env), /RESULT_EVENT_NOT_ALLOWED/);
    else if (untrustedIssueAuthor) await assert.rejects(runResultBroker(env), /RESULT_EVENT_NOT_ALLOWED/);
    else if (botBadTitle || botForeignOrigin || botMissingEvidence)
      await assert.rejects(runResultBroker(env), /RESULT_BOT_INCIDENT_BINDING_STOP/);
    else if (collision) await assert.rejects(runResultBroker(env), /RESULT_ID_COLLISION_STOP/);
    else if (priorCentralResult) {
      await assert.rejects(runResultBroker(env), /RESULT_INCIDENT_ALREADY_RECORDED_STOP/);
      assert.deepEqual(seen, []);
      assert.equal(comments.length,1);
    } else if (priorOriginResult) {
      await assert.rejects(runResultBroker(env), /RESULT_ORIGIN_ALREADY_RETURNED_STOP/);
      assert.deepEqual(seen, ['comment']);
      assert.equal(originComments.length,1);
    } else if (lostComment) await assert.rejects(runResultBroker(env), /RESULT_COMMENT_READBACK_STOP/);
    else if (invalidOriginalAuthor || wrongOriginalRequest) {
      await assert.rejects(runResultBroker(env),
        /RESULT_ORIGIN_ISSUE_NOT_AUTHORIZED|RESULT_ORIGIN_REQUEST_BINDING_STOP/);
    } else if (originPostFailsOnce) {
      await assert.rejects(runResultBroker(env), /RESULT_ORIGIN_POST_OUTCOME_UNKNOWN/);
      await runResultBroker(env);
      await runResultBroker(env);
      assert.deepEqual(seen, ['comment', 'origin-comment', 'origin-comment']);
      assert.equal(comments.length, 1);
      assert.equal(originComments.length, 1);
    } else if (partialCentral) {
      await assert.rejects(runResultBroker(env), /RESULT_RECEIPT_BINDING_STOP/);
      assert.deepEqual(seen, []);
    } else if (partialOrigin) {
      await assert.rejects(runResultBroker(env), /RESULT_ORIGIN_RECEIPT_BINDING_STOP/);
      assert.deepEqual(seen, ['comment']);
    } else if (wrongWriterSource) {
      await assert.rejects(runResultBroker(env), /RESULT_WRITER_SOURCE_PROVENANCE_STOP/);
      assert.deepEqual(seen, []);
    }
    else { await runResultBroker(env); await runResultBroker(env);
      assert.deepEqual(seen, botOrigin ? ['comment', 'origin-comment'] : ['comment']); }
    if (unauthorized || untrustedIssueAuthor || botBadTitle || botForeignOrigin ||
        botMissingEvidence || collision || invalidOriginalAuthor || wrongOriginalRequest)
      assert.deepEqual(seen, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    fs.rmSync(temp, {recursive: true, force: true});
  }
}
test('result broker records one verified comment and remains idempotent', async () => simulate());
test('result broker fails closed if GitHub result comment disappears', async () => simulate({lostComment: true}));
test('result broker blocks same ID with different payload', async () => simulate({collision: true}));
test('second repair resultId on the same incident cannot overwrite the first return',async()=>
  simulate({priorCentralResult:true}));
test('second repair resultId cannot write a competing return to the original Issue',async()=>
  simulate({botOrigin:true,priorOriginResult:true}));
test('result broker rejects untrusted issue comment actor', async () => simulate({unauthorized: true}));
test('result broker accepts a bound bot-created intake with an authenticated owner result',
  async () => simulate({botOrigin: true}));
test('result broker returns only to an owner-authenticated original Issue',
  async () => simulate({botOrigin: true, invalidOriginalAuthor: true}));
test('result broker prevents return to mismatched original request ID',
  async () => simulate({botOrigin: true, wrongOriginalRequest: true}));
test('result broker repairs a partial original return without duplicating central record',
  async () => simulate({botOrigin: true, originPostFailsOnce: true}));
test('central result POST response lost after persistence is reconciled without duplication',
  async()=>simulate({centralAckLost:true}));
test('original Issue result POST response lost after persistence is reconciled without duplication',
  async()=>simulate({botOrigin:true,originAckLost:true}));
test('result-id and digest alone cannot authenticate a partial central bot receipt',
  async()=>simulate({partialCentral:true}));
test('origin result-id and digest alone cannot authenticate a partial original bot receipt',
  async()=>simulate({botOrigin:true,partialOrigin:true}));
test('Writer B original result checks the authenticated completed control workflow source SHA',
  async () => simulate({botOrigin: true, writerOrigin: true}));
test('Writer B original result rejects wrong workflow SHA before any comment write',
  async () => simulate({botOrigin: true, writerOrigin: true, wrongWriterSource: true}));
test('result broker refuses a bot-created intake with a different title',
  async () => simulate({botOrigin: true, botBadTitle: true}));
test('result broker refuses a bot-created intake with a foreign origin',
  async () => simulate({botOrigin: true, botForeignOrigin: true}));
test('result broker refuses a bot-created intake without its origin evidence link',
  async () => simulate({botOrigin: true, botMissingEvidence: true}));
test('result broker still rejects a third-party Issue even with an owner comment',
  async () => simulate({untrustedIssueAuthor: true}));

async function simulatePublicFeature({invalidOriginal = false, wrongSource = false,
  wrongIdentity = false, wrongChat = false, wrongBranch = false,
  forkPr = false, wrongSha = false, publicDenied = false,
  publicMissing = false, publicTimeout = false, failedCi = false} = {}) {
  const seed = setup();
  const input = structuredClone(seed.handoff);
  input.origin.repository = 'ansqhd5774-Choi/zgmini-pc-control';
  input.failure.kind = 'FEATURE';
  input.failure.evidenceIssueNumber = 1009;
  const handoff = parseHandoff(JSON.stringify(input));
  const result = structuredClone(seed.result);
  result.fingerprint = fingerprintHandoff(handoff);
  result.pullRequest.repository = 'ansqhd5774-Choi/zgmini';
  result.testRun.repository = 'ansqhd5774-Choi/zgmini';
  const pr = structuredClone(seed.pr);
  pr.head.repo.full_name = 'ansqhd5774-Choi/zgmini';
  pr.base.repo.full_name = 'ansqhd5774-Choi/zgmini';
  if (forkPr) pr.head.repo.full_name = 'third-party/fork';
  const run = structuredClone(seed.run);
  run.repository.full_name = 'ansqhd5774-Choi/zgmini';
  run.name = 'Node.js CI';
  if (wrongSha) run.head_sha = 'c'.repeat(40);
  if (failedCi) run.conclusion = 'failure';
  const origin = {number: 1009, user: {login: invalidOriginal ? 'intruder' : 'ansqhd5774-Choi'},
    labels: [{name: 'pc-job'}], body: JSON.stringify({schema: 'ZGMINI_PC_JOB_V1',
      requestId: wrongIdentity ? 'pc-different-id' : handoff.origin.requestId,
      chatId: wrongChat ? 'chat-different' : handoff.origin.chatId,
      sourceSha: handoff.origin.sourceSha,
      sourceBranch: wrongBranch ? 'codex/other-branch' : handoff.origin.branch,
      sourceRepository: wrongSource ? 'ansqhd5774-Choi/zgmini-pc-control' : 'ansqhd5774-Choi/zgmini'})};
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-handoff-public-'));
  const eventPath = path.join(temp, 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify({action: 'created', repository: {private: true},
    issue: {number: 2001, title: `agent-handoff ${handoff.incidentId}`,
      labels: [{name: 'agent-handoff'}], user: {login: 'github-actions[bot]'},
      body: JSON.stringify(handoff)},
    comment: {body: JSON.stringify(result), user: {login: 'ansqhd5774-Choi'}}}));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'unit-test-nonsecret';
  const writes = [], publicHeaders = [], ledger = [], originLedger = [];
  globalThis.fetch = async (url, options = {}) => {
    const uri = new URL(url), method = options.method ?? 'GET';
    if (uri.pathname.startsWith('/repos/ansqhd5774-Choi/zgmini/')) {
      publicHeaders.push(options.headers);
      if (publicTimeout) throw new TypeError('simulated network timeout');
      if (publicDenied) return {ok: false, status: 403};
      if (publicMissing) return {ok: false, status: 404};
      if (uri.pathname.endsWith('/pulls/920')) return {ok: true, json: async () => pr};
      if (uri.pathname.endsWith('/actions/runs/42450377234')) return {ok: true, json: async () => run};
    }
    if (uri.pathname.endsWith('/issues/1009')) return {ok: true, json: async () => origin};
    if (uri.pathname.endsWith('/issues/1009/comments') && method === 'GET')
      return {ok: true, json: async () => originLedger};
    if (uri.pathname.endsWith('/issues/1009/comments') && method === 'POST') {
      originLedger.push({user: {login: 'github-actions[bot]'},
        issue_url:'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/1009',
        body: JSON.parse(options.body).body});
      return {ok: true, json: async () => ({id: 2})};
    }
    if (uri.pathname.endsWith('/issues/2001/comments') && method === 'GET')
      return {ok: true, json: async () => ledger};
    if (uri.pathname.endsWith('/issues/2001/comments') && method === 'POST') {
      writes.push(JSON.parse(options.body).body);
      ledger.push({user: {login: 'github-actions[bot]'},
        issue_url:'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/2001',
        body: writes.at(-1)});
      return {ok: true, json: async () => ({id: 1})};
    }
    throw new Error(`unexpected GitHub API ${uri.pathname}`);
  };
  const env = {GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: 'ansqhd5774-Choi/zgmini-pc-control',
    GITHUB_EVENT_NAME: 'issue_comment', GITHUB_ACTOR: 'ansqhd5774-Choi'};
  try {
    const bad = invalidOriginal || wrongSource || wrongIdentity || wrongChat ||
      wrongBranch || forkPr || wrongSha || publicDenied || publicMissing ||
      publicTimeout || failedCi;
    if (bad) await assert.rejects(runResultBroker(env),
      /RESULT_FEATURE_ORIGIN_NOT_AUTHORIZED|RESULT_FEATURE_ORIGIN_BINDING_STOP|RESULT_OWNER_REPOSITORY_STOP|RESULT_PR_PROVENANCE_STOP|RESULT_TEST_RUN_PROVENANCE_STOP|RESULT_PUBLIC_GITHUB_API_40[34]_STOP|simulated network timeout/);
    else { await runResultBroker(env); await runResultBroker(env); }
    assert.equal(writes.length, bad ? 0 : 1);
    assert.equal(originLedger.length, bad ? 0 : 1);
    for (const headers of publicHeaders) assert.equal(headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

test('verified PC Job feature source allows public feature PR/run and one idempotent private return',
  async () => simulatePublicFeature());
test('public return rejects untrusted original PC Job author without a GitHub write',
  async () => simulatePublicFeature({invalidOriginal: true}));
test('public return rejects a source-repository mismatch without a GitHub write',
  async () => simulatePublicFeature({wrongSource: true}));
test('public return rejects a changed original request ID without a GitHub write',
  async () => simulatePublicFeature({wrongIdentity: true}));
test('public return rejects an altered original chat ID without a GitHub write',
  async () => simulatePublicFeature({wrongChat: true}));
test('public return rejects an altered original branch without a GitHub write',
  async () => simulatePublicFeature({wrongBranch: true}));
test('public return rejects a fork PR without a GitHub write',
  async () => simulatePublicFeature({forkPr: true}));
test('public return rejects a different-SHA CI run without a GitHub write',
  async () => simulatePublicFeature({wrongSha: true}));
test('public return rejects failed CI without a GitHub write',
  async () => simulatePublicFeature({failedCi: true}));
test('public return stops on a public API denial without a GitHub write',
  async () => simulatePublicFeature({publicDenied: true}));
test('public return stops on a public API 404 without a GitHub write',
  async () => simulatePublicFeature({publicMissing: true}));
test('public return stops on a public API timeout without a GitHub write',
  async () => simulatePublicFeature({publicTimeout: true}));
