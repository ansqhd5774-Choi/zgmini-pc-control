// One-shot, issue-bound, B-approved PC R54 evidence READ ONLY.
// Never run the R54 publisher or query providers/SQLite/D1.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const TITLE='pc-theme-r54-evidence-readonly-once';
export const SCHEMA='ZGMINI_THEME_R54_EVIDENCE_ONCE_V1';
export const APPROVAL='THEME_R54_EVIDENCE_B_APPROVAL.json';
export const ADAPTER_REF='77c6cc43a2450f34a7cfe81f39040807e727f1cf';
export const ADAPTER_HASH='13027dcc945d06e63f3445b11bed30ec7e65dd3bf16c2728b63034e50f31e46c';
export const DATA_ROOT=String.raw`E:\ZGmini\data`;
const MIN_FREE_MIB=1536;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST=new RegExp('^pc-theme-r54-evidence-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const SHA=/^[a-f0-9]{64}$/;
const GIT_SHA=/^[a-f0-9]{40}$/;
const SAFE_CODE=/^R54_ONCE_[A-Z0-9_]{2,72}$/;
const BASE=path.dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const validIssueNumber=x=>Number.isSafeInteger(x)&&x>0&&x<1e9;
const resultName=n=>validIssueNumber(n)?`THEME_R54_EVIDENCE_${n}.json`:fail('R54_ONCE_ISSUE_NUMBER_DENIED');
const textName=n=>validIssueNumber(n)?`THEME_R54_EVIDENCE_${n}.txt`:fail('R54_ONCE_ISSUE_NUMBER_DENIED');

function regular(file,max=32768) {
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)
  fail('R54_ONCE_SOURCE_FILE_DENIED');
 const bytes=fs.readFileSync(file);
 if(bytes.length>max)fail('R54_ONCE_SOURCE_FILE_DENIED');
 return bytes;
}
function absoluteWorkspace(env){
 const root=env.GITHUB_WORKSPACE;
 if(typeof root!=='string'||!path.isAbsolute(root))fail('R54_ONCE_WORKSPACE_DENIED');
 const real=fs.realpathSync.native(root);
 if((process.platform==='win32'?real.toLowerCase():real)!==
   (process.platform==='win32'?path.resolve(root).toLowerCase():path.resolve(root)))
  fail('R54_ONCE_WORKSPACE_REDIRECT');
 return real;
}
function confinedFile(workspace,relative,max) {
 const full=path.resolve(workspace,relative);
 const rel=path.relative(workspace,full);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))
  fail('R54_ONCE_PATH_ESCAPE');
 let part=workspace;
 for(const segment of rel.split(path.sep)){
  part=path.join(part,segment);
  if(fs.lstatSync(part).isSymbolicLink())fail('R54_ONCE_REDIRECTED_SOURCE');
 }
 return regular(full,max);
}
function getEvent(env){
 return JSON.parse(regular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
}
export function validateRequest(event,env) {
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
   env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
   event?.action!=='opened'||event?.repository?.private!==true||
   event?.repository?.full_name!==REPO||
   event?.issue?.user?.login!==OWNER||event?.issue?.title!==TITLE||
   !validIssueNumber(event?.issue?.number)||
   event?.issue?.labels?.some(x=>['pc-job','pc-maintenance'].includes(x?.name)))
  fail('R54_ONCE_ISSUE_AUTH_DENIED');
 if(typeof event.issue.body!=='string'||event.issue.body.length>4096)
  fail('R54_ONCE_REQUEST_SIZE_DENIED');
 let r;try{r=JSON.parse(event.issue.body);}catch{fail('R54_ONCE_REQUEST_JSON_DENIED');}
 if(!r||typeof r!=='object'||Array.isArray(r)||
   Object.keys(r).sort().join('|')!==['schema','operation','requestId','chatId','sourceSha','controlSha'].sort().join('|')||
   r.schema!==SCHEMA||r.operation!=='theme-nine-r54-evidence-readonly-once'||
   r.sourceSha!==ADAPTER_REF||r.controlSha!==env.GITHUB_SHA||
   !GIT_SHA.test(env.GITHUB_SHA??'')||
   !REQUEST.test(r.requestId)||!CHAT.test(r.chatId)||
   r.requestId.slice('pc-theme-r54-evidence-'.length)!==r.chatId.slice('chat-'.length))
  fail('R54_ONCE_REQUEST_DENIED');
 return r;
}
export function verifyApproval(workspace){
 const approval=JSON.parse(confinedFile(workspace,'r54-control/'+APPROVAL,4096).toString('utf8'));
 if(approval?.schema!=='ZGMINI_THEME_R54_EVIDENCE_B_APPROVAL_V1'||
   approval?.grade!=='B'||approval?.purpose!=='theme-r54-one-shot-raw-evidence'||
   approval?.scope!=='FIXED_PRIVATE_R54_MANIFEST_RAW_READONLY_ONCE'||
   approval?.sourceCommit!==ADAPTER_REF||
   approval?.adapterSha256!==ADAPTER_HASH||
   approval?.dataRoot!==DATA_ROOT||
   approval?.minimumFreeMiB!==MIN_FREE_MIB||
   approval?.timeoutSeconds!==240||
   approval?.maxProviderRequests!==0||approval?.maxAutomaticRetries!==0||
   approval?.coreWrites!==false||approval?.dbWrites!==false||
   approval?.d1Writes!==false||approval?.schedulerWrites!==false||
   !SHA.test(approval?.scriptSha256??''))
  fail('R54_ONCE_APPROVAL_DENIED');
 if(sha(fs.readFileSync(fileURLToPath(import.meta.url)))!==approval.scriptSha256)
  fail('R54_ONCE_APPROVAL_SCRIPT_SHA_DENIED');
 const adapter=confinedFile(workspace,
  'r54-adapter/controller/theme-nine-r54-evidence-readonly.mjs',32*1024);
 if(sha(adapter)!==ADAPTER_HASH)fail('R54_ONCE_ADAPTER_SHA_DENIED');
 return approval;
}
const status=v=>typeof v==='string'&&/^[A-Z0-9_]{2,70}$/.test(v)?v:'UNKNOWN';
const hash=v=>SHA.test(v??'')?v:null;
const name=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,110}$/.test(v)?v:null;
const date=v=>typeof v==='string'&&/^20\d\d-\d\d-\d\d$/.test(v)?v:null;
const num=v=>Number.isSafeInteger(v)&&v>=0&&v<=4096?v:null;
function proofOf(item) {
 return {status:status(item?.status),expectedSha256:hash(item?.expectedSha256),
  currentSha256:hash(item?.currentSha256),prefixFileCount:num(item?.prefixFileCount),
  rawStatus:status(item?.rawStatus),rawVerifiedPages:num(item?.rawVerifiedPages)};
}
// Only fixed metadata; never return raw prices, manifest entries, tokens or log lines.
export function summarizeInspection(v){
 const candidates=Array.isArray(v?.r48?.candidates)?v.r48.candidates:[];
 const chosen=candidates.filter(x=>['2026-10-28','2026-10-29','2026-10-30'].includes(x?.date)).slice(0,12);
 const logs=Array.isArray(v?.r54?.logs)?v.r54.logs.slice(-12):[];
 return {provenance:'PC_READ_ONLY_EVIDENCE_NOT_PUBLISH_APPROVAL',
  manifests:{baseline:{status:status(v?.manifests?.baseline?.status),
   currentSha256:hash(v?.manifests?.baseline?.sha256),fileCount:num(v?.manifests?.baseline?.fileCount)},
   delta:{status:status(v?.manifests?.delta?.status),
    currentSha256:hash(v?.manifests?.delta?.sha256),fileCount:num(v?.manifests?.delta?.fileCount)}},
  r48:{directoryStatus:status(v?.r48?.directoryStatus),candidateCount:num(candidates.length),
   candidates:chosen.map(x=>({date:date(x.date),filename:name(x.filename),
    status:status(x.status),expectedBaselineSha256:hash(x.expectedBaselineSha256),
    expectedDeltaSha256:hash(x.expectedDeltaSha256),
    baseline:proofOf(x.baseline),delta:proofOf(x.delta)}))},
  r51:{directoryStatus:status(v?.r51?.directoryStatus),
   candidateNames:(v?.r51?.observedCandidateNames??[]).slice(-8).map(name).filter(Boolean)},
  r54:{status:status(v?.r54?.status),
   logs:logs.map(x=>({name:name(x.name),status:status(x.status),
    knownError:status(x.knownError),sourceManifestShaDrift:x.sourceManifestShaDrift===true,
    sha256:hash(x.sha256)}))}};
}
const stopCode=e=>SAFE_CODE.test(e?.code??'')?e.code:'R54_ONCE_UNEXPECTED_STOP';
function reportBase(env){
 return {schema:SCHEMA,status:'BLOCKED',code:'R54_ONCE_NOT_STARTED',
  sourceSha:ADAPTER_REF,controlSha:env.GITHUB_SHA??null,
  runId:String(env.GITHUB_RUN_ID??''),providerCalls:0,sqliteOpened:false,
  coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
}
export async function execute({env=process.env,platform=process.platform,
 freeMiB=Math.floor(os.freemem()/1048576),loader=async file=>import(pathToFileURL(file).href)}={}){
 let result=reportBase(env),number=null;
 try{
  if(platform!=='win32')fail('R54_ONCE_WINDOWS_ONLY');
  const event=getEvent(env),request=validateRequest(event,env);
  number=event.issue.number;
  result={...result,issueNumber:number,requestId:request.requestId,chatId:request.chatId};
  const workspace=absoluteWorkspace(env);
  verifyApproval(workspace);
  if(freeMiB<MIN_FREE_MIB)fail('R54_ONCE_RESOURCE_WAIT_MEMORY');
  const source=path.resolve(workspace,'r54-adapter/controller/theme-nine-r54-evidence-readonly.mjs');
  const adapter=await loader(source);
  if(typeof adapter?.inspectThemeNineR54Evidence!=='function')
   fail('R54_ONCE_ADAPTER_EXPORT_DENIED');
  const inspection=adapter.inspectThemeNineR54Evidence(DATA_ROOT);
  if(inspection?.status!=='PASS'||inspection.providerCalls!==0||
    inspection.operationalWrites!==0||inspection.d1Writes!==0||
    inspection.sqliteOpened!==false)
   fail('R54_ONCE_ADAPTER_RESULT_DENIED');
  const details=summarizeInspection(inspection);
  result={...result,status:'PASS',code:'R54_ONCE_EVIDENCE_RETRIEVED_NOT_PUBLISH_APPROVED',details};
 }catch(e){result={...result,status:'BLOCKED',code:stopCode(e)};}
 if(number!==null){
  try{
   const workspace=absoluteWorkspace(env);
   fs.writeFileSync(path.join(workspace,resultName(number)),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
   fs.writeFileSync(path.join(workspace,textName(number)),
    `STATUS=${result.status} CODE=${result.code} REQUEST=${result.requestId}\n`,{flag:'wx'});
  }catch{result={...result,status:'BLOCKED',code:'R54_ONCE_RESULT_SAVE_DENIED'};}
 }
 process.stdout.write(`STATUS=${result.status} CODE=${result.code} VERIFIED_PUBLICATION=NO\n`);
 return result;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=getEvent(env),request=validateRequest(event,env),workspace=absoluteWorkspace(env);
 verifyApproval(workspace);
 const r=JSON.parse(confinedFile(workspace,resultName(event.issue.number),16000).toString('utf8'));
 if(r?.schema!==SCHEMA||r.issueNumber!==event.issue.number||
   r.requestId!==request.requestId||r.chatId!==request.chatId||
   r.sourceSha!==ADAPTER_REF||r.controlSha!==env.GITHUB_SHA||
   r.runId!==String(env.GITHUB_RUN_ID??'')||
   !['PASS','BLOCKED'].includes(r.status)||!SAFE_CODE.test(r.code??'')||
   !env.GITHUB_TOKEN)fail('R54_ONCE_RESULT_UNTRUSTED');
 const allowed={schema:SCHEMA,status:r.status,code:r.code,requestId:r.requestId,
  sourceSha:r.sourceSha,controlSha:r.controlSha,details:r.details??null,
  providerCalls:0,sqliteOpened:false,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
 const body=`R54 기존 10개 테마 원자료 읽기 전용 증거: **${r.status}** (${r.code})\n\n`+
  '```json\n'+JSON.stringify(allowed,null,2)+'\n```';
 if(body.length>28000)fail('R54_ONCE_REPORT_TOO_LARGE');
 const response=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
   'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!response.ok)fail('R54_ONCE_UPLOAD_FAILED');
 return {status:'UPLOADED',issueNumber:event.issue.number};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length===2){const result=await execute();if(result.status!=='PASS')process.exitCode=1;}
 else if(process.argv.length===3&&process.argv[2]==='--upload')await upload();
 else fail('R54_ONCE_ARGUMENTS_DENIED');
}
