import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SCHEMA,SCOPE} from './versioned-bundle-plan.mjs';
import {selectPinnedBundleProfiles,buildPinnedVersionedBundlePlan} from
 './pinned-bundle-profiles.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const sourceSha='0c97599431882245a156470bd51290e327e7ee78';
const binding={
 sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha,
};
const id='configured-themes';
function fixture(){
 const profile={id,binding,rootSegments:['pc-writer','theme-config-tool'],
  files:[],directories:[],tasks:[],
  bundleProfile:{id,home:'E:\\ZGmini\\data\\pc-writer\\theme-config-tool',
   taskName:'ZGMINI-PC-Configured-Themes',taskTime:'13:00',
   requiredLaunchers:['THEME_SCHEDULED.cmd'],optionalLaunchers:['THEME_SCHEDULED.vbs'],
   activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:33554432}};
 const aOnly={id:'a-only',binding,rootSegments:['pc-writer'],
  files:[],directories:[],tasks:[]};
 const registry={schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',
  profiles:[profile,aOnly]};
 const manifestBytes=Buffer.from(JSON.stringify(registry)+'\n');
 const requestIdentity={...binding};
 const files=[
  {path:'docs/ONBOARDING.md',sha256:hash('md'),bytes:2},
  {path:'scripts/pc-writer/program.mjs',sha256:hash('js'),bytes:2},
 ];
 const version=hash(JSON.stringify(Object.fromEntries(files.map(x=>[x.path,x.sha256])))).slice(0,16);
 const approval={schema:SCHEMA,status:'APPROVED',scope:SCOPE,
  sourceRepository:binding.sourceRepository,sourceBranch:binding.sourceBranch,
  sourceSha,profileId:id,
  bundle:{version,files,sourceTreeGitOid:'eacf4d4c7b2673257e558f087fd36aa65ecf347c',
   zipSha256:hash('zip')},
  activation:{task:{name:'ZGMINI-PC-Configured-Themes',time:'13:00',
   beforeXmlSha256:hash('task'),requiredState:'READY'},
   launchers:[{name:'THEME_SCHEDULED.cmd',
    beforeSha256:hash('old'),afterSha256:hash('new')}],
   activeRecord:{name:'ACTIVE_RUNTIME.json',
    beforeSha256:hash('old-active'),afterSha256:hash('new-active')}},
  effects:{taskDefinitionChanges:false,newTasks:false,providerCalls:false,
   dbWrites:false,d1Writes:false,secretReads:false,otherOperationalFiles:false}};
 return {registry,profile,manifestBytes,
  approvedManifestSha256:hash(manifestBytes),requestIdentity,approval};
}
test('B profile is projected from exactly A-approved PIN bytes, not source-embedded map',()=>{
 const f=fixture();
 const result=selectPinnedBundleProfiles(f);
 assert.equal(result.registrySha256,f.approvedManifestSha256);
 assert.deepEqual(Object.keys(result.trustedProfiles),[id]);
 assert.equal(result.trustedProfiles[id].home,f.profile.bundleProfile.home);
 assert.equal(Object.hasOwn(result.trustedProfiles,'a-only'),false);
});
test('same registry PIN validates complete B approval and binds source identity',()=>{
 const f=fixture();
 const result=buildPinnedVersionedBundlePlan(f);
 assert.equal(result.status,'PLAN_ONLY');
 assert.equal(result.profileId,id);
 assert.equal(result.registrySha256,f.approvedManifestSha256);
 assert.equal(result.fileCount,2);
});
test('changed registry raw bytes fail before any B plan, even if JSON semantically same',()=>{
 const f=fixture();
 f.manifestBytes=Buffer.from(f.manifestBytes.toString('utf8')+'\n');
 assert.throws(()=>selectPinnedBundleProfiles(f),
  e=>e.code==='INVENTORY_MANIFEST_APPROVAL_MISMATCH');
});
test('source SHA/branch drift, unlisted B profile and unexpected profile root are denied',()=>{
 const f=fixture();
 const wrong={...f,requestIdentity:{...binding,sourceSha:'f'.repeat(40)}};
 assert.throws(()=>selectPinnedBundleProfiles(wrong),
  e=>e.code==='INVENTORY_SOURCE_UNREGISTERED');
 const sourceWrong={...f,approval:{...f.approval,sourceBranch:'main'}};
 assert.throws(()=>buildPinnedVersionedBundlePlan(sourceWrong),
  e=>e.code==='B_APPROVAL_SOURCE_IDENTITY_DRIFT');
 f.registry.profiles[0].bundleProfile.home=
  'E:\\ZGmini\\data\\pc-writer\\allow.dots';
 f.manifestBytes=Buffer.from(JSON.stringify(f.registry)+'\n');
 f.approvedManifestSha256=hash(f.manifestBytes);
 assert.throws(()=>selectPinnedBundleProfiles(f),
  e=>e.code==='B_PROFILE_TARGET_DENIED');
});
test('A-only registry has no B activation capability',()=>{
 const f=fixture();
 delete f.registry.profiles[0].bundleProfile;
 f.manifestBytes=Buffer.from(JSON.stringify(f.registry)+'\n');
 f.approvedManifestSha256=hash(f.manifestBytes);
 assert.throws(()=>selectPinnedBundleProfiles(f),
  e=>e.code==='B_PROFILE_NO_APPROVED_B_ENTRY');
});
test('Windows device launcher and normalized duplicate names denied',()=>{
 const f=fixture();
 f.registry.profiles[0].bundleProfile.requiredLaunchers=['CON.cmd'];
 f.manifestBytes=Buffer.from(JSON.stringify(f.registry)+'\n');
 f.approvedManifestSha256=hash(f.manifestBytes);
 assert.throws(()=>selectPinnedBundleProfiles(f));
 const other=fixture();
 other.registry.profiles[0].bundleProfile.optionalLaunchers=['theme_scheduled.CMD'];
 other.manifestBytes=Buffer.from(JSON.stringify(other.registry)+'\n');
 other.approvedManifestSha256=hash(other.manifestBytes);
 assert.throws(()=>selectPinnedBundleProfiles(other));
});
