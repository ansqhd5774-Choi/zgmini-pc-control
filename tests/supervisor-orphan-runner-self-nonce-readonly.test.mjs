import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
 assessOrphanRunnerSelfNonce as assess,
 inspectOrphanRunnerSelfNonceReadonly as inspect
} from '../tools/supervisor-orphan-runner-self-nonce-readonly.mjs';
import {assessNoSpawnMonitorSnapshot} from
 '../controller/orphan-no-spawn-monitor-contract.mjs';

// Mixed-case-capable synthetic UUID: digits-only UUIDs cannot test case drift.
const nonce='a1111111-b222-4333-8444-55555555c555';
const baseTime=Date.parse('2026-11-27T00:10:00Z');
const json=o=>Buffer.from(JSON.stringify(o)+'\n');
const sha=x=>createHash('sha256').update(x).digest('hex');
const host={controllerSourceSha:'a'.repeat(40),
 controllerFiles:{'controller/supervisor.mjs':'b'.repeat(64)}};
const owner={pid:4111,nonce,bootAt:baseTime-3600000,
 at:'2026-11-27T00:00:00Z'};
const heartbeat={pid:4111,sourceSha:host.controllerSourceSha,
 at:'2026-11-27T00:05:00Z',mode:'LISTENING',
 children:Array.from({length:6},(_,i)=>({
  seat:i+1,pid:5000+i,alive:true
 }))};
const env=()=>({
 GITHUB_ACTIONS:'true',
 GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 RUNNER_NAME:'zgmini-pc-01',
 ZGMINI_SUPERVISOR_NONCE:nonce
});
const fixture=()=>({
 hostBytes:json(host),ownerBytes:json(owner),statusBytes:json(heartbeat),
 env:env(),oldOwnerAlive:false,bootAt:owner.bootAt,now:baseTime
});
function request(){
 const x=fixture();
 return {...x,expected:{
  hostSha256:sha(x.hostBytes),
  ownerSha256:sha(x.ownerBytes),
  heartbeatSha256:sha(x.statusBytes)
 }};
}

test('current job self-env nonce equals pinned old owner, no inherited Listener proof',()=>{
 const x=assess(request());
 assert.equal(x.status,'OBSERVED');
 assert.equal(x.code,'RUNNER_SELF_NONCE_EQUALS_ORIGINAL_OWNER_ONLY');
 assert.equal(x.seat,1);
 assert.equal(x.nonceInheritanceVerified,false);
 assert.equal(x.sixRunnerLineageVerified,false);
 assert.equal(x.adoptionAuthorized,false);
 assert.equal(x.effectAuthorized,false);
 assert.equal(x.operationalWrites,0);
 assert.equal(x.runnerTerminationAuthorized,false);
 assert.equal(x.leaseMutationAuthorized,false);
 assert.doesNotMatch(JSON.stringify(x),/11111111|55555555|4111|5000|b{64}/);
 assert.deepEqual(Object.keys(x).sort(),[
 'schema','scope','status','code','seat','effectAuthorized',
 'adoptionAuthorized','sixRunnerLineageVerified',
 'nonceInheritanceVerified','leaseMutationAuthorized',
 'supervisorSpawnAuthorized','runnerTerminationAuthorized',
 'operationalWrites','providerCalls','d1Writes','nonceExposed'
 ].sort());
});

test('six individual job-context matches still do NOT prove the original six Listeners',()=>{
 const outputs=Array.from({length:6},(_,i)=>{
  const x=request();
  x.env.RUNNER_NAME='zgmini-pc-0'+(i+1);
  return assess(x);
 });
 assert.deepEqual(outputs.map(x=>x.seat),[1,2,3,4,5,6]);
 assert.equal(outputs.every(x=>x.status==='OBSERVED'),true);
 assert.equal(outputs.every(x=>x.sixRunnerLineageVerified===false),true);
 // The existing independent B preflight specifically REJECTS this weak
 // job-context observation as a substitute for live, authenticated lineage.
 const y=assessNoSpawnMonitorSnapshot({
  privateLineage:{
   source:'RUNNER_JOB_SELF_ENV_MATCH_ONLY_NOT_AUTHORIZED',
   inheritedNonceMatchesOldOwner:true,
   newOwnerNonceMatchesInherited:true,
   newOwnerNoSpawnSourceVerified:true,
   sixOriginalListenerBirthTimesPinned:true
  }
 });
 assert.equal(y.status,'BLOCKED');
 assert.equal(y.effectAuthorized,false);
});

test('wrong, malformed or absent inherited nonce fail without publishing bytes',()=>{
 for(const value of ['',null,undefined,'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
   'fake',nonce.toUpperCase()+'x']){
  const r=request();r.env.ZGMINI_SUPERVISOR_NONCE=value;
  const x=assess(r);
  assert.equal(x.status,'STATE_UNKNOWN');
  assert.equal(x.code,'RUNNER_SELF_PROCESS_NONCE_MISMATCH');
  assert.doesNotMatch(JSON.stringify(x),/11111111|4444-5555|4111/);
 }
});

test('nonce comparison is byte-exact like installed assertSupervisorOwner',()=>{
 assert.notEqual(nonce,nonce.toUpperCase(),'fixture must exercise ASCII case drift');
 const same=request();
 assert.equal(assess(same).status,'OBSERVED');

 // The real installed guard uses === on nonce strings, not normalized UUID
 // bytes. Accepting these would falsely certify an A job that stays BLOCKED.
 const upperEnv=request();
 upperEnv.env.ZGMINI_SUPERVISOR_NONCE=nonce.toUpperCase();
 assert.equal(assess(upperEnv).code,'RUNNER_SELF_PROCESS_NONCE_MISMATCH');

 const upperOwner=request();
 upperOwner.ownerBytes=json({...owner,nonce:nonce.toUpperCase()});
 upperOwner.expected.ownerSha256=sha(upperOwner.ownerBytes);
 assert.equal(assess(upperOwner).code,'RUNNER_SELF_PROCESS_NONCE_MISMATCH');

 const bothUpper=request();
 bothUpper.env.ZGMINI_SUPERVISOR_NONCE=nonce.toUpperCase();
 bothUpper.ownerBytes=json({...owner,nonce:nonce.toUpperCase()});
 bothUpper.expected.ownerSha256=sha(bothUpper.ownerBytes);
 assert.equal(assess(bothUpper).status,'OBSERVED');
});

test('wrong host/source/owner/heartbeat raw preimage is rejected before nonce',()=>{
 for(const kind of ['host','owner','heartbeat']){
  const r=request();
  const key=kind==='host'?'hostBytes':kind==='owner'?'ownerBytes':'statusBytes';
  r[key]=Buffer.concat([r[key],Buffer.from(' ')]);
  const x=assess(r);
  assert.equal(x.code,'RUNNER_SELF_PREIMAGE_RAW_CAS_CHANGED');
 }
 for(const field of ['hostSha256','ownerSha256','heartbeatSha256']){
  const r=request();r.expected[field]='f'.repeat(64);
  assert.equal(assess(r).code,'RUNNER_SELF_PREIMAGE_RAW_CAS_CHANGED');
 }
});

test('dead owner, current boot, and old supervisor identity are not guessed',()=>{
 for(const mutate of [
  r=>{r.oldOwnerAlive=true;},
  r=>{r.oldOwnerAlive=null;},
  r=>{r.bootAt+=15000;},
  r=>{r.ownerBytes=json({...owner,pid:-1});r.expected.ownerSha256=sha(r.ownerBytes);},
  r=>{r.ownerBytes=json({...owner,nonce:'invalid'});r.expected.ownerSha256=sha(r.ownerBytes);},
  r=>{r.hostBytes=json({...host,controllerSourceSha:null});r.expected.hostSha256=sha(r.hostBytes);},
  r=>{r.hostBytes=json({...host,controllerFiles:{}});r.expected.hostSha256=sha(r.hostBytes);}
 ]){
  const r=request();mutate(r);
  assert.equal(assess(r).code,'RUNNER_SELF_OLD_OWNER_OR_BOOT_UNVERIFIED');
 }
});

test('original Supervisor six-wrapper heartbeat must be complete, unique and past',()=>{
 for(const mutate of [
  h=>{h.pid++;},
  h=>{h.sourceSha='b'.repeat(40);},
  h=>{h.at='2026-11-27T00:20:00Z';},
  h=>{h.children=h.children.slice(0,5);},
  h=>{h.children[5]={...h.children[0]};},
  h=>{h.children[5].pid=h.children[0].pid;},
  h=>{h.children[2].alive=false;}
 ]){
  const r=request();const h=structuredClone(heartbeat);mutate(h);
  r.statusBytes=json(h);r.expected.heartbeatSha256=sha(r.statusBytes);
  assert.ok(['RUNNER_SELF_ORIGINAL_HEARTBEAT_UNVERIFIED',
   'RUNNER_SELF_ORIGINAL_SIX_WRAPPERS_UNVERIFIED']
   .includes(assess(r).code));
 }
});

test('GitHub Actions job context is observed but not authenticated inheritance',()=>{
 for(const mutate of [
  x=>{x.GITHUB_REPOSITORY='another/repository';},
  x=>{x.GITHUB_ACTIONS='false';},
  x=>{x.RUNNER_NAME='zgmini-pc-07';},
  x=>{x.RUNNER_NAME='zgmini-pc-1';},
  x=>{delete x.RUNNER_NAME;}
 ]){
  const r=request();mutate(r.env);
  assert.equal(assess(r).code,'RUNNER_SELF_JOB_CONTEXT_UNVERIFIED');
 }
});

test('inspector reads only three fixed PC files twice and emits sanitized result',()=>{
 const r=request(),readPaths=[],stats=[];
 const root='E:/ZGmini/automation/pc-control';
 const files=new Map([
  [path.join(root,'host.json'),r.hostBytes],
  [path.join(root,'leases/supervisor/owner.json'),r.ownerBytes],
  [path.join(root,'SUPERVISOR_STATUS.json'),r.statusBytes]
 ]);
 const filesystem={
  lstatSync:p=>{
   stats.push(p);
   const data=files.get(p);if(!data)throw Error('UNEXPECTED');
   return {isFile:()=>true,isSymbolicLink:()=>false,
    nlink:1,size:data.length};
  },
  readFileSync:p=>{
   readPaths.push(p);
   if(!files.has(p))throw Error('UNEXPECTED');
   return Buffer.from(files.get(p));
  }
 };
 const x=inspect({
  filesystem,env:r.env,platform:'win32',hostname:'PC',expected:r.expected,
  uptime:()=>3600,now:()=>baseTime,pidAlive:()=>false
 });
 assert.equal(x.status,'OBSERVED');
 assert.equal(x.seat,1);
 assert.equal(readPaths.length,6);
 assert.equal(stats.length,12);
 assert.deepEqual(new Set(readPaths),new Set([...files.keys()]));
 assert.doesNotMatch(JSON.stringify(x),/11111111|5000|4111/);
});

test('same-host private reader refuses noncanonical OS/host without reading anything',()=>{
 let reads=0;
 for(const override of [
  {platform:'linux',hostname:'PC'},
  {platform:'win32',hostname:'ANOTHER'},
  {platform:'win32',hostname:'PC',uptime:null}
 ]){
  const x=inspect({
   ...override,filesystem:{lstatSync:()=>{reads++;throw Error('NO');}},
   expected:request().expected
  });
  assert.equal(x.code,'RUNNER_SELF_CANONICAL_WINDOWS_HOST_REQUIRED');
 }
 assert.equal(reads,0);
});

test('time-of-check change across two reads never produces a positive observation',()=>{
 const r=request();
 const root='E:/ZGmini/automation/pc-control',paths={
  [path.join(root,'host.json')]:r.hostBytes,
  [path.join(root,'leases/supervisor/owner.json')]:r.ownerBytes,
  [path.join(root,'SUPERVISOR_STATUS.json')]:r.statusBytes
 };
 let statusReads=0;
 const filesystem={
  lstatSync:p=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1,
   size:paths[p].length}),
  readFileSync:p=>{
   if(p.endsWith('SUPERVISOR_STATUS.json')&&++statusReads===2)
    return Buffer.from('x'.repeat(paths[p].length));
   return Buffer.from(paths[p]);
  }
 };
 const x=inspect({
  filesystem,platform:'win32',hostname:'PC',
  env:r.env,expected:r.expected,uptime:()=>3600,now:()=>baseTime,
  pidAlive:()=>false
 });
 assert.equal(x.code,'RUNNER_SELF_PREIMAGE_CHANGED_DURING_READ');
});

test('symlink, hardlink, unstable read, and missing owner reject all evidence',()=>{
 const r=request(),root='E:/ZGmini/automation/pc-control';
 for(const mode of ['symlink','hardlink','missing','changed']){
  const bytes={
   [path.join(root,'host.json')]:r.hostBytes,
   [path.join(root,'leases/supervisor/owner.json')]:r.ownerBytes,
   [path.join(root,'SUPERVISOR_STATUS.json')]:r.statusBytes
  };
  const file=path.join(root,'leases/supervisor/owner.json');
  const filesystem={
   lstatSync:p=>{
    if(mode==='missing'&&p===file)throw Error('NOT_FOUND');
    const data=bytes[p];
    return {isFile:()=>true,
     isSymbolicLink:()=>p===file&&mode==='symlink',
     nlink:p===file&&mode==='hardlink'?2:1,size:data.length};
   },
   readFileSync:p=>{
    const data=bytes[p];
    return p===file&&mode==='changed'?Buffer.from('a'):Buffer.from(data);
   }
  };
  const x=inspect({filesystem,env:r.env,expected:r.expected,
   hostname:'PC',platform:'win32',uptime:()=>3600,
   now:()=>baseTime,pidAlive:()=>false});
  assert.equal(x.status,'STATE_UNKNOWN');
  assert.equal(x.code,'RUNNER_SELF_FIXED_READ_UNVERIFIED');
 }
});

test('read-only module contains no runner spawn, mutation, secret output or workflow bypass',()=>{
 const source=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-runner-self-nonce-readonly.mjs',
  import.meta.url),'utf8');
 assert.doesNotMatch(source,
  /\bspawn\s*\(|\bexecFileSync\s*\(|unlinkSync|renameSync|writeFileSync|mkdirSync|rmSync|rmdirSync|taskkill|Stop-Process|console\.log/);
 assert.match(source,/timingSafeEqual/);
 assert.match(source,/nonceExposed:false/);
 assert.match(source,/scope:'SELF_ENV_ONLY_NOT_LISTENER_INHERITANCE_PROOF'/);
});
