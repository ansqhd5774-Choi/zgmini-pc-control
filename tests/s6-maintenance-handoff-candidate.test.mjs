import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nextRuntimeFiles,requireSevenToSevenContract,requireHandoffApproval,
 approvedRuntimeChanges,approvedHandoffCiPolicy,handoffFilePlan} from '../tools/handoff-maintenance.mjs';

test('S6 source-only 7-to-7 candidate preserves CI policy and refuses unapproved operation',()=>{
 const prior=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/05ef3bd6b5dc753c5abfbecccacc09375eb18d10.json',
  import.meta.url),'utf8'));
 const candidate=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/20a2939d419675ede3e8ab38a3ea3b70756981ac.json',
  import.meta.url),'utf8'));
 const previous=Object.fromEntries(nextRuntimeFiles.map(path=>[path,prior.files[path]]));
 const changed=['tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/update.mjs'];
 const fixedPolicy={schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',
  enabled:true,workflowId:430972394,workflowBlobSha:'b568bbc5de05b2d6fff75419b88322b3e2de020c',
  workflowPath:'.github/workflows/ci-approval-controller-b.yml'};
 const before={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:prior.targetSha,files:previous,ciControllerBPolicy:fixedPolicy};
 assert.equal(candidate.approved,false);
 assert.equal(candidate.installedSha,prior.targetSha);
 assert.equal(candidate.targetSha,'20a2939d419675ede3e8ab38a3ea3b70756981ac');
 assert.equal(Object.hasOwn(candidate,'ciControllerBPolicy'),false);
 assert.equal(candidate.checks.ownerNativeEffectApproved,false);
 assert.equal(candidate.checks.windowsHandoffExecuted,false);
 requireSevenToSevenContract(previous,candidate.files);
 assert.deepEqual(nextRuntimeFiles.filter(path=>previous[path]!==candidate.files[path]),changed);
 assert.deepEqual(candidate.runtimeChangedFiles,changed);
 for(const [path,hash] of Object.entries(prior.files)){
  assert.match(candidate.files[path],/^[a-f0-9]{64}$/);
  assert.equal(candidate.files[path]!==hash,changed.includes(path));
 }
 assert.throws(()=>requireHandoffApproval(candidate,candidate.targetSha,before.sourceSha),
  /HANDOFF_APPROVAL_REQUIRED/);
 // Synthetic approval tests source-diff mechanics only; grants no Owner permission.
 const synthetic={...candidate,approved:true};
 assert.equal(requireHandoffApproval(synthetic,candidate.targetSha,before.sourceSha),
  'SEVEN_TO_SEVEN');
 assert.deepEqual(approvedRuntimeChanges('SEVEN_TO_SEVEN',previous,candidate.files),changed);
 const plan=handoffFilePlan('SEVEN_TO_SEVEN',previous,candidate.files,
  {before,approval:synthetic,target:candidate.targetSha});
 assert.deepEqual(plan.writes,changed);
 assert.deepEqual(approvedHandoffCiPolicy(before,synthetic,
  {...before,sourceSha:candidate.targetSha,files:Object.fromEntries(
    nextRuntimeFiles.map(path=>[path,candidate.files[path]]))}),fixedPolicy);
});
