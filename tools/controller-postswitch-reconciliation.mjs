// State machine for a separately approved, post-switch Controller reconciliation.
// No OS/HTTP access here. An operator-only adapter owns the immutable originals,
// the separate recovery claim, exact preimages and idempotent GitHub replay.

const need = (pass, code) => {if (!pass) throw Object.assign(new Error(code), {code});};
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function forwardRecoveryCandidate(ledger, evidence) {
  if (!ledger || ledger.status !== 'RECOVERY_REQUIRED' || ledger.phase !== 'RECOVERY_REQUIRED' ||
      ledger.firstFail !== 'INTAKE_RESUMED' || ledger.code !== 'BACKLOG_ORIGINAL_REQUEST_INVALID' ||
      ledger.intakePaused !== false || ledger.postIssueNumber != null ||
      !isSha(ledger.installedShaBefore) || !isSha(ledger.targetSha) ||
      ledger.installedShaBefore === ledger.targetSha) return false;
  if (evidence?.status !== 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED' ||
      evidence.actualControllerSha !== ledger.targetSha ||
      evidence.installedShaBefore !== ledger.installedShaBefore ||
      Object.values(evidence.checks || {}).some(value => value !== true) ||
      !Object.keys(evidence.checks || {}).length) return false;
  return true;
}

/**
 * The adapter must atomically persist separate recovery records, never the
 * original maintenance ledger. It must fail closed when an old replay's ACK
 * is unknown, and must not issue duplicate pc-job or postcheck requests.
 */
export async function reconcilePostSwitchForward({ledger, evidence, ports, persist}) {
  need(forwardRecoveryCandidate(ledger, evidence), 'FORWARD_ORIGINAL_NOT_ELIGIBLE');
  for (const key of ['verifyPreconditions', 'reconcileBacklog', 'postcheck',
    'verifyFinal', 'verifyOriginalUnchanged']) need(typeof ports?.[key] === 'function', 'FORWARD_PORT_MISSING');
  need(typeof persist === 'function', 'FORWARD_PERSIST_MISSING');
  const report = {schema: 'ZGMINI_PC_POSTSWITCH_RECONCILIATION_V1',
    requestId: ledger.requestId, originalStatus: ledger.status,
    originalFirstFail: ledger.firstFail, targetControllerSha: ledger.targetSha,
    originalRequestRetried: false, originalLedgerPreserved: false,
    status: 'RECOVERY_REQUIRED', mutationStarted: false};
  const record = async (code, patch = {}) => {
    Object.assign(report, {code, ...patch});
    await persist({...report});
  };
  let mutated = false;
  try {
    const before = await ports.verifyPreconditions({ledger, evidence});
    need(before?.verified === true, 'FORWARD_PRECONDITION_FAILED');
    await ports.verifyOriginalUnchanged();
    await record('FORWARD_PREPARED');

    // A replay may send a GitHub request before yielding or receiving an ACK.
    // Durable intent and a held recovery claim are necessary BEFORE this call.
    mutated = true;
    await record('FORWARD_BACKLOG_REPLAY_STARTED', {mutationStarted: true});
    const backlog = await ports.reconcileBacklog();
    need(backlog?.verified === true && backlog?.outcomeUnknown !== true,
      'FORWARD_BACKLOG_NOT_VERIFIED');
    await ports.verifyOriginalUnchanged();
    await record('FORWARD_BACKLOG_RECONCILED', {backlogVerified: true});

    // postcheck is adapter-owned, with separate recovery state and unique Issue
    // readback; the existing makePorts().postcheck writes the original ledger.
    await record('FORWARD_POSTCHECK_STARTED');
    const post = await ports.postcheck();
    need(post?.status === 'PASS' && post?.actualExecutionSha === ledger.targetSha &&
      post?.protectedStateUnchanged === true && post?.runnerSetVerified === true &&
      post?.postSourceVerified === true && post?.outcomeUnknown !== true,
      'FORWARD_POSTCHECK_NOT_VERIFIED');
    await ports.verifyOriginalUnchanged();
    await record('FORWARD_POSTCHECK_VERIFIED', {postcheckVerified: true});

    const final = await ports.verifyFinal({ledger, evidence});
    need(final?.currentSourceSha === ledger.targetSha && final?.protectedStateUnchanged === true &&
      final?.workflowActive === true && final?.supervisorVerified === true &&
      final?.backlogVerified === true && final?.runnerSetVerified === true,
      'FORWARD_FINAL_READBACK_FAILED');
    await ports.verifyOriginalUnchanged();
    await record('FORWARD_VERIFIED_READY_FOR_LEASE_ARCHIVE',
      {status:'FORWARD_RECONCILED', originalLedgerPreserved:true});
    return {...report};
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code :
      'FORWARD_OUTCOME_UNKNOWN';
    // The adapter keeps the old install lease. If a GitHub write may have been
    // sent, the independent recovery claim must also survive for reconciliation.
    await record(code, {status:'RECOVERY_REQUIRED', mutationStarted: mutated,
      next:'INSPECT_RECOVERY_CLAIM_BACKLOG_AND_POSTCHECK_NO_AUTOMATIC_RETRY'});
    return {...report};
  }
}
