// W03 stage11: create-only sanitized SHA/date metadata, no ETF scores or raw bars.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,REPO,RESULT} from './w03-r48-private-readback.mjs';
const SH=/^[a-f0-9]{64}$/;
const RUN=/^\d{1,18}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const CODES=new Set(['NO_R48_CANDIDATE','R48_PARENT_PAIR_NOT_FOUND',
 'R48_SOURCE_MANIFEST_CHANGED','R48_STALE_VS_LATEST_R47',
 'R48_CURRENT_PRIVATE_CANDIDATE_SHA_VERIFIED']);
const no=x=>{throw new Error(x);};
function base(req,env){return {schema:RESULT,requestId:req.requestId,
 runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 status:'STATE_UNKNOWN',code:'W03_R48_READBACK_UNVERIFIED',
 candidateCount:null,latestR47Date:null,latest:null,
 rawPagesRehashedNow:false,taskExecutionVerified:false,
 providerCalls:0,sqliteOpened:false,pcWrites:0,d1Writes:0,
 publicationWrites:0,automaticRetries:0};}
export function sanitize(raw,req,env){
 const b=base(req,env);
 if(raw?.schema!==RESULT||raw.requestId!==req.requestId||
  raw.controlSha!==env.GITHUB_SHA||!/^[a-f0-9]{40}$/.test(raw.controlSha??''))
  return b;
 const d=raw.details;
 if(d?.schema!=='ZGMINI_W03_R48_PRIVATE_OBSERVATION_V1'||
  raw.status!==d.status||raw.code!==d.code||
  !['PASS','PARTIAL','NO_R48_CANDIDATE','STOP'].includes(d.status)||
  d.rawPagesRehashedNow!==false||d.taskExecutionVerified!==false||
  d.providerCalls!==0||d.sqliteOpened!==false||
  d.pcWrites!==0||d.d1Writes!==0||d.publicationWrites!==0||
  !Number.isSafeInteger(d.candidateCount)||d.candidateCount<0||
  d.candidateCount>512)return b;
 const head={...b,status:d.status,code:d.code,
  candidateCount:d.candidateCount,
  latestR47Date:d.latestR47Date===null?null:
   DATE.test(d.latestR47Date??'')?d.latestR47Date:null};
 if(d.status==='STOP'){
  if(d.latest!==null||!/^W03_R48_READBACK_[A-Z0-9_]+$/.test(d.code??''))
   return b;
  return head;
 }
 if(d.status==='NO_R48_CANDIDATE'){
  if(d.code!=='NO_R48_CANDIDATE'||d.latest!==null)return b;
  return head;
 }
 if(!CODES.has(d.code)||d.code==='NO_R48_CANDIDATE'||
  (d.status==='PASS')!==(d.code==='R48_CURRENT_PRIVATE_CANDIDATE_SHA_VERIFIED'))
  return b;
 const a=d.latest;
 if(!a||!DATE.test(a.date??'')||!SH.test(a.candidateSha256??'')||
  !Number.isSafeInteger(a.candidateBytes)||a.candidateBytes<1||
  a.candidateBytes>6*1024*1024||a.privateThemes!==9||
  a.privateHistoryRows!==2268||
  typeof a.parentPairMatched!=='boolean'||
  typeof a.currentSourceManifestMatched!=='boolean'||
  typeof a.latestR47DateMatched!=='boolean'||
  (a.r47EtfSha256!==null&&!SH.test(a.r47EtfSha256??''))||
  (a.r47NineSha256!==null&&!SH.test(a.r47NineSha256??''))||
  (a.sourceSummarySha256!==null&&!SH.test(a.sourceSummarySha256??''))||
  (a.completedWindowCount!==null&&(!Number.isSafeInteger(a.completedWindowCount)||
  a.completedWindowCount<0||a.completedWindowCount>200))||
  (a.parentPairMatched!==true&&[a.r47EtfSha256,a.r47NineSha256,
   a.sourceSummarySha256,a.completedWindowCount].some(x=>x!==null)))
  return b;
 return {...head,latest:{date:a.date,candidateSha256:a.candidateSha256,
  candidateBytes:a.candidateBytes,privateThemes:9,privateHistoryRows:2268,
  parentPairMatched:a.parentPairMatched,
  currentSourceManifestMatched:a.currentSourceManifestMatched,
  latestR47DateMatched:a.latestR47DateMatched,
  r47EtfSha256:a.r47EtfSha256,r47NineSha256:a.r47NineSha256,
  sourceSummarySha256:a.sourceSummarySha256,
  completedWindowCount:a.completedWindowCount}};
}
export const asText=x=>[
 'schema='+x.schema,'requestId='+x.requestId,'runId='+(x.runId??''),
 'status='+x.status,'code='+x.code,
 'candidateCount='+(x.candidateCount??''),
 'latestR47Date='+(x.latestR47Date??''),
 'candidateDate='+(x.latest?.date??''),
 'candidateSha256='+(x.latest?.candidateSha256??''),
 'r47EtfSha256='+(x.latest?.r47EtfSha256??''),
 'r47NineSha256='+(x.latest?.r47NineSha256??''),
 'privateHistoryRows='+(x.latest?.privateHistoryRows??''),
 'parentPairMatched='+(x.latest?.parentPairMatched??''),
 'currentSourceManifestMatched='+(x.latest?.currentSourceManifestMatched??''),
 'latestR47DateMatched='+(x.latest?.latestR47DateMatched??''),
 'rawPagesRehashedNow=false','taskExecutionVerified=false',
 'providerCalls=0','pcWrites=0','sqliteOpened=false','d1Writes=0',
 'publicationWrites=0','automaticRetries=0',''
].join('\r\n');
async function fetchApi(url,opts){
 const r=await fetch(url,{...opts,signal:AbortSignal.timeout(20000)});
 const s=await r.text();if(s.length>250000)throw Error('OUT_SIZE');
 let j=null;try{j=JSON.parse(s)}catch{}
 return {status:r.status,body:j};
}
async function verify(url,headers,body,http){
 try{const r=await http(url,{method:'GET',headers});
 return r.status===200&&typeof r.body?.content==='string'&&
  Buffer.from(r.body.content.replace(/\s+/g,''),'base64').equals(Buffer.from(body));
 }catch{return false;}
}
export async function publish({event,env,raw,http=fetchApi}={}){
 const req=authorize(event,env);
 if(!env.GITHUB_TOKEN||!RUN.test(env.GITHUB_RUN_ID??''))no('REPORT_AUTH');
 let data;try{data=JSON.parse(raw)}catch{data=null}
 const report=sanitize(data,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-w03-r48-readback'};
 let created=0,verified=0;
 for(const [ext,body] of [['json',JSON.stringify(report,null,2)+'\n'],
  ['txt',asText(report)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-r48-private-readback-'+req.requestId+'.'+ext;
  try{const x=await http(url,{method:'PUT',headers,body:JSON.stringify({
    message:'evidence: W03 R48 private candidate readback',
    content:Buffer.from(body).toString('base64')})});
   if(x.status===201)created++;
  }catch{}
  if(await verify(url,headers,body,http))verified++;
 }
 const status=verified===2?report.status:'STATE_UNKNOWN';
 const comment='<!-- w03-r48-private-readback:'+req.requestId+' -->\n'+
  'W03 R48 private candidate: '+status+' / '+report.code+
  '; candidateDate '+(report.latest?.date??'UNKNOWN')+
  '; latestR47Date '+(report.latestR47Date??'UNKNOWN')+
  '; parentPairMatched '+(report.latest?.parentPairMatched??'UNKNOWN')+
  '; sourceManifestMatch '+(report.latest?.currentSourceManifestMatched??'UNKNOWN')+
  '; JSON/TXT '+verified+'/2, created '+created+'/2; run '+report.runId+
  '; 0 PC/provider/SQLite/D1/publication writes; no replay.\n';
 const posted=await http('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:comment})});
 if(posted.status!==201)no('REPORT_COMMENT_NOT_PROVEN');
 return {status,verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-r48-readback.json'),'utf8')}catch{}
  const x=await publish({event,env,raw});
  process.stdout.write('REPORT '+x.status+' '+x.verified+'/2\n');
 }catch{process.stderr.write('W03_R48_REPORT_UNVERIFIED_NO_REPLAY\n');
  process.exitCode=1;}
}
