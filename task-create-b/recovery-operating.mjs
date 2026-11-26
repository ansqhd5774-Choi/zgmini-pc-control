// Windows-only, original-owner, single existing disabled Task recovery.
// Never creates/deletes Tasks or alters Core/Korea/Writer/DB/schema/Provider.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {TASK,INSTALLED_SOURCE,SOURCE_ROOT,WRAPPER} from './contract.mjs';
import {ORIGINAL_REQUEST,DISABLED_TASK_SHA256,CORE_SHA256,
 SIDECAR_SHA256,LAUNCHER_SHA256,DISABLED_TEMPLATE_SHA256,
 ENABLED_TEMPLATE_SHA256} from './recovery-contract.mjs';

const HOME='E:\\ZGmini\\data\\pc-writer';
const OWNER_DIR=path.win32.join(HOME,'task-create-b',ORIGINAL_REQUEST);
const OWNER_LOCK=path.win32.join(HOME,'writer-source-install.lock');
const CONFIG=path.win32.join(HOME,'config.json');
const SIDE=path.win32.join(HOME,'archive-sidecar-r7','archive-run.mjs');
const PROTECTED=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Writer'];
const schtasks=path.win32.join(process.env.SystemRoot||'C:\\Windows','System32','schtasks.exe');
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const hash=buf=>createHash('sha256').update(buf).digest('hex');
function fixedRun(args){
 need(fs.existsSync(schtasks),'TASK_RECOVERY_B_SCHTASKS_STOP');
 const r=spawnSync(schtasks,args,{shell:false,windowsHide:true,
  encoding:null,timeout:20000,maxBuffer:262144,cwd:SOURCE_ROOT});
 need(r.status===0&&!r.error&&Buffer.isBuffer(r.stdout),
  'TASK_RECOVERY_B_NATIVE_QUERY_STOP');
 return r.stdout;
}
function exactFile(file,limit=131072){
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=limit,
  'TASK_RECOVERY_B_FILE_SHAPE_STOP');
 const bytes=fs.readFileSync(file);
 need(bytes.length===stat.size,'TASK_RECOVERY_B_FILE_READBACK_STOP');
 return bytes;
}
function taskXmlRaw(name){return fixedRun(['/Query','/TN',name,'/XML']);}
function originalState(proof,claimCreated,ownerSnapshots){
 const m=proof.manifest,req=proof.request.requestId;
 need(m.ownerRequestId===ORIGINAL_REQUEST&&m.taskName===TASK&&
  m.installedSourceSha===INSTALLED_SOURCE&&m.sourceRoot===SOURCE_ROOT&&
  m.wrapperPath===WRAPPER,'TASK_RECOVERY_B_FIXED_SCOPE_STOP');
 const dir=fs.lstatSync(OWNER_DIR);
 need(dir.isDirectory()&&!dir.isSymbolicLink(),
  'TASK_RECOVERY_B_OWNER_JOURNAL_STOP');
 need(exactFile(OWNER_LOCK,256).toString('utf8')===ORIGINAL_REQUEST,
  'TASK_RECOVERY_B_OWNER_LOCK_STOP');
 const j=exactFile(path.win32.join(OWNER_DIR,'journal.jsonl'),65536);
 need(j.length>10&&j.toString('utf8').includes('CLAIMED'),
  'TASK_RECOVERY_B_OWNER_JOURNAL_STOP');
 const claims=fs.readdirSync(OWNER_DIR)
  .filter(x=>/^owner-recovery-[a-f0-9-]+\.json$/.test(x));
 const claimFile='owner-recovery-'+req+'.json';
 need(claimCreated?(claims.length===1&&claims[0]===claimFile):
  claims.length===0,'TASK_RECOVERY_B_DUPLICATE_CLAIM_STOP');
 if(claimCreated){
  const claimed=JSON.parse(exactFile(path.win32.join(OWNER_DIR,claimFile),4096));
  need(claimed.schema==='ZGMINI_PC_TASK_RECOVERY_CLAIM_V1'&&
   claimed.requestId===req&&claimed.ownerRequestId===ORIGINAL_REQUEST,
   'TASK_RECOVERY_B_CLAIM_DRIFT_STOP');
 }
 for(const name of PROTECTED){
  const live=taskXmlRaw(name);
  const backup=exactFile(path.win32.join(OWNER_DIR,name+'.xml'));
  need(live.equals(backup),'TASK_RECOVERY_B_PROTECTED_BACKUP_DRIFT_STOP');
  if(name===PROTECTED[0])
   need(hash(live)===CORE_SHA256&&hash(backup)===m.coreTaskXmlSha256,
    'TASK_RECOVERY_B_CORE_SHA_STOP');
  if(ownerSnapshots&&ownerSnapshots[name]!==hash(live))
   stop('TASK_RECOVERY_B_PROTECTED_TASK_DRIFT_STOP');
 }
 need(hash(exactFile(SIDE))===SIDECAR_SHA256&&
  hash(exactFile(WRAPPER,8192))===LAUNCHER_SHA256,
  'TASK_RECOVERY_B_PROTECTED_FILE_STOP');
 const source=JSON.parse(exactFile(CONFIG,65536).toString('utf8'));
 need(source.source===INSTALLED_SOURCE,
  'TASK_RECOVERY_B_CONFIG_SOURCE_STOP');
 return Object.fromEntries(PROTECTED.map(name=>[name,hash(taskXmlRaw(name))]));
}

export function makeW06TaskRecoveryPort(proof){
 need(process.platform==='win32','TASK_RECOVERY_B_WINDOWS_ONLY_STOP');
 const m=proof.manifest,req=proof.request.requestId;
 const existing=createOperatingTaskCreateBPort({manifest:m,request:{requestId:req}});
 let before=null,claimed=false,enabledAttempted=false;
 const claimFile=path.win32.join(OWNER_DIR,'owner-recovery-'+req+'.json');
 const assertBase=()=>originalState(proof,claimed,before);
 return {
  async observe(){
   const snapshots=assertBase();
   const observed=await existing.observe();
   need(observed.taskExists===true&&observed.wrapperExists===true&&
    observed.installedSourceSha===INSTALLED_SOURCE&&
    observed.configSourceSha===INSTALLED_SOURCE&&
    observed.coreTaskXmlSha256===CORE_SHA256&&
    observed.sidecarSourceSha256===SIDECAR_SHA256&&
    observed.coreTaskEnabled===true,'TASK_RECOVERY_B_INSTALLED_SOURCE_STOP');
   need(hash(taskXmlRaw(TASK))===DISABLED_TASK_SHA256,
    'TASK_RECOVERY_B_TASK_XML_CAS_STOP');
   need(await existing.taskReadback({name:TASK,enabled:false,
    definitionTemplateSha256:DISABLED_TEMPLATE_SHA256})===true,
    'TASK_RECOVERY_B_DISABLED_DEFINITION_STOP');
   need(await existing.launcherReadback(WRAPPER,LAUNCHER_SHA256)===true,
    'TASK_RECOVERY_B_LAUNCHER_STOP');
   if(!before)before=snapshots;
   return true;
  },
  async claimRecoveryOnce(){
   need(!claimed&&before!==null&&m.taskName===TASK,
    'TASK_RECOVERY_B_CLAIM_SCOPE_STOP');
   const body=Buffer.from(JSON.stringify({
    schema:'ZGMINI_PC_TASK_RECOVERY_CLAIM_V1',
    requestId:req,ownerRequestId:ORIGINAL_REQUEST})+'\n');
   let fd;
   try{
    fd=fs.openSync(claimFile,'wx');
    fs.writeFileSync(fd,body);fs.fsyncSync(fd);
   }finally{if(fd!==undefined)fs.closeSync(fd);}
   need(exactFile(claimFile,4096).equals(body),
    'TASK_RECOVERY_B_CLAIM_READBACK_STOP');
   claimed=true;
  },
  async enableExisting(){
   need(claimed&&!enabledAttempted,'TASK_RECOVERY_B_ENABLE_SCOPE_STOP');
   assertBase();
   enabledAttempted=true;
   // Existing source adapter rechecks native LIMITED/IgnoreNew/PT1M,
   // original Core/sidecar config+XML and then enables exact TASK only.
   await existing.enableTask(TASK);
  },
  async verifyEnabled(){
   need(claimed&&enabledAttempted,'TASK_RECOVERY_B_ENABLED_SCOPE_STOP');
   return await existing.taskReadback({name:TASK,enabled:true,
    definitionTemplateSha256:ENABLED_TEMPLATE_SHA256})===true&&
    await existing.launcherReadback(WRAPPER,LAUNCHER_SHA256)===true;
  },
  async verifyProtected(){
   need(claimed&&enabledAttempted,'TASK_RECOVERY_B_POSTCHECK_SCOPE_STOP');
   // Enabled Task XML has changed; original disabled XML is no longer a valid CAS.
   const snapshots=Object.fromEntries(PROTECTED.map(n=>[n,hash(taskXmlRaw(n))]));
   need(PROTECTED.every(n=>snapshots[n]===before[n]),
    'TASK_RECOVERY_B_PROTECTED_TASK_DRIFT_STOP');
   return (await existing.verifyProtectedUnchanged())===true&&
    exactFile(OWNER_LOCK,256).toString('utf8')===ORIGINAL_REQUEST&&
    hash(exactFile(SIDE))===SIDECAR_SHA256&&
    hash(exactFile(WRAPPER,8192))===LAUNCHER_SHA256;
  },
  async releaseOriginalOwnerLock(){
   need(claimed&&enabledAttempted&&
    await existing.taskReadback({name:TASK,enabled:true,
     definitionTemplateSha256:ENABLED_TEMPLATE_SHA256})===true,
    'TASK_RECOVERY_B_RELEASE_PRECONDITION_STOP');
   need(await existing.verifyProtectedUnchanged()===true&&
    PROTECTED.every(n=>hash(taskXmlRaw(n))===before[n])&&
    exactFile(OWNER_LOCK,256).toString('utf8')===ORIGINAL_REQUEST&&
    exactFile(claimFile,4096).length>20,
    'TASK_RECOVERY_B_OWNER_RELEASE_CAS_STOP');
   // Exact original-owner Writer B shared lock only. Never a Core lock.
   fs.unlinkSync(OWNER_LOCK);
   need(!fs.existsSync(OWNER_LOCK),'TASK_RECOVERY_B_LOCK_RELEASE_UNVERIFIED_STOP');
  }
 };
}
