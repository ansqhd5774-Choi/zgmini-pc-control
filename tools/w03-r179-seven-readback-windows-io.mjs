// W03 exact R179 protected single-file B IO. No effects on import.
// Shares the existing Writer B exclusive install lock and durable journal.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../r17-writer-b/r17-b-claim.mjs';
import {TARGET,BEFORE_BYTES} from './w03-r179-seven-readback-b.mjs';
const SHA=b=>createHash('sha256').update(b).digest('hex');
const SHARED='E:\\ZGmini\\data\\pc-writer\\writer-source-install.lock';
const JOURNAL='E:\\ZGmini\\data\\pc-writer\\w03-r179-readback-b-once';
const PARENT='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PHASE=/^(BACKUP_VERIFIED|SWITCH_INTENT|APPLIED_VERIFIED|STOP_ORIGINAL_VERIFIED|RECOVERY_REQUIRED)$/;
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
function aclHash(file){
 need(process.platform==='win32','W03_R179_B_WINDOWS_ONLY_STOP');
 const exe=path.win32.join(process.env.SystemRoot??'C:\\Windows',
  'System32','icacls.exe');
 need(fs.existsSync(exe),'W03_R179_B_ACL_TOOL_STOP');
 const result=spawnSync(exe,[file],{encoding:'utf8',shell:false,
  windowsHide:true,timeout:15000,maxBuffer:128000});
 need(result.status===0&&!result.error&&result.stdout?.startsWith(file),
  'W03_R179_B_ACL_QUERY_STOP');
 const normalized=result.stdout.slice(file.length).split(/\r?\n/)
  .map(line=>line.trim()).filter(Boolean).join('\n');
 need(normalized.length>0,'W03_R179_B_ACL_EMPTY_STOP');
 return SHA(Buffer.from(normalized));
}
function readRegular(file){
 need(file===TARGET&&process.platform==='win32',
  'W03_R179_B_FIXED_SOURCE_ONLY_STOP');
 need(path.win32.dirname(file).toLowerCase()===PARENT.toLowerCase(),
  'W03_R179_B_PARENT_STOP');
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&
  [BEFORE_BYTES,BEFORE_BYTES-2].includes(st.size),
  'W03_R179_B_SOURCE_SIZE_STOP');
 need(path.win32.dirname(fs.realpathSync.native(file)).toLowerCase()===
  fs.realpathSync.native(PARENT).toLowerCase(),
  'W03_R179_B_REALPATH_STOP');
 return fs.readFileSync(file);
}
function backupOriginal(source,dest){
 fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
 const st=fs.lstatSync(dest);
 need(st.isFile()&&!st.isSymbolicLink(),'W03_R179_B_BACKUP_SCOPE_STOP');
 need(aclHash(source)===aclHash(dest),'W03_R179_B_BACKUP_ACL_STOP');
 const fd=fs.openSync(dest,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replaceAtomic(bytes,suffix,before,acl){
 need(Buffer.isBuffer(bytes)&&[BEFORE_BYTES,BEFORE_BYTES-2].includes(bytes.length),
  'W03_R179_B_REPLACE_SIZE_STOP');
 const temp=TARGET+'.w03-r179-b-'+suffix+'.tmp';
 need(!fs.existsSync(temp),'W03_R179_B_TEMP_COLLISION_STOP');
 try{
  need(readRegular(TARGET).equals(before)&&aclHash(TARGET)===acl,
   'W03_R179_B_FINAL_CAS_STOP');
  backupOriginal(TARGET,temp);
  const fd=fs.openSync(temp,'r+');
  try{
   fs.writeSync(fd,bytes,0,bytes.length,0);
   fs.ftruncateSync(fd,bytes.length);
   fs.fsyncSync(fd);
  }finally{fs.closeSync(fd);}
  need(fs.readFileSync(temp).equals(bytes)&&aclHash(temp)===acl,
   'W03_R179_B_TEMP_READBACK_STOP');
  need(readRegular(TARGET).equals(before),'W03_R179_B_CONCURRENT_DRIFT_STOP');
  fs.renameSync(temp,TARGET);
  need(readRegular(TARGET).equals(bytes)&&aclHash(TARGET)===acl,
   'W03_R179_B_INSTALLED_READBACK_STOP');
 }finally{if(fs.existsSync(temp))try{fs.unlinkSync(temp);}catch{}}
}
export function createR179ProtectedIO(){
 need(process.platform==='win32','W03_R179_B_WINDOWS_ONLY_STOP');
 let current=null,lease=null,claimed=false,before=null,acl=null;
 let backedUp=false,after=null,backupPath=null;
 const check=()=>{need(current&&lease!==null&&
  fs.readFileSync(SHARED,'utf8')===current,
  'W03_R179_B_SHARED_LEASE_DRIFT_STOP');};
 const checkId=id=>{check();need(id===current&&ID.test(id),
  'W03_R179_B_REQUEST_OWNER_STOP');};
 return Object.freeze({
  async acquire(id){
   need(current===null&&ID.test(id),'W03_R179_B_LOCK_REQUEST_STOP');
   need(path.win32.dirname(TARGET)===PARENT,
    'W03_R179_B_TARGET_PARENT_STOP');
   fs.realpathSync.native(PARENT);
   lease=acquireInstallLock({journalRoot:JOURNAL,requestId:id,sharedLock:SHARED});
   current=id;
  },
  async read(target){check();need(target===TARGET,'W03_R179_B_TARGET_DENIED');
   return readRegular(target);},
  async claim(id,manifestHash){
   checkId(id);need(!claimed&&/^[a-f0-9]{64}$/i.test(manifestHash),
    'W03_R179_B_CLAIM_DENIED');
   createInstallJournal({journalRoot:JOURNAL,requestId:id,
    sharedLock:SHARED,fd:lease.fd});
   claimed=true;
   const f=path.win32.join(JOURNAL,id,'approval.sha256');
   const fd=fs.openSync(f,'wx');
   try{fs.writeSync(fd,manifestHash+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  },
  async backup(target,id){
   checkId(id);need(claimed&&!backedUp&&target===TARGET,
    'W03_R179_B_BACKUP_UNAUTHORIZED');
   before=readRegular(TARGET);acl=aclHash(TARGET);
   backupPath=TARGET+'.w03-r179-b-'+id+'.original.bin';
   backupOriginal(TARGET,backupPath);
   const stored=fs.readFileSync(backupPath);
   need(stored.equals(before)&&aclHash(backupPath)===acl,
    'W03_R179_B_BACKUP_READBACK_STOP');
   backedUp=true;return Buffer.from(stored);
  },
  async journal(id,phase){
   checkId(id);need(claimed&&PHASE.test(phase),
    'W03_R179_B_JOURNAL_PHASE_STOP');
   const file=path.win32.join(JOURNAL,id,'journal.jsonl');
   const fd=fs.openSync(file,'a');
   try{fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString()})+'\n');
    fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  },
  async replace(target,bytes,id){
   checkId(id);need(target===TARGET&&claimed&&backedUp&&before&&
    Buffer.isBuffer(bytes)&&bytes.length===before.length-2,
    'W03_R179_B_CANDIDATE_SCOPE_STOP');
   need(backupPath&&fs.readFileSync(backupPath).equals(before),
    'W03_R179_B_BACKUP_DRIFT_STOP');
   after=Buffer.from(bytes);
   replaceAtomic(after,id,before,acl);
  },
  async restore(target,bytes,id){
   checkId(id);need(target===TARGET&&claimed&&backedUp&&
    Buffer.isBuffer(bytes)&&bytes.equals(before)&&after&&
    readRegular(TARGET).equals(after)&&
    fs.readFileSync(backupPath).equals(before),
    'W03_R179_B_RESTORE_PROVENANCE_STOP');
   replaceAtomic(before,id+'-rollback',after,acl);
  },
  async release(id,{retain=false}={}){
   checkId(id);
   try{releaseInstallClaim({fd:lease.fd,sharedLock:SHARED,
    requestId:id,retain});}finally{lease=null;current=null;}
  },
 });
}