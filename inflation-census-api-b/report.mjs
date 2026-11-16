// Create-only private result JSON/TXT and originating owner Issue receipt.
// Never include provider URL (contains key), raw body, credential or full paths.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CENSUS_B_REPO,authorizeCensusB} from './contract.mjs';
const OUTPUT='ZGMINI_W01_CENSUS_M3_API_B_RESULT_V1';
const RUN=/^\d{1,18}$/;
const CODE=/^(?:W01_CENSUS_B|INFL_MANUAL_B|WRITER_B_CORE)_[A-Z0-9_]{3,90}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)fail(code);};
const CONTROL_ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const clean=raw=>raw&&typeof raw==='object'&&!Array.isArray(raw);
const num=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
export function sanitizeCensusBResult(raw,proof,env){
 const basic={schema:OUTPUT,status:'STATE_UNKNOWN',
  code:'W01_CENSUS_B_REPORT_UNVERIFIED_STOP',
  requestId:proof.request.requestId,runId:RUN.test(env.GITHUB_RUN_ID??'')?
   env.GITHUB_RUN_ID:null,
  controlSha:proof.controlSha,sourceSha:proof.manifest.installedSourceSha,
  providerCalls:null,stored:null,publicWrites:0,d1Writes:0,taskChanges:0,
  replay:'FORBIDDEN'};
 if(!clean(raw)||raw.requestId!==proof.request.requestId||
  raw.sourceSha!==proof.manifest.installedSourceSha||
  raw.replay!=='FORBIDDEN'||raw.publicWrites!==0||
  raw.d1Writes!==0||raw.taskChanges!==0)return basic;
 if(raw.status==='PASS'&&raw.code==='W01_CENSUS_B_SAVED_READBACK'&&
  raw.providerCalls===2&&['SAVED_READBACK','UNCHANGED'].includes(raw.stored))
  return {...basic,status:'PASS',code:raw.code,
   providerCalls:2,stored:raw.stored};
 if(['STOP','STATE_UNKNOWN'].includes(raw.status)&&CODE.test(raw.code??'')){
  return {...basic,status:raw.status,code:raw.code,
   providerCalls:num(raw.providerCalls,2)?raw.providerCalls:null};
 }
 return basic;
}
async function remoteReadback(fetchApi,url,headers,contents){
 try{
  const r=await fetchApi(url+'?ref=main',{headers});
  if(r.status!==200)return false;
  const v=await r.json();
  return v.encoding==='base64'&&
   Buffer.from(String(v.content??'').replace(/\s/g,''),'base64')
    .equals(Buffer.from(contents));
 }catch{return false;}
}
export async function publishCensusBReceipt({proof,env,event,raw,
 fetchApi=fetch}){
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'W01_CENSUS_B_REPORT_TOKEN_STOP');
 const value=sanitizeCensusBResult(raw,proof,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json',
  'user-agent':'zgmini-w01-census-api-b'};
 const reportTxt=['SCHEMA='+OUTPUT,'REQUEST_ID='+value.requestId,
  'RUN_ID='+value.runId,'STATUS='+value.status,'CODE='+value.code,
  'SOURCE_SHA='+value.sourceSha,'PROVIDER_CALLS='+(value.providerCalls??'UNKNOWN'),
  'STORED='+(value.stored??'UNKNOWN'),
  'D1_WRITES=0','PUBLIC_WRITES=0','TASK_CHANGES=0',
  'REPLAY=FORBIDDEN',''].join('\n');
 const basename='results/w01-census-api-b-'+proof.request.requestId;
 let created=0,verified=0;
 for(const [ext,data] of [['json',JSON.stringify(value,null,2)+'\n'],
  ['txt',reportTxt]]){
  const url='https://api.github.com/repos/'+CENSUS_B_REPO+
   '/contents/'+basename+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,body:JSON.stringify({
    message:'evidence: W01 Census M3 API-only B result',
    content:Buffer.from(data).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await remoteReadback(fetchApi,url,headers,data))verified++;
 }
 const note='<!-- w01-census-api-b:'+proof.request.requestId+' -->\n'+
  'W01 Census #28 M3 API-only B: '+
  (verified===2?value.status:'STATE_UNKNOWN')+' / '+value.code+
  '; provider calls '+(value.providerCalls??'UNKNOWN')+'/2; stored '+
  (value.stored??'UNKNOWN')+
  '; create '+created+'/2, JSON/TXT readback '+verified+'/2'+
  '; Run '+value.runId+
  '; D1/Task/other inputs unchanged; replay forbidden.\n';
 const ack=await fetchApi('https://api.github.com/repos/'+CENSUS_B_REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:note})});
 need(ack.status===201,'W01_CENSUS_B_REPORT_COMMENT_STOP');
 return {status:verified===2?value.status:'STATE_UNKNOWN',verified,created};
}
async function main(){
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const request=JSON.parse(event.issue?.body??'null');
 need(typeof request?.approvalManifestPath==='string'&&
  /^approvals\/inflation-census-api-b\/[a-z0-9][a-z0-9._-]{0,95}\.json$/.test(
   request.approvalManifestPath),'W01_CENSUS_B_REPORT_MANIFEST_PATH_STOP');
 const bytes=fs.readFileSync(path.join(CONTROL_ROOT,
  ...request.approvalManifestPath.split('/')));
 const proof=authorizeCensusB({event,env,manifestBytes:bytes});
 let raw={};
 try{
  const file=path.join(env.RUNNER_TEMP,'w01-census-api-b-once-result.json');
  const b=fs.readFileSync(file,'utf8');
  if(Buffer.byteLength(b)<=4096)raw=JSON.parse(b);
 }catch{}
 return publishCensusBReceipt({proof,env,event,raw});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const v=await main();
  process.stdout.write('W01_CENSUS_B_RECEIPT '+v.status+' '+v.verified+'/2\n');
  if(v.verified!==2)process.exitCode=1;
 }catch{
  process.stderr.write('W01_CENSUS_B_RECEIPT_UNVERIFIED\n');
  process.exitCode=1;
 }
}
