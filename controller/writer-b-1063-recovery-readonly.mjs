// One incident, one fixed Writer B request: bounded read-only recovery evidence.
// Never treats a diagnostic PASS as authorization to resume, unlock, or retry.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeTaskXmlBytes} from '../writer-b/windows-guards.mjs';
import {sameTaskDefinitionExceptSettingsEnabled} from '../r17-writer-b/r17-b-xml.mjs';

export const WRITER_B_1063_REQUEST_ID='bd435d7c-2939-457f-907c-98d551f6b8cf';
const M_FILE='lib/market-score/employment-r6-collector.mjs';
const M_BACKUP='lib__market-score__employment-r6-collector.mjs.original.bin';
const M_BEFORE='5be5155196c8539639f6bb5228d5af145646e0aff7f7c92a86ba3341d83efc39';
const M_AFTER='f22b2f1447e462d3101caf027323572606db61352ab6a53524dd406cca7a4915';
const BASE='825cfbd6e2025940e3e48631e7ff1dddf582e75a';
const CANDIDATE='b1541453df0a92af748eb8e191c96bb3ef1e6071';
const MANIFEST='984ee506c54c1c97de31d5af4d0369cc2e8c0b5557334146748628110be709f7';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA40=/^[0-9a-f]{40}$/i;
const SHA64=/^[0-9a-f]{64}$/i;
const PHASES=new Set([
 'CLAIMED','BACKED_UP','STAGED','CORE_PREPAUSE_IDLE','TASK_PAUSED',
 'CORE_DRAINED','CORE_POST_PREPARE_IDLE','SOURCE_SWITCHED','CONFIG_SWITCHED',
 'CORE_RESUMED','CONFIG_ROLLED_BACK','SOURCE_ROLLED_BACK',
 'RECOVERY_REQUIRED','FINALIZED',
]);
const ROOT=String.raw`E:\ZGmini\data\pc-writer`;
const DEFAULT_PATHS=Object.freeze({
 journalDir:path.win32.join(ROOT,'writer-b-install-once',WRITER_B_1063_REQUEST_ID),
 lockPath:path.win32.join(ROOT,'writer-source-install.lock'),
 coreCycleLockPath:path.win32.join(ROOT,'local-cycle.lock'),
 configPath:path.win32.join(ROOT,'config.json'),
 sourceRoot:String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`,
});
const sha256=b=>createHash('sha256').update(b).digest('hex');
const localPath=x=>{
 need(typeof x==='string'&&x.length>0,'WRITER_B_1063_PATH_INVALID');
 if(process.platform!=='win32'){
  need(!x.startsWith('\\\\?\\'),'WRITER_B_1063_PATH_INVALID');
  return path.normalize(x);
 }
 // Allow only the Windows local-drive long-path spelling, never UNC/devices.
 const stripped=/^\\\\\?\\[A-Za-z]:\\/.test(x)?x.slice(4):x;
 need(!stripped.startsWith('\\\\?\\')&&
  /^[A-Za-z]:\\/.test(stripped),'WRITER_B_1063_PATH_INVALID');
 return path.win32.normalize(stripped);
};
const canonicalFixedDir=(io,dir)=>{
 const st=io.lstatSync(dir);
 need(st.isDirectory()&&!st.isSymbolicLink(),
  'WRITER_B_1063_DIRECTORY_UNSAFE');
 const actual=io.realpathSync.native(dir);
 need(localPath(actual).toLowerCase()===
  localPath(path.resolve(dir)).toLowerCase(),
  'WRITER_B_1063_DIRECTORY_JUNCTION_ESCAPE');
 return localPath(actual);
};
const unknown=code=>({status:'STATE_UNKNOWN',code,
 incident:'WRITER_B_1063',requestId:WRITER_B_1063_REQUEST_ID,
 recoveryAuthorized:false,runtimeSourceVerified:false,operationalWrites:0,
 providerCalls:0,d1Writes:0,sqliteOpened:false});
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const within=(root,file)=>{
 const normalizedRoot=localPath(root).toLowerCase();
 const normalizedFile=localPath(file).toLowerCase();
 return normalizedFile.startsWith(normalizedRoot+path.sep);
};

// Only literal files in the exact approved incident directory are read.
// No directory traversal, recursive enumeration, or caller-provided paths.
function fixedBytes(file,{io,limit,withinRoot}){
 const before=io.lstatSync(file);
 need(before.isFile()&&!before.isSymbolicLink()&&
  Number.isSafeInteger(before.size)&&before.size>0&&before.size<=limit,
  'WRITER_B_1063_FILE_NOT_REGULAR_BOUNDED');
 const actual=io.realpathSync.native(file);
 need(within(withinRoot,actual),'WRITER_B_1063_FILE_ESCAPE');
 // Fd-based bounded read avoids replacing the checked file with another one.
 // This is the same check pattern as controller/fixed-readonly-bytes.mjs.
 const flags=process.platform==='win32'?'r':
  fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0);
 let fd;
 try{
  fd=io.openSync(file,flags);
  const opened=io.fstatSync(fd);
  need(opened.isFile()&&opened.size===before.size&&
   (!opened.ino||!before.ino||opened.ino===before.ino)&&
   (!opened.dev||!before.dev||opened.dev===before.dev),
   'WRITER_B_1063_FILE_CHANGED_WHILE_READING');
  const bytes=Buffer.alloc(opened.size);
  let length=0;
  while(length<bytes.length){
   const n=io.readSync(fd,bytes,length,bytes.length-length,length);
   need(Number.isSafeInteger(n)&&n>0,'WRITER_B_1063_FILE_SHORT_READ');
   length+=n;
  }
  const after=io.fstatSync(fd);
  need(after.isFile()&&after.size===opened.size&&
   (!opened.ino||!after.ino||opened.ino===after.ino)&&
   (!opened.dev||!after.dev||opened.dev===after.dev)&&
   (!Number.isFinite(opened.mtimeMs)||!Number.isFinite(after.mtimeMs)||
    opened.mtimeMs===after.mtimeMs),
   'WRITER_B_1063_FILE_CHANGED_WHILE_READING');
  return bytes;
 }finally{if(fd!==undefined)io.closeSync(fd);}
}
function strictObject(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
function validatedJournal(raw){
 need(raw.length>0&&raw.length<=8192,'WRITER_B_1063_JOURNAL_SIZE');
 const lines=raw.toString('utf8').split('\n');
 need(lines.at(-1)==='','WRITER_B_1063_PARTIAL_JOURNAL');
 lines.pop();
 need(lines.length>=1&&lines.length<=64,'WRITER_B_1063_JOURNAL_COUNT');
 const phases=lines.map((line,index)=>{
  need(line.length>0&&line.length<=512,'WRITER_B_1063_JOURNAL_LINE');
  const record=JSON.parse(line);
  need(strictObject(record)&&typeof record.at==='string'&&
   /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.at),
   'WRITER_B_1063_JOURNAL_FORMAT');
  const phase=index===0?record.status:record.phase;
  need(PHASES.has(phase)&&(index!==0||phase==='CLAIMED'),
   'WRITER_B_1063_JOURNAL_PHASE');
  return phase;
 });
 return {phases,lastPhase:phases.at(-1),entryCount:phases.length};
}
function validatedPreimage(raw){
 need(raw.length>0&&raw.length<=16384,'WRITER_B_1063_PREIMAGE_SIZE');
 const p=JSON.parse(raw.toString('utf8'));
 need(strictObject(p)&&p.head===BASE&&
  typeof p.branch==='string'&&p.branch.length>0&&p.branch.length<=160&&
  /^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(p.branch)&&!p.branch.includes('..')&&
  SHA64.test(p.originalConfigSha256??'')&&
  SHA64.test(p.originalTaskDefinitionSha256??'')&&
  strictObject(p.beforeSha256)&&
  Object.keys(p.beforeSha256).length===1&&
  Object.keys(p.beforeSha256)[0]===M_FILE&&p.beforeSha256[M_FILE]===M_BEFORE&&
  strictObject(p.protectedSha256)&&Object.keys(p.protectedSha256).length===0,
  'WRITER_B_1063_PREIMAGE_SCOPE_DRIFT');
 return p;
}
function validatedProvenance(raw){
 need(raw.length>0&&raw.length<=65536,'WRITER_B_1063_PROVENANCE_SIZE');
 const p=JSON.parse(raw.toString('utf8'));
 need(strictObject(p)&&
  p.schema==='ZGMINI_PC_WRITER_B_LOCAL_OVERLAY_PROVENANCE_V1'&&
  p.mode==='LOCAL_OVERLAY'&&p.localOnly===true&&
  p.requestId===WRITER_B_1063_REQUEST_ID&&p.manifestSha===MANIFEST&&
  p.baseHead===BASE&&p.candidateSourceSha===CANDIDATE&&
  SHA40.test(p.preparedLocalSha??'')&&p.preparedLocalSha!==BASE&&
  SHA40.test(p.baseTreeOid??'')&&SHA40.test(p.preparedTreeOid??'')&&
  p.baseTreeOid!==p.preparedTreeOid&&
  p.localRef===`refs/heads/writer-b/${WRITER_B_1063_REQUEST_ID}`&&
  Array.isArray(p.changedPaths)&&p.changedPaths.length===1&&
  p.changedPaths[0]===M_FILE&&
  Array.isArray(p.fileHashes)&&p.fileHashes.length===1&&
  strictObject(p.fileHashes[0])&&p.fileHashes[0].path===M_FILE&&
  p.fileHashes[0].change==='M'&&
  p.fileHashes[0].beforeSha256===M_BEFORE&&
  p.fileHashes[0].afterSha256===M_AFTER,
  'WRITER_B_1063_PROVENANCE_SCOPE_DRIFT');
 return p;
}
function defaultGit(sourceRoot,args){
 const bin=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync);
 need(!!bin,'WRITER_B_1063_GIT_MISSING');
 const out=spawnSync(bin,['-C',sourceRoot,'-c','core.fsmonitor=false',...args],{
  encoding:'utf8',windowsHide:true,shell:false,timeout:12000,maxBuffer:4096,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'},
 });
 need(out?.status===0&&!out.error&&typeof out.stdout==='string'&&
  out.stdout.length<=4096,'WRITER_B_1063_GIT_PROBE_UNAVAILABLE');
 return out.stdout.trim();
}
function defaultTaskXml(){
 const exe=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','schtasks.exe');
 const out=spawnSync(exe,['/Query','/TN','ZGMINI-PC-Local-Core','/XML'],{
  encoding:null,windowsHide:true,shell:false,timeout:12000,maxBuffer:262144,
 });
 need(out?.status===0&&!out.error&&Buffer.isBuffer(out.stdout)&&
  out.stdout.length>0&&out.stdout.length<=262144,
  'WRITER_B_1063_TASK_XML_UNAVAILABLE');
 return out.stdout;
}
function defaultTaskProbe(){
 const cscript=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','cscript.exe');
 const script=fileURLToPath(new URL('./writer-b-1063-task-probe.mjs',import.meta.url));
 const out=spawnSync(cscript,['//NoLogo','//E:JScript',script],{
  encoding:'utf8',windowsHide:true,shell:false,timeout:12000,maxBuffer:2048,
 });
 need(out?.status===0&&!out.error&&typeof out.stdout==='string'&&
  out.stdout.length>0&&out.stdout.length<=2048,
  'WRITER_B_1063_TASK_ENABLED_UNAVAILABLE');
 const answer=JSON.parse(out.stdout.trim());
 const keys=['enabled','instances','ok','relatedProcesses','state',
  'unknownProcessLines'];
 need(answer?.ok===true&&typeof answer.enabled==='boolean'&&
  Object.keys(answer).sort().join(',')===keys.join(',')&&
  [answer.instances,answer.relatedProcesses,answer.unknownProcessLines]
   .every(n=>Number.isSafeInteger(n)&&n>=0&&n<=65535)&&
  Number.isSafeInteger(answer.state)&&answer.state>=0&&answer.state<=4,
  'WRITER_B_1063_TASK_PROBE_UNAVAILABLE');
 return {enabled:answer.enabled,state:answer.state,instances:answer.instances,
  relatedProcesses:answer.relatedProcesses,
  unknownProcessLines:answer.unknownProcessLines};
}

function readCoreCycleLock(io,file){
 try{
  const parent=canonicalFixedDir(io,path.dirname(file));
  const st=io.lstatSync(file);
  // The Core lease can be represented as a file or directory. Presence only
  // is observed; it is never opened, removed, or treated as an install lock.
  need(!st.isSymbolicLink()&&(st.isFile()||st.isDirectory())&&
   within(parent,io.realpathSync.native(file)),
   'WRITER_B_1063_CORE_LOCK_UNSAFE');
  return true;
 }catch(error){
  if(error?.code==='ENOENT')return false;
  throw error;
 }
}
const coreQuietFromProbe=(probe,coreCycleLockPresent)=>
 probe.enabled===false&&[1,3].includes(probe.state)&&
 probe.instances===0&&probe.relatedProcesses===0&&
 probe.unknownProcessLines===0&&coreCycleLockPresent===false;

export function inspectWriterB1063Recovery({
 platform=process.platform,paths=DEFAULT_PATHS,io=fs,git=defaultGit,
 taskXml=defaultTaskXml,taskProbe=defaultTaskProbe,digest=sha256,
}={}){
 if(platform!=='win32')return unknown('WRITER_B_1063_WINDOWS_REQUIRED');
 try{
  // Reject a junction in the journal parent or other trusted E: ancestors.
  canonicalFixedDir(io,path.dirname(path.dirname(path.dirname(path.dirname(paths.journalDir)))));
  canonicalFixedDir(io,path.dirname(path.dirname(path.dirname(paths.journalDir))));
  canonicalFixedDir(io,path.dirname(path.dirname(paths.journalDir)));
  canonicalFixedDir(io,path.dirname(paths.journalDir));
  const root=canonicalFixedDir(io,paths.journalDir);
  const file=(name,limit)=>fixedBytes(path.join(root,name),{io,limit,withinRoot:root});
  const journalRaw=file('journal.jsonl',8192);
  const journal=validatedJournal(journalRaw);
  // BACKED_UP is the last guaranteed point at which all three backups exist.
  need(journal.phases.includes('BACKED_UP'),
   'WRITER_B_1063_JOURNAL_BEFORE_BACKUP');
  const preimageRaw=file('preimage.json',16384);
  const preimage=validatedPreimage(preimageRaw);
  const configOriginal=file('config.original.bin',65536);
  const taskOriginal=file('task.original.xml',262144);
  const moduleOriginal=file(M_BACKUP,2097152);
  const backups={
   configSha256:digest(configOriginal),taskXmlSha256:digest(taskOriginal),
   moduleSha256:digest(moduleOriginal),
  };
  need(backups.configSha256===preimage.originalConfigSha256&&
   backups.taskXmlSha256===preimage.originalTaskDefinitionSha256&&
   backups.moduleSha256===M_BEFORE,
   'WRITER_B_1063_BACKUP_HASH_MISMATCH');
  const provenanceRaw=journal.phases.includes('STAGED')?
   file('provenance.json',65536):null;
  const provenance=provenanceRaw?validatedProvenance(provenanceRaw):null;

  // Absence is a relevant lock observation, not permission to recreate/delete it.
  let lock={state:'ABSENT',owner:'NONE',matchesRequest:false};
  try{
   const lockRoot=canonicalFixedDir(io,path.dirname(paths.lockPath));
   const raw=fixedBytes(paths.lockPath,{io,limit:128,withinRoot:lockRoot});
   const owner=raw.toString('utf8');
   need(UUID.test(owner),'WRITER_B_1063_LOCK_UNRECOGNIZED');
   lock={state:'PRESENT',owner:owner===WRITER_B_1063_REQUEST_ID?
    WRITER_B_1063_REQUEST_ID:'OTHER_OWNER',matchesRequest:owner===WRITER_B_1063_REQUEST_ID};
  }catch(error){
   if(error?.code!=='ENOENT')throw error;
  }

  canonicalFixedDir(io,path.dirname(path.dirname(paths.sourceRoot)));
  canonicalFixedDir(io,path.dirname(paths.sourceRoot));
  const sourceRoot=canonicalFixedDir(io,paths.sourceRoot);
  const head=git(sourceRoot,['rev-parse','--verify','HEAD']);
  const branch=git(sourceRoot,['branch','--show-current']);
  need(SHA40.test(head)&&branch.length>0&&branch.length<=160&&
   /^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(branch)&&!branch.includes('..'),
   'WRITER_B_1063_SOURCE_PROBE_INVALID');
  const configRoot=canonicalFixedDir(io,path.dirname(paths.configPath));
  const configRaw=fixedBytes(paths.configPath,{io,limit:65536,withinRoot:configRoot});
  const config=JSON.parse(configRaw.toString('utf8'));
  need(SHA40.test(config?.source??''),'WRITER_B_1063_CONFIG_SOURCE_UNAVAILABLE');
  const xml=taskXml();
  need(Buffer.isBuffer(xml)&&xml.length>0&&xml.length<=262144,
   'WRITER_B_1063_TASK_XML_UNAVAILABLE');
   // A paused Task may differ from its original XML solely in Settings.Enabled.
   // Raw XML equality cannot distinguish that expected change from drift.
   const definitionMatchesOriginalExceptEnabled=
    sameTaskDefinitionExceptSettingsEnabled(decodeTaskXmlBytes(xml))===
    sameTaskDefinitionExceptSettingsEnabled(decodeTaskXmlBytes(taskOriginal));
  const probe=taskProbe();
  need(strictObject(probe)&&typeof probe.enabled==='boolean'&&
   [probe.instances,probe.relatedProcesses,probe.unknownProcessLines]
    .every(n=>Number.isSafeInteger(n)&&n>=0&&n<=65535)&&
   Number.isSafeInteger(probe.state)&&probe.state>=0&&probe.state<=4,
   'WRITER_B_1063_TASK_PROBE_UNAVAILABLE');
  const coreCycleLockPresent=readCoreCycleLock(io,paths.coreCycleLockPath);
  const coreQuietSnapshot=coreQuietFromProbe(probe,coreCycleLockPresent);
  const modulePath=path.join(sourceRoot,...M_FILE.split('/'));
  const liveModuleRaw=fixedBytes(modulePath,{io,limit:2097152,withinRoot:sourceRoot});
  const liveModuleSha256=digest(liveModuleRaw);
  const finalHead=git(sourceRoot,['rev-parse','--verify','HEAD']);
  need(finalHead.toLowerCase()===head.toLowerCase(),
   'WRITER_B_1063_SOURCE_CHANGED_DURING_PROBE');

  return {status:'PASS',code:'WRITER_B_1063_RECOVERY_EVIDENCE_READONLY',
   incident:'WRITER_B_1063',requestId:WRITER_B_1063_REQUEST_ID,
   recoveryStatus:'RECOVERY_REQUIRED',recoveryAuthorized:false,
   evidenceLevel:'FIXED_INCIDENT_PC_SNAPSHOT_NOT_RECOVERY_PROOF',
   journal:{sha256:digest(journalRaw),lastPhase:journal.lastPhase,
    entryCount:journal.entryCount},
   backups:{...backups,preimageSha256:digest(preimageRaw),matchPreimage:true,
    expectedModuleBeforeSha256:M_BEFORE},
   provenance:{present:!!provenance,sha256:provenanceRaw?digest(provenanceRaw):null,
    preparedLocalSha:provenance?.preparedLocalSha??null},
   lock,
   source:{head,configSource:config.source.toLowerCase(),
    module:{path:M_FILE,sha256:liveModuleSha256,
     state:liveModuleSha256===M_BEFORE?'BEFORE':
      liveModuleSha256===M_AFTER?'AFTER':'OTHER'},
    trackedDirty:'NOT_VERIFIED',
    headEqualsConfig:head.toLowerCase()===config.source.toLowerCase(),
    baseHead:BASE,headIsOriginalBase:head.toLowerCase()===BASE,
    headIsPreparedLocal:!!provenance&&head.toLowerCase()===provenance.preparedLocalSha,
    sourcePair:head.toLowerCase()!==config.source.toLowerCase()?'HEAD_CONFIG_DRIFT':
     head.toLowerCase()===BASE?'ORIGINAL_BASE_PAIR':
     provenance&&head.toLowerCase()===provenance.preparedLocalSha?
      'INCIDENT_PREPARED_PAIR':'OTHER_EQUAL_PAIR',
    branchKind:branch===preimage.branch?'ORIGINAL_BRANCH':
     branch===`writer-b/${WRITER_B_1063_REQUEST_ID}`?'INCIDENT_LOCAL_BRANCH':'OTHER',
    configSha256:digest(configRaw)},
   coreTask:{name:'ZGMINI-PC-Local-Core',
    enabled:probe.enabled,state:probe.state,instances:probe.instances,
    relatedProcesses:probe.relatedProcesses,
    unknownProcessLines:probe.unknownProcessLines,
    coreCycleLockPresent,coreQuietSnapshot,
    resumeAuthorized:false,
    xmlSha256:digest(xml),
    xmlMatchesOriginal:digest(xml)===preimage.originalTaskDefinitionSha256,
    definitionMatchesOriginalExceptEnabled},
   runtimeSourceVerified:false,operationalWrites:0,
   providerCalls:0,d1Writes:0,sqliteOpened:false};
 }catch(error){
  return unknown(/^WRITER_B_1063_[A-Z0-9_]{1,80}$/.test(error?.code??'')?
   error.code:'WRITER_B_1063_READONLY_INCOMPLETE');
 }
}
