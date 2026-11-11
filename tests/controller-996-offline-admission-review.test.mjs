import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {review996PcJobWorkflowSource,review996OfflinePcJobAdmission}
  from '../tools/controller-996-offline-admission-review.mjs';

const workflowText=fs.readFileSync(new URL('../.github/workflows/pc-job.yml',import.meta.url),'utf8');
const start='2026-11-11T00:00:00.000Z';
const future='2026-11-11T08:00:00.000Z';
const row=id=>({id,name:`pc-runner-${id}`,
  machine:'기존 ZGMINI PC',status:'offline',busy:false,
  labels:['self-hosted','Windows','X64','zgmini-pc-control']});
const fixture=()=>({stage:'PRE_OFFLINE',workflowText,workflowState:'active',
  workflowMutationCount:0,runnerInventoryComplete:true,
  runnerRows:Array.from({length:6},(_,i)=>row(i+1)),runningJobs:0,
  drainConfirmed:true,windowsAutoStartHeld:true,
  offlineStartAt:start,plannedResumeAt:future});
const review=changes=>review996OfflinePcJobAdmission({...fixture(),...changes});

test('exact current pc-job opened-event self-hosted route is the contract',()=>{
  assert.equal(review996PcJobWorkflowSource(workflowText),true);
  for(const changed of [
    workflowText.replace('types: [opened]','types: [edited]'),
    workflowText.replace('runs-on: [self-hosted, Windows, X64, zgmini-pc-control]',
      'runs-on: [self-hosted, Windows, X64, zgmini-handoff-ci-isolated]'),
    workflowText.replace("github.actor == 'ansqhd5774-Choi'",'github.actor == github.actor'),
    workflowText.replace("'pc-job'","'pc-maintenance'"),
  ])assert.equal(review996PcJobWorkflowSource(changed),false);
});
test('nominal synthetic before-offline review is NOT permission to change PCs',()=>{
  const result=review();
  assert.equal(result.status,'SYNTHETIC_CONTRACT_REVIEWED_ONLY');
  assert.equal(result.matchedRunnerCount,6);
  assert.deepEqual(result.pcTopology,{physicalPcCount:2,
    existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
    additionalPcRequired:false});
  assert.equal(result.maxQueuedHours,24);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.evidenceAuthenticated,false);
  assert.equal(result.workflowPuts,0);
  assert.equal(result.issuePosts,0);
  assert.equal(result.pcWrites,0);
});
test('workflow must remain active without enable/disable calls',()=>{
  assert.equal(review({workflowState:'disabled_manually'}).code,
    'C996_ADMISSION_WORKFLOW_NOT_ACTIVE_OR_CHANGED');
  assert.equal(review({workflowMutationCount:1}).code,
    'C996_ADMISSION_WORKFLOW_NOT_ACTIVE_OR_CHANGED');
});
test('incomplete inventory and missing runner route fail without effects',()=>{
  assert.equal(review({runnerInventoryComplete:false}).code,
    'C996_ADMISSION_RUNNER_INVENTORY_INCOMPLETE');
  assert.equal(review({runnerRows:[]}).code,
    'C996_ADMISSION_RUNNER_INVENTORY_INCOMPLETE');
  assert.equal(review({runnerRows:[row(1),row(1)]}).code,
    'C996_ADMISSION_RUNNER_INVENTORY_INCOMPLETE');
});
test('matching runner on common queue PC cannot accept the original PC job',()=>{
  const rows=fixture().runnerRows;
  rows[2].machine='공통 대기열 PC';
  assert.equal(review({runnerRows:rows}).code,
    'C996_ADMISSION_MATCHING_RUNNER_ON_OTHER_PC');
});
test('live matching runner, busy runner or undrained job blocks offline cutover',()=>{
  for(const changes of [
    {runnerRows:[{...row(1),status:'online'}]},
    {runnerRows:[{...row(1),busy:true}]},
    {runningJobs:1},
    {drainConfirmed:false},
  ]){
    const result=review(changes);
    assert.ok(['C996_ADMISSION_RUNNER_NOT_OFFLINE',
      'C996_ADMISSION_RUNNER_OR_JOB_NOT_DRAINED'].includes(result.code));
    assert.equal(result.executionAuthorized,false);
    assert.equal(result.automaticRetry,false);
  }
});
test('automatic Runner startup before original Windows postcheck is forbidden',()=>{
  assert.equal(review({windowsAutoStartHeld:false}).code,
    'C996_ADMISSION_WINDOWS_RESTART_NOT_FENCED');
});
test('GitHub queued job expiry is bounded by 24 hours, never infinite',()=>{
  for(const plannedResumeAt of ['2026-11-12T00:00:00.000Z',
    '2026-11-12T03:00:00.000Z','invalid',start]){
    const r=review({plannedResumeAt});
    assert.equal(r.code,'C996_ADMISSION_QUEUE_24H_BOUND_NOT_PROVEN');
  }
});
test('before resuming, require postcheck while all matching runners remain offline',()=>{
  const good=review({stage:'BEFORE_RESUME',postReadbackVerified:true,
    runnerResumeOccurred:false});
  assert.equal(good.status,'SYNTHETIC_CONTRACT_REVIEWED_ONLY');
  const premature=review({stage:'BEFORE_RESUME',postReadbackVerified:false,
    runnerResumeOccurred:false});
  assert.equal(premature.code,'C996_ADMISSION_POSTCHECK_BEFORE_RESUME_NOT_PROVEN');
  const resumed=review({stage:'BEFORE_RESUME',postReadbackVerified:true,
    runnerResumeOccurred:true});
  assert.equal(resumed.code,'C996_ADMISSION_POSTCHECK_BEFORE_RESUME_NOT_PROVEN');
});
test('oldest queued run must still be under 24 hours before resume',()=>{
  const r=review({stage:'BEFORE_RESUME',postReadbackVerified:true,
    runnerResumeOccurred:false,oldestQueuedAt:'2026-11-10T06:00:00.000Z'});
  assert.equal(r.code,'C996_ADMISSION_QUEUE_24H_BOUND_NOT_PROVEN');
});
test('synthetic claim never grants C-grade authority even with every guard true',()=>{
  const r=review({stage:'BEFORE_RESUME',postReadbackVerified:true,
    runnerResumeOccurred:false});
  assert.equal(r.productionExecutable,false);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.workflowPuts,0);
  assert.equal(r.issuePosts,0);
  assert.equal(r.pcWrites,0);
});
