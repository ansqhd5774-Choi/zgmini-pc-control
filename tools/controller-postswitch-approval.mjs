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

export function validatePostSwitchApproval(approval, {requestId,sourceSha,evidence} = {}) {
  need(keysAre(approval, ['schema','approved','operation','requestId','issueNumber',
    'sourceSha','targetControllerSha','installedShaBefore','evidenceHashes',
    'toolHashes','postcheck','expectedBacklogIssues']),
  'POSTSWITCH_APPROVAL_FIELDS_INVALID');
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
