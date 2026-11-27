import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertIsolatedOrphanRoot,swapOrphanLeaseInTemp}
 from '../tools/supervisor-orphan-lease-temp-fixture.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const nonce='11111111-2222-4333-8444-555555555555';
const old={pid:4242,nonce,bootAt:20000,at:'2026-11-26T23:00:00Z'};
const fresh={pid:9000,nonce,bootAt:20000,
 recoveryMode:'ADOPT_EXISTING_SIX_NO_SPAWN',at:'2026-11-27T00:00:00Z'};
const host={controllerSourceSha:'a'.repeat(40),controllerFiles:{'controller/common.mjs':'b'.repeat(64)}};
const heartbeat={pid:4242,sourceSha:'a'.repeat(40),mode:'LISTENING',
 at:'2026-11-26T23:00:10Z',children:Array.from({length:6},(_,i)=>({seat:i+1,pid:5100+i}))};
const json=o=>JSON.stringify(o)+'\n';
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-fixture-'));
 const control=path.join(root,'pc-control');
 const lease=path.join(control,'leases','supervisor');
 fs.mkdirSync(lease,{recursive:true});
 const oldBytes=json(old),hostBytes=json(host),heartbeatBytes=json(heartbeat);
 fs.writeFileSync(path.join(lease,'owner.json'),oldBytes,{flag:'wx'});
 fs.writeFileSync(path.join(control,'host.json'),hostBytes,{flag:'wx'});
 fs.writeFileSync(path.join(control,'SUPERVISOR_STATUS.json'),heartbeatBytes,{flag:'wx'});
 const expected={ownerSha256:sha(oldBytes),hostSha256:sha(hostBytes),
  heartbeatSha256:sha(heartbeatBytes)};
 return {root,control,lease,oldBytes,expected,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const request=fx=>({
 root:fx.root,requestId:'orphan-temp-proof-20261127-once',
 expected:fx.expected,newOwner:{...fresh},
 privateAttestation:{scope:'SYNTHETIC_TEMP_ONLY',noSpawnVerified:true,
  oldNonceSameAsNew:true,sixListenerIdentitiesVerified:true,workerCount:0,
  unrelatedLeasesAbsent:true,watchdogFenced:true,independentOperatorVerified:true},
 oldPidAlive:()=>false,newPidAlive:()=>true
});
const readOwner=fx=>fs.readFileSync(path.join(fx.lease,'owner.json'),'utf8');

test('isolated same-nonce lease directory handoff preserves exact prior owner as backup',()=>{
 const fx=fixture();try{
  assert.equal(assertIsolatedOrphanRoot(fx.root),fs.realpathSync(fx.root));
  const v=swapOrphanLeaseInTemp(request(fx));
  assert.equal(v.status,'ISOLATED_SWAPPED');
  assert.equal(v.code,'ORPHAN_TEMP_LEASE_CAS_SWAP_SIMULATED');
  assert.equal(JSON.parse(readOwner(fx)).pid,9000);
  const backup=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once',
   'old-supervisor','owner.json');
  assert.equal(fs.readFileSync(backup,'utf8'),fx.oldBytes);
  assert.equal(v.operatingWrites,0);
  assert.equal(v.runnerStarts,0);
  assert.equal(v.runnerStops,0);
  assert.equal(v.leaseMutationAuthorized,false);
  assert.equal(v.operatingEffectAuthorized,false);
  assert.doesNotMatch(JSON.stringify(v),/11111111|9000|4242|owner.json/);
 }finally{fx.cleanup();}
});

test('one-use duplicate request refuses any second lease transition',()=>{
 const fx=fixture();try{
  const q=request(fx);
  assert.equal(swapOrphanLeaseInTemp(q).status,'ISOLATED_SWAPPED');
  const current=readOwner(fx);
  const second=swapOrphanLeaseInTemp(q);
  assert.equal(second.status,'BLOCKED');
  assert.equal(readOwner(fx),current);
 }finally{fx.cleanup();}
});

test('operating path and nonfixture TEMP path can never enter the isolated swap',()=>{
 const fx=fixture();try{
  const q=request(fx);
  for(const root of [
   'E:/ZGmini/automation/pc-control',
   os.tmpdir(),path.dirname(fx.root),path.join(fx.root,'pc-control')]){
   const r=swapOrphanLeaseInTemp({...q,root});
   assert.equal(r.status,'BLOCKED');
   assert.equal(r.code,'ORPHAN_TEMP_SCOPE_DENIED');
  }
  assert.equal(readOwner(fx),fx.oldBytes);
 }finally{fx.cleanup();}
});

test('CAS mismatch, live old owner, absent new PID or active resource lease forbid swap',()=>{
 const mutations=[
  q=>{q.expected.ownerSha256='c'.repeat(64);},
  q=>{q.expected.hostSha256='d'.repeat(64);},
  q=>{q.expected.heartbeatSha256='e'.repeat(64);},
  q=>{q.oldPidAlive=()=>true;},
  q=>{q.oldPidAlive=()=>null;},
  q=>{q.newPidAlive=()=>false;},
  q=>{q.newOwner.nonce='bad';},
  q=>{q.newOwner.pid=4242;},
  q=>{q.newOwner.bootAt=35001;},
  q=>{q.newOwner.recoveryMode='SPAWN_ALL_SIX';},
  q=>{q.privateAttestation.oldNonceSameAsNew=false;},
  q=>{q.privateAttestation.workerCount=1;},
  q=>{q.privateAttestation.watchdogFenced=false;},
  q=>{q.privateAttestation.independentOperatorVerified=false;},
  q=>{q.privateAttestation.sixListenerIdentitiesVerified=false;}
 ];
 for(let i=0;i<mutations.length;i++){
  const fx=fixture();try{
   const q=request(fx);mutations[i](q);
   const result=swapOrphanLeaseInTemp(q);
   assert.equal(result.status,'BLOCKED','mutation '+i);
   assert.equal(readOwner(fx),fx.oldBytes);
  }finally{fx.cleanup();}
 }
 const fx=fixture();try{
  fs.mkdirSync(path.join(fx.control,'leases','request-busy'));
  const result=swapOrphanLeaseInTemp(request(fx));
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'ORPHAN_TEMP_OTHER_RESOURCE_LEASE_PRESENT');
  assert.equal(readOwner(fx),fx.oldBytes);
 }finally{fx.cleanup();}
});

test('failure before old lease rename does not change original owner',()=>{
 const fx=fixture();try{
  const result=swapOrphanLeaseInTemp({...request(fx),
   injectFailure:'BEFORE_RENAME'});
  assert.equal(result.status,'BLOCKED');
  assert.equal(readOwner(fx),fx.oldBytes);
  const duplicate=swapOrphanLeaseInTemp(request(fx));
  assert.equal(duplicate.status,'BLOCKED');
  assert.equal(duplicate.code,'ORPHAN_TEMP_CLAIM_REUSED_NO_RETRY');
 }finally{fx.cleanup();}
});

test('injected failure after old archive restores OLD lease iff original bytes intact',()=>{
 const fx=fixture();try{
  const result=swapOrphanLeaseInTemp({...request(fx),
   injectFailure:'AFTER_OLD_RENAMED'});
  assert.equal(result.status,'ISOLATED_ROLLED_BACK');
  assert.equal(readOwner(fx),fx.oldBytes);
  assert.equal(fs.readdirSync(path.join(fx.control,'leases')).join(','),'supervisor');
  const duplicate=swapOrphanLeaseInTemp(request(fx));
  assert.equal(duplicate.status,'BLOCKED');
 }finally{fx.cleanup();}
});

test('uncertain after new owner claim retains evidence; never overwrites live owner',()=>{
 const fx=fixture();try{
  const result=swapOrphanLeaseInTemp({...request(fx),
   injectFailure:'AFTER_NEW_RENAMED'});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(JSON.parse(readOwner(fx)).pid,9000);
  assert.equal(result.runnerStops,0);
  assert.equal(result.runnerStarts,0);
  const original=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once',
   'old-supervisor','owner.json');
  assert.equal(fs.readFileSync(original,'utf8'),fx.oldBytes);
  const duplicate=swapOrphanLeaseInTemp(request(fx));
  assert.equal(duplicate.status,'BLOCKED');
 }finally{fx.cleanup();}
});

test('isolated implementation does not run shell, kill process or modify external root',()=>{
 const src=fs.readFileSync(new URL('../tools/supervisor-orphan-lease-temp-fixture.mjs',
  import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bspawn\s*\(|\bexecFileSync\s*\(|\bkill\s*\(|taskkill|Stop-Process|Get-CimInstance|workflow_dispatch|process\.env/);
 assert.match(src,/zgmini-orphan-fixture-/);
 assert.match(src,/sourceOnlyFixture:true/);
 assert.match(src,/operatingEffectAuthorized:false/);
});


test('immutable phase witnesses and latest journal distinguish successful handoff from initial PREPARED',()=>{
 const fx=fixture();try{
  const result=swapOrphanLeaseInTemp(request(fx));
  assert.equal(result.status,'ISOLATED_SWAPPED');
  const claim=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once');
  const phases=['PREPARED','OLD_ARCHIVE_PENDING','OLD_ARCHIVED',
   'NEW_OWNER_PENDING','NEW_OWNER_CLAIMED','POSTCHECK_PASS'];
  for(const phase of phases){
   const record=JSON.parse(fs.readFileSync(path.join(claim,'phase-'+phase+'.json'),'utf8'));
   assert.equal(record.phase,phase);
   assert.equal(record.ownerSha256,fx.expected.ownerSha256);
   assert.doesNotMatch(JSON.stringify(record),/11111111-2222|9000|4242/);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(claim,'journal.json'),'utf8')).phase,
   'POSTCHECK_PASS');
  assert.equal(fs.readdirSync(claim).filter(x=>x.startsWith('phase-')).length,6);
 }finally{fx.cleanup();}
});

test('rollback after old archive is journaled and never reuses its durable claim',()=>{
 const fx=fixture();try{
  const result=swapOrphanLeaseInTemp({...request(fx),
   injectFailure:'AFTER_OLD_RENAMED'});
  assert.equal(result.status,'ISOLATED_ROLLED_BACK');
  const claim=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once');
  for(const phase of ['OLD_ARCHIVED','OLD_RESTORE_PENDING','OLD_RESTORED'])
   assert.equal(JSON.parse(fs.readFileSync(
    path.join(claim,'phase-'+phase+'.json'),'utf8')).phase,phase);
  assert.equal(JSON.parse(fs.readFileSync(path.join(claim,'journal.json'),'utf8')).phase,
   'OLD_RESTORED');
  assert.equal(readOwner(fx),fx.oldBytes);
  assert.equal(swapOrphanLeaseInTemp(request(fx)).code,
   'ORPHAN_TEMP_CLAIM_REUSED_NO_RETRY');
 }finally{fx.cleanup();}
});

test('after old archive any host or heartbeat CAS change prevents rollback',()=>{
 for(const target of ['host.json','SUPERVISOR_STATUS.json']){
  const fx=fixture();try{
   let drifted=false;
   const filesystem=Object.create(fs);
   filesystem.renameSync=(src,dst)=>{
    fs.renameSync(src,dst);
    if(path.basename(dst)==='old-supervisor'){
     fs.writeFileSync(path.join(fx.control,target),
      JSON.stringify({simulated:'DRIFT'})+'\n');
     drifted=true;
    }
   };
   const before=fs.readFileSync(path.join(fx.control,target),'utf8');
   const result=swapOrphanLeaseInTemp({...request(fx),filesystem,
    injectFailure:'AFTER_OLD_RENAMED'});
   assert.equal(drifted,true);
   assert.equal(result.status,'RECOVERY_REQUIRED',target);
   assert.notEqual(fs.readFileSync(path.join(fx.control,target),'utf8'),before);
   assert.equal(fs.existsSync(fx.lease),false);
   const claim=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once');
   assert.equal(fs.readFileSync(path.join(claim,'old-supervisor','owner.json'),'utf8'),
    fx.oldBytes);
   assert.equal(JSON.parse(fs.readFileSync(path.join(claim,'journal.json'),'utf8')).phase,
    'RECOVERY_REQUIRED');
  }finally{fx.cleanup();}
 }
});

test('new unrelated lease after old archive blocks rollback, leaves original evidence',()=>{
 const fx=fixture();try{
  const filesystem=Object.create(fs);
  filesystem.renameSync=(src,dst)=>{
   fs.renameSync(src,dst);
   if(path.basename(dst)==='old-supervisor')
    fs.mkdirSync(path.join(fx.control,'leases','request-racing'));
  };
  const result=swapOrphanLeaseInTemp({...request(fx),filesystem,
   injectFailure:'AFTER_OLD_RENAMED'});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(fs.existsSync(fx.lease),false);
  assert.equal(fs.readFileSync(path.join(fx.root,
   'orphan-claim-orphan-temp-proof-20261127-once','old-supervisor',
   'owner.json'),'utf8'),fx.oldBytes);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fx.root,
   'orphan-claim-orphan-temp-proof-20261127-once','journal.json'),'utf8')).phase,
   'RECOVERY_REQUIRED');
 }finally{fx.cleanup();}
});

test('old Owner identity and live new Owner must still match directly before handoff',()=>{
 for(const key of ['old','new']){
  const fx=fixture();try{
   let count=0;
   const q=request(fx);
   q.oldPidAlive=()=>key==='old'&&++count>=2?true:false;
   q.newPidAlive=()=>key==='new'&&++count>=2?false:true;
   const result=swapOrphanLeaseInTemp(q);
   assert.equal(result.status,'BLOCKED');
   assert.equal(result.code,'ORPHAN_TEMP_SECOND_CAS_OR_LIVENESS_CHANGED');
   assert.equal(readOwner(fx),fx.oldBytes);
   const claim=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once');
   assert.equal(JSON.parse(fs.readFileSync(path.join(claim,'journal.json'),'utf8')).phase,
    'PREPARED');
  }finally{fx.cleanup();}
 }
});

test('after new owner claim unknown phase never automatically restores old owner',()=>{
 const fx=fixture();try{
  const result=swapOrphanLeaseInTemp({...request(fx),
   injectFailure:'AFTER_NEW_RENAMED'});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  const claim=path.join(fx.root,'orphan-claim-orphan-temp-proof-20261127-once');
  assert.equal(JSON.parse(fs.readFileSync(path.join(claim,'journal.json'),'utf8')).phase,
   'RECOVERY_REQUIRED');
  assert.equal(JSON.parse(readOwner(fx)).pid,9000);
  assert.equal(fs.existsSync(path.join(claim,'old-supervisor','owner.json')),true);
 }finally{fx.cleanup();}
});
