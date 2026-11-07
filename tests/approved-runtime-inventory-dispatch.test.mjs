import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runApprovedRuntimeInventory} from '../controller/approved-runtime-inventory-dispatch.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'generic-dispatch-'));
const withTmp=async fn=>{const dir=temp();try{await fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}};
const manifest=(profiles=[])=>Buffer.from(JSON.stringify({
 schema:'ZGMINI_APPROVED_RUNTIME_INVENTORY_PROFILES_V1',profiles,
}));
const profile=(id,subdir)=>({id,rootSegments:['pc-writer',subdir],
 files:[{key:'install',relativePath:'INSTALL_RESULT.json'}],directories:[],tasks:[]});
const setup=(root,bytes)=>{
 fs.mkdirSync(path.join(root,'pc-writer','controller-approvals'),{recursive:true});
 fs.writeFileSync(path.join(root,'pc-writer','controller-approvals',
  'approved-runtime-inventory-profiles.json'),bytes);
};

test('before B-grade registration, missing PIN is clean BLOCKED even with manifest present',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('theme','theme-runtime')]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({dataRoot:root,host:{},
   queryTask:()=>{throw Error('should not query task');}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_NOT_REGISTERED');
  assert.equal(result.operationalWrites,0);
  assert.equal(result.mutationStarted,false);
 });
});

test('approved SHA but manifest not installed yields clean bounded BLOCKED',async()=>{
 await withTmp(async root=>{
  const result=runApprovedRuntimeInventory({dataRoot:root,
   host:{approvedRuntimeInventorySha256:'a'.repeat(64)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_ABSENT');
  assert.equal(result.providerCalls,0);
 });
});

test('installed registry and independent host approval PIN grant one generic operation to many profiles',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('theme','theme-runtime'),profile('other','other-runtime')]);
  setup(root,bytes);
  const result=runApprovedRuntimeInventory({dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.profileCount,2);
  assert.equal(result.profiles[0].rootExists,false);
  assert.equal(result.profiles[1].rootExists,false);
  assert.equal(result.operationalWrites,0);
  assert.equal(result.d1Writes,0);
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=32768);
 });
});

test('post-approval registry tampering is blocked and returns no contents',async()=>{
 await withTmp(async root=>{
  const original=manifest([profile('theme','theme-runtime')]);
  const changed=manifest([profile('unapproved','new-runtime')]);
  setup(root,changed);
  const result=runApprovedRuntimeInventory({dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(original)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_DRIFT');
  assert.ok(!JSON.stringify(result).includes('new-runtime'));
 });
});

test('an extra untrusted request selector cannot influence the fixed registry operation',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('approved','safe-runtime')]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)},
   request:{profileId:'bad',path:'../../private.json',operation:'arbitrary-shell'},
   profileId:'bad',registryPath:'../../private.json'});
  assert.equal(result.status,'PASS');
  assert.equal(result.profileCount,1);
  assert.equal(result.profiles[0].profileId,'approved');
  assert.ok(!JSON.stringify(result).includes('private.json'));
 });
});

test('even SHA-matched malicious paths cannot expand rights',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([{
   ...profile('theme','theme-runtime'),files:[{key:'arbitrary',relativePath:'../../secret.json'}],
  }]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_INVALID');
 });
});

test('registry symlink redirection denied regardless of same approved content',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('theme','theme-runtime')]);
  fs.mkdirSync(path.join(root,'pc-writer','controller-approvals'),{recursive:true});
  fs.writeFileSync(path.join(root,'approved.json'),bytes);
  fs.symlinkSync(path.join(root,'approved.json'),
   path.join(root,'pc-writer','controller-approvals',
    'approved-runtime-inventory-profiles.json'),'file');
  const result=runApprovedRuntimeInventory({dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_INVALID');
 });
});
