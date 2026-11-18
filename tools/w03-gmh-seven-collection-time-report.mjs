// W03 safe create-only JSON/TXT receipt for GMH collection-time audit.
// Never emits prices, saved histories, source code, credentials or raw manifests.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {identifySafeReceipt,compatibleControlSha,OUTPUT,REPO,SOURCE_SHA,
 CHECKPOINT_SHA} from './w03-gmh-seven-collection-time-a.mjs';
import {MANIFEST_SHA,PRIVATE_SHA} from './w03-gmh-seven-public-compat-a.mjs';

const RUN=/^\d{1,18}$/;
const SHA40=/^[a-f0-9]{40}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const CODE=/^W03_(?:GMH_TIME|SAVED|PC_PARITY)_[A-Z0-9_]{3,100}$/;
const safeFacts=x=>{
 if(x?.schema!=='ZGMINI_W03_GMH_TIME_FACTS_V1'||
  x.observationDate!=='2026-11-13'||
  x.inputManifestSha256!==MANIFEST_SHA||
  x.checkpointSha256!==CHECKPOINT_SHA||
  x.privateArtifactSha256!==PRIVATE_SHA||
  x.sourceTimestampBasis!=='MANIFEST_GET_REQUEST_AT'||
  !ISO.test(x.sourceStoredAt??'')||
  !(Date.parse(x.sourceStoredAt)>=Date.parse('2026-11-13T00:00:00Z'))||
  x.verifiedSymbols!==14||x.rawPagesVerified!==30||
  !Number.isSafeInteger(x.coveringPages)||
  x.coveringPages<14||x.coveringPages>30||
  x.rawFilesRehashed!==true||
  x.sourceTimestampIsFileCommitTime!==false||
  x.publicationAuthorized!==false||x.rightsVerified!==false||
  x.d1SeedCasVerified!==false||x.r32NonRegressionVerified!==false||
  x.providerCalls!==0||x.sqliteWrites!==0||x.d1Writes!==0||
  x.publicWrites!==0)return null;
 const keys=['schema','observationDate','sourceStoredAt','sourceTimestampBasis',
  'inputManifestSha256','checkpointSha256','privateArtifactSha256',
  'verifiedSymbols','rawPagesVerified','coveringPages','rawFilesRehashed',
  'sourceTimestampIsFileCommitTime','publicationAuthorized','rightsVerified',
  'd1SeedCasVerified','r32NonRegressionVerified','providerCalls',
  'sqliteWrites','d1Writes','publicWrites'];
 return Object.fromEntries(keys.map(k=>[k,x[k]]));
};
const base=(request,env)=>({schema:OUTPUT,status:'STATE_UNKNOWN',
 code:'W03_GMH_TIME_RESULT_UNVERIFIED',requestId:request.requestId,
 runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 facts:null,rawPricesExposed:false,providerCalls:0,d1Writes:0,
 publicWrites:0,retry:'NO_AUTOMATIC_REEXECUTION'});
export function sanitize(raw,request,env,{controlCheck=compatibleControlSha}={}){
 const result=base(request,env);
 if(!controlCheck(request.controlSourceSha,env.GITHUB_SHA))
  return {...result,status:'STOP',code:'W03_GMH_TIME_CONTROL_DRIFT_STOP'};
 if(raw?.schema!==OUTPUT||
  (raw.requestId!==request.requestId&&raw.requestId!==null))return result;
 if(raw.status==='STOP'&&CODE.test(raw.code??''))
  return {...result,status:'STOP',code:raw.code};
 if(raw.status!=='PASS'||raw.code!=='W03_GMH_TIME_MANIFEST_ATTESTED_READONLY'||
  raw.controlSha!==env.GITHUB_SHA||!SHA40.test(raw.controlSha??'')||
  raw.candidateSourceSha!==SOURCE_SHA||
  raw.requestId!==request.requestId||
  raw.rawPricesExposed!==false||raw.providerCalls!==0||
  raw.d1Writes!==0||raw.publicWrites!==0||
  raw.retry!=='NO_AUTOMATIC_REEXECUTION')return result;
 const facts=safeFacts(raw.facts);
 return facts?{...result,status:'PASS',code:raw.code,facts}:result;
}
const readback=async(fetchApi,url,headers,bytes)=>{
 try{
  const res=await fetchApi(url+'?ref=main',{headers});
  if(res.status!==200)return false;
  const data=await res.json();
  return data.encoding==='base64'&&typeof data.content==='string'&&
   Buffer.from(data.content.replace(/\s/g,''),'base64').equals(Buffer.from(bytes));
 }catch{return false;}
};
export async function publish({event,env,raw,fetchApi=fetch}={}){
 const req=identifySafeReceipt(event,env);
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<20||
  !RUN.test(env.GITHUB_RUN_ID??''))throw Error('W03_GMH_TIME_REPORT_AUTH_STOP');
 let parsed=null;
 try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=4500?
  JSON.parse(raw):null;}catch{}
 const record=sanitize(parsed,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json',
  'user-agent':'zgmini-w03-gmh-collection-time-readonly'};
 const txt=['REQUEST_ID='+record.requestId,'STATUS='+record.status,
  'CODE='+record.code,'RUN_ID='+record.runId,
  'SOURCE_TIMESTAMP='+String(record.facts?.sourceStoredAt??'UNKNOWN'),
  'PROVENANCE='+JSON.stringify(record.facts??{}),
  'PUBLICATION_AUTHORIZED=false','RIGHTS_VERIFIED=false',
  'D1_SEED_CAS_VERIFIED=false','R32_NONREGRESSION_VERIFIED=false',
  'PROVIDER_CALLS=0','D1_WRITES=0','PUBLIC_WRITES=0',
  'RAW_PRICE_EXPOSED=false','RETRY=NO_AUTOMATIC_REEXECUTION',''].join('\n');
 let created=0,verified=0;
 for(const [ext,bytes] of [
  ['json',JSON.stringify(record,null,2)+'\n'],['txt',txt]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-gmh-collection-time-'+req.requestId+'.'+ext;
  try{
   const res=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: W03 read-only source-time SHA attestation',
     content:Buffer.from(bytes).toString('base64')})});
   if(res.status===201)created++;
  }catch{}
  if(await readback(fetchApi,url,headers,bytes))verified++;
 }
 const note='<!-- w03-gmh-time:'+req.requestId+' -->\n'+
  'W03 GMH 14-symbol collection-time read-only '+
  (verified===2?record.status:'STATE_UNKNOWN')+
  ' / '+record.code+'; observation '+(record.facts?.observationDate??'UNKNOWN')+
  ', sourceRequestTime '+(record.facts?.sourceStoredAt??'UNKNOWN')+
  ', pages '+(record.facts?.rawPagesVerified??'UNKNOWN')+
  ', source lineage SHA checked '+Boolean(record.facts)+
  '; JSON/TXT remote '+verified+'/2, created '+created+
  '/2, run '+record.runId+'; provider/PC/D1/public writes 0; no replay.\n';
 const response=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:note})});
 if(response.status!==201)throw Error('W03_GMH_TIME_REPORT_COMMENT_STOP');
 return {status:verified===2?record.status:'STATE_UNKNOWN',verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(
   env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-gmh-collection-time-result.json'),'utf8');}catch{}
  const result=await publish({event,env,raw});
  process.stdout.write(result.status+' '+result.verified+'/2\n');
 }catch{
  process.stderr.write('W03_GMH_TIME_REPORT_UNKNOWN_NO_REEXECUTION\n');
  process.exitCode=1;
 }
}
