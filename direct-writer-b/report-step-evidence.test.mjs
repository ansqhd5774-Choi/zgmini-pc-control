import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sanitizeDirectBReport,directBTextReport} from './report.mjs';
import {recordApplyExit,DIRECT_B_EXIT_SCHEMA,DIRECT_B_EXIT_FILE}
  from './capture-apply-exit.mjs';

const request={requestId:'fb3dd7e4-e3cc-4a49-851b-377f9f824529',
  approvalManifestSha256:'a'.repeat(64)};
const env={GITHUB_RUN_ID:'42433385671',GITHUB_JOB:'approved-runtime-b',
  DIRECT_B_CONFIGURED_OUTCOME:'success',
  DIRECT_B_CANDIDATE_OUTCOME:'success',
  DIRECT_B_APPLY_OUTCOME:'failure'};
const exit=n=>({schema:DIRECT_B_EXIT_SCHEMA,runId:env.GITHUB_RUN_ID,
  jobName:env.GITHUB_JOB,step:'apply',nodeExitCode:n});
const blocked={status:'DIRECT_B_EFFECT_BLOCKED',code:'DIRECT_B_EFFECT_STOP',
  requestId:request.requestId};
const pass={status:'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED',
  code:'DIRECT_B_LOCAL_EFFECT_PASS',requestId:request.requestId,
  manifestSha256:request.approvalManifestSha256,controlSha:'b'.repeat(40),
  sourceSha:'c'.repeat(40),mode:'CONFIGURED_THEMES_REPEAT_UPGRADE',
  operationSucceeded:true};

test('actual #846 missing raw result retains process first-fail exit 13',()=>{
  const result=sanitizeDirectBReport(null,request,env,exit(13));
  assert.equal(result.status,'DIRECT_B_STATE_UNKNOWN');
  assert.equal(result.code,'DIRECT_B_APPLY_NODE_EXIT_NONZERO');
  assert.equal(result.runId,env.GITHUB_RUN_ID);
  assert.equal(result.jobName,env.GITHUB_JOB);
  assert.equal(result.jobId,null);
  assert.equal(result.lastPassStep,'APPROVED_SOURCE_CHECKOUT');
  assert.equal(result.firstFailStep,'APPLY_RUNTIME_B_EFFECT');
  assert.equal(result.firstFailCode,'DIRECT_B_APPLY_NODE_EXIT_NONZERO');
  assert.equal(result.nodeExitCode,13);
  assert.equal(result.applyStepInvoked,true);
  assert.equal(result.operationalEffectAttempted,'UNKNOWN');
  assert.equal(result.operationSucceeded,false);
  assert.equal(result.runtimeEffectProof,'NOT_ESTABLISHED');
  assert.equal(result.retry,'NO_AUTO_RETRY_READ_ONLY_RECONCILE');
  assert.match(directBTextReport(result),/NODE_EXIT_CODE=13/);
  assert.match(directBTextReport(result),/FIRST_FAIL=APPLY_RUNTIME_B_EFFECT/);
});

test('structured first-fail remains authoritative when exit 1 matches',()=>{
  const result=sanitizeDirectBReport(blocked,request,env,exit(1));
  assert.equal(result.status,'DIRECT_B_EFFECT_BLOCKED');
  assert.equal(result.code,blocked.code);
  assert.equal(result.firstFailCode,blocked.code);
  assert.equal(result.nodeExitCode,1);
  assert.equal(result.operationSucceeded,false);
});

test('result and process contradiction is UNKNOWN, never local success',()=>{
  const mismatched=sanitizeDirectBReport(pass,request,env,exit(13));
  assert.equal(mismatched.status,'DIRECT_B_STATE_UNKNOWN');
  assert.equal(mismatched.code,'DIRECT_B_RESULT_PROCESS_CONFLICT');
  assert.equal(mismatched.operationSucceeded,false);
  const failedExitZero=sanitizeDirectBReport(blocked,request,env,exit(0));
  assert.equal(failedExitZero.status,'DIRECT_B_STATE_UNKNOWN');
  assert.equal(failedExitZero.code,'DIRECT_B_RESULT_PROCESS_CONFLICT');
});

test('PASS requires successful Actions step and zero process exit',()=>{
  const successful={...env,DIRECT_B_APPLY_OUTCOME:'success'};
  const result=sanitizeDirectBReport(pass,request,successful,exit(0));
  assert.equal(result.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
  assert.equal(result.operationSucceeded,true);
  assert.equal(result.runtimeEffectProof,'LOCAL_EXECUTOR_PASS_REPORT_PENDING');
  assert.equal(sanitizeDirectBReport(pass,request,successful,null).status,
    'DIRECT_B_STATE_UNKNOWN');
});

test('tampered or absent sidecar never guesses an exit code',()=>{
  const missing=sanitizeDirectBReport(null,request,env,null);
  assert.equal(missing.nodeExitCode,null);
  assert.equal(missing.code,'DIRECT_B_APPLY_STEP_FAILED_EXIT_UNKNOWN');
  const wrongJob=sanitizeDirectBReport(null,request,env,
    {...exit(13),jobName:'other-job'});
  assert.equal(wrongJob.nodeExitCode,null);
  assert.equal(wrongJob.status,'DIRECT_B_STATE_UNKNOWN');
  const extended=sanitizeDirectBReport(null,request,env,
    {...exit(13),authorization:'hidden'});
  assert.equal(extended.nodeExitCode,null);
});

test('checkout failure is not mislabeled as a Node apply failure',()=>{
  const interrupted={...env,DIRECT_B_CANDIDATE_OUTCOME:'failure',
    DIRECT_B_APPLY_OUTCOME:'skipped'};
  const result=sanitizeDirectBReport(null,request,interrupted,null);
  assert.equal(result.lastPassStep,'CONFIGURED_SOURCE_PIN');
  assert.equal(result.firstFailStep,'APPROVED_SOURCE_CHECKOUT');
  assert.equal(result.firstFailCode,'DIRECT_B_SOURCE_CHECKOUT_STEP_FAILED');
  assert.equal(result.nodeExitCode,null);
  assert.equal(result.applyStepInvoked,false);
  assert.equal(result.operationalEffectAttempted,'NOT_STARTED_BY_WORKFLOW');
});

test('approved raw preflight stop is classified before operational effect',()=>{
  const raw={status:'DIRECT_B_PREFLIGHT_STOP',
    code:'DIRECT_B_APPROVAL_BYTES_STOP',requestId:null};
  const result=sanitizeDirectBReport(raw,request,env,exit(1));
  assert.equal(result.status,'DIRECT_B_PREFLIGHT_STOP');
  assert.equal(result.code,'DIRECT_B_APPROVAL_BYTES_STOP');
  assert.equal(result.firstFailStep,'APPROVAL_PREFLIGHT');
  assert.equal(result.operationalEffectAttempted,'NOT_STARTED_BY_PREFLIGHT');
});

test('capture helper writes only create-once bounded TEMP provenance',()=>{
  const writes=[];
  const captured=recordApplyExit({env:{RUNNER_TEMP:path.resolve('/tmp'),
    GITHUB_RUN_ID:env.GITHUB_RUN_ID,GITHUB_JOB:env.GITHUB_JOB},
  exitText:'13',writeFile:(file,content,options)=>
    writes.push({file,content,options})});
  assert.equal(captured.nodeExitCode,13);
  assert.equal(writes.length,1);
  assert.equal(writes[0].file,path.join(path.resolve('/tmp'),DIRECT_B_EXIT_FILE));
  assert.equal(writes[0].options.flag,'wx');
  assert.deepEqual(JSON.parse(writes[0].content),captured);
  assert.throws(()=>recordApplyExit({env:{RUNNER_TEMP:'/tmp',
    GITHUB_RUN_ID:'0',GITHUB_JOB:'approved-runtime-b'},exitText:'secret'}),
  /DIRECT_B_APPLY_EXIT_RECORD_INVALID/);
});

test('fixed Windows Actions step captures and preserves native exit',()=>{
  const workflow=fs.readFileSync(fileURLToPath(new URL(
    '../.github/workflows/pc-approved-runtime-b-once.yml',
    import.meta.url)),'utf8');
  assert.match(workflow,/set "zgmini_apply_exit=%ERRORLEVEL%"/);
  assert.match(workflow,/capture-apply-exit\.mjs" %zgmini_apply_exit%/);
  assert.match(workflow,/exit \/b %zgmini_apply_exit%/);
  for(const step of ['CONFIGURED','CANDIDATE','APPLY'])
    assert.match(workflow,new RegExp('DIRECT_B_'+step+'_OUTCOME:'));
  assert.match(workflow,/if: always\(\) && steps\.control\.outcome == 'success'/);
});
