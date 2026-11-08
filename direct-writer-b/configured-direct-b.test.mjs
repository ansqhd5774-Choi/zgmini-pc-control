import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authorizeApprovedRaw,applyApprovedOnce} from './run.mjs';
import {sanitizeDirectBReport,directBTextReport} from './report.mjs';
import {resolveConfiguredSourcePin} from './configured-source-pin.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const repo='ansqhd5774-Choi/zgmini-pc-control';
const sourceSha='0c97599431882245a156470bd51290e327e7ee78';
const requestId='abeb79fe-03b3-4f7c-9df3-f521bff31c50';
const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'823'};
const approved={schema:'ZGMINI_CONFIGURED_RUNTIME_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'PC_WRITER_CONFIGURED_THEME_REPEAT_UPGRADE_ONLY',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha,
  profileId:'configured-themes',
  runnerPath:'scripts/pc-writer/theme-config-package-runner.mjs',
  packageManifestSha256:'b'.repeat(64),
  runtimeMode:'REPEATABLE_ACTIVE_RUNTIME',
  runtimePreimage:{activeRuntimeSha256:'c'.repeat(64),
    taskXmlSha256:'d'.repeat(64),scheduledCmdSha256:'e'.repeat(64),
    scheduledVbsSha256:'f'.repeat(64)},
  effects:{providerCalls:false,dbWrites:false,d1Writes:false,
    taskDefinitionChanges:false,newTasks:false,
    otherOperationalFiles:false}};
function fixture(manifest=approved){
  const raw=Buffer.from(JSON.stringify(manifest)+'\n');
  const request={schema:'ZGMINI_PC_APPROVED_RUNTIME_B_ACTIONS_REQUEST_V1',
    requestId,chatId:'bc5fe67b-c68d-4b62-9448-6b15a05e9241',
    operation:'pc-approved-runtime-b',controlRepository:repo,
    approvalManifestSha256:sha(raw)};
  const event={repository:{full_name:repo,private:true},
    sender:{login:'ansqhd5774-Choi'},issue:{user:{login:'ansqhd5774-Choi'},
      title:'pc-approved-runtime-b',number:832,
      labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(request)}};
  return {raw,request,event,auth:()=>authorizeApprovedRaw({event,env,raw,
    worktree:raw,actualHead:env.GITHUB_SHA})};
}

test('exact private owner, approval bytes and configured source pin',()=>{
  const f=fixture(),auth=f.auth();
  assert.equal(auth.mode,'CONFIGURED_THEMES_REPEAT_UPGRADE');
  assert.equal(resolveConfiguredSourcePin({event:f.event,env,controlRoot:'/fixed',
    loadAuth:()=>auth}),sourceSha);
  assert.throws(()=>fixture({...approved,runnerPath:'scripts/evil.mjs'}).auth(),
    /DIRECT_B_EFFECT_SCOPE_STOP/);
  f.event.sender.login='other';
  assert.throws(f.auth,/DIRECT_B_ISSUE_OWNER_STOP/);
});

test('two-direction Windows evidence reaches bounded JSON and TXT',async()=>{
  const f=fixture();
  const r=await applyApprovedOnce(f.auth(),{configuredRunner:async()=>({
    status:'DONE',sourceSha,
    verified:'PC_RUNTIME_SOURCE_TASK_MANUAL_ACTIVE_ROLLBACK',
    compatibilityEvidenceSha256:'9'.repeat(64),
    compatibilityDirections:2,compatibilitySharedLockVerified:true})});
  const report=sanitizeDirectBReport(r,f.request,env);
  assert.equal(report.operationSucceeded,true);
  assert.equal(report.compatibilityEvidenceSha256,'9'.repeat(64));
  assert.equal(report.compatibilityDirections,2);
  assert.equal(report.compatibilitySharedLockVerified,true);
  assert.match(directBTextReport(report),/RUN_ID=823/);
  assert.match(directBTextReport(report),/COMPATIBILITY_DIRECTIONS=2/);
});

test('untrusted fixture proof is stripped and cannot prove an effect',async()=>{
  const f=fixture();
  const result=await applyApprovedOnce(f.auth(),{
    configuredRunner:async()=>({status:'BLOCKED',
      reason:'B_FIXED_WINDOWS_REQUIRED',
      compatibilityEvidenceSha256:'9'.repeat(64),
      compatibilityDirections:1,compatibilitySharedLockVerified:true})});
  const report=sanitizeDirectBReport(result,f.request,env);
  assert.equal(report.operationSucceeded,false);
  assert.equal(report.compatibilityEvidenceSha256,null);
});
