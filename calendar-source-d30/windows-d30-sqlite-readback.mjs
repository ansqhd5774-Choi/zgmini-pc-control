// D+30: owner-authorized, single-use, READ-ONLY Windows SQLite verification.
// The existing calendar Actions/Windows route invokes this module after B.
// No controller install, provider fetch, DB modification, public response,
// scheduler mutation, dynamic SQL, arbitrary path or Issue-supplied command.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

export const D30_SQLITE_ISSUE_TITLE='pc-calendar-d30-db-readonly-once';
export const D30_SQLITE_OPERATION='calendar-d30-db-readonly-once';
export const D30_SQLITE_SCHEMA='ZGMINI_CALENDAR_D30_DB_READONLY_V1';
export const D30_SQLITE_PATH=String.raw`E:\ZGmini\data\pc-writer\storage\core.sqlite`;

const OWNER='ansqhd5774-Choi';
const CONTROL=`${OWNER}/zgmini-pc-control`;
const SHA40=/^[a-f0-9]{40}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REQUEST_KEYS=['schema','operation','requestId','controlSha'];
const DAY=/^20\d\d-\d\d-\d\d$/;
const BASE='release-calendar:earnings-api';
const STATUS_KEY=`${BASE}:forward-30-status`;
const INPUT_SQL="SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='input' AND feed_key=? AND snapshot_key='current' LIMIT 1";
const GIT=[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files\Git\bin\git.exe`];

const block=(code,detail={})=>({status:'BLOCKED',code,...detail,
 providerCalls:0,dbWrites:0,d1Writes:0,operationalWrites:0});
const observed=(status,code,detail={})=>({status,code,...detail,
 providerCalls:0,dbWrites:0,d1Writes:0,operationalWrites:0});
const validDay=day=>DAY.test(day??'')&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&
 new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
const isoMs=value=>Number.isSafeInteger(value)&&value>=0&&
 Number.isFinite(Date.parse(new Date(value).toISOString()))?
  new Date(value).toISOString():null;
const compactJson=text=>{
 if(typeof text!=='string'||text.length<2||text.length>1_100_000)return null;
 try{const value=JSON.parse(text);return value&&typeof value==='object'&&
  !Array.isArray(value)?value:null;}catch{return null;}
};

export function nyCalendarDay(now=new Date()){
 const fields=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=type=>fields.find(field=>field.type===type)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}

export function d30CalendarDay(today){
 if(!validDay(today))return null;
 return new Date(Date.parse(today+'T00:00:00Z')+30*86_400_000)
  .toISOString().slice(0,10);
}

// Approval checks occur BEFORE touching the operational DB. Issue-supplied
// data cannot choose a SQL query, file path, date or execution entrypoint.
export function authorizeD30SqliteIssue({event,env,observedControlSha}={}){
 if(env?.GITHUB_REPOSITORY!==CONTROL||env.GITHUB_EVENT_NAME!=='issues'||
    env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_RUN_ATTEMPT!=='1'||event?.action!=='opened'||
    event?.repository?.full_name!==CONTROL||
    event.repository.private!==true||event?.sender?.login!==OWNER||
    event?.issue?.user?.login!==OWNER||event.issue.pull_request||
    event.issue.title!==D30_SQLITE_ISSUE_TITLE||
    !Number.isSafeInteger(event.issue.number)||event.issue.number<=0)
  return block('ER1_D30_SQLITE_OWNER_OR_EVENT_STOP');
 let request;
 try{if(typeof event.issue.body!=='string'||event.issue.body.length>4096)
     throw Error('body');request=JSON.parse(event.issue.body);}catch{
   return block('ER1_D30_SQLITE_REQUEST_INVALID');
 }
 if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).length!==REQUEST_KEYS.length||
    REQUEST_KEYS.some(key=>!Object.hasOwn(request,key))||
    request.schema!==D30_SQLITE_SCHEMA||
    request.operation!==D30_SQLITE_OPERATION||
    typeof request.requestId!=='string'||
    !request.requestId.startsWith('pc-calendar-d30-db-')||
    !UUID.test(request.requestId.slice('pc-calendar-d30-db-'.length))||
    !SHA40.test(request.controlSha??'')||
    request.controlSha!==env.GITHUB_SHA||
    request.controlSha!==observedControlSha)
  return block('ER1_D30_SQLITE_CONTROL_OR_SCOPE_STOP');
 return observed('AUTHORIZED','ER1_D30_SQLITE_READONLY_AUTHORIZED',
  {issue:event.issue.number,requestId:request.requestId});
}

// Count only structurally valid provider records. Never expose names, tickers
// or the provider's proprietary JSON to the Action log/result.
function validVendorRows(text,targetDay){
 if(typeof text!=='string'||text.length<1||text.length>1_000_000)return null;
 const payload=compactJson(text);
 if(!payload||payload.date!==targetDay)return null;
 const seen=new Set();let count=0;
 for(const group of ['pre','after','notSupplied']){
  const rows=payload[group];
  if(!Array.isArray(rows)||rows.length>5000)return null;
  for(const row of rows){
   if(!row||typeof row!=='object'||Array.isArray(row)||
      typeof row.symbol!=='string'||!/^[A-Z0-9.\-]{1,12}$/.test(row.symbol)||
      typeof row.name!=='string'||!row.name.trim()||row.name.length>200||
      seen.has(row.symbol))return null;
   seen.add(row.symbol);count++;
  }
 }
 return count;
}

/**
 * Production opens ONLY D30_SQLITE_PATH with readOnly:true. Tests inject an
 * isolated fixture path; Issue payload has no path/query/date parameters.
 * `now` is the observation clock, not a request field.
 */
export function readD30Sqlite({now=new Date(),dbPath=D30_SQLITE_PATH,
  fileSystem=fs,openDb=file=>new DatabaseSync(file,{readOnly:true,timeout:4000})}={}){
 const today=nyCalendarDay(now),targetDay=d30CalendarDay(today);
 const common={nyDay:today,targetDay,sqliteOpened:false,
  privateRawDataDisclosed:false,providerRequestEvidence:'NOT_DIRECTLY_OBSERVED',
  d30SourceDesignedMaxDailyGet:1};
 if(!targetDay)return block('ER1_D30_SQLITE_NY_DAY_UNAVAILABLE',common);
 let info,resolved;
 try{
  info=fileSystem.lstatSync(dbPath);resolved=fileSystem.realpathSync(dbPath);
  if(!info.isFile()||info.isSymbolicLink()||info.size<=0||
     path.win32.basename(dbPath).toLowerCase()!=='core.sqlite'||
     path.win32.basename(path.win32.dirname(dbPath)).toLowerCase()!=='storage'||
     (!dbPath.startsWith('/tmp/')&&
      path.win32.normalize(resolved).toLowerCase()!==
      path.win32.normalize(dbPath).toLowerCase()))
    return block('ER1_D30_SQLITE_FILE_SCOPE_STOP',common);
 }catch{return observed('PENDING','ER1_D30_SQLITE_FILE_UNAVAILABLE',common);}
 let db;
 try{
  db=openDb(dbPath);
  const row=key=>db.prepare(INPUT_SQL).get(key);
  const statusRow=row(STATUS_KEY),statusBody=compactJson(statusRow?.body);
  if(!statusRow)return observed('PENDING','ER1_D30_FORWARD_STATUS_PENDING',
    {...common,sqliteOpened:true});
  if(!statusBody||!isoMs(statusRow.stored_at))
   return block('ER1_D30_FORWARD_STATUS_INVALID',
    {...common,sqliteOpened:true});
  if(statusBody.attemptedNyDay!==today)
   return observed('PENDING','ER1_D30_FORWARD_STATUS_STALE',
    {...common,sqliteOpened:true,sourceStatus:'STALE_HISTORICAL'});
  const attemptRow=row(`${BASE}:forward-30-attempt:${today}`);
  const attemptBody=compactJson(attemptRow?.body);
  if(!attemptRow||!attemptBody||attemptBody.attemptedNyDay!==today||
     !isoMs(attemptRow.stored_at))
   return observed('STATE_UNKNOWN','ER1_D30_ATTEMPT_READBACK_UNVERIFIED',
    {...common,sqliteOpened:true,sourceStatus:statusBody.status});
  const safe={...common,sqliteOpened:true,attemptStoredAt:isoMs(attemptRow.stored_at),
    statusStoredAt:isoMs(statusRow.stored_at),attemptObserved:true};
  if(statusBody.status==='SOURCE_FAILED')
   return observed('SOURCE_FAILED','ER1_D30_PRIVATE_PROVIDER_FAILED',
    {...safe,sourceStatus:'SOURCE_FAILED',privateInputVerified:false});
  if(statusBody.status!=='READY'||
     !Array.isArray(statusBody.coveredDays)||
     statusBody.coveredDays.length!==1||
     statusBody.coveredDays[0]!==targetDay||
     !Number.isSafeInteger(statusBody.recordCount)||statusBody.recordCount<0||
     !Number.isFinite(Date.parse(statusBody.checkedAt??''))||
     statusBody.publicationStatus!=='HELD_UNCONFIRMED')
   return block('ER1_D30_READY_STATUS_SHAPE_INVALID',safe);
  const targetRow=row(`${BASE}:${targetDay}`);
  const targetBody=compactJson(targetRow?.body);
  const actualCount=validVendorRows(targetBody?.text,targetDay);
  if(!targetRow||!isoMs(targetRow.stored_at)||
     targetBody?.requestedDate!==targetDay||actualCount===null||
     actualCount!==statusBody.recordCount||
     attemptRow.stored_at>targetRow.stored_at||
     targetRow.stored_at>statusRow.stored_at)
   return observed('STATE_UNKNOWN','ER1_D30_PRIVATE_INPUT_READBACK_MISMATCH',
    {...safe,sourceStatus:'READY',privateInputVerified:false});
  return observed('PASS','ER1_D30_PRIVATE_SQLITE_READBACK_VERIFIED',
   {...safe,sourceStatus:'READY',coveredDayCount:1,recordCount:actualCount,
    privateInputVerified:true,rawJsonParsed:true,
    inputStoredAt:isoMs(targetRow.stored_at),
    sourceCheckedAt:new Date(statusBody.checkedAt).toISOString()});
 }catch{return observed('STATE_UNKNOWN','ER1_D30_SQLITE_READONLY_QUERY_UNAVAILABLE',
   {...common,sqliteOpened:db!==undefined});}
 finally{if(db)try{db.close()}catch{}}
}

// Git CLI is fixed, non-shell, read-only, and limited to the already-checked
// out private control source. No env/content may inject git arguments.
export function checkedOutControlSha({workspace,platform=process.platform,
 fileSystem=fs,gitRunner=spawnSync}={}){
 if(platform!=='win32'||!workspace||typeof workspace!=='string')return null;
 const repo=path.win32.join(workspace,'control');
 const exe=GIT.find(file=>fileSystem.existsSync(file));
 if(!exe)return null;
 try{
  const out=gitRunner(exe,['-C',repo,'rev-parse','--verify','HEAD'],
   {windowsHide:true,shell:false,encoding:'utf8',timeout:10000,maxBuffer:4096});
  const sha=out?.stdout?.trim();
  return !out?.error&&out.status===0&&SHA40.test(sha)?sha:null;
 }catch{return null;}
}

export function runD30SqliteIssue({event,env,observedControlSha,
 platform=process.platform,readback=readD30Sqlite}={}){
 if(platform!=='win32')return block('ER1_D30_SQLITE_WINDOWS_REQUIRED');
 const auth=authorizeD30SqliteIssue({event,env,observedControlSha});
 if(auth.status!=='AUTHORIZED')return auth;
 const result=readback();
 return {...result,issue:auth.issue,requestId:auth.requestId,
  controlSha:observedControlSha};
}

async function main(){
 let result;
 try{
  if(process.platform!=='win32')result=block('ER1_D30_SQLITE_WINDOWS_REQUIRED');
  else{
   const eventPath=process.env.GITHUB_EVENT_PATH;
   const info=fs.lstatSync(eventPath);
   // Normal issue webhooks include additional installation/repository metadata.
   // The approved request body is independently limited to 4 KiB above.
   if(!info.isFile()||info.isSymbolicLink()||info.size<=0||info.size>2_000_000)
    result=block('ER1_D30_SQLITE_EVENT_SCOPE_STOP');
   else{
    const event=JSON.parse(fs.readFileSync(eventPath,'utf8'));
    result=runD30SqliteIssue({event,env:process.env,
     observedControlSha:checkedOutControlSha({workspace:process.env.GITHUB_WORKSPACE})});
   }
  }
 }catch{result=block('ER1_D30_SQLITE_PREFLIGHT_UNAVAILABLE');}
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.status==='BLOCKED')process.exitCode=1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
