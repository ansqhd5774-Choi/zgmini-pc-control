import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateRequest,validateApproval,verifySource,issueAsOf,PINNED_SOURCE} from
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
  created_at:'2026-11-06T16:20:30Z',body:JSON.stringify(request)}};

test('Issue creation time fixes UTC observation asOf across reruns',()=>{
  assert.equal(issueAsOf(event),'2026-11-06');
  assert.equal(issueAsOf(structuredClone(event)),'2026-11-06');
  assert.equal(issueAsOf({...event,issue:{...event.issue,
    created_at:'2026-11-06T23:59:59Z'}}),'2026-11-06');
  for(const stamp of [undefined,'2026-11-31T12:00:00Z',
    '2026-12-01T00:00:00Z'])
    assert.throws(()=>issueAsOf({...event,issue:{...event.issue,
      created_at:stamp}}),/ER1_NOV_FORECAST_B_ISSUE_TIME_STOP/);
});

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

test('pinned Git blob and clean LF/CRLF checkout are accepted; drift is rejected',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'er1-b-source-test-'));
  try{
    const m={...approval,files:approval.files.map(e=>({...e}))};
    const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',
      windowsHide:true,timeout:10000}).trim();
    git(['init','-q']);
    git(['config','user.name','ER1 Test']);
    git(['config','user.email','er1-test@example.invalid']);
    git(['config','core.autocrlf','false']);
    for(const e of m.files){
      const file=path.join(dir,e.path);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,'// '+e.path+'\nexport const fixture=true;\n');
    }
    git(['add','--',...m.files.map(e=>e.path)]);
    git(['commit','-q','-m','fixture']);
    m.sourceSha=git(['rev-parse','HEAD']);
    for(const e of m.files)e.blobSha=git(['rev-parse','HEAD:'+e.path]);
    assert.equal(verifySource(dir,m),dir); // LF from initial commit.
    git(['config','core.autocrlf','true']);
    for(const e of m.files){
      const file=path.join(dir,e.path);
      fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\n/g,'\r\n'));
    }
    assert.equal(verifySource(dir,m),dir); // CRLF, Git clean-normalized.
    assert.throws(()=>verifySource(dir,m,{getHead:()=>('a'.repeat(40))}),
      /ER1_NOV_FORECAST_B_SOURCE_STOP/);
    assert.throws(()=>verifySource(dir,{...m,files:[
      {...m.files[0],blobSha:'f'.repeat(40)},...m.files.slice(1)]}),
      /ER1_NOV_FORECAST_B_SOURCE_HASH_STOP/);
    fs.appendFileSync(path.join(dir,m.files[0].path),'// tampered\r\n');
    assert.throws(()=>verifySource(dir,m),/ER1_NOV_FORECAST_B_SOURCE_HASH_STOP/);
  }finally{
    // Isolated temporary test fixture only; production paths are untouched.
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
