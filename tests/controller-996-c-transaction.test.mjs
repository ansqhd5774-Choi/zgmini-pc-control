import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {RECOVERY_996,validate996CContract,simulate996CTransaction}
 from '../tools/controller-996-c-transaction.mjs';

const rawEvidence={
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 backlog:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
 controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
 stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
 maintainerManifest:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
};
const observedAt='2026-11-10T03:02:02.041Z';
const protectedFingerprint='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const protectedObservedAt='2026-11-10T03:12:02.041Z';
const goodChecks=['ledgerPinned','ownerMatched','ownerDead',
 'recoveryClaimAbsent','stageOnly','stagedFilesVerified',
 'installedControllerVerified','maintainerVerified','backlogOpen',
 'workflowDisabled','originalIssuePinned','dedicatedRunnersReady',
 'supervisorVerified','runnerListComplete','noOtherControllerLeases',
 'stableRawDigests'];
const steps=['freshReadback','reserveClaim','freshWithOwnClaim','recordPrepared',
 'recordWorkflowEnableIntent','enableWorkflowOnce','workflowActiveReadback',
 'closeBacklogGuarded','fullBacklogDispositionReadback',
 'independentProtectedPostcheck','recordPreArchive',
 'recordOriginalLeaseArchiveIntent','archiveOriginalLease','finalReadback',
 'completeRecord','recordOwnClaimArchiveIntent','archiveOwnClaim',
 'finalOwnClaimReadback'];
function fixture(){
 const e=RECOVERY_996,digests={...rawEvidence};
 // A consistent synthetic 5-item snapshot exercises the contract; the real
 // observation fingerprint stays pinned separately in its own regression.
 const itemFiles={"config.json":'1'.repeat(64),
  'quota-runner.cmd':'2'.repeat(64),'run-local.cmd':'3'.repeat(64)};
 const itemTasks={'ZGMINI-PC-Local-Core':'4'.repeat(64),
  'ZGMINI-PC-Local-Korea':'5'.repeat(64)};
 const itemEnabled={'ZGMINI-PC-Local-Core':true,
  'ZGMINI-PC-Local-Korea':false};
 const itemFingerprint=createHash('sha256').update(Buffer.from(JSON.stringify({
  files:itemFiles,tasks:itemTasks}))).digest('hex');
 const preflight={schema:'ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1',
  requestId:e.requestId,issueNumber:996,observedAt,
  status:'C_EVIDENCE_GAPS',
  checks:{...Object.fromEntries(goodChecks.map(k=>[k,true])),
   workflowDisableActorVerified:false,protectedBaselineVerified:false},
  firstFailedCheck:'workflowDisableActorVerified',
  digests,protectionNowFingerprint:itemFingerprint,
  protectedBaselineSha256:null,independentRunnersObserved:1,
  backlogPauseWindowCount:1,operationalWrites:0,issuePosts:0,
  pcRetries:0,executionAuthorized:false};
 const protectedAttestation={
  schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
  requestId:e.requestId,issueNumber:996,observedAt:protectedObservedAt,
  status:'CURRENT_ITEMS_MATCH_OBSERVATION',
  items:{files:{...itemFiles},taskSha256:{...itemTasks},taskEnabled:{...itemEnabled}},
  currentFingerprint:itemFingerprint,originalObservationFingerprint:itemFingerprint,
  fingerprintMatch:true,allFivePresent:true,historicalBaselineAvailable:false,
  allActorsImmutableProven:false,operationalWrites:0,issuePosts:0,
  pcRetries:0,executionAuthorized:false,
 };
 const approval={approved:true,grade:'C',operation:'RECONCILE_INTAKE_PAUSED_ONLY',
  requestId:e.requestId,issueNumber:996,controllerSha:e.controllerSha,
  targetSha:e.targetSha,maintainerSha:e.maintainerSha,
  executionScope:'ORIGINAL_WINDOWS_ONE_SHOT',
  authorizationMode:'PHASE_SCOPED_EVIDENCE_EXCEPTION',
  acceptsUnprovenGitHubDisableActor:true,
  acceptsMissingHistoricalProtectedBaseline:true,
  acceptsNoAllActorsImmutabilityProof:true,
  acceptedGaps:['workflowDisableActorVerified','protectedBaselineVerified'],
  phaseScopedSourceProof:{maintainerSourceSha:e.maintainerSha,
   failureFirstPhase:'INTAKE_PAUSED',failureCode:'RUNNER_SET_DRIFT',
   reachedBackup:false,reachedControllerSwitch:false,
   claimsIndependentDisableActorAudit:false,
   claimsAllActorsProtectedImmutability:false},
  userConsentReceiptVerified:true,committedManifestVerified:true,
  evidenceObservedAt:observedAt,protectionNowFingerprint:itemFingerprint,
  protectedItemsObservedAt:protectedObservedAt,
  protectedItemsSha256:{files:{...itemFiles},tasks:{...itemTasks}},
  protectedTaskEnabled:{...itemEnabled},
  evidenceSha256:{...digests},
  allowedEffects:['CREATE_AND_ARCHIVE_OWN_C_RECOVERY_CLAIM',
   'WRITE_C_SCOPED_AUDIT_AND_ATTEMPT_MARKERS',
   'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
   'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE','READ_ONLY_DISPOSITION_NO_REPLAY',
   'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK'],
 };
 return {preflight,protectedAttestation,approval};
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
   {...approval,authorizationMode:'NORMAL_NO_EXCEPTION'},
   {...approval,acceptsMissingHistoricalProtectedBaseline:false},
   {...approval,acceptsUnprovenGitHubDisableActor:false},
   {...approval,acceptsNoAllActorsImmutabilityProof:false},
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
  f=>{f.preflight.firstFailedCheck='ownerDead';},
  f=>{f.preflight.checks.ownerDead=false;},
  f=>{f.preflight.checks.workflowDisableActorVerified=true;},
  f=>{f.preflight.checks.protectedBaselineVerified=true;},
  f=>{f.preflight.protectedBaselineSha256='a'.repeat(64);},
  f=>{f.preflight.status='READONLY_VERIFIED';},
  f=>{f.preflight.independentRunnersObserved=-1;},
  f=>{f.preflight.backlogPauseWindowCount=2;},
  f=>{f.preflight.pcRetries=1;},
  f=>{f.preflight.protectionNowFingerprint='b'.repeat(64);},
  f=>{f.approval.evidenceObservedAt='2026-11-09T03:02:02.041Z';},
  f=>{f.approval.acceptedGaps=[];},
  f=>{f.approval.phaseScopedSourceProof.reachedBackup=true;},
  f=>{f.approval.phaseScopedSourceProof.claimsIndependentDisableActorAudit=true;},
  f=>{f.preflight.digests.backlog='a'.repeat(64);},
  f=>{f.preflight.digests.protectedSnapshot='c'.repeat(64);},
  f=>{f.approval.allowedEffects='wrong';},
  f=>{f.approval.allowedEffects.push('INSTALL_CONTROLLER');},
  f=>{f.protectedAttestation.items.files['config.json']='f'.repeat(64);},
  f=>{f.protectedAttestation.allFivePresent=false;},
  f=>{f.protectedAttestation.items.taskEnabled['ZGMINI-PC-Local-Core']=null;},
  f=>{f.protectedAttestation.historicalBaselineAvailable=true;},
  f=>{f.approval.protectedItemsObservedAt='2026-11-10T03:13:02.041Z';},
 ];
 for(const modify of fixtures){
  const f=fixture();modify(f);
  assert.equal(validate996CContract(f).status,'NOT_STARTED');
 }
});

test('actual Windows R1 pins 7 raw digests and missing baseline, not 8',()=>{
 const f=fixture();
 assert.equal(Object.keys(f.preflight.digests).length,7);
 assert.equal(f.preflight.digests.ledger,rawEvidence.ledger);
 assert.equal(protectedFingerprint.length,64);
 assert.equal(f.preflight.protectedBaselineSha256,null);
 assert.equal(f.preflight.checks.workflowDisableActorVerified,false);
 assert.equal(f.preflight.checks.protectedBaselineVerified,false);
 const noProtectedEvidence=validate996CContract({
  preflight:f.preflight,approval:f.approval});
 assert.equal(noProtectedEvidence.code,'CURRENT_PROTECTED_ITEMS_UNPROVEN');
});

test('unrelated Runner count is not a seventh-seat admission gate',()=>{
 for(const unrelatedCount of [0,1,2,8]){
  const f=fixture();f.preflight.independentRunnersObserved=unrelatedCount;
  assert.equal(validate996CContract(f).status,'REVIEWED_CONTRACT_ONLY');
 }
});

test('approved fixture only verifies contract; it grants no runtime authority',()=>{
 const decision=validate996CContract(fixture());
 assert.equal(decision.status,'REVIEWED_CONTRACT_ONLY');
 assert.equal(decision.executionAuthorized,false);
 assert.equal(decision.sourceOnly,true);
 assert.equal(decision.controllerInstallPermitted,false);
 assert.equal(decision.completionRecordStatus,'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED');
 assert.equal(decision.evidenceChecksPassed,16);
 assert.deepEqual(decision.evidenceChecksUnproven,
  ['workflowDisableActorVerified','protectedBaselineVerified']);
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
 assert.equal(decision.ownClaimArchives,1);
 assert.equal(decision.claimDisposition,'SIMULATED_ARCHIVED');
 assert.equal(decision.backlogReplays,0);
 assert.equal(decision.originalRetries,0);
 assert.equal(decision.controllerInstalls,0);
 assert.equal(decision.completionRecordStatus,'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED');
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
  assert.equal(result.claimMustRemain,i>=1&&i<16);
  assert.equal(result.claimDisposition,i<1?'NOT_CREATED':i>=16?
   'MAY_BE_ARCHIVED_REQUIRE_INDEPENDENT_READBACK':'PRESERVE_IN_PLACE');
  assert.equal(result.workflowEnables,i>=5?1:0);
  assert.equal(result.leaseArchives,i>=12?1:0);
  assert.equal(result.ownClaimArchives,i>=16?1:0);
  assert.equal(result.originalRetries,0);
 }
});

test('uncertain workflow enable result leaves claim and stops instead of retry',async()=>{
 const history=[];
 const result=await simulate996CTransaction({...fixture(),
  ports:mockPorts(history,{unknownAt:'enableWorkflowOnce'})});
 assert.deepEqual(history,steps.slice(0,6));
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
