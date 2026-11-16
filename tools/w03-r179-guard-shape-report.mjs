// Create-only redacted R179 source-operator receipt (no protected source content).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authenticate,OUTPUT,REPO,PIN} from './w03-r179-guard-shape-readonly.mjs';
const RUN=/^\d{1,18}$/;
const SHA40=/^[a-f0-9]{40}$/;
const CODE=/^W03_R179_SHAPE_[A-Z0-9_]{3,100}$/;
const TAGS=new Set(['ROLLING_MISMATCH','JSON_STRINGIFY','JSON_PARSE',
 'THEME_IDENTIFIER','ROLLING_IDENTIFIER','OBSERVED_DATE_IDENTIFIER',
 'OBSERVATION_DATE_IDENTIFIER','GOT_IDENTIFIER','LENGTH_ACCESS',
 'IF_BRANCH','THROW_BRANCH']);
const OPERATORS=new Set(['===','!==','==','!=','>=','<=','>','<']);
const NAMES=new Set(['GOT','THEMES','ROWS','ITEMS','DATA','PUBLIC_THEMES',
 'RESPONSE','RESULT','PAYLOAD','PUBLIC_RESULT','OTHER']);
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(condition,code)=>{if(!condition)stop(code);};
const line=n=>Number.isInteger(n)&&n>=1&&n<=1499;
const base=(req,env)=>({schema:OUTPUT,status:'STATE_UNKNOWN',
 code:'W03_R179_SHAPE_UNVERIFIED',requestId:req.requestId,
 runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 payload:null,sourceOnly:true,providerCalls:0,pcWrites:0,
 d1Writes:0,retry:'NO_AUTOMATIC_REEXECUTION'});
export function sanitize(raw,req,env){
 const out=base(req,env);
 if(raw?.schema!==OUTPUT||![req.requestId,null].includes(raw.requestId))return out;
 if(raw.status==='STOP'&&CODE.test(raw.code??''))
  return {...out,status:'STOP',code:raw.code};
 if(raw.status!=='PASS'||raw.requestId!==req.requestId||
  raw.controlSourceSha!==req.controlSourceSha||
  raw.code!=='W03_R179_GUARD_SHAPE_READONLY')return out;
 const a=raw.payload;
 if(a?.schema!=='ZGMINI_W03_R179_GUARD_SHAPE_PAYLOAD_V1'||
  a.result!=='STATIC_SOURCE_PINNED'||a.sourceBytes!==10822||
  a.sourceSha256!==PIN||!SHA40.test(raw.controlSourceSha??'')||
  a.sourceOnly!==true||a.providerCalls!==0||
  a.sqliteOpened!==false||a.sqliteWrites!==0||
  a.publisherExecuted!==false||a.pcWrites!==0||a.d1Writes!==0||
  !Number.isInteger(a.exactOldCount)||a.exactOldCount<0||a.exactOldCount>300||
  !Number.isInteger(a.comparisonCount)||a.comparisonCount<0||
  a.comparisonCount>60||!Number.isInteger(a.rollingMarkerCount)||
  a.rollingMarkerCount<0||a.rollingMarkerCount>50||
  !Array.isArray(a.oldMatches)||a.oldMatches.length>20||
  !a.oldMatches.every(x=>line(x.line)&&typeof x.nearRollingMarker==='boolean')||
  !Array.isArray(a.comparisons)||a.comparisons.length!==a.comparisonCount||
  !a.comparisons.every(x=>line(x.line)&&NAMES.has(x.nameClass)&&
    OPERATORS.has(x.operator)&&
    (x.count==='OTHER'||[7,10,13,14].includes(x.count))&&
    typeof x.nearRollingMarker==='boolean')||
  !Array.isArray(a.context)||a.context.length>6||
  !a.context.every(x=>line(x.markerLine)&&Array.isArray(x.signals)&&
   x.signals.length<=30&&x.signals.every(s=>line(s.line)&&
    Array.isArray(s.tags)&&s.tags.length<=11&&
    s.tags.every(tag=>TAGS.has(tag)))))return out;
 const payload={
  result:'STATIC_SOURCE_PINNED',sourceBytes:10822,sourceSha256:PIN,
  exactOldCount:a.exactOldCount,
  oldMatches:a.oldMatches.map(x=>({line:x.line,nearRollingMarker:x.nearRollingMarker})),
  comparisonCount:a.comparisonCount,
  comparisons:a.comparisons.map(x=>({line:x.line,nameClass:x.nameClass,
   operator:x.operator,count:x.count,nearRollingMarker:x.nearRollingMarker})),
  rollingMarkerCount:a.rollingMarkerCount,
  context:a.context.map(x=>({markerLine:x.markerLine,
   signals:x.signals.map(y=>({line:y.line,tags:[...y.tags]}))})),
  sourceOnly:true,providerCalls:0,sqliteOpened:false,
  sqliteWrites:0,publisherExecuted:false,pcWrites:0,d1Writes:0
 };
 return {...out,status:'PASS',code:'W03_R179_GUARD_SHAPE_READONLY',
  payload};
}
async function verifiedReadback(fetchApi,url,headers,contents){
 try{const res=await fetchApi(url+'?ref=main',{headers});
  if(res.status!==200)return false;
  const value=await res.json();
  return value.encoding==='base64'&&typeof value.content==='string'&&
   Buffer.from(value.content.replace(/\s/g,''),'base64').equals(Buffer.from(contents));
 }catch{return false;}
}
export async function publish({event,env,raw,fetchApi=fetch}){
 const req=authenticate(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'W03_R179_SHAPE_REPORT_AUTH_STOP');
 let source=null;
 try{source=typeof raw==='string'&&Buffer.byteLength(raw)<=20000?
  JSON.parse(raw):null;}catch{}
 const report=sanitize(source,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-w03-r179-guard-shape'};
 let created=0,readback=0;
 const txt=['REQUEST_ID='+req.requestId,'STATUS='+report.status,
  'CODE='+report.code,'RUN_ID='+(report.runId??'UNKNOWN'),
  'SAFE_SHAPE='+JSON.stringify(report.payload),
  'ORIGINAL_SOURCE_EXPOSED=false','PC_WRITES=0','D1_WRITES=0','PROVIDER_CALLS=0',
  'RETRY=NO_AUTOMATIC_REEXECUTION',''].join('\n');
 for(const [ext,contents] of [['json',JSON.stringify(report,null,2)+'\n'],['txt',txt]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-r179-guard-shape-'+req.requestId+'.'+ext;
  try{
   const result=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: R179 pinned mismatch operator shape',
     content:Buffer.from(contents).toString('base64')})});
   if(result.status===201)created++;
  }catch{}
  if(await verifiedReadback(fetchApi,url,headers,contents))readback++;
 }
 const status=readback===2?report.status:'STATE_UNKNOWN';
 const note='<!-- w03-r179-guard-shape:'+req.requestId+' -->\n'+
  'R179 source shape '+status+' / '+report.code+
  '; JSON/TXT '+readback+'/2; created '+created+'/2; run '+report.runId+
  '; PC/SQLite/D1/Provider writes 0; no replay.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:note})});
 need(posted.status===201,'W03_R179_SHAPE_REPORT_POST_STOP');
 return {status,readback,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-r179-guard-shape-result.json'),'utf8');}catch{}
  const out=await publish({event,env,raw});
  process.stdout.write(out.status+' '+out.readback+'/2\n');
 }catch{process.stderr.write('W03_R179_SHAPE_RESULT_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;}
}