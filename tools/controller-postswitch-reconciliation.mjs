// State machine for a separately approved, post-switch Controller reconciliation.
// No OS/HTTP access here. An operator-only adapter owns the immutable originals,
// the separate recovery claim, exact preimages and idempotent GitHub replay.

const need = (pass, code) => {if (!pass) throw Object.assign(new Error(code), {code});};
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const REQUIRED_EVIDENCE_CHECKS = Object.freeze([
  'ORIGINAL_LEDGER', 'TARGET_SWITCHED', 'BACKUP_VERIFIED',
  'OWNER_DEAD_AND_MATCHED', 'BACKLOG_CLOSED',
  'LIVE_WORKFLOW_ACTIVE', 'RUNNERS_ONLINE', 'SUPERVISOR_FRESH',
  'PROTECTION_UNCHANGED', 'PROTECTION_CONTRACT_VERIFIED',
]);
const REQUIRED_MATERIALS = Object.freeze([
  'ledger', 'owner', 'marker', 'currentHost', 'snapshotHost',
  'protectedBefore', 'backlog',
]);

export function forwardRecoveryCandidate(ledger, evidence) {
  if (!ledger || ledger.status !== 'RECOVERY_REQUIRED' || ledger.phase !== 'RECOVERY_REQUIRED' ||
      ledger.firstFail !== 'INTAKE_RESUMED' || ledger.code !== 'BACKLOG_ORIGINAL_REQUEST_INVALID' ||
      ledger.intakePaused !== false || ledger.postIssueNumber != null ||
      !isSha(ledger.installedShaBefore) || !isSha(ledger.targetSha) ||
      ledger.installedShaBefore === ledger.targetSha) return false;
  if (evidence?.status !== 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED' ||
      evidence.requestId !== ledger.requestId ||
      evidence.actualControllerSha !== ledger.targetSha ||
      evidence.installedShaBefore !== ledger.installedShaBefore ||
      !evidence.checks || Object.keys(evidence.checks).length !== REQUIRED_EVIDENCE_CHECKS.length ||
      !REQUIRED_EVIDENCE_CHECKS.filter(key =>
        key !== 'PROTECTION_UNCHANGED' && key !== 'PROTECTION_CONTRACT_VERIFIED')
        .every(key => evidence.checks[key] === true) ||
      !((evidence.checks.PROTECTION_UNCHANGED === true &&
          evidence.checks.PROTECTION_CONTRACT_VERIFIED === false) ||
        (evidence.checks.PROTECTION_UNCHANGED === false &&
          evidence.checks.PROTECTION_CONTRACT_VERIFIED === true)) ||
      !REQUIRED_MATERIALS.every(key => isDigest(evidence.materialHashes?.[key]))) return false;
  return true;
}

/**
 * The adapter must atomically acquire a request-scoped exclusive recovery claim
 * and persist a separate recovery record, never the original maintenance
 * ledger. An interrupted claim may only be inspected, never automatically
 * reacquired or replayed. Both pc-job and postcheck ACK loss are hard stops.
 */
export async function reconcilePostSwitchForward({ledger, evidence, ports, persist,resumeApproved=false}) {
  need(forwardRecoveryCandidate(ledger, evidence), 'FORWARD_ORIGINAL_NOT_ELIGIBLE');
  for (const key of ['verifyPreconditions', 'acquireClaim', 'reconcileBacklog', 'postcheck',
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
  let mutated = false, claimAcquired = false;
  try {
    const before = await ports.verifyPreconditions({ledger, evidence});
    need(before?.verified === true, 'FORWARD_PRECONDITION_FAILED');
    need(await ports.verifyOriginalUnchanged() === true, 'FORWARD_ORIGINAL_CHANGED');
    // An exclusive claim is a separate recoverable artifact, not a release of
    // the existing install lease. A pre-existing claim must be inspected by
    // its owner; blindly starting this state machine again risks duplication.
    const claim = await ports.acquireClaim({requestId: ledger.requestId,
      ledgerDigest: evidence.materialHashes.ledger});
    need(claim?.acquired === true && claim?.exclusive === true &&
      (claim?.preexisting === false ||
        (resumeApproved===true&&claim?.preexisting===true&&claim?.resumed===true)),
      'FORWARD_CLAIM_NOT_EXCLUSIVE');
    claimAcquired = true;
    // The claim can be acquired after the read-only snapshot but before the
    // first operational write. Revalidate the entire signed/live envelope,
    // not just the old ledger, while the exclusive claim is held.
    const held = await ports.verifyPreconditions({ledger, evidence, claimHeld: true});
    need(held?.verified === true, 'FORWARD_POSTCLAIM_PRECONDITION_DRIFT');
    need(await ports.verifyOriginalUnchanged() === true, 'FORWARD_ORIGINAL_CHANGED');
    await record('FORWARD_PREPARED', {claimHeld: true});

    // A replay may send a GitHub request before yielding or receiving an ACK.
    // Durable intent and a held recovery claim are necessary BEFORE this call.
    mutated = true;
    await record('FORWARD_BACKLOG_REPLAY_STARTED', {mutationStarted: true});
    const backlog = await ports.reconcileBacklog();
    need(backlog?.verified === true && backlog?.outcomeUnknown !== true,
      'FORWARD_BACKLOG_NOT_VERIFIED');
    need(await ports.verifyOriginalUnchanged() === true, 'FORWARD_ORIGINAL_CHANGED');
    await record('FORWARD_BACKLOG_RECONCILED', {backlogVerified: true});

    // postcheck is adapter-owned, with separate recovery state and unique Issue
    // readback; the existing makePorts().postcheck writes the original ledger.
    await record('FORWARD_POSTCHECK_STARTED');
    const post = await ports.postcheck();
    need(post?.status === 'PASS' && post?.actualExecutionSha === ledger.targetSha &&
      post?.protectedStateUnchanged === true && post?.runnerSetVerified === true &&
      post?.postSourceVerified === true && post?.outcomeUnknown !== true,
      'FORWARD_POSTCHECK_NOT_VERIFIED');
    need(await ports.verifyOriginalUnchanged() === true, 'FORWARD_ORIGINAL_CHANGED');
    await record('FORWARD_POSTCHECK_VERIFIED', {postcheckVerified: true});

    const final = await ports.verifyFinal({ledger, evidence});
    need(final?.currentSourceSha === ledger.targetSha &&
      (final?.protectedStateUnchanged === true || final?.protectionContractVerified === true) &&
      final?.workflowActive === true && final?.supervisorVerified === true &&
      final?.backlogVerified === true && final?.runnerSetVerified === true,
      'FORWARD_FINAL_READBACK_FAILED');
    need(await ports.verifyOriginalUnchanged() === true, 'FORWARD_ORIGINAL_CHANGED');
    await record('FORWARD_VERIFIED_READY_FOR_LEASE_ARCHIVE',
      {status:'FORWARD_RECONCILED', originalLedgerPreserved:true});
    return {...report};
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code :
      'FORWARD_OUTCOME_UNKNOWN';
    // The adapter keeps the old install lease. If a GitHub write may have been
    // sent, the independent recovery claim must also survive for reconciliation.
    const patch = {status:'RECOVERY_REQUIRED', mutationStarted: mutated,
      next:'INSPECT_RECOVERY_CLAIM_BACKLOG_AND_POSTCHECK_NO_AUTOMATIC_RETRY'};
    if (claimAcquired) await record(code, patch);
    else Object.assign(report, {code, ...patch});
    return {...report};
  }
}
