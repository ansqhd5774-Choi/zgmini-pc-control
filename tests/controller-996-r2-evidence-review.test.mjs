import test from 'node:test';
import assert from 'node:assert/strict';
import {review996ProtectedR2Evidence,review996ManifestProtectedEvidence,
 validate996ManifestProtectionBaseline} from '../tools/controller-996-r2-evidence-review.mjs';
import {createHash} from 'node:crypto';

const r2=()=>({
 schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
 requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
 issueNumber:996,observedAt:'2026-11-10T04:06:43.338Z',
 status:'CURRENT_ITEMS_MATCH_OBSERVATION',
 items:{
  files:{'config.json':'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453'},
  writerFileStatus:{'config.json':'PRESENT','quota-runner.cmd':'ABSENT',
   'run-local.cmd':'ABSENT'},
  taskSha256:{
   'ZGMINI-PC-Local-Core':'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
   'ZGMINI-PC-Local-Korea':'1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1'},
  taskEnabled:{'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true}},
 currentFingerprint:'877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86',
 originalObservationFingerprint:'877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86',
 fingerprintMatch:true,allFivePresent:false,presentWriterFileCount:1,
 historicalBaselineAvailable:false,allActorsImmutableProven:false,
 operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false,
});

test('actual operator R2 fingerprint recomputes exactly; historical gaps persist',()=>{
 const v=review996ProtectedR2Evidence(r2());
 assert.equal(v.status,'CURRENT_PROTECTION_MATCHES_R1');
 assert.equal(v.presentWriterFiles,1);
 assert.equal(v.absentWriterFiles,2);
 assert.equal(v.protectedTasksVerified,2);
 assert.equal(v.enabledTasks,2);
 assert.equal(v.historicalBaselineAvailable,false);
 assert.equal(v.workflowDisableActorVerified,false);
 assert.equal(v.executionAuthorized,false);
});

test('a changed Writer digest cannot be concealed with old aggregate text',()=>{
 const x=r2();x.items.files['config.json']='a'.repeat(64);
 assert.equal(review996ProtectedR2Evidence(x).code,'C_R2_AGGREGATE_RECOMPUTE_MISMATCH');
});

test('an absent Writer cannot pretend to have a digest',()=>{
 const x=r2();x.items.files['quota-runner.cmd']='b'.repeat(64);
 assert.equal(review996ProtectedR2Evidence(x).code,'C_R2_ABSENT_FILE_HAS_HASH');
});

test('a missing task or unknown enabled state cannot be inferred',()=>{
 const x=r2();x.items.taskEnabled['ZGMINI-PC-Local-Core']=null;
 assert.equal(review996ProtectedR2Evidence(x).code,'C_R2_PROTECTED_TASK_UNVERIFIED');
 const y=r2();delete y.items.taskSha256['ZGMINI-PC-Local-Korea'];
 assert.equal(review996ProtectedR2Evidence(y).code,'C_R2_ITEM_SET_DRIFT');
});

test('both originally enabled protected Tasks must remain enabled',()=>{
 for(const task of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']){
  const x=r2();x.items.taskEnabled[task]=false;
  assert.equal(review996ProtectedR2Evidence(x).code,'C_R2_PROTECTED_TASK_UNVERIFIED');
 }
});

test('declaring historical evidence or approval without source proof is rejected',()=>{
 const x=r2();x.historicalBaselineAvailable=true;
 assert.equal(review996ProtectedR2Evidence(x).code,'C_R2_AUTHORITY_OR_HISTORICAL_GAP_DRIFT');
 const y=r2();y.executionAuthorized=true;
 assert.equal(review996ProtectedR2Evidence(y).code,'C_R2_AUTHORITY_OR_HISTORICAL_GAP_DRIFT');
});

function successor(){
 const current=r2();current.items.files['config.json']='53533eab16c0d62301450129cfe81aefcd7a56a45c97a20d536b32c526c3d72a';
 current.currentFingerprint=createHash('sha256').update(JSON.stringify({files:current.items.files,tasks:current.items.taskSha256})).digest('hex');
 current.status='CURRENT_ITEMS_DIFFER_OR_UNPROVEN';current.fingerprintMatch=false;
 return {current,baseline:{schema:'ZGMINI_CONTROLLER_996_MANIFEST_PROTECTION_BASELINE_V1',
  historicalFingerprint:current.originalObservationFingerprint,fingerprint:current.currentFingerprint,
  items:structuredClone(current.items),evidence:[{repository:'ansqhd5774-Choi/zgmini-pc-control',
   issueNumber:1321,commit:'a'.repeat(40),path:'results/43233846597-1-seat-5.json',sha256:'b'.repeat(64)}]}};
}
test('manifest baseline compares current items without rewriting historical R2 or granting authority',()=>{
 const {current,baseline}=successor();
 assert.equal(review996ProtectedR2Evidence(current).status,'EVIDENCE_UNVERIFIED');
 const r=review996ManifestProtectedEvidence(current,baseline);
 assert.equal(r.status,'CURRENT_PROTECTION_MATCHES_MANIFEST_BASELINE');
 assert.equal(r.historicalFingerprintMatches,false);assert.equal(r.executionAuthorized,false);
 assert.equal(r.evidenceAuthenticated,false);assert.equal(r.baselineAuthority,'EXACT_OWNER_MANIFEST_CONSENT_REQUIRED');
});
test('changed current bytes, hidden absent files and disabled tasks cannot match a manifest baseline',()=>{
 for(const change of [x=>x.items.files['config.json']='c'.repeat(64),
  x=>x.items.files['quota-runner.cmd']='c'.repeat(64),x=>x.items.taskEnabled['ZGMINI-PC-Local-Core']=false]){
  const {current,baseline}=successor();change(current);
  assert.equal(review996ManifestProtectedEvidence(current,baseline).status,'EVIDENCE_UNVERIFIED');
 }
});
test('baseline validation rejects malformed provenance, forged aggregates and permission flags',()=>{
 for(const change of [b=>b.approved=true,b=>b.fingerprint='c'.repeat(64),b=>b.items.taskEnabled['ZGMINI-PC-Local-Korea']=false,
  b=>b.evidence=[],b=>b.evidence[0].path='results/../../secret.json',b=>b.evidence[0].repository='other/repo',
  b=>b.items.files['run-local.cmd']='c'.repeat(64)]){
  const {current,baseline}=successor();change(baseline);
  assert.equal(validate996ManifestProtectionBaseline(baseline),false);
  assert.equal(review996ManifestProtectedEvidence(current,baseline).code,'C_R2_MANIFEST_BASELINE_INVALID');
 }
});
