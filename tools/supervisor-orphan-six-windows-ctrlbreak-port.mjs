// Private Windows CTRL+BREAK port for a separately approved orphan-six B.
// Source-only. Not registered in installed maintenance agent or in any CLI.
// Never target a process by untrusted Issue data. A sent event is not an exit.
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const stamp=x=>typeof x==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x.slice(0,23)+'Z';
const goodPid=x=>Number.isSafeInteger(x)&&x>0&&x<=0x7fffffff;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const denied=code=>Object.freeze({schema:'ZGMINI_ORPHAN_SIX_BREAK_V1',
 status:'BLOCKED',code,signalSubmitted:false,exitVerified:false,
 operationalRecoveryVerified:false});
const uncertain=code=>Object.freeze({...denied(code),status:'RECOVERY_REQUIRED',
 nextAction:'RECONCILE_ORIGINAL_DURABLE_STOP_INTENT_NO_RETRY'});

const FIXED_PS="$ErrorActionPreference='Stop'\n$target=[uint32]__PID__\n$seat=[int]__SEAT__\n$birth='__BIRTH__'\n$kind='__KIND__'\n$testExe='__TEMP_EXE__'\n$p=Get-CimInstance Win32_Process -Filter \"ProcessId=$target\" -ErrorAction Stop\nif($null -eq $p -or [int]$p.ProcessId -ne [int]$target){throw 'PIN_NOT_FOUND'}\n$when=([datetime]$p.CreationDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')\nif($when -cne $birth){throw 'PIN_BIRTH_CHANGED'}\nif($kind -eq 'RUNNER'){\n $pattern='(?i)^E:\\\\ZGmini\\\\automation\\\\pc-control\\\\runners\\\\0'+$seat+'\\\\(?:bin\\\\)?Runner\\.Listener\\.exe$'\n if(([string]$p.ExecutablePath -notmatch $pattern) -or\n    [string]$p.Name -ine 'Runner.Listener.exe'){throw 'PIN_EXE_CHANGED'}\n}elseif($kind -eq 'TEMP'){\n if([string]$p.ExecutablePath -ine $testExe -or\n    [string]$p.Name -ine 'node.exe'){throw 'TEMP_EXE_CHANGED'}\n}else{throw 'PIN_KIND_INVALID'}\n$cs=@'\nusing System;\nusing System.Runtime.InteropServices;\npublic static class ZgminiSixBreak {\n [DllImport(\"kernel32.dll\", SetLastError=true)] public static extern bool FreeConsole();\n [DllImport(\"kernel32.dll\", SetLastError=true)] public static extern bool AttachConsole(uint id);\n [DllImport(\"kernel32.dll\", SetLastError=true)] public static extern uint GetConsoleProcessList([Out] uint[] rows,uint count);\n [DllImport(\"kernel32.dll\", SetLastError=true)] public static extern bool GenerateConsoleCtrlEvent(uint signal,uint group);\n [UnmanagedFunctionPointer(CallingConvention.Winapi)] public delegate bool ControlHandler(uint code);\n private static readonly ControlHandler keepAlive=signal=>true;\n [DllImport(\"kernel32.dll\", SetLastError=true)] private static extern bool SetConsoleCtrlHandler(ControlHandler cb,bool add);\n public static bool GuardSender(){return SetConsoleCtrlHandler(keepAlive,true);}\n}\n'@\nAdd-Type -TypeDefinition $cs -ErrorAction Stop\n[void][ZgminiSixBreak]::FreeConsole()\nif(-not [ZgminiSixBreak]::AttachConsole($target)){throw 'CONSOLE_ATTACH_FAILED'}\ntry {\n $members=[uint32[]]::new(16)\n $n=[ZgminiSixBreak]::GetConsoleProcessList($members,[uint32]$members.Length)\n if($n -ne 2){throw 'CONSOLE_NONEXCLUSIVE'}\n $seen=@($members[0..([int]$n-1)] | ForEach-Object{[uint32]$_})\n if(-not ($seen -contains $target) -or\n    -not ($seen -contains [uint32]$PID)){throw 'CONSOLE_MEMBER_DRIFT'}\n $p2=Get-CimInstance Win32_Process -Filter \"ProcessId=$target\" -ErrorAction Stop\n if($null -eq $p2){throw 'PIN_EXITED_BEFORE_SIGNAL'}\n $birth2=([datetime]$p2.CreationDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')\n if($birth2 -cne $birth -or [string]$p2.ExecutablePath -ine [string]$p.ExecutablePath){\n  throw 'PIN_CHANGED_BEFORE_SIGNAL'\n }\n if(-not [ZgminiSixBreak]::GuardSender()){throw 'SENDER_UNPROTECTED'}\n # group 0: single exclusive console broadcast, NOT a PID-only signal.\n if(-not [ZgminiSixBreak]::GenerateConsoleCtrlEvent([uint32]1,[uint32]0)){\n  throw 'WINDOWS_BREAK_REJECTED'\n }\n Write-Output '{\"status\":\"SENT\",\"code\":\"EXCLUSIVE_CONSOLE_CTRL_BREAK_SUBMITTED\"}'\n} finally {\n [void][ZgminiSixBreak]::FreeConsole()\n}";

export function prepareOrphanSixFixedConsoleBreak({
 seat,pid,startedAtUtc,platform=process.platform,
 hostname=os.hostname(),testExe=null
}={}){
 if(platform!=='win32'||!goodPid(pid)||!Number.isInteger(seat)||
    seat<1||seat>6||!stamp(startedAtUtc))
  return denied('ORPHAN_SIX_BREAK_PIN_INVALID');
 const mode=testExe===null?'RUNNER':'TEMP';
 if(mode==='RUNNER'&&String(hostname).toUpperCase()!=='PC')
  return denied('ORPHAN_SIX_BREAK_OPERATING_HOST_REQUIRED');
 if(mode==='TEMP'&&(String(hostname).toUpperCase()!=='DESKTOP-N62L0NG'||
    typeof testExe!=='string'||!path.win32.isAbsolute(testExe)||
    !/\\node\.exe$/i.test(testExe)))
  return denied('ORPHAN_SIX_BREAK_TEMP_ISOLATED_HOST_REQUIRED');
 const ps=FIXED_PS.replace('__PID__',String(pid))
  .replace('__SEAT__',String(seat))
  .replace('__BIRTH__',startedAtUtc)
  .replace('__KIND__',mode)
  .replace('__TEMP_EXE__',mode==='TEMP'?testExe.replaceAll("'","''"):'');
 // Never serialize source.script: contains sensitive exact original PID/birth.
 return Object.freeze({status:'PRIVATE_SOURCE_READY',code:'ORPHAN_SIX_BREAK_SOURCE_PINNED',
  seat,pid,startedAtUtc,mode,script:ps});
}
export async function submitOrphanSixCtrlBreakOnce({
 source,exactIntent,preSignal,
 run=spawnSync,platform=process.platform,
 root=process.env.SystemRoot
}={}){
 if(source?.status!=='PRIVATE_SOURCE_READY'||!goodPid(source.pid)||
    !stamp(source.startedAtUtc)||!sha(exactIntent?.rawSha256)||
    exactIntent?.status!=='EXACT_CAS_READBACK_VERIFIED'||
    exactIntent?.phase!=='STOP_INTENT_RECORDED'||
    exactIntent?.seat!==source.seat||
    exactIntent?.source!=='PRIVATE_B_DURABLE_STOP_INTENT'||
    preSignal?.source!=='PRIVATE_SAME_HOST_B_PRESIGNAL_DOUBLE_READ'||
    preSignal?.seat!==source.seat||
    preSignal?.oldInstancePid!==source.pid||
    preSignal?.oldInstanceBirth!==source.startedAtUtc||
    preSignal?.maintenanceLeaseOwnedVerified!==true||
    preSignal?.oneUseClaimUninterruptedVerified!==true||
    preSignal?.watchdogFenceUninterruptedVerified!==true||
    preSignal?.intakeDrainedStillVerified!==true||
    preSignal?.allSixPinsUnchangedVerified!==true||
    preSignal?.originalCASUnchangedVerified!==true||
    preSignal?.consoleExclusiveVerified!==true||
    typeof preSignal?.observedAtUtc!=='string'||
    !Number.isFinite(Date.parse(preSignal.observedAtUtc))||
    Date.now()-Date.parse(preSignal.observedAtUtc)>5000||
    Date.parse(preSignal.observedAtUtc)>Date.now()||
    platform!=='win32'||!(/^[A-Za-z]:[\\/]Windows$/i).test(root??''))
  return denied('ORPHAN_SIX_BREAK_DURABLE_INTENT_OR_FENCE_UNVERIFIED');
 if(source.mode==='RUNNER'&&String(os.hostname()).toUpperCase()!=='PC')
  return denied('ORPHAN_SIX_BREAK_OPERATING_HOST_REQUIRED');
 if(source.mode==='TEMP'&&String(os.hostname()).toUpperCase()!=='DESKTOP-N62L0NG')
  return denied('ORPHAN_SIX_BREAK_TEMP_ISOLATED_HOST_REQUIRED');
 let result;
 try{
  result=await run(path.win32.join(root,'System32',
   'WindowsPowerShell','v1.0','powershell.exe'),
   ['-NoLogo','-NoProfile','-NonInteractive','-Command',source.script],
   {shell:false,windowsHide:true,timeout:18000,
    encoding:'utf8',maxBuffer:16384});
 }catch{return uncertain('ORPHAN_SIX_BREAK_OUTCOME_UNKNOWN');}
 if(result?.error||result?.status!==0)
  return uncertain('ORPHAN_SIX_BREAK_OUTCOME_UNKNOWN');
 let data;
 try{data=JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));}
 catch{return uncertain('ORPHAN_SIX_BREAK_OS_RECEIPT_UNVERIFIED');}
 if(data?.status!=='SENT'||
    data?.code!=='EXCLUSIVE_CONSOLE_CTRL_BREAK_SUBMITTED')
  return uncertain('ORPHAN_SIX_BREAK_OS_RECEIPT_UNVERIFIED');
 return Object.freeze({schema:'ZGMINI_ORPHAN_SIX_BREAK_V1',
  status:'SIGNAL_SUBMITTED',code:'ORPHAN_SIX_BREAK_NOT_EXIT_PROOF',
  signalSubmitted:true,exitVerified:false,operationalRecoveryVerified:false,
  nextAction:'PRIVATE_SAME_HOST_WMI_DOUBLE_EXIT_READBACK_REQUIRED'});
}
