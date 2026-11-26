// Same-host fixed A-grade preflight for the existing independent C-grade
// receipt-root operator. Return only coarse account compatibility, never the
// Windows service account, SID, raw WMI data, paths, or permissions.
import {spawnSync} from 'node:child_process';

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
 cAccountCandidate:code==='DEDICATED_ACCOUNT_CANDIDATE'});
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
