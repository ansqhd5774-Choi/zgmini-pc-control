// Fixed CNN Sidecar B Windows file transaction adapter. Not an authorization
// entrypoint: only an independently authenticated B receiver may construct this.
import fs from 'node:fs';
import path from 'node:path';
import {TARGET,sha256} from './contract.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../r17-writer-b/r17-b-claim.mjs';

const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const JOURNALS=String.raw`E:\ZGmini\data\pc-writer\writer-b-install-once`;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const digest=file=>sha256(fs.readFileSync(file));
const backupMatches=(file,expected)=>{
 try{return typeof file==='string'&&digest(file)===expected;}
 catch{return false;}
};
const event=(file,status)=>{const fd=fs.openSync(file,'a');
 try{fs.writeSync(fd,JSON.stringify({status,at:new Date().toISOString()})+'\n');
 fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
function targetCheck(target){
 const stat=fs.lstatSync(target);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=131072,
  'SIDECAR_B_TARGET_TYPE_STOP');
 const real=fs.realpathSync.native(target);
 need(path.win32.normalize(real).toLowerCase()===
  path.win32.normalize(target).toLowerCase(),'SIDECAR_B_REALPATH_STOP');
}
function durableWrite(file,bytes){
 const fd=fs.openSync(file,'wx',0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function atomicSwap(file,bytes,requestId){
 const temp=file+'.sidecar-b-'+requestId+'.tmp';
 durableWrite(temp,bytes);
 try{fs.renameSync(temp,file);}catch(e){
  // Unknown whether replacement committed: keep temp and journal for inspection.
  stop('SIDECAR_B_ATOMIC_REPLACE_STOP');
 }
}
function createFileIO({
 requestId,observeProtected,target,sharedLock,journalRoot
}){
 need(process.platform==='win32','SIDECAR_B_WINDOWS_ONLY_STOP');
 need(typeof observeProtected==='function','SIDECAR_B_TRUSTED_PROBE_STOP');
 let lock=null,journal=null,backup=null,retain=false;
 const requireLock=()=>need(lock&&
  fs.readFileSync(sharedLock,'utf8')===requestId,'SIDECAR_B_LOCK_OWNER_STOP');
 const log=status=>{requireLock();need(journal,'SIDECAR_B_CLAIM_STOP');
  event(journal.journalFile,status);};
 return {
  async acquire(id){
   need(id===requestId&&!lock,'SIDECAR_B_REQUEST_SCOPE_STOP');
   lock=acquireInstallLock({journalRoot,requestId,sharedLock});
  },
  async observe(){
   requireLock();targetCheck(target);
   const protectedState=await observeProtected();
   need(protectedState&&typeof protectedState==='object'&&
    !Array.isArray(protectedState),'SIDECAR_B_PROTECTED_PROBE_STOP');
   return {...protectedState,target:TARGET,regularFile:true,
    realPathMatches:true,beforeSha256:digest(target),
    leaseOwned:protectedState.leaseOwned===true,
    sharedInstallLockOwned:true};
  },
  async claimOnce(id){
   requireLock();need(id===requestId,'SIDECAR_B_REQUEST_SCOPE_STOP');
   journal=createInstallJournal({journalRoot,requestId,sharedLock,fd:lock.fd});
  },
  async backup(expected){
   requireLock();targetCheck(target);
   need(digest(target)===expected,'SIDECAR_B_PREIMAGE_STOP');
   backup=path.join(journal.journalDir,'archive-run.original');
   durableWrite(backup,fs.readFileSync(target));
   need(digest(backup)===expected,'SIDECAR_B_BACKUP_STOP');
   log('BACKUP_VERIFIED');
  },
  async atomicReplace(bytes,before,after){
   requireLock();need(backupMatches(backup,before),
    'SIDECAR_B_BACKUP_STOP');
   targetCheck(target);need(digest(target)===before,'SIDECAR_B_CAS_STOP');
   need(sha256(bytes)===after,'SIDECAR_B_CANDIDATE_HASH_STOP');
   log('REPLACEMENT_STARTED');retain=true;
   atomicSwap(target,bytes,requestId);
   need(digest(target)===after,'SIDECAR_B_READBACK_STOP');
   log('REPLACEMENT_READBACK_VERIFIED');
   retain=false;
  },
  async readbackSha256(){requireLock();targetCheck(target);return digest(target);},
  async restoreBackup(expected){
   // Recovery failure must retain the shared owner lock, including when the
   // backup itself is missing or corrupt (before restoration starts).
   retain=true;
   requireLock();need(backupMatches(backup,expected),
    'SIDECAR_B_BACKUP_STOP');
   // Preserve evidence of any unknown replacement bytes in the journal.
   const temp=target+'.sidecar-b-restore-'+requestId+'.tmp';
   durableWrite(temp,fs.readFileSync(backup));
   fs.renameSync(temp,target);
   need(digest(target)===expected,'SIDECAR_B_ROLLBACK_READBACK_STOP');
   log('ORIGINAL_RESTORED_VERIFIED');retain=false;
  },
  async release(id){
   requireLock();need(id===requestId,'SIDECAR_B_REQUEST_SCOPE_STOP');
   // The one-shot claim and backup remain immutable even after success.
   // On unknown replacement or recovery preserve the shared lock for owner
   // reconciliation; never unlink a lock belonging to another request.
   releaseInstallClaim({fd:lock.fd,sharedLock,requestId,retain});
   lock=null;
  }
 };

}

// Production receiver is hard-bound to the approved exact operational file,
// shared Writer lock and durable journal. No caller-selectable target paths.
export function createWindowsSidecarIO({requestId,observeProtected}){
 return createFileIO({requestId,observeProtected,target:TARGET,
  sharedLock:SHARED_LOCK,journalRoot:JOURNALS});
}

// Only the existing isolated Windows CI runner may use a real temporary file.
// This is NOT a receiver operation; the production receiver calls the fixed
// factory above, and manifest validation always binds TARGET.
export function createIsolatedWindowsSidecarIO({
 requestId,observeProtected,fixtureDir
}){
 need(process.platform==='win32'&&
  process.env.CI==='true'&&
  process.env.COMPUTERNAME?.toUpperCase()==='DESKTOP-N62L0NG',
  'SIDECAR_B_ISOLATION_HOST_STOP');
 need(typeof fixtureDir==='string'&&typeof process.env.RUNNER_TEMP==='string',
  'SIDECAR_B_ISOLATION_ROOT_STOP');
 const base=fs.realpathSync.native(process.env.RUNNER_TEMP);
 const root=fs.realpathSync.native(fixtureDir);
 const rel=path.win32.relative(base,root);
 need(rel.length>0&&rel!=='..'&&!rel.startsWith('..'+path.win32.sep)&&
  !path.win32.isAbsolute(rel),'SIDECAR_B_ISOLATION_ROOT_STOP');
 const target=path.join(root,'archive-run.mjs');
 const sharedLock=path.join(root,'writer-source-install.lock');
 const journalRoot=path.join(root,'writer-b-install-once');
 return createFileIO({requestId,observeProtected,target,sharedLock,journalRoot});
}
