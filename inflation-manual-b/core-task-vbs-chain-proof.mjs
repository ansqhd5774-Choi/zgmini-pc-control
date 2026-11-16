// V2-only safe proof for TaskScheduler Event129 wscript.exe -> approved VBS
// -> live WMI ancestry -> approved lock-owning Core Node. Never trusts name alone.
export const APPROVED_VBS_CHAIN_FILES=Object.freeze({
 TASK_VBS:Object.freeze({path:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs',
  sha256:'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c'}),
 CUTOVER_VBS:Object.freeze({path:'E:\\ZGmini\\data\\pc-writer\\cutover-evidence\\inflation-r37-2026-10-20T19-39-19-549Z\\run-local-core.vbs',
  sha256:'bb3e11c0b5c8da07162b1c824e7b52e7a7c2f987c079f29713211a2413932b01'}),
 ARCHIVE_NODE:Object.freeze({path:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\archive-run.mjs',
  sha256:'ce07af0b5e8d17625644e204f2815c754aff2468bc5434ac13c0dadcecd907'}),
 ARCHIVE_CORE_NODE:Object.freeze({path:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\archive-core-r10.mjs',
  sha256:'e96d9ba669ee053d0b3558db36f1f5f7a28648b8ea26b7937f62a19bb4495c84'}),
});
const TASK='\\ZGMINI-PC-Local-Core';
const CHANNEL='Microsoft-Windows-TaskScheduler/Operational';
const EVENT=/<Event(?:\s[^>]*)?>[\s\S]*?<\/Event>/g;
const KINDS=new Set(Object.keys(APPROVED_VBS_CHAIN_FILES));
const strictIso=s=>typeof s==='string'&&
 /^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s)&&
 Number.isFinite(Date.parse(s));
const wscript=s=>{
 const norm=typeof s==='string'?s.replace(/"/g,'').replace(/\//g,'\\').toLowerCase():null;
 return norm==='wscript.exe'||norm==='c:\\windows\\system32\\wscript.exe'||
  norm==='c:\\windows\\syswow64\\wscript.exe';
};
const refused=()=>Object.freeze({ok:false,code:'INFL_MANUAL_B_EVENT129_VBS_CHAIN_UNVERIFIED'});

// Parse eligible event roots only. No event alone proves ownership.
export function coreVbsTaskEventCandidates(xml,{now=Date.now()}={}){
 if(typeof xml!=='string'||xml.length<30||xml.length>=300_000||
  !Number.isSafeInteger(now)||now<946684800000)return [];
 const out=[];
 let count=0;
 for(const match of xml.matchAll(EVENT)){
  if(++count>64)return [];
  const event=match[0];
  if(!/<EventID(?:\s[^>]*)?>129<\/EventID>/.test(event)||
   !/<Provider\s+Name="Microsoft-Windows-TaskScheduler"/.test(event)||
   !event.includes('<Channel>'+CHANNEL+'</Channel>')||
   !event.includes('<Data Name="TaskName">'+TASK+'</Data>'))continue;
  const path=/<Data Name="Path">([^<]{1,320})<\/Data>/.exec(event)?.[1];
  const pid=/<Data Name="ProcessID">([1-9][0-9]{0,9})<\/Data>/.exec(event)?.[1];
  const iso=/<TimeCreated\s+SystemTime="([^"]{1,80})"/.exec(event)?.[1];
  if(!wscript(path)||!pid||!strictIso(iso))continue;
  const at=Date.parse(iso);
  if(at>now+60_000||now-at>3_600_000)continue;
  out.push(Object.freeze({pid:Number(pid),eventAt:at}));
 }
 return Object.freeze(out.slice(0,6));
}

// WSH reports no process IDs, commands, credentials or absolute paths.
export function verifyCoreVbsTaskWitness({
 candidate,witness,lockAt,ownerCreatedAtMs,taskRunning,ownerCoreMatched,
 now=Date.now(),
}={}){
 if(!candidate||!Number.isSafeInteger(candidate.pid)||candidate.pid<=0||
  !Number.isSafeInteger(candidate.eventAt)||
  !Number.isSafeInteger(lockAt)||!Number.isSafeInteger(ownerCreatedAtMs)||
  !Number.isSafeInteger(now)||taskRunning!==true||ownerCoreMatched!==true||
  witness?.ok!==true||witness?.taskVbsLinked!==true||
  witness?.taskRunning!==true||witness?.ownerCoreMatched!==true||
  witness?.ownerCreatedAtMs!==ownerCreatedAtMs||
  !Number.isSafeInteger(witness?.taskVbsCreatedAtMs)||
  !Array.isArray(witness?.approvedLauncherKinds)||
  witness.approvedLauncherKinds.length<1||witness.approvedLauncherKinds.length>12||
  witness.approvedLauncherKinds.at(-1)!=='TASK_VBS'||
  witness.approvedLauncherKinds.some(x=>!KINDS.has(x))||
  Math.abs(candidate.eventAt-witness.taskVbsCreatedAtMs)>30_000||
  candidate.eventAt>lockAt+5_000||
  witness.taskVbsCreatedAtMs>ownerCreatedAtMs+1_000||
  ownerCreatedAtMs>lockAt+5_000||now<lockAt||
  now-lockAt>=3_600_000||
  lockAt-witness.taskVbsCreatedAtMs>=3_600_000)return refused();
 return Object.freeze({ok:true,code:'INFL_MANUAL_B_CORE_TASK_VBS_CHAIN_LINKED',
  proof:'TASKSCHEDULER_EVENT129_WMI_APPROVED_VBS_CHAIN_LOCK'});
}

export function assertPinnedVbsLaunchers(kinds,hashFile){
 const fail=()=>{throw Object.assign(new Error('INFL_MANUAL_B_VBS_LAUNCHER_SOURCE_STOP'),
  {code:'INFL_MANUAL_B_VBS_LAUNCHER_SOURCE_STOP'});};
 if(!Array.isArray(kinds)||kinds.length<1||kinds.length>12||
  kinds.at(-1)!=='TASK_VBS'||typeof hashFile!=='function')fail();
 for(const kind of new Set(kinds)){
  const f=APPROVED_VBS_CHAIN_FILES[kind];
  if(!f||hashFile(f.path)!==f.sha256)fail();
 }
 return true;
}
