// W03: Compare actual SHA-pinned private GMH seven-theme 7x252 against the
// existing no-mutation public base projection and visitor R32 view.
// This is NOT a D1 seed readback, a CAS, a publish authorization, or a writer.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='w03-gmh-seven-public-compat-readonly';
export const SCHEMA='ZGMINI_W03_GMH_SEVEN_PUBLIC_COMPAT_REQUEST_V1';
export const OUTPUT='ZGMINI_W03_GMH_SEVEN_PUBLIC_COMPAT_RESULT_V1';
export const MANIFEST_SHA='82f380e346e350c276c4b532353ddc3112dbfa5f90c8d1590c25e22ec064bc0a';
export const PRIVATE_SHA='9f5fa50f294224b273b0eee6e4d1ad96afc1b37a61774d8bf74d1543ffa1f62a';
export const SOURCE_ROOT='E:\\ZGmini\\data\\themes\\theme-legacy-seven';
const PRIVATE_FILE='seven-gmh-'+PRIVATE_SHA.slice(0,16)+'.json';
export const BASE_URL='https://zgmini.kr/api/theme-fear-greed?publication-base=1';
export const PUBLIC_URL='https://zgmini.kr/api/theme-fear-greed';
const NAMES=Object.freeze([
 ['로봇·자동화',['BOTZ','ROBO']],['클라우드·SaaS',['SKYY','CLOU']],
 ['자율주행',['DRIV','BOTZ']],['원전·SMR',['NLR','URA']],
 ['방산',['ITA','SHLD']],['핀테크',['FINX','ARKF']],
 ['사이버보안',['CIBR','BUG']]
]);
const SHA40=/^[a-f0-9]{40}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DATE=/^\d{4}-\d\d-\d\d$/;
const DIGEST=b=>createHash('sha256').update(b).digest('hex');
const STOP=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)STOP(code);};
const date=x=>typeof x==='string'&&DATE.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const score=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&
 a.length===b.length&&a.every((x,i)=>x===b[i]);

export function authorize(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&!event.issue.pull_request&&
  event.issue.title===TITLE&&Number.isSafeInteger(event.issue.number)&&
  event.issue.number>0&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),
  'W03_GMH_COMPAT_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body)}catch{STOP('W03_GMH_COMPAT_JSON_STOP')}
 const fields=['schema','requestId','chatId','operation','controlRepository',
  'controlSourceSha','expectedManifestSha256','expectedPrivateOutputSha256'];
 need(r&&typeof r==='object'&&!Array.isArray(r)&&
  Object.keys(r).length===fields.length&&fields.every(k=>Object.hasOwn(r,k))&&
  r.schema===SCHEMA&&r.operation===TITLE&&REPO===r.controlRepository&&
  r.controlSourceSha===env.GITHUB_SHA&&UUID.test(r.requestId??'')&&
  UUID.test(r.chatId??'')&&r.expectedManifestSha256===MANIFEST_SHA&&
  r.expectedPrivateOutputSha256===PRIVATE_SHA,
  'W03_GMH_COMPAT_REQUEST_STOP');
 return Object.freeze(r);
}
export function validateCandidate(v){
 need(v?.schema==='ZGMINI_W03_GMH_SEVEN_PRIVATE_252_V1'&&
  v.status==='PRIVATE_GMH_ONLY_7X252_NOT_PUBLISHED'&&
  v.inputProvider==='GETMARKETHISTORY_FREE_HOURLY_ONLY'&&
  v.rawManifestSha256===MANIFEST_SHA&&
  v.methodologyVersion==='ETF_ONLY_T40_R20_V40_PAIR50'&&
  v.publicationAuthorized===false&&
  v.providerCalls===0&&v.d1Writes===0&&v.publicWrites===0&&
  v.commonSessionCount===679&&
  v.observationDate==='2026-11-13'&&
  Array.isArray(v.themes)&&v.themes.length===NAMES.length,
  'W03_GMH_COMPAT_PRIVATE_CANDIDATE_STOP');
 let expectedDays=null;
 for(let i=0;i<NAMES.length;i++){
  const t=v.themes[i],[name,etfs]=NAMES[i];
  need(t?.theme===name&&same(t.etfs,etfs)&&
   Array.isArray(t.history)&&t.history.length===252,
   'W03_GMH_COMPAT_PRIVATE_THEME_STOP');
  const days=t.history.map(p=>p?.date);
  need(days.every((d,j)=>date(d)&&(j===0||d>days[j-1]))&&
   t.history.every(p=>score(p.score))&&
   (!expectedDays||same(days,expectedDays)),
   'W03_GMH_COMPAT_PRIVATE_HISTORY_STOP');
  expectedDays??=days;
 }
 need(expectedDays.at(-1)===v.observationDate,
  'W03_GMH_COMPAT_PRIVATE_DATE_STOP');
 return v;
}
export function readSavedCandidate(){
 need(process.platform==='win32','W03_GMH_COMPAT_WINDOWS_ONLY_STOP');
 const root=fs.realpathSync.native(SOURCE_ROOT),
  rel='derived'+path.sep+PRIVATE_FILE,
  file=path.join(root,rel),
  st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>1000&&st.size<=500000,
  'W03_GMH_COMPAT_PRIVATE_FILE_STOP');
 need(fs.realpathSync.native(file).toLowerCase().startsWith(
  root.toLowerCase()+path.sep),'W03_GMH_COMPAT_REALPATH_STOP');
 const a=fs.readFileSync(file),b=fs.readFileSync(file);
 need(a.equals(b)&&DIGEST(a)===PRIVATE_SHA,
  'W03_GMH_COMPAT_SHA_OR_CONCURRENT_STOP');
 return validateCandidate(JSON.parse(a.toString('utf8')));
}
function publicProjection(response){
 const httpStatus=Number.isInteger(response?.httpStatus)&&response.httpStatus>=100&&
  response.httpStatus<=599?response.httpStatus:null;
 const data=response?.body;
 const state=data?.status==='READY'?'READY':
  data?.status==='UNAVAILABLE'?'UNAVAILABLE':'OTHER_OR_INVALID';
 const reason=state==='UNAVAILABLE'?
  ['STORED_DATA_PENDING','STORED_DATA_NOT_APPROVED','STORED_DATA_STALE',
   'STORED_READ_UNAVAILABLE','STORED_DATA_INVALID'].includes(data.reason)?
   data.reason:'OTHER_OR_UNKNOWN':null;
 const eligible=state==='READY'&&httpStatus===200&&
  Array.isArray(data.themes)&&data.themes.length>=7&&data.themes.length<=15;
 return {httpStatus,state,reason,eligible,data:eligible?data:null};
}
function scoresOf(src){
 const obj={};
 for(const [name,etfs] of NAMES){
  const t=src?.themes?.find(x=>x?.theme===name);
  if(!t||!same(t.etfs,etfs)||!Array.isArray(t.history)||
   t.history.length!==252||!t.history.every(p=>date(p?.date)&&score(p?.score)))
   return null;
  obj[name]=new Map(t.history.map(x=>[x.date,x.score]));
 }
 return obj;
}
export function comparePrivateToSite(candidate,baseResponse,publicResponse){
 validateCandidate(candidate);
 const base=publicProjection(baseResponse),visible=publicProjection(publicResponse);
 const expected={schema:'ZGMINI_W03_GMH_PUBLIC_COMPAT_FACTS_V1',
  privateDate:candidate.observationDate,manifestSha256:MANIFEST_SHA,
  candidateSha256:PRIVATE_SHA,
  baseHttpStatus:base.httpStatus,baseState:base.state,baseReason:base.reason,
  publicHttpStatus:visible.httpStatus,publicState:visible.state,publicReason:visible.reason,
  baseObservationDate:date(base.data?.observationDate)?base.data.observationDate:null,
  publicObservationDate:date(visible.data?.observationDate)?visible.data.observationDate:null,
  sharedDates:0,comparedScores:0,mismatchedScores:0,maxDiff:null,
  publicR32DifferentScores:0,baseStructureValid:false,
  publicStructureValid:false,publicationAuthorized:false,
  d1SeedCasVerified:false,r32NonRegressionVerified:false,
  publicApiOnly:true,providerCalls:0,d1Writes:0,publicWrites:0};
 const old=scoresOf(base.data),newView=scoresOf(visible.data);
 expected.baseStructureValid=old!==null;
 expected.publicStructureValid=newView!==null;
 if(!old)return expected;
 let compared=0,differences=0,maxDiff=0,overlap=new Set();
 for(const t of candidate.themes){
  const prev=old[t.theme];
  for(const p of t.history)if(prev.has(p.date)){
   overlap.add(p.date);compared++;
   const delta=Math.abs(prev.get(p.date)-p.score);
   if(delta>0.00001)differences++;
   if(delta>maxDiff)maxDiff=delta;
  }
 }
 expected.sharedDates=overlap.size;expected.comparedScores=compared;
 expected.mismatchedScores=differences;
 expected.maxDiff=Number(maxDiff.toFixed(5));
 if(newView){
  let changed=0;
  for(const [name] of NAMES)
   for(const [day,val] of old[name])
    if(newView[name].has(day)&&
     Math.abs(newView[name].get(day)-val)>0.00001)changed++;
  expected.publicR32DifferentScores=changed;
 }
 return expected;
}
async function fixedGet(url,fetchImpl){
 let resp;
 try{resp=await fetchImpl(url,{method:'GET',redirect:'error',
  cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache'},
  signal:AbortSignal.timeout(18000)});}
 catch{return {httpStatus:null,body:null};}
 if(!resp||!Number.isInteger(resp.status))return {httpStatus:null,body:null};
 let size=0,parts=[];
 try{
  for await(const chunk of resp.body){
   size+=chunk.byteLength;if(size>1_800_000)STOP('W03_GMH_COMPAT_HTTP_BODY_LIMIT_STOP');
   parts.push(Buffer.from(chunk));
  }
  return {httpStatus:resp.status,
   body:JSON.parse(Buffer.concat(parts).toString('utf8'))};
 }catch{return {httpStatus:resp.status,body:null};}
}
export async function execute({event,env,load=readSavedCandidate,fetchImpl=fetch}={}){
 const req=authorize(event,env);
 need(process.platform==='win32','W03_GMH_COMPAT_WINDOWS_ONLY_STOP');
 const privateOutput=load();
 const base=await fixedGet(BASE_URL,fetchImpl);
 const visible=await fixedGet(PUBLIC_URL,fetchImpl);
 const stats=comparePrivateToSite(privateOutput,base,visible);
 return {schema:OUTPUT,status:'PASS',code:'W03_GMH_COMPAT_PUBLIC_READONLY_CAPTURED',
  requestId:req.requestId,controlSha:env.GITHUB_SHA,
  runId:env.GITHUB_RUN_ID??null,
  facts:stats,rawPriceExposed:false,providerCalls:0,d1Writes:0,
  publicWrites:0,retry:'NO_AUTOMATIC_REEXECUTION'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let out;try{out=await execute({event:JSON.parse(
   fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),env:process.env});}
 catch(e){out={schema:OUTPUT,status:'STOP',requestId:null,
  code:/^W03_GMH_COMPAT_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
   e.code:'W03_GMH_COMPAT_UNKNOWN_STOP',facts:null};}
 try{
  if(!process.env.RUNNER_TEMP||!path.isAbsolute(process.env.RUNNER_TEMP))
   STOP('W03_GMH_COMPAT_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-gmh-public-compat.json'),
   JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='PASS')process.exitCode=1;
}
