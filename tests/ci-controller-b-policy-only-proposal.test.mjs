import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 nextRuntimeFiles,requireHandoffApproval,approvedPolicyOnlyHandoff,
 approvedHandoffCiPolicy,handoffFilePlan
} from '../tools/handoff-maintenance.mjs';

const proposal=JSON.parse(readFileSync(
 new URL('../proposals/maintenance-handoffs/905c0b1806a3988f39400dc82536fd753b9ff764.json',import.meta.url),'utf8'
));
const installedSha='b08f3a482e9bb39523f47675ae06bc6e02e01d2d';
const candidateSha='905c0b1806a3988f39400dc82536fd753b9ff764';
const oldWorkflow='27e48ecde81bdf6f15cccffcffd9b3e70482a5f3';
const proposedWorkflow='a31972f47badcd35b0ffffa61721a93308d23067';
const runtimeFiles=Object.fromEntries(nextRuntimeFiles.map(rel=>[rel,proposal.files[rel]]));
const before=()=>({
 schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
 sourceSha:installedSha,
 startupSha256:'a'.repeat(64),
 files:{...runtimeFiles},
 ciControllerBPolicy:{
  schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',enabled:true,
  workflowId:430972394,workflowBlobSha:oldWorkflow,
  workflowPath:'.github/workflows/ci-approval-controller-b.yml',
 }
});

test('review-only B policy source is not an executable approved handoff',()=>{
 assert.equal(proposal.schema,'ZGMINI_MAINTENANCE_HANDOFF_V2');
 assert.equal(proposal.transition,'SEVEN_TO_SEVEN');
 assert.equal(proposal.installedSha,installedSha);
 assert.equal(proposal.targetSha,candidateSha);
 assert.equal(proposal.approved,false);
 assert.match(proposal.approvalBasis,/PROPOSED_NOT_APPROVED/);
 assert.equal(proposal.runtimeChangedFiles.length,0);
 assert.equal(Object.hasOwn(proposal,'ciNativeApproval'),false);
 assert.throws(()=>requireHandoffApproval(proposal,candidateSha,installedSha),
  /HANDOFF_APPROVAL_REQUIRED/);
 assert.equal(approvedPolicyOnlyHandoff(before(),proposal,candidateSha),false);
 assert.throws(()=>handoffFilePlan('SEVEN_TO_SEVEN',runtimeFiles,proposal.files,{
  before:before(),approval:proposal,target:candidateSha,
 }),/HANDOFF_NO_RUNTIME_CHANGE/);
});

test('all nine immutable installed maintainer bytes are equal to proposal SHA256 pins',()=>{
 assert.equal(Object.keys(proposal.files).length,9);
 assert.equal(nextRuntimeFiles.length,7);
 for(const [rel,expected] of Object.entries(proposal.files)){
  assert.match(expected,/^[a-f0-9]{64}$/);
  const actual=createHash('sha256').update(
   readFileSync(new URL('../'+rel,import.meta.url))).digest('hex');
  assert.equal(actual,expected,'immutable protected maintainer file: '+rel);
 }
});

test('hypothetically independently approved exact policy-only 7-to-7 changes zero runtime files',()=>{
 const approved={...proposal,approved:true};
 const pre=before();
 assert.equal(requireHandoffApproval(approved,candidateSha,installedSha),'SEVEN_TO_SEVEN');
 assert.equal(approvedPolicyOnlyHandoff(pre,approved,candidateSha),true);
 assert.deepEqual(handoffFilePlan('SEVEN_TO_SEVEN',pre.files,approved.files,{
  before:pre,approval:approved,target:candidateSha,
 }).writes,[]);
 const next={...pre,sourceSha:candidateSha,files:{...runtimeFiles}};
 assert.deepEqual(approvedHandoffCiPolicy(pre,approved,next),approved.ciControllerBPolicy);
 assert.equal(approved.ciControllerBPolicy.workflowBlobSha,proposedWorkflow);
 assert.notEqual(proposedWorkflow,oldWorkflow);
 // This test uses an in-memory synthetic Owner approval. Source file remains false.
 assert.equal(proposal.approved,false);
});

test('new policy cannot change independent identity or silently become a no-op',()=>{
 const pre=before();
 for(const wrong of [
  {workflowBlobSha:oldWorkflow},
  {workflowId:1},
  {workflowPath:'other.yml'},
  {enabled:false},
  {schema:'INVALID_POLICY'},
 ]){
  const candidate={...proposal,approved:true,
   ciControllerBPolicy:{...proposal.ciControllerBPolicy,...wrong}};
  assert.equal(approvedPolicyOnlyHandoff(pre,candidate,candidateSha),false);
 }
 assert.equal(proposal.ciControllerBPolicy.workflowBlobSha,proposedWorkflow);
 assert.match(proposal.checks.installedWindowsEvidence,/45905232182/);
 assert.match(proposal.checks.preflight,/Owner|Windows|source/);
});


test('R6 held policy proposal is non-executable even if a future recovery is claimed',()=>{
 const h=proposal.approvalHold;
 assert.equal(h.state,'USER_DEFERRED');
 assert.equal(h.effectiveDate,'2026-11-27');
 assert.equal(h.authorization,'NONE');
 assert.equal(proposal.approved,false);
 assert.equal(h.resumeReviewOnlyAfter.length,5);
 assert.equal(h.prohibitedEffects.length,4);
 assert.match(h.resumeReviewOnlyAfter[0],/Supervisor alive/);
 assert.match(h.resumeReviewOnlyAfter[1],/HEALTHY/);
 assert.match(h.resumeReviewOnlyAfter[2],/READY.*2\/2/);
 assert.match(h.resumeReviewOnlyAfter[3],/CAS|manifest SHA256/);
 assert.match(h.resumeReviewOnlyAfter[4],/Owner/);
 assert.match(proposal.scopeNote,/USER_DEFERRED/);
 const reviewed={...proposal,approvalHold:{...h,state:'REVIEW_ELIGIBLE'}};
 assert.equal(reviewed.approved,false);
 assert.throws(()=>requireHandoffApproval(reviewed,candidateSha,installedSha),
  /HANDOFF_APPROVAL_REQUIRED/);
});

test('original post-R6 Windows evidence does not establish Supervisor, HEALTHY and READY2',()=>{
 const result=name=>JSON.parse(readFileSync(
  new URL('../results/'+name,import.meta.url),'utf8'));
 const r6=result('pc-process-inventory-45907705042-1-operating.json');
 const pc=result('pc-process-inventory-45907709067-1-operating.json');
 const wmi=result('pc-process-inventory-45908087228-1-operating.json');
 assert.equal(r6.runId,proposal.approvalHold.evidence.r6Run);
 assert.equal(r6.watchdogR6Runtime.code,'WATCHDOG_R6_HEALTH_STATUS_UNVERIFIED');
 assert.equal(r6.watchdogR6Runtime.naturalRestartObserved,true);
 assert.equal(r6.watchdogR6Runtime.watchdogOwnerVerified,true);
 assert.equal(r6.watchdogR6Runtime.watchdogHealthState,
  'BLOCKED_OLD_RUNNER_EXECUTABLE_UNVERIFIED');
 assert.equal(r6.watchdogR6Runtime.standbyReadyCount,0);
 assert.equal(r6.watchdogR6Runtime.activeSupervisorVerified,false);
 assert.equal(pc.runId,proposal.approvalHold.evidence.supervisorRun);
 assert.equal(pc.status,'PASS'); // The collection succeeded, not the Supervisor.
 assert.equal(pc.maintenance.runtimeSignals.supervisorAlive,false);
 assert.equal(pc.maintenance.runtimeSignals.supervisorFresh,false);
 assert.equal(pc.maintenance.runtimeSignals.supervisorChildrenVerified,false);
 assert.equal(pc.maintenance.runtimeSignals.runnerSetOnline,true);
 assert.equal(pc.maintenance.automationState,'PARTIAL_OR_UNVERIFIED');
 assert.equal(wmi.runId,proposal.approvalHold.evidence.controllerListenerWmiRun);
 assert.equal(wmi.standbyRunnerWmi.controllerListenerCount,6);
 assert.equal(wmi.standbyRunnerWmi.status,'STATE_UNKNOWN');
 assert.equal(wmi.standbyRunnerWmi.promotionApproved,false);
 assert.equal(proposal.approved,false);
});
