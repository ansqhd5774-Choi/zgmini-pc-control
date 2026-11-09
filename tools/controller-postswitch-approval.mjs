// Narrow, immutable C-grade manifest for the already switched #917 incident.
// Validation is pure; an "approved" JSON document is not an execution channel.
const fail = code => {throw Object.assign(new Error(code), {code});};
const need = (ok, code) => {if (!ok) fail(code);};
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const sha40 = x => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x);
const sha64 = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const keysAre = (value, keys) => object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));

export const INCIDENT = Object.freeze({
  requestId:'pc-update-877e10c8-8580-4095-a675-bef9ec032193',
  issueNumber:917,
  oldSha:'c09bf6a6f66f229016135020d6ba553ba9a94676',
  newSha:'badad9124157879d7a645b64f2768113d632355b',
});

export const MATERIAL_KEYS = Object.freeze([
  'ledger','owner','marker','currentHost','snapshotHost','protectedBefore','backlog',
]);
export const TOOL_PATHS = Object.freeze([
  'tools/controller-postswitch-launcher.mjs',
  'tools/controller-postswitch-approval.mjs',
  'tools/controller-postswitch-operator.mjs',
  'tools/controller-postswitch-windows.mjs',
  'tools/controller-postswitch-evidence.mjs',
  'tools/controller-postswitch-preflight.mjs',
  'tools/controller-postswitch-backlog.mjs',
  'tools/controller-postswitch-postcheck.mjs',
  'tools/controller-postswitch-reconciliation.mjs',
  'tools/controller-postswitch-state.mjs',
  'tools/update.mjs',
  'tools/maintenance-apply.mjs',
  'tools/maintenance-contract.mjs',
  'tools/maintenance-lock.mjs',
  'tools/source-bundle-register.mjs',
]);


// This is incident-specific evidence, not an implicit recovery authorization.
// The direct C manifest must explicitly consent to these exact observed bytes.
export const WRITER_TRANSITION = Object.freeze({
  baselineConfigSha256:'a648e80310f50cf68475195e21a750647629c48b584333520260827c6ff5a037',
  priorConfigSha256:'e3e5b6de45cdb63de4056a56784e46c9b0fb8546462089cb5b98c8d42496110c',
  currentConfigSha256:'05eeb13d9183480b89413557c7e65c57d818a5d8fc5eaa88261e55cfc409c57a',
  priorApprovedSourceSha:'70d2d1dbd8180255133bdd7fc925ae07bb8d6cc9',
  approvedSourceSha:'75f73d8613550221f8e80b304d67b8b10a228e7f',
  priorWriterBResultBlobSha:'e07389fb660359352109146175eb8fa3f7ae0798',
  priorWriterAResultBlobSha:'6baf4fd2d8d6067bc178b7f79a95c4381771c512',
  writerBResultBlobSha:'6315e35e980a58a55a6dd8ae11ca53c8e945f42f',
  writerAResultBlobSha:'65e7edf335d9492058e5e8d183d9927c9c5ba3c0',
});

export function validatePostSwitchApproval(approval, {requestId,sourceSha,evidence} = {}) {
  const transitionRequested = Object.hasOwn(approval ?? {}, 'writerTransition');
  need(keysAre(approval, ['schema','approved','operation','requestId','issueNumber',
    'sourceSha','targetControllerSha','installedShaBefore','evidenceHashes',
    'toolHashes','postcheck','expectedBacklogIssues',
    ...(transitionRequested ? ['writerTransition'] : [])]),
  'POSTSWITCH_APPROVAL_FIELDS_INVALID');
  if (transitionRequested) {
    need(keysAre(approval.writerTransition, Object.keys(WRITER_TRANSITION)) &&
      Object.entries(WRITER_TRANSITION).every(([key,value])=>
        approval.writerTransition[key]===value),
    'POSTSWITCH_APPROVED_WRITER_TRANSITION_MISMATCH');
    need(evidence?.checks?.PROTECTION_UNCHANGED === false &&
      evidence?.checks?.PROTECTION_CONTRACT_VERIFIED === true,
    'POSTSWITCH_APPROVED_WRITER_TRANSITION_UNVERIFIED');
  } else {
    need(evidence?.checks?.PROTECTION_UNCHANGED === true,
      'POSTSWITCH_APPROVAL_PROTECTION_UNVERIFIED');
  }
  need(approval.schema === 'ZGMINI_PC_POSTSWITCH_RECOVERY_APPROVAL_V1' &&
    approval.approved === true && approval.operation === 'FORWARD_POSTSWITCH_917' &&
    approval.requestId === INCIDENT.requestId &&
    approval.issueNumber === INCIDENT.issueNumber &&
    approval.installedShaBefore === INCIDENT.oldSha &&
    approval.targetControllerSha === INCIDENT.newSha &&
    approval.requestId === requestId && sha40(approval.sourceSha) &&
    approval.sourceSha === sourceSha, 'POSTSWITCH_APPROVAL_IDENTITY_INVALID');
  need(keysAre(approval.evidenceHashes,MATERIAL_KEYS) &&
    MATERIAL_KEYS.every(key=>sha64(approval.evidenceHashes[key]) &&
      approval.evidenceHashes[key] === evidence?.materialHashes?.[key]),
  'POSTSWITCH_APPROVAL_PREIMAGE_DRIFT');
  need(keysAre(approval.toolHashes,TOOL_PATHS) &&
    TOOL_PATHS.every(key=>sha64(approval.toolHashes[key])),
  'POSTSWITCH_APPROVAL_TOOLSET_INVALID');
  need(Array.isArray(approval.expectedBacklogIssues) &&
    approval.expectedBacklogIssues.length===1 &&
    approval.expectedBacklogIssues[0]===919,
  'POSTSWITCH_APPROVAL_BACKLOG_SCOPE_INVALID');
  const post=approval.postcheck;
  need(keysAre(post,['operation','sourceRepository','sourceBranch','sourceSha']) &&
    post.operation === 'core-status' &&
    post.sourceRepository === 'ansqhd5774-Choi/zgmini' &&
    post.sourceBranch === 'main' && sha40(post.sourceSha),
  'POSTSWITCH_APPROVAL_POSTCHECK_INVALID');
  return approval;
}
