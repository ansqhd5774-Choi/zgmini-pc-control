// CNN #1521: fixed, read-only SQLite->D1->public GET evidence for 1D/1W.
// No supplier access, arbitrary SQL, writes, deployment, or raw payload in receipts.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {inspectFearGreedArchive} from './fear-greed-archive-readonly.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';

export const CNN_PUBLIC_OPERATION='cnn-public-d1-api-readback-readonly';
const SQL="SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key=? LIMIT 1";
const FEEDS=Object.freeze([
 ['observed','fear-greed-observed','CNN_OBSERVED_ARCHIVE_R1','observations','observedAt'],
 ['checks','fear-greed-verified-checks','CNN_VERIFIED_CHECKS_R1','checks','checkedAt']
]);
const PERIODS=Object.freeze(['1D','1W']);
const URLS=Object.freeze({
 '1D':'https://zgmini.kr/api/fear-greed/observations?period=1D',
 '1W':'https://zgmini.kr/api/fear-greed/observations?period=1W'
});
const MAX=750000, SHA40=/^[a-f0-9]{40}$/;
const iso=t=>typeof t==='string'&&Number.isFinite(Date.parse(t))&&
 new Date(t).toISOString()===t;
const score=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const stamp=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
const hash=text=>createHash('sha256').update(text).digest('hex');
const base=code=>({status:'STATE_UNKNOWN',code,
 local:{status:'NOT_CHECKED'},d1:{status:'NOT_CHECKED'},api:{status:'NOT_CHECKED'},
 sameDayMatched:false,publicPeriodsMatched:false,providerCalls:0,d1Writes:0,
 operationalWrites:0,sqliteOpened:false});
function summarizeFeed(raw,kind,day){
 if(!raw)return {status:'MISSING',count:0,lastAt:null,storedAt:null,hash:null,points:[]};
 const [,key,version,field,timeKey]=FEEDS.find(x=>x[0]===kind);
 if(typeof raw.body!=='string'||Buffer.byteLength(raw.body,'utf8')>MAX)
  return {status:'INVALID',count:0,lastAt:null,storedAt:null,hash:null,points:[]};
 let body;try{body=JSON.parse(raw.body)}catch{return {status:'INVALID',count:0,lastAt:null,storedAt:null,hash:null,points:[]};}
 if(body?.version!==version||body?.date!==day||!Array.isArray(body[field])||
    body[field].length>1500)return {status:'INVALID',count:0,lastAt:null,storedAt:null,hash:null,points:[]};
 const points=[];const seen=new Set();
 for(const p of body[field]){
  const at=p?.[timeKey];
  if(!iso(at)||at.slice(0,10)!==day||!score(p?.score)||seen.has(at))
   return {status:'INVALID',count:0,lastAt:null,storedAt:null,hash:null,points:[]};
  if(kind==='checks'&&(!iso(p?.sourceObservedAt)||Date.parse(p.sourceObservedAt)>Date.parse(at)+300000||
     p.sourceStoredAt!==Date.parse(at)))
   return {status:'INVALID',count:0,lastAt:null,storedAt:null,hash:null,points:[]};
  seen.add(at);points.push(kind==='checks'?
    {checkedAt:at,sourceObservedAt:p.sourceObservedAt,score:p.score}:
    {observedAt:at,score:p.score});
 }
 points.sort((a,b)=>a[timeKey].localeCompare(b[timeKey]));
 return {status:'READ',count:points.length,lastAt:points.at(-1)?.[timeKey]??null,
  storedAt:stamp(raw.stored_at),hash:hash(raw.body),points};
}
const digest=(points,field,day)=>JSON.stringify(points.filter(p=>iso(p?.[field])&&p[field].slice(0,10)===day)
 .map(p=>field==='checkedAt'?{checkedAt:p.checkedAt,sourceObservedAt:p.sourceObservedAt,score:p.score}:
  {observedAt:p.observedAt,score:p.score}).sort((a,b)=>a[field].localeCompare(b[field])));
export function compareCnnPublicReadback(local,rows,replies,{day}={}){
 const out=base('CNN_PUBLIC_READBACK_UNVERIFIED'),localRows=local?.local;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day??'')||!localRows||localRows.status!=='READ')
  return {...out,code:'CNN_LOCAL_SQLITE_UNVERIFIED'};
 const observed=localRows.original?.recentDates?.find(x=>x.date===day);
 const checked=localRows.checks?.recentDates?.find(x=>x.date===day);
 if(!observed||!checked)return {...out,code:'CNN_LOCAL_DAY_INCOMPLETE',
  local:{status:'DAY_INCOMPLETE',date:day},sqliteOpened:true};
 const d1observed=summarizeFeed(rows?.observed,'observed',day);
 const d1checks=summarizeFeed(rows?.checks,'checks',day);
 const sourceSame=d1observed.status==='READ'&&d1observed.count===observed.count&&
  d1observed.lastAt===observed.lastAt;
 const checkSame=d1checks.status==='READ'&&d1checks.count===checked.count&&
  d1checks.lastAt===checked.lastAt;
 // Current source score must agree if the latest local original has that observedAt.
 const cur=localRows.currentPublic;
 const scoreSame=cur?.observedAt!==observed.lastAt||
  (d1observed.points.at(-1)?.score===cur?.score);
 const localMatched=sourceSame&&checkSame&&scoreSame;
 const d1={status:localMatched?'MATCHED':
    d1observed.status==='MISSING'||d1checks.status==='MISSING'?'MISSING_OR_LAG':
    d1observed.status==='INVALID'||d1checks.status==='INVALID'?'INVALID':'MISMATCH',
  date:day,observedCount:d1observed.count,checkedCount:d1checks.count,
  lastObservedAt:d1observed.lastAt,lastCheckedAt:d1checks.lastAt,
  observedStoredAt:d1observed.storedAt,checkedStoredAt:d1checks.storedAt,
  observedBodySha256:d1observed.hash,checkedBodySha256:d1checks.hash};
 const api={status:'NOT_CHECKED',periods:{}};
 for(const period of PERIODS){
  const response=replies?.[period];
  const actual=response?.body,valid=response?.httpStatus===200&&
   actual?.period===period&&Array.isArray(actual.points)&&Array.isArray(actual.checkedPoints);
  const observedMatch=valid&&d1observed.status==='READ'&&
   digest(actual.points,'observedAt',day)===digest(d1observed.points,'observedAt',day);
  const checksMatch=valid&&d1checks.status==='READ'&&
   digest(actual.checkedPoints,'checkedAt',day)===digest(d1checks.points,'checkedAt',day);
  api.periods[period]={httpStatus:response?.httpStatus??null,
   status:observedMatch&&checksMatch?'MATCHED':
    response?.httpStatus!==200?'UNAVAILABLE':'MISMATCH_OR_UNVERIFIED',
   observedMatch:Boolean(observedMatch),checksMatch:Boolean(checksMatch)};
 }
 const publicMatched=PERIODS.every(p=>api.periods[p].status==='MATCHED');
 api.status=publicMatched?'MATCHED':'PARTIAL_OR_UNVERIFIED';
 const all=localMatched&&publicMatched;
 return {...out,status:all?'PASS':'STATE_UNKNOWN',
  code:all?'CNN_SQLITE_D1_API_1D_1W_MATCHED':
   !localMatched?'CNN_D1_LOCAL_NOT_MATCHED':'CNN_PUBLIC_API_NOT_MATCHED',
  local:{status:'READ',date:day,observedCount:observed.count,checkedCount:checked.count,
   lastObservedAt:observed.lastAt,lastCheckedAt:checked.lastAt,
   currentScore:cur?.observedAt===observed.lastAt?cur.score:null},
  d1,api,sameDayMatched:localMatched,publicPeriodsMatched:publicMatched,
  sqliteOpened:true};
}
async function readD1(dataRoot,fileSystem,day){
 const cfg=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer','config.json'),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!cfg.ok)throw Error('CNN_CONFIG_MISSING');
 const c=JSON.parse(cfg.bytes.toString('utf8'));
 if(!SHA40.test(c?.source??'')||!/^\w{32}$/.test(c?.account??'')||
  !/^[a-f0-9-]{36}$/.test(c?.core??''))throw Error('CNN_CONFIG_INVALID');
 const checkout=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
 const root=(fileSystem.realpathSync.native??fileSystem.realpathSync)(checkout);
 const gitBin=selectR6GitBinary({exists:fileSystem.existsSync});
 if(!gitBin)throw Error('CNN_GIT_MISSING');
 const git=args=>execFileSync(gitBin,
  ['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',root,...args],
  {encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
   stdio:['ignore','pipe','ignore']}).trim();
 if(git(['rev-parse','HEAD'])!==c.source)throw Error('CNN_SOURCE_MISMATCH');
 for(const p of ['scripts/pc-writer/d1.mjs','scripts/pc-writer/d1-transient.mjs',
  'scripts/pc-writer/d1-diagnostics.mjs']){
  git(['ls-files','--error-unmatch','--',p]);git(['diff','--quiet','HEAD','--',p]);
  const f=path.join(root,...p.split('/')),s=fileSystem.lstatSync(f);
  if(!s.isFile()||s.isSymbolicLink())throw Error('CNN_SOURCE_FILE_INVALID');
 }
 const {client,credential}=await import(pathToFileURL(path.join(root,'scripts','pc-writer','d1.mjs')).href);
 const remote=client(c,()=>credential(root)),result={};
 for(const [kind,feed] of FEEDS)
  result[kind]=(await remote.query(c.core,SQL,[feed,day])).results?.[0]??null;
 return result;
}
async function readApi(period,fetcher=fetch){
 const response=await fetcher(URLS[period],{method:'GET',redirect:'error',
  headers:{accept:'application/json','cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
 const httpStatus=response.status;
 if(!response.ok||Number(response.headers.get('content-length')??'0')>MAX||!response.body)
  return {httpStatus,body:null};
 const reader=response.body.getReader(),parts=[];let n=0;
 try{while(n<=MAX){const {done,value}=await reader.read();if(done)break;
  n+=value.byteLength;if(n>MAX)break;parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 if(n>MAX)return {httpStatus,body:null};
 try{return {httpStatus,body:JSON.parse(Buffer.concat(parts).toString('utf8'))};}
 catch{return {httpStatus,body:null};}
}
export async function inspectCnnPublicReadback(dataRoot,{
 localProbe=inspectFearGreedArchive,queryFixed=null,fetchFixed=null,fileSystem=fs
}={}){
 const out=base('CNN_PUBLIC_READBACK_UNVERIFIED');
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return {...out,code:'CNN_DATA_ROOT_INVALID'};
 let local;
 try{local=localProbe(dataRoot)}catch{return {...out,code:'CNN_LOCAL_READ_UNVERIFIED'};}
 const current=local?.local?.currentPublic;
 if(!iso(current?.observedAt))return {...out,code:'CNN_CURRENT_SOURCE_UNVERIFIED'};
 const day=current.observedAt.slice(0,10);
 // Fixed 1D/1W windows only; source dates outside both are reported stale.
 if(Date.now()-Date.parse(current.observedAt)>2*86400000)
  return {...out,code:'CNN_CURRENT_STALE_FOR_1D',local:{status:'STALE',date:day}};
 let rows;
 try{rows=queryFixed?await queryFixed(day):await readD1(dataRoot,fileSystem,day);}
 catch{return {...out,code:'CNN_APPROVED_D1_READ_UNVERIFIED',
  sqliteOpened:local?.sqliteOpened===true};}
 const replies={};
 for(const period of PERIODS){
  try{replies[period]=fetchFixed?await fetchFixed(period):await readApi(period);}
  catch{replies[period]={httpStatus:null,body:null};}
 }
 return compareCnnPublicReadback(local,rows,replies,{day});
}
