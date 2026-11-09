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

// Later B-grade Writer overlays are separate from the historical #917 C-grade
// approval. Recording them does not authorize a new protection exception or a
// Windows recovery. In particular, the 4ec config digest has no independent
// historical A-grade observation; it may only be calculated from live bytes.
// The final 0be... config digest was observed after #1195 by read-only #1202.
export const WRITER_FOLLOWUP_CANDIDATE = Object.freeze({
  scope:'READONLY_SOURCE_ONLY_CANDIDATE_NOT_C_APPROVAL',
  sourceSequence:Object.freeze([
    '75f73d8613550221f8e80b304d67b8b10a228e7f',
    '4ec0b8c197627ebdb316be8df291e30d7e435784',
    '144f3b8f673cc3d18f004ddd65f6920d450f0ea6',
    '48d3478030590ca63aaab2435e88c896608c70d3',
    'de81749f83c086f5cb0cad7ed1d5cc958de19280',
  ]),
  configShaAnchors:Object.freeze({
    prior70:'e3e5b6de45cdb63de4056a56784e46c9b0fb8546462089cb5b98c8d42496110c',
    at75:'05eeb13d9183480b89413557c7e65c57d818a5d8fc5eaa88261e55cfc409c57a',
    at4ec:null, // DERIVED_ONLY: never report this as observed A-grade proof.
    at144:'9e9bbe92ee7a2e368c08ec5ddb21bdb7fc782613a05d610da963f7278c75a404',
    at48:'59777810c0949036f03777b7ea5561bd72bf0697cdaba65e393af49bf67356dc',
    atDe:'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453',
  }),
  writerB:Object.freeze([
    Object.freeze({
      path:'results/writer-b-source-install-a861da80-8765-4e8c-b5a0-1824764284e2.json',
      blobSha:'0d79ca8a7dd75740894df8576ca266e599df8c5d',
      rawSha256:'151a27ae60b86c6f89144ab75168c06cf9547085c8905c27dd537a87c0ee6339',
      requestId:'a861da80-8765-4e8c-b5a0-1824764284e2',
      baseHead:'75f73d8613550221f8e80b304d67b8b10a228e7f',
      sourceSha:'4ec0b8c197627ebdb316be8df291e30d7e435784',
      candidateSourceSha:'27c02d9b254e92af21b2a5b92a4c0bb152bb5713',
      manifestSha256:'3452198846df9e4bb6f2299e3f4be64691ec87d4c9801121db130482c866904c',
      changedPath:'scripts/pc-writer/build-asset-r10-release.mjs',
    }),
    Object.freeze({
      path:'results/writer-b-source-install-b86e398c-59dd-485e-a3b1-2596fb5466d2.json',
      blobSha:'77d9eb6965a272dc797e7052b62a8e172df5e302',
      rawSha256:'bc73d77b72c2d11cb0ba8806adc369100087bfb883d6e9894f806e905f1941a7',
      requestId:'b86e398c-59dd-485e-a3b1-2596fb5466d2',
      baseHead:'4ec0b8c197627ebdb316be8df291e30d7e435784',
      sourceSha:'144f3b8f673cc3d18f004ddd65f6920d450f0ea6',
      candidateSourceSha:'27c02d9b254e92af21b2a5b92a4c0bb152bb5713',
      manifestSha256:'88c28ab0fbe7ae4683f76a94af907df5ef591623bdec37b01a670914cfa88703',
      changedPath:'scripts/pc-writer/run-local.mjs',
    }),
    Object.freeze({
      path:'results/writer-b-source-install-d9cc77ff-acb0-44e0-9f2b-1659efead888.json',
      blobSha:'c594b77b96d8b822cce38a36d36bfa562e123be1',
      rawSha256:'425d4a06585694c94f612af769e6341153dba9c1e7f9718f279c7111b98a2d50',
      requestId:'d9cc77ff-acb0-44e0-9f2b-1659efead888',
      baseHead:'144f3b8f673cc3d18f004ddd65f6920d450f0ea6',
      sourceSha:'48d3478030590ca63aaab2435e88c896608c70d3',
      candidateSourceSha:'66cb996994dbece69f64bb2de51ef6e4c0a874de',
      manifestSha256:'0f0e02409e9c206f8c35e1efe7790ce1a80a3e3eb0bcf8bbf4f8931a1587a57c',
      changedPath:'scripts/pc-writer/run-local.mjs',
    }),
    Object.freeze({
      path:'results/writer-b-source-install-f18e341c-e37e-4975-8a1b-2fa9818b9fae.json',
      blobSha:'e53ccadeecd51929eaa1db38f161c50b03811f06',
      rawSha256:'bc03c09f451ea151a22be22cc7b5851c7984754899398a321c7036dbf02a59ad',
      requestId:'f18e341c-e37e-4975-8a1b-2fa9818b9fae',
      baseHead:'48d3478030590ca63aaab2435e88c896608c70d3',
      sourceSha:'de81749f83c086f5cb0cad7ed1d5cc958de19280',
      candidateSourceSha:'b37c7c029d36c6d29c50a5173018836918db5c78',
      manifestSha256:'dc6b0707ae4778ecf99cdcb186a96a0c64aac9441fd42ec09f509640ee1f325c',
      changedPaths:Object.freeze([
        'lib/market-score/employment-r6-formula.mjs',
        'lib/market-score/employment-r6-feature-engine.mjs',
        'lib/market-score/employment-r6-one-year-read-model.mjs',
        'scripts/pc-writer/employment-r6-one-year-stage.mjs',
        'worker/employment-r6-public-display.mjs',
      ]),
    }),
  ]),
  aObservations:Object.freeze({
    at144:Object.freeze({
      path:'results/42709978452-1-seat-6.json',
      blobSha:'01c74375290e3d6b0727a88d6c44a3b89d56da12',
      rawSha256:'eae8ba147d1e2ff5eea078b9728b5602877dea22f46dd62f0482915e53c9d799',
      sourceSha:'144f3b8f673cc3d18f004ddd65f6920d450f0ea6',
      checkpointSha:'4ec0b8c197627ebdb316be8df291e30d7e435784',
      status:'PASS',code:'WRITER_APPROVED_PREIMAGE_READONLY',
      evidenceLevel:'FIXED_CHECKOUT_NOT_LIVE_CORE_PROCESS',
    }),
    at48Uncorroborated:Object.freeze({
      path:'results/42712917820-1-seat-1.json',
      blobSha:'19b1831712a2db5837b54401cc8995e389ae7a1a',
      rawSha256:'75455b80247383d886d0832301f2ac25ac19749a5ac500a29bc24dd9ca9aef4c',
      status:'STATE_UNKNOWN',code:'WRITER_PREIMAGE_CHECKOUT_NOT_CORROBORATED',
    }),
    at48HistoricalOnly:Object.freeze({
      path:'results/42714326288-1-seat-6.json',
      blobSha:'b5a7fb1999fd4daf80178c4093fe58f79cd8b270',
      rawSha256:'c3d6d41cc29f27f5d360995435de9ec8eef4bcdb168a646f8edb6248390b761f',
      sourceSha:'48d3478030590ca63aaab2435e88c896608c70d3',
      status:'PASS',code:'PC_SOURCE_READONLY_DIAGNOSIS',
      evidenceLevel:'HISTORICAL_CHECKOUT_NOT_CORE_RUNTIME',
    }),
    atDeReadOnly:Object.freeze({
      issueNumber:1202,
      path:'results/42722662159-1-seat-2.json',
      blobSha:'247bc5dcc61ac7472e8869b92882aa2e29684e38',
      requestId:'pc-7fec8790-8160-4bd3-950d-7398da251793',
      sourceSha:'de81749f83c086f5cb0cad7ed1d5cc958de19280',
      configSha256:'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453',
      evidenceLevel:'READONLY_CONFIG_BYTES_NOT_LIVE_CORE_PROCESS',
    }),
  }),
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
