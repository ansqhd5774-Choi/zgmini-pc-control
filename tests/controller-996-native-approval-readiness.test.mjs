import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build996ConsentComment} from '../tools/controller-996-c-consent-verifier.mjs';
import {review996NativeApprovalReadiness,review996NativePinnedConsentReadiness}
 from '../tools/controller-996-native-approval-readiness.mjs';

const id='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const src='badad9124157879d7a645b64f2768113d632355b';
const target='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const maintainer='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const fingerprint='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const observedAt='2026-11-10T03:02:02.041Z';
const r2At='2026-11-10T04:06:43.338Z';
const digests={
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 backlog:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
 controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
 stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
 maintainerManifest:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
};
const writer={'config.json':'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453'};
const writerStatus={'config.json':'PRESENT','quota-runner.cmd':'ABSENT','run-local.cmd':'ABSENT'};
const tasks={'ZGMINI-PC-Local-Core':'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
 'ZGMINI-PC-Local-Korea':'1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1'};
const enabled={'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true};
const sha=x=>createHash('sha256').update(x).digest('hex');

function fixture(){
 const trueNames=['ledgerPinned','ownerMatched','ownerDead',
  'recoveryClaimAbsent','stageOnly','stagedFilesVerified',
  'installedControllerVerified','maintainerVerified','backlogOpen',
  'workflowDisabled','originalIssuePinned','dedicatedRunnersReady',
  'supervisorVerified','runnerListComplete','noOtherControllerLeases',
  'stableRawDigests'];
 const originalObservation={
  schema:'ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1',
  requestId:id,issueNumber:996,observedAt,status:'C_EVIDENCE_GAPS',
  checks:{...Object.fromEntries(trueNames.map(k=>[k,true])),
   workflowDisableActorVerified:false,protectedBaselineVerified:false},
  firstFailedCheck:'workflowDisableActorVerified',digests:{...digests},
  protectionNowFingerprint:fingerprint,protectedBaselineSha256:null,
  independentRunnersObserved:1,backlogPauseWindowCount:1,
  operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false,
 };
 const protectedObservation={
  schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
  requestId:id,issueNumber:996,observedAt:r2At,
  status:'CURRENT_ITEMS_MATCH_OBSERVATION',
  items:{files:{...writer},writerFileStatus:{...writerStatus},
   taskSha256:{...tasks},taskEnabled:{...enabled}},
  currentFingerprint:fingerprint,originalObservationFingerprint:fingerprint,
  fingerprintMatch:true,allFivePresent:false,presentWriterFileCount:1,
  historicalBaselineAvailable:false,allActorsImmutableProven:false,
  operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false,
 };
 const manifest={schema:'ZGMINI_CONTROLLER_996_C_APPROVAL_V1',
  approved:true,grade:'C',operation:'RECONCILE_INTAKE_PAUSED_ONLY',
  executionScope:'ORIGINAL_WINDOWS_ONE_SHOT',
  authorizationMode:'PHASE_SCOPED_EVIDENCE_EXCEPTION',
  requestId:id,issueNumber:996,controllerSha:src,targetSha:target,
  maintainerSha:maintainer,
  acceptsUnprovenGitHubDisableActor:true,
  acceptsMissingHistoricalProtectedBaseline:true,
  acceptsNoAllActorsImmutabilityProof:true,
  acceptedGaps:['workflowDisableActorVerified','protectedBaselineVerified'],
  allowedEffects:['CREATE_AND_ARCHIVE_OWN_C_RECOVERY_CLAIM',
   'WRITE_C_SCOPED_AUDIT_AND_ATTEMPT_MARKERS',
   'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
   'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE',
   'READ_ONLY_DISPOSITION_NO_REPLAY',
   'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK'],
  phaseScopedSourceProof:{maintainerSourceSha:maintainer,
   failureFirstPhase:'INTAKE_PAUSED',failureCode:'RUNNER_SET_DRIFT',
   reachedBackup:false,reachedControllerSwitch:false,
   claimsIndependentDisableActorAudit:false,
   claimsAllActorsProtectedImmutability:false},
  evidenceObservedAt:observedAt,protectedItemsObservedAt:r2At,
  protectionNowFingerprint:fingerprint,
  evidenceSha256:{...digests},
  protectedItemsSha256:{files:{...writer},tasks:{...tasks}},
  protectedWriterFileStatus:{...writerStatus},
  protectedTaskEnabled:{...enabled},
 };
 const bytes=Buffer.from(JSON.stringify(manifest)+'\n');
 const ownerConsentEvidence={
  originalIssue:{number:996,title:'pc-controller-update',
   user:{login:'ansqhd5774-Choi'},
   body:JSON.stringify({requestId:id,targetControllerSha:target})},
  commentsReadback:{complete:true,comments:[{id:1919,
   user:{login:'ansqhd5774-Choi'},
   created_at:'2026-11-10T04:10:00.000Z',
   body:build996ConsentComment(sha(bytes))}]},
  gitRead:{repository:'ansqhd5774-Choi/zgmini-pc-control',
   path:'docs/CONTROLLER_996_C_APPROVAL_R1.json',commitSha:'a'.repeat(40),bytes},
  operatorManifestBytes:Buffer.from(bytes),
 };
 return {originalObservation,protectedObservation,ownerConsentEvidence};
}

// Synthetic test consent only: the simulated owner comment must be re-hashed
// after every manifest mutation, so the historical pin check itself is tested.
function reSignSyntheticManifest(f,change){
 const evidence=f.ownerConsentEvidence;
 const manifest=JSON.parse(evidence.operatorManifestBytes.toString('utf8'));
 change(manifest);
 const bytes=Buffer.from(JSON.stringify(manifest)+'\n');
 evidence.gitRead.bytes=Buffer.from(bytes);
 evidence.operatorManifestBytes=Buffer.from(bytes);
 evidence.commentsReadback.comments[0].body=build996ConsentComment(sha(bytes));
}

test('pinned owner consent review uses only signed manifest, never synthetic R1/R2 objects',()=>{
 const f=fixture();
 const reviewed=review996NativePinnedConsentReadiness({
  ownerConsentEvidence:f.ownerConsentEvidence});
 assert.equal(reviewed.status,'READONLY_PINNED_OWNER_C_CONSENT_REVIEWED');
 assert.equal(reviewed.code,'FRESH_ORIGINAL_WINDOWS_R1_R2_READBACK_STILL_REQUIRED');
 assert.equal(reviewed.pinnedHistoricalRawDigests,7);
 assert.equal(reviewed.verifiedPresentWriterFiles,1);
 assert.equal(reviewed.verifiedProtectedTasks,2);
 assert.equal(reviewed.historicalRawWindowsObjectsProvided,false);
 assert.equal(reviewed.liveWindowsReobserved,false);
 assert.equal(reviewed.executionAuthorized,false);
 assert.equal(reviewed.operationalWrites,0);
 assert.equal(reviewed.issuePosts,0);
 // No originalObservation or protectedObservation is passed to the new API.
});

test('resigned but altered historical R1/R2 anchors fail independently of valid consent provenance',()=>{
 const mutants=[
  m=>{m.evidenceObservedAt='2026-11-10T03:02:03.041Z';},
  m=>{m.protectedItemsObservedAt='2026-11-10T04:06:44.338Z';},
  m=>{m.protectionNowFingerprint='a'.repeat(64);},
  m=>{m.evidenceSha256.ledger='b'.repeat(64);},
  m=>{m.evidenceSha256.stagedHost='c'.repeat(64);},
  m=>{m.protectedItemsSha256.files['config.json']='d'.repeat(64);},
  m=>{m.protectedItemsSha256.tasks['ZGMINI-PC-Local-Core']='e'.repeat(64);},
  m=>{m.protectedWriterFileStatus['quota-runner.cmd']='PRESENT';
   m.protectedItemsSha256.files['quota-runner.cmd']='f'.repeat(64);},
 ];
 for(const change of mutants){
  const f=fixture();reSignSyntheticManifest(f,change);
  const reviewed=review996NativePinnedConsentReadiness({
   ownerConsentEvidence:f.ownerConsentEvidence});
  assert.equal(reviewed.status,'C_NOT_READY');
  assert.equal(reviewed.code,'C_SIGNED_HISTORICAL_R1_R2_PIN_MISMATCH');
  assert.equal(reviewed.executionAuthorized,false);
 }
});

test('missing or forged owner consent never passes pinned historical review',()=>{
 for(const mutate of [
  f=>{f.ownerConsentEvidence.commentsReadback.comments=[];},
  f=>{f.ownerConsentEvidence.originalIssue.user.login='another-owner';},
  f=>{f.ownerConsentEvidence.gitRead.commitSha='not-an-immutable-sha';},
 ]){
  const f=fixture();mutate(f);
  const reviewed=review996NativePinnedConsentReadiness({
   ownerConsentEvidence:f.ownerConsentEvidence});
  assert.equal(reviewed.status,'C_NOT_READY');
  assert.equal(reviewed.executionAuthorized,false);
 }
});

test('synthetic owner-comment fixture and exact real R1/R2 only produce read-only C readiness, never execution',()=>{
 const result=review996NativeApprovalReadiness(fixture());
 assert.equal(result.status,'READONLY_APPROVAL_AND_R1_R2_CONTRACT_REVIEWED');
 assert.equal(result.code,'FRESH_NATIVE_FINAL_PREFLIGHT_AND_OPERATOR_STILL_REQUIRED');
 assert.equal(result.verifiedPresentWriterFiles,1);
 assert.equal(result.verifiedProtectedTasks,2);
 assert.deepEqual(result.explicitlyUnprovenChecks,
  ['workflowDisableActorVerified','protectedBaselineVerified']);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.pcRetries,0);
});

test('missing owner C consent or unverifiable manifest never reaches the contract',()=>{
 for(const mutate of [
  x=>{x.ownerConsentEvidence.commentsReadback.comments=[];},
  x=>{x.ownerConsentEvidence.commentsReadback.complete=false;},
  x=>{x.ownerConsentEvidence.gitRead.commitSha='main';},
  x=>{x.ownerConsentEvidence.operatorManifestBytes=Buffer.from('{}');},
  x=>{x.ownerConsentEvidence.originalIssue.user.login='github-actions[bot]';},
 ]){
  const f=fixture();mutate(f);
  const result=review996NativeApprovalReadiness(f);
  assert.equal(result.status,'C_NOT_READY');
  assert.equal(result.executionAuthorized,false);
 }
});

test('altered original R1, R2 and missing baseline are not silently accepted',()=>{
 for(const mutate of [
  x=>{x.protectedObservation.items.files['config.json']='a'.repeat(64);},
  x=>{x.protectedObservation.items.writerFileStatus['run-local.cmd']='PRESENT';},
  x=>{x.protectedObservation.items.taskEnabled['ZGMINI-PC-Local-Core']=false;},
  x=>{x.ownerConsentEvidence.originalIssue.title='fake';},
  x=>{x.protectedObservation.historicalBaselineAvailable=true;},
  x=>{x.originalObservation.digests.backlog='b'.repeat(64);},
  x=>{x.originalObservation.checks.workflowDisableActorVerified=true;},
  x=>{x.originalObservation.protectedBaselineSha256='c'.repeat(64);},
 ]){
  const f=fixture();mutate(f);
  const result=review996NativeApprovalReadiness(f);
  assert.equal(result.status,'C_NOT_READY');
  assert.equal(result.executionAuthorized,false);
 }
});

test('readiness composition exposes no native PC writes or GitHub network port',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-native-approval-readiness.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|execFileSync|spawnSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|https\.request|http\.request|process\.kill)\s*\(/);
});
