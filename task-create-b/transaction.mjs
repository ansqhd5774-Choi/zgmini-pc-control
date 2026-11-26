// Reusable, source-only B transaction for creating ONE exact Windows Task.
// OS operations are supplied only by an independently authenticated adapter;
// this module never runs shell/Task Scheduler, providers, SQLite, or D1.
import {TASK,RESULT_SCHEMA,verifyTaskCreateBCandidate,verifyTaskCreateBPreimage}
 from './contract.mjs';

const required=['acquireSharedLease','observe','claimOnce','backupProtected',
 'createLauncherExclusive','launcherReadback','registerTaskDisabled',
 'taskReadback','enableTask','verifyProtectedUnchanged',
 'undoOwnedTaskIfExact','undoOwnedLauncherIfExact','verifyRestored','releaseSharedLease'];
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const safe=e=>/^TASK_CREATE_B_[A-Z0-9_]{3,90}$/.test(e?.code??'')?
 e.code:'TASK_CREATE_B_ADAPTER_FAILURE_STOP';

export async function applyTaskCreateB(proof,candidate,io){
 verifyTaskCreateBCandidate(proof,candidate);
 need(io&&required.every(k=>typeof io[k]==='function'),'TASK_CREATE_B_ADAPTER_SCOPE_STOP');
 const m=proof.manifest,requestId=proof.request.requestId;
 const result={schema:RESULT_SCHEMA,requestId,taskName:TASK,created:false,
  status:'TASK_CREATE_B_STATE_UNKNOWN',code:'TASK_CREATE_B_NOT_STARTED',
  taskChanges:0,otherTaskChanges:0,providerCalls:0,sqliteWrites:0,d1Writes:0};
 let lease=false,claimed=false,wrapperMayExist=false,taskMayExist=false;
 let enableAttempted=false,retained=false;
 try{
  await io.acquireSharedLease(requestId);lease=true;
  verifyTaskCreateBPreimage(proof,await io.observe());
  await io.claimOnce(requestId);claimed=true;
  await io.backupProtected(m.coreTaskXmlSha256,m.sidecarSourceSha256);
  verifyTaskCreateBPreimage(proof,await io.observe());
  wrapperMayExist=true;
  await io.createLauncherExclusive(m.wrapperPath,candidate.launcher);
  need(await io.launcherReadback(m.wrapperPath,m.launcherSha256)===true,
   'TASK_CREATE_B_LAUNCHER_READBACK_STOP');
  taskMayExist=true;
  await io.registerTaskDisabled(TASK,candidate.disabledXml);
  need(await io.taskReadback({name:TASK,enabled:false,
   definitionSha256:m.disabledXmlSha256})===true,
   'TASK_CREATE_B_DISABLED_READBACK_STOP');
  need(await io.verifyProtectedUnchanged(m)===true,
   'TASK_CREATE_B_PROTECTED_STATE_DRIFT_STOP');
  enableAttempted=true; // treat unknown enable result as an effect, NEVER replay
  await io.enableTask(TASK);
  need(await io.taskReadback({name:TASK,enabled:true,
   definitionSha256:m.enabledXmlSha256})===true,
   'TASK_CREATE_B_ENABLED_READBACK_STOP');
  need(await io.verifyProtectedUnchanged(m)===true,
   'TASK_CREATE_B_PROTECTED_POSTCHECK_STOP');
  Object.assign(result,{status:'TASK_CREATE_B_INSTALLED_VERIFIED',
   code:'TASK_CREATE_B_ONE_TASK_ENABLE_READBACK_PASS',
   created:true,taskChanges:1});
  return result;
 }catch(error){
  const code=safe(error);
  // Once activation is attempted, one or more CNN ticks may already have
  // collected/published. Never delete, automatically replay, or claim no effect.
  if(enableAttempted){retained=true;return {...result,
   status:'TASK_CREATE_B_RECOVERY_REQUIRED',code,
   created:null,taskChanges:null,providerCalls:null,sqliteWrites:null,d1Writes:null,
   lastEffect:'ENABLE_ATTEMPTED_INSPECT_TASK_AND_SAVED_CHECKPOINTS'};}
  if(!claimed){return {...result,status:'TASK_CREATE_B_PREFLIGHT_STOP',code};}
  try{
   if(taskMayExist)need(await io.undoOwnedTaskIfExact(TASK,m.disabledXmlSha256)===true,
    'TASK_CREATE_B_TASK_ROLLBACK_UNVERIFIED');
   if(wrapperMayExist)need(await io.undoOwnedLauncherIfExact(m.wrapperPath,
    m.launcherSha256)===true,'TASK_CREATE_B_WRAPPER_ROLLBACK_UNVERIFIED');
   need(await io.verifyRestored(m)===true,'TASK_CREATE_B_RESTORE_READBACK_STOP');
   return {...result,status:'TASK_CREATE_B_INSTALL_STOP_RESTORED',code};
  }catch{
   retained=true;return {...result,status:'TASK_CREATE_B_RECOVERY_REQUIRED',
    code:'TASK_CREATE_B_ROLLBACK_UNVERIFIED',created:null,taskChanges:null,
    lastEffect:'RECONCILE_EXACT_CLAIM_BACKUP_TASK_BEFORE_NEW_REQUEST'};
  }
 }finally{
  if(lease&&!retained)await io.releaseSharedLease(requestId);
 }
}
