import test from 'node:test';
import assert from 'node:assert/strict';
import {plan996OfflineRecovery,plan996TwoBootRecovery,
  plan996SingleBootRecovery,simulate996TwoBootRecovery}
  from '../tools/controller-996-windows-archive-adapter.mjs';

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
test('existing ZGMINI PC WinPE boot proposes two guarded offline phases',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'EXISTING_ZGMINI_PC_WINPE_BOOT'});
  assert.equal(result.status,'OWNER_DECISION_REQUIRED');
  assert.equal(result.productionExecutable,false);
  assert.deepEqual(result.steps.map(step=>step.name),['oldC','install','ownC']);
  assert.deepEqual(result.legacySingleSessionSteps.map(step=>step.name),
    ['oldC','continuation','install']);
  assert.equal(result.twoBootReview.legacySingleSessionPlanExecutable,false);
  assert.equal(result.twoBootReview.currentOperatorCompatible,false);
  assert.equal(result.singleBootAlternative.winpeBootCount,1);
  assert.equal(result.ownerDecisions.length,5);
  assert.equal(result.code,'C996_EXISTING_ZGMINI_PC_WINPE_APPROVAL_REQUIRED');
  assert.deepEqual(result.pcTopology,{physicalPcCount:2,
    existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
    recoveryBootPc:'기존 ZGMINI PC',bootEnvironment:'WinPE',
    additionalPcRequired:false});
  assert.deepEqual(result.preservation,['VOLUME_ID','FILE_IDS','SHA256','ACL','PATH_MAPPING']);
  assert.equal(result.intendedCompletion,'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED');
  for(const field of ['operationalWrites','workflowPuts','backlogWrites','issuePosts'])assert.equal(result[field],0);
});
test('supplied offline=true and owner consent flags never authorize this planner',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'EXISTING_ZGMINI_PC_WINPE_BOOT',
    approved:true,offline:true,volumeLockVerified:true});
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.status,'OWNER_DECISION_REQUIRED');
});
test('no selected method requests a specific decision and rejects unsafe identifiers',()=>{
  assert.equal(plan996OfflineRecovery({continuationId}).code,'C996_OFFLINE_METHOD_NOT_SELECTED');
  assert.throws(()=>plan996OfflineRecovery({continuationId:'../old-claim',method:'EXISTING_ZGMINI_PC_WINPE_BOOT'}));
});

const testNonce='11111111-1111-4111-8111-111111111111';
const testSource='a'.repeat(64);
const testReady='b'.repeat(64);
const twoBoot=plan996TwoBootRecovery(continuationId);
const trace=()=>[
  {phase:'WINPE_FIRST_BOOT',bootEpoch:'boot-epoch-01',
    oldCArchiveDestination:twoBoot.oldClaimArchive.destination,
    oldCArchived:true,installLeaseHeld:true,workflowState:'active',
    workflowPutCount:0,backlogWriteCount:0},
  {phase:'ORIGINAL_WINDOWS_RESTORE',bootEpoch:'boot-epoch-02',
    installLeaseHeld:true,workflowState:'active',backlogClosed:true,
    fourJobsVerified:true,admissionProtected:true,workflowPutCount:0,
    backlogWriteCount:0,issuePostCount:0,ownerNonce:testNonce,
    sourceSha256:testSource,readyMarkerSha256:testReady},
  {phase:'WINPE_SECOND_BOOT',bootEpoch:'boot-epoch-03',
    installLeaseArchived:true,ownClaimArchived:true,ownerNonce:testNonce,
    sourceSha256:testSource,readyMarkerSha256:testReady,
    signedHandoffVerified:true,ownerApprovalFreshOrBoundedVerified:true},
  {phase:'ORIGINAL_WINDOWS_READBACK',bootEpoch:'boot-epoch-04',
    installLeaseArchived:true,ownClaimArchived:true,workflowState:'active',
    backlogClosed:true,controllerUnchanged:true,protectedItemsUnchanged:true,
    fourJobsVerified:true,sourceSha256:testSource},
];
const simulate=events=>simulate996TwoBootRecovery({continuationId,events});

test('two-boot proposal uses exactly the two named physical PCs and same reboot target',()=>{
  assert.equal(twoBoot.physicalPcCount,2);
  assert.equal(twoBoot.additionalPcRequired,false);
  assert.equal(twoBoot.existingPcName,'기존 ZGMINI PC');
  assert.equal(twoBoot.queuePcName,'공통 대기열 PC');
  assert.equal(twoBoot.winpeBootCount,2);
  assert.deepEqual(twoBoot.phases.map(p=>p.os),['WinPE','Windows','WinPE','Windows']);
  assert.ok(twoBoot.phases.every(p=>p.pc==='기존 ZGMINI PC'));
  assert.equal(twoBoot.executionAuthorized,false);
  assert.equal(twoBoot.originalPcWrites,0);
});
test('old interrupted C claim does not take the new online C claim archive destination',()=>{
  assert.notEqual(twoBoot.oldClaimArchive.destination,twoBoot.newClaimArchive.destination);
  assert.equal(twoBoot.oldClaimArchive.source,twoBoot.newClaimArchive.source);
  assert.match(twoBoot.oldClaimArchive.destination,/controller-recovery-interrupted-/);
  assert.match(twoBoot.newClaimArchive.destination,/controller-recovery-archived-/);
  assert.deepEqual(twoBoot.phases[0].moves.map(m=>m.name),['oldC']);
  assert.equal(twoBoot.phases[0].workflow,'READBACK_NO_MUTATION');
  assert.equal(twoBoot.phases[0].installLease,'HELD');
});
test('online stage retains installation lease and requires job-admission proof before second WinPE',()=>{
  assert.deepEqual(twoBoot.phases[1].moves,[]);
  assert.equal(twoBoot.phases[1].installLease,'HELD');
  assert.equal(twoBoot.phases[1].admission,
    'PROVE_GITHUB_PC_JOB_ADMISSION_FENCE_OR_STOP');
  assert.equal(twoBoot.phases[1].handoff,'READY_FOR_SECOND_BOOT');
  assert.deepEqual(twoBoot.phases[2].moves.map(m=>m.name),['install','ownC']);
  assert.deepEqual(twoBoot.phases[3].moves,[]);
});
test('partial synthetic trace is incomplete and never releases install barrier',()=>{
  for(let n=0;n<4;n++){
    const result=simulate(trace().slice(0,n));
    assert.equal(result.status,'SYNTHETIC_INCOMPLETE');
    assert.equal(result.completed,n);
    assert.equal(result.installLeaseReleaseAuthorized,false);
    assert.equal(result.operationalWrites,0);
  }
});
test('first boot refuses early install release or unapproved workflow effect',()=>{
  const altered=trace();altered[0].installLeaseHeld=false;
  assert.equal(simulate(altered).code,'C996_TWO_BOOT_FIRST_BOOT_GUARD_FAILED');
  const altered2=trace();altered2[0].workflowPutCount=1;
  assert.equal(simulate(altered2).code,'C996_TWO_BOOT_FIRST_BOOT_GUARD_FAILED');
});
test('online handoff rejects missing four original jobs, admission proof, or early install release',()=>{
  for(const field of ['fourJobsVerified','admissionProtected','installLeaseHeld']){
    const altered=trace();altered[1][field]=false;
    assert.equal(simulate(altered).code,'C996_TWO_BOOT_ONLINE_HANDOFF_UNVERIFIED');
  }
  const altered=trace();altered[1].readyMarkerSha256='missing';
  assert.equal(simulate(altered).code,'C996_TWO_BOOT_ONLINE_HANDOFF_UNVERIFIED');
  for(const field of ['workflowPutCount','backlogWriteCount','issuePostCount']){
    const writing=trace();writing[1][field]=1;
    assert.equal(simulate(writing).code,'C996_TWO_BOOT_ONLINE_HANDOFF_UNVERIFIED');
  }
});
test('out-of-order, repeated boot epoch, or oversized trace is blocked without effects',()=>{
  const order=trace();order[1].phase='WINPE_SECOND_BOOT';
  assert.equal(simulate(order).code,'C996_TWO_BOOT_PHASE_ORDER_INVALID');
  const repeated=trace();repeated[2].bootEpoch=repeated[0].bootEpoch;
  assert.equal(simulate(repeated).code,'C996_TWO_BOOT_BOOT_EPOCH_INVALID');
  assert.equal(simulate([...trace(),trace()[0]]).code,'C996_TWO_BOOT_EVENTS_INVALID');
  assert.equal(simulate('unexpected').operationalWrites,0);
});
test('second WinPE rejects altered nonce, source pin, ready marker, or missing Owner approval',()=>{
  for(const [field,value] of [
    ['ownerNonce','22222222-2222-4222-8222-222222222222'],
    ['sourceSha256','c'.repeat(64)],
    ['readyMarkerSha256','d'.repeat(64)],
    ['signedHandoffVerified',false],
    ['ownerApprovalFreshOrBoundedVerified',false],
  ]){
    const altered=trace();altered[2][field]=value;
    assert.equal(simulate(altered).code,'C996_TWO_BOOT_SECOND_BOOT_GUARD_FAILED');
  }
});
test('final Windows readback refuses drift and unverified original receipts',()=>{
  for(const field of ['controllerUnchanged','protectedItemsUnchanged','fourJobsVerified']){
    const altered=trace();altered[3][field]=false;
    assert.equal(simulate(altered).code,'C996_TWO_BOOT_FINAL_READBACK_UNVERIFIED');
  }
  const altered=trace();altered[3].sourceSha256='c'.repeat(64);
  assert.equal(simulate(altered).code,'C996_TWO_BOOT_FINAL_READBACK_UNVERIFIED');
});
test('a full synthetic trace is review-only and grants neither PC writes nor C approval',()=>{
  const reviewed=simulate(trace());
  assert.equal(reviewed.status,'SYNTHETIC_SEQUENCE_REVIEWED_ONLY');
  assert.equal(reviewed.completed,4);
  assert.equal(reviewed.installLeaseReleaseAuthorized,false);
  assert.equal(reviewed.executionAuthorized,false);
  assert.equal(reviewed.operationalWrites,0);
  assert.equal(reviewed.automaticRetry,false);
});

const singleBoot=plan996SingleBootRecovery(continuationId);
test('single-WinPE alternative uses exactly the two named PCs and one WinPE boot',()=>{
  assert.equal(singleBoot.physicalPcCount,2);
  assert.equal(singleBoot.additionalPcRequired,false);
  assert.equal(singleBoot.existingPcName,'기존 ZGMINI PC');
  assert.equal(singleBoot.queuePcName,'공통 대기열 PC');
  assert.equal(singleBoot.winpeBootCount,1);
  assert.deepEqual(singleBoot.phases.map(p=>p.os),['Windows','WinPE','Windows']);
  assert.ok(singleBoot.phases.every(p=>p.pc==='기존 ZGMINI PC'));
});
test('single-WinPE plan retains the old C claim and install lease until offline move',()=>{
  assert.equal(singleBoot.phases[0].originalOldClaim,'RETAIN_UNTIL_WINPE');
  assert.equal(singleBoot.phases[0].installLease,'HELD');
  assert.deepEqual(singleBoot.phases[0].moves,[]);
  assert.deepEqual(singleBoot.phases[1].moves.map(m=>m.name),
    ['oldC','continuation','install']);
  assert.equal(singleBoot.phases[1].installLease,'HELD_UNTIL_LAST_MOVE');
  assert.equal(singleBoot.phases[2].installLease,'ARCHIVED');
});
test('single-WinPE proposal disjoins the old-C destination and stops on unapproved effects',()=>{
  assert.notEqual(singleBoot.oldClaimArchive.destination,twoBoot.newClaimArchive.destination);
  assert.match(singleBoot.phases[0].workflow,/NO_UNAPPROVED_PUT/);
  assert.match(singleBoot.phases[0].backlog,/NO_UNAPPROVED_WRITE/);
  assert.equal(singleBoot.phases[0].admission,
    'DRAIN_MATCHING_RUNNERS_THEN_OFFLINE_KEEP_WORKFLOW_ACTIVE');
  assert.equal(singleBoot.phases[2].runner,
    'REMAIN_OFFLINE_UNTIL_POSTCHECK_AND_RESUME_WITHIN_24H');
  assert.equal(singleBoot.admissionReviewModule,
    'tools/controller-996-offline-admission-review.mjs');
  assert.equal(singleBoot.githubQueueMaxHours,24);
  assert.equal(singleBoot.currentOperatorCompatible,false);
  assert.ok(singleBoot.currentOperatorBlockers.includes('REAL_PC_JOB_ADMISSION_FENCE_NOT_PROVEN'));
});
test('both boot designs remain source-only: no native boot or C write is authorized',()=>{
  for(const p of [singleBoot,twoBoot]){
    assert.equal(p.status,'SOURCE_ONLY_NOT_EXECUTABLE');
    assert.equal(p.productionExecutable,false);
    assert.equal(p.executionAuthorized,false);
    assert.equal(p.originalPcWrites,0);
    assert.equal(p.workflowPuts,0);
    assert.equal(p.backlogWrites,0);
    assert.equal(p.issuePosts,0);
  }
});
