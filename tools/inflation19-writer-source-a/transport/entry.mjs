// Validates an issue, then invokes one fixed read-only inventory script.
// Its only write is a bounded result under RUNNER_TEMP, never E: PC storage.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {RESULT_SCHEMA,validateEvent,stop,CODE} from './contract.mjs';

const MAX_BYTES=32_768;
const filename=(id,issueNumber)=>
 `ZGMINI_INFL19_WRITER_SOURCE_${issueNumber}_${id}.json`;
export const resultPath=(temp,id,issueNumber)=>{
 if(!Number.isSafeInteger(issueNumber)||issueNumber<1)
  stop('INFL19_A_RESULT_ID_DENIED');
 return path.join(temp,filename(id,issueNumber));
};
const minimalEnv=env=>Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','PATHEXT',
 'ComSpec','USERPROFILE','TEMP','TMP'].filter(k=>typeof env[k]==='string')
 .map(k=>[k,env[k]]));

export function safeResult(raw,request){
 const d=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const pass=d.schema==='ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_V1'&&
  d.status==='PASS_READONLY'&&d.code==='INFL19_A_SOURCE_IDENTITY_OBSERVED'&&
  d.providerCalls===0&&d.d1Writes===0&&d.pcSourceWrites===0&&
  d.configWrites===0&&d.taskWrites===0&&
  /^[a-f0-9]{40}$/.test(d.sourceHeadSha??'')&&
  /^[a-f0-9]{40}$/.test(d.configApprovedSha??'')&&
  /^[a-f0-9]{64}$/.test(d.taskXmlSha256??'')&&
  typeof d.sourceRoot==='string'&&
  d.sourceRoot.startsWith('e:\\zgmini\\projects\\')&&
  typeof d.targetFilesDirty==='boolean'&&
  d.files&&typeof d.files==='object'&&!Array.isArray(d.files)&&
  Object.keys(d.files).length===3;
 const code=pass?'INFL19_A_SOURCE_IDENTITY_OBSERVED':
  d.status==='BLOCKED'&&CODE.test(d.code??'')?d.code:
   'INFL19_A_UNVERIFIED_RESULT';
 const base={schema:RESULT_SCHEMA,requestId:request.requestId,chatId:request.chatId,
  status:pass?'PASS_READONLY':'BLOCKED',code,providerCalls:0,d1Writes:0,
  pcSourceWrites:0,configWrites:0,taskWrites:0};
 if(!pass)return base;
 const expected=['scripts/pc-writer/run-local.mjs',
  'scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs',
  'scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs'];
 const files={};
 for(const rel of expected){
  const f=d.files[rel];
  if(f?.status==='ABSENT')files[rel]={status:'ABSENT'};
  else if(f?.status==='PRESENT'&&/^[a-f0-9]{64}$/.test(f.sha256??''))
   files[rel]={status:'PRESENT',sha256:f.sha256};
  else return {...base,status:'BLOCKED',code:'INFL19_A_UNVERIFIED_RESULT'};
 }
 return {...base,sourceHeadSha:d.sourceHeadSha,
  configApprovedSha:d.configApprovedSha,
  configMatchesHead:d.configMatchesHead===true,
  targetFilesDirty:d.targetFilesDirty,
  taskXmlSha256:d.taskXmlSha256,actionExe:typeof d.actionExe==='string'&&
   /^[a-z0-9._-]{1,40}$/.test(d.actionExe)?d.actionExe:'UNKNOWN',
  sourceRoot:d.sourceRoot,files,
  evidenceLevel:'TASK_XML_AND_FILESYSTEM_GIT_READONLY_NOT_CORE_RUNTIME'};
}

export function executeInventory({event,env,spawn=spawnSync,
 scriptPath,resultDir,writeResult=(p,b)=>fs.writeFileSync(p,b,{flag:'wx',mode:0o600})}={}){
 const request=validateEvent(event,env);
 if(typeof resultDir!=='string'||!path.isAbsolute(resultDir)||
    !fs.statSync(resultDir).isDirectory()||
    typeof scriptPath!=='string'||!path.isAbsolute(scriptPath))
  stop('INFL19_A_TRANSPORT_PATH_DENIED');
 let raw;
 try{
  const run=spawn(process.execPath,[scriptPath],{encoding:'utf8',timeout:50_000,
   maxBuffer:MAX_BYTES,windowsHide:true,env:minimalEnv(env)});
  if(run.error||!Number.isSafeInteger(run.status)||
     typeof run.stdout!=='string'||
     Buffer.byteLength(run.stdout)>MAX_BYTES||!run.stdout.trim())
   raw={status:'BLOCKED',code:'INFL19_A_RUNNER_STOP'};
  else{
   raw=JSON.parse(run.stdout);
   if(run.status!==0)raw={status:'BLOCKED',code:
     typeof raw?.code==='string'?raw.code:'INFL19_A_RUNNER_STOP'};
  }
 }catch{raw={status:'BLOCKED',code:'INFL19_A_RUNNER_STOP'}}
 const result=safeResult(raw,request);
 const out=JSON.stringify(result,null,2)+'\n';
 if(Buffer.byteLength(out)>MAX_BYTES)stop('INFL19_A_OUTPUT_TOO_LARGE');
 writeResult(resultPath(resultDir,request.requestId,request.issueNumber),out);
 return {request,result};
}

function main(){
 try{
  if(process.platform!=='win32')stop('INFL19_A_WINDOWS_ONLY');
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const target=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','inventory.mjs');
  const {result}=executeInventory({event,env,scriptPath:target,resultDir:env.RUNNER_TEMP});
  process.stdout.write(`INFL19_A_RESULT ${result.status} ${result.code}\n`);
  if(result.status!=='PASS_READONLY')process.exitCode=1;
 }catch(e){
  const code=CODE.test(e?.code??'')?e.code:'INFL19_A_ENTRY_STOP';
  process.stdout.write(`INFL19_A_ENTRY_BLOCKED ${code}\n`);
  process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
