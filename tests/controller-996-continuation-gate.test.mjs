import test from 'node:test';
import assert from 'node:assert/strict';
import {review996ContinuationGate} from
  '../tools/controller-996-continuation-gate.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ID='70a4c347-25ea-4fc6-83d2-c0c670115249';
const pins=Object.fromEntries([
  'oldC','installOwner','installRecovery','backlog','installed','stage',
  'maintainer','PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED',
].map((k,i)=>[k,String(i).padStart(64,'0')]));
function valid(){
  const manifest={
    schema:'ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1',
    approved:true,grade:'C',operation:'ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE',
    issueNumber:996,originalRequestId:REQ,continuationRequestId:ID,
    operatorCommit:'a'.repeat(40),operatorSha256:'a'.repeat(64),
    packageSha256:'b'.repeat(64),sourceLockSha256:'c'.repeat(64),
    originalPins:structuredClone(pins),
    effects:['RESERVE_INDEPENDENT_CONTINUATION_C_CLAIM',
      'WRITE_SCOPED_DURABLE_RECOVERY_MARKERS',
      'ARCHIVE_ABANDONED_C_CLAIM_NO_DELETE',
      'ARCHIVE_INDEPENDENT_CONTINUATION_C_CLAIM',
      'VERIFY_DURABLE_READY_TO_RELEASE_INSTALL',
      'ARCHIVE_ORIGINAL_INSTALL_LEASE_LAST_NO_DELETE'],
    workflowPutCount:0,backlogWriteCount:0,
    originalRequestRetryCount:0,issuePostCount:0,
  };
  return {
    manifest,
    manifestProof:{status:'IMMUTABLE_GIT_MANIFEST_BYTES_VERIFIED',
      repository:'ansqhd5774-Choi/zgmini-pc-control',
      gitCommit:'d'.repeat(40),manifestSha256:'e'.repeat(64),
      contentMatchesCandidate:true},
    consent:{status:'NEW_CONTINUATION_C_RECEIPT_INDEPENDENTLY_VERIFIED',
      continuationRequestId:ID,manifestSha256:'e'.repeat(64),
      revoked:false,oldConsentReused:false,
      operatorSha256:manifest.operatorSha256,
      packageSha256:manifest.packageSha256,
      sourceLockSha256:manifest.sourceLockSha256},
    gitSource:{status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
      installed:38,staged:39,maintainer:7,total:84,
      executionAuthorized:false,originalWindowsReadback:true},
    physical:{status:'FRESH_ORIGINAL_WINDOWS_C_PREWRITE_MATCHES',
      originalRequestId:REQ,oldCClaimExists:true,installLeaseExists:true,
      oldCOwnerAlive:false,installOwnerAlive:false,
      newContinuationClaimExists:false,archiveDestinationExists:false,
      workflowState:'active',protectionVerified:true,replayCount:0,
      replayJournalEmpty:true,markersExact:true,markerDetailsVerified:true,
      twoSnapshotsIdentical:true,shaPins:structuredClone(pins)},
    remote:{status:'FRESH_GITHUB_READ_ONLY_RECONCILED',
      originalIssueNumber:996,originalRequestId:REQ,workflowState:'active',
      replayDispatches:0,originalIssues:[1217,1219,1226,1227].map(issueNumber=>({
        issueNumber,state:'open',resultVerified:false,
        nextAction:'OWNER_REPLAN_REVIEW_REQUIRED'}))},
    conflicts:{scope:'CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES',
      foreignInstallOwnerCount:0,otherContinuationCount:0,
      twoSnapshotsIdentical:true,fresh:true,writerActiveCount:0},
  };
}
test('stale consent effects releasing install before continuation are invalid',()=>{
  const x=valid();
  x.manifest.effects=[
    'RESERVE_INDEPENDENT_CONTINUATION_C_CLAIM',
    'WRITE_SCOPED_DURABLE_RECOVERY_MARKERS',
    'ARCHIVE_ABANDONED_C_CLAIM_NO_DELETE',
    'ARCHIVE_ORIGINAL_INSTALL_LEASE_LAST_NO_DELETE',
    'ARCHIVE_INDEPENDENT_CONTINUATION_C_CLAIM',
  ];
  const r=review996ContinuationGate(x);
  assert.equal(r.code,'C_CONTINUATION_NEW_EXACT_SCOPE_MANIFEST_REQUIRED');
  assert.equal(r.executionAuthorized,false);
});
const check=x=>review996ContinuationGate(x);

test('all synthetic requirements only produce a NON-AUTHORIZING review',()=>{
  const r=check(valid());
  assert.equal(r.status,'C_CONTINUATION_EVIDENCE_SHAPES_REVIEWED_ONLY');
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.originalUnresolvedIssues,4);
});
test('old phase-scoped C consent cannot be reused',()=>{
  const x=valid();x.manifest.schema='ZGMINI_CONTROLLER_996_C_APPROVAL_V1';
  assert.equal(check(x).code,'C_CONTINUATION_NEW_EXACT_SCOPE_MANIFEST_REQUIRED');
});
test('new exact approval rejects Workflow PUT or old request retry',()=>{
  for(const key of ['workflowPutCount','backlogWriteCount',
    'originalRequestRetryCount','issuePostCount']){
    const x=valid();x.manifest[key]=1;
    assert.equal(check(x).code,'C_CONTINUATION_NEW_EXACT_SCOPE_MANIFEST_REQUIRED');
  }
});
test('manifest Git origin must not be supplied as a self-hash field',()=>{
  const x=valid();x.manifestProof.contentMatchesCandidate=false;
  assert.equal(check(x).code,'C_CONTINUATION_MANIFEST_ORIGIN_UNVERIFIED');
});
test('revoked or copied old receipt is rejected',()=>{
  for(const prop of ['revoked','oldConsentReused']){
    const x=valid();x.consent[prop]=true;
    assert.equal(check(x).code,
      'C_CONTINUATION_NEW_CONSENT_NOT_INDEPENDENTLY_VERIFIED');
  }
});
test('mismatched source lock or ZIP byte digest stops review',()=>{
  for(const prop of ['sourceLockSha256','packageSha256','operatorSha256']){
    const x=valid();x.consent[prop]='f'.repeat(64);
    assert.equal(check(x).code,
      'C_CONTINUATION_NEW_CONSENT_NOT_INDEPENDENTLY_VERIFIED');
  }
});
test('mock-only source success is insufficient without original Windows proof',()=>{
  const x=valid();x.gitSource.originalWindowsReadback=false;
  assert.equal(check(x).code,
    'C_CONTINUATION_84_GIT_BYTES_ORIGINAL_PC_NOT_VERIFIED');
});
test('old marker detail drift is not accepted',()=>{
  const x=valid();x.physical.markerDetailsVerified=false;
  assert.equal(check(x).code,'C_CONTINUATION_FRESH_PHYSICAL_OR_MARKER_MISMATCH');
});
test('old owner is alive or claimed archive destination exists',()=>{
  for(const prop of ['oldCOwnerAlive','archiveDestinationExists']){
    const x=valid();x.physical[prop]=true;
    assert.equal(check(x).code,'C_CONTINUATION_FRESH_PHYSICAL_OR_MARKER_MISMATCH');
  }
});
test('physical pin drift prevents the recovery handoff',()=>{
  const x=valid();x.physical.shaPins.oldC='f'.repeat(64);
  assert.equal(check(x).code,'C_CONTINUATION_FRESH_PHYSICAL_OR_MARKER_MISMATCH');
});
test('four unresolved issues cannot be marked successful or replayed',()=>{
  const x=valid();x.remote.originalIssues[0].resultVerified=true;
  assert.equal(check(x).code,'C_CONTINUATION_ORIGINAL_ISSUE_RECONCILIATION_INVALID');
  const y=valid();y.remote.replayDispatches=1;
  assert.equal(check(y).code,'C_CONTINUATION_ORIGINAL_ISSUE_RECONCILIATION_INVALID');
});
test('foreign install owner or overlapping C contention blocks the review',()=>{
  for(const prop of ['foreignInstallOwnerCount','otherContinuationCount']){
    const x=valid();x.conflicts[prop]=1;
    assert.equal(check(x).code,
      'C_CONTINUATION_SHARED_RESOURCE_CONFLICT_OR_UNKNOWN');
  }
});
test('unrelated Writer activity does not block lease-only recovery review',()=>{
  const x=valid();x.conflicts.writerActiveCount=9;
  const r=check(x);
  assert.equal(r.status,'C_CONTINUATION_EVIDENCE_SHAPES_REVIEWED_ONLY');
  assert.equal(r.executionAuthorized,false);
});
test('unscoped, stale, or single-snapshot conflict evidence is rejected',()=>{
  for(const [key,value] of [['scope','ALL_WRITERS'],['fresh',false],
    ['twoSnapshotsIdentical',false],['foreignInstallOwnerCount',undefined]]){
    const x=valid();x.conflicts[key]=value;
    assert.equal(check(x).code,
      'C_CONTINUATION_SHARED_RESOURCE_CONFLICT_OR_UNKNOWN');
  }
});
