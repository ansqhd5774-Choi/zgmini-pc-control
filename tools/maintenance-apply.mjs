// This coordinator runs ONLY in a maintenance process outside the supervisor tree.
// All machine-specific operations are injected so the safety transitions can be tested
// without touching a real runner, scheduled task, or database.
export const UPDATE_PHASES = Object.freeze([
  'RECEIVED','VALIDATED','STAGED','INTAKE_PAUSED','DRAINED','BACKED_UP',
  'SUPERVISOR_STOPPED','SWITCHED','RECONNECTED','INTAKE_RESUMED','BACKLOG_RECONCILED',
  'POSTCHECK_PENDING','PASS','BLOCKED','ROLLED_BACK','RECOVERY_REQUIRED'
]);

const fail = code => Object.assign(new Error(code), {code});
// Preserve fixed error codes, but never leak arbitrary exception text/paths.
// An uncoded filesystem/child-process exception should still identify its
// exact update phase so a harmless pre-install failure can be investigated
// without guessing which mutating step ran.
const OPERATIONS=Object.freeze({inspect:'INSPECT',validate:'VALIDATE',stage:'STAGE',
  pauseIntake:'PAUSE_INTAKE',waitForDrain:'DRAIN',backup:'BACKUP',
  stopOwnSupervisor:'SUPERVISOR_STOP',switchVersion:'SWITCH',
  reconnect:'RECONNECT',resumeIntake:'RESUME_INTAKE',
  reconcileBacklog:'BACKLOG',postcheck:'POSTCHECK'});
const ERRNOS=new Set(['ENOENT','EACCES','EPERM','EBUSY','ENOSPC','ETIMEDOUT']);
export function maintenanceFailureCode(error,operation='inspect'){
  const stage=OPERATIONS[operation]??'UNKNOWN_STAGE';
  const code=error?.code;
  if(ERRNOS.has(code))return `UPDATE_${stage}_${code}`;
  if(typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(code))return code;
  return `UPDATE_${stage}_FAILED`;
}

/**
 * Port contract:
 *   persist(journal), read(requestId), inspect(), validate(request, state),
 *   stage(request), pauseIntake(), waitForDrain(), backup(), stopOwnSupervisor(),
 *   switchVersion(), reconnect(), resumeIntake(), postcheck(request),
 *   verifyBackup(), restore(), reconnectPrevious(), verifyPrevious(),
 *   inspectAfterUncertain(journal), listCurrentJobs().
 * Optional verifyPrevalidationUntouched({installedSha}) may return true only
 * after a fresh, read-only source/owner/protected-state proof. It must not
 * release or archive any lease: the owning outer maintainer releases its own
 * controller-install lease after this coordinator returns BLOCKED.
 *
 * inspectAfterUncertain never performs an install. Its result is evidence only.
 */
export async function applyApprovedUpdate(request, port) {
  const old = await port.read(request.requestId);
  if (old) {
    if (old.fingerprint !== port.fingerprint(request)) throw fail('REQUEST_ID_REUSED_WITH_DIFFERENT_BODY');
    if (['PASS','BLOCKED','ROLLED_BACK','RECOVERY_REQUIRED'].includes(old.status)) return {...old,reused:true};
    // A previous attempt might have succeeded before a network/PC timeout.
    // Reconcile the actual install/process/ledger first; NEVER re-run blindly.
    const observed = await port.inspectAfterUncertain(old);
    const recovered = {...old,status:'RECOVERY_REQUIRED',code:'INTERRUPTED_INSTALL_REQUIRES_RECONCILIATION',observed,lastPass:old.phase,firstFail:old.phase};
    await port.persist(recovered);
    return recovered;
  }

  const ledger={schema:'ZGMINI_PC_UPDATE_RESULT_V1',requestId:request.requestId,
    fingerprint:port.fingerprint(request),installedShaBefore:request.installedSha,
    targetSha:request.targetSha,status:'RUNNING',phase:'RECEIVED',lastPass:null,firstFail:null,
    code:'IN_PROGRESS',updatedAt:new Date().toISOString()};
  const record=async (phase,patch={})=>{ledger.phase=phase;ledger.lastPass=phase;Object.assign(ledger,patch);ledger.updatedAt=new Date().toISOString();await port.persist({...ledger});};
  await record('RECEIVED');
  let paused=false,backup=false,supervisorStopped=false,switched=false,intakeAttempted=false;
  let failureOperation='inspect';
  try {
    const before=await port.inspect();
    if(before.insideRunnerTree || before.githubActions) throw fail('MAINTENANCE_PROCESS_NOT_INDEPENDENT');
    if(before.installedSha!==request.installedSha) throw fail('INSTALLED_SHA_MISMATCH');
    failureOperation='validate';await port.validate(request,before);
    await record('VALIDATED');
    failureOperation='stage';await port.stage(request);
    await record('STAGED');
    // Intake is paused BEFORE draining. Accepted Issues remain durable on GitHub.
    failureOperation='pauseIntake';intakeAttempted=true;paused=true;await port.pauseIntake();
    await record('INTAKE_PAUSED');
    failureOperation='waitForDrain';await port.waitForDrain();
    await record('DRAINED');
    failureOperation='backup';await port.backup();backup=true;
    await record('BACKED_UP');
    failureOperation='stopOwnSupervisor';supervisorStopped=true;await port.stopOwnSupervisor();
    await record('SUPERVISOR_STOPPED');
    failureOperation='switchVersion';await port.switchVersion();switched=true;
    await record('SWITCHED');
    failureOperation='reconnect';await port.reconnect();
    await record('RECONNECTED');
    failureOperation='resumeIntake';await port.resumeIntake();paused=false;
    await record('INTAKE_RESUMED');
    // GitHub does not replay Issues opened while a workflow is disabled.
    // Reconcile the durable Issue queue before declaring this update complete.
    failureOperation='reconcileBacklog';if(port.reconcileBacklog)await port.reconcileBacklog(request);
    await record('BACKLOG_RECONCILED');
    await record('POSTCHECK_PENDING');
    failureOperation='postcheck';const post=await port.postcheck(request);
    if(post?.status!=='PASS'||post?.actualExecutionSha!==request.targetSha||
      post?.protectedStateUnchanged!==true||post?.runnerSetVerified!==true||
      post?.postSourceVerified!==true) throw fail('POSTCHECK_NOT_VERIFIED');
    await record('PASS',{status:'PASS',code:'APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED',actualInstalledSha:request.targetSha,postcheck:post,
      protectedStateUnchanged:true,workflowEnabled:true});
    return {...ledger};
  } catch(error) {
    const firstFail=ledger.phase,reason=maintenanceFailureCode(error,failureOperation);
    ledger.failureOperation=failureOperation;
    // A network timeout while a postcheck may still be running is not evidence
    // of diagnostic failure. In particular, do not stop its active Runner.
    if((ledger.phase==='POSTCHECK_PENDING' && ['POSTCHECK_OUTCOME_UNKNOWN','RUNNER_RECONNECT_OUTCOME_UNKNOWN'].includes(reason)) ||
      (ledger.phase==='INTAKE_RESUMED' && reason.startsWith('BACKLOG_'))) {
      await record('RECOVERY_REQUIRED',{status:'RECOVERY_REQUIRED',code:reason,firstFail,
        actualInstalledSha:null,intakePaused:paused,next:reason==='BACKLOG_REPLAY_OUTCOME_UNKNOWN'
          ?'RECONCILE_QUEUED_ISSUES_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY'
          :'RECONCILE_POSTCHECK_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY'});
      return {...ledger};
    }
    // If code was only staged, the installed controller is untouched.
    const prevalidationOnly=ledger.phase==='RECEIVED'&&
      ['inspect','validate'].includes(failureOperation)&&
      !intakeAttempted&&!paused&&!backup&&!supervisorStopped&&!switched;
    let prevalidationUntouched=false;
    if(prevalidationOnly&&port.verifyPrevalidationUntouched){
      try {prevalidationUntouched=await port.verifyPrevalidationUntouched({
        installedSha:request.installedSha})===true;} catch {}
    }
    let oldStillRunning=false;
    // A positive scoped no-effect proof is already sufficient here. Avoid
    // a second broad Runner-idle probe that can fail solely because another
    // approved A task started while this request was being classified.
    if(!switched&&!prevalidationUntouched){try{oldStillRunning=await port.verifyPrevious({installedSha:request.installedSha,requireRunning:true});}catch{}}
    if(!switched && (!supervisorStopped || oldStillRunning)) {
      // Intake is deliberately not enabled when drain/state is uncertain.
      // An intact preflight failure can leave it enabled only if verified.
      let safe=oldStillRunning||prevalidationUntouched;
      // pauseIntake() can disable the workflow and then lose its API ACK,
      // leaving paused=false in this coordinator. Never infer active intake
      // merely from an unchanged controller or from our local Boolean.
      let observed;
      try {observed=await port.inspectAfterUncertain({...ledger});} catch {}
      let workflowState=observed?.workflowState;
      // A claimed untouched prevalidation must also match the independently
      // observed installed SHA, not only a callback's Boolean result.
      if(prevalidationUntouched&&observed?.actualControllerSha!==request.installedSha)safe=false;
      if(safe && paused && workflowState==='disabled_manually') {
        if(port.didPauseIntake && !port.didPauseIntake())safe=false;
        else try {await port.resumeIntake();paused=false;
          observed=await port.inspectAfterUncertain({...ledger});
          workflowState=observed?.workflowState;
        } catch {safe=false;}
      }
      if(safe && paused && workflowState==='active')paused=false;
      if(workflowState!=='active')safe=false;
      // Before pauseIntake was even attempted there is no backlog to replay.
      // Requiring a nonexistent pause journal turns harmless validation failures
      // into permanent shared recovery locks.
      if(safe && intakeAttempted && port.reconcileBacklog){try {await port.reconcileBacklog(request);}catch{safe=false;}}
      const status=safe?'BLOCKED':'RECOVERY_REQUIRED';
      const substate=safe&&prevalidationUntouched?'PREVALIDATION_UNTOUCHED_VERIFIED':undefined;
      await record(status,{status,code:reason,firstFail,substate,actualInstalledSha:safe?request.installedSha:null,intakePaused:paused,
        workflowEnabled:workflowState==='active'?true:workflowState==='disabled_manually'?false:null,
        observed});
      return {...ledger};
    }
    // Never restore from an unverified snapshot, even if an earlier copy succeeded.
    let restored=false;
    if(backup) {
      try {
        if(await port.verifyBackup(request.installedSha)) {
          await port.restore();
          await port.reconnectPrevious();
          restored=await port.verifyPrevious({installedSha:request.installedSha,requireRunning:true});
        }
      } catch {restored=false;}
    }
    // Only an explicitly verified rollback may reactivate request intake.
    if(restored) {try {await port.resumeIntake();paused=false;}catch{restored=false;}}
    let backlogVerified=restored;
    if(restored && port.reconcileBacklog){try {await port.reconcileBacklog(request);}catch{backlogVerified=false;}}
    const status=restored&&backlogVerified?'ROLLED_BACK':'RECOVERY_REQUIRED';
    await record(status,{status,code:backlogVerified?reason:'BACKLOG_OR_RECOVERY_NOT_VERIFIED',firstFail,
      actualInstalledSha:restored?request.installedSha:null,intakePaused:paused,
      recoverySha:restored?request.installedSha:null,protectedStateUnchanged:restored,workflowEnabled:restored&&!paused});
    return {...ledger};
  }
}

// Explicit recovery action. Never resumes installation or overwrites the failed
// update journal. The caller owns a separate recovery reservation and report.
export async function reconcileInterruptedRollback(original,port,persist){
 const phase=original.status==='RECOVERY_REQUIRED'?original.firstFail:original.phase;
 const out={schema:'ZGMINI_PC_ROLLBACK_RECONCILIATION_V1',requestId:original.requestId,
  status:'RECOVERY_REQUIRED',originalStatus:original.status,originalPhase:phase,
  actualInstalledSha:null,originalRequestRetried:false};
 const record=async(code,patch={})=>{Object.assign(out,{code,...patch,at:new Date().toISOString()});await persist({...out});};
 if(['POSTCHECK_PENDING','INTAKE_RESUMED','BACKLOG_RECONCILED'].includes(phase)){
  await record('RECOVERY_WAIT_EXISTING_RESULT');return out;
 }
 if(!['BACKED_UP','SUPERVISOR_STOPPED','SWITCHED','RECONNECTED'].includes(phase)||!['RUNNING','RECOVERY_REQUIRED'].includes(original.status)){
  await record('RECOVERY_PHASE_NOT_ROLLBACK_ELIGIBLE');return out;
 }
 try{
  await port.prepareRecovery();
  if(await port.verifyBackup(original.installedShaBefore)!==true)throw fail('RECOVERY_BACKUP_NOT_VERIFIED');
  await record('RECOVERY_BACKUP_VERIFIED');
  await record('RECOVERY_RESTORE_STARTED',{mutationStarted:true});
  await port.restore();await record('RECOVERY_FILES_RESTORED');
  await port.reconnectPrevious();
  if(await port.verifyPrevious({installedSha:original.installedShaBefore,requireRunning:true})!==true)throw fail('RECOVERY_RUNTIME_NOT_VERIFIED');
  await port.resumeIntake();
  if(port.reconcileBacklog)await port.reconcileBacklog();
  if(await port.verifyPrevious({installedSha:original.installedShaBefore,requireRunning:true})!==true)throw fail('RECOVERY_FINAL_READBACK_FAILED');
  await record('INTERRUPTED_ROLLBACK_VERIFIED',{status:'ROLLED_BACK',actualInstalledSha:original.installedShaBefore,protectedStateUnchanged:true});
  }catch(error){await record(maintenanceFailureCode(error,'reconcileBacklog'),{status:'RECOVERY_REQUIRED'});}
 return out;
}
