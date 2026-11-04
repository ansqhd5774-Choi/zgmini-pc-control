// Fixed R54 readiness observation. No collectors, score calculation, task writes,
// Controller calls, database access, credentials, or public publication.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const TITLE='pc-theme-r54-readiness-readonly-once';
export const SCHEMA='ZGMINI_R54_READINESS_READONLY_ONCE_V1';
export const TASK_NAMES=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13'];
export const DATA_ROOT=String.raw`E:\ZGmini\data`;
const APPROVAL='THEME_R54_READINESS_B_APPROVAL.json';
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST=new RegExp('^pc-theme-r54-readiness-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const fn=fileURLToPath(import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=s=>{throw Object.assign(new Error(s),{code:s});};
const permitted=s=>typeof s==='string'&&/^R54_READINESS_[A-Z0-9_]{2,70}$/.test(s);
const isoDay=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;

function fileBytes(p,max){
 const st=fs.lstatSync(p);
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)fail('R54_READINESS_FILE_DENIED');
 return fs.readFileSync(p);
}
function workspace(env){
 const p=env.GITHUB_WORKSPACE;
 if(typeof p!=='string'||!path.isAbsolute(p))fail('R54_READINESS_WORKSPACE_DENIED');
 const real=fs.realpathSync.native(p),resolved=path.resolve(p);
 if((process.platform==='win32'?real.toLowerCase():real)!==
    (process.platform==='win32'?resolved.toLowerCase():resolved))fail('R54_READINESS_WORKSPACE_REDIRECT');
 return real;
}
function eventFrom(env){return JSON.parse(fileBytes(env.GITHUB_EVENT_PATH,100000).toString('utf8'));}
export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.repository?.private!==true||
  event.repository.full_name!==REPO||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==TITLE||!Number.isSafeInteger(event?.issue?.number)||
  event.issue.number<1||event.issue.number>=1000000000||
  event.issue.labels?.some(x=>['pc-job','pc-maintenance'].includes(x.name)))
  fail('R54_READINESS_AUTH_DENIED');
 if(typeof event.issue.body!=='string'||event.issue.body.length>4096)
  fail('R54_READINESS_BODY_DENIED');
 let r;try{r=JSON.parse(event.issue.body);}catch{fail('R54_READINESS_JSON_DENIED');}
 if(!r||typeof r!=='object'||Array.isArray(r)||
  Object.keys(r).sort().join('|')!==['schema','operation','requestId','chatId','controlSha'].sort().join('|')||
  r.schema!==SCHEMA||r.operation!=='r54-readiness-readonly-once'||
  !SHA40.test(env.GITHUB_SHA??'')||r.controlSha!==env.GITHUB_SHA||
  !REQUEST.test(r.requestId)||!CHAT.test(r.chatId)||
  r.requestId.slice('pc-theme-r54-readiness-'.length)!==r.chatId.slice('chat-'.length))
  fail('R54_READINESS_REQUEST_DENIED');
 return r;
}
function approvalCheck(base){
 const p=path.join(base,'control',APPROVAL);
 const a=JSON.parse(fileBytes(p,4096).toString('utf8'));
 if(a.schema!=='ZGMINI_R54_READINESS_B_APPROVAL_V1'||a.grade!=='B'||
  a.scope!=='FIXED_R54_READONLY_TASK_MEMORY_CANDIDATE_DATES_ONCE'||
  a.dataRoot!==DATA_ROOT||a.timeoutSeconds!==120||
  a.maxProviderRequests!==0||a.maxAutomaticRetries!==0||
  a.pcDataWrites!==false||a.databaseWrites!==false||a.d1Writes!==false||
  a.schedulerWrites!==false||!SHA64.test(a.scriptSha256??'')||
  sha(fs.readFileSync(fn))!==a.scriptSha256)fail('R54_READINESS_APPROVAL_DENIED');
 return a;
}
export function inspect({taskQuery=task=>execFileSync('schtasks.exe',
 ['/Query','/TN',task,'/XML'],{timeout:12000,maxBuffer:1048576,windowsHide:true}),
 list=dir=>fs.readdirSync(dir),freeMiB=Math.floor(os.freemem()/1048576),
 dataRoot=DATA_ROOT}={}){
 const tasks=TASK_NAMES.map(name=>{
  try{const xml=taskQuery(name);return {name,found:true,exitCode:0,
   xmlSha256:sha(Buffer.isBuffer(xml)?xml:Buffer.from(String(xml)))};}
  catch(e){return {name,found:false,exitCode:Number.isSafeInteger(e?.status)?e.status:null,
   errorKind:['ENOENT','EACCES','ETIMEDOUT'].includes(e?.code)?e.code:'TASK_QUERY_FAILED'};}
 });
 const roots=[['r47',path.join(dataRoot,'themes','legacy-nine-r47-private'),
  /^THEME_NINE_R47_PRIVATE_(20\d\d-\d\d-\d\d)_[a-f0-9]{16}_NINE\.json$/],
  ['r48',path.join(dataRoot,'themes','legacy-nine-r48-private-candidate'),
  /^THEME_NINE_R48_PRIVATE_CANDIDATE_(20\d\d-\d\d-\d\d)_[a-f0-9]{16}\.json$/],
  ['marketParquet',path.join(dataRoot,'theme-market-history-r131','marketparquet-r165'),
  /^etf_daily_(20\d\d-\d\d-\d\d)\.parquet$/]];
 const saved={};
 for(const [key,dir,pattern] of roots){
  try{
   const st=fs.lstatSync(dir);
   if(!st.isDirectory()||st.isSymbolicLink())fail('R54_READINESS_DIRECTORY_UNSAFE');
   const entries=list(dir);
   if(entries.length>8192)fail('R54_READINESS_DIRECTORY_TOO_LARGE');
   const dates=entries.flatMap(n=>{const m=pattern.exec(n);return m&&isoDay(m[1])?[m[1]]:[]});
   saved[key]={status:'READ',candidateCount:dates.length,latestDates:[...new Set(dates)].sort().slice(-6)};
  }catch(e){saved[key]={status:e?.code==='R54_READINESS_DIRECTORY_TOO_LARGE'?'LIMIT':'UNAVAILABLE'};}
 }
 return {freeMiB,tasks,candidates:saved};
}
const name=n=>`R54_READINESS_${n}.json`;
const resultBase=env=>({schema:SCHEMA,status:'BLOCKED',code:'R54_READINESS_NOT_STARTED',
 controlSha:env.GITHUB_SHA??null,runId:String(env.GITHUB_RUN_ID??''),
 providerCalls:0,pcDataWrites:0,databaseWrites:0,d1Writes:0,schedulerWrites:0});
export async function execute({env=process.env,platform=process.platform,inspectFn=inspect}={}){
 let r=resultBase(env),issueNumber=null;
 try{
  if(platform!=='win32')fail('R54_READINESS_WINDOWS_ONLY');
  const event=eventFrom(env),req=validateRequest(event,env);issueNumber=event.issue.number;
  r={...r,issueNumber,requestId:req.requestId,chatId:req.chatId};
  approvalCheck(workspace(env));
  r={...r,status:'PASS',code:'R54_READINESS_OBSERVED_NOT_PUBLISHED',details:inspectFn()};
 }catch(e){r={...r,status:'BLOCKED',code:permitted(e?.code)?e.code:'R54_READINESS_UNEXPECTED_STOP'};}
 if(issueNumber!==null){
  try{fs.writeFileSync(path.join(workspace(env),name(issueNumber)),JSON.stringify(r,null,2)+'\n',{flag:'wx'});}
  catch{r={...r,status:'BLOCKED',code:'R54_READINESS_RESULT_SAVE_DENIED'};}
 }
 process.stdout.write(`STATUS=${r.status} CODE=${r.code} OPERATING_DATA_WRITES=0\n`);
 return r;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=eventFrom(env),req=validateRequest(event,env),base=workspace(env);
 approvalCheck(base);
 const r=JSON.parse(fileBytes(path.join(base,name(event.issue.number)),8192).toString('utf8'));
 if(r.schema!==SCHEMA||r.issueNumber!==event.issue.number||
  r.requestId!==req.requestId||r.chatId!==req.chatId||
  r.controlSha!==env.GITHUB_SHA||r.runId!==String(env.GITHUB_RUN_ID??'')||
  !['PASS','BLOCKED'].includes(r.status)||!permitted(r.code)||!env.GITHUB_TOKEN)
  fail('R54_READINESS_RESULT_DENIED');
 const body=`R54 정규 복구 사전조건 1회 읽기 전용 점검: **${r.status}** (${r.code})\n\n`+
  '```json\n'+JSON.stringify(r,null,2)+'\n```';
 if(body.length>12000)fail('R54_READINESS_REPORT_TOO_LARGE');
 const res=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${env.GITHUB_TOKEN}`,
   'content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!res.ok)fail('R54_READINESS_UPLOAD_FAILED');
 return {status:'UPLOADED',issueNumber:event.issue.number};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fn){
 if(process.argv.length===2){const r=await execute();if(r.status!=='PASS')process.exitCode=1;}
 else if(process.argv.length===3&&process.argv[2]==='--upload')await upload();
 else fail('R54_READINESS_ARGUMENTS_DENIED');
}
