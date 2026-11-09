import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseHandoff} from '../agent-handoff/contract.mjs';
import {assertCompletedWriterBEvent, findWriterBReceipt,
  prepareWriterBFailureHandoff} from '../agent-handoff/writer-b-result-to-incident.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const owner = 'ansqhd5774-Choi';
const bot = 'github-actions[bot]';
const runId = 42437425077;
const requestId = '9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
const chatId = 'e94b51bd-0c27-4257-b430-c8f69fa6728e';
const manifestPath = 'approvals/writer-updates/employment-r6-19-file-overlay-20261108-r2.json';
const sourceSha = 'a'.repeat(40);
const manifest = () => JSON.stringify({schema: 'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
  status: 'APPROVED_B', scope: 'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY', runCount: 1,
  sourceRepository: 'ansqhd5774-Choi/zgmini', candidateSourceSha: 'c'.repeat(40)});
const digest = s => createHash('sha256').update(s).digest('hex');
const request = () => ({schema: 'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1', requestId, chatId,
  operation: 'pc-writer-source-install', controlRepository: repo,
  approvalManifestPath: manifestPath, approvalManifestSha256: digest(manifest())});
const issue = () => ({repository: repo, number: 874, user: {login: owner},
  title: 'pc-writer-source-install', labels: [{name: 'pc-writer-b-install'}],
  body: JSON.stringify(request())});
const event = () => ({action: 'completed', repository: {full_name: repo, private: true},
  workflow_run: {name: 'ZGMINI Approved Writer B Source Overlay Once',
    event: 'issues', actor: {login: owner}, head_repository: {full_name: repo},
    head_sha: sourceSha, head_branch: 'main', id: runId, run_attempt: 1,
    created_at: '2026-11-08T23:00:00Z'}});
const result = (status = 'WRITER_B_PREFLIGHT_STOP',
  code = 'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP') => ({
  schema: 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1', requestId, status, code,
  sourceSha: null, mode: null, localOnly: null, baseHead: null,
  candidateSourceSha: null, manifestSha256: null, baseTreeOid: null,
  preparedTreeOid: null, provenanceSha256: null, runId: String(runId),
  retry: 'READ_ONLY_RECONCILE_NO_REEXECUTE'});
const comment = (r = result()) => ({user: {login: bot},
  body: `<!-- zgmini-writer-b-install:${requestId} -->\n`+
    `Writer B evidence: **${r.status}** (${r.code})\n`+
    `DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n`+
    `RESULT_CREATED: 2/2; RESULT_READBACK: 2/2\n`+
    `RUN_ID: ${runId}; RETRY: NO_REEXECUTE\n`,
  issue_url: `https://api.github.com/repos/${repo}/issues/874`});
const artifacts = (r = result()) => ({
  resultJson: {path: `results/writer-b-source-install-${requestId}.json`,
    ref: 'main', content: JSON.stringify(r)},
  resultTxt: {path: `results/writer-b-source-install-${requestId}.txt`,
    ref: 'main', content: `REQUEST_ID=${requestId}\nSTATUS=${r.status}\nCODE=${r.code}\n`+
      `RUN_ID=${runId}\nRETRY=READ_ONLY_RECONCILE_NO_REEXECUTE\n`},
  manifestJson: {path: manifestPath, ref: sourceSha, content: manifest()}});
const fixture = (r = result()) => {
  const receipt = findWriterBReceipt([comment(r)], runId);
  return {event: event(), originIssue: issue(), receipt, ...artifacts(r)};
};

test('one bot-verified preflight failure yields a sanitized and deterministic candidate', () => {
  const f = fixture();
  const first = prepareWriterBFailureHandoff(f);
  const again = prepareWriterBFailureHandoff(f);
  assert.equal(first.state, 'READY_TO_ENQUEUE');
  assert.equal(first.reportStatus, 'WRITER_B_PREFLIGHT_STOP');
  assert.equal(first.handling, 'SOURCE_DIAGNOSIS_ONLY');
  assert.equal(first.automaticPcRetries, 0);
  assert.equal(first.pcOperationalWrites, 0);
  assert.deepEqual(again, first);
  const handoff = parseHandoff(first.body);
  assert.equal(handoff.origin.sourceSha, sourceSha); // B control run, not local overlay.
  assert.equal(handoff.origin.repository, repo);
  assert.equal(handoff.origin.issueNumber, 874);
  assert.equal(handoff.failure.kind, 'COMMON_WRITER');
  assert.equal(handoff.failure.code, 'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
  assert.equal(handoff.failure.lastPass, 'NOT_RECORDED');
  assert.equal(handoff.failure.firstFail, 'NOT_RECORDED');
  assert.deepEqual(handoff.failure.fileRefs, [manifestPath,
    `results/writer-b-source-install-${requestId}.json`,
    `results/writer-b-source-install-${requestId}.txt`]);
  assert.doesNotMatch(first.body, /GITHUB_TOKEN|password|rawPayload/);
});

test('verified success and STATE_UNKNOWN cannot become repair incidents', () => {
  for (const [status, code] of [
    ['WRITER_B_INSTALLED_VERIFIED', 'WRITER_B_INSTALL_VERIFIED'],
    ['WRITER_B_STATE_UNKNOWN', 'WRITER_B_RESULT_UNVERIFIED_STOP']]) {
    const item = prepareWriterBFailureHandoff(fixture(result(status, code)));
    assert.equal(item.state, 'NOT_ELIGIBLE');
    assert.equal(item.reportStatus, status);
    assert.equal(item.automaticPcRetries, 0);
    assert.equal(Object.hasOwn(item, 'body'), false);
  }
});

test('approval setup STOP is kept separate from authenticated PC runtime failures', () => {
  const item = prepareWriterBFailureHandoff(fixture(result(
    'WRITER_B_SETUP_STOP', 'WRITER_B_APPROVAL_PATH_STOP')));
  assert.equal(item.state, 'SETUP_REVIEW_REQUIRED');
  assert.equal(item.automaticPcRetries, 0);
  assert.equal(Object.hasOwn(item, 'body'), false);
});

test('a reported successful or unknown status cannot carry a contradictory code', () => {
  for (const status of ['WRITER_B_INSTALLED_VERIFIED', 'WRITER_B_STATE_UNKNOWN']) {
    const f = fixture(result(status, 'WRITER_B_PREFLIGHT_STOP'));
    assert.throws(() => prepareWriterBFailureHandoff(f),
      /RESULT_STATUS_CODE_MISMATCH_STOP/);
  }
});

test('RECOVERY_REQUIRED creates only an explicit read-only reconciliation candidate', () => {
  const item = prepareWriterBFailureHandoff(fixture(result(
    'WRITER_B_RECOVERY_REQUIRED', 'WRITER_B_RECOVERY_REQUIRED')));
  assert.equal(item.state, 'READY_TO_ENQUEUE');
  assert.equal(item.reportStatus, 'WRITER_B_RECOVERY_REQUIRED');
  assert.equal(item.handling, 'READ_ONLY_RECOVERY_RECONCILE_NO_REEXECUTE');
  assert.equal(item.automaticPcRetries, 0);
  const actual = parseHandoff(item.body);
  assert.equal(actual.failure.firstFail, 'NOT_RECORDED');
});

test('only the authenticated exact bot result marker and run ID can identify origin', () => {
  const exact = comment();
  assert.equal(findWriterBReceipt([exact], runId).issueNumber, 874);
  assert.equal(findWriterBReceipt([{...exact, user: {login: owner}}], runId), null);
  assert.equal(findWriterBReceipt([{...exact, body: exact.body.replace(
    String(runId), '42437425078')}], runId), null);
  assert.throws(() => findWriterBReceipt([exact, exact], runId), /RECEIPT_DUPLICATE_STOP/);
  assert.throws(() => findWriterBReceipt(Array(501).fill(exact), runId),
    /RECEIPT_INVENTORY_INVALID/);
});

test('event repository, workflow, owner, run attempt and control source are pinned', () => {
  for (const modify of [
    e => { e.repository.private = false; },
    e => { e.workflow_run.name = 'ZGMINI PC Job'; },
    e => { e.workflow_run.actor.login = 'attacker'; },
    e => { e.workflow_run.head_repository.full_name = 'other/repo'; },
    e => { e.workflow_run.run_attempt = 2; },
    e => { e.workflow_run.head_sha = 'bad'; },
    e => { e.workflow_run.head_branch = 'feature'; }
  ]) {
    const e = event(); modify(e);
    assert.throws(() => assertCompletedWriterBEvent(e), /EVENT_NOT_ALLOWED/);
  }
});

test('origin spoofing, unapproved manifest and tampered SHA stop before enqueue', () => {
  for (const mutate of [
    f => { f.originIssue.user.login = bot; },
    f => { f.originIssue.labels = []; },
    f => { f.originIssue.number = 875; },
    f => { f.originIssue.body = JSON.stringify({...request(), operation: 'core-status'}); },
    f => { f.manifestJson.content = manifest().replace('APPROVED_B', 'DRAFT'); },
    f => { f.manifestJson.ref = 'b'.repeat(40); },
    f => { f.manifestJson.content = '{}'; }
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => prepareWriterBFailureHandoff(f),
      /ORIGIN_NOT_AUTHORIZED|ORIGIN_REQUEST_INVALID|MANIFEST_SHA_MISMATCH_STOP|ARTIFACT_READBACK_INVALID/);
  }
});

test('remote JSON, TXT and bot readback must agree exactly', () => {
  for (const mutate of [
    f => { f.resultJson.ref = sourceSha; },
    f => { f.resultJson.content = JSON.stringify({...result(), runId: '1'}); },
    f => { f.resultTxt.content = f.resultTxt.content.replace('RUN_ID='+runId, 'RUN_ID=1'); },
    f => { f.receipt.comment.body = f.receipt.comment.body.replace(
      'RESULT_READBACK: 2/2', 'RESULT_READBACK: 1/2'); },
    f => { f.receipt.comment.body = f.receipt.comment.body.replace(
      'WRITER_B_PREFLIGHT_STOP', 'WRITER_B_STATE_UNKNOWN'); }
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => prepareWriterBFailureHandoff(f),
      /ARTIFACT_READBACK_INVALID|RESULT_IDENTITY_INVALID|TXT_RESULT_MISMATCH_STOP|RECEIPT_READBACK_MISMATCH_STOP/);
  }
});
