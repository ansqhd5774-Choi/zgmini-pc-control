import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectOrphanOwnerPreimage,inspectOrphanOwnerPreimageReadonly}
 from '../tools/supervisor-orphan-owner-preimage-readonly.mjs';

const owner={pid:4242,nonce:'11111111-2222-4333-8444-555555555555',
 bootAt:1000000,at:'2026-11-26T23:12:00Z'};
const host={controllerSourceSha:'a'.repeat(40),controllerFiles:{
 'controller/entry.mjs':'f'.repeat(64)}};
const heartbeat={pid:4242,sourceSha:host.controllerSourceSha,mode:'LISTENING',
 at:'2026-11-26T23:17:50Z',
 children:Array.from({length:6},(_,i)=>({seat:i+1,pid:5000+i,alive:true}))};
const bytes=o=>Buffer.from(JSON.stringify(o));
function valid(){
 const a=bytes(owner),b=bytes(host),c=bytes(heartbeat);
 return {ownerBytes:a,hostBytes:b,heartbeatBytes:c,
  secondOwnerBytes:Buffer.from(a),secondHostBytes:Buffer.from(b),
  secondHeartbeatBytes:Buffer.from(c),relatedLeaseNames:['supervisor'],
  installLeaseHeld:false,pidProbe:()=>false,
  now:Date.parse('2026-11-26T23:18:10Z'),bootAt:1000000};
}

test('stable private owner CAS emits hashes, no PID or nonce',()=>{
 const r=projectOrphanOwnerPreimage(valid());
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'ORPHAN_OWNER_CAS_PREIMAGE_OBSERVED');
 assert.match(r.ownerRecordSha256,/^[0-9a-f]{64}$/);
 assert.match(r.hostManifestSha256,/^[0-9a-f]{64}$/);
 assert.match(r.heartbeatSha256,/^[0-9a-f]{64}$/);
 assert.equal(r.oldOwnerDeadVerified,true);
 assert.equal(r.bootEpochMatch,true);
 assert.equal(r.sixHistoricalSeatsVerified,true);
 assert.equal(r.relatedLeaseCount,0);
 assert.equal(r.preimageStable,true);
 assert.equal(r.effectAuthorized,false);
 assert.equal(r.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(r),/11111111|4242|5000|E:\\ZGmini/);
});

test('changed raw owner, host or heartbeat between reads is rejected',()=>{
 for(const k of ['secondOwnerBytes','secondHostBytes','secondHeartbeatBytes']){
  const v=valid();v[k]=bytes({drift:'changed'});
  const r=projectOrphanOwnerPreimage(v);
  assert.equal(r.status,'STATE_UNKNOWN',k);
  assert.equal(r.ownerRecordSha256,null);
 }
});

test('dead PID, boot and historical six seats remain independently reported',()=>{
 const cases=[
  [v=>v.pidProbe=()=>true,'oldOwnerDeadVerified',false],
  [v=>v.bootAt+=25000,'bootEpochMatch',false],
  [v=>{const a={...heartbeat,children:heartbeat.children.slice(0,5)};
   v.heartbeatBytes=bytes(a);v.secondHeartbeatBytes=bytes(a);},
   'sixHistoricalSeatsVerified',false],
  [v=>{const a={...heartbeat,pid:6666};
   v.heartbeatBytes=bytes(a);v.secondHeartbeatBytes=bytes(a);},
   'ownerHeartbeatIdentityMatch',false],
  [v=>{v.relatedLeaseNames.push('request-inflight');},'relatedLeaseCount',1],
  [v=>{v.installLeaseHeld=true;},'installLeaseHeld',true]
 ];
 for(const [change,key,result] of cases){
  const v=valid();change(v);const r=projectOrphanOwnerPreimage(v);
  assert.equal(r.status,'PASS');
  assert.equal(r[key],result);
  assert.equal(r.effectAuthorized,false);
 }
});

test('invalid nonce shape, PID, JSON or read contract fails closed',()=>{
 const cases=[
  v=>{const a=bytes({...owner,nonce:'bad'});v.ownerBytes=a;v.secondOwnerBytes=a;},
  v=>{const a=bytes({...owner,pid:null});v.ownerBytes=a;v.secondOwnerBytes=a;},
  v=>{v.ownerBytes=Buffer.from('not json');v.secondOwnerBytes=Buffer.from('not json');},
  v=>{v.pidProbe=()=>null;},
  v=>{v.installLeaseHeld=null;},
  v=>{v.relatedLeaseNames=[];v.relatedLeaseNames.push('../unsafe');v.relatedLeaseNames[0]='x'.repeat(300);},
 ];
 for(let i=0;i<cases.length;i++){
  const v=valid();cases[i](v);const r=projectOrphanOwnerPreimage(v);
  assert.equal(r.status,'STATE_UNKNOWN','case '+i);
  assert.equal(r.effectAuthorized,false);
 }
});

test('only canonical Windows PC and three fixed files are read twice',()=>{
 const values=[
  bytes(owner),bytes(host),bytes(heartbeat)
 ];
 let count=0;
 const fake={
  lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:300}),
  readFileSync:p=>{count++;return values[['owner.json','host.json',
   'SUPERVISOR_STATUS.json'].findIndex(n=>p.endsWith(n))];},
  readdirSync:()=>['supervisor'],
  existsSync:()=>false
 };
 const result=inspectOrphanOwnerPreimageReadonly({
  filesystem:fake,platform:'win32',hostname:'PC',
  currentBootAt:1000000,pidProbe:()=>false,
  now:Date.parse('2026-11-26T23:18:10Z')
 });
 assert.equal(result.status,'PASS');
 assert.equal(count,6);
 for(const bad of [
  {platform:'linux',hostname:'PC'},
  {platform:'win32',hostname:'OTHER'}
 ]){
  const r=inspectOrphanOwnerPreimageReadonly({...bad,
   filesystem:{lstatSync:()=>{throw Error('must not read');}}});
  assert.equal(r.status,'STATE_UNKNOWN');
 }
});

test('read-only CAS source has no mutable process, lease, DB or network calls',()=>{
 const txt=fs.readFileSync(new URL('../tools/supervisor-orphan-owner-preimage-readonly.mjs',
  import.meta.url),'utf8');
 assert.doesNotMatch(txt,/\bspawn\s*\(|\bexecFileSync\s*\(|\bwriteFileSync\s*\(|unlinkSync|renameSync|mkdirSync|taskkill|workflow_dispatch/);
 assert.match(txt,/process\.kill\(pid,0\)/); // signal zero checks liveness only
 assert.match(txt,/leaseMutationAuthorized:false/);
 assert.match(txt,/effectAuthorized:false/);
});
