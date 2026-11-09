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
