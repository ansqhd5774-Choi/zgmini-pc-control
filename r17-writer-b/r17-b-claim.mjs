// Exact one-request claim without consuming a requestId under contention.
// Acquire the shared Writer mutex FIRST. A losing concurrent worker must not
// create a request journal or mark an approved one-shot request as spent.
import fs from 'node:fs';
import path from 'node:path';
const stop=(code)=>{throw Object.assign(new Error(code),{code});};
export function acquireInstallClaim({journalRoot,requestId,sharedLock}){
  const journalDir=path.join(journalRoot,requestId);
  const journalFile=path.join(journalDir,'journal.jsonl');
  const hooksDir=path.join(journalDir,'hooks-empty');
  fs.mkdirSync(journalRoot,{recursive:true});
  if(fs.existsSync(journalDir))stop('R17_B_REQUEST_ALREADY_CLAIMED_STOP');
  let fd;
  try{fd=fs.openSync(sharedLock,'wx');}
  catch(error){
    if(error?.code==='EEXIST')stop('R17_B_SHARED_INSTALL_BUSY_NOOP_STOP');
    stop('R17_B_SHARED_INSTALL_LOCK_STOP');
  }
  try{
    fs.writeSync(fd,requestId);
    fs.fsyncSync(fd);
    fs.mkdirSync(journalDir,{recursive:false});
    fs.writeFileSync(journalFile,JSON.stringify({status:'CLAIMED',at:new Date().toISOString()})+'\n',{flag:'wx'});
    fs.mkdirSync(hooksDir,{recursive:false});
    return {fd,journalDir,journalFile,hooksDir};
  }catch{
    // No live Git/config/Task mutation is possible before claim returns.
    // The incomplete journal directory remains to prevent blind replay.
    fs.closeSync(fd);
    try{if(fs.readFileSync(sharedLock,'utf8')===requestId)fs.unlinkSync(sharedLock);}catch{}
    stop('R17_B_CLAIM_INITIALIZATION_STOP');
  }
}

export function releaseInstallClaim({fd,sharedLock,requestId,retain}){
  fs.closeSync(fd);
  if(retain)return;
  if(fs.readFileSync(sharedLock,'utf8')!==requestId)
    stop('R17_B_SHARED_LOCK_DRIFT_STOP');
  fs.unlinkSync(sharedLock); // Only the exact owned single lock leaf.
}
