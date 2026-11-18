// Create-only, non-price W03 private 7x252 result receipt.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,OUTPUT,SAVED_SCHEMA} from './w03-gmh-seven-private-score-once.mjs';
import {REPO,APPROVED_SOURCE_SHA} from './w03-gmh-seven-manual-once.mjs';
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const RUN=/^\d{1,18}$/;
const CODE=/^W03_GMH_SCORE_[A-Z0-9_]{3,80}$/;
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const base=(req,env)=>({schema:OUTPUT,status:'STATE_UNKNOWN',
 code:'W03_GMH_SCORE_RESULT_UNVERIFIED',requestId:req.requestId,
 runId:RUN.test(env.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 sourceCommit:req.candidateSourceSha,providerCalls:0,d1Writes:0,
 publicWrites:0,taskChanges:0,rawBarExposure:false,
 retry:'NO_AUTOMATIC_REEXECUTION',
 observationDate:null,commonSessionCount:null,historyPoints:null,
 inputManifestSha256:null,privateArtifactSha256:null,
 checkpointSha256:null,rawPagesVerified:null,localSaved:null});
export function sanitize(raw,req,env){
 const a=base(req,env);
 if(raw?.schema!==OUTPUT||raw.requestId!==req.requestId||
  raw.controlSha!==req.controlSourceSha||
  !SHA40.test(raw.controlSha??'')||
  raw.sourceCommit!==req.candidateSourceSha||
  raw.providerCalls!==0||raw.d1Writes!==0||
  raw.publicWrites!==0||raw.taskChanges!==0||
  raw.rawBarExposure!==false||raw.retry!=='NO_AUTOMATIC_REEXECUTION')return a;
 if(raw.status==='STOP'&&CODE.test(raw.code??''))
  return {...a,status:'STOP',code:raw.code};
 if(req.schema===SAVED_SCHEMA){
  if(raw.status!=='PASS'||raw.code!=='W03_GMH_SCORE_SAVED_7X252_VERIFIED'||
   !/^\d{4}-\d\d-\d\d$/.test(raw.observationDate??'')||
   !Number.isSafeInteger(raw.commonSessionCount)||
   raw.commonSessionCount<628||raw.commonSessionCount>1500||
   raw.historyPoints!==1764||
   !Number.isSafeInteger(raw.rawPagesVerified)||
   raw.rawPagesVerified<14||raw.rawPagesVerified>256||
   raw.localSaved!==true||
   !SHA64.test(raw.checkpointSha256??'')||
   !SHA64.test(raw.inputManifestSha256??'')||
   !SHA64.test(raw.privateArtifactSha256??''))return a;
  return {...a,status:'PASS',code:raw.code,
   observationDate:raw.observationDate,
   commonSessionCount:raw.commonSessionCount,historyPoints:1764,
   inputManifestSha256:raw.inputManifestSha256,
   privateArtifactSha256:raw.privateArtifactSha256,
   checkpointSha256:raw.checkpointSha256,
   rawPagesVerified:raw.rawPagesVerified,localSaved:true};
 }
 if(raw.status!=='PASS'||raw.code!=='W03_GMH_SCORE_PRIVATE_7X252_VERIFIED'||
  !/^\d{4}-\d\d-\d\d$/.test(raw.observationDate??'')||
  !Number.isSafeInteger(raw.commonSessionCount)||
  raw.commonSessionCount<628||raw.commonSessionCount>1500||
  raw.historyPoints!==1764||
  !SHA64.test(raw.inputManifestSha256??'')||
  !SHA64.test(raw.privateArtifactSha256??''))return a;
 return {...a,status:'PASS',code:raw.code,observationDate:raw.observationDate,
  commonSessionCount:raw.commonSessionCount,historyPoints:1764,
  inputManifestSha256:raw.inputManifestSha256,
  privateArtifactSha256:raw.privateArtifactSha256};
}
const check=async(fetchApi,url,headers,contents)=>{
 try{const r=await fetchApi(url+'?ref=main',{headers});
  if(r.status!==200)return false;const v=await r.json();
  return v.encoding==='base64'&&typeof v.content==='string'&&
   Buffer.from(v.content.replace(/\s/g,''),'base64').equals(Buffer.from(contents));
 }catch{return false;}
};
export async function report({event,env,raw,fetchApi=fetch}){
 const req=authorize(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'W03_GMH_SCORE_REPORT_AUTH_STOP');
 let parsed=null;
 try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=5000?
  JSON.parse(raw):null;}catch{}
 const result=sanitize(parsed,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-w03-gmh-seven-score'};
 const txt=['REQUEST_ID='+req.requestId,'STATUS='+result.status,
  'CODE='+result.code,'RUN_ID='+result.runId,
  'OBSERVATION_DATE='+(result.observationDate??'UNKNOWN'),
  'COMMON_SESSIONS='+(result.commonSessionCount??'UNKNOWN'),
  'HISTORY_POINTS='+(result.historyPoints??'UNKNOWN'),
  'MANIFEST_SHA256='+(result.inputManifestSha256??'UNKNOWN'),
  'CHECKPOINT_SHA256='+(result.checkpointSha256??'UNKNOWN'),
  'VERIFIED_RAW_PAGES='+(result.rawPagesVerified??'UNKNOWN'),
  'PRIVATE_LOCAL_SAVED='+(result.localSaved??'UNKNOWN'),
  'PRIVATE_OUTPUT_SHA256='+(result.privateArtifactSha256??'UNKNOWN'),
  'PROVIDER_CALLS=0','D1_WRITES=0','PUBLIC_WRITES=0',
  'RAW_BAR_EXPOSURE=false','RETRY=NO_AUTOMATIC_REEXECUTION',''].join('\n');
 let created=0,verified=0;
 for(const [ext,contents] of [['json',JSON.stringify(result,null,2)+'\n'],['txt',txt]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-gmh-seven-private-score-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: GMH-only 7x252 private score checksum',
     content:Buffer.from(contents).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await check(fetchApi,url,headers,contents))verified++;
 }
 const note='<!-- w03-gmh-seven-private-score:'+req.requestId+' -->\n'+
  'W03 GMH private 7x252 '+(verified===2?result.status:'STATE_UNKNOWN')+
  ' / '+result.code+'; 252-point output '+(result.historyPoints??'UNKNOWN')+
  ', common sessions '+(result.commonSessionCount??'UNKNOWN')+
  ', JSON/TXT readback '+verified+'/2; created '+created+'/2; run '+result.runId+
  '; provider/D1/public writes 0; no replay.\n';
 const p=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:note})});
 need(p.status===201,'W03_GMH_SCORE_REPORT_COMMENT_STOP');
 return {status:verified===2?result.status:'STATE_UNKNOWN',created,verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-gmh-seven-score.json'),'utf8');}catch{}
  const r=await report({event,env,raw});
  process.stdout.write(r.status+' '+r.verified+'/2\n');
 }catch{process.stderr.write('W03_GMH_SCORE_REPORT_UNKNOWN\n');process.exitCode=1;}
}
