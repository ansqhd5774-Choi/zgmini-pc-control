import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {preflightTaskCreateB} from '../task-create-b/preflight.mjs';
import {sanitizeTaskCreateB} from '../task-create-b/report.mjs';
import {ISSUE_TITLE,ISSUE_LABEL,TASK,RESULT_SCHEMA}
 from '../task-create-b/contract.mjs';

const fixture=()=>({request:{requestId:'abec1087-3a25-4452-a5a8-a45218f05c37'},
 manifest:{candidateSourceSha:'1'.repeat(40)}});
test('W06 preflight gives only an immutable candidate SHA, no operation data',()=>{
 const result=preflightTaskCreateB({read:fixture});
 assert.deepEqual(result,{requestId:fixture().request.requestId,
  candidateSourceSha:'1'.repeat(40)});
 assert.deepEqual(Object.keys(result),['requestId','candidateSourceSha']);
 assert.throws(()=>preflightTaskCreateB({read:()=>({
  ...fixture(),manifest:{candidateSourceSha:'branch-name'}})}),
 e=>e.code==='TASK_CREATE_B_CANDIDATE_SOURCE_STOP');
});
test('W06 task result marks natural CNN ticks unverified after Task readback',()=>{
 const request={requestId:'abec1087-3a25-4452-a5a8-a45218f05c37'};
 const base={schema:RESULT_SCHEMA,requestId:request.requestId,taskName:TASK,
  status:'TASK_CREATE_B_INSTALLED_VERIFIED',
  code:'TASK_CREATE_B_ONE_TASK_ENABLE_READBACK_PASS',
  created:true,taskChanges:1,otherTaskChanges:0};
 assert.equal(sanitizeTaskCreateB(base,request,{verified:false}).installed,null);
 const result=sanitizeTaskCreateB(base,request,{verified:true});
 assert.equal(result.installed,true);
 assert.equal(result.taskChanges,1);
 assert.equal(result.installerProviderCalls,0);
 assert.equal(result.scheduledRuntimeEffects,'UNVERIFIED_UNTIL_NATURAL_TICKS');
 assert.equal(sanitizeTaskCreateB({...base,status:'TASK_CREATE_B_RECOVERY_REQUIRED',
  created:null},request).status,'TASK_CREATE_B_RECOVERY_REQUIRED');
});
test('W06 reuses exact owner-scoped Writer B workflow without adding Cron',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../.github/workflows/pc-writer-b-source-once.yml',import.meta.url)),'utf8');
 assert.match(source,/github\.event\.issue\.title == 'pc-writer-task-create-once'/);
 assert.match(source,/contains\(github\.event\.issue\.labels\.\*\.name, 'pc-writer-b-install'\)/);
 assert.match(source,/group: zgmini-writer-source-b-one-at-a-time/);
 assert.match(source,/id: w06taskapprove/);
 assert.match(source,/ref: \$\{\{ steps\.w06taskapprove\.outputs\.candidateSourceSha \}\}/);
 assert.match(source,/id: w06taskcreate/);
 assert.match(source,/task-create-b\\entry\.mjs/);
 assert.match(source,/task-create-b\\report\.mjs/);
 assert.doesNotMatch(source,/^\s*schedule\s*:/m);
 assert.equal(ISSUE_TITLE,'pc-writer-task-create-once');
 assert.equal(ISSUE_LABEL,'pc-writer-b-install');
});
