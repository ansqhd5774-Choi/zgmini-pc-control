#!/usr/bin/env node
// Existing PC Writer-B lane; source-only until exact reviewed B approval exists.
// No new Task, scheduler, Controller operation, source installation or D1 write.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {
 CENSUS_B_REPO,CENSUS_B_TITLE,CENSUS_B_SOURCE_ROOT,CENSUS_B_DATA_ROOT,
 CENSUS_B_TARGET,CENSUS_B_CORE_LOCK,CENSUS_B_WRITER_LOCK,CENSUS_B_SOURCE_FILES,
 authorizeCensusB,censusBDigest
} from './contract.mjs';
import {performCensusApiB} from './coordinator.mjs';
import {APPROVAL_SCHEMA_V2} from '../inflation-manual-b/contract.mjs';
import {taskProbe,observeLiveCoreLockOwner}
 from '../inflation-manual-b/windows-adapter.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../r17-writer-b/r17-b-claim.mjs';
import {coreReadyForMaintenance,coreMaintenanceWindowBlockCode}
 from '../writer-b/windows-guards.mjs';
import {awaitNaturalCoreIdle} from '../writer-b/core-idle-window.mjs';

const CONTROL_ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const CONFIG=path.join(CENSUS_B_DATA_ROOT,'config.json');
const JOURNAL=path.join(CENSUS_B_DATA_ROOT,'inflation-census-api-b-once');
const RESULT='w01-census-api-b-once-result.json';
const REVIEWED=[
 'inflation-census-api-b/contract.mjs',
 'inflation-census-api-b/coordinator.mjs',
 'inflation-census-api-b/windows-adapter.mjs',
 'inflation-census-api-b/report.mjs',
 'inflation-manual-b/windows-adapter.mjs',
 '.github/workflows/pc-writer-b-source-once.yml'
];
const HASH=/^[a-f0-9]{64}$/i,SHA40=/^[a-f0-9]{40}$/i;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const FILE_LIMIT=2_000_000;
const same=(a,b)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
function fixedFile(file,root,max=FILE_LIMIT){
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
  'W01_CENSUS_B_FILE_SHAPE_STOP');
 const base=fs.realpathSync.native(root).toLowerCase()+path.sep;
 need(fs.realpathSync.native(file).toLowerCase().startsWith(base),
  'W01_CENSUS_B_FILE_SCOPE_STOP');
 return fs.readFileSync(file);
}
function gitExe(){
 const p=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(p=>fs.existsSync(p));
 need(p,'W01_CENSUS_B_GIT_UNAVAILABLE_STOP');return p;
}
function git(root,args){
 const r=spawnSync(gitExe(),['-C',root,...args],{
  shell:false,windowsHide:true,encoding:'utf8',
  timeout:20000,maxBuffer:120000});
 need(!r.error&&r.status===0,
  'W01_CENSUS_B_GIT_VERIFICATION_STOP');
 return r.stdout.trim();
}
function pinnedManifest(relative){
 const file=path.join(CONTROL_ROOT,...relative.split('/'));
 const worktree=fixedFile(file,CONTROL_ROOT,4096);
 const r=spawnSync(gitExe(),['-C',CONTROL_ROOT,'show',`HEAD:${relative}`],{
  shell:false,windowsHide:true,encoding:null,timeout:20000,maxBuffer:8192});
 need(!r.error&&r.status===0&&Buffer.isBuffer(r.stdout)&&
  r.stdout.equals(worktree),'W01_CENSUS_B_MANIFEST_BLOB_STOP');
 return worktree;
}
export function verifyReviewedCode(proof,{head,ancestor,changed}){
 need(SHA40.test(head??'')&&head===proof.controlSha&&
  ancestor===true&&changed===false,
  'W01_CENSUS_B_REVIEWED_CODE_STOP');
 return true;
}
function readControlPreflight(proof){
 const head=git(CONTROL_ROOT,['rev-parse','HEAD']);
 let ancestor=false,changed=true;
 try{
  git(CONTROL_ROOT,['merge-base','--is-ancestor',proof.manifest.controlSourceSha,'HEAD']);
  ancestor=true;
  git(CONTROL_ROOT,['diff','--exit-code',proof.manifest.controlSourceSha,'HEAD',
   '--',...REVIEWED]);
  git(CONTROL_ROOT,['diff','--exit-code','HEAD','--',...REVIEWED]);
  changed=false;
 }catch{}
 verifyReviewedCode(proof,{head,ancestor,changed});
}
function readSourcePreimage(requestId){
 const stat=fs.lstatSync(CENSUS_B_SOURCE_ROOT);
 need(stat.isDirectory()&&!stat.isSymbolicLink(),
  'W01_CENSUS_B_SOURCE_HOME_STOP');
 const head=git(CENSUS_B_SOURCE_ROOT,['rev-parse','HEAD']);
 const clean=git(CENSUS_B_SOURCE_ROOT,
  ['status','--porcelain=v1','--untracked-files=no'])==='';
 const conf=JSON.parse(fixedFile(CONFIG,CENSUS_B_DATA_ROOT,131072).toString('utf8'));
 const sourceFilesSha256=Object.fromEntries(CENSUS_B_SOURCE_FILES.map(p=>
  [p,sha(fixedFile(path.join(CENSUS_B_SOURCE_ROOT,...p.split('/')),
    CENSUS_B_SOURCE_ROOT))]));
 const lockOwner=fs.readFileSync(CENSUS_B_WRITER_LOCK,'utf8');
 const task=taskProbe();
 return {sourceHead:head,configSource:conf.source,
  sourceRoot:CENSUS_B_SOURCE_ROOT,dataRoot:CENSUS_B_DATA_ROOT,
  coreLock:CENSUS_B_CORE_LOCK,writerLock:CENSUS_B_WRITER_LOCK,
  sourceClean:clean,writerLeaseOwned:lockOwner===requestId,
  coreTaskEnabled:task.enabled===true,sourceFilesSha256};
}
function checkedArchive(doc){
 need(doc?.schemaVersion===1&&doc.provider==='US_CENSUS_M3'&&
  doc.selector==='MTM/TI'&&doc.unit==='USD_MILLION_SA_NOMINAL'&&
  typeof doc.sourceVersion==='string'&&
  typeof doc.sourceStoredAt==='string'&&!Number.isNaN(Date.parse(doc.sourceStoredAt))&&
  Array.isArray(doc.observations)&&doc.observations.length>0&&
  doc.observations.every(x=>/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(x?.date??'')&&
   typeof x?.value==='number'&&Number.isFinite(x.value)&&x.value>=0),
  'W01_CENSUS_B_SAVED_SCHEMA_STOP');
 const dir=path.join(CENSUS_B_DATA_ROOT,'inflation-causal-candidates-r1','raw');
 const year=new Date().getUTCFullYear();
 for(const y of [year-1,year]){
  const matched=fs.readdirSync(dir).filter(n=>
   new RegExp('^census-m3-mtm-'+y+'-[a-f0-9]{64}\\.json$').test(n));
  need(matched.length>=1&&matched.length<=100,
   'W01_CENSUS_B_RAW_ARCHIVE_MISSING_STOP');
  const valid=matched.some(name=>{
   const digest=name.slice(('census-m3-mtm-'+y+'-').length,-5);
   try{return sha(fixedFile(path.join(dir,name),CENSUS_B_DATA_ROOT,5_000_000))===digest;}
   catch{return false;}
  });
  need(valid,'W01_CENSUS_B_RAW_ARCHIVE_READBACK_STOP');
 }
 return {observations:doc.observations.length,
  sourceStoredAt:doc.sourceStoredAt};
}
export function makeWindowsCensusApiBAdapter(proof){
 need(process.platform==='win32','W01_CENSUS_B_WINDOWS_ONLY_STOP');
 let writer=null,core=null,claim=null,quota=null;
 const requestId=proof.request.requestId;
 const journalFile=path.join(JOURNAL,requestId,'journal.jsonl');
 return {
  async proveLiveCoreLockOwner(){
   await observeLiveCoreLockOwner(APPROVAL_SCHEMA_V2,{maxObservationMs:6*60_000});
  },
  async acquireSharedWriterLease(id){
   need(id===requestId,'W01_CENSUS_B_WRITER_OWNER_STOP');
   writer=acquireInstallLock({journalRoot:JOURNAL,requestId,
    sharedLock:CENSUS_B_WRITER_LOCK});
  },
  async readPcPreimage(){
   need(writer!==null,'W01_CENSUS_B_WRITER_LEASE_MISSING_STOP');
   return readSourcePreimage(requestId);
  },
  async assertCoreIdle(){
   await awaitNaturalCoreIdle({
    sample:()=>({probe:taskProbe(),lock:fs.existsSync(CENSUS_B_CORE_LOCK)}),
    wait:delay,clock:Date.now,isReady:coreReadyForMaintenance,
    blockCode:coreMaintenanceWindowBlockCode
   });
  },
  async acquireCoreLease(id){
   need(id===requestId&&writer!==null&&!core,
    'W01_CENSUS_B_CORE_LEASE_SCOPE_STOP');
   const value=JSON.stringify({pid:process.pid,at:Date.now(),
    owner:'W01_CENSUS_API_B_ONCE',requestId:id,nonce:randomUUID()});
   let fd;
   try{fd=fs.openSync(CENSUS_B_CORE_LOCK,'wx',0o600);}
   catch{stop('W01_CENSUS_B_CORE_LEASE_BUSY_STOP');}
   try{
    fs.writeSync(fd,value);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
    const st=fs.statSync(CENSUS_B_CORE_LOCK);
    core={value,dev:st.dev,ino:st.ino};
    await this.verifyCoreLease(id);
   }catch(e){
    if(fd!==undefined&&fd!==null)try{fs.closeSync(fd);}catch{}
    // Failed initial verification: remove only this exact inode and content.
    // Foreign, partial or changed Core locks must remain for their owner.
    let safelyReleased=false;
    if(core?.value===value){
     try{
      const st=fs.statSync(CENSUS_B_CORE_LOCK);
      if(st.dev===core.dev&&st.ino===core.ino&&
       fs.readFileSync(CENSUS_B_CORE_LOCK,'utf8')===core.value){
       fs.unlinkSync(CENSUS_B_CORE_LOCK);
       safelyReleased=!fs.existsSync(CENSUS_B_CORE_LOCK);
      }
     }catch{}
    }
    core=null;
    if(safelyReleased)stop('W01_CENSUS_B_CORE_ACQUIRE_ABORTED_CLEAN_STOP');
    throw e;
   }
  },
  async verifyCoreLease(id){
   need(id===requestId&&core,'W01_CENSUS_B_CORE_LEASE_MISSING_STOP');
   const st=fs.statSync(CENSUS_B_CORE_LOCK);
   need(st.dev===core.dev&&st.ino===core.ino&&
    fs.readFileSync(CENSUS_B_CORE_LOCK,'utf8')===core.value,
    'W01_CENSUS_B_CORE_LEASE_DRIFT_STOP');
   const p=taskProbe();
   need(p.enabled===true&&p.instances===0&&p.relatedProcesses===0&&
    p.unknownProcessLines===0&&p.state===3,
    'W01_CENSUS_B_CORE_ACTIVE_STOP');
  },
  async claimOnce(id){
   need(id===requestId&&writer!==null&&core!==null,
    'W01_CENSUS_B_CLAIM_SCOPE_STOP');
   claim=createInstallJournal({journalRoot:JOURNAL,requestId,
    sharedLock:CENSUS_B_WRITER_LOCK,fd:writer.fd});
  },
  async journalPhase(phase){
   need(claim!==null&&
    ['CLAIMED','COMPLETED','RECOVERY_REQUIRED','CLAIMED_UNTOUCHED_STOP'].includes(phase),
    'W01_CENSUS_B_JOURNAL_SCOPE_STOP');
   const fd=fs.openSync(journalFile,'a');
   try{fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString()})+'\n');
    fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  },
  async collectAndReadback(){
   need(core!==null&&claim!==null,'W01_CENSUS_B_COLLECT_LEASE_STOP');
   await this.verifyCoreLease(requestId);
   const load=await import(pathToFileURL(path.join(CENSUS_B_SOURCE_ROOT,
    'scripts','pc-writer','local-env.mjs')).href);
   const env=load.loadLocalProviders(CENSUS_B_DATA_ROOT);
   const qm=await import(pathToFileURL(path.join(CENSUS_B_SOURCE_ROOT,
    'scripts','pc-writer','quota-fetch.mjs')).href);
   quota=qm.createQuotaFetch({base:CENSUS_B_DATA_ROOT,
    originalFetch:globalThis.fetch,mode:'enforce'});
   const module=await import(pathToFileURL(path.join(CENSUS_B_SOURCE_ROOT,
    'scripts','pc-writer','inflation-causal-candidate-once.mjs')).href);
   return module.runInflationCandidateOnce({approved:true,base:CENSUS_B_DATA_ROOT,
    groups:['census'],providerEnv:env,quotaFetch:quota.fetch});
  },
  async verifySavedReadback(){
   need(core!==null&&claim!==null,'W01_CENSUS_B_READBACK_LEASE_STOP');
   const raw=fixedFile(CENSUS_B_TARGET,CENSUS_B_DATA_ROOT);
   const doc=JSON.parse(raw.toString('utf8'));
   checkedArchive(doc);
  },
  async releaseCoreLease(id){
   need(id===requestId&&core!==null,'W01_CENSUS_B_CORE_RELEASE_OWNER_STOP');
   const st=fs.statSync(CENSUS_B_CORE_LOCK);
   need(st.dev===core.dev&&st.ino===core.ino&&
    fs.readFileSync(CENSUS_B_CORE_LOCK,'utf8')===core.value,
    'W01_CENSUS_B_CORE_RELEASE_DRIFT_STOP');
   fs.unlinkSync(CENSUS_B_CORE_LOCK);core=null;
  },
  async releaseSharedWriterLease({requestId:id,retain}){
   need(id===requestId&&writer!==null,'W01_CENSUS_B_WRITER_RELEASE_OWNER_STOP');
   releaseInstallClaim({fd:writer.fd,sharedLock:CENSUS_B_WRITER_LOCK,
    requestId,retain});writer=null;
  },
 };
}
export async function executeCensusApiB({env=process.env,event}={}){
 need(process.platform==='win32'&&env.GITHUB_REPOSITORY===CENSUS_B_REPO&&
  typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
  'W01_CENSUS_B_RUNNER_HOST_STOP');
 const ev=event??JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const req=JSON.parse(ev.issue?.body??'null');
 const bytes=pinnedManifest(req?.approvalManifestPath??'');
 const proof=authorizeCensusB({event:ev,env,manifestBytes:bytes});
 readControlPreflight(proof);
 return performCensusApiB(proof,makeWindowsCensusApiBAdapter(proof));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let output;
 try{output=await executeCensusApiB();}
 catch(e){output={status:'STOP',code:/^W01_CENSUS_B_[A-Z0-9_]{3,90}$/.test(e?.code??'')?
  e.code:'W01_CENSUS_B_SETUP_UNVERIFIED_STOP',providerCalls:0,
  publicWrites:0,d1Writes:0,taskChanges:0,replay:'FORBIDDEN'};}
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&path.isAbsolute(process.env.RUNNER_TEMP),
   'W01_CENSUS_B_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,RESULT),JSON.stringify(output)+'\n',
   {flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(output.status+' '+output.code+'\n');
 if(output.status!=='PASS')process.exitCode=1;
}
