import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPostSwitchEvidence} from '../tools/controller-postswitch-evidence.mjs';
import {forwardRecoveryCandidate, reconcilePostSwitchForward} from '../tools/controller-postswitch-reconciliation.mjs';

const oldSha='c09bf6a6f66f229016135020d6ba553ba9a94676';
const newSha='badad9124157879d7a645b64f2768113d632355b';
const requestId='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const ledger=()=>({requestId,status:'RECOVERY_REQUIRED',
  phase:'RECOVERY_REQUIRED',firstFail:'INTAKE_RESUMED',code:'BACKLOG_ORIGINAL_REQUEST_INVALID',
  intakePaused:false,postIssueNumber:null,installedShaBefore:oldSha,targetSha:newSha});
const evidence=()=>{
  const e={ledger:ledger(),currentSha:newSha,currentBytesVerified:true,snapshotSha:oldSha,
    snapshotBytesVerified:true,ownerIdentityVerified:true,ownerAlive:false,protectionVerified:true,
    backlogVerified:true,pauseWindowsClosed:true,workflow:'active',runnerSetVerified:true,
    supervisorVerified:true,otherControlLeaseCount:1};
  const materialHashes=Object.fromEntries(['ledger','owner','marker','currentHost',
    'snapshotHost','protectedBefore','backlog'].map(k=>[k,'f'.repeat(64)]));
  return {...classifyPostSwitchEvidence(e),requestId,actualControllerSha:newSha,
    installedShaBefore:oldSha,materialHashes};
};
// A C-approved Writer transition is separately attested; it is never labeled
// as unchanged relative to #917's historical protected snapshot.
const transitionedEvidence=()=>{
  const e=evidence();
  return {...e,checks:{...e.checks,PROTECTION_UNCHANGED:false,
    PROTECTION_CONTRACT_VERIFIED:true}};
};

function ports(calls, options={}) {
  let preflightCount=0;
  return {
    verifyPreconditions:async()=>{calls.push('preflight');preflightCount++;
      return {verified:!(options.preconditionAfterClaimFail && preflightCount>1)};},
    verifyOriginalUnchanged:async()=>{calls.push('original-unchanged');
      if(options.originalChanged)throw Object.assign(Error('ORIGINAL_CHANGED'),{code:'ORIGINAL_CHANGED'});
      return options.originalFalse ? false : true;},
    acquireClaim:async()=>{calls.push('claim');return options.claimExists ?
      {acquired:false,exclusive:false,preexisting:true}:
      {acquired:true,exclusive:true,preexisting:false};},
    reconcileBacklog:async()=>{calls.push('backlog');return options.backlog ?? {verified:true};},
    postcheck:async()=>{calls.push('postcheck');return options.post ?? {
      status:'PASS',actualExecutionSha:newSha,protectedStateUnchanged:true,
      runnerSetVerified:true,postSourceVerified:true};},
    verifyFinal:async()=>{calls.push('final');return options.final ?? {
      currentSourceSha:newSha,protectedStateUnchanged:true,workflowActive:true,
      supervisorVerified:true,backlogVerified:true,runnerSetVerified:true};},
  };
}

test('post-switch recovery candidate refuses original approval drift',()=>{
  assert.equal(forwardRecoveryCandidate(ledger(),evidence()),true);
  const change=ledger();change.code='ANOTHER_ERROR';
  assert.equal(forwardRecoveryCandidate(change,evidence()),false);
  assert.equal(forwardRecoveryCandidate(ledger(),{...evidence(),actualControllerSha:oldSha}),false);
});

test('incomplete, mismatched or unverifiable evidence cannot start any action',()=>{
  assert.equal(forwardRecoveryCandidate(ledger(),{...evidence(),requestId:'wrong'}),false);
  assert.equal(forwardRecoveryCandidate(ledger(),{...evidence(),checks:{ORIGINAL_LEDGER:true}}),false);
  assert.equal(forwardRecoveryCandidate(ledger(),{...evidence(),materialHashes:{}}),false);
  assert.equal(forwardRecoveryCandidate(ledger(),{...evidence(),materialHashes:{
    ...evidence().materialHashes,ledger:'invalid'}}),false);
});

test('durable intent precedes replay, separately verified postcheck and final readback',async()=>{
  const calls=[],records=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls),persist:async r=>{calls.push('persist:'+r.code);records.push(r);}});
  assert.equal(result.status,'FORWARD_RECONCILED');
  assert.equal(result.originalLedgerPreserved,true);
  assert.equal(result.originalRequestRetried,false);
  assert.equal(records.at(-1).code,'FORWARD_VERIFIED_READY_FOR_LEASE_ARCHIVE');
  assert.ok(calls.indexOf('persist:FORWARD_BACKLOG_REPLAY_STARTED')<calls.indexOf('backlog'));
  assert.ok(calls.indexOf('persist:FORWARD_POSTCHECK_STARTED')<calls.indexOf('postcheck'));
  assert.equal(calls.filter(x=>x==='original-unchanged').length,5);
  assert.ok(calls.indexOf('claim')<calls.indexOf('backlog'));
  assert.ok(calls.indexOf('claim')<calls.indexOf('persist:FORWARD_PREPARED'));
});

test('unverified replay is a hard stop; no postcheck',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{backlog:{verified:false,outcomeUnknown:true}}),persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_BACKLOG_NOT_VERIFIED');
  assert.equal(result.mutationStarted,true);
  assert.equal(calls.includes('postcheck'),false);
});

test('failed postcheck never reaches final readback or lease archive',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{post:{status:'FAIL',actualExecutionSha:newSha}}),persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_POSTCHECK_NOT_VERIFIED');
  assert.equal(calls.includes('final'),false);
});

test('original ledger mutation blocks success',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{originalChanged:true}),persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'ORIGINAL_CHANGED');
  assert.equal(calls.includes('backlog'),false);
});

test('a false return from original ledger CAS is also a hard stop',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{originalFalse:true}),persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_ORIGINAL_CHANGED');
  assert.equal(calls.includes('backlog'),false);
});

test('an existing recovery claim blocks a second replay attempt',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{claimExists:true}),persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_CLAIM_NOT_EXCLUSIVE');
  assert.equal(calls.includes('backlog'),false);
  assert.equal(calls.includes('postcheck'),false);
});

test('preconditions are freshly verified under the claim before any replay',async()=>{
  const calls=[],records=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{preconditionAfterClaimFail:true}),
    persist:async record=>records.push(record)});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_POSTCLAIM_PRECONDITION_DRIFT');
  assert.equal(calls.filter(x=>x==='preflight').length,2);
  assert.equal(calls.includes('backlog'),false);
  assert.equal(calls.includes('postcheck'),false);
  assert.equal(records.at(-1).next,'INSPECT_RECOVERY_CLAIM_BACKLOG_AND_POSTCHECK_NO_AUTOMATIC_RETRY');
});

test('final workflow mismatch blocks success even if backlog and postcheck were PASS',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),
    ports:ports(calls,{final:{currentSourceSha:newSha,protectedStateUnchanged:true,
      workflowActive:false,supervisorVerified:true,backlogVerified:true,runnerSetVerified:true}}),persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_FINAL_READBACK_FAILED');
});

test('missing ports never starts or writes recovery',async()=>{
  let writes=0;
  await assert.rejects(()=>reconcilePostSwitchForward({ledger:ledger(),evidence:evidence(),ports:{},
    persist:async()=>{writes++;}}),/FORWARD_PORT_MISSING/);
  assert.equal(writes,0);
});


test('an approved Writer transition is accepted without falsifying historical unchanged',async()=>{
  const ev=transitionedEvidence();
  assert.equal(ev.checks.PROTECTION_UNCHANGED,false);
  assert.equal(ev.checks.PROTECTION_CONTRACT_VERIFIED,true);
  assert.equal(forwardRecoveryCandidate(ledger(),ev),true);
  const calls=[];
  const result=await reconcilePostSwitchForward({ledger:ledger(),evidence:ev,
    ports:ports(calls,{final:{
      currentSourceSha:newSha,protectedStateUnchanged:false,protectionContractVerified:true,
      workflowActive:true,supervisorVerified:true,backlogVerified:true,runnerSetVerified:true}}),
    persist:async()=>{}});
  assert.equal(result.status,'FORWARD_RECONCILED');
  assert.ok(calls.includes('final'));
});

test('protection transition cannot bypass missing or contradictory evidence',()=>{
  const ev=transitionedEvidence();
  for(const checks of [
    {...ev.checks,PROTECTION_CONTRACT_VERIFIED:false},
    {...ev.checks,PROTECTION_UNCHANGED:true},
    {...ev.checks,RUNNERS_ONLINE:false},
  ]) {
    assert.equal(forwardRecoveryCandidate(ledger(),{...ev,checks}),false);
  }
});

test('transition drift at final readback retains recovery claim and stops',async()=>{
  const calls=[];
  const result=await reconcilePostSwitchForward({
    ledger:ledger(),evidence:transitionedEvidence(),
    ports:ports(calls,{final:{
      currentSourceSha:newSha,protectedStateUnchanged:false,protectionContractVerified:false,
      workflowActive:true,supervisorVerified:true,backlogVerified:true,runnerSetVerified:true}}),
    persist:async()=>{}});
  assert.equal(result.status,'RECOVERY_REQUIRED');
  assert.equal(result.code,'FORWARD_FINAL_READBACK_FAILED');
  assert.equal(result.mutationStarted,true);
});
