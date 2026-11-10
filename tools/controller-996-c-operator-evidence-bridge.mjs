// #996 C continuation: read-only connection between the exact GitHub consent
// evidence reader, source artifact bytes, and the strict continuation gate.
// This is NOT a Windows operator, CLI, permission to run C, or a live adapter.
// It has no filesystem/network ports and never mutates operational state.
import {createHash} from 'node:crypto';
import {review996ContinuationGate} from './controller-996-continuation-gate.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const H40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const H64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const digest=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_C_OPERATOR_EVIDENCE_BRIDGE_V1',
  status:'C_OPERATOR_SOURCE_REVIEW_BLOCKED',code,
  executionAuthorized:false,productionExecutable:false,
  operationalWrites:0,workflowPuts:0,backlogWrites:0,
  issuePosts:0,pcRetries:0,
});

/**
 * Inputs are evidence returned by independently authenticated read-only
 * readers. This function cannot authenticate those readers: even its success
 * must never authorize an operating-PC write or declare C ready to execute.
 * `rawManifestBytes` must be the exact GitHub blob bytes provided by the
 * existing owner-consent reader; artifact buffers are compared in memory only.
 */
export function review996COperatorEvidenceBridge({
  manifest,consentEvidence,operatorBytes,packageBytes,sourceLockBytes,
  gitSource,physical,remote,conflicts,
}={}){
  const m=consentEvidence;
  if(m?.schema!=='ZGMINI_CONTROLLER_996_NEW_C_CONSENT_READ_V1'||
    m.status!=='C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY'||
    m.repository!==REPO||m.issueNumber!==996||
    !Number.isSafeInteger(m.consentCommentId)||m.consentCommentId<=0||
    !H40(m.manifestCommitSha)||!H64(m.manifestSha256)||
    !Buffer.isBuffer(m.rawManifestBytes)||
    m.rawManifestBytes.length<1||m.rawManifestBytes.length>65_536||
    digest(m.rawManifestBytes)!==m.manifestSha256)
    return fail('C_OPERATOR_OWNER_CONSENT_BYTES_NOT_VERIFIED');
  let pinned;
  try{pinned=JSON.parse(m.rawManifestBytes.toString('utf8'));}
  catch{return fail('C_OPERATOR_MANIFEST_ORIGIN_BYTES_INVALID');}
  if(!pinned||typeof pinned!=='object'||Array.isArray(pinned)||
    !manifest||typeof manifest!=='object'||Array.isArray(manifest)||
    !same(pinned,manifest)||
    m.continuationRequestId!==manifest.continuationRequestId||
    m.operatorSha256!==manifest.operatorSha256||
    m.bootstrapSha256!==manifest.bootstrapSha256||
    m.packageSha256!==manifest.packageSha256||
    m.sourceLockSha256!==manifest.sourceLockSha256)
    return fail('C_OPERATOR_CONSENT_MANIFEST_MISMATCH');
  // Future source bundles are NOT presumed authentic. Check actual bytes,
  // never a filename, a boolean or a caller-supplied digest alone.
  for(const [name,bytes,expected,limit] of [
    ['OPERATOR',operatorBytes,manifest.operatorSha256,2_000_000],
    ['PACKAGE',packageBytes,manifest.packageSha256,16_000_000],
    ['SOURCE_LOCK',sourceLockBytes,manifest.sourceLockSha256,100_000],
  ]){
    if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>limit||
      !H64(expected)||digest(bytes)!==expected)
      return fail(`C_OPERATOR_${name}_BYTES_NOT_PINNED`);
  }
  const receipt={status:'NEW_CONTINUATION_C_RECEIPT_INDEPENDENTLY_VERIFIED',
    continuationRequestId:m.continuationRequestId,
    manifestSha256:m.manifestSha256,revoked:false,oldConsentReused:false,
    operatorSha256:m.operatorSha256,packageSha256:m.packageSha256,
    bootstrapSha256:m.bootstrapSha256,
    sourceLockSha256:m.sourceLockSha256};
  const gate=review996ContinuationGate({manifest,
    manifestProof:{status:'IMMUTABLE_GIT_MANIFEST_BYTES_VERIFIED',
      repository:REPO,gitCommit:m.manifestCommitSha,
      manifestSha256:m.manifestSha256,contentMatchesCandidate:true},
    consent:receipt,gitSource,physical,remote,conflicts});
  if(gate.status!=='C_CONTINUATION_EVIDENCE_SHAPES_REVIEWED_ONLY')
    return fail(gate.code);
  return Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_C_OPERATOR_EVIDENCE_BRIDGE_V1',
    status:'C_OPERATOR_SOURCE_EVIDENCE_SHAPES_REVIEWED_ONLY',
    code:'ACTUAL_WINDOWS_C_OPERATOR_AND_FRESH_PREWRITE_CAS_NOT_APPROVED',
    sourceFiles:gate.sourceFiles,originalUnresolvedIssues:gate.originalUnresolvedIssues,
    executionAuthorized:false,productionExecutable:false,
    operationalWrites:0,workflowPuts:0,backlogWrites:0,
    issuePosts:0,pcRetries:0,
  });
}

// Explicit final fail-closed entrypoint. It must not even inspect supplied
// ports or paths, let alone attempt to acquire/move an original C claim.
export function execute996COperator(){
  return fail('C_CONTINUATION_PRODUCTION_NOT_APPROVED');
}
