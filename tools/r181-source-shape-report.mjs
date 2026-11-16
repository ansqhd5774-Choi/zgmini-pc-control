#!/usr/bin/env node
// Create-only public-redacted shape receipt for an authenticated private issue.
// Reporter alone receives Github token, never collector or raw source.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authenticateR181InspectEvent}
  from './r181-source-shape-readonly.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const RUN=/^\d{1,18}$/;
const SAFE_SHAPE=/^[ A-Za-z0-9()[\]{}:;,.=+?!<>*/%-]{0,180}$/;
const SAFE_CODE=/^R181_INSPECT_[A-Z0-9_]{3,80}$/;
const STOP=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)STOP(code);};
export function sanitizeR181ShapeResult(raw,request,env){
  const out={schema:'ZGMINI_R181_SHAPE_RESULT_V1',
    requestId:request.requestId,status:'STATE_UNKNOWN',
    code:'R181_INSPECT_RESULT_UNVERIFIED_STOP',
    shape:null,runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
    operationalWrites:0,providerCalls:0,d1Writes:0};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    raw.schema!==out.schema)return out;
  if(raw.status==='STOP'&&SAFE_CODE.test(raw.code??'')&&
     (raw.requestId===request.requestId||raw.requestId===null)){
    return {...out,status:'STOP',code:raw.code};
  }
  if(raw.status!=='PASS'||raw.code!=='R181_SOURCE_SHAPE_READONLY'||
    raw.requestId!==request.requestId)return out;
  const s=raw.shape;
  if(s?.schema!=='ZGMINI_R181_URL_SHAPE_V1'||
    s.status!=='STATIC_SOURCE_ONLY'||
    !['ZERO','ONE','MULTIPLE'].includes(s.legacyRouteCountBucket)||
    typeof s.modernRouteExactPresent!=='boolean'||
    s.runtimeUrlVerified!==false||s.http404SubtypeVerified!==false||
    s.providerCalls!==0||s.operationalWrites!==0||
    s.sqliteOpened!==false||s.d1Writes!==0||
    !Array.isArray(s.safeShapeLines)||s.safeShapeLines.length>36||
    !s.safeShapeLines.every(x=>Number.isInteger(x.line)&&
      x.line>=1&&x.line<=200&&typeof x.shape==='string'&&
      SAFE_SHAPE.test(x.shape)))return out;
  const allowedHints=['BARS_PREFIX','OLD_EXACT','MODERN_EXACT','STOCKS_US',
    'QUERY_ROUTE','BARS_QUERY','source','symbol','dataset','ticker',
    'timeframe','SPY','1h'];
  if(!s.literalHints||typeof s.literalHints!=='object'||
    Object.keys(s.literalHints).sort().join(',')!==allowedHints.sort().join(',')||
    allowedHints.some(k=>typeof s.literalHints[k]!=='boolean'))return out;
  const allowedFeatures=['usesURLConstructor','usesURLSearchParams',
    'usesEncodeURIComponent','usesTemplateLiterals','usesFetch',
    'usesDynamicConcatenation','usesGetMarketHistoryHost'];
  if(!s.features||typeof s.features!=='object'||
    Object.keys(s.features).sort().join(',')!==allowedFeatures.sort().join(',')||
    allowedFeatures.some(k=>typeof s.features[k]!=='boolean'))return out;
  const shape={
    classification:s.legacyRouteCountBucket,
    literalHints:Object.fromEntries(allowedHints.map(k=>[k,s.literalHints[k]])),
    features:Object.fromEntries(allowedFeatures.map(k=>[k,s.features[k]])),
    safeShapeLines:s.safeShapeLines.map(x=>({line:x.line,shape:x.shape})),
    runtimeUrlVerified:false,http404SubtypeVerified:false,
  };
  return {...out,status:'PASS',code:'R181_SOURCE_SHAPE_READONLY',shape};
}
function txt(r){return [
  'REQUEST_ID='+r.requestId,'STATUS='+r.status,'CODE='+r.code,
  'RUN_ID='+(r.runId??'UNKNOWN'),
  'STATIC_ONLY=true','RUNTIME_URL_VERIFIED=false',
  'PROVIDER_CALLS=0','OPERATIONAL_WRITES=0','D1_WRITES=0',
  'SHAPE_RECEIPT='+JSON.stringify(r.shape??{}),''].join('\n');}
async function readback(fetchApi,url,headers,content){
  try{
    const rsp=await fetchApi(url+'?ref=main',{method:'GET',headers});
    if(rsp.status!==200)return false;
    const v=await rsp.json();
    return v?.encoding==='base64'&&typeof v.content==='string'&&
      Buffer.from(v.content.replace(/\s/g,''),'base64')
        .equals(Buffer.from(content));
  }catch{return false;}
}
export async function reportR181Shape({event,env,raw,fetchApi=fetch}){
  const request=authenticateR181InspectEvent(event,env);
  need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
    RUN.test(env.GITHUB_RUN_ID??''),
    'R181_INSPECT_REPORT_AUTH_STOP');
  let data=null;
  try{data=typeof raw==='string'&&Buffer.byteLength(raw)<=12500?
    JSON.parse(raw):null;}catch{}
  const r=sanitizeR181ShapeResult(data,request,env);
  const headers={accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_TOKEN,
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-r181-readonly-shape'};
  let verified=0,created=0;
  for(const [ext,body] of [
    ['json',JSON.stringify(r,null,2)+'\n'],['txt',txt(r)]]){
    const url='https://api.github.com/repos/'+REPO+
      '/contents/results/r181-source-shape-'+request.requestId+'.'+ext;
    try{
      const rsp=await fetchApi(url,{method:'PUT',headers,
        body:JSON.stringify({message:'evidence: one-shot fixed R181 readonly URL shape',
          content:Buffer.from(body).toString('base64')})});
      if(rsp.status===201)created++;
    }catch{}
    if(await readback(fetchApi,url,headers,body))verified++;
  }
  const status=verified===2?r.status:'STATE_UNKNOWN';
  const comment='<!-- w03-r181-shape:'+request.requestId+' -->\n'+
    'R181 pinned readonly source shape: '+status+' ('+r.code+')\n'+
    'JSON/TXT readback: '+verified+'/2, created '+created+'/2, run '+
    (r.runId??'UNKNOWN')+'; operational writes 0; no automatic replay.\n';
  const rsp=await fetchApi('https://api.github.com/repos/'+REPO+
    '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
      body:JSON.stringify({body:comment})});
  need(rsp.status===201,'R181_INSPECT_REPORT_COMMENT_STOP');
  return {status,verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const env=process.env,
      event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    let raw='{}';
    try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
      'r181-source-shape-result.json'),'utf8');}catch{}
    const result=await reportR181Shape({event,env,raw});
    process.stdout.write('R181_SHAPE_REPORT '+result.status+' '+result.verified+'/2\n');
  }catch{
    process.stderr.write('R181_SHAPE_REPORT_UNVERIFIED_NO_REPLAY\n');
    process.exitCode=1;
  }
}
