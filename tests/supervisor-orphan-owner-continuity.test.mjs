import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import {assessOrphanOwnerContinuity,compareContinuityStrategies}
 from '../controller/orphan-owner-continuity-contract.mjs';
import {assertSupervisorOwner} from '../controller/common.mjs';

const nonce='11111111-2222-4333-8444-555555555555';
const now=Date.parse('2026-11-26T23:30:10Z');
const at='2026-11-26T23:30:00Z';
const oldAt='2026-11-26T23:27:40Z';
const source='a'.repeat(40);
function valid(){
 return {
  observedAt:at,now,oldOwner:{pid:4242,nonce,bootAt:200000},
  oldOwnerAlive:false,oldSupervisorIdentityProven:true,
  oldHeartbeat:{pid:4242,sourceSha:source,mode:'LISTENING',at:oldAt,
   children:Array.from({length:6},(_,i)=>({seat:i+1,pid:4300+i}))},
  controllerSourceSha:source,installedControllerSourceSha:source,
  currentBootAt:200000,ownerBytesSha256:'b'.repeat(64),
  expectedOwnerBytesSha256:'b'.repeat(64),
  hostBytesSha256:'c'.repeat(64),expectedHostBytesSha256:'c'.repeat(64),
  watchdogOwnerVerified:true,watchdogSourceMatch:true,
  watchdogBlockedOldRunners:true,maintenanceReceiverReady:true,
  installLeaseHeld:false,relatedLeaseCount:0,allSixRunnersOnline:true,
  runnerSeatProof:Array.from({length:6},(_,i)=>({
   seat:i+1,listenerCount:1,workerCount:0,
   canonicalControllerSource:true,livePidWithCreationTimeVerified:true
  })),
  inheritedNonceLocalProof:{method:'PRIVATE_WINDOWS_SUPERVISOR_LAUNCH_LINEAGE',
   verified:true,seatCount:6,oldOwnerMatches:true},
  approvalManifestAuthenticated:true
 };
}

test('isolated same-nonce six-seat proof remains candidate-only, never an effect',()=>{
 const p=assessOrphanOwnerContinuity(valid());
 assert.equal(p.status,'CANDIDATE_ONLY');
 assert.equal(p.code,'CONTINUITY_SAME_NONCE_OWNER_REPLACEMENT_PLAUSIBLE');
 assert.equal(p.existingListenerCount,6);
 assert.equal(p.activeWorkerCount,0);
 assert.equal(p.oldOwnerNonceContinued,false);
 assert.equal(p.controllerJobAdmissionVerified,false);
 for(const flag of ['effectAuthorized','supervisorSpawnAuthorized','runnerStopAuthorized',
  'leaseMutationAuthorized'])assert.equal(p[flag],false);
 assert.equal(p.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(p),/11111111|4242|4300|supervisor\/owner\.json/i);
});

test('observed old owner, current boot, source and heartbeat must all agree',()=>{
 const changes=[
  x=>{x.controllerSourceSha='d'.repeat(40);},
  x=>{x.ownerBytesSha256='d'.repeat(64);},
  x=>{x.hostBytesSha256='d'.repeat(64);},
  x=>{x.oldOwnerAlive=true;},
  x=>{x.oldOwnerAlive=null;},
  x=>{x.oldSupervisorIdentityProven=false;},
  x=>{x.oldOwner.pid=0;},
  x=>{x.oldOwner.nonce='not-a-uuid';},
  x=>{x.oldOwner.nonce='------------------------------------';},
  x=>{x.oldOwner.bootAt+=15000;},
  x=>{x.oldHeartbeat.pid=4243;},
  x=>{x.oldHeartbeat.mode='DRAIN';},
  x=>{x.oldHeartbeat.sourceSha='d'.repeat(40);},
  x=>{x.oldHeartbeat.children=x.oldHeartbeat.children.slice(1);},
  x=>{x.oldHeartbeat.children[1].pid=4300;},
  x=>{x.oldHeartbeat.children[1].seat=1;},
  x=>{x.oldHeartbeat.at='2026-11-26T23:29:55Z';},
  x=>{x.oldHeartbeat.at='2026-11-28T23:30:00Z';},
  x=>{x.observedAt='2026-11-26T23:18:00Z';},
  x=>{x.now=Date.parse('2026-11-26T23:31:59Z')+2000;}
 ];
 for(let i=0;i<changes.length;i++){
  const x=valid();changes[i](x);const p=assessOrphanOwnerContinuity(x);
  assert.equal(p.status,'BLOCKED','owner case '+i);
  assert.equal(p.effectAuthorized,false);
 }
});

test('watchdog, maintenance and job leases fail closed independent of six online seats',()=>{
 const changes=[
  x=>{x.watchdogOwnerVerified=false;},
  x=>{x.watchdogSourceMatch=false;},
  x=>{x.watchdogBlockedOldRunners=false;},
  x=>{x.maintenanceReceiverReady=false;},
  x=>{x.installLeaseHeld=true;},
  x=>{x.relatedLeaseCount=1;},
  x=>{x.allSixRunnersOnline=false;},
  x=>{x.runnerSeatProof[2].listenerCount=0;},
  x=>{x.runnerSeatProof[2].listenerCount=2;},
  x=>{x.runnerSeatProof[2].workerCount=1;},
  x=>{x.runnerSeatProof[2].canonicalControllerSource=false;},
  x=>{x.runnerSeatProof[2].livePidWithCreationTimeVerified=false;},
  x=>{x.runnerSeatProof[2].seat=1;},
  x=>{x.runnerSeatProof=x.runnerSeatProof.slice(0,5);}
 ];
 for(let i=0;i<changes.length;i++){
  const x=valid();changes[i](x);const p=assessOrphanOwnerContinuity(x);
  assert.equal(p.status,'BLOCKED','resource case '+i);
  assert.equal(p.supervisorSpawnAuthorized,false);
 }
 const busy=valid();busy.runnerSeatProof[4].workerCount=1;
 assert.equal(assessOrphanOwnerContinuity(busy).code,'CONTINUITY_WORKER_PRESENT');
});

test('private inherited nonce proof and exact effect approval cannot be inferred',()=>{
 const changes=[
  x=>{delete x.inheritedNonceLocalProof;},
  x=>{x.inheritedNonceLocalProof.method='WMI_PATH_ONLY';},
  x=>{x.inheritedNonceLocalProof.verified=false;},
  x=>{x.inheritedNonceLocalProof.oldOwnerMatches=undefined;},
  x=>{x.inheritedNonceLocalProof.seatCount=5;},
  x=>{x.approvalManifestAuthenticated=false;}
 ];
 for(let i=0;i<changes.length;i++){
  const x=valid();changes[i](x);const p=assessOrphanOwnerContinuity(x);
  assert.equal(p.status,'BLOCKED','nonce proof '+i);
  assert.equal(p.leaseMutationAuthorized,false);
 }
});

test('installed Controller permits matching inherited nonce only with LIVE new owner PID',()=>{
 const host={controllerFiles:{'controller/standby.mjs':'a'.repeat(64)}};
 const owner={pid:process.pid,nonce,bootAt:Date.now()-os.uptime()*1000};
 const io={readFileSync:()=>JSON.stringify(owner)};
 const oldRunnerEnvironment={ZGMINI_SUPERVISOR_NONCE:nonce};
 assert.equal(assertSupervisorOwner('E:/uninstalled-fixture',host,oldRunnerEnvironment,io),
  'SUPERVISOR_OWNERSHIP_VERIFIED');
 assert.throws(()=>assertSupervisorOwner('E:/uninstalled-fixture',host,
  {ZGMINI_SUPERVISOR_NONCE:'99999999-9999-4999-8999-999999999999'},io),
  /SUPERVISOR_OWNERSHIP_LOST/);
 const oldPid=owner.pid;owner.pid=2147483647;
 assert.throws(()=>assertSupervisorOwner('E:/uninstalled-fixture',host,
  oldRunnerEnvironment,io),/SUPERVISOR_OWNERSHIP_LOST/);
 owner.pid=oldPid;owner.bootAt=0;
 assert.throws(()=>assertSupervisorOwner('E:/uninstalled-fixture',host,
  oldRunnerEnvironment,io),/SUPERVISOR_OWNERSHIP_LOST/);
});

test('continuity strategy comparison never approves or starts any process',()=>{
 const yes=compareContinuityStrategies({
  existingRunnerNonceMatchesNewOwner:true,oldPidProvenDead:true,
  originalSixSeatsVerified:true,newSupervisorWouldSpawnSix:false
 });
 assert.equal(yes.sameNonceCode,'CODE_PATH_PLAUSIBLE_NOT_AUTHORIZED');
 assert.equal(yes.duplicateRisk,false);
 assert.equal(yes.effectAuthorized,false);
 const no=compareContinuityStrategies({
  existingRunnerNonceMatchesNewOwner:false,oldPidProvenDead:true,
  originalSixSeatsVerified:true,newSupervisorWouldSpawnSix:true
 });
 assert.equal(no.newNonceCode,'OLD_RUNNER_ADMISSION_WOULD_FAIL');
 assert.equal(no.duplicateRisk,true);
});

test('candidate has no OS operations, process environment, SQL or network',()=>{
 const src=fs.readFileSync(new URL('../controller/orphan-owner-continuity-contract.mjs',
  import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bspawn\s*\(|\bkill\s*\(|\bexecFileSync\s*\(|\bwriteFileSync\s*\(|fetch\s*\(|require\s*\(|unlinkSync|renameSync|mkdirSync|taskkill/);
 for(const field of ['effectAuthorized:false','supervisorSpawnAuthorized:false',
   'runnerStopAuthorized:false','leaseMutationAuthorized:false'])assert.ok(src.includes(field));
});
