import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {executeJob} from '../controller/engine.mjs';
import {exclusive} from '../controller/common.mjs';
import {memoryAdmissionMinimum,waitForMemoryAdmission} from '../controller/memory-admission.mjs';

const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url)));
function setup(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-memory-fixture-'));
 const dataRoot=path.join(root,'data');fs.mkdirSync(path.join(dataRoot,'pc-writer'),{recursive:true});
 fs.writeFileSync(path.join(dataRoot,'pc-writer/config.json'),JSON.stringify({source:'a'.repeat(40)}));
 return {root,policy:structuredClone(policy),host:{dataRoot,controllerSourceSha:'b'.repeat(40)},queryTask:()=>Buffer.from('fixed-task'),seat:1,runId:'4242',fixture:true};
}
const request=(operation,id)=>({schema:'ZGMINI_PC_JOB_V1',requestId:id,chatId:'chat-a',operation,sourceRepository:policy.sourceRepository,sourceBranch:'main',sourceSha:'a'.repeat(40)});

test('gate is operation-specific and preserves the R6 1536 MiB threshold',()=>{
 assert.equal(memoryAdmissionMinimum(policy,'runner-smoke'),null);
 assert.equal(memoryAdmissionMinimum(policy,'theme-common-tests'),384);
 assert.equal(memoryAdmissionMinimum(policy,'employment-r6-candidate-stage-readonly'),1536);
});
test('R6 post-admission check tolerates transient RAM dips but keeps the 1536 MiB guard',async()=>{
 const source=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 const branch=source.split("if(request.operation==='employment-r6-candidate-stage-readonly')")[1]
  ?.split("if(request.operation==='core-conflict-proof')")[0];
 assert.ok(branch,'R6 operation branch present');
 assert.ok(branch.includes("await waitForMemoryAdmission({minimumFreeMiB,timeoutMs:9000,intervalMs:1500})"));
 assert.ok(branch.includes("minimumFreeMiB=policy.operations[request.operation].minimumFreeMiB??policy.minimumFreeMiBForHeavy"));
 assert.ok(branch.includes("if(!memoryRecheck.admitted)return {status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY'"));
 assert.equal(branch.includes("if(os.freemem()/1048576<minimum"),false);
 const threshold=memoryAdmissionMinimum(policy,'employment-r6-candidate-stage-readonly');
 assert.equal(threshold,1536);
 const admitted=await waitForMemoryAdmission({minimumFreeMiB:threshold,
  readFreeMiB:()=>1634,timeoutMs:0});
 assert.equal(admitted.admitted,true);
 const seen=[1200,1540];let n=0;
 const recovered=await waitForMemoryAdmission({minimumFreeMiB:threshold,
  readFreeMiB:()=>seen[Math.min(n++,seen.length-1)],timeoutMs:50,intervalMs:1});
 assert.equal(recovered.admitted,true);assert.equal(recovered.samples,2);
 const blocked=await waitForMemoryAdmission({minimumFreeMiB:threshold,
  readFreeMiB:()=>1200,timeoutMs:5,intervalMs:1});
 assert.equal(blocked.admitted,false);assert.equal(blocked.freeMiB,1200);
});

test('free memory at threshold is admitted without waiting',async()=>{
 const r=await waitForMemoryAdmission({minimumFreeMiB:1536,readFreeMiB:()=>1536,timeoutMs:0});
 assert.equal(r.admitted,true);assert.equal(r.samples,1);assert.ok(r.waitedMs<10);
});
test('temporary RAM deficit recovers in bounded time',async()=>{
 const values=[800,1200,1540];let count=0;
 const r=await waitForMemoryAdmission({minimumFreeMiB:1536,readFreeMiB:()=>values[Math.min(count++,2)],timeoutMs:50,intervalMs:1});
 assert.equal(r.admitted,true);assert.equal(r.samples,3);assert.equal(r.minObservedMiB,800);
});
test('sustained RAM deficit remains BLOCKED and is never treated as success',async()=>{
 const r=await waitForMemoryAdmission({minimumFreeMiB:1536,readFreeMiB:()=>1000,timeoutMs:5,intervalMs:2});
 assert.equal(r.admitted,false);assert.equal(r.freeMiB,1000);assert.ok(r.samples>=2);
});
test('memory wait has strict duration and refuses invalid samples',async()=>{
 await assert.rejects(waitForMemoryAdmission({minimumFreeMiB:1536,timeoutMs:61000}),/MEMORY_WAIT_INVALID/);
 await assert.rejects(waitForMemoryAdmission({minimumFreeMiB:1536,readFreeMiB:()=>NaN}),/MEMORY_SAMPLE_INVALID/);
});
test('memory-blocked heavy job never acquires seat/heavy leases or starts worker, and duplicate cannot execute',async()=>{
 const c=setup(),q=request('employment-r6-candidate-stage-readonly','memory-request-1000');
 let snapshots=0;
 const first=await executeJob(q,{...c,fixtureFreeMiB:()=>{
  snapshots++;
  assert.equal(fs.existsSync(path.join(c.root,'leases','seat-1')),false);
  assert.equal(fs.existsSync(path.join(c.root,'leases','heavy')),false);
  return 800;
 },fixtureMemoryWaitMs:8,fixtureMemoryPollMs:1});
 assert.equal(first.report.status,'BLOCKED');assert.equal(first.report.code,'RESOURCE_WAIT_MEMORY');
 assert.equal(first.report.memoryAdmission.minimumFreeMiB,1536);
 assert.ok(snapshots>=2);assert.equal(first.report.mutationStarted,false);
 assert.equal(first.report.operationalWrites,0);assert.equal(first.report.providerCalls,0);assert.equal(first.report.d1Writes,0);
 assert.equal(fs.existsSync(path.join(c.root,'leases','request-memory-request-1000')),false);
 assert.equal(fs.existsSync(path.join(c.root,'leases','heavy')),false);
 assert.equal(fs.existsSync(path.join(c.root,'jobs',first.report.jobId,'input.json')),false);
 const again=await executeJob(q,{...c,runId:'4243',fixtureFreeMiB:()=>20000});
 assert.equal(again.report.reused,true);assert.equal(again.report.code,'RESOURCE_WAIT_MEMORY');
 assert.ok(again.report.prior.finishedAt);assert.equal(again.report.prior.memoryAdmission.admitted,false);
});
test('heavy job recovers from low RAM and starts exactly one allowlisted worker',async()=>{
 const c=setup(),q=request('theme-common-tests','memory-request-3000');let reads=0;
 const first=await executeJob(q,{...c,runId:'4245',fixtureFreeMiB:()=>++reads===1?200:500,fixtureMemoryWaitMs:60,fixtureMemoryPollMs:2});
 assert.equal(first.report.memoryAdmission.admitted,true);
 assert.ok(first.report.memoryAdmission.samples>=2);
 assert.equal(first.report.result?.code,'SOURCE_NOT_APPROVED_FOR_EXECUTION');
 assert.equal(first.report.lastPass,'ALLOWLISTED_WORKER_STARTED');
 assert.equal(first.report.operationalWrites,0);
 assert.equal(fs.existsSync(path.join(first.workspace,'input.json')),true);
 const again=await executeJob(q,{...c,runId:'4246',fixtureFreeMiB:()=>20000});
 assert.equal(again.report.reused,true);
 assert.equal(fs.existsSync(path.join(again.workspace,'input.json')),false);
});
test('only one low-memory heavy job occupies a Runner while the others do not wait',async()=>{
 const c=setup(),firstRequest=request('employment-r6-candidate-stage-readonly','memory-request-4000');
 const first=executeJob(firstRequest,{...c,runId:'4247',fixtureFreeMiB:()=>100,fixtureMemoryWaitMs:100,fixtureMemoryPollMs:5});
 let present=false;
 for(let n=0;n<50;n++){
  present=fs.existsSync(path.join(c.root,'leases','heavy-memory-wait'));
  if(present)break;
  await new Promise(resolve=>setTimeout(resolve,1));
 }
 assert.equal(present,true);
 const next=await executeJob(request('employment-r6-candidate-stage-readonly','memory-request-4001'),{
  ...c,seat:2,runId:'4248',fixtureFreeMiB:()=>100,fixtureMemoryWaitMs:100,fixtureMemoryPollMs:5});
 assert.equal(next.report.status,'BLOCKED');assert.equal(next.report.code,'MEMORY_WAIT_ALREADY_ACTIVE');
 assert.equal(fs.existsSync(path.join(c.root,'leases','seat-2')),false);
 assert.equal((await first).report.code,'RESOURCE_WAIT_MEMORY');
 assert.equal(fs.existsSync(path.join(c.root,'leases','heavy-memory-wait')),false);
});
test('independent light work continues while memory-gated heavy job waits',async()=>{
 const c=setup(),heavy=executeJob(request('employment-r6-candidate-stage-readonly','memory-request-2000'),{
  ...c,fixtureFreeMiB:()=>300,fixtureMemoryWaitMs:120,fixtureMemoryPollMs:5});
 const light=await executeJob(request('runner-smoke','memory-request-2001'),{...c,seat:2,runId:'4244'});
 const blocked=await heavy;
 assert.equal(light.report.status,'PASS');assert.equal(blocked.report.status,'BLOCKED');
 assert.equal(blocked.report.code,'RESOURCE_WAIT_MEMORY');assert.equal(fs.existsSync(path.join(c.root,'leases','heavy')),false);
});
test('non-isolated operation Task snapshot failure remains prevalidation without leaking shell errors',async()=>{
 const c=setup(),q=request('failure-proof','memory-request-5000');
 const r=await executeJob(q,{...c,queryTask:()=>{throw new Error('private PC path and stdout must not leak');}});
 assert.equal(r.report.status,'BLOCKED');assert.equal(r.report.code,'PROTECTED_TASK_XML_QUERY_FAILED');
 assert.equal(r.report.phase,'PREVALIDATION');assert.equal(r.report.failureOperation,'PROTECTED_STATE_SNAPSHOT');
 assert.equal(r.report.failedProtectedTask,'ZGMINI-PC-Local-Core');assert.equal(r.report.mutationStarted,false);
 assert.equal(r.report.operationalWrites,0);assert.equal(fs.existsSync(path.join(r.workspace,'input.json')),false);
 assert.equal(JSON.stringify(r.report).includes('private PC path'),false);
});
test('malformed existing request ledger identifies the exact prevalidation operation without a worker',async()=>{
 const c=setup(),q=request('runner-smoke','memory-request-6000');
 fs.mkdirSync(path.join(c.root,'ledger'),{recursive:true});
 fs.writeFileSync(path.join(c.root,'ledger',q.requestId+'.json'),'{private PC path');
 const r=await executeJob(q,c);
 assert.equal(r.report.status,'BLOCKED');assert.equal(r.report.code,'REQUEST_LEDGER_PARSE_FAILED');
 assert.equal(r.report.phase,'PREVALIDATION');assert.equal(r.report.failureOperation,'REQUEST_LEDGER');
 assert.equal(r.report.mutationStarted,false);assert.equal(r.report.affectedScope,'OWN_REQUEST_ONLY');
 assert.equal(fs.existsSync(path.join(c.root,'leases','request-'+q.requestId)),false);
 assert.equal(fs.existsSync(path.join(r.workspace,'input.json')),false);
 assert.equal(JSON.stringify(r.report).includes('private PC path'),false);
});
test('invalid Core config identifies read failure without exposing config bytes or starting a worker',async()=>{
 const c=setup(),q=request('runner-smoke','memory-request-6001');
 fs.writeFileSync(path.join(c.host.dataRoot,'pc-writer','config.json'),'{private config');
 const r=await executeJob(q,c);
 assert.equal(r.report.status,'BLOCKED');assert.equal(r.report.code,'CORE_CONFIG_PARSE_FAILED');
 assert.equal(r.report.phase,'PREVALIDATION');assert.equal(r.report.failureOperation,'CORE_STATE_READ');
 assert.equal(r.report.mutationStarted,false);assert.equal(r.report.operationalWrites,0);
 assert.equal(fs.existsSync(path.join(c.root,'leases','request-'+q.requestId)),false);
 assert.equal(fs.existsSync(path.join(r.workspace,'input.json')),false);
 assert.equal(JSON.stringify(r.report).includes('private config'),false);
});
test('active shared heavy lease is retained and reported as a shared prevalidation conflict',async()=>{
 const c=setup(),q=request('theme-common-tests','memory-request-6002');
 const release=exclusive(path.join(c.root,'leases'),'heavy');
 try{
  const r=await executeJob(q,{...c,fixtureFreeMiB:()=>2000});
  assert.equal(r.report.status,'BLOCKED');assert.equal(r.report.code,'LEASE_BUSY');
  assert.equal(r.report.phase,'PREVALIDATION');assert.equal(r.report.failureOperation,'RESOURCE_LEASE');
  assert.equal(r.report.affectedScope,'SHARED_LEASE_POSSIBLE');
  assert.equal(r.report.nextAction,'INSPECT_LEASE_OWNER_NO_LOCK_DELETION');
  assert.equal(fs.existsSync(path.join(c.root,'leases','heavy')),true);
  assert.equal(fs.existsSync(path.join(r.workspace,'input.json')),false);
 }finally{release();}
});
