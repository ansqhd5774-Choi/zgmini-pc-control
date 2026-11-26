// Same-host fixed A-grade preflight for the existing independent C-grade
// receipt-root operator. Return only coarse account compatibility, never the
// Windows service account, SID, raw WMI data, paths, or permissions.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';


const SERVICE='actions.runner.ansqhd5774-Choi-zgmini-pc-control.zgmini-handoff-ci-spare-01';
const SCRIPT=[
  "$svcs=@(Get-CimInstance -ClassName Win32_Service -Filter \"Name='"+SERVICE+"'\" -ErrorAction Stop)",
  "if($svcs.Count -ne 1){Write-Output 'SERVICE_UNVERIFIED';exit}",
  "if([string]$svcs[0].State -ne 'Running'){Write-Output 'SERVICE_NOT_RUNNING';exit}",
  "$account=[string]$svcs[0].StartName",
  "if([string]::IsNullOrWhiteSpace($account)){Write-Output 'ACCOUNT_UNVERIFIED';exit}",
  "if($account -match '^(?i:LocalSystem|LocalService|NetworkService|NT AUTHORITY\\\\.*)$')"+
    "{Write-Output 'SHARED_ACCOUNT_STOP'}else{Write-Output 'DEDICATED_ACCOUNT_CANDIDATE'}"
].join(';');

const CODES=new Set(['SERVICE_UNVERIFIED','SERVICE_NOT_RUNNING','ACCOUNT_UNVERIFIED',
 'SHARED_ACCOUNT_STOP','DEDICATED_ACCOUNT_CANDIDATE']);
const base=Object.freeze({
 schema:'ZGMINI_CI_RECEIPT_C_OPERATOR_PREFLIGHT_READONLY_V1',
 accountValueCaptured:false,accountSidCaptured:false,rawServiceDataCaptured:false,
 cOperatorApplied:false,receiptRootCreated:false,runnerWritableVerified:false,
 crossRunDurabilityVerified:false,operationalWrites:0,providerCalls:0,d1Writes:0
});
const out=(status,code)=>({...base,status,code,
 cAccountCandidate:code==='CI_RECEIPT_C_DEDICATED_ACCOUNT_CANDIDATE'});
export function classifyReceiptCOperatorServiceCode(raw){
 if(typeof raw!=='string'||raw.length>80||!CODES.has(raw.trim()))return out('STATE_UNKNOWN','C_SERVICE_ACCOUNT_UNVERIFIED');
 const code=raw.trim();
 return out(code==='DEDICATED_ACCOUNT_CANDIDATE'?'PARTIAL':
  ['SERVICE_NOT_RUNNING','SHARED_ACCOUNT_STOP'].includes(code)?'BLOCKED':'STATE_UNKNOWN',
  'CI_RECEIPT_C_'+code);
}
export function inspectReceiptCOperatorServiceReadonly({
 platform=process.platform,run=spawnSync
}={}){
 if(platform!=='win32')return out('STATE_UNKNOWN','CI_RECEIPT_C_WINDOWS_REQUIRED');
 let result;
 try{
  result=run('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive',
   '-Command',SCRIPT],{
   encoding:'utf8',shell:false,windowsHide:true,timeout:10000,maxBuffer:1024
  });
 }catch{return out('STATE_UNKNOWN','CI_RECEIPT_C_SERVICE_QUERY_UNAVAILABLE');}
 if(result?.error||result?.status!==0||typeof result.stdout!=='string'||
    result.stdout.length>100)
  return out('STATE_UNKNOWN','CI_RECEIPT_C_SERVICE_QUERY_UNAVAILABLE');
 return classifyReceiptCOperatorServiceCode(result.stdout);
}

// Physical-only C packet preflight. GitHub variable configuration is a
// separate condition; absence of a variable must not conceal a preexisting
// target directory. No paths, directory contents or ACLs are returned.
const C_FIXED_DIRS=Object.freeze([
  'C:\\', 'C:\\ProgramData', 'C:\\ProgramData\\ZGMINI-CI',
  'C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts'
]);
const cPathReport=(states,code,status='PARTIAL')=>({
 schema:'ZGMINI_CI_RECEIPT_C_FIXED_PATHS_READONLY_V1',
 status,code,volume:states[0],programData:states[1],
 parent:states[2],receiptRoot:states[3],
 originalCOperatorMayRunUnchanged:states[0]==='DIRECTORY'&&
   states[1]==='DIRECTORY'&&states[2]==='ABSENT'&&states[3]==='ABSENT',
 actualRunnerWriteVerified:false,cOperatorApplied:false,
 githubVariableConfiguredVerified:false,cAdminPrivilegeVerified:false,
 operationalWrites:0,providerCalls:0,d1Writes:0
});
export function inspectReceiptCFixedPathsReadonly({
 platform=process.platform,filesystem=fs
}={}){
 if(platform!=='win32')
  return cPathReport(['UNVERIFIED','UNVERIFIED','UNVERIFIED','UNVERIFIED'],
   'CI_RECEIPT_C_WINDOWS_REQUIRED','STATE_UNKNOWN');
 const states=[];
 for(const p of C_FIXED_DIRS){
  try{
   const item=filesystem.lstatSync(p);
   if(!item.isDirectory()||item.isSymbolicLink()){
    states.push('ALIAS_OR_NON_DIRECTORY');
   }else{
    const real=typeof filesystem.realpathSync?.native==='function'
      ?filesystem.realpathSync.native(p):filesystem.realpathSync(p);
    states.push(path.win32.normalize(real).toLowerCase()===
      path.win32.normalize(p).toLowerCase()?'DIRECTORY':'ALIAS_OR_NON_DIRECTORY');
   }
  }catch(e){
   states.push(e?.code==='ENOENT'?'ABSENT':'UNVERIFIED');
  }
 }
 if(states.some(x=>x==='ALIAS_OR_NON_DIRECTORY'))
  return cPathReport(states,'CI_RECEIPT_C_PATH_ALIAS_STOP','BLOCKED');
 if(states.slice(0,2).some(x=>x!=='DIRECTORY')||states.includes('UNVERIFIED'))
  return cPathReport(states,'CI_RECEIPT_C_FIXED_PATH_UNVERIFIED','STATE_UNKNOWN');
 if(states[2]==='ABSENT'&&states[3]==='ABSENT')
  return cPathReport(states,'CI_RECEIPT_C_TARGET_ABSENT');
 if(states[3]==='DIRECTORY')
  return cPathReport(states,'CI_RECEIPT_C_ROOT_ALREADY_PRESENT');
 if(states[2]==='DIRECTORY')
  return cPathReport(states,'CI_RECEIPT_C_PARENT_ALREADY_PRESENT');
 return cPathReport(states,'CI_RECEIPT_C_PATH_STATE_UNVERIFIED','STATE_UNKNOWN');
}
