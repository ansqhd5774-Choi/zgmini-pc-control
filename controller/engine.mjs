import fs from 'node:fs';import path from 'node:path';import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {digest,need,validateRequest,writeJson,exclusive,errorCode} from './common.mjs';import {protectedState,readCore,nativeTaskXml,nativeRetiredIranEvidence,
 CORE_STATUS_STAGES} from './operations.mjs';
import {memoryAdmissionMinimum,waitForMemoryAdmission} from './memory-admission.mjs';
import {R6_READONLY_STAGES} from './employment-r6-collection-evidence-readonly.mjs';
const worker=fileURLToPath(new URL('./worker.mjs',import.meta.url));
// Only reviewed fixed operations with no provider/DB/operational write effect
// may return useful reads when an unrelated Scheduler observation is missing.
// The caller cannot select or expand this class in the Issue payload.
const ISOLATED_READS=new Set(['runner-smoke','core-status','core-runtime-source-readonly','writer-install-preimage-readonly']);
const unavailableProtection=e=>['RETIRED_IRAN_INVENTORY_UNAVAILABLE',
 'PROTECTED_TASK_XML_QUERY_FAILED'].includes(errorCode(e));
function readFixedStage(workspace,filename,allowedStages){
 try{
  const marker=path.join(workspace,filename);
  const stat=fs.lstatSync(marker);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>128)return null;
  const body=JSON.parse(fs.readFileSync(marker,'utf8'));
  return body&&typeof body==='object'&&!Array.isArray(body)&&
   Object.keys(body).length===1&&allowedStages.includes(body.stage)?body.stage:null;
 }catch{return null;}
}
export const readFixedR6Stage=workspace=>
 readFixedStage(workspace,'employment-r6-readonly-stage.json',R6_READONLY_STAGES);
export const readFixedCoreStatusStage=workspace=>
 readFixedStage(workspace,'core-status-readonly-stage.json',CORE_STATUS_STAGES);
function noteUnavailableProtection(report,error,phase){
 report[phase==='PRECHECK'?'protectionPrecheckCode':'protectionPostcheckCode']=errorCode(error);
 if(phase==='POSTCHECK')report.postcheckFailureCode=errorCode(error);
 if(['SCHTASKS_INVENTORY_COMMAND_FAILED','SCHTASKS_INVENTORY_EMPTY_PARSE'].includes(error?.probeReason))
  report.protectedProbeReason=error.probeReason;
}
export async function executeJob(raw,{root,policy,host,seat,runId,attempt=1,queryTask=nativeTaskXml,retiredTaskEvidence=nativeRetiredIranEvidence,fixture=false,terminateTree=null,terminationGraceMs=5000,fixtureFreeMiB=null,fixtureMemoryWaitMs=20,fixtureMemoryPollMs=2,approvedPreimageScope=null}={}){
 need(Number.isInteger(seat)&&seat>=1&&seat<=policy.seats,'SEAT_NOT_ALLOWED');need(/^\d{1,20}$/.test(String(runId)),'RUN_ID');
 const workspaceId=`run-${runId}-${attempt}-seat-${seat}`,workspace=path.join(root,'jobs',workspaceId);fs.mkdirSync(workspace,{recursive:true});
 const start=Date.now(),report={schema:'ZGMINI_PC_RESULT_V1',jobId:workspaceId,requestId:typeof raw?.requestId==='string'&&/^[a-z0-9-]{8,80}$/.test(raw.requestId)?raw.requestId:null,startedAt:new Date(start).toISOString(),controlRepository:policy.controlRepository,controlSourceSha:host.controllerSourceSha,sourceRepository:policy.sourceRepository,requestedSourceSha:/^[a-f0-9]{40}$/.test(raw?.sourceSha??'')?raw.sourceSha:null,sourceBranch:typeof raw?.sourceBranch==='string'&&/^[a-zA-Z0-9_./-]{1,160}$/.test(raw.sourceBranch)?raw.sourceBranch:null,operation:Object.hasOwn(policy.operations,raw?.operation)?raw.operation:'NOT_ALLOWED',seat,status:'BLOCKED',code:'PREFLIGHT_NOT_COMPLETED',lastPass:'REQUEST_RECEIVED',firstFail:null,operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false,controlWorkspaceWrites:true};
 let releaseSeat,releaseRequest,releaseResource,releaseMemoryWait,ledger,before,uncertainChild=false,preflightOperation='REQUEST_VALIDATION';
 try{
  const request=validateRequest(raw,policy);report.chatId=request.chatId;preflightOperation='REQUEST_LEDGER';const payloadSha=digest(JSON.stringify(request));
  const isolatedRead=policy.mutationsEnabled===false&&
   policy.operations[request.operation].grade==='A'&&
   policy.operations[request.operation].resource==='light'&&ISOLATED_READS.has(request.operation);
  report.effectClass=isolatedRead?'FIXED_READONLY_NO_PROVIDER_NO_DB':'REGISTERED_OPERATION';
  const ledgerRoot=path.join(root,'ledger');fs.mkdirSync(ledgerRoot,{recursive:true});ledger=path.join(ledgerRoot,request.requestId+'.json');
  if(fs.existsSync(ledger)){const prior=JSON.parse(fs.readFileSync(ledger));need(prior.payloadSha===payloadSha,'DUPLICATE_REQUEST_PAYLOAD_CHANGED');need(['PASS','FAIL','BLOCKED','STATE_UNKNOWN'].includes(prior.report?.status),'PRIOR_RESULT_INVALID');Object.assign(report,{status:prior.report.status,code:prior.report.code,lastPass:prior.report.lastPass,firstFail:prior.report.firstFail,actualExecutionSha:prior.report.actualExecutionSha,protectedStateUnchanged:prior.report.protectedStateUnchanged});report.reused=true;report.reuseCode='DUPLICATE_REUSED_NO_EXECUTION';report.prior=prior.report;return finalize();}
  preflightOperation='REQUEST_LEASE';releaseRequest=exclusive(path.join(root,'leases'),'request-'+request.requestId);
  preflightOperation='MEMORY_ADMISSION';const minimumFreeMiB=memoryAdmissionMinimum(policy,request.operation);
  if(minimumFreeMiB!==null){
   report.memoryAdmission=await waitForMemoryAdmission({minimumFreeMiB,
    onWaitBegin:()=>{try{releaseMemoryWait=exclusive(path.join(root,'leases'),'heavy-memory-wait');}
     catch(error){if(error.code==='LEASE_BUSY')throw Object.assign(new Error('MEMORY_WAIT_ALREADY_ACTIVE'),{code:'MEMORY_WAIT_ALREADY_ACTIVE'});throw error;}},
    ...(fixture?{timeoutMs:fixtureMemoryWaitMs,intervalMs:fixtureMemoryPollMs,
     ...(typeof fixtureFreeMiB==='function'?{readFreeMiB:fixtureFreeMiB}:{})}:{})});
   releaseMemoryWait?.();releaseMemoryWait=undefined;
   if(!report.memoryAdmission.admitted){
    Object.assign(report,{status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',phase:'PREVALIDATION',failureOperation:'MEMORY_ADMISSION',
     lastPass:'MEMORY_ADMISSION_SAMPLED',firstFail:'MEMORY_ADMISSION',next:'MEMORY_WAIT_EXPIRED_NEW_REQUEST_ONLY',
     nextAction:'WAIT_FOR_MEMORY_THEN_NEW_REQUEST',mutationStarted:false,affectedScope:'OWN_REQUEST_ONLY'});
    report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-start;
    writeJson(ledger,{payloadSha,report});return finalize();
   }
  }
  preflightOperation='SEAT_LEASE';releaseSeat=exclusive(path.join(root,'leases'),'seat-'+seat);
  if(policy.operations[request.operation].resource==='heavy'){preflightOperation='RESOURCE_LEASE';releaseResource=exclusive(path.join(root,'leases'),'heavy');}
  preflightOperation='PROTECTED_STATE_SNAPSHOT';try{before=protectedState(host.dataRoot,{retiredTaskEvidence,queryTask:task=>{
   try{return queryTask(task);}catch{throw Object.assign(new Error('PROTECTED_TASK_XML_QUERY_FAILED'),{code:'PROTECTED_TASK_XML_QUERY_FAILED',safeTaskName:task});}
  }});}
  catch(error){if(isolatedRead&&unavailableProtection(error)){
   noteUnavailableProtection(report,error,'PRECHECK');
  }else{const retiredIranFailure=String(error?.code??'').startsWith('RETIRED_IRAN_');
   const protectedProbeReason=['SCHTASKS_INVENTORY_COMMAND_FAILED',
    'SCHTASKS_INVENTORY_EMPTY_PARSE'].includes(error?.probeReason)?error.probeReason:null;
   Object.assign(report,{phase:'PREVALIDATION',failureOperation:'PROTECTED_STATE_SNAPSHOT',mutationStarted:false,
    affectedScope:'OWN_REQUEST_ONLY',nextAction:retiredIranFailure?'VERIFY_APPROVED_RETIRED_IRAN_STATE_NO_RETRY':'INSPECT_REQUIRED_TASK_REGISTRATION_NO_AUTOMATIC_RETRY',
    ...(protectedProbeReason?{protectedProbeReason}:{}),
    ...(retiredIranFailure?{failedProtectedTask:'ZGMINI-PC-Iran-Progress-R13'}:typeof error.safeTaskName==='string'?{failedProtectedTask:error.safeTaskName}:{})});throw error;}}
  preflightOperation='CORE_STATE_READ';report.pcOperationalApprovedSha=readCore(host.dataRoot).approvedSourceSha??null;report.lastPass=before?'PROTECTED_STATE_SNAPSHOT':'CORE_STATE_READ';
  preflightOperation='WORKER_INPUT_WRITE';
  const input=path.join(workspace,'input.json'),output=path.join(workspace,'worker-result.json');
  writeJson(input,{request,context:{workspace,workspaceId,dataRoot:host.dataRoot,policy,host,seat,approvedPreimageScope,
   skipProtectedTaskObservation:isolatedRead&&!before&&request.operation==='core-status'}});
  const ms=policy.operations[request.operation].timeoutSeconds*1000;
  preflightOperation='WORKER_EXECUTION';const childResult=await new Promise(resolve=>{
   const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,PATH:path.dirname(process.execPath),TEMP:workspace,TMP:workspace};
   const child=spawn(process.execPath,[worker,input,output],{env,cwd:workspace,windowsHide:true,stdio:'ignore'});let timedOut=false,settled=false,grace;
   const timer=setTimeout(()=>{timedOut=true;grace=setTimeout(()=>{if(!settled){settled=true;child.unref();resolve({code:null,timedOut:true,terminationUnknown:true,pid:child.pid});}},terminationGraceMs);if(child.pid){if(terminateTree)try{terminateTree(child.pid);}catch{}else if(process.platform==='win32')try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});}catch{}else child.kill('SIGKILL');}},ms);
   child.on('error',()=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);resolve({code:-1,timedOut});});child.on('exit',code=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);resolve({code,timedOut});});
  });
  report.lastPass='ALLOWLISTED_WORKER_STARTED';report.exitCode=childResult.code;
  if(childResult.terminationUnknown){uncertainChild=true;report.resourceLeasesRetained=true;report.status='STATE_UNKNOWN';report.code='WORKER_TERMINATION_UNVERIFIED';report.firstFail='OWN_WORKER_TERMINATION';report.workerPid=childResult.pid;report.next='RECONCILE_WORKER_AND_RETAIN_RESOURCE_LEASES';}
  else if(childResult.timedOut){
   report.status='FAIL';report.code='JOB_EXECUTION_TIMEOUT';report.firstFail='OWN_WORKER_TIMEOUT';
   if(request.operation==='employment-r6-collection-evidence-readonly'){
    const lastStage=readFixedR6Stage(workspace);
    if(lastStage)report.workerLastEnteredStage=lastStage;
   }else if(request.operation==='core-status'){
    const lastStage=readFixedCoreStatusStage(workspace);
    if(lastStage)report.workerLastEnteredStage=lastStage;
   }
  }
  else if(fs.existsSync(output)){preflightOperation='WORKER_RESULT_PARSE';const result=JSON.parse(fs.readFileSync(output));Object.assign(report,{status:result.status,code:result.code,result,sqliteOpened:result.sqliteOpened===true});report.lastPass=result.status==='PASS'?'ALLOWLISTED_OPERATION_COMPLETED':report.lastPass;report.firstFail=result.status==='PASS'?null:'ALLOWLISTED_OPERATION';}
  else{report.status='FAIL';report.code='WORKER_RESULT_MISSING';report.firstFail='RESULT_FILE';}
  preflightOperation='POSTCHECK';let after;
  try{after=protectedState(host.dataRoot,{retiredTaskEvidence,queryTask:task=>{
   try{return queryTask(task);}catch{throw Object.assign(new Error('PROTECTED_TASK_XML_QUERY_FAILED'),{code:'PROTECTED_TASK_XML_QUERY_FAILED',safeTaskName:task});}
  }});}
  catch(error){if(isolatedRead&&unavailableProtection(error))noteUnavailableProtection(report,error,'POSTCHECK');else throw error;}
  report.protectedBeforeSha256=before?digest(JSON.stringify(before)):null;
  report.protectedAfterSha256=after?digest(JSON.stringify(after)):null;
  if(isolatedRead&&(!before||!after)){
   report.workerOutcome={status:report.status,code:report.code,
    firstFail:report.firstFail,resultPresent:report.result!==undefined};
   report.protectedStateUnchanged=null;
   report.protectionObservation='UNVERIFIED';
   report.affectedScope='PROTECTION_ATTESTATION_ONLY';
   if(report.status==='PASS')Object.assign(report,{status:'STATE_UNKNOWN',
    code:'READONLY_RESULT_PROTECTION_UNVERIFIED',firstFail:'PROTECTED_STATE_OBSERVATION'});
   report.next='USE_VERIFIED_READ_RESULT_NOT_AS_WRITE_OR_SYSTEM_HEALTH_APPROVAL';
  }else{
   report.protectedStateUnchanged=JSON.stringify(before)===JSON.stringify(after);
   need(report.protectedStateUnchanged,'PROTECTED_STATE_DRIFT_OBSERVED');
  }
  report.actualExecutionSha=request.operation==='employment-r6-candidate-stage-readonly'
    ?(report.result?.actualExecutionSha??null)
    :(report.result?.actualExecutionSha??host.controllerSourceSha);
  report.pcOperationalApprovedSha=report.result?.core?.approvedSourceSha??report.pcOperationalApprovedSha;
  report.next??=report.status==='PASS'?'READ_RESULT_NO_REPEAT':report.status==='BLOCKED'?'RESOLVE_NAMED_GATE_BEFORE_NEW_REQUEST':'INSPECT_FIRST_FAIL_NO_AUTOMATIC_RETRY';
  preflightOperation='RESULT_LEDGER_WRITE';report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-start;writeJson(ledger,{payloadSha,report});
 }catch(error){
  const postcheckCode=errorCode(error);
  // A failed retired-R13 POSTCHECK cannot verify the worker outcome.
  // If termination is uncertain, retain its stronger recovery-needed identity
  // and lease marker instead of reclassifying it as a generic BLOCKED gate.
  if(preflightOperation==='POSTCHECK'&&
     postcheckCode==='RETIRED_IRAN_INVENTORY_UNAVAILABLE'){
   const prePostcheckOutcome={status:report.status,code:report.code,
    firstFail:report.firstFail,resultPresent:report.result!==undefined};
   Object.assign(report,{
    postcheckFailureCode:postcheckCode,
    ...(['SCHTASKS_INVENTORY_COMMAND_FAILED','SCHTASKS_INVENTORY_EMPTY_PARSE']
      .includes(error?.probeReason)?{protectedProbeReason:error.probeReason}:{}),
    workerOutcome:prePostcheckOutcome,
    protectedStateUnchanged:null,
    protectedBeforeSha256:digest(JSON.stringify(before)),
    protectedAfterSha256:null,
   });
   if(!uncertainChild)Object.assign(report,{
    status:'STATE_UNKNOWN',code:'PROTECTED_STATE_POSTCHECK_UNVERIFIED',
    firstFail:'PROTECTED_STATE_POSTCHECK',
    next:'RESOLVE_NAMED_GATE_NO_AUTOMATIC_RETRY',
   });
  }else{
report.status='BLOCKED';const baseCode=errorCode(error);report.code=baseCode==='INTERNAL_EXECUTION_ERROR'&&error instanceof SyntaxError
    ?preflightOperation==='REQUEST_LEDGER'?'REQUEST_LEDGER_PARSE_FAILED':preflightOperation==='CORE_STATE_READ'?'CORE_CONFIG_PARSE_FAILED':baseCode:baseCode;
   // A protected POSTCHECK drift is the failing stage, not the successful worker.
   report.firstFail=preflightOperation==='POSTCHECK'&&report.code==='PROTECTED_STATE_DRIFT_OBSERVED'
    ?'PROTECTED_STATE_POSTCHECK':report.lastPass;
   report.next=report.code==='LEASE_BUSY'?'WAIT_FOR_EXISTING_OWNER_DO_NOT_DELETE_LOCK':'RESOLVE_NAMED_GATE_NO_AUTOMATIC_RETRY';
   if(!report.phase&&report.lastPass==='REQUEST_RECEIVED'){
    const leaseFailure=['REQUEST_LEASE','SEAT_LEASE','RESOURCE_LEASE'].includes(preflightOperation);
    Object.assign(report,{phase:'PREVALIDATION',failureOperation:preflightOperation,mutationStarted:false,
     affectedScope:leaseFailure?'SHARED_LEASE_POSSIBLE':'OWN_REQUEST_ONLY',
     nextAction:leaseFailure?'INSPECT_LEASE_OWNER_NO_LOCK_DELETION':'INSPECT_NAMED_PREFLIGHT_OPERATION_NO_AUTOMATIC_RETRY'});
   }
  if(report.code==='MEMORY_WAIT_ALREADY_ACTIVE')Object.assign(report,{phase:'PREVALIDATION',failureOperation:'MEMORY_WAIT_LEASE_ACQUIRE',mutationStarted:false,affectedScope:'OWN_REQUEST_ONLY',nextAction:'WAIT_FOR_EXISTING_MEMORY_WAITER_NO_LOCK_DELETION',firstFail:'MEMORY_ADMISSION'});
  }
 }
 finally{if(uncertainChild){report.resourceLeasesRetained=true;const marker=path.join(workspace,'RECOVERY_REQUIRED.json');writeJson(marker,{requestId:report.requestId,workerPid:report.workerPid,reason:'WORKER_TERMINATION_UNVERIFIED'});}else{releaseMemoryWait?.();releaseResource?.();releaseSeat?.();releaseRequest?.();}}
 return finalize();
 function finalize(){report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-start;const file=path.join(workspace,'RESULT.json');writeJson(file,report);fs.writeFileSync(path.join(workspace,'RESULT.txt'),Object.entries(report).filter(([k])=>k!=='result'&&k!=='prior').map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join('\r\n')+'\r\n');return {report,file,workspace};}
}
