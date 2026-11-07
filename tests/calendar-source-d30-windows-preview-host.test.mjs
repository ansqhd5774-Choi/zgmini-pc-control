import assert from 'node:assert/strict';
import test from 'node:test';
import {D30_INSTALL_CONTRACT} from '../calendar-source-d30/contract.mjs';
import {validateD30ReadOnlyIssue,parseD30ReadOnlyIssueEvent,
  runD30ReadOnlyWindowsHost}
  from '../calendar-source-d30/windows-preview-host.mjs';

const owner='ansqhd5774-Choi';
const repo=`${owner}/zgmini-pc-control`;
const controlSha='a'.repeat(40);
const request={schema:'ZGMINI_CALENDAR_D30_READONLY_PREVIEW_V1',
  requestId:'pc-calendar-d30-18b0a810-1b20-4a30-8b40-a150b160c170',
  operation:'calendar-d30-readonly-preview-once',
  controlSha,
  candidateHead:D30_INSTALL_CONTRACT.sourceHead,
  baseHead:D30_INSTALL_CONTRACT.historicPublicSourceSha};
const env={GITHUB_REPOSITORY:repo,GITHUB_ACTOR:owner,
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:controlSha};

function fixture(){
  return {env:{...env},controlHead:controlSha,event:{action:'opened',
    repository:{private:true,full_name:repo},
    sender:{login:owner},
    issue:{user:{login:owner},title:'pc-calendar-d30-readonly-preview-once',
      body:JSON.stringify(request)}}};
}

test('exact private owner-origin Issue and control SHA authorizes read-only preview only',()=>{
  const r=validateD30ReadOnlyIssue(fixture());
  assert.equal(r.requestId,request.requestId);
  assert.equal(r.controlHead,controlSha);
  assert.equal('install' in r,false);
});

test('normal GitHub Issue metadata beyond 8 KiB does not block a valid request',()=>{
  const f=fixture();
  f.event.repository.description='context'.repeat(3000);
  const bytes=Buffer.from(JSON.stringify(f.event),'utf8');
  assert.ok(bytes.length>8192);
  const event=parseD30ReadOnlyIssueEvent(bytes);
  assert.equal(validateD30ReadOnlyIssue({...f,event}).requestId,request.requestId);
  assert.throws(()=>parseD30ReadOnlyIssueEvent(Buffer.alloc(2_000_000)),
    {code:'ER1_D30_PREVIEW_EVENT_FILE_STOP'});
});

test('other actor or mismatched control checkout cannot authorize source reads',()=>{
  const f=fixture();f.env.GITHUB_ACTOR='another-user';
  assert.throws(()=>validateD30ReadOnlyIssue(f),
    {code:'ER1_D30_PREVIEW_EVENT_STOP'});
  f.env.GITHUB_ACTOR=owner;f.controlHead='b'.repeat(40);
  assert.throws(()=>validateD30ReadOnlyIssue(f),
    {code:'ER1_D30_PREVIEW_EVENT_STOP'});
});

test('public Issue or PR event stops despite matching apparent user',()=>{
  const f=fixture();f.event.repository.private=false;
  assert.throws(()=>validateD30ReadOnlyIssue(f),
    {code:'ER1_D30_PREVIEW_ISSUE_STOP'});
  f.event.repository.private=true;
  f.event.issue.pull_request={url:'not-an-issue'};
  assert.throws(()=>validateD30ReadOnlyIssue(f),
    {code:'ER1_D30_PREVIEW_ISSUE_STOP'});
});

test('body scope is exact: candidate SHA, operation and surplus keys rejected',()=>{
  const f=fixture();
  for(const change of [{candidateHead:'b'.repeat(40)},
    {operation:'install'}, {newCommand:'powershell'}]){
    f.event.issue.body=JSON.stringify({...request,...change});
    assert.throws(()=>validateD30ReadOnlyIssue(f),
      {code:'ER1_D30_PREVIEW_REQUEST_STOP'});
  }
});

test('non-Windows environment safe-stops before workspace and source access',async()=>{
  if(process.platform==='win32')return;
  const report=await runD30ReadOnlyWindowsHost({env:{...env}});
  assert.equal(report.status,'READ_ONLY_PREVIEW_BLOCKED');
  assert.equal(report.code,'ER1_D30_PREVIEW_WINDOWS_ONLY');
  assert.equal(report.sourceWrites,0);
  assert.ok(JSON.stringify(report).length<32_768);
});
