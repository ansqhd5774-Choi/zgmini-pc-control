import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {create996NativeOperator,review996PrePutOwnerConsent}
 from '../tools/controller-996-native-operator.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const FINGERPRINT='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const ORIGINAL='d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780';
const COMMIT='b'.repeat(40);
const HASH='a'.repeat(64);
const toRun={manifestCommitSha:COMMIT};
const pinnedOwnerConsent=Object.freeze({
 status:'READONLY_PINNED_OWNER_C_CONSENT_REVIEWED',
 manifestSha256:HASH,manifestCommitSha:COMMIT,originalRequestId:REQ,
 protectedFingerprint:FINGERPRINT,consentCommentId:123456,
 executionAuthorized:false,
});

function fixture(t,overrides={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>{assert.match(path.basename(root),/^zgmini-996-test-/);
  fs.rmSync(root,{recursive:true,force:true});});
 const events=[];
 const call=(name,result)=>()=>{events.push(name);return result;};
 const ports={
  approval:call('APPROVAL',pinnedOwnerConsent),
  fresh:call('FRESH',{status:'FRESH_ORIGINAL_WINDOWS_R1_R2_MATCH_PINNED',
   rawDigestsVerified:7,checksVerified:16,protectedFingerprint:FINGERPRINT,
   protectedTasksEnabled:2}),
  reserveClaim:call('CLAIM',{requestId:REQ,issueNumber:996,pid:process.pid,
   nonce:'12345678-abcd-4567-abcd-123456789012'}),
  ownedFresh:call('OWNED',{status:'FRESH_OWN_CLAIM_R1_R2_MATCH_PINNED',
   ownCClaimVerified:true,protectedFingerprint:FINGERPRINT}),
  record:(name,details)=>{events.push(name);assert.ok(details);return HASH;},
  prepareWorkflow:call('WORKFLOW_INTENT',{}),
  beforeWorkflowPut:call('BEFORE_PUT',true),
  enableWorkflow:call('WORKFLOW_PUT',true),
  verifyWorkflow:call('WORKFLOW_ACTIVE',true),
  closeBacklog:call('BACKLOG_CLOSE',{originalSha:ORIGINAL,nextSha:HASH,
   resumeAt:'2026-11-10T12:00:00.000Z'}),
  originalDispositions:call('GITHUB_RESULTS',{
   status:'READONLY_RESULTS_RECONCILED',listingComplete:true,
   commentsComplete:true,issueScans:2,issuePosts:0,pcRetries:0,
   originalIssueCount:2,entries:[
    {originIssue:1001,requestId:'original-1',disposition:'RESULT_PRESENT',
     verification:{status:'RESULT_PAIR_VERIFIED',resultStatus:'PASS',
      resultCode:'GOOD',summaryOnly:false}},
    {originIssue:1002,requestId:'original-2',disposition:'REPLAN',
     verification:{status:'RESULT_PAIR_INCOMPLETE'}}]}),
  postcheck:(phase,owner)=>{events.push(phase);
   assert.equal(owner.nonce,'12345678-abcd-4567-abcd-123456789012');
   assert.equal(owner.pid,process.pid);
   return {
   status:'READONLY_PHASE_PHYSICAL_STATE_MATCHES_PINNED',phase,
   originalLeaseArchived:phase!=='BACKLOG_CLOSED',
   ownClaimArchived:phase==='FINAL_ARCHIVED',backlogSha256:HASH};},
  archiveOriginal:call('ARCHIVE_ORIGINAL',true),
  archiveOwn:call('ARCHIVE_OWN',true),
  ...overrides,
 };
 const operator=create996NativeOperator({testOnly:true,testRoot:root,
  bindings:ports});
 return {operator,events};
}

test('full 18-phase sequence keeps unresolved original jobs for owner replan',async t=>{
 const {operator,events}=fixture(t);
 const r=await operator.run(toRun);
 assert.equal(r.status,'SIMULATED_NATIVE_OPERATOR_SEQUENCE');
 assert.equal(r.code,'NO_REAL_WINDOWS_EFFECT');
 assert.equal(r.physicalPostcheckVerified,false);
 assert.equal(r.originalIssueCount,2);
 assert.equal(r.verifiedPass,1);
 assert.equal(r.ownerReplanRequired,1);
 assert.equal(r.originalJobStatusesAllPass,false);
 assert.match(r.dispositionSha256,/^[0-9a-f]{64}$/);
 assert.equal(r.workflowPutAttempts,1);
 assert.equal(r.backlogCloseAttempts,1);
 assert.equal(r.originalLeaseArchiveAttempts,1);
 assert.equal(r.ownClaimArchiveAttempts,1);
 assert.equal(r.controllerInstalls,0);
 assert.equal(r.originalPcJobRetries,0);
 assert.equal(r.issuePosts,0);
 assert.deepEqual(events,[
  'APPROVAL','FRESH','CLAIM','OWNED','PREPARED',
  'WORKFLOW_INTENT','BEFORE_PUT','WORKFLOW_PUT','WORKFLOW_ACTIVE',
  'BACKLOG_CLOSE','GITHUB_RESULTS','BACKLOG_CLOSED','PRE_ARCHIVE',
  'ORIGINAL_LEASE_ARCHIVE_ATTEMPTED','ARCHIVE_ORIGINAL',
  'ORIGINAL_LEASE_ARCHIVED','COMPLETE',
  'OWN_CLAIM_ARCHIVE_ATTEMPTED','ARCHIVE_OWN','FINAL_ARCHIVED']);
});

test('GitHub approval missing blocks without reserving any Claim',async t=>{
 const {operator,events}=fixture(t,{approval:()=>{
  events.push('NO_CONSENT');
  return {status:'C_NOT_READY',executionAuthorized:false};}});
 const r=await operator.run(toRun);
 assert.equal(r.status,'C_NOT_STARTED');
 assert.equal(r.failedStep,'APPROVAL');
 assert.equal(r.workflowPutAttempts,0);
 assert.deepEqual(events,['NO_CONSENT']);
});

test('fresh protected R2 drift blocks before a Claim write',async t=>{
 const {operator,events}=fixture(t,{fresh:()=>{
  events.push('FRESH_DRIFT');return {status:'C_FRESH_READBACK_UNVERIFIED'};}});
 const r=await operator.run(toRun);
 assert.equal(r.status,'C_NOT_STARTED');
 assert.equal(r.failedStep,'FRESH_PREFLIGHT');
 assert.equal(r.workflowPutAttempts,0);
 assert.ok(!events.includes('CLAIM'));
});

test('a Claim directory may exist after failed owner write; never retry',async t=>{
 const {operator,events}=fixture(t,{reserveClaim:()=>{
  events.push('MKDIR_THEN_OWNER_WRITE_FAILED');
  throw Object.assign(Error('uncertain'),{code:'C_RECOVERY_CLAIM_CREATE_UNCERTAIN'});}});
 const r=await operator.run(toRun);
 assert.equal(r.status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
 assert.equal(r.code,'C_RECOVERY_CLAIM_CREATE_UNCERTAIN');
 assert.equal(r.claimMayExist,true);
 assert.ok(!events.includes('OWNED'));
 const again=await operator.run(toRun);
 assert.equal(again.code,'C_OPERATOR_ALREADY_ATTEMPTED');
 assert.ok(!events.includes('WORKFLOW_PUT'));
});

test('PUT ACK/timeout loss consumes exactly one attempt and stops before backlog',async t=>{
 const {operator,events}=fixture(t,{enableWorkflow:()=>{
  events.push('PUT_TIMEOUT');throw Object.assign(Error('timeout'),{
   code:'C_WORKFLOW_ENABLE_OUTCOME_UNKNOWN'});}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'WORKFLOW_ENABLE_ONCE');
 assert.equal(r.code,'C_WORKFLOW_ENABLE_OUTCOME_UNKNOWN');
 assert.equal(r.workflowPutAttempts,1);
 assert.equal(r.backlogCloseAttempts,0);
 assert.ok(!events.includes('BACKLOG_CLOSE'));
});

test('source or GitHub provenance drift after intent stops before Workflow PUT',async t=>{
 const {operator,events}=fixture(t,{beforeWorkflowPut:()=>{
  events.push('SOURCE_DRIFT');
  throw Object.assign(Error('installed source changed'),{
   code:'C_OPERATOR_PRE_PUT_WRITER_SOURCE_UNVERIFIED'});}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'PRE_PUT_REVALIDATION');
 assert.equal(r.workflowPutAttempts,0);
 assert.equal(r.claimMayExist,true);
 assert.ok(events.includes('WORKFLOW_INTENT'));
 assert.ok(!events.includes('WORKFLOW_PUT'));
 assert.ok(!events.includes('BACKLOG_CLOSE'));
});

test('Workflow active readback failure does not close backlog or archive lease',async t=>{
 const {operator,events}=fixture(t,{verifyWorkflow:()=>{
  events.push('ACTIVE_UNKNOWN');throw Error('GET unavailable');}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'WORKFLOW_ACTIVE_READBACK');
 assert.equal(r.workflowPutAttempts,1);
 assert.equal(r.backlogCloseAttempts,0);
 assert.ok(!events.includes('ARCHIVE_ORIGINAL'));
});

test('pre-PUT immutable owner consent refresh accepts only the same pinned comment',()=>{
 assert.equal(review996PrePutOwnerConsent({first:pinnedOwnerConsent,
  refreshed:{...pinnedOwnerConsent},manifestCommitSha:COMMIT}),true);
 assert.throws(()=>review996PrePutOwnerConsent({first:pinnedOwnerConsent,
  refreshed:{...pinnedOwnerConsent,consentCommentId:123457},
  manifestCommitSha:COMMIT}),/C_OPERATOR_PRE_PUT_CONSENT_IDENTITY_DRIFT/);
 assert.throws(()=>review996PrePutOwnerConsent({first:pinnedOwnerConsent,
  refreshed:{...pinnedOwnerConsent,manifestSha256:'c'.repeat(64)},
  manifestCommitSha:COMMIT}),/C_OPERATOR_PRE_PUT_CONSENT_IDENTITY_DRIFT/);
 assert.throws(()=>review996PrePutOwnerConsent({first:pinnedOwnerConsent,
  refreshed:{...pinnedOwnerConsent,manifestCommitSha:'d'.repeat(40)},
  manifestCommitSha:COMMIT}),/C_OPERATOR_PRE_PUT_CONSENT_IDENTITY_DRIFT/);
});

test('owner revocation in the sole pre-PUT GET halts with marker preserved and PUT zero',async t=>{
 let ownerGetRounds=0;
 const {operator,events}=fixture(t,{beforeWorkflowPut:()=>{
  events.push('NEW_OWNER_COMMENT_GET');ownerGetRounds++;
  return review996PrePutOwnerConsent({first:pinnedOwnerConsent,
   refreshed:{status:'C_NOT_READY',code:'CONSENT_REVOKED',executionAuthorized:false},
   manifestCommitSha:COMMIT});
 }});
 const r=await operator.run(toRun);
 assert.equal(r.status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
 assert.equal(r.code,'C_OPERATOR_PRE_PUT_CONSENT_REVOKED');
 assert.equal(r.failedStep,'PRE_PUT_REVALIDATION');
 assert.equal(r.workflowPutAttempts,0);
 assert.equal(r.backlogCloseAttempts,0);
 assert.equal(ownerGetRounds,1);
 assert.ok(events.includes('WORKFLOW_INTENT'));
 assert.ok(!events.includes('WORKFLOW_PUT'));
 assert.ok(!events.includes('ARCHIVE_ORIGINAL'));
 const again=await operator.run(toRun);
 assert.equal(again.code,'C_OPERATOR_ALREADY_ATTEMPTED');
 assert.equal(ownerGetRounds,1);
});

test('unverified or failed late consent blocks the one-shot Workflow PUT',async t=>{
 const {operator,events}=fixture(t,{beforeWorkflowPut:()=>{
  events.push('OWNER_GET_HTTP_FAILED');
  return review996PrePutOwnerConsent({first:pinnedOwnerConsent,
   refreshed:{status:'C_NOT_READY',code:'C_GITHUB_READ_FAILED_OR_UNVERIFIABLE'},
   manifestCommitSha:COMMIT});
 }});
 const r=await operator.run(toRun);
 assert.equal(r.code,'C_OPERATOR_PRE_PUT_CONSENT_UNVERIFIED');
 assert.equal(r.workflowPutAttempts,0);
 assert.ok(events.includes('WORKFLOW_INTENT'));
 assert.ok(!events.includes('WORKFLOW_PUT'));
});

test('backlog rename/readback uncertainty never issues a second close',async t=>{
 const {operator,events}=fixture(t,{closeBacklog:()=>{
  events.push('RENAMED_BUT_GET_UNKNOWN');throw Error('post-rename error');}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'BACKLOG_CLOSE_ONCE');
 assert.equal(r.backlogCloseAttempts,1);
 assert.equal(r.originalLeaseArchiveAttempts,0);
 assert.ok(!events.includes('GITHUB_RESULTS'));
});

test('incomplete original GitHub scan preserves both Claims and existing lease',async t=>{
 const {operator,events}=fixture(t,{originalDispositions:()=>{
  events.push('RESULT_READ_FAIL');throw Error('HTTP fail');}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'ORIGINAL_JOB_DISPOSITIONS');
 assert.equal(r.backlogCloseAttempts,1);
 assert.equal(r.originalLeaseArchiveAttempts,0);
 assert.ok(!events.includes('PRE_ARCHIVE'));
});

test('after original lease rename error, one attempt and no COMPLETE marker',async t=>{
 const {operator,events}=fixture(t,{archiveOriginal:()=>{
  events.push('ORIGINAL_ARCHIVE_READBACK_FAIL');throw Error('uncertain');}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'ORIGINAL_LEASE_ARCHIVE_ONCE');
 assert.equal(r.status,'STATE_UNKNOWN_CHECK_ARCHIVED_ORIGINAL_LEASE');
 assert.equal(r.originalLeaseArchiveAttempts,1);
 assert.equal(r.originalLeaseMayBeArchived,true);
 assert.ok(!events.includes('COMPLETE'));
});

test('after own Claim archive final read failure must not claim completion',async t=>{
 const {operator,events}=fixture(t,{postcheck:phase=>{
  events.push(phase);
  if(phase==='FINAL_ARCHIVED')throw Error('final GET failed');
  return {status:'READONLY_PHASE_PHYSICAL_STATE_MATCHES_PINNED',phase,
   originalLeaseArchived:phase!=='BACKLOG_CLOSED',
   ownClaimArchived:false,backlogSha256:HASH};}});
 const r=await operator.run(toRun);
 assert.equal(r.failedStep,'FINAL_INDEPENDENT_POSTCHECK');
 assert.equal(r.status,'STATE_UNKNOWN_CHECK_ARCHIVED_C_CLAIM');
 assert.equal(r.ownClaimArchiveAttempts,1);
 assert.equal(r.ownClaimMayBeArchived,true);
 assert.ok(events.includes('COMPLETE'));
});

test('production refuses non-original Windows and injecting custom ports',()=>{
 assert.throws(()=>create996NativeOperator(),/C_OPERATOR_ORIGINAL_WINDOWS_ONLY/);
 assert.throws(()=>create996NativeOperator({bindings:{}}),
  /C_OPERATOR_ORIGINAL_WINDOWS_ONLY/);
});

test('operator source never auto-posts Issues or replays original pc-job',()=>{
 const body=fs.readFileSync(new URL('../tools/controller-996-native-operator.mjs',
  import.meta.url),'utf8');
 assert.ok(!body.includes('simulate996CTransaction('));
 assert.ok(!body.includes('execFileSync('));
 assert.ok(!body.includes('fs.renameSync('));
 assert.ok(!body.includes('issues.create('));
 assert.ok(!body.includes('workflow_dispatch'));
});
