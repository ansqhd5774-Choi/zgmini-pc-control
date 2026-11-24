import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{execFileSync}from'node:child_process';
import {executeJob,readFixedR6Stage} from '../controller/engine.mjs';import {validateRequest,exclusive} from '../controller/common.mjs';
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
   {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE',
    probeReason:'SCHTASKS_INVENTORY_EMPTY_PARSE'});
  return 'APPROVED_RETIRED_ABSENT';
 };
 const result=await executeJob(req('runner-smoke','postcheck-r13-unknown-01'),
  {...c,retiredTaskEvidence,runId:'3301'});
 assert.equal(probes,2);
 assert.equal(result.report.status,'STATE_UNKNOWN');
 assert.equal(result.report.code,'READONLY_RESULT_PROTECTION_UNVERIFIED');
 assert.equal(result.report.postcheckFailureCode,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.equal(result.report.protectedProbeReason,'SCHTASKS_INVENTORY_EMPTY_PARSE');
 assert.deepEqual(result.report.workerOutcome,
  {status:'PASS',code:'RUNNER_COMMAND_EXECUTED',
   firstFail:null,resultPresent:true});
 assert.equal(result.report.result.code,'RUNNER_COMMAND_EXECUTED');
 assert.equal(result.report.protectedStateUnchanged,null);
 assert.match(result.report.protectedBeforeSha256,/^[a-f0-9]{64}$/);
 assert.equal(result.report.protectedAfterSha256,null);
 assert.equal(result.report.firstFail,'PROTECTED_STATE_OBSERVATION');
 assert.equal(result.report.operationalWrites,0);
 assert.equal(result.report.providerCalls,0);
 assert.equal(result.report.d1Writes,0);
 assert.equal(JSON.parse(fs.readFileSync(
  path.join(result.workspace,'RESULT.json'),'utf8')).status,'STATE_UNKNOWN');
});

test('W04 shared-lock A returns its own observation even when retired R13 inventory fails',async()=>{
 const c=fixture();
 const out=await executeJob(req('shared-resource-release-readonly','w04-core-lock-r13-inventory-01'),{
  ...c,runId:'9843',retiredTaskEvidence:()=>{
   throw Object.assign(new Error('private scheduler inventory error'),{
    code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE',
    probeReason:'SCHTASKS_INVENTORY_COMMAND_FAILED'});
  },
 });
 assert.equal(out.report.effectClass,'FIXED_READONLY_NO_PROVIDER_NO_DB');
 assert.equal(out.report.status,'STATE_UNKNOWN');
 assert.equal(out.report.code,'READONLY_RESULT_PROTECTION_UNVERIFIED');
 assert.equal(out.report.protectionPrecheckCode,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.equal(out.report.protectedProbeReason,'SCHTASKS_INVENTORY_COMMAND_FAILED');
 assert.equal(out.report.protectedStateUnchanged,null);
 assert.equal(out.report.resultPresent,undefined);
 assert.equal(typeof out.report.result?.code,'string');
 assert.equal(out.report.providerCalls,0);
 assert.equal(out.report.d1Writes,0);
 assert.equal(out.report.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(out.report),/private scheduler inventory error/);
});

test('missing unrelated inventory preserves a fixed read result without asserting protection PASS',async()=>{
 const c=fixture();
 const result=await executeJob(req('runner-smoke','precheck-r13-denied-01'),
  {...c,runId:'3302',retiredTaskEvidence:()=>{
   throw Object.assign(new Error('inventory probe unavailable'),
    {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE',
     probeReason:'SCHTASKS_INVENTORY_COMMAND_FAILED'});
  }});
 assert.equal(result.report.status,'STATE_UNKNOWN');
 assert.equal(result.report.code,'READONLY_RESULT_PROTECTION_UNVERIFIED');
 assert.equal(result.report.protectionPrecheckCode,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.equal(result.report.protectedProbeReason,'SCHTASKS_INVENTORY_COMMAND_FAILED');
 assert.equal(result.report.result.code,'RUNNER_COMMAND_EXECUTED');
 assert.equal(result.report.protectedStateUnchanged,null);
 assert.equal(result.report.protectedBeforeSha256,null);
 assert.equal(result.report.workerOutcome.status,'PASS');
 assert.equal(result.report.operationalWrites,0);
});

test('protection availability exception cannot authorize another registered operation',async()=>{
 const c=fixture();const out=await executeJob(req('failure-proof','strict-operation-protection-01'),
  {...c,retiredTaskEvidence:()=>{throw Object.assign(new Error('unavailable'),
   {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});}});
 assert.equal(out.report.status,'BLOCKED');
 assert.equal(out.report.code,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 assert.equal(out.report.result,undefined);
});

test('a fixed read keeps Core evidence through unavailable Task observation, never full health PASS',async()=>{
 const c=fixture();const out=await executeJob(req('core-status','fixed-core-read-partial-01'),
  {...c,queryTask:()=>{throw new Error('private error text');}});
 assert.equal(out.report.status,'STATE_UNKNOWN');
 assert.equal(out.report.code,'READONLY_RESULT_PROTECTION_UNVERIFIED');
 assert.equal(out.report.result.core.approvedSourceSha,'a'.repeat(40));
 assert.equal(out.report.result.taskObservation,'UNVERIFIED');
 assert.deepEqual(out.report.result.core.taskXmlHashes,{});
 assert.equal(out.report.protectedStateUnchanged,null);
 assert.equal(out.report.protectionPrecheckCode,'PROTECTED_TASK_XML_QUERY_FAILED');
 assert.equal(JSON.stringify(out.report).includes('private error text'),false);
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
 assert.equal(result.report.lastPass,'ALLOWLISTED_OPERATION_COMPLETED');
 assert.equal(result.report.firstFail,'PROTECTED_STATE_POSTCHECK');
 assert.equal(result.report.protectedStateUnchanged,false);
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


test('core-status reuses precheck Task hashes and queries protected tasks only before and after',async()=>{
 const c=fixture();let taskQueries=0,retiredQueries=0;
 const out=await executeJob(req('core-status','core-status-reuse-precheck-01'),
  {...c,runId:'5501',queryTask:()=>{taskQueries++;return Buffer.from('fixed-task');},
   retiredTaskEvidence:()=>{retiredQueries++;return 'APPROVED_RETIRED_ABSENT';}});
 assert.equal(out.report.status,'PASS');
 assert.equal(out.report.result.code,'CORE_READONLY_DIAGNOSIS');
 assert.equal(taskQueries,4); // two active tasks in each protected pre/post snapshot
 assert.equal(retiredQueries,2); // one retired-task attestation in each snapshot
 assert.equal(out.report.protectedStateUnchanged,true);
 assert.equal(out.report.result.core.taskXmlHashes['ZGMINI-PC-Iran-Progress-R13'],'APPROVED_RETIRED_ABSENT');
 assert.equal(out.report.providerCalls,0);
 assert.equal(out.report.d1Writes,0);
});

test('core-status preserves Core evidence when only postcheck Task lookup fails',async()=>{
 const c=fixture();let probes=0;
 const out=await executeJob(req('core-status','core-status-postcheck-unavailable-01'),
  {...c,runId:'5502',queryTask:()=>{if(++probes===3)throw new Error('private scheduler failure');
   return Buffer.from('fixed-task');}});
 assert.equal(probes,3);
 assert.equal(out.report.status,'STATE_UNKNOWN');
 assert.equal(out.report.code,'READONLY_RESULT_PROTECTION_UNVERIFIED');
 assert.equal(out.report.result.code,'CORE_READONLY_DIAGNOSIS');
 assert.equal(out.report.result.core.approvedSourceSha,'a'.repeat(40));
 assert.equal(out.report.protectionPostcheckCode,'PROTECTED_TASK_XML_QUERY_FAILED');
 assert.equal(out.report.protectedStateUnchanged,null);
 assert.equal(JSON.stringify(out.report).includes('private scheduler failure'),false);
});


function fixtureD05Ledger(c){
 const dir=path.join(c.host.dataRoot,'pc-writer','score-lineage');
 fs.mkdirSync(dir,{recursive:true});
 const calculatedAt='2026-11-19T12:00:00.000Z',sourceSha='a'.repeat(40);
 const stable={schema:'D05_COMPOSITE_INPUT_LINEAGE_LOCAL_V1',
  eventId:'D05/CM-R1/'+calculatedAt,calculatedAt,asOfDate:'2026-11-19',score:50,
  outputSignature:'12345678',archiveKey:'composite-observed:2026-11-19',
  archiveStoredAt:Date.parse(calculatedAt),approvedSourceSha:sourceSha,runtimeSourceSha:sourceSha,
  inputScope:'SELECTED_7_BATCHES_ONLY',inputStatus:'LOCAL_SELECTED_7_MATCHED',
  selectionEvidence:'POST_SELECTION_UNIQUE_MATCH',
  effectiveUseVerified:false,completeD05InputLineage:false,publicD1Verified:false,
  sources:['macro','credit','supply','fundFlows','bisDsr','bisTc','rates'].map(sourceKey=>({
   sourceKey,batchKey:sourceKey+':PRIVATE_NOT_RETURNED',storedAt:1,
   storedBodySha256:'c'.repeat(64),selectionWitness:'POST_SELECTION_MATCH_ONLY'}))};
 const stableEvidenceDigestSha256=createHash('sha256').update(JSON.stringify(stable)).digest('hex');
 fs.writeFileSync(path.join(dir,'d05-composite-events-v1.jsonl'),
  JSON.stringify({status:'PREPARED_LOCAL_ONLY',...stable,
   recordedAt:'2026-11-19T12:00:01.000Z',stableEvidenceDigestSha256})+'\n');
}

test('092 simulated: unrelated Scheduler outage does not suppress fixed Core snapshot result',async()=>{
 const c=fixture();
 const out=await executeJob(req('core-runtime-source-readonly','core092-scheduler-sim-01'),
  {...c,runId:'9221',queryTask:()=>{throw Error('private scheduler error');}});
 assert.equal(out.report.status,'STATE_UNKNOWN');
 assert.equal(out.report.protectionObservation,'UNVERIFIED');
 assert.equal(out.report.protectedStateUnchanged,null);
 assert.equal(out.report.result?.status,'STATE_UNKNOWN');
 assert.ok(['CORE_WINDOWS_REQUIRED','CORE_FIXED_PROBE_UNAVAILABLE',
  'CORE_FIXED_PROBE_EXECUTION_UNAVAILABLE'].includes(out.report.result?.code));
 assert.equal(out.report.effectClass,'FIXED_READONLY_NO_PROVIDER_NO_DB');
 assert.equal(out.report.providerCalls,0);
 assert.equal(out.report.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(out.report),/private scheduler error/);
});

test('D05 fixed read preserves ledger when unrelated scheduler query is unavailable',async()=>{
 const c=fixture();fixtureD05Ledger(c);let schedulerCalls=0;
 const out=await executeJob(req('d05-lineage-readonly','d05-scheduler-unavailable-01'),
  {...c,runId:'5601',queryTask:()=>{schedulerCalls++;throw Error('private scheduler error');}});
 assert.ok(schedulerCalls>=1);
 assert.equal(out.report.status,'STATE_UNKNOWN');
 assert.equal(out.report.code,'READONLY_RESULT_PROTECTION_UNVERIFIED');
 assert.equal(out.report.result.code,'D05_READONLY_DIAGNOSIS');
 assert.equal(out.report.result.lineage.eventCount,1);
 assert.equal(out.report.result.lineage.currentApprovedSourceEventCount,1);
 assert.equal(out.report.protectedStateUnchanged,null);
 assert.equal(JSON.stringify(out.report).includes('private scheduler error'),false);
});

test('D05 fixed read keeps ledger proof when Core config JSON is unavailable',async()=>{
 const c=fixture();fixtureD05Ledger(c);
 fs.writeFileSync(path.join(c.host.dataRoot,'pc-writer','config.json'),'{invalid');
 const out=await executeJob(req('d05-lineage-readonly','d05-source-config-unavailable-01'),
  {...c,runId:'5602'});
 assert.equal(out.report.status,'STATE_UNKNOWN');
 assert.equal(out.report.code,'D05_CORE_SOURCE_OBSERVATION_UNVERIFIED');
 assert.equal(out.report.result.code,'D05_READONLY_DIAGNOSIS');
 assert.equal(out.report.result.lineage.eventCount,1);
 assert.equal(out.report.result.lineage.currentApprovedSourceEventCount,null);
 assert.equal(out.report.protectedStateUnchanged,true);
 assert.equal(out.report.coreSourceObservation,'UNVERIFIED');
});

test('D05 read succeeds without extra source lookup and detects real protected drift',async()=>{
 const c=fixture();fixtureD05Ledger(c);let queries=0;
 const ok=await executeJob(req('d05-lineage-readonly','d05-source-reuse-01'),
  {...c,runId:'5603',queryTask:()=>{queries++;return Buffer.from('fixed-task');}});
 assert.equal(ok.report.status,'PASS');
 assert.equal(ok.report.result.lineage.currentApprovedSourceEventCount,1);
 assert.equal(queries,4);
 let n=0;
 const drift=await executeJob(req('d05-lineage-readonly','d05-protected-drift-01'),
  {...c,runId:'5604',queryTask:()=>Buffer.from(++n<=2?'before':'after')});
 assert.equal(drift.report.status,'BLOCKED');
 assert.equal(drift.report.code,'PROTECTED_STATE_DRIFT_OBSERVED');
 assert.equal(drift.report.lastPass,'ALLOWLISTED_OPERATION_COMPLETED');
 assert.equal(drift.report.firstFail,'PROTECTED_STATE_POSTCHECK');
 assert.equal(drift.report.protectedStateUnchanged,false);
});

test('R6 timeout stage parser accepts only a single literal phase from own workspace',()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'zg-r6-stage-'));
 const marker=path.join(workspace,'employment-r6-readonly-stage.json');
 try{
  assert.equal(readFixedR6Stage(workspace),null);
  fs.writeFileSync(marker,JSON.stringify({stage:'ETA539_RAW_CURRENT_PARITY'}));
  assert.equal(readFixedR6Stage(workspace),'ETA539_RAW_CURRENT_PARITY');
  fs.writeFileSync(marker,JSON.stringify({stage:'../PRIVATE_PATH'}));
  assert.equal(readFixedR6Stage(workspace),null);
  fs.writeFileSync(marker,JSON.stringify({stage:'STATE_CLAIMS_51_COVERAGE',raw:'must-not-report'}));
  assert.equal(readFixedR6Stage(workspace),null);
  fs.writeFileSync(marker,'x'.repeat(129));
  assert.equal(readFixedR6Stage(workspace),null);
  fs.writeFileSync(marker,'{ malformed');
  assert.equal(readFixedR6Stage(workspace),null);
 }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
