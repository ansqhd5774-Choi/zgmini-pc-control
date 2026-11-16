// W01 bounded Event129 evidence. READ ONLY; no B coordinator or provider imports.
// All returned data are fixed codes, booleans, counts and bounded differences.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {TextDecoder} from 'node:util';
import {fileURLToPath} from 'node:url';
import {verifyCoreTaskEvent129} from './inflation-event129-b-proof.mjs';
import {coreVbsTaskEventCandidates,verifyCoreVbsTaskWitness,
 assertPinnedVbsLaunchers,APPROVED_VBS_CHAIN_FILES} from './inflation-vbs-b-proof.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const DATA=String.raw`E:\ZGmini\data\pc-writer`;
const PROBE=path.join(ROOT,'inflation-core-owner-diagnostic-probe.js');
const EVENT_TOOL=path.win32.join(process.env.SystemRoot||'C:\\Windows',
 'System32','wevtutil.exe');
const SCRIPT=path.win32.join(process.env.SystemRoot||'C:\\Windows',
 'System32','cscript.exe');
const SCHTASKS=path.win32.join(process.env.SystemRoot||'C:\\Windows',
 'System32','schtasks.exe');
const MAX_RESULT=8192,MAX_XML=300000,MAX_EVENTS=64,MAX_VBS=6;
const sha=b=>createHash('sha256').update(b).digest('hex');
const nowIso=clock=>new Date(clock()).toISOString();
const basic=()=>({status:'STATE_UNKNOWN',code:'INFL_E129_NOT_OBSERVED_WITHIN_LIMIT',
 scope:'CORE_OWNER_EVENT129_READONLY_ONLY',authorizesB:false,
 providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false,
 stage:'START',firstFailCode:null,reader:'NOT_EVALUATED',
 encoding:'NOT_EVALUATED',bom:'NOT_EVALUATED',
 rawBDirect:{ok:null,code:'NOT_EVALUATED'},
 rawBVbs:{ok:null,code:'NOT_EVALUATED',candidates:[]},
 supplemental:{parsed:null,coreCandidates:null,onlySupplemental:false},
 task:{definition:'NOT_EVALUATED',instance:'NOT_EVALUATED'},
 wmi:{status:'NOT_EVALUATED',ownerFound:null,coreMatched:null},
 event:{total:null,systemMatch:null,taskMatch:null,fieldsPresent:null,
  pidMatch:null,timeParsed:null,withinTime:null,candidateCount:null},
 lock:{before:'NOT_EVALUATED',after:'NOT_EVALUATED',same:null},
 snapshots:[],probeCounts:{event:0,taskDefinition:0,wmi:0,lockReads:0}});
const legal=(v,codes)=>codes.includes(v)?v:'UNAVAILABLE';
const delta=(a,b)=>Number.isSafeInteger(a)&&Number.isSafeInteger(b)?
 Math.max(-3600000,Math.min(3600000,a-b)):null;
function snapshot(out,clock,phase){
 if(out.snapshots.length<10)out.snapshots.push({phase,utc:nowIso(clock)});
}
function decode(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>=MAX_XML)return {ok:false,encoding:'UNSUPPORTED',bom:'UNKNOWN',text:null};
 const a=bytes,bom=a.length>=3&&a[0]===239&&a[1]===187&&a[2]===191?'UTF8':
 a.length>=2&&a[0]===255&&a[1]===254?'UTF16LE':
 a.length>=2&&a[0]===254&&a[1]===255?'UTF16BE':'NONE';
 const encoding=bom==='UTF16LE'?'utf-16le':bom==='UTF16BE'?'utf-16be':'utf-8';
 try{
  const text=new TextDecoder(encoding,{fatal:true}).decode(a);
  return {ok:true,encoding:encoding.toUpperCase(),bom,text};
 }catch{return {ok:false,encoding:'UNSUPPORTED',bom,text:null};}
}
// This is auxiliary structure/coverage analysis ONLY; it never authorizes a B proof.
export function describeEvent129(xml,lockPid,ownerCreatedAtMs,lockAt,clock=Date.now){
 const out={parsed:false,total:0,systemMatch:0,taskMatch:0,
  fieldsPresent:0,pidMatch:0,timeParsed:0,withinTime:0,candidateCount:0};
 if(typeof xml!=='string'||xml.length<30||xml.length>=MAX_XML)return out;
 const roots=[...xml.matchAll(/<Event(?:\s[^>]*)?>[\s\S]*?<\/Event>/g)];
 if(roots.length>MAX_EVENTS){out.total=MAX_EVENTS;return out;}
 if(!roots.length||/<Event(?:\s[^>]*)?>/.test(xml.replace(/<Event(?:\s[^>]*)?>[\s\S]*?<\/Event>/g,'')))return out;
 out.parsed=true;out.total=roots.length;
 for(const root of roots){
  const e=root[0];
  if(!/<EventID(?:\s[^>]*)?>129<\/EventID>/.test(e)||
   !/<Provider\s+Name="Microsoft-Windows-TaskScheduler"/.test(e)||
   !/<Channel>Microsoft-Windows-TaskScheduler\/Operational<\/Channel>/.test(e))continue;
  out.systemMatch++;
  if(!e.includes('<Data Name="TaskName">\\ZGMINI-PC-Local-Core</Data>'))continue;
  out.taskMatch++;
  const p=/<Data Name="Path">([^<]{1,320})<\/Data>/.exec(e)?.[1];
  const pid=/<Data Name="ProcessID">([1-9][0-9]{0,9})<\/Data>/.exec(e)?.[1];
  const timestamp=/<TimeCreated\s+SystemTime="([^"]{1,80})"/.exec(e)?.[1];
  if(!p||!pid||!timestamp)continue;
  out.fieldsPresent++;
  if(pid!==String(lockPid))continue;
  out.pidMatch++;
  const t=/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(timestamp)?
   Date.parse(timestamp):NaN;
  if(!Number.isFinite(t))continue;
  out.timeParsed++;
  if(Number.isSafeInteger(ownerCreatedAtMs)&&Number.isSafeInteger(lockAt)&&
   Math.abs(t-ownerCreatedAtMs)<=30000&&t<=lockAt+5000&&lockAt-t<=3600000&&
   ownerCreatedAtMs<=lockAt+5000&&clock()>=lockAt)out.withinTime++;
 }
 out.candidateCount=out.taskMatch;
 return out;
}
function lockReader(){
 try{
  const st=fs.lstatSync(LOCK);
  if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>=512)
   return {status:'INVALID'};
  const bytes=fs.readFileSync(LOCK);
  if(bytes.length!==st.size)return {status:'INVALID'};
  const x=JSON.parse(bytes.toString('utf8'));
  if(!x||Object.keys(x).sort().join(',')!=='at,pid'||
   !Number.isSafeInteger(x.pid)||x.pid<=0||
   !Number.isSafeInteger(x.at)||x.at<946684800000)return {status:'INVALID'};
  return {status:'PRESENT',pid:x.pid,at:x.at,hash:sha(bytes)};
 }catch(e){return {status:e?.code==='ENOENT'?'ABSENT':'UNAVAILABLE'};}
}
function pinHash(file){
 const f=Object.values(APPROVED_VBS_CHAIN_FILES).find(item=>item.path.toLowerCase()===file.toLowerCase());
 if(!f||!file.toLowerCase().startsWith(DATA.toLowerCase()+'\\'))return null;
 try{
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>2000000)return null;
  return sha(fs.readFileSync(file));
 }catch{return null;}
}
function command(binary,args,{timeout=8000,maxBuffer=MAX_XML}={}){
 return spawnSync(binary,args,{shell:false,windowsHide:true,encoding:null,timeout,maxBuffer});
}
function statusOf(p){
 if(p?.error?.code==='ETIMEDOUT'||p?.signal)return 'TIMEOUT';
 if(p?.error||p?.status!==0)return 'ERROR';
 return Buffer.isBuffer(p.stdout)?'OK':'ERROR';
}
function safeProbe(raw){
 if(!Buffer.isBuffer(raw)||raw.length>12000)return null;
 try{
  const p=JSON.parse(raw.toString('utf8').trim());
  if(typeof p?.ok!=='boolean'||typeof p?.taskRunning!=='boolean'||
   typeof p?.linked!=='boolean'||typeof p?.ownerCoreMatched!=='boolean')return null;
  return p;
 }catch{return null;}
}
export async function inspectInflationEvent129Once({
 platform=process.platform,clock=Date.now,readLock=lockReader,
 execute=command,hashFile=pinHash,probePath=PROBE
}={}){
 const out=basic(),finish=()=>{
  if(JSON.stringify(out).length>MAX_RESULT)return {status:'STATE_UNKNOWN',
   code:'INFL_E129_RESULT_LIMIT_STOP',authorizesB:false,
   providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false};
  return out;
 };
 const start=clock();
 if(platform!=='win32'){out.code='INFL_E129_WINDOWS_REQUIRED';return finish();}
 const stop=(code,phase)=>{out.code=code;out.firstFailCode??=code;out.stage=phase;};
 let before=null,after=null,owner=null,bytes=null,eventsText=null;
 try{
  snapshot(out,clock,'BEFORE_LOCK');
  before=readLock();out.probeCounts.lockReads++;out.lock.before=legal(before?.status,['PRESENT','ABSENT','INVALID','UNAVAILABLE']);
  if(before?.status!=='PRESENT'){stop('INFL_E129_LOCK_NOT_VERIFIED','LOCK');return finish();}
  if(clock()-start>78000){stop('INFL_E129_TIME_BUDGET_STOP','TIME');return finish();}
  snapshot(out,clock,'TASK_DEFINITION');
  const task=execute(SCHTASKS,['/Query','/TN','ZGMINI-PC-Local-Core','/XML'],{timeout:8000,maxBuffer:262144});
  out.probeCounts.taskDefinition++;
  out.task.definition=statusOf(task);
  if(out.task.definition!=='OK'){stop('INFL_E129_TASK_DEFINITION_UNAVAILABLE','TASK');return finish();}
  snapshot(out,clock,'WMI_OWNER');
  const initial=execute(SCRIPT,['//NoLogo','//E:JScript',probePath,String(before.pid)],{timeout:7000,maxBuffer:12000});
  out.probeCounts.wmi++;
  owner=statusOf(initial)==='OK'?safeProbe(initial.stdout):null;
  out.task.instance=owner?.taskInstanceStatus??'ERROR';
  out.wmi.status=owner?.wmiStatus??'ERROR';
  out.wmi.ownerFound=typeof owner?.ownerFound==='boolean'?owner.ownerFound:null;
  out.wmi.coreMatched=typeof owner?.ownerCoreMatched==='boolean'?owner.ownerCoreMatched:null;
  if(!owner||owner.ok!==true){
   stop('INFL_E129_TASK_OR_WMI_UNAVAILABLE','WMI');return finish();
  }
  snapshot(out,clock,'EVENT129');
  const raw=execute(EVENT_TOOL,['qe','Microsoft-Windows-TaskScheduler/Operational',
    '/q:*[System[(EventID=129)]]','/rd:true','/c:64','/f:xml'],{timeout:12000,maxBuffer:MAX_XML});
  out.probeCounts.event++;
  out.reader=statusOf(raw);
  if(out.reader!=='OK'){stop('INFL_E129_READER_UNAVAILABLE','READER');return finish();}
  bytes=raw.stdout;
  const decoded=decode(bytes);
  out.encoding=decoded.encoding;out.bom=decoded.bom;
  eventsText=bytes.toString('utf8'); // EXACT current B encoding behavior (no repair).
  const extra=describeEvent129(eventsText,before.pid,owner.ownerCreatedAtMs,before.at,clock);
  out.event={total:extra.total,systemMatch:extra.systemMatch,taskMatch:extra.taskMatch,
   fieldsPresent:extra.fieldsPresent,pidMatch:extra.pidMatch,timeParsed:extra.timeParsed,
   withinTime:extra.withinTime,candidateCount:extra.candidateCount};
  if(decoded.ok){
   const aux=describeEvent129(decoded.text,before.pid,owner.ownerCreatedAtMs,before.at,clock);
   out.supplemental={parsed:aux.parsed,coreCandidates:aux.taskMatch,
    onlySupplemental:aux.taskMatch>0&&extra.taskMatch===0};
  }
  const direct=verifyCoreTaskEvent129({xml:eventsText,lockPid:before.pid,
   lockAt:before.at,ownerCreatedAtMs:owner.ownerCreatedAtMs,
   taskRunning:owner.taskRunning,ownerCoreMatched:owner.ownerCoreMatched,now:clock()});
  out.rawBDirect={ok:direct.ok,code:direct.code};
  if(direct.ok===true){out.status='PASS';out.code='INFL_E129_B_DIRECT_LINK_OBSERVED';out.stage='PROOF';return finish();}
  const candidates=coreVbsTaskEventCandidates(eventsText,{now:clock()});
  out.rawBVbs.code=candidates.length?'INFL_E129_CANDIDATES_UNVERIFIED':
   'INFL_E129_NOT_OBSERVED_WITHIN_LIMIT';
  out.rawBVbs.ok=false;
  for(const candidate of candidates.slice(0,MAX_VBS)){
   if(clock()-start>78000){stop('INFL_E129_TIME_BUDGET_STOP','WMI');break;}
   snapshot(out,clock,'WMI_VBS');
   const w=execute(SCRIPT,['//NoLogo','//E:JScript',probePath,
    String(before.pid),String(candidate.pid)],{timeout:7000,maxBuffer:12000});
   out.probeCounts.wmi++;
   const witness=statusOf(w)==='OK'?safeProbe(w.stdout):null;
   let candidateCode='INFL_E129_WMI_UNAVAILABLE';
   if(witness?.ok===true){
    const result=verifyCoreVbsTaskWitness({candidate,witness,lockAt:before.at,
     ownerCreatedAtMs:owner.ownerCreatedAtMs,taskRunning:owner.taskRunning,
     ownerCoreMatched:owner.ownerCoreMatched,now:clock()});
    candidateCode=result.code;
    if(result.ok){
     try{
      assertPinnedVbsLaunchers(witness.approvedLauncherKinds,hashFile);
      out.rawBVbs.ok=true;out.rawBVbs.code='INFL_MANUAL_B_CORE_TASK_VBS_CHAIN_LINKED';
     }catch{candidateCode='INFL_E129_LAUNCHER_HASH_UNVERIFIED';}
    }else if(witness.taskVbsLinked===false){
     candidateCode='INFL_E129_VBS_ANCESTRY_UNVERIFIED';
    }
   }
   out.rawBVbs.candidates.push({code:candidateCode,
    ancestry:witness?.taskVbsLinked??null,
    hashMatched:candidateCode==='INFL_MANUAL_B_CORE_TASK_VBS_CHAIN_LINKED'?true:
     candidateCode==='INFL_E129_LAUNCHER_HASH_UNVERIFIED'?false:null});
   if(out.rawBVbs.ok){out.status='PASS';out.code='INFL_E129_B_VBS_LINK_OBSERVED';break;}
  }
  if(out.status!=='PASS'&&out.firstFailCode===null)
   stop('INFL_E129_NOT_OBSERVED_WITHIN_LIMIT','PROOF');
  return finish();
 }catch{
  stop('INFL_E129_READONLY_EXCEPTION_STOP','ERROR');return finish();
 }finally{
  snapshot(out,clock,'AFTER_LOCK');
  try{
   after=readLock();out.probeCounts.lockReads++;
   out.lock.after=legal(after?.status,['PRESENT','ABSENT','INVALID','UNAVAILABLE']);
   out.lock.same=before?.status==='PRESENT'&&after?.status==='PRESENT'?
    before.hash===after.hash:null;
   if(out.lock.same!==true){
    out.status='STATE_UNKNOWN';out.code='INFL_E129_LOCK_SNAPSHOT_RACE';
    out.firstFailCode='INFL_E129_LOCK_SNAPSHOT_RACE';
   }
  }catch{
   out.lock.after='UNAVAILABLE';out.lock.same=null;
   out.status='STATE_UNKNOWN';out.code='INFL_E129_LOCK_SNAPSHOT_RACE';
  }
  // Must never advertise success without a stable lock, nor confuse an auxiliary parse with B.
  if(clock()-start>80000){out.status='STATE_UNKNOWN';out.code='INFL_E129_TIME_BUDGET_STOP';}
 }
}
