import test from 'node:test';
import assert from 'node:assert/strict';
import {TARGET,PREIMAGE,SCHEMA,sha256,validateManifest,verifyObservation,
 applyOneFile} from './contract.mjs';
const before=Buffer.from('old approved source');
const after=Buffer.from('new independently approved source');
const S='a'.repeat(40), H='b'.repeat(64);
const manifest=()=>({schema:SCHEMA,status:'APPROVED_B',
 requestId:'8f265fcb-45b7-43b8-acd2-40976524db91',target:TARGET,
 beforeSha256:PREIMAGE,afterSha256:sha256(after),
 approvedContentSha256:sha256(after),approvedSourceSha:S,installedHead:S,
 installedConfigSource:S,taskDefinitionSha256:H,wrapperSha256:H,
 allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
 allowTaskChanges:false,runCount:1});
const observed=m=>({target:TARGET,regularFile:true,realPathMatches:true,
 beforeSha256:m.beforeSha256,head:m.installedHead,
 configSource:m.installedConfigSource,
 taskDefinitionSha256:m.taskDefinitionSha256,wrapperSha256:m.wrapperSha256,
 active:false,leaseOwned:true,sharedInstallLockOwned:true,
 sourceApproved:true});
const stop=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('only exact fixed file and exact fields authorized',()=>{
 const m=manifest();assert.equal(validateManifest(m),m);
 stop(()=>validateManifest({...m,target:'E:\\ZGmini\\data\\pc-writer\\config.json'}),'SIDECAR_B_SCOPE_STOP');
 stop(()=>validateManifest({...m,allowTaskChanges:true}),'SIDECAR_B_SCOPE_STOP');
 stop(()=>validateManifest({...m,runCount:2}),'SIDECAR_B_SCOPE_STOP');
 stop(()=>validateManifest({...m,extra:true}),'SIDECAR_B_FIELDS_STOP');
});
test('preimage, source, Task, real path, activity and lease are independent stops',()=>{
 const m=manifest(),o=observed(m);
 for(const [key,value,code] of [
  ['beforeSha256','0'.repeat(64),'SIDECAR_B_PREIMAGE_STOP'],
  ['head','f'.repeat(40),'SIDECAR_B_LINEAGE_STOP'],
  ['sourceApproved',false,'SIDECAR_B_LINEAGE_STOP'],
  ['taskDefinitionSha256','f'.repeat(64),'SIDECAR_B_LINEAGE_STOP'],
  ['realPathMatches',false,'SIDECAR_B_PATH_STOP'],
  ['active',true,'SIDECAR_B_RESOURCE_STOP'],
  ['leaseOwned',false,'SIDECAR_B_RESOURCE_STOP'],
  ['sharedInstallLockOwned',false,'SIDECAR_B_RESOURCE_STOP']
 ])stop(()=>verifyObservation(m,{...o,[key]:value}),code);
});
function adapter(m,{badReadback=false,failReplace=false}={}){
 const events=[];let current=m.beforeSha256;
 return {events,
  async acquire(){events.push('acquire');},
  async observe(){events.push('observe');return observed(m);},
  async claimOnce(){events.push('claim');},
  async backup(){events.push('backup');},
  async atomicReplace(){events.push('replace');if(failReplace)throw Error('disk');
   current=badReadback?'f'.repeat(64):m.afterSha256;},
  async readbackSha256(){events.push('readback');return current;},
  async restoreBackup(){events.push('restore');current=m.beforeSha256;},
  async release(){events.push('release');}
 };
}
test('applies with exact readback and releases lock',async()=>{
 const m=manifest(),io=adapter(m);
 const r=await applyOneFile(m,after,io);
 assert.equal(r.status,'APPLIED_SOURCE_ONLY');
 assert.deepEqual(io.events,['acquire','observe','claim','backup','observe',
  'replace','readback','release']);
});
test('hash mismatch causes no PC acquisition',async()=>{
 const m=manifest(),io=adapter(m);
 await assert.rejects(applyOneFile(m,before,io),e=>e.code==='SIDECAR_B_CANDIDATE_HASH_STOP');
 assert.deepEqual(io.events,[]);
});
test('changed PC state fails before claim/backup',async()=>{
 const m=manifest(),io=adapter(m);
 io.observe=async()=>({...observed(m),active:true});
 await assert.rejects(applyOneFile(m,after,io),e=>e.code==='SIDECAR_B_RESOURCE_STOP');
 assert.deepEqual(io.events,['acquire','release']);
});
test('readback mismatch rolls back and verifies original',async()=>{
 const m=manifest(),io=adapter(m,{badReadback:true});
 await assert.rejects(applyOneFile(m,after,io),e=>e.code==='SIDECAR_B_READBACK_STOP');
 assert.deepEqual(io.events.slice(-4),['readback','restore','readback','release']);
});
test('replacement failure restores backup',async()=>{
 const m=manifest(),io=adapter(m,{failReplace:true});
 await assert.rejects(applyOneFile(m,after,io),/disk/);
 assert.ok(io.events.includes('restore'));
});
test('unverified rollback never reports success',async()=>{
 const m=manifest(),io=adapter(m,{badReadback:true});
 io.restoreBackup=async()=>{throw Error('backup lost');};
 await assert.rejects(applyOneFile(m,after,io),e=>e.code==='SIDECAR_B_RECOVERY_UNVERIFIED_STOP');
 assert.equal(io.events.at(-1),'release');
});

test('installed R3 after-image cannot replay original one-file B request',async()=>{
 const m=manifest(),io=adapter(m);
 const alreadyInstalledR3='583297b451f168a32a2a5de4b0b04c9b14449aab9a041c954a420203cf04f188';
 assert.notEqual(alreadyInstalledR3,PREIMAGE);
 io.observe=async()=>({...observed(m),beforeSha256:alreadyInstalledR3});
 await assert.rejects(applyOneFile(m,after,io),e=>e.code==='SIDECAR_B_PREIMAGE_STOP');
 assert.deepEqual(io.events,['acquire','release']);
});
test('operational approved source mismatch independently prevents B claim',async()=>{
 const m=manifest(),io=adapter(m);
 const operationalApprovedSource='d8ac245003e7b8e006c2345382d5c639c6d5f18b';
 assert.notEqual(operationalApprovedSource,m.installedConfigSource);
 io.observe=async()=>({...observed(m),configSource:operationalApprovedSource});
 await assert.rejects(applyOneFile(m,after,io),e=>e.code==='SIDECAR_B_LINEAGE_STOP');
 assert.deepEqual(io.events,['acquire','release']);
});
