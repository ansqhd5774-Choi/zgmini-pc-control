// Only synthetic Node children created under TEMP on isolated Windows CI.
// Never invokes or probes a real installed GitHub Runner.Listener or PC Owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareOrphanSixFixedConsoleBreak,submitOrphanSixCtrlBreakOnce}
 from '../tools/supervisor-orphan-six-windows-ctrlbreak-port.mjs';

const windows={skip:process.platform!=='win32'||os.hostname().toUpperCase()!=='DESKTOP-N62L0NG'};
const ps=()=>path.win32.join(process.env.SystemRoot,'System32',
 'WindowsPowerShell','v1.0','powershell.exe');
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const cmdQuote=x=>'"'+String(x).replaceAll('"','')+'"';
function powershell(command){
 const result=spawnSync(ps(),['-NoLogo','-NoProfile','-NonInteractive','-Command',command],
  {shell:false,windowsHide:true,encoding:'utf8',timeout:18000,maxBuffer:16384});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,'TEMP_PS_COMMAND_FAILED');
 return result.stdout.trim().split(/\r?\n/).at(-1);
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFile(name,timeout=6000){
 const end=Date.now()+timeout;
 while(Date.now()<end){if(fs.existsSync(name))return true;await pause(30);}
 return fs.existsSync(name);
}
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
async function waitGone(pid){
 for(let i=0;i<100;i++){if(!alive(pid))return true;await pause(30);}
 return !alive(pid);
}
function cleanup(dir,children){
 for(const c of children){
  if(!c||!alive(c.pid))continue;
  // Reject unrelated/reused PID before cleanup: only our own TEMP synthetic
  // Node process with the exact source script is eligible for cleanup.
  const script="$ErrorActionPreference='Stop';"+
    "$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+c.pid+"' -ErrorAction Stop;"+
    "if($null -ne $p -and $p.ExecutablePath -ieq "+quote(process.execPath)+
    " -and $p.CommandLine -like "+quote('*'+c.script+'*')+
    "){Stop-Process -Id "+c.pid+" -Force -ErrorAction Stop}";
  try{powershell(script);}catch{}
 }
 fs.rmSync(dir,{recursive:true,force:true});
}
function start(dir,script,label){
 const ready=path.join(dir,label+'.ready'),seen=path.join(dir,label+'.seen');
 const args=[script,ready,seen].map(cmdQuote).join(' ');
 const command="$ErrorActionPreference='Stop';"+
  "$p=Start-Process -FilePath "+quote(process.execPath)+
  " -ArgumentList "+quote(args)+
  " -WorkingDirectory "+quote(dir)+" -WindowStyle Hidden -PassThru;"+
  "Write-Output $p.Id";
 const pid=Number(powershell(command));
 assert.ok(Number.isSafeInteger(pid)&&pid>0);
 return {pid,ready,seen,script};
}
function birth(pid){
 return powershell("$ErrorActionPreference='Stop';"+
  "$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+pid+"';"+
  "if($null -eq $p){throw 'TEMP_PID_MISSING'};"+
  "([datetime]$p.CreationDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')");
}
const intent=seat=>({source:'PRIVATE_B_DURABLE_STOP_INTENT',
 status:'EXACT_CAS_READBACK_VERIFIED',phase:'STOP_INTENT_RECORDED',
 seat,rawSha256:'b'.repeat(64)});
const proof=(pid,startedAtUtc,seat)=>({
 source:'PRIVATE_SAME_HOST_B_PRESIGNAL_DOUBLE_READ',
 seat,oldInstancePid:pid,oldInstanceBirth:startedAtUtc,
 maintenanceLeaseOwnedVerified:true,
 oneUseClaimUninterruptedVerified:true,watchdogFenceUninterruptedVerified:true,
 intakeDrainedStillVerified:true,allSixPinsUnchangedVerified:true,
 originalCASUnchangedVerified:true,consoleExclusiveVerified:true,
 observedAtUtc:new Date().toISOString()
});

test('production port cannot be compiled for other hosts or Issue-provided executable',()=>{
 const birth='2026-11-27T03:00:00.1234567Z';
 assert.equal(prepareOrphanSixFixedConsoleBreak({
  seat:1,pid:52000,startedAtUtc:birth,platform:'win32',
  hostname:'DESKTOP-N62L0NG'
 }).status,'BLOCKED');
 assert.equal(prepareOrphanSixFixedConsoleBreak({
  seat:1,pid:52000,startedAtUtc:birth,platform:'win32',
  hostname:'PC',testExe:'C:\\\\temp\\\\node.exe'
 }).status,'BLOCKED');
 assert.equal(prepareOrphanSixFixedConsoleBreak({
  seat:1,pid:52000,startedAtUtc:birth,platform:'win32',
  hostname:'PC',testExe:null
 }).status,'PRIVATE_SOURCE_READY');
 for(const inputs of [
  {seat:7,pid:1,startedAtUtc:birth},
  {seat:1,pid:-2,startedAtUtc:birth},
  {seat:1,pid:32,startedAtUtc:'2026-11-27T03:00:00.123Z'}
 ]){
  const result=prepareOrphanSixFixedConsoleBreak({
   ...inputs,platform:'win32',hostname:'PC'
  });
  assert.equal(result.status,'BLOCKED');
 }
});
test('no irreversible event before durable intent and fresh private fence',async()=>{
 const born='2026-11-27T03:00:00.1234567Z';
 const candidate=prepareOrphanSixFixedConsoleBreak({
  seat:1,pid:52000,startedAtUtc:born,
  platform:'win32',hostname:'PC'
 });
 let calls=0;
 const call=()=>{calls++;throw Error('must not run');};
 for(const bad of [
  {exactIntent:{...intent(1),phase:'PREPARED'}},
  {exactIntent:{...intent(2)}},
  {exactIntent:intent(1),preSignal:{...proof(52000,born,1),
   watchdogFenceUninterruptedVerified:false}},
  {exactIntent:intent(1),preSignal:{...proof(52000,born,1),
   observedAtUtc:'2026-11-27T00:00:00Z'}},
  {exactIntent:intent(1),preSignal:{...proof(52000,born,1),
   consoleExclusiveVerified:false}},
 ]){
  const result=await submitOrphanSixCtrlBreakOnce({
   source:candidate,exactIntent:intent(1),preSignal:proof(52000,born,1),
   ...bad,platform:'win32',root:'C:\\Windows',run:call
  });
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.signalSubmitted,false);
 }
 assert.equal(calls,0);
});
test('forged or JSON-copied source cannot invoke PowerShell, even with fake B flags',async()=>{
 const born='2026-11-27T03:00:00.1234567Z';
 const original=prepareOrphanSixFixedConsoleBreak({seat:1,pid:52000,
  startedAtUtc:born,platform:'win32',hostname:'PC'});
 let calls=0;
 const copied=JSON.parse(JSON.stringify(original));
 const forgery={...copied,pid:52000,startedAtUtc:born,mode:'TEMP',
  script:'arbitrary shell'};
 const result=await submitOrphanSixCtrlBreakOnce({
  source:forgery,exactIntent:intent(1),preSignal:proof(52000,born,1),
  platform:'win32',root:'C:\\Windows',run:()=>{calls++;throw Error('MUST_NOT_RUN');}
 });
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.signalSubmitted,false);
 assert.equal(calls,0);
 assert.equal(original.pid,undefined);
 assert.equal(original.script,undefined);
});
test('synthetic native Windows Ctrl+Break sends once to exact private console only',
 windows,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-six-break-temp-'));
 const fixture=path.join(dir,'synthetic-signal.mjs');
 const src=[
  "import fs from 'node:fs';",
  "const [ready,seen]=process.argv.slice(2);",
  "process.on('SIGBREAK',()=>{fs.writeFileSync(seen,'SIGBREAK',{flag:'wx'});process.exit(0);});",
  "fs.writeFileSync(ready,String(process.pid),{flag:'wx'});",
  "setInterval(()=>{},1000);"
 ].join('\n');
 const children=[];
 try{
  fs.writeFileSync(fixture,src,{flag:'wx'});
  const target=start(dir,fixture,'target'),peer=start(dir,fixture,'peer');
  children.push(target,peer);
  assert.equal(await waitFile(target.ready),true);
  assert.equal(await waitFile(peer.ready),true);
  const born=birth(target.pid);
  const pinned=prepareOrphanSixFixedConsoleBreak({
   seat:1,pid:target.pid,startedAtUtc:born,
   platform:process.platform,hostname:os.hostname(),testExe:process.execPath
  });
  assert.equal(pinned.status,'PRIVATE_SOURCE_READY');
  assert.equal(pinned.script,undefined);
  assert.equal(pinned.pid,undefined);
  const result=await submitOrphanSixCtrlBreakOnce({
   source:pinned,exactIntent:intent(1),preSignal:proof(target.pid,born,1)
  });
  assert.equal(result.status,'SIGNAL_SUBMITTED',result.code);
  assert.equal(result.signalSubmitted,true);
  assert.equal(result.exitVerified,false);
  assert.equal(result.operationalRecoveryVerified,false);
  assert.equal(await waitFile(target.seen,4000),true);
  assert.equal(fs.readFileSync(target.seen,'utf8'),'SIGBREAK');
  assert.equal(await waitGone(target.pid),true);
  assert.equal(alive(peer.pid),true);
  assert.equal(fs.existsSync(peer.seen),false);
  console.log('WIN_ORPHAN_SIX_PRIVATE_CTRL_BREAK_TEMP=PASS');
 }finally{cleanup(dir,children);}
});
test('Windows native emitter fails closed if pinned birth changes, without false SENT',
 windows,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-six-break-temp-birth-'));
 const fixture=path.join(dir,'synthetic-signal.mjs');
 const src=[
  "import fs from 'node:fs';",
  "const [ready,seen]=process.argv.slice(2);",
  "process.on('SIGBREAK',()=>{fs.writeFileSync(seen,'SIGBREAK',{flag:'wx'});process.exit(0);});",
  "fs.writeFileSync(ready,String(process.pid),{flag:'wx'});",
  "setInterval(()=>{},1000);"
 ].join('\n');
 const children=[];
 try{
  fs.writeFileSync(fixture,src,{flag:'wx'});
  const target=start(dir,fixture,'target');
  children.push(target);
  assert.equal(await waitFile(target.ready),true);
  const original=birth(target.pid);
  const fake=original.slice(0,-2)+(original.at(-2)==='8'?'7':'8')+'Z';
  const pinned=prepareOrphanSixFixedConsoleBreak({
   seat:1,pid:target.pid,startedAtUtc:fake,
   platform:process.platform,hostname:os.hostname(),testExe:process.execPath
  });
  assert.equal(pinned.status,'PRIVATE_SOURCE_READY');
  const r=await submitOrphanSixCtrlBreakOnce({
   source:pinned,exactIntent:intent(1),preSignal:proof(target.pid,fake,1)
  });
  assert.equal(r.status,'RECOVERY_REQUIRED');
  assert.equal(r.signalSubmitted,false);
  assert.equal(alive(target.pid),true);
  assert.equal(fs.existsSync(target.seen),false);
  console.log('WIN_ORPHAN_SIX_PRIVATE_BIRTH_DRIFT_DENIED=PASS');
 }finally{cleanup(dir,children);}
});
