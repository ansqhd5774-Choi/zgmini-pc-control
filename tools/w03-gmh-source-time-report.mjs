#!/usr/bin/env node
// Report exact forbidden provider Task disable and protected GMH readback.
// Never promote it to successful raw data collection or D1 publication.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,REQUEST_SCHEMA,OPERATION,PINS}
 from './w03-gmh-source-time-readonly.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const RUN=/^\d{1,18}$/;
const CODE=/^(?:GMH_TIME_|W03_SAVED_)[A-Z0-9_]{3,100}$/;
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(ok,c)=>{if(!ok)stop(c);};
function verifyEvent(event,env){return authorize(event,env);}
export function sanitizeGmhTimeResult(raw,request,env){
 const base={schema:'ZGMINI_GMH_SOURCE_TIME_RECEIPT_V1',requestId:request.requestId,status:'STATE_UNKNOWN',code:'GMH_TIME_RESULT_UNVERIFIED',providerCalls:0,d1Writes:0,publicWrites:0,sourceWrites:0,publicationAuthorized:false,runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null};
 if(raw?.status==='PASS'&&raw.code==='GMH_TIME_SOURCE_RECEIPTS_SHA_ATTESTED'&&raw.requestId===request.requestId&&raw.observationDate==='2026-11-13'&&raw.manifestSha256===PINS.manifest&&raw.checkpointSha256===PINS.checkpoint&&raw.privateSha256===PINS.private&&raw.verifiedSymbols===14&&raw.rawPagesVerified===30&&raw.sourceTimestampBasis==='MANIFEST_GET_REQUEST_AT'&&raw.sourceTimestampIsFileCommitTime===false&&Number.isFinite(Date.parse(raw.sourceStoredAt))&&Date.parse(raw.sourceStoredAt)<=Date.now()&&['providerCalls','sqliteWrites','d1Writes','publicWrites','sourceWrites','schedulerWrites'].every(k=>raw[k]===0)&&raw.publicationAuthorized===false&&raw.derivedLicenseVerified===false&&raw.upstreamCommercialRightsVerified===false)return {...base,status:'PASS',code:raw.code,observationDate:raw.observationDate,sourceStoredAt:raw.sourceStoredAt,sourceTimestampBasis:raw.sourceTimestampBasis,sourceTimestampIsFileCommitTime:false,manifestSha256:raw.manifestSha256,checkpointSha256:raw.checkpointSha256,privateSha256:raw.privateSha256,verifiedSymbols:14,rawPagesVerified:30,coveringPages:raw.coveringPages,derivedLicenseVerified:false,upstreamCommercialRightsVerified:false};
 if(raw?.status==='STOP'&&CODE.test(raw.code??''))return {...base,status:'STOP',code:raw.code};return base;
}
function asText(r){return Object.entries(r).map(([k,v])=>k+'='+String(v)).join('\n')+'\n';}
async function readback(fetchApi,url,headers,bytes){
 try{
  const r=await fetchApi(url+'?ref=main',{method:'GET',headers});
  if(r.status!==200)return false;
  const v=await r.json();
  return v?.encoding==='base64'&&typeof v.content==='string'&&
   Buffer.from(v.content.replace(/\s/g,''),'base64')
    .equals(Buffer.from(bytes));
 }catch{return false;}
}
export async function publishGmhTimeReceipt({event,env,raw,fetchApi=fetch}){
 const req=verifyEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'GMH_TIME_REPORT_TOKEN_STOP');
 let data=null;
 try{data=typeof raw==='string'&&Buffer.byteLength(raw)<=4096?
  JSON.parse(raw):null;}catch{}
 const out=sanitizeGmhTimeResult(data,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-gmh-source-time'};
 let created=0,verified=0;
 for(const [ext,body] of [
  ['json',JSON.stringify(out,null,2)+'\n'],
  ['txt',asText(out)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/gmh-source-time-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: GMH saved source collection timestamp',
     content:Buffer.from(body).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await readback(fetchApi,url,headers,body))verified++;
 }
 const status=verified===2?out.status:'STATE_UNKNOWN';
 const comment='<!-- w03-gmh-source-time:'+req.requestId+' -->\n'+
  'Exact existing GMH manifest collection time readonly request: '+status+' / '+out.code+
  '; JSON/TXT readback '+verified+'/2, created '+created+
  '/2; run '+out.runId+
  '; private saved raw verified; rights and publication not authorized; no replay.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:comment})});
 need(posted.status===201,'GMH_TIME_REPORT_COMMENT_STOP');
 return {status,created,verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'gmh-source-time-result.json'),'utf8');}catch{}
  const result=await publishGmhTimeReceipt({event,env,raw});
  process.stdout.write('GMH_TIME_REPORT '+result.status+' '+result.verified+'/2\n');
 }catch{
  process.stderr.write('GMH_TIME_REPORT_STATE_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;
 }
}
