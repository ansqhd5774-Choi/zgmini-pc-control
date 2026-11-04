// Isolated B-grade candidate. Pure scope checks and dependency-injected single attempt.
// This module makes no network or disk access and cannot publish without an approved bridge.
export const KEY = 'detail:inflation-causal-public-19:r1';
export const SOURCE_REPOSITORY = 'ansqhd5774-Choi/zgmini';
export const EXPECTED_BASE_VERSION =
  'INFL19_PRESENTATION_3a974384f3772b194849f6632c04b01ef5c1086702a0ed610b552d02cb213cf9';
export const EXPECTED_BASE_STORED_AT = 1793787605696;
export const REQUIRED_MATERIAL_IDS = Object.freeze(['1', '3']);
const METADATA = new Set(['sourceStoredAt', 'availableAt']);
const COMPARE_FIELDS = ['status', 'value', 'previousValue', 'observationDate',
  'previousObservationDate', 'availableAt', 'sourceStoredAt', 'history'];
const fail = (code) => { throw Error(code); };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function validateApproval(approval) {
  if (approval?.approved !== true || approval.schema !== 'ZGMINI_INFL19_DELTA_B_APPROVAL_V1' ||
      approval.scope !== 'PC_STORED_WTI_AND_GAS_ONLY_D1_ONE_KEY_ONCE' ||
      approval.sourceRepository !== SOURCE_REPOSITORY ||
      !/^[a-f0-9]{40}$/.test(approval.sourceSha ?? '') ||
      approval.approvedHome !== 'E:\\ZGmini\\data\\pc-writer' ||
      approval.operationalRoot !== 'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release' ||
      approval.markerPath !== 'E:\\ZGmini\\automation\\inflation19-public-delta-r1\\ONE_SHOT_STARTED.json' ||
      approval.key !== KEY || approval.expectedPublicSourceVersion !== EXPECTED_BASE_VERSION ||
      approval.expectedPublicSourceStoredAt !== EXPECTED_BASE_STORED_AT ||
      JSON.stringify(approval.expectedMaterialIds) !== JSON.stringify(REQUIRED_MATERIAL_IDS) ||
      JSON.stringify(approval.allowedMetadataOnlyIds) !== '["18"]' ||
      approval.maxPublicGets !== 2 ||
      approval.maxD1Writes !== 1 || approval.maxProviderRequests !== 0 ||
      approval.maxAutomaticRetries !== 0 || approval.allowCoreWrites !== false ||
      approval.allowDbWrites !== false || approval.allowScoreWrites !== false ||
      approval.allowSchedulerWrites !== false || approval.allowDirectDeploy !== false)
    fail('INFL19_DELTA_APPROVAL_DENIED');
  return approval;
}

export function classifyDelta(pc, published, {validate, approval} = {}) {
  validateApproval(approval);
  if (typeof validate !== 'function') fail('INFL19_DELTA_VALIDATOR_REQUIRED');
  try { validate(pc); validate(published); }
  catch { fail('INFL19_DELTA_CONTRACT_DENIED'); }
  if (pc.status !== 'READY' || published.status !== 'READY' ||
      pc.score !== null || published.score !== null ||
      pc.indicators?.length !== 19 || published.indicators?.length !== 19)
    fail('INFL19_DELTA_19_READY_REQUIRED');
  if (published.sourceVersion !== approval.expectedPublicSourceVersion ||
      published.sourceStoredAt !== approval.expectedPublicSourceStoredAt)
    fail('INFL19_DELTA_PUBLIC_BASE_MOVED');
  if (!/^INFL19_PRESENTATION_[a-f0-9]{64}$/.test(pc.sourceVersion ?? '') ||
      !Number.isSafeInteger(pc.sourceStoredAt) ||
      pc.sourceStoredAt <= published.sourceStoredAt)
    fail('INFL19_DELTA_PC_CHECKPOINT_DENIED');
  if (pc.sourceVersion === published.sourceVersion)
    fail('INFL19_DELTA_SOURCE_VERSION_COLLISION');

  const changedMaterial = [], changedMetadata = [];
  for (let i = 0; i < 19; i++) {
    const x = pc.indicators[i], y = published.indicators[i];
    if (x.id !== y.id || x.series !== y.series || x.unit !== y.unit ||
        x.status !== 'READY' || y.status !== 'READY')
      fail('INFL19_DELTA_IDENTITY_DENIED');
    const fields = COMPARE_FIELDS.filter(f => !same(x[f], y[f]));
    if (fields.some(f => !METADATA.has(f))) changedMaterial.push(x.id);
    else if (fields.length) changedMetadata.push(x.id);
  }
  if (JSON.stringify(changedMaterial) !== JSON.stringify(REQUIRED_MATERIAL_IDS))
    fail('INFL19_DELTA_REQUIRED_MATERIAL_SCOPE_DENIED');
  if (changedMetadata.some(id => id !== '18'))
    fail('INFL19_DELTA_OTHER_METADATA_SCOPE_DENIED');
  const wti = pc.indicators.find(x => x.id === '1');
  const gas = pc.indicators.find(x => x.id === '3');
  if (wti?.observationDate < '2026-10-01' ||
      gas?.observationDate <= '2026-10-27')
    fail('INFL19_DELTA_RELEASED_GAS_NOT_COLLECTED');
  return Object.freeze({
    status: 'PASS_DRY_RUN', code: 'INFL19_DELTA_SCOPE_VERIFIED',
    materialIds: changedMaterial, metadataOnlyIds: changedMetadata,
    key: KEY, sourceVersion: pc.sourceVersion,
    sourceStoredAt: pc.sourceStoredAt, providerCalls: 0,
    coreWrites: 0, dbWrites: 0, d1Writes: 0, schedulerWrites: 0,
  });
}

// deps: verifyProvenance, previewStored, readPublic, validate, reserveOnce, writePinnedPayload.
// Only the approved CAS writer must implement writePinnedPayload; never reconstruct a second D1 writer.
export async function runScopedOnce({approval, deps, dryRun = true} = {}) {
  validateApproval(approval);
  await deps.verifyProvenance(approval);
  const preview = await deps.previewStored();
  if (preview?.ready !== 19 || preview.status === 'PENDING' || preview.payload?.status !== 'READY')
    fail('INFL19_DELTA_PC_PREVIEW_NOT_READY');
  // Snapshot once. An approved bridge publishes exactly this immutable input, not a later re-preview.
  const pinned = structuredClone(preview.payload);
  const published = await deps.readPublic();
  const scope = classifyDelta(pinned, published, {validate:deps.validate, approval});
  if (dryRun) return scope;
  await deps.verifyD1Binding(approval);
  await deps.reserveOnce(approval);
  try {
    const result = await deps.writePinnedPayload(pinned);
    if (!['READBACK_VERIFIED', 'ALREADY_STORED'].includes(result?.status) ||
        result?.key !== KEY) fail('INFL19_DELTA_D1_READBACK_UNVERIFIED');
    const after = await deps.readPublic();
    if (!same(after, pinned)) fail('INFL19_DELTA_PUBLIC_GET_MISMATCH');
    return {...scope, status: 'PASS', code: 'INFL19_DELTA_PUBLIC_VERIFIED',
      d1Writes: result.status === 'READBACK_VERIFIED' ? 1 : 0,
      d1Readback: result.status};
  } catch(e) {
    // Marker has been consumed: no retry. Actual D1 result may be unknown.
    return {...scope, status: 'STATE_UNKNOWN',
      code: /^[A-Z0-9_]{4,100}$/.test(e?.message ?? '') ? e.message : 'INFL19_DELTA_WRITE_OUTCOME_UNKNOWN',
      d1Writes: null, d1Readback: null};
  }
}
