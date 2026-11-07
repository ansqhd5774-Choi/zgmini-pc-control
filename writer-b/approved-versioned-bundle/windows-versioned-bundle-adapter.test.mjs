import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeWindowsVersionedBundleAdapterCandidate} from
 './windows-versioned-bundle-adapter.mjs';
import {runVersionedBundleTransaction} from './versioned-bundle-transaction.mjs';
import {SCHEMA,SCOPE} from './versioned-bundle-plan.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const SHA40='0c97599431882245a156470bd51290e327e7ee78';
function setup(profileId='configured-themes',{pinnedLauncher=false,
 changedNodeFlags=false,misroutedTaskVbs=false,brokenLockContract=false}={}){
 const home='E:\\ZGmini\\data\\pc-writer\\'+profileId;
 const taskName='ZGMINI-PC-'+profileId.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('-');
 const launcher='SCHEDULED.cmd';
 const sourceBlobs={
  'config/job.json':Buffer.from('{"approved":true}\n'),
  'docs/README.md':Buffer.from('# Versioned job\n'),
  'scripts/pc-writer/job.mjs':Buffer.from(pinnedLauncher?
   "const lockPath='state/scheduled.lock';\nconst lockFd=openSync(lockPath,'"+
   (brokenLockContract?'w':'wx')+"');\n"+
   "const dbSchema='ZGMINI_DB_SCHEMA_V1';\n"+
   "const checkpoint='ZGMINI_CHECKPOINT_SCHEMA_V1';\nexport default 7;\n":
   'export default 7;\n'),
 };
 const files=Object.entries(sourceBlobs).map(([p,b])=>({
  path:p,sha256:hash(b),bytes:b.length
 }));
 const version=hash(JSON.stringify(Object.fromEntries(files.map(x=>[x.path,x.sha256])))).slice(0,16);
 const oldVersion='1111111111111111';
 const taskXml=Buffer.from(pinnedLauncher?
  '<Task><Actions><Exec><Command>wscript.exe</Command><Arguments>"'+
  (misroutedTaskVbs?'C:\\Foreign':home)+'\\SCHEDULED.vbs"</Arguments></Exec></Actions></Task>\n':
  '<Task>fixed</Task>\n');
 const previousCmd='@echo off\r\n"E:\\ZGmini\\runtime\\node.exe" "'+
  home+'\\versions\\'+oldVersion+'\\scripts\\pc-writer\\job.mjs" scheduled\r\n';
 const nextCmd=previousCmd.replace(oldVersion,version).replace(
  '"E:\\ZGmini\\runtime\\node.exe"',
  '"E:\\ZGmini\\runtime\\node.exe"'+(changedNodeFlags?' --trace-warnings':''));
 const originalLauncher=Buffer.from(pinnedLauncher?previousCmd:'@echo off\r\nrem old\r\n');
 const targetLauncher=Buffer.from(pinnedLauncher?nextCmd:'@echo off\r\nrem new\r\n');
 const fixedVbs=Buffer.from('WScript.CreateObject("WScript.Shell").Run "SCHEDULED.cmd"\r\n');
 const originalMarker=Buffer.from('{"version":"old"}\n');
 const targetMarker=Buffer.from('{"version":"'+version+'"}\n');
 const zip=Buffer.from('approved zip fixture, no executable unzip\n');
 const identity={sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha:SHA40};
 const registry={schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',
  profiles:[{id:profileId,binding:identity,
   rootSegments:['pc-writer',profileId],files:[],directories:[],tasks:[],
   bundleProfile:{id:profileId,home,taskName,taskTime:'13:00',
    requiredLaunchers:[launcher],optionalLaunchers:pinnedLauncher?['SCHEDULED.vbs']:[],
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
 const pinnedApproval={requestId:'dd80405f-e159-4ad0-9d92-4e5fcaed0e3b',
  rawManifestSha256:hash(rawManifest),
  approvalRef:'approvals/versioned-bundle/pinned-fixture.json',
  sourceSha:SHA40,profileId};
 const oldFiles=files.map(x=>({...x}));
 const approvedEvidence={schema:'ZGMINI_IMMUTABLE_PINNED_LAUNCHER_EVIDENCE_V1',
  profileId,sourceSha:SHA40,taskXmlSha256:hash(taskXml),
  oldVersion,newVersion:version,taskVbsName:'SCHEDULED.vbs',
  taskVbsSha256:hash(fixedVbs),launcherNames:[launcher],oldFiles,
  lockPathMarker:'state/scheduled.lock',exclusiveLockMarker:"'wx'",
  dbSchemaMarker:'ZGMINI_DB_SCHEMA_V1',
  checkpointMarker:'ZGMINI_CHECKPOINT_SCHEMA_V1'};
 const evidenceRaw=Buffer.from(JSON.stringify(approvedEvidence));
 return {manifest,registryBytes,hostApprovedRegistrySha256:hash(registryBytes),
  requestIdentity:identity,rawManifest,pinnedApproval,sourceBlobs,
  zip,taskXml,launcher,originalLauncher,targetLauncher,originalMarker,targetMarker,
  pinnedLauncher,oldVersion,oldFiles,fixedVbs,evidenceRaw};
}
function makeBridge(f,{failAt=null,sourceTampered=false,taskDrift=false,
 handleDrift=false,mixedRuntimeUnsafe=false,
 priorExact=false,priorCorrupt=false,pinnedEvidenceUnapproved=false,
 pinnedEvidenceTampered=false,oldVersionCorrupt=false,
 simulateTaskTick=false}={}){
 const current={launcher:Buffer.from(f.originalLauncher),
  marker:Buffer.from(f.originalMarker),promoted:false};
 const stage=new Map(),backups=new Map(),steps=[],externalEffects=[];
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
   inject('auth');return {verified:pin.rawManifestSha256===rawSha256,rawSha256,
    compatibilityEvidenceSha256:f.pinnedLauncher&&!pinnedEvidenceUnapproved?
     hash(f.evidenceRaw):null};
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
  async readLauncherBytes({launcherName}){
   return launcherName==='SCHEDULED.vbs'?f.fixedVbs:current.launcher;
  },
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
  async inspectImmutableVersion({approvedFiles,fileListSha256,version}){
   inject('inspect-version');
   if(f.pinnedLauncher&&version===f.oldVersion){
    const good=!oldVersionCorrupt&&approvedFiles.length===f.oldFiles.length&&
     approvedFiles.every(item=>f.oldFiles.some(old=>old.path===item.path&&
      old.sha256===item.sha256&&old.bytes===item.bytes));
    return {exists:true,exactVerified:good,
     fileListSha256:good?fileListSha256:hash('old-corrupted'),
     fileCount:f.oldFiles.length};
   }
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
   if(f.pinnedLauncher)return {strategy:'IMMUTABLE_VERSION_PINNED_LAUNCHER',
    evidenceRawBytes:pinnedEvidenceTampered?Buffer.from('{}'):f.evidenceRaw};
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
   if(simulateTaskTick){
    steps.push('scheduler-tick-after-'+kind);
    externalEffects.push({version:current.launcher.equals(f.targetLauncher)?
     f.manifest.bundle.version:f.oldVersion,kind});
   }
   if(failAt==='cas-'+kind)throw Error('AFTER_CAS_FAULT');
   return {atomicRename:true,fsynced:true,aclPreserved:true,
    handleBound:true,noReparse:true,afterSha256:hash(afterBytes)};
  },
  async readInstalledVersionFile({path,version}){
   if(f.pinnedLauncher&&version===f.oldVersion)return f.sourceBlobs[path];
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
 return {bridge,current,steps,backups,externalEffects,saved:()=>savedLock};
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
test('Windows bridge rejects old slug request IDs before claiming shared lock',async()=>{
 const f=setup(),driver=makeBridge(f);
 const adapter=makeWindowsVersionedBundleAdapterCandidate({
  manifest:f.manifest,registryBytes:f.registryBytes,
  hostApprovedRegistrySha256:f.hostApprovedRegistrySha256,
  requestIdentity:f.requestIdentity,bridge:driver.bridge,
 });
 await assert.rejects(adapter.acquireSharedWriterLock({
  requestId:'approved-bundle-request-001',profileId:f.manifest.profileId,
 }),e=>e.code==='B_WINDOWS_REQUEST_ID');
 assert.deepEqual(driver.steps,[]);
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
test('pinned immutable launcher activates only with authenticated byte-level evidence',async()=>{
 const f=setup('configured-themes',{pinnedLauncher:true});
 const driver=makeBridge(f,{simulateTaskTick:true});
 const result=await execute(f,driver);
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.deepEqual(driver.current.launcher,f.targetLauncher);
 assert.ok(driver.steps.includes('scheduler-tick-after-launcher'));
 assert.ok(driver.steps.includes('scheduler-tick-after-active-record'));
 assert.deepEqual(driver.externalEffects.map(x=>x.version),
  [f.manifest.bundle.version,f.manifest.bundle.version]);
});
test('pinned version proof without raw authenticated SHA never reaches stage/CAS',async()=>{
 for(const options of [{pinnedEvidenceUnapproved:true},
  {pinnedEvidenceTampered:true},{oldVersionCorrupt:true}]){
  const f=setup('configured-themes',{pinnedLauncher:true});
  const driver=makeBridge(f,options);
  const result=await execute(f,driver);
  assert.equal(result.status,'BLOCKED',JSON.stringify(result));
  assert.equal(result.code,'B_WINDOWS_PINNED_LAUNCHER_NOT_PROVEN');
  assert.equal(driver.steps.includes('stage-file'),false);
  assert.equal(driver.steps.includes('backup'),false);
  assert.equal(driver.steps.includes('cas-launcher'),false);
 }
});
test('pinned launcher rejects changed Node flags, redirected Task VBS, or missing lock',async()=>{
 for(const option of [{changedNodeFlags:true},{misroutedTaskVbs:true},
  {brokenLockContract:true}]){
  const f=setup('configured-themes',{pinnedLauncher:true,...option});
  const driver=makeBridge(f);
  const result=await execute(f,driver);
  assert.equal(result.status,'BLOCKED',JSON.stringify({option,result}));
  assert.equal(result.code,'B_WINDOWS_PINNED_LAUNCHER_NOT_PROVEN');
  assert.equal(driver.steps.includes('stage-file'),false);
  assert.equal(driver.steps.includes('backup'),false);
 }
});
test('schedule tick after first CAS can leave external effects despite file rollback',async()=>{
 const f=setup('configured-themes',{pinnedLauncher:true});
 const driver=makeBridge(f,{simulateTaskTick:true,failAt:'cas-launcher'});
 const result=await execute(f,driver);
 assert.equal(result.status,'BLOCKED',JSON.stringify(result));
 assert.equal(result.rollback,'VERIFIED');
 assert.deepEqual(driver.current.launcher,f.originalLauncher);
 assert.deepEqual(driver.current.marker,f.originalMarker);
 // The in-flight process launched the new immutable version. Writer-B can
 // restore files but cannot undo that process's DB/checkpoint effects.
 assert.equal(driver.externalEffects.length,1);
 assert.equal(driver.externalEffects[0].version,f.manifest.bundle.version);
});
