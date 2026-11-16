// W03 compute-only one-shot: requires previously saved GMH-only raw SHA/
// 628 actual common sessions. Never calls providers or D1 and never publishes.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REPO,OWNER,APPROVED_SOURCE_SHA,verifyCandidate}
 from './w03-gmh-seven-manual-once.mjs';

export const TITLE='w03-gmh-seven-private-score-once';
export const SCHEMA='ZGMINI_W03_GMH_SEVEN_PRIVATE_SCORE_REQUEST_V1';
export const OUTPUT='ZGMINI_W03_GMH_SEVEN_PRIVATE_SCORE_RESULT_V1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const ROOT='E:\\ZGmini\\data';
const JOURNAL='E:\\ZGmini\\data\\pc-writer\\w03-gmh-seven-private-score-once';
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(x,code)=>{if(!x)fail(code);};
export function authorize(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===TITLE&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'W03_GMH_SCORE_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body);}catch{fail('W03_GMH_SCORE_JSON_STOP');}
 const fields=['schema','operation','requestId','chatId',
  'controlRepository','controlSourceSha','candidateSourceSha'];
 need(r&&typeof r==='object'&&!Array.isArray(r)&&
  Object.keys(r).length===fields.length&&fields.every(k=>Object.hasOwn(r,k))&&
  r.schema===SCHEMA&&r.operation===TITLE&&
  UUID.test(r.requestId??'')&&UUID.test(r.chatId??'')&&
  r.controlRepository===REPO&&r.controlSourceSha===env.GITHUB_SHA&&
  r.candidateSourceSha===APPROVED_SOURCE_SHA,
  'W03_GMH_SCORE_REQUEST_STOP');
 return Object.freeze(r);
}
function claim(req){
 need(process.platform==='win32','W03_GMH_SCORE_WINDOWS_ONLY_STOP');
 const root=fs.realpathSync.native(ROOT),pc=fs.realpathSync.native(path.join(root,'pc-writer'));
 need(pc.toLowerCase().startsWith(root.toLowerCase()+path.sep),
  'W03_GMH_SCORE_ROOT_STOP');
 fs.mkdirSync(JOURNAL,{recursive:true});
 need(fs.realpathSync.native(JOURNAL).toLowerCase().startsWith(pc.toLowerCase()+path.sep),
  'W03_GMH_SCORE_JOURNAL_STOP');
 fs.writeFileSync(path.join(JOURNAL,req.requestId+'.json'),JSON.stringify({
  schema:SCHEMA,requestId:req.requestId,source:APPROVED_SOURCE_SHA,
  operation:TITLE,at:new Date().toISOString(),providerCalls:0,d1Writes:0,
  publicWrites:0})+'\n',{flag:'wx'});
}
function launch(script){
 need(process.platform==='win32','W03_GMH_SCORE_WINDOWS_ONLY_STOP');
 const node='E:\\ZGmini\\runtime\\node.exe';
 need(fs.existsSync(node),'W03_GMH_SCORE_NODE_STOP');
 const r=spawnSync(node,[script,'--compute'],{
  cwd:path.dirname(script),shell:false,windowsHide:true,
  timeout:420000,maxBuffer:5000,encoding:'utf8',
  env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',
   PATH:process.env.PATH??'',ZGMINI_DATA_ROOT:ROOT}
 });
 let value;try{value=JSON.parse(r.stdout.trim());}catch{
  return {schema:OUTPUT,status:'STOP',code:'W03_GMH_SCORE_CHILD_OUTPUT_STOP'};}
 const good=r.status===0&&value?.status===
  'PRIVATE_GMH_ONLY_7X252_NOT_PUBLISHED'&&value.historyPoints===1764&&
  Number.isSafeInteger(value.commonSessionCount)&&value.commonSessionCount>=628&&
  value.commonSessionCount<=1500&&
  /^\d{4}-\d\d-\d\d$/.test(value.observationDate??'')&&
  SHA64.test(value.inputManifestSha256??'')&&
  SHA64.test(value.privateArtifactSha256??'')&&
  value.providerCalls===0&&value.d1Writes===0&&value.publicWrites===0;
 return good?{schema:OUTPUT,status:'PASS',code:'W03_GMH_SCORE_PRIVATE_7X252_VERIFIED',
  observationDate:value.observationDate,
  commonSessionCount:value.commonSessionCount,historyPoints:1764,
  inputManifestSha256:value.inputManifestSha256,
  privateArtifactSha256:value.privateArtifactSha256,
  providerCalls:0,d1Writes:0,publicWrites:0}:
  {schema:OUTPUT,status:'STOP',code:'W03_GMH_SCORE_PRIVATE_INPUT_NOT_VERIFIED'};
}
export function execute({event,env,sourceRoot,verify=verifyCandidate,
 journal=claim,run=launch}={}){
 const req=authorize(event,env);
 need(process.platform==='win32','W03_GMH_SCORE_WINDOWS_ONLY_STOP');
 const file=verify({sourceRoot});
 journal(req);
 const r=run(file);
 need(r?.schema===OUTPUT&&['PASS','STOP'].includes(r.status),
  'W03_GMH_SCORE_RESULT_CONTRACT_STOP');
 return {...r,requestId:req.requestId,
  sourceCommit:APPROVED_SOURCE_SHA,controlSha:env.GITHUB_SHA,
  runId:env.GITHUB_RUN_ID??null,
  providerCalls:0,d1Writes:0,publicWrites:0,taskChanges:0,
  rawBarExposure:false,retry:'NO_AUTOMATIC_REEXECUTION'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  result=execute({event,env,
   sourceRoot:path.join(env.GITHUB_WORKSPACE??'','w03-gmh-source')});
 }catch(e){
  result={schema:OUTPUT,status:'STOP',requestId:null,
   code:/^W03_GMH_SCORE_[A-Z0-9_]{3,80}$/.test(e?.code??'')?
    e.code:'W03_GMH_SCORE_UNCLASSIFIED_STOP',
   sourceCommit:APPROVED_SOURCE_SHA,providerCalls:0,d1Writes:0,publicWrites:0,
   taskChanges:0,rawBarExposure:false,retry:'NO_AUTOMATIC_REEXECUTION'};
 }
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&
    path.isAbsolute(process.env.RUNNER_TEMP),'W03_GMH_SCORE_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-gmh-seven-score.json'),
   JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='PASS')process.exitCode=1;
}
