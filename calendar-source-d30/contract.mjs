// Source-only B install preflight for the ER1 D+30 calendar collector.
// This file never reads/writes the PC, calls a provider, or performs an install.
// A PASS from this pure function is a manifest consistency check, NOT a live install.

export const D30_INSTALL_CONTRACT = Object.freeze({
  scope: 'ER1_D30_SOURCE_3FILE_ONLY',
  sourceRepository: 'ansqhd5774-Choi/zgmini',
  sourcePullRequest: 1000,
  sourceHead: '57f5c72ff0d5f05dee1c76fd3ba7eb904e7adb2a',
  // Historical configuration; not an assertion about live PC source.
  historicConfiguredCoreSha: 'd7bc4948573843766ad82c72ff392220178c36a3',
  historicPublicSourceSha: 'ce9bccd8b38939b204e8f836a50ae362960eb7af',
  existingOverlayIssue: 511,
  operationalFiles: Object.freeze([
    Object.freeze({
      path: 'lib/earnings-api-calendar.mjs',
      baseSha256: 'e5c0fdfaddd8048fcb7e79c40f9d39185c75efbe73e7f6b62752073f14b23b3f',
      targetBlob: '4530407da60f17373906222686c7c2351730f1ae',
      targetSha256: 'e48d4ea5da65d2b72b070e54bb41103486e730c38b8c040215388a9b57af39cb',
    }),
    Object.freeze({
      path: 'scripts/pc-writer/earnings-api-local.mjs',
      baseSha256: '5d71670fa20ee7525caf0c55b18aafa322258f155e97f042f54f7c2581755958',
      targetBlob: '4abf15cf8ef0763b0107e921d5fe36acc22e1e15',
      targetSha256: 'd3a44b963b2396a002e317b4583ca2546e6409aacba8162b089b653aef9bec4a',
    }),
    Object.freeze({
      path: 'scripts/pc-writer/release-calendar.mjs',
      baseSha256: '3fa8e1039fcedd3b2fb07b888996f845c6b7102505acdba7608818cb56238871',
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

// An idle Core has no live process to attest. Accept a separate, explicitly
// corroborated registered-source identity; never relabel it as a live SHA.
export function coreSourceIdentity(activeCore) {
  if (!activeCore || typeof activeCore.sourceRoot !== 'string' ||
      !activeCore.sourceRoot.trim() ||
      !Number.isSafeInteger(activeCore.evidenceIssue) || activeCore.evidenceIssue <= 0 ||
      !String(activeCore.evidenceRequestId || '').trim()) return null;
  if (activeCore.runtimeSourceVerified === true &&
      activeCore.evidenceLevel === 'LIVE_CORE_EXECUTION_VERIFIED' &&
      sha.test(activeCore.runtimeSourceSha || '')) return activeCore.runtimeSourceSha;
  if (activeCore.runtimeSourceVerified === false &&
      activeCore.evidenceLevel === 'REGISTERED_CORE_SOURCE_PROVENANCE_VERIFIED' &&
      sha.test(activeCore.operationalSourceSha || '') &&
      activeCore.gitVerified === true &&
      activeCore.taskLauncherSourceVerified === true &&
      activeCore.configSourceMatchesHead === true &&
      // A last-run checkpoint records a PAST execution. A stale historical
      // SHA does not invalidate the independently verified registered source.
      (activeCore.trackedDirty === false ||
        (activeCore.trackedDirty === true &&
          activeCore.sourceTrackedDirtyScope === 'PINNED_TARGET_3FILES' &&
          activeCore.pinnedOverlayVerified === true)))
    return activeCore.operationalSourceSha;
  return null;
}

/**
 * Strict, side-effect-free contract check. Inputs must originate from independently
 * verified Windows A-grade evidence and approved B maintenance records.
 * Missing corroborated source/old-byte evidence always means UNKNOWN, not success.
 *
 * activeCore: live Core proof OR independently corroborated idle registered
 *   source provenance (see coreSourceIdentity); neither can be inferred from HEAD.
 * installedFileHashes: { [relativePath]: currently installed sha256 }
 * approvedBManifest: { scope, sourceHead, sourceRoot, beforeSourceSha,
 *   files:[ {path,beforeSha256,targetBlob,targetSha256,afterSha256,
 *             mergePreview?} ], approvalEvidence }
 * Each non-base file requires a separate read-only 3-way merge preview on the
 * Windows preimage, public base and PR candidate, with verified preservation.
 */
export function assessD30SourceInstall({ activeCore, installedFileHashes, approvedBManifest } = {}) {
  const reject = (code, details) => ({ status: 'BLOCKED', code, details });
  const targetFiles = D30_INSTALL_CONTRACT.operationalFiles;
  const paths = targetFiles.map(({ path }) => path);

  const operationalSourceSha = coreSourceIdentity(activeCore);
  if (!operationalSourceSha) {
    return reject('ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED',
      'Live Core origin or corroborated idle registered-source origin is UNKNOWN. Filesystem HEAD alone is insufficient.');
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
      approvedBManifest.beforeSourceSha !== operationalSourceSha ||
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

  for (const [i, file] of approvedBManifest.files.entries()) {
    const pinned = targetFiles[i];
    if (!digest.test(file.afterSha256 || '')) {
      return reject('ER1_D30_APPROVED_AFTER_BYTES_MISSING',
        'Each exact after SHA256 must be separately approved, never inferred from a candidate Git blob.');
    }
    if (file.beforeSha256 === pinned.baseSha256) {
      if (file.afterSha256 !== pinned.targetSha256 || file.mergePreview != null) {
        return reject('ER1_D30_UNNECESSARY_OR_INCORRECT_MERGE',
          'Unmodified base requires exact candidate bytes, with no fictitious merge.');
      }
      continue;
    }
    const preview = file.mergePreview;
    if (!preview || preview.status !== 'CLEAN_PRESERVED_VERIFIED' ||
        preview.beforeSha256 !== file.beforeSha256 ||
        preview.baseSha256 !== pinned.baseSha256 ||
        preview.candidateSha256 !== pinned.targetSha256 ||
        preview.afterSha256 !== file.afterSha256 ||
        preview.conflictCount !== 0 || preview.preservedVerified !== true ||
        preview.sourceWrites !== 0 ||
        !Number.isSafeInteger(preview.evidenceIssue) || preview.evidenceIssue <= 0 ||
        !String(preview.evidenceRequestId || '').trim()) {
      return reject('ER1_D30_MERGE_PREVIEW_UNVERIFIED',
        'PC overlays require independently verified, non-conflicting read-only 3-way merge bytes.');
    }
  }

  return {
    status: 'READY_FOR_SEPARATE_APPROVED_B_INSTALL',
    scope: D30_INSTALL_CONTRACT.scope,
    sourceHead: D30_INSTALL_CONTRACT.sourceHead,
    operationalFileCount: 3,
    note: 'Pure preflight only; real installation, rollback protection, and post-install validation remain separate.',
  };
}
