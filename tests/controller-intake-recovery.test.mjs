import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {planIntakeRecovery,commitIntakeRecovery,REQUEST,REQUEST1745,plan1745IntakeRecovery} from '../tools/controller-intake-recovery.mjs';
const body={operation:'theme-platform-shadow-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'main',sourceSha:'a'.repeat(40),requestId:'pc-original'};
function fixture(){
 const receipt=b=>({schema:'ZGMINI_PC_RESULT_V1',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  requestId:b.requestId,operation:b.operation,sourceRepository:b.sourceRepository,sourceBranch:b.sourceBranch,
  requestedSourceSha:b.sourceSha,protectedStateUnchanged:true,providerCalls:0,operationalWrites:0,d1Writes:0,
  status:'PASS',startedAt:'2026-11-16T01:32:44.000Z',finishedAt:'2026-11-16T01:33:00.000Z'});
 const replacement={...body,requestId:'pc-replacement'};
 return {ledger:{requestId:REQUEST,issueNumber:1501,status:'RECOVERY_REQUIRED',firstFail:'RECONNECTED',
  failureOperation:'resumeIntake',targetSha:'b'.repeat(40)},identityVerified:true,ownerAlive:false,
  status:{runtimeState:'HEALTHY',maintenanceState:'HEALTHY',workflowState:'active',actualControllerSha:'b'.repeat(40),
   installLock:{held:true,recoveryRequired:true},observedAt:'2026-11-16T13:00:00Z'},
  backlog:{schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQUEST,pausedAt:'2026-11-16T00:46:38Z',resumedAt:null,
   windows:[{pausedAt:'2026-11-16T00:46:38Z',resumedAt:null}],replays:{}},
  protectedTasksSame:true,searchComplete:true,candidates:[1508,1503],original1503:{...body},replacement1517:replacement,
  original1508:{...body},receipt1508:receipt(body),receipt1517:{...receipt(replacement),status:'BLOCKED'},
  botReceipt1508:true,botReceipt1517:true,resultPairsVerified:true};
}
test('reconciles equivalent BLOCKED execution without converting it into functional PASS or replay',()=>{
 const f=fixture(),before=structuredClone(f),r=planIntakeRecovery(f);
 assert.deepEqual(f,before);assert.equal(r.summary.replacementFunctionalStatus,'BLOCKED');
 assert.equal(r.summary.replayedRequests,0);assert.equal(r.summary.controllerChanged,false);
 assert.equal(r.summary.workflowChanged,false);assert.equal(r.backlog.resumeEvidence.exactEnableTimeKnown,false);
 assert.equal(r.backlog.replays['1503'].status,'SKIPPED_EQUIVALENT_EXECUTION');
});
const rejected={
 wrongRequest:f=>f.ledger.requestId='pc-other',wrongIssue:f=>f.ledger.issueNumber=1499,
 wrongPhase:f=>f.ledger.firstFail='SWITCHED',postcheckPending:f=>f.ledger.postIssueNumber=1700,
 liveOwner:f=>f.ownerAlive=true,unknownOwner:f=>f.ownerAlive=null,identity:f=>f.identityVerified=false,
 runtime:f=>f.status.runtimeState='UNVERIFIED',maintainer:f=>f.status.maintenanceState='UNVERIFIED',
 inactiveWorkflow:f=>f.status.workflowState='disabled_manually',wrongTarget:f=>f.status.actualControllerSha='c'.repeat(40),
 noLock:f=>f.status.installLock.held=false,closedWindow:f=>f.backlog.windows[0].resumedAt='2026-11-16T01:00:00Z',
 priorReplay:f=>f.backlog.replays['1503']={status:'POSTING'},taskDrift:f=>f.protectedTasksSame=false,
 incompleteSearch:f=>f.searchComplete=false,extraCandidate:f=>f.candidates.push(1504),missingCandidate:f=>f.candidates=[1508],
 replacementSource:f=>f.replacement1517.sourceSha='c'.repeat(40),replacementOperation:f=>f.replacement1517.operation='other',
 receiptRequest:f=>f.receipt1517.requestId='pc-other',receiptSource:f=>f.receipt1517.requestedSourceSha='c'.repeat(40),
 receiptUnfinished:f=>f.receipt1517.finishedAt=null,receiptRunning:f=>f.receipt1517.status='RUNNING',
 providerCall:f=>f.receipt1517.providerCalls=1,operationalWrite:f=>f.receipt1517.operationalWrites=1,
 d1Write:f=>f.receipt1517.d1Writes=1,protection:f=>f.receipt1517.protectedStateUnchanged=false,
 botReceipt:f=>f.botReceipt1517=false,missingPair:f=>f.resultPairsVerified=false,
 resumeEvidenceFailed:f=>f.receipt1508.status='BLOCKED',badTime:f=>f.receipt1508.startedAt='bad',
 beforePause:f=>f.receipt1508.startedAt='2026-11-15T00:00:00Z',
};
for(const [name,mutate] of Object.entries(rejected))test('refuses '+name,()=>{
 const f=fixture();mutate(f);assert.throws(()=>planIntakeRecovery(f));
});
function transaction(){
 const rootDir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-intake-test-'));
 fs.mkdirSync(path.join(rootDir,'leases/controller-install'),{recursive:true});
 const files={ledger:path.join(rootDir,'ledger.json'),owner:path.join(rootDir,'leases/controller-install/owner.json'),
  marker:path.join(rootDir,'leases/controller-install/RECOVERY_REQUIRED.json'),
  host:path.join(rootDir,'host.json'),baseline:path.join(rootDir,'baseline.json'),backlog:path.join(rootDir,'backlog.json')};
 const bytes=Object.fromEntries(Object.entries(files).map(([k,p])=>{
  const b=Buffer.from(JSON.stringify({kind:k}));fs.writeFileSync(p,b);return [k,b];
 }));
 const e={files,bytes,hashes:{fixture:'unchanged'},ownerPid:123,
  backlog:{reconciled:true},summary:{originalLedgerPreserved:true,replayedRequests:0}};
 return {rootDir,e,proposal:{},sourceSha:'a'.repeat(40),freshEvidence:()=>e,verifyFinal:()=>{},isAlive:()=>false};
}
test('transaction preserves original journal and backlog bytes and archives the complete lease',()=>{
 const f=transaction();try{
  const r=commitIntakeRecovery(f);
  assert.equal(r.status,'INTAKE_RECOVERED_EXISTING_CONTROLLER_PRESERVED');
  assert.equal(fs.existsSync(path.join(f.rootDir,'leases/controller-install')),false);
  assert.equal(fs.existsSync(path.join(f.rootDir,'leases/controller-recovery')),false);
  assert.deepEqual(fs.readFileSync(f.e.files.ledger),f.e.bytes.ledger);
  assert.deepEqual(fs.readFileSync(path.join(f.rootDir,'recovery',r.archiveName,'owner.json')),f.e.bytes.owner);
  const backup=fs.readdirSync(path.join(f.rootDir,'recovery')).find(x=>x.endsWith('.original-backlog.json'));
  assert.deepEqual(fs.readFileSync(path.join(f.rootDir,'recovery',backup)),f.e.bytes.backlog);
 }finally{fs.rmSync(f.rootDir,{recursive:true,force:true});}
});
test('fresh evidence change refuses all bookkeeping changes and releases only own claim',()=>{
 const f=transaction();try{
  f.freshEvidence=()=>({hashes:{changed:true}});
  assert.throws(()=>commitIntakeRecovery(f),{code:'INTAKE_EVIDENCE_CHANGED'});
  assert.deepEqual(fs.readFileSync(f.e.files.backlog),f.e.bytes.backlog);
  assert.ok(fs.existsSync(path.join(f.rootDir,'leases/controller-install')));
  assert.equal(fs.existsSync(path.join(f.rootDir,'leases/controller-recovery')),false);
 }finally{fs.rmSync(f.rootDir,{recursive:true,force:true});}
});
test('uncertain final check retains original lease, reservation and PREPARED evidence without rollback',()=>{
 const f=transaction();try{
  f.verifyFinal=()=>{throw Object.assign(Error(),{code:'FIXTURE_RUNTIME_DRIFT'});};
  assert.throws(()=>commitIntakeRecovery(f),{code:'FIXTURE_RUNTIME_DRIFT'});
  assert.ok(fs.existsSync(path.join(f.rootDir,'leases/controller-install')));
  assert.ok(fs.existsSync(path.join(f.rootDir,'leases/controller-recovery')));
  assert.deepEqual(fs.readFileSync(f.e.files.ledger),f.e.bytes.ledger);
  assert.throws(()=>commitIntakeRecovery(f),{code:'EEXIST'});
 }finally{fs.rmSync(f.rootDir,{recursive:true,force:true});}
});
test('identity drift after backlog write cannot archive a different owner',()=>{
 const f=transaction();try{
  f.verifyFinal=()=>fs.writeFileSync(f.e.files.owner,'{}');
  assert.throws(()=>commitIntakeRecovery(f),{code:'INTAKE_FINAL_IDENTITY_DRIFT'});
  assert.ok(fs.existsSync(path.join(f.rootDir,'leases/controller-install')));
 }finally{fs.rmSync(f.rootDir,{recursive:true,force:true});}
});

function fixture1745(){
 const e=fixture();e.ledger={...e.ledger,requestId:REQUEST1745,issueNumber:1745,
 targetSha:'e3a495c97d6b40d6d4eea2ff4f586bef46216eb7'};
 e.status.actualControllerSha=e.ledger.targetSha;
 e.backlog={schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQUEST1745,pausedAt:'2026-11-16T13:24:40.774Z',resumedAt:null,
 windows:[{pausedAt:'2026-11-16T13:24:40.774Z',resumedAt:null}],replays:{}};
 e.candidates=[1747];e.original1747={...body,operation:'core-status'};
 e.receipt1747={...e.receipt1508,operation:'core-status',code:'CORE_READONLY_DIAGNOSIS',firstFail:null,
 actualExecutionSha:e.ledger.targetSha,controlSourceSha:e.ledger.targetSha,
 startedAt:'2026-11-16T13:30:32.296Z',finishedAt:'2026-11-16T13:30:37.553Z'};
 e.botReceipt1747=true;return e;
}
test('#1745 reconciles the single already executed request without replay or changing installed Controller',()=>{
 const e=fixture1745(),before=structuredClone(e),r=plan1745IntakeRecovery(e);
 assert.deepEqual(e,before);assert.equal(r.summary.requestId,REQUEST1745);
 assert.equal(r.summary.replayedRequests,0);assert.equal(r.summary.controllerChanged,false);
 assert.deepEqual(Object.keys(r.backlog.replays),['1747']);
 assert.equal(r.backlog.resumeEvidence.exactEnableTimeKnown,false);
});
const rejected1745={
 request:e=>e.ledger.requestId=REQUEST,issue:e=>e.ledger.issueNumber=1501,
 phase:e=>e.ledger.firstFail='SWITCHED',postcheck:e=>e.ledger.postIssueNumber=1788,
 alive:e=>e.ownerAlive=true,unknownOwner:e=>e.ownerAlive=null,identity:e=>e.identityVerified=false,
 runtime:e=>e.status.runtimeState='UNVERIFIED',receiver:e=>e.status.maintenanceState='UNVERIFIED',
 workflow:e=>e.status.workflowState='disabled_manually',target:e=>e.ledger.targetSha='b'.repeat(40),
 unlocked:e=>e.status.installLock.held=false,marker:e=>e.status.installLock.recoveryRequired=false,
 requestBacklog:e=>e.backlog.requestId=REQUEST,window:e=>e.backlog.windows[0].pausedAt='2026-11-16T13:25:00Z',
 topWindow:e=>e.backlog.resumedAt=e.receipt1747.startedAt,priorReplay:e=>e.backlog.replays.x={},
 protection:e=>e.protectedTasksSame=false,truncated:e=>e.searchComplete=false,
 extra:e=>e.candidates.push(1748),missing:e=>e.candidates=[],
 receiptId:e=>e.receipt1747.requestId='other',operation:e=>e.original1747.operation='other',
 source:e=>e.receipt1747.requestedSourceSha='c'.repeat(40),execution:e=>e.receipt1747.actualExecutionSha='c'.repeat(40),
 writes:e=>e.receipt1747.operationalWrites=1,provider:e=>e.receipt1747.providerCalls=1,d1:e=>e.receipt1747.d1Writes=1,
 blocked:e=>e.receipt1747.status='BLOCKED',code:e=>e.receipt1747.code='OTHER',
 unprotected:e=>e.receipt1747.protectedStateUnchanged=false,bot:e=>e.botReceipt1747=false,
 pair:e=>e.resultPairsVerified=false,finished:e=>e.receipt1747.finishedAt='bad',
 time:e=>e.receipt1747.startedAt='2026-11-16T13:00:00Z',reverse:e=>e.receipt1747.finishedAt='2026-11-16T13:29:00Z'
};
for(const [name,mutate] of Object.entries(rejected1745))test('#1745 rejects '+name,()=>{
 const e=fixture1745();mutate(e);assert.throws(()=>plan1745IntakeRecovery(e));
});
test('#1745 transaction archives under its own request and preserves original lease bytes',()=>{
 const f=transaction();try{
 f.e.summary.requestId=REQUEST1745;const r=commitIntakeRecovery(f);
 assert.ok(r.archiveName.startsWith(REQUEST1745+'-intake-'));
 assert.deepEqual(fs.readFileSync(path.join(f.rootDir,'recovery',r.archiveName,'owner.json')),f.e.bytes.owner);
 assert.deepEqual(fs.readFileSync(f.e.files.ledger),f.e.bytes.ledger);
 }finally{fs.rmSync(f.rootDir,{recursive:true,force:true});}
});
