// W01 approved Census-only B transaction sequencing, no direct filesystem,
// network or Windows calls. The Windows adapter must supply existing guarded IO.
// A read-only Core owner proof is required BEFORE taking the shared Writer lock.
import {assertCensusBAuthorized,CENSUS_B_DATA_ROOT,CENSUS_B_CORE_LOCK,
 CENSUS_B_WRITER_LOCK,CENSUS_B_SOURCE_ROOT,CENSUS_B_SOURCE_FILES}
 from './contract.mjs';
const SHA64=/^[a-f0-9]{64}$/;
const METHODS=['proveLiveCoreLockOwner','acquireSharedWriterLease','readPcPreimage',
 'preflightProviderReadOnly','assertCoreIdle','acquireCoreLease','verifyCoreLease','claimOnce',
 'collectAndReadback','verifySavedReadback','releaseCoreLease',
 'releaseSharedWriterLease','journalPhase'];
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
export function verifyCensusBPreimage(approval,actual){
 need(actual?.sourceHead===approval.installedSourceSha&&
  actual?.configSource===approval.installedSourceSha&&
  actual?.sourceRoot===CENSUS_B_SOURCE_ROOT&&actual?.dataRoot===CENSUS_B_DATA_ROOT&&
  actual?.coreLock===CENSUS_B_CORE_LOCK&&actual?.writerLock===CENSUS_B_WRITER_LOCK&&
  actual?.sourceClean===true&&actual?.writerLeaseOwned===true&&
  actual?.coreTaskEnabled===true&&
  CENSUS_B_SOURCE_FILES.every(k=>
   SHA64.test(actual?.sourceFilesSha256?.[k]??'')&&
   actual.sourceFilesSha256[k]===approval.sourceFilesSha256[k])&&
  Object.keys(actual.sourceFilesSha256).length===CENSUS_B_SOURCE_FILES.length,
  'W01_CENSUS_B_SOURCE_PREIMAGE_STOP');
}
export function verifyCensusBCollectorResult(result){
 need(result&&['COMPLETE','UNCHANGED'].includes(result.status)&&
  result.providerRequests===2&&Array.isArray(result.completed)&&
  result.completed.length===1&&result.completed[0]?.group==='census'&&
  JSON.stringify(result.completed[0]?.ids)==='[28]'&&
  result.completed[0]?.providerRequests===2&&
  ['SAVED_READBACK','UNCHANGED'].includes(result.completed[0]?.status)&&
  Array.isArray(result.failed)&&result.failed.length===0&&
  Array.isArray(result.skipped)&&result.skipped.length===0,
  'W01_CENSUS_B_COLLECTOR_RESULT_STOP');
 return result;
}
const safeCode=e=>/^(?:W01_CENSUS_B|INFL_MANUAL_B|WRITER_B_CORE)_[A-Z0-9_]{3,90}$/.test(e?.code??'')?
 e.code:'W01_CENSUS_B_IO_UNVERIFIED_STOP';
export async function performCensusApiB(proof,io){
 assertCensusBAuthorized(proof);
 need(io&&METHODS.every(name=>typeof io[name]==='function'),
  'W01_CENSUS_B_IO_CONTRACT_STOP');
 let writer=false,core=false,claimed=false,writeIntent=false,retain=false;
 let coreAcquireAttempted=false,claimAttempted=false;
 let firstFail=null,phase='PREFLIGHT',outcome=null;
 try{
  await io.proveLiveCoreLockOwner();phase='CORE_OWNER_VERIFIED';
  await io.acquireSharedWriterLease(proof.request.requestId);writer=true;
  const preimage=await io.readPcPreimage();
  verifyCensusBPreimage(proof.manifest,preimage);phase='SOURCE_VERIFIED';
  await io.preflightProviderReadOnly();phase='PROVIDER_PREFLIGHT_VERIFIED';
  await io.assertCoreIdle();
  coreAcquireAttempted=true;
  await io.acquireCoreLease(proof.request.requestId);core=true;
  await io.verifyCoreLease(proof.request.requestId);
  // Recheck live source and exclusive Core ownership before the one-way claim.
  verifyCensusBPreimage(proof.manifest,await io.readPcPreimage());
  claimAttempted=true;
  await io.claimOnce(proof.request.requestId);claimed=true;
  await io.journalPhase('CLAIMED');
  // After this boundary the call may have hit the provider or changed private
  // data. An unknown outcome must never be reported as a clean retry.
  writeIntent=true;phase='COLLECTION_ATTEMPTED';
  const output=verifyCensusBCollectorResult(await io.collectAndReadback());
  await io.verifyCoreLease(proof.request.requestId);
  await io.verifySavedReadback(output);
  phase='READBACK_VERIFIED';
  await io.journalPhase('COMPLETED');
  writeIntent=false;
  outcome={status:'PASS',code:'W01_CENSUS_B_SAVED_READBACK',
   requestId:proof.request.requestId,sourceSha:proof.manifest.installedSourceSha,
   providerCalls:2,stored:output.completed[0].status,
   publicWrites:0,d1Writes:0,taskChanges:0,
   replay:'FORBIDDEN'};
 }catch(e){
  firstFail=safeCode(e);
  const cleanCoreAbort=['W01_CENSUS_B_CORE_LEASE_BUSY_STOP',
   'W01_CENSUS_B_CORE_ACQUIRE_ABORTED_CLEAN_STOP'].includes(e?.code);
  const cleanClaimRefusal=e?.code==='R17_B_REQUEST_ALREADY_CLAIMED_STOP';
  retain=(claimed&&writeIntent)||
   (coreAcquireAttempted&&!core&&!cleanCoreAbort)||
   (claimAttempted&&!claimed&&!cleanClaimRefusal);
  if(claimed)try{
   await io.journalPhase(retain?'RECOVERY_REQUIRED':'CLAIMED_UNTOUCHED_STOP');
  }catch{retain=true;firstFail='W01_CENSUS_B_JOURNAL_UNVERIFIED_STOP';}
  outcome={status:retain?'STATE_UNKNOWN':'STOP',
   code:firstFail,requestId:proof.request.requestId,
   sourceSha:proof.manifest.installedSourceSha,
   lastPass:phase,providerCalls:writeIntent?null:0,
   publicWrites:0,d1Writes:0,taskChanges:0,replay:'FORBIDDEN'};
 }finally{
  if(core){
   try{await io.releaseCoreLease(proof.request.requestId);}
   catch{
    // Do not release the shared Writer mutex when the Core lease ownership
    // cannot be proven. This is for the original request's recovery owner.
    retain=true;firstFail='W01_CENSUS_B_CORE_RELEASE_UNVERIFIED_STOP';
    outcome={...outcome,status:'STATE_UNKNOWN',code:firstFail,providerCalls:null};
   }
  }
  if(writer){
   try{await io.releaseSharedWriterLease({requestId:proof.request.requestId,retain});}
   catch{firstFail='W01_CENSUS_B_WRITER_RELEASE_UNVERIFIED_STOP';
    outcome={...outcome,status:'STATE_UNKNOWN',code:firstFail,providerCalls:null};}
  }
 } return outcome;
}
