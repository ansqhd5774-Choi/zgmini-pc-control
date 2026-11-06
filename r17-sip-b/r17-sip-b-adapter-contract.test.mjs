import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authorizeSipInstall,digest} from './r17-sip-b-auth.mjs';
import {sanitizeSipReport} from './r17-sip-b-install-upload.mjs';
import {runWindowsInstall,coreQuietForTarget} from './r17-sip-b-install-windows.mjs';

const bytes=fs.readFileSync(new URL('./R17_SIP_B_SCOPE_DRAFT.json',import.meta.url));
const requestId='pc-r17-12345678-1234-4123-8123-123456789abc';
const chatId='chat-12345678-1234-4123-8123-123456789abc';
const request=()=>({schema:'ZGMINI_R17_SIP_B_INSTALL_REQUEST_V1',requestId,chatId,
  operation:'r17-sip-threefile-install-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  candidateSourceSha:'b30aefd89793de093369044a14d86c1fdc3b0d61',
  approvalManifestSha256:digest(bytes)});
const env=()=>({GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_RUN_ID:'42234567890',RUNNER_NAME:'zgmini-pc-01',
  GITHUB_SHA:'a'.repeat(40),R17_SIP_CONTROL_SHA:'a'.repeat(40)});
const event=()=>({action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',
    private:true},sender:{login:'ansqhd5774-Choi'},
  issue:{number:523,title:'pc-r17-sip-threefile-install',
    user:{login:'ansqhd5774-Choi'},
    labels:[{name:'pc-r17-writer-b-install'}],body:JSON.stringify(request())}});

test('single approved event and exact manifest digest admitted',()=>{
  const result=authorizeSipInstall({event:event(),env:env(),manifestBytes:bytes});
  assert.equal(result.requestId,requestId);
  assert.equal(result.registeredB,true);
  assert.equal(result.manifestSha256,digest(bytes));
});

test('legacy fivefile event cannot pass new fixed title and scope',()=>{
  const old=event();old.issue.title='pc-r17-writer-fivefile-install';
  assert.throws(()=>authorizeSipInstall({event:old,env:env(),manifestBytes:bytes}),
    {code:'SIP_B_ISSUE_AUTHORIZATION_STOP'});
  const wrong=event();wrong.issue.body=JSON.stringify({...request(),
    operation:'r17-writer-fivefile-install-once'});
  assert.throws(()=>authorizeSipInstall({event:wrong,env:env(),manifestBytes:bytes}),
    {code:'SIP_B_REQUEST_SCOPE_STOP'});
});

test('changed candidate, extra argument, event retry and manifest drift refused',()=>{
  for(const mutation of [
    x=>{x.issue.body=JSON.stringify({...request(),shell:'dir'});},
    x=>{x.issue.body=JSON.stringify({...request(),candidateSourceSha:'0'.repeat(40)});},
    x=>{x.issue.labels=[];},
  ]){const e=event();mutation(e);
    assert.throws(()=>authorizeSipInstall({event:e,env:env(),manifestBytes:bytes}));}
  assert.throws(()=>authorizeSipInstall({event:event(),env:{...env(),
    GITHUB_RUN_ATTEMPT:'2'},manifestBytes:bytes}),{code:'SIP_B_EVENT_CONTEXT_STOP'});
  assert.throws(()=>authorizeSipInstall({event:event(),env:env(),
    manifestBytes:Buffer.concat([bytes,Buffer.from(' ')])}),
    {code:'SIP_B_MANIFEST_DIGEST_STOP'});
});

test('Windows entry uses authenticated request before any PC I/O',async()=>{
  const e=event();e.issue.labels=[];
  await assert.rejects(runWindowsInstall(e,env(),bytes),
    {code:'SIP_B_ISSUE_AUTHORIZATION_STOP'});
});

test('private upload report sanitizes exact statuses and never leaks raw error',()=>{
  const good=sanitizeSipReport({status:'SIP_B_INSTALLED_VERIFIED',
    sourceSha:'f'.repeat(40),requestId},requestId,'123');
  assert.equal(good.sourceSha,'f'.repeat(40));
  assert.equal(good.status,'SIP_B_INSTALLED_VERIFIED');
  const bad=sanitizeSipReport({status:'SIP_B_INSTALL_STOP',
    code:'private key abc',recovery:'NOT_NEEDED'},requestId,'123');
  assert.equal(bad.code,'SIP_B_RESULT_UNVERIFIED');
  const recovery=sanitizeSipReport({status:'SIP_B_RECOVERY_REQUIRED',
    code:'SIP_B_DRIVER_STOP',recovery:'MANUAL_RECONCILIATION_REQUIRED'},requestId,'123');
  assert.equal(recovery.recovery,'MANUAL_RECONCILIATION_REQUIRED');
});

test('Core source/config target pair cannot re-enable while a process or lock remains',()=>{
  const quiet={instances:0,relatedProcesses:0,unknownProcessLines:0,state:3};
  assert.equal(coreQuietForTarget(quiet,false),true);
  assert.equal(coreQuietForTarget(quiet,true),false);
  assert.equal(coreQuietForTarget({...quiet,instances:1},false),false);
  assert.equal(coreQuietForTarget({...quiet,relatedProcesses:1},false),false);
  assert.equal(coreQuietForTarget({...quiet,unknownProcessLines:1},false),false);
  assert.equal(coreQuietForTarget({...quiet,state:4},false),false);
});
