// Operating PC only. Finishes the retained original W06 B Task transaction.
// Never removes/recreates the Task and never bypasses its old shared Writer lock.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {TASK,normalizedW06TaskTemplate} from './contract.mjs';
import {ORIGIN,DISABLED_XML_SHA} from './recovery-contract.mjs';

const HOME='E:\\ZGmini\\data\\pc-writer';
const ROOT=path.win32.join(HOME,'task-create-b',ORIGIN);
const OWNER_LOCK=path.win32.join(HOME,'writer-source-install.lock');
const CLAIM=path.win32.join(ROOT,'recovery-claim.json');
const COMPLETED=path.win32.join(ROOT,'recovery-completed.json');
const PROTECTED=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Writer'];
const EXE=path.win32.join(process.env.SystemRoot||'C:\\Windows',
 'System32','schtasks.exe');
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const digest=b=>createHash('sha256').update(b).digest('hex');
function readExact(file,max=131072){
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=max,
  'TASK_RECOVERY_B_FILE_SHAPE_STOP');
 const bytes=fs.readFileSync(file);
 need(bytes.length===stat.size,'TASK_RECOVERY_B_FILE_READ_STOP');
 return bytes;
}
function atomicOnce(file,body){
 const bytes=Buffer.from(JSON.stringify(body)+'\n','utf8');
 let fd;
 try{
  fd=fs.openSync(file,'wx');
  fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);
 }finally{if(fd!==undefined)fs.closeSync(fd)}
 need(readExact(file,4096).equals(bytes),'TASK_RECOVERY_B_DURABLE_STOP');
}
function taskXmlBytes(name){
 need(PROTECTED.includes(name)||name===TASK,
  'TASK_RECOVERY_B_TASK_SCOPE_STOP');
 const p=spawnSync(EXE,['/Query','/TN',name,'/XML'],{
  shell:false,windowsHide:true,timeout:15000,maxBuffer:262144,encoding:null});
 need(!p.error&&p.status===0&&Buffer.isBuffer(p.stdout)&&
  p.stdout.length>0&&p.stdout.length<=131072,
  'TASK_RECOVERY_B_NATIVE_XML_STOP');
 return p.stdout;
}
function originalOwnerExact(){
 return readExact(OWNER_LOCK,128).toString('utf8')===ORIGIN;
}
function oldJournalExact(){
 const dir=fs.lstatSync(ROOT);
 need(dir.isDirectory()&&!dir.isSymbolicLink(),
  'TASK_RECOVERY_B_OWNER_DIR_STOP');
 const rows=readExact(path.win32.join(ROOT,'journal.jsonl'),65536)
  .toString('utf8').trim().split('\n');
 // Original one-shot journal remains claimed; no phase rewriting.
 if(rows.length!==1)return false;
 try{const row=JSON.parse(rows[0]);return row?.status==='CLAIMED'&&
  typeof row.at==='string'&&Number.isFinite(Date.parse(row.at));}
 catch{return false}
}
function protectedBackupsExact(manifest){
 for(const name of PROTECTED){
  const saved=readExact(path.win32.join(ROOT,name+'.xml'));
  const current=taskXmlBytes(name);
  if(!saved.equals(current))return false;
  if(name==='ZGMINI-PC-Local-Core'&&digest(saved)!==manifest.coreTaskXmlSha256)
   return false;
 }
 return true;
}
function savedCandidateExact(manifest){
 const raw=readExact(path.win32.join(ROOT,'candidate-task-disabled.xml'));
 if(raw.length<4||raw[0]!==0xff||raw[1]!==0xfe)return false;
 return normalizedW06TaskTemplate(raw.subarray(2))===manifest.disabledTemplateSha256;
}

export function createW06RecoveryOperatingPort(proof){
 need(process.platform==='win32','TASK_RECOVERY_B_WINDOWS_ONLY_STOP');
 const original=proof.originProof;
 const port=createOperatingTaskCreateBPort(original);
 const m=original.manifest;
 async function snapshot(){
  const state=await port.observe();
  const taskPresent=state.taskExists===true;
  const taskBytes=taskPresent?taskXmlBytes(TASK):null;
  return {
   taskPresent,taskXmlSha256:taskBytes?digest(taskBytes):null,
   wrapperExact:state.wrapperExists===true&&
    await port.launcherReadback(m.wrapperPath,m.launcherSha256)===true,
   originalJournalExact:oldJournalExact(),
   originalOwnerLockExact:originalOwnerExact(),
   originalBackupsMatch:protectedBackupsExact(m),
   savedCandidateExact:savedCandidateExact(m),
   protectedUnchanged:await port.verifyProtectedUnchanged()===true,
   installedSourceSha:state.installedSourceSha,
   configSourceSha:state.configSourceSha,
   sidecarSourceSha256:state.sidecarSourceSha256,
   coreTaskXmlSha256:state.coreTaskXmlSha256,
   disabledTaskExact:taskPresent&&
    await port.taskReadback({name:TASK,enabled:false,
     definitionTemplateSha256:m.disabledTemplateSha256})===true,
   enabledTaskExact:taskPresent&&
    await port.taskReadback({name:TASK,enabled:true,
     definitionTemplateSha256:m.enabledTemplateSha256})===true
  };
 }
 return {
  snapshot,
  async claimOnce(requestId){
   need(!fs.existsSync(CLAIM)&&!fs.existsSync(COMPLETED)&&
    originalOwnerExact()&&oldJournalExact(),
    'TASK_RECOVERY_B_ALREADY_CLAIMED_STOP');
   // Lock with O_EXCL. The original shared B lock remains held by its
   // retained owner ID; other Writer B transactions cannot enter.
   atomicOnce(CLAIM,{schema:'ZGMINI_TASK_RECOVERY_CLAIM_V1',
    requestId,originRequestId:ORIGIN,status:'CLAIMED'});
  },
  async enableOnce(expectedXmlSha){
   need(expectedXmlSha===DISABLED_XML_SHA&&
    digest(taskXmlBytes(TASK))===expectedXmlSha,
    'TASK_RECOVERY_B_TASK_CAS_DRIFT_STOP');
   const a=await snapshot();
   need(a.originalOwnerLockExact&&a.originalBackupsMatch&&
    a.protectedUnchanged&&a.disabledTaskExact&&!a.enabledTaskExact,
    'TASK_RECOVERY_B_PRE_ENABLE_DRIFT_STOP');
   await port.enableTask(TASK);
  },
  async finishOnce(requestId){
   const claim=JSON.parse(readExact(CLAIM,4096).toString('utf8'));
   need(claim?.requestId===requestId&&
    claim.originRequestId===ORIGIN&&claim.status==='CLAIMED',
    'TASK_RECOVERY_B_CLAIM_CAS_STOP');
   const after=await snapshot();
   need(after.originalOwnerLockExact&&after.originalBackupsMatch&&
    after.protectedUnchanged&&after.enabledTaskExact&&!after.disabledTaskExact,
    'TASK_RECOVERY_B_POSTCHECK_STOP');
   atomicOnce(COMPLETED,{schema:'ZGMINI_TASK_RECOVERY_COMPLETE_V1',
    originRequestId:ORIGIN,requestId,status:'VERIFIED'});
   // Retired original lock only after its exact owner, journal, approved Task,
   // protected backups and new durable completion proof have been verified.
   need(originalOwnerExact(),'TASK_RECOVERY_B_OWNER_LOCK_DRIFT_STOP');
   fs.unlinkSync(OWNER_LOCK);
   need(!fs.existsSync(OWNER_LOCK),'TASK_RECOVERY_B_OWNER_RELEASE_STOP');
  }
 };
}
