// Cross-component source-only tests for proposed orphan/no-spawn recovery.
// These use synthetic in-memory records. A Watchdog HEALTHY indication is
// NOT proof that six inherited Listener nonces were authenticated, nor an
// approval to acquire Owner or write the operating heartbeat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertSupervisorOwner} from '../controller/common.mjs';
import {decide as watchdogDecision,provenOldRunnerExit}
 from '../tools/runner-watchdog.mjs';
import {decideStandbyPromotion}
 from '../controller/standby.mjs';
import {assessNoSpawnMonitorSnapshot}
 from '../controller/orphan-no-spawn-monitor-contract.mjs';

const root=path.join(os.tmpdir(),'zgmini-no-spawn-cross-contract-DO_NOT_CREATE');
const nonce='a1111111-b222-4333-8444-55555555c555';
const source='a'.repeat(40);
const sha=c=>c.repeat(64);
const host={controllerFiles:{'controller/standby.mjs':sha('a')}};
const syntheticOwner=()=>({
 pid:process.pid,nonce,bootAt:Date.now()-os.uptime()*1000,
 at:new Date(Date.now()-1000).toISOString(),
 recoveryMode:'ADOPT_EXISTING_SIX_NO_SPAWN'
});
const io=owner=>({
 readFileSync:(file,encoding)=>{
  assert.equal(file,path.join(root,'leases','supervisor','owner.json'));
  assert.equal(encoding,'utf8');
  return JSON.stringify(owner);
 }
});
const oldHeartbeatAt=Date.parse('2026-11-26T23:00:00.000Z');
const fakeListenerSeats=()=>Array.from({length:6},(_,i)=>({
 seat:i+1,pid:4100+i,
 startedAtUtc:'2026-11-26T22:57:00.000Z',
 canonicalPathSha256:String.fromCharCode(97+i).repeat(64)
}));
const allOtherPreflightValid=()=>({
 now:Date.parse('2026-11-27T00:01:12.000Z'),
 observedAt:'2026-11-27T00:01:10.000Z',
 preimage:{
  controllerSourceSha:source,ownerRecordSha256:sha('a'),
  hostManifestSha256:sha('b'),heartbeatSha256:sha('c'),
  stableAtRead:true
 },
 approvedPreimage:{
  scope:'SEPARATELY_APPROVED_ORPHAN_RECOVERY_B',
  approvalVerified:true,ownerRecordSha256:sha('a'),
  hostManifestSha256:sha('b'),heartbeatSha256:sha('c')
 },
 installed:{controllerSourceSha:source,controllerFilesVerified:true},
 oldOwner:{pid:9000,deadVerified:true,sameBootVerified:true,
  historicalSixSeatsVerified:true,
  lastHeartbeatAt:new Date(oldHeartbeatAt).toISOString()},
 newOwner:{pid:process.pid,aliveVerified:true,sameBootVerified:true,
  recoveryMode:'ADOPT_EXISTING_SIX_NO_SPAWN',
  startedAtUtc:'2026-11-27T00:00:00.000Z',
  noRunnerLaunchObserved:true},
 watcher:{
  watchdogOwnerVerified:true,installedR6SourceVerified:true,
  singleWatchdogOwnerVerified:true,
  noStandbyPromotionPendingVerified:true
 },
 privateLineage:{
  source:'RUNNER_JOB_SELF_ENV_MATCH_ONLY_NOT_AUTHORIZED',
  inheritedNonceMatchesOldOwner:true,
  newOwnerNonceMatchesInherited:true,
  newOwnerNoSpawnSourceVerified:true,
  sixOriginalListenerBirthTimesPinned:true
 },
 controllerSeatPins:fakeListenerSeats(),
 liveWmi:{source:'WIN32_PROCESS_PRIVATE_SAME_HOST',
  completeControllerRootsVerified:true,
  extraControllerListenerCount:0,unknownControllerPathCount:0,
  rows:fakeListenerSeats().map(x=>({...x,alive:true}))
 },
 lease:{
  newOwnerBytesSha256:sha('d'),newOwnerPid:process.pid,
  newOwnerMatchesLiveProcess:true,sameOwnerNonceContinuityVerified:true,
  claimExactCasReadback:true,singleRecoveryOperatorVerified:true,
  uninterruptedRecoveryLeaseVerified:true
 },
 installation:{
  independentMaintainerVerified:true,controllerSourceUnchanged:true,
  installLeaseHeld:false,workflowState:'active'
 },
 gitHubRoster:{fixedSixOnline:true},
 relatedLeases:0,activeControllerWorkers:0
});

test('existing Controller admission requires old nonce exact bytes AND a live replacement owner PID',()=>{
 // The same-nonce lease could satisfy the installed common.mjs guard only
 // after a separately authenticated operating B effect. This fixture
 // verifies code compatibility, not that the actual effect is authorized.
 const owner=syntheticOwner();
 assert.equal(assertSupervisorOwner(root,host,{
  ZGMINI_SUPERVISOR_NONCE:nonce
 },io(owner)),'SUPERVISOR_OWNERSHIP_VERIFIED');
 for(const mismatch of [
  nonce.toUpperCase(),
  'b1111111-b222-4333-8444-55555555c555',
  undefined
 ]){
  assert.throws(()=>assertSupervisorOwner(root,host,{
   ZGMINI_SUPERVISOR_NONCE:mismatch
  },io(owner)),e=>[
   'SUPERVISOR_OWNERSHIP_LOST','SUPERVISOR_OWNERSHIP_UNVERIFIED'
  ].includes(e?.code));
 }
 // The new Owner cannot have a mismatched Windows boot.
 assert.throws(()=>assertSupervisorOwner(root,host,{
  ZGMINI_SUPERVISOR_NONCE:nonce
 },io({...owner,bootAt:owner.bootAt-60000})),{
  code:'SUPERVISOR_OWNERSHIP_LOST'
 });
});

test('HEALTHY Watchdog alone does not supply the missing six-listener private nonce proof',()=>{
 const now=Date.parse('2026-11-27T00:01:12.000Z');
 const state=watchdogDecision({
  paused:false,owner:{pid:process.pid},live:true,
  heartbeat:new Date(now-1000).toISOString(),now
 });
 assert.equal(state,'HEALTHY');
 const candidate=assessNoSpawnMonitorSnapshot(allOtherPreflightValid());
 assert.equal(candidate.status,'BLOCKED');
 assert.equal(candidate.code,'NO_SPAWN_MONITOR_PRIVATE_NONCE_LINEAGE_UNVERIFIED');
 assert.equal(candidate.effectAuthorized,false);
 assert.equal(candidate.controllerJobAdmissionVerified,false);
 assert.equal(candidate.heartbeatWriteAuthorized,false);
 assert.equal(candidate.leaseMutationAuthorized,false);
 assert.equal(candidate.supervisorSpawnAuthorized,false);
 assert.equal(candidate.operationalWrites,0);
});

test('live six Listener PIDs deny old Runner exit and standby promotion even with a fresh status',()=>{
 const now=Date.parse('2026-11-27T00:01:12.000Z');
 const heartbeat={
  at:new Date(now-1000).toISOString(),
  pid:process.pid,mode:'LISTENING',
  adoptionMode:'ADOPT_EXISTING_SIX_NO_SPAWN',
  children:fakeListenerSeats().map(x=>({seat:x.seat,pid:x.pid,alive:true}))
 };
 assert.equal(watchdogDecision({
  paused:false,owner:{pid:process.pid},live:true,
  heartbeat:heartbeat.at,now
 }),'HEALTHY');
 assert.equal(provenOldRunnerExit({
  owner:{pid:process.pid},heartbeat,pidAlive:()=>true
 }),false);
 assert.equal(decideStandbyPromotion({
  sourceVerified:true,watchdogBound:true,
  supervisorLeasePresent:false,relatedLeasesPresent:false,
  maintenanceBusy:false,activeChildrenStopped:false
 }),'HOLD_EXISTING_CHILD');
});

test('lost owner heartbeat freshness must never imply safe standby takeover of six live listeners',()=>{
 const now=Date.parse('2026-11-27T00:01:12.000Z');
 const stale=new Date(now-50000).toISOString();
 assert.equal(watchdogDecision({
  paused:false,owner:{pid:process.pid},live:true,
  heartbeat:stale,now
 }),'BLOCKED_LIVE_OR_UNKNOWN');
 assert.equal(watchdogDecision({
  paused:false,owner:{pid:process.pid},live:false,
  heartbeat:stale,now
 }),'RECOVER');
 const orphan={
  pid:process.pid,
  children:fakeListenerSeats().map(x=>({seat:x.seat,pid:x.pid}))
 };
 assert.equal(provenOldRunnerExit({
  owner:{pid:process.pid},heartbeat:orphan,pidAlive:n=>n===process.pid?false:true
 }),false);
 assert.equal(decideStandbyPromotion({
  sourceVerified:true,watchdogBound:true,
  supervisorLeasePresent:false,relatedLeasesPresent:false,
  maintenanceBusy:false,activeChildrenStopped:false
 }),'HOLD_EXISTING_CHILD');
});

test('integration test contains no operating heartbeat/lease writes or Runner process spawns',()=>{
 const src=fs.readFileSync(new URL(
  '../tests/supervisor-orphan-owner-watchdog-crosscheck.test.mjs',import.meta.url
 ),'utf8');
 assert.doesNotMatch(src,
  /\bspawn\s*\(|\bexecFileSync\s*\(|\bkill\s*\(|\bwriteFileSync\s*\(|\brenameSync\s*\(|\bmkdirSync\s*\(|\brmSync\s*\(/);
});
