// Pure orchestration of the fixed #917 recovery. No OS or GitHub calls.
// Ports are implemented only by the separately pinned, direct Windows C tool.
import {INCIDENT,validatePostSwitchApproval} from './controller-postswitch-approval.mjs';
import {forwardRecoveryCandidate,reconcilePostSwitchForward} from './controller-postswitch-reconciliation.mjs';

const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};

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
