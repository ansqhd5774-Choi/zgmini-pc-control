import './w04-3409-source-preflight-readonly.test.mjs';
import './w04-3516-archive-receipt-readonly.test.mjs';
import test from 'node:test';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectTask, TASK} from '../tools/marketparquet-task-source-readonly.mjs';
import {safeRuntimeSignals} from '../tools/automation-status.mjs';
import {inspectCiControllerBReceiverReadOnly} from '../tools/pc-process-inventory-readonly.mjs';
import assert from 'node:assert/strict';
import {classifyInstalledReconciliationProof,main as maintenanceRecoveryMain} from '../tools/maintenance-recovery.mjs';
import {authenticateProcess,collect,sanitizeProbe,sanitizeMaintenanceStatus,project2960MaintenanceStatus,project3409MaintenanceStatus,compact3409ProcessResult,projectEr1PostcheckLinkReadonly,assess3409OriginalLeaseLineage,project3516MaintenanceStatus,compact3516ProcessResult,assess3516OriginalLeaseLineage,project3409PauseWindows,compare2960ProtectedBaseline,classify2960ProtectionDifference,assess2960OriginalLeaseLineage,compact2960ProcessResult,projectD05WriterCheckpoint,compactD05WriterResult,inspectD05PrivateFinalReceiptReadonly,classify996LeaseCorrelation,inspect996LeaseCorrelation,classify1501LeaseCorrelation,inspect1501LeaseCorrelation,classify1501RecoveryCheckpoint,classify1841RecoveryCheckpoint,summarize2094StageStatus,inspect2094StageReadonly,project2505RecoveryReadonly,inspect2505RecoveryReadonly,inspect2505RecoveryByteProof,project2505WriterSourceOnlyDelta,inspect1841LeaseCorrelation,inspectW052821RecoveryCasReadonly,inspectW052821CheckoutReadonly,classifyW052821OwnerPidChronology,sanitizeW05OperatorTopologyProbe,collectW05OperatorTopology,w05OperatorTopologyText,projectObservedProviderHosts,classify1501BacklogBytes,inspect1501BacklogReadonly,sanitizeRuntimeSignals,sanitizeDedicatedRunnerEvidence,projectTargetEndpointStatus,serializeProcessResult,toText,SCHEMA,TITLE,ROLE_OPERATION}
 from '../tools/pc-process-inventory-readonly.mjs';
import {inspect3160RecoveryCasReadonly} from '../tools/pc-process-inventory-readonly.mjs';
import {inspect3160RollbackPreflightReadonly} from '../tools/pc-process-inventory-readonly.mjs';
import {projectCnnSidecarStaticGuard} from '../tools/pc-process-inventory-readonly.mjs';
import {inspectR3WatchdogPreimageReadonly} from '../tools/pc-process-inventory-readonly.mjs';
import {classifyR3RunnerWmiRows,inspectR3RunnerWmiReadonly} from '../tools/pc-process-inventory-readonly.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
function event(role='operating'){
 const request={schema:SCHEMA,operation:ROLE_OPERATION,role,
  requestId:'2d605c34-939e-43e4-8ca1-58d678bf3862'};
 return {action:'opened',repository:{full_name:REPO,private:true},
  issue:{number:2001,user:{login:'ansqhd5774-Choi'},title:TITLE,
   body:JSON.stringify(request)}};
}
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ID:'43110000000',GITHUB_RUN_ATTEMPT:'1'};
test('exact read-only schema, owner, roles and run provenance',()=>{
 assert.equal(authenticateProcess(event(),env,'operating').role,'operating');
 assert.equal(authenticateProcess(event('handoff'),env,'handoff').role,'handoff');
 for(const role of ['operating','handoff']){
  const e=event(role),b=JSON.parse(e.issue.body);
  for(const prop of ['cmd','path','script','token','operationWrites']){
   assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
    body:JSON.stringify({...b,[prop]:'not-allowed'})}},env,role));
  }
 }
 assert.throws(()=>authenticateProcess({...event(),action:'labeled'},env,'operating'));
 assert.throws(()=>authenticateProcess(event(),{...env,GITHUB_ACTOR:'other'},'operating'));
});

test('#3409 fixed maintenance scope accepts operating only and rejects paths',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const scoped={...e,issue:{...e.issue,body:JSON.stringify({...p,
  probe:'w04-3409-maintenance-status-readonly'})}};
 assert.equal(authenticateProcess(scoped,env,'operating').w043409MaintenanceStatus,true);
 assert.throws(()=>authenticateProcess(scoped,env,'handoff'));
 for(const probe of ['w04-3409-maintenance-status-readonly;cmd','w04-3410-maintenance-status-readonly']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
  body:JSON.stringify({...p,probe:'w04-3409-maintenance-status-readonly',
   path:'E:/private'})}},env,'operating'));
});
test('#3409 original maintenance ledger projection strips secrets and fails closed',()=>{
 const requestId='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
 const fixture={actualControllerSha:'6'.repeat(40),workflowState:'active',
  historicalRequest:{requestId,status:'RECOVERY_REQUIRED',code:'POSTCHECK_OUTCOME_UNKNOWN',
   phase:'RECOVERY_REQUIRED',firstFail:'POSTCHECK_PENDING',postIssueNumber:3410,
   secret:'SECRET_LEDGER'},
  recoveryEvidence:{requestId,leaseHeld:true,recoveryRequired:true,
   installLease:{directory:'PRESENT',ownerFile:'PRESENT',recoveryMarker:'PRESENT',
    ownerMarkerMatch:true,ownerPid:12345,nonce:'SECRET_OWNER'},
   backlog:{file:'PRESENT',windows:1,openWindows:0,replayCount:0,secret:'SECRET_BACKLOG'}}};
 const result=project3409MaintenanceStatus(fixture);
 assert.equal(result.status,'READ_ONLY_OBSERVED');
 assert.equal(result.historicalRequest.postIssueNumber,3410);
 assert.equal(result.recoveryEvidence.recoveryRequired,true);
 assert.equal(result.recoveryEligible,false);
 assert.equal(result.protectedStateUnchanged,null);
 assert.doesNotMatch(JSON.stringify(result),/SECRET|nonce|ownerPid|token/i);
 const compact=compact3409ProcessResult({requestId:'fixed'},result);
 assert.equal(compact.status,'PASS');
 assert.ok(Buffer.byteLength(JSON.stringify(compact))<32768);
 assert.equal(project3409MaintenanceStatus({...fixture,recoveryEvidence:{
  ...fixture.recoveryEvidence,requestId:'another-request'}}).status,'STATE_UNKNOWN');
 assert.equal(project3409MaintenanceStatus(null).status,'STATE_UNKNOWN');
 assert.equal(compact3409ProcessResult({requestId:'fixed'},
  project3409MaintenanceStatus(null)).status,'PARTIAL');
});
test('#3587 fixed ER1 postcheck link probe only accepts operating role and exact input',()=>{
 const e=event(),p=JSON.parse(e.issue.body),probe='w04-3587-postcheck-link-readonly';
 const scoped={...e,issue:{...e.issue,body:JSON.stringify({...p,probe})}};
 assert.equal(authenticateProcess(scoped,env,'operating').w043587PostcheckLink,true);
 assert.throws(()=>authenticateProcess(scoped,env,'handoff'));
 for(const bad of ['w04-3588-postcheck-link-readonly',probe+';cmd']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe:bad})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
  body:JSON.stringify({...p,probe,path:'E:/private'})}},env,'operating'));
});
test('#3587 local ledger projection distinguishes actual linked pair from external PASS',()=>{
 const id='pc-update-f4ad863b-608b-4c04-b23c-921a8b4823fe';
 const fixture={requestId:id,issueNumber:3587,
  targetSha:'502aac841475fa94b7cc9d56c028fd38b0554831',
  postIssueNumber:3590,secret:'NEVER_EXPOSE_LEDGER_SECRET',
  postcheckLink:{schema:'ZGMINI_MAINTENANCE_POSTCHECK_LINK_V1',
   requestId:id,issueNumber:3590,state:'RESULT_REPORTED',
   reportedRunJobLinked:true,runId:45617472368,jobId:139216506442,
   reportedStatus:'PASS',postSourceVerified:true,
   observedAtUtc:'2026-11-25T12:50:00.000Z',nonce:'NEVER_EXPOSE_NONCE'}};
 const good=projectEr1PostcheckLinkReadonly(fixture);
 assert.equal(good.status,'PASS');
 assert.equal(good.exactRunJobMatched,true);
 assert.equal(good.reportedRunJobLinked,true);
 assert.equal(good.sourceCommitExistenceVerified,null);
 assert.equal(good.postSourceMetadataMatched,true);
 assert.equal(good.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(good),/NEVER_EXPOSE|nonce|secret/);
 for(const alteration of [
  {postIssueNumber:3591},{targetSha:'a'.repeat(40)},
  {requestId:'other'},{issueNumber:3590}
 ]){
  assert.equal(projectEr1PostcheckLinkReadonly({...fixture,...alteration}).status,'STATE_UNKNOWN');
 }
 for(const linkChange of [
  {reportedRunJobLinked:false},{reportedRunJobLinked:undefined},
  {runId:45617472369},{jobId:139216506443},
  {reportedStatus:'FAIL'},{issueNumber:3591}
 ]){
  const r=projectEr1PostcheckLinkReadonly({...fixture,
   postcheckLink:{...fixture.postcheckLink,...linkChange}});
  assert.notEqual(r.status,'PASS');
  assert.equal(r.exactRunJobMatched,false);
 }
 assert.equal(projectEr1PostcheckLinkReadonly(null).status,'STATE_UNKNOWN');
 assert.equal(projectEr1PostcheckLinkReadonly({...fixture,
  postcheckLink:{...fixture.postcheckLink,requestId:'other'}}).status,'STATE_UNKNOWN');
 assert.ok(Buffer.byteLength(JSON.stringify(good))<2048);
});
test('W04 #3409 pause-window projection is exact, bounded and redacts raw data',()=>{
 const id='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
 const pausedAt='2026-11-24T17:08:20.000Z',resumedAt='2026-11-24T17:09:30.000Z';
 const x={schema:'ZGMINI_PC_BACKLOG_V1',requestId:id,
  windows:[{pausedAt,resumedAt,nonce:'PRIVATE_VALUE'}],replays:{secret:'PRIVATE_VALUE'}};
 assert.deepEqual(project3409PauseWindows(x),[{pausedAtUtc:pausedAt,resumedAtUtc:resumedAt}]);
 assert.doesNotMatch(JSON.stringify(project3409PauseWindows(x)),/PRIVATE_VALUE|nonce|replays/);
 assert.equal(project3409PauseWindows({...x,requestId:'wrong'}),null);
 assert.equal(project3409PauseWindows({...x,windows:[{pausedAt,resumedAt:'2026-11-24T17:01:00.000Z'}]}),null);
 assert.equal(project3409PauseWindows({...x,windows:Array(9).fill({pausedAt,resumedAt})}),null);
 assert.deepEqual(project3409PauseWindows({...x,windows:[{pausedAt,resumedAt:null}]}),
  [{pausedAtUtc:pausedAt,resumedAtUtc:null}]);
 assert.equal(project3409PauseWindows({...x,windows:[{pausedAt:'NOT_DATE',resumedAt}]}),null);
});
test('W04 #3409 lease lineage requires exact request, target, owner and chronology',()=>{
 const id='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
 const target='6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4';
 const ledger={requestId:id,issueNumber:3409,status:'RECOVERY_REQUIRED',
  firstFail:'POSTCHECK_PENDING',postIssueNumber:3410,targetSha:target,
  updatedAt:'2026-11-24T17:15:43.183Z'};
 const owner={pid:3210,nonce:'11111111-2222-4333-8444-555555555555',
  at:'2026-11-24T17:08:01.000Z'};
 const marker={requestOwnerPid:3210,nonce:owner.nonce,
  at:'2026-11-24T17:15:43.300Z'};
 assert.equal(assess3409OriginalLeaseLineage(ledger,owner,marker).correlated,true);
 for(const change of [
  {requestId:'not-original'},{issueNumber:999},{postIssueNumber:999},
  {targetSha:'a'.repeat(40)},{status:'PASS'}]){
  assert.equal(assess3409OriginalLeaseLineage({...ledger,...change},owner,marker).correlated,false);
 }
 assert.equal(assess3409OriginalLeaseLineage(ledger,owner,{...marker,nonce:'different'}).correlated,false);
 assert.equal(assess3409OriginalLeaseLineage(ledger,owner,
  {...marker,at:'2026-11-24T17:30:00.000Z'}).correlated,false);
});
test('#2960 exact recovery probe rejects arbitrary parameters and handoff host',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const q={...e,issue:{...e.issue,body:JSON.stringify({...p,
  probe:'w05-2960-maintenance-status-readonly'})}};
 assert.equal(authenticateProcess(q,env,'operating').w052960MaintenanceStatus,true);
 assert.throws(()=>authenticateProcess(q,env,'handoff'));
 for(const probe of ['maintenance-status','w05-2960-other','w05-2960-maintenance-status-readonly;cmd']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
  body:JSON.stringify({...p,probe:'w05-2960-maintenance-status-readonly',
   path:'SECRET'})}},env,'operating'));
});
test('#2960 exact status strips secrets and never authorizes recovery',()=>{
 const id='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
 const r={actualControllerSha:'a'.repeat(40),workflowState:'active',
  historicalRequest:{requestId:id,status:'RECOVERY_REQUIRED',
   firstFail:'POSTCHECK_PENDING',code:'POSTCHECK_OUTCOME_UNKNOWN',
   phase:'RECOVERY_REQUIRED',postIssueNumber:2965,secret:'SECRET_H'},
  recoveryEvidence:{requestId:id,leaseHeld:true,recoveryRequired:true,
   backlog:{file:'PRESENT',windows:2,openWindows:0,replayCount:0,secret:'SECRET_B'},
   installLease:{directory:'PRESENT',ownerFile:'PRESENT',
    recoveryMarker:'PRESENT',ownerMarkerMatch:true,nonce:'SECRET_L'}}};
 const out=project2960MaintenanceStatus(r);
 assert.equal(out.status,'READ_ONLY_OBSERVED');
 assert.equal(out.historicalRequest.firstFail,'POSTCHECK_PENDING');
 assert.equal(out.recoveryEvidence.backlog.windows,2);
 assert.equal(out.leaseBoundToOriginalRequest,null);
 assert.equal(out.recoveryEligible,false);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|nonce|ownerPid|command/i);
 assert.equal(project2960MaintenanceStatus({...r,recoveryEvidence:{
  ...r.recoveryEvidence,requestId:'wrong'}}).status,'STATE_UNKNOWN');
 assert.equal(project2960MaintenanceStatus(null).status,'STATE_UNKNOWN');
});


test('#2960 compact receipt respects 32 KiB atomic result limit',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',role:'operating',
  requestId:'21f1eecd-4f3b-443e-89cd-f6362871f9ea',issueNumber:2977,
  runId:'45184776880',attempt:'1',host:'PC',runnerName:'zgmini-pc-03',
  operationalWrites:0,providerCalls:0,d1Writes:0,automaticRetries:0};
 const id='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
 const s=project2960MaintenanceStatus({actualControllerSha:'a'.repeat(40),
  workflowState:'active',historicalRequest:{requestId:id,status:'RECOVERY_REQUIRED'},
  recoveryEvidence:{requestId:id,leaseHeld:true,recoveryRequired:true,
   backlog:{file:'PRESENT',windows:1,openWindows:0,replayCount:0}}});
 const out=compact2960ProcessResult(base,s);
 assert.equal(out.status,'PASS');
 assert.equal(out.w052960MaintenanceStatus.status,'READ_ONLY_OBSERVED');
 assert.equal(out.snapshot,undefined);
 assert.equal(out.maintenance,undefined);
 assert.ok(Buffer.byteLength(serializeProcessResult(out))<32768);
 assert.ok(Buffer.byteLength(toText(out))<32768);
 assert.equal(compact2960ProcessResult(base,project2960MaintenanceStatus(null)).status,'PARTIAL');
});

test('D05 fixed Writer probe uses exact operating-only request contract',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const q={...e,issue:{...e.issue,body:JSON.stringify({...p,probe:'d05-writer-checkpoint-readonly'})}};
 assert.equal(authenticateProcess(q,env,'operating').d05WriterCheckpoint,true);
 assert.throws(()=>authenticateProcess(q,env,'handoff'));
 for(const probe of ['d05-writer-status','d05-writer-checkpoint-readonly -c',
  'd05-writer-checkpoint-readonly\\\\cmd']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
  body:JSON.stringify({...p,probe:'d05-writer-checkpoint-readonly',
   file:'E:/SECRET'})}},env,'operating'));
});
test('D05 Writer checkpoint projection distinguishes unchanged and unproven without leaking data',()=>{
 const raw={at:'2026-11-23T13:40:15.000Z',mode:'PUBLISH',
  status:'VERIFIED',source:'a'.repeat(40),
  market:{status:'LOCAL_STORED'},compositeObserved:{status:'UNCHANGED'},
  d05PrivateLineageStatus:'UNPROVEN',
  credentials:'SECRET',failure:{message:'SECRET'},providerInputs:['SECRET']};
 const out=projectD05WriterCheckpoint(raw);
 assert.equal(out.status,'READ_ONLY_OBSERVED');
 assert.equal(out.compositeArchiveStage,'UNCHANGED');
 assert.equal(out.actualLineageAppendProven,false);
 assert.equal(out.archiveAppendConditionMet,false);
 assert.equal(out.recoveryEligible,false);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|credentials|providerInputs|message/);
 const yes=projectD05WriterCheckpoint({...raw,market:{status:'VERIFIED'},
  compositeObserved:{status:'LOCAL_STORED'},
  d05PrivateLineageStatus:'APPENDED_VERIFIED_LOCAL_ONLY'});
 assert.equal(yes.marketStage,'VERIFIED');
 assert.equal(yes.archiveAppendConditionMet,true);
 assert.equal(yes.actualLineageAppendProven,true);
 const missing=projectD05WriterCheckpoint({...raw,d05PrivateLineageStatus:null});
 assert.equal(missing.d05PrivateLineageStage,null);
 assert.equal(projectD05WriterCheckpoint(null).status,'STATE_UNKNOWN');
 assert.equal(projectD05WriterCheckpoint({...raw,status:'SECRET'}).status,'STATE_UNKNOWN');
 const base={schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',role:'operating',
  requestId:'218d558d-418a-4967-a015-7c2e43261bfd',issueNumber:2985,
  runId:'45187447318',attempt:'1',host:'PC',runnerName:'zgmini-pc-03',operationalWrites:0,
  providerCalls:0,d1Writes:0,automaticRetries:0};
 const compact=compactD05WriterResult(base,out);
 assert.equal(compact.status,'PASS');
 assert.ok(Buffer.byteLength(serializeProcessResult(compact))<32768);
 assert.ok(Buffer.byteLength(toText(compact))<32768);
});

test('sanitize output keeps only bounded whitelisted Windows process metadata',()=>{
 const result=sanitizeProbe({schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  observedAtUtc:'2026-11-12T10:00:00Z',totalProcessCount:151,
  selectedProcessCount:84,processCounts:[{name:'Runner.Listener.exe',count:6},
   {name:'node.exe',count:10},{name:'cmd.exe',count:16},{name:'conhost.exe',count:39}],processes:[
  {name:'Runner.Listener.exe',pid:44,ppid:3,session:1,workingSetMiB:84,commandLine:'super-secret'},
  {name:'node.exe',pid:46,ppid:44,session:1,workingSetMiB:31,
   path:'C:\\Users\\secret'}],services:[{name:'actions.runner.zgmini-pc-03',
  state:'Running',startMode:'Auto',path:'C:\\SECRET'}],
  serviceStatus:'OK',tasks:[{name:'ZGMINI-PC-Local-Core',state:'Ready',argument:'SECRET'}],
  taskStatus:'OK',startup:['ZGMINI_PC_CONTROL.vbs'],startupStatus:'OK'});
 assert.equal(result.processes.length,2);
 assert.equal(result.totalProcessCount,151);
 assert.equal(result.processCounts.find(x=>x.name==='Runner.Listener.exe').count,6);
 assert.equal(result.processListTruncated,true);
 assert.doesNotMatch(JSON.stringify(result),/super-secret|C:\\Users|SECRET/);
 assert.equal(result.services[0].startMode,'Auto');
 assert.equal(result.tasks[0].state,'Ready');
});
test('aggregated memory coverage exposes only fixed process classes and private commit',()=>{
 const sample={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:3,
  selectedProcessCount:1,processes:[
   {name:'node.exe',pid:12,ppid:10,session:1,workingSetMiB:0,
    privateCommitMiB:512,commandLine:'SECRET'}],
  memoryGroups:[
   {kind:'NODE_NONRUNNER',count:1,workingSetMiB:0,privateCommitMiB:512,
    zeroWorkingSetCount:1,unknownWorkingSetCount:0,unknownPrivateCommitCount:0,
    commandLine:'SECRET'},
   {kind:'OTHER_PROCESSES',count:2,workingSetMiB:300,privateCommitMiB:900,
    zeroWorkingSetCount:0,unknownWorkingSetCount:0,unknownPrivateCommitCount:0,
    applicationName:'Private-Browser'}]};
 const out=sanitizeProbe(sample);
 assert.equal(out.memoryGroupCoverage,'COUNT_COMPLETE');
 assert.equal(out.memoryGroups.reduce((n,g)=>n+g.count,0),3);
 assert.equal(out.memoryGroups[0].privateCommitMiB,512);
 assert.equal(out.processes[0].privateCommitMiB,512);
 assert.equal(out.processes[0].workingSetMiB,0);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|Private-Browser|applicationName|commandLine/);
 assert.equal(sanitizeProbe({...sample,totalProcessCount:4}).memoryGroupCoverage,'COUNT_PARTIAL');
 assert.equal(sanitizeProbe({...sample,memoryGroups:[]}).memoryGroupCoverage,'UNAVAILABLE');
});
test('memory groups fail closed for unapproved labels and forged counters',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  processes:[],services:[],tasks:[]};
 const valid={kind:'NODE_NONRUNNER',count:1,workingSetMiB:0,
  privateCommitMiB:30,zeroWorkingSetCount:1,
  unknownWorkingSetCount:0,unknownPrivateCommitCount:0};
 const cases=[
  [{...valid,kind:'secret-app.exe'}],
  [{...valid,zeroWorkingSetCount:2}],
  [{...valid,privateCommitMiB:-1}],
  [valid,valid]];
 for(const groups of cases)
  assert.throws(()=>sanitizeProbe({...base,memoryGroups:groups}));
});
test('compact result preserves full memory attribution and large readonly roster without truncation',()=>{
 const complete={schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
  role:'operating',status:'PASS',code:'PROCESS_INVENTORY_COLLECTED',
  snapshot:{memoryGroupCoverage:'COUNT_COMPLETE',
   memoryGroups:[{kind:'NODE_NONRUNNER',count:14,workingSetMiB:0,
    privateCommitMiB:3000,zeroWorkingSetCount:14,
    unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
   processes:Array.from({length:60},(_,i)=>({name:'node.exe',pid:i+1,
    ppid:123,session:1,workingSetMiB:0,privateCommitMiB:90}))},
  observedHttpHostRoster:{hosts:Array.from({length:32},(_,i)=>({
   host:'example-'+i+'.gov',summary:'X'.repeat(180),readOnly:true}))}};
 const raw=serializeProcessResult(complete);
 assert.ok(Buffer.byteLength(raw)<32768);
 assert.ok(Buffer.byteLength(raw)<Buffer.byteLength(JSON.stringify(complete,null,2)));
 assert.deepEqual(JSON.parse(raw),complete);
 assert.match(raw,/privateCommitMiB/);
});
test('bounded broad categories resolve OTHER process group without leaking names',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:4,
  selectedProcessCount:0,processes:[],services:[],tasks:[],
  memoryGroups:[{kind:'OTHER_PROCESSES',count:4,workingSetMiB:4000,
   privateCommitMiB:3000,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
  otherSubgroups:[
   {category:'BROWSER_WEBVIEW',count:2,workingSetMiB:3000,privateCommitMiB:2000,
    processName:'DO_NOT_LEAK_USER_APP'},
   {category:'WINDOWS_CORE_UI',count:1,workingSetMiB:700,privateCommitMiB:600},
   {category:'UNCLASSIFIED_OTHER',count:1,workingSetMiB:300,privateCommitMiB:400}],
  otherTopMemory:[{category:'BROWSER_WEBVIEW',workingSetMiB:2500,
   privateCommitMiB:1600,commandLine:'SECRET_DO_NOT_LEAK'}]};
 const out=sanitizeProbe(base);
 assert.equal(out.memoryGroupCoverage,'COUNT_COMPLETE');
 assert.equal(out.otherSubgroupCoverage,'COUNT_COMPLETE');
 assert.equal(out.otherSubgroups.reduce((n,g)=>n+g.count,0),4);
 assert.equal(out.otherTopMemory[0].workingSetMiB,2500);
 assert.deepEqual(Object.keys(out.otherTopMemory[0]),
  ['category','workingSetMiB','privateCommitMiB']);
 assert.doesNotMatch(JSON.stringify(out),/DO_NOT_LEAK|SECRET|processName|commandLine/);
 assert.equal(sanitizeProbe({...base,otherSubgroups:base.otherSubgroups.slice(0,2)})
  .otherSubgroupCoverage,'COUNT_PARTIAL');
 assert.equal(sanitizeProbe({...base,otherSubgroups:[]}).otherSubgroupCoverage,'UNAVAILABLE');
});
test('broad category sanitizer rejects names, forged data, duplicate classes',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  processes:[],memoryGroups:[{kind:'OTHER_PROCESSES',count:1,
   workingSetMiB:123,privateCommitMiB:66,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}]};
 const valid={category:'UNCLASSIFIED_OTHER',count:1,
  workingSetMiB:123,privateCommitMiB:66};
 for(const groups of [
  [{...valid,category:'private.exe'}],
  [{...valid,workingSetMiB:-1}],
  [valid,valid]
 ])assert.throws(()=>sanitizeProbe({...base,otherSubgroups:groups}));
 for(const row of [
  {category:'private.exe',workingSetMiB:123,privateCommitMiB:1},
  {category:'WINDOWS_CORE_UI',workingSetMiB:-1,privateCommitMiB:1},
 ])assert.throws(()=>sanitizeProbe({...base,otherTopMemory:[row]}));
});
test('reject unapproved process names, task names, service names',()=>{
 const raw={schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  processes:[{name:'unknown.exe',pid:1,ppid:0}],services:[],tasks:[]};
 assert.throws(()=>sanitizeProbe(raw),/PROBE_PROCESS_NOT_ALLOWLISTED/);
 assert.throws(()=>sanitizeProbe({...raw,processes:[],tasks:[{name:'MicrosoftWindows',state:'Ready'}]}));
 assert.throws(()=>sanitizeProbe({...raw,processes:[],services:[{name:'SecretsService',state:'Running'}]}));
});
test('result text is limited to safe run summary',()=>{
 const text=toText({schema:'R',requestId:'id',role:'handoff',runId:'1',
  attempt:'1',host:'PC',runnerName:'runner',status:'PASS',
  code:'PROCESS_INVENTORY_COLLECTED',observedAtUtc:'2026-11-12T00:00Z',
  snapshot:{totalProcessCount:140,selectedProcessCount:12}});
 assert.match(text,/totalProcessCount=140/);
 assert.doesNotMatch(text,/cmd|token|AppData|C:\\Users/i);
});
test('no implicit cross-host worker execution',()=>{
 const out=collect('operating',{requestId:'id',issueNumber:2,runId:'2',attempt:'1'},
  {RUNNER_NAME:'zgmini-handoff-ci-spare-01'});
 assert.equal(out.status,'BLOCKED');
});

test('CI installed policy readback never exposes the CI installed policy or local path',()=>{
 const fixed='E:/ZGmini/automation/pc-maintenance/MAINTENANCE_INSTALL.json';
 const base={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:'a'.repeat(40),startupSha256:'b'.repeat(64),
  files:Object.fromEntries(Array.from({length:7},(_,i)=>['tools/file'+i+'.mjs','c'.repeat(64)])),
  token:'NEVER_PRINT_PRIVATE_TOKEN',root:'E:/PRIVATE_CREDENTIAL_ROOT'};
 const policy={schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',enabled:true,
  workflowId:430972394,workflowBlobSha:'d'.repeat(40),
  workflowPath:'.github/workflows/ci-approval-controller-b.yml'};
 const fake=(content,{link=false,size=160}={})=>({
  lstatSync:p=>{assert.equal(p,fixed);return{
   isFile:()=>true,isSymbolicLink:()=>link,size};},
  readFileSync:(p,encoding)=>{assert.equal(p,fixed);assert.equal(encoding,'utf8');return content;}
 });
 const absent=inspectCiControllerBReceiverReadOnly(fake(JSON.stringify(base)));
 assert.equal(absent.policyState,'ABSENT_IN_INSTALLED_MANIFEST');
 assert.equal(absent.manifestReadable,true);
 const present=inspectCiControllerBReceiverReadOnly(fake(JSON.stringify({...base,ciControllerBPolicy:policy})));
 assert.equal(present.policyState,'PRESENT_FORMAT_ONLY');
 assert.equal(present.installedSourceIntegrityAsserted,false);
 assert.equal(present.executionAuthorized,false);
 assert.equal(present.operationalWrites,0);
 const invalid=inspectCiControllerBReceiverReadOnly(fake(JSON.stringify({...base,
  ciControllerBPolicy:{...policy,workflowBlobSha:'BAD'}})));
 assert.equal(invalid.policyState,'INVALID');
 for(const value of [invalid,absent,present])
  assert.doesNotMatch(JSON.stringify(value),/PRIVATE|TOKEN|credential|430972394|dddddddd/i);
 for(const value of [invalid,absent,present])assert.equal(JSON.stringify(value).includes('E:/'),false);
 for(const unverified of [
  inspectCiControllerBReceiverReadOnly(fake('invalid JSON')),
  inspectCiControllerBReceiverReadOnly(fake(JSON.stringify(base),{link:true})),
  inspectCiControllerBReceiverReadOnly(fake(JSON.stringify(base),{size:131073})),
  inspectCiControllerBReceiverReadOnly({lstatSync:()=>{throw Error('PRIVATE PATH')}}),
  inspectCiControllerBReceiverReadOnly(fake('{}'))
 ])assert.equal(unverified.policyState,'UNVERIFIED');
});

test('operating maintainer status exposes only bounded hashes and safe lease booleans',()=>{
 const raw={maintenanceSourceSha:'a'.repeat(40),actualControllerSha:'b'.repeat(40),
  maintenanceFilesVerified:true,controllerFilesVerified:true,
  installLock:{held:true,recoveryRequired:true,owner:{nonce:'SECRET_NONCE'}},
  diagnostics:[],receiverStatus:'LISTENING',workflowState:'active',
  observedAt:'2026-11-13T01:02:03.123Z',privatePath:'E:/SECRET',
  token:'super-secret'};
 const out=sanitizeMaintenanceStatus(raw);
 assert.equal(out.status,'PASS');
 assert.equal(out.maintenanceSourceSha,'a'.repeat(40));
 assert.equal(out.actualControllerSha,'b'.repeat(40));
 assert.equal(out.installLockHeld,true);
 assert.equal(out.installLockRecoveryRequired,true);
 assert.equal(out.observedAtUtc,'2026-11-13T01:02:03.123Z');
 assert.equal(out.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|nonce|token|privatePath|owner/i);
});
test('missing lease evidence is unknown even if fallback marker claims it is held',()=>{
 const out=sanitizeMaintenanceStatus({maintenanceSourceSha:'a'.repeat(40),
  maintenanceFilesVerified:true,installLock:{held:true,recoveryRequired:true},
  diagnostics:['INSTALL_LEASE_UNAVAILABLE']});
 assert.equal(out.status,'STATE_UNKNOWN');
 assert.equal(out.installLockReadbackVerified,false);
 assert.equal(out.installLockHeld,null);
 assert.equal(out.installLockRecoveryRequired,null);
 assert.equal(sanitizeMaintenanceStatus(null).status,'STATE_UNKNOWN');
 assert.equal(sanitizeMaintenanceStatus({maintenanceSourceSha:'invalid'}).maintenanceSourceSha,null);
});

const pinned996=()=>({
 lockBefore:{held:true,recoveryRequired:true,ownerPid:4567},
 lockAfter:{held:true,recoveryRequired:true,ownerPid:4567},
 first:{
  owner:Buffer.from(JSON.stringify({pid:4567,nonce:'11111111-2222-4333-8444-555555555555',
   at:'2026-11-12T20:32:30.000Z'})),
  marker:Buffer.from(JSON.stringify({requestOwnerPid:4567,nonce:'11111111-2222-4333-8444-555555555555',
   at:'2026-11-12T20:32:32.000Z'})),
  ledger:Buffer.from(JSON.stringify({requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
   issueNumber:996,targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
   updatedAt:'2026-11-12T20:32:33.000Z'}))
 }
});
test('fixed 996 lease snapshots correlate only owner marker and pinned original ledger',()=>{
 const x=pinned996();x.second={...x.first};
 const result=classify996LeaseCorrelation(x);
 assert.equal(result.status,'CORRELATED');
 assert.equal(result.ownerPid,4567);
 assert.equal(result.ownerMarkerIdentityMatched,true);
 assert.equal(result.ledger996Matched,true);
 assert.equal(result.ledgerMarkerTimeMatched,true);
 for(const sha of ['ownerSha256','markerSha256','ledgerSha256'])
  assert.match(result[sha],/^[0-9a-f]{64}$/);
 assert.doesNotMatch(JSON.stringify(result),/11111111|targetSha|owner\\.json|nonce|owner\\.at|ZGmini/i);
});
test('mismatched original request and changed file snapshots never claim C996 ownership',()=>{
 const base=pinned996();
 const wrong={...base,second:{...base.first},
  first:{...base.first,ledger:Buffer.from(JSON.stringify({requestId:'another-request',
   issueNumber:996,targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
   updatedAt:'2026-11-12T20:32:33.000Z'}))}};
 wrong.second={...wrong.first};
 assert.equal(classify996LeaseCorrelation(wrong).status,'STATE_UNKNOWN');
 assert.equal(classify996LeaseCorrelation(wrong).ledger996Matched,false);
 const drifting={...base,second:{...base.first,
  marker:Buffer.from('changed between snapshots')}};
 assert.equal(classify996LeaseCorrelation(drifting).code,'C996_ORIGINAL_SNAPSHOT_UNVERIFIED');
 assert.equal(classify996LeaseCorrelation({
  ...base,lockAfter:{held:false,recoveryRequired:false}}).status,'STATE_UNKNOWN');
});
test('read-only collector fails closed without fixed local files',()=>{
 const result=inspect996LeaseCorrelation({
  lock:()=>({held:true,recoveryRequired:true,ownerPid:4567}),
  stat:()=>{throw Error('offline');},
  read:()=>{throw Error('no file');}});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'C996_ORIGINAL_FILES_UNAVAILABLE');
 assert.equal(result.operationalWrites,0);
});
test('fixed 1501 lease snapshot distinguishes current owner from unrelated C996 ledger',()=>{
 const p=pinned996(),o=JSON.parse(p.first.owner.toString('utf8'));
 const ledger={requestId:'pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b',
  issueNumber:1501,targetSha:'b2ff49dd14a09ebeba482e2ae9a84530e00f094f',
  updatedAt:'2026-11-12T20:32:33.000Z'};
 const x={...p,first:{...p.first,ledger:Buffer.from(JSON.stringify(ledger))}};
 x.second={...x.first};
 const ok=classify1501LeaseCorrelation(x);
 assert.equal(ok.status,'CORRELATED');
 assert.equal(ok.code,'C1501_LEASE_IDENTITY_CORRELATED');
 assert.equal(ok.ledger1501Matched,true);
 assert.equal(ok.ownerMarkerIdentityMatched,true);
 assert.equal(ok.ledgerMarkerTimeMatched,true);
 assert.equal(Object.hasOwn(ok,'ledger996Matched'),false);
 assert.equal(classify996LeaseCorrelation(x).status,'STATE_UNKNOWN');
 const late={...x,first:{...x.first,ledger:Buffer.from(JSON.stringify({...ledger,
  updatedAt:'2026-11-16T12:00:00.000Z'}))}};
 late.second={...late.first};
 const mis=classify1501LeaseCorrelation(late);
 assert.equal(mis.status,'STATE_UNKNOWN');
 assert.equal(mis.ledger1501Matched,true);
 assert.equal(mis.ledgerMarkerTimeMatched,false);
 assert.doesNotMatch(JSON.stringify(mis),/95a0c24a|b2ff49dd|11111111|nonce|ZGmini/i);
});
test('fixed 1501 operation never follows user-controlled path or mutates files',()=>{
 const q=inspect1501LeaseCorrelation({lock:()=>({held:true,recoveryRequired:true,ownerPid:42}),
  stat:()=>{throw Error('no mounted ledger');},
  read:()=>{throw Error('unexpected read');}});
 assert.equal(q.status,'STATE_UNKNOWN');
 assert.equal(q.code,'C1501_ORIGINAL_FILES_UNAVAILABLE');
 assert.equal(q.operationalWrites,0);
 assert.equal(Object.hasOwn(q,'ledger996Matched'),false);
});
test('1501 recovery checkpoint preserves phase and PID existence without claiming safe release',()=>{
 const x=pinned996();
 x.first.ledger=Buffer.from(JSON.stringify({
  requestId:'pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b',
  issueNumber:1501,targetSha:'b2ff49dd14a09ebeba482e2ae9a84530e00f094f',
  status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'RECONNECTED',
  failureOperation:'resumeIntake',intakePaused:true,workflowEnabled:false,
  updatedAt:'2026-11-12T20:32:33.000Z',token:'SECRET_TOKEN'}));
 x.second={...x.first};
 const z=classify1501RecoveryCheckpoint(x,{
  signal:(pid,flag)=>{assert.equal(pid,4567);assert.equal(flag,0);},
  backupPresent:true,backlogPresent:false});
 assert.equal(z.status,'CORRELATED');
 assert.equal(z.ledgerPhase,'RECOVERY_REQUIRED');
 assert.equal(z.ledgerFirstFail,'RECONNECTED');
 assert.equal(z.ledgerFailureOperation,'resumeIntake');
 assert.equal(z.ownerPidObservation,'PID_PRESENT_IDENTITY_UNVERIFIED');
 assert.equal(z.backupPresent,true);
 assert.equal(z.backlogPresent,false);
 assert.equal(z.eligibleForAutomaticRelease,false);
 assert.doesNotMatch(JSON.stringify(z),/SECRET_TOKEN|nonce|targetSha|requestId|ZGmini/i);
 const absent=classify1501RecoveryCheckpoint(x,{
  signal:()=>{const e=new Error('not found');e.code='ESRCH';throw e;}});
 assert.equal(absent.ownerPidObservation,'PID_NOT_PRESENT');
 assert.equal(absent.eligibleForAutomaticRelease,false);
});
test('1501 recovery checkpoint refuses to interpret uncorrelated or malformed phase',()=>{
 const x=pinned996();x.second={...x.first};
 const no=classify1501RecoveryCheckpoint(x,{signal:()=>{throw Error('should not probe');}});
 assert.equal(no.status,'STATE_UNKNOWN');
 assert.equal(no.ownerPidObservation,'UNKNOWN');
 assert.equal(no.ledgerPhase,null);
});
test('#1841 original ledger is correlated only with its own matching live owner marker',()=>{
 const x=pinned996();
 x.first.ledger=Buffer.from(JSON.stringify({
  requestId:'pc-update-7acb05d3-2860-4d19-8e30-55fe78892b12',
  issueNumber:1841,targetSha:'2f569c18e09a55e54e81052985a80f6a8765d680',
  status:'RECOVERY_REQUIRED',phase:'SWITCHED',firstFail:'SWITCHED',
  failureOperation:'reconcileBacklog',intakePaused:true,workflowEnabled:false,
  updatedAt:'2026-11-12T20:32:33.000Z',token:'SECRET_DO_NOT_LEAK'}));
 x.second={...x.first};
 const result=classify1841RecoveryCheckpoint(x,{
  signal:()=>{const e=new Error('absent');e.code='ESRCH';throw e;},
  backupPresent:true,backlogPresent:true});
 assert.equal(result.status,'CORRELATED');
 assert.equal(result.code,'C1841_LEASE_IDENTITY_CORRELATED');
 assert.equal(result.ledger1841Matched,true);
 assert.equal(result.ledgerPhase,'SWITCHED');
 assert.equal(result.ledgerFirstFail,'SWITCHED');
 assert.equal(result.ledgerFailureOperation,'reconcileBacklog');
 assert.equal(result.ownerPidObservation,'PID_NOT_PRESENT');
 assert.equal(result.backupPresent,true);
 assert.equal(result.backlogPresent,true);
 assert.equal(result.eligibleForAutomaticRelease,false);
 assert.equal(Object.hasOwn(result,'ledger996Matched'),false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_DO_NOT_LEAK|7acb05d3|2f569c18|nonce|ZGmini/i);
});
test('#1841 stale ledger timing or another owner never authenticates a held lease',()=>{
 const x=pinned996();
 const wrong=classify1841RecoveryCheckpoint({...x,second:{...x.first}});
 assert.equal(wrong.status,'STATE_UNKNOWN');
 assert.equal(wrong.ledger1841Matched,false);
 x.first.ledger=Buffer.from(JSON.stringify({
  requestId:'pc-update-7acb05d3-2860-4d19-8e30-55fe78892b12',
  issueNumber:1841,targetSha:'2f569c18e09a55e54e81052985a80f6a8765d680',
  status:'RECOVERY_REQUIRED',phase:'SWITCHED',firstFail:'SWITCHED',
  updatedAt:'2026-11-17T01:40:00.000Z',note:'SECRET'}));
 x.second={...x.first};
 const stale=classify1841RecoveryCheckpoint(x,{backupPresent:true,backlogPresent:false,
  signal:()=>{throw Error('MUST_NOT_SIGNAL_UNVERIFIED_OWNER');}});
 assert.equal(stale.status,'STATE_UNKNOWN');
 assert.equal(stale.ledger1841Matched,true);
 assert.equal(stale.ownerMarkerIdentityMatched,true);
 assert.equal(stale.ledgerMarkerTimeMatched,false);
 assert.equal(stale.ledgerPhase,'SWITCHED');
 assert.equal(stale.ownerPidObservation,'UNKNOWN');
 assert.equal(stale.eligibleForAutomaticRelease,false);
 assert.doesNotMatch(JSON.stringify(stale),/SECRET|7acb05d3|nonce|ZGmini/i);
});
test('#1841 fixed read-only probe rejects missing original bytes without writing or executing',()=>{
 const out=inspect1841LeaseCorrelation({
  lock:()=>({held:true,recoveryRequired:true,ownerPid:1}),
  stat:()=>{throw Error('absent');},
  read:()=>{throw Error('MUST_NOT_READ_UNSAFE');},
  signal:()=>{throw Error('MUST_NOT_EXECUTE');}});
 assert.equal(out.status,'STATE_UNKNOWN');
 assert.equal(out.code,'C1841_ORIGINAL_FILES_UNAVAILABLE');
 assert.equal(out.operationalWrites,0);
 assert.equal(out.providerCalls,0);
 assert.equal(out.d1Writes,0);
});
test('workflow state distinguishes current active and manual disable without exposing raw data',()=>{
 const base={maintenanceSourceSha:'a'.repeat(40),maintenanceFilesVerified:true,
  installLock:{held:true,recoveryRequired:true},diagnostics:[]};
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'active'}).workflowState,'active');
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'disabled_manually'}).workflowState,'disabled_manually');
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'disabled_inactivity'}).workflowState,'disabled_inactivity');
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'SECRET_TOKEN'}).workflowState,'UNVERIFIED');
});
test('project repeated HTTP host names only, never raw tokens, one-off, or URL paths',()=>{
 const raw={status:'PASS',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',scope:'FIXED_LOCAL_JSONL_ONLY',
  now:'2026-11-16T12:00:00Z',windowDays:14,monitoredHostCount:2,
  monitoredHostsReturned:2,omittedHosts:0,
  http:{normal:1,failed:1,unknown:0,total:2},
  hosts:[
   {host:'api.example.gov',monitored:true,monitoringState:'normal',reason:'RECENT_2XX',
    lastAttemptAt:'2026-11-16T11:00:00Z',last2xxRunAt:'2026-11-16T11:00:00Z',
    lastRunStatuses:{200:1},token:'DO_NOT_LEAK',url:'https://secret/path?key=secret'},
   {host:'status.example.gov',monitored:true,monitoringState:'failed',
    reason:'LAST_HTTP_ERROR',lastAttemptAt:'2026-11-16T11:10:00Z',
    last2xxRunAt:null,lastRunStatuses:{503:2}},
   {host:'only-once.example.gov',monitored:false,monitoringState:'unknown',
    reason:'NOT_REPEATED',lastAttemptAt:'2026-11-16T11:00:00Z',
    last2xxRunAt:null,lastRunStatuses:{200:1}}
  ]};
 const projected=projectObservedProviderHosts(raw);
 assert.equal(projected.status,'PASS');
 assert.equal(projected.monitoredCount,2);
 assert.equal(projected.rosterComplete,true);
 assert.deepEqual(projected.http,{normal:1,failed:1,unknown:0,total:2});
 assert.deepEqual(projected.hosts.map(x=>x.host),['api.example.gov','status.example.gov']);
 assert.doesNotMatch(JSON.stringify(projected),/DO_NOT_LEAK|only-once|secret\/path|token|https:\/\//i);
 assert.equal(projected.providerCalls,0);assert.equal(projected.operationalWrites,0);
});
test('partial or malformed observed HTTP evidence does not assert validated connection health',()=>{
 const row={status:'STATE_UNKNOWN',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',now:'2026-11-16T12:00:00Z',windowDays:14,
  monitoredHostCount:2,monitoredHostsReturned:1,omittedHosts:1,
  http:{normal:2,failed:0,unknown:0,total:2},
  hosts:[{host:'api.example.gov',monitored:true,monitoringState:'normal',reason:'RECENT_2XX',
   lastAttemptAt:'2026-11-16T11:00:00Z',last2xxRunAt:'2026-11-16T11:00:00Z',
   lastRunStatuses:{200:1}}]};
 const partial=projectObservedProviderHosts(row);
 assert.equal(partial.status,'STATE_UNKNOWN');
 assert.equal(partial.rosterComplete,false);
 assert.equal(partial.hosts.length,1);
 assert.equal(partial.http,null);
 assert.equal(projectObservedProviderHosts({...row,hosts:[{...row.hosts[0],
  host:'user:password@api.example.gov'}]}).status,'STATE_UNKNOWN');
});
test('#1501 open paused backlog window and durable replays summarize without raw content',()=>{
 const raw=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_BACKLOG_V1',
  windows:[{pausedAt:'2026-11-16T00:35:00Z',resumedAt:null}],
  replays:{'1503':{status:'POSTING',body:'SECRET_TOKEN'},
   '1508':{status:'SKIPPED_RESULT_PRESENT',command:'secret cmd'},
   '1510':{status:'DONE'}},token:'SECRET_TOKEN'}));
 const x=classify1501BacklogBytes(raw,raw);
 assert.equal(x.status,'PASS');assert.equal(x.openWindowCount,1);
 assert.equal(x.windowCount,1);assert.equal(x.replayCount,3);
 assert.deepEqual(x.replayCounts,{done:1,skippedResultPresent:1,posting:1,otherUnverified:0});
 assert.deepEqual(x.replays.map(z=>z.issueNumber),[1503,1508,1510]);
 assert.equal(x.mutationAllowed,false);
 assert.doesNotMatch(JSON.stringify(x),/SECRET_TOKEN|secret cmd|nonce|body/i);
 assert.equal(classify1501BacklogBytes(raw,Buffer.from('drift')).status,'STATE_UNKNOWN');
});
test('#1501 backlog refuses wrong schema, invalid windows, symlink, missing owner',()=>{
 const build=v=>Buffer.from(JSON.stringify(v));
 assert.equal(classify1501BacklogBytes(build({schema:'OTHER'}),build({schema:'OTHER'})).status,'STATE_UNKNOWN');
 const invalid=build({schema:'ZGMINI_PC_BACKLOG_V1',windows:[{pausedAt:'x',resumedAt:null}]});
 assert.equal(classify1501BacklogBytes(invalid,invalid).status,'STATE_UNKNOWN');
 const q=inspect1501BacklogReadonly({correlation:()=>({status:'STATE_UNKNOWN'}),
  stat:()=>{throw Error('must not read');},read:()=>{throw Error('must not read');}});
 assert.equal(q.code,'C1501_BACKLOG_OWNER_UNVERIFIED');
 const unsafe=inspect1501BacklogReadonly({correlation:()=>({status:'CORRELATED'}),
  stat:()=>({isDirectory:()=>false,isSymbolicLink:()=>true}),
  read:()=>{throw Error('must not read');}});
 assert.equal(unsafe.code,'C1501_BACKLOG_UNSAFE_DIRECTORY');
});
test('#1501 current runtime and independent maintenance health are distinct from workflow and lease',()=>{
 const base={maintenanceSourceSha:'a'.repeat(40),maintenanceFilesVerified:true,
  actualControllerSha:'b'.repeat(40),
  installLock:{held:true,recoveryRequired:true},diagnostics:[],
  workflowState:'active',runtimeState:'HEALTHY',
  maintenanceState:'HEALTHY',automationState:'HEALTHY',nonce:'secret'};
 const ok=sanitizeMaintenanceStatus(base);
 assert.equal(ok.runtimeState,'HEALTHY');
 assert.equal(ok.maintenanceState,'HEALTHY');
 assert.equal(ok.automationState,'HEALTHY');
 assert.equal(ok.workflowState,'active');
 assert.equal(ok.installLockHeld,true);
 assert.doesNotMatch(JSON.stringify(ok),/nonce|secret/i);
 const unknown=sanitizeMaintenanceStatus({...base,runtimeState:'COMPROMISED',
  maintenanceState:'COMPROMISED',automationState:'COMPROMISED'});
 assert.equal(unknown.runtimeState,'UNVERIFIED');
 assert.equal(unknown.maintenanceState,'UNVERIFIED');
 assert.equal(unknown.automationState,'PARTIAL_OR_UNVERIFIED');
});
test('#1501 isolate runtime signal that prevents healthy classification',()=>{
 const sample={controllerFilesVerified:true,supervisorAlive:false,
  supervisorIdentityVerified:false,supervisorFresh:false,
  supervisorChildrenVerified:false,runnerSetOnline:true,workflowState:'active',
  nonce:'SECRET_NONCE',ownerPid:4567};
 const signals=safeRuntimeSignals(sample);
 assert.deepEqual(signals,{
  controllerFilesVerified:true,supervisorAlive:false,
  supervisorIdentityVerified:false,supervisorFresh:false,
  supervisorChildrenVerified:false,runnerSetOnline:true,workflowActive:true});
 const projected=sanitizeRuntimeSignals(signals);
 assert.deepEqual(projected,signals);
 assert.doesNotMatch(JSON.stringify(projected),/SECRET|nonce|ownerPid|4567/);
 const unknown=safeRuntimeSignals({workflowState:'ERROR',
  supervisorAlive:'yes',runnerSetOnline:'online'});
 assert.equal(unknown.supervisorAlive,null);
 assert.equal(unknown.runnerSetOnline,null);
 assert.equal(unknown.workflowActive,null);
 assert.equal(sanitizeRuntimeSignals({supervisorAlive:'false'}).supervisorAlive,null);
});
test('runner-query missing cannot be misreported as actual offline six seats',()=>{
 const q=sanitizeDedicatedRunnerEvidence({diagnostics:['RUNNERS_QUERY_UNAVAILABLE'],runners:null});
 assert.equal(q.queryState,'QUERY_UNAVAILABLE');
 assert.equal(q.allSixOnline,null);
 assert.deepEqual(q.runners.map(x=>x.status),Array(6).fill('UNVERIFIED'));
 const rows=Array.from({length:6},(_,i)=>({
  name:'zgmini-pc-0'+(i+1),status:'online',busy:false,token:'HIDDEN'}));
 const x=sanitizeDedicatedRunnerEvidence({runners:rows});
 assert.equal(x.queryState,'QUERY_RETURNED');
 assert.equal(x.allSixOnline,true);
 assert.equal(x.runners.length,6);
 assert.doesNotMatch(JSON.stringify(x),/HIDDEN|token/);
 const partial=sanitizeDedicatedRunnerEvidence({runners:[
  ...rows.slice(0,4),{...rows[4],status:'offline'},rows[5],rows[5]]});
 assert.equal(partial.allSixOnline,false);
 assert.equal(partial.runners[4].status,'offline');
 assert.equal(partial.runners[5].status,'DUPLICATE');
 const unknown=sanitizeDedicatedRunnerEvidence({runners:[{name:'zgmini-pc-01',
  status:'SUSPICIOUS',busy:'maybe',password:'SECRET'}]});
 assert.equal(unknown.runners[0].status,'UNVERIFIED');
 assert.equal(unknown.runners[0].busy,null);
 assert.doesNotMatch(JSON.stringify(unknown),/SECRET|password/);
});
test('runner query HTTP 403 emits read-only forbidden classification, no fabricated offline list',()=>{
 const x=sanitizeDedicatedRunnerEvidence({diagnostics:['RUNNERS_QUERY_UNAVAILABLE'],
  runnerQueryError:'HTTP_403_FORBIDDEN',runners:null,token:'SECRET'});
 assert.equal(x.queryState,'QUERY_UNAVAILABLE');
 assert.equal(x.queryFailureReason,'HTTP_403_FORBIDDEN');
 assert.equal(x.allSixOnline,null);
 assert.deepEqual(x.runners.map(row=>row.status),Array(6).fill('UNVERIFIED'));
 assert.doesNotMatch(JSON.stringify(x),/SECRET|token/);
 assert.equal(sanitizeDedicatedRunnerEvidence({diagnostics:['RUNNERS_QUERY_UNAVAILABLE'],
  runnerQueryError:'PRIVATE'}).queryFailureReason,null);
});

test('three fixed hosts preserve hashed endpoint 404 receipts without paths or credentials',()=>{
 const NOW=Date.parse('2026-11-16T13:10:00Z');
 const hash='a'.repeat(32),other='b'.repeat(32);
 const lines=[
  JSON.stringify({at:'2026-11-16T11:05:00Z',endpointPaths:{
   'data.sec.gov':{[hash]:{requests:2,statuses:{200:1,404:1}}},
   'cdn.www.census.gov':{[other]:{requests:1,statuses:{200:1}}},
   'private.example.org':{[other]:{requests:1,statuses:{500:1}}},
   },secret:'DO_NOT_PUBLISH',url:'https://data.sec.gov/secret-path?token=x'}),
  JSON.stringify({at:'2026-11-16T11:06:00Z',endpointPaths:{
   'data.sec.gov':{[hash]:{requests:1,statuses:{404:1}}}}},
  )];
 const q=projectTargetEndpointStatus(lines,NOW);
 assert.equal(q.status,'OBSERVED');
 assert.equal(q.hosts.length,3);
 assert.equal(q.hosts[0].host,'data.sec.gov');
 assert.equal(q.hosts[0].endpointCount,1);
 assert.deepEqual(q.hosts[0].endpointHashes[0].lastStatuses,{'404':1});
 assert.equal(q.hosts[0].endpointHashes[0].last2xxAt,'2026-11-16T11:05:00.000Z');
 assert.equal(q.hosts[0].endpointHashes[0].last404At,'2026-11-16T11:06:00.000Z');
 assert.equal(q.endpointCoverageVerified,false);
 assert.doesNotMatch(JSON.stringify(q),/DO_NOT_PUBLISH|private\.example|secret-path|token|https:\/\//);
});
test('invalid and partial endpoint log cannot claim comprehensive HTTP coverage',()=>{
 const now=Date.parse('2026-11-16T13:10:00Z');
 const bad=projectTargetEndpointStatus(['{"at": "garbage"}'],now);
 assert.equal(bad.status,'STATE_UNKNOWN');
 assert.equal(bad.invalidEvents,1);
 const partial=projectTargetEndpointStatus([JSON.stringify({
  at:'2026-11-16T13:00:00Z',endpointPaths:{'data.sec.gov':{
   ['c'.repeat(32)]:{requests:1,statuses:{200:1}}}}})],now,{partialTail:true});
 assert.equal(partial.status,'STATE_UNKNOWN');
 assert.equal(partial.endpointCoverageVerified,false);
 const forged=projectTargetEndpointStatus([JSON.stringify({
  at:'2026-11-16T13:00:00Z',endpointPaths:{'data.sec.gov':{
   'user:pass@api':{requests:1,statuses:{200:1}}}}})],now);
 assert.equal(forged.status,'STATE_UNKNOWN');
});

test('recent real HTTP 200 with unverified cadence is safe in exact A roster projection',()=>{
 const host={host:'data.alpaca.markets',monitored:true,monitoringState:'normal',
  reason:'RECENT_2XX_CADENCE_UNVERIFIED',lastAttemptAt:'2026-11-16T00:00:11.478Z',
  last2xxRunAt:'2026-11-16T00:00:11.478Z',lastRunStatuses:{200:1},
  secret:'PRIVATE_CREDENTIAL'};
 const raw={status:'PASS',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',now:'2026-11-16T14:34:00Z',
  windowDays:14,monitoredHostCount:1,monitoredHostsReturned:1,
  omittedHosts:0,http:{normal:1,failed:0,unknown:0,total:1},hosts:[host]};
 const projected=projectObservedProviderHosts(raw);
 assert.equal(projected.status,'PASS');
 assert.deepEqual(projected.http,{normal:1,failed:0,unknown:0,total:1});
 assert.equal(projected.hosts[0].reason,'RECENT_2XX_CADENCE_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(projected),/PRIVATE_CREDENTIAL/);
 assert.equal(projected.providerCalls,0);
 assert.equal(projected.operationalWrites,0);
 assert.equal(projectObservedProviderHosts({...raw,hosts:[
  {...host,reason:'RECENT_2XX_SECRET_COMMAND'}]}).status,'STATE_UNKNOWN');
});

test('bounded monthly Census source evidence is allowed in sanitised 32-host roster',()=>{
 const h={host:'cdn.www.census.gov',monitored:true,monitoringState:'normal',
  reason:'MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW',
  lastAttemptAt:'2026-11-03T21:00:36.518Z',
  last2xxRunAt:'2026-11-03T21:00:36.518Z',
  lastRunStatuses:{200:1},rawSecret:'DO_NOT_PRINT'};
 const raw={status:'PASS',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',now:'2026-11-16T14:34:00Z',
  windowDays:14,monitoredHostCount:1,monitoredHostsReturned:1,
  omittedHosts:0,http:{normal:1,failed:0,unknown:0,total:1},hosts:[h]};
 const result=projectObservedProviderHosts(raw);
 assert.equal(result.rosterComplete,true);
 assert.deepEqual(result.http,{normal:1,failed:0,unknown:0,total:1});
 assert.equal(result.hosts[0].reason,'MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW');
 assert.equal(result.providerCalls,0);assert.equal(result.operationalWrites,0);
 assert.ok(!JSON.stringify(result).includes('DO_NOT_PRINT'));
 const tampered=projectObservedProviderHosts({...raw,hosts:[{...h,
  reason:'MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW_SECRET'}]});
 assert.equal(tampered.status,'STATE_UNKNOWN');
});


test('browser attribution distinguishes Runner descendants from nonzero Windows sessions using only aggregate memory',()=>{
 const fixture={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:3,
  selectedProcessCount:0,processes:[],services:[],tasks:[],
  memoryGroups:[{kind:'OTHER_PROCESSES',count:3,workingSetMiB:6000,
   privateCommitMiB:12000,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
  otherSubgroups:[{category:'BROWSER_WEBVIEW',count:3,workingSetMiB:6000,
   privateCommitMiB:12000}],
  browserAttribution:[
   {class:'RUNNER_DESCENDANT',count:1,workingSetMiB:400,privateCommitMiB:900,
    pid:123,name:'SECRET_USER_BROWSER'},
   {class:'NONZERO_SESSION_NONRUNNER',count:2,workingSetMiB:5600,
    privateCommitMiB:11100,cmd:'NEVER_SHOW'}
  ]};
 const out=sanitizeProbe(fixture);
 assert.equal(out.browserAttributionCoverage,'COUNT_COMPLETE');
 assert.equal(out.browserAttribution.length,2);
 assert.equal(out.browserAttribution.reduce((v,g)=>v+g.workingSetMiB,0),6000);
 assert.deepEqual(Object.keys(out.browserAttribution[0]),
  ['class','count','workingSetMiB','privateCommitMiB']);
 assert.doesNotMatch(JSON.stringify(out),/SECRET_USER_BROWSER|NEVER_SHOW|pid|cmd/);
 assert.equal(sanitizeProbe({...fixture,browserAttribution:undefined})
  .browserAttributionCoverage,'UNAVAILABLE');
 for(const bad of [
  [{...fixture.browserAttribution[0],class:'SECRET_APPLICATION'},
   fixture.browserAttribution[1]],
  [{...fixture.browserAttribution[0],count:2},fixture.browserAttribution[1]],
  [{...fixture.browserAttribution[0],workingSetMiB:-1},fixture.browserAttribution[1]],
  [fixture.browserAttribution[0],fixture.browserAttribution[0]],
  [fixture.browserAttribution[0]],
  [{...fixture.browserAttribution[0],class:'SESSION_ZERO_NONRUNNER',count:0},
   fixture.browserAttribution[1]]
 ])assert.throws(()=>sanitizeProbe({...fixture,browserAttribution:bad}));
});
test('zero-browser inventory yields complete empty attribution and rejects invented browser processes',()=>{
 const raw={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  selectedProcessCount:0,processes:[],otherSubgroups:[
   {category:'WINDOWS_CORE_UI',count:1,workingSetMiB:10,privateCommitMiB:15}],
  browserAttribution:[]};
 assert.equal(sanitizeProbe(raw).browserAttributionCoverage,'COUNT_COMPLETE');
 assert.throws(()=>sanitizeProbe({...raw,browserAttribution:[
  {class:'NONZERO_SESSION_NONRUNNER',count:1,workingSetMiB:10,privateCommitMiB:15}
 ]}));
});


test('unclassified OTHER attribution keeps exact class totals without leaking process identifiers',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  totalProcessCount:4,selectedProcessCount:0,processes:[],services:[],tasks:[],
  memoryGroups:[{kind:'OTHER_PROCESSES',count:4,workingSetMiB:4402,
   privateCommitMiB:7300,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
  otherSubgroups:[{category:'UNCLASSIFIED_OTHER',count:4,
   workingSetMiB:4402,privateCommitMiB:7300}],
  unclassifiedAttribution:[
   {class:'RUNNER_DESCENDANT',count:1,workingSetMiB:1659,
    privateCommitMiB:1865,name:'PRIVATE_PROCESS',pid:123,commandLine:'secret'},
   {class:'NONZERO_SESSION_NONRUNNER',count:3,workingSetMiB:2743,
    privateCommitMiB:5435,username:'PRIVATE_USER',path:'SECRET_PATH'}
  ]};
 const result=sanitizeProbe(base);
 assert.equal(result.unclassifiedAttributionCoverage,'COUNT_COMPLETE');
 assert.equal(result.unclassifiedAttribution.length,2);
 assert.equal(result.unclassifiedAttribution.reduce((n,g)=>n+g.workingSetMiB,0),4402);
 assert.deepEqual(Object.keys(result.unclassifiedAttribution[0]),
  ['class','count','workingSetMiB','privateCommitMiB']);
 assert.doesNotMatch(JSON.stringify(result),
  /PRIVATE_PROCESS|PRIVATE_USER|SECRET_PATH|secret|commandLine|username/);
 assert.equal(sanitizeProbe({...base,unclassifiedAttribution:undefined})
  .unclassifiedAttributionCoverage,'UNAVAILABLE');
 for(const invalid of [
  [{...base.unclassifiedAttribution[0],class:'UNAPPROVED_APP'},
   base.unclassifiedAttribution[1]],
  [base.unclassifiedAttribution[0],base.unclassifiedAttribution[0]],
  [{...base.unclassifiedAttribution[0],count:2},
   base.unclassifiedAttribution[1]],
  [{...base.unclassifiedAttribution[0],workingSetMiB:-1},
   base.unclassifiedAttribution[1]],
  [{...base.unclassifiedAttribution[0],count:0},
   base.unclassifiedAttribution[1]],
  [base.unclassifiedAttribution[0]]
 ])assert.throws(()=>sanitizeProbe({...base,unclassifiedAttribution:invalid}));
});
test('no UNCLASSIFIED_OTHER gives complete empty attribution only for empty groups',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  selectedProcessCount:0,processes:[],
  otherSubgroups:[{category:'WINDOWS_CORE_UI',count:1,
   workingSetMiB:50,privateCommitMiB:80}],
  unclassifiedAttribution:[]};
 assert.equal(sanitizeProbe(base).unclassifiedAttributionCoverage,'COUNT_COMPLETE');
 assert.throws(()=>sanitizeProbe({...base,unclassifiedAttribution:[
  {class:'SESSION_ZERO_NONRUNNER',count:1,workingSetMiB:50,privateCommitMiB:80}
 ]}));
});

const C2094_ID='pc-update-dbed28c1-a59b-403b-84c6-8cf190930cb5';
function stage2094Fixture(){
 return {status:'STATUS',installedReadbackCode:null,ledgerReadbackCode:null,
  lockReadbackCode:null,artifactReadbackCode:null,
  actualControllerSha:'f7f1559bc0ef15bb9b375982d048369c474c490f',
  installLock:{held:false,recoveryRequired:false,ownerPid:12345,nonce:'NO_EXPORT'},
  ledger:{schema:'ZGMINI_PC_UPDATE_RESULT_V1',requestId:C2094_ID,
   issueNumber:2094,targetSha:'ead5d2d585ff2ce2a6df5f9b6cf720f65d90b49b',
   installedShaBefore:'f7f1559bc0ef15bb9b375982d048369c474c490f',
   status:'BLOCKED',phase:'BLOCKED',firstFail:'STAGED',
   failureOperation:'pauseIntake',code:'WORKFLOW_DISABLE_NOT_CONFIRMED',
   workflowEnabled:true,nonce:'CONFIDENTIAL',absolutePath:'E:/PRIVATE/data',
   providerApiKey:'SECRET'},
  artifacts:{schema:'ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1',requestId:C2094_ID,
   status:'OBSERVED',recoveryComplete:false,installSuccessProven:false,
   artifacts:{backupRoot:'PRESENT',stageRoot:'PRESENT',stagedHost:'PRESENT',
    snapshotRoot:'ABSENT',originalHost:'ABSENT',protectedBefore:'ABSENT',
    previousHost:'ABSENT'},backlog:{file:'PRESENT',windows:1,openWindows:0,
     replayCount:0,secret:'NO_EXPORT'},
   lease:{directory:'ABSENT',ownerFile:'ABSENT',recoveryMarker:'ABSENT',
    ownerMarkerMatch:null,privateOwner:'NO_EXPORT'}}};
}
test('C2094 fixed A scope reports actual stage metadata but NEVER approves recovery',()=>{
 const j=stage2094Fixture(),r=summarize2094StageStatus(j);
 assert.equal(r.status,'READ_ONLY_OBSERVED');
 assert.equal(r.ledgerFirstFail,'STAGED');
 assert.equal(r.ledgerFailureOperation,'pauseIntake');
 assert.equal(r.backup.stageRoot,'PRESENT');
 assert.equal(r.backlog.openWindows,0);
 assert.equal(r.lease.held,false);
 assert.equal(r.restorationVerified,false);
 assert.equal(r.recoveryEligible,false);
 const output=JSON.stringify(r);
 assert.doesNotMatch(output,/NO_EXPORT|CONFIDENTIAL|SECRET|PRIVATE|ownerPid|nonce|absolutePath|providerApiKey/);
 assert.equal(inspect2094StageReadonly(()=>j).status,'READ_ONLY_OBSERVED');
});
test('C2094 fixed A scope rejects wrong issue, target, prior SHA and foreign request',()=>{
 const a=stage2094Fixture(),bad=[
  {...a,ledger:{...a.ledger,requestId:'pc-update-other-1234567890'}},
  {...a,ledger:{...a.ledger,issueNumber:9999}},
  {...a,ledger:{...a.ledger,targetSha:'a'.repeat(40)}},
  {...a,ledger:{...a.ledger,installedShaBefore:'b'.repeat(40)}},
  {...a,artifacts:{...a.artifacts,requestId:'pc-update-other-1234567890'}},
  {...a,installedReadbackCode:'INSTALLED_MANIFEST_UNAVAILABLE'}
 ];
 for(const j of bad)assert.equal(summarize2094StageStatus(j).status,'STATE_UNKNOWN');
});
test('C2094 fixed A scope fails closed on unknown type, damaged readback or unstable snapshot',()=>{
 const a=stage2094Fixture();
 for(const j of [
  {...a,artifacts:{...a.artifacts,status:'UNVERIFIED'}},
  {...a,artifactReadbackCode:'UPDATE_ARTIFACTS_UNVERIFIED'},
  {...a,installLock:{held:'false'}},
  {...a,artifacts:{...a.artifacts,artifacts:{...a.artifacts.artifacts,stageRoot:'SYMLINK'}}},
  {...a,artifacts:{...a.artifacts,backlog:{...a.artifacts.backlog,openWindows:-1}}},
 ]){
  const result=summarize2094StageStatus(j);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.recoveryEligible,false);
 }
 assert.equal(inspect2094StageReadonly(()=>{throw Error('secret token');}).status,'STATE_UNKNOWN');
 let reads=0;
 const changed=inspect2094StageReadonly(()=>({
  ...a,artifacts:{...a.artifacts,backlog:{...a.artifacts.backlog,openWindows:reads++?1:0}}}));
 assert.equal(changed.code,'C2094_DOUBLE_READ_CHANGED');
 assert.doesNotMatch(JSON.stringify(changed),/secret|token/i);
});

test('fixed MarketParquet Task fingerprint never reveals credentials or command line',()=>{
 const xml='<Task><Settings><Enabled>true</Enabled></Settings><Actions><Exec>'+
  '<Command>C:\\Windows\\System32\\cmd.exe</Command>'+
  '<Arguments>/d /c &quot;E:\\ZGmini\\data\\pc-writer\\legacy\\collect.cmd&quot; SECRET_TOKEN</Arguments>'+
  '</Exec></Actions></Task>';
 const bytes=Buffer.from(xml);
 const evidence=inspectTask({platform:'win32',query:()=>({status:0,stdout:bytes}),
  hashEntry:p=>{assert.equal(p,'E:\\ZGmini\\data\\pc-writer\\legacy\\collect.cmd');return 'a'.repeat(64);},
  clock:()=> '2026-11-18T09:00:00Z'});
 assert.equal(TASK,'ZGMINI-PC-MarketParquet-ETF');
 assert.equal(evidence.status,'PASS');
 assert.equal(evidence.taskEnabled,true);
 assert.equal(evidence.actionKind,'CMD');
 assert.equal(evidence.entryFileScope,'E_DATA');
 assert.equal(evidence.entryFileLeaf,'collect.cmd');
 assert.equal(evidence.entryFileSha256,'a'.repeat(64));
 assert.equal(evidence.taskXmlSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.doesNotMatch(JSON.stringify(evidence),/SECRET_TOKEN|legacy|\/d \/c|C:\\Windows/);
});
test('MarketParquet Task probe fails closed for missing/ambiguous/unapproved sources',()=>{
 const doc=(enabled,execs)=>'<Task><Settings><Enabled>'+enabled+'</Enabled></Settings><Actions>'+execs+'</Actions></Task>';
 const exec=p=>'<Exec><Command>E:\\ZGmini\\runtime\\node.exe</Command><Arguments>'+p+'</Arguments></Exec>';
 const probe=x=>inspectTask({platform:'win32',query:()=>({status:0,stdout:Buffer.from(x)}),
  hashEntry:()=> 'b'.repeat(64)});
 assert.equal(inspectTask({platform:'linux'}).status,'STATE_UNKNOWN');
 assert.equal(probe(doc('true',exec('C:\\Users\\x.mjs'))).code,'TASK_SOURCE_OUTSIDE_APPROVED_ROOT');
 assert.equal(probe(doc('true',exec('E:\\ZGmini\\data\\a.mjs')+exec('E:\\ZGmini\\data\\b.mjs'))).code,'TASK_EXEC_ACTION_COUNT_NOT_ONE');
 assert.equal(probe(doc('false',exec('E:\\ZGmini\\data\\x.mjs'))).taskEnabled,false);
 assert.equal(probe(doc('true','')).status,'STATE_UNKNOWN');
 assert.equal(inspectTask({platform:'win32',query:()=>({status:1,stderr:Buffer.from('SECRET')})}).code,
  'TASK_QUERY_UNAVAILABLE');
});

test('Task XML without explicit Settings Enabled still fingerprints one action without claiming Task enabled',()=>{
 const xml='<Task><Settings></Settings><Actions><Exec>'+
  '<Command>E:\\ZGmini\\runtime\\node.exe</Command>'+
  '<Arguments>E:\\ZGmini\\data\\pc-writer\\collector.mjs</Arguments>'+
  '</Exec></Actions></Task>';
 const result=inspectTask({platform:'win32',query:()=>({status:0,stdout:Buffer.from(xml)}),
  hashEntry:()=> 'f'.repeat(64)});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'TASK_ENABLED_FIELD_ABSENT_SOURCE_FINGERPRINTED');
 assert.equal(result.enabledFieldPresent,false);
 assert.equal(result.execActionCount,1);
 assert.equal(result.taskEnabled,null);
 assert.equal(result.entryFileLeaf,'collector.mjs');
 assert.equal(result.entryFileSha256,'f'.repeat(64));
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
});
test('missing and multiple Task Exec actions are distinct hard-UNKNOWN without source access',()=>{
 const inspect=xml=>inspectTask({platform:'win32',
  query:()=>({status:0,stdout:Buffer.from(xml)}),
  hashEntry:()=>{throw Error('HASH_ENTRY_MUST_NOT_RUN');}});
 const empty=inspect('<Task><Settings><Enabled>true</Enabled></Settings><Actions></Actions></Task>');
 assert.equal(empty.status,'STATE_UNKNOWN');
 assert.equal(empty.code,'TASK_EXEC_ACTION_COUNT_NOT_ONE');
 assert.equal(empty.execActionCount,0);
 const two=inspect('<Task><Settings></Settings><Actions><Exec></Exec><Exec></Exec></Actions></Task>');
 assert.equal(two.status,'STATE_UNKNOWN');
 assert.equal(two.execActionCount,2);
 assert.equal(two.taskEnabled,null);
});


const C2505_FIXED_ID='pc-update-8f413b02-4bb7-4d99-b71f-64d9c51a294a';
const C2505_FIXED_SHA='0f1effad0c58e8b7bd684aa638521180183ca902';
function c2505Fixture(){
 return {status:'STATUS',actualControllerSha:C2505_FIXED_SHA,
  installedReadbackCode:null,ledgerReadbackCode:null,lockReadbackCode:null,
  artifactReadbackCode:null,installLock:{held:true,recoveryRequired:true},
  ledger:{requestId:C2505_FIXED_ID,issueNumber:2505,targetSha:C2505_FIXED_SHA,
   status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
   firstFail:'POSTCHECK_PENDING',postIssueNumber:2506,
   workflowEnabled:null,intakePaused:false,
   privateUnrelated:'secret-do-not-publish'},
  artifacts:{schema:'ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1',
   requestId:C2505_FIXED_ID,status:'OBSERVED',
   artifacts:{backupRoot:'PRESENT',stageRoot:'PRESENT',snapshotRoot:'PRESENT',
    stagedHost:'PRESENT',originalHost:'PRESENT',protectedBefore:'PRESENT',
    previousHost:'PRESENT'},
   backlog:{file:'PRESENT',windows:1,openWindows:0,replayCount:0},
   lease:{directory:'PRESENT',ownerFile:'PRESENT',
    recoveryMarker:'PRESENT',ownerMarkerMatch:true,
    nonce:'secret-do-not-publish'}}};
}
test('C2505 exact fixed recovery read is bounded and cannot authorize lease release',()=>{
 const result=inspect2505RecoveryReadonly(()=>c2505Fixture());
 assert.equal(result.status,'READ_ONLY_OBSERVED');
 assert.equal(result.actualControllerSha,C2505_FIXED_SHA);
 assert.equal(result.ledgerFirstFail,'POSTCHECK_PENDING');
 assert.equal(result.postIssueNumber,2506);
 assert.equal(result.backup.protectedBefore,'PRESENT');
 assert.equal(result.backlog.openWindows,0);
 assert.equal(result.lease.held,true);
 assert.equal(result.lease.recoveryRequired,true);
 assert.equal(result.lease.ownerRequestIdentityVerified,null);
 assert.equal(result.recoveryEligible,false);
 assert.equal(result.installSuccessProven,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.equal(JSON.stringify(result).includes('secret-do-not-publish'),false);
});
test('C2505 reports unknown for wrong request, incomplete evidence or changing readback',()=>{
 const wrong=c2505Fixture();wrong.ledger.requestId='pc-foreign';
 assert.equal(project2505RecoveryReadonly(wrong).code,
  'C2505_LEDGER_IDENTITY_UNVERIFIED');
 const invalid=c2505Fixture();
 invalid.artifacts.artifacts.snapshotRoot='UNSAFE';
 assert.equal(project2505RecoveryReadonly(invalid).status,'STATE_UNKNOWN');
 const truncated=c2505Fixture();truncated.artifactReadbackCode='UPDATE_ARTIFACTS_UNVERIFIED';
 assert.equal(project2505RecoveryReadonly(truncated).status,'STATE_UNKNOWN');
 let n=0;
 const changed=inspect2505RecoveryReadonly(()=>{
  const x=c2505Fixture();if(++n===2)x.artifacts.artifacts.stageRoot='ABSENT';
  return x;
 });
 assert.equal(changed.code,'C2505_DOUBLE_READ_CHANGED');
 assert.equal(inspect2505RecoveryReadonly(()=>{throw Error('private');}).code,
  'C2505_READBACK_FAILED');
});

test('C2505 byte proof verifies saved Controller closure and baseline without exposing lease identity',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-c2505-proof-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const controlRoot=path.join(dir,'control'),maintenanceRoot=path.join(dir,'maintenance');
 const id='pc-update-8f413b02-4bb7-4d99-b71f-64d9c51a294a';
 const root=path.join(controlRoot,'backups','controller-update-'+id);
 const write=(file,body)=>{fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,typeof body==='string'?body:JSON.stringify(body));};
 const old='5e805bc907a4fb9e8d2fb2d53432bfec7b7cea59';
 const target='0f1effad0c58e8b7bd684aa638521180183ca902';
 const nonce='11111111-2222-4333-8444-555555555555';
 const stamp=['2026-11-20T14:20:19.000Z',
  '2026-11-20T14:25:00.000Z','2026-11-20T14:25:01.000Z'];
 const ledger={requestId:id,issueNumber:2505,installedShaBefore:old,targetSha:target,
  status:'RECOVERY_REQUIRED',firstFail:'POSTCHECK_PENDING',updatedAt:stamp[1]};
 const owner={pid:3210,nonce,at:stamp[0]};
 const marker={requestOwnerPid:3210,nonce,at:stamp[2]};
 const files={};
 for(const rel of ['controller/entry.mjs','controller/engine.mjs',
  'controller/operations.mjs','controller/common.mjs','config/operations.json']){
  const bytes='fixture:'+rel;
  files[rel]=createHash('sha256').update(bytes).digest('hex');
  write(path.join(root,'snapshot',rel),bytes);
 }
 const savedHost=JSON.stringify({controllerSourceSha:old,controllerFiles:files});
 const writerDataRoot=path.join(dir,'writer-data');
 const writerBytes=JSON.stringify({fixture:true});
 const writerSha=createHash('sha256').update(writerBytes).digest('hex');
 const baseline={files:{'config.json':writerSha},tasks:{'ZGMINI-PC-Local-Core':'b'}};
 write(path.join(writerDataRoot,'config.json'),writerBytes);
 write(path.join(maintenanceRoot,'backlog',id+'.json'),{schema:'ZGMINI_PC_BACKLOG_V1',requestId:id,windows:[{pausedAt:stamp[0],resumedAt:stamp[1]}],replays:{}});
 write(path.join(maintenanceRoot,'ledger',id+'.json'),ledger);
 write(path.join(maintenanceRoot,'leases/controller-install/owner.json'),owner);
 write(path.join(maintenanceRoot,'leases/controller-install/RECOVERY_REQUIRED.json'),marker);
 write(path.join(controlRoot,'host.json'),{controllerSourceSha:target});
 write(path.join(root,'snapshot/host.json'),savedHost);
 write(path.join(root,'previous-host.json'),savedHost);
 write(path.join(root,'PROTECTED_BEFORE.json'),baseline);
 const args={controlRoot,maintenanceRoot,writerDataRoot,
  protectedProbe:()=>baseline,pidProbe:()=>false};
 const good=inspect2505RecoveryByteProof(args);
 assert.equal(good.status,'READ_ONLY_OBSERVED');
 assert.equal(good.snapshotFilesVerified,true);
 assert.equal(good.previousHostMatchesSnapshot,true);
 assert.equal(good.protectedBaselineMatchesCurrent,true);
 assert.equal(good.ownerMarkerMatches,true);
 assert.equal(good.ownerPidPresent,false);
 assert.equal(good.leaseTimelineAligned,true);
 assert.equal(good.currentTargetMatches,true);
 assert.equal(good.leaseBoundToOriginalRequest,null);
 assert.equal(good.recoveryEligible,false);
 assert.equal(good.casDigests.currentWriterConfigSha256,writerSha);
 assert.match(good.casDigests.ownerSha256,/^[a-f0-9]{64}$/);
 assert.match(good.casDigests.markerSha256,/^[a-f0-9]{64}$/);
 assert.match(good.casDigests.ledgerSha256,/^[a-f0-9]{64}$/);
 assert.match(good.casDigests.snapshotHostSha256,/^[a-f0-9]{64}$/);
 assert.match(good.casDigests.protectedBeforeSha256,/^[a-f0-9]{64}$/);
 assert.match(good.casDigests.backlogSha256,/^[a-f0-9]{64}$/);
 assert.ok(Date.parse(good.writerConfigModifiedAtUtc)>0);
 assert.equal(good.operationalWrites,0);
 assert.equal(good.providerCalls,0);
 assert.equal(good.d1Writes,0);
 assert.equal(JSON.stringify(good).includes(nonce),false);
 const changedKnown=inspect2505RecoveryByteProof({...args,protectedProbe:()=>({
  files:{'config.json':writerSha},
  tasks:{'ZGMINI-PC-Local-Core':'different'}
 })});
 assert.equal(changedKnown.protectedBaselineMatchesCurrent,false);
 assert.equal(changedKnown.protectedDifferenceClass,'KNOWN_SCOPES');
 assert.deepEqual(changedKnown.protectedDifferenceScopes,['LOCAL_CORE_TASK']);
 const extraKey=inspect2505RecoveryByteProof({...args,protectedProbe:()=>({
  files:{'config.json':writerSha,'PRIVATE_PATH':'private'},tasks:{'ZGMINI-PC-Local-Core':'b'}
 })});
 assert.equal(extraKey.protectedDifferenceClass,'UNVERIFIED_EXTRA_KEYS');
 assert.equal(JSON.stringify(extraKey).includes('PRIVATE_PATH'),false);
 const drift=inspect2505RecoveryByteProof({...args,protectedProbe:()=>({
  files:{'config.json':writerSha},tasks:{'ZGMINI-PC-Local-Core':'changed'}
 })});
 assert.equal(drift.protectedBaselineMatchesCurrent,false);
 // A different live Writer hash than the injected protected snapshot must STOP.
 const changingConfig=inspect2505RecoveryByteProof({...args,protectedProbe:()=>({
  files:{'config.json':'a'.repeat(64)},tasks:{'ZGMINI-PC-Local-Core':'b'}
 })});
 assert.equal(changingConfig.code,'C2505_WRITER_CONFIG_READBACK_DRIFT');
 const modulePath=path.join(root,'snapshot/controller/entry.mjs');
 write(modulePath,'changed');
 assert.equal(inspect2505RecoveryByteProof(args).snapshotFilesVerified,false);
 fs.rmSync(path.join(root,'previous-host.json'));
 assert.equal(inspect2505RecoveryByteProof(args).status,'STATE_UNKNOWN');
});

test('C2505 Writer B source-only CAS proves exact original byte digest, not a changed baseline',()=>{
 const old='7965b337cf69a6d48cb152b1594833d64266a677';
 const latest='a96c35cbf43877e9f3f640e77c10dbe47ab5b067';
 const before='{\n  "enabled": true,\n  "source": "'+old+'",\n  "other": "preserve-this"\n}\n';
 const baselineHash=createHash('sha256').update(before).digest('hex');
 const now=Buffer.from(before.replace(old,latest));
 const ok=project2505WriterSourceOnlyDelta(now,baselineHash);
 assert.equal(ok.code,'C2505_WRITER_SOURCE_ONLY_REVERSED_EXACT');
 assert.equal(ok.sourceMatched,true);
 assert.equal(ok.reversesToOriginal,true);
 assert.equal(ok.recoveryEligible,false);
 assert.equal(ok.safeToReplaceProtectedBefore,false);
 assert.equal(JSON.stringify(ok).includes('preserve-this'),false);
 const altered=Buffer.from(before.replace(old,latest).replace('preserve-this','unexpected'));
 assert.equal(project2505WriterSourceOnlyDelta(altered,baselineHash).code,
  'C2505_WRITER_SOURCE_ONLY_REVERSE_DIFFERS');
 const outdated=Buffer.from(before);
 assert.equal(project2505WriterSourceOnlyDelta(outdated,baselineHash).code,
  'C2505_WRITER_SOURCE_NOT_LAST_RECEIPT');
 const duplicate=Buffer.from('{"source":"'+latest+'","nested":{"source":"'+latest+'"}}');
 assert.equal(project2505WriterSourceOnlyDelta(duplicate,baselineHash).code,
  'C2505_WRITER_SOURCE_FIELD_AMBIGUOUS');
 assert.equal(project2505WriterSourceOnlyDelta(now,'not-a-sha').code,
  'C2505_WRITER_SOURCE_BYTES_UNVERIFIED');
});

test('W05 #2821 fixed read-only CAS observes stable original bytes without claiming recovery',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w05-2821-cas-'));
 const maintenanceRoot=path.join(root,'maintenance'),controlRoot=path.join(root,'control');
 const id='pc-update-c09a58ae-4d2d-4f70-ae66-aa64d976ee51';
 const old='2f3ebcf3518a5e9b694bafbb7e6331840a6a4a25';
 const target='08f0b656faa9ad5c46a813a0cdda4b43107eefbd';
 const backup=path.join(controlRoot,'backups','controller-update-'+id);
 const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
 const entry=Buffer.from('export const safe=true;\n');
 const host={controllerSourceSha:old,
  controllerFiles:{'controller/entry.mjs':createHash('sha256').update(entry).digest('hex')}};
 const protectedBefore={files:{'config.json':'0'.repeat(64)},tasks:{}};
 const owner={pid:1234,nonce:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
 const marker={requestOwnerPid:owner.pid,nonce:owner.nonce};
 const ledger={requestId:id,issueNumber:2821,installedShaBefore:old,targetSha:target,
  status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'BACKED_UP'};
 write(path.join(maintenanceRoot,'ledger',id+'.json'),JSON.stringify(ledger));
 write(path.join(maintenanceRoot,'leases/controller-install/owner.json'),JSON.stringify(owner));
 write(path.join(maintenanceRoot,'leases/controller-install/RECOVERY_REQUIRED.json'),JSON.stringify(marker));
 write(path.join(controlRoot,'host.json'),JSON.stringify(host));
 write(path.join(backup,'snapshot/host.json'),JSON.stringify(host));
 write(path.join(backup,'snapshot/controller/entry.mjs'),entry);
 write(path.join(backup,'PROTECTED_BEFORE.json'),JSON.stringify(protectedBefore));
 const args={maintenanceRoot,controlRoot,lock:()=>({held:true,recoveryRequired:true}),
  isAlive:()=>false,protectedProbe:()=>protectedBefore};
 try{
  const observed=inspectW052821RecoveryCasReadonly(args);
  assert.equal(observed.status,'READ_ONLY_OBSERVED');
  assert.equal(observed.code,'W05_2821_FIXED_RECOVERY_CAS');
  assert.equal(observed.phase,'RECOVERY_REQUIRED');
  assert.equal(observed.firstFail,'BACKED_UP');
  assert.equal(observed.ownerMarkerSame,true);
  assert.equal(observed.ownerAlive,false);
  assert.equal(observed.hostSame,true);
  assert.equal(observed.backupFilesVerified,true);
  assert.equal(observed.protectionSame,true);
  for(const key of ['ledgerSha256','ownerSha256','markerSha256',
   'snapshotHostSha256','protectionSha256'])
   assert.match(observed.digests[key],/^[a-f0-9]{64}$/);
  assert.equal(observed.recoveryEligible,false);
  assert.equal(observed.operationalWrites,0);
  assert.equal(JSON.stringify(observed).includes(owner.nonce),false);
  write(path.join(maintenanceRoot,'ledger',id+'.json'),JSON.stringify({...ledger,issueNumber:999}));
  assert.equal(inspectW052821RecoveryCasReadonly(args).code,
   'W05_2821_ORIGINAL_LEDGER_IDENTITY_DRIFT');
  write(path.join(maintenanceRoot,'ledger',id+'.json'),JSON.stringify(ledger));
  write(path.join(backup,'snapshot/controller/entry.mjs'),'altered');
  assert.equal(inspectW052821RecoveryCasReadonly(args).backupFilesVerified,false);
  assert.equal(inspectW052821RecoveryCasReadonly({...args,
   lock:()=>({held:false,recoveryRequired:false})}).status,'STATE_UNKNOWN');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});


test('W05 #2821 rollback local checkout is read-only and checks pinned 5 files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w05-checkout-'));
 const id='pc-update-c09a58ae-4d2d-4f70-ae66-aa64d976ee51';
 const source='fda563c93f4680709788ba782ad1918abf74ff2d';
 const paths=['tools/controller-rollback-recovery.mjs','tools/update.mjs',
  'tools/maintenance-apply.mjs','tools/maintenance-contract.mjs',
  'tools/maintenance-lock.mjs'];
 const save=(rel,bytes)=>{
  const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,bytes);
 };
 const expected=paths.map((p,i)=>{
  const b=Buffer.from('trusted-'+i+'\n');
  save(p,b);
  return [p,createHash('sha256').update(b).digest('hex')];
 });
 const approval={schema:'ZGMINI_PC_ROLLBACK_APPROVAL_V1',approved:true,
  requestId:id,sourceSha:source,
  files:expected.map(([p,h])=>({path:p,sha256:h}))};
 const approvalPath='approvals/maintenance-recoveries/'+id+'.rollback.json';
 save(approvalPath,JSON.stringify(approval));
 const check=()=>inspectW052821CheckoutReadonly({checkoutRoot:root,expected});
 try{
  assert.equal(check(),'W05_CHECKOUT_BYTES_VERIFIED');
  save(paths[1],'tampered');
  assert.equal(check(),'W05_CHECKOUT_SOURCE_DRIFT');
  save(paths[1],Buffer.from('trusted-1\n'));
  save(approvalPath,JSON.stringify({...approval,sourceSha:'0'.repeat(40)}));
  assert.equal(check(),'W05_CHECKOUT_APPROVAL_DRIFT');
  fs.rmSync(path.join(root,approvalPath));
  assert.equal(check(),'W05_APPROVAL_MISSING');
  save(approvalPath,JSON.stringify(approval));
  fs.rmSync(path.join(root,paths[1]));
  assert.equal(check(),'W05_SOURCE_MISSING');
  save(paths[1],Buffer.from('trusted-1\n'));
  assert.equal(check(),'W05_CHECKOUT_BYTES_VERIFIED');
  assert.equal(inspectW052821CheckoutReadonly({checkoutRoot:path.join(root,'absent'),expected}),
   'W05_PROJECT_ROOT_UNAVAILABLE');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('W05 #2821 pinned PID chronology proves reuse only after original lease timestamp',()=>{
 const ownerAtUtc='2026-11-22T10:00:00.000Z';
 const cas={status:'READ_ONLY_OBSERVED',code:'W05_2821_FIXED_RECOVERY_CAS',
  firstFail:'BACKED_UP',ownerMarkerSame:true,ownerAlive:true,ownerPid:14356,
  ownerAtUtc,digests:{ownerSha256:
   'eb6c203bef862af8f24e95c6dc5b0c890c33d14e2ebfdef6bfb43df3548c98a0'}};
 const observe=(candidate,override={})=>
  classifyW052821OwnerPidChronology({...cas,...override},candidate);
 const reused=observe({pid:14356,state:'OBSERVED',
  startedAtUtc:'2026-11-23T04:50:00.000Z'});
 assert.equal(reused.status,'READ_ONLY_OBSERVED');
 assert.equal(reused.code,'W05_OWNER_PID_REUSED_AFTER_LEASE');
 assert.equal(reused.ownerAtUtc,ownerAtUtc);
 assert.equal(reused.processStartedAtUtc,'2026-11-23T04:50:00.000Z');
 assert.equal(reused.recoveryEligible,false);
 const sameWindow=observe({pid:14356,state:'OBSERVED',
  startedAtUtc:'2026-11-22T10:00:03.000Z'});
 assert.equal(sameWindow.code,'W05_OWNER_PID_IDENTITY_UNVERIFIED');
 const older=observe({pid:14356,state:'OBSERVED',
  startedAtUtc:'2026-11-22T09:00:00.000Z'});
 assert.equal(older.code,'W05_OWNER_PID_IDENTITY_UNVERIFIED');
 assert.equal(observe({pid:14356,state:'NOT_PRESENT'},
  {ownerAlive:false}).code,'W05_OWNER_PID_NOT_PRESENT');
 assert.equal(observe({pid:14356,state:'NOT_PRESENT'}).code,
  'W05_OWNER_PID_SNAPSHOT_CHANGED');
 for(const candidate of [
  {pid:99999,state:'OBSERVED',startedAtUtc:'2026-11-23T04:50:00Z'},
  {pid:14356,state:'UNKNOWN',startedAtUtc:null},
  {pid:14356,state:'OBSERVED',startedAtUtc:'invalid'}]){
  const result=observe(candidate);
  assert.equal(result.status,'STATE_UNKNOWN');assert.equal(result.recoveryEligible,false);
 }
 assert.equal(observe({pid:14356,state:'OBSERVED',
   startedAtUtc:'2026-11-23T04:50:00Z'},
  {digests:{ownerSha256:'0'.repeat(64)}}).code,
  'W05_OWNER_LEASE_CAS_UNVERIFIED');
 assert.equal(observe({pid:14356,state:'OBSERVED',
   startedAtUtc:'2026-11-23T04:50:00Z'},
  {ownerAtUtc:null}).code,
  'W05_OWNER_LEASE_TIME_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(reused),/nonce|commandline|token|credential/i);
});


test('W05 optional operator topology request admits only exact fixed operating read',()=>{
 const e=event();
 const body=JSON.parse(e.issue.body);
 const good={...e,issue:{...e.issue,body:JSON.stringify({...body,probe:'w05-operator-topology-readonly'})}};
 assert.equal(authenticateProcess(good,env,'operating').w05OperatorTopology,true);
 assert.throws(()=>authenticateProcess({...good,issue:{...good.issue,
  body:JSON.stringify({...body,probe:'arbitrary-command'})}},env,'operating'),/REQUEST_SCOPE_INVALID/);
 assert.throws(()=>authenticateProcess({...good,issue:{...good.issue,
  body:JSON.stringify({...body,probe:'w05-operator-topology-readonly',cmd:'arbitrary'})}},
  env,'operating'),/REQUEST_SCOPE_INVALID/);
 const handoff=event('handoff'),raw=JSON.parse(handoff.issue.body);
 assert.throws(()=>authenticateProcess({...handoff,issue:{...handoff.issue,
  body:JSON.stringify({...raw,probe:'w05-operator-topology-readonly'})}},env,'handoff'),/REQUEST_SCOPE_INVALID/);
});
test('W05 operator topology sanitizes fixed first-boundary classifications without SID or path',()=>{
 const rows={schema:'ZGMINI_W05_OPERATOR_TOPOLOGY_PROBE_V1',candidateTotal:3,
  cases:[{pid:101,reason:'PARENT_UNAVAILABLE'},
   {pid:102,reason:'SID_UNAVAILABLE'},{pid:103,reason:'EXPLORER_CHAIN_CANDIDATE'}]};
 const r=sanitizeW05OperatorTopologyProbe(rows);
 assert.equal(r.status,'PASS');assert.equal(r.code,'W05_OPERATOR_CANDIDATE_TOPOLOGY_COLLECTED');
 assert.equal(r.independentOperatorAttested,false);
 assert.equal(r.recoveryEligible,false);
 assert.deepEqual(r.cases.map(x=>x.firstBoundary),
  ['PARENT_UNAVAILABLE','SID_UNAVAILABLE','EXPLORER_CHAIN_CANDIDATE']);
 assert.equal(sanitizeW05OperatorTopologyProbe({schema:rows.schema,candidateTotal:0,cases:[]}).status,
  'STATE_UNKNOWN');
});

test('W05 operator topology denies untrusted/missing/cross-run data',()=>{
 const basic={schema:'ZGMINI_W05_OPERATOR_TOPOLOGY_PROBE_V1',candidateTotal:1,
  cases:[{pid:123,reason:'RUNNER_ANCESTRY'}]};
 for(const raw of [
  {...basic,cases:[{pid:123,reason:'INDEPENDENT_OPERATOR'}]},
  {...basic,cases:[{pid:123,reason:'PARENT_UNAVAILABLE',sid:'private'}]},
  {...basic,candidateTotal:2},
  {...basic,cases:[{pid:123,reason:'RUNNER_ANCESTRY'},{pid:123,reason:'RUNNER_ANCESTRY'}],candidateTotal:2},
  {...basic,cases:[]},
  {...basic,candidateTotal:-1},
  {...basic,candidateTotal:8,cases:Array.from({length:7},(_,i)=>({pid:i+1,reason:'PARENT_UNAVAILABLE'}))}
 ])assert.throws(()=>sanitizeW05OperatorTopologyProbe(raw));
});
test('W05 operator topology collector uses fixed read-only WMI on operating PC',()=>{
 const ctx={requestId:'2d605c34-939e-43e4-8ca1-58d678bf3862',
  issueNumber:2860,runId:'45120000000',attempt:'1'};
 const response={schema:'ZGMINI_W05_OPERATOR_TOPOLOGY_PROBE_V1',candidateTotal:2,
  cases:[{pid:2399,reason:'PARENT_UNAVAILABLE'},
   {pid:2500,reason:'RUNNER_ANCESTRY'}]};
 let count=0;
 const opts={platform:()=> 'win32',hostname:()=> 'PC',exists:()=>true,
  spawn:(exe,args,options)=>{
   count++;
   assert.ok(exe.endsWith('powershell.exe'));
   assert.deepEqual(args.slice(0,4),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand']);
   const ps=Buffer.from(args[4],'base64').toString('utf16le');
   assert.match(ps,/Get-CimInstance/);
   assert.match(ps,/Invoke-CimMethod/);
   assert.match(ps,/GetOwnerSid/);
   assert.doesNotMatch(ps,/Set-ScheduledTask|Remove-Item|taskkill|reg add|workflow enable/i);
   assert.equal(options.shell,false);
   return {status:0,stdout:JSON.stringify(response)};
  }};
 const localEnv={...env,RUNNER_NAME:'zgmini-pc-01',COMPUTERNAME:'PC'};
 const r=collectW05OperatorTopology(ctx,localEnv,opts);
 assert.equal(count,1);assert.equal(r.status,'PASS');
 assert.equal(r.code,'W05_OPERATOR_CANDIDATE_TOPOLOGY_COLLECTED');
 assert.equal(r.cases.length,2);
 assert.equal(r.operationalWrites,0);assert.equal(r.recoveryEligible,false);
 assert.equal(r.independentOperatorAttested,false);
 assert.equal(r.ownerSidsCaptured,false);assert.equal(r.commandLinesCaptured,false);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_SECRET|"commandLine"\\s*:|"sid"\\s*:|"userName"\\s*:/i);
 const txt=w05OperatorTopologyText(r);
 assert.match(txt,/candidate.2399=PARENT_UNAVAILABLE/);
 assert.match(txt,/independentOperatorAttested=false/);
 assert.doesNotMatch(txt,/SID-[0-9]|CommandLine|token|environment/i);
 assert.equal(collectW05OperatorTopology(ctx,{...localEnv,RUNNER_NAME:'untrusted'},opts).status,'BLOCKED');
 assert.equal(count,1);
 const failed=collectW05OperatorTopology(ctx,localEnv,{...opts,
  spawn:()=>({status:2,stderr:'PRIVATE_SECRET'})});
 assert.equal(failed.code,'W05_OPERATOR_WMI_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(failed),/PRIVATE_SECRET/);
});

test('fixed #2960 protection probe compares exact baseline and fails closed',()=>{
 const before={files:{'config.json':'a'.repeat(64),'core.json':'b'.repeat(64)},
  tasks:{'ZGMINI-PC-Local-Core':{enabled:true}}};
 const identical=structuredClone(before);
 const changed=structuredClone(before);
 changed.files['config.json']='c'.repeat(64);
 assert.equal(compare2960ProtectedBaseline(before,identical),true);
 assert.equal(compare2960ProtectedBaseline(before,changed),false);
 assert.equal(compare2960ProtectedBaseline(null,identical),null);
 assert.equal(compare2960ProtectedBaseline(before,{files:{}}),null);
 assert.equal(compare2960ProtectedBaseline([],identical),null);
 assert.equal(typeof compare2960ProtectedBaseline(before,identical),'boolean');
});

test('fixed #2960 drift scope is descriptive only and never approves recovery',()=>{
 const before={files:{'config.json':'a'.repeat(64),
  'quota-runner.cmd':'b'.repeat(64),'run-local.cmd':'c'.repeat(64)},
  tasks:{'ZGMINI-PC-Local-Core':'d'.repeat(64),
   'ZGMINI-PC-Local-Korea':'e'.repeat(64)}};
 const same=structuredClone(before);
 assert.equal(classify2960ProtectionDifference(before,same),'UNCHANGED');
 const writer=structuredClone(before);
 writer.files['config.json']='f'.repeat(64);
 assert.equal(classify2960ProtectionDifference(before,writer),'WRITER_CONFIG_ONLY');
 const task=structuredClone(writer);
 task.tasks['ZGMINI-PC-Local-Core']='0'.repeat(64);
 assert.equal(classify2960ProtectionDifference(before,task),'OTHER_PROTECTED_DRIFT');
 const secondFile=structuredClone(writer);
 secondFile.files['quota-runner.cmd']='1'.repeat(64);
 assert.equal(classify2960ProtectionDifference(before,secondFile),'OTHER_PROTECTED_DRIFT');
 const invalid=structuredClone(writer);
 invalid.files['config.json']='not-a-hash';
 assert.equal(classify2960ProtectionDifference(before,invalid),'OTHER_PROTECTED_DRIFT');
 assert.equal(classify2960ProtectionDifference(null,writer),'UNVERIFIED');
 assert.equal(classify2960ProtectionDifference(before,{files:{}}),'UNVERIFIED');
});

test('fixed #2960 lease lineage requires exact original journal, owner and recovery timing',()=>{
 const ledger={requestId:'pc-update-e8767e20-6bad-4418-97c6-561cf79a8213',
  issueNumber:2960,status:'RECOVERY_REQUIRED',
  firstFail:'POSTCHECK_PENDING',postIssueNumber:2965,
  updatedAt:'2026-11-23T12:26:43.563Z'};
 const owner={pid:18001,nonce:'e8767e20-6bad-4418-97c6-561cf79a8213',
  at:'2026-11-23T12:15:00.000Z'};
 const marker={requestOwnerPid:owner.pid,nonce:owner.nonce,
  at:'2026-11-23T12:26:43.800Z'};
 const valid=assess2960OriginalLeaseLineage(ledger,owner,marker);
 assert.deepEqual(valid,{originalLedgerMatches:true,ownerMarkerMatches:true,
  recoveryTimelineMatches:true,correlated:true});
 assert.doesNotMatch(JSON.stringify(valid),/18001|e8767e20/);
 assert.equal(assess2960OriginalLeaseLineage(
  {...ledger,requestId:'pc-update-00000000-0000-4000-8000-000000000000'},
  owner,marker).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(
  {...ledger,issueNumber:2999},owner,marker).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(
  {...ledger,postIssueNumber:2966},owner,marker).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(
  ledger,owner,{...marker,requestOwnerPid:100}).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(
  ledger,owner,{...marker,nonce:'00000000-0000-4000-8000-000000000000'}).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(
  ledger,owner,{...marker,at:'2026-11-23T12:27:10.000Z'}).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(
  ledger,{...owner,at:'2026-11-23T12:26:44.000Z'},marker).correlated,false);
 assert.equal(assess2960OriginalLeaseLineage(null,null,null).correlated,false);
});

test('#2960 installed reconciliation is all-or-nothing and never rewrites historical postcheck',()=>{
 const base={
  originalLedger:true,ownerAndMarker:true,ownerDead:true,
  controllerVerified:true,maintenanceVerified:true,
  workflowActive:true,backlogReconciled:true,supervisorVerified:true,
  protectedWriterPreserved:true,sourceAndCasVerified:true,
  currentAReceiptVerified:true,operatorVerified:true
 };
 const allowed=classifyInstalledReconciliationProof(base);
 assert.equal(allowed.status,'INSTALLED_RECONCILIATION_ELIGIBLE');
 assert.equal(allowed.originalPostcheckVerified,false);
 assert.equal(allowed.originalLedgerPreserved,true);
 const all=Object.keys(base);
 for(const name of all){
  const denied=classifyInstalledReconciliationProof({...base,[name]:false});
  assert.equal(denied.status,'RECOVERY_REQUIRED',name);
  assert.equal(denied.originalPostcheckVerified,false);
  assert.equal(denied.checks[
   {originalLedger:'ORIGINAL_LEDGER',ownerAndMarker:'EXACT_OWNER_AND_DEAD',
    ownerDead:'EXACT_OWNER_AND_DEAD',controllerVerified:'CURRENT_TARGET_BYTES',
    maintenanceVerified:'MAINTAINER_BYTES',workflowActive:'ACTIVE_WORKFLOW',
    backlogReconciled:'BACKLOG_RECONCILED',
    supervisorVerified:'CURRENT_SUPERVISOR',
    protectedWriterPreserved:'CURRENT_PROTECTION',
    sourceAndCasVerified:'EXACT_SOURCE_AND_CAS',
    currentAReceiptVerified:'CURRENT_A_SUCCESS',
    operatorVerified:'INDEPENDENT_OPERATOR'}[name]],false,name);
 }
 assert.equal(classifyInstalledReconciliationProof(null).status,'RECOVERY_REQUIRED');
 assert.equal(classifyInstalledReconciliationProof({...base,ownerDead:null}).status,'RECOVERY_REQUIRED');
 assert.equal(classifyInstalledReconciliationProof({...base,currentAReceiptVerified:'PASS'}).status,'RECOVERY_REQUIRED');
});
test('#2960 B reconciliation is not callable inside any Actions or isolated runner',()=>{
 assert.throws(()=>maintenanceRecoveryMain([
  'reconcile-installed','--request-id',
  'pc-update-e8767e20-6bad-4418-97c6-561cf79a8213',
  '--source-sha','a'.repeat(40)]),/RECOVERY_OPERATOR_WINDOWS_REQUIRED/);
});

test('D05 theme final-output probe admits only the fixed operating scope',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const request=(probe,extra={})=>({...e,issue:{...e.issue,body:JSON.stringify({...p,probe,...extra})}});
 const exact=request('d05-theme-final-outputs-readonly');
 assert.equal(authenticateProcess(exact,env,'operating').d05ThemeFinalOutputs,true);
 assert.throws(()=>authenticateProcess(exact,env,'handoff'));
 assert.throws(()=>authenticateProcess(request('d05-theme-final-outputs-readonly',{path:'E:/outside'}),env,'operating'));
 assert.throws(()=>authenticateProcess(request('d05-theme-final-outputs-readonly --other'),env,'operating'));
 const txt=toText({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',d05ThemeFinalOutputs:{
  code:'D05_THEME_FINAL_OUTPUTS_INCOMPLETE',distinctThemeCount:12,dailyFinalScorePoints:45,
  currentReceiptMatched:false,archiveScanComplete:true}});
 assert.match(txt,/d05ThemeCount=12/);
 assert.match(txt,/d05DailyPoints=45/);
});


test('D05 configured registration probe is fixed scope, operating-only, and count-only',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const request=(probe,extra={})=>({...e,issue:{...e.issue,body:JSON.stringify({...p,probe,...extra})}});
 const exact=request('d05-configured-registration-readonly');
 assert.equal(authenticateProcess(exact,env,'operating').d05ConfiguredRegistrations,true);
 assert.throws(()=>authenticateProcess(exact,env,'handoff'));
 assert.throws(()=>authenticateProcess(request('d05-configured-registration-readonly',{path:'E:/secret'}),env,'operating'));
 assert.throws(()=>authenticateProcess(request('d05-configured-registration-readonly cmd'),env,'operating'));
 const txt=toText({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',d05ConfiguredRegistrations:{
  code:'D05_CONFIGURED_REGISTRATIONS_READONLY',registeredDefinitionCount:1,
  registryManifestSha256:'a'.repeat(64)}});
 assert.match(txt,/d05ConfiguredDefinitionCount=1/);
 assert.match(txt,/d05ConfiguredInventoryHash=/);
});


test('#3160 scoped CAS read-only request accepts only exact operating probe',()=>{
 const raw=event(),request=JSON.parse(raw.issue.body);
 const mk=(probe,extra={})=>({...raw,issue:{...raw.issue,
  body:JSON.stringify({...request,probe,...extra})}});
 const exact=mk('c3160-rollback-cas-readonly');
 assert.equal(authenticateProcess(exact,env,'operating').c3160RecoveryCas,true);
 assert.throws(()=>authenticateProcess(exact,env,'handoff'));
 assert.throws(()=>authenticateProcess(mk('c3160-rollback-cas-readonly',{path:'E:/other'}),env,'operating'));
 assert.throws(()=>authenticateProcess(mk('c3160-rollback-cas-readonly;cmd'),env,'operating'));
});

test('#3160 exact BACKED_UP CAS is bound to immutable bytes and never approves recovery',()=>{
 const id='pc-update-56444e31-5488-48df-aea9-474d259cb198';
 const m='E:/ZGmini/automation/pc-maintenance';
 const c='E:/ZGmini/automation/pc-control';
 const backup=path.join(c,'backups','controller-update-'+id);
 const sha=x=>createHash('sha256').update(x).digest('hex');
 const host={controllerSourceSha:'4396d2bb326d86b8ce9e27c528519bf0090b8e9e',
  controllerFiles:{'controller/operations.mjs':sha('original controller file')}};
 const nonce='56444e31-5488-48df-aea9-474d259cb198';
 const owner={pid:12345,nonce},marker={requestOwnerPid:12345,nonce};
 const ledger={requestId:id,issueNumber:3160,status:'RECOVERY_REQUIRED',
  firstFail:'BACKED_UP',installedShaBefore:host.controllerSourceSha,
  targetSha:'56a3d9d7420709714a45dac37aeab74d055f4265'};
 const baseline={files:{'config.json':'a'.repeat(64)},tasks:{core:'b'.repeat(64)}};
 const backlog={schema:'ZGMINI_PC_BACKLOG_V1',requestId:id,
  windows:[{pausedAt:'2026-11-24T03:15:00Z',resumedAt:null}],replays:{}};
 const entries=[
  [path.join(m,'ledger',id+'.json'),ledger],
  [path.join(m,'leases/controller-install/owner.json'),owner],
  [path.join(m,'leases/controller-install/RECOVERY_REQUIRED.json'),marker],
  [path.join(c,'host.json'),host],
  [path.join(backup,'snapshot/host.json'),host],
  [path.join(backup,'PROTECTED_BEFORE.json'),baseline],
  [path.join(m,'backlog',id+'.json'),backlog],
  [path.join(backup,'snapshot/controller/operations.mjs'),'original controller file'],
  [path.join(c,'controller/operations.mjs'),'original controller file']
 ];
 const bytes=new Map(entries.map(([key,v])=>[key,Buffer.from(
  typeof v==='string'?v:JSON.stringify(v))]));
 const read=p=>{if(!bytes.has(p))throw Error('not found');return bytes.get(p);};
 const stat=p=>{const v=read(p);return{isFile:()=>true,isSymbolicLink:()=>false,size:v.length};};
 const run=()=>inspect3160RecoveryCasReadonly({
  maintenanceRoot:m,controlRoot:c,read,stat,protectedProbe:()=>baseline,
  lock:()=>({held:true,recoveryRequired:true}),pidProbe:()=>false});
 const result=run();
 assert.equal(result.status,'READ_ONLY_OBSERVED');
 assert.equal(result.ownerMarkerMatches,true);
 assert.equal(result.ownerPidObservation,'PID_NOT_PRESENT');
 assert.equal(result.snapshotHostSameAsCurrent,true);
 assert.equal(result.backupFilesVerified,true);
 assert.equal(result.liveFilesVerified,true);
 assert.equal(result.protectionDifference,'UNCHANGED');
 assert.equal(result.backlog.openWindows,1);
 for(const v of Object.values(result.digests))assert.match(v,/^[a-f0-9]{64}$/);
 assert.equal(result.recoveryEligible,false);
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/12345|56444e31-5488-48df-aea9-474d259cb198-rawsecret/);
 bytes.set(path.join(m,'ledger',id+'.json'),Buffer.from(JSON.stringify({...ledger,issueNumber:9999})));
 assert.equal(run().code,'C3160_LEDGER_IDENTITY_OR_PHASE_DRIFT');
 bytes.delete(path.join(m,'leases/controller-install/RECOVERY_REQUIRED.json'));
 assert.equal(run().code,'C3160_ORIGINAL_FILES_UNAVAILABLE');
});


test('#3160 ENOENT preflight distinguishes absent local manifest from original lease without writes',()=>{
 const id='pc-update-56444e31-5488-48df-aea9-474d259cb198';
 const root='E:/ZGmini/projects/zgmini-pc-control';
 const maintenance='E:/ZGmini/automation/pc-maintenance';
 const manifestPath=path.join(root,'approvals/maintenance-recoveries',id+'.rollback.json');
 const packagePath=path.join(maintenance,'approved',id+'.json');
 const toolPath=path.join(root,'tools/controller-rollback-recovery.mjs');
 const data=new Map([[packagePath,Buffer.from('{}')],[toolPath,Buffer.from('not pinned')]]);
 const read=p=>{if(!data.has(p))throw Object.assign(Error('missing'),{code:'ENOENT'});return data.get(p);};
 const stat=p=>{
  if(p===path.join(maintenance,'leases/controller-recovery'))throw Object.assign(Error('missing'),{code:'ENOENT'});
  const b=read(p);return{isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false,size:b.length};
 };
 const run=()=>inspect3160RollbackPreflightReadonly({checkoutRoot:root,
  maintenanceRoot:maintenance,read,stat,list:()=>[],
  gitAvailable:()=>({status:0}),gitCheck:()=>({status:1,stdout:Buffer.alloc(0)})});
 const before=run();
 assert.equal(before.status,'READ_ONLY_OBSERVED');
 assert.equal(before.localApproval,'ABSENT');
 assert.equal(before.approvalIdentity,'MISSING');
 assert.equal(before.localApprovedPackage,'PRESENT');
 assert.equal(before.checkoutHeadApproval,'NOT_READABLE_FROM_HEAD');
 assert.equal(before.recoveryClaim,'ABSENT');
 assert.equal(before.recoveryRecordCount,0);
 assert.equal(before.localRecoveryToolShaVerified,false);
 assert.equal(before.recoveryEligible,false);
 assert.equal(before.operationalWrites,0);
 const approved={schema:'ZGMINI_PC_ROLLBACK_APPROVAL_V1',approved:true,requestId:id,
  sourceSha:'a19ce199142d64b0aa6de800f1c2c6d9b07c141c',
  ledgerSha256:'9359ea893172168cc96c67990310f2b9f87141ea6765571abbdc8f73a3444c71'};
 data.set(manifestPath,Buffer.from(JSON.stringify(approved)));
 const after=run();
 assert.equal(after.localApproval,'PRESENT');
 assert.equal(after.approvalIdentity,'EXPECTED_IDENTITY');
 assert.equal(after.recoveryEligible,false);
});


test('D05 #3178 private final receipt probe is exact, operating-only and refuses paths',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const request=(probe,extra={})=>({...e,issue:{...e.issue,
  body:JSON.stringify({...p,probe,...extra})}});
 const q=request('d05-private-final-events-readonly');
 assert.equal(authenticateProcess(q,env,'operating').d05PrivateFinalReceipt,true);
 assert.throws(()=>authenticateProcess(q,env,'handoff'));
 assert.throws(()=>authenticateProcess(request('d05-private-final-events-readonly;cmd'),env,'operating'));
 assert.throws(()=>authenticateProcess(request('d05-private-final-events-readonly',{path:'E:/SECRET'}),env,'operating'));
});

test('D05 #3178 actual private receipt validates both immutable bytes and run linkage',()=>{
 
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'d05-private-receipt-'));
 const dir=path.join(root,'pc-writer','marketparquet-paid'),derived=path.join(dir,'derived');
 const calc='2026-11-24T05:01:30.000Z',confirmedDate='2026-11-24',
  privateSha='a'.repeat(64);
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 try{
  fs.mkdirSync(derived,{recursive:true});
  const envelope={schema:'ZGMINI_D05_PRIVATE_THEME_FINAL_EVENTS_R1',
   privateBodySha256:privateSha,sourceVersion:'b'.repeat(64),
   registrySha256:'c'.repeat(64),calculatedAt:calc,
   confirmedObservationDate:confirmedDate,
   events:[{scoreId:'theme:ai-software',phase:'CONFIRMED',
    asOfDate:confirmedDate,calculatedAt:calc,score:51,secret:'SECRET_SCORE'}]};
  const bytes=Buffer.from(JSON.stringify(envelope)),receiptSha=hash(bytes);
  const receipt=path.join(derived,'d05-private-final-theme-'+receiptSha+'.json');
  fs.writeFileSync(receipt,bytes);
  const run={confirmedDate,privateStored:{status:'PRIVATE_STORED_READBACK_VERIFIED',
   count:1,bodySha256:privateSha,secret:'SECRET_INPUT'},
   d05PrivateFinalOutputReadback:{status:'LOCAL_PRIVATE_FINAL_THEME_EVENTS_VERIFIED',
    calculatedAt:calc,confirmedObservationDate:confirmedDate,
    scoreCount:1,privateBodySha256:privateSha,finalEventBodySha256:receiptSha},
   credentials:'SECRET_TOKEN'};
  const report=path.join(dir,'theme-last-run.json');
  fs.writeFileSync(report,JSON.stringify(run));
  const ok=inspectD05PrivateFinalReceiptReadonly({root,now:Date.parse(calc)+90000});
  // The incorrect parent-level lookup must remain absent; the production
  // pc-writer subdirectory is the only accepted fixed path.
  assert.equal(fs.existsSync(path.join(root,'marketparquet-paid','theme-last-run.json')),false);
  assert.equal(ok.status,'PASS');
  assert.equal(ok.receiptMatched,true);
  assert.equal(ok.scoreCount,1);
  assert.equal(ok.calculatedAt,calc);
  assert.equal(ok.finalEventBodySha256,receiptSha);
  assert.equal(ok.operationalWrites,0);
  assert.doesNotMatch(JSON.stringify(ok),/SECRET|score:51|SECRET_INPUT/);
  assert.equal(ok.privateBodySha256,privateSha);
  const serialized=serializeProcessResult({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
   d05PrivateFinalReceipt:ok});
  assert.ok(Buffer.byteLength(serialized)<32768);
  assert.match(toText({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
   d05PrivateFinalReceipt:ok}),/d05PrivateReceiptMatched=true/);
  fs.writeFileSync(receipt,Buffer.from(JSON.stringify({...envelope,secret:'SECRET_TAMPER'})));
  assert.equal(inspectD05PrivateFinalReceiptReadonly({root,now:Date.parse(calc)+90000}).code,
   'D05_PRIVATE_RECEIPT_HASH_MISMATCH');
  fs.writeFileSync(receipt,bytes);
  fs.writeFileSync(report,JSON.stringify({...run,confirmedDate:'2026-11-23'}));
  assert.equal(inspectD05PrivateFinalReceiptReadonly({root,now:Date.parse(calc)+90000}).code,
   'D05_PRIVATE_RUN_RECEIPT_MISMATCH');
  fs.writeFileSync(report,JSON.stringify({...run,d05PrivateFinalOutputReadback:
   {status:'NO_VERIFIED_PRIVATE_FINAL_OUTPUT'}}));
  assert.equal(inspectD05PrivateFinalReceiptReadonly({root,now:Date.parse(calc)+90000}).code,
   'D05_PRIVATE_OUTPUT_NOT_VERIFIED');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('CNN pinned static guard uses existing operating-only probe and no caller paths',()=>{
 const e=event(),body=JSON.parse(e.issue.body);
 const request={...body,probe:'cnn-sidecar-static-guard-readonly'};
 const exact={...e,issue:{...e.issue,body:JSON.stringify(request)}};
 assert.equal(authenticateProcess(exact,env,'operating').cnnSidecarStaticGuard,true);
 assert.throws(()=>authenticateProcess(exact,env,'handoff'));
 for(const data of [
  {...request,path:'E:/other'}, {...request,script:'unsafe'},
  {...request,probe:'cnn-sidecar-static-guard-readonly;cmd'},
  {...request,probe:'cnn-source-full-text-readonly'}
 ]){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify(data)}},env,'operating'));
 }
});

test('CNN static projection exposes only pinned candidates, never raw private text',()=>{
 const raw={ledgerStatus:'READ',scriptStatus:[
  'archive-run.mjs','run-original-then-archive.vbs',
  'archive-core-r10.mjs','verified-checks-r10.mjs'
 ].map(file=>({file,status:'MATCH',modifiedAfterLedger:false})),
 ledgerOriginCandidates:['archive-run.mjs'],
 sourceGuardCandidates:[{file:'archive-run.mjs',line:42,kind:'GIT_REFERENCE',
  secret:'DO_NOT_EXPOSE'}],reasonConcepts:['SOURCE','SHA'],
 matchingErrorSite:'NONE',rawSource:'DO_NOT_EXPOSE',reason:'DO_NOT_EXPOSE'};
 const result=projectCnnSidecarStaticGuard(raw);
 assert.equal(result.status,'PASS');
 assert.equal(result.sidecarFailureResolved,false);
 assert.equal(result.sameLedgerSnapshotVerified,false);
 assert.deepEqual(result.sourceGuardCandidates,[{file:'archive-run.mjs',line:42,
  kind:'GIT_REFERENCE'}]);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
 for(const invalid of [
  {...raw,sourceGuardCandidates:[{file:'private.txt',line:1,kind:'GIT_REFERENCE'}]},
  {...raw,scriptStatus:raw.scriptStatus.map((x,i)=>i===0?{...x,modifiedAfterLedger:true}:x)},
  {...raw,ledgerStatus:'CHANGED_DURING_DIAGNOSIS'},
  {...raw,reasonConcepts:['SOURCE','SECRET']},
  {...raw,sourceGuardCandidates:[{file:'archive-run.mjs',line:0,kind:'GIT_REFERENCE'}]}
 ]){
  const r=projectCnnSidecarStaticGuard(invalid);
  assert.equal(r.status,'STATE_UNKNOWN');
  assert.deepEqual(r.sourceGuardCandidates,[]);
  assert.equal(r.sidecarFailureResolved,false);
 }
});


test('CNN Git predicate probe is fixed operating-only and rejects arbitrary inputs',()=>{
 const e=event(),body=JSON.parse(e.issue.body);
 const request={...body,probe:'cnn-sidecar-git-predicates-readonly'};
 const exact={...e,issue:{...e.issue,body:JSON.stringify(request)}};
 assert.equal(authenticateProcess(exact,env,'operating').cnnSidecarGitPredicates,true);
 assert.throws(()=>authenticateProcess(exact,env,'handoff'));
 for(const extra of [
  {path:'C:/unexpected'},{script:'archive-run.mjs'},
  {probe:'cnn-sidecar-git-predicates-readonly;cmd'},
  {checkout:'E:/different'}
 ]){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...request,...extra})}},env,'operating'));
 }
});
test('CNN Git evidence differentiates mismatch, dirty, unknown and verified bounds',async()=>{
 const {projectCnnGitEvidence,inspectCnnGitPredicatesReadonly}=
  await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const raw={sourcePin:true,ledgerStable:true,ledgerStatus:'BLOCKED',
  head:'a'.repeat(40),approved:'b'.repeat(40),checkpoint:'a'.repeat(40),
  gitVerified:true,trackedClean:false,mentionsCheckout:true,guardSites:true,
  secret:'SECRET_PRIVATE_SOURCE_DO_NOT_LEAK'};
 const output=projectCnnGitEvidence(raw);
 assert.equal(output.status,'PASS');
 assert.equal(output.gitHeadMatchesConfig,false);
 assert.equal(output.trackedTreeClean,false);
 assert.equal(output.gitHeadMatchesCheckpoint,true);
 assert.equal(output.ledgerBlocked,true);
 assert.equal(output.failurePredicateResolved,false);
 assert.equal(output.sidecarFailureResolved,false);
 assert.equal(output.operationalWrites,0);
 assert.ok(!JSON.stringify(output).includes('SECRET_PRIVATE_SOURCE_DO_NOT_LEAK'));
 for(const bad of [
  {...raw,sourcePin:false},{...raw,ledgerStable:false},
  {...raw,gitVerified:false},{...raw,approved:null},
  {...raw,trackedClean:null},{...raw,head:'invalid'},
 ]){
  const uncertain=projectCnnGitEvidence(bad);
  assert.equal(uncertain.status,'STATE_UNKNOWN');
  assert.equal(uncertain.failurePredicateResolved,false);
 }
 const wrongRoot=inspectCnnGitPredicatesReadonly('/unapproved/location');
 assert.equal(wrongRoot.status,'STATE_UNKNOWN');
 assert.equal(wrongRoot.operationalWrites,0);
});

test('CNN tracks untracked-only dirt separately from tracked status with safe classification',async()=>{
 const {projectCnnGitEvidence}=await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const base={sourcePin:true,ledgerStable:true,ledgerStatus:'BLOCKED',
  head:'a'.repeat(40),approved:'a'.repeat(40),checkpoint:'a'.repeat(40),
  gitVerified:true,trackedClean:true,wholeTreeClean:false,
  mentionsCheckout:true,guardSites:true,
  sourceStatusGuardClass:'DEFAULT_OR_UNKNOWN',
  sourceText:'PRIVATE_SOURCE_DO_NOT_LOG',
  untrackedStatus:'?? SECRET_CREDENTIALS.txt'};
 const x=projectCnnGitEvidence(base);
 assert.equal(x.status,'PASS');
 assert.equal(x.gitHeadMatchesConfig,true);
 assert.equal(x.trackedTreeClean,true);
 assert.equal(x.wholeTreeClean,false);
 assert.equal(x.untrackedOnlyDirty,true);
 assert.equal(x.sourceStatusGuardClass,'DEFAULT_OR_UNKNOWN');
 assert.equal(x.failurePredicateResolved,false);
 assert.equal(x.sidecarFailureResolved,false);
 assert.equal(x.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(x),/PRIVATE_SOURCE_DO_NOT_LOG|SECRET_CREDENTIALS/);
 const clean=projectCnnGitEvidence({...base,wholeTreeClean:true});
 assert.equal(clean.untrackedOnlyDirty,false);
 const unknown=projectCnnGitEvidence({...base,wholeTreeClean:null});
 assert.equal(unknown.wholeTreeClean,null);
 assert.equal(unknown.untrackedOnlyDirty,null);
 const invalid=projectCnnGitEvidence({...base,sourceStatusGuardClass:'SECRET_VALUE'});
 assert.equal(invalid.sourceStatusGuardClass,'UNVERIFIED');
 const withoutPin=projectCnnGitEvidence({...base,sourcePin:false});
 assert.equal(withoutPin.sourceStatusGuardClass,'UNVERIFIED');
 assert.equal(withoutPin.status,'STATE_UNKNOWN');
});

test('CNN pinned SOURCE SHA origin classifier returns only bounded static classes',async()=>{
 const {classifyPinnedCnnGuardOrigin,projectCnnGitEvidence}=
  await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const source=[
  'const EXPECTED_SOURCE_SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";',
  'const secret="PRIVATE_TOKEN_MUST_NOT_ESCAPE";',
  "const v=execFileSync('git',['rev-parse','HEAD']);",
  "if(!v) throw Error('SOURCE SHA');"
 ].join('\n');
 const a=classifyPinnedCnnGuardOrigin(source,'b'.repeat(40));
 assert.equal(a.reasonLine,4);
 assert.equal(a.reasonSiteClass,'THROW');
 assert.equal(a.gitBinaryClass,'PATH_LOOKUP');
 assert.equal(a.fixedShaRelation,'MISMATCH');
 assert.doesNotMatch(JSON.stringify(a),/PRIVATE_TOKEN|aaaaaaaa|bbbbbbbb/);
 const b=classifyPinnedCnnGuardOrigin(source,'a'.repeat(40));
 assert.equal(b.fixedShaRelation,'MATCH');
 const c=classifyPinnedCnnGuardOrigin(source.replace("throw Error('SOURCE SHA');",
  "need(v,'SOURCE SHA');"),'a'.repeat(40));
 assert.equal(c.reasonSiteClass,'CHECK_HELPER');
 const d=classifyPinnedCnnGuardOrigin('const z=10;','a'.repeat(40));
 assert.equal(d.reasonSiteClass,'NO_DIRECT_LITERAL');
 assert.equal(d.gitBinaryClass,'UNVERIFIED');
 const e=classifyPinnedCnnGuardOrigin(source+'\nthrow Error("SOURCE SHA");','a'.repeat(40));
 assert.equal(e.reasonLine,null);
 assert.equal(e.reasonSiteClass,'MULTIPLE_LITERAL_SITES');
 const old={sourcePin:true,ledgerStable:true,ledgerStatus:'BLOCKED',
  head:'b'.repeat(40),approved:'b'.repeat(40),checkpoint:'b'.repeat(40),
  gitVerified:true,trackedClean:true,wholeTreeClean:true,guardSites:true,
  guardOrigin:a};
 const projected=projectCnnGitEvidence(old);
 assert.equal(projected.guardOrigin.reasonLine,4);
 assert.equal(projected.guardOrigin.gitBinaryClass,'PATH_LOOKUP');
 assert.equal(projected.guardOrigin.fixedShaRelation,'MISMATCH');
 assert.equal(projected.failurePredicateResolved,false);
 assert.equal(projected.operationalWrites,0);
 assert.equal(projected.providerCalls,0);
 assert.equal(projected.d1Writes,0);
 const unknown=projectCnnGitEvidence({...old,sourcePin:false});
 assert.equal(unknown.guardOrigin,null);
 assert.equal(unknown.status,'STATE_UNKNOWN');
});

test('CNN SHA40 literal comparison is bounded and never exposes private pins',async()=>{
 const {projectCnnGitEvidence}=await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const base={sourcePin:true,ledgerStable:true,ledgerStatus:'BLOCKED',
  head:'a'.repeat(40),approved:'a'.repeat(40),checkpoint:'a'.repeat(40),
  gitVerified:true,trackedClean:true,wholeTreeClean:true,
  sourceShaLiterals:['b'.repeat(40)],
  secret:'PRIVATE_CODE_OR_TOKEN_DO_NOT_LEAK'};
 const probe=v=>projectCnnGitEvidence({...base,...v});
 assert.equal(probe({}).pinnedScriptSha40LiteralRelation,'OTHER_ONLY');
 assert.equal(probe({sourceShaLiterals:['a'.repeat(40)]})
  .pinnedScriptSha40LiteralRelation,'APPROVED_ONLY');
 assert.equal(probe({sourceShaLiterals:['a'.repeat(40),'b'.repeat(40)]})
  .pinnedScriptSha40LiteralRelation,'MIXED');
 assert.equal(probe({sourceShaLiterals:[]})
  .pinnedScriptSha40LiteralRelation,'NONE');
 assert.equal(probe({sourceShaLiterals:Array.from({length:5},(_,i)=>
  String(i+1).repeat(40))}).pinnedScriptSha40LiteralRelation,'AMBIGUOUS');
 for(const invalid of [{sourcePin:false},{ledgerStable:false},
  {gitVerified:false},{approved:null},{sourceShaLiterals:null}]){
  assert.equal(probe(invalid).pinnedScriptSha40LiteralRelation,'UNVERIFIED');
 }
 const output=probe({});
 assert.equal(output.failurePredicateResolved,false);
 assert.equal(output.sidecarFailureResolved,false);
 assert.equal(output.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(output),/PRIVATE_CODE_OR_TOKEN|bbbbbbbbbbbb|aaaaaaaaaaaa/);
});

test('CNN fixed SHA guard reference only reports candidate line categories',async()=>{
 const {classifyPinnedCnnGuardOrigin,projectCnnGitEvidence}=
  await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const lines=Array.from({length:26},()=>'const noop=0;');
 lines[0]='const APPROVED_SOURCE_SHA="'+('a'.repeat(40))+'";';
 lines[18]="if(head !== APPROVED_SOURCE_SHA) throw Error('SOURCE SHA');";
 lines[20]="if(config !== head) throw Error('OTHER');";
 lines[22]="if(dirty) throw Error('DIRTY');";
 const original=lines.join('\n')+'\nconst PRIVATE_SECRET="NEVER_PUBLISH";';
 const exact=classifyPinnedCnnGuardOrigin(original,'b'.repeat(40));
 assert.equal(exact.fixedShaRelation,'MISMATCH');
 assert.equal(exact.fixedShaGuardReference,'LINE_19');
 assert.doesNotMatch(JSON.stringify(exact),/NEVER_PUBLISH|APPROVED_SOURCE_SHA|aaaaaaaa/);
 lines[18]="if(head !== other) throw Error('SOURCE SHA');";
 assert.equal(classifyPinnedCnnGuardOrigin(lines.join('\n'),'b'.repeat(40))
  .fixedShaGuardReference,'NOT_REFERENCED_IN_CANDIDATE_GUARDS');
 lines[18]="if(head !== APPROVED_SOURCE_SHA) throw Error('SOURCE SHA');";
 lines[20]="if(config !== APPROVED_SOURCE_SHA) throw Error('OTHER');";
 assert.equal(classifyPinnedCnnGuardOrigin(lines.join('\n'),'b'.repeat(40))
  .fixedShaGuardReference,'MULTIPLE_CANDIDATE_GUARDS');
 const output=projectCnnGitEvidence({sourcePin:true,ledgerStable:true,ledgerStatus:'BLOCKED',
  gitVerified:true,trackedClean:true,wholeTreeClean:true,
  head:'b'.repeat(40),approved:'b'.repeat(40),checkpoint:'b'.repeat(40),
  sourceShaLiterals:['a'.repeat(40)],guardOrigin:exact});
 assert.equal(output.guardOrigin.fixedShaGuardReference,'LINE_19');
 assert.equal(output.pinnedScriptSha40LiteralRelation,'OTHER_ONLY');
 assert.equal(output.failurePredicateResolved,false);
 assert.equal(output.operationalWrites,0);
 assert.equal(output.providerCalls,0);
 assert.equal(output.d1Writes,0);
 assert.equal(projectCnnGitEvidence({...output,sourcePin:false}).guardOrigin,null);
});

test('CNN guard classifier includes exact source and approved names rather than returning false unknown',async()=>{
 const {classifyPinnedCnnGuardOrigin}=await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const make=name=>{
  const rows=Array.from({length:25},()=>'const noop=0;');
  rows[0]='const '+name+'="'+('a'.repeat(40))+'";';
  rows[18]="if(head !== "+name+") need(false,'SOURCE SHA');";
  rows[20]="if(config !== head) need(false,'OTHER');";
  rows[22]="if(dirty) need(false,'DIRTY');";
  return rows.join('\n');
 };
 for(const name of ['source','approved','SOURCE','APPROVED_SOURCE_SHA']){
  const v=classifyPinnedCnnGuardOrigin(make(name),'b'.repeat(40));
  assert.equal(v.fixedShaRelation,'MISMATCH');
  assert.equal(v.fixedShaGuardReference,'LINE_19');
  assert.equal(v.reasonSiteClass,'CHECK_HELPER');
  assert.doesNotMatch(JSON.stringify(v),/aaaaaaaaaaaaaaaa|APPROVED_SOURCE_SHA/);
 }
 const d=classifyPinnedCnnGuardOrigin(make('irrelevant'),'b'.repeat(40));
 assert.equal(d.fixedShaGuardReference,'UNVERIFIED');
});

test('CNN pinned source-guard windows do not double count an adjacent guard',async()=>{
 const {classifyPinnedCnnGuardOrigin,projectCnnGitEvidence}=
  await import('../controller/cnn-sidecar-git-predicates-readonly.mjs');
 const pin='a'.repeat(40),approved='b'.repeat(40);
 const make=()=>Array.from({length:26},(_,i)=>i===0?
  'const APPROVED_SOURCE_SHA="'+pin+'";':'const noop=0;');
 const classify=lines=>classifyPinnedCnnGuardOrigin(lines.join('\n'),approved);
 let lines=make();
 lines[18]="if (a) need(true,'OTHER');";
 lines[20]="if (head!==APPROVED_SOURCE_SHA) need(false,'SOURCE SHA');";
 lines[22]="if (dirty) need(false,'DIRTY');";
 let result=classify(lines);
 // Prior [19,22) and [21,24) scans both included physical line 21.
 assert.equal(result.fixedShaRelation,'MISMATCH');
 assert.equal(result.fixedShaGuardReference,'LINE_21');
 lines=make();
 lines[18]="if (a) need(true,'OTHER');";
 lines[20]="if (b) need(true,'OTHER');";
 lines[22]="if (head!==APPROVED_SOURCE_SHA) need(false,'SOURCE SHA');";
 result=classify(lines);
 assert.equal(result.fixedShaGuardReference,'LINE_23');
 lines[18]="if (head!==APPROVED_SOURCE_SHA) need(false,'SOURCE SHA');";
 assert.equal(classify(lines).fixedShaGuardReference,'MULTIPLE_CANDIDATE_GUARDS');
 lines=make();
 lines[18]="if (head !== (";
 lines[19]="APPROVED_SOURCE_SHA)) need(false,'SOURCE SHA');";
 lines[20]="if (other) need(true,'OTHER');";
 lines[22]="if (dirty) need(false,'DIRTY');";
 assert.equal(classify(lines).fixedShaGuardReference,'LINE_19');
 lines=make();
 lines[18]="if (other) need(true,'OTHER');";
 lines[20]="if (other) need(true,'OTHER');";
 lines[22]="if (dirty) need(false,'DIRTY');";
 assert.equal(classify(lines).fixedShaGuardReference,'NOT_REFERENCED_IN_CANDIDATE_GUARDS');
 assert.equal(classify(lines).gitBinaryClass,'UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(result),/aaaaaaaaaaaaaaaa|bbbbbbbbbbbb/);
 const output=projectCnnGitEvidence({sourcePin:true,ledgerStable:true,
  ledgerStatus:'BLOCKED',head:approved,approved,checkpoint:approved,
  gitVerified:true,trackedClean:true,wholeTreeClean:true,guardOrigin:result});
 assert.equal(output.failurePredicateResolved,false);
 assert.equal(output.sidecarFailureResolved,false);
 assert.equal(output.operationalWrites,0);
 assert.equal(output.providerCalls,0);
 assert.equal(output.d1Writes,0);
});


test('CNN Sidecar B manifest pin read is strictly fixed operating owner A only',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const q={...e,issue:{...e.issue,body:JSON.stringify({...p,
  probe:'cnn-sidecar-b-preimage-pins-readonly'})}};
 const auth=authenticateProcess(q,env,'operating');
 assert.equal(auth.cnnSidecarBPreimagePins,true);
 assert.throws(()=>authenticateProcess(q,env,'handoff'));
 for(const bad of ['cnn-sidecar-b-preimage-pins-readonly;cmd',
  'cnn-sidecar-b-preimage-pins','cnn-sidecar-b-preimage-pins-readonly ']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe:bad})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...q,issue:{...q.issue,
  body:JSON.stringify({...p,probe:'cnn-sidecar-b-preimage-pins-readonly',target:'SECRET'})}},env,'operating'));
});


test('CNN Sidecar B resource check is a fixed operating-only A route',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const q={...e,issue:{...e.issue,body:JSON.stringify({...p,
  probe:'cnn-sidecar-b-resource-readonly'})}};
 const auth=authenticateProcess(q,env,'operating');
 assert.equal(auth.cnnSidecarBResources,true);
 assert.throws(()=>authenticateProcess(q,env,'handoff'));
 for(const bad of ['cnn-sidecar-b-resource-readonly;cmd',
  'cnn-sidecar-b-resource-readonly ','cnn-sidecar-b-resource']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe:bad})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...q,issue:{...q.issue,
  body:JSON.stringify({...p,probe:'cnn-sidecar-b-resource-readonly',
   target:'SECRET'})}},env,'operating'));
});


test('CNN B Core readiness probe requires exact operating A owner',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const q={...e,issue:{...e.issue,body:JSON.stringify({...p,
  probe:'cnn-sidecar-b-core-readonly'})}};
 assert.equal(authenticateProcess(q,env,'operating').cnnSidecarBCore,true);
 assert.throws(()=>authenticateProcess(q,env,'handoff'));
 for(const name of ['cnn-sidecar-b-core-readonly ','cnn-sidecar-b-core-readonly;cmd',
  'cnn-sidecar-b-core']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe:name})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...q,issue:{...q.issue,
  body:JSON.stringify({...p,probe:'cnn-sidecar-b-core-readonly',
   command:'PRIVATE'})}},env,'operating'));
});

test('W04 #3516 fixed recovery A scope accepts only operating role and no arbitrary path',()=>{
 const e=event(),b=JSON.parse(e.issue.body);
 const scoped={...e,issue:{...e.issue,body:JSON.stringify({...b,
  probe:'w04-3516-maintenance-status-readonly'})}};
 assert.equal(authenticateProcess(scoped,env,'operating').w043516MaintenanceStatus,true);
 assert.throws(()=>authenticateProcess(scoped,env,'handoff'));
 for(const probe of ['w04-3516-maintenance-status-readonly;cmd',
  'w04-3519-maintenance-status-readonly','w04-3516-maintenance-status-readonly/../../']) {
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...b,probe})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...scoped,issue:{...scoped.issue,
  body:JSON.stringify({...b,probe:'w04-3516-maintenance-status-readonly',
   path:'E:/ZGmini/data/core.sqlite'})}},env,'operating'));
});
test('W04 #3516 recovery attestation must bind exact issue, SHA and postcheck',()=>{
 const id='pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1';
 const sha='83679b013ac9a9820331d93311ec97e572b18e13';
 const raw={actualControllerSha:sha,workflowState:'active',
  historicalRequest:{requestId:id,status:'RECOVERY_REQUIRED',
   code:'POSTCHECK_OUTCOME_UNKNOWN',phase:'RECOVERY_REQUIRED',
   firstFail:'POSTCHECK_PENDING',postIssueNumber:3519,secret:'SECRET_LEDGER'},
  recoveryEvidence:{requestId:id,leaseHeld:true,recoveryRequired:true,
   postIssueNumber:3519,
   installLease:{directory:'PRESENT',ownerFile:'PRESENT',
    recoveryMarker:'PRESENT',ownerMarkerMatch:true,nonce:'SECRET_OWNER'},
   backlog:{file:'PRESENT',windows:1,openWindows:0,replayCount:0,
    secret:'SECRET_BACKLOG'}}};
 const p=project3516MaintenanceStatus(raw);
 assert.equal(p.status,'READ_ONLY_OBSERVED');
 assert.equal(p.recoveryEligible,false);
 assert.equal(p.protectedStateUnchanged,null);
 assert.equal(p.historicalRequest.postIssueNumber,3519);
 assert.equal(p.recoveryEvidence.leaseHeld,true);
 assert.doesNotMatch(JSON.stringify(p),/SECRET_|nonce|ownerPid|command/i);
 for(const changed of [
  {...raw,actualControllerSha:'a'.repeat(40)},
  {...raw,historicalRequest:{...raw.historicalRequest,postIssueNumber:3518}},
  {...raw,recoveryEvidence:{...raw.recoveryEvidence,postIssueNumber:3518}},
  {...raw,recoveryEvidence:{...raw.recoveryEvidence,requestId:'not-target'}},
 ])assert.equal(project3516MaintenanceStatus(changed).status,'STATE_UNKNOWN');
 const unknown=project3516MaintenanceStatus(null);
 assert.equal(unknown.status,'STATE_UNKNOWN');
 assert.equal(compact3516ProcessResult({requestId:'safe'},unknown).status,'PARTIAL');
 const compact=compact3516ProcessResult({requestId:'safe',status:'RUNNING'},p);
 assert.equal(compact.status,'PASS');
 assert.equal(compact.maintenance,undefined);
 assert.ok(Buffer.byteLength(serializeProcessResult(compact))<32768);
 const text=toText(compact);
 assert.match(text,/w043516Status=READ_ONLY_OBSERVED/);
 assert.match(text,/w043516LeaseHeld=true/);
 assert.match(text,/w043516RecoveryArchive=UNVERIFIED/);
 const withArchive=compact3516ProcessResult({requestId:'safe'},
  {...p,recoveryArchive:{status:'ARCHIVE_VERIFIED',archiveRecordVerified:true}});
 assert.match(toText(withArchive),/w043516RecoveryArchive=ARCHIVE_VERIFIED/);
 assert.match(toText(withArchive),/w043516ArchiveRecord=true/);
 assert.doesNotMatch(text,/SECRET_|nonce/i);
});
test('W04 #3516 lease lineage requires original Issue/postcheck/target/marker chronology',()=>{
 const requestId='pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1';
 const targetSha='83679b013ac9a9820331d93311ec97e572b18e13';
 const ledger={requestId,issueNumber:3516,postIssueNumber:3519,targetSha,
  status:'RECOVERY_REQUIRED',firstFail:'POSTCHECK_PENDING',
  updatedAt:'2026-11-25T08:27:03.200Z'};
 const owner={pid:10101,nonce:'11111111-2222-4333-8444-555555555555',
  at:'2026-11-25T08:21:20.000Z'};
 const marker={requestOwnerPid:10101,nonce:owner.nonce,
  at:'2026-11-25T08:27:03.250Z'};
 assert.equal(assess3516OriginalLeaseLineage(ledger,owner,marker).correlated,true);
 for(const broken of [
  {...ledger,requestId:'wrong'},
  {...ledger,issueNumber:3409},
  {...ledger,postIssueNumber:3518},
  {...ledger,targetSha:'b'.repeat(40)},
  {...ledger,status:'PASS'},
 ])assert.equal(assess3516OriginalLeaseLineage(broken,owner,marker).correlated,false);
 assert.equal(assess3516OriginalLeaseLineage(ledger,owner,{...marker,nonce:'wrong'}).correlated,false);
 assert.equal(assess3516OriginalLeaseLineage(ledger,owner,
  {...marker,at:'2026-11-25T08:32:03.250Z'}).correlated,false);
});

test('R3 exact operating A probe only admits fixed Watchdog preimage, no commands',()=>{
 const e=event(),p=JSON.parse(e.issue.body);
 const scoped={...e,issue:{...e.issue,body:JSON.stringify({
  ...p,probe:'controller-standby-watchdog-preimage-readonly'})}};
 assert.equal(authenticateProcess(scoped,env,'operating').watchdogR3Preimage,true);
 assert.throws(()=>authenticateProcess(scoped,env,'handoff'));
 for(const probe of ['controller-standby-watchdog-preimage-readonly;cmd',
  'controller-standby-watchdog-preimage-readonly/../secret']){
  assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
   body:JSON.stringify({...p,probe})}},env,'operating'));
 }
 assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
  body:JSON.stringify({...p,probe:'controller-standby-watchdog-preimage-readonly',
   path:'E:/outside'})}},env,'operating'));
});
test('R3 Watchdog A attests fixed source bytes, matching raw manifest and scope',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r3-watchdog-preimage-'));
 const code=Buffer.from('// faithful source fixture only, no runner or worker spawn');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 try{
  fs.writeFileSync(path.join(home,'runner-watchdog.mjs'),code);
  const manifest={sha256:hash(code),scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1'};
  const raw=Buffer.from(JSON.stringify(manifest));
  fs.writeFileSync(path.join(home,'INSTALL.json'),raw);
  const r=inspectR3WatchdogPreimageReadonly({watchdogHome:home});
  assert.equal(r.status,'PASS');
  assert.equal(r.installedMatch,true);
  assert.equal(r.sourceSha256,hash(code));
  assert.equal(r.manifestSha256,hash(raw));
  assert.equal(r.declaredSha256,manifest.sha256);
  assert.equal(r.scope,manifest.scope);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.providerCalls,0);
  assert.equal(r.d1Writes,0);
  const txt=toText({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
   watchdogR3Preimage:r});
  assert.match(txt,/watchdogSourceSha256=/);
  assert.doesNotMatch(txt,/faithful source|INSTALL\.json|E:\\\\ZGmini/);
  assert.ok(Buffer.byteLength(JSON.stringify(r))<2048);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('R3 Watchdog A distinguishes mismatched source, manifest, alias and missing files',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r3-watchdog-denied-'));
 const code='// fixed watchdog source, one file, no other changes';
 const hash=b=>createHash('sha256').update(b).digest('hex');
 try{
  fs.writeFileSync(path.join(home,'runner-watchdog.mjs'),code);
  const f=path.join(home,'INSTALL.json');
  fs.writeFileSync(f,JSON.stringify({sha256:hash(code),scope:'RUNNER_RECOVERY_ONLY'}));
  assert.equal(inspectR3WatchdogPreimageReadonly({watchdogHome:home}).status,'PASS');
  fs.writeFileSync(path.join(home,'runner-watchdog.mjs'),code+' changed');
  const mismatch=inspectR3WatchdogPreimageReadonly({watchdogHome:home});
  assert.equal(mismatch.status,'STATE_UNKNOWN');
  assert.equal(mismatch.installedMatch,false);
  assert.notEqual(mismatch.sourceSha256,mismatch.declaredSha256);
  fs.writeFileSync(f,JSON.stringify({sha256:hash(code+' changed'),scope:'UNTRUSTED'}));
  assert.equal(inspectR3WatchdogPreimageReadonly({watchdogHome:home}).status,'STATE_UNKNOWN');
  fs.rmSync(f);
  const absent=inspectR3WatchdogPreimageReadonly({watchdogHome:home});
  assert.equal(absent.status,'STATE_UNKNOWN');
  assert.equal(absent.sourceSha256,null);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('R3 fixed operating A WMI probe authenticates without arbitrary path or role',()=>{
 const original=event('operating'),body=JSON.parse(original.issue.body);
 const requested={...original,issue:{...original.issue,body:JSON.stringify({
  ...body,probe:'controller-standby-runner-wmi-readonly'})}};
 assert.equal(authenticateProcess(requested,env,'operating').standbyRunnerWmi,true);
 assert.throws(()=>authenticateProcess(requested,env,'handoff'));
 for(const probe of ['controller-standby-runner-wmi-readonly;whoami',
  'controller-standby-runner-wmi-test-only']){
  const bad={...original,issue:{...original.issue,body:JSON.stringify({...body,probe})}};
  assert.throws(()=>authenticateProcess(bad,env,'operating'));
 }
 const pathAttack={...original,issue:{...original.issue,body:JSON.stringify({
  ...body,probe:'controller-standby-runner-wmi-readonly',path:'C:/Windows/secrets'})}};
 assert.throws(()=>authenticateProcess(pathAttack,env,'operating'));
});

test('R3 WMI classifier returns only bounded category counts, no PID or executable path',()=>{
 const canonicalize=p=>p;
 const fixture={rows:[
  {pid:4311,name:'Runner.Listener.exe',
   executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\seat-1\\Runner.Listener.exe'},
  {pid:4312,name:'Runner.Worker.exe',
   executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\seat-2\\Runner.Worker.exe'},
  {pid:4313,name:'Runner.Listener.exe',
   executablePath:'C:\\DifferentRunner\\Runner.Listener.exe'}]};
 const observed=classifyR3RunnerWmiRows(fixture,{canonicalize});
 assert.equal(observed.status,'PASS');
 assert.equal(observed.code,'STANDBY_WMI_EXECUTABLE_PATHS_CLASSIFIED');
 assert.equal(observed.controllerListenerCount,1);
 assert.equal(observed.controllerWorkerCount,1);
 assert.equal(observed.unknownPathCount,0);
 assert.equal(observed.promotionApproved,false);
 assert.doesNotMatch(JSON.stringify(observed),/4311|seat-1|DifferentRunner|executablePath/i);
 for(const wrong of [
  null,{rows:'bad'},{rows:[...fixture.rows,fixture.rows[0]]},
  {rows:[{pid:4314,name:'node.exe',executablePath:'E:\\runner.exe'}]},
  {rows:[{pid:4314,name:'Runner.Listener.exe',executablePath:''}]},
  {rows:Array.from({length:257},(_,i)=>({pid:1000+i,name:'Runner.Worker.exe',
   executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\seat-1\\Runner.Worker.exe'}))}
 ]){
  assert.equal(classifyR3RunnerWmiRows(wrong,{canonicalize}).status,'STATE_UNKNOWN');
 }
 const inaccessible=classifyR3RunnerWmiRows(fixture,{canonicalize:p=>{
  if(p.includes('DifferentRunner'))throw Error('EPERM');return p;}});
 assert.equal(inaccessible.status,'STATE_UNKNOWN');
});

test('R3 WMI Windows source uses fixed no-shell CIM executable and fails closed',()=>{
 const script=inspectR3RunnerWmiReadonly({
  env:{SystemRoot:'C:\\Windows'},run:()=>({status:0,stdout:'{}'}),
  filesystem:{statSync:()=>({isFile:()=>true})},canonicalize:p=>p});
 // Off-host CI must not mistake synthetic inputs for real WMI proof.
 if(process.platform!=='win32'){
  assert.equal(script.status,'STATE_UNKNOWN');
  assert.equal(script.code,'STANDBY_WMI_WINDOWS_SCOPE_UNVERIFIED');
 }else{
  assert.equal(script.status,'STATE_UNKNOWN');
  assert.equal(script.code,'STANDBY_WMI_ROWS_UNVERIFIED');
 }
 assert.equal(script.promotionApproved,false);
});

test('R3 WMI exact unknown process type and cause remain safe aggregate counts',()=>{
 const rows=[
  {pid:7501,name:'Runner.Listener.exe',
   executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\seat-1\\Runner.Listener.exe'},
  {pid:7502,name:'Runner.Worker.exe',executablePath:''},
  {pid:7503,name:'Runner.Worker.exe',
   executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\seat-3\\Runner.Worker.exe'},
  {pid:7504,name:'Runner.Worker.exe',executablePath:'relative.exe'}];
 const result=classifyR3RunnerWmiRows({rows},{canonicalize:p=>{
  if(p.includes('seat-3'))throw Error('REDACTED_EXAMPLE_ACCESS_DENIED');
  return p;}});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'STANDBY_WMI_EXECUTABLE_PATH_UNVERIFIED');
 assert.equal(result.controllerListenerCount,1);
 assert.equal(result.unknownPathCount,3);
 assert.equal(result.unknownListenerCount,0);
 assert.equal(result.unknownWorkerCount,3);
 assert.equal(result.missingWmiPathCount,1);
 assert.equal(result.nonAbsoluteWmiPathCount,1);
 assert.equal(result.canonicalizationFailedCount,1);
 assert.equal(result.promotionApproved,false);
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/7501|7502|7503|7504|relative\.exe|seat-3|ACCESS_DENIED|executablePath/i);
 const text=toText({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
  requestId:'fixed',role:'operating',runId:1,attempt:1,host:'PC',
  runnerName:'zgmini-pc-01',status:result.status,code:result.code,
  observedAtUtc:'2026-11-26T00:00:00.000Z',standbyRunnerWmi:result});
 assert.match(text,/wmiUnknownWorkerCount=3/);
 assert.match(text,/wmiMissingPathCount=1/);
 assert.match(text,/wmiCanonicalizationFailedCount=1/);
 assert.doesNotMatch(text,/7501|7502|7503|7504|relative\.exe|seat-3|ACCESS_DENIED/);
});
