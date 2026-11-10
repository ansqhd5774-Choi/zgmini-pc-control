import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assess996PausedIntake,draft996CApproval,exactlySixDedicatedSeats,INTAKE_996}
  from '../tools/controller-996-intake-candidate.mjs';

const seats=()=>Array.from({length:6},(_,index)=>({
  name:`zgmini-pc-0${index+1}`, status:'online', busy:false,
}));
function fixture(){
  const at='2026-11-10T01:36:10.335Z';
  return {
    schema:INTAKE_996.schema,requestId:INTAKE_996.requestId,
    issueNumber:996,observedAt:at,
    ledger:{requestId:INTAKE_996.requestId,issueNumber:996,
      installedShaBefore:INTAKE_996.controllerSha,targetSha:INTAKE_996.targetSha,
      status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
      firstFail:'INTAKE_PAUSED',code:'RUNNER_SET_DRIFT',updatedAt:at},
    installLock:{held:true,recoveryRequired:true,ownerPid:46568,markerOwnerPid:46568,
      ownerNonceMatched:true,markerLedgerTimeMatched:true,ownerDeadProven:true,
      recoveryClaimAbsent:true},
    controller:{sourceSha:INTAKE_996.controllerSha,hostFilesVerified:true,
      supervisorIdentityVerified:true,switchNeverStarted:true},
    stage:{exists:true,bytesVerified:true,snapshotAbsent:true,
      previousFilesAbsent:true,sourceRequestId:INTAKE_996.requestId},
    backlog:{exists:true,requestId:INTAKE_996.requestId,pauseWindowOpen:true,
      pauseOwnedByRequest:true,replaysUntampered:true},
    workflow:{state:'disabled_manually',pausedByRequest:true},
    protection:{beforeAndNowVerified:true,unchanged:true},
    runners:[{name:'zgmini-handoff-ci-spare-01',status:'offline',busy:true},...seats()],
    otherControllerLeaseCount:0,
    maintainer:{sourceSha:INTAKE_996.maintainerSha,filesVerified:true},
    digests:Object.fromEntries([
      'ledger','owner','recoveryMarker','backlog','stagedHost','controllerHost',
      'maintainerManifest','protectedSnapshot',
    ].map((name,index)=>[name,String(index+1).repeat(64)])),
  };
}

test('read-only candidate admits independent spare but never grants C execution',()=>{
  const e=fixture(),prior=structuredClone(e);
  const assessment=assess996PausedIntake(e);
  assert.equal(assessment.status,'C_CANDIDATE_READY_FOR_REVIEW');
  assert.equal(assessment.code,'EXPLICIT_NEW_C_CONSENT_REQUIRED');
  assert.ok(Object.values(assessment.checks).every(Boolean));
  const proposal=draft996CApproval(e);
  assert.equal(proposal.approved,false);
  assert.equal(proposal.executionAuthorized,false);
  assert.equal(proposal.grade,'C');
  assert.equal(proposal.operation,'RECONCILE_INTAKE_PAUSED_ONLY');
  assert.deepEqual(e,prior);
});

test('missing evidence and empty inputs fail closed with no approval candidate',()=>{
  for(const e of [null,{},fixture()]){
    if(e?.digests)delete e.digests;
    const assessment=assess996PausedIntake(e);
    assert.equal(assessment.status,'EVIDENCE_INCOMPLETE');
    assert.equal(assessment.executionAuthorized,false);
    assert.equal(draft996CApproval(e).approved,false);
  }
});

test('dedicated runner uniqueness, online and idle are required; spare is ignored',()=>{
  const rows=seats();
  assert.equal(exactlySixDedicatedSeats(rows),true);
  assert.equal(exactlySixDedicatedSeats([...rows,{name:'spare',busy:true,status:'offline'}]),true);
  for(const broken of [null,rows.slice(0,5),[...rows,rows[0]],
    rows.map((row,index)=>index===1?{...row,status:'offline'}:row),
    rows.map((row,index)=>index===4?{...row,busy:true}:row)]){
    assert.equal(exactlySixDedicatedSeats(broken),false);
  }
});

test('other failure phase, successful ledger or changed Controller are ineligible',()=>{
  const phase=fixture();phase.ledger.firstFail='RECEIVED';
  assert.equal(assess996PausedIntake(phase).code,'LEDGER_PHASE');
  const passed=fixture();passed.ledger.status='PASS';
  assert.equal(assess996PausedIntake(passed).code,'LEDGER_PHASE');
  const changed=fixture();changed.controller.switchNeverStarted=false;
  assert.equal(assess996PausedIntake(changed).code,'ORIGINAL_RUNTIME');
});

test('owner must be proven dead and current recovery marker must match',()=>{
  for(const patch of [{ownerDeadProven:null},{ownerDeadProven:false},
    {ownerPid:999},{ownerNonceMatched:false},{markerLedgerTimeMatched:false},
    {recoveryClaimAbsent:false}]){
    const e=fixture();Object.assign(e.installLock,patch);
    assert.equal(assess996PausedIntake(e).code,'ORIGINAL_LEASE');
  }
});

test('intake and backlog must be verified as the original open pause window',()=>{
  for(const [field,value] of [['pauseWindowOpen',false],['pauseOwnedByRequest',false],
    ['replaysUntampered',false],['requestId','other']]){
    const e=fixture();e.backlog[field]=value;
    assert.equal(assess996PausedIntake(e).code,'PAUSE_JOURNAL');
  }
  const resumed=fixture();resumed.workflow.state='active';
  assert.equal(assess996PausedIntake(resumed).code,'INTAKE_PAUSED');
});

test('staging or backup/switch evidence drift is not accepted',()=>{
  for(const patch of [{exists:false},{bytesVerified:false},{snapshotAbsent:false},
    {previousFilesAbsent:false},{sourceRequestId:'other'}]){
    const e=fixture();Object.assign(e.stage,patch);
    assert.equal(assess996PausedIntake(e).code,'STAGED_ONLY');
  }
  const protectedChange=fixture();protectedChange.protection.unchanged=false;
  assert.equal(assess996PausedIntake(protectedChange).code,'PROTECTED_STATE');
});

test('maintenance source and complete raw digest map must match',()=>{
  const source=fixture();source.maintainer.sourceSha='a'.repeat(40);
  assert.equal(assess996PausedIntake(source).code,'MAINTAINER_PIN');
  for(const malformed of [null,'x'.repeat(64),'A'.repeat(64)]){
    const e=fixture();e.digests.backlog=malformed;
    assert.equal(assess996PausedIntake(e).code,'RAW_EVIDENCE_PIN');
  }
  const extra=fixture();extra.digests.extra='a'.repeat(64);
  assert.equal(assess996PausedIntake(extra).code,'RAW_EVIDENCE_PIN');
});

test('proposal code contains no runtime write or process execution path',()=>{
  const source=readFileSync(fileURLToPath(new URL(
    '../tools/controller-996-intake-candidate.mjs',import.meta.url)),'utf8');
  assert.doesNotMatch(source,/\b(?:execFile|spawn|unlink|rename|writeFile|mkdir)Sync\b/);
  assert.doesNotMatch(source,/\b(?:fetch|https|http|process\.kill)\s*\(/);
  assert.equal(draft996CApproval({}).executionAuthorized,false);
});
