import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runVersionedBundleTransaction} from './versioned-bundle-transaction.mjs';
import {buildVersionedBundlePlan,SCHEMA,SCOPE} from './versioned-bundle-plan.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const profiles={'common-job':{
 id:'common-job',home:'E:\\ZGmini\\data\\pc-writer\\common-job',
 taskName:'ZGMINI-PC-Common-Job',taskTime:'13:00',
 requiredLaunchers:['JOB_SCHEDULED.cmd'],optionalLaunchers:['JOB_SCHEDULED.vbs'],
 activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:32*1024*1024,
}};
function input(){
 const files=[
  {path:'config/job.json',sha256:hash('config'),bytes:6},
  {path:'docs/job.md',sha256:hash('docs'),bytes:4},
  {path:'scripts/pc-writer/job.mjs',sha256:hash('code'),bytes:4},
 ];
 const version=hash(JSON.stringify(Object.fromEntries(files.map(f=>[f.path,f.sha256])))).slice(0,16);
 const manifest={schema:SCHEMA,status:'APPROVED',scope:SCOPE,
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',
  sourceSha:'0c97599431882245a156470bd51290e327e7ee78',profileId:'common-job',
  bundle:{version,files,sourceTreeGitOid:'eacf4d4c7b2673257e558f087fd36aa65ecf347c',
   zipSha256:hash('package')},
  activation:{task:{name:'ZGMINI-PC-Common-Job',time:'13:00',
   beforeXmlSha256:hash('task'),requiredState:'READY'},
   launchers:[{name:'JOB_SCHEDULED.cmd',beforeSha256:hash('old'),
    afterSha256:hash('new')}],
   activeRecord:{name:'ACTIVE_RUNTIME.json',beforeSha256:hash('old-active'),
    afterSha256:hash('new-active')}},
  effects:{taskDefinitionChanges:false,newTasks:false,providerCalls:false,
   dbWrites:false,d1Writes:false,secretReads:false,otherOperationalFiles:false}};
 const rawManifest=JSON.stringify(manifest);
 const pinnedApproval={requestId:'issue-765-request-1',rawManifestSha256:hash(rawManifest),
  approvalRef:'docs/approved/bundle-manifest.json',
  sourceSha:manifest.sourceSha,profileId:manifest.profileId};
 return {manifest,rawManifest,pinnedApproval,trustedProfiles:profiles};
}
function snapshot(manifest,after=false,trustedProfiles=profiles){
 const task=manifest.activation.task;
 return {
  task:{name:task.name,time:task.time,state:'READY',xmlSha256:task.beforeXmlSha256},
  launchers:manifest.activation.launchers.map(l=>({
   name:l.name,sha256:after?l.afterSha256:l.beforeSha256,
  })),
  activeRecord:{name:manifest.activation.activeRecord.name,
   sha256:after?manifest.activation.activeRecord.afterSha256:
    manifest.activation.activeRecord.beforeSha256},
  bundleVersion:after?manifest.bundle.version:null,
  fileListSha256:after?buildVersionedBundlePlan(manifest,trustedProfiles).fileListSha256:null,
 };
}
function driver(manifest,{failAt=null,rollbackFails=false,trustedProfiles=profiles}={}){
 const log=[];
 const state={active:false,locked:false,staged:false,backup:false,committed:false,
  results:[]};
 const maybe=(name)=>{log.push(name);if(failAt===name)throw Error('fault');};
 const adapter={
  async authenticatePinnedApproval({pin,rawSha256}){
   maybe('authenticate');return {verified:true,rawSha256};
  },
  async inspectPreimage(){maybe('preimage');return snapshot(manifest,false,trustedProfiles);},
  async acquireSharedWriterLock(){maybe('lock');state.locked=true;return {id:'lease'};},
  async verifyPreimageUnderLock(){maybe('under-lock');return snapshot(manifest,false,trustedProfiles);},
  async stageVerifiedBundle(){
   maybe('stage');state.staged=true;
   return {verified:true,fileListSha256:buildVersionedBundlePlan(manifest,trustedProfiles).fileListSha256};
  },
  async backupPreimages(){
   maybe('backup');state.backup=true;return {complete:true,journalId:'journal-1'};
  },
  async casActivate(){
   log.push('activate');state.active=true; // inject a partial write BEFORE exception
   if(failAt==='activate')throw Error('fault');
   return {activated:true};
  },
  async readBack(){maybe('readback');return snapshot(manifest,state.active,trustedProfiles);},
  async commit(){maybe('commit');state.committed=true;return {committed:true};},
  async rollback(){
   log.push('rollback');
   if(rollbackFails)throw Error('fault');
   state.active=false;return {rolledBack:true};
  },
  async verifyRollback(){maybe('verify-rollback');return snapshot(manifest,state.active,trustedProfiles);},
  async releaseSharedWriterLock(){maybe('unlock');state.locked=false;},
  async recordResult({report}){log.push('report');state.results.push(report);return {json:true,txt:true};},
 };
 return {log,state,adapter};
}

test('generic common B transaction: authenticated preflight to readback 2/2 without shell',async()=>{
 const arg=input();const d=driver(arg.manifest);
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'PASS');assert.equal(r.reportStatus,'JSON_TXT_2_OF_2');
 assert.equal(r.retainLockForRecovery,false);
 assert.equal(d.state.active,true);assert.equal(d.state.locked,false);
 assert.deepEqual(d.log,['authenticate','preimage','lock','under-lock','stage',
  'backup','activate','readback','commit','unlock','report']);
});
test('unauthenticated raw manifest never calls adapter or writes',async()=>{
 const arg=input();const d=driver(arg.manifest);
 arg.pinnedApproval.rawManifestSha256=hash('spoofed');
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'B_PIN_RAW_HASH_DRIFT');
 assert.deepEqual(d.log,['report']);
});
test('early failures release shared lock without activating',async()=>{
 for(const failAt of ['authenticate','preimage','lock','under-lock','stage']){
  const arg=input();const d=driver(arg.manifest,{failAt});
  const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
  assert.equal(r.status,'BLOCKED',failAt);
  assert.equal(d.state.active,false,failAt);
  assert.equal(d.state.locked,false,failAt);
  assert.equal(d.log.includes('rollback'),false,failAt);
  assert.equal(d.log.includes('activate'),false,failAt);
 }
});
test('partial backup failure preserves lease/journal for investigation',async()=>{
 const arg=input();const d=driver(arg.manifest,{failAt:'backup'});
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'B_BACKUP_UNKNOWN');
 assert.equal(r.retainLockForRecovery,true);
 assert.equal(d.state.active,false);
 assert.equal(d.log.includes('activate'),false);
 assert.equal(d.log.includes('unlock'),false);
});
test('failure after activation attempts verified rollback under same lock',async()=>{
 for(const failAt of ['activate','readback']){
  const arg=input();const d=driver(arg.manifest,{failAt});
  const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
  assert.equal(r.status,'BLOCKED',failAt);
  assert.equal(r.rollback,'VERIFIED',failAt);
  assert.equal(d.state.active,false,failAt);
  assert.equal(d.state.locked,false,failAt);
  assert.ok(d.log.indexOf('rollback')<d.log.indexOf('unlock'),failAt);
  assert.ok(d.log.includes('verify-rollback'),failAt);
 }
});
test('rollback fault reports STATE_UNKNOWN and preserves lock',async()=>{
 const arg=input();const d=driver(arg.manifest,{failAt:'readback',rollbackFails:true});
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'B_ROLLBACK_UNKNOWN');
 assert.equal(r.retainLockForRecovery,true);
 assert.equal(d.state.active,true);assert.equal(d.state.locked,true);
 assert.equal(d.log.includes('unlock'),false);
});
test('commit ambiguity preserves lock and journal instead of unsafe retry/rollback',async()=>{
 const arg=input();const d=driver(arg.manifest,{failAt:'commit'});
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.retainLockForRecovery,true);
 assert.equal(d.log.includes('rollback'),false);
 assert.equal(d.log.includes('unlock'),false);
});
test('Windows readback Task XML drift triggers rollback, never changes Task',async()=>{
 const arg=input();const d=driver(arg.manifest);
 d.adapter.readBack=async()=>({
  ...snapshot(arg.manifest,true),task:{...snapshot(arg.manifest,true).task,
   xmlSha256:hash('unexpected-task-change')},
 });
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'B_TASK_DRIFT');assert.equal(r.rollback,'VERIFIED');
 assert.equal(d.state.active,false);
});
test('two distinct pinned profiles reuse exactly the same generic coordinator',async()=>{
 const arg=input();
 const second={...profiles['common-job'],id:'second-tool',
  home:'E:\\ZGmini\\data\\pc-writer\\second-tool',
  taskName:'ZGMINI-PC-Second-Tool',
  requiredLaunchers:['SECOND_SCHEDULED.cmd'],optionalLaunchers:[]};
 arg.trustedProfiles={...profiles,'second-tool':second};
 arg.manifest.profileId='second-tool';
 arg.manifest.activation.task.name=second.taskName;
 arg.manifest.activation.launchers[0].name='SECOND_SCHEDULED.cmd';
 arg.rawManifest=JSON.stringify(arg.manifest);
 arg.pinnedApproval={...arg.pinnedApproval,profileId:'second-tool',
  rawManifestSha256:hash(arg.rawManifest)};
 const d=driver(arg.manifest,{trustedProfiles:arg.trustedProfiles});
 const r=await runVersionedBundleTransaction({...arg,adapter:d.adapter});
 assert.equal(r.status,'PASS');
 assert.equal(r.profileId,'second-tool');
 assert.equal(d.state.active,true);
 assert.equal(d.state.locked,false);
});
