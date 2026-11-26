import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectCiControllerBActivationReadonly as inspect} from '../tools/ci-controller-b-activation-readonly.mjs';
import {authenticateProcess,collect,SCHEMA,TITLE,ROLE_OPERATION,toText}
 from '../tools/pc-process-inventory-readonly.mjs';

const fixed={targetSha:'a'.repeat(40),sourcePrNumber:42,
 sourceMainSha:'b'.repeat(40),sourceWorkflowBlobSha:'c'.repeat(40),
 policyRevision:'d'.repeat(40),businessApprovalSha256:'e'.repeat(64),
 sourceBranch:'codex/ci-approval-source',authorityChangesExcluded:true,
 delegationPin:{issueNumber:101,commentId:102,bodySha256:'f'.repeat(64)},
 installPlan:{targetSha:'a'.repeat(40),installedSha:'b'.repeat(40),
  purpose:'pc-controller-maintenance',postOperation:'core-status',
  allowFiles:[{path:'controller/engine.mjs',sha256:'a'.repeat(64)}]}};
function run(enabled='false',policy=JSON.stringify(fixed)){
 return inspect({enabled,policy});
}
test('missing or invalid policy is a specific read-only non-authorizing result',()=>{
 const missing=run('false','');
 assert.equal(missing.code,'CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED');
 // Missing generated-approval policy is not an independent new gate for
 // existing Owner-merged B approvals. The actual publisher is still disabled.
 assert.equal(missing.ownerMergedExistingApprovalPolicyRequired,false);
 assert.equal(missing.ciGeneratedApprovalPolicyRequired,true);
 assert.equal(missing.ownerMergedExistingSubmissionVerified,false);
 assert.equal(missing.activationAuthorized,false);
 assert.equal(run('false','{broken').code,'CI_CONTROLLER_B_AUTO_POLICY_JSON_INVALID');
 assert.equal(run('true').code,'CI_CONTROLLER_B_ALREADY_ENABLED_STOP');
 assert.equal(run(null).code,'CI_CONTROLLER_B_FLAG_NOT_EXPLICITLY_DISABLED');
 assert.equal(run('false',' '.repeat(32769)).code,'CI_CONTROLLER_B_AUTO_POLICY_SIZE_DENIED');
 for(const bad of [
  {...fixed,sourcePrNumber:0},{...fixed,authorityChangesExcluded:false},
  {...fixed,delegationPin:{...fixed.delegationPin,bodySha256:'WRONG'}},
  {...fixed,installPlan:{...fixed.installPlan,targetSha:'f'.repeat(40)}},
  {...fixed,installPlan:{...fixed.installPlan,allowFiles:[]}},
  {...fixed,installPlan:{...fixed.installPlan,
    allowFiles:[{path:'tools/maintenance-agent.mjs',sha256:'a'.repeat(64)}]}}
 ]){
  assert.equal(run('false',JSON.stringify(bad)).code,'CI_CONTROLLER_B_AUTO_POLICY_FORMAT_DENIED');
 }
});
test('shape-only success cannot mint any approval, disclose policy or execute',()=>{
 const secret='NEVER_PRINT_DELEGATION_PIN_OR_ACCOUNT';
 const p={...fixed,secret};
 const x=run('false',JSON.stringify(p));
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.code,'CI_CONTROLLER_B_AUTO_POLICY_FORMAT_OBSERVED_ONLY');
 assert.equal(x.variableEnabledVerified,true);
 assert.equal(x.policyConfigured,true);
 assert.equal(x.policyShapeVerified,true);
 assert.equal(x.independentOwnerGrantVerified,false);
 assert.equal(x.activationAuthorized,false);
 assert.equal(x.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(x),/NEVER_PRINT|codex\/ci-approval-source|controller\/engine.mjs|[a-f]{64}/);
});
test('existing owner handoff Issue A accepts one exact policy probe and rejects arbitrary inputs',()=>{
 const repo='ansqhd5774-Choi/zgmini-pc-control';
 const request={schema:SCHEMA,operation:ROLE_OPERATION,requestId:'2d605c34-939e-43e4-8ca1-58d678bf3862',
  role:'handoff',probe:'ci-controller-b-activation-readonly'};
 const event={action:'opened',repository:{full_name:repo,private:true},
  issue:{number:2001,user:{login:'ansqhd5774-Choi'},title:TITLE,body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:repo,GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
  GITHUB_RUN_ID:'43110000000',GITHUB_RUN_ATTEMPT:'1'};
 const ctx=authenticateProcess(event,env,'handoff');
 assert.equal(ctx.ciControllerBActivation,true);
 assert.throws(()=>authenticateProcess({...event,issue:{...event.issue,
  body:JSON.stringify({...request,command:'secret'})}},env,'handoff'));
 assert.throws(()=>authenticateProcess(event,env,'operating'));
 const out=collect('handoff',ctx,{...env,RUNNER_NAME:'zgmini-handoff-ci-spare-01',
  COMPUTERNAME:'DESKTOP-N62L0NG',ZGMINI_CI_CONTROLLER_B_ENABLED:'false',
  ZGMINI_CI_CONTROLLER_B_POLICY:JSON.stringify(fixed)});
 // CI source tests on Windows must prove the host-specific result path.
 assert.equal(out.ciControllerBActivation?.activationAuthorized,false);
 assert.equal(out.operationalWrites,0);
 assert.doesNotMatch(toText(out),/NEVER_PRINT|sourceBranch|bodySha256/);
});
test('existing Owner-approved push path is independent of generated-approval policy',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 const publisher=readFileSync(new URL('../ci-approval/completed-run-intake.mjs',import.meta.url),'utf8');
 const request=readFileSync(new URL('../tools/maintenance-request.mjs',import.meta.url),'utf8');
 // The trigger requires ENABLED but does not require POLICY on push;
 // workflow_run generated-approval path alone has that additional gate.
 assert.match(workflow,/vars\\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.match(workflow,/github\\.event_name == 'push' &&/);
 assert.match(workflow,/github\\.event_name == 'workflow_run' &&\\s+vars\\.ZGMINI_CI_CONTROLLER_B_POLICY != ''/);
 assert.match(publisher,/if\\(policy\\)\\s*\\{/);
 assert.match(publisher,/if\\(eventName==='push'\\)return publishExistingControllerApprovals\\(event,opts\\)/);
 assert.match(request,/if\\(ownerMerged\\)\\s*\\{\\s*await resolveControllerApprovalCI/);
 const observed=inspect({enabled:'false',policy:''});
 assert.equal(observed.ownerMergedExistingApprovalPolicyRequired,false);
 assert.equal(observed.ciGeneratedApprovalPolicyRequired,true);
 assert.equal(observed.variableEnabledVerified,true);
 assert.equal(observed.activationAuthorized,false);
 assert.equal(observed.controllerBPublished,false);
});
test('only existing read-only isolated workflow can receive policy vars',()=>{
 const y=readFileSync(new URL('../.github/workflows/pc-process-inventory-readonly.yml',import.meta.url),'utf8');
 assert.match(y,/ZGMINI_CI_CONTROLLER_B_ENABLED: \$\{\{ vars\.ZGMINI_CI_CONTROLLER_B_ENABLED \}\}/);
 assert.match(y,/ZGMINI_CI_CONTROLLER_B_POLICY: \$\{\{ vars\.ZGMINI_CI_CONTROLLER_B_POLICY \}\}/);
 assert.match(y,/name: Collect read-only runtime process snapshot on isolated handoff PC/);
 assert.doesNotMatch(y,/workflow_dispatch:|schedule:/);
});
