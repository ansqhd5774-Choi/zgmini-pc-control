// CI-native fixed A operation adapter. Executes ONLY an exact independently
// installed read-only grant via the existing installed Controller engine.
// This code is never an Owner identity or a Writer B/Controller B installer.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readNativeScope,observeNativeReceiver} from './native-receiver-observe.mjs';
import {validateRequest} from '../controller/common.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='E:\\ZGmini\\automation\\pc-control';
const REQUIRED=['config/operations.json','controller/common.mjs','controller/engine.mjs',
 'controller/entry.mjs','controller/fear-greed-archive-readonly.mjs',
 'controller/operations.mjs','controller/supervisor.mjs','controller/upload.mjs',
 'controller/worker.mjs'];
const ALLOWED=new Set(['runner-smoke','core-status']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);
const failed=(code,more={})=>Object.freeze({state:'BLOCKED',code,canExecute:false,
 operationalWrites:0,...more});
const safeFile=(root,rel)=>{
 if(typeof rel!=='string'||!/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json|host\.json)$/.test(rel))
  throw Error('CI_NATIVE_A_INSTALLED_FILE_DENIED');
 let at=path.resolve(root);
 if(!path.isAbsolute(at))throw Error('CI_NATIVE_A_INSTALLED_ROOT_UNVERIFIED');
 const dirs=rel.split('/');
 for(const dir of dirs.slice(0,-1)){
  at=path.join(at,dir);
  const st=fs.lstatSync(at);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('CI_NATIVE_A_INSTALLED_ROOT_UNVERIFIED');
 }
 const pathname=path.join(path.resolve(root),...dirs),st=fs.lstatSync(pathname);
 if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>1024*1024)
  throw Error('CI_NATIVE_A_INSTALLED_FILE_UNVERIFIED');
 return pathname;
};
/**
 * Pure readiness decision. A verified receiver observation never directly
 * grants execution; this requires a second locally installed A-only grant,
 * installed Controller source pin and exact runtime file hashes.
 */
export function inspectNativeAExecution({
 observation,scope,host,controllerPolicyBytes,adapterBytes,readInstalledFile,env
}={}){
 if(observation?.state!=='CONTRACT_MATCH_ONLY'||
   observation.code!=='CI_NATIVE_RECEIVER_INDEPENDENT_EVIDENCE_MATCH'||
   observation.effectKey!==scope?.effectKey && scope?.effectKey!==undefined)
  return failed('CI_NATIVE_A_RECEIVER_ADMISSION_MISSING');
 const p=scope?.policy;
 if(p?.effect!=='A_READONLY'||p?.schema!=='ZGMINI_CI_NATIVE_DISPATCH_V1'||
    p.enabled!==true||p.nativeAExecutionEnabled!==true||
    !hex(p.nativeAAdapterSha256,64)||!hex(p.installedControllerSha,40)||
    !hex(p.approvedRequestSha256,64)||!hex(p.businessApprovalSha256,64))
  return failed('CI_NATIVE_A_EXECUTION_SCOPE_UNVERIFIED');
 if(!Buffer.isBuffer(scope.requestBytes)||!Buffer.isBuffer(scope.approvalBytes)||
    !Buffer.isBuffer(controllerPolicyBytes)||!Buffer.isBuffer(adapterBytes)||
    sha(scope.requestBytes)!==p.approvedRequestSha256||
    sha(scope.approvalBytes)!==p.businessApprovalSha256||
    sha(adapterBytes)!==p.nativeAAdapterSha256||
    !controllerPolicyBytes.equals(scope.approvalBytes))
  return failed('CI_NATIVE_A_EXECUTION_BYTES_UNVERIFIED');
 const seat=env?.RUNNER_NAME?.match(/^zgmini-pc-0([1-6])$/)?.[1];
 const runId=env?.GITHUB_RUN_ID,attempt=env?.GITHUB_RUN_ATTEMPT;
 if(!seat||!/^[1-9][0-9]{0,19}$/.test(runId??'')||attempt!=='1'||
    env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='workflow_dispatch')
  return failed('CI_NATIVE_A_RUNNER_IDENTITY_DENIED');
 let policy,request;
 try{policy=JSON.parse(controllerPolicyBytes.toString('utf8'));
  request=validateRequest(JSON.parse(scope.requestBytes.toString('utf8')),policy);
 }catch{return failed('CI_NATIVE_A_FIXED_CONTRACT_DENIED');}
 if(policy.controlRepository!==REPO||policy.mutationsEnabled!==false||
    policy.sourceRepository!=='ansqhd5774-Choi/zgmini'||
    !ALLOWED.has(request.operation)||request.operation!==p.nativeAOperation||
    policy.operations?.[request.operation]?.grade!=='A'||
    policy.operations?.[request.operation]?.resource!=='light'||
    !Number.isSafeInteger(policy.seats)||Number(seat)>policy.seats)
  return failed('CI_NATIVE_A_EFFECT_SCOPE_DENIED');
 if(host?.controllerSourceSha!==p.installedControllerSha||
    !hex(host.controllerSourceSha,40)||
    !host.controllerFiles||typeof host.controllerFiles!=='object'||
    !REQUIRED.every(f=>hex(host.controllerFiles[f],64))||
    typeof readInstalledFile!=='function')
  return failed('CI_NATIVE_A_CONTROLLER_ATTESTATION_MISSING');
 const entries=Object.entries(host.controllerFiles);
 if(entries.length<REQUIRED.length||
    entries.some(([f,hash])=>!/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(f)||!hex(hash,64)))
  return failed('CI_NATIVE_A_CONTROLLER_FILE_MAP_INVALID');
 try{
  for(const [name,expected] of entries){
   const bytes=readInstalledFile(name);
   if(!Buffer.isBuffer(bytes)||!bytes.length||sha(bytes)!==expected)
    return failed('CI_NATIVE_A_CONTROLLER_SOURCE_DRIFT');
  }
 }catch{return failed('CI_NATIVE_A_CONTROLLER_SOURCE_UNAVAILABLE');}
 if(host.controllerFiles['config/operations.json']!==sha(controllerPolicyBytes))
  return failed('CI_NATIVE_A_INSTALLED_POLICY_DRIFT');
 return Object.freeze({state:'READY_FOR_EXISTING_A_ENGINE_ONLY',
  code:'CI_NATIVE_A_INSTALLED_OPERATION_VERIFIED',canExecute:true,
  operationalWrites:0,operation:request.operation,request,policy,
  seat:Number(seat),runId,attempt:1});
}
export async function runNativeAReadOnly({observation,scope,host,controllerPolicyBytes,
 adapterBytes,readInstalledFile,env,executeJob}={}){
 const admission=inspectNativeAExecution({observation,scope,host,
  controllerPolicyBytes,adapterBytes,readInstalledFile,env});
 if(!admission.canExecute)return admission;
 if(typeof executeJob!=='function')return failed('CI_NATIVE_A_ENGINE_PORT_UNAVAILABLE');
 let result;
 try{
  result=await executeJob(admission.request,{root:ROOT,policy:admission.policy,
   host,seat:admission.seat,runId:admission.runId,attempt:1});
 }catch{return failed('CI_NATIVE_A_ENGINE_OUTCOME_UNKNOWN');}
 const report=result?.report;
 if(report?.schema!=='ZGMINI_PC_RESULT_V1'||report.requestId!==admission.request.requestId||
    report.operation!==admission.operation||
    !['PASS','FAIL','BLOCKED','STATE_UNKNOWN'].includes(report.status))
  return failed('CI_NATIVE_A_RESULT_UNVERIFIED');
 return Object.freeze({state:report.status,code:report.code,
  canExecute:false,operationalWrites:report.operationalWrites??0,
  sanitized:Object.freeze({
   schema:'ZGMINI_CI_NATIVE_A_RECEIPT_V1',
   requestId:report.requestId,
   operation:report.operation,jobId:report.jobId,
   status:report.status,code:report.code,
   runId:admission.runId,seat:admission.seat,
   reused:report.reused===true,
   actualExecutionSha:report.actualExecutionSha??null,
   protectedStateUnchanged:report.protectedStateUnchanged??null,
   providerCalls:report.providerCalls??null,
   d1Writes:report.d1Writes??null,
   operationalWrites:report.operationalWrites??null
  })
 });
}
async function main(){
 const env=process.env;
 let event;
 try{
  const st=fs.lstatSync(env.GITHUB_EVENT_PATH);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>65536)throw Error('EVENT');
  event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 }catch{console.log(JSON.stringify(failed('CI_NATIVE_A_EVENT_UNAVAILABLE')));return 1}
 if(!env.GITHUB_TOKEN||env.GITHUB_TOKEN.length>1024){
  console.log(JSON.stringify(failed('CI_NATIVE_A_TOKEN_UNAVAILABLE')));return 1;
 }
 const getJson=async route=>{
  if(typeof route!=='string'||!/^(?:actions\/runs\/[0-9]+\/attempts\/[0-9]+|contents\/\.github\/workflows\/[a-z0-9-]+\.yml\?ref=[a-f0-9]{40})$/.test(route))
   throw Error('CI_NATIVE_A_GITHUB_READ_ROUTE_DENIED');
  const response=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
   method:'GET',signal:AbortSignal.timeout(12000),
   headers:{Accept:'application/vnd.github+json',
    Authorization:'Bearer '+env.GITHUB_TOKEN,
    'X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw Error('CI_NATIVE_A_GITHUB_READ_UNVERIFIED');
  const body=await response.text();
  if(body.length>150000)throw Error('CI_NATIVE_A_GITHUB_RESPONSE_TOO_LARGE');
  return JSON.parse(body);
 };
 const observation=await observeNativeReceiver({effect:'A_READONLY',
  event,env,ports:{readNativeScope,getJson}});
 let scope,policyBytes,host,adapterBytes;
 try{
  scope=readNativeScope('A_READONLY');
  policyBytes=fs.readFileSync(safeFile(ROOT,'config/operations.json'));
  host=JSON.parse(fs.readFileSync(safeFile(ROOT,'host.json'),'utf8'));
  adapterBytes=fs.readFileSync(fileURLToPath(import.meta.url));
 }catch{
  console.log(JSON.stringify(failed('CI_NATIVE_A_LOCAL_SOURCE_UNAVAILABLE')));return 1;
 }
 const readInstalledFile=rel=>fs.readFileSync(safeFile(ROOT,rel));
 // The engine import is after all independent source/installed-policy guards.
 let engine;
 const pre=inspectNativeAExecution({observation,scope,host,controllerPolicyBytes:policyBytes,
  adapterBytes,readInstalledFile,env});
 if(!pre.canExecute){console.log(JSON.stringify(pre));return 1;}
 try{engine=await import(pathToFileURL(safeFile(ROOT,'controller/engine.mjs')).href)}
 catch{console.log(JSON.stringify(failed('CI_NATIVE_A_INSTALLED_ENGINE_UNAVAILABLE')));return 1;}
 const result=await runNativeAReadOnly({observation,scope,host,
  controllerPolicyBytes:policyBytes,adapterBytes,readInstalledFile,env,
  executeJob:engine.executeJob});
 if(result.sanitized){
  // Only bounded allowlisted fields cross into the upload artifact; raw Worker
  // output and private host data remain inside the existing PC ledger.
  try{
   const dir=env.RUNNER_TEMP;
   if(!path.isAbsolute(dir)||fs.lstatSync(dir).isSymbolicLink())throw Error('TEMP');
   const basename='zgmini-ci-native-a-'+env.GITHUB_RUN_ID+'-'+pre.seat;
   const js=JSON.stringify(result.sanitized,null,2)+'\n';
   const txt=Object.entries(result.sanitized).map(([k,v])=>k+'='+String(v)).join('\n')+'\n';
   if(Buffer.byteLength(js)>8192||Buffer.byteLength(txt)>8192)throw Error('SIZE');
   fs.writeFileSync(path.join(dir,basename+'.json'),js,{flag:'wx'});
   fs.writeFileSync(path.join(dir,basename+'.txt'),txt,{flag:'wx'});
  }catch{console.log(JSON.stringify(failed('CI_NATIVE_A_RESULT_EXPORT_UNVERIFIED')));return 1;}
 }
 console.log(JSON.stringify({state:result.state,code:result.code,
  reused:result.sanitized?.reused??false}));
 return result.state==='PASS'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.exitCode=await main();
}
