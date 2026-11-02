import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {executeJob} from './engine.mjs';import {need,writeJson,errorCode,digest} from './common.mjs';
const controller=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(controller),host=JSON.parse(fs.readFileSync(path.join(root,'host.json'))),policy=JSON.parse(fs.readFileSync(path.join(root,'config/operations.json')));
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
const seat=Number(process.env.RUNNER_NAME?.match(/^zgmini-pc-0([1-6])$/)?.[1]);const runId=process.env.GITHUB_RUN_ID,attempt=Number(process.env.GITHUB_RUN_ATTEMPT||1);
const pointer=path.join(root,'reports',`${runId}-${attempt}-${seat}.json`);fs.mkdirSync(path.dirname(pointer),{recursive:true});
try{
 for(const [rel,sha] of Object.entries(host.controllerFiles))need(digest(fs.readFileSync(path.join(root,rel)))===sha,'CONTROLLER_SOURCE_DRIFT');
 need(process.env.GITHUB_REPOSITORY===policy.controlRepository&&event.repository?.private===true,'CONTROL_REPOSITORY_OR_VISIBILITY');
 need(policy.allowedActors.includes(process.env.GITHUB_ACTOR),'ACTOR_NOT_ALLOWED');need(process.env.GITHUB_EVENT_NAME==='issues'&&event.action==='opened','EVENT_NOT_ALLOWED');
 need(event.issue?.labels?.some(x=>x.name==='pc-job'),'REQUEST_LABEL_REQUIRED');need(!event.issue.pull_request,'PULL_REQUEST_NOT_ALLOWED');
 const raw=JSON.parse(event.issue.body);const result=await executeJob(raw,{root,policy,host,seat,runId,attempt});
 writeJson(pointer,{...result,issueNumber:event.issue.number});console.log(JSON.stringify(result.report));process.exitCode=result.report.status==='FAIL'?1:0;
}catch(error){writeJson(pointer,{issueNumber:event.issue?.number,report:{schema:'ZGMINI_PC_RESULT_V1',jobId:`run-${runId}-${attempt}-seat-${seat}`,status:'BLOCKED',code:errorCode(error),lastPass:'EVENT_RECEIVED',firstFail:'EVENT_OR_REQUEST_VALIDATION',operationalWrites:0,providerCalls:0,d1Writes:0}});console.log(JSON.stringify({status:'BLOCKED',code:errorCode(error)}));process.exitCode=1;}
