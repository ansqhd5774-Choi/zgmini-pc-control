import fs from 'node:fs';import path from 'node:path';import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {digest,need,validateRequest,writeJson,exclusive,errorCode} from './common.mjs';import {protectedState,readCore,nativeTaskXml} from './operations.mjs';
const worker=fileURLToPath(new URL('./worker.mjs',import.meta.url));
export async function executeJob(raw,{root,policy,host,seat,runId,attempt=1,queryTask=nativeTaskXml,fixture=false}={}){
 need(Number.isInteger(seat)&&seat>=1&&seat<=policy.seats,'SEAT_NOT_ALLOWED');need(/^\d{1,20}$/.test(String(runId)),'RUN_ID');
 const workspaceId=`run-${runId}-${attempt}-seat-${seat}`,workspace=path.join(root,'jobs',workspaceId);fs.mkdirSync(workspace,{recursive:true});
 const start=Date.now(),report={schema:'ZGMINI_PC_RESULT_V1',jobId:workspaceId,requestId:typeof raw?.requestId==='string'&&/^[a-z0-9-]{8,80}$/.test(raw.requestId)?raw.requestId:null,startedAt:new Date(start).toISOString(),controlRepository:policy.controlRepository,controlSourceSha:host.controllerSourceSha,sourceRepository:policy.sourceRepository,requestedSourceSha:/^[a-f0-9]{40}$/.test(raw?.sourceSha??'')?raw.sourceSha:null,sourceBranch:typeof raw?.sourceBranch==='string'&&/^[a-zA-Z0-9_./-]{1,160}$/.test(raw.sourceBranch)?raw.sourceBranch:null,operation:Object.hasOwn(policy.operations,raw?.operation)?raw.operation:'NOT_ALLOWED',seat,status:'BLOCKED',code:'PREFLIGHT_NOT_COMPLETED',lastPass:'REQUEST_RECEIVED',firstFail:null,operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false,controlWorkspaceWrites:true};
 let releaseSeat,releaseRequest,releaseResource,ledger,before;
 try{
  const request=validateRequest(raw,policy);report.chatId=request.chatId;const payloadSha=digest(JSON.stringify(request));
  const ledgerRoot=path.join(root,'ledger');fs.mkdirSync(ledgerRoot,{recursive:true});ledger=path.join(ledgerRoot,request.requestId+'.json');
  if(fs.existsSync(ledger)){const prior=JSON.parse(fs.readFileSync(ledger));need(prior.payloadSha===payloadSha,'DUPLICATE_REQUEST_PAYLOAD_CHANGED');report.status='PASS';report.code='DUPLICATE_REUSED_NO_EXECUTION';report.prior=prior.report;report.lastPass='PRIOR_RESULT_VERIFIED';return finalize();}
  releaseRequest=exclusive(path.join(root,'leases'),'request-'+request.requestId);releaseSeat=exclusive(path.join(root,'leases'),'seat-'+seat);
  if(policy.operations[request.operation].resource==='heavy')releaseResource=exclusive(path.join(root,'leases'),'heavy');
  before=protectedState(host.dataRoot,{queryTask});report.pcOperationalApprovedSha=readCore(host.dataRoot).approvedSourceSha??null;report.lastPass='PROTECTED_STATE_SNAPSHOT';
  const input=path.join(workspace,'input.json'),output=path.join(workspace,'worker-result.json');
  writeJson(input,{request,context:{workspace,workspaceId,dataRoot:host.dataRoot,policy,host,seat}});
  const ms=policy.operations[request.operation].timeoutSeconds*1000;
  const childResult=await new Promise(resolve=>{
   const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,PATH:path.dirname(process.execPath),TEMP:workspace,TMP:workspace};
   const child=spawn(process.execPath,[worker,input,output],{env,cwd:workspace,windowsHide:true,stdio:'ignore'});let timedOut=false,settled=false;
   const timer=setTimeout(()=>{timedOut=true;if(child.pid){if(process.platform==='win32')try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});}catch{}else child.kill('SIGKILL');}},ms);
   child.on('error',()=>{if(settled)return;settled=true;clearTimeout(timer);resolve({code:-1,timedOut});});child.on('exit',code=>{if(settled)return;settled=true;clearTimeout(timer);resolve({code,timedOut});});
  });
  report.lastPass='ALLOWLISTED_WORKER_STARTED';report.exitCode=childResult.code;
  if(childResult.timedOut){report.status='FAIL';report.code='JOB_EXECUTION_TIMEOUT';report.firstFail='OWN_WORKER_TIMEOUT';}
  else if(fs.existsSync(output)){const result=JSON.parse(fs.readFileSync(output));Object.assign(report,{status:result.status,code:result.code,result,sqliteOpened:result.sqliteOpened===true});report.lastPass=result.status==='PASS'?'ALLOWLISTED_OPERATION_COMPLETED':report.lastPass;report.firstFail=result.status==='PASS'?null:'ALLOWLISTED_OPERATION';}
  else{report.status='FAIL';report.code='WORKER_RESULT_MISSING';report.firstFail='RESULT_FILE';}
  const after=protectedState(host.dataRoot,{queryTask});report.protectedStateUnchanged=JSON.stringify(before)===JSON.stringify(after);report.protectedBeforeSha256=digest(JSON.stringify(before));report.protectedAfterSha256=digest(JSON.stringify(after));
  need(report.protectedStateUnchanged,'PROTECTED_STATE_DRIFT_OBSERVED');
  report.actualExecutionSha=request.operation==='employment-r6-candidate-stage-readonly'
    ?(report.result?.actualExecutionSha??null)
    :(report.result?.actualExecutionSha??host.controllerSourceSha);
  report.pcOperationalApprovedSha=report.result?.core?.approvedSourceSha??report.pcOperationalApprovedSha;
  report.next=report.status==='PASS'?'READ_RESULT_NO_REPEAT':report.status==='BLOCKED'?'RESOLVE_NAMED_GATE_BEFORE_NEW_REQUEST':'INSPECT_FIRST_FAIL_NO_AUTOMATIC_RETRY';
  report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-start;writeJson(ledger,{payloadSha,report});
 }catch(error){report.status='BLOCKED';report.code=errorCode(error);report.firstFail=report.lastPass;report.next=report.code==='LEASE_BUSY'?'WAIT_FOR_EXISTING_OWNER_DO_NOT_DELETE_LOCK':'RESOLVE_NAMED_GATE_NO_AUTOMATIC_RETRY';}
 finally{releaseResource?.();releaseSeat?.();releaseRequest?.();}
 return finalize();
 function finalize(){report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-start;const file=path.join(workspace,'RESULT.json');writeJson(file,report);fs.writeFileSync(path.join(workspace,'RESULT.txt'),Object.entries(report).filter(([k])=>k!=='result'&&k!=='prior').map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join('\r\n')+'\r\n');return {report,file,workspace};}
}
