import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {executeJob} from '../controller/engine.mjs';
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
test('free memory at threshold is admitted without waiting',async()=>{
 const r=await waitForMemoryAdmission({minimumFreeMiB:1536,readFreeMiB:()=>1536,timeoutMs:0});
 assert.equal(r.admitted,true);assert.equal(r.samples,1);assert.equal(r.waitedMs,0);
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
test('independent light work continues while memory-gated heavy job waits',async()=>{
 const c=setup(),heavy=executeJob(request('employment-r6-candidate-stage-readonly','memory-request-2000'),{
  ...c,fixtureFreeMiB:()=>300,fixtureMemoryWaitMs:120,fixtureMemoryPollMs:5});
 const light=await executeJob(request('runner-smoke','memory-request-2001'),{...c,seat:2,runId:'4244'});
 const blocked=await heavy;
 assert.equal(light.report.status,'PASS');assert.equal(blocked.report.status,'BLOCKED');
 assert.equal(blocked.report.code,'RESOURCE_WAIT_MEMORY');assert.equal(fs.existsSync(path.join(c.root,'leases','heavy')),false);
});
