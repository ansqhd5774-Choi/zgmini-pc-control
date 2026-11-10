// #996 only. Source-only, pure C-grade recovery candidate; NEVER changes intake,
// lease, Controller, backlog, Writer, or a GitHub issue. A separate reviewed
// operator must re-read live evidence and obtain explicit C consent to execute.

export const INTAKE_996 = Object.freeze({
  schema: 'ZGMINI_CONTROLLER_996_INTAKE_EVIDENCE_V1',
  requestId: 'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
  issueNumber: 996,
  controllerSha: 'badad9124157879d7a645b64f2768113d632355b',
  targetSha: '9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
  maintainerSha: '16064e29fea0e53e7769a24d93d75b6f5292cfc0',
});

const SEATS = Object.freeze(Array.from({length: 6}, (_, n) => `zgmini-pc-0${n + 1}`));
const DIGEST_KEYS = Object.freeze([
  'ledger', 'owner', 'recoveryMarker', 'backlog', 'stagedHost',
  'controllerHost', 'maintainerManifest', 'protectedSnapshot',
]);
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const validIso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const plainObject = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value);

/** Ignore independent CI/blog Runners, but require each dedicated seat once. */
export function exactlySixDedicatedSeats(rows) {
  if (!Array.isArray(rows)) return false;
  return SEATS.every(name => {
    const matches = rows.filter(row => row?.name === name);
    return matches.length === 1 && matches[0].status === 'online' &&
      matches[0].busy === false;
  });
}

/**
 * Read-only proposal classification. `true` fields are claims from the *read*
 * evidence source, not proof that an eventual C operator has authority. That
 * operator must independently verify the exact raw bytes, owner identity and
 * live workflow immediately before each mutation.
 */
export function assess996PausedIntake(evidence) {
  const e = plainObject(evidence) ? evidence : {};
  const id = INTAKE_996;
  const ledger = e.ledger ?? {};
  const lock = e.installLock ?? {};
  const controller = e.controller ?? {};
  const backlog = e.backlog ?? {};
  const stage = e.stage ?? {};
  const maintainer = e.maintainer ?? {};
  const workflow = e.workflow ?? {};
  const protection = e.protection ?? {};
  const pins = e.digests ?? {};

  const checks = {
    REQUEST_PIN: e.schema === id.schema && e.requestId === id.requestId &&
      e.issueNumber === id.issueNumber && validIso(e.observedAt),
    LEDGER_PHASE: ledger.requestId === id.requestId &&
      ledger.issueNumber === id.issueNumber &&
      ledger.installedShaBefore === id.controllerSha &&
      ledger.targetSha === id.targetSha && ledger.status === 'RECOVERY_REQUIRED' &&
      ledger.phase === 'RECOVERY_REQUIRED' && ledger.firstFail === 'INTAKE_PAUSED' &&
      ledger.code === 'RUNNER_SET_DRIFT' && validIso(ledger.updatedAt),
    ORIGINAL_LEASE: lock.held === true && lock.recoveryRequired === true &&
      Number.isSafeInteger(lock.ownerPid) && lock.ownerPid > 0 &&
      lock.ownerPid === lock.markerOwnerPid &&
      lock.ownerNonceMatched === true && lock.markerLedgerTimeMatched === true &&
      lock.ownerDeadProven === true && lock.recoveryClaimAbsent === true,
    ORIGINAL_RUNTIME: controller.sourceSha === id.controllerSha &&
      controller.hostFilesVerified === true &&
      controller.supervisorIdentityVerified === true &&
      controller.switchNeverStarted === true,
    STAGED_ONLY: stage.exists === true && stage.bytesVerified === true &&
      stage.snapshotAbsent === true && stage.previousFilesAbsent === true &&
      stage.sourceRequestId === id.requestId,
    PAUSE_JOURNAL: backlog.exists === true && backlog.requestId === id.requestId &&
      backlog.pauseWindowOpen === true && backlog.pauseOwnedByRequest === true &&
      backlog.replaysUntampered === true,
    INTAKE_PAUSED: workflow.state === 'disabled_manually' &&
      workflow.pausedByRequest === true,
    PROTECTED_STATE: protection.beforeAndNowVerified === true &&
      protection.unchanged === true,
    DEDICATED_RUNNERS: exactlySixDedicatedSeats(e.runners),
    NO_COLLIDING_LEASE: e.otherControllerLeaseCount === 0,
    MAINTAINER_PIN: maintainer.sourceSha === id.maintainerSha &&
      maintainer.filesVerified === true,
    RAW_EVIDENCE_PIN: plainObject(pins) &&
      Object.keys(pins).length === DIGEST_KEYS.length &&
      DIGEST_KEYS.every(name => sha256(pins[name])),
  };
  const firstFailedCheck = Object.keys(checks).find(key => !checks[key]) ?? null;
  return Object.freeze({
    schema: 'ZGMINI_CONTROLLER_996_INTAKE_ASSESSMENT_V1',
    status: firstFailedCheck ? 'EVIDENCE_INCOMPLETE' : 'C_CANDIDATE_READY_FOR_REVIEW',
    code: firstFailedCheck ?? 'EXPLICIT_NEW_C_CONSENT_REQUIRED',
    firstFailedCheck, checks: Object.freeze(checks),
    executionAuthorized: false, operationalWrites: 0,
  });
}

/** A proposed approval is always false; there is no execute/apply function. */
export function draft996CApproval(evidence) {
  const assessment = assess996PausedIntake(evidence);
  if (assessment.status !== 'C_CANDIDATE_READY_FOR_REVIEW') {
    return {status: 'EVIDENCE_INCOMPLETE', code: assessment.code,
      approved: false, executionAuthorized: false};
  }
  return {
    schema: 'ZGMINI_CONTROLLER_996_INTAKE_C_CANDIDATE_V1',
    approved: false,
    grade: 'C',
    operation: 'RECONCILE_INTAKE_PAUSED_ONLY',
    requestId: INTAKE_996.requestId,
    issueNumber: INTAKE_996.issueNumber,
    installedControllerSha: INTAKE_996.controllerSha,
    failedTargetSha: INTAKE_996.targetSha,
    installedMaintainerSha: INTAKE_996.maintainerSha,
    evidenceObservedAt: evidence.observedAt,
    evidenceSha256: Object.fromEntries(DIGEST_KEYS.map(k => [k, evidence.digests[k]])),
    effectBoundary: [
      'RESUME_EXISTING_PC_JOB_INTAKE',
      'RECONCILE_ORIGINAL_PAUSE_WINDOW_WITHOUT_DUPLICATE_EXECUTION',
      'ARCHIVE_ORIGINAL_INSTALL_LEASE_ONLY_AFTER_VERIFIED_RETURN',
    ],
    explicitlyExcluded: [
      'CONTROLLER_REINSTALL', 'FAILED_REQUEST_RETRY', 'WRITER_DB_D1_MUTATION',
      'OTHER_LEASE_REMOVAL', 'CREDENTIAL_OR_RAW_LEDGER_PUBLICATION',
    ],
    executionAuthorized: false,
  };
}
