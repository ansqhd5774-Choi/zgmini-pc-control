import assert from 'node:assert/strict';
import test from 'node:test';
import {makeD30BManifestDraft,assessD30BApprovedEvidence,
  simulateD30BTransaction} from '../calendar-source-d30/windows-b-simulator.mjs';

const OLD='a'.repeat(40);
const proof={runtimeSourceVerified:true,
  evidenceLevel:'LIVE_CORE_EXECUTION_VERIFIED',
  sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  runtimeSourceSha:OLD,evidenceIssue:999,evidenceRequestId:'synthetic-a-result'};
function fixture(){
  const draft=makeD30BManifestDraft();
  const hashes=Object.fromEntries(draft.files.map(f=>[f.path,f.beforeSha256]));
  return {activeCore:{...proof},installedFileHashes:hashes,
    approvedBManifest:{...draft,beforeSourceSha:OLD,
      approvalEvidence:'SYNTHETIC_APPROVAL_FOR_UNIT_TEST_ONLY'}};
}

test('#682 exact three-file before/after hashes are preserved but draft is unapproved',()=>{
  const draft=makeD30BManifestDraft();
  assert.equal(draft.status,'AWAITING_PROVENANCE_AND_SEPARATE_B_APPROVAL');
  assert.equal(draft.beforeSourceSha,null);
  assert.equal(draft.approvalEvidence,null);
  assert.equal(draft.previewEvidence.sourceProvenance,'PENDING');
  assert.equal(draft.files.length,3);
  assert.equal(draft.files[1].beforeSha256,
    'f80bced7233ba9da5511a73bf324ae73a4a7c505ecf1ce9f690cb412b98b1b62');
  assert.equal(draft.files[1].afterSha256,
    'a686bf736c9a5ae274cd2dc69dd169e93ddab90f72ae273c45e765c788226ce8');
  assert.equal(draft.files[1].mergePreview.evidenceIssue,682);
});

test('real #682 PENDING source provenance cannot be promoted to B success',async()=>{
  const f=fixture();
  delete f.activeCore;
  const r=await simulateD30BTransaction(f);
  assert.equal(r.status,'SIMULATION_BLOCKED');
  assert.equal(r.code,'ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED');
  assert.equal(r.operationalWrites,0);
});

test('approval absent is a hard stop even with synthetic source proof',()=>{
  const f=fixture();
  f.approvedBManifest.approvalEvidence=null;
  const r=assessD30BApprovedEvidence(f);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.code,'ER1_D30_APPROVED_B_MANIFEST_MISSING_OR_MISMATCHED');
});

test('tampered before or after SHA cannot be hidden by later approval',()=>{
  const f=fixture();
  f.approvedBManifest.files[1].afterSha256='9'.repeat(64);
  assert.equal(assessD30BApprovedEvidence(f).code,
    'ER1_D30_B_PREVIEW_EVIDENCE_DRIFT');
  const g=fixture();g.installedFileHashes[g.approvedBManifest.files[0].path]='9'.repeat(64);
  assert.equal(assessD30BApprovedEvidence(g).code,
    'ER1_D30_FILE_SCOPE_OR_DIGEST_MISMATCH');
});

test('synthetic stage/CAS transaction verifies exact three paths, never PC installed',async()=>{
  const r=await simulateD30BTransaction({...fixture(),
    sharedLeaseGranted:true,coreQuiesced:true});
  assert.equal(r.status,'SIMULATED_B_TRANSACTION_VERIFIED');
  assert.equal(r.simulatedOnly,true);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.backupObserved,true);
});

test('shared source lease or Core quiescence missing stops before backup/writes',async()=>{
  const f=fixture();
  const a=await simulateD30BTransaction({...f,
    sharedLeaseGranted:false,coreQuiesced:true});
  assert.equal(a.code,'ER1_D30_SIM_SHARED_LEASE_STOP');
  assert.equal(a.backupObserved,false);
  const b=await simulateD30BTransaction({...f,
    sharedLeaseGranted:true,coreQuiesced:false});
  assert.equal(b.code,'ER1_D30_SIM_CORE_BUSY_STOP');
  assert.equal(b.backupObserved,false);
});

test('post-stage simulated Git commit fault causes exact backup rollback',async()=>{
  const r=await simulateD30BTransaction({...fixture(),
    sharedLeaseGranted:true,coreQuiesced:true,failAt:'commit'});
  assert.equal(r.status,'SIMULATED_ROLLED_BACK');
  assert.equal(r.code,'ER1_D30_SIM_COMMIT_FAULT');
  assert.equal(r.stateRestored,true);
  assert.equal(r.operationalWrites,0);
});
