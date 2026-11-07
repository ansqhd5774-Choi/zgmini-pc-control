import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runApprovedRegistryCas,patchHostRuntimePinBytes,
 PIN_CAS_SCHEMA,PIN_CAS_SCOPE,RUNTIME_REGISTRY_SCHEMA}
 from './approved-registry-cas.mjs';
import {makeIsolatedRegistryPinAdapter,ISOLATED_FIXTURE_MARKER}
 from './isolated-registry-pin-adapter.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const REG='pc-writer/controller-approvals/approved-runtime-inventory-profiles.json';
const SOURCE='a'.repeat(40);

function setup({injectFailure=null,registryAbsent=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-b-pin-fixture-'));
 fs.writeFileSync(path.join(root,'SIMULATION_ONLY'),ISOLATED_FIXTURE_MARKER);
 fs.mkdirSync(path.join(root,'pc-writer','controller-approvals'),{recursive:true});
 const existing={id:'existing',binding:{sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:'b'.repeat(40)},
  rootSegments:['pc-writer','existing'],files:[],directories:[],tasks:[]};
 const beforeRegistry=registryAbsent?null:
  Buffer.from(JSON.stringify({schema:RUNTIME_REGISTRY_SCHEMA,profiles:[existing]}));
 const oldPin=beforeRegistry===null?null:hash(beforeRegistry);
 const host=Buffer.from('{\n  "token":"PRIVATE_KEEP_UNCHANGED",\n  "approvedRuntimeInventorySha256":'+
  JSON.stringify(oldPin)+'\n}\n');
 const profile={id:'themeTool',binding:{sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha:SOURCE},
  rootSegments:['pc-writer','theme-config-tool'],files:[],directories:[],tasks:[],
  bundleProfile:{id:'themeTool',home:'E:\\ZGmini\\data\\pc-writer\\theme-config-tool',
   taskName:'ZGMINI-PC-Configured-Themes',taskTime:'13:00',
   requiredLaunchers:['THEME_SCHEDULED.cmd'],optionalLaunchers:[],
   activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:33554432}};
 const targetRegistry=Buffer.from(registryAbsent?
  JSON.stringify({schema:RUNTIME_REGISTRY_SCHEMA,profiles:[profile]}):
  beforeRegistry.toString('utf8').replace(/]}$/,`,${JSON.stringify(profile)}]}`));
 const pin=hash(targetRegistry),afterHost=patchHostRuntimePinBytes(host,{oldPin,newPin:pin});
 const approval={schema:PIN_CAS_SCHEMA,status:'APPROVED_B',scope:PIN_CAS_SCOPE,
  profileId:profile.id,sourceSha:SOURCE,hostBeforeSha256:hash(host),
  hostAfterSha256:hash(afterHost),oldPin,newPin:pin,
  registryBeforeSha256:beforeRegistry===null?null:hash(beforeRegistry),registryAfterSha256:pin,
  registryEntryKey:profile.id,registryEntryBeforeSha256:null,
  registryEntryAfterSha256:hash(Buffer.from(JSON.stringify(profile)))};
 const raw=Buffer.from(JSON.stringify(approval));
 const requestId='pinregistration00001';
 const pinnedApproval={requestId,profileId:profile.id,sourceSha:SOURCE,
  rawApprovalSha256:hash(raw)};
 fs.writeFileSync(path.join(root,'host.json'),host);
 if(beforeRegistry!==null)
  fs.writeFileSync(path.join(root,...REG.split('/')),beforeRegistry);
 const adapter=makeIsolatedRegistryPinAdapter({fixtureRoot:root,requestId,
  trustedApprovalSha256:pinnedApproval.rawApprovalSha256,
  targetRegistryBytes:targetRegistry,injectFailure});
 return {root,host,beforeRegistry,afterHost,targetRegistry,raw,approval,pinnedApproval,adapter,
  hostPath:path.join(root,'host.json'),registryPath:path.join(root,...REG.split('/'))};
}
async function withFixture(behavior,fn){
 const x=setup(behavior);
 try{await fn(x);}finally{fs.rmSync(x.root,{recursive:true,force:true});}
}

test('two-file host PIN+registry CAS changes only approved bytes with journal and 2/2 results',async()=>{
 await withFixture({},async x=>{
  const output=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(output.status,'PASS',JSON.stringify(output));
  assert.equal(output.reportStatus,'JSON_TXT_2_OF_2');
  assert.deepEqual(fs.readFileSync(x.hostPath),x.afterHost);
  assert.deepEqual(fs.readFileSync(x.registryPath),x.targetRegistry);
  assert.equal(fs.existsSync(path.join(x.root,'writer-source-install.lock')),false);
  assert.equal(fs.readFileSync(x.hostPath,'utf8').includes('PRIVATE_KEEP_UNCHANGED'),true);
  const evidence=fs.readFileSync(path.join(x.root,
   'pin-cas-result.'+x.pinnedApproval.requestId+'.json'),'utf8');
  assert.ok(!evidence.includes('PRIVATE_KEEP_UNCHANGED'));
  assert.ok(!evidence.includes('THEME_SCHEDULED.cmd'));
  const journal=fs.readFileSync(path.join(x.root,
   'pin-cas-journal.'+x.pinnedApproval.requestId+'.jsonl'),'utf8');
  assert.match(journal,/HOST_CAS_INTENT/);
  assert.match(journal,/REGISTRY_CAS_INTENT/);
  assert.match(journal,/COMMITTED/);
  assert.ok(fs.existsSync(x.hostPath+'.backup.'+x.pinnedApproval.requestId));
  assert.ok(fs.existsSync(x.registryPath+'.backup.'+x.pinnedApproval.requestId));
 });
});

test('fault after first file write restores host and preserves approved registry',async()=>{
 await withFixture({injectFailure:'HOST_DONE'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.rollback,'VERIFIED');
  assert.deepEqual(fs.readFileSync(x.hostPath),x.host);
  assert.deepEqual(fs.readFileSync(x.registryPath),x.beforeRegistry);
  assert.equal(fs.existsSync(path.join(x.root,'writer-source-install.lock')),false);
 });
});

test('fault after both writes rolls two files back in reverse order',async()=>{
 await withFixture({injectFailure:'REGISTRY_DONE'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.rollback,'VERIFIED');
  assert.deepEqual(fs.readFileSync(x.hostPath),x.host);
  assert.deepEqual(fs.readFileSync(x.registryPath),x.beforeRegistry);
 });
});

test('partial backup failure reports STATE_UNKNOWN and retains shared lock',async()=>{
 await withFixture({injectFailure:'BACKUP_HOST_DONE'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(out.retainLockForRecovery,true);
  assert.deepEqual(fs.readFileSync(x.hostPath),x.host);
  assert.deepEqual(fs.readFileSync(x.registryPath),x.beforeRegistry);
  assert.equal(fs.readFileSync(path.join(x.root,'writer-source-install.lock'),'utf8'),
   x.pinnedApproval.requestId);
  assert.equal(fs.existsSync(x.hostPath+'.backup.'+x.pinnedApproval.requestId),true);
 });
});

test('corrupted Git approval/pin cannot claim lock or change source files',async()=>{
 await withFixture({},async x=>{
  const pin={...x.pinnedApproval,rawApprovalSha256:'0'.repeat(64)};
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:pin,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED');
  assert.deepEqual(fs.readFileSync(x.hostPath),x.host);
  assert.deepEqual(fs.readFileSync(x.registryPath),x.beforeRegistry);
  assert.equal(fs.existsSync(path.join(x.root,'writer-source-install.lock')),false);
 });
});

test('unapproved symlink and non-fixture path are refused',async()=>{
 await withFixture({},async x=>{
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-b-pin-outside-'));
  try{
   const outsideFile=path.join(outside,'target');fs.writeFileSync(outsideFile,'outside');
   fs.unlinkSync(x.hostPath);fs.symlinkSync(outsideFile,x.hostPath,'file');
   const out=await runApprovedRegistryCas({approvalRaw:x.raw,
    pinnedApproval:x.pinnedApproval,adapter:x.adapter});
   assert.equal(out.status,'BLOCKED');
   assert.equal(fs.readFileSync(outsideFile,'utf8'),'outside');
  }finally{fs.rmSync(outside,{recursive:true,force:true});}
 });
 const unrelated=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-b-unrelated-'));
 try{assert.throws(()=>makeIsolatedRegistryPinAdapter({fixtureRoot:unrelated,
  requestId:'pinregistration00001',trustedApprovalSha256:'a'.repeat(64),
  targetRegistryBytes:Buffer.from('{}')}),{code:'B_PIN_FIXTURE_SCOPE'});}
 finally{fs.rmSync(unrelated,{recursive:true,force:true});}
});

test('initial registry bootstrap is create-exclusive and keeps unrelated host secrets',async()=>{
 await withFixture({registryAbsent:true},async x=>{
  assert.equal(fs.existsSync(x.registryPath),false);
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'PASS');
  assert.deepEqual(fs.readFileSync(x.registryPath),x.targetRegistry);
  assert.deepEqual(fs.readFileSync(x.hostPath),x.afterHost);
  assert.equal(fs.existsSync(x.registryPath+'.backup.'+x.pinnedApproval.requestId),false);
  assert.equal(fs.existsSync(path.join(x.root,'writer-source-install.lock')),false);
 });
});

test('initial registry creation failure after write restores true ABSENT without touching other files',async()=>{
 await withFixture({registryAbsent:true,injectFailure:'REGISTRY_DONE'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.rollback,'VERIFIED');
  assert.equal(fs.existsSync(x.registryPath),false);
  assert.deepEqual(fs.readFileSync(x.hostPath),x.host);
  assert.equal(fs.existsSync(path.join(x.root,'writer-source-install.lock')),false);
 });
});

test('consumed request ID cannot leak a shared writer lock when journal already exists',async()=>{
 await withFixture({},async x=>{
  const first=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(first.status,'PASS');
  // Simulate a replay with a fresh, otherwise valid receiver instance.
  const secondAdapter=makeIsolatedRegistryPinAdapter({fixtureRoot:x.root,
   requestId:x.pinnedApproval.requestId,
   trustedApprovalSha256:x.pinnedApproval.rawApprovalSha256,
   targetRegistryBytes:x.targetRegistry});
  await assert.rejects(secondAdapter.acquireSharedWriterLock({
   requestId:x.pinnedApproval.requestId}),{code:'B_PIN_FIXTURE_REQUEST_CONSUMED'});
  assert.equal(fs.existsSync(path.join(x.root,'writer-source-install.lock')),false);
 });
});
