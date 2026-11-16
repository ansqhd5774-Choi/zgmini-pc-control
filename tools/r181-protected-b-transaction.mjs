// W03: fixed protected PC-only R181 transaction contract.
// Source-only until an independently approved B runner binds trusted fixed IO.
// No network, shell, SQLite, D1, task or direct filesystem effects in this module.
import {createHash} from 'node:crypto';
import {
  PINNED_R181_SHA256, preparePinnedR181RouteCandidate,
} from './r181-pinned-route-candidate.mjs';

export const R181_B_OPERATION='r181-protected-route-install';
export const R181_B_REQUEST_SCHEMA='ZGMINI_R181_PROTECTED_B_REQUEST_V1';
export const R181_B_APPROVAL_SCHEMA='ZGMINI_R181_PROTECTED_B_APPROVAL_V1';
export const R181_B_SCOPE='W03_R181_PC_ONLY_SINGLE_FILE_GMH_ROUTE';
export const R181_B_PATCH='GMH_2026_11_STOCKS_US_EXACT_3_BYTE_INSERT';
export const R181_B_TARGET='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r181-primary-cycle.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ACTOR='ansqhd5774-Choi';
const SHA40=/^[0-9a-f]{40}$/i;
const SHA64=/^[0-9a-f]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPROVAL_PATH=/^approvals\/r181-protected-b\/r181-[a-z0-9-]{4,70}\.json$/;
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository','approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','operation','controlSourceSha','targetPath','beforeSha256','patchId','runCount','allowProviderCalls','allowDbWrites','allowD1Writes','allowTaskChanges','allowOtherFileChanges'];
const authorized=new WeakSet();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(condition,code)=>{if(!condition)fail(code);};
const safeCode=e=>/^R181_(?:B_)?[A-Z0-9_]{3,100}$/.test(e?.code??'')?
  e.code:'R181_B_UNCLASSIFIED_STOP';

// The external, trusted B admission must also verify a merged approval,
// exact event source commit, and installed Windows execution registration.
// This check alone never creates a PC job, authorizes a shell, or installs code.
export function authorizeR181ProtectedB({event,env,manifestBytes}){
  need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===ACTOR&&
    env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
    event?.repository?.full_name===REPO&&event.repository.private===true&&
    event.sender?.login===ACTOR&&event.issue?.user?.login===ACTOR&&
    event.issue?.title===R181_B_OPERATION&&!event.issue.pull_request&&
    event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
    'R181_B_EVENT_DENIED');
  let req;
  try{req=JSON.parse(event.issue.body);}catch{fail('R181_B_REQUEST_JSON_DENIED');}
  need(exact(req,REQUEST_KEYS)&&req.schema===R181_B_REQUEST_SCHEMA&&
    req.operation===R181_B_OPERATION&&req.controlRepository===REPO&&
    UUID.test(req.requestId)&&UUID.test(req.chatId)&&
    APPROVAL_PATH.test(req.approvalManifestPath)&&
    SHA64.test(req.approvalManifestSha256),
    'R181_B_REQUEST_DENIED');
  need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&
    manifestBytes.length<=4096&&sha(manifestBytes)===req.approvalManifestSha256,
    'R181_B_MANIFEST_HASH_DENIED');
  let m;
  try{m=JSON.parse(manifestBytes.toString('utf8'));}
  catch{fail('R181_B_MANIFEST_JSON_DENIED');}
  need(exact(m,APPROVAL_KEYS)&&m.schema===R181_B_APPROVAL_SCHEMA&&
    m.status==='APPROVED_B'&&m.scope===R181_B_SCOPE&&
    m.operation===R181_B_OPERATION&&m.controlSourceSha===env.GITHUB_SHA&&
    m.targetPath===R181_B_TARGET&&
    m.beforeSha256===PINNED_R181_SHA256&&m.patchId===R181_B_PATCH&&
    m.runCount===1&&
    ['allowProviderCalls','allowDbWrites','allowD1Writes','allowTaskChanges',
      'allowOtherFileChanges'].every(x=>m[x]===false),
    'R181_B_APPROVAL_DENIED');
  const proof=Object.freeze({
    request:Object.freeze(req),manifest:Object.freeze(m),
    sourceSha:env.GITHUB_SHA,issueNumber:event.issue.number,
    manifestSha256:req.approvalManifestSha256,
  });
  authorized.add(proof);
  return proof;
}

// A trusted Windows B IO adapter owns the SAME shared writer lease, a
// durable exclusive one-shot claim, same-directory ACL-preserving backup,
// journal fsync, guarded atomic replace and readback. All targets are fixed.
const IO_KEYS=['acquireSharedWriterLease','readPinnedFile','claimOnce',
  'backupAndVerify','journal','replaceAtomically','restoreAtomically',
  'releaseWriterLease'];
const result=(status,code,more={})=>Object.freeze({
  status,code,applied:false,providerCalls:0,dbWrites:0,d1Writes:0,
  taskChanges:0,otherFileWrites:0,...more,
});
export async function runApprovedR181ProtectedB(proof,io){
  need(authorized.has(proof),'R181_B_AUTH_REQUIRED');
  need(object(io)&&IO_KEYS.every(k=>typeof io[k]==='function'),
    'R181_B_TRUSTED_IO_REQUIRED');
  const requestId=proof.request.requestId;
  let acquired=false,claimed=false,attempted=false,retain=false;
  let before=null,after=null,candidate=null,stage='LOCK';
  let out=result('R181_B_STATE_UNKNOWN','R181_B_NOT_EXECUTED');
  try{
    await io.acquireSharedWriterLease(requestId);acquired=true;
    stage='READ_PINNED';
    before=await io.readPinnedFile(R181_B_TARGET);
    // Reject drift and unsupported URL syntax without a claim or write.
    const prepared=preparePinnedR181RouteCandidate(before);
    if(prepared.status!=='PREPARED_CANDIDATE_ONLY'){
      out=result('R181_B_PREFLIGHT_STOP',prepared.code,{
        beforeSha256:Buffer.isBuffer(before)?sha(before):null});
      return out;
    }
    after=prepared.getPrivateCandidateBytes();
    need(after.length===before.length+3&&
      prepared.candidateSha256===sha(after),
      'R181_B_CANDIDATE_DRIFT_STOP');
    candidate={beforeSha256:sha(before),afterSha256:sha(after),
      changedByteCount:3};
    stage='ONE_SHOT_CLAIM';
    await io.claimOnce(requestId,proof.manifestSha256);claimed=true;
    stage='BACKUP';
    const backup=await io.backupAndVerify(R181_B_TARGET,requestId);
    need(Buffer.isBuffer(backup)&&backup.equals(before),
      'R181_B_BACKUP_VERIFY_STOP');
    stage='FINAL_CAS';
    need(Buffer.isBuffer(await io.readPinnedFile(R181_B_TARGET))&&
      sha(await io.readPinnedFile(R181_B_TARGET))===candidate.beforeSha256,
      'R181_B_FINAL_CAS_STOP');
    await io.journal(requestId,'BACKUP_VERIFIED');
    stage='SWITCH';
    await io.journal(requestId,'SWITCH_INTENT');
    attempted=true;
    await io.replaceAtomically(R181_B_TARGET,after,requestId);
    stage='READBACK';
    const got=await io.readPinnedFile(R181_B_TARGET);
    need(Buffer.isBuffer(got)&&got.equals(after),
      'R181_B_READBACK_STOP');
    await io.journal(requestId,'APPLIED_VERIFIED');
    out=result('R181_B_APPLIED_VERIFIED','R181_B_SINGLE_ROUTE_APPLIED',
      {...candidate,applied:true,changedFileCount:1,backupVerified:true});
  }catch(error){
    const code=safeCode(error);
    if(!acquired&&!claimed)out=result('R181_B_PREFLIGHT_STOP',code);
    else if(!claimed)out=result('R181_B_PREFLIGHT_STOP',code);
    else{
      // Never clobber external changes. On uncertainty retain the exact
      // journal/lease for the authorized recovery owner; no blind retry.
      try{
        const current=await io.readPinnedFile(R181_B_TARGET);
        if(!Buffer.isBuffer(current))fail('R181_B_RECOVERY_READ_STOP');
        if(attempted&&!current.equals(before)){
          need(after&&current.equals(after),
            'R181_B_CONCURRENT_RECOVERY_DRIFT_STOP');
          await io.restoreAtomically(R181_B_TARGET,before,requestId);
        }
        const restored=await io.readPinnedFile(R181_B_TARGET);
        need(Buffer.isBuffer(restored)&&restored.equals(before),
          'R181_B_ORIGINAL_RESTORE_STOP');
        await io.journal(requestId,'STOP_ORIGINAL_VERIFIED');
        out=result('R181_B_STOP_RESTORED',code,{
          originalVerified:true,beforeSha256:sha(before)});
      }catch{
        retain=true;
        try{await io.journal(requestId,'RECOVERY_REQUIRED');}catch{}
        out=result('R181_B_RECOVERY_REQUIRED',code,{
          recovery:'READ_ONLY_RECONCILE_NO_REPLAY'});
      }
    }
  }finally{
    if(acquired){
      try{await io.releaseWriterLease(requestId,{retain});}
      catch{
        out=result('R181_B_RECOVERY_REQUIRED','R181_B_RELEASE_UNVERIFIED',{
          recovery:'READ_ONLY_RECONCILE_NO_REPLAY'});
      }
    }
  }
  return out;
}
