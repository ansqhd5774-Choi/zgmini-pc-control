import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {RECOVERY_996,validate996CContract,simulate996CTransaction}
 from '../tools/controller-996-c-transaction.mjs';

const names=['ledger','owner','recoveryMarker','backlog','stagedHost',
 'controllerHost','maintainerManifest','protectedSnapshot'];
const steps=['freshReadback','reserveClaim','freshWithOwnClaim','recordPrepared','enableWorkflowOnce',
 'workflowActiveReadback','closeBacklogCas','fullBacklogDispositionReadback',
 'independentProtectedPostcheck','recordPreArchive','archiveOriginalLease','finalReadback','completeRecord'];
const originals=()=>Array.from({length:6},(_,i)=>({
 name:`zgmini-pc-0${i+1}`,status:'online',busy:false}));
function fixture(){
 const e=RECOVERY_996,digests=Object.fromEntries(names.map((n,i)=>[n,String(i+1).repeat(64)]));
 const preflight={schema:'ZGMINI_CONTROLLER_996_INTAKE_EVIDENCE_V1',
  requestId:e.requestId,issueNumber:996,
  ledger:{firstFail:'INTAKE_PAUSED',code:'RUNNER_SET_DRIFT',
   status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED'},
  controller:{sourceSha:e.controllerSha,hostFilesVerified:true,
   switchNeverStarted:true,supervisorIdentityVerified:true},
  maintainer:{sourceSha:e.maintainerSha,filesVerified:true},
  workflow:{state:'disabled_manually',pausedByRequest:true},
  installLock:{ownerDeadProven:true,ownerNonceMatched:true,recoveryClaimAbsent:true},
  stage:{exists:true,bytesVerified:true,snapshotAbsent:true},
  backlog:{pauseWindowOpen:true,pauseOwnedByRequest:true,replaysUntampered:true},
  protection:{beforeAndNowVerified:true,unchanged:true},
  otherControllerLeaseCount:0,runners:[...originals(),{name:'independent',status:'offline',busy:true}],
  digests};
 const approval={approved:true,grade:'C',operation:'RECONCILE_INTAKE_PAUSED_ONLY',
  requestId:e.requestId,issueNumber:996,controllerSha:e.controllerSha,
  targetSha:e.targetSha,maintainerSha:e.maintainerSha,
  executionScope:'ORIGINAL_WINDOWS_ONE_SHOT',
  userConsentReceiptVerified:true,committedManifestVerified:true,
  evidenceSha256:{...digests},
  allowedEffects:['ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
   'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE','READ_ONLY_DISPOSITION_NO_REPLAY',
   'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK'],
 };
 return {preflight,approval};
}
function mockPorts(history,{throwAt=null,unknownAt=null}={}){
 return Object.fromEntries(steps.map(name=>[name,async()=>{
  history.push(name);
  if(name===throwAt)throw Error('injected failure');
  if(name===unknownAt)return undefined;
  return true;
 }]));
}

test('untrusted/missing approval cannot even construct a C execution plan',async()=>{
 const {preflight,approval}=fixture();
 for(const candidate of [null,{}, {...approval,approved:false},
   {...approval,grade:'B'}, {...approval,requestId:'wrong'},
   {...approval,userConsentReceiptVerified:false},
   {...approval,committedManifestVerified:false},
   {...approval,executionScope:'NEW_WINDOWS_SPARE'}]){
  const history=[];
  const decision=await simulate996CTransaction({preflight,approval:candidate,
   ports:mockPorts(history)});
  assert.equal(decision.status,'NOT_STARTED');
  assert.equal(decision.executionAuthorized,false);
  assert.equal(history.length,0);
 }
});

test('raw fingerprint, authority and original C failure phase must match',()=>{
 const fixtures=[
  f=>{f.preflight.ledger.firstFail='RECEIVED';},
  f=>{f.preflight.controller.sourceSha='a'.repeat(40);},
  f=>{f.preflight.workflow.state='active';},
  f=>{f.preflight.installLock.ownerDeadProven=false;},
  f=>{f.preflight.protection.unchanged=false;},
  f=>{f.preflight.runners=[];},
  f=>{f.preflight.digests.backlog='a'.repeat(64);},
  f=>{f.approval.allowedEffects='wrong';},
  f=>{f.preflight.runners[2]=null;},
  f=>{f.approval.allowedEffects.push('INSTALL_CONTROLLER');},
 ];
 for(const modify of fixtures){
  const f=fixture();modify(f);
  assert.equal(validate996CContract(f).status,'NOT_STARTED');
 }
});

test('approved fixture only verifies contract; it grants no runtime authority',()=>{
 const decision=validate996CContract(fixture());
 assert.equal(decision.status,'REVIEWED_CONTRACT_ONLY');
 assert.equal(decision.executionAuthorized,false);
 assert.equal(decision.sourceOnly,true);
 assert.deepEqual(decision.intendedOrder.slice(0,2),['FRESH_CAS','ATOMIC_CLAIM']);
});

test('incomplete native adapter cannot produce partial operational effect',async()=>{
 const decision=await simulate996CTransaction({...fixture(),ports:{}});
 assert.equal(decision.status,'NOT_STARTED');
 assert.equal(decision.leaseArchives,0);
 assert.equal(decision.workflowEnables,0);
});

test('simulation always sequences workflow, backlog, independent check, archive',async()=>{
 const history=[];
 const decision=await simulate996CTransaction({...fixture(),
  ports:mockPorts(history)});
 assert.deepEqual(history,steps);
 assert.equal(decision.status,'SIMULATED_TRANSACTION_PASS');
 assert.equal(decision.executionAuthorized,false);
 assert.equal(decision.workflowEnables,1);
 assert.equal(decision.leaseArchives,1);
 assert.equal(decision.backlogReplays,0);
 assert.equal(decision.originalRetries,0);
 assert.equal(decision.controllerInstalls,0);
});

test('each injected stage failure halts without executing any later stage',async()=>{
 for(let i=0;i<steps.length;i++){
  const history=[];
  const result=await simulate996CTransaction({...fixture(),
   ports:mockPorts(history,{throwAt:steps[i]})});
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.failedStep,steps[i]);
  assert.deepEqual(history,steps.slice(0,i+1));
  assert.equal(result.retryAuthorized,false);
  assert.equal(result.claimMustRemain,i>=1);
  assert.equal(result.workflowEnables,i>=4?1:0);
  assert.equal(result.leaseArchives,i>=10?1:0);
  assert.equal(result.originalRetries,0);
 }
});

test('uncertain workflow enable result leaves claim and stops instead of retry',async()=>{
 const history=[];
 const result=await simulate996CTransaction({...fixture(),
  ports:mockPorts(history,{unknownAt:'enableWorkflowOnce'})});
 assert.deepEqual(history,steps.slice(0,5));
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.failedStep,'enableWorkflowOnce');
 assert.equal(result.claimMustRemain,true);
 assert.equal(result.retryAuthorized,false);
 assert.equal(result.workflowEnables,1);
 assert.equal(result.leaseArchives,0);
});

test('source-only transaction has no real operational write or network path',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-c-transaction.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|execFileSync|spawnSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|https\.request|http\.request|process\.kill)\s*\(/);
 assert.equal(typeof RECOVERY_996.requestId,'string');
});
