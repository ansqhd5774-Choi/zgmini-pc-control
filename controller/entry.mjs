import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {need,writeJson,errorCode,digest,validateRequest} from './common.mjs';
import {readStagedPreimageScope} from './preimage-manifest-contract.mjs';
const controller=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(controller),policy=JSON.parse(fs.readFileSync(path.join(root,'config/operations.json')));
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
const seat=Number(process.env.RUNNER_NAME?.match(/^zgmini-pc-0([1-6])$/)?.[1]);const runId=process.env.GITHUB_RUN_ID,attempt=Number(process.env.GITHUB_RUN_ATTEMPT||1);
const pointer=path.join(root,'reports',`${runId}-${attempt}-${seat}.json`);fs.mkdirSync(path.dirname(pointer),{recursive:true});
try{
 // Host snapshot is loaded inside the receipt boundary: a missing or invalid
 // host manifest must not suppress the fixed BLOCKED JSON/TXT upload path.
 let host;
 try{host=JSON.parse(fs.readFileSync(path.join(root,'host.json')));}
 catch{throw Object.assign(Error('CONTROLLER_HOST_MANIFEST_UNAVAILABLE'),{code:'CONTROLLER_HOST_MANIFEST_UNAVAILABLE'});}
 for(const [rel,sha] of Object.entries(host.controllerFiles))need(digest(fs.readFileSync(path.join(root,rel)))===sha,'CONTROLLER_SOURCE_DRIFT');
 need(process.env.GITHUB_REPOSITORY===policy.controlRepository&&event.repository?.private===true,'CONTROL_REPOSITORY_OR_VISIBILITY');
 need(policy.allowedActors.includes(process.env.GITHUB_ACTOR),'ACTOR_NOT_ALLOWED');const validEvent=event.action==='opened' ||
  (event.action==='labeled'&&event.label?.name==='pc-job');
 need(process.env.GITHUB_EVENT_NAME==='issues'&&validEvent,'EVENT_NOT_ALLOWED');
 need(event.issue?.user?.login==='ansqhd5774-Choi','REQUEST_OWNER_NOT_ALLOWED');
 need(event.issue?.labels?.some(x=>x.name==='pc-job'),'REQUEST_LABEL_REQUIRED');need(!event.issue.pull_request,'PULL_REQUEST_NOT_ALLOWED');
 const raw=validateRequest(JSON.parse(event.issue.body),policy);
 if(Object.hasOwn(raw,'preimageManifestPath'))need([
  'controller/preimage-manifest-stager.mjs',
  'controller/preimage-manifest-contract.mjs'].every(x=>
   /^[0-9a-f]{64}$/.test(host.controllerFiles?.[x]??'')),
  'PREIMAGE_STAGE_SOURCE_NOT_ATTESTED');
 const approvedPreimageScope=readStagedPreimageScope({env:process.env,request:raw});
 // Delay engine/operations loading until inside the error receipt boundary.
 // Missing selective-overlay imports must still produce an uploadable BLOCKED result.
 const {executeJob}=await import('./engine.mjs');
 const result=await executeJob(raw,{root,policy,host,seat,runId,attempt,approvedPreimageScope});
 writeJson(pointer,{...result,issueNumber:event.issue.number});console.log(JSON.stringify(result.report));process.exitCode=result.report.status==='FAIL'?1:0;
}catch(error){
 const missingModule=error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND';
 const code=missingModule?'CONTROLLER_IMPORT_MISSING':errorCode(error);
 writeJson(pointer,{issueNumber:event.issue?.number,report:{schema:'ZGMINI_PC_RESULT_V1',jobId:`run-${runId}-${attempt}-seat-${seat}`,status:'BLOCKED',code,lastPass:'EVENT_RECEIVED',firstFail:missingModule?'ENGINE_IMPORT':code==='CONTROLLER_HOST_MANIFEST_UNAVAILABLE'?'HOST_MANIFEST_READ':'EVENT_OR_REQUEST_VALIDATION',operationalWrites:0,providerCalls:0,d1Writes:0}});console.log(JSON.stringify({status:'BLOCKED',code}));process.exitCode=1;}
