// Fixed one-shot Windows read-only process/operating-mode inventory.
// Never read process command lines, full environment, secrets, user profiles, credentials or DB content.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authenticate,validateSeat} from './pc-host-inventory-readonly.mjs';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';
import {collectAutomationStatus} from './automation-status.mjs';
import {maintenanceLockStatus} from './maintenance-lock.mjs';
import {createHash} from 'node:crypto';

export const TITLE='pc-process-inventory-readonly';
export const SCHEMA='ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1';
export const ROLE_OPERATION='process-inventory-readonly';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const MAX_BYTES=32768;
const KNOWN_PROCESSES=new Set([
 'runner.listener.exe','runner.worker.exe','node.exe','wscript.exe','cscript.exe',
 'powershell.exe','pwsh.exe','cmd.exe','conhost.exe','git.exe','gh.exe','python.exe',
 'pythonw.exe','dism.exe','dismhost.exe','oscdimg.exe','wrangler.exe'
]);
const PS_SCRIPT=[
 "$ErrorActionPreference = 'Stop'",
 "$names = @('Runner.Listener.exe','Runner.Worker.exe','node.exe','wscript.exe','cscript.exe','powershell.exe','pwsh.exe','cmd.exe','conhost.exe','git.exe','gh.exe','python.exe','pythonw.exe','dism.exe','dismhost.exe','oscdimg.exe','wrangler.exe')",
 "$processes = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)",
 "$filtered = @($processes | Where-Object { $names -contains $_.Name })",
 "$counts = @($filtered | Group-Object Name | Sort-Object Name | ForEach-Object { [pscustomobject]@{name=[string]$_.Name;count=[int]$_.Count} })",
 "$selected = @($filtered | Sort-Object @{Expression={ if ($_.Name -match '(?i)^Runner\\.') {0} elseif ($_.Name -match '(?i)^(wscript|cscript)\\.exe$') {1} elseif ($_.Name -match '(?i)^node\\.exe$') {2} elseif ($_.Name -match '(?i)^(powershell|pwsh)\\.exe$') {3} elseif ($_.Name -match '(?i)^cmd\\.exe$') {4} else {5} }},Name,ProcessId | Select-Object -First 60 | ForEach-Object {",
 " [pscustomobject]@{name=[string]$_.Name;pid=[int]$_.ProcessId;ppid=[int]$_.ParentProcessId;session=[int]$_.SessionId;workingSetMiB=[int][math]::Floor(([double]$_.WorkingSetSize)/1048576)}",
 "})",
 "$services=@()",
 "$serviceStatus='OK'",
 "try { $services=@(Get-CimInstance -ClassName Win32_Service -ErrorAction Stop | Where-Object { $_.Name -match '(?i)^(actions\\.runner\\.|zgmini)' } | Sort-Object Name | Select-Object -First 24 | ForEach-Object { [pscustomobject]@{ name=[string]$_.Name;state=[string]$_.State;startMode=[string]$_.StartMode } }) } catch { $serviceStatus='UNAVAILABLE' }",
 "$tasks=@()",
 "$taskStatus='OK'",
 "try { $tasks=@(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -match '(?i)^ZGMINI[-_ ]' } | Sort-Object TaskName | Select-Object -First 48 | ForEach-Object { [pscustomobject]@{name=[string]$_.TaskName;state=[string]$_.State} }) } catch { $taskStatus='UNAVAILABLE' }",
 "$startup=@()",
 "$startupStatus='OK'",
 "try { $folder=Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Startup'; if (Test-Path -LiteralPath $folder -PathType Container) { $startup=@(Get-ChildItem -LiteralPath $folder -File -ErrorAction Stop | Where-Object { $_.Name -match '(?i)^ZGMINI[-_. ]' } | Select-Object -First 24 | ForEach-Object { [string]$_.Name }) } } catch { $startupStatus='UNAVAILABLE' }",
 "$result=[ordered]@{schema='ZGMINI_PC_PROCESS_PROBE_V1';observedAtUtc=(Get-Date).ToUniversalTime().ToString('o');totalProcessCount=$processes.Count;selectedProcessCount=$filtered.Count;processCounts=@($counts);processes=@($selected);services=@($services);serviceStatus=$serviceStatus;tasks=@($tasks);taskStatus=$taskStatus;startup=@($startup);startupStatus=$startupStatus}",
 "$result | ConvertTo-Json -Compress -Depth 8"
].join('; ');

function fail(code){const err=new Error(code);err.code=code;throw err;}
function simple(s,max=100){return String(s??'').replace(/[^a-zA-Z0-9 ._()-]/g,'?').slice(0,max);}
function smallInt(v,limit=2147483647){return Number.isSafeInteger(v)&&v>=0&&v<=limit?v:null;}
function safeList(a,max){return Array.isArray(a)?a.slice(0,max):[];}
export function authenticateProcess(event,env,role){
 // Reuse exact event/actor/run provenance checks by validating a transformed
 // fixed schema: never accept extra or arbitrary command arguments.
 if(!['operating','handoff'].includes(role))fail('ROLE_INVALID');
 let raw;
 try{raw=JSON.parse(event?.issue?.body??'');}catch{fail('REQUEST_JSON_INVALID');}
 if(!raw||Object.keys(raw).sort().join(',')!=='operation,requestId,role,schema'||
   raw.schema!==SCHEMA||raw.operation!==ROLE_OPERATION||raw.role!==role)fail('REQUEST_SCOPE_INVALID');
 const normalized=structuredClone(event);
 normalized.issue.title='pc-host-inventory-readonly';
 normalized.issue.body=JSON.stringify({schema:'ZGMINI_PC_HOST_INVENTORY_REQUEST_V1',
  operation:'host-inventory-readonly',requestId:raw.requestId,role});
 if(event.issue.title!==TITLE)fail('ISSUE_TITLE_INVALID');
 return authenticate(normalized,env,role);
}
export function sanitizeProbe(raw){
 if(!raw||raw.schema!=='ZGMINI_PC_PROCESS_PROBE_V1')fail('PROBE_SCHEMA_INVALID');
 const processes=safeList(raw.processes,60).map(p=>{
   const name=simple(p?.name,60);
   if(!KNOWN_PROCESSES.has(name.toLowerCase()))fail('PROBE_PROCESS_NOT_ALLOWLISTED');
   if(smallInt(p.pid)===null||smallInt(p.ppid)===null)fail('PROBE_PID_INVALID');
   return {name,pid:p.pid,ppid:p.ppid,session:smallInt(p.session,1000),
    workingSetMiB:smallInt(p.workingSetMiB,200000)};
 });
 const processCounts=safeList(raw.processCounts,24).map(p=>{
  const name=simple(p?.name,60);
  if(!KNOWN_PROCESSES.has(name.toLowerCase())||smallInt(p.count,100000)===null)
   fail('PROBE_PROCESS_COUNT_INVALID');
  return {name,count:p.count};
 });
 const services=safeList(raw.services,24).map(s=>{
  const name=simple(s?.name,110);
  if(!/^(actions\.runner\.|zgmini)/i.test(name))fail('PROBE_SERVICE_NOT_ALLOWLISTED');
  return {name,state:simple(s.state,32),startMode:simple(s.startMode,32)};
 });
 const tasks=safeList(raw.tasks,48).map(t=>{
  const name=simple(t?.name,110);
  if(!/^ZGMINI[-_ ]/i.test(name))fail('PROBE_TASK_NOT_ALLOWLISTED');
  return {name,state:simple(t.state,32)};
 });
 const startup=safeList(raw.startup,24).map(n=>{
   const name=simple(n,110);
   if(!/^ZGMINI[-_. ]/i.test(name))fail('PROBE_STARTUP_NOT_ALLOWLISTED');
   return name;
 });
 const mode=x=>x==='OK'?'OK':'UNAVAILABLE';
 return {observedAtUtc:/^\d{4}-\d\d-\d\dT/.test(raw.observedAtUtc||'')?
    String(raw.observedAtUtc).slice(0,32):null,
  totalProcessCount:smallInt(raw.totalProcessCount,100000),
  selectedProcessCount:smallInt(raw.selectedProcessCount,100000),
  processes,processCounts,services,serviceStatus:mode(raw.serviceStatus),
  tasks,taskStatus:mode(raw.taskStatus),startup,startupStatus:mode(raw.startupStatus),
  processListTruncated:smallInt(raw.selectedProcessCount,100000)>processes.length};
}

const SHA40=/^[a-f0-9]{40}$/;
const asSha=x=>typeof x==='string'&&SHA40.test(x)?x:null;
const asBool=x=>typeof x==='boolean'?x:null;
// Only fixed, bounded fields leave the operating PC. Never return a full
// owner/lease/claim object, source path, nonce, credential or environment.
export function sanitizeMaintenanceStatus(raw){
 const diagnostics=Array.isArray(raw?.diagnostics)?raw.diagnostics:[];
 const lockKnown=Boolean(raw?.installLock&&typeof raw.installLock==='object'&&
  !diagnostics.includes('INSTALL_LEASE_UNAVAILABLE'));
 const sourceSha=asSha(raw?.maintenanceSourceSha);
 const sourceVerified=asBool(raw?.maintenanceFilesVerified);
 const held=lockKnown?asBool(raw.installLock.held):null;
 const recoveryRequired=lockKnown?asBool(raw.installLock.recoveryRequired):null;
 const observedAt=typeof raw?.observedAt==='string'&&
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(raw.observedAt)?
  raw.observedAt.slice(0,32):null;
 return {
  status:sourceSha&&sourceVerified===true&&held!==null&&
   recoveryRequired!==null?'PASS':'STATE_UNKNOWN',
  code:sourceSha?'MAINTENANCE_SOURCE_READONLY':'MAINTENANCE_SOURCE_UNVERIFIED',
  observedAtUtc:observedAt,maintenanceSourceSha:sourceSha,
  maintenanceFilesVerified:sourceVerified,
  actualControllerSha:asSha(raw?.actualControllerSha),
  controllerFilesVerified:asBool(raw?.controllerFilesVerified),
  installLockReadbackVerified:lockKnown,
  installLockHeld:held,installLockRecoveryRequired:recoveryRequired,
  receiverStatus:raw?.receiverStatus==='LISTENING'?'LISTENING':'UNVERIFIED',
  workflowState:raw?.workflowState==='active'?'active':'UNVERIFIED',
  operationalWrites:0,providerCalls:0,d1Writes:0
 };
}
function collectMaintenanceStatusReadonly(){
 try{return sanitizeMaintenanceStatus(collectAutomationStatus([]));}
 catch{return sanitizeMaintenanceStatus(null);}
}


const C996_ID='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const C996_TARGET='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const C1501_ID='pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b';
const C1501_TARGET='b2ff49dd14a09ebeba482e2ae9a84530e00f094f';
const MAINTENANCE_ROOT='E:/ZGmini/automation/pc-maintenance';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const c996Unknown=code=>({status:'STATE_UNKNOWN',code,
 ownerPid:null,ownerMarkerIdentityMatched:false,ledger996Matched:false,
 ledgerMarkerTimeMatched:false,unchangedAcrossReads:false,
 ownerSha256:null,markerSha256:null,ledgerSha256:null,
 operationalWrites:0,providerCalls:0,d1Writes:0});
// Return a bounded read-only correlation result. Neither the raw owner nonce,
// original ledger/body, absolute paths nor recovery marker is published.
export function classify996LeaseCorrelation({lockBefore,lockAfter,first,second}={},
 {requestId=C996_ID,issueNumber=996,targetSha=C996_TARGET}={}){
 if(lockBefore?.held!==true||lockBefore?.recoveryRequired!==true||
    lockAfter?.held!==true||lockAfter?.recoveryRequired!==true)
  return c996Unknown('C996_ACTIVE_RECOVERY_LEASE_NOT_VERIFIED');
 if(!first||!second||!['owner','marker','ledger'].every(k=>
    Buffer.isBuffer(first[k])&&Buffer.isBuffer(second[k])&&
    first[k].length>0&&first[k].length<=32768&&
    first[k].equals(second[k])))
  return c996Unknown('C996_ORIGINAL_SNAPSHOT_UNVERIFIED');
 let owner,marker,ledger;
 try{
  owner=JSON.parse(first.owner.toString('utf8'));
  marker=JSON.parse(first.marker.toString('utf8'));
  ledger=JSON.parse(first.ledger.toString('utf8'));
 }catch{return c996Unknown('C996_ORIGINAL_JSON_UNVERIFIED');}
 const pid=Number.isSafeInteger(owner?.pid)&&owner.pid>0?owner.pid:null;
 const nonceOk=typeof owner?.nonce==='string'&&
  /^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(owner.nonce);
 const ownerMarkerIdentityMatched=Boolean(pid&&nonceOk&&marker?.nonce===owner.nonce&&
  marker?.requestOwnerPid===pid&&lockBefore.ownerPid===pid&&lockAfter.ownerPid===pid);
 const ledger996Matched=ledger?.requestId===requestId&&ledger?.issueNumber===issueNumber&&
  ledger?.targetSha===targetSha;
 const tLedger=Date.parse(ledger?.updatedAt??''),tMarker=Date.parse(marker?.at??''),
  tOwner=Date.parse(owner?.at??'');
 const ledgerMarkerTimeMatched=Number.isFinite(tLedger)&&
  Number.isFinite(tMarker)&&Number.isFinite(tOwner)&&
  Math.abs(tLedger-tMarker)<5000&&tOwner<=tMarker;
 const matched=ownerMarkerIdentityMatched&&ledger996Matched&&ledgerMarkerTimeMatched;
 return {status:matched?'CORRELATED':'STATE_UNKNOWN',
  code:matched?'C996_LEASE_IDENTITY_CORRELATED':'C996_LEASE_IDENTITY_UNPROVEN',
  ownerPid:ownerMarkerIdentityMatched?pid:null,
  ownerMarkerIdentityMatched,ledger996Matched,ledgerMarkerTimeMatched,
  unchangedAcrossReads:true,
  ownerSha256:sha256(first.owner),markerSha256:sha256(first.marker),
  ledgerSha256:sha256(first.ledger),
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function inspect996LeaseCorrelation({
 read=fs.readFileSync,stat=fs.lstatSync,
 lock=()=>maintenanceLockStatus(MAINTENANCE_ROOT,'controller-install')}={}){
 try{
  const before=lock();
  if(before?.held!==true||before?.recoveryRequired!==true)
   return c996Unknown('C996_ACTIVE_RECOVERY_LEASE_NOT_VERIFIED');
  const fixed={
   owner:path.join(MAINTENANCE_ROOT,'leases/controller-install/owner.json'),
   marker:path.join(MAINTENANCE_ROOT,'leases/controller-install/RECOVERY_REQUIRED.json'),
   ledger:path.join(MAINTENANCE_ROOT,'ledger',C996_ID+'.json')
  };
  const snapshot=()=>Object.fromEntries(Object.entries(fixed).map(([k,f])=>{
   const st=stat(f);
   if(!st.isFile()||st.size<1||st.size>32768)
    throw Error('C996_FIXED_ORIGINAL_FILE_INVALID');
   return [k,read(f)];
  }));
  const first=snapshot(),second=snapshot(),after=lock();
  return classify996LeaseCorrelation({lockBefore:before,lockAfter:after,first,second});
 }catch{return c996Unknown('C996_ORIGINAL_FILES_UNAVAILABLE');}
}

// Fixed #1501 probe uses the same double-read, exact-identity and timestamp
// evidence as #996. This is an independent read-only comparison, not evidence
// that an old recovery issue remains the owner of a CURRENT lease.
const as1501=row=>{
 const {ledger996Matched,...rest}=row;
 return {...rest,code:rest.code.replace(/^C996_/,'C1501_'),
  ledger1501Matched:ledger996Matched};
};
export function classify1501LeaseCorrelation(snapshot){
 return as1501(classify996LeaseCorrelation(snapshot,
  {requestId:C1501_ID,issueNumber:1501,targetSha:C1501_TARGET}));
}
const SAFE_RECOVERY_PHASES=new Set([
 'RECEIVED','VALIDATED','STAGED','INTAKE_PAUSED','DRAINED','BACKED_UP',
 'SUPERVISOR_STOPPED','SWITCHED','RECONNECTED','INTAKE_RESUMED',
 'BACKLOG_RECONCILED','POSTCHECK_PENDING','PASS','BLOCKED','ROLLED_BACK',
 'RECOVERY_REQUIRED']);
const SAFE_RECOVERY_STATUS=new Set(['RUNNING','UNKNOWN','PASS','BLOCKED',
 'ROLLED_BACK','RECOVERY_REQUIRED']);
const safeOperation=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(s)?s:null;
const safeFlag=x=>typeof x==='boolean'?x:null;
// A PID probe cannot prove process identity, because Windows can recycle PIDs.
// Never interpret a visible PID as ownership of the original maintenance lease.
function pidObservation(pid,signal=process.kill){
 if(!Number.isSafeInteger(pid)||pid<=0)return 'UNKNOWN';
 try{signal(pid,0);return 'PID_PRESENT_IDENTITY_UNVERIFIED';}
 catch(e){return e?.code==='ESRCH'?'PID_NOT_PRESENT':'UNKNOWN';}
}
export function classify1501RecoveryCheckpoint({lockBefore,lockAfter,first,second},
 {signal=process.kill,backupPresent=null,backlogPresent=null}={}){
 const correlation=classify1501LeaseCorrelation({lockBefore,lockAfter,first,second});
 const empty={...correlation,ledgerPhase:null,ledgerFirstFail:null,
  ledgerStatus:null,ledgerFailureOperation:null,ledgerIntakePaused:null,
  ledgerWorkflowEnabled:null,ownerPidObservation:'UNKNOWN',
  backupPresent:null,backlogPresent:null,eligibleForAutomaticRelease:false};
 if(correlation.status!=='CORRELATED')return empty;
 let ledger;
 try{ledger=JSON.parse(first.ledger.toString('utf8'));}catch{return empty;}
 return {...empty,
  ledgerPhase:SAFE_RECOVERY_PHASES.has(ledger.phase)?ledger.phase:null,
  ledgerFirstFail:SAFE_RECOVERY_PHASES.has(ledger.firstFail)?ledger.firstFail:null,
  ledgerStatus:SAFE_RECOVERY_STATUS.has(ledger.status)?ledger.status:null,
  ledgerFailureOperation:safeOperation(ledger.failureOperation),
  ledgerIntakePaused:safeFlag(ledger.intakePaused),
  ledgerWorkflowEnabled:safeFlag(ledger.workflowEnabled),
  ownerPidObservation:pidObservation(correlation.ownerPid,signal),
  backupPresent:safeFlag(backupPresent),backlogPresent:safeFlag(backlogPresent),
  eligibleForAutomaticRelease:false};
}
function fixedPathExists(p,stat=fs.lstatSync){
 try{stat(p);return true;}catch(e){return e?.code==='ENOENT'?false:null;}
}
export function inspect1501LeaseCorrelation({
 read=fs.readFileSync,stat=fs.lstatSync,
 lock=()=>maintenanceLockStatus(MAINTENANCE_ROOT,'controller-install'),
 signal=process.kill}={}){
 try{
  const before=lock();
  if(before?.held!==true||before?.recoveryRequired!==true)
   return as1501(c996Unknown('C996_ACTIVE_RECOVERY_LEASE_NOT_VERIFIED'));
  const fixed={
   owner:path.join(MAINTENANCE_ROOT,'leases/controller-install/owner.json'),
   marker:path.join(MAINTENANCE_ROOT,'leases/controller-install/RECOVERY_REQUIRED.json'),
   ledger:path.join(MAINTENANCE_ROOT,'ledger',C1501_ID+'.json')
  };
  const snapshot=()=>Object.fromEntries(Object.entries(fixed).map(([k,f])=>{
   const st=stat(f);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>32768)
    throw Error('C1501_FIXED_ORIGINAL_FILE_INVALID');
   const bytes=read(f);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)throw Error('C1501_FILE_READ_MISMATCH');
   return [k,bytes];
  }));
  const first=snapshot(),second=snapshot(),after=lock();
  const data=classify1501RecoveryCheckpoint({lockBefore:before,lockAfter:after,
   first,second},{
    signal,backupPresent:fixedPathExists(
     path.join('E:/ZGmini/automation/pc-control/backups','controller-update-'+C1501_ID),stat),
    backlogPresent:fixedPathExists(
     path.join(MAINTENANCE_ROOT,'backlog',C1501_ID+'.json'),stat)});
  return data;
 }catch{return as1501(c996Unknown('C996_ORIGINAL_FILES_UNAVAILABLE'));}
}

export function collect(role,ctx,env=process.env){
 const host=os.hostname().toUpperCase();
 const runnerName=String(env.RUNNER_NAME||'');
 const identity=validateSeat(role,host,runnerName,env.COMPUTERNAME);
 const base={schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',role,
  requestId:ctx.requestId,issueNumber:ctx.issueNumber,runId:ctx.runId,
  attempt:ctx.attempt,observedAtUtc:new Date().toISOString(),
  host,runnerName,
  runnerLabel:role==='operating'?'zgmini-pc-control':'zgmini-handoff-ci-isolated',
  operationalWrites:0,providerCalls:0,d1Writes:0,automaticRetries:0,
  commandLinesCaptured:false,environmentValuesCaptured:false};
 if(identity!=='MATCH'||(role==='operating'&&host!=='PC')){
  return {...base,status:'BLOCKED',code:identity==='MATCH'?'HOST_NOT_CANONICAL':identity};
 }
 const withMaintenance=role==='operating'?{...base,
  maintenance:collectMaintenanceStatusReadonly(),
  c996LeaseCorrelation:inspect996LeaseCorrelation(),
  c1501LeaseCorrelation:inspect1501LeaseCorrelation()}:base;
 const ps=path.win32.join(env.SystemRoot||'C:\\Windows',
  'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 if(os.platform()!=='win32'||!fs.existsSync(ps))
  return {...withMaintenance,status:'PARTIAL',code:'POWERSHELL_NOT_AVAILABLE'};
 const encoded=Buffer.from(PS_SCRIPT,'utf16le').toString('base64');
 const proc=spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive',
  '-EncodedCommand',encoded],{encoding:'utf8',windowsHide:true,timeout:45000,
  maxBuffer:MAX_BYTES,shell:false,env:{...env}});
 if(proc.error||proc.status!==0)
   return {...withMaintenance,status:'PARTIAL',code:proc.error?.code==='ETIMEDOUT'?
    'PROCESS_PROBE_TIMEOUT':'PROCESS_PROBE_UNAVAILABLE'};
 try{
  const parsed=JSON.parse(proc.stdout.replace(/^\uFEFF/,'').trim());
  const snapshot=sanitizeProbe(parsed);
  return {...withMaintenance,status:'PASS',code:'PROCESS_INVENTORY_COLLECTED',snapshot};
 }catch{return {...withMaintenance,status:'PARTIAL',code:'PROCESS_REPORT_INVALID'};}
}
export function toText(r){
 return ['schema='+r.schema,'requestId='+r.requestId,'role='+r.role,
  'runId='+r.runId,'attempt='+r.attempt,'host='+r.host,
  'runner='+r.runnerName,'status='+r.status,'code='+r.code,
  'observedAtUtc='+r.observedAtUtc,
  'totalProcessCount='+(r.snapshot?.totalProcessCount??'UNKNOWN'),
  'selectedProcessCount='+(r.snapshot?.selectedProcessCount??'UNKNOWN'),
  'maintenanceStatus='+(r.maintenance?.status??'NOT_APPLICABLE'),
  'maintenanceSourceSha='+(r.maintenance?.maintenanceSourceSha??'UNKNOWN'),
  'installLockHeld='+(r.maintenance?.installLockHeld??'UNKNOWN'),
  'c996LeaseCorrelation='+(r.c996LeaseCorrelation?.status??'NOT_APPLICABLE'),
  'c996LeaseCorrelationCode='+(r.c996LeaseCorrelation?.code??'NOT_APPLICABLE'),
  'operationalWrites=0','automaticRetries=0',''].join('\r\n');
}
async function main(){
 const env=process.env,role=process.argv[2];
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const ctx=authenticateProcess(event,env,role);
 const result=collect(role,ctx,env);
 const stem='results/pc-process-inventory-'+ctx.runId+'-'+ctx.attempt+'-'+role;
 const outputs=[[stem+'.json',JSON.stringify(result,null,2)+'\n'],[stem+'.txt',toText(result)]];
 const headers={authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','content-type':'application/json'};
 const uploaded=await uploadResultPairAtomic({outputs,headers,
  message:'results(ops): fixed process snapshot '+role+' '+ctx.runId});
 if(uploaded.delivery!=='RESULT_PAIR_READBACK_VERIFIED')fail(uploaded.delivery);
 const ack=await fetch('https://api.github.com/repos/'+REPO+'/issues/'+ctx.issueNumber+'/comments',
  {method:'POST',headers,body:JSON.stringify({body:
   '<!-- zgmini-pc-process:'+ctx.runId+':'+role+' -->\n'+'Process inventory '+
    role+': '+result.status+' / '+result.code+'; exact result pair '+stem+
    '.json and '+stem+'.txt verified; operationalWrites=0; retries=0.'})});
 if(!ack.ok)fail('COMMENT_NOT_VERIFIED');
 console.log('PROCESS_INVENTORY_VERIFIED role='+role+' status='+result.status+' code='+result.code);
 if(result.status!=='PASS')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
