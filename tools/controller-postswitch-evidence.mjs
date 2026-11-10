// Fixed-root, read-only evidence for a controller update interrupted after intake resume.
// This tool never replays a request, modifies a journal, releases a lease or installs files.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {WRITER_FOLLOWUP_CANDIDATE, WRITER_TRANSITION, writerFollowupMatches}
  from './controller-postswitch-approval.mjs';

const control = 'E:/ZGmini/automation/pc-control';
const maintenance = 'E:/ZGmini/automation/pc-maintenance';
const gh = 'C:/Program Files/GitHub CLI/gh.exe';
const repository = 'ansqhd5774-Choi/zgmini-pc-control';
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest = value => createHash('sha256').update(value).digest('hex');
const need = (ok, code) => {if (!ok) throw Object.assign(new Error(code), {code});};
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const alive = pid => {try {process.kill(pid, 0); return true;} catch (error) {return error.code === 'ESRCH' ? false : null;}};
const sameKeys = (left, right) => left && right &&
  typeof left === 'object' && typeof right === 'object' &&
  !Array.isArray(left) && !Array.isArray(right) &&
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(left).every(key => Object.hasOwn(right, key));
const WRITER_B_RESULT_PATH =
  'results/writer-b-source-install-b14af1b2-9a23-4f5a-9239-218498ddb403.json';
const WRITER_A_RESULT_PATH = 'results/42693903840-1-seat-1.json';
const WRITER_B2_RESULT_PATH =
  'results/writer-b-source-install-df88aee8-f993-4280-ad8f-522da056134e.json';
const WRITER_A2_RESULT_PATH = 'results/42701322061-1-seat-3.json';
const WRITER_CONFIG_PATH = 'E:/ZGmini/data/pc-writer/config.json';
const WRITER_RESULT_RAW_SHA256 = Object.freeze({
  [WRITER_B_RESULT_PATH]:'c0b3f677b83babef8db31d0e155f33226f939bca468c2c8e2cb6b655b02a1a62',
  [WRITER_A_RESULT_PATH]:'1d35d6550595802f2f060f88f82f34757c898bd92c372cdf52a13405221faae0',
  [WRITER_B2_RESULT_PATH]:'22edebeadc41c1e418b7a6444f4a4714c719cc3ccddb2462804766ba445702e2',
  [WRITER_A2_RESULT_PATH]:'920d01cfcdb80120a5d1623f70bcce7579ee7febf286741f2ef285522b648e66',
});
const EXPECTED_TRANSITION = Object.freeze({
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

/**
 * Historical #917 protection is immutable. An explicitly approved C-grade
 * recovery may accept only the separately pinned Writer config evolution.
 * The first Writer B's historical config digest remains a separately pinned
 * C-grade consent. The second Writer B's source-only config change must also
 * be independently reversed against those exact historical bytes at runtime.
 */
export function verifySourceOnlyConfigEvolution(raw, transition) {
  if (!Buffer.isBuffer(raw) || !sameKeys(transition, EXPECTED_TRANSITION) ||
      digest(raw) !== transition.currentConfigSha256) return false;
  try {
    const text = raw.toString('utf8');
    // Invalid UTF-8 must not silently normalize to replacement characters.
    if (!Buffer.from(text, 'utf8').equals(raw)) return false;
    const current = JSON.parse(text);
    const matches = [...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/gi)];
    if (matches.length !== 1 || matches[0][1] !== transition.approvedSourceSha ||
        current?.source !== transition.approvedSourceSha) return false;
    const inverted = text.slice(0, matches[0].index) +
      matches[0][0].replace(transition.approvedSourceSha,
        transition.priorApprovedSourceSha) +
      text.slice(matches[0].index + matches[0][0].length);
    return digest(Buffer.from(inverted, 'utf8')) === transition.priorConfigSha256 &&
      JSON.stringify({...current, source:transition.priorApprovedSourceSha}) ===
        JSON.stringify(JSON.parse(inverted));
  } catch { return false; }
}

export function verifyWriterProtectionEvidence({baseline, current,
  transition, writerB, writerA, writerBBlobSha, writerABlobSha,
  writerB2, writerA2, writerB2BlobSha, writerA2BlobSha} = {}) {
  if (!sameKeys(transition, EXPECTED_TRANSITION) ||
      !Object.entries(EXPECTED_TRANSITION).every(([key, value]) =>
        transition[key] === value) ||
      !sameKeys(baseline, current) ||
      !sameKeys(baseline?.files, current?.files) ||
      !sameKeys(baseline?.tasks, current?.tasks) ||
      baseline.files['config.json'] !== transition.baselineConfigSha256 ||
      current.files['config.json'] !== transition.currentConfigSha256 ||
      baseline.files['config.json'] === current.files['config.json'] ||
      !Object.keys(baseline.files).every(key =>
        key === 'config.json' || baseline.files[key] === current.files[key]) ||
      !Object.keys(baseline.tasks).every(key =>
        baseline.tasks[key] === current.tasks[key]) ||
      Object.keys(baseline.tasks).length !== 3 ||
      !Object.hasOwn(baseline.tasks, 'ZGMINI-PC-Local-Core') ||
      !Object.hasOwn(baseline.tasks, 'ZGMINI-PC-Local-Korea') ||
      baseline.tasks['ZGMINI-PC-Iran-Progress-R13'] !== 'APPROVED_RETIRED_ABSENT' ||
      writerBBlobSha !== transition.priorWriterBResultBlobSha ||
      writerABlobSha !== transition.priorWriterAResultBlobSha ||
      writerB2BlobSha !== transition.writerBResultBlobSha ||
      writerA2BlobSha !== transition.writerAResultBlobSha) return false;
  if (writerB?.schema !== 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1' ||
      writerB?.requestId !== 'b14af1b2-9a23-4f5a-9239-218498ddb403' ||
      writerB?.status !== 'WRITER_B_INSTALLED_VERIFIED' ||
      writerB?.code !== 'WRITER_B_INSTALL_VERIFIED' ||
      writerB?.localOnly !== true || writerB?.mode !== 'LOCAL_OVERLAY' ||
      writerB?.sourceSha !== transition.priorApprovedSourceSha ||
      writerB?.manifestSha256 !==
        '593004aa6b0c5c6471a691faebd9c98f142af4990580a8b1d5a0619d829b2e6f' ||
      !Array.isArray(writerB?.changedPaths) || writerB.changedPaths.length !== 4 ||
      !['scripts/pc-writer/release-calendar.mjs',
        'lib/treasury-auction-history-source.mjs',
        'lib/treasury-auction-history.mjs',
        'lib/treasury-auction-history-taws.mjs']
        .every(name => writerB.changedPaths.includes(name)))
    return false;
  const observed = writerA?.result;
  return writerA?.schema === 'ZGMINI_PC_RESULT_V1' &&
    writerA.requestId === 'pc-4b53b63d-cf6f-4898-806d-f6774b63009c' &&
    writerA.operation === 'writer-install-preimage-readonly' &&
    writerA.status === 'PASS' && writerA.code === 'WRITER_FIXED_PREIMAGE_READONLY' &&
    writerA.operationalWrites === 0 && writerA.providerCalls === 0 &&
    writerA.d1Writes === 0 && writerA.sqliteOpened === false &&
    writerA.protectedStateUnchanged === true &&
    observed?.status === 'PASS' && observed?.sourceIdentityConsistent === true &&
    observed?.sourceHead === transition.priorApprovedSourceSha &&
    observed?.approvedConfigSource === transition.priorApprovedSourceSha &&
    observed?.checkpointSource === transition.priorApprovedSourceSha &&
    observed?.r6Config?.status === 'PASS' &&
    observed.r6Config.configSha256 === transition.priorConfigSha256 &&
    writerB2?.schema === 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1' &&
    writerB2.requestId === 'df88aee8-f993-4280-ad8f-522da056134e' &&
    writerB2.status === 'WRITER_B_INSTALLED_VERIFIED' &&
    writerB2.code === 'WRITER_B_INSTALL_VERIFIED' &&
    writerB2.mode === 'LOCAL_OVERLAY' && writerB2.localOnly === true &&
    writerB2.baseHead === transition.priorApprovedSourceSha &&
    writerB2.sourceSha === transition.approvedSourceSha &&
    writerB2.manifestSha256 ===
      'b030d7fca591d9a39a4af9337ac8df632933ea4e710f83d1f3bc6b2c59ea435b' &&
    Array.isArray(writerB2.changedPaths) && writerB2.changedPaths.length === 2 &&
    new Set(writerB2.changedPaths).size === 2 &&
    ['lib/diagnostic-layer/asset-bubble-r10-raw-evidence-r1.mjs',
      'worker/asset-bubble-r10-raw-r1.mjs']
      .every(name => writerB2.changedPaths.includes(name)) &&
    writerA2?.schema === 'ZGMINI_PC_RESULT_V1' &&
    writerA2.requestId === 'pc-1f2318d5-6122-40a6-8581-5f1fba0f9d69' &&
    writerA2.operation === 'writer-install-preimage-readonly' &&
    writerA2.status === 'PASS' && writerA2.code === 'WRITER_FIXED_PREIMAGE_READONLY' &&
    writerA2.operationalWrites === 0 && writerA2.providerCalls === 0 &&
    writerA2.d1Writes === 0 && writerA2.sqliteOpened === false &&
    writerA2.protectedStateUnchanged === true &&
    writerA2.result?.status === 'PASS' &&
    writerA2.result.sourceIdentityConsistent === true &&
    writerA2.result.sourceHead === transition.approvedSourceSha &&
    writerA2.result.approvedConfigSource === transition.approvedSourceSha &&
    writerA2.result.checkpointSource === transition.approvedSourceSha &&
    writerA2.result.r6Config?.status === 'PASS' &&
    writerA2.result.r6Config.configSha256 === transition.currentConfigSha256;
}

export function verifyWriterProtectionTransition(proof = {}) {
  return verifyWriterProtectionEvidence(proof) &&
    verifySourceOnlyConfigEvolution(proof.currentConfigRaw, proof.transition);
}

// Reuse all historical assertions after reversing only the independently
// checked source chain. Neither config nor PROTECTED_BEFORE is written.
export function verifyWriterFollowupRecoveryEvidence({historicalProof,followup,proof}={}) {
  if(!writerFollowupMatches(followup) ||
    proof?.status!=='READONLY_WRITER_PROTECTION_CANDIDATE_VERIFIED' ||
    proof.code!=='WRITER_PROTECTION_PINNED_EVIDENCE_MATCH' ||
    proof.writerBReceiptCount!==4 || proof.operationalWrites!==0 ||
    proof.cApprovalAuthorized!==false || proof.liveCoreSourceVerified!==false ||
    proof.historicalCConsentVerifiedHere!==false)return false;
  const raw=historicalProof?.currentConfigRaw;
  const analysis=analyzeWriterFollowupSourceCandidate(raw);
  if(analysis.status!=='SOURCE_ONLY_CHAIN_CANDIDATE_VERIFIED' ||
    JSON.stringify(proof.digestStages)!==JSON.stringify(analysis.stages) ||
    !verifyWriterFollowupProtectedSnapshot(historicalProof.baseline,historicalProof.current))return false;
  const text=raw.toString('utf8');
  const hit=[...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/gi)][0];
  const restored=Buffer.from(text.slice(0,hit.index)+hit[0].replace(hit[1],
    WRITER_TRANSITION.approvedSourceSha)+text.slice(hit.index+hit[0].length),'utf8');
  const current=structuredClone(historicalProof.current);
  current.files['config.json']=WRITER_TRANSITION.currentConfigSha256;
  return verifyWriterProtectionTransition({...historicalProof,current,currentConfigRaw:restored});
}

const gitBlobDigest = raw => createHash('sha1')
  .update(Buffer.from(`blob ${raw.length}\0`, 'utf8')).update(raw).digest('hex');

/**
 * Strictly verify all four *additional* approved Writer B result bytes.
 * The A-grade observations below are intentionally NOT promoted into a
 * successful, current live-Core source check. This candidate is not a C
 * approval, and this helper is not wired into the live recovery operator.
 */
export function verifyWriterFollowupBReceipts(receipts) {
  const contract = WRITER_FOLLOWUP_CANDIDATE;
  const count=contract.sourceSequence.length-1;
  if (!Array.isArray(receipts) || receipts.length !== count ||
      !Array.isArray(contract?.writerB) || contract.writerB.length !== count) return false;
  for (let index = 0; index < count; index++) {
    const expected = contract.writerB[index], row = receipts[index];
    if (!Buffer.isBuffer(row?.raw) || row.path !== expected.path ||
        row.blobSha !== expected.blobSha ||
        gitBlobDigest(row.raw) !== expected.blobSha ||
        digest(row.raw) !== expected.rawSha256) return false;
    let result;
    try {
      const utf8 = row.raw.toString('utf8');
      if (!Buffer.from(utf8, 'utf8').equals(row.raw)) return false;
      result = JSON.parse(utf8);
    } catch {return false;}
    if (result?.schema !== 'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1' ||
        result.requestId !== expected.requestId ||
        result.status !== 'WRITER_B_INSTALLED_VERIFIED' ||
        result.code !== 'WRITER_B_INSTALL_VERIFIED' ||
        result.mode !== 'LOCAL_OVERLAY' || result.localOnly !== true ||
        result.baseHead !== expected.baseHead ||
        result.sourceSha !== expected.sourceSha ||
        result.candidateSourceSha !== expected.candidateSourceSha ||
        result.manifestSha256 !== expected.manifestSha256 ||
        !Array.isArray(result.changedPaths) ||
        JSON.stringify(result.changedPaths) !== JSON.stringify(
          expected.changedPaths ?? [expected.changedPath])) return false;
  }
  return contract.writerB.every((entry, index) =>
    entry.baseHead === contract.sourceSequence[index] &&
    entry.sourceSha === contract.sourceSequence[index + 1]);
}

/**
 * A byte-only, in-memory inverse over the JSON source field. Anchors at de8,
 * 48d, 144f, 75f and 70d were observed separately. The 4ec digest is calculated,
 * never asserted as an independently observed historical A-grade digest.
 * No argument or return value constitutes live-Core or C-grade verification.
 */
export function analyzeSourceOnlyReplacementChain(raw, {sources, anchors} = {}) {
  const stop = code => ({status:'SOURCE_ONLY_CHAIN_UNVERIFIED', code,
    cApprovalAuthorized:false, liveCoreSourceVerified:false});
  if (!Buffer.isBuffer(raw) || !Array.isArray(sources) ||
      ![5,6].includes(sources.length) || sources.some(source =>
        typeof source !== 'string' || !/^[a-f0-9]{40}$/.test(source)) ||
      new Set(sources).size !== sources.length || !anchors ||
      typeof anchors !== 'object' || Array.isArray(anchors) ||
      Object.keys(anchors).length !== sources.length ||
      sources.some((source,index)=>!Object.hasOwn(anchors,source) ||
        (anchors[source] === null ? index !== 2 :
          typeof anchors[source] !== 'string' ||
          !/^[a-f0-9]{64}$/.test(anchors[source]))))
    return stop('WRITER_CHAIN_ARGUMENTS_INVALID');
  try {
    let currentText = raw.toString('utf8');
    if (!Buffer.from(currentText, 'utf8').equals(raw))
      return stop('WRITER_CHAIN_UTF8_INVALID');
    const derived=[];
    for (let step=sources.length-1;step>=0;step--) {
      const currentSource=sources[step];
      const currentRaw=Buffer.from(currentText,'utf8');
      const currentHash=digest(currentRaw);
      const expectedHash=anchors[currentSource];
      if (expectedHash != null &&
          (!/^[a-f0-9]{64}$/.test(expectedHash) || currentHash !== expectedHash))
        return stop('WRITER_CHAIN_CONFIG_SHA_MISMATCH');
      const parsed=JSON.parse(currentText);
      const hits=[...currentText.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/gi)];
      if (hits.length !== 1 || hits[0][1] !== currentSource ||
          parsed?.source !== currentSource)
        return stop('WRITER_CHAIN_SOURCE_NOT_UNIQUE');
      derived.push({sourceSha:currentSource,configSha256:currentHash,
        evidenceLevel:expectedHash == null ? 'DERIVED_ONLY' : 'PINNED_DIGEST_MATCH'});
      if (step === 0) break;
      const priorSource=sources[step-1], hit=hits[0];
      const replaced=hit[0].replace(currentSource,priorSource);
      if (replaced === hit[0])return stop('WRITER_CHAIN_SOURCE_REPLACE_FAILED');
      const nextText=currentText.slice(0,hit.index)+replaced+
        currentText.slice(hit.index+hit[0].length);
      if (JSON.stringify({...parsed,source:priorSource}) !==
          JSON.stringify(JSON.parse(nextText)))
        return stop('WRITER_CHAIN_NON_SOURCE_DRIFT');
      currentText=nextText;
    }
    return {status:'SOURCE_ONLY_CHAIN_CANDIDATE_VERIFIED',
      code:'WRITER_CHAIN_PINNED_ENDPOINTS_MATCH',
      stages:derived,intermediate4ecIndependentlyObserved:false,
      cApprovalAuthorized:false,liveCoreSourceVerified:false};
  } catch {return stop('WRITER_CHAIN_BYTES_INVALID');}
}

export function analyzeWriterFollowupSourceCandidate(currentConfigRaw) {
  const candidate=WRITER_FOLLOWUP_CANDIDATE;
  const [source75,source4ec,source144,source48,sourceDe]=candidate.sourceSequence;
  const h=candidate.configShaAnchors;
  return analyzeSourceOnlyReplacementChain(currentConfigRaw,{
    sources:[WRITER_TRANSITION.priorApprovedSourceSha,
      source75,source4ec,source144,source48,sourceDe],
    anchors:{
      [WRITER_TRANSITION.priorApprovedSourceSha]:h.prior70,
      [source75]:h.at75,[source4ec]:h.at4ec,
      [source144]:h.at144,[source48]:h.at48,[sourceDe]:h.atDe,
    },
  });
}

/**
 * #917's immutable PROTECTED_BEFORE snapshot is never rewritten to make later
 * Writer overlays appear unchanged. This only compares the new *candidate*
 * against the separately observed, post-#1195 de8 Writer config digest. It is NOT
 * a C-grade consent or a substitute for the historical 70d→75f approval.
 */
export function verifyWriterFollowupProtectedSnapshot(baseline, current) {
  const baselineSha=WRITER_TRANSITION.baselineConfigSha256;
  const latestSha=WRITER_FOLLOWUP_CANDIDATE.configShaAnchors.atDe;
  if (!sameKeys(baseline,current) ||
      !sameKeys(baseline?.files,current?.files) ||
      !sameKeys(baseline?.tasks,current?.tasks) ||
      baseline.files['config.json']!==baselineSha ||
      current.files['config.json']!==latestSha ||
      Object.keys(baseline.tasks).length!==3 ||
      !Object.hasOwn(baseline.tasks,'ZGMINI-PC-Local-Core') ||
      !Object.hasOwn(baseline.tasks,'ZGMINI-PC-Local-Korea') ||
      baseline.tasks['ZGMINI-PC-Iran-Progress-R13']!==
        'APPROVED_RETIRED_ABSENT') return false;
  return Object.keys(baseline.files).every(key=>
    key==='config.json' || baseline.files[key]===current.files[key]) &&
    Object.keys(baseline.tasks).every(key=>baseline.tasks[key]===current.tasks[key]);
}

/**
 * Combine independently pinned B receipts, actual local Writer config bytes,
 * and the original protected snapshot for READ-ONLY planning only. Success is
 * never passed to validatePostSwitchApproval or the Windows C-grade operator.
 * In particular, this does not promote partial A observations to live Core.
 */
export function inspectWriterFollowupProtectionCandidate({baseline,current,
  writerBReceipts,currentConfigRaw}={}) {
  const result={schema:'ZGMINI_PC_WRITER_FOLLOWUP_PROTECTION_CANDIDATE_V1',
    status:'READONLY_WRITER_FOLLOWUP_PROTECTION_UNVERIFIED',
    code:'WRITER_FOLLOWUP_PROTECTION_INCOMPLETE',
    operationalWrites:0,cApprovalAuthorized:false,liveCoreSourceVerified:false,
    historicalCConsentVerifiedHere:false};
  if (!verifyWriterFollowupProtectedSnapshot(baseline,current))
    return {...result,code:'WRITER_FOLLOWUP_PROTECTED_STATE_DRIFT'};
  if (!verifyWriterFollowupBReceipts(writerBReceipts))
    return {...result,code:'WRITER_FOLLOWUP_B_RECEIPTS_UNVERIFIED'};
  const analysis=analyzeWriterFollowupSourceCandidate(currentConfigRaw);
  if (analysis.status!=='SOURCE_ONLY_CHAIN_CANDIDATE_VERIFIED' ||
      analysis.code!=='WRITER_CHAIN_PINNED_ENDPOINTS_MATCH' ||
      analysis.cApprovalAuthorized!==false ||
      analysis.liveCoreSourceVerified!==false ||
      analysis.intermediate4ecIndependentlyObserved!==false ||
      !Array.isArray(analysis.stages) || analysis.stages.length!==6 ||
      analysis.stages.some((step,index)=>
        step.evidenceLevel!==(index===3?'DERIVED_ONLY':'PINNED_DIGEST_MATCH')))
    return {...result,code:'WRITER_FOLLOWUP_CONFIG_BYTES_UNVERIFIED'};
  return {...result,status:'READONLY_WRITER_FOLLOWUP_PROTECTION_CANDIDATE_VERIFIED',
    code:'WRITER_FOLLOWUP_PINNED_READONLY_EVIDENCE_MATCH',
    digestStages:analysis.stages.map(({sourceSha,configSha256,evidenceLevel})=>
      ({sourceSha,configSha256,evidenceLevel})),
    next:'EXPLICIT_NEW_C_GRADE_CONSENT_AND_LIVE_CORE_PROOF_REQUIRED'};
}

export function classifyWriterFollowupAObservations({at144,at48Uncorroborated,
  at48HistoricalOnly} = {}) {
  const s=WRITER_FOLLOWUP_CANDIDATE.sourceSequence;
  const accurate = at144?.status === 'PASS' &&
    at144.code === 'WRITER_APPROVED_PREIMAGE_READONLY' &&
    at144.result?.sourceHead === s[2] &&
    at144.result?.approvedConfigSource === s[2] &&
    at144.result?.checkpointSource === s[1] &&
    at144.result?.sourceIdentityConsistent === false &&
    at144.result?.runtimeSourceVerified === false &&
    at48Uncorroborated?.status === 'STATE_UNKNOWN' &&
    at48Uncorroborated.code === 'WRITER_PREIMAGE_CHECKOUT_NOT_CORROBORATED' &&
    at48Uncorroborated.result?.sourceHead === null &&
    at48Uncorroborated.result?.runtimeSourceVerified === false &&
    at48HistoricalOnly?.status === 'PASS' &&
    at48HistoricalOnly.code === 'PC_SOURCE_READONLY_DIAGNOSIS' &&
    at48HistoricalOnly.result?.runtimeSourceVerified === false &&
    at48HistoricalOnly.result?.historicalCheckoutCandidate?.head === s[3] &&
    at48HistoricalOnly.result?.historicalCheckoutCandidate?.trackedDirty === false;
  return {status:accurate ? 'A_OBSERVATIONS_CLASSIFIED_NOT_LIVE_CORE' :
    'A_OBSERVATIONS_UNVERIFIED',
    liveCoreSourceVerified:false,latestPreimagePass:false,
    cApprovalAuthorized:false};
}

function verifiedGitHubResult(pathName, expectedBlobSha) {
  const row = readGitHub('contents/' + pathName);
  need(row?.type === 'file' && row?.path === pathName &&
    row?.sha === expectedBlobSha && row?.encoding === 'base64' &&
    typeof row?.content === 'string',
  'POSTSWITCH_WRITER_RESULT_BLOB_DRIFT');
  const bytes = Buffer.from(row.content.replace(/\s/g, ''), 'base64');
  need(digest(bytes) === WRITER_RESULT_RAW_SHA256[pathName],
    'POSTSWITCH_WRITER_RESULT_RAW_DRIFT');
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    need(false, 'POSTSWITCH_WRITER_RESULT_UNREADABLE');
  }
}

export function verifyControllerFiles(host, root, readBytes = fs.readFileSync) {
  if (!host || !isSha(host.controllerSourceSha) || !host.controllerFiles ||
      Array.isArray(host.controllerFiles) || typeof host.controllerFiles !== 'object') return false;
  const files = Object.entries(host.controllerFiles);
  if (files.length < 5) return false;
  return files.every(([rel, hash]) =>
    /^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel) &&
    /^[a-f0-9]{64}$/.test(hash) &&
    (() => {try {return digest(readBytes(path.join(root, rel))) === hash;} catch {return false;}})());
}

// #917 is a fixed 38-file post-switch incident. A self-consistent but reduced
// host.json (37/37 etc.) must not silently pass the C-grade recovery gate.
export function verifyExactPostSwitchInventory(currentHost, backupHost,
  currentSourcePaths, backupSourcePaths) {
  const set = items => Array.isArray(items) && items.length === 38 &&
    items.every(p => /^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p)) &&
    new Set(items).size === 38 ? [...items].sort().join('\n') : null;
  const current = set(Object.keys(currentHost?.controllerFiles ?? {}));
  const backup = set(Object.keys(backupHost?.controllerFiles ?? {}));
  return current !== null && backup !== null && current === backup &&
    current === set(currentSourcePaths) && backup === set(backupSourcePaths);
}

export function verifySourceBytes(host, sourceSha, readPinnedBlob) {
  if (!host || host.controllerSourceSha !== sourceSha ||
      typeof readPinnedBlob !== 'function' ||
      !host.controllerFiles || typeof host.controllerFiles !== 'object') return false;
  return Object.entries(host.controllerFiles).every(([rel, expected]) => {
    try {return /^[a-f0-9]{64}$/.test(expected) &&
      digest(readPinnedBlob(sourceSha, rel)) === expected;}
    catch {return false;}
  });
}

export function verifySupervisorSnapshot(status, owner, {targetSha,
  livePid = alive, now = Date.now(), bootAt = now - os.uptime() * 1000} = {}) {
  if (status?.mode !== 'LISTENING' || status?.sourceSha !== targetSha ||
      !Number.isSafeInteger(status.pid) || status.pid < 1 ||
      owner?.pid !== status.pid || !/^[a-f0-9-]{36}$/.test(owner?.nonce ?? '') ||
      !Number.isFinite(owner?.bootAt) || Math.abs(owner.bootAt - bootAt) > 10000 ||
      livePid(status.pid) !== true || !Array.isArray(status.children) ||
      status.children.length !== 6 ||
      !Number.isFinite(Date.parse(status.at ?? '')) ||
      now - Date.parse(status.at) < 0 || now - Date.parse(status.at) >= 45000) return false;
  const seats = new Set();
  for (const child of status.children) {
    if (!Number.isInteger(child?.seat) || child.seat < 1 || child.seat > 6 ||
        seats.has(child.seat) || child.alive !== true ||
        !Number.isSafeInteger(child.pid) || child.pid < 1 ||
        livePid(child.pid) !== true) return false;
    seats.add(child.seat);
  }
  return seats.size === 6;
}

export function classifyPostSwitchEvidence(evidence) {
  const checks = {
    ORIGINAL_LEDGER: evidence.ledger?.status === 'RECOVERY_REQUIRED' &&
      evidence.ledger?.phase === 'RECOVERY_REQUIRED' &&
      evidence.ledger?.firstFail === 'INTAKE_RESUMED' &&
      evidence.ledger?.code === 'BACKLOG_ORIGINAL_REQUEST_INVALID' &&
      evidence.ledger?.intakePaused === false &&
      evidence.ledger?.postIssueNumber == null,
    TARGET_SWITCHED: evidence.currentSha === evidence.ledger?.targetSha &&
      evidence.currentSha !== evidence.ledger?.installedShaBefore &&
      evidence.currentBytesVerified === true,
    BACKUP_VERIFIED: evidence.snapshotSha === evidence.ledger?.installedShaBefore &&
      evidence.snapshotBytesVerified === true,
    OWNER_DEAD_AND_MATCHED: evidence.ownerIdentityVerified === true && evidence.ownerAlive === false,
    PROTECTION_UNCHANGED: evidence.protectionVerified === true,
    PROTECTION_CONTRACT_VERIFIED: evidence.protectionContractVerified === true,
    BACKLOG_CLOSED: evidence.backlogVerified === true && evidence.pauseWindowsClosed === true,
    LIVE_WORKFLOW_ACTIVE: evidence.workflow === 'active',
    RUNNERS_ONLINE: evidence.runnerSetVerified === true,
    SUPERVISOR_FRESH: evidence.supervisorVerified === true,
  };
  // Keep the historical truth visible. A separately pinned C-grade contract
  // may satisfy protection, but must never relabel the old snapshot unchanged.
  const failed = Object.entries(checks).filter(([name, pass]) => !pass &&
    name !== 'PROTECTION_CONTRACT_VERIFIED' &&
    !(name === 'PROTECTION_UNCHANGED' && checks.PROTECTION_CONTRACT_VERIFIED))
    .map(([name]) => name);
  return {status: failed.length ? 'RECOVERY_REQUIRED' : 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED',
    code: failed[0] ?? 'POSTSWITCH_EVIDENCE_VERIFIED', checks,
    next: failed.length ? 'RECONCILE_NAMED_CHECKS_WITHOUT_OPERATIONAL_WRITE' :
      'PREPARE_EXACT_APPROVAL_AND_ISOLATED_FORWARD_RECOVERY_NO_AUTOMATIC_EXECUTION'};
}

// The six dedicated PC seats must each be uniquely registered and online.
// Additional independently scoped runners (for example, handoff CI spares)
// are unrelated to the recovery of these seats and must not create a false
// shared-Controller outage.
export function verifyNamedPcRunnersOnline(rows) {
  if (!Array.isArray(rows)) return false;
  const names = Array.from({length: 6}, (_, index) => `zgmini-pc-0${index + 1}`);
  return names.every(name => {
    const matches = rows.filter(row => row?.name === name);
    return matches.length === 1 && matches[0].status === 'online';
  });
}

function readGitHub(route) {
  return JSON.parse(execFileSync(gh, ['api', `repos/${repository}/${route}`],
    {encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 3e6}));
}

export async function main(args = process.argv.slice(2), {writerTransition = null, writerFollowup = null} = {}) {
  need(process.platform === 'win32' && !process.env.GITHUB_ACTIONS && !process.env.RUNNER_NAME,
    'POSTSWITCH_OPERATOR_WINDOWS_REQUIRED');
  need(args.length === 4 && args[0] === '--request-id' && args[2] === '--source-sha' &&
    /^pc-update-[a-f0-9-]{36}$/.test(args[1]) && isSha(args[3]), 'POSTSWITCH_USAGE');
  const id = args[1], source = args[3];
  const git = params => execFileSync('git', params, {cwd: repo, windowsHide: true, maxBuffer: 4e6});
  git(['merge-base', '--is-ancestor', source, 'HEAD']);
  need(digest(git(['show', `${source}:tools/controller-postswitch-evidence.mjs`])) ===
    digest(fs.readFileSync(fileURLToPath(import.meta.url))), 'POSTSWITCH_SOURCE_DRIFT');
  // Import closure of update.mjs: maintenance-contract.mjs re-exports the
  // source-bundle contract, and update.mjs imports that module directly too.
  // Every local non-builtin import must match the pinned recovery source.
  for (const rel of ['tools/update.mjs', 'tools/maintenance-apply.mjs',
    'tools/maintenance-contract.mjs', 'tools/maintenance-lock.mjs',
    'tools/source-bundle-register.mjs']) {
    need(digest(git(['show', `${source}:${rel}`])) === digest(fs.readFileSync(path.join(repo, rel))),
      'POSTSWITCH_DEPENDENCY_DRIFT');
  }

  const ledgerPath = path.join(maintenance, 'ledger', `${id}.json`);
  const ledgerRaw = fs.readFileSync(ledgerPath), ledger = JSON.parse(ledgerRaw);
  const dir = path.join(maintenance, 'leases/controller-install');
  const ownerRaw = fs.readFileSync(path.join(dir, 'owner.json'));
  const markerRaw = fs.readFileSync(path.join(dir, 'RECOVERY_REQUIRED.json'));
  const owner = JSON.parse(ownerRaw), marker = JSON.parse(markerRaw);
  const original = readGitHub(`issues/${ledger.issueNumber}`);
  let issueBody = null;
  try {issueBody = JSON.parse(original.body);} catch {}
  const ownerIdentityVerified = ledger.requestId === id && Number.isSafeInteger(owner.pid) && owner.pid > 0 &&
    /^[0-9a-f-]{36}$/.test(owner.nonce ?? '') && marker.requestOwnerPid === owner.pid && marker.nonce === owner.nonce &&
    Number.isFinite(Date.parse(ledger.updatedAt)) && Number.isFinite(Date.parse(marker.at)) &&
    Math.abs(Date.parse(marker.at) - Date.parse(ledger.updatedAt)) < 5000 &&
    Number.isFinite(Date.parse(owner.at)) && Date.parse(owner.at) <= Date.parse(marker.at) &&
    original.title === 'pc-controller-update' && original.user?.login === 'ansqhd5774-Choi' &&
    issueBody?.requestId === id && issueBody?.targetControllerSha === ledger.targetSha;

  const currentHostRaw = fs.readFileSync(path.join(control, 'host.json'));
  const currentHost = JSON.parse(currentHostRaw);
  const base = path.join(control, 'backups', `controller-update-${id}`);
  const snapshotHostPath = path.join(base, 'snapshot', 'host.json');
  const snapshotHostRaw = fs.readFileSync(snapshotHostPath);
  const snapshotHost = JSON.parse(snapshotHostRaw);
  const sourcePaths = sha => git(['ls-tree', '-r', '--name-only', sha]).toString('utf8')
    .split(/\r?\n/).filter(p => /^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p));
  const exactInventories = verifyExactPostSwitchInventory(currentHost, snapshotHost,
    sourcePaths(ledger.targetSha), sourcePaths(ledger.installedShaBefore));
  const sourceBlob = (sha, rel) => git(['show', `${sha}:${rel}`]);
  const exactSourceBytes = exactInventories &&
    verifySourceBytes(currentHost, ledger.targetSha, sourceBlob) &&
    verifySourceBytes(snapshotHost, ledger.installedShaBefore, sourceBlob);
  const baselinePath = path.join(base, 'PROTECTED_BEFORE.json');
  const baselineExists = fs.existsSync(baselinePath);
  const backlogPath = path.join(maintenance, 'backlog', `${id}.json`);
  const backlogRaw = fs.readFileSync(backlogPath), backlog = JSON.parse(backlogRaw);
  const windows = Array.isArray(backlog.windows) ? backlog.windows :
    [{pausedAt: backlog.pausedAt, resumedAt: backlog.resumedAt}];
  const pauseWindowsClosed = windows.length > 0 && windows.every(w =>
    Number.isFinite(Date.parse(w.pausedAt)) && Number.isFinite(Date.parse(w.resumedAt)) &&
    Date.parse(w.resumedAt) >= Date.parse(w.pausedAt));
  const backlogVerified = backlog.schema === 'ZGMINI_PC_BACKLOG_V1' && backlog.requestId === id &&
    backlog.replays && typeof backlog.replays === 'object' && !Array.isArray(backlog.replays) &&
    Object.entries(backlog.replays).every(([issue, entry]) => /^\d{1,10}$/.test(issue) &&
      ['DONE', 'SKIPPED_RESULT_PRESENT', 'POSTING'].includes(entry?.status));

  // Reuse the exact existing maintenance protection attestation: Core/Korea
  // scheduled task XML, writer configs, retired Iran approval, real workflow,
  // and every closed maintenance pause interval. All these port calls are reads.
  let protectionVerified = false, protectionCode = null;
  let protectionContractVerified = false;
  let writerFollowupVerified = false;
  let currentInventoryComplete = false, snapshotInventoryComplete = false;
  if (baselineExists && backlogVerified) {
    try {
      const {loadApprovedPackage, makePorts, prevalidationInventory,
        protectedSnapshot} = await import('./update.mjs');
      const data = loadApprovedPackage(id, path.join(maintenance, 'approved', `${id}.json`), {recovery: true});
      currentInventoryComplete = prevalidationInventory(currentHost) !== null;
      snapshotInventoryComplete = prevalidationInventory(snapshotHost) !== null;
      const {ports} = makePorts(data, data.issueNumber, {recoveryOperator: true});
      try {
        await ports.prepareRecovery();
        need(writerTransition === null && writerFollowup === null, 'POSTSWITCH_WRITER_TRANSITION_UNEXPECTED');
        protectionVerified = true;
      } catch (error) {
        if (error?.code !== 'PROTECTED_STATE_DRIFT' || writerTransition === null)
          throw error;
        protectionCode = error.code;
        const current = protectedSnapshot();
        const writerB = verifiedGitHubResult(WRITER_B_RESULT_PATH,
          writerTransition?.priorWriterBResultBlobSha);
        const writerA = verifiedGitHubResult(WRITER_A_RESULT_PATH,
          writerTransition?.priorWriterAResultBlobSha);
        const writerB2 = verifiedGitHubResult(WRITER_B2_RESULT_PATH,
          writerTransition?.writerBResultBlobSha);
        const writerA2 = verifiedGitHubResult(WRITER_A2_RESULT_PATH,
          writerTransition?.writerAResultBlobSha);
        const currentConfigRaw = fs.readFileSync(WRITER_CONFIG_PATH);
        const historicalProof={
          baseline:json(baselinePath),current,transition:writerTransition,
          writerB,writerA,writerBBlobSha:writerTransition.priorWriterBResultBlobSha,
          writerABlobSha:writerTransition.priorWriterAResultBlobSha,
          writerB2,writerA2,writerB2BlobSha:writerTransition.writerBResultBlobSha,
          writerA2BlobSha:writerTransition.writerAResultBlobSha,currentConfigRaw};
        if(writerFollowup!==null){
          need(writerFollowupMatches(writerFollowup),'POSTSWITCH_WRITER_FOLLOWUP_CONTRACT_INVALID');
          const {inspectLocalWriterProtectionReadOnly}=await import('./controller-postswitch-writer-readonly.mjs');
          const proof=await inspectLocalWriterProtectionReadOnly({
            readConfigRaw:()=>currentConfigRaw,readBaseline:()=>json(baselinePath),
            readCurrent:()=>current});
          writerFollowupVerified=verifyWriterFollowupRecoveryEvidence({
            historicalProof,followup:writerFollowup,proof});
          protectionContractVerified=writerFollowupVerified;
        }else protectionContractVerified = verifyWriterProtectionTransition(historicalProof);
        need(protectionContractVerified,'POSTSWITCH_WRITER_CONTRACT_NOT_VERIFIED');
      }
    } catch (error) {protectionCode = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code :
      'POSTSWITCH_PROTECTION_READBACK_FAILED';}
  }

  const runnerRows = readGitHub('actions/runners?per_page=100').runners;
  const runnerSetVerified = verifyNamedPcRunnersOnline(runnerRows);
  const workflow = readGitHub('actions/workflows/pc-job.yml').state;
  let supervisorVerified = false;
  try {
    const supervisor = json(path.join(control, 'SUPERVISOR_STATUS.json'));
    const supervisorOwner = json(path.join(control, 'leases/supervisor/owner.json'));
    supervisorVerified = verifySupervisorSnapshot(supervisor, supervisorOwner,
      {targetSha: ledger.targetSha});
  } catch {}
  const otherControlLeaseCount = fs.readdirSync(path.join(control, 'leases')).filter(name =>
    name !== 'supervisor' && !name.startsWith('supervisor.dead-')).length;
  const decision = classifyPostSwitchEvidence({ledger,
    currentSha: currentHost.controllerSourceSha,
    currentBytesVerified: exactSourceBytes && currentInventoryComplete &&
      verifyControllerFiles(currentHost, control),
    snapshotSha: snapshotHost.controllerSourceSha,
    snapshotBytesVerified: exactSourceBytes && snapshotInventoryComplete &&
      verifyControllerFiles(snapshotHost, path.join(base, 'snapshot')),
    ownerIdentityVerified, ownerAlive: alive(owner.pid), protectionVerified,
    protectionContractVerified,
    backlogVerified, pauseWindowsClosed, workflow, runnerSetVerified, supervisorVerified,
    otherControlLeaseCount});
  const replayStates = Object.fromEntries(Object.entries(backlog.replays || {})
    .filter(([issue]) => /^\d{1,10}$/.test(issue))
    .map(([issue, entry]) => [issue,
      ['DONE', 'SKIPPED_RESULT_PRESENT', 'POSTING'].includes(entry?.status) ? entry.status : 'UNKNOWN']));
  return {schema: 'ZGMINI_PC_POSTSWITCH_EVIDENCE_V1', requestId: id, sourceSha: source,
    ...decision, actualControllerSha: currentHost.controllerSourceSha,
    installedShaBefore: ledger.installedShaBefore, backupSha: snapshotHost.controllerSourceSha,
    materialHashes: {ledger: digest(ledgerRaw), owner: digest(ownerRaw), marker: digest(markerRaw),
      currentHost: digest(currentHostRaw),
      snapshotHost: digest(snapshotHostRaw),
      protectedBefore: baselineExists ? digest(fs.readFileSync(baselinePath)) : null,
      backlog: digest(backlogRaw)},
    backlogReplayStates: replayStates,
    protectionCode, protectionContractVerified, writerFollowupVerified,
    exactInventories, exactSourceBytes, otherControlLeaseCount, operationalWrites: 0};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    console.log(JSON.stringify(result));
    if (result.status !== 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED') process.exitCode = 2;
  }
  catch (error) {console.log(JSON.stringify({status: 'RECOVERY_REQUIRED',
    code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'POSTSWITCH_INSPECTION_FAILED',
    next: 'READ_ONLY_RECONCILE_NO_INSTALL_OR_LOCK_CHANGE', operationalWrites: 0}));
    process.exitCode = 2;}
}
