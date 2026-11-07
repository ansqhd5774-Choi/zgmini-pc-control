import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeWindowsVersionedBundleAdapterCandidate} from
 './windows-versioned-bundle-adapter.mjs';
import {runVersionedBundleTransaction} from './versioned-bundle-transaction.mjs';
import {SCHEMA,SCOPE} from './versioned-bundle-plan.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const SHA40='0c97599431882245a156470bd51290e327e7ee78';
function setup(profileId='configured-themes'){
 const home='E:\\ZGmini\\data\\pc-writer\\'+profileId;
 const taskName='ZGMINI-PC-'+profileId.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('-');
 const launcher='SCHEDULED.cmd';
 const sourceBlobs={
  'config/job.json':Buffer.from('{"approved":true}\n'),
  'docs/README.md':Buffer.from('# Versioned job\n'),
  'scripts/pc-writer/job.mjs':Buffer.from('export default 7;\n'),
 };
 const files=Object.entries(sourceBlobs).map(([p,b])=>({
  path:p,sha256:hash(b),bytes:b.length
 }));
 const version=hash(JSON.stringify(Object.fromEntries(files.map(x=>[x.path,x.sha256])))).slice(0,16);
 const taskXml=Buffer.from('<Task>fixed</Task>\n');
 const originalLauncher=Buffer.from('@echo off\r\nrem old\r\n');
 const targetLauncher=Buffer.from('@echo off\r\nrem new\r\n');
 const originalMarker=Buffer.from('{"version":"old"}\n');
 const targetMarker=Buffer.from('{"version":"'+version+'"}\n');
 const zip=Buffer.from('approved zip fixture, no executable unzip\n');
 const identity={sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha:SHA40};
 const registry={schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',
  profiles:[{id:profileId,binding:identity,
   rootSegments:['pc-writer',profileId],files:[],directories:[],tasks:[],
   bundleProfile:{id:profileId,home,taskName,taskTime:'13:00',
    requiredLaunchers:[launcher],optionalLaunchers:[],
    activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:33554432}}]};
 const registryBytes=Buffer.from(JSON.stringify(registry)+'\n');
 const manifest={schema:SCHEMA,status:'APPROVED',scope:SCOPE,
  sourceRepository:identity.sourceRepository,
  sourceBranch:identity.sourceBranch,sourceSha:SHA40,profileId,
  bundle:{version,files,sourceTreeGitOid:'eacf4d4c7b2673257e558f087fd36aa65ecf347c',
   zipSha256:hash(zip)},
  activation:{task:{name:taskName,time:'13:00',
   beforeXmlSha256:hash(taskXml),requiredState:'READY'},
   launchers:[{name:launcher,beforeSha256:hash(originalLauncher),
    afterSha256:hash(targetLauncher)}],
   activeRecord:{name:'ACTIVE_RUNTIME.json',
    beforeSha256:hash(originalMarker),afterSha256:hash(targetMarker)}},
  effects:{taskDefinitionChanges:false,newTasks:false,providerCalls:false,
   dbWrites:false,d1Writes:false,secretReads:false,otherOperationalFiles:false},
 };
 const rawManifest=JSON.stringify(manifest);
 const pinnedApproval={requestId:'approved-bundle-request-001',
  rawManifestSha256:hash(rawManifest),
  approvalRef:'approvals/versioned-bundle/pinned-fixture.json',
  sourceSha:SHA40,profileId};
 return {manifest,registryBytes,hostApprovedRegistrySha256:hash(registryBytes),
  requestIdentity:identity,rawManifest,pinnedApproval,sourceBlobs,
  zip,taskXml,launcher,originalLauncher,targetLauncher,originalMarker,targetMarker};
}
function makeBridge(f,{failAt=null,sourceTampered=false,taskDrift=false,
 handleDrift=false,mixedRuntimeUnsafe=false,
 priorExact=false,priorCorrupt=false}={}){
 const current={launcher:Buffer.from(f.originalLauncher),
  marker:Buffer.from(f.originalMarker),promoted:false};
 const stage=new Map(),backups=new Map(),steps=[];
 if(priorExact||priorCorrupt){
  current.promoted=true;
  for(const [name,bytes] of Object.entries(f.sourceBlobs))
   stage.set(name,priorCorrupt&&name==='docs/README.md'?
    Buffer.from('corrupted'):Buffer.from(bytes));
 }
 let savedLock=null;
 const inject=(phase)=>{steps.push(phase);if(failAt===phase)throw Error('INJECTED_'+phase);};
 const bridge={
  async authenticatePinnedApproval({pin,rawSha256}){
   inject('auth');return {verified:pin.rawManifestSha256===rawSha256,rawSha256};
  },
  async verifyApprovedSourceTree({sourceTreeGitOid}){
   inject('tree');return {verified:sourceTreeGitOid===f.manifest.bundle.sourceTreeGitOid};
  },
  async verifyNoReparse(){inject('reparse');return {exactApprovedRoot:true,noReparse:true};},
  async verifyProtectedHandles({phase}){
   inject('handles-'+phase);
   return {held:!handleDrift,noReparse:true,scoped:true};
  },
  async readTaskDefinition(){
   inject('read-task');
   return {xmlBytes:taskDrift&&current.promoted?Buffer.from('<Task>changed</Task>\n'):
    f.taskXml,state:'READY',time:'13:00'};
  },
  async readLauncherBytes(){return current.launcher;},
  async readActiveRecordBytes(){return current.marker;},
  async readPinnedSourceBlob({path}){
   inject('source-blob');
   return sourceTampered?Buffer.from('tampered'):f.sourceBlobs[path];
  },
  async readApprovedZipArtifact(){inject('zip');return f.zip;},
  async readApprovedActivationBytes({kind}){
   inject('activation-bytes');
   return kind==='launcher'?f.targetLauncher:f.targetMarker;
  },
  async inspectImmutableVersion({approvedFiles,fileListSha256}){
   inject('inspect-version');
   if(!current.promoted)return {exists:false};
   const matches=stage.size===approvedFiles.length&&approvedFiles.every(f=>{
    const bytes=stage.get(f.path);
    return Buffer.isBuffer(bytes)&&bytes.length===f.bytes&&hash(bytes)===f.sha256;
   });
   return {exists:true,exactVerified:matches,
    fileListSha256:matches?fileListSha256:hash('incorrect'),
    fileCount:stage.size};
  },
  async attestNoMixedRuntimeExposure(){
   inject('activation-compatibility');
   // Synthetic capability only. This fixture does not establish Windows
   // Scheduler tick safety or real launcher compatibility.
   return {strategy:'STATIC_DISPATCHER_POINTER_SWITCH',taskUnchanged:true,
    oldAndNewLaunchersCompatible:!mixedRuntimeUnsafe,
    activePointerAtomic:true,scheduleTickSafe:!mixedRuntimeUnsafe};
  },
  async acquireExistingR17SharedWriterLock({mode}){
   inject('shared-lock');assert.equal(mode,'EXCLUSIVE_SAME_WRITER_B');
   savedLock={id:'existing-r17-shared-lock'};return {acquired:true,lock:savedLock};
  },
  async releaseExistingR17SharedWriterLock(){inject('release');savedLock=null;return {released:true};},
  async stageImmutableVersionFile({path,bytes,expectedSha256}){
   inject('stage-file');assert.equal(hash(bytes),expectedSha256);
   stage.set(path,Buffer.from(bytes));
   return {staged:true,handleBound:true,noReparse:true};
  },
  async readStagedVersionFile({path}){return stage.get(path);},
  async startDurableJournal(){
   inject('journal');return {created:true,journalId:'journal-1'};
  },
  async backupSameFolderPreserveAcl({kind,name,expectedBeforeSha256}){
   inject('backup');
   const bytes=Buffer.from(kind==='launcher'?current.launcher:current.marker);
   assert.equal(hash(bytes),expectedBeforeSha256);
   backups.set(kind+name,bytes);
   return {fsynced:true,aclPreserved:true,sha256:hash(bytes),
    handleBound:true,noReparse:true};
  },
  async promoteStagedImmutableVersion({fileListSha256}){
   inject('promote');current.promoted=true;
   return {promoted:true,fileListSha256};
  },
  async casReplaceSameFolder({kind,name,expectedBeforeSha256,afterBytes,expectedAfterSha256}){
   steps.push('cas-'+kind);
   const before=kind==='launcher'?current.launcher:current.marker;
   assert.equal(hash(before),expectedBeforeSha256);
   assert.equal(hash(afterBytes),expectedAfterSha256);
   if(kind==='launcher')current.launcher=Buffer.from(afterBytes);
   else current.marker=Buffer.from(afterBytes);
   if(failAt==='cas-'+kind)throw Error('AFTER_CAS_FAULT');
   return {atomicRename:true,fsynced:true,aclPreserved:true,
    handleBound:true,noReparse:true,afterSha256:hash(afterBytes)};
  },
  async readInstalledVersionFile({path}){
   return current.promoted?stage.get(path):null;
  },
  async commitDurableJournal(){inject('commit');return {committed:true};},
  async restoreSameFolderBackup({kind,name,beforeSha256}){
   inject('restore-'+kind);
   const b=backups.get(kind+name);
   assert.equal(hash(b),beforeSha256);
   if(kind==='launcher')current.launcher=Buffer.from(b);
   else current.marker=Buffer.from(b);
   return {restored:true,sha256:hash(b),aclPreserved:true,fsynced:true,
    handleBound:true,noReparse:true};
  },
  async recordJsonTxtResult(){inject('record');return {json:true,txt:true};},
 };
 return {bridge,current,steps,backups,saved:()=>savedLock};
}
async function execute(f,driver){
 const bundleProfile=JSON.parse(f.registryBytes.toString('utf8')).profiles[0].bundleProfile;
 const adapter=makeWindowsVersionedBundleAdapterCandidate({
  manifest:f.manifest,registryBytes:f.registryBytes,
  hostApprovedRegistrySha256:f.hostApprovedRegistrySha256,
  requestIdentity:f.requestIdentity,bridge:driver.bridge});
 return runVersionedBundleTransaction({
  rawManifest:f.rawManifest,pinnedApproval:f.pinnedApproval,
  trustedProfiles:{[f.manifest.profileId]:bundleProfile},adapter});
}
test('approved common B bridge: stage immutable files, backup, CAS and readback',async()=>{
 const f=setup(),driver=makeBridge(f);
 const result=await execute(f,driver);
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.deepEqual(driver.current.launcher,f.targetLauncher);
 assert.deepEqual(driver.current.marker,f.targetMarker);
 assert.ok(driver.current.promoted);
 assert.equal(driver.saved(),null);
 assert.equal(result.reportStatus,'JSON_TXT_2_OF_2');
 assert.ok(driver.steps.includes('shared-lock'));
 assert.ok(driver.steps.includes('cas-launcher'));
 assert.ok(driver.steps.includes('cas-active-record'));
});
test('second unrelated approved profile uses identical bridge/adapter source',async()=>{
 const f=setup('economic-series'),driver=makeBridge(f);
 const result=await execute(f,driver);
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.equal(result.profileId,'economic-series');
});
test('incomplete Windows bridge is a hard blocker before mutation',()=>{
 const f=setup();
 assert.throws(()=>makeWindowsVersionedBundleAdapterCandidate({
  manifest:f.manifest,registryBytes:f.registryBytes,
  hostApprovedRegistrySha256:f.hostApprovedRegistrySha256,
  requestIdentity:f.requestIdentity,bridge:{},
 }),e=>e.code==='B_WINDOWS_BRIDGE_UNREGISTERED');
});
test('untrusted registry raw PIN cannot unlock/activate',()=>{
 const f=setup(),driver=makeBridge(f);
 assert.throws(()=>makeWindowsVersionedBundleAdapterCandidate({
  manifest:f.manifest,registryBytes:f.registryBytes,
  hostApprovedRegistrySha256:hash('wrong registry'),
  requestIdentity:f.requestIdentity,bridge:driver.bridge,
 }),e=>e.code==='INVENTORY_MANIFEST_APPROVAL_MISMATCH');
 assert.equal(driver.steps.length,0);
});
test('pinned source blob drift blocks before backup/CAS',async()=>{
 const f=setup(),driver=makeBridge(f,{sourceTampered:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_WINDOWS_SOURCE_BYTES_DRIFT');
 assert.equal(driver.steps.includes('backup'),false);
 assert.equal(driver.steps.includes('cas-launcher'),false);
 assert.deepEqual(driver.current.launcher,f.originalLauncher);
});
test('launcher CAS post-write fault restores exact original state in reverse order',async()=>{
 const f=setup(),driver=makeBridge(f,{failAt:'cas-launcher'});
 const result=await execute(f,driver);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.rollback,'VERIFIED');
 assert.deepEqual(driver.current.launcher,f.originalLauncher);
 assert.deepEqual(driver.current.marker,f.originalMarker);
 const registryIndex=driver.steps.indexOf('restore-active-record');
 const launcherIndex=driver.steps.indexOf('restore-launcher');
 assert.ok(registryIndex<launcherIndex);
});
test('Task XML readback drift cannot be passed off as successful rollback',async()=>{
 const f=setup(),driver=makeBridge(f,{taskDrift:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'B_ROLLBACK_UNKNOWN');
 assert.equal(result.rollback,'UNVERIFIED');
 assert.deepEqual(driver.current.launcher,f.originalLauncher);
 assert.ok(driver.saved()!==null);
});
test('prior exact immutable version can be reused without restaging',async()=>{
 const f=setup(),driver=makeBridge(f,{priorExact:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'PASS');
 assert.equal(driver.steps.includes('stage-file'),false);
 assert.equal(driver.steps.includes('promote'),false);
 assert.ok(driver.steps.includes('cas-launcher'));
});
test('prior immutable version with hash drift never gets silently replaced',async()=>{
 const f=setup(),driver=makeBridge(f,{priorCorrupt:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_WINDOWS_IMMUTABLE_REUSE_DRIFT');
 assert.equal(driver.steps.includes('stage-file'),false);
 assert.equal(driver.steps.includes('cas-launcher'),false);
});
test('post-lock handle/reparse drift blocks staging and every CAS',async()=>{
 const f=setup(),driver=makeBridge(f,{handleDrift:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_WINDOWS_HANDLE_SCOPE_DRIFT');
 assert.ok(driver.steps.includes('handles-UNDER_LOCK'));
 assert.equal(driver.steps.includes('stage-file'),false);
 assert.equal(driver.steps.includes('cas-launcher'),false);
});
test('unproven scheduler tick/launcher compatibility stops before any CAS',async()=>{
 const f=setup(),driver=makeBridge(f,{mixedRuntimeUnsafe:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_WINDOWS_MIXED_RUNTIME_NOT_PROVEN');
 assert.ok(driver.steps.includes('activation-compatibility'));
 assert.equal(driver.steps.includes('stage-file'),false);
 assert.equal(driver.steps.includes('backup'),false);
 assert.equal(driver.steps.includes('cas-launcher'),false);
});
