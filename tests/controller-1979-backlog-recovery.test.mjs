import test from 'node:test';import assert from 'node:assert/strict';
import {plan1979} from '../tools/controller-1979-backlog-recovery.mjs';
import {REQUEST1979} from '../tools/controller-intake-recovery.mjs';
const target='5492726bb5b0505b7ff7db73a3c673dabdf724ce';
function fixture(){
 const b={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-1af3112e-95b6-4f21-a69b-10c0f585fa44',chatId:'chat-9a27e4dc-7088-456f-b184-f5316c4055df',operation:'writer-install-preimage-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'1f451fbd979af6b9a0a1a2a4b2f79db60f3ae22f',preimageManifestPath:'approvals/writer-updates/w05-r304-wpsfd42-threefile-source-20261117.json',preimageManifestSha256:'4397597f7424146c81218c0d3e1eaf12d25afa26a3b62f89bfde1074e8d95f16'};
 const body1985={requestId:'pc-proof',operation:'r47-task-action-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'a'.repeat(40)};
 return {ledger:{requestId:REQUEST1979,issueNumber:1979,targetSha:target,status:'RECOVERY_REQUIRED',firstFail:'INTAKE_RESUMED',failureOperation:'reconcileBacklog',code:'BACKLOG_ORIGINAL_REQUEST_INVALID'},
 identityVerified:true,ownerAlive:false,status:{runtimeState:'HEALTHY',maintenanceState:'HEALTHY',workflowState:'active',actualControllerSha:target,installLock:{held:true,recoveryRequired:true}},
 backlog:{schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQUEST1979,pausedAt:'2026-11-17T09:44:25.782Z',resumedAt:'2026-11-17T09:48:12.244Z',windows:[{pausedAt:'2026-11-17T09:44:25.782Z',resumedAt:'2026-11-17T09:48:12.244Z'}],replays:{}},
 protectedTasksSame:true,searchComplete:true,candidates:[1981],originalBody:JSON.stringify(b),body1985,
 receipt1985:{schema:'ZGMINI_PC_RESULT_V1',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',requestId:body1985.requestId,operation:body1985.operation,sourceRepository:body1985.sourceRepository,sourceBranch:body1985.sourceBranch,requestedSourceSha:body1985.sourceSha,actualExecutionSha:target,controlSourceSha:target,status:'PASS',protectedStateUnchanged:true,providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false,startedAt:'2026-11-17T10:03:29.186Z',finishedAt:'2026-11-17T10:03:35.085Z'},botReceipt:true,resultPairsVerified:true};
}
test('closed pause rejects invalid original without replay, changing ledger or claiming functional success',()=>{
 const e=fixture(),before=structuredClone(e),p=plan1979(e);assert.deepEqual(e,before);
 assert.equal(p.backlog.windows[0].resumedAt,e.backlog.resumedAt);
 assert.equal(p.backlog.replays['1981'].status,'REJECTED_INVALID_ORIGINAL');
 assert.equal(p.backlog.replays['1981'].replayed,false);assert.equal(p.summary.controllerChanged,false);
 assert.equal(p.summary.replayedRequests,0);assert.equal(p.summary.originalLedgerPreserved,true);
});
const mutations={
 request:e=>e.ledger.requestId='other',issue:e=>e.ledger.issueNumber=1745,phase:e=>e.ledger.firstFail='RECONNECTED',
 operation:e=>e.ledger.failureOperation='resumeIntake',postcheck:e=>e.ledger.postIssueNumber=1985,target:e=>e.ledger.targetSha='a'.repeat(40),
 owner:e=>e.ownerAlive=true,unknown:e=>e.ownerAlive=null,identity:e=>e.identityVerified=false,
 runtime:e=>e.status.runtimeState='UNVERIFIED',maint:e=>e.status.maintenanceState='UNVERIFIED',
 workflow:e=>e.status.workflowState='disabled_manually',sha:e=>e.status.actualControllerSha='a'.repeat(40),
 lock:e=>e.status.installLock.held=false,marker:e=>e.status.installLock.recoveryRequired=false,
 backlog:e=>e.backlog.requestId='other',open:e=>e.backlog.windows[0].resumedAt=null,
 replay:e=>e.backlog.replays['1981']={status:'POSTING'},protection:e=>e.protectedTasksSame=false,
 truncated:e=>e.searchComplete=false,extra:e=>e.candidates.push(1982),missing:e=>e.candidates=[],
 changedOriginal:e=>e.originalBody+=' ',fixedOriginal:e=>e.originalBody=e.originalBody.replace('writer-updates/','writer-preimage/'),
 bot:e=>e.botReceipt=false,pair:e=>e.resultPairsVerified=false,
 receipt:e=>e.receipt1985.requestId='other',source:e=>e.receipt1985.requestedSourceSha='b'.repeat(40),
 control:e=>e.receipt1985.actualExecutionSha='b'.repeat(40),blocked:e=>e.receipt1985.status='BLOCKED',
 calls:e=>e.receipt1985.providerCalls=1,writes:e=>e.receipt1985.operationalWrites=1,
 d1:e=>e.receipt1985.d1Writes=1,sqlite:e=>e.receipt1985.sqliteOpened=true,
 beforeResume:e=>e.receipt1985.startedAt='2026-11-17T09:45:00Z',badTime:e=>e.receipt1985.finishedAt='bad'
};
for(const[name,change]of Object.entries(mutations))test('rejects '+name,()=>{const e=fixture();change(e);assert.throws(()=>plan1979(e));});
