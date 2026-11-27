import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createNoSpawnHeartbeatActor} from '../controller/orphan-no-spawn-heartbeat-actor.mjs';

const t=Date.parse('2026-11-26T23:45:12Z');
const hex=c=>c.repeat(64);
const seats=()=>Array.from({length:6},(_,i)=>({
 seat:i+1,pid:5100+i,startedAtUtc:'2026-11-26T22:57:00Z',
 canonicalPathSha256:String.fromCharCode(97+i).repeat(64)
}));
const sample=()=>({
 observedAt:'2026-11-26T23:45:10Z',
 preimage:{controllerSourceSha:'a'.repeat(40),ownerRecordSha256:hex('a'),
  hostManifestSha256:hex('b'),heartbeatSha256:hex('c'),stableAtRead:true},
 approvedPreimage:{scope:'SEPARATELY_APPROVED_ORPHAN_RECOVERY_B',
  approvalVerified:true,ownerRecordSha256:hex('a'),
  hostManifestSha256:hex('b'),heartbeatSha256:hex('c')},
 installed:{controllerSourceSha:'a'.repeat(40),controllerFilesVerified:true},
 oldOwner:{pid:999999,deadVerified:true,sameBootVerified:true,
  historicalSixSeatsVerified:true,lastHeartbeatAt:'2026-11-26T23:00:00Z'},
 newOwner:{pid:process.pid,aliveVerified:true,sameBootVerified:true,
  recoveryMode:'ADOPT_EXISTING_SIX_NO_SPAWN',
  startedAtUtc:'2026-11-26T23:45:00Z',noRunnerLaunchObserved:true},
 watcher:{watchdogOwnerVerified:true,installedR6SourceVerified:true,
  singleWatchdogOwnerVerified:true,noStandbyPromotionPendingVerified:true},
 privateLineage:{source:'PRIVATE_APPROVED_WINDOWS_B_ATTESTATION',
  inheritedNonceMatchesOldOwner:true,newOwnerNonceMatchesInherited:true,
  newOwnerNoSpawnSourceVerified:true,sixOriginalListenerBirthTimesPinned:true},
 controllerSeatPins:seats(),
 liveWmi:{source:'WIN32_PROCESS_PRIVATE_SAME_HOST',
  completeControllerRootsVerified:true,extraControllerListenerCount:0,
  unknownControllerPathCount:0,rows:seats().map(x=>({...x,alive:true}))},
 lease:{newOwnerBytesSha256:hex('d'),newOwnerPid:process.pid,
  newOwnerMatchesLiveProcess:true,sameOwnerNonceContinuityVerified:true,
  claimExactCasReadback:true,singleRecoveryOperatorVerified:true,
  uninterruptedRecoveryLeaseVerified:true},
 gitHubRoster:{fixedSixOnline:true},
 installation:{independentMaintainerVerified:true,controllerSourceUnchanged:true,
  installLeaseHeld:false,workflowState:'active'},
 relatedLeases:0,activeControllerWorkers:0
});
const clone=x=>structuredClone(x);
const actor=(probe,writeStatus,options={})=>createNoSpawnHeartbeatActor({
 attest:probe,writeStatus,now:()=>t,selfPid:process.pid,...options
});
const source=()=>fs.readFileSync(
 new URL('../controller/orphan-no-spawn-heartbeat-actor.mjs',import.meta.url),'utf8');

test('two live probes allow one heartbeat with six inherited Listener PIDs, no spawn',async()=>{
 const base=sample();let reads=0,writes=[];
 const a=actor(async()=>{reads++;return clone(base);},async hb=>{writes.push(hb);return true;});
 const r=await a.tick();
 assert.equal(r.status,'MONITORING');
 assert.equal(reads,2);assert.equal(writes.length,1);
 assert.equal(writes[0].pid,process.pid);
 assert.equal(writes[0].sourceSha,'a'.repeat(40));
 assert.equal(writes[0].at,new Date(t).toISOString());
 assert.equal(writes[0].mode,'LISTENING');
 assert.equal(writes[0].adoptionMode,'ADOPT_EXISTING_SIX_NO_SPAWN');
 assert.deepEqual(writes[0].children.map(x=>x.seat),[1,2,3,4,5,6]);
 assert.deepEqual(writes[0].children.map(x=>x.pid),seats().map(x=>x.pid));
 assert.equal(r.runnerStarts,0);assert.equal(r.runnerStops,0);
 assert.equal(r.leaseMutations,0);assert.equal(r.operatingRecoveryVerified,false);
 assert.doesNotMatch(JSON.stringify(r),/5100|999999|WIN32_PROCESS|PRIVATE_APPROVED|owner\.json/);
 a.stop();
});

test('a second prewrite probe detecting PID reuse, birth or path changes never writes',async()=>{
 for(const mutate of [
  x=>{x.liveWmi.rows[0].pid=5200;},
  x=>{x.liveWmi.rows[0].startedAtUtc='2026-11-26T22:58:00Z';},
  x=>{x.liveWmi.rows[0].canonicalPathSha256=hex('f');},
  x=>{x.lease.claimExactCasReadback=false;},
  x=>{x.watcher.noStandbyPromotionPendingVerified=false;},
  x=>{x.privateLineage.inheritedNonceMatchesOldOwner=false;}
 ]){
  let calls=0,writes=0;const a=actor(async()=>{
   const x=sample();if(++calls===2)mutate(x);return x;
  },async()=>{writes++;return true;});
  assert.equal((await a.tick()).status,'FAIL_CLOSED');
  assert.equal(writes,0);
  assert.equal((await a.tick()).status,'FAIL_CLOSED');
 }
});

test('after a good tick no change to any pinned Listener or Owner can be rebased',async()=>{
 let writes=0,mutated=false;
 const a=actor(async()=>{
  const x=sample();if(mutated){
   x.controllerSeatPins[1].pid=7101;
   x.liveWmi.rows[1].pid=7101;
  }return x;
 },async()=>{writes++;return true;});
 assert.equal((await a.tick()).status,'MONITORING');
 mutated=true;
 assert.equal((await a.tick()).code,'NO_SPAWN_ACTOR_PINNED_IDENTITY_DRIFT');
 assert.equal(writes,1);
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
});

test('no approved private lineage, wrong Owner PID or stale WMI blocks all writes',async()=>{
 for(const mutate of [
  x=>{x.approvedPreimage.approvalVerified=false;},
  x=>{x.privateLineage.source='GITHUB_ISSUE_BODY';},
  x=>{x.newOwner.pid+=1;},
  x=>{x.liveWmi.unknownControllerPathCount=1;},
  x=>{x.observedAt='2026-11-26T23:40:00Z';},
  x=>{x.relatedLeases=1;}
 ]){
  let writes=0;const a=actor(async()=>{
   const x=sample();mutate(x);return x;
  },async()=>{writes++;return true;});
  assert.equal((await a.tick()).status,'FAIL_CLOSED');
  assert.equal(writes,0);
 }
});

test('heartbeat write must positively attest atomic write/readback, no retry on unknown',async()=>{
 let writes=0;
 const a=actor(async()=>sample(),async()=>{
  writes++;return false;
 });
 assert.equal((await a.tick()).code,'NO_SPAWN_ACTOR_HEARTBEAT_WRITE_UNVERIFIED');
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
 assert.equal(writes,1);
});

test('overlapping private attestation latches a failure before any heartbeat',async()=>{
 let unblock;
 const pending=new Promise(resolve=>{unblock=resolve;});
 let count=0,writes=0;
 const a=actor(async()=>{
  if(++count===1)await pending;
  return sample();
 },async()=>{writes++;return true;});
 const first=a.tick();
 assert.equal((await a.tick()).code,'NO_SPAWN_ACTOR_OVERLAPPING_ATTESTATION');
 unblock();
 assert.equal((await first).status,'FAIL_CLOSED');
 assert.equal(writes,0);
});

test('attestor exception and missing bindings fail closed without source side effects',async()=>{
 let writes=0;const a=actor(async()=>{throw Error('PRIVATE_NONCE');},async()=>{
  writes++;return true;
 });
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
 assert.equal(writes,0);
 assert.throws(()=>createNoSpawnHeartbeatActor(),/PRIVATE_BINDINGS_REQUIRED/);
});

test('Windows CI-compatible isolated TEMP heartbeat file never touches operating root',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-fixture-'));
 try{
  const file=path.join(root,'SUPERVISOR_STATUS.json');
  const a=actor(async()=>sample(),async hb=>{
   fs.writeFileSync(file,JSON.stringify(hb)+'\n',{flag:'wx'});
   return JSON.parse(fs.readFileSync(file,'utf8')).children.length===6;
  });
  assert.equal((await a.tick()).status,'MONITORING');
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).children.length,6);
  a.stop();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('no-spawn Actor has no OS process, lease or filesystem mutation primitives',()=>{
 const src=source();
 assert.doesNotMatch(src,/\bspawn\s*\(|\bexecFile\s*\(|\bkill\s*\(|taskkill|Stop-Process|Get-CimInstance/);
 assert.doesNotMatch(src,/unlinkSync|renameSync|writeFileSync|mkdirSync|rmSync|rmdirSync|child_process/);
 assert.doesNotMatch(src,/process\.env|SUPER[V]?ISOR_NONCE|heartbeatWriteAuthorized:true/);
 assert.match(src,/assessNoSpawnMonitorSnapshot/);
 assert.match(src,/writeStatus\(heartbeat\)/);
 assert.match(src,/clearInterval\(timer\)/);
});
