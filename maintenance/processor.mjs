import {digest,validateContract,verifyChanges,errorCode} from './contract.mjs';

const finished=new Set(['PASS','BLOCKED','FAIL']);
const update=(record,patch,store)=>{const next={...record,...patch,updatedAt:new Date().toISOString()};store(next);return next;};
const reportOf=r=>({schema:'ZGMINI_PC_CONTROLLER_UPDATE_RESULT_V1',requestId:r.requestId,chatId:r.chatId,
 controlRepository:r.controlRepository,requestedInstalledSha:r.installedSha,targetSha:r.targetSha,
 actualInstalledSha:r.actualInstalledSha??null,status:r.status,code:r.code,phase:r.phase,
 lastPass:r.lastPass??null,firstFail:r.firstFail??null,backup:r.backup??null,
 runnerCount:r.runnerCount??null,protectedStateUnchanged:r.protectedStateUnchanged??null,
 workflowEnabled:r.workflowEnabled??null,operationalWrites:0,providerCalls:0,d1Writes:0,
 appliedAt:r.appliedAt??null,replayedPendingIssues:r.replayedPendingIssues??null,updatedAt:r.updatedAt});

/**
 * Standalone maintenance job state machine. The caller must live OUTSIDE the
 * six-runner Supervisor tree. Every phase is stored before an unsafe boundary.
 * WAITING_FOR_IDLE may be polled; APPLYING is never automatically re-executed.
 */
export async function processUpdate(issue,io){
 let request;
 try{request=validateContract(JSON.parse(issue.body),{actor:issue.actor,labels:issue.labels});}
 catch(error){return {status:'BLOCKED',code:errorCode(error),firstFail:'REQUEST_APPROVAL',issue:issue.number};}
 const payloadSha=digest(JSON.stringify(request));
 let record=io.load(request.requestId);
 if(record&&record.payloadSha!==payloadSha)return {status:'BLOCKED',code:'DUPLICATE_REQUEST_PAYLOAD_CHANGED',requestId:request.requestId};
 if(!record){
  record={...request,issueNumber:issue.number,payloadSha,status:'WAITING',code:'REQUEST_STORED',phase:'RECEIVED',lastPass:'REQUEST_STORED',firstFail:null};
  record=update(record,{},io.save);
 }
 const finish=async(patch)=>{
  record=update(record,patch,io.save);
  if(record.published===true)return reportOf(record);
  try{await io.publish(record.issueNumber,reportOf(record));record=update(record,{published:true,publicationCode:null},io.save);}
  catch(error){record=update(record,{publicationCode:errorCode(error)},io.save);}
  return reportOf(record);
 };
 if(finished.has(record.status))return finish({}); // idempotent remote publication, never reapply
 try{
  const installed=await io.inspectInstalled();
  if(installed.manifestValid===false)return finish({status:'BLOCKED',code:'INSTALLED_MANIFEST_DRIFT',phase:'STOP',firstFail:'INSTALLED_MANIFEST'});
  if(record.phase==='APPLIED_PENDING_REPLAY'){
   const audit=await io.auditApplied(request,record);
   if(!audit?.verified)return finish({status:'BLOCKED',code:'POST_UPDATE_AUDIT_FAILED_NO_RETRY',phase:'STOP',firstFail:'RECOVERY_AUDIT'});
   try{const replay=await io.replayPending(record);return finish({status:'PASS',code:'CONTROLLER_UPDATED_SIX_RECONNECTED',phase:'DONE',lastPass:'PENDING_REQUESTS_REPLAYED',firstFail:null,actualInstalledSha:audit.actualInstalledSha,runnerCount:6,protectedStateUnchanged:true,workflowEnabled:true,replayedPendingIssues:replay});}
   catch(error){return reportOf(update(record,{status:'WAITING',code:'REPLAY_RECOVERY_WAITING',lastPass:'CONTROLLER_APPLIED_VERIFIED'},io.save));}
  }
  if(record.phase==='APPLYING'){
   // A killed worker/network timeout is not permission to run the updater twice.
   const audit=await io.auditApplied(request,record);
   if(audit?.verified&&audit.actualInstalledSha===request.targetSha&&audit.runnerCount===6&&audit.protectedStateUnchanged===true&&audit.workflowEnabled===true)
    return reportOf(update(record,{status:'WAITING',code:'UPDATE_RECOVERED_PENDING_REPLAY',phase:'APPLIED_PENDING_REPLAY',lastPass:'POST_CRASH_AUDIT',firstFail:null,actualInstalledSha:audit.actualInstalledSha,runnerCount:6,protectedStateUnchanged:true,workflowEnabled:true,backup:audit.backup??record.backup},io.save));
   return finish({status:'BLOCKED',code:'UPDATE_OUTCOME_UNCERTAIN_NO_RETRY',phase:'STOP',lastPass:'UPDATE_STARTED',firstFail:'POST_CRASH_AUDIT',actualInstalledSha:installed.sha});
  }
  if(record.phase==='RECEIVED'||record.phase==='WAITING_FOR_IDLE'){
   if(installed.sha!==request.installedSha){
    if(installed.sha===request.targetSha){
     const audit=await io.auditApplied(request,record);
     if(audit?.verified)return finish({status:'PASS',code:'ALREADY_INSTALLED_VERIFIED_NO_REEXECUTION',phase:'DONE',lastPass:'EXISTING_INSTALL_AUDITED',actualInstalledSha:installed.sha,runnerCount:audit.runnerCount,protectedStateUnchanged:audit.protectedStateUnchanged,workflowEnabled:audit.workflowEnabled});
    }
    return finish({status:'BLOCKED',code:'INSTALLED_SHA_MISMATCH',phase:'STOP',firstFail:'INSTALLED_SOURCE_GATE',actualInstalledSha:installed.sha});
   }
   if(request.approval.scope==='ONE_TIME_MAINTENANCE_BOOTSTRAP'&&request.targetSha!==io.approvedBootstrapTargetSha)
    return finish({status:'BLOCKED',code:'BOOTSTRAP_TARGET_NOT_PINNED',phase:'STOP',firstFail:'APPROVAL_SCOPE'});
   const changes=await io.inspectChanges(request);
   verifyChanges(request,changes);
   record=update(record,{phase:'WAITING_FOR_IDLE',lastPass:'EXACT_SOURCE_FILES_AND_APPROVAL_VERIFIED',code:'WAITING_FOR_IDLE'},io.save);
  }
  const idle=await io.isIdle();
  if(!idle.ok)return reportOf(update(record,{status:'WAITING',code:idle.code??'CONTROL_JOBS_BUSY',phase:'WAITING_FOR_IDLE',lastPass:'EXACT_SOURCE_FILES_AND_APPROVAL_VERIFIED'},io.save));
  // Exclusive maintenance process and the updater itself repeat the idle gate.
  record=update(record,{phase:'APPLYING',status:'WAITING',code:'UPDATE_APPLICATION_STARTED',lastPass:'RUNNERS_IDLE_VERIFIED',appliedAt:new Date().toISOString(),protectedBeforeSha256:installed.protectedSha??null},io.save);
  let applied;
  try{applied=await io.apply(request);}catch(error){
   const audit=await io.auditApplied(request,record);
   if(audit?.verified&&audit.actualInstalledSha===request.targetSha&&audit.runnerCount===6&&audit.protectedStateUnchanged&&audit.workflowEnabled)
    applied={...audit,code:'UPDATE_COMPLETED_AFTER_TRANSPORT_ERROR'};
   else return finish({status:'BLOCKED',code:'UPDATE_STOP_NO_AUTOMATIC_RETRY',phase:'STOP',firstFail:'UPDATE_APPLICATION',errorCode:errorCode(error),actualInstalledSha:(await io.inspectInstalled()).sha});
  }
  if(applied.actualInstalledSha!==request.targetSha||applied.runnerCount!==6||applied.protectedStateUnchanged!==true||applied.workflowEnabled!==true)
   return finish({status:'BLOCKED',code:'POST_UPDATE_VERIFICATION_FAILED',phase:'STOP',firstFail:'AFTER_UPDATE_AUDIT',actualInstalledSha:applied.actualInstalledSha,runnerCount:applied.runnerCount,protectedStateUnchanged:applied.protectedStateUnchanged,workflowEnabled:applied.workflowEnabled,backup:applied.backup});
  record=update(record,{status:'WAITING',code:'UPDATE_APPLIED_PENDING_REPLAY',phase:'APPLIED_PENDING_REPLAY',lastPass:'INSTALL_SOURCE_AND_SIX_RUNNERS_VERIFIED',applyFinishedAt:new Date().toISOString(),actualInstalledSha:applied.actualInstalledSha,runnerCount:6,protectedStateUnchanged:true,workflowEnabled:true,backup:applied.backup},io.save);
  try{const replay=await io.replayPending(record);return finish({status:'PASS',code:applied.code??'CONTROLLER_UPDATED_SIX_RECONNECTED',phase:'DONE',lastPass:'PENDING_REQUESTS_REPLAYED',firstFail:null,replayedPendingIssues:replay});}
  catch(error){return reportOf(update(record,{code:'REPLAY_RECOVERY_WAITING',publicationCode:errorCode(error)},io.save));}
 }catch(error){return finish({status:'BLOCKED',code:errorCode(error),phase:'STOP',firstFail:record.phase==='RECEIVED'?'SOURCE_APPROVAL':'PREFLIGHT_OR_IDLE',actualInstalledSha:record.actualInstalledSha??null});}
}
