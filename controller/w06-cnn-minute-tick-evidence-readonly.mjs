// Fixed W06 Task timing context. Read local SQLite and TaskScheduler events
// only; no Task registration, provider requests, process command-line output,
// SQLite mutation, D1 query/write, log-channel enablement or synthetic ticks.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {TextDecoder} from 'node:util';

const DB=String.raw`E:\ZGmini\data\pc-writer\storage\core.sqlite`;
const CHANNEL='Microsoft-Windows-TaskScheduler/Operational';
const TASK='\\ZGMINI-PC-CNN-Minute';
const SQL="SELECT kind,stored_at,CASE WHEN kind='attempt' THEN substr(body,1,4096) ELSE NULL END AS attempt_body FROM public_feed_snapshots_v1 WHERE feed_key='fear-greed' AND snapshot_key='current' AND kind IN ('output','attempt') LIMIT 2";
const INTERVAL=60000;
const stamp=n=>Number.isSafeInteger(n)&&n>=946684800000&&n<=8640000000000000;
const iso=n=>stamp(n)?new Date(n).toISOString():null;
const exactIso=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s)&&
 Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const gateBase=(code,status='UNVERIFIED')=>({
 status,code,meaning:'ONE_FUTURE_NOMINAL_TICK_SNAPSHOT_NOT_HISTORIC_SKIP_PROOF',
 nextRunUtc:null,lastOutputStoredAt:null,lastAttemptStoredAt:null,
 lastRetryAt:null,predictedGate:'UNVERIFIED',millisecondsUntilEligible:null,
 sqliteOpened:null,providerCalls:0,sqliteWrites:0,d1Writes:0,taskChanges:0
});
export function classifyW06NextTickGate(rows,{nextRunUtc,observedAtMs}={}){
 const result=gateBase('CNN_NEXT_TICK_PREIMAGE_UNVERIFIED');
 if(!exactIso(nextRunUtc)||!stamp(observedAtMs)||!Array.isArray(rows)||rows.length>2)
  return result;
 const next=Date.parse(nextRunUtc);
 // A scheduler time that passed before the SQLite snapshot is not a prediction.
 if(next<observedAtMs||next>observedAtMs+3600000)
  return {...result,code:'CNN_NEXT_TICK_TIME_UNVERIFIED',nextRunUtc};
 let output=null,attempt=null,retry=null;
 const seen=new Set();
 try{
  for(const row of rows){
   if(!row||!['output','attempt'].includes(row.kind)||seen.has(row.kind)||
    !stamp(row.stored_at)||row.stored_at>observedAtMs+5000)
    throw Error('BAD_ROW');
   seen.add(row.kind);
   if(row.kind==='output')output=row.stored_at;
   else{
    attempt=row.stored_at;
    if(typeof row.attempt_body!=='string'||row.attempt_body.length>4096)
     throw Error('BAD_ATTEMPT');
    const body=JSON.parse(row.attempt_body);
    if(body?.status!=='ATTEMPTED'||(body.retryAt!==undefined&&!stamp(body.retryAt)))
     throw Error('BAD_ATTEMPT');
    retry=body.retryAt??null;
   }
  }
 }catch{return {...result,code:'CNN_NEXT_TICK_ROWS_UNVERIFIED',nextRunUtc}}
 let gate='ELIGIBLE',until=0;
 if(output!==null&&next>=output&&next-output<INTERVAL){
  gate='CACHED';until=INTERVAL-(next-output);
 }else if(retry!==null&&retry>next){
  gate='COOLDOWN_RETRY_AFTER';until=retry-next;
 }else if(attempt!==null&&next>=attempt&&next-attempt<INTERVAL){
  gate='COOLDOWN_LAST_ATTEMPT';until=INTERVAL-(next-attempt);
 }else if(output!==null&&output>next||attempt!==null&&attempt>next){
  gate='UNVERIFIED';until=null;
 }
 return {...result,status:'READ',
  code:'CNN_NEXT_TICK_FIXED_GATE_READ',nextRunUtc,
  lastOutputStoredAt:iso(output),lastAttemptStoredAt:iso(attempt),
  lastRetryAt:iso(retry),predictedGate:gate,
  millisecondsUntilEligible:until};
}
export function inspectW06NextTickGateReadonly(nextRunUtc,{
 filesystem=fs,connect=(p,options)=>new DatabaseSync(p,options),
 clock=Date.now
}={}){
 const unread=code=>({...gateBase(code),sqliteOpened:false});
 let db;
 try{
  const stat=filesystem.lstatSync(DB);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1)
   return unread('CNN_MINUTE_DB_UNSAFE');
  db=connect(DB,{readOnly:true,timeout:1000});
  db.exec('PRAGMA query_only=ON');
  const rows=db.prepare(SQL).all();
  const projected=classifyW06NextTickGate(rows,{
   nextRunUtc,observedAtMs:clock()});
  return {...projected,sqliteOpened:true};
 }catch{return unread('CNN_NEXT_TICK_DB_READ_UNVERIFIED')}
 finally{try{db?.close()}catch{}}
}

const eventsBase=(code,status='UNVERIFIED')=>({
 status,code,channelEnabled:null,recent90mIgnoredLaunches:null,
 latestIgnoredAt:null,eventsExamined:null,
 eventMeaning:'SCHEDULER_EVENT322_IF_ENABLED_NOT_COLLECTOR_OUTCOME',
 operationalWrites:0,providerCalls:0,sqliteWrites:0,d1Writes:0
});
export function projectW06Event322Readonly(raw,{nowMs}={}){
 const out=eventsBase('CNN_TASK_EVENT322_UNVERIFIED');
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>280000||
  !stamp(nowMs))return out;
 const events=[...raw.matchAll(/<Event(?:\s[^>]*)?>([\s\S]*?)<\/Event>/g)];
 if(events.length>64)return out;
 let count=0,latest=null;
 for(const [,body] of events){
  if(!/<EventID(?:\s[^>]*)?>322<\/EventID>/.test(body))continue;
  const task=/<Data\s+Name="TaskName">([^<]{1,150})<\/Data>/.exec(body)?.[1];
  const time=/<TimeCreated\s+SystemTime="([^"]{1,60})"/.exec(body)?.[1];
  if(task!==TASK||!exactIso(time))continue;
  const when=Date.parse(time);
  if(when<nowMs-90*60000||when>nowMs+300000)continue;
  count++;latest=Math.max(latest??0,when);
 }
 return {...out,status:'READ',code:'CNN_TASK_EVENT322_FIXED_READ',
  channelEnabled:true,recent90mIgnoredLaunches:count,
  latestIgnoredAt:iso(latest),eventsExamined:events.length};
}
function decodeXml(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>300000)throw Error('XML_INVALID');
 const utf16le=bytes.length>=2&&bytes[0]===255&&bytes[1]===254;
 const utf16be=bytes.length>=2&&bytes[0]===254&&bytes[1]===255;
 const decoded=new TextDecoder(utf16le?'utf-16le':
  utf16be?'utf-16be':'utf-8',{fatal:true}).decode(bytes);
 if(decoded.includes('\0'))throw Error('XML_ENCODING_INVALID');
 return decoded;
}
export function inspectW06TaskEventsReadonly({
 platform=process.platform,systemRoot=process.env.SystemRoot||String.raw`C:\Windows`,
 filesystem=fs,run=spawnSync,clock=Date.now
}={}){
 if(platform!=='win32'||!/^[a-z]:[\\/]windows$/i.test(systemRoot))
  return eventsBase('CNN_TASK_EVENT_WINDOWS_SCOPE_STOP');
 const bin=path.win32.join(systemRoot,'System32','wevtutil.exe');
 if(!filesystem.existsSync(bin))return eventsBase('CNN_TASK_EVENT_READER_MISSING');
 const call=(args,maxBuffer=16384)=>{
  const result=run(bin,args,{shell:false,windowsHide:true,
   timeout:9000,maxBuffer,encoding:null});
  if(result?.error||result?.status!==0||!Buffer.isBuffer(result.stdout))
   throw Error('WEVTUTIL_UNAVAILABLE');
  return decodeXml(result.stdout);
 };
 try{
  const config=call(['gl',CHANNEL]);
  const state=[...config.matchAll(/^\s*enabled\s*:\s*(true|false)\s*$/gim)];
  if(state.length!==1)return eventsBase('CNN_TASK_EVENT_CHANNEL_UNVERIFIED');
  if(state[0][1].toLowerCase()==='false')
   return {...eventsBase('CNN_TASK_EVENT_CHANNEL_DISABLED','READ'),channelEnabled:false};
  const xml=call(['qe',CHANNEL,'/q:*[System[(EventID=322)]]',
   '/rd:true','/c:64','/f:xml'],300000);
  const result=projectW06Event322Readonly(xml,{nowMs:clock()});
  return {...result,channelEnabled:true};
 }catch{return eventsBase('CNN_TASK_EVENT_READER_UNVERIFIED')}
}
