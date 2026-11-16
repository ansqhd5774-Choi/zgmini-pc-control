import test from 'node:test';
import assert from 'node:assert/strict';
import {planIntakeRecovery,REQUEST} from '../tools/controller-intake-recovery.mjs';
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
