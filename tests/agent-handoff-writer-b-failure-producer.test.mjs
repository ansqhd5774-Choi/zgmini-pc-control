import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {processCompletedWriterB} from '../agent-handoff/writer-b-failure-producer.mjs';
import {parseHandoff} from '../agent-handoff/contract.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const owner = 'ansqhd5774-Choi';
const bot = 'github-actions[bot]';
const runId = 42437425077;
const requestId = '9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
const chatId = 'e94b51bd-0c27-4257-b430-c8f69fa6728e';
const sourceSha = 'a'.repeat(40);
const manifestPath = 'approvals/writer-updates/employment-r6-19-file-overlay-20261108-r2.json';
const sha256 = s => createHash('sha256').update(s).digest('hex');
const manifest = () => JSON.stringify({schema: 'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
  status: 'APPROVED_B', scope: 'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',
  runCount: 1, sourceRepository: 'ansqhd5774-Choi/zgmini',
  candidateSourceSha: 'b'.repeat(40)});
const request = () => ({schema: 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId, chatId, operation: 'pc-writer-source-install',
  controlRepository: repo, approvalManifestPath: manifestPath,
  approvalManifestSha256: sha256(manifest())});
const issue = () => ({repository: repo, number: 874, user: {login: owner},
  title: 'pc-writer-source-install', labels: [{name: 'pc-writer-b-install'}],
  body: JSON.stringify(request())});
const event = () => ({action: 'completed', repository: {full_name: repo,
  private: true}, workflow_run: {name: 'ZGMINI Approved Writer B Source Overlay Once',
  event: 'issues', actor: {login: owner}, head_repository: {full_name: repo},
  head_sha: sourceSha, head_branch: 'main', id: runId, run_attempt: 1,
  created_at: '2026-11-08T02:11:00Z'}});
const report = (status = 'WRITER_B_PREFLIGHT_STOP',
  code = 'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP') => ({
  schema: 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1', requestId, status, code,
  sourceSha: null, runId: String(runId), retry: 'READ_ONLY_RECONCILE_NO_REEXECUTE'});
const txt = r => `REQUEST_ID=${requestId}\nSTATUS=${r.status}\nCODE=${r.code}\n`+
  `RUN_ID=${runId}\nRETRY=READ_ONLY_RECONCILE_NO_REEXECUTE\n`;
const comment = r => ({user: {login: bot},
  issue_url: `https://api.github.com/repos/${repo}/issues/874`,
  body: `<!-- zgmini-writer-b-install:${requestId} -->\n`+
    `Writer B evidence: **${r.status}** (${r.code})\n`+
    `DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n`+
    `RESULT_CREATED: 2/2; RESULT_READBACK: 2/2\n`+
    `RUN_ID: ${runId}; RETRY: NO_REEXECUTE\n`});

function fixture(initial = report()) {
  const state = {report: initial, original: issue(), comments: [comment(initial)],
    manifest: manifest(), missing: null, created: [],
    waitComments: [], waitPost: 0, waitRead: 0, waitList: 0,
    calls: {comments: 0, file: [], list: 0, create: 0, route: 0, readIssue: []},
    failAfterPost: false, failBeforePost: false, tamperReadback: false};
  const io = {
    readComments: async since => {
      state.calls.comments++;
      assert.equal(since, '2026-11-08T02:11:00Z');
      return state.comments;
    },
    readIssue: async number => {
      state.calls.readIssue.push(number);
      if (number === 874) return state.original;
      const created = state.created.find(x => x.number === number);
      if (!created) throw new Error('UNEXPECTED_ISSUE_READ');
      return state.tamperReadback ? {...created, body: '{}'} : created;
    },
    readFile: async (filePath, ref, maxBytes) => {
      state.calls.file.push({filePath, ref, maxBytes});
      if (filePath === state.missing) return null;
      if (filePath === manifestPath) return {path: filePath, ref,
        content: state.manifest};
      if (filePath === `results/writer-b-source-install-${requestId}.json`)
        return {path: filePath, ref, content: JSON.stringify(state.report)};
      if (filePath === `results/writer-b-source-install-${requestId}.txt`)
        return {path: filePath, ref, content: txt(state.report)};
      throw new Error('UNEXPECTED_FILE_READ');
    },
    listHandoffs: async () => {
      state.calls.list++;
      return {repository: repo, complete: true, issues: state.created};
    },
    routeHandoff: async () => ({state: ++state.calls.route === 1 ? 'ROUTE_RECORDED' : 'ROUTE_REUSED'}),
    createHandoff: async prepared => {
      state.calls.create++;
      if (state.failBeforePost) throw new Error('POST_LOST');
      const created = {number: 1100, repository: repo, user: {login: bot},
        labels: [{name: 'agent-handoff'}], body: prepared.body};
      state.created.push(created);
      if (state.failAfterPost) throw new Error('POST_ACK_LOST');
      return {number: created.number};
    },
    listResourceWaitComments: async () => {
      state.waitList++;
      return state.waitComments;
    },
    createResourceWaitComment: async body => {
      state.waitPost++;
      const item={id:7201,body,user:{login:bot},
        issue_url:`https://api.github.com/repos/${repo}/issues/68`};
      state.waitComments.push(item);
      return {id:item.id};
    },
    readResourceWaitComment: async id => {
      state.waitRead++;
      return state.waitComments.find(x=>x.id===id);
    },
  };
  return {state, io};
}

test('confirmed #874-shaped failure produces one bot-read-back verified handoff', async () => {
  const {io, state} = fixture();
  const actual = await processCompletedWriterB(event(), io);
  assert.equal(actual.state, 'ISSUE_CREATED_VERIFIED');
  assert.equal(actual.verifiedResults, 1);
  assert.equal(actual.confirmedFailures, 1);
  assert.equal(actual.newIssues, 1);
  assert.equal(actual.routesRecorded, 1);
  assert.equal(state.calls.route, 1);
  assert.equal(actual.pcOperationalWrites, 0);
  assert.equal(actual.automaticPcRetries, 0);
  assert.equal(state.calls.create, 1);
  assert.equal(state.calls.list, 1);
  const handoff = parseHandoff(state.created[0].body);
  assert.equal(handoff.origin.issueNumber, 874);
  assert.equal(handoff.failure.kind, 'COMMON_WRITER');
  assert.equal(handoff.failure.code, 'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
  assert.equal(handoff.failure.lastPass, 'NOT_RECORDED');
  assert.deepEqual(state.calls.file.map(x => [x.ref, x.maxBytes]),
    [['main', 65536], ['main', 65536], [sourceSha, 131072]]);
});

test('same run is idempotent: on repeat no second Issue POST', async () => {
  const {io, state} = fixture();
  await processCompletedWriterB(event(), io);
  const again = await processCompletedWriterB(event(), io);
  assert.equal(again.state, 'REUSED_EXISTING');
  assert.equal(again.reusedIssues, 1);
  assert.equal(again.routesReused, 1);
  assert.equal(state.calls.route, 2);
  assert.equal(state.calls.create, 1);
});

test('successful Writer B and uncertain result do not enqueue', async () => {
  for (const [status, code] of [
    ['WRITER_B_INSTALLED_VERIFIED', 'WRITER_B_INSTALL_VERIFIED'],
    ['WRITER_B_STATE_UNKNOWN', 'WRITER_B_RESULT_UNVERIFIED_STOP']]) {
    const {io, state} = fixture(report(status, code));
    const result = await processCompletedWriterB(event(), io);
    assert.equal(result.state, 'NOT_ELIGIBLE');
    assert.equal(state.calls.create, 0);
    assert.equal(state.calls.list, 0);
  }
});

test('approval setup STOP is reported for review without generating a repair Issue', async () => {
  const {io, state} = fixture(report('WRITER_B_SETUP_STOP',
    'WRITER_B_APPROVAL_PATH_STOP'));
  const result = await processCompletedWriterB(event(), io);
  assert.equal(result.state, 'SETUP_REVIEW_REQUIRED');
  assert.equal(result.reportStatus, 'WRITER_B_SETUP_STOP');
  assert.equal(result.confirmedFailures, 0);
  assert.equal(state.calls.create, 0);
  assert.equal(state.calls.list, 0);
});

test('a verified clean shared-resource deferral stays out of the repair queue', async () => {
  const {io,state} = fixture(report('WRITER_B_PREFLIGHT_STOP',
    'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'));
  const result = await processCompletedWriterB(event(), io);
  assert.equal(result.state, 'WAIT_RECORDED');
  assert.equal(result.resourceKey, 'writer-source');
  assert.match(result.waitId, /^resource-wait-/);
  assert.equal(result.automaticPcRetries, 0);
  assert.equal(state.calls.create, 0);
  assert.equal(state.calls.list, 0);
  assert.equal(state.waitPost, 1);
  assert.equal(state.waitRead, 1);
  const again = await processCompletedWriterB(event(), io);
  assert.equal(again.state, 'WAIT_REUSED');
  assert.equal(state.waitPost, 1);
});

test('completed but skipped irrelevant Issue has no Writer B receipt', async () => {
  const {io, state} = fixture();
  state.comments = [];
  const result = await processCompletedWriterB(event(), io);
  assert.equal(result.state, 'NO_VERIFIED_WRITER_B_RECEIPT');
  assert.equal(result.newIssues, 0);
  assert.equal(state.calls.file.length, 0);
});

test('failed source workflow without a Writer B receipt is visible, never silent NO_WORK', async () => {
  for (const conclusion of ['failure', 'timed_out']) {
    const {io, state} = fixture();
    state.comments = [];
    const e = event();
    e.workflow_run.conclusion = conclusion;
    await assert.rejects(() => processCompletedWriterB(e, io),
      /WRITER_B_HANDOFF_PRODUCER_FAILED_RUN_RECEIPT_ABSENT/);
    assert.equal(state.calls.create, 0);
    assert.equal(state.calls.file.length, 0);
    assert.equal(state.calls.route, 0);
  }
});

test('unrelated skipped source workflow with no receipt remains benign', async () => {
  const {io, state} = fixture();
  state.comments = [];
  const e = event();
  e.workflow_run.conclusion = 'skipped';
  const result = await processCompletedWriterB(e, io);
  assert.equal(result.state, 'NO_VERIFIED_WRITER_B_RECEIPT');
  assert.equal(result.newIssues, 0);
  assert.equal(state.calls.file.length, 0);
  assert.equal(state.calls.create, 0);
});

const rejectedComment = () => ({user:{login:bot},
  issue_url:`https://api.github.com/repos/${repo}/issues/874`,
  body:`<!-- zgmini-writer-b-request-rejected:${runId} -->\n` +
    'Writer B request: **REJECTED_BEFORE_PC** (WRITER_B_REQUEST_CONTRACT_STOP)\n' +
    'PC_INSTALL: NOT_EXECUTED; RESULT_PAIR: NOT_CREATED_INVALID_REQUEST\n' +
    `RUN_ID: ${runId}; RETRY: NO_REEXECUTE\n`});

test('verified pre-PC admission rejection is safe, not a missing result failure', async () => {
  for (const conclusion of ['success','failure']) {
    const {io,state}=fixture();
    state.comments=[rejectedComment()];
    const e=event();e.workflow_run.conclusion=conclusion;
    const result=await processCompletedWriterB(e,io);
    assert.equal(result.state,'REJECTED_BEFORE_PC');
    assert.equal(result.newIssues,0);
    assert.equal(result.confirmedFailures,0);
    assert.equal(state.calls.file.length,0);
    assert.equal(state.calls.create,0);
    assert.equal(state.calls.route,0);
  }
});

test('successful source job without either verified reporter receipt fails closed',async()=>{
  const {io,state}=fixture();
  state.comments=[];
  const e=event();e.workflow_run.conclusion='success';
  await assert.rejects(processCompletedWriterB(e,io),
    /WRITER_B_HANDOFF_PRODUCER_SUCCESSFUL_RUN_RECEIPT_ABSENT/);
  assert.equal(state.calls.create,0);
  assert.equal(state.calls.route,0);
});

test('forged, malformed or duplicate rejection cannot mask failed source run',async()=>{
  for(const modify of [
    c=>{c.user.login='untrusted-user';},
    c=>{c.issue_url='https://api.github.com/repos/other/repo/issues/874';},
    c=>{c.body=c.body.replace('PC_INSTALL: NOT_EXECUTED','PC_INSTALL: DONE');},
    c=>{c.body=c.body.replace(`RUN_ID: ${runId}`, 'RUN_ID: 1');},
  ]){
    const {io,state}=fixture();state.comments=[rejectedComment()];
    modify(state.comments[0]);
    const e=event();e.workflow_run.conclusion='failure';
    await assert.rejects(processCompletedWriterB(e,io),
      /WRITER_B_HANDOFF_PRODUCER_FAILED_RUN_RECEIPT_ABSENT/);
    assert.equal(state.calls.create,0);
  }
  const {io,state}=fixture();
  state.comments=[rejectedComment(),rejectedComment()];
  const e=event();e.workflow_run.conclusion='failure';
  await assert.rejects(processCompletedWriterB(e,io),
    /WRITER_B_HANDOFF_PRODUCER_REJECTION_RECEIPT_DUPLICATE/);
  assert.equal(state.calls.create,0);
});

test('verified failed source workflow keeps normal evidence-based routing', async () => {
  const {io, state} = fixture();
  const e = event();
  e.workflow_run.conclusion = 'failure';
  const result = await processCompletedWriterB(e, io);
  assert.equal(result.state, 'ISSUE_CREATED_VERIFIED');
  assert.equal(result.confirmedFailures, 1);
  assert.equal(state.calls.route, 1);
  assert.equal(result.automaticPcRetries, 0);
});

test('wrong actor, workflow or repeated attempt never reaches GitHub I/O', async () => {
  const {io, state} = fixture();
  for (const modify of [
    e => { e.workflow_run.name = 'ZGMINI PC Job'; },
    e => { e.workflow_run.actor.login = 'attacker'; },
    e => { e.workflow_run.run_attempt = 2; }]) {
    const e = event(); modify(e);
    await assert.rejects(() => processCompletedWriterB(e, io), /EVENT_NOT_ALLOWED/);
  }
  assert.equal(state.calls.comments, 0);
});

test('missing result or manifest, duplicate bot receipt and altered origin fail closed', async () => {
  for (const mutate of [
    s => { s.missing = `results/writer-b-source-install-${requestId}.json`; },
    s => { s.missing = `results/writer-b-source-install-${requestId}.txt`; },
    s => { s.missing = manifestPath; },
    s => { s.comments.push(s.comments[0]); },
    s => { s.original.user.login = bot; },
    s => { s.original.body = JSON.stringify({...request(),
      approvalManifestPath: '../untrusted.json'}); },
    s => { s.manifest = '{}'; }
  ]) {
    const {io, state} = fixture(); mutate(state);
    await assert.rejects(() => processCompletedWriterB(event(), io),
      /EVIDENCE_PAIR_INCOMPLETE|RECEIPT_DUPLICATE_STOP|ORIGIN_NOT_AUTHORIZED|ORIGIN_MANIFEST_PATH_INVALID|MANIFEST_SHA_MISMATCH_STOP/);
    assert.equal(state.calls.create, 0);
  }
});

test('ambiguous Issue POST outcome reconciles once, never retries', async () => {
  const first = fixture(); first.state.failAfterPost = true;
  const recovered = await processCompletedWriterB(event(), first.io);
  assert.equal(recovered.state, 'POST_RECONCILED');
  assert.equal(first.state.calls.list, 2);
  assert.equal(first.state.calls.create, 1);
  assert.equal(first.state.calls.route, 1);
  const second = fixture(); second.state.failBeforePost = true;
  await assert.rejects(() => processCompletedWriterB(event(), second.io),
    /POST_OUTCOME_UNKNOWN/);
  assert.equal(second.state.calls.list, 2);
  assert.equal(second.state.calls.create, 1);
});

test('a created Issue is not accepted without exact authenticated readback', async () => {
  const {io, state} = fixture(); state.tamperReadback = true;
  await assert.rejects(() => processCompletedWriterB(event(), io),
    /CREATE_READBACK_STOP/);
  assert.equal(state.calls.create, 1);
});

test('route failure prevents Writer B intake completion and never retries the installer', async () => {
  const {io, state} = fixture();
  io.routeHandoff = async () => { throw new Error('HANDOFF_BOT_DIRECT_ROUTE_COMMENT_READBACK_STOP'); };
  await assert.rejects(processCompletedWriterB(event(), io), /COMMENT_READBACK_STOP/);
  assert.equal(state.calls.create, 1);
  assert.equal(state.calls.route, 0);
});
