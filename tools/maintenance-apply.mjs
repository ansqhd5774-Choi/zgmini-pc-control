// This coordinator runs ONLY in a maintenance process outside the supervisor tree.
// All machine-specific operations are injected so the safety transitions can be tested
// without touching a real runner, scheduled task, or database.
export const UPDATE_PHASES = Object.freeze([
  'RECEIVED','VALIDATED','STAGED','INTAKE_PAUSED','DRAINED','BACKED_UP',
  'SUPERVISOR_STOPPED','SWITCHED','RECONNECTED','INTAKE_RESUMED','BACKLOG_RECONCILED',
  'POSTCHECK_PENDING','PASS','BLOCKED','ROLLED_BACK','RECOVERY_REQUIRED'
]);

const fail = code => Object.assign(new Error(code), {code});
const codeOf = error => /^[A-Z0-9_]{1,80}$/.test(error?.code ?? '') ? error.code : 'UPDATE_UNEXPECTED_FAILURE';

/**
 * Port contract:
 *   persist(journal), read(requestId), inspect(), validate(request, state),
 *   stage(request), pauseIntake(), waitForDrain(), backup(), stopOwnSupervisor(),
 *   switchVersion(), reconnect(), resumeIntake(), postcheck(request),
 *   verifyBackup(), restore(), reconnectPrevious(), verifyPrevious(),
 *   inspectAfterUncertain(journal), listCurrentJobs().
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
  let paused=false,backup=false,supervisorStopped=false,switched=false;
  try {
    const before=await port.inspect();
    if(before.insideRunnerTree || before.githubActions) throw fail('MAINTENANCE_PROCESS_NOT_INDEPENDENT');
    if(before.installedSha!==request.installedSha) throw fail('INSTALLED_SHA_MISMATCH');
    await port.validate(request,before);
    await record('VALIDATED');
    await port.stage(request);
    await record('STAGED');
    // Intake is paused BEFORE draining. Accepted Issues remain durable on GitHub.
    paused=true;await port.pauseIntake();
    await record('INTAKE_PAUSED');
    await port.waitForDrain();
    await record('DRAINED');
    await port.backup();backup=true;
    await record('BACKED_UP');
    supervisorStopped=true;await port.stopOwnSupervisor();
    await record('SUPERVISOR_STOPPED');
    await port.switchVersion();switched=true;
    await record('SWITCHED');
    await port.reconnect();
    await record('RECONNECTED');
    await port.resumeIntake();paused=false;
    await record('INTAKE_RESUMED');
    // GitHub does not replay Issues opened while a workflow is disabled.
    // Reconcile the durable Issue queue before declaring this update complete.
    if(port.reconcileBacklog)await port.reconcileBacklog(request);
    await record('BACKLOG_RECONCILED');
    await record('POSTCHECK_PENDING');
    const post=await port.postcheck(request);
    if(post?.status!=='PASS'||post?.actualExecutionSha!==request.targetSha||
      post?.protectedStateUnchanged!==true||post?.runnerSetVerified!==true||
      post?.postSourceVerified!==true) throw fail('POSTCHECK_NOT_VERIFIED');
    await record('PASS',{status:'PASS',code:'APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED',actualInstalledSha:request.targetSha,postcheck:post,
      protectedStateUnchanged:true,workflowEnabled:true});
    return {...ledger};
  } catch(error) {
    const firstFail=ledger.phase,reason=codeOf(error);
    // A network timeout while a postcheck may still be running is not evidence
    // of diagnostic failure. In particular, do not stop its active Runner.
    if((ledger.phase==='POSTCHECK_PENDING' && reason==='POSTCHECK_OUTCOME_UNKNOWN') ||
      (ledger.phase==='INTAKE_RESUMED' && reason.startsWith('BACKLOG_'))) {
      await record('RECOVERY_REQUIRED',{status:'RECOVERY_REQUIRED',code:reason,firstFail,
        actualInstalledSha:null,intakePaused:paused,next:reason==='BACKLOG_REPLAY_OUTCOME_UNKNOWN'
          ?'RECONCILE_QUEUED_ISSUES_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY'
          :'RECONCILE_POSTCHECK_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY'});
      return {...ledger};
    }
    // If code was only staged, the installed controller is untouched.
    let oldStillRunning=false;
    if(!switched){try{oldStillRunning=await port.verifyPrevious({installedSha:request.installedSha,requireRunning:true});}catch{}}
    if(!switched && (!supervisorStopped || oldStillRunning)) {
      // Intake is deliberately not enabled when drain/state is uncertain.
      // An intact preflight failure can leave it enabled only if verified.
      let safe=oldStillRunning;
      // pauseIntake() can disable the workflow and then lose its API ACK,
      // leaving paused=false in this coordinator. Never infer active intake
      // merely from an unchanged controller or from our local Boolean.
      let observed;
      try {observed=await port.inspectAfterUncertain({...ledger});} catch {}
      let workflowState=observed?.workflowState;
      if(safe && paused && workflowState==='disabled_manually') {
        if(port.didPauseIntake && !port.didPauseIntake())safe=false;
        else try {await port.resumeIntake();paused=false;
          observed=await port.inspectAfterUncertain({...ledger});
          workflowState=observed?.workflowState;
        } catch {safe=false;}
      }
      if(safe && paused && workflowState==='active')paused=false;
      if(workflowState!=='active')safe=false;
      if(safe && port.reconcileBacklog){try {await port.reconcileBacklog(request);}catch{safe=false;}}
      const status=safe?'BLOCKED':'RECOVERY_REQUIRED';
      await record(status,{status,code:reason,firstFail,actualInstalledSha:safe?request.installedSha:null,intakePaused:paused,
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
