import test from 'node:test';
import assert from 'node:assert/strict';
import {plan996OfflineRecovery} from '../tools/controller-996-windows-archive-adapter.mjs';

const continuationId='70a4c347-25ea-4fc6-83d2-c0c670115249';
test('a volume lock cannot be treated as authorization for path-based rename',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'LOCK_VOLUME_THEN_PATH_RENAME'});
  assert.equal(result.status,'UNSUPPORTED_METHOD');
  assert.equal(result.code,'C996_VOLUME_LOCK_DISALLOWS_PATH_RENAME');
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.operationalWrites,0);
});
test('dismount alone cannot establish an exclusive file-system namespace',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'DISMOUNT_WITHOUT_EXCLUSIVE_HOST'});
  assert.equal(result.status,'UNSUPPORTED_METHOD');
  assert.equal(result.code,'C996_DISMOUNT_IS_NOT_EXCLUSIVE');
});
test('separate offline host plan keeps existing three moves and install last',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'SEPARATE_OFFLINE_HOST'});
  assert.equal(result.status,'OWNER_DECISION_REQUIRED');
  assert.equal(result.productionExecutable,false);
  assert.deepEqual(result.steps.map(step=>step.name),['oldC','continuation','install']);
  assert.equal(result.ownerDecisions.length,5);
  assert.deepEqual(result.preservation,['VOLUME_ID','FILE_IDS','SHA256','ACL','PATH_MAPPING']);
  assert.equal(result.intendedCompletion,'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED');
  for(const field of ['operationalWrites','workflowPuts','backlogWrites','issuePosts'])assert.equal(result[field],0);
});
test('supplied offline=true and owner consent flags never authorize this planner',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'SEPARATE_OFFLINE_HOST',
    approved:true,offline:true,volumeLockVerified:true});
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.status,'OWNER_DECISION_REQUIRED');
});
test('no selected method requests a specific decision and rejects unsafe identifiers',()=>{
  assert.equal(plan996OfflineRecovery({continuationId}).code,'C996_OFFLINE_METHOD_NOT_SELECTED');
  assert.throws(()=>plan996OfflineRecovery({continuationId:'../old-claim',method:'SEPARATE_OFFLINE_HOST'}));
});
