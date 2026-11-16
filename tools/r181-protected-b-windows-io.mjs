// Windows-side IO for the exact W03 R181 protected B transaction.
// Source-only: importing this module does not install or modify any PC file.
// A separately approved, registered B entrypoint must authenticate the event.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../r17-writer-b/r17-b-claim.mjs';
import {R181_B_TARGET} from './r181-protected-b-transaction.mjs';
import {R181_PRIMARY_B_TARGET} from './r181-primary-b-transaction.mjs';

const SHARED_LOCK='E:\\ZGmini\\data\\pc-writer\\writer-source-install.lock';
const JOURNAL_ROOT='E:\\ZGmini\\data\\pc-writer\\r181-protected-b-once';
const PRIMARY_JOURNAL_ROOT='E:\\ZGmini\\data\\pc-writer\\r181-primary-b-once';
const TARGETS=new Set([R181_B_TARGET,R181_PRIMARY_B_TARGET]);
const SOURCE_PARENT='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167';
const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const SAFE_ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SAFE_PHASE=/^(?:BACKUP_VERIFIED|SWITCH_INTENT|APPLIED_VERIFIED|STOP_ORIGINAL_VERIFIED|RECOVERY_REQUIRED)$/;
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(condition,code)=>{if(!condition)stop(code);};

export function normalizeR181Acl(raw,file){
  need(typeof raw==='string'&&raw.startsWith(file),'R181_B_ACL_QUERY_STOP');
  const acl=raw.slice(file.length).split(/\r?\n/)
    .map(line=>line.trim()).filter(Boolean).join('\n');
  need(acl.length>0,'R181_B_ACL_EMPTY_STOP');
  return acl;
}
function aclDigest(file){
  need(process.platform==='win32','R181_B_WINDOWS_ONLY_STOP');
  const exe=path.win32.join(process.env.SystemRoot??'C:\\Windows',
    'System32','icacls.exe');
  need(fs.existsSync(exe),'R181_B_ACL_TOOL_STOP');
  const r=spawnSync(exe,[file],{encoding:'utf8',shell:false,
    windowsHide:true,timeout:15000,maxBuffer:128000});
  need(r.status===0&&!r.error&&typeof r.stdout==='string',
    'R181_B_ACL_QUERY_STOP');
  return SHA(Buffer.from(normalizeR181Acl(r.stdout,file)));
}
function readRegular(file){
  need(TARGETS.has(file),'R181_B_FIXED_PATH_ONLY_STOP');
  need(path.win32.dirname(file).toLowerCase()===SOURCE_PARENT.toLowerCase(),
    'R181_B_SOURCE_PARENT_STOP');
  const parent=fs.realpathSync.native(SOURCE_PARENT);
  const st=fs.lstatSync(file);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=8192,
    'R181_B_TARGET_NOT_REGULAR_STOP');
  const actual=fs.realpathSync.native(file);
  need(path.win32.dirname(actual).toLowerCase()===parent.toLowerCase(),
    'R181_B_REALPATH_ESCAPE_STOP');
  return fs.readFileSync(file);
}
function copyProtected(file,dest){
  fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);
  const st=fs.lstatSync(dest);
  need(st.isFile()&&!st.isSymbolicLink(),'R181_B_PROTECTED_COPY_SCOPE_STOP');
  need(aclDigest(file)===aclDigest(dest),'R181_B_ACL_PRESERVATION_STOP');
}
function flushFile(file){
  const fd=fs.openSync(file,'r+');
  try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replaceProtected(target,bytes,suffix,expectedBefore,expectedAcl){
  need(TARGETS.has(target)&&Buffer.isBuffer(bytes)&&
    bytes.length>0&&bytes.length<=8192,'R181_B_REPLACE_SCOPE_STOP');
  const tmp=target+'.r181-b-'+suffix+'.tmp';
  need(!fs.existsSync(tmp),'R181_B_TEMP_COLLISION_STOP');
  try{
    need(readRegular(target).equals(expectedBefore),
      'R181_B_REPLACE_CONCURRENT_DRIFT_STOP');
    need(aclDigest(target)===expectedAcl,'R181_B_ACL_DRIFT_STOP');
    copyProtected(target,tmp);
    const fd=fs.openSync(tmp,'r+');
    try{
      fs.writeSync(fd,bytes,0,bytes.length,0);
      fs.ftruncateSync(fd,bytes.length);
      fs.fsyncSync(fd);
    }finally{fs.closeSync(fd);}
    need(fs.readFileSync(tmp).equals(bytes),'R181_B_TEMP_READBACK_STOP');
    need(aclDigest(tmp)===expectedAcl,'R181_B_TEMP_ACL_STOP');
    need(readRegular(target).equals(expectedBefore),
      'R181_B_FINAL_CONCURRENT_DRIFT_STOP');
    fs.renameSync(tmp,target);
    need(readRegular(target).equals(bytes),'R181_B_INSTALL_READBACK_STOP');
    need(aclDigest(target)===expectedAcl,'R181_B_INSTALLED_ACL_STOP');
  }finally{
    // Only this request-owned temporary leaf may be cleaned.
    if(fs.existsSync(tmp))try{fs.unlinkSync(tmp);}catch{}
  }
}

// No target or root override: exact fixed contract controls the real PC path.
export function createR181ProtectedWindowsIo(profile='CYCLE'){
  need(profile==='CYCLE'||profile==='PRIMARY','R181_B_PROFILE_DENIED');
  const fixedTarget=profile==='PRIMARY'?R181_PRIMARY_B_TARGET:R181_B_TARGET;
  const journalRoot=profile==='PRIMARY'?PRIMARY_JOURNAL_ROOT:JOURNAL_ROOT;
  need(process.platform==='win32','R181_B_WINDOWS_ONLY_STOP');
  let currentId=null,lease=null,claimed=false,before=null,acl=null;
  let backedUp=false,lastCandidate=null,backupPath=null;
  function checkId(id){
    need(typeof id==='string'&&SAFE_ID.test(id)&&id===currentId&&
      lease!==null,'R181_B_REQUEST_OWNER_STOP');
  }
  function checkLock(){
    need(lease!==null&&currentId!==null&&
      fs.readFileSync(SHARED_LOCK,'utf8')===currentId,
      'R181_B_SHARED_LEASE_DRIFT_STOP');
  }
  return Object.freeze({
    async acquireSharedWriterLease(id){
      need(currentId===null&&SAFE_ID.test(id),
        'R181_B_ALREADY_LOCKED_STOP');
      need(path.win32.dirname(fixedTarget)===SOURCE_PARENT,
        'R181_B_FIXED_PARENT_STOP');
      fs.realpathSync.native(SOURCE_PARENT);
      lease=acquireInstallLock({journalRoot:journalRoot,requestId:id,
        sharedLock:SHARED_LOCK});
      currentId=id;
    },
    async readPinnedFile(target){
      checkLock();
      need(target===fixedTarget,'R181_B_PROFILE_TARGET_DENIED');
      return readRegular(target);
    },
    async claimOnce(id,manifestSha){
      checkId(id);checkLock();
      need(!claimed&&/^[a-f0-9]{64}$/i.test(manifestSha),
        'R181_B_CLAIM_SCOPE_STOP');
      createInstallJournal({journalRoot:journalRoot,requestId:id,
        sharedLock:SHARED_LOCK,fd:lease.fd});
      claimed=true;
      // Only the approved manifest digest is durably retained.
      const fd=fs.openSync(path.win32.join(journalRoot,id,'approval.sha256'),'wx');
      try{
        fs.writeSync(fd,manifestSha+'\n');
        fs.fsyncSync(fd);
      }finally{fs.closeSync(fd);}
    },
    async backupAndVerify(target,id){
      checkId(id);checkLock();
      need(claimed&&!backedUp&&target===fixedTarget,
        'R181_B_BACKUP_SCOPE_STOP');
      before=readRegular(target);
      acl=aclDigest(target);
      backupPath=target+'.r181-b-'+id+'.original.bin';
      copyProtected(target,backupPath);
      flushFile(backupPath);
      const stored=fs.readFileSync(backupPath);
      need(stored.equals(before)&&aclDigest(backupPath)===acl,
        'R181_B_BACKUP_READBACK_STOP');
      backedUp=true;
      return Buffer.from(stored);
    },
    async journal(id,phase){
      checkId(id);checkLock();
      need(claimed&&SAFE_PHASE.test(phase),'R181_B_JOURNAL_SCOPE_STOP');
      const fd=fs.openSync(path.win32.join(journalRoot,id,'journal.jsonl'),'a');
      try{
        fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString()})+'\n');
        fs.fsyncSync(fd);
      }finally{fs.closeSync(fd);}
    },
    async replaceAtomically(target,bytes,id){
      checkId(id);checkLock();
      need(target===fixedTarget,'R181_B_PROFILE_TARGET_DENIED');
      need(claimed&&backedUp&&before!==null&&
        Buffer.isBuffer(bytes)&&bytes.length===before.length+3,
        'R181_B_REPLACE_UNPREPARED_STOP');
      need(backupPath!==null&&fs.readFileSync(backupPath).equals(before),
        'R181_B_BACKUP_DRIFT_STOP');
      lastCandidate=Buffer.from(bytes);
      replaceProtected(target,lastCandidate,id,before,acl);
    },
    async restoreAtomically(target,bytes,id){
      checkId(id);checkLock();
      need(claimed&&backedUp&&target===fixedTarget&&
        Buffer.isBuffer(bytes)&&bytes.equals(before)&&
        lastCandidate!==null&&readRegular(target).equals(lastCandidate)&&
        fs.readFileSync(backupPath).equals(before),
        'R181_B_ROLLBACK_PROVENANCE_STOP');
      replaceProtected(target,before,id+'-rollback',lastCandidate,acl);
    },
    async releaseWriterLease(id,{retain=false}={}){
      checkId(id);
      try{
        releaseInstallClaim({fd:lease.fd,sharedLock:SHARED_LOCK,
          requestId:id,retain});
      }finally{lease=null;currentId=null;}
    },
  });
}
