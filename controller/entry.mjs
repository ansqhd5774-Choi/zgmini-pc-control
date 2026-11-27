import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {need,writeJson,errorCode,digest,validateRequest,assertSupervisorOwner,publicJobLogEnvelope} from './common.mjs';
const controller=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(controller);
let policy,event,importFailureStage='EVENT_OR_REQUEST_VALIDATION';
const seat=Number(process.env.RUNNER_NAME?.match(/^zgmini-pc-0([1-6])$/)?.[1]);const runId=process.env.GITHUB_RUN_ID,attempt=Number(process.env.GITHUB_RUN_ATTEMPT||1);
const pointer=path.join(root,'reports',`${runId}-${attempt}-${seat}.json`);fs.mkdirSync(path.dirname(pointer),{recursive:true});
try{
 // Event identity precedes policy loading so a corrupt local policy still
 // retains the original, trusted Issue number in the BLOCKED result pointer.
 event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
 try{policy=JSON.parse(fs.readFileSync(path.join(root,'config/operations.json')));}
 catch{throw Object.assign(Error('CONTROLLER_POLICY_UNAVAILABLE'),{code:'CONTROLLER_POLICY_UNAVAILABLE'});}
 // A syntactically valid scalar or incomplete object is not an executable
 // local policy. Keep it inside the same fixed BLOCKED receipt boundary.
 need(policy!==null&&typeof policy==='object'&&!Array.isArray(policy)&&
  policy.controlRepository==='ansqhd5774-Choi/zgmini-pc-control'&&
  Number.isSafeInteger(policy.maxReportBytes)&&policy.maxReportBytes>0&&
  Array.isArray(policy.allowedActors)&&
  policy.operations!==null&&typeof policy.operations==='object'&&
  !Array.isArray(policy.operations),'CONTROLLER_POLICY_UNAVAILABLE');
 // Host snapshot is loaded inside the receipt boundary: a missing or invalid
 // host manifest must not suppress the fixed BLOCKED JSON/TXT upload path.
 let host;
 try{host=JSON.parse(fs.readFileSync(path.join(root,'host.json')));}
 catch{throw Object.assign(Error('CONTROLLER_HOST_MANIFEST_UNAVAILABLE'),{code:'CONTROLLER_HOST_MANIFEST_UNAVAILABLE'});}
 // A syntactically valid JSON value is not necessarily an installed host manifest.
 // Distinguish missing manifest shape from operational source-file drift.
 need(host!==null&&typeof host==='object'&&!Array.isArray(host)&&
  host.controllerFiles!==null&&typeof host.controllerFiles==='object'&&
  !Array.isArray(host.controllerFiles),'CONTROLLER_HOST_MANIFEST_UNAVAILABLE');
 // The maintenance prevalidation contract requires these nine baseline
 // runtime files. Counting arbitrary entries is not proof they are attested.
 const required=['config/operations.json','controller/common.mjs','controller/engine.mjs',
  'controller/entry.mjs','controller/fear-greed-archive-readonly.mjs',
  'controller/operations.mjs','controller/supervisor.mjs','controller/upload.mjs',
  'controller/worker.mjs'];
 const files=Object.entries(host.controllerFiles);
 need(/^[a-f0-9]{40}$/.test(host.controllerSourceSha??'')&&
  required.every(rel=>/^[a-f0-9]{64}$/.test(host.controllerFiles[rel]??''))&&
  files.every(([rel,sha])=>/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel)
   &&/^[a-f0-9]{64}$/.test(sha)),'CONTROLLER_HOST_MANIFEST_UNAVAILABLE');
 for(const [rel,sha] of Object.entries(host.controllerFiles))need(digest(fs.readFileSync(path.join(root,rel)))===sha,'CONTROLLER_SOURCE_DRIFT');
 // Guard new work at installed, standby-attested Controller entry only.
 assertSupervisorOwner(root,host);
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
 // The preimage module is optional. Ordinary PC operations must not depend
 // on loading its files, while scoped requests still fail closed and retain
 // their distinct PREIMAGE_STAGE_IMPORT receipt if its import is unavailable.
 let approvedPreimageScope=null;
 if(Object.hasOwn(raw,'preimageManifestPath')){
  importFailureStage='PREIMAGE_STAGE_IMPORT';
  const {readStagedPreimageScope}=await import('./preimage-manifest-contract.mjs');
  approvedPreimageScope=readStagedPreimageScope({env:process.env,request:raw});
 }
 // Delay engine/operations loading until inside the error receipt boundary.
 // Missing selective-overlay imports must still produce an uploadable BLOCKED result.
 importFailureStage='ENGINE_IMPORT';
 const {executeJob}=await import('./engine.mjs');
 const result=await executeJob(raw,{root,policy,host,seat,runId,attempt,approvedPreimageScope});
 writeJson(pointer,{...result,issueNumber:event.issue.number});console.log(JSON.stringify(publicJobLogEnvelope(result.report,event?.repository?.private)));process.exitCode=result.report.status==='FAIL'?1:0;
}catch(error){
 const missingModule=error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND';
 const code=missingModule?'CONTROLLER_IMPORT_MISSING':errorCode(error);
 writeJson(pointer,{issueNumber:event?.issue?.number,report:{schema:'ZGMINI_PC_RESULT_V1',jobId:`run-${runId}-${attempt}-seat-${seat}`,status:'BLOCKED',code,lastPass:'EVENT_RECEIVED',firstFail:missingModule?importFailureStage:code==='CONTROLLER_HOST_MANIFEST_UNAVAILABLE'?'HOST_MANIFEST_READ':'EVENT_OR_REQUEST_VALIDATION',operationalWrites:0,providerCalls:0,d1Writes:0}});// Any failure may occur *before* GitHub event origin is authenticated.
 // Never disclose its raw diagnostic code in a public Actions log.
 // The exact original code remains in the fixed local BLOCKED pointer.
 console.log(JSON.stringify(publicJobLogEnvelope({status:'BLOCKED',code},false)));process.exitCode=1;}
