// Bounded, fixed-file, A-grade read-only inventory of PC fetch-wrapper responses.
// Neither log entries nor request parameters can select a file or execute code.
// This is NOT complete proof of all collectors, scheduled cadence or parse/storage.
import fs from 'node:fs';
import path from 'node:path';

const TAIL_BYTES=4*1024*1024;
const MAX_LINES=12_000;
const MAX_HOSTS=64;
const WINDOW_DAYS=14;
const DAY_MS=86_400_000;
const safeHost=s=>typeof s==='string' && s.length<=180 &&
  /^(?=.{4,180}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(s) &&
  !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(s) &&
  !/^\d+(?:\.\d+){3}$/.test(s);
const fixedStatus=s=>/^[1-5]\d\d$/.test(s)||s==='NETWORK_ERROR'||s==='PROVIDER_QUOTA_GUARD';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const iso=ms=>Number.isFinite(ms)?new Date(ms).toISOString():null;
const kstDay=ms=>new Date(ms+9*3600_000).toISOString().slice(0,10);
const unknown=code=>({status:'STATE_UNKNOWN',code,source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false,
  allActiveEndpointsVerified:false,activeEndpointCount:null});

export function inspectProviderActivity(dataRoot,{now=Date.now(),fileSystem=fs}={}){
 if(!Number.isSafeInteger(now)||now<0)return unknown('INVALID_OBSERVATION_TIME');
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return unknown('UNVERIFIED_DATA_ROOT');
 const root=path.join(dataRoot,'pc-writer'),file=path.join(root,'collection-events.jsonl');
 try{
  for(const dir of [dataRoot,root]){
   const stat=fileSystem.lstatSync(dir);
   if(!stat.isDirectory()||stat.isSymbolicLink())return unknown('UNSAFE_DATA_DIRECTORY');
  }
  const stat=fileSystem.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())return unknown('UNSAFE_LOG_FILE');
  if(!stat.size)return unknown('COLLECTION_LOG_EMPTY');
 }catch{return unknown('COLLECTION_LOG_MISSING_OR_UNREADABLE');}

 let fd,buffer,startStat,endStat;
 try{
  fd=fileSystem.openSync(file,'r');startStat=fileSystem.fstatSync(fd);
  const size=startStat.size,length=Math.min(TAIL_BYTES,size),offset=size-length;
  buffer=Buffer.alloc(length);
  let total=0;
  while(total<length){const got=fileSystem.readSync(fd,buffer,total,length-total,offset+total);if(got<=0)throw Error('INCOMPLETE');total+=got;}
  endStat=fileSystem.fstatSync(fd);
 }catch{return unknown('COLLECTION_LOG_READ_FAILED');}
 finally{if(fd!==undefined)fileSystem.closeSync(fd);}
 if(!startStat||!endStat||startStat.size!==endStat.size||startStat.mtimeMs!==endStat.mtimeMs)
  return unknown('COLLECTION_LOG_CHANGED_DURING_READ');

 const partialTail=startStat.size>TAIL_BYTES;
 let lines=buffer.toString('utf8').split(/\n/);
 if(partialTail)lines.shift();
 // Log writer appends one line per run; never parse an in-progress append.
 if(!buffer.toString('utf8').endsWith('\n'))lines.pop();
 else lines.pop(); // final split segment after trailing LF
 const partialRows=lines.length>MAX_LINES;
 if(partialRows)lines=lines.slice(-MAX_LINES);
 let bad=0,duplicated=0,hiddenHosts=0,events=0;
 const from=now-WINDOW_DAYS*DAY_MS;
 const seen=new Set();
 const hosts=new Map();
 for(const raw of lines){
  const line=raw.trim();if(!line)continue;
  if(seen.has(line)){duplicated++;continue;}seen.add(line);
  let obj;try{obj=JSON.parse(line);}catch{bad++;continue;}
  const at=Date.parse(obj?.at??'');
  if(!Number.isFinite(at)||at>now+60_000||!obj?.providers||typeof obj.providers!=='object'||Array.isArray(obj.providers)){
   bad++;continue;
  }
  if(at<from)continue;
  events++;
  for(const [host,entry] of Object.entries(obj.providers)){
   if(!safeHost(host)){hiddenHosts++;continue;}
   if(!entry||!integer(entry.requests)||typeof entry.statuses!=='object'||entry.statuses===null||Array.isArray(entry.statuses)){
    bad++;continue;
   }
   const statuses=Object.entries(entry.statuses);
   if(statuses.some(([s,n])=>!fixedStatus(s)||!integer(n))){bad++;continue;}
   const total=statuses.reduce((a,[,n])=>a+n,0);
   if(total!==entry.requests){bad++;continue;}
   if(entry.requests===0)continue;
   const x=hosts.get(host)??{host,requestCount:0,observedDays:new Set(),lastAttemptAt:null,lastRunResponses:null,
    lastRunRequests:null,last2xxRunAt:null,statusCounts:{ok2xx:0,client4xx:0,server5xx:0,networkError:0,quotaGuard:0,other:0}};
   x.requestCount+=entry.requests;x.observedDays.add(kstDay(at));
   const bin={ok2xx:0,client4xx:0,server5xx:0,networkError:0,quotaGuard:0,other:0};
   for(const [s,n] of statuses){const group=s==='NETWORK_ERROR'?'networkError':s==='PROVIDER_QUOTA_GUARD'?'quotaGuard':
      s.startsWith('2')?'ok2xx':s.startsWith('4')?'client4xx':s.startsWith('5')?'server5xx':'other';
    bin[group]+=n;x.statusCounts[group]+=n;
   }
   if(at>=(x.lastAttemptAt??-1)){
    x.lastAttemptAt=at;x.lastRunResponses=bin;x.lastRunRequests=entry.requests;
   }
   if(bin.ok2xx>0)x.last2xxRunAt=Math.max(x.last2xxRunAt??0,at);
   hosts.set(host,x);
  }
 }
 const sorted=[...hosts.values()].sort((a,b)=>b.lastAttemptAt-a.lastAttemptAt||a.host.localeCompare(b.host));
 const resultHosts=sorted.slice(0,MAX_HOSTS).map(x=>({
  host:x.host,requestCount:x.requestCount,observedDayCount:x.observedDays.size,
  lastAttemptAt:iso(x.lastAttemptAt),last2xxRunAt:iso(x.last2xxRunAt),
  lastRunRequests:x.lastRunRequests,lastRunResponses:x.lastRunResponses,
  statusCounts:x.statusCounts,
 }));
 const noObservedHosts=hosts.size===0;
 const limited=partialTail||partialRows||bad>0||duplicated>0||hiddenHosts>0||hosts.size>MAX_HOSTS||noObservedHosts;
 return {status:limited?'STATE_UNKNOWN':'PASS',code:noObservedHosts?'PROVIDER_ACTIVITY_NO_OBSERVED_HOSTS':limited?'PROVIDER_ACTIVITY_PARTIAL':'PROVIDER_ACTIVITY_OBSERVED',
  source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',scope:'FIXED_LOCAL_JSONL_ONLY',
  evidenceLevel:'FETCH_WRAPPER_HTTP_ONLY_NOT_PARSER_OR_STORAGE_PROOF',
  now:iso(now),windowDays:WINDOW_DAYS,observedWindowStart:iso(from),
  eventsExamined:events,logLinesExamined:lines.length,tailBytes:buffer.length,
  tailTruncated:partialTail,linesTruncated:partialRows,invalidRows:bad,duplicateLines:duplicated,
  hiddenHosts,observedHostCount:hosts.size,hostsReturned:resultHosts.length,hosts:resultHosts,
  allActiveEndpointsVerified:false,activeEndpointCount:null,
  missingCollectorCoverage:['ALPACA_CHILD_PROCESS','SUPPLY_R10_CHILD_PROCESS','SECTOR_CHILD_PROCESS','DOL_OR_BLS_INDEPENDENT_COLLECTORS_UNVERIFIED'],
  providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false};
}
