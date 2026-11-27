// ISOLATED TEMP FIXTURE ONLY: fixed-path raw-byte Supervisor heartbeat writer.
// This is not an operating Controller B writer or a lease/nonce authority.
// Single-process caller fences and a cooperative TEMP lock cannot make NTFS
// replacement a cross-process compare-and-swap. External writers are outside
// this contract and any ambiguous post-rename outcome requires reconciliation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {assertIsolatedOrphanRoot} from './supervisor-orphan-lease-temp-fixture.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const pid=x=>Number.isSafeInteger(x)&&x>0;
const result=(status,code,fields={})=>Object.freeze({
 schema:'ZGMINI_ORPHAN_STATUS_TEMP_WRITER_V1',
 status,code,sourceOnlyFixture:true,operatingEffectAuthorized:false,
 operatingWrites:0,runnerStarts:0,runnerStops:0,
 leaseMutationAuthorized:false,heartbeatWriteAuthorized:false,
 ...fields
});
const blocked=code=>result('BLOCKED',code);
const hasExactKeys=(obj,keys)=>obj!==null&&typeof obj==='object'&&
 !Array.isArray(obj)&&Object.keys(obj).length===keys.length&&
 keys.every(k=>Object.hasOwn(obj,k));
function validHeartbeat(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<80||bytes.length>16384)return false;
 let obj;
 try{
  obj=JSON.parse(bytes.toString('utf8'));
  if(Buffer.compare(bytes,Buffer.from(JSON.stringify(obj)+'\n'))!==0)
   return false;
 }catch{return false;}
 if(!hasExactKeys(obj,['at','pid','sourceSha','mode','adoptionMode',
   'children','restartCounts'])||
    typeof obj.at!=='string'||!Number.isFinite(Date.parse(obj.at))||
    !pid(obj.pid)||!/^[a-f0-9]{40}$/.test(obj.sourceSha)||
    obj.mode!=='LISTENING'||
    obj.adoptionMode!=='ADOPT_EXISTING_SIX_NO_SPAWN'||
    !hasExactKeys(obj.restartCounts,[])||
    !Array.isArray(obj.children)||obj.children.length!==6)return false;
 const pids=new Set();
 for(let i=0;i<6;i++){
  const child=obj.children[i];
  if(!hasExactKeys(child,['seat','pid','alive'])||
    child.seat!==i+1||!pid(child.pid)||child.alive!==true||
    pids.has(child.pid)||child.pid===obj.pid)return false;
  pids.add(child.pid);
 }
 return true;
}
function readRegular(io,file){
 const stat=io.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||
    stat.size<20||stat.size>16384)
  throw Error('ORPHAN_STATUS_TEMP_FILE_UNSAFE');
 const body=io.readFileSync(file);
 if(!Buffer.isBuffer(body)||body.length!==stat.size)
  throw Error('ORPHAN_STATUS_TEMP_BYTES_UNVERIFIED');
 return body;
}

// The only file this fixture can touch is the exact
// OS_TEMP/zgmini-orphan-fixture-*/pc-control/SUPERVISOR_STATUS.json.
// An existing, verified synthetic lease directory is mandatory via the
// reusable assertIsolatedOrphanRoot check; no caller-supplied filename.
export function createIsolatedOrphanStatusWriter({
 root,filesystem=fs,tempRoot=os.tmpdir(),beforeCommit=null
}={}){
 let base;
 try{base=assertIsolatedOrphanRoot(root,{filesystem,tempRoot});}
 catch{return async()=>blocked('ORPHAN_STATUS_TEMP_SCOPE_DENIED');}
 const statusFile=path.join(base,'pc-control','SUPERVISOR_STATUS.json');
 const lock=path.join(base,'pc-control','orphan-status-cas-lock');
 const ensureScope=()=>assertIsolatedOrphanRoot(root,{filesystem,tempRoot})===base;
 return async function writeStatus(packet){
  let held=false,attemptedReplace=false,verified=false,stage=null;
  try{
   if(!ensureScope())return blocked('ORPHAN_STATUS_TEMP_SCOPE_CHANGED');
   if(packet?.schema!=='ZGMINI_ORPHAN_EXACT_HEARTBEAT_CAS_WRITE_V1'||
      packet.fixedFile!=='SUPERVISOR_STATUS.json'||
      !sha64(packet.expectedRawSha256)||!sha64(packet.nextRawSha256)||
      typeof packet.canCommit!=='function'||
      !validHeartbeat(packet.nextRawBytes))
    return blocked('ORPHAN_STATUS_TEMP_PACKET_INVALID');
   // Decouple the following byte verification from any mutable caller Buffer.
   const next=Buffer.from(packet.nextRawBytes);
   if(sha(next)!==packet.nextRawSha256||packet.canCommit()!==true)
    return blocked('ORPHAN_STATUS_TEMP_PAYLOAD_OR_FENCE_INVALID');
   if(sha(readRegular(filesystem,statusFile))!==packet.expectedRawSha256)
    return blocked('ORPHAN_STATUS_TEMP_INITIAL_CAS_CHANGED');
   // Atomic mkdir excludes *cooperating* test writers, not a foreign
   // process editing the same file. A busy lock is never stolen or deleted.
   try{filesystem.mkdirSync(lock);}
   catch{return blocked('ORPHAN_STATUS_TEMP_LOCK_BUSY');}
   held=true;
   if(!ensureScope()||
      sha(readRegular(filesystem,statusFile))!==packet.expectedRawSha256)
    return blocked('ORPHAN_STATUS_TEMP_LOCKED_CAS_CHANGED');
   stage=path.join(base,'pc-control',
    'SUPERVISOR_STATUS.'+randomUUID()+'.tmp');
   const fd=filesystem.openSync(stage,'wx',0o600);
   try{filesystem.writeFileSync(fd,next);filesystem.fsyncSync(fd);}
   finally{filesystem.closeSync(fd);}
   if(sha(readRegular(filesystem,stage))!==packet.nextRawSha256)
    return blocked('ORPHAN_STATUS_TEMP_STAGED_BYTES_CHANGED');
   // Injected hook is ONLY for isolated race/failure simulations. It is
   // never part of any operating-PC B implementation.
   if(beforeCommit!==null){
    if(typeof beforeCommit!=='function')
     return blocked('ORPHAN_STATUS_TEMP_TEST_HOOK_INVALID');
    await beforeCommit();
   }
   if(!ensureScope()||packet.canCommit()!==true||
      sha(readRegular(filesystem,statusFile))!==packet.expectedRawSha256)
    return blocked('ORPHAN_STATUS_TEMP_PRECOMMIT_CAS_CHANGED');
   attemptedReplace=true;
   filesystem.renameSync(stage,statusFile);
   stage=null;
   const readback=sha(readRegular(filesystem,statusFile));
   if(readback!==packet.nextRawSha256)
    return result('RECOVERY_REQUIRED','ORPHAN_STATUS_TEMP_POSTREPLACE_UNVERIFIED');
   verified=true;
   return result('EXACT_RAW_CAS_READBACK_VERIFIED',
    'ORPHAN_STATUS_TEMP_EXACT_RAW_READBACK',{
     expectedRawSha256:packet.expectedRawSha256,
     readbackRawSha256:readback
    });
  }catch{
   return result(attemptedReplace?'RECOVERY_REQUIRED':'BLOCKED',
    attemptedReplace?'ORPHAN_STATUS_TEMP_UNKNOWN_AFTER_REPLACE':
     'ORPHAN_STATUS_TEMP_PRECOMMIT_UNKNOWN');
  }finally{
   // Never hide a possible post-rename effect by removing the lock or
   // calling this writer again. Preserve evidence for separate inspection.
   if(held&&(!attemptedReplace||verified)){
    if(stage)try{filesystem.unlinkSync(stage);}catch{}
    try{filesystem.rmdirSync(lock);}catch{}
   }
  }
 };
}
