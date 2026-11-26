import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {preflightTaskCreateB} from '../task-create-b/preflight.mjs';
import {sanitizeTaskCreateB} from '../task-create-b/report.mjs';
import {ISSUE_TITLE,ISSUE_LABEL,TASK,RESULT_SCHEMA,authorizeTaskCreateB}
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

test('W06 proposed manifest contains exact pins but cannot authorize any Task installation',()=>{
 const file=fileURLToPath(new URL('../task-create-b/w06-cnn-minute-proposal.json',import.meta.url));
 const proposed=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(proposed.status,'PROPOSED_B');
 assert.equal(proposed.taskName,TASK);
 assert.equal(proposed.installedSourceSha,'393cee0da46515ff056543173fcd1253a858b3d7');
 assert.equal(proposed.candidateSourceSha,'0bae713aa6df1f4c00037db908050c74ae3dd20c');
 assert.equal(proposed.candidateFileSha256,'694474d9966ef0a06dd46bb5d5b684150c5d66b5fcf989501fc4f9aa1502a7e7');
 assert.equal(proposed.launcherSha256,'73c8cf4381fd328182a9fad0a7cb5753cf9093e58524f0c9a04be4df7032d733');
 assert.equal(proposed.coreTaskXmlSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.equal(proposed.sidecarSourceSha256,'eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b');
 assert.equal(proposed.allowCnnHttpRequests,true);
 assert.equal(proposed.allowSqliteObservationWrites,true);
 assert.equal(proposed.allowD1PublicProjectionWrites,true);
 assert.equal(proposed.allowOtherTaskChanges,false);
 const request={schema:'ZGMINI_PC_TASK_CREATE_B_REQUEST_V1',
  requestId:'abec1087-3a25-4452-a5a8-a45218f05c37',
  operation:'task-create-once',
  approvalManifestPath:'approvals/task-create-b/w06-cnn-minute-20261126.json',
  approvalManifestSha256:createHash('sha256').update(
   Buffer.from(JSON.stringify(proposed))).digest('hex')};
 const fakeEvent={action:'opened',issue:{title:ISSUE_TITLE,
  user:{login:'ansqhd5774-Choi'},labels:[{name:ISSUE_LABEL}],
  body:JSON.stringify(request)}};
 assert.throws(()=>authorizeTaskCreateB({event:fakeEvent,
  manifestBytes:Buffer.from(JSON.stringify(proposed)),manifestCommitted:true}),
  e=>e.code==='TASK_CREATE_B_APPROVAL_SCOPE_STOP');
});

test('B: Task backup and candidate writes are durable without changing source or DB',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../task-create-b/windows-adapter.mjs',import.meta.url)),'utf8');
 assert.match(source,/function writeDurableOnce\(file,bytes\)/);
 assert.match(source,/fs\.openSync\(file,'wx'\)/);
 assert.match(source,/fs\.fsyncSync\(fd\)/);
 assert.match(source,/fs\.readFileSync\(file\)\.equals\(bytes\)/);
 assert.match(source,/writeDurableOnce\(p,obj\.bytes\)/);
 assert.match(source,/writeDurableOnce\(dest,bytes\)/);
 assert.match(source,/writeDurableOnce\(file,Buffer\.concat/);
 assert.doesNotMatch(source,/\b(?:unlink|rm)Sync\(CONFIG\)/);
});

test('user-approved W06 B manifest authorizes only fixed Task, candidate and explicit effects',()=>{
 const path=fileURLToPath(new URL('../approvals/task-create-b/w06-cnn-minute-20261126.json',import.meta.url));
 const approvedBytes=fs.readFileSync(path),approved=JSON.parse(approvedBytes);
 const proposed=JSON.parse(fs.readFileSync(fileURLToPath(new URL(
  '../task-create-b/w06-cnn-minute-proposal.json',import.meta.url)),'utf8'));
 assert.deepEqual({...approved,status:'PROPOSED_B'},proposed);
 assert.equal(approved.status,'APPROVED_B');
 assert.equal(approved.taskName,'ZGMINI-PC-CNN-Minute');
 assert.equal(approved.allowOtherTaskChanges,false);
 assert.equal(approved.allowCnnHttpRequests,true);
 assert.equal(approved.allowSqliteObservationWrites,true);
 assert.equal(approved.allowD1PublicProjectionWrites,true);
 assert.equal(approved.runCount,1);
 const request={schema:'ZGMINI_PC_TASK_CREATE_B_REQUEST_V1',
  requestId:'abec1087-3a25-4452-a5a8-a45218f05c37',
  operation:'task-create-once',
  approvalManifestPath:'approvals/task-create-b/w06-cnn-minute-20261126.json',
  approvalManifestSha256:createHash('sha256').update(approvedBytes).digest('hex')};
 const event={action:'opened',issue:{title:ISSUE_TITLE,
  user:{login:'ansqhd5774-Choi'},labels:[{name:ISSUE_LABEL}],
  body:JSON.stringify(request)}};
 const proof=authorizeTaskCreateB({event,manifestBytes:approvedBytes,manifestCommitted:true});
 assert.equal(proof.manifest.candidateSourceSha,'0bae713aa6df1f4c00037db908050c74ae3dd20c');
 assert.throws(()=>authorizeTaskCreateB({event,
  manifestBytes:Buffer.from(JSON.stringify({...approved,allowOtherTaskChanges:true})),
  manifestCommitted:true}),e=>e.code==='TASK_CREATE_B_REQUEST_SCOPE_STOP');
 assert.throws(()=>authorizeTaskCreateB({event,manifestBytes:approvedBytes,
  manifestCommitted:false}),e=>e.code==='TASK_CREATE_B_OWNER_OR_COMMIT_STOP');
});
