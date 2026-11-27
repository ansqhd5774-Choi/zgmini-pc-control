import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectOrphanSixBirthBoundReadonly as inspect}
 from '../tools/supervisor-orphan-six-birth-bound-readonly.mjs';
import {projectPrivateOrphanWmiEvidence}
 from '../tools/supervisor-orphan-private-wmi.mjs';

const sum=b=>createHash('sha256').update(b).digest('hex');
const oldAt='2026-11-26T23:30:00.000Z';
const currentAt='2026-11-27T01:00:00.000Z';
const source='a'.repeat(40);
const hb={pid:3300,at:oldAt,sourceSha:source,mode:'LISTENING',
 children:Array.from({length:6},(_,i)=>({seat:i+1,pid:4300+i,alive:true}))};
const bytes=Buffer.from(JSON.stringify(hb)+'\n');
const expected={ownerSha256:'b'.repeat(64),hostSha256:'c'.repeat(64),
 heartbeatSha256:sum(bytes)};
const root='E:\\ZGmini\\automation\\pc-control';
const p=seat=>root+'\\runners\\'+String(seat).padStart(2,'0')+
 '\\bin\\Runner.Listener.exe';
const rows=()=>[
 ...Array.from({length:6},(_,i)=>({
  name:'Runner.Listener.exe',pid:5501+i,sessionId:1,
  startedAtUtc:'2026-11-26T23:05:00.000Z',
  executablePath:p(i+1),serviceAncestor:false,
  serviceObservationAvailable:true
 })),
 {name:'Runner.Listener.exe',pid:6001,sessionId:0,
  startedAtUtc:'2026-11-26T22:00:00.000Z',
  executablePath:'',serviceAncestor:true,serviceObservationAvailable:true}
];
function fixtures(){
 let sourceBytes=Buffer.from(bytes),preimages=0,wmi=0,reads=0;
 let mutateWmi=null;
 const filesystem={
  lstatSync:file=>{
   assert.equal(path.basename(file),'SUPERVISOR_STATUS.json');
   return {isFile:()=>true,isSymbolicLink:()=>false,
    nlink:1,size:sourceBytes.length};
  },
  readFileSync:file=>{
   assert.equal(path.basename(file),'SUPERVISOR_STATUS.json');
   reads++;return Buffer.from(sourceBytes);
  }
 };
 const inspectPreimage=()=>{
  preimages++;
  return {status:'PASS',preimageStable:true,oldOwnerDeadVerified:true,
   bootEpochMatch:true,sixHistoricalSeatsVerified:true,
   ownerHeartbeatIdentityMatch:true,existingOwnerNonceWellFormed:true,
   ownerRecordSha256:expected.ownerSha256,
   hostManifestSha256:expected.hostSha256,
   heartbeatSha256:expected.heartbeatSha256};
 };
 const captureWmi=({originalHeartbeatAt,originalSeatPins})=>{
  assert.equal(originalHeartbeatAt,oldAt);wmi++;
  let scoped=rows();
  if(mutateWmi)scoped=mutateWmi(scoped,wmi);
  return projectPrivateOrphanWmiEvidence(scoped,{
   controllerRoot:root,canonicalize:s=>s,
   originalHeartbeatAt,originalSeatPins:originalSeatPins??null,
   observedAt:currentAt
  });
 };
 const run=()=>inspect({expected,filesystem,inspectPreimage,captureWmi});
 return {run,filesystem,
  counts:()=>({reads,preimages,wmi}),
  changeHeartbeat:b=>{sourceBytes=Buffer.from(b);},
  mutateWmi:fn=>{mutateWmi=fn;},
  inspectPreimage,captureWmi
 };
}
test('six original-age listeners in two private WMI reads produce only sanitized A observation',()=>{
 const f=fixtures(),x=f.run();
 assert.equal(x.status,'PASS');
 assert.equal(x.code,'ORPHAN_SIX_WMI_BIRTH_PREHEARTBEAT_TWO_OBSERVATIONS');
 assert.equal(x.exactSeatCount,6);
 assert.equal(x.allSixOlderThanOriginalHeartbeat,true);
 assert.equal(x.twoSnapshotSeatIdentityStable,true);
 assert.deepEqual(f.counts(),{reads:2,preimages:2,wmi:2});
 for(const k of ['privateOriginalLaunchProven','nonceInheritanceVerified',
  'adoptionAuthorized','effectAuthorized','supervisorSpawnAuthorized',
  'leaseMutationAuthorized','runnerStopAuthorized','heartbeatWriteAuthorized',
  'nonceExposed','processIdsExposed','processBirthsExposed','pathsExposed'])
  assert.equal(x[k],false,k);
 assert.equal(x.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(x),/5501|6001|Runner.Listener.exe|23:05|23:30|E:\\|b{64}|c{64}/);
});

test('six-seat birth count is not original launcher, nonce or B Owner authority',()=>{
 const x=fixtures().run();
 assert.equal(x.scope,'TWO_PRIVATE_WMI_OBSERVATIONS_NOT_ORIGINAL_LAUNCH_PROOF');
 assert.equal(x.privateOriginalLaunchProven,false);
 assert.equal(x.nonceInheritanceVerified,false);
 assert.equal(x.adoptionAuthorized,false);
 assert.equal(x.effectAuthorized,false);
});

test('wrong or absent originally approved raw-byte SHA fails before any WMI',()=>{
 for(const input of [
  {ownerSha256:'0'.repeat(64),hostSha256:expected.hostSha256,
   heartbeatSha256:expected.heartbeatSha256},
  {ownerSha256:expected.ownerSha256,hostSha256:'0'.repeat(64),
   heartbeatSha256:expected.heartbeatSha256},
  {ownerSha256:expected.ownerSha256,hostSha256:expected.hostSha256,
   heartbeatSha256:'0'.repeat(64)},
  {},null
 ]){
  const f=fixtures();
  const x=inspect({expected:input,filesystem:f.filesystem,
   inspectPreimage:f.inspectPreimage,captureWmi:f.captureWmi});
  assert.equal(x.status,'STATE_UNKNOWN');
  assert.equal(f.counts().wmi,0);
 }
});

test('status file drift, malformed heartbeat, or tampered second read fails closed',()=>{
 for(const kind of ['drift','invalid','second']){
  const f=fixtures();
  if(kind==='drift')f.changeHeartbeat(Buffer.from('x'.repeat(bytes.length)));
  if(kind==='invalid'){
   const data={...hb,children:[]};
   const body=Buffer.from(JSON.stringify(data)+'\n');
   const e={...expected,heartbeatSha256:sum(body)};
   f.changeHeartbeat(body);
   const x=inspect({expected:e,filesystem:f.filesystem,
    inspectPreimage:()=>({...f.inspectPreimage(),heartbeatSha256:e.heartbeatSha256}),
    captureWmi:f.captureWmi});
   assert.equal(x.status,'STATE_UNKNOWN');
   assert.equal(f.counts().wmi,0);continue;
  }
  if(kind==='second')f.mutateWmi((arr,n)=>n===1?(f.changeHeartbeat(
   Buffer.from('y'.repeat(bytes.length))),arr):arr);
  const x=f.run();
  assert.equal(x.status,'STATE_UNKNOWN');
  assert.equal(x.adoptionAuthorized,false);
 }
});

test('different Listener birth or seat identity between independent observations is rejected',()=>{
 for(const alter of [
  arr=>{arr[0].pid+=777;},
  arr=>{arr[0].startedAtUtc='2026-11-26T23:10:00.000Z';},
  arr=>{arr[0].executablePath=p(2);},
  arr=>{arr.splice(0,1);}
 ]){
  const f=fixtures();
  f.mutateWmi((arr,n)=>{
   if(n===2)alter(arr);return arr;
  });
  const x=f.run();
  assert.equal(x.status,'STATE_UNKNOWN');
  assert.equal(x.code,'ORPHAN_SIX_BIRTH_PRIVATE_WMI_SECOND_CHANGED');
 }
});

test('late-created Listener after historical heartbeat never counts as original continuity',()=>{
 const f=fixtures();
 f.mutateWmi(arr=>{
  arr[0].startedAtUtc='2026-11-26T23:40:00.000Z';
  return arr;
 });
 const x=f.run();
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'ORPHAN_SIX_BIRTH_PRIVATE_WMI_FIRST_UNVERIFIED');
 assert.equal(f.counts().wmi,1);
});

test('old owner life/boot/source condition and incomplete historical seats prevent WMI',()=>{
 for(const flag of ['oldOwnerDeadVerified','bootEpochMatch',
  'sixHistoricalSeatsVerified','ownerHeartbeatIdentityMatch']){
  const f=fixtures();
  const x=inspect({expected,filesystem:f.filesystem,
   inspectPreimage:()=>({...f.inspectPreimage(),[flag]:false}),
   captureWmi:f.captureWmi});
  assert.equal(x.code,'ORPHAN_SIX_BIRTH_OWNER_PREIMAGE_UNVERIFIED');
  assert.equal(f.counts().wmi,0);
 }
});

test('read-only source never spawns, kills, writes, or serializes private WMI rows',()=>{
 const src=fs.readFileSync(new URL('../tools/supervisor-orphan-six-birth-bound-readonly.mjs',import.meta.url),'utf8');
 assert.match(src,/readPrivateOrphanWmiEvidence/);
 assert.match(src,/originalSeatPins:pin.rows/);
 assert.doesNotMatch(src,/process\.kill|taskkill|Stop-Process|spawn\(|execFileSync|writeFileSync|renameSync|unlinkSync|console\.log/);
});
