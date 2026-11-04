import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validateRequest,validateChildResult,summarizePartialResult,configuredProviderKeys,
  verifyApproval,verifySource,isPinnedSourceCommit,
  TITLE,SOURCE_SHA,SOURCE_REPO,SOURCE_FILE_HASHES,WRITER,APPROVAL,CONTROL_REPO,
} from './inflation-gas-electric-b-once.mjs';

const uuid='123e4567-e89b-42d3-a456-426614174000';
const valid=()=>({
  event:{action:'opened',repository:{private:true},issue:{title:TITLE,
    user:{login:'ansqhd5774-Choi'},body:JSON.stringify({
      schema:'ZGMINI_INFLATION_GAS_ELECTRIC_ONCE_V1',
      operation:'collect-gas-electric-private-once',sourceSha:SOURCE_SHA,
      requestId:`pc-inflation-gas-electric-${uuid}`,chatId:`chat-${uuid}`,
    })}},
  env:{GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
    GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'},
});
const result=()=>({status:'PASS',code:'GAS_ELECTRIC_SAVED_READBACK',
  ids:2,providerCalls:3,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0,
  counts:{DHHNGSP:1600,EIA_INDUSTRIAL_US:150},
  latest:{DHHNGSP:'2026-10-30',EIA_INDUSTRIAL_US:'2026-09'},
  fileSha256:{DHHNGSP:null,EIA_INDUSTRIAL_US:null}});

test('private owned exact Issue schema allows only fixed operation',()=>{
  const {event,env}=valid();
  assert.equal(validateRequest(event,env).sourceSha,SOURCE_SHA);
  assert.equal(validateRequest(event,env).operation,'collect-gas-electric-private-once');
});
test('untrusted actors, fake Issue scope, and arbitrary command injection denied',()=>{
  const {event,env}=valid();
  assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'other'}),/GASEL_ISSUE_DENIED/);
  assert.throws(()=>validateRequest({...event,repository:{private:false}},env),/GASEL_ISSUE_DENIED/);
  const body=JSON.parse(event.issue.body);
  const injection={...event,issue:{...event.issue,body:JSON.stringify({...body,cmd:'powershell'})}};
  assert.throws(()=>validateRequest(injection,env),/GASEL_REQUEST_DENIED/);
  const changed={...event,issue:{...event.issue,body:JSON.stringify({...body,sourceSha:'a'.repeat(40)})}};
  assert.throws(()=>validateRequest(changed,env),/GASEL_REQUEST_DENIED/);
});
test('strict 2-series/3-calls valid child result; reject wrong counts or raw data',()=>{
  assert.equal(validateChildResult(result()).status,'PASS');
  const base=result();
  assert.throws(()=>validateChildResult({...base,providerCalls:4}),/GASEL_CHILD_RESULT_CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,ids:1}),/GASEL_CHILD_RESULT_CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,dbWrites:1}),/GASEL_CHILD_RESULT_CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,counts:{DHHNGSP:100}}),/GASEL_CHILD_RESULT_CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,latest:{...base.latest,EIA_INDUSTRIAL_US:'invalid'}}),/GASEL_CHILD_RESULT_CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,fileSha256:{...base.fileSha256,raw:'secret'}}),/GASEL_CHILD_RESULT_CONTRACT_DENIED/);
});
test('manifest rejects any Core, D1, scheduler, or provider-cap escalation',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gas-el-approval-'));
  try{
    fs.mkdirSync(path.join(dir,'control'));
    const approval={schema:'ZGMINI_INFLATION_GAS_ELECTRIC_B_APPROVAL_V1',
      scope:'GAS_ELECTRIC_PC_PRIVATE_ONCE',sourceRepository:SOURCE_REPO,
      sourceSha:SOURCE_SHA,writerHome:WRITER,
      outputRelatives:['inflation-causal-r1/gas-dhhngsp.json',
        'inflation-causal-r1/electricity-industrial-eia.json'],
      maxProviderRequests:3,maxAutomaticRetries:0,
      allowCoreWrites:false,allowDbWrites:false,allowD1Writes:false,
      allowSchedulerChanges:false,allowPublicRawData:false,
      sourceFileHashes:SOURCE_FILE_HASHES};
    const file=path.join(dir,'control',APPROVAL);
    fs.writeFileSync(file,JSON.stringify(approval));
    assert.equal(verifyApproval(dir).scope,'GAS_ELECTRIC_PC_PRIVATE_ONCE');
    for(const modified of [
      {...approval,allowCoreWrites:true},
      {...approval,allowDbWrites:true},
      {...approval,allowD1Writes:true},
      {...approval,allowSchedulerChanges:true},
      {...approval,maxProviderRequests:4},
      {...approval,sourceSha:'0'.repeat(40)},
    ]){
      fs.writeFileSync(file,JSON.stringify(modified));
      assert.throws(()=>verifyApproval(dir),/GASEL_APPROVAL_DENIED/);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('source pin is 40 hexadecimal chars and placeholder cannot remain',()=>{
  assert.match(SOURCE_SHA,/^[0-9a-f]{40}$/);
  assert.equal(isPinnedSourceCommit(),true,'exact Git commit must satisfy the same runtime guard');
  for(const h of Object.values(SOURCE_FILE_HASHES))assert.match(h,/^[0-9a-f]{64}$/);
});
test('source SHA gate denies absent checkout on Linux test fixture',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gas-el-source-'));
  try{
    assert.throws(()=>verifySource(dir));
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('partial provider keys do not block independent available source',()=>{
  assert.deepEqual(configuredProviderKeys({FRED_API_KEY:'key'}),{fred:true,eia:false});
  assert.deepEqual(configuredProviderKeys({FRED_KEY:'key'}),{fred:true,eia:false});
  assert.deepEqual(configuredProviderKeys({EIA_API_KEY:'key'}),{fred:false,eia:true});
  assert.deepEqual(configuredProviderKeys({EIA_KEY:'key'}),{fred:false,eia:true});
  assert.deepEqual(configuredProviderKeys({}),{fred:false,eia:false});
});
test('partial output returns one safe completed source and exact other failure',()=>{
  const partial={status:'PARTIAL',code:'GAS_ELECTRIC_PARTIAL_INPUTS',
    ids:1,providerCalls:1,providerAttempts:1,
    counts:{DHHNGSP:560},latest:{DHHNGSP:'2026-10-30'},
    fileSha256:{DHHNGSP:'a'.repeat(64)},failures:{EIA_INDUSTRIAL_US:'EIA_KEY_MISSING'},
    coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
  const safe=summarizePartialResult(partial);
  assert.equal(safe.latest.DHHNGSP,'2026-10-30');
  assert.equal(safe.failures.EIA_INDUSTRIAL_US,'EIA_KEY_MISSING');
  assert.equal(Object.keys(safe).length,5);
  assert.throws(()=>summarizePartialResult({...partial,counts:{DHHNGSP:0}}),
    /PARTIAL_CONTRACT_DENIED/);
  assert.throws(()=>summarizePartialResult({...partial,failures:{EIA_INDUSTRIAL_US:'secret_123'}}),
    /PARTIAL_CONTRACT_DENIED/);
  assert.throws(()=>summarizePartialResult({...partial,providerCalls:4}),
    /PARTIAL_CONTRACT_DENIED/);
});
