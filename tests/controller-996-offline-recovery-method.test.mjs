import test from 'node:test';
import assert from 'node:assert/strict';
import {plan996OfflineRecovery,plan996TwoBootRecovery,
  plan996SingleBootRecovery,simulate996TwoBootRecovery,
  simulate996SingleBootRecovery}
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
test('existing ZGMINI PC selects one offline WinPE boot without granting C Owner approval',()=>{
  const result=plan996OfflineRecovery({continuationId,method:'EXISTING_ZGMINI_PC_WINPE_BOOT'});
  assert.equal(result.status,'OWNER_FINAL_APPROVAL_REQUIRED');
  assert.equal(result.productionExecutable,false);
  assert.deepEqual(result.steps.map(step=>step.name),['oldC','continuation','install']);
  assert.deepEqual(result.legacySingleSessionSteps.map(step=>step.name),
    ['oldC','continuation','install']);
  assert.notEqual(result.steps[0].destination,result.legacySingleSessionSteps[0].destination);
  assert.equal(result.twoBootAlternative.legacySingleSessionPlanExecutable,false);
  assert.equal(result.twoBootAlternative.currentOperatorCompatible,false);
  assert.equal(result.selectedBootReview.winpeBootCount,1);
  assert.equal(result.selectedWinpeBootCount,1);
  assert.equal(result.designSelection,'SINGLE_WINPE_BOOT_BOUNDED_SIGNED_OFFLINE');
  assert.equal(result.signedHandoffMode,'SHORT_LIVED_OFFLINE_PINNED_PUBLIC_KEY');
  assert.equal(result.ownerDecisions.length,6);
  assert.equal(result.selectedBootImageVerified,false);
  assert.equal(result.nativeMoverSelected,false);
  assert.equal(result.winPePowerShellAssumed,false);
  assert.equal(result.driveLetterTrusted,false);
  assert.equal(result.code,'C996_SINGLE_BOOT_BOUNDED_SIGNED_OWNER_APPROVAL_REQUIRED');
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
  assert.equal(result.status,'OWNER_FINAL_APPROVAL_REQUIRED');
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
  assert.equal(twoBoot.selectedBootImageVerified,false);
  assert.equal(twoBoot.winPePowerShellAssumed,false);
  assert.equal(twoBoot.verifiedVolumeIdentity,null);
});

test('single boot never assumes WinPE .NET or original Windows E: mapping',()=>{
  const single=plan996SingleBootRecovery(continuationId);
  assert.equal(single.selectedBootImageVerified,false);
  assert.equal(single.nativeMoverSelected,false);
  assert.equal(single.winPePowerShellAssumed,false);
  assert.equal(single.driveLetterTrusted,false);
  assert.equal(single.verifiedVolumeIdentity,null);
  assert.equal(single.executionAuthorized,false);
  assert.equal(single.productionExecutable,false);
  assert.equal(single.originalPcWrites,0);
  assert.equal(single.selectedConsentMode,'SHORT_LIVED_SIGNED_OFFLINE');
  assert.equal(single.prebootOnlineApprovalAndRevocationReadbackRequired,true);
  assert.equal(single.winpeNetworkRequiredForConsent,false);
  assert.equal(single.revocationDuringWinpeAvailable,false);
  assert.equal(single.signatureAlgorithmCandidate,'RSA_PSS_SHA256');
  assert.equal(single.signatureVerificationImplemented,false);
  assert.equal(single.pinnedOwnerPublicKeyVerified,false);
  assert.equal(single.offlineExpiryAndClockTrustVerified,false);
  assert.equal(single.offlineValiditySeconds,null);
  assert.equal(single.finalOwnerCApprovalGranted,false);
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
  assert.deepEqual(twoBoot.phases[2].moves.map(m=>m.name),['ownC','install']);
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

const singleMoves=()=>singleBoot.phases[1].moves.map((step,i)=>({
  name:step.name,source:step.source,destination:step.destination,
  sourceFileId:String(i+1).repeat(32),archiveFileId:String(i+1).repeat(32),
  sourceVolumeSerial:'1'.repeat(16),archiveVolumeSerial:'1'.repeat(16),
  destinationAbsentBefore:true,sourceAbsentAfter:true,noReplace:true,
}));
const singleTrace=()=>[
  {phase:'ORIGINAL_WINDOWS_PREPARE',bootEpoch:'windows-original-01',
    oldCAtOriginal:true,installLeaseHeld:true,workflowState:'active',
    backlogClosed:true,fourJobsVerified:true,admissionProtected:true,
    sixMatchingRunnersOffline:true,runnerAutoStartHeld:true,
    workflowPutCount:0,backlogWriteCount:0,issuePostCount:0,
    ownerNonce:testNonce,sourceSha256:testSource,
    readyMarkerSha256:testReady,signedHandoffVerified:true,
    ownerApprovalFreshOrBoundedVerified:true},
  {phase:'WINPE_SINGLE_BOOT',bootEpoch:'winpe-original-02',
    ownerNonce:testNonce,sourceSha256:testSource,
    readyMarkerSha256:testReady,signedHandoffVerified:true,
    ownerApprovalFreshOrBoundedVerified:true,bootImageVerified:true,
    nativeX64MoverVerified:true,volumeIdentityPinned:true,
    installLeaseHeldUntilFinalMove:true,moves:singleMoves()},
  {phase:'ORIGINAL_WINDOWS_READBACK',bootEpoch:'windows-original-03',
    installLeaseArchived:true,archivesVerified:true,
    controllerUnchanged:true,protectedItemsUnchanged:true,
    workflowState:'active',backlogClosed:true,fourJobsVerified:true,
    runnerPostcheckBeforeResume:true,sourceSha256:testSource},
];
const simulateSingle=events=>simulate996SingleBootRecovery({continuationId,events});

test('single boot review accepts only a complete ordered synthetic sequence without granting C authority',()=>{
  for(let n=0;n<3;n++){
    const partial=simulateSingle(singleTrace().slice(0,n));
    assert.equal(partial.status,'SYNTHETIC_INCOMPLETE');
    assert.equal(partial.completed,n);
    assert.equal(partial.installLeaseReleaseAuthorized,false);
  }
  const result=simulateSingle(singleTrace());
  assert.equal(result.status,'SYNTHETIC_SEQUENCE_REVIEWED_ONLY');
  assert.equal(result.completed,3);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.installLeaseReleaseAuthorized,false);
  assert.equal(result.operationalWrites,0);
  assert.equal(result.automaticRetry,false);
});
test('single boot halts on unapproved online effect, unprotected admission, or invalid handoff pin',()=>{
  for(const [field,value] of [
    ['sixMatchingRunnersOffline',false],['runnerAutoStartHeld',false],
    ['installLeaseHeld',false],['workflowPutCount',1],
    ['fourJobsVerified',false],['signedHandoffVerified',false],
    ['sourceSha256','invalid-sha'],
  ]){
    const altered=singleTrace();altered[0][field]=value;
    assert.equal(simulateSingle(altered).code,
      'C996_SINGLE_BOOT_ONLINE_PREPARE_UNVERIFIED');
  }
  for(const [field,value] of [
    ['readyMarkerSha256','c'.repeat(64)],
    ['sourceSha256','c'.repeat(64)],
    ['ownerApprovalFreshOrBoundedVerified',false],
    ['volumeIdentityPinned',false],['bootImageVerified',false],
  ]){
    const altered=singleTrace();altered[1][field]=value;
    assert.equal(simulateSingle(altered).code,
      'C996_SINGLE_BOOT_WINPE_HANDOFF_OR_MOVES_UNVERIFIED');
  }
});
test('single boot refuses a missing, reordered, replaced, or mismatched WinPE move',()=>{
  for(const change of [
    moves=>moves.pop(),
    moves=>moves.reverse(),
    moves=>{moves[1].destinationAbsentBefore=false;},
    moves=>{moves[0].noReplace=false;},
    moves=>{moves[1].archiveFileId='f'.repeat(32);},
    moves=>{moves[2].archiveVolumeSerial='f'.repeat(16);},
  ]){
    const altered=singleTrace();change(altered[1].moves);
    const reviewed=simulateSingle(altered);
    assert.ok(['C996_SINGLE_BOOT_WINPE_HANDOFF_OR_MOVES_UNVERIFIED',
      'C996_SINGLE_BOOT_MOVE_ORDER_OR_IDENTITY_FAILED'].includes(reviewed.code));
    assert.equal(reviewed.executionAuthorized,false);
    assert.equal(reviewed.operationalWrites,0);
    assert.equal(reviewed.automaticRetry,false);
  }
});
test('single boot rejects phase reuse, extra phases, and unsafe final readback',()=>{
  const reordered=singleTrace();reordered[1].phase='ORIGINAL_WINDOWS_READBACK';
  assert.equal(simulateSingle(reordered).code,'C996_SINGLE_BOOT_PHASE_ORDER_INVALID');
  const repeated=singleTrace();repeated[2].bootEpoch=repeated[0].bootEpoch;
  assert.equal(simulateSingle(repeated).code,'C996_SINGLE_BOOT_BOOT_EPOCH_INVALID');
  assert.equal(simulateSingle([...singleTrace(),singleTrace()[0]]).code,
    'C996_SINGLE_BOOT_EVENTS_INVALID');
  for(const field of ['installLeaseArchived','archivesVerified',
    'protectedItemsUnchanged','runnerPostcheckBeforeResume']){
    const drift=singleTrace();drift[2][field]=false;
    assert.equal(simulateSingle(drift).code,
      'C996_SINGLE_BOOT_FINAL_READBACK_UNVERIFIED');
  }
});

test('no caller-supplied approval flags become authenticated evidence in either boot simulator',()=>{
  for(const [run,makeTrace] of [[simulate,trace],[simulateSingle,singleTrace]]){
    const complete=run(makeTrace());
    const incomplete=run([]);
    const blocked=run('invalid-events');
    for(const result of [complete,incomplete,blocked]){
      assert.equal(result.evidenceAuthenticated,false);
      assert.equal(result.ownerApprovalVerified,false);
      assert.equal(result.signatureCryptographicallyVerified,false);
      assert.equal(result.executionAuthorized,false);
      assert.equal(result.installLeaseReleaseAuthorized,false);
    }
  }
});
