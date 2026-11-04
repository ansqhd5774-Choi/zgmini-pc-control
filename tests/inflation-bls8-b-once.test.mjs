import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateRequest,validateChildResult,verifyApproval,
  TITLE,SOURCE_SHA,SOURCE_REPO,SOURCE_FILE_HASHES,WRITER,APPROVAL,CONTROL_REPO} from './inflation-bls8-b-once.mjs';

const uuid='123e4567-e89b-42d3-a456-426614174000';
const valid=()=>({
  event:{action:'opened',repository:{private:true},issue:{title:TITLE,
    user:{login:'ansqhd5774-Choi'},body:JSON.stringify({schema:'ZGMINI_INFLATION_BLS8_ONCE_V1',
      operation:'collect-bls8-private-once',sourceSha:SOURCE_SHA,
      requestId:`pc-inflation-bls8-${uuid}`,chatId:`chat-${uuid}`})}},
  env:{GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
    GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'},
});
const result=()=>({status:'PASS',code:'BLS8_SAVED_READBACK',ids:8,providerCalls:1,
  coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0,
  latest:Object.fromEntries(Object.keys(SOURCE_FILE_HASHES).length&&[
    'WPU1017','WPU102502','WPU081','WPU061','WPU012','WPU0221','WPU029','WPUID61'
  ].map(x=>[x,'2026-09-01'])),
  counts:Object.fromEntries([
    'WPU1017','WPU102502','WPU081','WPU061','WPU012','WPU0221','WPU029','WPUID61'
  ].map(x=>[x,160])),
});

test('fixed issue actor/shape/sourceSha admitted',()=>{
  const {event,env}=valid();
  const got=validateRequest(event,env);
  assert.equal(got.sourceSha,SOURCE_SHA);
  assert.equal(got.operation,'collect-bls8-private-once');
});
test('untrusted issue author and extra shell-style input denied',()=>{
  const {event,env}=valid();
  assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'other'}),/BLS8_ISSUE_DENIED/);
  const body=JSON.parse(event.issue.body);
  const modified={...event,issue:{...event.issue,body:JSON.stringify({...body,cmd:'echo secret'})}};
  assert.throws(()=>validateRequest(modified,env),/BLS8_REQUEST_DENIED/);
  const wrong={...event,issue:{...event.issue,body:JSON.stringify({...body,sourceSha:'a'.repeat(40)})}};
  assert.throws(()=>validateRequest(wrong,env),/BLS8_REQUEST_DENIED/);
});
test('child result rejects missing, partial, and invalid dates',()=>{
  assert.equal(validateChildResult(result()).status,'PASS');
  const base=result();assert.throws(()=>validateChildResult({...base,ids:7}),/CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,providerCalls:2}),/CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,coreWrites:1}),/CONTRACT_DENIED/);
  assert.throws(()=>validateChildResult({...base,latest:{...base.latest,WPU1017:'invalid'}}),/CONTRACT_DENIED/);
});
test('manifest scope cannot escalate to Core, D1 or schedules',()=>{
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'bls8-approval-'));
  try{
    fs.mkdirSync(path.join(work,'control'));
    const approval={schema:'ZGMINI_INFLATION_BLS8_B_APPROVAL_V1',scope:'BLS8_PC_PRIVATE_ONCE',
      sourceRepository:SOURCE_REPO,sourceSha:SOURCE_SHA,writerHome:WRITER,
      outputRelative:'inflation-causal-r1/bls-ppi8.json',maxProviderRequests:1,
      maxAutomaticRetries:0,allowCoreWrites:false,allowDbWrites:false,
      allowD1Writes:false,allowSchedulerChanges:false,allowPublicRawData:false,
      sourceFileHashes:SOURCE_FILE_HASHES};
    const file=path.join(work,'control',APPROVAL);
    fs.writeFileSync(file,JSON.stringify(approval));
    assert.equal(verifyApproval(work).scope,'BLS8_PC_PRIVATE_ONCE');
    fs.writeFileSync(file,JSON.stringify({...approval,allowD1Writes:true}));
    assert.throws(()=>verifyApproval(work),/BLS8_APPROVAL_DENIED/);
  }finally{fs.rmSync(work,{recursive:true,force:true});}
});
