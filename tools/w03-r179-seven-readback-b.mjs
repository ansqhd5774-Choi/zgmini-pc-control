// W03 R179 seven-core public readback compatibility; exact single-file
// in-memory B candidate only. No raw code, credentials or D1 operations leave PC.
import {createHash} from 'node:crypto';
export const OP='w03-r179-readback-guard-install';
export const REQUEST_SCHEMA='ZGMINI_W03_R179_GUARD_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_W03_R179_GUARD_B_APPROVAL_V1';
export const SCOPE='W03_R179_SEVEN_CORE_READBACK_MINIMUM_ONLY';
export const TARGET='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r179-publish-core.mjs';
export const BEFORE_SHA='f9ea0a1bfaf52909b7a434b65ba93887f56660bc979a3cb7e0992597bc9f3b68';
export const BEFORE_BYTES=10822;
export const PATCH='R179_LEGACY_SEVEN_EXACT_TO_AT_LEAST_SEVEN';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const STOP=code=>{throw Object.assign(Error(code),{code});};
const need=(condition,code)=>{if(!condition)STOP(code);};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const MANIFEST=/^approvals\/w03-r179-guard\/r179-readback-[a-z0-9-]{5,72}\.json$/;
const OLD='got.length!==7',NEW='got.length<7';
const exact=(o,keys)=>o&&Object.getPrototypeOf(o)===Object.prototype&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const approved=new WeakSet();
const REQUEST_KEYS=['schema','operation','requestId','chatId','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','operation','controlSourceSha',
 'targetPath','beforeSha256','beforeBytes','patchId','maxAttempts',
 'allowProviderCalls','allowSqliteWrites','allowD1Writes','allowTaskChanges',
 'allowOtherSourceChanges'];
// Pure function with explicit expected hash for test fixtures. The production
// wrapper below always passes the immutable operational PIN.
export function prepareExactGuardCandidate(bytes,expectedSha=BEFORE_SHA){
 need(Buffer.isBuffer(bytes)&&bytes.length===BEFORE_BYTES,
  'W03_R179_GUARD_PREIMAGE_SIZE_STOP');
 need(SHA(bytes)===expectedSha,'W03_R179_GUARD_PREIMAGE_SHA_STOP');
 const text=bytes.toString('utf8');
 need(Buffer.from(text,'utf8').equals(bytes)&&!text.includes('\0'),
  'W03_R179_GUARD_UTF8_STOP');
 const occurrences=text.split(OLD).length-1;
 need(occurrences===1,'W03_R179_GUARD_NOT_UNIQUE_STOP');
 need(text.includes('PUBLIC_API_ROLLING_MISMATCH')&&
  text.includes('themes'),'W03_R179_GUARD_READBACK_CONTEXT_STOP');
 const after=Buffer.from(text.replace(OLD,NEW),'utf8');
 need(after.length===bytes.length-2&&SHA(after)!==expectedSha,
  'W03_R179_GUARD_REPLACEMENT_STOP');
 // The new fragment is only a minimum count; all other identity,
 // observation-date, score and lineage checks are preserved byte-for-byte.
 return Object.freeze({status:'PREPARED_IN_MEMORY_NOT_INSTALLED',
  beforeSha256:expectedSha,afterSha256:SHA(after),changedBytes:-2,
  getCandidateBytes:()=>Buffer.from(after)});
}
export function authorize({event,env,manifestBytes}){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===OP&&
  event.issue.labels?.some(l=>l.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'W03_R179_B_EVENT_STOP');
 let request;try{request=JSON.parse(event.issue.body);}catch{
  STOP('W03_R179_B_REQUEST_JSON_STOP');}
 need(exact(request,REQUEST_KEYS)&&request.schema===REQUEST_SCHEMA&&
  request.operation===OP&&request.controlRepository===REPO&&
  UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
  MANIFEST.test(request.approvalManifestPath??'')&&
  SHA64.test(request.approvalManifestSha256??''),
  'W03_R179_B_REQUEST_IDENTITY_STOP');
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&
  manifestBytes.length<=4096&&SHA(manifestBytes)===request.approvalManifestSha256,
  'W03_R179_B_MANIFEST_HASH_STOP');
 let manifest;try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{
  STOP('W03_R179_B_MANIFEST_JSON_STOP');}
 need(exact(manifest,APPROVAL_KEYS)&&manifest.schema===APPROVAL_SCHEMA&&
  manifest.status==='APPROVED_B'&&manifest.scope===SCOPE&&
  manifest.operation===OP&&SHA40.test(manifest.controlSourceSha??'')&&
  manifest.targetPath===TARGET&&manifest.beforeSha256===BEFORE_SHA&&
  manifest.beforeBytes===BEFORE_BYTES&&manifest.patchId===PATCH&&
  manifest.maxAttempts===1&&
  ['allowProviderCalls','allowSqliteWrites','allowD1Writes',
   'allowTaskChanges','allowOtherSourceChanges'].every(k=>manifest[k]===false),
  'W03_R179_B_APPROVAL_STOP');
 const proof=Object.freeze({request:Object.freeze(request),
  manifest:Object.freeze(manifest),issueNumber:event.issue.number,
  head:env.GITHUB_SHA,manifestSha256:request.approvalManifestSha256});
 approved.add(proof);return proof;
}
const expectedIo=['acquire','read','claim','backup','journal','replace','restore','release'];
const result=(status,code,details={})=>Object.freeze({
 status,code,applied:false,providerCalls:0,sqliteWrites:0,d1Writes:0,
 taskChanges:0,otherSourceWrites:0,...details});
export async function runApprovedGuard(proof,io){
 need(approved.has(proof),'W03_R179_B_PROOF_REQUIRED');
 need(io&&expectedIo.every(k=>typeof io[k]==='function'),
  'W03_R179_B_IO_CONTRACT_STOP');
 let locked=false,claimBegun=false,claimed=false,switched=false,retain=false;
 let before=null,after=null,candidate=null,stage='LOCK';
 let out=result('PREFLIGHT_STOP','W03_R179_B_NOT_STARTED');
 const id=proof.request.requestId;
 try{
  await io.acquire(id);locked=true;stage='PIN';
  before=await io.read(TARGET);
  // Never weaken production source pin, regardless of test dependency injection.
  candidate=prepareExactGuardCandidate(before,BEFORE_SHA);
  after=candidate.getCandidateBytes();
  stage='CLAIM';claimBegun=true;
  await io.claim(id,proof.manifestSha256);claimed=true;
  stage='BACKUP';
  const saved=await io.backup(TARGET,id);
  need(Buffer.isBuffer(saved)&&saved.equals(before),
   'W03_R179_B_BACKUP_MISMATCH_STOP');
  need((await io.read(TARGET)).equals(before),'W03_R179_B_FINAL_CAS_STOP');
  await io.journal(id,'BACKUP_VERIFIED');stage='SWITCH';
  await io.journal(id,'SWITCH_INTENT');
  switched=true;await io.replace(TARGET,after,id);
  stage='READBACK';
  need((await io.read(TARGET)).equals(after),'W03_R179_B_READBACK_STOP');
  await io.journal(id,'APPLIED_VERIFIED');
  out=result('APPLIED_VERIFIED','W03_R179_B_SEVEN_CORE_READBACK_PATCHED',{
   applied:true,changedFileCount:1,changedByteCount:-2,
   beforeSha256:candidate.beforeSha256,afterSha256:candidate.afterSha256,
   backupVerified:true});
 }catch(error){
  const code=/^(?:W03_R179_|R17_B_)[A-Z0-9_]{3,100}$/.test(error?.code??'')?
   error.code:'W03_R179_B_UNCLASSIFIED_STOP';
  if(claimBegun&&!claimed){retain=true;out=result('RECOVERY_REQUIRED',
   'W03_R179_B_CLAIM_OUTCOME_UNKNOWN');}
  else if(!claimed)out=result('PREFLIGHT_STOP',code);
  else{
   try{
    const current=await io.read(TARGET);
    need(Buffer.isBuffer(current),'W03_R179_B_RECOVERY_READ_STOP');
    if(switched&&!current.equals(before)){
     need(after&&current.equals(after),'W03_R179_B_RECOVERY_DRIFT_STOP');
     await io.restore(TARGET,before,id);
    }
    need((await io.read(TARGET)).equals(before),
     'W03_R179_B_ORIGINAL_RESTORE_STOP');
    await io.journal(id,'STOP_ORIGINAL_VERIFIED');
    out=result('STOP_RESTORED',code,{beforeSha256:SHA(before),
     originalVerified:true});
   }catch{
    retain=true;try{await io.journal(id,'RECOVERY_REQUIRED');}catch{}
    out=result('RECOVERY_REQUIRED',code,{retry:'READ_ONLY_RECONCILE_NO_REPLAY'});
   }
  }
 }finally{
  if(locked)try{await io.release(id,{retain});}catch{
   out=result('RECOVERY_REQUIRED','W03_R179_B_RELEASE_UNVERIFIED',
    {retry:'READ_ONLY_RECONCILE_NO_REPLAY'});
  }
 }
 return out;
}