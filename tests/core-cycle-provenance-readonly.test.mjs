import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectStoredCoreCycleEvidence,verifyStoredCoreCycle} from '../controller/core-cycle-provenance-readonly.mjs';
import {inspectCoreRuntimeSource} from '../controller/core-runtime-source-readonly.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
const t=Date.UTC(2026,10,21,7,45,0),source='a'.repeat(40);
const id='12345678-1234-4234-8234-123456789abc';
function fixture(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-092-stored-'));
 const dataRoot=path.join(temp,'pc-writer'),checkoutRoot=path.join(temp,'checkout');
 const src=path.join(checkoutRoot,'scripts','pc-writer');
 fs.mkdirSync(dataRoot,{recursive:true});fs.mkdirSync(src,{recursive:true});
 const names=['local-cycle.mjs','core-cycle-id.mjs','core-origin-runtime.mjs','core-origin-wmi.mjs'];
 const hashes={};
 for(const name of names){const bytes=Buffer.from('approved '+name);
  hashes[name]=sha(bytes);fs.writeFileSync(path.join(src,name),bytes);}
 const date=n=>new Date(n).toISOString();
 const core={at:date(t-30_000),lane:'core',coreCycleId:id,
  coreCycleStartedAt:date(t-180_000),coreCheckoutSourceSha:source,
  coreEntrypointSha256:hashes['local-cycle.mjs'],
  coreProofFileSha256:Object.fromEntries(names.slice(1).map(x=>[x,hashes[x]])),
  coreOriginEvidence:'TASK_ENGINE_WMI_CAPTURED_AT_START',
  coreOriginCode:'CORE_TASK_ENGINE_CAPTURED_AT_START',
  coreNodeCreatedAtMs:t-180_200};
 const collector={at:date(t-120_000),coreCycleId:id,status:'COMPLETE'};
 const writer={at:date(t-60_000),coreCycleId:id,source,status:'VERIFIED',mode:'PUBLISH'};
 const save=(file,obj)=>fs.writeFileSync(path.join(dataRoot,file),JSON.stringify(obj));
 save('config.json',{source,token:'secret-never-output'});
 save('local-cycle-last-run.json',core);
 save('local-collection-last-run.json',collector);
 save('local-writer-last-run.json',writer);
 return {temp,src,dataRoot,checkoutRoot,core,collector,writer,save,hashes};
}
test('valid finished cycle binds task at source start to exact installed bytes, collection and Writer',()=>{
 const f=fixture();
 try{
  const out=inspectStoredCoreCycleEvidence({dataRoot:f.dataRoot,checkoutRoot:f.checkoutRoot,now:t});
  assert.equal(out.status,'PASS');
  assert.equal(out.runtimeSourceVerified,true);
  assert.equal(out.activeCoreSourceVerified,false);
  assert.equal(out.evidenceLevel,'NATURAL_TASK_ENGINE_WMI_CAPTURE_AND_SAVED_CYCLE_CROSSCHECK');
  assert.equal(out.sourceSha,source);
  assert.doesNotMatch(JSON.stringify(out),/secret|token|coreProcessPid|coreParentPid/i);
 }finally{fs.rmSync(f.temp,{recursive:true,force:true});}
});
test('missing Task origin, cross-cycle mismatch, stale evidence and source mismatch stay UNKNOWN',()=>{
 const f=fixture();try{
  const base={cycle:f.core,collection:f.collector,writer:f.writer,
   approvedSource:source,installedHashes:f.hashes,now:t};
  for(const mutated of [
   {cycle:{...f.core,coreOriginEvidence:'SELF_RECORDED_NOT_TASK_ATTESTED'}},
   {cycle:{...f.core,coreOriginCode:'OTHER'}},
   {cycle:{...f.core,coreNodeCreatedAtMs:t-240_000}},
   {cycle:{...f.core,coreCycleId:'invalid'}},
   {collection:{...f.collector,coreCycleId:'other'}},
   {writer:{...f.writer,source:'b'.repeat(40)}},
   {now:t+2*3600000},
   {installedHashes:{...f.hashes,'core-origin-wmi.mjs':'c'.repeat(64)}},
  ]){
   const out=verifyStoredCoreCycle({...base,...mutated});
   assert.equal(out.status,'STATE_UNKNOWN',JSON.stringify(mutated).slice(0,95));
   assert.equal(out.runtimeSourceVerified,false);
  }
 }finally{fs.rmSync(f.temp,{recursive:true,force:true});}
});
test('symlink escape and changed/missing source bytes never turn into proof',()=>{
 const f=fixture();try{
  const m=path.join(f.src,'core-origin-wmi.mjs');
  fs.unlinkSync(m);
  let symlinkCreated=false;
  try{fs.symlinkSync(path.join(f.dataRoot,'config.json'),m,'file');symlinkCreated=true;}
  catch(e){if(!['EPERM','EACCES','ENOTSUP'].includes(e.code))throw e;}
  if(symlinkCreated){
   assert.equal(inspectStoredCoreCycleEvidence({dataRoot:f.dataRoot,checkoutRoot:f.checkoutRoot,now:t}).status,'STATE_UNKNOWN');
   fs.unlinkSync(m);
  }
  fs.writeFileSync(m,'tampered-source');
  assert.equal(inspectStoredCoreCycleEvidence({dataRoot:f.dataRoot,checkoutRoot:f.checkoutRoot,now:t}).status,'STATE_UNKNOWN');
 }finally{fs.rmSync(f.temp,{recursive:true,force:true});}
});
test('live not-running snapshot may use valid captured cycle, not invent an active Task',()=>{
 const fake={ok:true,engines:[],processes:[],taskStateBefore:3,taskStateAfter:3,
  runningInstances:0};
 const f=fixture();try{
  const origin=()=>inspectStoredCoreCycleEvidence({dataRoot:f.dataRoot,checkoutRoot:f.checkoutRoot,now:t});
  const got=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
   probe:()=>({status:0,stdout:JSON.stringify(fake)}),
   readLock:()=>({state:'ABSENT'}),recentCycleReader:origin});
  assert.equal(got.status,'PASS');
  assert.equal(got.code,'CORE_RECENT_RUNTIME_SOURCE_VERIFIED');
  assert.equal(got.activeCoreSourceVerified,false);
  assert.equal(got.liveSnapshot.code,'CORE_TASK_NOT_RUNNING_AT_SNAPSHOT');
  assert.equal(got.lockOwner.status,'ABSENT');
 }finally{fs.rmSync(f.temp,{recursive:true,force:true});}
});
test('a bad or absent stored cycle does not override UNKNOWN from live snapshot',()=>{
 const snap={ok:true,engines:[],processes:[],taskStateBefore:3,taskStateAfter:3,runningInstances:0};
 const got=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
   probe:()=>({status:0,stdout:JSON.stringify(snap)}),
   readLock:()=>({state:'ABSENT'}),recentCycleReader:()=>({status:'STATE_UNKNOWN',code:'NO_VALID_SOURCE'})});
 assert.equal(got.status,'STATE_UNKNOWN');
 assert.equal(got.runtimeSourceVerified,false);
 assert.equal(got.recentCycleEvidence.code,'NO_VALID_SOURCE');
});
