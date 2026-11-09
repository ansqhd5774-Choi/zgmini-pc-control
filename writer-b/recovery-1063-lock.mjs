// Only exact-owner, archived, same-file Writer B #1063 lock finalization.
// This is not a general-purpose forced unlock function.
import fs from 'node:fs';
import path from 'node:path';
import {INCIDENT_ID} from './recovery-1063-core.mjs';

const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
function fixedBytes(file,io){
 const stat=io.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=128,
  'WRITER_B_1063_LOCK_UNSAFE');
 const resolved=io.realpathSync.native(file);
 need(path.normalize(resolved).toLowerCase()===path.normalize(file).toLowerCase(),
  'WRITER_B_1063_LOCK_REPARSE');
 return io.readFileSync(file);
}
export function archiveAndFinalizeExactLock({lock,journal,expected=INCIDENT_ID,io=fs}){
 need(expected===INCIDENT_ID,'WRITER_B_1063_LOCK_REQUEST_MISMATCH');
 const initial=io.lstatSync(lock);
 const original=fixedBytes(lock,io);
 need(original.toString('utf8')===INCIDENT_ID,
  'WRITER_B_1063_LOCK_CHANGED');
 const archived=path.join(journal,'recovery-1063-exact-owner-lock.original');
 io.copyFileSync(lock,archived,fs.constants.COPYFILE_EXCL);
 // Windows FlushFileBuffers requires a write-capable handle. Never pretend
 // archive durability is proven when such a handle cannot be obtained.
 const fd=io.openSync(archived,'r+');
 try{io.fsyncSync(fd);}finally{io.closeSync(fd);}
 need(fixedBytes(archived,io).equals(original),
  'WRITER_B_1063_LOCK_ARCHIVE_READBACK_FAILED');
 const latest=io.lstatSync(lock);
 need(latest.isFile()&&!latest.isSymbolicLink()&&
  latest.size===initial.size&&latest.mtimeMs===initial.mtimeMs&&
  (!initial.ino||!latest.ino||initial.ino===latest.ino)&&
  (!initial.dev||!latest.dev||initial.dev===latest.dev)&&
  fixedBytes(lock,io).equals(original),
  'WRITER_B_1063_LOCK_CHANGED_BEFORE_FINALIZE');
 io.unlinkSync(lock);
 return {archived:true,lockFinalized:true};
}
