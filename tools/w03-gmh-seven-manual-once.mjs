// W03 one-shot, explicitly authorized *manual* GMH historical collection.
// Uses reviewed zgmini candidate source on the existing Windows runner.
// No scheduled tasks, public D1 writes, source installation or raw export.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const TITLE='w03-gmh-seven-history-manual-once';
export const SCHEMA='ZGMINI_W03_GMH_SEVEN_MANUAL_REQUEST_V1';
export const OUTPUT='ZGMINI_W03_GMH_SEVEN_MANUAL_RESULT_V1';
export const APPROVED_SOURCE_SHA='f5fe56a48d651129bd811cc34d43665fba51c146';
export const WINDOW_START='2024-03-04';
export const WINDOW_END='2026-11-13';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const EXPECTED=['schema','operation','requestId','chatId','controlRepository',
 'controlSourceSha','candidateSourceSha','start','end','maxRequests'];
const STOP=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)STOP(code);};
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));

export function authorize(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&env.GITHUB_ACTOR===OWNER&&
  SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===TITLE&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'W03_GMH_MANUAL_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body);}catch{STOP('W03_GMH_MANUAL_JSON_STOP');}
 need(exact(r,EXPECTED)&&r.schema===SCHEMA&&r.operation===TITLE&&
  UUID.test(r.requestId??'')&&UUID.test(r.chatId??'')&&
  r.controlRepository===REPO&&r.controlSourceSha===env.GITHUB_SHA&&
  r.candidateSourceSha===APPROVED_SOURCE_SHA&&
  r.start===WINDOW_START&&r.end===WINDOW_END&&r.maxRequests===4,
  'W03_GMH_MANUAL_REQUEST_STOP');
 return Object.freeze(r);
}
const fixedRead=(root,relative)=>{
 const file=path.join(root,...relative.split('/')),
  st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<90000,
  'W03_GMH_MANUAL_SOURCE_SCOPE_STOP');
 need(fs.realpathSync.native(file).toLowerCase().startsWith(
  fs.realpathSync.native(root).toLowerCase()+path.sep),
  'W03_GMH_MANUAL_SOURCE_ESCAPE_STOP');
 return file;
};
function checkedGitHead(root){
 const git=['C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe'].find(s=>fs.existsSync(s));
 need(git,'W03_GMH_MANUAL_GIT_NOT_FOUND_STOP');
 const r=spawnSync(git,['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
 need(r.status===0&&SHA40.test(r.stdout?.trim()??''),
  'W03_GMH_MANUAL_SOURCE_HEAD_READ_STOP');
 return r.stdout.trim();
}
export function verifyCandidate({sourceRoot,head=checkedGitHead}){
 need(process.platform==='win32','W03_GMH_MANUAL_WINDOWS_ONLY_STOP');
 need(typeof sourceRoot==='string'&&path.isAbsolute(sourceRoot)&&
  head(sourceRoot)===APPROVED_SOURCE_SHA,
  'W03_GMH_MANUAL_SOURCE_COMMIT_STOP');
 const script=fixedRead(sourceRoot,
  'scripts/pc-writer/theme-seven-gmh-history-r1.mjs');
 fixedRead(sourceRoot,'scripts/pc-writer/theme-optional-score-r188.mjs');
 return script;
}
const JOURNAL='E:\\ZGmini\\data\\pc-writer\\w03-gmh-seven-manual-once';
const DATA_ROOT='E:\\ZGmini\\data';
function claimRequest(req){
 need(process.platform==='win32','W03_GMH_MANUAL_WINDOWS_ONLY_STOP');
 const root=fs.realpathSync.native(DATA_ROOT),dir=path.join(root,'pc-writer');
 need(fs.realpathSync.native(dir).toLowerCase().startsWith(root.toLowerCase()+path.sep),
  'W03_GMH_MANUAL_DATA_ROOT_STOP');
 fs.mkdirSync(JOURNAL,{recursive:true});
 need(fs.realpathSync.native(JOURNAL).toLowerCase().startsWith(
  fs.realpathSync.native(dir).toLowerCase()+path.sep),
  'W03_GMH_MANUAL_JOURNAL_ESCAPE_STOP');
 const journal=path.join(JOURNAL,req.requestId+'.json');
 fs.writeFileSync(journal,JSON.stringify({
  schema:SCHEMA,requestId:req.requestId,
  candidateSourceSha:APPROVED_SOURCE_SHA,
  start:WINDOW_START,end:WINDOW_END,attemptedAt:new Date().toISOString(),
  operation:TITLE,sideEffects:'GMH_RAW_ONLY_4_GET_NO_PUBLISH'
 })+'\n',{flag:'wx'});
 return journal;
}
const approvedStatus=new Set(['PRIVATE_GMH_HISTORY_COLLECTED',
 'CHECKPOINT_READY_TO_RESUME','STOP_PREVIOUS_FAILURE_REVIEW_REQUIRED',
 'STOP_PROVIDER_NETWORK_OR_TIMEOUT','STOP_PROVIDER_HTTP_429',
 'STOP_PROVIDER_HTTP_403','STOP_PROVIDER_HTTP_404','STOP_PROVIDER_HTTP_500',
 'STOP_PROVIDER_HTTP_502','STOP_PROVIDER_HTTP_503']);
function launchSource(script,req){
 need(process.platform==='win32','W03_GMH_MANUAL_WINDOWS_ONLY_STOP');
 const node='E:\\ZGmini\\runtime\\node.exe';
 need(fs.existsSync(node),'W03_GMH_MANUAL_NODE_MISSING_STOP');
 const r=spawnSync(node,[script,'--collect',req.start,req.end],{
  cwd:path.dirname(script),shell:false,windowsHide:true,
  timeout:180000,encoding:'utf8',maxBuffer:30000,
  env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',
   PATH:process.env.PATH??'',
   ZGMINI_DATA_ROOT:DATA_ROOT}
 });
 let data;try{data=JSON.parse(r.stdout.trim());}catch{
  return {schema:OUTPUT,status:'STOP',
   code:'W03_GMH_MANUAL_CHILD_RESULT_UNKNOWN',
   providerCalls:null,rawPagesStored:null};
 }
 const valid=data?.schema==='GMH_SEVEN_1H_SAVED_RAW_V1'&&
  approvedStatus.has(data.status)&&
  Number.isSafeInteger(data.providerCalls)&&
  data.providerCalls>=0&&data.providerCalls<=4&&
  Number.isSafeInteger(data.rawPagesStored)&&
  data.rawPagesStored>=0&&data.rawPagesStored<=4&&
  data.d1Writes===0&&data.publicWrites===0&&data.schedulerWrites===0;
 if(!valid)return {schema:OUTPUT,status:'STOP',
  code:'W03_GMH_MANUAL_CHILD_RESULT_UNTRUSTED',
  providerCalls:null,rawPagesStored:null};
 const ok=r.status===0&&['PRIVATE_GMH_HISTORY_COLLECTED',
  'CHECKPOINT_READY_TO_RESUME'].includes(data.status);
 return {schema:OUTPUT,status:ok?'PASS':'STOP',
  code:ok?'W03_GMH_MANUAL_PRIVATE_RAW_CHECKPOINT':
   'W03_GMH_MANUAL_'+data.status,
  sourceStatus:data.status,
  providerCalls:data.providerCalls,rawPagesStored:data.rawPagesStored,
  completedSymbols:Number.isSafeInteger(data.completedSymbols)?
   data.completedSymbols:null,
  pendingSymbols:Number.isSafeInteger(data.pendingSymbols)?
   data.pendingSymbols:null,
  manifestFiles:Number.isSafeInteger(data.manifestFiles)?
   data.manifestFiles:null};
}
export function execute({event,env,sourceRoot,
 verify=verifyCandidate,claim=claimRequest,launch=launchSource}={}){
 const request=authorize(event,env);
 need(process.platform==='win32','W03_GMH_MANUAL_WINDOWS_ONLY_STOP');
 const file=verify({sourceRoot});
 claim(request);
 const result=launch(file,request);
 need(result?.schema===OUTPUT&&['PASS','STOP'].includes(result.status),
  'W03_GMH_MANUAL_RESULT_STOP');
 return {...result,requestId:request.requestId,
  sourceCommit:APPROVED_SOURCE_SHA,controlSha:env.GITHUB_SHA,
  runId:env.GITHUB_RUN_ID??null,
  d1Writes:0,publicWrites:0,schedulerChanges:0,
  rawPriceExposed:false,retry:'NO_AUTOMATIC_REEXECUTION'};
}
async function main(){
 const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const sourceRoot=path.join(env.GITHUB_WORKSPACE??'','w03-gmh-source');
 const out=execute({event,env,sourceRoot});
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let out;
 try{out=await main();}
 catch(e){out={schema:OUTPUT,status:'STOP',requestId:null,
  code:/^W03_GMH_MANUAL_[A-Z0-9_]{3,80}$/.test(e?.code??'')?
   e.code:'W03_GMH_MANUAL_UNCLASSIFIED_STOP',
  sourceCommit:APPROVED_SOURCE_SHA,providerCalls:null,d1Writes:0,
  publicWrites:0,schedulerChanges:0,rawPriceExposed:false,
  retry:'NO_AUTOMATIC_REEXECUTION'};}
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&
   path.isAbsolute(process.env.RUNNER_TEMP),
   'W03_GMH_MANUAL_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-gmh-manual-result.json'),
   JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='PASS')process.exitCode=1;
}
