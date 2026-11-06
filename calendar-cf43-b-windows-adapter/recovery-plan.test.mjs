import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRecovery} from './recovery-plan.mjs';
const base={taskState:'ENABLED',sourceState:'BASE_DIRTY',configState:'BASE',
 approvedBytesMatch:true,drained:false};
test('Disable operation changed OS then threw: use observed disabled Task and safe rollback',()=>{
 assert.equal(classifyRecovery({...base,taskState:'DISABLED',drained:true}),
  'SAFE_ROLLBACK');
});
test('Git branch switched, staging/commit failed: restore only with observed approved bytes',()=>{
 assert.equal(classifyRecovery({...base,taskState:'DISABLED',
  sourceState:'BRANCH_DIRTY',drained:true}),'SAFE_ROLLBACK');
 assert.equal(classifyRecovery({...base,taskState:'DISABLED',
  sourceState:'UNKNOWN',drained:true}),'RECOVERY_REQUIRED');
});
test('Config rename succeeded then threw: rollback only under disabled/drained Core',()=>{
 assert.equal(classifyRecovery({...base,taskState:'DISABLED',
  sourceState:'COMMITTED_CLEAN',configState:'CHILD',drained:true}),
  'SAFE_ROLLBACK');
 assert.equal(classifyRecovery({...base,taskState:'DISABLED',
  sourceState:'COMMITTED_CLEAN',configState:'UNKNOWN',drained:true}),
  'RECOVERY_REQUIRED');
});
test('Enable OS success then readback failure: never rewrite live source/config',()=>{
 assert.equal(classifyRecovery({...base,taskState:'ENABLED',
  sourceState:'COMMITTED_CLEAN',configState:'CHILD'}),'RECOVERY_REQUIRED');
 assert.equal(classifyRecovery(base),'STOP_NO_MUTATION');
});
