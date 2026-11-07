import assert from 'node:assert/strict';
import test from 'node:test';
import { assessD30SourceInstall, D30_INSTALL_CONTRACT } from '../calendar-source-d30/contract.mjs';

const originalBytes = Object.fromEntries(D30_INSTALL_CONTRACT.operationalFiles.map(file =>
  [file.path, file.baseSha256]));
// #663: this PC file has a local overlay absent from the public ce9 base.
const COLLECTOR = 'scripts/pc-writer/earnings-api-local.mjs';
const MERGED = '9'.repeat(64); // synthetic digest: never a real approved merge
originalBytes[COLLECTOR] = 'f80bced7233ba9da5511a73bf324ae73a4a7c505ecf1ce9f690cb412b98b1b62';

const proof = {
  runtimeSourceVerified: true,
  evidenceLevel: 'LIVE_CORE_EXECUTION_VERIFIED',
  sourceRoot: 'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  runtimeSourceSha: 'a'.repeat(40),
  evidenceIssue: 999,
  evidenceRequestId: 'fixture-not-a-real-pc-result',
};

test('three-file install target pins the post-race-fix collector exactly', () => {
  const [calendar, collector, writer] = D30_INSTALL_CONTRACT.operationalFiles;
  assert.equal(D30_INSTALL_CONTRACT.operationalFiles.length, 3);
  assert.equal(calendar.targetBlob, '4530407da60f17373906222686c7c2351730f1ae');
  assert.equal(collector.targetBlob, '4abf15cf8ef0763b0107e921d5fe36acc22e1e15');
  assert.equal(collector.targetSha256, 'd3a44b963b2396a002e317b4583ca2546e6409aacba8162b089b653aef9bec4a');
  assert.equal(collector.baseSha256, '5d71670fa20ee7525caf0c55b18aafa322258f155e97f042f54f7c2581755958');
  assert.equal(writer.targetBlob, '0d3c0a18863f79304fceb5fea6367bec4ecd186a');
});

function fixture() {
  return {
    activeCore: { ...proof },
    installedFileHashes: { ...originalBytes },
    approvedBManifest: {
      scope: D30_INSTALL_CONTRACT.scope,
      sourceHead: D30_INSTALL_CONTRACT.sourceHead,
      sourceRoot: proof.sourceRoot,
      beforeSourceSha: proof.runtimeSourceSha,
      approvalEvidence: 'fixture-not-a-real-approval',
      files: D30_INSTALL_CONTRACT.operationalFiles.map(file => ({
        path: file.path,
        beforeSha256: originalBytes[file.path],
        targetBlob: file.targetBlob,
        targetSha256: file.targetSha256,
        afterSha256: file.path === COLLECTOR ? MERGED : file.targetSha256,
        ...(file.path === COLLECTOR ? {mergePreview: {
          status: 'CLEAN_PRESERVED_VERIFIED',
          beforeSha256: originalBytes[file.path],
          baseSha256: file.baseSha256,
          candidateSha256: file.targetSha256,
          afterSha256: MERGED,
          conflictCount: 0,
          preservedVerified: true,
          sourceWrites: 0,
          evidenceIssue: 999,
          evidenceRequestId: 'fixture-only-merge-preview',
        }} : {}),
      })),
    },
  };
}

test('active Core proof is mandatory: previous configured d7bc is not live proof', () => {
  const input = fixture();
  delete input.activeCore;
  assert.equal(assessD30SourceInstall(input).code, 'ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED');
});

test('filesystem candidate inventory is not proof of executed Core origin', () => {
  const input = fixture();
  input.activeCore.evidenceLevel = 'FILESYSTEM_AND_GIT_READONLY_NOT_CORE_RUNTIME';
  assert.equal(assessD30SourceInstall(input).code, 'ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED');
});

test('separately proven idle Core source is accepted, not mislabeled as live', () => {
  const input = fixture();
  const core = input.activeCore;
  core.runtimeSourceVerified = false;
  core.evidenceLevel = 'REGISTERED_CORE_SOURCE_PROVENANCE_VERIFIED';
  core.operationalSourceSha = core.runtimeSourceSha;
  delete core.runtimeSourceSha;
  Object.assign(core, {gitVerified:true,taskLauncherSourceVerified:true,
    configSourceMatchesHead:true,writerCheckpointMatchesHead:true,trackedDirty:false});
  assert.equal(assessD30SourceInstall(input).status,'READY_FOR_SEPARATE_APPROVED_B_INSTALL');
  core.taskLauncherSourceVerified = false;
  assert.equal(assessD30SourceInstall(input).code,'ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED');
});

test('all original Windows file SHA256 must be known', () => {
  const input = fixture();
  delete input.installedFileHashes[D30_INSTALL_CONTRACT.operationalFiles[0].path];
  assert.equal(assessD30SourceInstall(input).code, 'ER1_D30_INSTALLED_BYTES_UNVERIFIED');
});

test('old #511 overlay cannot be silently overwritten', () => {
  const input = fixture();
  input.installedFileHashes['scripts/pc-writer/release-calendar.mjs'] = 'a'.repeat(64);
  assert.equal(assessD30SourceInstall(input).code, 'ER1_D30_FILE_SCOPE_OR_DIGEST_MISMATCH');
});

test('PR candidate digest cannot masquerade as approved merged after SHA', () => {
  const input = fixture();
  const collector = input.approvedBManifest.files[1];
  collector.afterSha256 = collector.targetSha256;
  assert.equal(assessD30SourceInstall(input).code,'ER1_D30_MERGE_PREVIEW_UNVERIFIED');
  collector.afterSha256 = MERGED;
  delete collector.mergePreview;
  assert.equal(assessD30SourceInstall(input).code,'ER1_D30_MERGE_PREVIEW_UNVERIFIED');
});

test('conflicting or unpreserved read-only merge is rejected', () => {
  const input = fixture();
  const preview = input.approvedBManifest.files[1].mergePreview;
  preview.conflictCount = 1;
  assert.equal(assessD30SourceInstall(input).code,'ER1_D30_MERGE_PREVIEW_UNVERIFIED');
  preview.conflictCount = 0;
  preview.preservedVerified = false;
  assert.equal(assessD30SourceInstall(input).code,'ER1_D30_MERGE_PREVIEW_UNVERIFIED');
});

test('test source files and any fourth operational file are excluded', () => {
  const input = fixture();
  input.approvedBManifest.files.push({
    path: 'tests/earnings-api-forward30.test.mjs', beforeSha256: '1'.repeat(64),
    targetBlob: 'a'.repeat(40), targetSha256: '2'.repeat(64),
  });
  assert.equal(assessD30SourceInstall(input).code,
    'ER1_D30_APPROVED_B_MANIFEST_MISSING_OR_MISMATCHED');
});

test('wrong target Git blob is rejected', () => {
  const input = fixture();
  input.approvedBManifest.files[0].targetBlob = 'a'.repeat(40);
  assert.equal(assessD30SourceInstall(input).code, 'ER1_D30_FILE_SCOPE_OR_DIGEST_MISMATCH');
});

test('wrong source HEAD or old live SHA is rejected', () => {
  const input = fixture();
  input.approvedBManifest.sourceHead = 'f'.repeat(40);
  assert.equal(assessD30SourceInstall(input).code,
    'ER1_D30_APPROVED_B_MANIFEST_MISSING_OR_MISMATCHED');
  input.approvedBManifest.sourceHead = D30_INSTALL_CONTRACT.sourceHead;
  input.approvedBManifest.beforeSourceSha = 'b'.repeat(40);
  assert.equal(assessD30SourceInstall(input).code,
    'ER1_D30_APPROVED_B_MANIFEST_MISSING_OR_MISMATCHED');
});

test('exact approved fixture permits a separate B install, without executing it', () => {
  const result = assessD30SourceInstall(fixture());
  assert.equal(result.status, 'READY_FOR_SEPARATE_APPROVED_B_INSTALL');
  assert.equal(result.operationalFileCount, 3);
});
