// W03 12/68: only whitelisted R51 stored dates/counts/SHAs are posted.
// No private scores or raw source data are exported.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,REPO,RESULT} from './w03-r51-stored-date-readback.mjs';
const HEX=/^[a-f0-9]{64}$/;
const DATE=/^20\d\d-\d\d-\d\d$/;
const RUN=/^\d{1,18}$/;
const codes=new Set(['R51_SAVED_R48_SHA_LINK_VERIFIED','R51_R48_SOURCE_NOT_FOUND','NO_R51_CANDIDATE']);
export function sanitize(raw,req,env){
 const safe={schema:RESULT,requestId:req.requestId,runId:
   RUN.test(env.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
   status:'STATE_UNKNOWN',code:'R51_REMOTE_UNVERIFIED',
   candidateCount:null,latest:null,publicCurrentDateVerified:false,
   providerCalls:0,publicGets:0,sqliteOpened:false,pcWrites:0,
   d1Writes:0,publicationWrites:0,rawPagesRehashedNow:false,
   taskExecutionVerified:false,retry:'NO_AUTOMATIC_REPLAY'};
 const m=raw?.metadata;
 if(raw?.schema!==RESULT||raw?.requestId!==req.requestId||
  raw?.controlSha!==env.GITHUB_SHA||!/^[a-f0-9]{40}$/.test(raw.controlSha??'')||
  m?.schema!=='ZGMINI_W03_R51_SAVED_PRIVATE_METADATA_V1'||
  raw.status!==m.status||raw.code!==m.code||
  !Number.isSafeInteger(m.candidateCount)||m.candidateCount<0||
  m.candidateCount>512||m.providerCalls!==0||m.publicGets!==0||
  m.sqliteOpened!==false||m.pcWrites!==0||m.d1Writes!==0||
  m.publicationWrites!==0||m.rawPagesRehashedNow!==false||
  m.taskExecutionVerified!==false)return safe;
 if(raw.status==='STOP'){
  if(m.latest!==null||!/^W03_R51_READBACK_[A-Z0-9_]+$/.test(raw.code??''))
   return safe;
  return {...safe,status:'STOP',code:raw.code,candidateCount:m.candidateCount};
 }
 if(raw.status==='NO_R51_CANDIDATE'){
  if(raw.code!=='NO_R51_CANDIDATE'||m.latest!==null)return safe;
  return {...safe,status:'NO_R51_CANDIDATE',code:raw.code,
   candidateCount:m.candidateCount};
 }
 const v=m.latest;
 if(!['PASS','PARTIAL'].includes(raw.status)||!codes.has(raw.code)||
  !v||!DATE.test(v.confirmedDate??'')||!DATE.test(v.provisionalEndDate??'')||
  !HEX.test(v.candidateSha256??'')||
  !Number.isSafeInteger(v.candidateBytes)||v.candidateBytes<1||
  v.candidateBytes>6*1048576||
  !Number.isSafeInteger(v.provisionalDateCount)||
  v.provisionalDateCount<1||v.provisionalDateCount>32||
  v.confirmedThemeCount!==9||v.confirmedHistoryRows!==2268||
  !['PUBLIC_LEGACY_AS_IS','R32_DATED'].includes(v.provisionalMode)||
  typeof v.parentR48Matched!=='boolean'||
  v.currentPublicDateVerified!==false||
  (v.parentR48Sha256!==null&&!HEX.test(v.parentR48Sha256??''))||
  (raw.status==='PASS')!==(v.parentR48Matched===true)||
  (raw.status==='PASS')!==(raw.code==='R51_SAVED_R48_SHA_LINK_VERIFIED'))
  return safe;
 return {...safe,status:raw.status,code:raw.code,candidateCount:m.candidateCount,
  latest:{confirmedDate:v.confirmedDate,provisionalEndDate:v.provisionalEndDate,
   candidateSha256:v.candidateSha256,candidateBytes:v.candidateBytes,
   provisionalDateCount:v.provisionalDateCount,
   confirmedThemeCount:9,confirmedHistoryRows:2268,
   provisionalMode:v.provisionalMode,parentR48Matched:v.parentR48Matched,
   parentR48Sha256:v.parentR48Sha256}};
}
export const asText=r=>[
 'schema='+r.schema,'requestId='+r.requestId,'runId='+(r.runId??''),
 'status='+r.status,'code='+r.code,'candidateCount='+(r.candidateCount??''),
 'confirmedDate='+(r.latest?.confirmedDate??''),
 'provisionalEndDate='+(r.latest?.provisionalEndDate??''),
 'candidateSha256='+(r.latest?.candidateSha256??''),
 'parentR48Sha256='+(r.latest?.parentR48Sha256??''),
 'provisionalMode='+(r.latest?.provisionalMode??''),
 'parentR48Matched='+(r.latest?.parentR48Matched??''),
 'publicCurrentDateVerified=false','providerCalls=0','publicGets=0',
 'pcWrites=0','sqliteOpened=false','d1Writes=0','publicationWrites=0',
 'rawPagesRehashedNow=false','taskExecutionVerified=false',
 'retry=NO_AUTOMATIC_REPLAY',''
].join('\r\n');
async function http(url,opts){
 const response=await fetch(url,{...opts,signal:AbortSignal.timeout(20000)});
 const t=await response.text();
 if(t.length>250000)throw Error('REPORT_RESPONSE_TOO_LARGE');
 let b=null;try{b=JSON.parse(t)}catch{}
 return {status:response.status,body:b};
}
async function verify(url,headers,payload,fetcher){
 try{const r=await fetcher(url,{method:'GET',headers});
  return r.status===200&&typeof r.body?.content==='string'&&
   Buffer.from(r.body.content.replace(/\s+/g,''),'base64').equals(Buffer.from(payload))
 }catch{return false}
}
export async function publish({event,env,raw,fetcher=http}={}){
 const req=authorize(event,env);
 if(!env.GITHUB_TOKEN||!RUN.test(env.GITHUB_RUN_ID??''))throw Error('REPORT_TOKEN_STOP');
 let result;try{result=JSON.parse(raw)}catch{result=null}
 const report=sanitize(result,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-w03-r51-readback'};
 let created=0,verified=0;
 for(const [ext,payload] of [['json',JSON.stringify(report,null,2)+'\n'],
  ['txt',asText(report)]]){
  const url='https://api.github.com/repos/'+REPO+'/contents/results/w03-r51-readback-'+
    req.requestId+'.'+ext;
  try{const p=await fetcher(url,{method:'PUT',headers,body:JSON.stringify({
   message:'evidence: W03 R51 private stored date readback',
   content:Buffer.from(payload).toString('base64')})});
   if(p.status===201)created++
  }catch{}
  if(await verify(url,headers,payload,fetcher))verified++
 }
 const status=verified===2?report.status:'STATE_UNKNOWN';
 const comment='<!-- w03-r51-readback:'+req.requestId+' -->\n'+
  'W03 R51 private dates: '+status+' / '+report.code+
  '; confirmed '+(report.latest?.confirmedDate??'UNKNOWN')+
  '; provisionalEnd '+(report.latest?.provisionalEndDate??'UNKNOWN')+
  '; parentR48Matched '+(report.latest?.parentR48Matched??'UNKNOWN')+
  '; JSON/TXT '+verified+'/2 created '+created+'/2; run '+report.runId+
  '; live public date verified separately=false; PC/API/DB writes 0; no replay.\n';
 const posted=await fetcher('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:comment})});
 if(posted.status!==201)throw Error('COMMENT_NOT_PROVEN');
 return {status,verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-r51-readback.json'),'utf8')}catch{}
  const r=await publish({event,env,raw});
  process.stdout.write('R51_REPORTED '+r.status+' '+r.verified+'/2\n')
 }catch{process.stderr.write('R51_REMOTE_REPORT_UNVERIFIED_NO_REPLAY\n');
  process.exitCode=1}
}
