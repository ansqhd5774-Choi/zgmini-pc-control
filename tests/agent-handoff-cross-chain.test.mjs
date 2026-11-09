import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {processCompletedPcJob} from '../agent-handoff/pc-failure-producer.mjs';
import {processCompletedWriterB} from '../agent-handoff/writer-b-failure-producer.mjs';
import {parseHandoff, fingerprintHandoff} from '../agent-handoff/contract.mjs';
import {prepareHandoff} from '../agent-handoff/route.mjs';
import {main as runResultBroker} from '../agent-handoff/result-broker.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const owner = 'ansqhd5774-Choi';
const bot = 'github-actions[bot]';
const runId = 42570000001;
const attempt = 1;
const originalNumber = 2400;
const incidentNumber = 2401;
const sourceSha = 'a'.repeat(40);
const repairSha = 'b'.repeat(40);
const request = {
  schema: 'ZGMINI_PC_JOB_V1', requestId: 'pc-e2e-cross-0001', chatId: 'chat-cross-1',
  operation: 'core-status', sourceRepository: 'ansqhd5774-Choi/zgmini',
  sourceBranch: 'main', sourceSha
};
const original = {repository: repo, number: originalNumber, user: {login: owner},
  labels: [{name: 'pc-job'}], body: JSON.stringify(request)};
const pcEvent = {action: 'completed', repository: {full_name: repo, private: true},
  workflow_run: {name: 'ZGMINI PC Job', event: 'issues', actor: {login: owner},
    head_repository: {full_name: repo}, id: runId, run_attempt: attempt,
    created_at: '2026-11-09T01:00:00Z'}};
const pcReport = {schema: 'ZGMINI_PC_RESULT_V1',
  jobId: `run-${runId}-${attempt}-seat-2`, requestId: request.requestId,
  chatId: request.chatId, seat: 2, controlRepository: repo,
  controlSourceSha: 'c'.repeat(40), sourceRepository: request.sourceRepository,
  sourceBranch: request.sourceBranch, requestedSourceSha: request.sourceSha,
  operation: request.operation, status: 'RUNTIME_FAILED', code: 'CONTROLLER_IMPORT_FAILED',
  lastPass: 'SOURCE_CHECKED', firstFail: 'RUNTIME_IMPORT', finishedAt: '2026-11-09T01:20:00Z'};

function intakeFixture({status = 'RUNTIME_FAILED', authenticatedReceipt = true} = {}) {
  const incidents = [];
  let posts = 0;
  const io = {
    readReport: async name => name.endsWith('seat-2.json') ? {...pcReport, status} : null,
    readComments: async () => authenticatedReceipt ? [{user: {login: bot},
      body: `<!-- zgmini-pc-result:${runId}:${attempt}:2 -->\nverified`,
      issue_url: `https://api.github.com/repos/${repo}/issues/${originalNumber}`}]: [],
    readIssue: async number => number === originalNumber ? original : incidents.find(x => x.number === number),
    listHandoffs: async () => ({repository: repo, complete: true, issues: structuredClone(incidents)}),
    createHandoff: async prepared => {
      posts++;
      const item = {repository: repo, number: incidentNumber,
        title: `agent-handoff ${prepared.incidentId}`, user: {login: bot},
        labels: [{name: 'agent-handoff'}], body: prepared.body};
      incidents.push(item);
      return item;
    }
  };
  return {incidents, io, get posts() { return posts; }};
}

test('verified PC FAIL crosses bot Issue, routing contract and owner result readback once', async () => {
  const f = intakeFixture();
  const intake = await processCompletedPcJob(pcEvent, f.io);
  assert.equal(intake.confirmedFailures, 1);
  assert.equal(intake.newIssues, 1);
  assert.equal(intake.automaticPcRetries, 0);
  assert.equal(intake.pcOperationalWrites, 0);
  assert.equal(f.posts, 1);
  const incident = f.incidents[0];
  const handoff = parseHandoff(incident.body);
  assert.equal(handoff.origin.issueNumber, originalNumber);
  assert.equal(handoff.origin.chatId, request.chatId);
  assert.equal(handoff.failure.evidenceIssueNumber, originalNumber);
  assert.equal(prepareHandoff(incident.body).role, 'COMMON_PROCESS_OWNER');

  const result = {schema: 'ZGMINI_AGENT_HANDOFF_RESULT_V1', resultId: 'result-e2e-cross-0001',
    incidentId: handoff.incidentId, fingerprint: fingerprintHandoff(handoff),
    pullRequest: {repository: repo, number: 2500, headSha: repairSha},
    testRun: {repository: repo, runId: 42570000002, headSha: repairSha}};
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-cross-chain-'));
  const eventFile = path.join(temp, 'event.json');
  fs.writeFileSync(eventFile, JSON.stringify({action: 'created', repository: {private: true},
    issue: incident, comment: {body: JSON.stringify(result), user: {login: owner}}}));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  const ledger = [], originLedger = [];
  let writes = 0;
  process.env.GITHUB_TOKEN = 'integration-test-placeholder';
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    let value;
    if (u.pathname.endsWith(`/issues/${incidentNumber}/comments`) && method === 'GET') value = ledger;
    else if (u.pathname.endsWith(`/issues/${incidentNumber}/comments`) && method === 'POST') {
      writes++;
      ledger.push({user: {login: bot}, body: JSON.parse(init.body).body});
      value = {id: 1};
    } else if (u.pathname.endsWith('/pulls/2500')) value = {number: 2500,
      head: {sha: repairSha, repo: {full_name: repo}}, base: {repo: {full_name: repo}}, state: 'open'};
    else if (u.pathname.endsWith('/actions/runs/42570000002')) value = {id: 42570000002,
      head_sha: repairSha, status: 'completed', conclusion: 'success', repository: {full_name: repo}};
    else if (u.pathname.endsWith(`/issues/${originalNumber}`)) value = original;
    else if (u.pathname.endsWith(`/issues/${originalNumber}/comments`) && method === 'GET') value = originLedger;
    else if (u.pathname.endsWith(`/issues/${originalNumber}/comments`) && method === 'POST') {
      originLedger.push({user: {login: bot}, body: JSON.parse(init.body).body});
      value = {id: 3};
    }
    else throw new Error(`unrecognized mock route ${u.pathname}`);
    return {ok: true, status: 200, json: async () => value};
  };
  try {
    const env = {GITHUB_EVENT_PATH: eventFile, GITHUB_REPOSITORY: repo,
      GITHUB_EVENT_NAME: 'issue_comment', GITHUB_ACTOR: owner};
    await runResultBroker(env);
    await runResultBroker(env);
    assert.equal(writes, 1);
    assert.equal(originLedger.length, 1);
    assert.match(originLedger[0].body, /HANDOFF_ORIGIN_RESULT_RECORDED/);
    assert.match(ledger[0].body, /HANDOFF_RESULT_RECORDED/);
    assert.match(ledger[0].body, new RegExp(`origin: ${repo}#${originalNumber}`));
    assert.match(ledger[0].body, /state: RUNTIME_VERIFICATION_PENDING/);
    assert.match(ledger[0].body, /ChatGPT owner received: UNKNOWN/);
    assert.match(ledger[0].body, /Windows\/D1\/API\/UI verification: NOT_VERIFIED/);
    const repeatedIntake = await processCompletedPcJob(pcEvent, f.io);
    assert.equal(repeatedIntake.newIssues, 0);
    assert.equal(repeatedIntake.reusedIssues, 1);
    assert.equal(f.posts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    fs.rmSync(temp, {recursive: true, force: true});
  }
});

test('missing authenticated PC receipt never reaches central intake', async () => {
  const f = intakeFixture({authenticatedReceipt: false});
  const result = await processCompletedPcJob(pcEvent, f.io);
  assert.equal(result.state, 'PARTIAL_RECEIPT_PENDING');
  assert.equal(result.confirmedFailures, 0);
  assert.equal(result.newIssues, 0);
  assert.equal(f.posts, 0);
  assert.deepEqual(f.incidents, []);
});

test('unknown PC status cannot be promoted to agent work', async () => {
  const f = intakeFixture({status: 'STATE_UNKNOWN'});
  const result = await processCompletedPcJob(pcEvent, f.io);
  assert.equal(result.confirmedFailures, 0);
  assert.equal(result.newIssues, 0);
  assert.equal(f.posts, 0);
});

test('verified Writer B STOP reaches the same handoff and result contract without a PC retry', async () => {
  const writerRunId = 42570000003;
  const writerRequestId = '9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
  const writerChatId = 'e94b51bd-0c27-4257-b430-c8f69fa6728e';
  const manifestPath = 'approvals/writer-updates/cross-chain-test.json';
  const manifest = JSON.stringify({schema: 'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
    status: 'APPROVED_B', scope: 'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',
    runCount: 1, sourceRepository: 'ansqhd5774-Choi/zgmini', candidateSourceSha: repairSha});
  const manifestDigest = createHash('sha256').update(manifest).digest('hex');
  const writerRequest = {schema: 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
    requestId: writerRequestId, chatId: writerChatId, operation: 'pc-writer-source-install',
    controlRepository: repo, approvalManifestPath: manifestPath,
    approvalManifestSha256: manifestDigest};
  const originIssue = {repository: repo, number: 2403, user: {login: owner},
    title: 'pc-writer-source-install', labels: [{name: 'pc-writer-b-install'}],
    body: JSON.stringify(writerRequest)};
  const writerEvent = {action: 'completed', repository: {full_name: repo, private: true},
    workflow_run: {name: 'ZGMINI Approved Writer B Source Overlay Once',
      event: 'issues', actor: {login: owner}, head_repository: {full_name: repo},
      head_sha: sourceSha, head_branch: 'main', id: writerRunId, run_attempt: 1,
      created_at: '2026-11-09T01:00:00Z'}};
  const writerReport = {schema: 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1',
    requestId: writerRequestId, status: 'WRITER_B_PREFLIGHT_STOP',
    code: 'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP', sourceSha: null,
    runId: String(writerRunId), retry: 'READ_ONLY_RECONCILE_NO_REEXECUTE'};
  const writerText = `REQUEST_ID=${writerRequestId}\nSTATUS=${writerReport.status}\n`+
    `CODE=${writerReport.code}\nRUN_ID=${writerRunId}\nRETRY=${writerReport.retry}\n`;
  const receipt = {user: {login: bot},
    issue_url: `https://api.github.com/repos/${repo}/issues/${originIssue.number}`,
    body: `<!-- zgmini-writer-b-install:${writerRequestId} -->\n`+
      `Writer B evidence: **${writerReport.status}** (${writerReport.code})\n`+
      'DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n' +
      'RESULT_CREATED: 2/2; RESULT_READBACK: 2/2\n' +
      `RUN_ID: ${writerRunId}; RETRY: NO_REEXECUTE\n`};
  const incidents = [];
  let issueCreates = 0;
  const io = {
    readComments: async () => [receipt],
    readIssue: async n => n === originIssue.number ? originIssue : incidents.find(x => x.number === n),
    readFile: async (filePath, ref) => {
      const jsonPath = `results/writer-b-source-install-${writerRequestId}`;
      const content = filePath === manifestPath ? manifest :
        filePath === `${jsonPath}.json` ? JSON.stringify(writerReport) :
        filePath === `${jsonPath}.txt` ? writerText : null;
      assert.notEqual(content, null);
      return {path: filePath, ref, content};
    },
    listHandoffs: async () => ({repository: repo, complete: true, issues: structuredClone(incidents)}),
    createHandoff: async prepared => {
      issueCreates++;
      const item = {repository: repo, number: 2404, user: {login: bot},
        title: `agent-handoff ${prepared.incidentId}`, labels: [{name: 'agent-handoff'}],
        body: prepared.body};
      incidents.push(item);
      return item;
    }
  };
  const intake = await processCompletedWriterB(writerEvent, io);
  assert.equal(intake.state, 'ISSUE_CREATED_VERIFIED');
  assert.equal(intake.confirmedFailures, 1);
  assert.equal(intake.newIssues, 1);
  assert.equal(intake.pcOperationalWrites, 0);
  assert.equal(intake.automaticPcRetries, 0);
  const incident = incidents[0];
  const handoff = parseHandoff(incident.body);
  assert.equal(handoff.origin.issueNumber, originIssue.number);
  assert.equal(handoff.origin.sourceSha, sourceSha);
  assert.equal(handoff.failure.kind, 'COMMON_WRITER');
  assert.equal(handoff.failure.lastPass, 'NOT_RECORDED');
  assert.equal(handoff.failure.firstFail, 'NOT_RECORDED');
  assert.equal(prepareHandoff(incident.body).role, 'COMMON_PROCESS_OWNER');
  const again = await processCompletedWriterB(writerEvent, io);
  assert.equal(again.state, 'REUSED_EXISTING');
  assert.equal(issueCreates, 1);

  const result = {schema: 'ZGMINI_AGENT_HANDOFF_RESULT_V1',
    resultId: 'result-e2e-writer-0001', incidentId: handoff.incidentId,
    fingerprint: fingerprintHandoff(handoff),
    pullRequest: {repository: repo, number: 2501, headSha: repairSha},
    testRun: {repository: repo, runId: 42570000004, headSha: repairSha}};
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-writer-return-'));
  const eventFile = path.join(temp, 'event.json');
  fs.writeFileSync(eventFile, JSON.stringify({action: 'created', repository: {private: true},
    issue: incident, comment: {user: {login: owner}, body: JSON.stringify(result)}}));
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.GITHUB_TOKEN;
  const ledger = [], originLedger = [receipt];
  let resultWrites = 0;
  process.env.GITHUB_TOKEN = 'integration-test-placeholder';
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    let data;
    if (u.pathname.endsWith('/issues/2404/comments') && init.method === 'GET') data = ledger;
    else if (u.pathname.endsWith('/issues/2404/comments') && init.method === 'POST') {
      resultWrites++;
      ledger.push({user: {login: bot}, body: JSON.parse(init.body).body});
      data = {id: 2};
    } else if (u.pathname.endsWith('/pulls/2501')) data = {number: 2501,
      head: {sha: repairSha, repo: {full_name: repo}}, base: {repo: {full_name: repo}}, state: 'open'};
    else if (u.pathname.endsWith('/actions/runs/42570000004')) data = {id: 42570000004,
      head_sha: repairSha, status: 'completed', conclusion: 'success', repository: {full_name: repo}};
    else if (u.pathname.endsWith('/actions/runs/42570000003')) data = {id: writerRunId,
      name: 'ZGMINI Approved Writer B Source Overlay Once', head_sha: sourceSha,
      head_branch: 'main', event: 'issues', actor: {login: owner},
      repository: {full_name: repo}, status: 'completed', run_attempt: 1};
    else if (u.pathname.endsWith('/issues/2403')) data = originIssue;
    else if (u.pathname.endsWith('/issues/2403/comments') && init.method === 'GET') data = originLedger;
    else if (u.pathname.endsWith('/issues/2403/comments') && init.method === 'POST') {
      originLedger.push({user: {login: bot}, body: JSON.parse(init.body).body});
      data = {id: 4};
    }
    else throw new Error(`unexpected GitHub API ${u.pathname}`);
    return {ok: true, status: 200, json: async () => data};
  };
  try {
    const env = {GITHUB_EVENT_PATH: eventFile, GITHUB_REPOSITORY: repo,
      GITHUB_EVENT_NAME: 'issue_comment', GITHUB_ACTOR: owner};
    await runResultBroker(env);
    await runResultBroker(env);
    assert.equal(resultWrites, 1);
    assert.equal(originLedger.length, 2);
    assert.match(originLedger[1].body, /HANDOFF_ORIGIN_RESULT_RECORDED/);
    assert.match(ledger[0].body, /state: RUNTIME_VERIFICATION_PENDING/);
    assert.match(ledger[0].body, /Windows\/D1\/API\/UI verification: NOT_VERIFIED/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = oldToken;
    fs.rmSync(temp, {recursive: true, force: true});
  }
});
