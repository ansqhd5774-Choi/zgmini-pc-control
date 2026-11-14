// ZGMINI support-only. Pure read-only classifier; not a Windows Operator or deployment tool.
// Input values must be authenticated by the existing single operating Owner.
// Missing booleans must remain null/undefined, never assumed false.
export function classifyHandoffReceipt(e, config = {}) {
  const OLD = config.installedSha || '16064e29fea0e53e7769a24d93d75b6f5292cfc0';
  const TARGET = config.targetSha || 'c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7';
  const result = (status, reason, next) => ({status, reason, next, operationalPass: status === 'HANDOFF_VERIFIED'});
  if (!e || typeof e !== 'object' || Array.isArray(e)) return result('INVALID_EVIDENCE','Receipt must be an object','OWNER_READ_ONLY_REVIEW');
  const bools = ['attemptObserved','journalPresent','stopRequestPresent','stopHandledPresent','priorReceiverAlive','operatorAlive','runtimeHashesVerified','receiverOriginVerified','protectionPreserved','runnerSeatsVerified','installLeaseClear','remoteReportPresent'];
  if (bools.some(key => e[key] != null && typeof e[key] !== 'boolean')) return result('INVALID_EVIDENCE','Malformed tri-state evidence','OWNER_READ_ONLY_REVIEW');
  const statuses = ['PASS','BLOCKED','RUNNING','RECOVERY_REQUIRED','ROLLED_BACK'];
  if (e.journalStatus != null && !statuses.includes(e.journalStatus)) return result('INVALID_EVIDENCE','Unexpected journal status','OWNER_READ_ONLY_REVIEW');
  if (e.installedSourceSha != null && !/^[a-f0-9]{40}$/.test(e.installedSourceSha)) return result('INVALID_EVIDENCE','Invalid installed source SHA','OWNER_READ_ONLY_REVIEW');
  if (e.journalPresent === false && e.journalStatus != null) return result('EVIDENCE_CONFLICT','Journal absent but status supplied','OWNER_READ_ONLY_REVIEW');
  if (e.attemptObserved === false && (
    e.journalPresent === true || e.stopRequestPresent === true || e.stopHandledPresent === true
  )) return result('EVIDENCE_CONFLICT','Claimed not-run but state transition evidence exists','OWNER_READ_ONLY_REVIEW');
  if (e.attemptObserved !== true) return result('NOT_RUN_UNCONFIRMED','No authenticated attempt receipt','WAIT_FOR_ORIGINAL_EVIDENCE');
  if (e.journalStatus === 'PASS' && e.installedSourceSha === OLD) return result('EVIDENCE_CONFLICT','PASS conflicts with old installed source','OWNER_READ_ONLY_REVIEW');
  if (e.journalStatus === 'PASS' && e.installedSourceSha != null && e.installedSourceSha !== TARGET) return result('EVIDENCE_CONFLICT','PASS conflicts with target SHA','OWNER_READ_ONLY_REVIEW');
  if (e.journalStatus === 'RECOVERY_REQUIRED') return result('RECOVERY_REQUIRED','Journal reports recovery required','OWNER_RECOVERY_REVIEW');
  if (e.journalStatus === 'ROLLED_BACK') return result('ROLLBACK_REATTESTATION_REQUIRED','Rollback label does not independently establish current receiver identity','OWNER_READ_ONLY_REVIEW');
  if (e.journalStatus === 'RUNNING') return result(e.operatorAlive === true ? 'HANDOFF_IN_PROGRESS' : 'INCOMPLETE_JOURNAL','Running journal needs operator state confirmation','OWNER_READ_ONLY_REVIEW');
  if (e.journalPresent === false && (e.priorReceiverAlive === false || e.stopHandledPresent === true)) {
    return result('STOPPED_PREJOURNAL_UNKNOWN','Receiver may have stopped before durable handoff journal','OWNER_RECOVERY_REVIEW');
  }
  if (e.stopRequestPresent === true && e.journalPresent !== true) return result('STOP_PENDING_OR_TIMEOUT','Delayed cooperative stop remains possible','OWNER_READ_ONLY_REVIEW');
  if (e.journalStatus === 'BLOCKED') {
    if (e.priorReceiverAlive === true && e.stopRequestPresent === false && e.stopHandledPresent === false && e.installedSourceSha === OLD && e.protectionPreserved === true) {
      return result('PREFLIGHT_BLOCKED_UNTOUCHED','Preflight blocked with observed old receiver and unchanged protection','NO_AUTO_RETRY');
    }
    return result('BLOCKED_SIDE_EFFECTS_UNKNOWN','Blocked label cannot prove no state transition','OWNER_READ_ONLY_REVIEW');
  }
  if (e.journalStatus === 'PASS') {
    const verified = e.journalPresent === true && e.installedSourceSha === TARGET &&
      e.runtimeHashesVerified === true && e.receiverOriginVerified === true &&
      e.protectionPreserved === true && e.runnerSeatsVerified === true &&
      e.installLeaseClear === true;
    if (!verified && e.receiverOriginVerified !== true) return result('PASS_BUT_RECEIVER_UNVERIFIED','Journal PASS lacks independent Windows receiver-origin verification','OWNER_READ_ONLY_REVIEW');
    if (!verified) return result('PASS_EVIDENCE_INCOMPLETE','One or more required bytes/protection/runner/lease proofs missing','OWNER_READ_ONLY_REVIEW');
    if (e.remoteReportPresent === false) return result('UPLOAD_GAP','Local proof available but remote receipt absent; never replay handoff','RECOVER_EXISTING_RECEIPT');
    if (e.remoteReportPresent !== true) return result('PASS_REMOTE_RECEIPT_UNCONFIRMED','Remote receipt not observed','OWNER_READ_ONLY_REVIEW');
    return result('HANDOFF_VERIFIED','All stipulated independent handoff proofs observed','HANDOFF_ONLY_COMPLETE');
  }
  if (e.journalPresent === true) return result('JOURNAL_STATUS_UNKNOWN','Journal exists but status has not been authenticated','OWNER_READ_ONLY_REVIEW');
  if (e.stopHandledPresent === true) return result('STOPPED_PREJOURNAL_UNKNOWN','Stop handled without journal verification','OWNER_RECOVERY_REVIEW');
  return result('STATE_UNKNOWN','Evidence insufficient to determine side effects','OWNER_READ_ONLY_REVIEW');
}
