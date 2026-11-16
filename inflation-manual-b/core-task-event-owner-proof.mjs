// Optional, strictly read-only identity proof when Task Scheduler GetInstances(0)
// is security-context filtered. This DOES NOT relax a failed/unavailable proof.
// TaskScheduler/Operational event 129 binds ONE fixed Core task to the process
// PID that it launched; WMI independently proves the same live PID owns the
// immutable lock and is the approved Node Core script. No log changes, writes,
// raw events, paths or credentials may be emitted in result objects.
export const CORE_EVENT129_TASK=String.raw`\ZGMINI-PC-Local-Core`;
export const CORE_EVENT129_NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const MAX_XML=300_000;
const MAX_EVENTS=64;
const EVENT=/\<Event(?:\s[^>]*)?\>[\s\S]*?\<\/Event\>/g;
const date=x=>typeof x==='string'&&
 /^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x)&&
 Number.isFinite(Date.parse(x))?Date.parse(x):null;
// Only the three fixed documented Event 129 fields are used. No dynamic
// regex construction, external XPath, event text or untrusted XML commands.
const taskName=xml=>/<Data Name="TaskName">([^<]{1,320})<\/Data>/.exec(xml)?.[1]??null;
const imagePath=xml=>/<Data Name="Path">([^<]{1,320})<\/Data>/.exec(xml)?.[1]??null;
const eventPid=xml=>/<Data Name="ProcessID">([1-9][0-9]{0,9})<\/Data>/.exec(xml)?.[1]??null;
const norm=x=>typeof x==='string'?x.replace(/\//g,'\\').replace(/^"|"$/g,'').toLowerCase():null;
const reason=(code)=>Object.freeze({ok:false,code});
// A V2 approval can attempt the independent event+WMI identity proof even
// when GetInstances(0) hides the Core Task. This is ONLY an observation gate,
// not an authorization to accept a lock owner without exact Event 129 proof.
// V1 must retain its existing visible Task/related process requirement.
export function shouldAttemptCoreOwnerProof(isV2,probe,lockPresent){
 return lockPresent===true&&(isV2===true||
  (probe?.instances>0&&probe?.relatedProcesses>0));
}
// A non-Core lock owner or an unmatched recent Task event can be transient
// because Korea and Core share local-cycle.lock. V2 waits ONLY for these
// inconclusive, bounded observations; it never authorizes a provider GET.
// An unreadable event log, failed WMI or malformed lock remains a hard stop.
export function shouldWaitForV2OwnerEvidence({
 isV2,linked,taskRunning,ownerKoreaMatched,eventCode,
}={}){
 return isV2===true&&linked===false&&(
  ownerKoreaMatched===true||taskRunning===false||
  (taskRunning===true&&
   eventCode==='INFL_MANUAL_B_EVENT129_TASK_PID_NOT_VERIFIED'));
}
export function verifyCoreTaskEvent129({
 xml,lockPid,lockAt,ownerCreatedAtMs,taskRunning,ownerCoreMatched,now=Date.now(),
}={}){
 if(typeof xml!=='string'||xml.length<30||xml.length>MAX_XML||
  !Number.isSafeInteger(lockPid)||lockPid<=0||
  !Number.isSafeInteger(lockAt)||lockAt<=946684800000||lockAt>now+60_000||
  !Number.isSafeInteger(ownerCreatedAtMs)||ownerCreatedAtMs<946684800000||
  !Number.isSafeInteger(now)||now<=0||taskRunning!==true||
  ownerCoreMatched!==true)
  return reason('INFL_MANUAL_B_EVENT129_INPUT_UNVERIFIED');
 let count=0;
 for(const match of xml.matchAll(EVENT)){
  if(++count>MAX_EVENTS)return reason('INFL_MANUAL_B_EVENT129_LOG_TOO_LARGE');
  const event=match[0];
  // Windows task provider and operational channel are bound to this record;
  // event 129 is a direct TaskName -> action ProcessID link.
  if(!/<EventID(?:\s[^>]*)?>129<\/EventID>/.test(event)||
   !/<Provider\s+Name="Microsoft-Windows-TaskScheduler"/.test(event)||
   !/<Channel>Microsoft-Windows-TaskScheduler\/Operational<\/Channel>/.test(event))
   continue;
  const name=taskName(event);
  const image=imagePath(event);
  const pid=eventPid(event);
  const timestamp=/<TimeCreated\s+SystemTime="([^"]{1,80})"/.exec(event)?.[1]??null;
  const when=date(timestamp);
  if(name!==CORE_EVENT129_TASK||
   norm(image)!==norm(CORE_EVENT129_NODE)||
   pid!==String(lockPid)||when===null)continue;
  // Bound the event to the *current* PID incarnation and its held Core lock:
  // a recycled Windows PID or a prior scheduled run can never authenticate.
  if(Math.abs(when-ownerCreatedAtMs)>30_000||
   when>lockAt+5_000||lockAt-when>3_600_000||
   ownerCreatedAtMs>lockAt+5_000||now<lockAt)
   continue;
  return Object.freeze({ok:true,code:'INFL_MANUAL_B_CORE_TASK_EVENT129_PID_LINKED',
   proof:'TASKSCHEDULER_OPERATIONAL_129_PLUS_LIVE_WMI_AND_LOCK'});
 }
 return reason('INFL_MANUAL_B_EVENT129_TASK_PID_NOT_VERIFIED');
}
