// Candidate ONLY: no entrypoint, workflow or operational PC installation.
// A separately approved Windows Writer-B receiver must construct this factory
// from authenticated host/Issue state and provide its EXISTING shared-lock API.
// Never accept any `paths`, `pin`, or `adapter` selector from an Issue body.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const SHA64=/^[a-f0-9]{64}$/;
const REQ=/^[A-Za-z0-9_-]{12,128}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const bad=code=>{const e=new Error(code);e.code=code;throw e;};
const need=(ok,code)=>{if(!ok)bad(code);};
const equalPath=(a,b)=>path.win32.normalize(a).toLowerCase()===
 path.win32.normalize(b).toLowerCase();

function defaultAclFingerprint(filename){
 const binary=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','icacls.exe');
 need(fs.existsSync(binary),'B_PIN_WINDOWS_ICACLS_UNAVAILABLE');
 const output=spawnSync(binary,[filename],{shell:false,encoding:'utf8',
  windowsHide:true,timeout:15000,maxBuffer:128000});
 need(output.status===0&&!output.error&&typeof output.stdout==='string'&&
  output.stdout.startsWith(filename),'B_PIN_WINDOWS_ACL_QUERY');
 const body=output.stdout.slice(filename.length).split(/\r?\n/)
  .map(x=>x.trim()).filter(Boolean).join('\n');
 need(body.length>0,'B_PIN_WINDOWS_ACL_EMPTY');
 return sha(Buffer.from(body));
}

function fixedTargets(targets){
 need(targets&&typeof targets==='object'&&
  Object.keys(targets).sort().join('|')===
   ['dataRoot','hostFile','registryFile','sharedWriterLock',
    'journalRoot','resultRoot'].sort().join('|'),
  'B_PIN_WINDOWS_TARGET_CONTRACT');
 for(const value of Object.values(targets))
  need(typeof value==='string'&&path.win32.isAbsolute(value)&&
   !value.includes('..')&&!value.includes('\\\\?\\')&&!value.includes('\\\\.\\'),
   'B_PIN_WINDOWS_TARGET_PATH');
 const base=path.win32.join(targets.dataRoot,'pc-writer');
 need(equalPath(targets.registryFile,path.win32.join(base,'controller-approvals',
  'approved-runtime-inventory-profiles.json'))&&
  equalPath(targets.sharedWriterLock,path.win32.join(base,
   'writer-source-install.lock'))&&
  equalPath(targets.journalRoot,path.win32.join(base,'approved-runtime-pin-cas')),
  'B_PIN_WINDOWS_FIXED_EFFECT_SCOPE');
 // hostFile's current location is intentionally NOT guessed here. The
 // authorized receiver must attest its exact installed path independently.
 need(path.win32.basename(targets.hostFile).toLowerCase()==='host.json',
  'B_PIN_WINDOWS_HOST_TARGET');
 return targets;
}

/**
 * Windows Node fs-backed B adapter candidate. `scope` and lock are NEVER
 * supplied from an untrusted manifest. The main installed receiver must
 * authenticate them before this factory is reachable; `verifyApproval` is
 * the narrow owner/event/immutable Git-bytes verifier, with no default.
 *
 * Tests may inject `platform`, `fileIO` and `aclFingerprint`, but an actual
 * receiver must pass Node's real Windows values and shared B lock helpers.
 */
export function makeWindowsRegistryPinBAdapter({
 authenticatedReceiver,targets,requestId,approvedRegistryAfterBytes,
 verifyApproval,lockApi,
 fileIO=fs,aclFingerprint=defaultAclFingerprint,
 platform=()=>process.platform,
}={}){
 need(authenticatedReceiver?.approvalScope===
  'HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY'&&
  authenticatedReceiver?.installedReceiverVerified===true&&
  authenticatedReceiver?.pathsFromInstalledHost===true,
  'B_PIN_WINDOWS_RECEIVER_AUTH_REQUIRED');
 need(platform()==='win32','B_PIN_WINDOWS_PLATFORM_REQUIRED');
 fixedTargets(targets);
 need(REQ.test(requestId??'')&&Buffer.isBuffer(approvedRegistryAfterBytes)&&
  approvedRegistryAfterBytes.length<=131072,
  'B_PIN_WINDOWS_INPUT');
 need(typeof verifyApproval==='function'&&typeof aclFingerprint==='function'&&
  ['acquireInstallLock','createInstallJournal','releaseInstallClaim'].every(
   name=>typeof lockApi?.[name]==='function'),
  'B_PIN_WINDOWS_TRUSTED_DEPENDENCIES');

 const HOST=targets.hostFile,REG=targets.registryFile;
 const LCK=targets.sharedWriterLock,JROOT=targets.journalRoot;
 const JDIR=path.win32.join(JROOT,requestId);
 const JFILE=path.win32.join(JDIR,'journal.jsonl');
 let lock=null,claimCreated=false;
 const ensureRegular=(file,allowMissing=false)=>{
  let stat;
  try{stat=fileIO.lstatSync(file);}catch(error){
   if(error.code==='ENOENT'&&allowMissing)return null;
   bad('B_PIN_WINDOWS_FILE_READ');
  }
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=1048576,
   'B_PIN_WINDOWS_FILE_SCOPE');
  const real=fileIO.realpathSync.native(file);
  need(equalPath(real,file),'B_PIN_WINDOWS_FILE_REPARSE');
  return stat;
 };
 const read=(file,allowMissing=false)=>ensureRegular(file,allowMissing)===null?
  null:fileIO.readFileSync(file);
 const checkLease=token=>need(token===lock&&lock!==null&&
  fileIO.readFileSync(LCK,'utf8')===requestId,
  'B_PIN_WINDOWS_SHARED_LOCK_DRIFT');
 const event=stage=>{
  need(claimCreated,'B_PIN_WINDOWS_JOURNAL_NOT_CLAIMED');
  const fd=fileIO.openSync(JFILE,'a');
  try{fileIO.writeSync(fd,JSON.stringify({stage,requestId})+'\n');
   fileIO.fsyncSync(fd);}finally{fileIO.closeSync(fd);}
 };
 const flush=file=>{
  const fd=fileIO.openSync(file,'r+');
  try{fileIO.fsyncSync(fd);}finally{fileIO.closeSync(fd);}
 };
 const backupName=file=>file+'.pin-b-'+requestId+'.original.bin';
 const copyBackup=file=>{
  const bytes=read(file),originalAcl=aclFingerprint(file);
  const dest=backupName(file);
  fileIO.copyFileSync(file,dest,fileIO.constants.COPYFILE_EXCL);
  flush(dest);
  need(read(dest).equals(bytes)&&aclFingerprint(dest)===originalAcl,
   'B_PIN_WINDOWS_BACKUP_SECURITY_DRIFT');
 };
 const atomicFileReplace=(file,oldSha,nextBytes,suffix='')=>{
  need(SHA64.test(oldSha??'')&&Buffer.isBuffer(nextBytes),
   'B_PIN_WINDOWS_CAS_INPUT');
  const current=read(file);
  need(sha(current)===oldSha,'B_PIN_WINDOWS_CONCURRENT_DRIFT');
  const originalAcl=aclFingerprint(file);
  const tmp=file+'.pin-b-'+requestId+suffix+'.tmp';
  fileIO.copyFileSync(file,tmp,fileIO.constants.COPYFILE_EXCL);
  let switched=false;
  try{
   const fd=fileIO.openSync(tmp,'r+');
   try{fileIO.writeSync(fd,nextBytes,0,nextBytes.length,0);
    fileIO.ftruncateSync(fd,nextBytes.length);fileIO.fsyncSync(fd);}
   finally{fileIO.closeSync(fd);}
   need(aclFingerprint(tmp)===originalAcl,
    'B_PIN_WINDOWS_CAS_ACL_DRIFT');
   // Second byte preimage check immediately before the rename. The shared
   // Writer lock serializes compliant writers; uncooperative writers still
   // cause a bounded STOP on detected drift rather than a blind replacement.
   need(sha(read(file))===oldSha,'B_PIN_WINDOWS_LAST_MOMENT_CAS_DRIFT');
   // Per-file rename is not whole-transaction atomic. Durable intent has
   // already been journaled by the caller. Faults require CAS rollback.
   fileIO.renameSync(tmp,file);switched=true;
   need(sha(read(file))===sha(nextBytes),
    'B_PIN_WINDOWS_SWITCH_READBACK');
  }finally{
   if(!switched){try{fileIO.unlinkSync(tmp);}catch{}}
  }
 };
 const createExclusive=(file,bytes)=>{
  need(read(file,true)===null,'B_PIN_WINDOWS_CREATE_DRIFT');
  const tmp=file+'.pin-b-'+requestId+'.create.tmp';
  const fd=fileIO.openSync(tmp,'wx');
  try{fileIO.writeSync(fd,bytes);fileIO.fsyncSync(fd);}
  finally{fileIO.closeSync(fd);}
  // NTFS hard link is CREATE_NEW: unlike rename it cannot overwrite another
  // actor's file created after our final absence check.
  try{fileIO.linkSync(tmp,file);}finally{fileIO.unlinkSync(tmp);}
  need(sha(read(file))===sha(bytes),'B_PIN_WINDOWS_CREATE_READBACK');
 };
 const snapshot=()=>({host:read(HOST),registry:read(REG,true)});
 const reportFile=(name,bytes)=>{
  const target=path.win32.join(targets.resultRoot,name);
  const fd=fileIO.openSync(target,'wx');
  try{fileIO.writeSync(fd,bytes);fileIO.fsyncSync(fd);}
  finally{fileIO.closeSync(fd);}
 };
 return {
  async authenticatePinnedApproval({pin,sha256:actualSha,scope}){
   const result=await verifyApproval({pin,sha256:actualSha,scope,
    receiver:authenticatedReceiver});
   return {verified:result?.verified===true&&
    result?.rawApprovalSha256===actualSha,sha256:actualSha};
  },
  async inspectPreimage(){return snapshot();},
  async acquireSharedWriterLock({requestId:received}){
   need(received===requestId,'B_PIN_WINDOWS_REQUEST_DRIFT');
   const claim=lockApi.acquireInstallLock({journalRoot:JROOT,
    requestId,sharedLock:LCK});
   need(Number.isInteger(claim?.fd),'B_PIN_WINDOWS_LOCK_UNKNOWN');
   lock=claim;return claim;
  },
  async verifyPreimageUnderLock({lock:token}){
   checkLease(token);return snapshot();
  },
  async loadApprovedRegistryAfterBytes({lock:token,approvalSha256}){
   checkLease(token);
   need(sha(approvedRegistryAfterBytes)===approvalSha256,
    'B_PIN_WINDOWS_APPROVED_BYTES');
   return Buffer.from(approvedRegistryAfterBytes);
  },
  async backupBoth({lock:token}){
   checkLease(token);
   // Claim the one-shot request in the existing shared B journal *after*
   // obtaining a lock token so the coordinator can retain an ambiguous
   // partial claim rather than lose lock ownership.
   lockApi.createInstallJournal({journalRoot:JROOT,
    requestId,sharedLock:LCK,fd:token.fd});
   claimCreated=true;event('BACKUP_INTENT');
   copyBackup(HOST);
   if(read(REG,true)!==null)copyBackup(REG);
   else event('REGISTRY_ABSENT_APPROVED');
   event('BOTH_BACKED_UP');
   return {complete:true,journalId:requestId};
  },
  async casHost({lock:token,backup,expectedSha256,afterBytes}){
   checkLease(token);
   need(backup?.journalId===requestId,'B_PIN_WINDOWS_JOURNAL_ID');
   event('HOST_CAS_INTENT');
   atomicFileReplace(HOST,expectedSha256,afterBytes);
   event('HOST_CAS_DONE');
  },
  async casRegistry({lock:token,backup,expectedSha256,afterBytes}){
   checkLease(token);
   need(backup?.journalId===requestId,'B_PIN_WINDOWS_JOURNAL_ID');
   event('REGISTRY_CAS_INTENT');
   if(expectedSha256===null)createExclusive(REG,afterBytes);
   else atomicFileReplace(REG,expectedSha256,afterBytes);
   event('REGISTRY_CAS_DONE');
  },
  async readBack({lock:token}){checkLease(token);return snapshot();},
  async commit({lock:token}){
   checkLease(token);event('COMMITTED');return {committed:true};
  },
  async restoreRegistry({lock:token,backup,beforeSha256,afterSha256}){
   checkLease(token);
   need(backup?.journalId===requestId,'B_PIN_WINDOWS_JOURNAL_ID');
   const current=read(REG,true),actual=current===null?null:sha(current);
   need(actual===beforeSha256||actual===afterSha256,
    'B_PIN_WINDOWS_EXTERNAL_DRIFT');
   if(actual===afterSha256){
    event('REGISTRY_RESTORE_INTENT');
    if(beforeSha256===null)fileIO.unlinkSync(REG);
    else{
     const prior=read(backupName(REG));
     need(sha(prior)===beforeSha256,
      'B_PIN_WINDOWS_REGISTRY_BACKUP_DRIFT');
     atomicFileReplace(REG,afterSha256,prior,'-restore');
    }
   }
  },
  async restoreHost({lock:token,backup,beforeSha256,afterSha256}){
   checkLease(token);
   need(backup?.journalId===requestId,'B_PIN_WINDOWS_JOURNAL_ID');
   const actual=sha(read(HOST));
   need(actual===beforeSha256||actual===afterSha256,
    'B_PIN_WINDOWS_EXTERNAL_DRIFT');
   if(actual===afterSha256){
    const prior=read(backupName(HOST));
    need(sha(prior)===beforeSha256,'B_PIN_WINDOWS_HOST_BACKUP_DRIFT');
    event('HOST_RESTORE_INTENT');
    atomicFileReplace(HOST,afterSha256,prior,'-restore');
   }
  },
  async verifyRestored({lock:token}){checkLease(token);return snapshot();},
  async releaseSharedWriterLock({lock:token}){
   checkLease(token);
   lockApi.releaseInstallClaim({fd:token.fd,sharedLock:LCK,
    requestId,retain:false});lock=null;
  },
  async recordResult({report}){
   // Only bounded non-secret fields; no raw host or registry bytes leave.
   const safe={requestId,status:report.status,code:report.code??null,
    phase:report.phase,recovery:report.rollback??null,
    retained:report.retainLockForRecovery===true};
   reportFile('pin-cas-'+requestId+'.json',
    Buffer.from(JSON.stringify(safe)+'\n'));
   reportFile('pin-cas-'+requestId+'.txt',
    Buffer.from(`requestId=${requestId}\nstatus=${safe.status}\ncode=${safe.code??'NONE'}\n`));
   return {json:true,txt:true};
  },
 };
}
