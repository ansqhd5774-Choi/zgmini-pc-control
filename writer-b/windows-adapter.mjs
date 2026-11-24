#!/usr/bin/env node
// Source-only generic Writer B Windows adapter. NOT a pc-job operation,
// Controller maintenance command, scheduled job or authorization shortcut.
// This file must pass the approved owner Issue / manifest SHA checks before
// it can access the operational checkout. No deployment occurs on PR creation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {sha256} from './contract.mjs';
import {materializeApprovedWriterFile} from './insert-only-patch.mjs';
import {verifyWriterBImportAvailability} from './import-availability.mjs';
import {approvalPathFromIssue,verifyReadOnlyPreflight} from './preflight.mjs';
import {performWriterBInstall} from './installer.mjs';
import {commitApprovedWriterBOverlay} from './git-stage.mjs';
import {buildLocalOverlayProvenance,
 writeImmutableLocalProvenance} from './provenance.mjs';
import {snapshotUnrelatedDirty} from './unrelated-snapshot.mjs';
import {decodeTaskXmlBytes,coreQuietFromProbe,
 coreReadyForMaintenance,coreMaintenanceWindowBlockCode,inhibitCoreStarts,
 attestTaskFirstHopLauncher} from './windows-guards.mjs';
import {awaitNaturalCoreIdle,isReservedCoreMaintenance,coreDrainWaitMs,
 MAX_POST_PREPARE_IDLE_WAIT_MS} from './core-idle-window.mjs';
import {sameTaskDefinitionExceptSettingsEnabled} from '../r17-writer-b/r17-b-xml.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim} from '../r17-writer-b/r17-b-claim.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PROBE=path.join(ROOT,'..','r17-writer-b','r17-b-windows-probe.js');
const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const CORE_CYCLE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const JOURNALS=String.raw`E:\ZGmini\data\pc-writer\writer-b-install-once`;
const WRITER_DATA_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
const SHA40=/^[0-9a-f]{40}$/i;
const BINARY=Object.freeze({
 git:[String.raw`C:\Program Files\Git\cmd\git.exe`,
      String.raw`C:\Program Files\Git\bin\git.exe`].find(p=>fs.existsSync(p)),
 schtasks:path.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32','schtasks.exe'),
 cscript:path.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32','cscript.exe'),
});
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const now=()=>new Date().toISOString();

function exec(name,args,{cwd,stdin,env={}}={}){
 need(Object.hasOwn(BINARY,name)&&typeof BINARY[name]==='string'&&
   fs.existsSync(BINARY[name]),'WRITER_B_EXECUTABLE_SCOPE_STOP');
 const out=spawnSync(BINARY[name],args,{cwd,windowsHide:true,shell:false,
  input:stdin,encoding:null,maxBuffer:4_000_000,timeout:45_000,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',...env}});
 need(out.status===0&&!out.error,'WRITER_B_EXECUTION_FAILED_STOP');
 return out.stdout;
}
const git=(dir,...args)=>exec('git',['-C',dir,'-c','core.fsmonitor=false',...args])
  .toString('utf8').trim();
const gitRaw=(dir,args,options={})=>exec('git',
  ['-C',dir,'-c','core.fsmonitor=false',...args],options);
let emptyHooks=null;
function gitLive(...args){
 need(emptyHooks&&fs.readdirSync(emptyHooks).length===0,
  'WRITER_B_EMPTY_HOOK_SCOPE_STOP');
 return exec('git',['-c',`core.hooksPath=${emptyHooks}`,
  '-c','core.fsmonitor=false',...args]).toString('utf8').trim();
}
function rawSafe(file,root){
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=2_000_000,
  'WRITER_B_REGULAR_FILE_STOP');
 const parent=fs.realpathSync.native(root).toLowerCase()+path.sep;
 need(fs.realpathSync.native(file).toLowerCase().startsWith(parent),
  'WRITER_B_REALPATH_SCOPE_STOP');
 return fs.readFileSync(file);
}
function scoped(root,relative){return path.join(root,...relative.split('/'));}
function fixedTaskXml(task){
 const raw=exec('schtasks',['/Query','/TN',task,'/XML']);
 const xml=decodeTaskXmlBytes(raw);
 return {raw,xml,normalized:sameTaskDefinitionExceptSettingsEnabled(xml)};
}
function taskProbe(){
 const out=exec('cscript',['//NoLogo',PROBE]);let x;
 try{x=JSON.parse(out.toString('utf8').trim());}catch{stop('WRITER_B_TASK_PROBE_JSON_STOP');}
 need(x?.ok===true&&typeof x.enabled==='boolean'&&
  Number.isInteger(x.state)&&Number.isInteger(x.instances)&&x.instances>=0&&
  Number.isInteger(x.relatedProcesses)&&x.relatedProcesses>=0&&
  Number.isInteger(x.unknownProcessLines)&&x.unknownProcessLines>=0,
  'WRITER_B_TASK_PROBE_STOP');
 return x;
}
function taskQuiet(task){return coreQuietFromProbe(task,fs.existsSync(CORE_CYCLE_LOCK));}
function readConfig(file){
 const raw=rawSafe(file,path.dirname(file));let json;
 try{json=JSON.parse(raw.toString('utf8'));}catch{stop('WRITER_B_CONFIG_JSON_STOP');}
 need(json&&typeof json==='object'&&SHA40.test(json.source??''),
  'WRITER_B_CONFIG_SOURCE_STOP');return {raw,json};
}
function replaceConfigOnly(raw,from,to){
 const text=raw.toString('utf8');
 const matches=[...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/gi)];
 need(matches.length===1&&matches[0][1]===from,'WRITER_B_CONFIG_CAS_STOP');
 const swapped=text.slice(0,matches[0].index)+matches[0][0].replace(from,to)+
  text.slice(matches[0].index+matches[0][0].length);
 const oldJson=JSON.parse(text),newJson=JSON.parse(swapped);
 need(JSON.stringify({...oldJson,source:to})===JSON.stringify(newJson),
  'WRITER_B_CONFIG_ONLY_SOURCE_STOP');
 return Buffer.from(swapped,'utf8');
}
function atomicBytes(file,bytes,id){
 const tmp=`${file}.writer-b-${id}.tmp`;
 need(!fs.existsSync(tmp),'WRITER_B_TEMP_COLLISION_STOP');
 fs.writeFileSync(tmp,bytes,{flag:'wx'});
 try{fs.renameSync(tmp,file);}catch{stop('WRITER_B_CONFIG_ATOMIC_RENAME_STOP');}
 need(fs.readFileSync(file).equals(bytes),'WRITER_B_CONFIG_ATOMIC_READBACK_STOP');
}

function durableBackup(file,bytes){
 const raw=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes,'utf8');
 const fd=fs.openSync(file,'wx');
 try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 need(fs.readFileSync(file).equals(raw),'WRITER_B_BACKUP_READBACK_STOP');
}

function statusSnapshot(root,manifest){
 const raw=gitRaw(root,['status','--porcelain=v1','-z','--untracked-files=all']);
 return snapshotUnrelatedDirty({sourceRoot:root,statusBytes:raw,manifest});
}
function sameUnrelated(root,manifest,saved){
 const current=statusSnapshot(root,manifest);
 need(current.porcelainSha256===saved.porcelainSha256&&
  JSON.stringify(current.evidence)===JSON.stringify(saved.evidence),
  'WRITER_B_UNRELATED_DIRTY_DRIFT_STOP');
}

function approvedRuntimeConsumerHash(file){
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size>0&&stat.size<=131072,
  'WRITER_B_RUNTIME_FILE_SHAPE_STOP');
 // C: compatibility junction is acceptable ONLY when its native target
 // resolves inside the existing E: Writer data root.
 const root=fs.realpathSync.native(WRITER_DATA_ROOT).toLowerCase()+path.sep;
 need(fs.realpathSync.native(file).toLowerCase().startsWith(root),
  'WRITER_B_RUNTIME_FILE_REALPATH_STOP');
 return sha256(fs.readFileSync(file));
}

export function makeWindowsBAdapter(auth,{candidateRoot,controlRoot}){
 const m=auth.manifest;
 const source=m.sourceRoot;
 const task=m.coreTask;
 let fd=null,originalConfig=null,originalXml=null,dirty=null,prepared=null;
 let before=null;
 const journalDir=path.join(JOURNALS,auth.requestId);
 const journalFile=path.join(journalDir,'journal.jsonl');
 const journal=(phase)=>{
  if(!fs.existsSync(journalFile))return;
  const f=fs.openSync(journalFile,'a');
  try{fs.writeSync(f,JSON.stringify({phase,at:now()})+'\n');fs.fsyncSync(f);}
  finally{fs.closeSync(f);}
 };
 const sourceRaw=file=>rawSafe(scoped(source,file),source);
 const sourceHash=file=>sha256(sourceRaw(file));
 const runtimeConsumerSha256=()=>Object.fromEntries(
  m.runtimeDependencies.consumers.map(entry=>[entry.path,
   approvedRuntimeConsumerHash(entry.path)]));
 const assertRuntimeConsumers=()=>{
  for(const entry of m.runtimeDependencies.consumers)
   need(approvedRuntimeConsumerHash(entry.path)===entry.sha256,
    'WRITER_B_RUNTIME_CONSUMER_DRIFT_STOP');
 };
 const assertBase=()=>{
  need(git(source,'rev-parse','HEAD')===m.baseHead&&
   git(source,'branch','--show-current')===before.originalBranch&&
   readConfig(m.configPath).raw.equals(originalConfig),
   'WRITER_B_BASE_CONCURRENT_DRIFT_STOP');
  sameUnrelated(source,m,dirty);
  assertRuntimeConsumers();
  for(const file of m.files){
   const target=scoped(source,file.path);
   if(file.change==='A')need(!fs.existsSync(target),'WRITER_B_ADD_CONFLICT_STOP');
   else need(sourceHash(file.path)===file.beforeSha256,
    'WRITER_B_SOURCE_CONCURRENT_DRIFT_STOP');
  }
 };
 const io={
  async acquireSharedWriterLock(requestId){
   need(requestId===auth.requestId,'WRITER_B_REQUEST_ID_STOP');
   fd=acquireInstallLock({journalRoot:JOURNALS,requestId,
    sharedLock:SHARED_LOCK}).fd;
  },
  async readPcPreimage(){
   need(fs.lstatSync(source).isDirectory()&&
    !fs.lstatSync(source).isSymbolicLink(),
    'WRITER_B_SOURCE_ROOT_REPARSE_STOP');
   const head=git(source,'rev-parse','HEAD');
   const branch=git(source,'branch','--show-current');
   originalConfig=readConfig(m.configPath).raw;
   originalXml=fixedTaskXml(task);
   const firstHop=attestTaskFirstHopLauncher({taskXml:originalXml.xml,
    manifest:m,realpath:fs.realpathSync.native});
   dirty=statusSnapshot(source,m);
   const t=taskProbe();
   before={sourceRoot:source,configPath:m.configPath,coreTask:task,
    head,configSource:JSON.parse(originalConfig.toString('utf8')).source,
    originalConfigSha256:sha256(originalConfig),
    originalTaskDefinitionSha256:sha256(originalXml.raw),
    originalBranch:branch,coreTaskEnabled:t.enabled,targetPathsClean:true,
    runtimeConsumerSha256:runtimeConsumerSha256(),
    firstHopEvidence:{code:firstHop.code,
     runtimeChainVerified:false,consumerId:firstHop.consumerId??null},
    beforeSha256:Object.fromEntries(m.files.map(f=>[f.path,
     f.change==='A'?(fs.existsSync(scoped(source,f.path))?'EXISTS':null):sourceHash(f.path)])),
    protectedSha256:Object.fromEntries(m.protectedFiles.map(f=>[f.path,sourceHash(f.path)])),
   };
   return before;
  },
  async readCandidate(){
   need(git(candidateRoot,'rev-parse','HEAD')===m.candidateSourceSha&&
    git(candidateRoot,'status','--porcelain=v1','--untracked-files=all')==='',
    'WRITER_B_CANDIDATE_DRIFT_STOP');
   const inputs=new Map(m.files.map(file=>[file.path,
    rawSafe(scoped(candidateRoot,file.path),candidateRoot)]));
   const hashes=Object.fromEntries([...inputs].map(([name,bytes])=>
    [name,sha256(bytes)]));
   // Probe only literal relative imports in exact approved AFTER bytes, not
   // arbitrary candidate files. Missing dependencies fail before request
   // claim, backup, Task disable or operational source modifications.
   const beforeFiles=new Map(m.files.filter(file=>file.change==='M')
    .map(file=>[file.path,sourceRaw(file.path)]));
   const after=new Map(m.files.map(file=>[file.path,
    materializeApprovedWriterFile(file,inputs.get(file.path),
     Object.hasOwn(file,'insertions')?beforeFiles.get(file.path):null)]));
   const sourceReal=fs.realpathSync.native(source).toLowerCase()+path.sep;
   verifyWriterBImportAvailability({afterFiles:after,beforeFiles,existing:relative=>{
    const file=scoped(source,relative);
    let stat;
    try{stat=fs.lstatSync(file);}
    catch(error){return {available:false,reason:
     error?.code==='ENOENT'?'NOT_FOUND':'READ_ERROR'};}
    if(stat.isSymbolicLink())return {available:false,reason:'SYMLINK'};
    if(!stat.isFile())return {available:false,reason:'NOT_FILE'};
    if(stat.size<=0||stat.size>2_000_000)
     return {available:false,reason:'SIZE'};
    let real;
    try{real=fs.realpathSync.native(file).toLowerCase();}
    catch{return {available:false,reason:'READ_ERROR'};}
    if(!real.startsWith(sourceReal))
     return {available:false,reason:'OUTSIDE_ROOT'};
    return true;
   }});
   return {sourceSha:m.candidateSourceSha,clean:true,sha256:hashes};
  },
  async claimRequest(requestId){
   need(requestId===auth.requestId&&fd!==null,'WRITER_B_CLAIM_LOCK_STOP');
   const claim=createInstallJournal({journalRoot:JOURNALS,
    requestId,sharedLock:SHARED_LOCK,fd});
   emptyHooks=claim.hooksDir;journal('CLAIMED');
  },
  async backupOriginal(snapshot){
   need(snapshot===before&&originalConfig&&originalXml,
    'WRITER_B_BACKUP_SOURCE_STOP');
   durableBackup(path.join(journalDir,'config.original.bin'),originalConfig);
   durableBackup(path.join(journalDir,'task.original.xml'),originalXml.raw);
   for(const file of m.files.filter(f=>f.change==='M')){
    const basename=file.path.replaceAll('/','__');
    durableBackup(path.join(journalDir,`${basename}.original.bin`),sourceRaw(file.path));
   }
   durableBackup(path.join(journalDir,'preimage.json'),
    JSON.stringify({head:before.head,branch:before.originalBranch,
     requestId:auth.requestId,manifestSha256:auth.manifestSha256,
     coreMaintenance:m.coreMaintenance??'NATURAL_IDLE',
     originalConfigSha256:before.originalConfigSha256,
     originalTaskDefinitionSha256:before.originalTaskDefinitionSha256,
     beforeSha256:before.beforeSha256,protectedSha256:before.protectedSha256}));
   journal('BACKED_UP');
  },
  async prepareIsolatedCommit(){
   assertBase();
   const stage=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-writer-b-'));
   git(stage,'init','-q');
   const sourceObjects=git(source,'rev-parse','--git-path','objects');
   const objects=fs.realpathSync.native(path.isAbsolute(sourceObjects)?
    sourceObjects:path.resolve(source,sourceObjects));
   need(fs.statSync(objects).isDirectory(),'WRITER_B_GIT_OBJECT_STORE_STOP');
   fs.writeFileSync(path.join(stage,'.git','objects','info','alternates'),
    objects.replaceAll('\\','/')+'\n',{flag:'wx'});
   git(stage,'read-tree',m.baseHead);
   const overlay=new Map();
   for(const file of m.files){
    const ls=git(source,'ls-tree',m.baseHead,'--',file.path);
    need(file.change==='M'?ls.startsWith('100644 blob '):ls==='',
     'WRITER_B_GIT_MODE_PREIMAGE_STOP');
    overlay.set(file.path,materializeApprovedWriterFile(file,
     rawSafe(scoped(candidateRoot,file.path),candidateRoot),
     Object.hasOwn(file,'insertions')?sourceRaw(file.path):null));
   }
   const sourceRef=`refs/heads/writer-b/${auth.requestId}`;
   const result=commitApprovedWriterBOverlay({stage,base:m.baseHead,
    manifestFiles:m.files,overlay,requestRef:sourceRef,run:git,runRaw:gitRaw});
   const provenance=buildLocalOverlayProvenance({auth,prepared:result,
    baseTreeOid:git(stage,'rev-parse',`${m.baseHead}^{tree}`),
    preparedTreeOid:git(stage,'rev-parse',`${result.sha}^{tree}`)});
   const digest=writeImmutableLocalProvenance({
    file:path.join(journalDir,'provenance.json'),bytes:provenance.bytes});
   need(digest===provenance.sha256,
    'WRITER_B_LOCAL_PROVENANCE_DIGEST_STOP');
   prepared={...result,stage,branch:`writer-b/${auth.requestId}`,
    baseTreeOid:provenance.record.baseTreeOid,
    preparedTreeOid:provenance.record.preparedTreeOid,
    provenanceSha256:digest,mode:'LOCAL_OVERLAY',localOnly:true};
   journal('STAGED');
   return prepared;
  },
  async waitForCoreIdleWindow(phase='PRECLAIM'){
   need(phase==='PRECLAIM'||phase==='POST_PREPARE',
    'WRITER_B_CORE_IDLE_PHASE_STOP');
   // Existing Core continues unmodified until two natural idle snapshots.
   await awaitNaturalCoreIdle({
    sample:()=>({probe:taskProbe(),lock:fs.existsSync(CORE_CYCLE_LOCK)}),
    wait:delay,clock:Date.now,
    isReady:coreReadyForMaintenance,
    blockCode:coreMaintenanceWindowBlockCode,
   },phase==='POST_PREPARE'?{windowMs:MAX_POST_PREPARE_IDLE_WAIT_MS}:undefined);
   journal(phase==='POST_PREPARE'?'CORE_POST_PREPARE_IDLE':'CORE_PREPAUSE_IDLE');
  },
  async pauseCore(){
   inhibitCoreStarts({assertBase,
    definitionMatches:()=>fixedTaskXml(task).normalized===originalXml.normalized,
    probe:taskProbe,cycleLockExists:()=>fs.existsSync(CORE_CYCLE_LOCK),journal,
    disable:()=>exec('schtasks',['/Change','/TN',task,'/Disable']),
   },{reserved:isReservedCoreMaintenance(m.coreMaintenance)});
  },
  async waitForCoreDrain(){
   let consecutive=0;const until=Date.now()+
    coreDrainWaitMs(m.coreMaintenance);
   while(Date.now()<until){
    consecutive=taskQuiet(taskProbe())?consecutive+1:0;
    if(consecutive>=2){journal('CORE_DRAINED');return;}
    await delay(1500);
   }
   stop('WRITER_B_CORE_NATURAL_DRAIN_TIMEOUT_STOP');
  },
  async assertCoreQuiet(){
   need(taskQuiet(taskProbe())&&
    fixedTaskXml(task).normalized===originalXml.normalized,
    'WRITER_B_CORE_QUIET_STOP');
  },
  async switchPreparedSource(artifact){
   need(artifact===prepared&&
    git(prepared.stage,'rev-parse','--verify',prepared.sourceRef)===prepared.sha,
    'WRITER_B_PREPARED_REF_DRIFT_STOP');
   assertBase();
   await io.assertCoreQuiet();
   for(const file of m.files){
    const attr=git(source,'check-attr','filter','--',file.path);
    need(attr===`${file.path}: filter: unspecified`||
     attr===`${file.path}: filter: unset`,
     'WRITER_B_GIT_FILTER_ATTR_STOP');
   }
   const localRef=`refs/heads/${prepared.branch}`;
   need(git(source,'show-ref','--heads').split(/\r?\n/).every(line=>
    !line.endsWith(' '+localRef)),'WRITER_B_REF_COLLISION_STOP');
   gitLive('-C',source,'fetch','--no-tags','--no-write-fetch-head',
    prepared.stage,`${prepared.sourceRef}:${localRef}`);
   need(git(source,'rev-parse','--verify',localRef)===prepared.sha,
    'WRITER_B_LIVE_FETCH_READBACK_STOP');
   gitLive('-C',source,'switch',prepared.branch);
   journal('SOURCE_SWITCHED');
  },
  async assertWriterSource(artifact){
   need(artifact===prepared&&git(source,'rev-parse','HEAD')===prepared.sha&&
    git(source,'branch','--show-current')===prepared.branch,
    'WRITER_B_LIVE_SOURCE_SHA_STOP');
   for(const file of m.files)need(sourceHash(file.path)===file.afterSha256,
    'WRITER_B_LIVE_TARGET_SHA_STOP');
   for(const file of m.protectedFiles)need(sourceHash(file.path)===file.sha256,
    'WRITER_B_LIVE_PROTECTED_SHA_STOP');
   sameUnrelated(source,m,dirty);
   assertRuntimeConsumers();
  },
  async changeConfigSource(from,to){
   need(from===m.baseHead&&to===prepared?.sha&&
    fs.readFileSync(m.configPath).equals(originalConfig),
    'WRITER_B_CONFIG_EXTERNAL_DRIFT_STOP');
   atomicBytes(m.configPath,replaceConfigOnly(originalConfig,from,to),auth.requestId);
   journal('CONFIG_SWITCHED');
  },
  async assertConfigSource(target){
   need(readConfig(m.configPath).json.source===target,
    'WRITER_B_CONFIG_TARGET_SHA_STOP');
  },
  async restoreCore(){
   need(fixedTaskXml(task).normalized===originalXml.normalized,
    'WRITER_B_CORE_RESTORE_TASK_XML_DRIFT_STOP');
   const state=taskProbe();
   if(state.enabled){
    need(fixedTaskXml(task).normalized===originalXml.normalized,
     'WRITER_B_CORE_ENABLED_DRIFT_STOP');return;
   }
   const head=git(source,'rev-parse','HEAD'),cfg=readConfig(m.configPath).json.source;
   need((head===m.baseHead&&cfg===m.baseHead)||
    (head===prepared?.sha&&cfg===prepared.sha&&taskQuiet(state)),
    'WRITER_B_CORE_REENABLE_SOURCE_PAIR_STOP');
   exec('schtasks',['/Change','/TN',task,'/Enable']);
   journal('CORE_RESUMED');
  },
  async verifyCoreDefinitionUnchanged(){
   need(taskProbe().enabled&&
    fixedTaskXml(task).normalized===originalXml.normalized,
    'WRITER_B_TASK_DEFINITION_DRIFT_STOP');
  },
  async prepareRollback(before,artifact){
   need(artifact===prepared,'WRITER_B_ROLLBACK_PREPARED_IDENTITY_STOP');
   const assertOwned=()=>{
    const head=git(source,'rev-parse','HEAD');
    const branch=git(source,'branch','--show-current');
    need((head===m.baseHead&&branch===before.originalBranch)||
      (head===prepared.sha&&branch===prepared.branch),
      'WRITER_B_ROLLBACK_SOURCE_EXTERNAL_DRIFT_STOP');
    const config=fs.readFileSync(m.configPath);
    need(config.equals(originalConfig)||
      config.equals(replaceConfigOnly(originalConfig,m.baseHead,prepared.sha)),
      'WRITER_B_CONFIG_ROLLBACK_DRIFT_STOP');
    sameUnrelated(source,m,dirty);
   };
   assertOwned();
   need(fixedTaskXml(task).normalized===originalXml.normalized,
    'WRITER_B_CORE_PREPAUSE_TASK_XML_DRIFT_STOP');
   if(!taskProbe().enabled)return; // Already paused by this exact owned transaction.
   if(m.coreMaintenance!=='PAUSE_NEW_STARTS_DRAIN_360S_V1')await io.waitForCoreIdleWindow();
   inhibitCoreStarts({assertBase:assertOwned,
    definitionMatches:()=>fixedTaskXml(task).normalized===originalXml.normalized,
    probe:taskProbe,cycleLockExists:()=>fs.existsSync(CORE_CYCLE_LOCK),journal,
    disable:()=>exec('schtasks',['/Change','/TN',task,'/Disable']),
   },{reserved:isReservedCoreMaintenance(m.coreMaintenance)});
   journal('ROLLBACK_CORE_PAUSED');
  },
  async restoreOriginalConfig(){
   const current=fs.readFileSync(m.configPath);
   if(current.equals(originalConfig))return;
   need(prepared&&current.equals(replaceConfigOnly(originalConfig,m.baseHead,prepared.sha)),
    'WRITER_B_CONFIG_ROLLBACK_DRIFT_STOP');
   atomicBytes(m.configPath,originalConfig,auth.requestId+'-rollback');
   journal('CONFIG_ROLLED_BACK');
  },
  async restoreOriginalSource(){
   const head=git(source,'rev-parse','HEAD'),branch=git(source,'branch','--show-current');
   if(head===m.baseHead&&branch===before.originalBranch)return;
   need(prepared&&head===prepared.sha&&branch===prepared.branch&&
    taskQuiet(taskProbe()),'WRITER_B_SOURCE_ROLLBACK_DRIFT_STOP');
   gitLive('-C',source,'switch',before.originalBranch);
   journal('SOURCE_ROLLED_BACK');
  },
  async verifyOriginalState(){
   need(git(source,'rev-parse','HEAD')===m.baseHead&&
    git(source,'branch','--show-current')===before.originalBranch&&
    fs.readFileSync(m.configPath).equals(originalConfig)&&
    fixedTaskXml(task).normalized===originalXml.normalized&&taskProbe().enabled,
    'WRITER_B_ORIGINAL_STATE_STOP');
   for(const file of m.files){
    if(file.change==='A')need(!fs.existsSync(scoped(source,file.path)),
     'WRITER_B_ROLLBACK_ADDED_FILE_STOP');
    else need(sourceHash(file.path)===file.beforeSha256,
     'WRITER_B_ROLLBACK_TARGET_SHA_STOP');
   }
   for(const file of m.protectedFiles)need(sourceHash(file.path)===file.sha256,
    'WRITER_B_ROLLBACK_PROTECTED_SHA_STOP');
   sameUnrelated(source,m,dirty);
   assertRuntimeConsumers();
  },
  async releaseSharedWriterLock({requestId,retain}){
   need(requestId===auth.requestId&&fd!==null,'WRITER_B_LOCK_OWNER_STOP');
   journal(retain?'RECOVERY_REQUIRED':'FINALIZED');
   releaseInstallClaim({fd,sharedLock:SHARED_LOCK,requestId,retain});
   fd=null;
  },
 };
 return io;
}

async function main(){
 need(process.platform==='win32','WRITER_B_WINDOWS_HOST_STOP');
 const workspace=process.env.GITHUB_WORKSPACE;
 need(typeof workspace==='string'&&workspace.length>0,
  'WRITER_B_WORKSPACE_STOP');
 const controlRoot=path.join(workspace,'writer-b-control');
 const candidateRoot=path.join(workspace,'writer-b-candidate');
 const head=git(controlRoot,'rev-parse','HEAD');
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const relative=approvalPathFromIssue(event);
 const approvalRoot=path.join(controlRoot,'approvals','writer-updates');
 need(fs.lstatSync(approvalRoot).isDirectory()&&
  !fs.lstatSync(approvalRoot).isSymbolicLink()&&
  fs.realpathSync.native(approvalRoot).toLowerCase().startsWith(
   fs.realpathSync.native(controlRoot).toLowerCase()+path.sep),
  'WRITER_B_APPROVAL_DIRECTORY_SCOPE_STOP');
 const target=scoped(controlRoot,relative);
 const bytes=rawSafe(target,approvalRoot);
 const auth=verifyReadOnlyPreflight({event,env:process.env,
  manifestBytes:bytes,controlHead:head});
 need(git(candidateRoot,'rev-parse','HEAD')===auth.manifest.candidateSourceSha,
  'WRITER_B_EXACT_CANDIDATE_SHA_STOP');
 const result=await performWriterBInstall(auth,
  makeWindowsBAdapter(auth,{candidateRoot,controlRoot}));
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.status!=='WRITER_B_INSTALLED_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch(error){
  process.stdout.write(JSON.stringify({status:'WRITER_B_SETUP_STOP',
   code:/^WRITER_B_[A-Z0-9_]+$/.test(error?.code??'')?error.code:
    'WRITER_B_SETUP_UNEXPECTED_STOP'})+'\n');
  process.exitCode=1;
 }
}

