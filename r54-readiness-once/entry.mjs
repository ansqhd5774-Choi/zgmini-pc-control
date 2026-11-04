// Fixed R54 readiness observation. No collectors, score calculation, task writes,
// Controller calls, database access, credentials, or public publication.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const TITLE='pc-theme-r54-readiness-readonly-once';
export const SCHEMA='ZGMINI_R54_READINESS_READONLY_ONCE_V1';
export const TASK_NAMES=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13'];
export const DATA_ROOT=String.raw`E:\ZGmini\data`;
const APPROVAL='THEME_R54_READINESS_B_APPROVAL.json';
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST=new RegExp('^pc-theme-r54-readiness-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const fn=fileURLToPath(import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=s=>{throw Object.assign(new Error(s),{code:s});};
const permitted=s=>typeof s==='string'&&/^R54_READINESS_[A-Z0-9_]{2,70}$/.test(s);
const isoDay=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const safeStatus=s=>typeof s==='string'&&s.length<=80&&
 (/^(WAIT_|STOP_|PRIVATE_|SOURCE_|R47_|THEME_NINE_R47_|R48_)[A-Z0-9_:-]{1,70}$/.test(s)||
  ['PASS','READY','BLOCKED','FAILED','PENDING','UNAVAILABLE'].includes(s))?s:null;
const sameReal=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const R35_DAYS=['2026-11-02','2026-11-03'];
const nyParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
 year:'numeric',month:'2-digit',day:'2-digit'});
function nyDay(value){
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return null;
 const p=Object.fromEntries(nyParts.formatToParts(d)
  .filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}

function inspectFile(p,maxBytes){
 try{
  const st=fs.lstatSync(p);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>maxBytes)
   return {status:'DENIED'};
  if(!sameReal(fs.realpathSync.native(p),path.resolve(p)))return {status:'DENIED'};
  const bytes=fs.readFileSync(p);
  return {status:'READ',sha256:sha(bytes),bytes:bytes.length,
   modifiedAt:st.mtime.toISOString(),buffer:bytes};
 }catch{return {status:'UNAVAILABLE'};}
}
function publicMeta(observed){
 const {buffer,...result}=observed;
 return result;
}
function checkedDirectory(dir,list){
 const st=fs.lstatSync(dir);
 if(!st.isDirectory()||st.isSymbolicLink())fail('R54_READINESS_DIRECTORY_UNSAFE');
 if(!sameReal(fs.realpathSync.native(dir),path.resolve(dir)))
  fail('R54_READINESS_DIRECTORY_UNSAFE');
 const names=list(dir);
 if(names.length>8192)fail('R54_READINESS_DIRECTORY_TOO_LARGE');
 return names;
}
function inspectRecent(dir,pattern,list,parse){
 try{
  const files=checkedDirectory(dir,list).filter(n=>pattern.test(n));
  const dated=files.map(n=>{
   try{const st=fs.lstatSync(path.join(dir,n));return {name:n,time:st.mtimeMs};}
   catch{return null;}
  }).filter(Boolean).sort((a,b)=>b.time-a.time).slice(0,3);
  return {status:'READ',files:dated.map(({name})=>{
   const observed=inspectFile(path.join(dir,name),131072);
   if(observed.status!=='READ')return publicMeta(observed);
   let detail=null;
   try{detail=parse(observed.buffer.toString('utf8'));}catch{}
   return {...publicMeta(observed),detail};
  })};
 }catch{return {status:'UNAVAILABLE'};}
}
function inspectR35Evidence(inside,list){
 const days=Object.fromEntries(R35_DAYS.map(date=>[date,{attempts:[]}]));
 const ledger={status:'UNAVAILABLE',nyBudgetTimezone:'America/New_York',
  maxProbesPerWindowPerNyDay:2,minProbeGapMinutes:360,filesScanned:0,invalidFiles:0,days};
 try{
  const dir=inside('themes/legacy-nine-r47-probes');
  const filenames=checkedDirectory(dir,list).filter(n=>/^r47-source-probe-[a-f0-9]{20}\.json$/.test(n));
  if(filenames.length>128)throw Error('TOO_MANY_PROBES');
  ledger.filesScanned=filenames.length;
  for(const filename of filenames){
   const observed=inspectFile(path.join(dir,filename),65536);
   if(observed.status!=='READ'){ledger.invalidFiles++;continue;}
   try{
    const v=JSON.parse(observed.buffer.toString('utf8'));
    const window=v?.window;
    const identity=sha(JSON.stringify({rosterSha:v?.rosterSha256,
     start:window?.start,end:window?.end})).slice(0,20);
    if(v?.version!==1||v?.project!=='legacy-nine-r47-source-probe'||
       !SHA64.test(v?.rosterSha256??'')||!isoDay(window?.start)||
       !isoDay(window?.end)||filename!==`r47-source-probe-${identity}.json`||
       !Array.isArray(v.attempts)||v.attempts.length>14)throw Error('PROBE_INVALID');
    for(const attempt of v.attempts){
     const date=nyDay(attempt?.at);
     if(!date||!safeStatus(attempt?.status)||
        !Number.isSafeInteger(attempt?.providerCalls)||
        attempt.providerCalls<0||attempt.providerCalls>256)throw Error('ATTEMPT_INVALID');
    }
    for(const attempt of v.attempts){
     const date=nyDay(attempt.at);
     if(!Object.hasOwn(days,date))continue;
     days[date].attempts.push({at:attempt.at,status:attempt.status,
      providerCalls:attempt.providerCalls,
      latestSeenSpyNYDay:isoDay(attempt.latestSeenSpyNYDay)?attempt.latestSeenSpyNYDay:null,
      windowStart:window.start,windowEnd:window.end,ledgerSha256:observed.sha256});
    }
   }catch{ledger.invalidFiles++;}
  }
  for(const value of Object.values(days)){
   value.attemptCount=value.attempts.length;
   value.attempts=value.attempts.sort((a,b)=>a.at.localeCompare(b.at)).slice(-3);
  }
  ledger.status='READ';
 }catch{ledger.status='UNAVAILABLE';}
 const spyRaw={status:'UNAVAILABLE',filesScanned:0,invalidFiles:0,
  dates:Object.fromEntries(R35_DAYS.map(date=>[date,{savedRows:0,files:[]}]))};
 try{
  const dir=inside('themes/legacy-nine-r35-delta/raw');
  const names=checkedDirectory(dir,list).filter(n=>/^SPY_[a-f0-9]{64}\.jsonl$/.test(n));
  if(names.length>16)throw Error('TOO_MANY_SPY_PAGES');
  spyRaw.filesScanned=names.length;
  for(const filename of names){
   const observed=inspectFile(path.join(dir,filename),8000000);
   if(observed.status!=='READ'||filename!==`SPY_${observed.sha256}.jsonl`){
    spyRaw.invalidFiles++;continue;
   }
   try{
    const matches=Object.fromEntries(R35_DAYS.map(date=>[date,0]));
    const lines=observed.buffer.toString('utf8').split(/\r?\n/).filter(Boolean);
    if(lines.length>5000)throw Error('BAR_LIMIT');
    for(const line of lines){
     const bar=JSON.parse(line);
     if(bar?.symbol!=='SPY'||typeof bar.timestamp!=='string'||!nyDay(bar.timestamp))
      throw Error('BAR_INVALID');
     const date=nyDay(bar.timestamp);
     if(Object.hasOwn(matches,date)&&bar.is_gap!==true)matches[date]++;
    }
    for(const [date,count] of Object.entries(matches))if(count){
     spyRaw.dates[date].savedRows+=count;
     spyRaw.dates[date].files.push({sha256:observed.sha256,rows:count});
    }
   }catch{spyRaw.invalidFiles++;}
  }
  spyRaw.status='READ';
 }catch{spyRaw.status='UNAVAILABLE';}
 return {probeLedger:ledger,spyRaw};
}
function inspectSourceLineage(dataRoot,list){
 const protectedRoot=path.resolve(dataRoot);
 const inside=relative=>{
  const p=path.resolve(protectedRoot,relative);
  if(!p.startsWith(protectedRoot+path.sep))fail('R54_READINESS_PATH_DENIED');
  return p;
 };
 const installed={};
 for(const [key,relative] of [
  ['r47Cmd','pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd'],
  ['r54Cmd','pc-writer/theme-nine-r54/scripts/pc-writer/THEME_NINE_R54_PUBLIC_CYCLE.cmd'],
  ['r54Connect','pc-writer/theme-nine-r54/scripts/pc-writer/theme-nine-r54-public-connect.mjs']]){
  installed[key]=publicMeta(inspectFile(inside(relative),1048576));
 }
 const manifests={};
 for(const [key,relative] of [
  ['r23','themes/legacy-nine-r23/raw-manifest.json'],
  ['r35','themes/legacy-nine-r35-delta/raw-manifest.json']]){
  const observed=inspectFile(inside(relative),2097152);
  const summary=publicMeta(observed);
  if(observed.status==='READ'){
   try{
    const data=JSON.parse(observed.buffer.toString('utf8'));
    if(!Array.isArray(data.files)||data.files.length>8192)throw Error('INVALID_FILES');
    const spyDates=data.files.filter(f=>f?.symbol==='SPY')
     .map(f=>f?.lastVerifiedNYDay).filter(isoDay).sort();
    summary.pageCount=data.files.length;
    summary.latestSpyDay=spyDates.at(-1)??null;
   }catch{summary.metadata='UNPARSEABLE';}
  }
  manifests[key]=summary;
 }
 const recentRuns={
  r47:inspectRecent(inside('pc-writer/theme-nine-r48'),
   /^THEME_NINE_R47_RECURRING_PRIVATE_UPDATE_\d+_\d+\.json$/,list,body=>{
    const v=JSON.parse(body);
    return {status:safeStatus(v?.status),stage:safeStatus(v?.stage),
     collectionStatus:safeStatus(v?.collection?.status),
     providerCalls:Number.isSafeInteger(v?.collection?.providerCalls)?
      v.collection.providerCalls:null,
     latestSeenSpyNYDay:isoDay(v?.collection?.latestSeenSpyNYDay)?
      v.collection.latestSeenSpyNYDay:null,
     benchmarkDate:isoDay(v?.benchmarkDate)?v.benchmarkDate:null,
     targetClosedNYDay:isoDay(v?.freshness?.targetClosedNYDay)?v.freshness.targetClosedNYDay:null,
     lastVerifiedSpyNYDay:isoDay(v?.freshness?.lastVerifiedSpyNYDay)?v.freshness.lastVerifiedSpyNYDay:null};
   }),
  r54:inspectRecent(inside('pc-writer/theme-nine-r54/logs'),
   /^THEME_NINE_R54_CYCLE_\d+_\d+\.txt$/,list,body=>({
    result:(body.match(/RESULT=(EXECUTED_CHECK_JSON_STATUS|STOP_OR_PENDING_REVIEW_TXT)/g)||[]).at(-1)??null,
    errors:[...new Set(body.match(/THEME_NINE_R54_[A-Z0-9_]{3,65}/g)||[])].slice(-4)
   }))
 };
 return {installed,manifests,recentRuns,r35Evidence:inspectR35Evidence(inside,list)};
}

function fileBytes(p,max){
 const st=fs.lstatSync(p);
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)fail('R54_READINESS_FILE_DENIED');
 return fs.readFileSync(p);
}
function workspace(env){
 const p=env.GITHUB_WORKSPACE;
 if(typeof p!=='string'||!path.isAbsolute(p))fail('R54_READINESS_WORKSPACE_DENIED');
 const real=fs.realpathSync.native(p),resolved=path.resolve(p);
 if((process.platform==='win32'?real.toLowerCase():real)!==
    (process.platform==='win32'?resolved.toLowerCase():resolved))fail('R54_READINESS_WORKSPACE_REDIRECT');
 return real;
}
function eventFrom(env){return JSON.parse(fileBytes(env.GITHUB_EVENT_PATH,100000).toString('utf8'));}
export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.repository?.private!==true||
  event.repository.full_name!==REPO||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==TITLE||!Number.isSafeInteger(event?.issue?.number)||
  event.issue.number<1||event.issue.number>=1000000000||
  event.issue.labels?.some(x=>['pc-job','pc-maintenance'].includes(x.name)))
  fail('R54_READINESS_AUTH_DENIED');
 if(typeof event.issue.body!=='string'||event.issue.body.length>4096)
  fail('R54_READINESS_BODY_DENIED');
 let r;try{r=JSON.parse(event.issue.body);}catch{fail('R54_READINESS_JSON_DENIED');}
 if(!r||typeof r!=='object'||Array.isArray(r)||
  Object.keys(r).sort().join('|')!==['schema','operation','requestId','chatId','controlSha'].sort().join('|')||
  r.schema!==SCHEMA||r.operation!=='r54-readiness-readonly-once'||
  !SHA40.test(env.GITHUB_SHA??'')||r.controlSha!==env.GITHUB_SHA||
  !REQUEST.test(r.requestId)||!CHAT.test(r.chatId)||
  r.requestId.slice('pc-theme-r54-readiness-'.length)!==r.chatId.slice('chat-'.length))
  fail('R54_READINESS_REQUEST_DENIED');
 return r;
}
function approvalCheck(base){
 const p=path.join(base,'control',APPROVAL);
 const a=JSON.parse(fileBytes(p,4096).toString('utf8'));
 if(a.schema!=='ZGMINI_R54_READINESS_B_APPROVAL_V1'||a.grade!=='B'||
  a.scope!=='FIXED_R54_R35_READONLY_PROBE_LEDGER_SPY_RAW_FORENSICS_ONCE'||
  a.dataRoot!==DATA_ROOT||a.timeoutSeconds!==120||
  a.maxProviderRequests!==0||a.maxAutomaticRetries!==0||
  a.pcDataWrites!==false||a.databaseWrites!==false||a.d1Writes!==false||
  a.schedulerWrites!==false||!SHA64.test(a.scriptSha256??'')||
  sha(fs.readFileSync(fn))!==a.scriptSha256)fail('R54_READINESS_APPROVAL_DENIED');
 return a;
}
export function inspect({taskQuery=task=>execFileSync('schtasks.exe',
 ['/Query','/TN',task,'/XML'],{timeout:12000,maxBuffer:1048576,windowsHide:true}),
 list=dir=>fs.readdirSync(dir),freeMiB=Math.floor(os.freemem()/1048576),
 dataRoot=DATA_ROOT}={}){
 const tasks=[...TASK_NAMES,'ZGMINI-PC-Theme-Nine-R47-Private'].map(name=>{
  try{const xml=taskQuery(name);return {name,found:true,exitCode:0,
   xmlSha256:sha(Buffer.isBuffer(xml)?xml:Buffer.from(String(xml)))};}
  catch(e){return {name,found:false,exitCode:Number.isSafeInteger(e?.status)?e.status:null,
   errorKind:['ENOENT','EACCES','ETIMEDOUT'].includes(e?.code)?e.code:'TASK_QUERY_FAILED'};}
 });
 const roots=[['r47',path.join(dataRoot,'themes','legacy-nine-r47-private'),
  /^THEME_NINE_R47_PRIVATE_(20\d\d-\d\d-\d\d)_[a-f0-9]{16}_NINE\.json$/],
  ['r48',path.join(dataRoot,'themes','legacy-nine-r48-private-candidate'),
  /^THEME_NINE_R48_PRIVATE_CANDIDATE_(20\d\d-\d\d-\d\d)_[a-f0-9]{16}\.json$/],
  ['marketParquet',path.join(dataRoot,'theme-market-history-r131','marketparquet-r165'),
  /^etf_daily_(20\d\d-\d\d-\d\d)\.parquet$/]];
 const saved={};
 for(const [key,dir,pattern] of roots){
  try{
   const st=fs.lstatSync(dir);
   if(!st.isDirectory()||st.isSymbolicLink())fail('R54_READINESS_DIRECTORY_UNSAFE');
   const entries=list(dir);
   if(entries.length>8192)fail('R54_READINESS_DIRECTORY_TOO_LARGE');
   const dates=entries.flatMap(n=>{const m=pattern.exec(n);return m&&isoDay(m[1])?[m[1]]:[]});
   saved[key]={status:'READ',candidateCount:dates.length,latestDates:[...new Set(dates)].sort().slice(-6)};
  }catch(e){saved[key]={status:e?.code==='R54_READINESS_DIRECTORY_TOO_LARGE'?'LIMIT':'UNAVAILABLE'};}
 }
 return {freeMiB,tasks,candidates:saved,sourceLineage:inspectSourceLineage(dataRoot,list)};
}
const name=n=>`R54_READINESS_${n}.json`;
export function projectR35Details(details){
 const lineage=details?.sourceLineage??{};
 const runs=lineage.recentRuns?.r47??{};
 const reports=(runs.files??[]).filter(f=>
  R35_DAYS.includes(f?.detail?.targetClosedNYDay)).map(f=>({
   sha256:f.sha256??null,modifiedAt:f.modifiedAt??null,detail:f.detail
  }));
 const manifest=lineage.manifests?.r35??{};
 return {
  r47Task:details.tasks?.find(t=>t.name==='ZGMINI-PC-Theme-Nine-R47-Private')??null,
  r47Reports:{status:runs.status??'UNAVAILABLE',reports},
  r35Manifest:{status:manifest.status??'UNAVAILABLE',
   sha256:manifest.sha256??null,modifiedAt:manifest.modifiedAt??null,
   latestSpyDay:manifest.latestSpyDay??null,pageCount:manifest.pageCount??null},
  r35Evidence:lineage.r35Evidence??null
 };
}
const resultBase=env=>({schema:SCHEMA,status:'BLOCKED',code:'R54_READINESS_NOT_STARTED',
 controlSha:env.GITHUB_SHA??null,runId:String(env.GITHUB_RUN_ID??''),
 providerCalls:0,pcDataWrites:0,databaseWrites:0,d1Writes:0,schedulerWrites:0});
export async function execute({env=process.env,platform=process.platform,inspectFn=inspect}={}){
 let r=resultBase(env),issueNumber=null;
 try{
  if(platform!=='win32')fail('R54_READINESS_WINDOWS_ONLY');
  const event=eventFrom(env),req=validateRequest(event,env);issueNumber=event.issue.number;
  r={...r,issueNumber,requestId:req.requestId,chatId:req.chatId};
  approvalCheck(workspace(env));
  r={...r,status:'PASS',code:'R54_READINESS_OBSERVED_NOT_PUBLISHED',
   details:projectR35Details(inspectFn())};
 }catch(e){r={...r,status:'BLOCKED',code:permitted(e?.code)?e.code:'R54_READINESS_UNEXPECTED_STOP'};}
 if(issueNumber!==null){
  try{fs.writeFileSync(path.join(workspace(env),name(issueNumber)),JSON.stringify(r,null,2)+'\n',{flag:'wx'});}
  catch{r={...r,status:'BLOCKED',code:'R54_READINESS_RESULT_SAVE_DENIED'};}
 }
 process.stdout.write(`STATUS=${r.status} CODE=${r.code} OPERATING_DATA_WRITES=0\n`);
 return r;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=eventFrom(env),req=validateRequest(event,env),base=workspace(env);
 approvalCheck(base);
 const r=JSON.parse(fileBytes(path.join(base,name(event.issue.number)),16384).toString('utf8'));
 if(r.schema!==SCHEMA||r.issueNumber!==event.issue.number||
  r.requestId!==req.requestId||r.chatId!==req.chatId||
  r.controlSha!==env.GITHUB_SHA||r.runId!==String(env.GITHUB_RUN_ID??'')||
  !['PASS','BLOCKED'].includes(r.status)||!permitted(r.code)||!env.GITHUB_TOKEN)
  fail('R54_READINESS_RESULT_DENIED');
 const body=`R35 11월 2·3일 SPY 저장·호출 원장 1회 읽기 전용 진단: **${r.status}** (${r.code})\n\n`+
  '```json\n'+JSON.stringify(r,null,2)+'\n```';
 if(body.length>22000)fail('R54_READINESS_REPORT_TOO_LARGE');
 const res=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${env.GITHUB_TOKEN}`,
   'content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!res.ok)fail('R54_READINESS_UPLOAD_FAILED');
 return {status:'UPLOADED',issueNumber:event.issue.number};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fn){
 if(process.argv.length===2){const r=await execute();if(r.status!=='PASS')process.exitCode=1;}
 else if(process.argv.length===3&&process.argv[2]==='--upload')await upload();
 else fail('R54_READINESS_ARGUMENTS_DENIED');
}
