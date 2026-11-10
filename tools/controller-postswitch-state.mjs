// Append-only, separately claimed state for an operator-approved #917 recovery.
// The old update ledger and install lease are never modified by this module.
// This module has no CLI; calling it is NOT a maintenance authorization.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const digest=data=>createHash('sha256').update(data).digest('hex');
const need=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
const sha64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sha40=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const idOk=value=>typeof value==='string'&&/^pc-update-[a-f0-9-]{36}$/.test(value);
const json=bytes=>JSON.parse(bytes.toString('utf8'));
const filename=index=>String(index).padStart(6,'0')+'.json';
function durableNewFile(file,value){
  const fd=fs.openSync(file,'wx',0o600);
  try{fs.writeFileSync(fd,value);fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
}

/** Never resume or clean an existing claim automatically. */
export function acquirePostSwitchState({maintenanceRoot,requestId,ledgerSha256,sourceSha,
  now=()=>new Date().toISOString(),nonce=randomUUID()}){
  need(path.isAbsolute(maintenanceRoot)&&idOk(requestId)&&
    sha64(ledgerSha256)&&sha40(sourceSha)&&
    typeof nonce==='string'&&/^[0-9a-f-]{36}$/.test(nonce),
  'POSTSWITCH_CLAIM_ARGUMENTS_INVALID');
  const ledgerFile=path.join(maintenanceRoot,'ledger',requestId+'.json');
  need(fs.existsSync(ledgerFile)&&
    digest(fs.readFileSync(ledgerFile))===ledgerSha256,
  'POSTSWITCH_ORIGINAL_LEDGER_CHANGED');
  const claimDir=path.join(maintenanceRoot,'leases','controller-recovery');
  const stateDir=path.join(maintenanceRoot,'recovery','post-switch',requestId);
  // The shared name also excludes concurrent rollback/abort-untouched.
  need(!fs.existsSync(claimDir),'POSTSWITCH_RECOVERY_CLAIM_EXISTS');
  need(!fs.existsSync(stateDir),'POSTSWITCH_RECOVERY_RECORD_EXISTS');
  try{fs.mkdirSync(claimDir);}catch(error){
    if(error?.code==='EEXIST')need(false,'POSTSWITCH_RECOVERY_CLAIM_EXISTS');
    throw error;
  }
  const owner={schema:'ZGMINI_PC_POSTSWITCH_OWNER_V1',pid:process.pid,
    nonce,requestId,ledgerSha256,sourceSha,at:now()};
  // Failure leaves the exclusive claim in place for manual inspection.
  durableNewFile(path.join(claimDir,'owner.json'),JSON.stringify(owner)+'\n');
  fs.mkdirSync(stateDir,{recursive:true});
  let previousHash=null,sequence=0;
  function verifyStillHeld(){
    need(digest(fs.readFileSync(ledgerFile))===ledgerSha256,
      'POSTSWITCH_ORIGINAL_LEDGER_CHANGED');
    const current=json(fs.readFileSync(path.join(claimDir,'owner.json')));
    need(current.nonce===nonce&&current.requestId===requestId&&
      current.ledgerSha256===ledgerSha256,
    'POSTSWITCH_RECOVERY_CLAIM_CHANGED');
  }
  function append(code,details={}){
    need(typeof code==='string'&&/^[A-Z0-9_]+$/.test(code)&&
      details&&typeof details==='object'&&!Array.isArray(details),
    'POSTSWITCH_RECOVERY_RECORD_INVALID');
    verifyStillHeld();
    const existing=fs.readdirSync(stateDir).sort();
    need(existing.length===sequence && existing.every((name,index)=>(
      name===filename(index+1))) &&
      (sequence===0 || inspectPostSwitchState({maintenanceRoot,requestId}).lastHash===previousHash),
    'POSTSWITCH_RECOVERY_RECORD_DRIFT');
    const record={schema:'ZGMINI_PC_POSTSWITCH_RECORD_V1',requestId,
      sequence:sequence+1,previousHash,code,details,at:now()};
    const raw=JSON.stringify(record)+'\n';
    durableNewFile(path.join(stateDir,filename(sequence+1)),raw);
    previousHash=digest(raw);sequence++;
    return {...record,sha256:previousHash};
  }
  const initial=append('RECOVERY_CLAIM_ACQUIRED',{sourceSha,ledgerSha256});
  return {owner,initial,append,verifyStillHeld,claimDir,stateDir,
    // A failed or ambiguous operation leaves this claim intact by design.
    releaseUntouched(){
      verifyStillHeld();
      need(sequence===1,'POSTSWITCH_CLAIM_ALREADY_USED');
      fs.unlinkSync(path.join(claimDir,'owner.json'));
      fs.rmdirSync(claimDir);
    },
  };
}

export function inspectPostSwitchState({maintenanceRoot,requestId}){
  need(path.isAbsolute(maintenanceRoot)&&idOk(requestId),
    'POSTSWITCH_STATE_ARGUMENTS_INVALID');
  const stateDir=path.join(maintenanceRoot,'recovery','post-switch',requestId);
  const claimDir=path.join(maintenanceRoot,'leases','controller-recovery');
  const exists=fs.existsSync(stateDir);
  if(!exists)return {exists:false,claimExists:fs.existsSync(claimDir)};
  const entries=fs.readdirSync(stateDir).sort();
  need(entries.length>0,'POSTSWITCH_RECOVERY_RECORD_INCOMPLETE');
  let previousHash=null,last=null;
  entries.forEach((name,index)=>{
    need(name===filename(index+1),'POSTSWITCH_RECOVERY_RECORD_SEQUENCE_DRIFT');
    const raw=fs.readFileSync(path.join(stateDir,name)),entry=json(raw);
    need(entry.schema==='ZGMINI_PC_POSTSWITCH_RECORD_V1'&&
      entry.requestId===requestId&&entry.sequence===index+1&&
      entry.previousHash===previousHash,
    'POSTSWITCH_RECOVERY_RECORD_CHAIN_DRIFT');
    previousHash=digest(raw);last=entry;
  });
  return {exists:true,claimExists:fs.existsSync(claimDir),count:entries.length,
    lastCode:last.code,lastHash:previousHash};
}

/** Explicitly claimed continuation; preserves the dead owner's bytes and the
 * entire original journal. A second continuation is rejected atomically. */
export function resumePostSwitchState({maintenanceRoot,requestId,sourceSha,ledgerSha256,
  contract,now=()=>new Date().toISOString(),livePid=pid=>{
    try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}
  }}){
  need(path.isAbsolute(maintenanceRoot)&&idOk(requestId)&&sha40(sourceSha)&&sha64(ledgerSha256),
    'POSTSWITCH_RESUME_ARGUMENTS_INVALID');
  const claimDir=path.join(maintenanceRoot,'leases/controller-recovery');
  const stateDir=path.join(maintenanceRoot,'recovery/post-switch',requestId);
  const ownerFile=path.join(claimDir,'owner.json');
  const ledgerFile=path.join(maintenanceRoot,'ledger',requestId+'.json');
  const raw=fs.readFileSync(ownerFile),owner=json(raw);
  const state=inspectPostSwitchState({maintenanceRoot,requestId});
  need(sha64(contract?.ownerSha256)&&sha64(contract?.recordTailSha256)&&
    Number.isSafeInteger(contract?.recordCount)&&contract.recordCount>0&&
    digest(raw)===contract.ownerSha256&&owner.requestId===requestId&&
    owner.sourceSha===(contract.ownerSourceSha??contract.priorSourceSha)&&owner.ledgerSha256===ledgerSha256&&
    livePid(owner.pid)===false&&state.count===contract.recordCount&&
    state.lastHash===contract.recordTailSha256&&digest(fs.readFileSync(ledgerFile))===ledgerSha256,
    'POSTSWITCH_RESUME_STATE_DRIFT');
  const finalizing=contract.mode==='FINALIZE_1215_1216_EXISTING_RESULTS';
  const priorContinuation=path.join(claimDir,'resume-1215/owner.json');
  if(finalizing){
    const priorRaw=fs.readFileSync(priorContinuation),prior=json(priorRaw);
    need(digest(priorRaw)===contract.priorContinuationOwnerSha256&&
      prior.sourceSha===contract.priorSourceSha&&livePid(prior.pid)===false,
      'POSTSWITCH_FINALIZE_PRIOR_OWNER_DRIFT');
  }
  const resumeDir=path.join(claimDir,finalizing?'finalize-1216':'resume-1215');
  try{fs.mkdirSync(resumeDir);}catch(e){
    if(e.code==='EEXIST')need(false,'POSTSWITCH_RESUME_ALREADY_CLAIMED');throw e;
  }
  const active={requestId,sourceSha,pid:process.pid,nonce:randomUUID(),at:now()};
  const activeFile=path.join(resumeDir,'owner.json');
  durableNewFile(activeFile,JSON.stringify(active)+'\n');
  const activeDigest=digest(fs.readFileSync(activeFile));
  let sequence=state.count,previousHash=state.lastHash;
  function verifyStillHeld(){
    need(digest(fs.readFileSync(ownerFile))===contract.ownerSha256&&
      digest(fs.readFileSync(activeFile))===activeDigest&&
      (!finalizing||digest(fs.readFileSync(priorContinuation))===contract.priorContinuationOwnerSha256)&&
      digest(fs.readFileSync(ledgerFile))===ledgerSha256,'POSTSWITCH_RESUME_OWNER_DRIFT');
  }
  function append(code,details={}){
    verifyStillHeld();const current=inspectPostSwitchState({maintenanceRoot,requestId});
    need(/^[A-Z0-9_]+$/.test(code)&&current.count===sequence&&current.lastHash===previousHash,
      'POSTSWITCH_RESUME_JOURNAL_DRIFT');
    const record={schema:'ZGMINI_PC_POSTSWITCH_RECORD_V1',requestId,
      sequence:sequence+1,previousHash,code,details,at:now()};
    const bytes=JSON.stringify(record)+'\n';
    durableNewFile(path.join(stateDir,filename(++sequence)),bytes);
    previousHash=digest(bytes);return record;
  }
  append('RECOVERY_CLAIM_RESUMED',{sourceSha,priorSourceSha:contract.priorSourceSha,
    replayIssueNumber:contract.replayIssueNumber});
  return {claimDir,stateDir,owner,append,verifyStillHeld};
}
