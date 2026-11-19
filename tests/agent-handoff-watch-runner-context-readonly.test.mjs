import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 REPOSITORY,TITLE,SCHEMA,URL,POLLS,INTERVAL_MS,
 validateContext,classifyRunnerState,inspectRunnerContext,sampleFiveSecondReads
} from '../tools/handoff-watch-runner-context-readonly.mjs';

const request={schema:SCHEMA,operation:'read-only-context-and-cadence',target:'handoff',
 requestId:'ab12cd34-5678-4abc-8a12-3456789abcde'};
const event=()=>({action:'opened',repository:{full_name:REPOSITORY,private:true},
 issue:{number:2142,user:{login:'ansqhd5774-Choi'},title:TITLE,body:JSON.stringify(request)}});
const env={GITHUB_EVENT_NAME:'issues',GITHUB_REPOSITORY:REPOSITORY,
 GITHUB_ACTOR:'ansqhd5774-Choi',RUNNER_NAME:'zgmini-handoff-ci-spare-01',
 GITHUB_RUN_ID:'44000000000',GITHUB_RUN_ATTEMPT:'1'};
test('fixed-owner issue authentication prohibits other PCs, accounts and arbitrary commands',()=>{
 assert.equal(validateContext(event(),env,'DESKTOP-N62L0NG').issueNumber,2142);
 for(const [e,v,h] of [
  [event(),env,'OTHER-PC'],[event(),{...env,RUNNER_NAME:'zgmini-pc-01'},'DESKTOP-N62L0NG'],
  [event(),{...env,GITHUB_ACTOR:'other'},'DESKTOP-N62L0NG'],
  [{...event(),issue:{...event().issue,user:{login:'other'}}},env,'DESKTOP-N62L0NG'],
  [{...event(),issue:{...event().issue,body:JSON.stringify({...request,cmd:'create task'})}},env,'DESKTOP-N62L0NG'],
  [{...event(),action:'labeled'},env,'DESKTOP-N62L0NG'],
  [event(),{...env,GITHUB_RUN_ATTEMPT:'2'},'DESKTOP-N62L0NG']
 ])assert.throws(()=>validateContext(e,v,h),/HANDOFF_WATCH_RUNNER_ADMISSION_STOP/);
});
test('valid JSON whitespace and property order do not change admission',()=>{
 const formatted = JSON.stringify({target:'handoff',requestId:request.requestId,
   operation:'read-only-context-and-cadence',schema:SCHEMA},null,2);
 assert.equal(validateContext({...event(),issue:{...event().issue,body:formatted}},
   env,'DESKTOP-N62L0NG').issueNumber,2142);
 for (const body of ['{invalid',JSON.stringify({...request,target:'other'}),
   JSON.stringify({...request,unknown:true})]) {
   assert.throws(()=>validateContext({...event(),issue:{...event().issue,body}},
     env,'DESKTOP-N62L0NG'),/HANDOFF_WATCH_RUNNER_ADMISSION_STOP/);
 }
});
const baseline={schema:'ZGMINI_HANDOFF_WATCH_RUNNER_CONTEXT_PROBE_V1',
 sessionId:0,serviceSid:true,adminGroupToken:true,taskQueryOk:true,taskExists:false,ghCliPresent:true};
test('a privileged Session 0 Runner is NOT authorized to install interactive per-user watch',()=>{
 const info=classifyRunnerState(baseline);
 assert.equal(info.sessionZero,true);
 assert.equal(info.adminGroupToken,true);
 assert.equal(info.runnerContextEligibleForUserActivation,false);
 assert.equal(info.verdict,'RUNNER_CONTEXT_CANNOT_OWN_USER_ONLOGON_WATCH');
 assert.equal(info.taskRegistrationPermissionTested,false);
 assert.equal(info.userCredentialStoreVerified,false);
 assert.equal(info.taskRegistrationAttempted,false);
 assert.equal(info.operationalWrites,0);
 assert.equal(info.taskExists,false);
 assert.equal(classifyRunnerState({...baseline,taskQueryOk:false,taskExists:false}).taskExists,null);
 assert.throws(()=>classifyRunnerState({...baseline,taskQueryOk:false,taskExists:true}));
});
test('read-only PowerShell process probe returns fixed booleans only, no SID/paths',()=>{
 const output=JSON.stringify({...baseline,token:'SENSITIVE',path:'C:\\private'});
 let commandText='';
 const report=inspectRunnerContext({run:(exe,args,opts)=>{
   assert.equal(exe,'powershell.exe');
   assert.deepEqual(args.slice(0,2),['-NoProfile','-NonInteractive']);
   assert.equal(opts.timeout,12_000);
   commandText=args[3];
   return {status:0,stdout:output};
 }});
 assert.match(commandText,/Get-ScheduledTask/);
 assert.doesNotMatch(commandText,/Register-ScheduledTask|Set-ScheduledTask|New-ScheduledTask|Start-ScheduledTask|gh auth token/);
 assert.equal(report.taskExists,false);
 assert.ok(!JSON.stringify(report).includes('SENSITIVE'));
 assert.ok(!JSON.stringify(report).includes('C:\\private'));
});
test('three bounded GET reads occur at 5s start cadence with only job token',async()=>{
 let now=1_000_000;
 const requests=[];
 const result=await sampleFiveSecondReads({
  token:'synthetic-token-not-to-log',clock:()=>now,
  sleep:async ms=>{now+=ms;},
  fetchImpl:async(url,options)=>{
   requests.push({t:now,url,hasToken:options.headers.Authorization==='Bearer synthetic-token-not-to-log'});
   return {status:requests.length===1?200:304,headers:{get:()=>'"fixed-etag"'},
    body:{cancel:async()=>{}}};
  }
 });
 assert.equal(POLLS,3);
 assert.equal(INTERVAL_MS,5_000);
 assert.deepEqual(requests.map(x=>x.t),[1_000_000,1_005_000,1_010_000]);
 assert.ok(requests.every(x=>x.url===URL&&x.hasToken));
 assert.deepEqual(result.readHttpCodes,[200,304,304]);
 assert.equal(result.successfulReads,3);
 assert.equal(result.observedMinStartIntervalMs,5_000);
 assert.equal(result.observedMaxStartIntervalMs,5_000);
 assert.equal(result.persistentCredentialVerified,false);
 assert.equal(result.actualUserTaskStarted,false);
 assert.equal(result.operationalWrites,0);
 assert.ok(!JSON.stringify(result).includes('synthetic-token-not-to-log'));
});
test('429 stops without 5-second retry flood or leaking credentials',async()=>{
 let calls=0;
 const report=await sampleFiveSecondReads({token:'private-token',clock:()=>1_000_000,
  sleep:async()=>{throw Error('should not sleep after 429');},
  fetchImpl:async()=>{calls++;return {status:429,headers:{get:()=>null},body:{cancel:async()=>{}}};}});
 assert.equal(calls,1);
 assert.deepEqual(report.readHttpCodes,[429]);
 assert.equal(report.successfulReads,0);
 assert.equal(report.sampleCount,1);
 assert.equal(report.observedMinStartIntervalMs,null);
 assert.ok(!JSON.stringify(report).includes('private-token'));
});
test('workflow scope permits only issue-triggered read-only isolated 2-minute job',()=>{
 const workflow=readFileSync('.github/workflows/handoff-watch-runner-context-readonly.yml','utf8');
 for(const q of [
  'types: [opened]','issues: read','contents: read',
  "github.actor == 'ansqhd5774-Choi'",
  'zgmini-handoff-ci-isolated','timeout-minutes: 2',
  "github.run_attempt == 1",
  'GITHUB_TOKEN: \${{ github.token }}'
 ])assert.ok(workflow.includes(q),q);
 assert.ok(workflow.includes("github.event.issue.title == 'handoff-watch-runner-context-readonly'"));
 assert.ok(workflow.indexOf('Confirm isolated queue host before checking out source') <
   workflow.indexOf('uses: actions/checkout@'));
 assert.doesNotMatch(workflow,/contains\(github\.event\.issue\.body/);
 assert.doesNotMatch(workflow,/issues: write|contents: write|schedule:|workflow_dispatch:|powershell.*Register-ScheduledTask/);
});
