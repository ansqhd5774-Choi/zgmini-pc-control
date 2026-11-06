// A/light fixed read-only release-calendar source inventory.
// Runtime process identity is deliberately not inferred from Git or checkpoints.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const SHA40=/^[0-9a-f]{40}$/i;
const KEY=/^[a-z][a-z0-9_-]{0,48}$/;
const EARNINGS_HOST='api.earningsapi.com';
const COLLECTION_EVENTS_MAX_BYTES=512*1024;
const COLLECTION_EVENTS_MAX_ROWS=1024;
const COLLECTION_EVENTS_MAX_DAYS=14;
// Leave headroom for the pc-job JSON/TXT envelope under its 32 KiB upload cap.
const CANDIDATES_REPORT_MAX_BYTES=24*1024;
const RESULT_REPORT_MAX_BYTES=27*1024;
const EARNINGS_COLLECTOR_EVIDENCE='FILE_INVENTORY_ONLY_NOT_DAILY_GET_PROOF';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=value=>typeof value==='string'&&SHA40.test(value)?value.toLowerCase():null;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const validKey=value=>typeof value==='string'&&KEY.test(value);
const inside=(root,other)=>{
 const relative=path.relative(root,other);
 return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);
};

// Read only the approved collection-events ledger. This is an observation of
// fetch-wrapper calls, not proof of an absolute daily GET limit or saved dates.
function inspectEarningsApiRequests(root,home,fileSystem){
 const out={status:'STATE_UNKNOWN',code:'COLLECTION_EVENTS_UNAVAILABLE',
  evidenceLevel:'LOGGED_FETCH_WRAPPER_CALLS_ONLY_NOT_DAILY_LIMIT_OR_SAVED_DATE_PROOF',
  coverage:'NONE',observedWindow:null,observedDays:[],observedDayCount:0,
  observedMaxDailyRequests:null,observedOverOneRequestDays:0,
  observedStatusDays:[],duplicateHostLogLines:0,statusInvalidEvents:0,statusCoverage:'NONE',
  statusColumns:['ok2xx','client4xx','server5xx','networkError','quotaGuard','other','duplicateLines'],
  statusEvidenceLevel:'FETCH_WRAPPER_RESPONSE_STATUSES_NOT_PROVIDER_GET_POLICY_PROOF',
  eventsExamined:0,invalidEvents:0,bytesRead:0,tailTruncated:false,dayListTruncated:false};
 const file=path.join(home,'collection-events.jsonl');
 let homeStat,fileStat,resolved;
 try{
  homeStat=fileSystem.lstatSync(home);
  resolved=fileSystem.realpathSync(file);
  fileStat=fileSystem.lstatSync(file);
 }catch{return out;}
 if(!homeStat.isDirectory()||homeStat.isSymbolicLink()||
    !inside(root,resolved)||!fileStat.isFile()||fileStat.isSymbolicLink()||
    fileStat.size<1||!Number.isSafeInteger(fileStat.size)){
  out.code='COLLECTION_EVENTS_UNSAFE_OR_EMPTY';return out;
 }
 const start=Math.max(0,fileStat.size-COLLECTION_EVENTS_MAX_BYTES);
 const bytesToRead=fileStat.size-start;
 let fd,buffer;
 try{
  fd=fileSystem.openSync(file,'r');
  const opened=fileSystem.fstatSync(fd);
  if(!opened.isFile()||opened.size!==fileStat.size){
   out.code='COLLECTION_EVENTS_CHANGED_DURING_READ';return out;
  }
  buffer=Buffer.alloc(bytesToRead);
  let read=0;
  while(read<buffer.length){
   const n=fileSystem.readSync(fd,buffer,read,buffer.length-read,start+read);
   if(n<=0)break;
   read+=n;
  }
  if(read!==buffer.length){out.code='COLLECTION_EVENTS_INCOMPLETE_READ';return out;}
 }catch{out.code='COLLECTION_EVENTS_READ_ERROR';return out;}
 finally{if(fd!==undefined)try{fileSystem.closeSync(fd);}catch{}}
 out.bytesRead=buffer.length;
 let text=buffer.toString('utf8');
 let incomplete=start>0||!text.endsWith('\n');
 if(start>0){
  const firstNewline=text.indexOf('\n');
  if(firstNewline<0){out.code='COLLECTION_EVENTS_TAIL_UNUSABLE';out.tailTruncated=true;return out;}
  text=text.slice(firstNewline+1);
 }
 let lines=text.split('\n');
 if(lines.at(-1)==='')lines.pop();
 else if(lines.length)lines.pop(); // Incomplete final append is not a valid event.
 if(lines.length>COLLECTION_EVENTS_MAX_ROWS){
  lines=lines.slice(-COLLECTION_EVENTS_MAX_ROWS);incomplete=true;
 }
 out.tailTruncated=incomplete;
 const counts=new Map(),statusesByDay=new Map(),seenHostLines=new Set();
 let earliest=null,latest=null;
 for(const line of lines){
  if(!line.trim())continue;
  out.eventsExamined++;
  let event;
  try{event=JSON.parse(line);}catch{out.invalidEvents++;continue;}
  const at=event?.at;
  const providers=event?.providers;
  if(typeof at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(at)||
     !Number.isFinite(Date.parse(at))||!providers||typeof providers!=='object'||Array.isArray(providers)){
   out.invalidEvents++;continue;
  }
  const host=Object.hasOwn(providers,EARNINGS_HOST)?providers[EARNINGS_HOST]:null;
  const requests=host===null?0:host?.requests;
  if(!Number.isSafeInteger(requests)||requests<0){out.invalidEvents++;continue;}
  const day=new Date(Date.parse(at)+9*3600*1000).toISOString().slice(0,10);
  counts.set(day,(counts.get(day)||0)+requests);
  if(host!==null&&requests>0){
   const bins=statusesByDay.get(day)??{ok2xx:0,client4xx:0,server5xx:0,
    networkError:0,quotaGuard:0,other:0,duplicateLines:0};
   statusesByDay.set(day,bins);
   // Hash the exact JSONL row only for local duplicate detection. Never report
   // event payloads, request URLs or hashes of raw events.
   const lineHash=hash(Buffer.from(line));
   if(seenHostLines.has(lineHash)){bins.duplicateLines++;out.duplicateHostLogLines++;}
   else seenHostLines.add(lineHash);
   const statusCounts=host.statuses;
   if(!statusCounts||typeof statusCounts!=='object'||Array.isArray(statusCounts)){
    out.statusInvalidEvents++;
   }else{
    for(const [status,count] of Object.entries(statusCounts)){
     if(!Number.isSafeInteger(count)||count<0){out.statusInvalidEvents++;continue;}
     const field=/^2\d\d$/.test(status)?'ok2xx':/^4\d\d$/.test(status)?'client4xx':
      /^5\d\d$/.test(status)?'server5xx':status==='NETWORK_ERROR'?'networkError':
      status==='PROVIDER_QUOTA_GUARD'?'quotaGuard':'other';
     bins[field]+=count;
    }
   }
  }
  if(!earliest||at<earliest)earliest=at;
  if(!latest||at>latest)latest=at;
 }
 const days=[...counts].sort(([a],[b])=>a.localeCompare(b));
 out.observedDayCount=days.length;
 out.dayListTruncated=days.length>COLLECTION_EVENTS_MAX_DAYS;
 out.observedDays=days.slice(-COLLECTION_EVENTS_MAX_DAYS).map(([kstDate,observedRequests])=>({kstDate,observedRequests}));
 out.observedStatusDays=days.slice(-COLLECTION_EVENTS_MAX_DAYS).filter(([day])=>statusesByDay.has(day))
  .map(([kstDate])=>({kstDate,counts:out.statusColumns.map(key=>statusesByDay.get(kstDate)[key]).join(',')}));
 out.observedMaxDailyRequests=days.length?Math.max(...days.map(([,n])=>n)):null;
 out.observedOverOneRequestDays=days.filter(([,n])=>n>1).length;
 out.observedWindow=earliest&&latest?{firstEventAt:earliest,lastEventAt:latest}:null;
 out.coverage=!days.length?'NONE':incomplete||out.invalidEvents?'PARTIAL':'BOUNDED_LOG';
 out.statusCoverage=!statusesByDay.size?'NONE':incomplete||out.invalidEvents||out.statusInvalidEvents?
  'PARTIAL':'BOUNDED_LOG';
 out.status=incomplete||out.invalidEvents||!days.length?'STATE_UNKNOWN':'OBSERVED';
 out.code=out.status==='OBSERVED'?'COLLECTION_EVENTS_OBSERVED_ONLY':'COLLECTION_EVENTS_PARTIAL_OR_INVALID';
 return out;
}

function defaultGitHead(dir){
 const exe=process.platform==='win32'
  ?['C:\\Program Files\\Git\\cmd\\git.exe','C:\\Program Files (x86)\\Git\\cmd\\git.exe'].find(fs.existsSync)
  :'git';
 if(!exe)return null;
 try{return sha(execFileSync(exe,['--no-optional-locks','-c','core.fsmonitor=false','-C',dir,'rev-parse','--verify','HEAD'],
  {windowsHide:true,timeout:1500,maxBuffer:1024,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}).trim());}
 catch{return null;}
}

export function inspectReleaseCalendarRuntime(dataRoot,{fileSystem=fs,gitHead=defaultGitHead,coreTaskXml=null}={}){
 const out={status:'BLOCKED',code:'RELEASE_CALENDAR_DATA_ROOT_UNVERIFIED',
  evidenceLevel:'CHECKPOINT_AND_SOURCE_INVENTORY_NOT_LIVE_PROCESS',runtimeSourceVerified:false,
  configuredSourceSha:null,collection:null,earningsApiRequestObservations:null,coreTask:null,candidates:[],candidateCount:0,gitSkippedCandidates:0,
  earningsApiCollectorEvidenceLevel:EARNINGS_COLLECTOR_EVIDENCE,
  inventoryTruncated:false,providerCalls:0,sqliteOpened:false,d1Writes:0,operationalWrites:0};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return out;
 const real=p=>{try{return fileSystem.realpathSync(p)}catch{return null}};
 const actualData=real(dataRoot),root=actualData&&path.dirname(actualData);
 if(!actualData||path.basename(actualData).toLowerCase()!=='data'||path.basename(root).toLowerCase()!=='zgmini')return out;
 const safeFile=(file,maxBytes)=>{
  const resolved=real(file);
  if(!resolved||!inside(root,resolved))return null;
  let s;try{s=fileSystem.lstatSync(file);}catch{return null;}
  if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>maxBytes)return null;
  try{return {bytes:fileSystem.readFileSync(resolved),modifiedAt:s.mtime.toISOString()}}catch{return null;}
 };
 const jsonFile=(file,maxBytes)=>{
  const data=safeFile(file,maxBytes);
  if(!data)return null;
  try{return {body:JSON.parse(data.bytes.toString('utf8')),modifiedAt:data.modifiedAt}}
  catch{return null;}
 };
 const home=path.join(actualData,'pc-writer');
 out.earningsApiRequestObservations=inspectEarningsApiRequests(root,home,fileSystem);
 if(coreTaskXml){
  const bytes=Buffer.isBuffer(coreTaskXml)?coreTaskXml:Buffer.from(String(coreTaskXml));
  const decoded=bytes.length>=4&&bytes[1]===0&&bytes[3]===0?bytes.toString('utf16le'):bytes.toString('utf8');
  out.coreTask={xmlSha256:hash(bytes),mentionsRunLocal:/run-local\.(?:cmd|mjs)/i.test(decoded),
   mentionsLocalCycle:/local-cycle\.mjs/i.test(decoded),evidenceLevel:'REGISTERED_TASK_XML_STATIC_ONLY'};
 }
 const config=jsonFile(path.join(home,'config.json'),65536)?.body;
 out.configuredSourceSha=sha([config?.source?.sha,config?.source?.commit,config?.source?.commitSha,config?.source,config?.sourceSha].find(sha));
 const saved=jsonFile(path.join(home,'local-collection-last-run.json'),131072);
 if(saved){
  const report=saved.body?.releaseCalendar;
  const sources=report?.sources&&typeof report.sources==='object'&&!Array.isArray(report.sources)?report.sources:{};
  const sourceKeys=Object.keys(sources).filter(validKey).sort().slice(0,32);
  out.collection={modifiedAt:saved.modifiedAt,at:date(saved.body?.at),
   sourceSha:sha(saved.body?.source),
   calendarStatus:typeof report?.status==='string'&&/^[A-Z_]{2,40}$/.test(report.status)?report.status:null,
   providerRequests:Number.isSafeInteger(report?.providerRequests)&&report.providerRequests>=0?report.providerRequests:null,
   sourceKeys,sourceCount:sourceKeys.length};
 }
 // Search only direct checkouts in the approved E:\\ZGmini\\projects tree.
 // Unlike the old 64-entry inventory, a large root does not skip every child.
 const projectRoot=path.join(root,'projects');
 let gitCalls=0;
 for(const parent of [projectRoot,path.join(projectRoot,'legacy')]){
  const resolvedParent=real(parent);
  if(!resolvedParent||!inside(root,resolvedParent))continue;
  let entries;try{entries=fileSystem.readdirSync(resolvedParent,{withFileTypes:true})}catch{continue;}
  if(entries.length>2048){out.inventoryTruncated=true;entries=entries.slice(0,2048);}
  for(const item of entries){
   if(!item.isDirectory()||item.isSymbolicLink?.())continue;
   const dir=path.join(resolvedParent,item.name),resolved=real(dir);
   if(!resolved||!inside(root,resolved))continue;
   const collector=safeFile(path.join(resolved,'scripts','pc-writer','collect-local.mjs'),1048576);
   const module=safeFile(path.join(resolved,'lib','release-calendar.mjs'),1048576);
   const runner=safeFile(path.join(resolved,'scripts','pc-writer','release-calendar.mjs'),1048576);
   if(!collector||!module||!runner)continue;
   out.candidateCount++;
   if(out.candidates.length>=32){out.inventoryTruncated=true;continue;}
   const earningsModule=safeFile(path.join(resolved,'scripts','pc-writer','earnings-api-local.mjs'),1048576);
   const source=module.bytes.toString('utf8');
   const match=source.match(/export\s+const\s+RELEASE_SOURCES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
   const keys=match?[...match[1].matchAll(/^\s*([a-z][a-z0-9_]*)\s*:/gm)].map(m=>m[1]).filter(validKey).slice(0,32):[];
   // Git can be slow or use a worktree pointer. Never follow an unverified
   // external .git directory, and budget at most six 1.5s attempts total.
   const markPath=path.join(resolved,'.git'),mark=real(markPath);
   let trustedGit=false;
   try{
    const s=fileSystem.lstatSync(markPath);
    if(mark&&inside(root,mark)&&!s.isSymbolicLink()){
     if(s.isDirectory())trustedGit=true;
     if(s.isFile()&&s.size<=2048){
      const pointer=fileSystem.readFileSync(markPath,'utf8').trim().match(/^gitdir:\s*(.+)$/i);
      const target=pointer&&real(path.resolve(resolved,pointer[1]));
      trustedGit=!!target&&inside(root,target)&&fileSystem.statSync(target).isDirectory();
     }
    }
   }catch{}
   const canGit=trustedGit&&gitCalls<6;
   if(trustedGit&&!canGit)out.gitSkippedCandidates++;
   if(canGit)gitCalls++;
   const head=canGit?gitHead(resolved):null;
   const collectorText=collector.bytes.toString('utf8');
   out.candidates.push({path:path.relative(root,resolved).replaceAll('\\','/'),head,
    matchesConfiguredSource:!!head&&head===out.configuredSourceSha,
    matchesCollectionSource:!!head&&head===out.collection?.sourceSha,
    collectorCallsCalendar:/\bcollectReleaseCalendar\s*\(/.test(collectorText),
    collectorImportsCalendar:/['"]\.\/release-calendar\.mjs['"]/.test(collectorText),
    moduleSha256:hash(module.bytes),collectorSha256:hash(collector.bytes),runnerSha256:hash(runner.bytes),
    // Preserve a per-checkout negative observation without repeating five
    // null/evidence fields across every absent PC-only collector candidate.
    earningsApiCollector:earningsModule?{verifiedReadable:true,
     sha256:hash(earningsModule.bytes),bytes:earningsModule.bytes.length,
     modifiedAt:earningsModule.modifiedAt,
     evidenceLevel:EARNINGS_COLLECTOR_EVIDENCE}:{verifiedReadable:false},
    sourceParseStatus:match&&keys.length?'PARSED':'UNKNOWN',
    sourceKeys:keys,sourceCount:match&&keys.length?keys.length:null});
  }
 }
 // The reporter pretty-prints the entire result before applying its 32 KiB
 // upload cap. Bound repeated candidates without hiding the discovered total.
 out.status='PASS';out.code='RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY';
 while(out.candidates.length>1&&(
       Buffer.byteLength(JSON.stringify(out.candidates,null,2),'utf8')>CANDIDATES_REPORT_MAX_BYTES||
       Buffer.byteLength(JSON.stringify(out,null,2),'utf8')>RESULT_REPORT_MAX_BYTES)){
  out.candidates.pop();out.inventoryTruncated=true;
 }
 return out;
}
