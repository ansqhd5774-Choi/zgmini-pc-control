import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {makeIsolatedWindowsFixtureAdapter} from './isolated-windows-fixture-adapter.mjs';
import {runVersionedBundleTransaction} from './versioned-bundle-transaction.mjs';
import {SCHEMA,SCOPE} from './versioned-bundle-plan.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const write=(file,bytes)=>{
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,bytes);
};
function createFixture(t,{faultAt=null}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-b-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 write(path.join(root,'SIMULATION_ONLY.json'),'ZGMINI_B_DISPOSABLE_FIXTURE_V1\n');
 const id='a08a54e5-8f26-4875-a6c4-39c23b008111';
 const profileId='job-one';
 const parent=path.join(root,'profiles',profileId);
 fs.mkdirSync(path.join(parent,'launchers'),{recursive:true});
 fs.mkdirSync(path.join(parent,'versions'),{recursive:true});
 const taskXml=Buffer.from('<Task><Name>Job1</Name></Task>\n');
 write(path.join(parent,'task.xml'),taskXml);
 write(path.join(parent,'task-state.json'),JSON.stringify({
  name:'ZGMINI-PC-Job-One',time:'13:00',state:'READY',
 }));
 const oldLauncher=Buffer.from('@echo off\r\necho old\r\n');
 const newLauncher=Buffer.from('@echo off\r\necho new\r\n');
 const launcher='JOB_SCHEDULED.cmd';
 write(path.join(parent,'launchers',launcher),oldLauncher);
 const oldRecord=Buffer.from('{"version":"old"}\n');
 const newRecord=Buffer.from('{"version":"new"}\n');
 write(path.join(parent,'ACTIVE_RUNTIME.json'),oldRecord);
 const sourceBlobs={
  'config/runtime.json':Buffer.from('{"ok":true}\n'),
  'docs/README.md':Buffer.from('# Bundle\n'),
  'scripts/job.mjs':Buffer.from('export default 1;\n'),
 };
 const files=Object.entries(sourceBlobs).map(([name,b])=>({
  path:name,sha256:hash(b),bytes:b.length}));
 files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const version=hash(JSON.stringify(Object.fromEntries(files.map(f=>[f.path,f.sha256])))).slice(0,16);
 const zipBlob=Buffer.from('fake local zip archive, never executed\n');
 const manifest={
  schema:SCHEMA,status:'APPROVED',scope:SCOPE,
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',
  sourceSha:'0c97599431882245a156470bd51290e327e7ee78',
  profileId,
  bundle:{version,files,sourceTreeGitOid:'eacf4d4c7b2673257e558f087fd36aa65ecf347c',
   zipSha256:hash(zipBlob)},
  activation:{
   task:{name:'ZGMINI-PC-Job-One',time:'13:00',
    beforeXmlSha256:hash(taskXml),requiredState:'READY'},
   launchers:[{name:launcher,beforeSha256:hash(oldLauncher),afterSha256:hash(newLauncher)}],
   activeRecord:{name:'ACTIVE_RUNTIME.json',beforeSha256:hash(oldRecord),
    afterSha256:hash(newRecord)},
  },
  effects:{taskDefinitionChanges:false,newTasks:false,providerCalls:false,
   dbWrites:false,d1Writes:false,secretReads:false,otherOperationalFiles:false},
 };
 const rawManifest=JSON.stringify(manifest);
 const approvedApprovalRef='approvals/versioned-bundle/job-one.json';
 const pinnedApproval={requestId:id,rawManifestSha256:hash(rawManifest),
  approvalRef:approvedApprovalRef,sourceSha:manifest.sourceSha,profileId};
 const trustedProfiles={[profileId]:{
  id:profileId,home:'E:\\ZGmini\\data\\pc-writer\\job-one',
  taskName:'ZGMINI-PC-Job-One',taskTime:'13:00',
  requiredLaunchers:[launcher],optionalLaunchers:[],
  activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:33554432,
 }};
 const arg={rawManifest,pinnedApproval,trustedProfiles};
 const make=options=>makeIsolatedWindowsFixtureAdapter({
  fixtureRoot:root,manifest,requestId:options?.requestId??id,
  approvedManifestSha256:pinnedApproval.rawManifestSha256,
  approvedSourceSha:pinnedApproval.sourceSha,
  approvedApprovalRef,sourceBlobs,zipBlob,
  launcherBlobs:{[launcher]:newLauncher},activeRecordBytes:newRecord,
  faultAt:options?.faultAt??faultAt,
 });
 return {root,id,parent,manifest,arg,make,oldLauncher,newLauncher,
  oldRecord,newRecord,taskXml,launcher,sourceBlobs};
}
test('isolated filesystem happy path: immutable bundle, backed-up CAS, unchanged Task',async t=>{
 const f=createFixture(t);
 const result=await runVersionedBundleTransaction({...f.arg,adapter:f.make()});
 assert.equal(result.status,'PASS');
 assert.equal(result.reportStatus,'JSON_TXT_2_OF_2');
 assert.equal(hash(fs.readFileSync(path.join(f.parent,'task.xml'))),hash(f.taskXml));
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'launchers',f.launcher)),f.newLauncher);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'ACTIVE_RUNTIME.json')),f.newRecord);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'launchers',
  f.launcher+'.backup.'+f.id)),f.oldLauncher);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,
  'ACTIVE_RUNTIME.json.backup.'+f.id)),f.oldRecord);
 for(const [name,bytes] of Object.entries(f.sourceBlobs)){
  assert.deepEqual(fs.readFileSync(path.join(f.parent,'versions',
   f.manifest.bundle.version,...name.split('/'))),bytes);
 }
 assert.equal(fs.existsSync(path.join(f.root,'shared-writer-b.lock')),false);
 assert.equal(fs.existsSync(path.join(f.root,'results',f.id+'.json')),true);
 assert.equal(fs.existsSync(path.join(f.root,'results',f.id+'.txt')),true);
});
test('real file replacement failure restores exact launcher and active marker',async t=>{
 const f=createFixture(t,{faultAt:'activation-after-file'});
 const result=await runVersionedBundleTransaction({...f.arg,adapter:f.make()});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.rollback,'VERIFIED');
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'launchers',f.launcher)),f.oldLauncher);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'ACTIVE_RUNTIME.json')),f.oldRecord);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'task.xml')),f.taskXml);
 assert.equal(fs.existsSync(path.join(f.root,'shared-writer-b.lock')),false);
});
test('partial file backup fault leaves lock and journal with STATE_UNKNOWN',async t=>{
 const f=createFixture(t,{faultAt:'backup-after-file'});
 const result=await runVersionedBundleTransaction({...f.arg,adapter:f.make()});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'B_BACKUP_UNKNOWN');
 assert.equal(result.retainLockForRecovery,true);
 assert.equal(fs.existsSync(path.join(f.root,'shared-writer-b.lock')),true);
 assert.equal(fs.existsSync(path.join(f.parent,'journals',f.id+'.jsonl')),true);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'launchers',f.launcher)),f.oldLauncher);
});
test('failing pinned fixture authority performs zero operating fixture changes',async t=>{
 const f=createFixture(t);
 const fake={...f.arg.pinnedApproval,approvalRef:'approvals/unrelated.json'};
 const result=await runVersionedBundleTransaction({...f.arg,pinnedApproval:fake,adapter:f.make()});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_AUTH_FAILED');
 assert.equal(fs.existsSync(path.join(f.parent,'versions',f.manifest.bundle.version)),false);
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'launchers',f.launcher)),f.oldLauncher);
});
test('actual injected symlink in fixture is rejected prior to activation',async t=>{
 const f=createFixture(t);
 const unrelated=path.join(f.root,'unrelated');fs.mkdirSync(unrelated);
 const original=path.join(f.parent,'launchers',f.launcher);
 fs.renameSync(original,path.join(f.parent,'launchers','safe-original.cmd'));
 fs.symlinkSync(path.join(unrelated,'bad.cmd'),original);
 const result=await runVersionedBundleTransaction({...f.arg,adapter:f.make()});
 assert.equal(result.status,'BLOCKED');
 assert.equal(fs.existsSync(path.join(f.parent,'versions',f.manifest.bundle.version)),false);
});
test('adapter refuses non-fixture root and lacks shell/external commands',t=>{
 const f=createFixture(t);
 assert.throws(()=>makeIsolatedWindowsFixtureAdapter({
  fixtureRoot:f.parent,manifest:f.manifest,requestId:f.id,
 }),e=>e.code==='B_FIXTURE_ROOT');
});
test('failed launcher CAS leaves exact immutable version reusable by a fresh request',async t=>{
 const f=createFixture(t,{faultAt:'activation-after-file'});
 const first=await runVersionedBundleTransaction({...f.arg,adapter:f.make()});
 assert.equal(first.status,'BLOCKED');
 assert.equal(first.rollback,'VERIFIED');
 assert.equal(fs.existsSync(path.join(f.parent,'versions',f.manifest.bundle.version)),true);
 const newRequestId='d5f34f9b-2770-4cf8-b547-5c413c3da779';
 const pinnedApproval={...f.arg.pinnedApproval,requestId:newRequestId};
 const second=await runVersionedBundleTransaction({
  ...f.arg,pinnedApproval,
  adapter:f.make({requestId:newRequestId,faultAt:'__none__'}),
 });
 assert.equal(second.status,'PASS',JSON.stringify(second));
 assert.equal(second.reportStatus,'JSON_TXT_2_OF_2');
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'ACTIVE_RUNTIME.json')),f.newRecord);
 assert.ok(fs.readFileSync(path.join(f.parent,'journals',newRequestId+'.jsonl'),'utf8')
  .includes('EXACT_IMMUTABLE_VERSION_REUSED'));
});
test('existing version with extra or corrupted file is never reused',async t=>{
 const f=createFixture(t,{faultAt:'activation-after-file'});
 const first=await runVersionedBundleTransaction({...f.arg,adapter:f.make()});
 assert.equal(first.rollback,'VERIFIED');
 const version=path.join(f.parent,'versions',f.manifest.bundle.version);
 fs.writeFileSync(path.join(version,'docs','README.md'),Buffer.from('corrupted'));
 const newRequestId='ea49681f-ecde-43e1-9175-0fc8cd760310';
 const result=await runVersionedBundleTransaction({
  ...f.arg,pinnedApproval:{...f.arg.pinnedApproval,requestId:newRequestId},
  adapter:f.make({requestId:newRequestId,faultAt:'__none__'}),
 });
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.code==='B_ADAPTER_ERROR'||result.code==='B_FIXTURE_IMMUTABLE_HASH_DRIFT');
 assert.deepEqual(fs.readFileSync(path.join(f.parent,'launchers',f.launcher)),f.oldLauncher);
});
