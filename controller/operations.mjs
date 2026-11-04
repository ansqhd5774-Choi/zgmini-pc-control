import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync,spawn} from 'node:child_process';import {need,digest,writeJson} from './common.mjs';
import {inspectFearGreedArchive} from './fear-greed-archive-readonly.mjs';
import {inspectAlpacaQuotaReadonly} from './alpaca-quota-readonly.mjs';
import {inspectPcSource} from './pc-source-readonly.mjs';
import {inspectPcSourceOrigin} from './pc-source-origin-readonly.mjs';
import {inspectR17Windows} from './us-breadth-r17-preflight.mjs';
import {inspectER1SavedInput} from './market-calendar-er1-saved-readonly.mjs';
import {inspectER1NovemberAvailability} from './market-calendar-er1-nov30-availability-readonly.mjs';
import {inspectAssetR10Publication} from './asset-r10-publication-readonly.mjs';
import {inspectEmploymentR6Candidate} from './employment-r6-candidate-readonly.mjs';
import {inspectEmploymentR6HostCas} from './employment-r6-host-cas-readonly.mjs';
const tasks=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13'];
export function protectedState(dataRoot,{queryTask}={}){
 const output={files:{},tasks:{}};
 for(const name of ['config.json','quota-runner.cmd','run-local.cmd']){const f=path.join(dataRoot,'pc-writer',name);if(fs.existsSync(f))output.files[name]=digest(fs.readFileSync(f));}
 if(queryTask)for(const task of tasks)output.tasks[task]=digest(queryTask(task));
 return output;
}
export function readCore(dataRoot,{queryTask}={}){
 const root=path.join(dataRoot,'pc-writer'),out={lockPresent:fs.existsSync(path.join(root,'local-cycle.lock')),checkpoints:{},taskXmlHashes:{}};
 for(const file of ['local-cycle-last-run.json','local-collection-last-run.json','local-writer-last-run.json']){
  const p=path.join(root,file);if(!fs.existsSync(p)){out.checkpoints[file]={exists:false};continue;}
  const s=fs.statSync(p);let data;try{data=JSON.parse(fs.readFileSync(p));}catch{data={};}
  out.checkpoints[file]={exists:true,modifiedAt:s.mtime.toISOString(),bytes:s.size,status:typeof data.status==='string'&&/^[A-Z0-9_:-]{1,80}$/.test(data.status)?data.status:null};
 }
 const config=path.join(root,'config.json');if(fs.existsSync(config)){const c=JSON.parse(fs.readFileSync(config));const x=c.source;out.approvedSourceSha=[x?.sha,x?.commit,x?.commitSha,x,c.sourceSha].find(v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v))??null;}
 if(queryTask)for(const task of tasks)out.taskXmlHashes[task]=digest(queryTask(task));
 return out;
}
export function nativeTaskXml(task){return execFileSync(path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe'),['/Query','/TN',task,'/XML'],{windowsHide:true,timeout:12000,maxBuffer:262144});}
export async function runOperation(request,context){
 const {workspace,dataRoot,policy,host,queryTask=nativeTaskXml}=context;
 if(request.operation==='runner-smoke')return {status:'PASS',code:'RUNNER_COMMAND_EXECUTED',seat:context.seat,resource:{totalMiB:Math.floor(os.totalmem()/1048576),freeMiB:Math.floor(os.freemem()/1048576)},execution: 'CMD_TO_PINNED_NODE',providerCalls:0,d1Writes:0};
 if(request.operation==='core-status')return {status:'PASS',code:'CORE_READONLY_DIAGNOSIS',core:readCore(dataRoot,{queryTask}),providerCalls:0,d1Writes:0,sqliteOpened:false};
 if(request.operation==='fear-greed-archive-status')return inspectFearGreedArchive(dataRoot,{queryTask});
 if(request.operation==='alpaca-quota-readonly')return inspectAlpacaQuotaReadonly(dataRoot);
 if(request.operation==='pc-source-preflight')return inspectPcSource({dataRoot,coreTaskXml:queryTask('ZGMINI-PC-Local-Core')});
 if(request.operation==='us-breadth-r17-preflight')return inspectR17Windows();
 if(request.operation==='pc-source-origin-readonly')return inspectPcSourceOrigin({dataRoot});
 if(request.operation==='market-calendar-er1-saved-status')return inspectER1SavedInput(dataRoot);
 if(request.operation==='market-calendar-er1-nov30-availability')return inspectER1NovemberAvailability(dataRoot);
 if(request.operation==='asset-r10-publication-status')return inspectAssetR10Publication(dataRoot);
 if(request.operation==='employment-r6-host-cas-readonly')return inspectEmploymentR6HostCas({host});
 if(request.operation==='employment-r6-candidate-stage-readonly'){
  const minimum=policy.operations[request.operation].minimumFreeMiB??policy.minimumFreeMiBForHeavy;
  if(os.freemem()/1048576<minimum)return {status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',
    candidateExecuted:false,sqliteOpened:false,providerCalls:0,d1Writes:0};
  return inspectEmploymentR6Candidate(request,{host,workspace});
 }
 if(request.operation==='core-conflict-proof'){
  const isolated=path.join(workspace,'core-fixture');fs.mkdirSync(path.join(isolated,'pc-writer'),{recursive:true});
  const f=path.join(isolated,'pc-writer','local-cycle.lock');fs.writeFileSync(f,'fixture-owner');
  const before=digest(fs.readFileSync(f));const blocked=readCore(isolated).lockPresent;need(blocked,'CORE_FIXTURE_NOT_DETECTED');need(before===digest(fs.readFileSync(f)),'CORE_FIXTURE_CHANGED');
  return {status:'PASS',code:'CORE_WRITE_GATE_BLOCKED_WITHOUT_LOCK_CHANGE',scope:'ISOLATED_FIXTURE',realCoreLockObserved:fs.existsSync(path.join(dataRoot,'pc-writer/local-cycle.lock')),mutationsEnabled:false};
 }
 if(request.operation==='isolation-proof'){
  const p=path.join(workspace,'isolation.json');writeJson(p,{requestId:request.requestId,seat:context.seat});
  await new Promise(r=>setTimeout(r,15000));need(JSON.parse(fs.readFileSync(p)).requestId===request.requestId,'ISOLATION_FILE_COLLISION');
  return {status:'PASS',code:'ISOLATED_WORKSPACE_VERIFIED',workspaceId:context.workspaceId,seat:context.seat,requestId:request.requestId};
 }
 if(request.operation==='failure-proof')throw Object.assign(new Error('CONTROLLED_FIXTURE_FAILURE'),{code:'CONTROLLED_FIXTURE_FAILURE'});
 if(request.operation==='timeout-proof'){await new Promise(r=>setTimeout(r,60000));return {status:'FAIL',code:'TIMEOUT_GUARD_NOT_APPLIED'};}
 if(request.operation==='source-audit'){
  const res=await fetch('https://api.github.com/repos/'+request.sourceRepository+'/commits/'+request.sourceSha,{headers:{accept:'application/vnd.github+json','user-agent':'zgmini-pc-control'},signal:AbortSignal.timeout(20000)});
  need(res.ok,'SOURCE_COMMIT_LOOKUP_FAILED');const data=await res.json();need(data.sha===request.sourceSha,'SOURCE_SHA_MISMATCH');
  const ref=await fetch('https://api.github.com/repos/'+request.sourceRepository+'/commits/'+encodeURIComponent(request.sourceBranch),{headers:{accept:'application/vnd.github+json','user-agent':'zgmini-pc-control'},signal:AbortSignal.timeout(20000)});need(ref.ok,'SOURCE_BRANCH_LOOKUP_FAILED');need((await ref.json()).sha===request.sourceSha,'SOURCE_BRANCH_HEAD_CHANGED');
  return {status:'PASS',code:'SOURCE_COMMIT_READONLY_VERIFIED',sourceSha:data.sha,changedFileCount:data.files?.length??null,executedCandidateCode:false};
 }
 if(request.operation==='theme-common-tests'){
  const approved=host.approvedSources?.[request.sourceSha];need(approved,'SOURCE_NOT_APPROVED_FOR_EXECUTION');need(approved.branch===request.sourceBranch,'APPROVED_SOURCE_BRANCH_MISMATCH');
  if(os.freemem()/1048576<(policy.operations[request.operation].minimumFreeMiB??policy.minimumFreeMiBForHeavy))return {status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',retry:'RESUME_WITH_NEW_REQUEST_WHEN_RESOURCE_CHANGES',candidateExecuted:false};
  const manifest=JSON.parse(fs.readFileSync(path.join(approved.root,'manifest.json')));need(digest(JSON.stringify(manifest.files))===approved.manifestSha256,'APPROVED_MANIFEST_DRIFT');
  const source=path.join(workspace,'source');fs.mkdirSync(source);
  for(const [relative,sha] of Object.entries(manifest.files)){const bytes=fs.readFileSync(path.join(approved.root,'source',relative));need(digest(bytes)===sha,'APPROVED_SOURCE_FILE_DRIFT');const dest=path.join(source,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
  const tmp=path.join(workspace,'tmp'),home=path.join(workspace,'home');fs.mkdirSync(tmp);fs.mkdirSync(home);
  const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,PATH:path.dirname(process.execPath),TEMP:tmp,TMP:tmp,USERPROFILE:home,HOME:home,CI:'true',ZGMINI_DATA_ROOT:path.join(tmp,'fixture-data')};
  const args=['--max-old-space-size=128','--test','--test-concurrency=1',...approved.tests];
  const run=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:source,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let text='',truncated=false;
   const add=b=>{if(text.length<131072)text+=b.toString();else truncated=true;};child.stdout.on('data',add);child.stderr.on('data',add);child.on('error',()=>resolve({code:-1,text:'',truncated}));child.on('exit',code=>resolve({code,text,truncated}));});
  const stats=run.text.split(/\r?\n/).filter(x=>/^.?\s*(tests|pass|fail|cancelled|skipped|todo) \d+$/.test(x)).slice(-8);
  return {status:run.code===0?'PASS':'FAIL',code:run.code===0?'APPROVED_TESTS_PASS':'APPROVED_TESTS_FAILED',exitCode:run.code,statistics:stats,actualExecutionSha:request.sourceSha,truncated:run.truncated,providerCalls:0,d1Writes:0};
 }
 throw Object.assign(new Error('OPERATION_NOT_ALLOWED'),{code:'OPERATION_NOT_ALLOWED'});
}
