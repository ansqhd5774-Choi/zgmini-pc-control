// Pure orchestration of the fixed #917 recovery. No OS or GitHub calls.
// Ports are implemented only by the separately pinned, direct Windows C tool.
import {INCIDENT,validatePostSwitchApproval} from './controller-postswitch-approval.mjs';
import {forwardRecoveryCandidate,reconcilePostSwitchForward} from './controller-postswitch-reconciliation.mjs';

const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};

/** Finalize only already verified results. This port surface has no replay or
 * postcheck submission methods; no additional GitHub execution is possible. */
export async function finishApprovedPostSwitchResults({approval,evidence,sourceSha,ports}){
  validatePostSwitchApproval(approval,{requestId:INCIDENT.requestId,sourceSha,evidence});
  need(approval.finalize!==undefined,'POSTSWITCH_FINALIZE_EXPLICIT_CONSENT_REQUIRED');
  for(const key of ['verifyPreconditions','verifyFinal','verifyOriginalUnchanged','archiveLease','persist'])
    need(typeof ports?.[key]==='function','POSTSWITCH_FINALIZE_PORT_MISSING');
  let archiveStarted=false;
  try{
    need((await ports.verifyPreconditions())?.verified===true,'POSTSWITCH_FINALIZE_PRECONDITION_FAILED');
    const final=await ports.verifyFinal();
    need(final?.currentSourceSha===INCIDENT.newSha&&
      (final.protectedStateUnchanged===true||final.protectionContractVerified===true)&&
      final.workflowActive===true&&final.supervisorVerified===true&&
      final.runnerSetVerified===true&&final.backlogVerified===true,
      'POSTSWITCH_FINALIZE_READBACK_FAILED');
    need(await ports.verifyOriginalUnchanged()===true,'POSTSWITCH_FINALIZE_ORIGINAL_DRIFT');
    await ports.persist({status:'RECOVERY_REQUIRED',code:'POSTSWITCH_FINALIZE_ARCHIVE_INTENT'});
    archiveStarted=true;
    const archived=await ports.archiveLease();
    need(archived?.verified===true&&archived.originalPreserved===true&&
      archived.archiveVerified===true&&archived.claimPreserved===true,
      'POSTSWITCH_FINALIZE_ARCHIVE_UNVERIFIED');
    const report={status:'RECOVERY_COMPLETED',code:'POSTSWITCH_FORWARD_RECOVERY_COMPLETED',
      originalLedgerPreserved:true,originalRequestRetried:false,leaseArchived:true,
      archivedLeaseName:archived.archiveName,replayIssueNumber:1215,postcheckIssueNumber:1216};
    await ports.persist(report);return report;
  }catch(error){
    const report={status:'RECOVERY_REQUIRED',code:error?.code??'POSTSWITCH_FINALIZE_OUTCOME_UNKNOWN',
      leaseArchived:archiveStarted?null:false,archiveOutcomeUnknown:archiveStarted,originalRequestRetried:false};
    // Once the lease was archived, persist() may itself fail. Do not attempt
    // a journal append through a moved claim or claim a rollback occurred.
    return report;
  }
}

export async function runApprovedPostSwitch({approval,ledger,evidence,sourceSha,ports}) {
  validatePostSwitchApproval(approval,{requestId:INCIDENT.requestId,sourceSha,evidence});
  need(forwardRecoveryCandidate(ledger,evidence),'POSTSWITCH_ORIGINAL_NOT_ELIGIBLE');
  need(ledger.requestId===INCIDENT.requestId &&
    ledger.targetSha===INCIDENT.newSha &&
    ledger.installedShaBefore===INCIDENT.oldSha &&
    ledger.issueNumber===INCIDENT.issueNumber,
  'POSTSWITCH_INCIDENT_LEDGER_MISMATCH');
  for(const name of ['verifyPreconditions','acquireClaim','reconcileBacklog',
    'postcheck','verifyFinal','verifyOriginalUnchanged','persist','archiveLease'])
    need(typeof ports?.[name]==='function','POSTSWITCH_OPERATOR_PORT_MISSING');

  // Forward reconciliation never touches the old install lease or ledger.
  const forward=await reconcilePostSwitchForward({ledger,evidence,
    ports, persist:ports.persist,resumeApproved:approval.resume!==undefined});
  if(forward.status!=='FORWARD_RECONCILED')return {
    ...forward, status:'RECOVERY_REQUIRED',leaseArchived:false};

  // A separate terminal step is required; 'forward reconciled' is not DONE.
  try {
    need(await ports.verifyOriginalUnchanged()===true,
      'POSTSWITCH_ORIGINAL_CHANGED_BEFORE_ARCHIVE');
    await ports.persist({...forward,status:'RECOVERY_REQUIRED',
      code:'POSTSWITCH_LEASE_ARCHIVE_INTENT',leaseArchived:false});
    const archived=await ports.archiveLease({approval,ledger,evidence});
    need(archived?.verified===true && archived?.originalPreserved===true &&
      archived?.archiveVerified===true && archived?.claimPreserved===true,
    'POSTSWITCH_LEASE_ARCHIVE_NOT_VERIFIED');
    await ports.persist({...forward,status:'RECOVERY_COMPLETED',
      code:'POSTSWITCH_FORWARD_RECOVERY_COMPLETED',leaseArchived:true,
      archivedLeaseName:archived.archiveName,
      originalLedgerPreserved:true});
    return {...forward,status:'RECOVERY_COMPLETED',
      code:'POSTSWITCH_FORWARD_RECOVERY_COMPLETED',leaseArchived:true,
      archivedLeaseName:archived.archiveName};
  } catch (error) {
    const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:
      'POSTSWITCH_LEASE_ARCHIVE_OUTCOME_UNKNOWN';
    // In particular, never release the exclusive recovery claim here.
    return {...forward,status:'RECOVERY_REQUIRED',code,leaseArchived:false,
      next:'INSPECT_LEASE_AND_RECOVERY_CLAIM_NO_AUTOMATIC_RETRY'};
  }
}
