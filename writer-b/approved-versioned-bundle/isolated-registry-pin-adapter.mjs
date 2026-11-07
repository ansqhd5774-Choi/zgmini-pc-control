// A disposable LOCAL filesystem adapter for the proposed common B-grade
// host PIN + registry transaction. It deliberately cannot operate on a live
// Windows host, arbitrary paths or an unmarked directory. NOT A RECEIVER.
//
// It exercises real Node file I/O, same-directory backups, flush, two-file
// CAS and rollback. Windows ACL and Git approval attestation still require
// separately authorized Windows-native integration before any production use.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const MARKER='ZGMINI_PIN_CAS_ISOLATED_FIXTURE_V1';
const SHA64=/^[a-f0-9]{64}$/;
const REQUEST=/^[A-Za-z0-9_-]{12,128}$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{const err=new Error(code);err.code=code;throw err;};
const need=(ok,code)=>{if(!ok)fail(code);};

function rootScope(input){
 need(typeof input==='string'&&path.isAbsolute(input),'B_PIN_FIXTURE_SCOPE');
 const actual=fs.realpathSync.native(input);
 const tmp=fs.realpathSync.native(os.tmpdir());
 const rel=path.relative(tmp,actual);
 need(rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel)&&
  !rel.includes(path.sep)&&path.basename(actual).startsWith('zgmini-b-pin-fixture-')&&
  input===actual,'B_PIN_FIXTURE_SCOPE');
 const marker=path.join(actual,'SIMULATION_ONLY');
 need(fs.existsSync(marker)&&!fs.lstatSync(marker).isSymbolicLink()&&
  fs.readFileSync(marker,'utf8')===MARKER,'B_PIN_FIXTURE_MARKER');
 return actual;
}
function scope(root,relative){
 const full=path.resolve(root,relative);
 const rel=path.relative(root,full);
 need(rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel),
  'B_PIN_FIXTURE_PATH');
 let cursor=root;
 for(const item of rel.split(path.sep)){
  cursor=path.join(cursor,item);
  let info;
  try{info=fs.lstatSync(cursor);}
  catch(error){if(error.code==='ENOENT')continue;throw error;}
  need(!info.isSymbolicLink(),'B_PIN_FIXTURE_REPARSE');
  const real=fs.realpathSync.native(cursor);
  need(path.relative(root,real)===path.relative(root,cursor),
   'B_PIN_FIXTURE_REPARSE');
 }
 return full;
}
function read(root,relative,allowAbsent=false){
 const full=scope(root,relative);
 let info;
 try{info=fs.lstatSync(full);}catch(error){
  if(error.code==='ENOENT'&&allowAbsent)return null;
  fail('B_PIN_FIXTURE_FILE_MISSING');
 }
 need(info.isFile()&&!info.isSymbolicLink()&&info.size<=1048576,
  'B_PIN_FIXTURE_FILE_TYPE');
 return fs.readFileSync(full);
}
function writeExclusive(root,relative,bytes){
 const full=scope(root,relative);
 const parent=path.dirname(full);
 need(fs.existsSync(parent)&&fs.statSync(parent).isDirectory(),
  'B_PIN_FIXTURE_PARENT');
 fs.writeFileSync(full,bytes,{flag:'wx',mode:0o600});
 const fd=fs.openSync(full,'r+');
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function append(root,relative,value){
 const full=scope(root,relative),fd=fs.openSync(full,'a');
 try{fs.writeSync(fd,JSON.stringify({stage:value})+'\n');fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}
function backup(root,relative,id){
 const source=scope(root,relative),target=scope(root,relative+'.backup.'+id);
 const original=read(root,relative);
 fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
 const mode=fs.statSync(source).mode&0o777;
 fs.chmodSync(target,mode);
 const fd=fs.openSync(target,'r+');
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 need(read(root,relative+'.backup.'+id).equals(original)&&
  (fs.statSync(target).mode&0o777)===mode,'B_PIN_FIXTURE_BACKUP');
 return target;
}
function atomicCas(root,relative,oldSha,bytes,id){
 need(SHA64.test(oldSha??''),'B_PIN_FIXTURE_CAS_EXPECTED');
 const before=read(root,relative);
 need(digest(before)===oldSha,'B_PIN_FIXTURE_CAS_CONCURRENT');
 const file=scope(root,relative),tmp=scope(root,relative+'.temp.'+id);
 fs.copyFileSync(file,tmp,fs.constants.COPYFILE_EXCL);
 const fd=fs.openSync(tmp,'r+');
 try{fs.writeSync(fd,bytes,0,bytes.length,0);fs.ftruncateSync(fd,bytes.length);
  fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 need((fs.statSync(tmp).mode&0o777)===(fs.statSync(file).mode&0o777),
  'B_PIN_FIXTURE_MODE_DRIFT');
 fs.renameSync(tmp,file);
 need(read(root,relative).equals(bytes),'B_PIN_FIXTURE_CAS_READBACK');
}
function atomicCreateNew(root,relative,bytes,id){
 need(read(root,relative,true)===null,'B_PIN_FIXTURE_CREATE_CONCURRENT');
 const target=scope(root,relative),temp=scope(root,relative+'.temp.'+id);
 writeExclusive(root,relative+'.temp.'+id,bytes);
 // A same-volume hard link is CREATE_NEW: it fails when `target` exists,
 // unlike rename which could overwrite an unexpected concurrent file.
 // A separately approved Windows adapter must prove this exact NTFS behavior.
 try{fs.linkSync(temp,target);}finally{fs.unlinkSync(temp);}
 need(read(root,relative).equals(bytes),'B_PIN_FIXTURE_CREATE_READBACK');
}

/**
 * The fixed relative paths below model RECEIVER-owned destinations. Neither
 * Issue nor approval manifest can name a path. The fixture authorization
 * check is deliberately only a test oracle, NOT GitHub authentication.
 */
export function makeIsolatedRegistryPinAdapter({fixtureRoot,requestId,
 trustedApprovalSha256,targetRegistryBytes,injectFailure=null}={}){
 const root=rootScope(fixtureRoot);
 need(REQUEST.test(requestId??'')&&SHA64.test(trustedApprovalSha256??'')&&
  Buffer.isBuffer(targetRegistryBytes),'B_PIN_FIXTURE_INPUT');
 const HOST='host.json';
 const REG='pc-writer/controller-approvals/approved-runtime-inventory-profiles.json';
 const LOCK='writer-source-install.lock';
 const JOURNAL='pin-cas-journal.'+requestId+'.jsonl';
 let lease=null,backupDone=false;
 const snapshot=()=>({host:read(root,HOST),registry:read(root,REG,true)});
 const requireLock=token=>need(token===lease&&lease!==null&&
  read(root,LOCK).toString('utf8')===requestId,'B_PIN_FIXTURE_LOCK_DRIFT');
 const fault=phase=>{if(injectFailure===phase)fail('B_PIN_FIXTURE_INJECTED_'+phase);};
 return {
  async authenticatePinnedApproval({pin,sha256}){
   fault('AUTHORIZE');
   return {verified:sha256===trustedApprovalSha256&&
    pin?.rawApprovalSha256===trustedApprovalSha256,sha256};
  },
  async inspectPreimage(){fault('PREIMAGE');return snapshot();},
  async acquireSharedWriterLock({requestId:claimed}){
   need(claimed===requestId,'B_PIN_FIXTURE_REQUEST_DRIFT');fault('LOCK');
   // Prevent a consumed request from accidentally claiming the lock and then
   // failing journal creation with an unowned lock left behind.
   need(read(root,JOURNAL,true)===null,'B_PIN_FIXTURE_REQUEST_CONSUMED');
   writeExclusive(root,LOCK,Buffer.from(requestId));
   try{writeExclusive(root,JOURNAL,
    Buffer.from(JSON.stringify({stage:'CLAIM'})+'\n'));}
   catch(error){fs.unlinkSync(scope(root,LOCK));throw error;}
   lease=Object.freeze({requestId});
   return lease;
  },
  async verifyPreimageUnderLock({lock}){requireLock(lock);fault('UNDER_LOCK');return snapshot();},
  async loadApprovedRegistryAfterBytes({lock,approvalSha256}){
   requireLock(lock);fault('LOAD_AFTER');
   need(digest(targetRegistryBytes)===approvalSha256,
    'B_PIN_FIXTURE_AFTER_BYTES_DRIFT');
   return Buffer.from(targetRegistryBytes);
  },
  async backupBoth({lock}){
   requireLock(lock);append(root,JOURNAL,'BACKUP_INTENT');fault('BACKUP_START');
   backup(root,HOST,requestId);fault('BACKUP_HOST_DONE');
   if(read(root,REG,true)!==null)backup(root,REG,requestId);
   else append(root,JOURNAL,'REGISTRY_ABSENT_APPROVED_CREATE_REQUIRED');
   fault('BACKUP_REGISTRY_DONE');
   append(root,JOURNAL,'BOTH_BACKED_UP');backupDone=true;
   return {complete:true,journalId:requestId};
  },
  async casHost({lock,backup:state,expectedSha256,afterBytes}){
   requireLock(lock);need(backupDone&&state.journalId===requestId,
    'B_PIN_FIXTURE_NOT_BACKED_UP');fault('HOST_BEFORE');
   append(root,JOURNAL,'HOST_CAS_INTENT');
   atomicCas(root,HOST,expectedSha256,afterBytes,requestId);
   append(root,JOURNAL,'HOST_CAS_DONE');fault('HOST_DONE');
  },
  async casRegistry({lock,backup:state,expectedSha256,afterBytes}){
   requireLock(lock);need(backupDone&&state.journalId===requestId,
    'B_PIN_FIXTURE_NOT_BACKED_UP');fault('REGISTRY_BEFORE');
   append(root,JOURNAL,'REGISTRY_CAS_INTENT');
   if(expectedSha256===null)
    atomicCreateNew(root,REG,afterBytes,requestId);
   else atomicCas(root,REG,expectedSha256,afterBytes,requestId);
   append(root,JOURNAL,'REGISTRY_CAS_DONE');fault('REGISTRY_DONE');
  },
  async readBack({lock}){requireLock(lock);fault('READBACK');return snapshot();},
  async commit({lock}){requireLock(lock);fault('COMMIT');
   append(root,JOURNAL,'COMMITTED');return {committed:true};},
  async restoreRegistry({lock,backup:state,beforeSha256,afterSha256}){
   requireLock(lock);need(state?.journalId===requestId,'B_PIN_FIXTURE_JOURNAL');
   const bytes=read(root,REG,true);
   const actual=bytes===null?null:digest(bytes);
   need(actual===beforeSha256||actual===afterSha256,
    'B_PIN_FIXTURE_EXTERNAL_DRIFT');
   if(actual===afterSha256){
    append(root,JOURNAL,'REGISTRY_RESTORE_INTENT');
    if(beforeSha256===null){
     // Exact transaction-created destination only, with afterimage SHA CAS.
     fs.unlinkSync(scope(root,REG));
    }else{
     const original=read(root,REG+'.backup.'+requestId);
     need(digest(original)===beforeSha256,'B_PIN_FIXTURE_BACKUP_DRIFT');
     atomicCas(root,REG,afterSha256,original,requestId+'-rollback');
    }
   }
   fault('RESTORE_REGISTRY');
  },
  async restoreHost({lock,backup:state,beforeSha256,afterSha256}){
   requireLock(lock);need(state?.journalId===requestId,'B_PIN_FIXTURE_JOURNAL');
   const actual=digest(read(root,HOST));
   need(actual===beforeSha256||actual===afterSha256,
    'B_PIN_FIXTURE_EXTERNAL_DRIFT');
   if(actual===afterSha256){
    const original=read(root,HOST+'.backup.'+requestId);
    need(digest(original)===beforeSha256,'B_PIN_FIXTURE_BACKUP_DRIFT');
    append(root,JOURNAL,'HOST_RESTORE_INTENT');
    atomicCas(root,HOST,afterSha256,original,requestId+'-rollback');
   }
   fault('RESTORE_HOST');
  },
  async verifyRestored({lock}){requireLock(lock);fault('VERIFY_RESTORED');
   return snapshot();},
  async releaseSharedWriterLock({lock}){requireLock(lock);fault('RELEASE');
   fs.unlinkSync(scope(root,LOCK));lease=null;},
  async recordResult({report}){
   // Never serializes host/registry content, even on an error path.
   const safe={requestId,status:report.status,phase:report.phase,
    code:report.code??null,retainLockForRecovery:report.retainLockForRecovery};
   writeExclusive(root,'pin-cas-result.'+requestId+'.json',
    Buffer.from(JSON.stringify(safe)+'\n'));
   writeExclusive(root,'pin-cas-result.'+requestId+'.txt',
    Buffer.from('requestId='+requestId+'\nstatus='+safe.status+'\ncode='+(safe.code??'NONE')+'\n'));
   return {json:true,txt:true};
  },
 };
}

export const ISOLATED_FIXTURE_MARKER=MARKER;
