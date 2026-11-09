// I/O-free one-shot transaction coordinator. A trusted Windows adapter must
// implement the fixed effects; this is not an executable pc-job or B shortcut.
import {
 assertAuthorizedManualReceiver,DATA_ROOT,MAX_BYTES,SOURCE_FILES,TARGETS,URLS,
} from './contract.mjs';

const SHA64=/^[a-f0-9]{64}$/i;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const METHODS=['acquireSharedLock','readSourcePreimage','fetchExactSources',
 'preflightParse','assertCoreIdle','acquireCoreLease','verifyCoreLease',
 'releaseCoreLease','claimOnce','applyData','readbackStored','journalPhase',
 'releaseSharedLock'];
const EXPECTED_STATUS=new Set(['SAVED_READBACK','UNCHANGED','ARCHIVED_READBACK']);

export function verifyManualPreimage(manifest,preimage){
 need(object(preimage)&&preimage.sourceRoot===manifest.sourceRoot&&
  preimage.sourceHead===manifest.sourceSha&&
  preimage.configSource===manifest.sourceSha&&
  object(preimage.sourceFiles)&&
  Object.keys(preimage.sourceFiles).length===SOURCE_FILES.length&&
  SOURCE_FILES.every((name,i)=>
   preimage.sourceFiles[name]===manifest.sourceFiles[i].sha256)&&
  preimage.dataRoot===DATA_ROOT&&preimage.otherWriterActive===false,
  'INFL_MANUAL_B_PC_PREIMAGE_STOP');
 return preimage;
}

export function verifyOfficialBytes(bytes){
 need(object(bytes)&&Object.keys(bytes).length===2&&
  Buffer.isBuffer(bytes.bls)&&Buffer.isBuffer(bytes.census)&&
  bytes.bls.length>0&&bytes.bls.length<=MAX_BYTES.bls&&
  bytes.census.length>0&&bytes.census.length<=MAX_BYTES.census,
  'INFL_MANUAL_B_SOURCE_BYTES_STOP');
 return bytes;
}

export function verifyManualOutcome(result,requestId){
 need(object(result)&&EXPECTED_STATUS.has(result.status)&&
  result.requestId===requestId&&
  result.apiCalls===0&&result.dbWrites===0&&
  result.d1Writes===0&&result.coreCheckpointWrites===0&&
  object(result.archives)&&
  SHA64.test(result.archives.bls?.hash??'')&&
  SHA64.test(result.archives.census?.hash??''),
  'INFL_MANUAL_B_RESULT_SCOPE_STOP');
 if(result.status==='SAVED_READBACK'){
  need(object(result.writes)&&Object.keys(result.writes).length>=1&&
   Object.keys(result.writes).every(k=>k==='bls'||k==='census')&&
   Object.values(result.writes).every(v=>SHA64.test(v?.sha256??'')),
   'INFL_MANUAL_B_WRITE_HASH_STOP');
 }
 return result;
}

function safeCode(error){
 const code=error?.code;
 return typeof code==='string'&&
  /^INFL_MANUAL_(?:B|STORE)_[A-Z0-9_]{1,90}$/.test(code)?
   code:'INFL_MANUAL_B_UNEXPECTED_STOP';
}

export async function performOfficialManualB(auth,io){
 assertAuthorizedManualReceiver(auth);
 need(object(io)&&METHODS.every(name=>typeof io[name]==='function'),
  'INFL_MANUAL_B_ADAPTER_METHODS_STOP');
 const requestId=auth.request.requestId,manifest=auth.manifest;
 let locked=false,coreLeased=false,claimed=false,writeIntent=false,retain=false;
 let result={status:'INFL_MANUAL_B_STATE_UNKNOWN',
  code:'INFL_MANUAL_B_RESULT_UNVERIFIED_STOP',requestId};
 try{
  // A busy shared writer lock must stop without consuming requestId.
  await io.acquireSharedLock(requestId);locked=true;
  verifyManualPreimage(manifest,await io.readSourcePreimage(manifest));
  const bytes=verifyOfficialBytes(await io.fetchExactSources({urls:URLS,
   maxBytes:MAX_BYTES,timeoutMs:manifest.timeoutMs}));
  // Import and parse the actual Census XLSX with the PC's installed xlsx-lite
  // before any data write or one-shot request journal is claimed.
  await io.preflightParse({base:DATA_ROOT,blsBytes:bytes.bls,
   censusBytes:bytes.census});
  await io.assertCoreIdle();
  // A quiet Core sample is not a lock: use the existing Core-exclusive lease.
  await io.acquireCoreLease(requestId);coreLeased=true;
  await io.claimOnce(requestId);claimed=true;
  await io.journalPhase('CLAIMED');
  // Re-check source and the owned lease immediately before first mutation.
  verifyManualPreimage(manifest,await io.readSourcePreimage(manifest));
  await io.verifyCoreLease(requestId);
  writeIntent=true;
  const stored=verifyManualOutcome(await io.applyData({base:DATA_ROOT,
   blsBytes:bytes.bls,censusBytes:bytes.census,requestId,
   targets:TARGETS}),requestId);
  await io.readbackStored(stored);
  await io.journalPhase('COMPLETED');
  result={status:'INFL_MANUAL_B_SAVED_VERIFIED',
   code:stored.status==='UNCHANGED'?'INFL_MANUAL_B_UNCHANGED':
    'INFL_MANUAL_B_READBACK_VERIFIED',requestId,
   sourceSha256s:{bls:stored.archives.bls.hash,
    census:stored.archives.census.hash},
   storedStatus:stored.status,
   committed:Object.fromEntries(Object.entries(stored.writes??{})
    .map(([key,value])=>[key,value.sha256]))};
 }catch(error){
  const code=safeCode(error);
  retain=writeIntent;
  const phase=writeIntent?'RECOVERY_REQUIRED':
   claimed?'CLAIMED_UNTOUCHED_STOP':'PREFLIGHT_STOP';
  if(claimed){
   try{await io.journalPhase(phase,error?.recovery??null);}catch{retain=true;}
  }
  result={status:writeIntent?'INFL_MANUAL_B_RECOVERY_REQUIRED':
   'INFL_MANUAL_B_PREFLIGHT_STOP',code,requestId,
   retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
 }finally{
  if(coreLeased){
   try{await io.releaseCoreLease(requestId);}catch{
    retain=true;
    result={status:'INFL_MANUAL_B_RECOVERY_REQUIRED',
     code:'INFL_MANUAL_B_CORE_LEASE_FINALIZE_STOP',requestId,
     retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
   }
  }
  if(locked){
   try{await io.releaseSharedLock({requestId,retain});}
   catch{
    result={status:'INFL_MANUAL_B_RECOVERY_REQUIRED',
     code:'INFL_MANUAL_B_LOCK_FINALIZE_STOP',requestId,
     retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
   }
  }
 }
 return result;
}
