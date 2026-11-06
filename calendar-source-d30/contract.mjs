// Source-only B install preflight for the ER1 D+30 calendar collector.
// This file never reads/writes the PC, calls a provider, or performs an install.
// A PASS from this pure function is a manifest consistency check, NOT a live install.

export const D30_INSTALL_CONTRACT = Object.freeze({
  scope: 'ER1_D30_SOURCE_3FILE_ONLY',
  sourceRepository: 'ansqhd5774-Choi/zgmini',
  sourcePullRequest: 1000,
  sourceHead: 'f85ae138a25a20565d3f0ca057c4ae373f940b47',
  // Historical configuration; not an assertion about live PC source.
  historicConfiguredCoreSha: 'd7bc4948573843766ad82c72ff392220178c36a3',
  historicPublicSourceSha: 'ce9bccd8b38939b204e8f836a50ae362960eb7af',
  existingOverlayIssue: 511,
  operationalFiles: Object.freeze([
    Object.freeze({
      path: 'lib/earnings-api-calendar.mjs',
      targetBlob: '4530407da60f17373906222686c7c2351730f1ae',
      targetSha256: 'e48d4ea5da65d2b72b070e54bb41103486e730c38b8c040215388a9b57af39cb',
    }),
    Object.freeze({
      path: 'scripts/pc-writer/earnings-api-local.mjs',
      targetBlob: '6dbc33113574f1b2f3253f6a095626caa6dd6423',
      targetSha256: '23468a6efcd95293dd499518ab23c5460b92e5660770d80e052b868ed194fc93',
    }),
    Object.freeze({
      path: 'scripts/pc-writer/release-calendar.mjs',
      targetBlob: '0d3c0a18863f79304fceb5fea6367bec4ecd186a',
      targetSha256: '1f7186cad2240839a432bd6ac9351c83762334b38a988d27d971cb4ffe647f1b',
    }),
  ]),
});

const digest = /^[a-f0-9]{64}$/;
const sha = /^[a-f0-9]{40}$/;
const exactKeys = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((x, i) => x === expected[i]);

/**
 * Strict, side-effect-free contract check. Inputs must originate from independently
 * verified Windows A-grade evidence and approved B maintenance records.
 * Missing runtime/old-byte evidence always means UNKNOWN, not success.
 *
 * activeCore: { runtimeSourceVerified:true, evidenceLevel:'LIVE_CORE_EXECUTION_VERIFIED',
 *   sourceRoot, runtimeSourceSha, evidenceIssue, evidenceRequestId }
 * installedFileHashes: { [relativePath]: currently installed sha256 }
 * approvedBManifest: { scope, sourceHead, sourceRoot, beforeSourceSha,
 *   files:[ {path,beforeSha256,targetBlob,targetSha256} ], approvalEvidence }
 */
export function assessD30SourceInstall({ activeCore, installedFileHashes, approvedBManifest } = {}) {
  const reject = (code, details) => ({ status: 'BLOCKED', code, details });
  const targetFiles = D30_INSTALL_CONTRACT.operationalFiles;
  const paths = targetFiles.map(({ path }) => path);

  if (!activeCore || activeCore.runtimeSourceVerified !== true ||
      activeCore.evidenceLevel !== 'LIVE_CORE_EXECUTION_VERIFIED' ||
      typeof activeCore.sourceRoot !== 'string' || !activeCore.sourceRoot.trim() ||
      !sha.test(activeCore.runtimeSourceSha || '') ||
      !Number.isSafeInteger(activeCore.evidenceIssue) ||
      !String(activeCore.evidenceRequestId || '').trim()) {
    return reject('ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED',
      'Actual active Core source root/SHA and A-grade live evidence are UNKNOWN. Historic config SHA is insufficient.');
  }

  if (!installedFileHashes || typeof installedFileHashes !== 'object' ||
      Array.isArray(installedFileHashes) ||
      !exactKeys(Object.keys(installedFileHashes).sort(), [...paths].sort()) ||
      !paths.every(path => digest.test(installedFileHashes[path] || ''))) {
    return reject('ER1_D30_INSTALLED_BYTES_UNVERIFIED',
      'Read-only exact SHA256 of all three currently installed PC files is required.');
  }

  if (!approvedBManifest || approvedBManifest.scope !== D30_INSTALL_CONTRACT.scope ||
      approvedBManifest.sourceHead !== D30_INSTALL_CONTRACT.sourceHead ||
      approvedBManifest.sourceRoot !== activeCore.sourceRoot ||
      approvedBManifest.beforeSourceSha !== activeCore.runtimeSourceSha ||
      typeof approvedBManifest.approvalEvidence !== 'string' ||
      !approvedBManifest.approvalEvidence.trim() ||
      !Array.isArray(approvedBManifest.files) ||
      approvedBManifest.files.length !== targetFiles.length) {
    return reject('ER1_D30_APPROVED_B_MANIFEST_MISSING_OR_MISMATCHED',
      'Exactly scoped, independently approved B manifest is required; no HEAD-wide install.');
  }

  if (!exactKeys(approvedBManifest.files.map(({ path }) => path), paths) ||
      approvedBManifest.files.some((file, i) =>
        file.beforeSha256 !== installedFileHashes[file.path] ||
        file.targetBlob !== targetFiles[i].targetBlob ||
        file.targetSha256 !== targetFiles[i].targetSha256)) {
    return reject('ER1_D30_FILE_SCOPE_OR_DIGEST_MISMATCH',
      'Manifest must include exactly the three operational files, each with verified before/target digests.');
  }

  return {
    status: 'READY_FOR_SEPARATE_APPROVED_B_INSTALL',
    scope: D30_INSTALL_CONTRACT.scope,
    sourceHead: D30_INSTALL_CONTRACT.sourceHead,
    operationalFileCount: 3,
    note: 'Pure preflight only; real installation, rollback protection, and post-install validation remain separate.',
  };
}
