import test from 'node:test';
import assert from 'node:assert/strict';
import {installedRecoveryCase,installedRecoveryProtectionAllowed,
 classifyInstalledReconciliationProof}
 from '../tools/maintenance-recovery.mjs';

const oldId='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
const w04Id='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
test('historical #2960 target and postcheck contract preserved',()=>{
 const s=installedRecoveryCase(oldId);
 assert.equal(s.issueNumber,2960);
 assert.equal(s.postIssueNumber,2965);
 assert.equal(s.targetSha,'b9a423cf38d0967d6ed336912a66433f79502d3d');
 assert.equal(s.postSourceBranch,'main');
 assert.equal(s.proof.runId,45186420113);
});
test('W04 #3409 reconciles only the pinned original and later independent A proof',()=>{
 const s=installedRecoveryCase(w04Id);
 assert.equal(s.issueNumber,3409);
 assert.equal(s.postIssueNumber,3410);
 assert.equal(s.targetSha,'6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4');
 assert.equal(s.postSourceBranch,'codex/employment-1y-reader-r1');
 assert.equal(s.postSourceSha,'50769db23ac6a5f55203855f5231d12dc0595bb4');
 assert.deepEqual(s.proof,{issueNumber:3438,runId:45457196689,
  jobId:138669741465,runnerName:'zgmini-pc-03',
  resultPath:'results/45457196689-1-seat-3.json'});
});
test('unknown request or incorrect case never selects a recovery scope',()=>{
 for(const id of [null,'','pc-update-unapproved','__proto__',
  'pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec1'])
  assert.equal(installedRecoveryCase(id),null);
});
const complete=()=>({originalLedger:true,ownerAndMarker:true,ownerDead:true,
 controllerVerified:true,maintenanceVerified:true,workflowActive:true,
 backlogReconciled:true,supervisorVerified:true,protectedWriterPreserved:true,
 sourceAndCasVerified:true,currentAReceiptVerified:true,operatorVerified:true});
test('reconciliation requires all independent live, CAS and operator checks',()=>{
 const success=classifyInstalledReconciliationProof(complete());
 assert.equal(success.status,'INSTALLED_RECONCILIATION_ELIGIBLE');
 assert.equal(success.originalPostcheckVerified,false);
 assert.equal(success.originalLedgerPreserved,true);
 for(const key of Object.keys(complete())){
  const failed=classifyInstalledReconciliationProof({...complete(),[key]:false});
  assert.equal(failed.status,'RECOVERY_REQUIRED',key);
  assert.equal(failed.checks[
   Object.keys(failed.checks).find(n=>!failed.checks[n])],false,key);
 }
});

test('W04 unchanged protected snapshot accepted, but any Writer drift is rejected',()=>{
 const w04=installedRecoveryCase(w04Id),legacy=installedRecoveryCase(oldId);
 const unchanged={allowed:true,code:'RECOVERY_ORIGINAL_PROTECTION_UNCHANGED',
  preservedWriterConfig:false};
 const writerDelta={allowed:true,code:'RECOVERY_CURRENT_WRITER_CONFIG_PRESERVED',
  preservedWriterConfig:true};
 assert.equal(installedRecoveryProtectionAllowed(w04,unchanged),true);
 assert.equal(installedRecoveryProtectionAllowed(w04,writerDelta),false);
 assert.equal(installedRecoveryProtectionAllowed(legacy,unchanged),false);
 assert.equal(installedRecoveryProtectionAllowed(legacy,writerDelta),true);
 assert.equal(installedRecoveryProtectionAllowed(w04,{...unchanged,allowed:false}),false);
 assert.equal(installedRecoveryProtectionAllowed(null,unchanged),false);
});
