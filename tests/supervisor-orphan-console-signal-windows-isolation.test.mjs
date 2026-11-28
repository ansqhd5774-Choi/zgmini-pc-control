// Windows only: exercise console control events against disposable TEMP-owned
// Node children on the isolated CI PC. NEVER target operational Runner processes.
// This is not an operating-PC B actuator, approval, or reusable signal sender.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const windows={skip:process.platform!=='win32'};
const fixtureSource=[
 "import fs from 'node:fs';",
 "const [ready,signalFile]=process.argv.slice(2);",
 "process.on('SIGINT',()=>{fs.writeFileSync(signalFile,'SIGINT',{flag:'wx'});process.exit(0);});",
 "process.on('SIGBREAK',()=>{fs.writeFileSync(signalFile,'SIGBREAK',{flag:'wx'});process.exit(0);});",
 "fs.writeFileSync(ready,String(process.pid),{flag:'wx'});",
 "setInterval(()=>{},1000);"
].join('\n');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function appears(filename,timeout=6500){
 const until=Date.now()+timeout;
 while(Date.now()<until){
  if(fs.existsSync(filename))return true;
  await pause(30);
 }
 return false;
}
// Start-Process creates a real private console on Windows. In contrast,
// Node detached:true can create a console-less DETACHED_PROCESS.
const winPs=()=>path.win32.join(process.env.SystemRoot,'System32',
 'WindowsPowerShell','v1.0','powershell.exe');
const psQuote=value=>"'"+String(value).replaceAll("'","''")+"'";
const cmdQuote=value=>'"'+String(value).replaceAll('"','')+'"';
function runFixedPowerShell(command){
 const out=spawnSync(winPs(),['-NoLogo','-NoProfile','-NonInteractive',
  '-Command',command],{windowsHide:true,shell:false,encoding:'utf8',
  timeout:18000,maxBuffer:16384});
 assert.equal(out.error,undefined,out.error?.code);
 assert.equal(out.status,0,'TEMP_FIXED_POWERSHELL_FAILED');
 return (out.stdout??'').trim().split(/\\r?\\n/).at(-1);
}
function start(dir,script,seat){
 const ready=path.join(dir,seat+'.ready'),seen=path.join(dir,seat+'.seen');
 const arg=[script,ready,seen].map(cmdQuote).join(' ');
 const command="$ErrorActionPreference='Stop'; $p=Start-Process -FilePath "+
  psQuote(process.execPath)+" -ArgumentList "+psQuote(arg)+
  " -WorkingDirectory "+psQuote(dir)+
  " -WindowStyle Hidden -PassThru; Write-Output $p.Id";
 const pid=Number(runFixedPowerShell(command));
 assert.ok(Number.isSafeInteger(pid)&&pid>0,'TEMP_LAUNCH_PID_UNVERIFIED');
 return {pid,ready,seen,script};
}
function pidAlive(pid){
 try{process.kill(pid,0);return true;}catch{return false;}
}
async function waitGone(pid,timeout=4000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(!pidAlive(pid))return true;
  await pause(50);
 }
 return !pidAlive(pid);
}
async function clean(dir,children){
 for(const c of children){
  if(!c||!pidAlive(c.pid))continue;
  // PID alone is insufficient for cleanup. Validate the exact synthetic
  // executable AND temporary script command line before stopping this fixture.
  const command="$ErrorActionPreference='Stop';"+
   " $p=Get-CimInstance Win32_Process -Filter 'ProcessId="+c.pid+
   "' -ErrorAction Stop;"+
   " if($null -ne $p -and $p.ExecutablePath -ieq "+psQuote(process.execPath)+
   " -and $p.CommandLine -like "+psQuote('*'+c.script+'*')+
   "){Stop-Process -Id "+c.pid+" -Force -ErrorAction Stop}";
  try{runFixedPowerShell(command);}catch{}
 }
 await pause(150);
 fs.rmSync(dir,{recursive:true,force:true});
}
// The sender is a fresh PowerShell child, not the test host. It detaches
// from its initial console before attaching to the exact disposable child.
// GetConsoleProcessList must be exactly {the fixture Node PID, sender PID}.
const fixedPowerShell=String.raw`
$ErrorActionPreference='Stop'
$target=[uint32]__TARGET_PID__
$control=[uint32]__CONTROL_TYPE__
$group=[uint32]0
$source=@'
using System;
using System.Runtime.InteropServices;
public static class ZgminiTempOnlyCtrl {
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool FreeConsole();
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AttachConsole(uint pid);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern uint GetConsoleProcessList([Out] uint[] processes,uint length);
 [UnmanagedFunctionPointer(CallingConvention.Winapi)] public delegate bool CtrlHandler(uint signal);
 private static readonly CtrlHandler keepAlive = signal => true;
 [DllImport("kernel32.dll", SetLastError=true)] private static extern bool SetConsoleCtrlHandler(CtrlHandler callback,bool add);
 public static bool ProtectSender() { return SetConsoleCtrlHandler(keepAlive,true); }
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GenerateConsoleCtrlEvent(uint type,uint processGroup);
}
'@
Add-Type -TypeDefinition $source -ErrorAction Stop
[void][ZgminiTempOnlyCtrl]::FreeConsole()
if(-not [ZgminiTempOnlyCtrl]::AttachConsole($target)){
 $attachError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
 Write-Output (@{status='BLOCKED';code='TEMP_CONSOLE_ATTACH_FAILED';win32Error=$attachError} | ConvertTo-Json -Compress)
 exit 0
}
try{
 $all=[uint32[]]::new(32)
 $count=[ZgminiTempOnlyCtrl]::GetConsoleProcessList($all,[uint32]$all.Length)
 if($count -ne 2){
  Write-Output '{"status":"BLOCKED","code":"TEMP_CONSOLE_NONEXCLUSIVE"}'
  exit 0
 }
 $members=@($all[0..([int]$count-1)] | ForEach-Object {[uint32]$_})
 if(-not ($members -contains $target) -or -not ($members -contains [uint32]$PID)){
  Write-Output '{"status":"BLOCKED","code":"TEMP_CONSOLE_TARGET_UNVERIFIED"}'
  exit 0
 }
 if(-not [ZgminiTempOnlyCtrl]::ProtectSender()){
  Write-Output '{"status":"BLOCKED","code":"TEMP_SENDER_HANDLER_FENCE_FAILED"}'
  exit 0
 }
 if(-not [ZgminiTempOnlyCtrl]::GenerateConsoleCtrlEvent($control,$group)){
  Write-Output '{"status":"BLOCKED","code":"TEMP_CONTROL_EVENT_REJECTED"}'
  exit 0
 }
 Write-Output '{"status":"SENT","code":"TEMP_EXCLUSIVE_CONSOLE_SIGNAL_SENT"}'
} finally {
 [void][ZgminiTempOnlyCtrl]::FreeConsole()
}
`;
function sendTestSignal(targetPid,control){
 assert.ok(Number.isSafeInteger(targetPid)&&targetPid>0);
 assert.ok(control===0||control===1);
 assert.match(process.env.SystemRoot??'',/^[a-z]:[\\/]windows$/i);
 assert.equal(fs.statSync(winPs()).isFile(),true);
 const command=fixedPowerShell.replace('__TARGET_PID__',String(targetPid))
  .replace('__CONTROL_TYPE__',String(control))
  ;
 // No shell, PID search, arbitrary command, or target override.
 const response=JSON.parse(runFixedPowerShell(command));
 assert.equal(response.status,'SENT',response.code+
  (Number.isInteger(response.win32Error)?' win32Error='+response.win32Error:''));
 return response;
}
async function withTwoTempConsoles(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-ctrl-temp-'));
 // Never use or fall back to E:/ZGmini automation on any platform.
 assert.ok(path.basename(dir).startsWith('zgmini-orphan-ctrl-temp-'));
 const script=path.join(dir,'signal-fixture.mjs');
 const children=[];
 try{
  fs.writeFileSync(script,fixtureSource,{flag:'wx'});
  children.push(start(dir,script,'target'),start(dir,script,'peer'));
  assert.ok(await appears(children[0].ready)&&await appears(children[1].ready),
   'TEMP_FIXTURE_CHILD_NOT_READY');
  for(const c of children){
   assert.equal(fs.readFileSync(c.ready,'utf8'),String(c.pid));
   assert.equal(fs.existsSync(c.seen),false);
  }
  await fn(children[0],children[1]);
 }finally{await clean(dir,children);}
}
test('WIN-OC01 CTRL+C route: record actual receipt, never infer targeted group support',windows,
 async()=>{
  await withTwoTempConsoles(async(target,peer)=>{
   sendTestSignal(target.pid,0);
   const received=await appears(target.seen,1500);
   const event=received?fs.readFileSync(target.seen,'utf8'):'NONE';
   assert.ok(event==='NONE'||event==='SIGINT',event);
   assert.equal(fs.existsSync(peer.seen),false,'UNRELATED_TEMP_CONSOLE_SIGNALED');
   assert.equal(pidAlive(peer.pid),true,'UNRELATED_TEMP_CHILD_EXITED');
   // CREATE_NEW_PROCESS_GROUP can ignore CTRL+C. A SENT API return is not
   // evidence that the listener received it; expose the observation instead.
   console.log('WIN_OC01_CTRL_C_RECEIVED='+received);
   console.log('WIN_OC01_CTRL_C_TARGETED_DELIVERY_PROVEN=false');
  });
 });
test('WIN-OC02 CTRL+BREAK route: only the exclusive TEMP console exits',windows,
 async()=>{
  await withTwoTempConsoles(async(target,peer)=>{
   sendTestSignal(target.pid,1);
   assert.ok(await appears(target.seen,3500),'TEMP_CTRL_BREAK_NOT_DELIVERED');
   assert.equal(fs.readFileSync(target.seen,'utf8'),'SIGBREAK');
   assert.equal(await waitGone(target.pid,3500),true,
    'TEMP_SIGNALLED_CHILD_NOT_EXITED');
   assert.equal(fs.existsSync(peer.seen),false,'UNRELATED_TEMP_CONSOLE_SIGNALED');
   assert.equal(pidAlive(peer.pid),true,'UNRELATED_TEMP_CHILD_EXITED');
   console.log('WIN_OC02_CTRL_BREAK_EXCLUSIVE_TEMP_CONSOLE_EXIT=PASS');
  });
 });
