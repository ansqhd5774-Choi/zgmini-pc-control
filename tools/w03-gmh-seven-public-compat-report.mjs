// Redacted create-only report for W03 public API comparability, not D1 seed CAS.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,OUTPUT,REPO,MANIFEST_SHA,PRIVATE_SHA}
 from './w03-gmh-seven-public-compat-a.mjs';
const RUN=/^\d{1,18}$/;
const SHA40=/^[a-f0-9]{40}$/;
const CODE=/^W03_GMH_COMPAT_[A-Z0-9_]{3,100}$/;
const DATE=/^\d{4}-\d\d-\d\d$/;
const STATE=new Set(['READY','UNAVAILABLE','OTHER_OR_INVALID']);
const REASON=new Set(['STORED_DATA_PENDING','STORED_DATA_NOT_APPROVED',
 'STORED_DATA_STALE','STORED_READ_UNAVAILABLE','STORED_DATA_INVALID',
 'OTHER_OR_UNKNOWN']);
const count=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const status=x=>x===null||(Number.isSafeInteger(x)&&x>=100&&x<=599);
const date=x=>x===null||typeof x==='string'&&DATE.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const safeFacts=v=>{
 if(v?.schema!=='ZGMINI_W03_GMH_PUBLIC_COMPAT_FACTS_V1'||
  v.privateDate!=='2026-11-13'||
  v.manifestSha256!==MANIFEST_SHA||
  v.candidateSha256!==PRIVATE_SHA||
  !status(v.baseHttpStatus)||!status(v.publicHttpStatus)||
  !STATE.has(v.baseState)||!STATE.has(v.publicState)||
  !(v.baseReason===null||REASON.has(v.baseReason))||
  !(v.publicReason===null||REASON.has(v.publicReason))||
  !date(v.baseObservationDate)||!date(v.publicObservationDate)||
  !count(v.sharedDates,252)||!count(v.comparedScores,1764)||
  !count(v.mismatchedScores,1764)||v.mismatchedScores>v.comparedScores||
  !(v.maxDiff===null||typeof v.maxDiff==='number'&&
   Number.isFinite(v.maxDiff)&&v.maxDiff>=0&&v.maxDiff<=100)||
  !count(v.publicR32DifferentScores,1764)||
  typeof v.baseStructureValid!=='boolean'||
  typeof v.publicStructureValid!=='boolean'||
  v.publicationAuthorized!==false||v.d1SeedCasVerified!==false||
  v.r32NonRegressionVerified!==false||v.publicApiOnly!==true||
  v.providerCalls!==0||v.d1Writes!==0||v.publicWrites!==0)return null;
 const result={};
 const keys=['schema','privateDate','manifestSha256','candidateSha256',
 'baseHttpStatus','baseState','baseReason','publicHttpStatus','publicState',
 'publicReason','baseObservationDate','publicObservationDate','sharedDates',
 'comparedScores','mismatchedScores','maxDiff','publicR32DifferentScores',
 'baseStructureValid','publicStructureValid','publicationAuthorized',
 'd1SeedCasVerified','r32NonRegressionVerified','publicApiOnly',
 'providerCalls','d1Writes','publicWrites'];
 for(const key of keys)result[key]=v[key];
 return result;
};
const base=(req,env)=>({schema:OUTPUT,
 status:'STATE_UNKNOWN',code:'W03_GMH_COMPAT_UNVERIFIED',
 requestId:req.requestId,runId:RUN.test(env.GITHUB_RUN_ID??'')?
  env.GITHUB_RUN_ID:null,
 facts:null,providerCalls:0,d1Writes:0,publicWrites:0,
 rawPriceExposed:false,retry:'NO_AUTOMATIC_REEXECUTION'});
export function sanitize(raw,req,env){
 const out=base(req,env);
 if(raw?.schema!==OUTPUT||
  raw.requestId!==req.requestId&&raw.requestId!==null)return out;
 if(raw.status==='STOP'&&CODE.test(raw.code??''))
  return {...out,status:'STOP',code:raw.code};
 if(raw.status!=='PASS'||raw.requestId!==req.requestId||
  raw.controlSha!==req.controlSourceSha||
  !SHA40.test(raw.controlSha??'')||
  raw.code!=='W03_GMH_COMPAT_PUBLIC_READONLY_CAPTURED'||
  raw.rawPriceExposed!==false||raw.providerCalls!==0||
  raw.d1Writes!==0||raw.publicWrites!==0||
  raw.retry!=='NO_AUTOMATIC_REEXECUTION')return out;
 const facts=safeFacts(raw.facts);
 if(!facts)return out;
 return {...out,status:'PASS',code:raw.code,facts};
}
const check=async(fetchApi,url,headers,content)=>{
 try{const res=await fetchApi(url+'?ref=main',{headers});
  if(res.status!==200)return false;
  const json=await res.json();
  return json.encoding==='base64'&&typeof json.content==='string'&&
   Buffer.from(json.content.replace(/\s/g,''),'base64')
    .equals(Buffer.from(content));
 }catch{return false;}
};
export async function publish({event,env,raw,fetchApi=fetch}){
 const req=authorize(event,env);
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<20||
  !RUN.test(env.GITHUB_RUN_ID??''))
  throw Error('W03_GMH_COMPAT_REPORT_AUTH');
 let o;try{o=typeof raw==='string'&&Buffer.byteLength(raw)<=9000?
  JSON.parse(raw):null;}catch{o=null;}
 const safe=sanitize(o,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json',
  'user-agent':'zgmini-w03-seven-gmh-public-compat'};
 const txt=['REQUEST_ID='+req.requestId,'STATUS='+safe.status,
  'CODE='+safe.code,'RUN_ID='+safe.runId,
  'PUBLIC_COMPAT='+JSON.stringify(safe.facts??{}),
  'D1_SEED_CAS_VERIFIED=false','R32_NONREGRESSION_VERIFIED=false',
  'PROVIDER_CALLS=0','D1_WRITES=0','PUBLIC_WRITES=0',
  'RAW_PRICE_EXPOSED=false','RETRY=NO_AUTOMATIC_REEXECUTION',''].join('\n');
 let verified=0,created=0;
 for(const [ext,content] of [
  ['json',JSON.stringify(safe,null,2)+'\n'],['txt',txt]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-gmh-public-compat-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: W03 7x252 GMH-only public read-only comparison',
     content:Buffer.from(content).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await check(fetchApi,url,headers,content))verified++;
 }
 const note='<!-- w03-gmh-public-compat:'+req.requestId+' -->\n'+
  'W03 live public API comparison '+(verified===2?safe.status:'STATE_UNKNOWN')+
  ' / '+safe.code+'; base '+(safe.facts?.baseState??'UNKNOWN')+
  ', public '+(safe.facts?.publicState??'UNKNOWN')+
  ', overlap '+(safe.facts?.comparedScores??'UNKNOWN')+
  ', score mismatches '+(safe.facts?.mismatchedScores??'UNKNOWN')+
  '; JSON/TXT remote '+verified+'/2; created '+created+'/2; run '+safe.runId+
  '; API-only not D1 CAS, zero writes, no replay.\n';
 const result=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:note})});
 if(result.status!==201)throw Error('W03_GMH_COMPAT_REPORT_COMMENT');
 return {status:verified===2?safe.status:'STATE_UNKNOWN',verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-gmh-public-compat.json'),'utf8');}catch{}
  const r=await publish({event,env,raw});
  process.stdout.write(r.status+' '+r.verified+'/2\n');
 }catch{process.stderr.write('W03_GMH_COMPAT_REPORT_UNKNOWN_NO_RETRY\n');
  process.exitCode=1;}
}
