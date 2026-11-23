import test from 'node:test';
import assert from 'node:assert/strict';
import {BEA_B_SCHEMA,BEA_B_SCOPE,BEA_B_MODE,
  isApprovedBeaNativeSource,verifyBeaInstalledBinding,verifyBeaCapture}
  from './bea-native-source-once.mjs';
import {applyApprovedOnce} from './run.mjs';
import {resolveConfiguredSourcePin} from './configured-source-pin.mjs';
import {sanitizeDirectBReport} from './report.mjs';

const sha40='a'.repeat(40),sha64='b'.repeat(64),httpSha='c'.repeat(64);
const approval=()=>({
  schema:BEA_B_SCHEMA,status:'APPROVED_B',scope:BEA_B_SCOPE,
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha:sha40,
  profileId:'bea-unit-nipa-r1',
  runnerPath:'scripts/pc-writer/EARNINGS_BEA_UNIT_NIPA_SOURCE_OWNER_R1.mjs',
  installedSourceSha:sha40,
  dataRoot:String.raw`E:\ZGmini\data\pc-writer`,
  sourceRoot:String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`,
  runCount:1,effects:{providerCalls:1,privateArchiveWrites:true,
    sqliteWrites:false,d1Writes:false,taskDefinitionChanges:false,
    newTasks:false,otherOperationalFiles:false}
});
const capture=()=>({status:'SOURCE_STORED_READBACK_VERIFIED',
  providerRequests:1,sourceVersion:sha64,sourceHttpSha256:httpSha,
  sourceStoredAt:1795400000000,observedThrough:'2026Q2'});
test('one narrowly authenticated BEA archive effect; no generic provider escalation',()=>{
  const m=approval();
  assert.equal(isApprovedBeaNativeSource(m),true);
  for(const invalid of [
    {...m,scope:'GENERIC_PROVIDER_WRITE'},
    {...m,effects:{...m.effects,providerCalls:2}},
    {...m,effects:{...m.effects,d1Writes:true}},
    {...m,effects:{...m.effects,sqliteWrites:true}},
    {...m,sourceSha:'main'},
    {...m,runnerPath:'custom.mjs'},
    {...m,runCount:2},
    {...m,effects:{...m.effects,allowOther:true}}
  ])assert.equal(isApprovedBeaNativeSource(invalid),false);
  assert.equal(verifyBeaInstalledBinding(m,{head:sha40,configSource:sha40}),true);
  assert.throws(()=>verifyBeaInstalledBinding(m,{
    head:'d'.repeat(40),configSource:sha40}),/SOURCE_CAS_STOP/);
  assert.throws(()=>verifyBeaInstalledBinding(m,{
    head:sha40,configSource:'d'.repeat(40)}),/SOURCE_CAS_STOP/);
});
test('hash, time, and period required for a claimed private archive readback',()=>{
  const valid=capture();assert.equal(verifyBeaCapture(valid).sourceVersion,sha64);
  for(const x of [
    {...valid,status:'READY'}, {...valid,providerRequests:0},
    {...valid,sourceVersion:'bogus'},
    {...valid,sourceHttpSha256:'bogus'},
    {...valid,sourceStoredAt:0},
    {...valid,observedThrough:'2027Q5'}
  ])assert.throws(()=>verifyBeaCapture(x),/ARCHIVE_READBACK_STOP/);
});
test('shared source pin resolves BEA B only on exact approved schema',()=>{
  const m=approval();
  assert.equal(resolveConfiguredSourcePin({
    loadAuth:()=>({mode:BEA_B_MODE,manifest:m})}),sha40);
  assert.throws(()=>resolveConfiguredSourcePin({
    loadAuth:()=>({mode:BEA_B_MODE,manifest:{...m,effects:{
      ...m.effects,d1Writes:true}}})}),/BEA_SOURCE_PIN_STOP/);
});
test('shared B dispatcher and report preserve proof without D1 or raw data',async()=>{
  const m=approval(),auth={mode:BEA_B_MODE,manifest:m,
    request:{requestId:'test',approvalManifestSha256:sha64},
    raw:Buffer.from('approval'),controlSha:sha40};
  const approved=await applyApprovedOnce(auth,{
    beaCandidateRoot:'/test/pin',beaRunner:async()=>({
      status:'PASS',providerRequests:1,...capture()})});
  assert.equal(approved.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
  assert.equal(approved.mode,BEA_B_MODE);
  const raw={...approved,manifestSha256:sha64};
  const env={GITHUB_RUN_ID:'123',GITHUB_JOB:'approved-runtime-b',
    DIRECT_B_CONFIGURED_OUTCOME:'success',
    DIRECT_B_CANDIDATE_OUTCOME:'success',
    DIRECT_B_APPLY_OUTCOME:'success'};
  const reported=sanitizeDirectBReport(raw,{
    requestId:'test',approvalManifestSha256:sha64},env);
  // A PASS without process-exit proof must remain UNKNOWN, never invented.
  assert.equal(reported.operationSucceeded,false);
  assert.equal(reported.code,'DIRECT_B_RESULT_PROCESS_CONFLICT');
  const unknown=await applyApprovedOnce(auth,{
    beaCandidateRoot:'/test/pin',beaRunner:async()=>({
      status:'STATE_UNKNOWN',code:'DIRECT_B_BEA_ATTEMPT_RECONCILE_REQUIRED'})});
  assert.equal(unknown.status,'DIRECT_B_EFFECT_UNKNOWN');
});
