import test from 'node:test';
import assert from 'node:assert/strict';
import {
  review996RunnerAdmissionReceipts,
  verify996RunnerAdmissionSnapshotStable,
  collect996RunnerAdmissionBaselineReadOnly,
} from '../tools/controller-996-runner-admission-bridge.mjs';

const names=Array.from({length:6},(_,i)=>
  `zgmini-pc-${String(i+1).padStart(2,'0')}`);
function sample({offline=false,pause=false,drain=false}={}){
  return {
    workflowState:'active',
    remoteRunners:{
      schema:'ZGMINI_996_PC_JOB_RUNNER_GET_V1',
      status:'RUNNER_INVENTORY_GET_ONLY',totalCount:7,
      runners:[...names.map((name,i)=>({
        id:10001+i,name,status:offline?'offline':'online',busy:false,
        labels:['self-hosted','Windows','X64','zgmini-pc-control'],
      })),{id:40001,name:'zgmini-handoff-ci-isolated',status:'offline',
        busy:false,labels:['self-hosted','Windows','X64','queue-worker']}],
    },
    remoteRuns:{schema:'ZGMINI_996_PC_JOB_RUNS_GET_V1',
      status:'WORKFLOW_RUNS_GET_ONLY',counts:{queued:2,in_progress:0,waiting:0}},
    localRunner:{schema:'ZGMINI_996_LOCAL_RUNNER_IDENTITY_READONLY_V1',
      status:'LOCAL_RUNNER_REGISTRATION_OBSERVED_ONLY',
      pcName:'기존 ZGMINI PC',startupAndWatchdogHashesMatch:true,
      bindings:names.map((name,i)=>({id:10001+i,name})),
      watchdogPausePresent:pause,controllerDrainPresent:drain,
      secret:'NEVER_EXPOSE_SECRET_LOCAL_RUNNER_URL'},
  };
}

test('six exact local and GitHub registration pairs remain observed only',()=>{
  const evidence=review996RunnerAdmissionReceipts(sample());
  assert.equal(evidence.status,'BASELINE_OBSERVED_READ_ONLY');
  assert.equal(evidence.matchingRunnerCount,6);
  assert.equal(evidence.physicalPcCount,2);
  assert.equal(evidence.existingPcName,'기존 ZGMINI PC');
  assert.equal(evidence.queuePcName,'공통 대기열 PC');
  assert.deepEqual(evidence.counts,{queued:2,inProgress:0,waiting:0});
  assert.equal(evidence.allOffline,false);
  assert.equal(evidence.markersObserved,false);
  for(const field of ['admissionEligible','processExitProven',
    'readbackAfterWindowsBootProven','sourceAuthenticatedExternally',
    'ownerApprovalVerified','executionAuthorized','productionExecutable'])
    assert.equal(evidence[field],false);
  for(const field of ['pcWrites','workflowPuts','issuePosts'])
    assert.equal(evidence[field],0);
  assert.equal(JSON.stringify(evidence).includes('NEVER_EXPOSE_SECRET'),false);
});

test('even offline plus both markers are not Owner C admission evidence',()=>{
  const evidence=review996RunnerAdmissionReceipts(sample({
    offline:true,pause:true,drain:true}));
  assert.equal(evidence.allOffline,true);
  assert.equal(evidence.noRunning,true);
  assert.equal(evidence.markersObserved,true);
  assert.equal(evidence.admissionEligible,false);
  assert.equal(evidence.processExitProven,false);
  assert.equal(evidence.executionAuthorized,false);
});

test('mismatched ID, missing registration and duplicate local runner block',()=>{
  const mismatch=sample();mismatch.localRunner.bindings[0].id=55555;
  assert.throws(()=>review996RunnerAdmissionReceipts(mismatch),
    /C996_ADMISSION_BRIDGE_LOCAL_REMOTE_RUNNER_MISMATCH/);
  const missing=sample();missing.localRunner.bindings.pop();
  assert.throws(()=>review996RunnerAdmissionReceipts(missing),
    /C996_ADMISSION_BRIDGE_LOCAL_INVENTORY_INVALID/);
  const duplicate=sample();duplicate.localRunner.bindings[5].id=10001;
  assert.throws(()=>review996RunnerAdmissionReceipts(duplicate),
    /C996_ADMISSION_BRIDGE_LOCAL_REMOTE_RUNNER_MISMATCH/);
});

test('foreign Runner with control label and missing Windows label block',()=>{
  const foreign=sample();
  foreign.remoteRunners.runners[6].labels.push('zgmini-pc-control');
  assert.throws(()=>review996RunnerAdmissionReceipts(foreign),
    /C996_ADMISSION_BRIDGE_LOCAL_REMOTE_RUNNER_MISMATCH/);
  const label=sample();
  label.remoteRunners.runners[3].labels=['self-hosted','X64','zgmini-pc-control'];
  assert.throws(()=>review996RunnerAdmissionReceipts(label),
    /C996_ADMISSION_BRIDGE_LOCAL_REMOTE_RUNNER_MISMATCH/);
});

test('disabled workflow or malformed GH run counts block',()=>{
  const disabled=sample();disabled.workflowState='disabled_manually';
  assert.throws(()=>review996RunnerAdmissionReceipts(disabled),
    /C996_ADMISSION_BRIDGE_WORKFLOW_UNVERIFIED/);
  const missing=sample();delete missing.remoteRuns.counts.waiting;
  assert.throws(()=>review996RunnerAdmissionReceipts(missing),
    /C996_ADMISSION_BRIDGE_WORKFLOW_RUNS_INVALID/);
  const incomplete=sample();incomplete.remoteRunners.totalCount=10;
  assert.throws(()=>review996RunnerAdmissionReceipts(incomplete),
    /C996_ADMISSION_BRIDGE_REMOTE_INVENTORY_INVALID/);
});

test('stable repeated GitHub/local reads can ignore harmless row ordering',()=>{
  const first=sample(),second=sample();
  second.remoteRunners.runners.reverse();
  second.remoteRunners.runners[3].labels.reverse();
  second.localRunner.bindings.reverse();
  assert.equal(verify996RunnerAdmissionSnapshotStable(first,second),true);
});

test('two-read drift in Runner status, workflow jobs and markers blocks',()=>{
  for(const scenario of ['status','busy','queue','pause','drain','labels']){
    const first=sample(),second=sample();
    if(scenario==='status')second.remoteRunners.runners[1].status='offline';
    if(scenario==='busy')second.remoteRunners.runners[1].busy=true;
    if(scenario==='queue')second.remoteRuns.counts.queued=1;
    if(scenario==='pause')second.localRunner.watchdogPausePresent=true;
    if(scenario==='drain')second.localRunner.controllerDrainPresent=true;
    if(scenario==='labels')second.remoteRunners.runners[6].labels.push('misc');
    assert.throws(()=>verify996RunnerAdmissionSnapshotStable(first,second),
      /C996_ADMISSION_BRIDGE_SNAPSHOT_DRIFT/,scenario);
  }
});

test('production entrypoint cannot run on Linux or inject synthetic I/O',()=>{
  assert.throws(()=>collect996RunnerAdmissionBaselineReadOnly(),
    /C_996_INSTALLED_GH_ORIGINAL_WINDOWS_ONLY/);
});
