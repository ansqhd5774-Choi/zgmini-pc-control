import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{execFileSync}from'node:child_process';
import {executeJob} from '../controller/engine.mjs';import {validateRequest,exclusive} from '../controller/common.mjs';
const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url)));
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-runner-'));const dataRoot=path.join(root,'data');fs.mkdirSync(path.join(dataRoot,'pc-writer'),{recursive:true});fs.writeFileSync(path.join(dataRoot,'pc-writer/config.json'),JSON.stringify({source:'a'.repeat(40)}));return {root,policy:structuredClone(policy),host:{dataRoot,controllerSourceSha:'b'.repeat(40)},queryTask:()=>Buffer.from('fixed-task'),retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT',runId:'100',seat:1};}
const req=(operation='runner-smoke',requestId='request-12345678')=>({schema:'ZGMINI_PC_JOB_V1',requestId,chatId:'chat-a',operation,sourceRepository:policy.sourceRepository,sourceBranch:'main',sourceSha:'a'.repeat(40)});
test('strict data-only request denies shell, unknown tasks, path and repo substitution',()=>{for(const q of [{...req(),cmd:'del all'},{...req(),operation:'arbitrary-cmd'},{...req(),requestId:'../../oops'},{...req(),sourceRepository:'other/repo'}])assert.throws(()=>validateRequest(q,policy));});
test('one fixed command produces JSON TXT and preserves protected state; duplicate executes nothing',async()=>{const c=fixture(),r=await executeJob(req(),c);assert.equal(r.report.status,'PASS');assert.equal(r.report.protectedStateUnchanged,true);assert.equal(r.report.pcOperationalApprovedSha,'a'.repeat(40));assert.ok(fs.existsSync(path.join(r.workspace,'RESULT.txt')));const again=await executeJob(req(),{...c,runId:'101'});assert.equal(again.report.reuseCode,'DUPLICATE_REUSED_NO_EXECUTION');assert.equal(again.report.code,r.report.code);assert.ok(again.report.prior.finishedAt);assert.equal(again.report.operationalWrites,0);const changed=await executeJob({...req(),operation:'failure-proof'},{...c,runId:'102'});assert.equal(changed.report.code,'DUPLICATE_REQUEST_PAYLOAD_CHANGED');});
test('duplicate of failure preserves FAIL and original first failure',async()=>{
 const c=fixture(),q=req('failure-proof');const first=await executeJob(q,c);
 const again=await executeJob(q,{...c,runId:'103'});
 assert.equal(first.report.status,'FAIL');assert.equal(again.report.status,'FAIL');
 assert.equal(again.report.code,first.report.code);assert.equal(again.report.firstFail,first.report.firstFail);
 assert.equal(again.report.reused,true);
});
test('failed worker termination returns bounded UNKNOWN and retains only fixture leases',async()=>{
 const c=fixture();c.policy.operations['timeout-proof'].timeoutSeconds=1;
 const r=await executeJob(req('timeout-proof'),{...c,terminateTree:()=>{throw Error('simulated kill failure');},terminationGraceMs:100});
 try{
  assert.equal(r.report.status,'STATE_UNKNOWN');assert.equal(r.report.code,'WORKER_TERMINATION_UNVERIFIED');
  assert.equal(r.report.resourceLeasesRetained,true);assert.ok(fs.existsSync(path.join(c.root,'leases/seat-1')));
  assert.ok(fs.existsSync(path.join(r.workspace,'RECOVERY_REQUIRED.json')));
 }finally{
  if(r.report.workerPid){if(process.platform==='win32')execFileSync('taskkill.exe',['/PID',String(r.report.workerPid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else process.kill(r.report.workerPid,'SIGKILL');}
 }
});
test('own lease does not steal/delete an existing active owner',()=>{const c=fixture();const release=exclusive(c.root,'x');assert.throws(()=>exclusive(c.root,'x'),/LEASE_BUSY/);release();});
test('six simultaneous seats retain separate request workspace and results',async()=>{const c=fixture();const results=await Promise.all(Array.from({length:6},(_,i)=>executeJob(req('runner-smoke','parallel-request-'+i),{...c,runId:String(1000+i),seat:i+1})));assert.equal(new Set(results.map(x=>x.workspace)).size,6);assert.ok(results.every(x=>x.report.status==='PASS'&&x.report.seat>=1));});
test('controlled operation failure is reported instead of losing the result',async()=>{const result=await executeJob(req('failure-proof'),fixture());assert.equal(result.report.status,'FAIL');assert.equal(result.report.code,'CONTROLLED_FIXTURE_FAILURE');assert.equal(result.report.protectedStateUnchanged,true);});
test('core conflict fixture preserves lock and never invokes real SQLite or writer',async()=>{const result=await executeJob(req('core-conflict-proof'),fixture());assert.equal(result.report.status,'PASS');assert.equal(result.report.result.code,'CORE_WRITE_GATE_BLOCKED_WITHOUT_LOCK_CHANGE');assert.equal(result.report.sqliteOpened,false);});
test('timeout terminates only the subprocess created by this job and preserves a failure report',async()=>{const c=fixture();c.policy.operations['timeout-proof'].timeoutSeconds=1;const result=await executeJob(req('timeout-proof'),c);assert.equal(result.report.code,'JOB_EXECUTION_TIMEOUT');assert.equal(result.report.protectedStateUnchanged,true);assert.equal(result.report.operationalWrites,0);});
test('unapproved source never executes a test command',async()=>{const c=fixture();const result=await executeJob(req('theme-common-tests'),c);assert.equal(result.report.result.code,'SOURCE_NOT_APPROVED_FOR_EXECUTION');});

test('postcheck R13 inventory uncertainty keeps worker result but never authorizes PASS',async()=>{
 const c=fixture();let probes=0;
 const retiredTaskEvidence=()=>{
  if(++probes===2)throw Object.assign(new Error('inventory probe unavailable'),
   {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
  return 'APPROVED_RETIRED_ABSENT';
 };
 const result=await executeJob(req('runner-smoke','postcheck-r13-unknown-01'),
  {...c,retiredTaskEvidence,runId:'3301'});
 assert.equal(probes,2);
 assert.equal(result.report.status,'STATE_UNKNOWN');
 assert.equal(result.report.code,'PROTECTED_STATE_POSTCHECK_UNVERIFIED');
 assert.equal(result.report.postcheckFailureCode,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.deepEqual(result.report.workerOutcome,
  {status:'PASS',code:'RUNNER_COMMAND_EXECUTED',
   firstFail:null,resultPresent:true});
 assert.equal(result.report.result.code,'RUNNER_COMMAND_EXECUTED');
 assert.equal(result.report.protectedStateUnchanged,null);
 assert.match(result.report.protectedBeforeSha256,/^[a-f0-9]{64}$/);
 assert.equal(result.report.protectedAfterSha256,null);
 assert.equal(result.report.firstFail,'PROTECTED_STATE_POSTCHECK');
 assert.equal(result.report.operationalWrites,0);
 assert.equal(result.report.providerCalls,0);
 assert.equal(result.report.d1Writes,0);
 assert.equal(JSON.parse(fs.readFileSync(
  path.join(result.workspace,'RESULT.json'),'utf8')).status,'STATE_UNKNOWN');
});

test('retired R13 inventory precheck failure blocks worker without changing safety rule',async()=>{
 const c=fixture();
 const result=await executeJob(req('runner-smoke','precheck-r13-denied-01'),
  {...c,runId:'3302',retiredTaskEvidence:()=>{
   throw Object.assign(new Error('inventory probe unavailable'),
    {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
  }});
 assert.equal(result.report.status,'BLOCKED');
 assert.equal(result.report.code,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.equal(result.report.failureOperation,'PROTECTED_STATE_SNAPSHOT');
 assert.equal(result.report.result,undefined);
});

test('changed protected state remains BLOCKED instead of being relabeled as uncertain',async()=>{
 const c=fixture();let probes=0;
 const result=await executeJob(req('runner-smoke','postcheck-r13-drift-01'),
  {...c,runId:'3303',retiredTaskEvidence:()=>{
   return ++probes===1?'APPROVED_RETIRED_ABSENT':'UNEXPECTED_TASK_STATE';
  }});
 assert.equal(probes,2);
 assert.equal(result.report.status,'BLOCKED');
 assert.equal(result.report.code,'PROTECTED_STATE_DRIFT_OBSERVED');
 assert.equal(result.report.result.code,'RUNNER_COMMAND_EXECUTED');
});

test('postcheck R13 with missing worker result preserves original timeout',async()=>{
 const c=fixture();c.policy.operations['timeout-proof'].timeoutSeconds=1;
 let probes=0;
 const result=await executeJob(req('timeout-proof','postcheck-r13-timeout-01'),
  {...c,runId:'3304',retiredTaskEvidence:()=>{
   if(++probes===2)throw Object.assign(new Error('inventory unavailable'),
    {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
   return 'APPROVED_RETIRED_ABSENT';
  }});
 assert.equal(probes,2);
 assert.equal(result.report.status,'STATE_UNKNOWN');
 assert.equal(result.report.code,'PROTECTED_STATE_POSTCHECK_UNVERIFIED');
 assert.equal(result.report.postcheckFailureCode,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.deepEqual(result.report.workerOutcome,
  {status:'FAIL',code:'JOB_EXECUTION_TIMEOUT',
   firstFail:'OWN_WORKER_TIMEOUT',resultPresent:false});
 assert.equal(result.report.result,undefined);
 assert.equal(result.report.firstFail,'PROTECTED_STATE_POSTCHECK');
 assert.equal(result.report.protectedStateUnchanged,null);
 assert.equal(result.report.resourceLeasesRetained,undefined);
});

test('R13 POSTCHECK failure after uncertain worker termination retains recovery identity and leases',async()=>{
 const c=fixture();c.policy.operations['timeout-proof'].timeoutSeconds=1;
 let probes=0;
 const result=await executeJob(req('timeout-proof','postcheck-r13-uncertain-child-01'),
  {...c,runId:'3305',terminateTree:()=>{throw Error('simulated termination denial');},
   terminationGraceMs:100,retiredTaskEvidence:()=>{
    if(++probes===2)throw Object.assign(new Error('inventory unavailable'),
     {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
    return 'APPROVED_RETIRED_ABSENT';
   }});
 try{
  assert.equal(probes,2);
  assert.equal(result.report.status,'STATE_UNKNOWN');
  assert.equal(result.report.code,'WORKER_TERMINATION_UNVERIFIED');
  assert.equal(result.report.firstFail,'OWN_WORKER_TERMINATION');
  assert.equal(result.report.postcheckFailureCode,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
  assert.deepEqual(result.report.workerOutcome,{
   status:'STATE_UNKNOWN',code:'WORKER_TERMINATION_UNVERIFIED',
   firstFail:'OWN_WORKER_TERMINATION',resultPresent:false});
  assert.equal(result.report.protectedStateUnchanged,null);
  assert.equal(result.report.protectedAfterSha256,null);
  assert.equal(result.report.resourceLeasesRetained,true);
  assert.equal(result.report.next,'RECONCILE_WORKER_AND_RETAIN_RESOURCE_LEASES');
  assert.ok(fs.existsSync(path.join(c.root,'leases','seat-1')));
  assert.ok(fs.existsSync(path.join(c.root,'leases','request-postcheck-r13-uncertain-child-01')));
  assert.equal(JSON.parse(fs.readFileSync(
   path.join(result.workspace,'RECOVERY_REQUIRED.json'),'utf8')).reason,
   'WORKER_TERMINATION_UNVERIFIED');
  assert.equal(JSON.parse(fs.readFileSync(
   path.join(result.workspace,'RESULT.json'),'utf8')).code,'WORKER_TERMINATION_UNVERIFIED');
 }finally{
  if(result.report.workerPid){
   try{
    if(process.platform==='win32')execFileSync('taskkill.exe',
     ['/PID',String(result.report.workerPid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else process.kill(result.report.workerPid,'SIGKILL');
   }catch{}
  }
 }
});
