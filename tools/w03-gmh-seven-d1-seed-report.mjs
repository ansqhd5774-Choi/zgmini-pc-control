// Create-only sanitized D1 seed vs private GMH 7x252 read receipt.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,OUTPUT,REPO}
 from './w03-gmh-seven-d1-seed-a.mjs';
import {PRIVATE_SHA,MANIFEST_SHA}
 from './w03-gmh-seven-public-compat-a.mjs';
const RUN=/^\d{1,18}$/;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const CODE=/^W03_GMH_D1_[A-Z0-9_]{3,100}$/;
const DATE=/^\d{4}-\d\d-\d\d$/;
const date=x=>x===null||typeof x==='string'&&DATE.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const bool=x=>typeof x==='boolean';
const count=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const hash=x=>x===null||typeof x==='string'&&SHA64.test(x);
const safeTime=x=>x===null||Number.isSafeInteger(x)&&x>=0&&x<=1e14;
function safeFacts(x){
 if(x?.schema!=='ZGMINI_W03_GMH_D1_SEED_FACTS_V1'||
  x.source!=='EXISTING_PC_D1_CORE_READ_ONLY'||
  x.observationDate!=='2026-11-13'||
  x.inputManifestSha256!==MANIFEST_SHA||
  x.privateOutputSha256!==PRIVATE_SHA||
  !bool(x.seedPresent)||!bool(x.seedSchemaValid)||
  !safeTime(x.seedStoredAt)||!date(x.seedObservationDate)||
  !hash(x.seedBodySha256)||!hash(x.seedHistoryHash)||
  !count(x.overlapDates,252)||!count(x.comparedScores,1764)||
  !count(x.mismatchedScores,1764)||x.mismatchedScores>x.comparedScores||
  !(x.maxScoreDifference===null||
   typeof x.maxScoreDifference==='number'&&Number.isFinite(x.maxScoreDifference)&&
   x.maxScoreDifference>=0&&x.maxScoreDifference<=100)||
  !bool(x.rollingPresent)||
  !['R178','OTHER_OR_UNKNOWN'].includes(x.rollingSchema)||
  !['READY','UNAVAILABLE','OTHER_OR_UNKNOWN'].includes(x.rollingStatus)||
  !safeTime(x.rollingStoredAt)||!date(x.rollingObservationDate)||
  !(x.rollingBaseHashMatches===null||bool(x.rollingBaseHashMatches))||
  !bool(x.rollingPrimaryGmh)||!bool(x.rollingSecondaryNone)||
  x.publicationAuthorized!==false||x.d1SeedCasVerified!==false||
  x.r32NonRegressionVerified!==false||x.d1ReadOnly!==true||
  x.providerCalls!==0||x.d1Writes!==0||x.publicWrites!==0)return null;
 const keys=[
  'schema','source','observationDate','inputManifestSha256',
  'privateOutputSha256','seedPresent','seedSchemaValid','seedStoredAt',
  'seedObservationDate','seedBodySha256','seedHistoryHash',
  'overlapDates','comparedScores','mismatchedScores','maxScoreDifference',
  'rollingPresent','rollingSchema','rollingStatus','rollingStoredAt',
  'rollingObservationDate','rollingBaseHashMatches','rollingPrimaryGmh',
  'rollingSecondaryNone','publicationAuthorized','d1SeedCasVerified',
  'r32NonRegressionVerified','d1ReadOnly','providerCalls','d1Writes',
  'publicWrites'
 ];
 return Object.fromEntries(keys.map(k=>[k,x[k]]));
}
const base=(req,env)=>({schema:OUTPUT,status:'STATE_UNKNOWN',
 code:'W03_GMH_D1_READ_UNVERIFIED',
 requestId:req.requestId,runId:RUN.test(env.GITHUB_RUN_ID??'')?
  env.GITHUB_RUN_ID:null,
 facts:null,providerCalls:0,d1Writes:0,publicWrites:0,
 rawPricesExposed:false,retry:'NO_AUTOMATIC_REEXECUTION'});
export function sanitize(raw,req,env){
 const o=base(req,env);
 if(raw?.schema!==OUTPUT||
  raw.requestId!==req.requestId&&raw.requestId!==null)return o;
 if(raw.status==='STOP'&&CODE.test(raw.code??''))
  return {...o,status:'STOP',code:raw.code};
 if(raw.status!=='PASS'||raw.requestId!==req.requestId||
  raw.controlSha!==req.controlSourceSha||!SHA40.test(raw.controlSha??'')||
  raw.code!=='W03_GMH_D1_EXISTING_SEED_READONLY'||
  raw.providerCalls!==0||raw.d1Writes!==0||raw.publicWrites!==0||
  raw.rawPricesExposed!==false||
  raw.retry!=='NO_AUTOMATIC_REEXECUTION')return o;
 const facts=safeFacts(raw.facts);
 if(!facts)return o;
 return {...o,status:'PASS',code:raw.code,facts};
}
const readback=async(fetchApi,url,headers,content)=>{
 try{const r=await fetchApi(url+'?ref=main',{headers});
  if(r.status!==200)return false;const v=await r.json();
  return v.encoding==='base64'&&typeof v.content==='string'&&
   Buffer.from(v.content.replace(/\s/g,''),'base64').equals(Buffer.from(content));
 }catch{return false;}
};
export async function publish({event,env,raw,fetchApi=fetch}){
 const req=authorize(event,env);
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<20||
  !RUN.test(env.GITHUB_RUN_ID??''))throw Error('W03_GMH_D1_REPORT_AUTH');
 let parsed=null;
 try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=13000?
  JSON.parse(raw):null;}catch{}
 const record=sanitize(parsed,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-w03-gmh-d1-seed-a'};
 const txt=['REQUEST_ID='+req.requestId,'STATUS='+record.status,
  'CODE='+record.code,'RUN_ID='+record.runId,
  'D1_SEED_COMPAT='+JSON.stringify(record.facts??{}),
  'D1_WRITES=0','PROVIDER_CALLS=0','RAW_PRICE_EXPOSED=false',
  'PUBLICATION_AUTHORIZED=false','D1_SEED_CAS_VERIFIED=false',
  'RETRY=NO_AUTOMATIC_REEXECUTION',''].join('\n');
 let created=0,verified=0;
 for(const [ext,content] of [
  ['json',JSON.stringify(record,null,2)+'\n'],['txt',txt]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-gmh-d1-seed-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: W03 GMH derived private score vs D1 seed read-only',
     content:Buffer.from(content).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await readback(fetchApi,url,headers,content))verified++;
 }
 const note='<!-- w03-gmh-d1-seed:'+req.requestId+' -->\n'+
  'W03 D1 seed read-only '+(verified===2?record.status:'STATE_UNKNOWN')+
  ' / '+record.code+', seed '+(record.facts?.seedPresent??'UNKNOWN')+
  ', overlap '+(record.facts?.comparedScores??'UNKNOWN')+
  ', mismatches '+(record.facts?.mismatchedScores??'UNKNOWN')+
  '; JSON/TXT '+verified+'/2, created '+created+'/2, run '+record.runId+
  '; D1/provider/public writes 0, no retry.\n';
 const res=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:note})});
 if(res.status!==201)throw Error('W03_GMH_D1_REPORT_COMMENT');
 return {status:verified===2?record.status:'STATE_UNKNOWN',verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(
   fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-gmh-d1-seed-result.json'),'utf8');}catch{}
  const r=await publish({event,env,raw});
  process.stdout.write(r.status+' '+r.verified+'/2\n');
 }catch{process.stderr.write('W03_GMH_D1_REPORT_UNKNOWN_NO_RETRY\n');
  process.exitCode=1;}
}
