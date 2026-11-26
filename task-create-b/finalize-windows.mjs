// Fixed Windows finalizer. No Task mutation: original Task was already enabled.
// Retained original source/backup/owner claim remain immutable.
import fs from 'node:fs';
import path from 'node:path';
import {createW06RecoveryOperatingPort} from './recovery-windows.mjs';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {ORIGIN} from './recovery-contract.mjs';
import {RECOVERY_ID,ENABLED_XML_SHA} from './finalize-contract.mjs';
import {TASK} from './contract.mjs';
const HOME='E:\\ZGmini\\data\\pc-writer';
const ROOT=path.win32.join(HOME,'task-create-b',ORIGIN);
const OLD_CLAIM=path.win32.join(ROOT,'recovery-claim.json');
const FINAL_CLAIM=path.win32.join(ROOT,'finalization-attempt.json');
const COMPLETED=path.win32.join(ROOT,'recovery-completed.json');
const LOCK=path.win32.join(HOME,'writer-source-install.lock');
const stop=c=>{throw Object.assign(Error(c),{code:c})};
const need=(v,c)=>{if(!v)stop(c)};
const exact=(obj,fields)=>obj&&typeof obj==='object'&&
 !Array.isArray(obj)&&Object.keys(obj).length===fields.length&&
 fields.every(x=>Object.hasOwn(obj,x));
function boundedRead(file,max=4096){
 const s=fs.lstatSync(file);
 need(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max,
  'TASK_FINALIZE_B_MARKER_SHAPE_STOP');
 return fs.readFileSync(file);
}
function parse(file){return JSON.parse(boundedRead(file).toString('utf8'))}
function originalClaimExact(){
 const x=parse(OLD_CLAIM);
 return exact(x,['schema','requestId','originRequestId','status'])&&
  x.schema==='ZGMINI_TASK_RECOVERY_CLAIM_V1'&&
  x.requestId===RECOVERY_ID&&x.originRequestId===ORIGIN&&x.status==='CLAIMED';
}
function completedExact(){
 const x=parse(COMPLETED);
 return exact(x,['schema','requestId','originRequestId','status'])&&
  x.schema==='ZGMINI_TASK_RECOVERY_COMPLETE_V1'&&
  x.requestId===RECOVERY_ID&&x.originRequestId===ORIGIN&&x.status==='VERIFIED';
}
function finalizeClaimExact(requestId){
 const x=parse(FINAL_CLAIM);
 return exact(x,['schema','requestId','recoveryRequestId','status'])&&
  x.schema==='ZGMINI_TASK_FINALIZATION_CLAIM_V1'&&
  x.requestId===requestId&&x.recoveryRequestId===RECOVERY_ID&&x.status==='CLAIMED';
}
function createDurableOnce(file,data){
 const bytes=Buffer.from(JSON.stringify(data)+'\n');
 let fd;
 try{fd=fs.openSync(file,'wx');fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}
 finally{if(fd!==undefined)fs.closeSync(fd)}
 need(boundedRead(file).equals(bytes),'TASK_FINALIZE_B_CLAIM_READBACK_STOP');
}
export function createW06FinalizationPort(proof){
 need(process.platform==='win32','TASK_FINALIZE_B_WINDOWS_SCOPE_STOP');
 const original=proof.originalProof;
 const io=createW06RecoveryOperatingPort(original);
 const p=createOperatingTaskCreateBPort(original.originProof);
 const m=original.originProof.manifest;
 return {
  async snapshot(){
   return io.snapshot();
  },
  async claimOnce(requestId){
   need(!fs.existsSync(FINAL_CLAIM)&&!fs.existsSync(COMPLETED)&&
    boundedRead(LOCK,128).toString('utf8')===ORIGIN&&
    originalClaimExact(),'TASK_FINALIZE_B_ALREADY_ORIGIN_CLAIMED_STOP');
   createDurableOnce(FINAL_CLAIM,{
    schema:'ZGMINI_TASK_FINALIZATION_CLAIM_V1',
    requestId,recoveryRequestId:RECOVERY_ID,status:'CLAIMED'});
  },
  async finishOnce(recoveryRequestId){
   need(recoveryRequestId===RECOVERY_ID&&originalClaimExact()&&
    finalizeClaimExact(proof.request.requestId)&&
    !fs.existsSync(COMPLETED)&&
    boundedRead(LOCK,128).toString('utf8')===ORIGIN,
    'TASK_FINALIZE_B_OWNER_CAS_STOP');
   // Existing finalizer writes completed proof and releases only the exact
   // original shared lock. Does not call enableTask or alter any Task.
   await io.finishOnce(RECOVERY_ID);
  },
  async readback(requestId){
   try{
    if(!finalizeClaimExact(requestId)||!originalClaimExact()||
      !completedExact()||fs.existsSync(LOCK))return false;
    const x=await p.observe();
    return x.taskExists===true&&x.wrapperExists===true&&
     x.installedSourceSha===m.installedSourceSha&&
     x.configSourceSha===m.installedSourceSha&&
     x.coreTaskXmlSha256===m.coreTaskXmlSha256&&
     x.sidecarSourceSha256===m.sidecarSourceSha256&&
     await p.launcherReadback(m.wrapperPath,m.launcherSha256)===true&&
     await p.taskReadback({name:TASK,enabled:true,
      definitionTemplateSha256:m.enabledTemplateSha256})===true&&
     await p.verifyProtectedUnchanged()===true;
   }catch{return false}
  }
 };
}
