import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNoSpawnHeartbeatActor} from '../controller/orphan-no-spawn-heartbeat-actor.mjs';
import {createIsolatedOrphanStatusWriter} from '../tools/supervisor-orphan-status-temp-writer.mjs';

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
// Synthetic status-file transport for OLD actor regressions. The in-memory
// SHA rolls after every successful test-only write, as real file bytes would.
// It is NOT a trusted or operating fixed-path writer.
const actor=(probe,writeStatus,options={})=>{
 let rawStatusSha256=hex('c');
 return createNoSpawnHeartbeatActor({
  attest:async()=>({...await probe(),heartbeatRawObservation:{
   source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:rawStatusSha256
  }}),
  writeStatus:async packet=>{
   if(packet.expectedRawSha256!==rawStatusSha256||!packet.canCommit())
    return false;
   const heartbeat=JSON.parse(packet.nextRawBytes.toString('utf8'));
   const ok=await writeStatus(heartbeat);
   if(ok===true){
    rawStatusSha256=createHash('sha256').update(packet.nextRawBytes).digest('hex');
    return {status:'EXACT_RAW_CAS_READBACK_VERIFIED',
     expectedRawSha256:packet.expectedRawSha256,
     readbackRawSha256:rawStatusSha256};
   }
   return ok;
  },
  now:()=>t,...options
 });
};
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

test('Windows TEMP exact-file atomic CAS permits real three-tick rotating readback',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-fixture-'));
 try{
  const control=path.join(root,'pc-control');
  fs.mkdirSync(path.join(control,'leases','supervisor'),{recursive:true});
  const file=path.join(control,'SUPERVISOR_STATUS.json');
  const initial=Buffer.from(JSON.stringify({
   at:'2026-11-26T23:00:00Z',pid:999999,sourceSha:'a'.repeat(40),
   mode:'LISTENING',children:seats().map(x=>({seat:x.seat,pid:x.pid}))
  })+'\n');
  fs.writeFileSync(file,initial,{flag:'wx'});
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const oldSha=hash(initial);
  let clock=t,commits=0;
  const sampleOnDisk=()=>{
   const x=sample();
   // The approved first heartbeat is immutable even as the *current*
   // status-file bytes are replaced by this Actor's own fresh heartbeat.
   x.preimage.heartbeatSha256=oldSha;
   x.approvedPreimage.heartbeatSha256=oldSha;
   x.observedAt=new Date(clock-1000).toISOString();
   x.heartbeatRawObservation={source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',
    sha256:hash(fs.readFileSync(file))};
   return x;
  };
  const a=createNoSpawnHeartbeatActor({
   now:()=>clock,
   attest:async()=>sampleOnDisk(),
   writeStatus:async packet=>{
    const outcome=await createIsolatedOrphanStatusWriter({root})(packet);
    if(outcome.status==='EXACT_RAW_CAS_READBACK_VERIFIED')commits++;
    return outcome;
   }
  });
  for(let i=0;i<3;i++){
   const outcome=await a.tick();
   assert.equal(outcome.status,'MONITORING','TEMP cycle '+i);
   const body=JSON.parse(fs.readFileSync(file,'utf8'));
   assert.equal(body.pid,process.pid);
   assert.equal(body.at,new Date(clock).toISOString());
   assert.equal(body.children.length,6);
   assert.equal(body.adoptionMode,'ADOPT_EXISTING_SIX_NO_SPAWN');
   clock+=15000;
  }
  assert.equal(commits,3);
  assert.notEqual(hash(fs.readFileSync(file)),oldSha);
  a.stop();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('no-spawn Actor has no OS process, lease or filesystem mutation primitives',()=>{
 const src=source();
 assert.doesNotMatch(src,/\bspawn\s*\(|\bexecFile\s*\(|\bkill\s*\(|taskkill|Stop-Process|Get-CimInstance/);
 assert.doesNotMatch(src,/unlinkSync|renameSync|writeFileSync|mkdirSync|rmSync|rmdirSync|child_process/);
 assert.doesNotMatch(src,/process\.env|SUPER[V]?ISOR_NONCE|heartbeatWriteAuthorized:true/);
 assert.match(src,/assessNoSpawnMonitorSnapshot/);
 assert.match(src,/writeStatus\(Object\.freeze/);
 assert.match(src,/clearInterval\(timer\)/);
});


test('established actor continues verified heartbeat during a legitimate Controller job lease',async()=>{
 let active=false,writes=[];
 const a=actor(async()=>{
  const x=sample();
  if(active){
   x.relatedLeases=2;x.activeControllerWorkers=1;
   x.ongoingJobs={
    source:'PRIVATE_SAME_HOST_CONTROLLER_JOB_LEASES',
    observedRelatedLeaseCount:2,
    allRelatedLeasesAccountedFor:true,
    allBoundToOriginalSixSeatsVerified:true,
    workerProcessLineageVerified:true,
    noInstallRecoveryOrExternalLeaseVerified:true,
    jobOwnerNonceContinuityVerified:true,
    activeWorkerCount:1
   };
  }
  return x;
 },async hb=>{writes.push(hb);return true;});
 assert.equal((await a.tick()).status,'MONITORING');
 active=true;
 assert.equal((await a.tick()).status,'MONITORING');
 assert.equal(writes.length,2);
 assert.deepEqual(writes[1].children,writes[0].children);
 assert.equal(writes[1].adoptionMode,'ADOPT_EXISTING_SIX_NO_SPAWN');
 a.stop();
});

test('unattributed job leases after initial adoption stop further heartbeat',async()=>{
 let active=false,writes=0;
 const a=actor(async()=>{
  const x=sample();
  if(active){x.relatedLeases=2;x.activeControllerWorkers=1;}
  return x;
 },async()=>{writes++;return true;});
 assert.equal((await a.tick()).status,'MONITORING');
 active=true;
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
 assert.equal(writes,1);
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
});


test('rolling SHA verifies three consecutive self-authored heartbeats without reapproving historical bytes',async()=>{
 let current=hex('c'),writes=[],reads=0;
 const fixed=async()=>{reads++;return {...sample(),heartbeatRawObservation:{
  source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:current
 }};};
 const a=createNoSpawnHeartbeatActor({
  attest:fixed,now:()=>t,
  writeStatus:async packet=>{
   assert.equal(packet.schema,'ZGMINI_ORPHAN_EXACT_HEARTBEAT_CAS_WRITE_V1');
   assert.equal(packet.fixedFile,'SUPERVISOR_STATUS.json');
   assert.equal(packet.expectedRawSha256,current);
   assert.equal(packet.canCommit(),true);
   const bytes=packet.nextRawBytes;
   const expected=createHash('sha256').update(bytes).digest('hex');
   assert.equal(packet.nextRawSha256,expected);
   assert.equal(JSON.parse(bytes.toString()).pid,process.pid);
   writes.push({preimage:packet.expectedRawSha256,sha256:expected});
   current=expected;
   return {status:'EXACT_RAW_CAS_READBACK_VERIFIED',
    expectedRawSha256:packet.expectedRawSha256,readbackRawSha256:expected};
  }
 });
 for(let i=0;i<3;i++){
  const outcome=await a.tick();
  assert.equal(outcome.status,'MONITORING','cycle '+i);
  assert.equal(outcome.operatingRecoveryVerified,false);
 }
 assert.equal(reads,6);
 assert.equal(writes.length,3);
 assert.equal(writes[0].preimage,hex('c'));
 assert.equal(writes[1].preimage,writes[0].sha256);
 assert.equal(writes[2].preimage,writes[1].sha256);
 a.stop();
});

test('external status-file tamper after a verified write stops subsequent heartbeat',async()=>{
 let current=hex('c'),writes=0;
 const a=createNoSpawnHeartbeatActor({
  now:()=>t,
  attest:async()=>({...sample(),heartbeatRawObservation:{
   source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:current
  }}),
  writeStatus:async packet=>{
   writes++;current=packet.nextRawSha256;
   return {status:'EXACT_RAW_CAS_READBACK_VERIFIED',
    expectedRawSha256:packet.expectedRawSha256,
    readbackRawSha256:packet.nextRawSha256};
  }
 });
 assert.equal((await a.tick()).status,'MONITORING');
 current=hex('f');
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
 assert.equal(writes,1);
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
});

test('prewrite double-read status CAS change blocks all writes',async()=>{
 let reads=0,writes=0;
 const a=createNoSpawnHeartbeatActor({
  now:()=>t,attest:async()=>({...sample(),heartbeatRawObservation:{
   source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:++reads===2?hex('f'):hex('c')
  }}),
  writeStatus:async()=>{writes++;return true;}
 });
 assert.equal((await a.tick()).status,'FAIL_CLOSED');
 assert.equal(writes,0);
});

test('only exact raw CAS readback receipt is accepted, not boolean or forged digest',async()=>{
 for(const modify of [
  ()=>true,
  ({expectedRawSha256,nextRawSha256})=>({
   status:'EXACT_RAW_CAS_READBACK_VERIFIED',expectedRawSha256,
   readbackRawSha256:hex('f')===nextRawSha256?hex('e'):hex('f')}),
  ({expectedRawSha256,nextRawSha256})=>({
   status:'EXACT_RAW_CAS_READBACK_VERIFIED',
   expectedRawSha256:hex('b'),readbackRawSha256:nextRawSha256})
 ]){
  let writes=0;
  const a=createNoSpawnHeartbeatActor({
   now:()=>t,attest:async()=>({...sample(),heartbeatRawObservation:{
    source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:hex('c')
   }}),
   writeStatus:async packet=>{writes++;return modify(packet);}
  });
  assert.equal((await a.tick()).code,'NO_SPAWN_ACTOR_HEARTBEAT_WRITE_UNVERIFIED');
  assert.equal((await a.tick()).status,'FAIL_CLOSED');
  assert.equal(writes,1);
 }
});

test('stopping an in-flight writer withdraws its ability to commit',async()=>{
 let resume,entered;
 const wait=new Promise(resolve=>{resume=resolve;});
 const enteredPromise=new Promise(resolve=>{entered=resolve;});
 let committed=false,canCommitAtEnd=null;
 const a=createNoSpawnHeartbeatActor({
  now:()=>t,attest:async()=>({...sample(),heartbeatRawObservation:{
   source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:hex('c')
  }}),
  writeStatus:async packet=>{
   entered();
   await wait;
   canCommitAtEnd=packet.canCommit();
   if(canCommitAtEnd)committed=true;
   return false;
  }
 });
 const running=a.tick();
 await enteredPromise;
 assert.equal(a.stop().status,'STOPPED');
 resume();
 assert.equal((await running).status,'FAIL_CLOSED');
 assert.equal(canCommitAtEnd,false);
 assert.equal(committed,false);
});

test('raw observation is mandatory even with synthetic six good seats',async()=>{
 for(const obs of [null,{},{
  source:'GITHUB_ISSUE_BODY',sha256:hex('c')},{
  source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:'short'},{
  source:'PRIVATE_FIXED_STATUS_FILE_RAW_BYTES',sha256:hex('f')}
 ]){
  let writes=0;
  const a=createNoSpawnHeartbeatActor({
   attest:async()=>({...sample(),heartbeatRawObservation:obs}),
   now:()=>t,writeStatus:async()=>{writes++;return true;}
  });
  assert.equal((await a.tick()).status,'FAIL_CLOSED');
  assert.equal(writes,0);
 }
});
