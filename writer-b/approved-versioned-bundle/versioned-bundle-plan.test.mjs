import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildVersionedBundlePlan,SCHEMA,SCOPE} from './versioned-bundle-plan.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const profiles=Object.freeze({'configured-themes':Object.freeze({
 id:'configured-themes',home:'E:\\ZGmini\\data\\pc-writer\\theme-config-tool',
 taskName:'ZGMINI-PC-Configured-Themes',taskTime:'13:00',
 requiredLaunchers:['THEME_SCHEDULED.cmd'],
 optionalLaunchers:['THEME_REGISTER.cmd','THEME_LIST.cmd','THEME_UPDATE.cmd','THEME_SCHEDULED.vbs'],
 activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:32*1024*1024,
})});

function fixture(){
 const files=[
  {path:'config/tool-registry.json',sha256:hash('registry'),bytes:8},
  {path:'docs/ONBOARDING.md',sha256:hash('docs'),bytes:4},
  {path:'scripts/pc-writer/tool.mjs',sha256:hash('source'),bytes:6},
 ];
 const version=hash(JSON.stringify(Object.fromEntries(files.map(x=>[x.path,x.sha256])))).slice(0,16);
 return {schema:SCHEMA,status:'APPROVED',scope:SCOPE,
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'codex/theme-fear-greed-integration-20261025',
  sourceSha:'0c97599431882245a156470bd51290e327e7ee78',profileId:'configured-themes',
  bundle:{version,files,sourceTreeGitOid:'eacf4d4c7b2673257e558f087fd36aa65ecf347c',
    zipSha256:'b155e20eb36bd4c1c6b5e1ab1851462d531d7b2ce02d70485843e00d1d160deb'},
  activation:{task:{name:'ZGMINI-PC-Configured-Themes',time:'13:00',
   beforeXmlSha256:hash('task-xml'),requiredState:'READY'},
   launchers:[{name:'THEME_SCHEDULED.cmd',beforeSha256:hash('old-cmd'),afterSha256:hash('new-cmd')}],
   activeRecord:{name:'ACTIVE_RUNTIME.json',beforeSha256:null,afterSha256:hash('new-active')}},
  effects:{taskDefinitionChanges:false,newTasks:false,providerCalls:false,dbWrites:false,
   d1Writes:false,secretReads:false,otherOperationalFiles:false}};
}
function rejected(mutate,code){const m=fixture();mutate(m);
 assert.throws(()=>buildVersionedBundlePlan(m,profiles),e=>e.code===code);
}

test('valid profile creates plan with no write action',()=>{
 const m=fixture(),plan=buildVersionedBundlePlan(m,profiles);
 assert.equal(plan.status,'PLAN_ONLY');
 assert.equal(plan.fileCount,3);
 assert.equal(plan.bundleVersion,m.bundle.version);
 assert.deepEqual(plan.launcherNames,['THEME_SCHEDULED.cmd']);
 assert.equal(Object.hasOwn(plan,'execute'),false);
 assert.ok(plan.runtimeRequired.includes('RECOVERABLE_JOURNAL_AND_ROLLBACK'));
});
test('approved immutable bundle accepts exact hash-pinned .js Node modules',()=>{
 const m=fixture();
 m.bundle.files.push({path:'scripts/pc-writer/theme-config-task-state.js',
  sha256:hash('approved-state-reader'),bytes:21});
 const sorted=[...m.bundle.files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 m.bundle.version=hash(JSON.stringify(Object.fromEntries(
  sorted.map(f=>[f.path,f.sha256])))).slice(0,16);
 const plan=buildVersionedBundlePlan(m,profiles);
 assert.equal(plan.fileCount,4);
 assert.equal(plan.bundleVersion,m.bundle.version);
});
test('98-file package with 26 approved .js modules stays within B scope',()=>{
 const m=fixture();
 m.bundle.files=Array.from({length:98},(_,i)=>({
  path:`scripts/pc-writer/approved-${String(i).padStart(3,'0')}.${i<26?'js':'mjs'}`,
  sha256:hash(`approved-package-file-${i}`),bytes:128,
 }));
 m.bundle.version=hash(JSON.stringify(Object.fromEntries(
  m.bundle.files.map(f=>[f.path,f.sha256])))).slice(0,16);
 const p=buildVersionedBundlePlan(m,profiles);
 assert.equal(p.fileCount,98);
 assert.equal(p.totalBytes,98*128);
});
test('profile must be independently registered by trusted receiver',()=>{
 rejected(m=>{m.profileId='unregistered-profile'},'B_PROFILE_NOT_REGISTERED');
});
test('request cannot inject arbitrary targets or unknown fields',()=>{
 rejected(m=>{m.extra='E:\\Secrets'},'B_MANIFEST_FIELDS');
 rejected(m=>{m.activation.extra=true},'B_ACTIVATION_FIELDS');
});
test('no traversal or absolute source path or arbitrary script type',()=>{
 rejected(m=>{m.bundle.files[0].path='../config/tool-registry.json'},'B_UNSAFE_BUNDLE_PATH');
 rejected(m=>{m.bundle.files[0].path='C:/tools/other.json'},'B_UNSAFE_BUNDLE_PATH');
 rejected(m=>{m.bundle.files[0].path='scripts\\other.mjs'},'B_UNSAFE_BUNDLE_PATH');
 rejected(m=>{m.bundle.files[0].path='scripts/autorun.cmd'},'B_UNSAFE_BUNDLE_PATH');
 rejected(m=>{m.bundle.files[0].path='scripts/autorun.ps1'},'B_UNSAFE_BUNDLE_PATH');
 rejected(m=>{m.bundle.files[0].path='scripts/autorun.cjs'},'B_UNSAFE_BUNDLE_PATH');
 rejected(m=>{m.bundle.files[0].path='CON.mjs'},'B_UNSAFE_BUNDLE_PATH');
});
test('NTFS case collision forbidden',()=>{
 rejected(m=>{m.bundle.files.push({...m.bundle.files[0],path:'CONFIG/tool-registry.json'})},'B_FILE_CASE_COLLISION');
});
test('version digest binds file list and byte hashes',()=>{
 rejected(m=>{m.bundle.files[0].sha256=hash('modified')},'B_VERSION_DIGEST');
 rejected(m=>{m.bundle.version='f'.repeat(16)},'B_VERSION_DIGEST');
});
test('unknown launcher and missing required scheduled launcher forbidden',()=>{
 rejected(m=>{m.activation.launchers[0].name='RUN_ANYTHING.cmd'},'B_LAUNCHER_NOT_APPROVED');
 rejected(m=>{m.activation.launchers=[]},'B_REQUIRED_LAUNCHER_MISSING');
 rejected(m=>{m.activation.launchers.push({...m.activation.launchers[0],name:'theme_scheduled.CMD'})},'B_LAUNCHER_CASE_COLLISION');
});
test('Task Scheduler definition/time/change forbidden',()=>{
 rejected(m=>{m.activation.task.time='12:00'},'B_TASK_PREIMAGE');
 rejected(m=>{m.activation.task.requiredState='RUNNING'},'B_TASK_PREIMAGE');
 rejected(m=>{m.effects.taskDefinitionChanges=true},'B_UNSAFE_EFFECTS');
 rejected(m=>{m.effects.newTasks=true},'B_UNSAFE_EFFECTS');
});
test('no provider calls, DB/D1 writes or unapproved files',()=>{
 rejected(m=>{m.effects.providerCalls=true},'B_UNSAFE_EFFECTS');
 rejected(m=>{m.effects.dbWrites=true},'B_UNSAFE_EFFECTS');
 rejected(m=>{m.effects.d1Writes=true},'B_UNSAFE_EFFECTS');
 rejected(m=>{m.effects.otherOperationalFiles=true},'B_UNSAFE_EFFECTS');
});
test('no unset or changed preimage and activated record path',()=>{
 rejected(m=>{m.activation.launchers[0].beforeSha256=null},'B_LAUNCHER_NOT_APPROVED');
 rejected(m=>{m.activation.activeRecord.name='providers.env'},'B_ACTIVE_PREIMAGE');
 rejected(m=>{m.activation.task.beforeXmlSha256=null},'B_TASK_PREIMAGE');
});
test('size and file count limited by pinned profile',()=>{
 rejected(m=>{m.bundle.files[0].bytes=32*1024*1024},'B_BUNDLE_SIZE');
 rejected(m=>{m.bundle.files[0].bytes=-1},'B_FILE_HASH_SIZE');
});
