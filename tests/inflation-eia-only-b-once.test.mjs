import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CONTROL_REPO,SOURCE_REPO,SOURCE_SHA,TITLE,APPROVAL,WRITER,FILE_HASHES,
  isPinnedSourceCommit,validateRequest,verifyApproval,verifySource,
  configuredEiaKey,validateChildResult,
} from './inflation-eia-only-b-once.mjs';

const uuid='123e4567-e89b-42d3-a456-426614174000';
function validRequest(){
  return {event:{action:'opened',repository:{private:true},issue:{title:TITLE,
    user:{login:'ansqhd5774-Choi'},body:JSON.stringify({
      schema:'ZGMINI_INFLATION_EIA_ONLY_ONCE_V1',
      operation:'collect-eia-only-private-once',sourceSha:SOURCE_SHA,
      requestId:`pc-inflation-eia-only-${uuid}`,chatId:`chat-${uuid}`,})}},
    env:{GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
      GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'}};
}
function successful(){return {status:'PASS',code:'EIA_ONLY_SAVED_READBACK',
  ids:1,providerCalls:2,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0,
  counts:{EIA_INDUSTRIAL_US:225},latest:{EIA_INDUSTRIAL_US:'2026-08'},
  fileSha256:{EIA_INDUSTRIAL_US:'a'.repeat(64)}}}
function manifest(){return {schema:'ZGMINI_INFLATION_EIA_ONLY_B_APPROVAL_V1',
  scope:'EIA_INDUSTRIAL_US_PRIVATE_ONCE',sourceRepository:SOURCE_REPO,
  sourceSha:SOURCE_SHA,writerHome:WRITER,
  outputRelative:'inflation-causal-r1/electricity-industrial-eia.json',
  maxProviderRequests:2,maxAutomaticRetries:0,allowFredCalls:false,
  allowCoreWrites:false,allowDbWrites:false,allowD1Writes:false,
  allowSchedulerChanges:false,allowPublicRawData:false,
  sourceFileHashes:FILE_HASHES}}

test('EIA-only exact private issue request is admitted',()=>{
  const {event,env}=validRequest();
  assert.equal(validateRequest(event,env).sourceSha,SOURCE_SHA);
});
test('untrusted actors and extra arbitrary fields denied',()=>{
  const {event,env}=validRequest();
  assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'other'}),/EIAONE_ISSUE_DENIED/);
  assert.throws(()=>validateRequest({...event,repository:{private:false}},env),/EIAONE_ISSUE_DENIED/);
  const data=JSON.parse(event.issue.body);
  assert.throws(()=>validateRequest({...event,issue:{...event.issue,
    body:JSON.stringify({...data,shell:'cmd /c whoami'})}},env),/EIAONE_REQUEST_DENIED/);
  assert.throws(()=>validateRequest({...event,issue:{...event.issue,
    body:JSON.stringify({...data,sourceSha:'0'.repeat(40)})}},env),/EIAONE_REQUEST_DENIED/);
});
test('40 hexadecimal Git commit SHA is distinct from 64-hex file SHA',()=>{
  // This same exported runtime gate would have caught previous GASEL_SOURCE_UNPINNED.
  if(SOURCE_SHA!=='__PIN_SOURCE_SHA__'){
    assert.equal(isPinnedSourceCommit(),true);
    assert.match(SOURCE_SHA,/^[a-f0-9]{40}$/);
  }else assert.equal(isPinnedSourceCommit(),false);
});
test('source file hash remains pinned and placeholders refuse execution',()=>{
  if(SOURCE_SHA==='__PIN_SOURCE_SHA__'){
    assert.throws(()=>verifySource(os.tmpdir()),/EIAONE_SOURCE_SHA_UNPINNED/);
  }else{
    for(const h of Object.values(FILE_HASHES))assert.match(h,/^[a-f0-9]{64}$/);
  }
});
test('manifest refuses FRED, Core, D1, schedule and quota escalation',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'eia-b-approval-'));
  try{
    fs.mkdirSync(path.join(tmp,'control'));
    const file=path.join(tmp,'control',APPROVAL),good=manifest();
    fs.writeFileSync(file,JSON.stringify(good));
    assert.equal(verifyApproval(tmp).maxProviderRequests,2);
    for(const mod of [{allowFredCalls:true},{allowCoreWrites:true},{allowDbWrites:true},
      {allowD1Writes:true},{allowSchedulerChanges:true},{allowPublicRawData:true},
      {maxProviderRequests:3},{maxAutomaticRetries:1},{sourceSha:'0'.repeat(40)}]){
      fs.writeFileSync(file,JSON.stringify({...good,...mod}));
      assert.throws(()=>verifyApproval(tmp),/EIAONE_APPROVAL_DENIED/);
    }
  }finally{fs.rmSync(tmp,{force:true,recursive:true})}
});
test('exact one EIA series result and 2 calls, no raw leakage or FRED',()=>{
  assert.equal(validateChildResult(successful()).ids,1);
  const good=successful();
  for(const bad of [{providerCalls:3},{ids:2},{coreWrites:1},
    {counts:{DHHNGSP:400}},{latest:{EIA_INDUSTRIAL_US:'wrong'}},
    {fileSha256:{EIA_INDUSTRIAL_US:'secret'}}])
    assert.throws(()=>validateChildResult({...good,...bad}),/EIAONE_CHILD_CONTRACT_DENIED/);
});
test('configured EIA key aliases recognized without revealing secret',()=>{
  assert.equal(configuredEiaKey({EIA_API_KEY:'secret'}),true);
  assert.equal(configuredEiaKey({EIA_KEY:'secret'}),true);
  assert.equal(configuredEiaKey({FRED_API_KEY:'secret'}),false);
  assert.equal(configuredEiaKey({}),false);
});
