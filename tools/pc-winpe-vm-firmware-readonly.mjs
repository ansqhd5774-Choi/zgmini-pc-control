// #996 fixed isolated WinPE feasibility. A-grade READ-ONLY evidence only.
// Existing GitHub Issue->isolated Runner->atomic JSON/TXT. NO VM install, boot,
// arbitrary shell, arbitrary paths, C grade work or automatic retries.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {probeFixedVmPrograms} from './pc-host-inventory-readonly.mjs';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
export const TITLE='pc-winpe-vm-firmware-readonly';
export const SCHEMA='ZGMINI_PC_WINPE_VM_FIRMWARE_REQUEST_V1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PS='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const KEYS=['VM_MONITOR','SLAT','FIRMWARE_ENABLED','HYPERVISOR_PRESENT'];
const stop=code=>{throw Object.assign(new Error(code),{code});};
const blocked=code=>({
 schema:'ZGMINI_PC_WINPE_VM_FIRMWARE_RESULT_V1',
 status:'STATE_UNKNOWN',code,firmwareEvidence:'NOT_ATTESTED',
 vmInstalledByProbe:false,winpeBooted:false,bootAuthorized:false,
 cExecutionAuthorized:false,operationalWrites:0,automaticRetries:0,
});
export function authenticateVmRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='issues'||
    env.GITHUB_ACTOR!==OWNER||event?.action!=='opened'||
    event?.repository?.full_name!==REPO||event.repository.private!==true||
    event?.issue?.user?.login!==OWNER||event.issue.title!==TITLE||
    !Number.isSafeInteger(event.issue.number)||event.issue.number<=0)
    stop('VM_ADMISSION_DENIED');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{stop('VM_JSON_INVALID');}
 if(!request||Object.keys(request).sort().join(',')!==
      'operation,requestId,role,schema,scope'||
    request.schema!==SCHEMA||request.operation!=='winpe-vm-firmware-readonly'||
    request.role!=='handoff'||request.scope!=='C996_ISOLATED_VM_PREFLIGHT'||
    typeof request.requestId!=='string'||!UUID.test(request.requestId))
    stop('VM_SCOPE_DENIED');
 if(!/^[1-9][0-9]{0,17}$/.test(env.GITHUB_RUN_ID||'')||
    env.GITHUB_RUN_ATTEMPT!=='1')stop('VM_ATTEMPT_DENIED');
 return Object.freeze({requestId:request.requestId,issueNumber:event.issue.number,
   runId:env.GITHUB_RUN_ID,attempt:'1'});
}
export function handoffSeat({
 platform=process.platform,host=os.hostname(),runner=process.env.RUNNER_NAME,
 originalRootExists=fs.existsSync('E:\\ZGmini'),
}={}){
 return platform==='win32'&&String(host).toUpperCase()==='DESKTOP-N62L0NG'&&
   runner==='zgmini-handoff-ci-spare-01'&&!originalRootExists?
   null:'VM_HANDOFF_HOST_DENIED';
}
export const WMI_QUERY=[
 "$ErrorActionPreference='Stop'",
 'function F([object] $x) {',
 " if ($null -eq $x) {return 'unknown'}",
 " if ($x -is [bool]) {if ($x) {return 'true'} else {return 'false'}}",
 " return 'unknown'",
 '}',
 'try {',
 ' $p=Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1',
 ' $c=Get-CimInstance -ClassName Win32_ComputerSystem',
 ' if ($null -eq $p -or $null -eq $c) { exit 2 }',
 " [Console]::Out.WriteLine('VM_MONITOR='+ (F $p.VMMonitorModeExtensions))",
 " [Console]::Out.WriteLine('SLAT='+ (F $p.SecondLevelAddressTranslationExtensions))",
 " [Console]::Out.WriteLine('FIRMWARE_ENABLED='+ (F $p.VirtualizationFirmwareEnabled))",
 " [Console]::Out.WriteLine('HYPERVISOR_PRESENT='+ (F $c.HypervisorPresent))",
 '} catch {exit 2}',
].join('\n');
export function parseWmi(stdout){
 if(typeof stdout!=='string')return null;
 const lines=stdout.trim().split(/\r?\n/),out={};
 if(lines.length!==KEYS.length)return null;
 for(let i=0;i<KEYS.length;i++){
  const prefix=KEYS[i]+'=';
  if(!lines[i].startsWith(prefix))return null;
  const val=lines[i].slice(prefix.length);
  if(!['true','false','unknown'].includes(val))return null;
  out[KEYS[i]]=val==='unknown'?null:val==='true';
 }
 return Object.freeze(out);
}
export function probeVmFirmware({
 platform=process.platform,spawn=spawnSync,vmProbe=probeFixedVmPrograms,
}={}){
 if(platform!=='win32')return blocked('VM_WINDOWS_ONLY');
 let p;
 try{
  p=spawn(PS,['-NoProfile','-NonInteractive','-EncodedCommand',
     Buffer.from(WMI_QUERY,'utf16le').toString('base64')],{
     encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:8000,
     shell:false,stdio:['ignore','pipe','pipe'],
  });
 }catch{return blocked('VM_WMI_UNAVAILABLE');}
 if(p?.error||p?.status!==0)return blocked('VM_WMI_UNAVAILABLE');
 const firmware=parseWmi(p.stdout);
 if(!firmware)return blocked('VM_WMI_OUTPUT_INVALID');
 let vm;
 try{vm=vmProbe();}catch{return blocked('VM_FIXED_PATH_PROBE_UNAVAILABLE');}
 if(vm?.scope!=='STANDARD_C_PATHS_ONLY'||vm.pathCount!==6||
    !Array.isArray(vm.programs)||vm.programs.length!==6)
    return blocked('VM_FIXED_PATH_PROBE_INVALID');
 const readiness=Object.values(firmware).some(x=>x===null)?'VM_FIRMWARE_UNKNOWN':
   !firmware.FIRMWARE_ENABLED?'VM_FIRMWARE_DISABLED':
   !firmware.VM_MONITOR||!firmware.SLAT?'VM_CPU_FEATURES_NOT_CONFIRMED':
   'VM_HARDWARE_FEATURES_PRESENT_ONLY';
 return Object.freeze({
  schema:'ZGMINI_PC_WINPE_VM_FIRMWARE_RESULT_V1',
  status:'PASS',code:'VM_FIRMWARE_FIXED_PATHS_READONLY_OBSERVED',
  firmware,readiness,
  vmPrograms:vm.programs.map(x=>({id:x.id,status:x.status})),
  vmPathsMode:'STANDARD_C_PATHS_ONLY',portableInstalls:'NOT_CHECKED',
  binaryPresentAtFixedPath:vm.programs.some(x=>x.status==='FILE_PRESENT'),
  vmOperationallyTested:false,vmInstalledByProbe:false,winpeBooted:false,
  bootAuthorized:false,cExecutionAuthorized:false,
  operationalWrites:0,automaticRetries:0,
 });
}
export function toVmText(r){
 return ['schema='+r.schema,'requestId='+r.requestId,
  'runId='+r.runId,'attempt='+r.attempt,
  'status='+r.status,'code='+r.code,
  'bootAuthorized=false','cExecutionAuthorized=false',
  'operationalWrites=0','automaticRetries=0'].join('\r\n')+'\r\n';
}
async function run(){
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const ctx=authenticateVmRequest(event,env);
 if(!env.GITHUB_TOKEN)stop('VM_RESULT_TOKEN_MISSING');
 const seat=handoffSeat(),probe=seat?blocked(seat):probeVmFirmware();
 const report={...probe,requestId:ctx.requestId,issueNumber:ctx.issueNumber,
  runId:ctx.runId,attempt:ctx.attempt,role:'handoff',
  host:os.hostname(),runner:env.RUNNER_NAME||''};
 const base='results/pc-winpe-vm-firmware-'+ctx.runId+'-'+ctx.attempt+'-handoff';
 const outputs=[[base+'.json',JSON.stringify(report,null,2)+'\n'],
  [base+'.txt',toVmText(report)]];
 const headers={authorization:'Bearer '+env.GITHUB_TOKEN,
  accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','content-type':'application/json'};
 const receipt=await uploadResultPairAtomic({outputs,headers,
  message:'results(c996): isolated VM firmware readonly '+ctx.runId});
 if(receipt.delivery!=='RESULT_PAIR_READBACK_VERIFIED')
   stop('VM_RESULT_PAIR_READBACK_UNVERIFIED');
 const ack=await fetch('https://api.github.com/repos/'+REPO+
  '/issues/'+ctx.issueNumber+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:'<!-- c996-firmware:'+ctx.runId+' -->\n'+
   'VM FIRMWARE READONLY '+report.status+' / '+report.code+
   '; verified '+base+'.json and '+base+'.txt; writes=0; retries=0.'})});
 if(!ack.ok)stop('VM_ACK_UNVERIFIED');
 console.log('VM_FIRMWARE_READONLY '+report.status+' / '+report.code+
  ' runId='+ctx.runId);
 if(report.status!=='PASS')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await run();
