// Create-only sanitized metadata. The reader never receives a GitHub token.
// No private scores, 1h prices, raw JSONL, source files or secrets are uploaded.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,REPO,RESULT_SCHEMA} from './w03-r47-private-readback.mjs';

const STATUS=new Set(['PRIVATE_RESULT_PAIR_AND_MANIFEST_SHA_VERIFIED',
 'PRIVATE_RESULT_SOURCE_MANIFEST_CHANGED','NO_PRIVATE_SHADOW','STOP']);
const HEX=/^[0-9a-f]{64}$/;
const HEX16=/^[0-9a-f]{16}$/;
const SHA40=/^[0-9a-f]{40}$/;
const RUN=/^\d{1,18}$/;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
function base(req,env){return {schema:RESULT_SCHEMA,requestId:req.requestId,
  runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
  status:'STATE_UNKNOWN',code:'W03_R47_READBACK_RESULT_UNVERIFIED',
  candidateCount:null,latest:null,sourceRawPagesRehashedNow:false,
  providerCalls:0,sqliteOpened:false,pcWrites:0,d1Writes:0,
  taskRunVerified:false,executionAuthorized:false,
  retry:'NO_AUTOMATIC_REEXECUTION'};}
export function sanitize(raw,req,env){
 const b=base(req,env);
 if(raw?.schema!==RESULT_SCHEMA||raw.requestId!==req.requestId||
  raw.controlSha!==env.GITHUB_SHA||!SHA40.test(raw.controlSha??'')||
  !STATUS.has(raw.status)||!((raw.status===raw.code&&
   ['PRIVATE_RESULT_PAIR_AND_MANIFEST_SHA_VERIFIED',
    'PRIVATE_RESULT_SOURCE_MANIFEST_CHANGED'].includes(raw.status))||
   (raw.status==='NO_PRIVATE_SHADOW'&&raw.code==='R47_PRIVATE_SHADOW_NOT_FOUND')||
   (raw.status==='STOP'&&/^W03_R47_READBACK_[A-Z0-9_]+$/.test(raw.code??''))))
  return b;
 const a=raw.metadata;
 if(a?.schema!=='ZGMINI_W03_R47_PRIVATE_SHADOW_METADATA_V1'||
  a.status!==raw.status||a.code!==raw.code||
  a.providerCalls!==0||a.sqliteOpened!==false||a.pcWrites!==0||
  a.d1Writes!==0||a.taskRunVerified!==false||
  a.sourceRawPagesRehashedNow!==false||
  !Number.isSafeInteger(a.candidateCount)||a.candidateCount<0||
  a.candidateCount>512)return b;
 const state={...b,status:a.status,code:a.code,candidateCount:a.candidateCount};
 if(a.status==='NO_PRIVATE_SHADOW'||a.status==='STOP'){
  if(a.latest!==null)return b;
  if(a.status==='STOP'&&!/^W03_R47_READBACK_[A-Z0-9_]+$/.test(a.code))
   return b;
  if(a.status==='NO_PRIVATE_SHADOW'&&a.code!=='R47_PRIVATE_SHADOW_NOT_FOUND')
   return b;
  return state;
 }
 const r=a.latest;
 if(!r||r.status!==a.status||!date(r.benchmarkDate)||
  !HEX.test(r.scoreSha256??'')||!HEX.test(r.themeSha256??'')||
  !HEX16.test(r.outputDigest16??'')||
  !Number.isSafeInteger(r.scoreBytes)||r.scoreBytes<1||r.scoreBytes>16*1024*1024||
  !Number.isSafeInteger(r.themeBytes)||r.themeBytes<1||r.themeBytes>8*1024*1024||
  !HEX.test(r.sourceBaselineSha256??'')||
  r.sourceDeltaSha256!==null&&!HEX.test(r.sourceDeltaSha256??'')||
  !Number.isSafeInteger(r.completedWindowCount)||
  r.completedWindowCount<0||r.completedWindowCount>200||
  !Number.isSafeInteger(r.verifiedPageReferencesAtCalculation)||
  r.verifiedPageReferencesAtCalculation<0||
  r.sourceCurrentManifestMatch!==(a.status==='PRIVATE_RESULT_PAIR_AND_MANIFEST_SHA_VERIFIED')||
  r.sourceRawPagesRehashedNow!==false||
  r.providerCalls!==0||r.dbWrites!==0||r.d1Writes!==0||
  r.publicationAuthorized!==false)return b;
 return {...state,latest:{status:r.status,benchmarkDate:r.benchmarkDate,
  scoreSha256:r.scoreSha256,themeSha256:r.themeSha256,
  outputDigest16:r.outputDigest16,
  scoreBytes:r.scoreBytes,themeBytes:r.themeBytes,
  sourceBaselineSha256:r.sourceBaselineSha256,
  sourceDeltaSha256:r.sourceDeltaSha256,
  completedWindowCount:r.completedWindowCount,
  verifiedPageReferencesAtCalculation:r.verifiedPageReferencesAtCalculation,
  sourceCurrentManifestMatch:r.sourceCurrentManifestMatch,
  sourceRawPagesRehashedNow:false}};
}
export function asText(r){return [
 `schema=${r.schema}`,`requestId=${r.requestId}`,`runId=${r.runId??''}`,
 `status=${r.status}`,`code=${r.code}`,
 `candidateCount=${r.candidateCount??''}`,
 `benchmarkDate=${r.latest?.benchmarkDate??''}`,
 `scoreSha256=${r.latest?.scoreSha256??''}`,
 `themeSha256=${r.latest?.themeSha256??''}`,
 `completedWindowCount=${r.latest?.completedWindowCount??''}`,
 `sourceCurrentManifestMatch=${r.latest?.sourceCurrentManifestMatch??''}`,
 'sourceRawPagesRehashedNow=false','taskRunVerified=false',
 'providerCalls=0','sqliteOpened=false','pcWrites=0','d1Writes=0',
 'executionAuthorized=false','retry=NO_AUTOMATIC_REEXECUTION',''
].join('\r\n');}
async function requestHttp(url,options){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 const text=await response.text();if(text.length>250000)throw Error('RESPONSE_TOO_LARGE');
 let body=null;try{body=JSON.parse(text);}catch{}
 return {status:response.status,body};
}
async function readback(url,headers,txt,fetchApi){
 try{const v=await fetchApi(url,{method:'GET',headers});
  return v.status===200&&typeof v.body?.content==='string'&&
    Buffer.from(v.body.content.replace(/\s+/g,''),'base64').equals(Buffer.from(txt));
 }catch{return false;}
}
export async function publish({event,env,raw,fetchApi=requestHttp}={}){
 const r=authorize(event,env);
 let parsed=null;try{parsed=JSON.parse(raw)}catch{}
 const report=sanitize(parsed,r,env);
 const headers={accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,
   'x-github-api-version':'2022-11-28',
   'content-type':'application/json',
   'user-agent':'zgmini-w03-r47-private-result-readback'};
 if(!env.GITHUB_TOKEN||!RUN.test(env.GITHUB_RUN_ID??''))
  throw Error('W03_R47_READBACK_REPORT_TOKEN_STOP');
 let stored=0,verified=0;
 for(const [ext,txt] of [['json',JSON.stringify(report,null,2)+'\n'],
  ['txt',asText(report)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-r47-private-readback-'+r.requestId+'.'+ext;
  try{const p=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: W03 R47 private result metadata readback',
      content:Buffer.from(txt).toString('base64')})});
   if(p.status===201)stored++;}catch{}
  if(await readback(url,headers,txt,fetchApi))verified++;
 }
 const status=verified===2?report.status:'STATE_UNKNOWN';
 const comment='<!-- w03-r47-private-readback:'+r.requestId+' -->\n'+
  'W03 R47 private result pair: '+status+' / '+report.code+
  '; last NY date '+(report.latest?.benchmarkDate??'UNKNOWN')+
  '; sourceManifestMatch '+(report.latest?.sourceCurrentManifestMatch??'UNKNOWN')+
  '; pairFileSha readback '+(report.latest?'2/2':'0/2')+
  '; rawPagesRehashedNow=false, actual R47 Task execution separately verified only;'+
  ' JSON/TXT '+verified+'/2; created '+stored+'/2; run '+report.runId+
  '; provider/PC/D1 writes 0; no replay.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
    body:JSON.stringify({body:comment})});
 if(posted.status!==201)throw Error('W03_R47_READBACK_REPORT_COMMENT_STOP');
 return {status,verified,stored};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
    'w03-r47-private-readback-result.json'),'utf8');}catch{}
  const result=await publish({event,env,raw});
  process.stdout.write(result.status+' '+result.verified+'/2\n');
 }catch{process.stderr.write('W03_R47_READBACK_REPORT_UNVERIFIED_NO_REPLAY\n');
  process.exitCode=1;}
}
