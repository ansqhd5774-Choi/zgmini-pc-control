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
// Fixed, path-free failure context for approved Controller updates.
// Conservative scope is intentional: an uncertain readback is never labelled
// as a verified no-effect failure.
function failureDetails({status,failureOperation,intakeAttempted,backup,supervisorStopped,switched,nextAction}){
  const mutationStarted=failureOperation==='stage'||intakeAttempted||backup||supervisorStopped||switched;
  let affectedScope='REQUEST_ONLY';
  if(switched||supervisorStopped)affectedScope='CONTROLLER_RUNTIME_AND_INTAKE';
  else if(intakeAttempted)affectedScope='SHARED_INTAKE';
  else if(failureOperation==='stage')affectedScope='INSTALL_STAGING';
  else if(status==='RECOVERY_REQUIRED')affectedScope='CONTROLLER_STATE_UNVERIFIED';
  return {failureOperation,mutationStarted:!!mutationStarted,affectedScope,
    nextAction:nextAction??(status==='BLOCKED'?'RESOLVE_NAMED_GATE_BEFORE_NEW_REQUEST'
      :status==='ROLLED_BACK'?'VERIFY_ROLLBACK_BEFORE_NEW_REQUEST'
      :'RECONCILE_ACTUAL_INSTALL_AND_LEASE_NO_AUTOMATIC_RETRY')};
}
const PRE_INSTALL_OPERATIONS=new Set(['loadApprovedPackage','makePorts','readOwner',
  'installedManifest','capturePrevalidationBaseline']);
export function maintenanceCliFailureReport(error){
  const preInstall=error?.failureStage==='PRE_INSTALL';
  const code=typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(error.code)
    ?error.code:'UPDATE_ENVIRONMENT_ERROR';
  return {status:'AUTOMATION_BLOCKED',code,failureStage:preInstall?'PRE_INSTALL':'UNVERIFIED',
    phase:preInstall?'PRE_INSTALL':'UNVERIFIED',
    failureOperation:preInstall&&PRE_INSTALL_OPERATIONS.has(error?.failureOperation)
      ?error.failureOperation:'unverified',
    // Null means the execution outcome cannot be proven, not that a mutation happened.
    mutationStarted:preInstall?false:null,
    affectedScope:preInstall?'REQUEST_ONLY':'CONTROLLER_STATE_UNVERIFIED',
    nextAction:preInstall?'RESOLVE_NAMED_GATE_BEFORE_NEW_REQUEST'
      :'RECONCILE_ACTUAL_INSTALL_AND_LEASE_NO_AUTOMATIC_RETRY',
    actualControllerSha:null};
}
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
    const recovered = {...old,status:'RECOVERY_REQUIRED',code:'INTERRUPTED_INSTALL_REQUIRES_RECONCILIATION',
      observed,lastPass:old.phase,firstFail:old.phase,
      failureOperation:'inspectAfterUncertain',mutationStarted:true,
      affectedScope:'CONTROLLER_STATE_UNVERIFIED',
      nextAction:'RECONCILE_EXISTING_STATE_NO_AUTOMATIC_RETRY'};
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
    failureOperation='stopOwnSupervisor';const idleWait=await port.stopOwnSupervisor();supervisorStopped=true;
    const validIdleWait=idleWait&&Number.isSafeInteger(idleWait.retryCount)&&idleWait.retryCount>=0
      &&Number.isSafeInteger(idleWait.elapsedMs)&&idleWait.elapsedMs>=0
      &&typeof idleWait.observedBusy==='boolean';
    await record('SUPERVISOR_STOPPED',validIdleWait?{supervisorIdleWait:{
      retryCount:idleWait.retryCount,elapsedMs:idleWait.elapsedMs,
      observedBusy:idleWait.observedBusy}}:{});
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
    // Only a positively observed bounded Busy refusal may carry failure telemetry.
    // This is not evidence that the old supervisor stopped or recovery succeeded.
    const idleFailure=error?.supervisorIdleWait;
    if(failureOperation==='stopOwnSupervisor'&&reason==='RUNNERS_NOT_IDLE'
      &&idleFailure&&Number.isSafeInteger(idleFailure.retryCount)
      &&idleFailure.retryCount>=0&&Number.isSafeInteger(idleFailure.elapsedMs)
      &&idleFailure.elapsedMs>=0&&idleFailure.observedBusy===true){
      ledger.supervisorIdleWait={retryCount:idleFailure.retryCount,
       elapsedMs:idleFailure.elapsedMs,observedBusy:true};
    }
    const details=(status,nextAction)=>failureDetails({status,failureOperation,
      intakeAttempted,backup,supervisorStopped,switched,nextAction});
    // Once the new six-Runner tree has reconnected, an intake API timeout
    // or journal failure has an UNKNOWN effect. The workflow may already be
    // enabled and queued Issues may already be claimed. Never stop that tree
    // or overwrite host.json via an automatic rollback on this boundary.
    // Reconcile the exact existing request/lease in the independent operator.
    const intakeBoundaryUncertain=ledger.phase==='RECONNECTED'||
      ledger.phase==='INTAKE_RESUMED';
    // A network timeout while a postcheck may still be running is not evidence
    // of diagnostic failure. In particular, do not stop its active Runner.
    if(intakeBoundaryUncertain ||
      (ledger.phase==='POSTCHECK_PENDING' &&
       ['POSTCHECK_OUTCOME_UNKNOWN','RUNNER_RECONNECT_OUTCOME_UNKNOWN'].includes(reason))) {
      const nextAction=intakeBoundaryUncertain
        ?'RECONCILE_WORKFLOW_BACKLOG_AND_INSTALLED_SHA_NO_AUTOMATIC_ROLLBACK'
        :'RECONCILE_POSTCHECK_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY';
      await record('RECOVERY_REQUIRED',{status:'RECOVERY_REQUIRED',code:reason,firstFail,
        actualInstalledSha:null,intakePaused:paused,next:nextAction,...details('RECOVERY_REQUIRED',nextAction)});
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
    let stagingIsolated=false;
    // Preparation failure must not poison the shared install lane when the
    // trusted port proves both the original runtime and the candidate namespace.
    // A generic untouched assertion is deliberately insufficient for staging.
    if(failureOperation==='stage'&&!intakeAttempted&&!paused&&!backup&&!supervisorStopped&&!switched&&
      typeof port.verifyStagingFailureIsolated==='function'){
      try{stagingIsolated=await port.verifyStagingFailureIsolated({installedSha:request.installedSha})===true;}catch{}
    }
    let oldStillRunning=false;
    // A positive scoped no-effect proof is already sufficient here. Avoid
    // a second broad Runner-idle probe that can fail solely because another
    // approved A task started while this request was being classified.
    if(!switched&&!prevalidationUntouched){
      try{
        // BACKED_UP may still have the original Supervisor running when a
        // last-second Runner busy preflight refuses to stop it. Prove the
        // immutable snapshot + live previous tree, not a target-SHA rollback.
        oldStillRunning=backup&&ledger.phase==='BACKED_UP'
          ? typeof port.verifyRestoredPrevious==='function' &&
            await port.verifyRestoredPrevious(request.installedSha)===true
          : await port.verifyPrevious({installedSha:request.installedSha,
            requireRunning:true,requireIdle:false})===true;
      }catch{}
    }
    if(!switched && (!supervisorStopped || oldStillRunning)) {
      // Intake is deliberately not enabled when drain/state is uncertain.
      // An intact preflight failure can leave it enabled only if verified.
      // A partially written staging tree is not a verified no-effect
      // prevalidation, even if the previous Supervisor is still alive.
      let safe=stagingIsolated||(failureOperation!=='stage'&&(oldStillRunning||prevalidationUntouched));
      // pauseIntake() can disable the workflow and then lose its API ACK,
      // leaving paused=false in this coordinator. Never infer active intake
      // merely from an unchanged controller or from our local Boolean.
      let observed;
      try {observed=await port.inspectAfterUncertain({...ledger});} catch {}
      let workflowState=observed?.workflowState;
      // A claimed untouched prevalidation must also match the independently
      // observed installed SHA, not only a callback's Boolean result.
      if((prevalidationUntouched||stagingIsolated)&&observed?.actualControllerSha!==request.installedSha)safe=false;
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
      // Restore of intake alone is complete only after the previous runtime
      // remains healthy with all six seats online (busy is not failure).
      if(safe && backup && ledger.phase==='BACKED_UP'){
        try{safe=await port.verifyPrevious({installedSha:request.installedSha,
          requireRunning:true,requireIdle:false})===true;}catch{safe=false;}
      }
      const status=safe?'BLOCKED':'RECOVERY_REQUIRED';
      const substate=safe&&stagingIsolated?'STAGING_ONLY_ISOLATED_VERIFIED':
       safe&&prevalidationUntouched?'PREVALIDATION_UNTOUCHED_VERIFIED':undefined;
      await record(status,{status,code:reason,firstFail,substate,actualInstalledSha:safe?request.installedSha:null,intakePaused:paused,
        ...(safe&&stagingIsolated?{candidateArtifactsPreserved:true,operatingStateUnchanged:true}:{}),
        workflowEnabled:workflowState==='active'?true:workflowState==='disabled_manually'?false:null,
        observed,...details(status)});
      return {...ledger};
    }
    // Restore service before diagnosing the rejected candidate. Preserve the
    // original failure separately from any recovery failure; never guess success.
    let restored=false,rollbackFailureCode=null,rollbackOperation='verifyBackup';
    try{
      if(!backup||await port.verifyBackup(request.installedSha)!==true)
        throw fail('ROLLBACK_BACKUP_NOT_VERIFIED');
      rollbackOperation='restore';await port.restore();
      rollbackOperation='reconnectPrevious';await port.reconnectPrevious();
      rollbackOperation='verifyPrevious';
      restored=await port.verifyPrevious({installedSha:request.installedSha,requireRunning:true})===true;
      if(!restored)throw fail('ROLLBACK_PREVIOUS_RUNTIME_NOT_VERIFIED');
      rollbackOperation='resumeIntake';await port.resumeIntake();paused=false;
      rollbackOperation='reconcileBacklog';if(port.reconcileBacklog)await port.reconcileBacklog(request);
      rollbackOperation='verifyPrevious';
      restored=await port.verifyPrevious({installedSha:request.installedSha,requireRunning:true,requireIdle:false})===true;
      if(!restored)throw fail('ROLLBACK_FINAL_RUNTIME_NOT_VERIFIED');
    }catch(rollbackError){
      rollbackFailureCode=maintenanceFailureCode(rollbackError,rollbackOperation);
      restored=false;
    }
    const status=restored?'ROLLED_BACK':'RECOVERY_REQUIRED';
    await record(status,{status,code:restored?reason:'BACKLOG_OR_RECOVERY_NOT_VERIFIED',firstFail,
      originalFailureCode:reason,rollbackFailureCode,
      rollbackFailureOperation:rollbackFailureCode?rollbackOperation:null,
      ...(error.postcheckFailureEvidence?{postcheckFailureEvidence:error.postcheckFailureEvidence}:{}),
      actualInstalledSha:restored?request.installedSha:null,intakePaused:paused,
      recoverySha:restored?request.installedSha:null,protectedStateUnchanged:restored,workflowEnabled:restored&&!paused,
      ...details(status,restored?'PREVIOUS_VERSION_RESTORED_CONTINUE_APPROVED_WORK':undefined)});
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
 // A connected new Supervisor may already be serving jobs, and enabling
 // pc-job.yml may have succeeded without its acknowledgement. A standalone
 // rollback must not kill that tree or overwrite host.json before the intake
 // and backlog have been independently reconciled. A failed resume at this
 // boundary is not evidence that the new Controller installation is bad.
 if(phase==='RECONNECTED'){
  await record('RECOVERY_RECONNECTED_INTAKE_READBACK_REQUIRED');return out;
 }
 if(['INTAKE_RESUMED','BACKLOG_RECONCILED'].includes(phase)){
  await record('RECOVERY_WAIT_EXISTING_RESULT');return out;
 }
 if(phase==='POSTCHECK_PENDING'){
  // A failed postcheck is not an uncertain postcheck. Only the independent
  // operator may attest the original GitHub failed job, original request,
  // exact snapshot/lease CAS, and existing active Controller. Ordinary callers
  // have no such port and retain the historical WAIT/no-mutation behavior.
  let confirmed=false;
  if(original.status==='RECOVERY_REQUIRED'&&original.firstFail==='POSTCHECK_PENDING'&&
    Number.isSafeInteger(original.postIssueNumber)&&original.postIssueNumber>0&&
    /^[a-f0-9]{40}$/.test(original.targetSha??'')&&
    typeof port.confirmPostcheckFailure==='function'){
   try{confirmed=await port.confirmPostcheckFailure(original)===true;}catch{}
  }
  if(!confirmed){
   await record('RECOVERY_WAIT_EXISTING_RESULT');return out;
  }
  await record('RECOVERY_CONFIRMED_POSTCHECK_FAILURE');
 }
 if(!['BACKED_UP','SUPERVISOR_STOPPED','SWITCHED','POSTCHECK_PENDING'].includes(phase)||
    !['RUNNING','RECOVERY_REQUIRED'].includes(original.status)){
  await record('RECOVERY_PHASE_NOT_ROLLBACK_ELIGIBLE');return out;
 }
 let recoveryOperation='prepareRecovery';
 try{
  await port.prepareRecovery();
  recoveryOperation='verifyBackup';
  if(await port.verifyBackup(original.installedShaBefore)!==true)throw fail('RECOVERY_BACKUP_NOT_VERIFIED');
  await record('RECOVERY_BACKUP_VERIFIED');
  // Automatic rollback may already have restored and reconnected the exact
  // snapshot before an intake check failed. Prove that state independently;
  // never copy files over a live, healthy previous Controller a second time.
  recoveryOperation='verifyRestoredPrevious';
  const preserved=port.verifyRestoredPrevious?
   await port.verifyRestoredPrevious(original.installedShaBefore)===true:false;
  if(preserved){
   await record('RECOVERY_EXISTING_VERSION_VERIFIED',{existingVersionPreserved:true});
  }else{
   // Read-only checks must precede the durable mutation claim. A rejected
   // roster or protected-state preflight has not changed intake or files.
   if(port.preflightRecoveryRestore){
    recoveryOperation='preflightRecoveryRestore';
    await port.preflightRecoveryRestore();
   }
   recoveryOperation='restore';
   if(port.restoreMarksMutation===true){
    // Record the durable claim at the first real mutation boundary, not
    // before repeated read-only roster/protection/backlog checks.
    let marked=false;
    await port.restore({beforeMutation:async()=>{
     if(marked)return;
     await record('RECOVERY_RESTORE_STARTED',{mutationStarted:true});
     marked=true;
    }});
    if(!marked)throw fail('RECOVERY_MUTATION_MARKER_MISSING');
   }else{
    // Existing restore ports retain their historical conservative contract.
    await record('RECOVERY_RESTORE_STARTED',{mutationStarted:true});
    await port.restore();
   }
   await record('RECOVERY_FILES_RESTORED');
   recoveryOperation='reconnectPrevious';await port.reconnectPrevious();
  }
  recoveryOperation='verifyPrevious';
  // A verified previous Supervisor may serve another approved A job. Its six
  // seats must remain online, but a busy seat is not a damaged runtime.
  if(await port.verifyPrevious({installedSha:original.installedShaBefore,
    requireRunning:true,requireIdle:false})!==true)throw fail('RECOVERY_RUNTIME_NOT_VERIFIED');
  // Intake/backlog writes also require a durable claim, even without restore.
  await record('RECOVERY_INTAKE_RESUME_STARTED',{mutationStarted:true});
  recoveryOperation='resumeIntake';
  await port.resumeIntake();
  recoveryOperation='reconcileBacklog';
  if(port.reconcileBacklog)await port.reconcileBacklog();
  recoveryOperation='verifyPrevious';
  // Replayed A jobs may now legitimately occupy a seat. Require six Online
  // runners and the same healthy Controller, not idle seats after intake opens.
  if(await port.verifyPrevious({installedSha:original.installedShaBefore,requireRunning:true,requireIdle:false})!==true)throw fail('RECOVERY_FINAL_READBACK_FAILED');
  await record('INTERRUPTED_ROLLBACK_VERIFIED',{status:'ROLLED_BACK',actualInstalledSha:original.installedShaBefore,protectedStateUnchanged:true});
  }catch(error){await record(maintenanceFailureCode(error,recoveryOperation),{status:'RECOVERY_REQUIRED',failureOperation:recoveryOperation});}
 return out;
}
