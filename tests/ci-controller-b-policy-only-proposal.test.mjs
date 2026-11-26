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
