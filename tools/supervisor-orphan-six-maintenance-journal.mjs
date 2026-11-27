// Existing maintainer-root request ledger adapter for the orphan-six B session.
// It is NOT a CLI or standalone installer. Only a trusted independent maintainer
// holding the existing controller-install lock may create/change this journal.
// No Runner, watchdog, heartbeat or other PC operation is performed here.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const SCHEMA='ZGMINI_ORPHAN_GRACEFUL_SIX_JOURNAL_V1';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const reqId=x=>typeof x==='string'&&/^pc-[a-f0-9-]{36}$/.test(x);
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const allowedStatus=new Set(['CANDIDATE_ONLY','RECOVERY_REQUIRED']);
const allowedPhase=new Set(['PREPARED','STOP_INTENT_RECORDED',
 'SEAT_EXIT_VERIFIED','WAITING_WATCHDOG','RECOVERY_REQUIRED','SOURCE_FINAL_CANDIDATE']);
const fields=['schema','requestId','manifestRawSha256','proposalId','status','phase',
 'intentCount','stoppedCount','nextSeat','code'];
function exactRecord(x,requestId,manifestRawSha256){
 if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).sort().join(',')!==fields.slice().sort().join(',')||
    x.schema!==SCHEMA||x.requestId!==requestId||
    x.manifestRawSha256!==manifestRawSha256||
    !sha64(x.proposalId)||!allowedStatus.has(x.status)||
    !allowedPhase.has(x.phase)||
    !Number.isInteger(x.intentCount)||x.intentCount<0||x.intentCount>6||
    !Number.isInteger(x.stoppedCount)||x.stoppedCount<0||
    x.stoppedCount>6||x.stoppedCount>x.intentCount||
    x.intentCount-x.stoppedCount>1||
    !Number.isInteger(x.nextSeat)||x.nextSeat<1||x.nextSeat>7||
    x.nextSeat!==x.stoppedCount+1||
    typeof x.code!=='string'||!/^[A-Z][A-Z0-9_]{2,79}$/.test(x.code))
   fail('ORPHAN_SIX_JOURNAL_RECORD_INVALID');
 if(x.status==='RECOVERY_REQUIRED'&&x.phase!=='RECOVERY_REQUIRED')
  fail('ORPHAN_SIX_JOURNAL_RECOVERY_PHASE_INVALID');
 if(x.status==='CANDIDATE_ONLY'&&x.phase==='RECOVERY_REQUIRED')
  fail('ORPHAN_SIX_JOURNAL_RECOVERY_PHASE_INVALID');
 return x;
}
function readRegular(file){
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
    st.size<10||st.size>8192)fail('ORPHAN_SIX_JOURNAL_FILE_INVALID');
 const bytes=fs.readFileSync(file);
 const after=fs.lstatSync(file);
 if(after.ino!==st.ino||after.size!==st.size||after.mtimeMs!==st.mtimeMs||
    bytes.length!==st.size)fail('ORPHAN_SIX_JOURNAL_CHANGED_DURING_READ');
 return bytes;
}
function writeNew(file,bytes){
 const fd=fs.openSync(file,'wx',0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}
// Existing maintenance-agent uses the same controller-install atomic lock.
// Its release()/holdForRecovery() belong to the caller, never this adapter.
export function createOrphanSixMaintenanceJournal({
 root,requestId,manifestRawSha256,lease
}={}){
 if(!path.isAbsolute(root??'')||!reqId(requestId)||!sha64(manifestRawSha256)||
    !lease?.owner||lease.owner.pid!==process.pid||
    typeof lease.owner.nonce!=='string'||lease.owner.nonce.length<16)
  fail('ORPHAN_SIX_JOURNAL_CONTEXT_DENIED');
 const requestedRoot=path.resolve(root);
 const rootStat=fs.lstatSync(requestedRoot);
 const requests=path.join(requestedRoot,'requests');
 const dirStat=fs.lstatSync(requests);
 if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||
    !dirStat.isDirectory()||dirStat.isSymbolicLink())
  fail('ORPHAN_SIX_JOURNAL_ROOT_INVALID');
 const file=path.join(requests,'orphan-six-'+sha256(requestId)+'.json');
 const ownerFile=path.join(requestedRoot,'leases','controller-install','owner.json');
 function verifyLease(){
  let actual;
  try{actual=JSON.parse(readRegular(ownerFile).toString('utf8'));}
  catch{fail('ORPHAN_SIX_INSTALL_LEASE_UNVERIFIED');}
  if(actual?.pid!==process.pid||
     actual?.nonce!==lease.owner.nonce||
     actual?.bootAt!==lease.owner.bootAt)
    fail('ORPHAN_SIX_INSTALL_LEASE_UNVERIFIED');
 }
 function read(){
  try{
   const bytes=readRegular(file);
   let record;
   try{record=JSON.parse(bytes.toString('utf8'));}
   catch{fail('ORPHAN_SIX_JOURNAL_JSON_INVALID');}
   exactRecord(record,requestId,manifestRawSha256);
   return Object.freeze({record,sha256:sha256(bytes)});
  }catch(e){if(e?.code==='ENOENT')return null;throw e;}
 }
 function commit(record,expectedSha256=null){
  verifyLease();
  exactRecord(record,requestId,manifestRawSha256);
  const bytes=Buffer.from(JSON.stringify(record)+'\n','utf8');
  if(bytes.length>8192)fail('ORPHAN_SIX_JOURNAL_SIZE_INVALID');
  const nextSha=sha256(bytes);
  if(expectedSha256===null){
   if(read()!==null)fail('ORPHAN_SIX_JOURNAL_ALREADY_CLAIMED');
   try{writeNew(file,bytes);}
   catch(e){if(e?.code==='EEXIST')fail('ORPHAN_SIX_JOURNAL_ALREADY_CLAIMED');throw e;}
  }else{
   if(!sha64(expectedSha256))fail('ORPHAN_SIX_JOURNAL_EXPECTED_SHA_INVALID');
   const before=read();
   if(!before||before.sha256!==expectedSha256)
    fail('ORPHAN_SIX_JOURNAL_CAS_MISMATCH');
   // CAS is serialized by the independently owned controller-install lease.
   // Recheck both lease and bytes immediately before atomic replace.
   const tmp=path.join(requests,'.orphan-six-'+randomUUID()+'.tmp');
   let renamed=false;
   try{
    writeNew(tmp,bytes);
    verifyLease();
    if(read()?.sha256!==expectedSha256)
     fail('ORPHAN_SIX_JOURNAL_CAS_MISMATCH');
    fs.renameSync(tmp,file);
    renamed=true;
   }finally{if(!renamed)try{fs.unlinkSync(tmp);}catch{/* leave evidence */}}
  }
  const observed=read();
  if(observed?.sha256!==nextSha)fail('ORPHAN_SIX_JOURNAL_READBACK_UNKNOWN');
  verifyLease();
  return Object.freeze({status:'EXACT_CAS_READBACK_VERIFIED',
   previousSha256:expectedSha256,readbackSha256:nextSha,
   phase:record.phase,code:record.code});
 }
 return Object.freeze({read,commit});
}
