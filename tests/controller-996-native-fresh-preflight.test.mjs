import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {review996FreshWindowsReadback,create996NativeFreshPreflight,
 review996OwnedClaimWindowsReadback,create996NativeOwnedClaimPreflight}
 from '../tools/controller-996-native-fresh-preflight.mjs';

const requestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const fingerprint='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const raw={
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 backlog:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
 controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
 stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
 maintainerManifest:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
};
const r1Time='2026-11-10T04:31:00.000Z';
const r2Time='2026-11-10T04:31:04.000Z';

function fixture(){
 const checks=Object.fromEntries([
  'ledgerPinned','ownerMatched','ownerDead','recoveryClaimAbsent',
  'stageOnly','stagedFilesVerified','installedControllerVerified',
  'maintainerVerified','backlogOpen','workflowDisabled',
  'originalIssuePinned','dedicatedRunnersReady','supervisorVerified',
  'runnerListComplete','noOtherControllerLeases','stableRawDigests',
 ].map(k=>[k,true]));
 checks.workflowDisableActorVerified=false;checks.protectedBaselineVerified=false;
 const r1={schema:'ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1',
  requestId,issueNumber:996,observedAt:r1Time,status:'C_EVIDENCE_GAPS',
  checks,firstFailedCheck:'workflowDisableActorVerified',
  digests:{...raw},protectionNowFingerprint:fingerprint,
  protectedBaselineSha256:null,independentRunnersObserved:1,
  backlogPauseWindowCount:1,operationalWrites:0,issuePosts:0,
  pcRetries:0,executionAuthorized:false};
 const r2={schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
  requestId,issueNumber:996,observedAt:r2Time,
  status:'CURRENT_ITEMS_MATCH_OBSERVATION',
  items:{files:{'config.json':'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453'},
   writerFileStatus:{'config.json':'PRESENT','quota-runner.cmd':'ABSENT',
    'run-local.cmd':'ABSENT'},
   taskSha256:{'ZGMINI-PC-Local-Core':'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
    'ZGMINI-PC-Local-Korea':'1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1'},
   taskEnabled:{'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true}},
  currentFingerprint:fingerprint,originalObservationFingerprint:fingerprint,
  fingerprintMatch:true,allFivePresent:false,presentWriterFileCount:1,
  historicalBaselineAvailable:false,allActorsImmutableProven:false,
  operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false};
 return {r1,r2};
}

test('new timestamps are distinct from pinned owner-approval R1/R2 but unchanged physical state passes',()=>{
 const f=fixture();
 const result=review996FreshWindowsReadback(f);
 assert.equal(result.status,'FRESH_ORIGINAL_WINDOWS_R1_R2_MATCH_PINNED');
 assert.equal(result.rawDigestsVerified,7);
 assert.equal(result.checksVerified,16);
 assert.equal(result.protectedTasksEnabled,2);
 assert.deepEqual(result.historicalGapsUnproven,
  ['workflowDisableActorVerified','protectedBaselineVerified']);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.workflowEnables,0);
 assert.equal(result.operationalWrites,0);
});

test('changed original raw bytes, owner, claim or workflow state block before any C mutation',()=>{
 for(const change of [
  x=>{x.r1.digests.backlog='f'.repeat(64);},
  x=>{x.r1.checks.ownerDead=false;},
  x=>{x.r1.checks.recoveryClaimAbsent=false;},
  x=>{x.r1.checks.workflowDisabled=false;},
  x=>{x.r1.firstFailedCheck='other';},
  x=>{x.r1.protectedBaselineSha256='a'.repeat(64);},
  x=>{x.r1.checks.protectedBaselineVerified=true;},
  x=>{x.r1.backlogPauseWindowCount=2;},
  x=>{x.r1.independentRunnersObserved=-1;},
 ]){
  const f=fixture();change(f);
  const result=review996FreshWindowsReadback(f);
  assert.equal(result.status,'C_FRESH_READBACK_UNVERIFIED');
  assert.equal(result.executionAuthorized,false);
 }
});

test('protection mismatch, disabled Task or stale R2 readback fail closed',()=>{
 for(const change of [
  x=>{x.r2.items.files['config.json']='f'.repeat(64);},
  x=>{x.r2.items.taskEnabled['ZGMINI-PC-Local-Korea']=false;},
  x=>{x.r2.observedAt='2026-11-10T04:06:43.338Z';},
  x=>{x.r2.currentFingerprint='f'.repeat(64);},
  x=>{x.r2.historicalBaselineAvailable=true;},
 ]){
  const f=fixture();change(f);
  const result=review996FreshWindowsReadback(f);
  assert.equal(result.status,'C_FRESH_READBACK_UNVERIFIED');
 }
});

test('test-only reader injection stays off the Windows production port and never authorizes effects',()=>{
 assert.throws(()=>create996NativeFreshPreflight(),
  /C_FRESH_ORIGINAL_WINDOWS_ONLY/);
 const f=fixture();
 const gateway=create996NativeFreshPreflight({testOnly:true,
  readR1:()=>f.r1,readR2:()=>f.r2});
 assert.equal(gateway.read().status,'FRESH_ORIGINAL_WINDOWS_R1_R2_MATCH_PINNED');
 const unknown=create996NativeFreshPreflight({testOnly:true,
  readR1:()=>{throw Error('secret external failure');},readR2:()=>f.r2});
 assert.equal(unknown.read().code,'C_FRESH_READ_IO_OR_ORIGIN_UNKNOWN');
});

function ownedFixture(){
 const f=fixture();
 f.r1.checks.recoveryClaimAbsent=false;
 f.r1.firstFailedCheck='recoveryClaimAbsent';
 const ownClaim={requestId,issueNumber:996,pid:process.pid,
  nonce:'11111111-1111-4111-8111-111111111111',at:'2026-11-10T04:30:59.000Z'};
 return {...f,ownClaim};
}

test('new owned Claim is the only allowed extra false R1 check and is bound to this PID/nonce',()=>{
 const f=ownedFixture();
 const result=review996OwnedClaimWindowsReadback(f);
 assert.equal(result.status,'FRESH_OWN_CLAIM_R1_R2_MATCH_PINNED');
 assert.equal(result.ownCClaimVerified,true);
 assert.equal(result.executionAuthorized,false);
 assert.equal(review996FreshWindowsReadback(f).status,'C_FRESH_READBACK_UNVERIFIED');
 for(const change of [
  x=>{x.ownClaim.pid=99999999;},
  x=>{x.ownClaim.nonce='';},
  x=>{x.ownClaim.requestId='wrong';},
  x=>{x.r1.checks.maintainerVerified=false;},
  x=>{x.r1.checks.workflowDisabled=false;},
  x=>{x.r1.firstFailedCheck='workflowDisableActorVerified';},
 ]){
  const next=ownedFixture();change(next);
  assert.equal(review996OwnedClaimWindowsReadback(next).status,
   'C_FRESH_READBACK_UNVERIFIED');
 }
});

test('owned production reader cannot be injected and loss of claim stops before changes',()=>{
 const f=ownedFixture();
 assert.throws(()=>create996NativeOwnedClaimPreflight({
  claimStore:{ownClaimReadback:()=>f.ownClaim}}),
 /C_FRESH_ORIGINAL_WINDOWS_ONLY/);
 const good=create996NativeOwnedClaimPreflight({testOnly:true,
  claimStore:{ownClaimReadback:()=>f.ownClaim},
  readR1:()=>f.r1,readR2:()=>f.r2});
 assert.equal(good.read().status,'FRESH_OWN_CLAIM_R1_R2_MATCH_PINNED');
 const lost=create996NativeOwnedClaimPreflight({testOnly:true,
  claimStore:{ownClaimReadback:()=>{throw Error('claim replaced');}},
  readR1:()=>f.r1,readR2:()=>f.r2});
 assert.equal(lost.read().code,'C_FRESH_OWNED_READ_IO_OR_ORIGIN_UNKNOWN');
});

test('fresh preflight source has no operational writes, Workflow PUT or Issue publishing',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-native-fresh-preflight.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|execFileSync|spawnSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|https\.request|http\.request|process\.kill)\s*\(/);
});
