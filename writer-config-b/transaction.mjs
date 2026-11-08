// Scoped Writer config.json transaction prototype, independent of Github CLI.
// Production only calls this with the fixed target and verified approval;
// overridable paths/callbacks below exist solely for isolated tests.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {changeEmploymentOptIns} from './config-two-key-patch.mjs';
import {TARGET,SCOPE,sha256} from './contract.mjs';
import {verifyInstalledR6} from './installed-r6-guard.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../r17-writer-b/r17-b-claim.mjs';

const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const JOURNAL_ROOT=String.raw`E:\ZGmini\data\pc-writer\writer-config-b-once`;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const publicCode=error=>/^CONFIG_B_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
  error.code:/^R17_B_SHARED_INSTALL_BUSY_NOOP_STOP$/.test(error?.code??'')?
  'CONFIG_B_SHARED_WRITER_BUSY_STOP':'CONFIG_B_UNEXPECTED_STOP';

function readRegular(file,parent){
 const root=fs.realpathSync.native(parent).toLowerCase()+path.sep;
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>=2&&st.size<=131072&&
  fs.realpathSync.native(file).toLowerCase().startsWith(root),
 'CONFIG_B_FILE_SCOPE_STOP');
 return fs.readFileSync(file);
}

export function normalizeAclEvidence(stdout,file){
 need(typeof stdout==='string'&&stdout.startsWith(file),'CONFIG_B_ACL_QUERY_STOP');
 const body=stdout.slice(file.length).split(/\r?\n/)
  .map(line=>line.trim()).filter(Boolean).join('\n');
 need(body.length>0,'CONFIG_B_ACL_EMPTY_STOP');
 return body;
}
function aclEvidence(file){
 if(process.platform!=='win32')return null;
 const exe=path.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','icacls.exe');
 need(fs.existsSync(exe),'CONFIG_B_ACL_TOOL_STOP');
 const r=spawnSync(exe,[file],{encoding:'utf8',shell:false,
  windowsHide:true,timeout:15000,maxBuffer:128000});
 need(r.status===0&&!r.error&&typeof r.stdout==='string'&&
   r.stdout.startsWith(file),'CONFIG_B_ACL_QUERY_STOP');
 return normalizeAclEvidence(r.stdout,file);
}
function copyProtected(source,dest){
 fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
 const stat=fs.lstatSync(dest);
 need(stat.isFile()&&!stat.isSymbolicLink(),'CONFIG_B_COPY_SCOPE_STOP');
 if(process.platform==='win32')
  need(aclEvidence(source)===aclEvidence(dest),
   'CONFIG_B_ACL_PRESERVATION_STOP');
}
function flushCopy(file){
 // Windows FlushFileBuffers requires GENERIC_WRITE on the copied backup.
 const fd=fs.openSync(file,'r+');
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function atomicReplace(target,bytes,suffix){
 const temp=target+'.config-b-'+suffix+'.tmp';
 need(!fs.existsSync(temp),'CONFIG_B_TEMP_COLLISION_STOP');
 try{
  copyProtected(target,temp);
  const fd=fs.openSync(temp,'r+');
  try{fs.writeSync(fd,bytes,0,bytes.length,0);
   fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd);
  }finally{fs.closeSync(fd);}
  if(process.platform==='win32')
   need(aclEvidence(target)===aclEvidence(temp),
    'CONFIG_B_ACL_PRESERVATION_STOP');
  fs.renameSync(temp,target);
 }finally{
  // Only this request-owned transient leaf can be cleaned.
  if(fs.existsSync(temp))try{fs.unlinkSync(temp);}catch{}
 }
}

export function applyApprovedConfig(auth,{target=TARGET,
  journalRoot=JOURNAL_ROOT,sharedLock=SHARED_LOCK,
  beforeSwitch=()=>{},afterSwitch=()=>{},verifyInstalled=verifyInstalledR6}={}){
 need(auth?.manifest?.scope===SCOPE&&
  auth.manifest?.targetPath===TARGET&&
  typeof auth.request?.requestId==='string',
  'CONFIG_B_UNVERIFIED_APPROVAL_STOP');
 const requestId=auth.request.requestId;
 let lock=null,claimed=false,retain=false,wrote=false,original=null,
  proposed=null,result=null,stage='LOCK',originalAcl=null;
 const journal=phase=>{
  if(!claimed)return;
  const file=path.join(journalRoot,requestId,'journal.jsonl');
  const fd=fs.openSync(file,'a');
  try{fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString()})+'\n');
    fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 };
 try{
  lock=acquireInstallLock({journalRoot,requestId,sharedLock});
  stage='ORIGINAL_READ';
  original=readRegular(target,path.dirname(target));
  need(sha256(original)===auth.manifest.beforeSha256,
    'CONFIG_B_ORIGINAL_CAS_STOP');
  stage='R6_INSTALLED_POSTIMAGE';
  const installed=verifyInstalled(auth.manifest,original);
  need(installed?.verifiedFiles===19,'CONFIG_B_INSTALL_VERIFICATION_STOP');
  originalAcl=aclEvidence(target);
  stage='PATCH';
  proposed=changeEmploymentOptIns(original);
  stage='JOURNAL_CREATE';
  createInstallJournal({journalRoot,requestId,sharedLock,fd:lock.fd});
  claimed=true;
  if(proposed.changed){
   const backup=target+'.config-b-'+requestId+'.original.bin';
   stage='BACKUP_COPY';copyProtected(target,backup);
   stage='BACKUP_SYNC';flushCopy(backup);
   stage='BACKUP_READBACK';
   need(fs.readFileSync(backup).equals(original),'CONFIG_B_BACKUP_READBACK_STOP');
  }
  journal('BACKED_UP_OR_NOOP');
  stage='FINAL_CAS';
  beforeSwitch();
  need(readRegular(target,path.dirname(target)).equals(original),
    'CONFIG_B_CONCURRENT_FILE_DRIFT_STOP');
  if(proposed.changed){
    wrote=true;stage='ATOMIC_SWITCH';
    atomicReplace(target,proposed.bytes,requestId);
    journal('SWITCHED');
    stage='AFTER_SWITCH';afterSwitch();
  }
  stage='RESULT_READBACK';
  need(readRegular(target,path.dirname(target)).equals(proposed.bytes),
    'CONFIG_B_READBACK_STOP');
  need(originalAcl===aclEvidence(target),'CONFIG_B_FINAL_ACL_STOP');
  need(changeEmploymentOptIns(proposed.bytes).changed===false,
    'CONFIG_B_IDEMPOTENCE_STOP');
  journal('VERIFIED');
  result={status:'CONFIG_B_APPLIED_VERIFIED',requestId,
   code:proposed.changed?'CONFIG_B_OPTINS_SET':'CONFIG_B_ALREADY_SET',
   changedKeys:proposed.changedKeys,
   installedSourceSha:installed.sourceSha,verifiedInstalledFiles:installed.verifiedFiles,
   manifestSha256:auth.request.approvalManifestSha256??null,
   controlSha:auth.controlSha,
   beforeSha256:proposed.beforeSha256,
   afterSha256:proposed.afterSha256,backupVerified:proposed.changed};
 }catch(error){
  const known=publicCode(error);
  const code=known==='CONFIG_B_UNEXPECTED_STOP'?
   `CONFIG_B_${stage}_SYSTEM_STOP`:known;
  if(!claimed)result={status:'CONFIG_B_PREFLIGHT_STOP',code,requestId};
  else{
   try{
    const current=readRegular(target,path.dirname(target));
    if(!wrote&&!current.equals(original)){
     journal('STOP_EXTERNAL_DRIFT_UNTOUCHED');
     result={status:'CONFIG_B_STOP_UNTOUCHED',code,requestId,
      recovery:'NO_OPERATIONAL_WRITE'};
    }else{
     if(wrote&&!current.equals(original)){
      need(proposed&&current.equals(proposed.bytes),
       'CONFIG_B_ROLLBACK_CONCURRENT_DRIFT_STOP');
      atomicReplace(target,original,requestId+'-rollback');
      journal('ROLLED_BACK');
     }
     need(readRegular(target,path.dirname(target)).equals(original),
      'CONFIG_B_ORIGINAL_VERIFY_STOP');
     need(originalAcl===aclEvidence(target),'CONFIG_B_ROLLBACK_ACL_STOP');
     journal('STOP_RESTORED');
     result={status:'CONFIG_B_STOP_RESTORED',code,requestId,
      recovery:'ORIGINAL_VERIFIED'};
    }
   }catch{
    retain=true;
    try{journal('RECOVERY_REQUIRED');}catch{}
    result={status:'CONFIG_B_RECOVERY_REQUIRED',code,requestId,
     recovery:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
   }
  }
 }finally{
  if(lock){
   try{journal(retain?'LOCK_RETAINED':'FINALIZED');
    releaseInstallClaim({fd:lock.fd,sharedLock,requestId,retain});
   }catch{
    result={status:'CONFIG_B_RECOVERY_REQUIRED',
     code:'CONFIG_B_LOCK_FINALIZE_STOP',requestId,
     recovery:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
   }
  }
 }
 return result;
}
