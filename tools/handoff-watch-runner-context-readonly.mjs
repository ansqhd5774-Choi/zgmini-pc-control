// One-shot read-only inspection on isolated queue PC Runner.
// No Task mutation, credentials read, user identity disclosure or resident watch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

export const REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='handoff-watch-runner-context-readonly';
export const SCHEMA='ZGMINI_HANDOFF_WATCH_RUNNER_CONTEXT_REQUEST_V1';
export const POLLS=3;
export const INTERVAL_MS=5_000;
export const URL='https://api.github.com/repos/'+REPOSITORY+'/issues?state=open&labels=agent-handoff&per_page=1';
const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function validateContext(event,env,host=os.hostname()) {
 const valid=event?.action==='opened' &&
   event?.repository?.private===true &&
   event?.repository?.full_name===REPOSITORY &&
   event?.issue?.user?.login==='ansqhd5774-Choi' &&
   event?.issue?.title===TITLE &&
   Number.isSafeInteger(event?.issue?.number) && event.issue.number>0 &&
   env.GITHUB_EVENT_NAME==='issues' &&
   env.GITHUB_REPOSITORY===REPOSITORY &&
   env.GITHUB_ACTOR==='ansqhd5774-Choi' &&
   env.RUNNER_NAME==='zgmini-handoff-ci-spare-01' &&
   host.toUpperCase()==='DESKTOP-N62L0NG' &&
   /^[1-9][0-9]{0,18}$/.test(env.GITHUB_RUN_ID||'') &&
   env.GITHUB_RUN_ATTEMPT==='1';
 let body=null;
 try {body=JSON.parse(event?.issue?.body||'');}catch{}
 const request=body &&
   Object.keys(body).sort().join(',')==='operation,requestId,schema,target' &&
   body.schema===SCHEMA &&
   body.operation==='read-only-context-and-cadence' &&
   body.target==='handoff' &&
   REQUEST_ID.test(body.requestId||'');
 if(!valid||!request)throw Error('HANDOFF_WATCH_RUNNER_ADMISSION_STOP');
 return {issueNumber:event.issue.number};
}
export function classifyRunnerState(p) {
 if(!p||p.schema!=='ZGMINI_HANDOFF_WATCH_RUNNER_CONTEXT_PROBE_V1')
   throw Error('HANDOFF_WATCH_PROBE_SCHEMA_STOP');
 if(!Number.isInteger(p.sessionId)||p.sessionId<0||p.sessionId>999 ||
   typeof p.serviceSid!=='boolean'||typeof p.adminGroupToken!=='boolean' ||
   typeof p.taskQueryOk!=='boolean'||typeof p.taskExists!=='boolean'||
   typeof p.ghCliPresent!=='boolean')throw Error('HANDOFF_WATCH_PROBE_VALUES_STOP');
 if(p.taskExists && !p.taskQueryOk)throw Error('HANDOFF_WATCH_PROBE_VALUES_STOP');
 const inServiceSession=p.sessionId===0||p.serviceSid;
 return {
  schema:'ZGMINI_HANDOFF_WATCH_RUNNER_CONTEXT_RESULT_V1',
  hostVerified:true,runnerVerified:true,sessionZero:p.sessionId===0,
  serviceIdentity:p.serviceSid,adminGroupToken:p.adminGroupToken,
  taskQueryOk:p.taskQueryOk,taskExists:p.taskQueryOk?p.taskExists:null,
  ghCliPresentInRunnerContext:p.ghCliPresent,
  userInteractiveSessionVerified:false,
  userCredentialStoreVerified:false,
  taskRegistrationPermissionTested:false,
  taskRegistrationAttempted:false,
  taskStartAttempted:false,
  sourceInstalled:false,
  runnerContextEligibleForUserActivation:!inServiceSession,
  verdict:inServiceSession?'RUNNER_CONTEXT_CANNOT_OWN_USER_ONLOGON_WATCH':
    'RUNNER_NOT_SESSION_ZERO_USER_CONTEXT_STILL_UNVERIFIED',
  operationalWrites:0,providerCalls:0,d1Writes:0
 };
}
const POWERSHELL=[
 "$ErrorActionPreference='Stop'",
 "$process = Get-Process -Id $PID -ErrorAction Stop",
 "$identity = [Security.Principal.WindowsIdentity]::GetCurrent()",
 "$principal = New-Object Security.Principal.WindowsPrincipal($identity)",
 "$serviceSid = $identity.User.Value -in @('S-1-5-18','S-1-5-19','S-1-5-20')",
 "$admin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
 "$taskOk = $false",
 "$taskExists = $false",
 "try { $tasks = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -eq 'ZGMINI-HANDOFF-WATCH' }); $taskOk = $true; $taskExists = $tasks.Count -gt 0 } catch { }",
 "$ghPresent = $null -ne (Get-Command gh.exe -ErrorAction SilentlyContinue)",
 "[pscustomobject]@{schema='ZGMINI_HANDOFF_WATCH_RUNNER_CONTEXT_PROBE_V1';sessionId=[int]$process.SessionId;serviceSid=[bool]$serviceSid;adminGroupToken=[bool]$admin;taskQueryOk=[bool]$taskOk;taskExists=[bool]$taskExists;ghCliPresent=[bool]$ghPresent} | ConvertTo-Json -Compress"
].join('; ');
export function inspectRunnerContext({run=spawnSync}={}) {
 const result=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',POWERSHELL],
   {encoding:'utf8',timeout:12_000,maxBuffer:8192,windowsHide:true});
 if(result.error || result.status!==0 || !result.stdout || result.stdout.length>8192)
   throw Error('HANDOFF_WATCH_CONTEXT_READ_STOP');
 let p;
 try {p=JSON.parse(result.stdout.trim());}catch{throw Error('HANDOFF_WATCH_CONTEXT_PARSE_STOP');}
 return classifyRunnerState(p);
}
export async function sampleFiveSecondReads({
 token,fetchImpl=fetch,clock=()=>Date.now(),
 sleep=ms=>new Promise(r=>setTimeout(r,ms))
}={}) {
 if(typeof token!=='string'||!token.trim())throw Error('HANDOFF_WATCH_EPHEMERAL_TOKEN_STOP');
 const codes=[],starts=[],durations=[];
 let etag=null;
 for(let i=0;i<POLLS;i++){
  const start=clock();starts.push(start);
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),3500);
  try {
   const headers={Accept:'application/vnd.github+json',
     Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
   if(etag)headers['If-None-Match']=etag;
   const response=await fetchImpl(URL,{method:'GET',headers,signal:ac.signal});
   durations.push(clock()-start);
   codes.push([200,304,401,403,429].includes(response.status)?response.status:0);
   if(response.status===200||response.status===304)etag=response.headers?.get?.('etag')||etag;
   try {await response.body?.cancel?.();}catch{}
   if(response.status!==200&&response.status!==304)break;
  }catch {
   durations.push(clock()-start);codes.push(0);break;
  }finally{clearTimeout(timer);}
  if(i<POLLS-1)await sleep(Math.max(0,start+INTERVAL_MS-clock()));
 }
 const diffs=starts.slice(1).map((t,i)=>t-starts[i]);
 return {sampleCount:codes.length,readHttpCodes:codes,
  observedMinStartIntervalMs:diffs.length?Math.min(...diffs):null,
  observedMaxStartIntervalMs:diffs.length?Math.max(...diffs):null,
  longestRequestMs:durations.length?Math.max(...durations):null,
  successfulReads:codes.filter(s=>s===200||s===304).length,
  samplingOnly:true,persistentCredentialVerified:false,
  source:'EPHEMERAL_ACTIONS_JOB_TOKEN_NOT_A_WATCHER_CREDENTIAL',
  actualUserTaskStarted:false,operationalWrites:0};
}
async function main(){
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 validateContext(event,process.env);
 const ctx=inspectRunnerContext();
 // Exactly three read-only HTTP GETs, bounded by timeout and spacing.
 const sample=await sampleFiveSecondReads({token:process.env.GITHUB_TOKEN});
 process.stdout.write(JSON.stringify({schema:'ZGMINI_HANDOFF_WATCH_RUNNER_READONLY_RESULT_V1',
  observedAtUtc:new Date().toISOString(),...ctx,pollSample:sample,
  result:'READ_ONLY_INSPECTION_ONLY_NO_C_ACTIVATION'})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{const code=/^HANDOFF_WATCH_[A-Z_]+STOP$/.test(e?.message||'')?
   e.message:'HANDOFF_WATCH_READONLY_INSPECTION_STOP';
  process.stderr.write(code+'\n');process.exitCode=2;});
