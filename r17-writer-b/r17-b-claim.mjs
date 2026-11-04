// Exact one-request claim without consuming a requestId under contention or
// a read-only prevalidation failure. Hold one shared Writer mutex throughout
// preflight, journal claim, and the operational transition.
import fs from 'node:fs';
import path from 'node:path';
const stop=(code)=>{throw Object.assign(new Error(code),{code});};
export function acquireInstallLock({journalRoot,requestId,sharedLock}){
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
    return {fd,journalDir,journalFile,hooksDir};
  }catch{
    fs.closeSync(fd);
    try{if(fs.readFileSync(sharedLock,'utf8')===requestId)fs.unlinkSync(sharedLock);}catch{}
    stop('R17_B_SHARED_INSTALL_LOCK_STOP');
  }
}

export function createInstallJournal({journalRoot,requestId,sharedLock,fd}){
  // Only the request holding the OS mutex may consume its one-shot journal.
  if(!Number.isInteger(fd)||fd<0||fs.readFileSync(sharedLock,'utf8')!==requestId)
    stop('R17_B_SHARED_LOCK_DRIFT_STOP');
  const journalDir=path.join(journalRoot,requestId);
  const journalFile=path.join(journalDir,'journal.jsonl');
  const hooksDir=path.join(journalDir,'hooks-empty');
  if(fs.existsSync(journalDir))stop('R17_B_REQUEST_ALREADY_CLAIMED_STOP');
  try{
    fs.mkdirSync(journalDir,{recursive:false});
    fs.writeFileSync(journalFile,JSON.stringify({status:'CLAIMED',at:new Date().toISOString()})+'\n',{flag:'wx'});
    fs.mkdirSync(hooksDir,{recursive:false});
    return {journalDir,journalFile,hooksDir};
  }catch{
    // A partial journal is retained for diagnosis; never auto-reuse its ID.
    stop('R17_B_CLAIM_INITIALIZATION_STOP');
  }
}

// Compatibility helper for the original exact-once claim contract.
export function acquireInstallClaim(args){
  const lock=acquireInstallLock(args);
  try{return {...lock,...createInstallJournal({...args,fd:lock.fd})};}
  catch(error){
    releaseInstallClaim({fd:lock.fd,sharedLock:args.sharedLock,
      requestId:args.requestId,retain:false});
    throw error;
  }
}

export function releaseInstallClaim({fd,sharedLock,requestId,retain}){
  fs.closeSync(fd);
  if(retain)return;
  if(fs.readFileSync(sharedLock,'utf8')!==requestId)
    stop('R17_B_SHARED_LOCK_DRIFT_STOP');
  fs.unlinkSync(sharedLock); // Only the exact owned single lock leaf.
}
