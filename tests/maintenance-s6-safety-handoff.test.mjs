import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
  nextRuntimeFiles,requireHandoffApproval,requireSevenToSevenContract,
  handoffFilePlan,approvedHandoffCiPolicy,
} from '../tools/handoff-maintenance.mjs';

// Pure source/approval verification. Never executes an installed Windows
// maintainer, stops a receiver, changes a lease, or sends any B request.
const existing=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/5a85f803fd9cb280561395f88a3544ee8e7d4660.json',
  import.meta.url),'utf8'));
const target=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/b08f3a482e9bb39523f47675ae06bc6e02e01d2d.json',
  import.meta.url),'utf8'));
const sourcePaths=[...nextRuntimeFiles,'tools/bootstrap-maintenance.mjs',
  'tools/handoff-maintenance.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex');

test('S6 stop fail-closed handoff pins only four changed installed runtime modules',()=>{
  assert.equal(target.schema,'ZGMINI_MAINTENANCE_HANDOFF_V2');
  assert.equal(target.transition,'SEVEN_TO_SEVEN');
  assert.equal(target.approved,true);
  assert.equal(target.scope,'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE');
  assert.equal(target.installedSha,existing.targetSha);
  assert.equal(target.installedSha,'5a85f803fd9cb280561395f88a3544ee8e7d4660');
  assert.equal(target.targetSha,'b08f3a482e9bb39523f47675ae06bc6e02e01d2d');
  assert.equal(requireHandoffApproval(target,target.targetSha,target.installedSha),'SEVEN_TO_SEVEN');
  assert.deepEqual(Object.keys(target.files).sort(),[...sourcePaths].sort());
  const oldFiles=Object.fromEntries(nextRuntimeFiles.map(p=>[p,existing.files[p]]));
  requireSevenToSevenContract(oldFiles,target.files);
  const actualDiff=nextRuntimeFiles.filter(p=>existing.files[p]!==target.files[p]);
  assert.deepEqual(actualDiff,[
    'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
    'tools/maintenance-agent.mjs','tools/update.mjs']);
  assert.deepEqual([...target.runtimeChangedFiles].sort(),[...actualDiff].sort());
  const plan=handoffFilePlan('SEVEN_TO_SEVEN',oldFiles,target.files);
  assert.deepEqual(plan.writes,actualDiff);
  assert.deepEqual(plan.rollbackAdded,[]);
  for(const p of sourcePaths){
    assert.match(target.files[p],/^[a-f0-9]{64}$/);
    assert.equal(hash(fs.readFileSync(new URL('../'+p,import.meta.url))),
      target.files[p],'approved target byte mismatch: '+p);
  }
});

test('S6 safety handoff preserves prior CI B identity and cannot authorize native B effects',()=>{
  assert.equal(Object.hasOwn(target,'ciControllerBPolicy'),false);
  const oldFiles=Object.fromEntries(nextRuntimeFiles.map(p=>[p,existing.files[p]]));
  const policy={
    schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',
    enabled:true,workflowId:430972394,
    workflowBlobSha:'27e48ecde81bdf6f15cccffcffd9b3e70482a5f3',
    workflowPath:'.github/workflows/ci-approval-controller-b.yml',
  };
  const before={
    schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
    sourceSha:target.installedSha,startupSha256:'a'.repeat(64),
    files:oldFiles,ciControllerBPolicy:policy,
  };
  const after={...before,sourceSha:target.targetSha,files:target.files};
  assert.deepEqual(approvedHandoffCiPolicy(before,target,after),policy);
  assert.equal(Object.hasOwn(target,'ciNativeApproval'),false);
});
