#!/usr/bin/env node
// Dormant until separately approved and enabled in a pinned Windows B workflow.
// Never run from generic A pc-job, visitor GET, Core scheduler, or source installer.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {
 CONTROL_REPO,DATA_ROOT,MAX_BYTES,OPERATION,SOURCE_FILES,SOURCE_ROOT,
 TARGETS,URLS,authorizeManualReceiver,sha256,verifyIssueEvent,
} from './contract.mjs';
import {performOfficialManualB} from './coordinator.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../r17-writer-b/r17-b-claim.mjs';
import {coreReadyForMaintenance,coreMaintenanceWindowBlockCode}
 from '../writer-b/windows-guards.mjs';
import {awaitNaturalCoreIdle,MAX_POST_PREPARE_IDLE_WAIT_MS}
 from '../writer-b/core-idle-window.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PROBE=path.join(ROOT,'..','r17-writer-b','r17-b-windows-probe.js');
const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const CORE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const JOURNAL_ROOT=String.raw`E:\ZGmini\data\pc-writer\inflation-manual-b-once`;
const CONFIG=String.raw`E:\ZGmini\data\pc-writer\config.json`;
const SOURCE_MJS=SOURCE_FILES[0];
const STORE_MJS=SOURCE_FILES[1];
const MAX_FILE=24_000_000;
const same=(a,b)=>path.win32.normalize(a).toLowerCase()===
 path.win32.normalize(b).toLowerCase();
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};

function safeFixedFile(filename,root,max=MAX_FILE){
 const st=fs.lstatSync(filename);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
  'INFL_MANUAL_B_FILE_SHAPE_STOP');
 const realRoot=fs.realpathSync.native(root).toLowerCase()+path.sep;
 need(fs.realpathSync.native(filename).toLowerCase().startsWith(realRoot),
  'INFL_MANUAL_B_FILE_REALPATH_STOP');
 return fs.readFileSync(filename);
}

function exe(name){
 const candidates=name==='git'?[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`]:
  [path.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32','cscript.exe')];
 const file=candidates.find(x=>fs.existsSync(x));
 need(file,'INFL_MANUAL_B_EXECUTABLE_STOP');return file;
}
function execute(binary,args){
 const p=spawnSync(exe(binary),args,{shell:false,windowsHide:true,
  encoding:'utf8',maxBuffer:1_000_000,timeout:30_000});
 need(!p.error&&p.status===0,'INFL_MANUAL_B_PROBE_EXEC_STOP');
 return p.stdout.trim();
}
function sourceFile(relative){return path.join(SOURCE_ROOT,...relative.split('/'));}
function checkSourceHome(){
 const st=fs.lstatSync(SOURCE_ROOT);
 need(st.isDirectory()&&!st.isSymbolicLink(),
  'INFL_MANUAL_B_SOURCE_ROOT_STOP');
}
function sourcePreimage(auth){
 checkSourceHome();
 const head=execute('git',['-C',SOURCE_ROOT,'rev-parse','HEAD']);
 const config=JSON.parse(safeFixedFile(CONFIG,DATA_ROOT,131_072).toString('utf8'));
 const modules=Object.fromEntries(SOURCE_FILES.map(name=>[name,
  sha256(safeFixedFile(sourceFile(name),SOURCE_ROOT,2_000_000))]));
 const owner=fs.readFileSync(SHARED_LOCK,'utf8');
 need(owner===auth.request.requestId,'INFL_MANUAL_B_SHARED_OWNER_STOP');
 return {sourceRoot:SOURCE_ROOT,sourceHead:head,
  configSource:config.source,sourceFiles:modules,dataRoot:DATA_ROOT,
  otherWriterActive:false};
}

function taskProbe(){
 let proof;
 try{proof=JSON.parse(execute('cscript',['//NoLogo',PROBE]));}
 catch{fail('INFL_MANUAL_B_CORE_PROBE_JSON_STOP');}
 need(proof?.ok===true&&typeof proof.enabled==='boolean'&&
  Number.isInteger(proof.instances)&&Number.isInteger(proof.relatedProcesses)&&
  Number.isInteger(proof.unknownProcessLines),
  'INFL_MANUAL_B_CORE_PROBE_STOP');
 return proof;
}

// Exact official URLs are already frozen by the pinned feature parser;
// verify the returned binding before exposing bytes to the writer.
async function officialBytes(source){
 const collected=await source.fetchOfficialManualCandidateSources();
 need(collected?.sourceUrls?.bls===URLS.bls&&
  collected?.sourceUrls?.census===URLS.census&&
  collected.supplierApiCalls===0&&collected.coreCheckpointWrites===0&&
  Buffer.isBuffer(collected.blsBytes)&&Buffer.isBuffer(collected.censusBytes)&&
  collected.blsBytes.length<=MAX_BYTES.bls&&
  collected.censusBytes.length<=MAX_BYTES.census,
  'INFL_MANUAL_B_OFFICIAL_GET_SCOPE_STOP');
 return {bls:collected.blsBytes,census:collected.censusBytes};
}

function verifyWriteBack(result){
 for(const key of ['bls','census']){
  const archive=result.archives[key],st=archive?.file;
  need(typeof st==='string'&&
   path.dirname(st).toLowerCase()===path.join(DATA_ROOT,
    'inflation-causal-candidates-r1','raw').toLowerCase(),
   'INFL_MANUAL_B_ARCHIVE_PATH_STOP');
  need(sha256(safeFixedFile(st,DATA_ROOT))===archive.hash,
   'INFL_MANUAL_B_ARCHIVE_READBACK_STOP');
  const written=result.writes?.[key];
  if(written)need(sha256(safeFixedFile(TARGETS[key],DATA_ROOT))===written.sha256,
   'INFL_MANUAL_B_TARGET_READBACK_STOP');
 }
}

export function makeWindowsManualAdapter(auth){
 need(process.platform==='win32','INFL_MANUAL_B_WINDOWS_HOST_STOP');
 const owner=auth.request.requestId;
 let lock=null,coreLease=null,claim=null,source=null,store=null,idleChecks=0;
 const journalFile=path.join(JOURNAL_ROOT,owner,'journal.jsonl');
 const journal=(phase,recovery=null)=>{
  need(claim!==null,'INFL_MANUAL_B_JOURNAL_NOT_CLAIMED_STOP');
  // Phases are fixed, not supplied by an untrusted Issue or error message.
  need(['CLAIMED','COMPLETED','RECOVERY_REQUIRED',
   'CLAIMED_UNTOUCHED_STOP'].includes(phase),'INFL_MANUAL_B_PHASE_STOP');
  const evidence=recovery&&phase==='RECOVERY_REQUIRED'?{
   committed:Object.fromEntries(Object.entries(recovery.committed??{})
    .filter(([key,value])=>['bls','census'].includes(key)&&
     /^[a-f0-9]{64}$/.test(value?.sha256??''))
    .map(([key,value])=>[key,{sha256:value.sha256,
     backup:typeof value.backup==='string'&&same(
      path.dirname(value.backup),path.join(DATA_ROOT,
       'inflation-causal-candidates-r1','manual-official-backups'))?
       path.basename(value.backup):null}])),
   failureCode:/^INFL_MANUAL_STORE_[A-Z0-9_]{1,90}$/.test(
    recovery.failureCode??'')?recovery.failureCode:'UNKNOWN',
   failingTarget:(()=>{const t=recovery.failingTarget;
    if(!t||!Object.values(TARGETS).some(p=>same(p,t.destination)))return null;
    return {name:path.basename(t.destination),
     expectedSha256:/^[a-f0-9]{64}$/.test(t.expectedSha256??'')?
      t.expectedSha256:null,
     backup:typeof t.backup==='string'&&same(path.dirname(t.backup),
      path.join(DATA_ROOT,'inflation-causal-candidates-r1',
       'manual-official-backups'))?path.basename(t.backup):null};})(),
  }:null;
  const fd=fs.openSync(journalFile,'a');
  try{fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString(),
    ...(evidence?{recovery:evidence}:{})})+'\n');
   fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 };
 return {
  async acquireSharedLock(id){
   need(id===owner,'INFL_MANUAL_B_OWNER_REQUEST_STOP');
   try{lock=acquireInstallLock({journalRoot:JOURNAL_ROOT,requestId:owner,
    sharedLock:SHARED_LOCK});}
   catch(error){
    if(error?.code==='R17_B_SHARED_INSTALL_BUSY_NOOP_STOP')
     fail('INFL_MANUAL_B_SHARED_BUSY_STOP');
    if(error?.code==='R17_B_REQUEST_ALREADY_CLAIMED_STOP')
     fail('INFL_MANUAL_B_ALREADY_CLAIMED_STOP');
    fail('INFL_MANUAL_B_SHARED_LOCK_STOP');
   }
  },
  async readSourcePreimage(){return sourcePreimage(auth);},
  async fetchExactSources(){
   source??=await import(pathToFileURL(sourceFile(SOURCE_MJS)).href);
   return officialBytes(source);
  },
  async preflightParse({base,blsBytes,censusBytes}){
   need(base===DATA_ROOT,'INFL_MANUAL_B_BASE_STOP');
   store??=await import(pathToFileURL(sourceFile(STORE_MJS)).href);
   const p=await store.prepareOfficialManualStore({base,blsBytes,censusBytes});
   need(p?.plan?.documents?.bls?.series?.WPSFD4?.length>0,
    'INFL_MANUAL_B_PPI_PREIMAGE_STOP');
  },
  async assertCoreIdle(){
   idleChecks++;
   await awaitNaturalCoreIdle({
    sample:()=>({probe:taskProbe(),lock:fs.existsSync(CORE_LOCK)}),
    wait:delay,clock:Date.now,isReady:coreReadyForMaintenance,
    blockCode:coreMaintenanceWindowBlockCode,
   },idleChecks>1?{windowMs:MAX_POST_PREPARE_IDLE_WAIT_MS}:undefined);
  },
  async acquireCoreLease(id){
   need(id===owner&&lock!==null&&coreLease===null,
    'INFL_MANUAL_B_CORE_OWNER_STOP');
   // The installed local-cycle.mjs uses the same wx file and checks live pid.
   // No Task disable, Core lock takeover, deletion or stale recovery.
   const value=JSON.stringify({pid:process.pid,at:Date.now(),
    owner:'INFL_MANUAL_B_ONCE',requestId:id,nonce:randomUUID()});
   let fd;
   try{fd=fs.openSync(CORE_LOCK,'wx',0o600);}
   catch(error){fail(error?.code==='EEXIST'?
    'INFL_MANUAL_B_CORE_LEASE_BUSY_STOP':'INFL_MANUAL_B_CORE_LEASE_CREATE_STOP');}
   try{fs.writeSync(fd,value);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
    const stat=fs.statSync(CORE_LOCK);
    need(fs.readFileSync(CORE_LOCK,'utf8')===value,
     'INFL_MANUAL_B_CORE_LEASE_READBACK_STOP');
    coreLease={value,dev:stat.dev,ino:stat.ino};
    await this.verifyCoreLease(id);
   }catch(error){
    if(fd!==null)try{fs.closeSync(fd);}catch{}
    // Release only our own exact lease, even if the post-create probe failed.
    // Any unknown or foreign content is preserved for read-only inspection.
    let released=false;
    try{if(fs.readFileSync(CORE_LOCK,'utf8')===value){
     fs.unlinkSync(CORE_LOCK);released=true;
    }}catch{}
    coreLease=null;
    if(!released)fail('INFL_MANUAL_B_CORE_LEASE_UNKNOWN_STOP');
    throw error;
   }
  },
  async verifyCoreLease(id){
   need(id===owner&&coreLease!==null,'INFL_MANUAL_B_CORE_LEASE_MISSING_STOP');
   const st=fs.statSync(CORE_LOCK);
   need(st.dev===coreLease.dev&&st.ino===coreLease.ino&&
    fs.readFileSync(CORE_LOCK,'utf8')===coreLease.value,
    'INFL_MANUAL_B_CORE_LEASE_DRIFT_STOP');
   const p=taskProbe();
   need(p.enabled===true&&p.instances===0&&p.relatedProcesses===0&&
    p.unknownProcessLines===0&&p.state===3,
    'INFL_MANUAL_B_CORE_LEASE_RUNTIME_STOP');
  },
  async releaseCoreLease(id){
   need(id===owner&&coreLease!==null,'INFL_MANUAL_B_CORE_RELEASE_OWNER_STOP');
   const st=fs.statSync(CORE_LOCK);
   need(st.dev===coreLease.dev&&st.ino===coreLease.ino&&
    fs.readFileSync(CORE_LOCK,'utf8')===coreLease.value,
    'INFL_MANUAL_B_CORE_RELEASE_DRIFT_STOP');
   // Only the exact inode/content created by this process, no foreign lock.
   fs.unlinkSync(CORE_LOCK);coreLease=null;
  },
  async claimOnce(id){
   need(id===owner&&lock!==null,'INFL_MANUAL_B_CLAIM_OWNER_STOP');
   claim=createInstallJournal({journalRoot:JOURNAL_ROOT,requestId:owner,
    sharedLock:SHARED_LOCK,fd:lock.fd});
  },
  async journalPhase(phase,recovery){journal(phase,recovery);},
  async applyData({base,blsBytes,censusBytes,requestId,targets}){
   need(base===DATA_ROOT&&requestId===owner&&claim!==null&&
    targets===TARGETS,'INFL_MANUAL_B_APPLY_SCOPE_STOP');
   store??=await import(pathToFileURL(sourceFile(STORE_MJS)).href);
   const withApprovedWriterB=async (operation,fn)=>{
    need(operation?.operation===
     'inflation-causal-candidate-manual-official-store-r1'&&
     Array.isArray(operation.targets)&&operation.targets.length===2&&
     operation.targets.every((p,i)=>same(p,Object.values(TARGETS)[i]))&&
     fs.readFileSync(SHARED_LOCK,'utf8')===owner,
     'INFL_MANUAL_B_LEASE_SCOPE_STOP');
    return fn(Object.freeze({scope:'APPROVED_WRITER_B',requestId:owner}));
   };
   return store.applyOfficialManualStore({base,blsBytes,censusBytes,
    withApprovedWriterB});
  },
  async readbackStored(result){verifyWriteBack(result);},
  async releaseSharedLock({requestId,retain}){
   need(lock&&requestId===owner,'INFL_MANUAL_B_LOCK_OWNER_STOP');
   releaseInstallClaim({fd:lock.fd,sharedLock:SHARED_LOCK,
    requestId:owner,retain});
  },
 };
}

// The GitHub workflow never passes an arbitrary command, destination or URL.
async function main(){
 const env=process.env;
 need(process.platform==='win32'&&env.GITHUB_REPOSITORY===CONTROL_REPO&&
  typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
  'INFL_MANUAL_B_RUNTIME_HOST_STOP');
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const request=verifyIssueEvent(event,env);
 const approvedRoot=path.join(env.GITHUB_WORKSPACE,'inflation-manual-control');
 need(execute('git',['-C',approvedRoot,'rev-parse','HEAD'])===env.GITHUB_SHA,
  'INFL_MANUAL_B_CONTROL_HEAD_STOP');
 const file=path.join(approvedRoot,...request.approvalManifestPath.split('/'));
 const bytes=safeFixedFile(file,approvedRoot,8192);
 const auth=authorizeManualReceiver({event,env,manifestBytes:bytes});
 const result=await performOfficialManualB(auth,makeWindowsManualAdapter(auth));
 const out=path.join(env.RUNNER_TEMP,'inflation-manual-b-result.json');
 fs.writeFileSync(out,JSON.stringify(result)+'\n',{flag:'wx'});
 process.stdout.write(result.status+' '+result.code+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch(error){
  const code=typeof error?.code==='string'&&
   /^INFL_MANUAL_B_[A-Z0-9_]+$/.test(error.code)?error.code:
    'INFL_MANUAL_B_SETUP_UNVERIFIED_STOP';
  // No token or provider/raw content may reach Actions logs.
  process.stderr.write(code+'\n');
  process.exitCode=1;
 }
}
