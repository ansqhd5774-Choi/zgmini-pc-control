import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRequest,validateApproval,verifySource,PINNED_SOURCE} from
  '../er1-nov-forecast-publish-entry.mjs';

const approval=JSON.parse(fs.readFileSync(new URL(
  '../ER1_NOV_FORECAST_B_APPROVAL.json',import.meta.url),'utf8'));
const uuid='12345678-1234-4123-8123-123456789012';
const request={schema:'ZGMINI_ER1_NOV_FORECAST_B_V1',
  operation:'saved-forecast-publish',sourceSha:PINNED_SOURCE,
  requestId:'pc-er1-nov-forecast-'+uuid,chatId:'chat-'+uuid,month:'2026-11'};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'};
const event={action:'opened',issue:{title:'pc-er1-nov-forecast-publish',
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-er1-approved'}],
  body:JSON.stringify(request)}};

test('fixed issue accepts exactly saved-only forecast B and pinned source',()=>{
  assert.deepEqual(validateRequest(event,env),request);
  for(const modified of [
    {issue:{...event.issue,body:JSON.stringify({...request,month:'2026-12'})}},
    {issue:{...event.issue,title:'pc-er1-nov30-full'}},
    {issue:{...event.issue,body:JSON.stringify({...request,
      sourceSha:'f'.repeat(40)})}}
  ])assert.throws(()=>validateRequest({...event,...modified},env),
    /ER1_NOV_FORECAST_B_(ISSUE|REQUEST)_STOP/);
});

test('approval is November public score only and zero vendor calls',()=>{
  assert.equal(validateApproval(approval),approval);
  assert.equal(approval.maxProviderCalls,0);
  assert.equal(approval.maxD1Writes,1);
  assert.equal(approval.allowCoreWrites,false);
  for(const wrong of [
    {...approval,maxProviderCalls:1},
    {...approval,month:'2026-12'},
    {...approval,outputKey:'market-calendar:earnings-dec2026-er1-score-public'}
  ])assert.throws(()=>validateApproval(wrong),
    /ER1_NOV_FORECAST_B_APPROVAL_STOP/);
});

test('source pin and file bytes are checked before D1 helper import',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'er1-b-source-test-'));
  try{
    const m={...approval,files:approval.files.map(e=>({...e}))};
    for(const e of m.files){
      const file=path.join(dir,e.path);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const data=Buffer.from('fixture:'+e.path);
      fs.writeFileSync(file,data);
      e.blobSha=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
    }
    assert.equal(verifySource(dir,m,{getHead:()=>PINNED_SOURCE}),dir);
    assert.throws(()=>verifySource(dir,m,{getHead:()=>('a'.repeat(40))}),
      /ER1_NOV_FORECAST_B_SOURCE_STOP/);
    fs.appendFileSync(path.join(dir,m.files[0].path),'x');
    assert.throws(()=>verifySource(dir,m,{getHead:()=>PINNED_SOURCE}),
      /ER1_NOV_FORECAST_B_SOURCE_HASH_STOP/);
  }finally{
    // Isolated temporary test fixture only; production paths are untouched.
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
