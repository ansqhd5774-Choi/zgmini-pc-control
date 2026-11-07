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
const identity={sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/theme',sourceSha:'1'.repeat(40)};
const manifest=(profiles=[])=>Buffer.from(JSON.stringify({
 schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',profiles,
}));
const profile=(id,subdir,sourceSha=identity.sourceSha)=>({id,
 binding:{...identity,sourceSha},rootSegments:['pc-writer',subdir],
 files:[{key:'install',relativePath:'INSTALL_RESULT.json'}],directories:[],tasks:[]});
const setup=(root,bytes)=>{
 fs.mkdirSync(path.join(root,'pc-writer'),{recursive:true});
 fs.writeFileSync(path.join(root,'pc-writer',
  'approved-runtime-inventory-profiles.json'),bytes);
};

test('before B-grade registration, missing PIN is clean BLOCKED even with manifest present',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('theme','theme-runtime')]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,host:{},
   queryTask:()=>{throw Error('should not query task');}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_NOT_REGISTERED');
  assert.equal(result.operationalWrites,0);
  assert.equal(result.mutationStarted,false);
 });
});

test('approved SHA but manifest not installed yields clean bounded BLOCKED',async()=>{
 await withTmp(async root=>{
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
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
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.registeredCount,2);
  assert.equal(result.selectedCount,2);
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
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(original)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_DRIFT');
  assert.ok(!JSON.stringify(result).includes('new-runtime'));
 });
});

test('an extra untrusted request selector cannot influence the fixed registry operation',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('approved','safe-runtime')]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:{...identity,
   profileId:'bad',path:'../../private.json',operation:'arbitrary-shell'},dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)},
   profileId:'bad',registryPath:'../../private.json'});
  assert.equal(result.status,'PASS');
  assert.equal(result.selectedCount,1);
  assert.equal(result.profiles[0].profileId,'approved');
  assert.ok(!JSON.stringify(result).includes('private.json'));
 });
});

test('even SHA-matched malicious paths cannot expand rights',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([{
   ...profile('theme','theme-runtime'),files:[{key:'arbitrary',relativePath:'../../secret.json'}],
  }]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_INVALID');
 });
});

test('registry symlink redirection denied regardless of same approved content',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('theme','theme-runtime')]);
  fs.mkdirSync(path.join(root,'pc-writer'),{recursive:true});
  fs.writeFileSync(path.join(root,'approved.json'),bytes);
  fs.symlinkSync(path.join(root,'approved.json'),
   path.join(root,'pc-writer',
    'approved-runtime-inventory-profiles.json'),'file');
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_REGISTRY_INVALID');
 });
});

test('128 approved profiles: source SHA selects only its own profile, not a 128-profile report',async()=>{
 await withTmp(async root=>{
  const profiles=Array.from({length:128},(_,i)=>
   profile('profile'+i,'runtime'+i,(i+1).toString(16).padStart(40,'0')));
  const bytes=manifest(profiles);setup(root,bytes);
  const selectedSha=(128).toString(16).padStart(40,'0');
  const result=runApprovedRuntimeInventory({request:{...identity,sourceSha:selectedSha},
   dataRoot:root,host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.registeredCount,128);
  assert.equal(result.selectedCount,1);
  assert.equal(result.profiles[0].profileId,'profile127');
  assert.ok(!JSON.stringify(result).includes('profile126'));
  assert.ok(Buffer.byteLength(JSON.stringify(result))<32768);
 });
});

test('unregistered source SHA never gains profile lookup authority',async()=>{
 await withTmp(async root=>{
  const bytes=manifest([profile('theme','theme-runtime')]);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:{...identity,sourceSha:'f'.repeat(40)},
   dataRoot:root,host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'APPROVED_INVENTORY_SOURCE_UNREGISTERED');
  assert.ok(!JSON.stringify(result).includes('theme-runtime'));
 });
});

test('five approved profiles for one source return truthful bounded SUMMARY_ONLY without blocking',async()=>{
 await withTmp(async root=>{
  const bytes=manifest(Array.from({length:5},(_,i)=>profile('same'+i,'runtime'+i)));
  setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.code,'APPROVED_RUNTIME_REGISTRY_SUMMARY_ONLY');
  assert.equal(result.mode,'SUMMARY_ONLY');
  assert.equal(result.selectedCount,5);
  assert.equal(result.fileHashesComplete,false);
  assert.equal(result.taskChecksComplete,false);
  assert.equal(result.preimageEvidenceLevel,'ROOT_EXISTENCE_ONLY');
  assert.equal(result.profiles.length,5);
  assert.ok(result.profiles.every(p=>p.status==='ROOT_ABSENT'));
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=20*1024);
 });
});

test('128 profiles sharing one approved source produce bounded summary without file/Task queries',async()=>{
 await withTmp(async root=>{
  const profiles=Array.from({length:128},(_,i)=>profile('longProfile'+i,'runtime'+i));
  const bytes=manifest(profiles);setup(root,bytes);
  let queries=0;
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)},queryTask:()=>{queries++;throw Error('unexpected');}});
  assert.equal(result.status,'PASS');
  assert.equal(result.selectedCount,128);
  assert.equal(result.mode,'SUMMARY_ONLY');
  assert.equal(result.fileHashesComplete,false);
  assert.equal(queries,0);
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=20*1024);
 });
});

test('worst-case long-ID blocked summaries fit bounds or compact without blocking',async()=>{
 await withTmp(async root=>{
  fs.mkdirSync(path.join(root,'pc-writer'),{recursive:true});
  const profiles=Array.from({length:128},(_,i)=>{
   fs.writeFileSync(path.join(root,'pc-writer','runtime'+i),'not-a-directory');
   return profile('longProfile'+'x'.repeat(31)+i,'runtime'+i);
  });
  const bytes=manifest(profiles);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.mode,'SUMMARY_ONLY');
  assert.equal(result.selectedCount,128);
  assert.equal(result.blockedProfiles,128);
  if(result.profileRowsOmitted){
   assert.deepEqual(result.profiles,[]);
   assert.match(result.summarySha256,/^[a-f0-9]{64}$/);
  }else{
   assert.equal(result.profiles.length,128);
   assert.ok(result.profiles.every(p=>p.status==='BLOCKED'));
  }
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=20*1024);
 });
});

test('one bad profile root does not block other profile summaries',async()=>{
 await withTmp(async root=>{
  const profiles=Array.from({length:5},(_,i)=>profile('item'+i,'runtime'+i));
  fs.mkdirSync(path.join(root,'pc-writer'),{recursive:true});
  fs.writeFileSync(path.join(root,'pc-writer','runtime1'),'wrong type');
  const bytes=manifest(profiles);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.mode,'SUMMARY_ONLY');
  assert.equal(result.blockedProfiles,1);
  assert.equal(result.profiles.find(p=>p.profileId==='item1').status,'BLOCKED');
  assert.equal(result.profiles.find(p=>p.profileId==='item2').status,'ROOT_ABSENT');
 });
});

test('one unsafe detailed profile is isolated; another profile retains full evidence',async()=>{
 await withTmp(async root=>{
  const profiles=[profile('good','good-runtime'),profile('bad','bad-runtime')];
  const good=path.join(root,'pc-writer','good-runtime');
  const bad=path.join(root,'pc-writer','bad-runtime');
  fs.mkdirSync(good,{recursive:true});
  fs.writeFileSync(path.join(good,'INSTALL_RESULT.json'),'fixed');
  fs.writeFileSync(bad,'wrong type');
  const bytes=manifest(profiles);setup(root,bytes);
  const result=runApprovedRuntimeInventory({request:identity,dataRoot:root,
   host:{approvedRuntimeInventorySha256:sha(bytes)}});
  assert.equal(result.status,'PASS');
  assert.equal(result.mode,'DETAILED');
  assert.equal(result.code,'APPROVED_RUNTIME_REGISTRY_PARTIAL_READONLY');
  assert.equal(result.blockedProfiles,1);
  assert.equal(result.fileHashesComplete,false);
  assert.equal(result.profiles.find(p=>p.profileId==='bad').status,'BLOCKED');
  assert.ok(result.profiles.find(p=>p.profileId==='good').files.install.sha256);
 });
});
