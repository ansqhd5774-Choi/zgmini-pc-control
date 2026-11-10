import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTINUATION_EFFECTS} from '../tools/controller-996-continuation-gate.mjs';
import {review996COperatorEvidenceBridge,execute996COperator} from
  '../tools/controller-996-c-operator-evidence-bridge.mjs';

const SHA=b=>createHash('sha256').update(b).digest('hex');
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ID='70a4c347-25ea-4fc6-83d2-c0c670115249';
const keys=['oldC','installOwner','installRecovery','backlog','installed',
  'stage','maintainer','PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED'];
const pins=Object.fromEntries(keys.map((k,i)=>[k,String(i).padStart(64,'0')]));
function valid(){
  const operatorBytes=Buffer.from('example prospective operator source; NOT executable');
  const packageBytes=Buffer.from('PK\x03\x04synthetic ZIP only; NOT runnable');
  const sourceLockBytes=Buffer.from('{"fixture":"source-only"}\n');
  const manifest={schema:'ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1',
    grade:'C',approved:true,
    operation:'ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE',
    issueNumber:996,originalRequestId:REQ,continuationRequestId:ID,
    operatorCommit:'a'.repeat(40),operatorSha256:SHA(operatorBytes),
    bootstrapSha256:'f'.repeat(64),
    packageSha256:SHA(packageBytes),sourceLockSha256:SHA(sourceLockBytes),
    originalPins:structuredClone(pins),effects:[...CONTINUATION_EFFECTS],
    workflowPutCount:0,backlogWriteCount:0,
    originalRequestRetryCount:0,issuePostCount:0};
  const rawManifestBytes=Buffer.from(JSON.stringify(manifest)+'\n');
  const consentEvidence={schema:'ZGMINI_CONTROLLER_996_NEW_C_CONSENT_READ_V1',
    status:'C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY',
    repository:'ansqhd5774-Choi/zgmini-pc-control',issueNumber:996,
    consentCommentId:555555,manifestCommitSha:'b'.repeat(40),
    manifestSha256:SHA(rawManifestBytes),rawManifestBytes,
    continuationRequestId:ID,operatorSha256:manifest.operatorSha256,
    bootstrapSha256:manifest.bootstrapSha256,
    packageSha256:manifest.packageSha256,
    sourceLockSha256:manifest.sourceLockSha256};
  const gitSource={status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
    installed:38,staged:39,maintainer:7,total:84,
    originalWindowsReadback:true,executionAuthorized:false};
  const physical={status:'FRESH_ORIGINAL_WINDOWS_C_PREWRITE_MATCHES',
    originalRequestId:REQ,oldCClaimExists:true,installLeaseExists:true,
    oldCOwnerAlive:false,installOwnerAlive:false,
    newContinuationClaimExists:false,archiveDestinationExists:false,
    workflowState:'active',protectionVerified:true,replayCount:0,
    replayJournalEmpty:true,markersExact:true,markerDetailsVerified:true,
    twoSnapshotsIdentical:true,shaPins:structuredClone(pins)};
  const remote={status:'FRESH_GITHUB_READ_ONLY_RECONCILED',
    originalIssueNumber:996,originalRequestId:REQ,workflowState:'active',
    replayDispatches:0,originalIssues:[1217,1219,1226,1227].map(issueNumber=>({
      issueNumber,state:'open',resultVerified:false,
      nextAction:'OWNER_REPLAN_REVIEW_REQUIRED'}))};
  const conflicts={scope:'CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES',
    foreignInstallOwnerCount:0,otherContinuationCount:0,
    twoSnapshotsIdentical:true,fresh:true,writerActiveCount:0};
  return {manifest,consentEvidence,operatorBytes,packageBytes,
    sourceLockBytes,gitSource,physical,remote,conflicts};
}
const review=x=>review996COperatorEvidenceBridge(x);
function repinManifest(x){
  x.consentEvidence.rawManifestBytes=Buffer.from(JSON.stringify(x.manifest)+'\n');
  x.consentEvidence.manifestSha256=SHA(x.consentEvidence.rawManifestBytes);
}
const blocked=(x,code)=>{
  const r=review(x);
  assert.equal(r.status,'C_OPERATOR_SOURCE_REVIEW_BLOCKED');
  assert.equal(r.code,code);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.productionExecutable,false);
  assert.equal(r.operationalWrites,0);
};

test('complete synthetic inputs produce evidence review, NEVER C authority',()=>{
  const r=review(valid());
  assert.equal(r.status,'C_OPERATOR_SOURCE_EVIDENCE_SHAPES_REVIEWED_ONLY');
  assert.equal(r.sourceFiles,84);
  assert.equal(r.originalUnresolvedIssues,4);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.productionExecutable,false);
  assert.equal(r.workflowPuts,0);
  assert.equal(r.backlogWrites,0);
});
test('missing or old phase-scoped consent cannot be bridged',()=>{
  const x=valid();x.consentEvidence=null;
  blocked(x,'C_OPERATOR_OWNER_CONSENT_BYTES_NOT_VERIFIED');
  const y=valid();y.consentEvidence.status='C_CONSENT_V1_APPROVED';
  blocked(y,'C_OPERATOR_OWNER_CONSENT_BYTES_NOT_VERIFIED');
});
test('tampered raw Git manifest bytes fail sha before object validation',()=>{
  const x=valid();x.consentEvidence.rawManifestBytes[0]^=1;
  blocked(x,'C_OPERATOR_OWNER_CONSENT_BYTES_NOT_VERIFIED');
});
test('candidate differs from pinned owner consent manifest',()=>{
  const x=valid();x.manifest.workflowPutCount=1;
  blocked(x,'C_OPERATOR_CONSENT_MANIFEST_MISMATCH');
});
test('mismatched exact operator/package/source-lock bytes fail closed',()=>{
  for(const [key,code] of [
    ['operatorBytes','C_OPERATOR_OPERATOR_BYTES_NOT_PINNED'],
    ['packageBytes','C_OPERATOR_PACKAGE_BYTES_NOT_PINNED'],
    ['sourceLockBytes','C_OPERATOR_SOURCE_LOCK_BYTES_NOT_PINNED'],
  ]){
    const x=valid();x[key]=Buffer.from('unexpected content');
    blocked(x,code);
  }
});
test('false consent receipt pinned artifact digest is refused',()=>{
  const x=valid();x.consentEvidence.packageSha256='f'.repeat(64);
  blocked(x,'C_OPERATOR_CONSENT_MANIFEST_MISMATCH');
});
test('all 10 original physical pins must match even when new manifest is internally consistent',()=>{
  for(const key of keys){
    const x=valid();
    x.manifest.originalPins[key]='f'.repeat(64);
    repinManifest(x);
    blocked(x,'C_CONTINUATION_FRESH_PHYSICAL_OR_MARKER_MISMATCH');
  }
});
test('new scoped consent cannot authenticate a different issue or unsigned effect changes',()=>{
  const x=valid();x.consentEvidence.issueNumber=1217;
  blocked(x,'C_OPERATOR_OWNER_CONSENT_BYTES_NOT_VERIFIED');
  for(const field of ['workflowPutCount','backlogWriteCount',
    'originalRequestRetryCount','issuePostCount']){
    const y=valid();y.manifest[field]=1;
    repinManifest(y);
    blocked(y,'C_CONTINUATION_NEW_EXACT_SCOPE_MANIFEST_REQUIRED');
  }
  const z=valid();z.manifest.effects=[...CONTINUATION_EFFECTS].reverse();
  repinManifest(z);
  blocked(z,'C_CONTINUATION_NEW_EXACT_SCOPE_MANIFEST_REQUIRED');
});
test('old owner active, archive collision and marker drift block',()=>{
  for(const key of ['oldCOwnerAlive','archiveDestinationExists',
    'markerDetailsVerified']){
    const x=valid();x.physical[key]=key==='markerDetailsVerified'?false:true;
    blocked(x,'C_CONTINUATION_FRESH_PHYSICAL_OR_MARKER_MISMATCH');
  }
});
test('foreign install/concurrent C owner is a scoped hard stop',()=>{
  for(const key of ['foreignInstallOwnerCount','otherContinuationCount']){
    const x=valid();x.conflicts[key]=1;
    blocked(x,'C_CONTINUATION_SHARED_RESOURCE_CONFLICT_OR_UNKNOWN');
  }
});
test('unrelated Writer activity is not a C lease archive conflict',()=>{
  const x=valid();x.conflicts.writerActiveCount=6;
  const r=review(x);
  assert.equal(r.status,'C_OPERATOR_SOURCE_EVIDENCE_SHAPES_REVIEWED_ONLY');
  assert.equal(r.executionAuthorized,false);
});
test('84 Git bytes not verified on original PC blocks',()=>{
  const x=valid();x.gitSource.originalWindowsReadback=false;
  blocked(x,'C_CONTINUATION_84_GIT_BYTES_ORIGINAL_PC_NOT_VERIFIED');
});
test('original unresolved jobs cannot become completed or replayed',()=>{
  const x=valid();x.remote.originalIssues[0].resultVerified=true;
  blocked(x,'C_CONTINUATION_ORIGINAL_ISSUE_RECONCILIATION_INVALID');
});
test('production execution rejects before touching any supplied getters',()=>{
  let touched=0;
  const port=new Proxy({}, {get(){touched++;throw Error('MUST_NOT_CALL');}});
  const r=execute996COperator(port);
  assert.equal(r.code,'C_CONTINUATION_PRODUCTION_NOT_APPROVED');
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(touched,0);
});
