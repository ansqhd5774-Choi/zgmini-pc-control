// #996 fixed original-PC A-grade volume identity readback. No C effects.
// Same approved pc-host-inventory GitHub workflow, different explicit Issue
// title and schema; never accepts arbitrary path, CMD, C-grade action or retry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='pc-volume-identity-readonly';
export const SCHEMA='ZGMINI_PC_VOLUME_IDENTITY_REQUEST_V1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const GUID=/^\\\\\?\\Volume\{[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\}\\$/i;
const ID=/^[a-f0-9]{16}:[a-f0-9]{32}$/;
const PS='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const NODE='E:\\ZGmini\\runtime\\node.exe';
const stop=code=>{throw Object.assign(Error(code),{code});};
const fail=code=>Object.freeze({
 schema:'ZGMINI_PC_VOLUME_IDENTITY_PROBE_V1',status:'STATE_UNKNOWN',code,
 offlineVolumeVerified:false,ownerApprovalVerified:false,
 cExecutionAuthorized:false,operationalWrites:0,automaticRetries:0,
});

export function authenticateVolumeIssue(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
    env.GITHUB_EVENT_NAME!=='issues'||event?.action!=='opened'||
    event?.repository?.full_name!==REPO||event?.repository?.private!==true||
    event?.issue?.title!==TITLE||event?.issue?.user?.login!=='ansqhd5774-Choi'||
    !Number.isSafeInteger(event?.issue?.number)||event.issue.number<=0)
   stop('VOLUME_ISSUE_ADMISSION_DENIED');
 let body;
 try{body=JSON.parse(event.issue.body);}catch{stop('VOLUME_REQUEST_JSON_INVALID');}
 if(!body||Object.keys(body).sort().join(',')!=='operation,requestId,schema,scope'||
    body.schema!==SCHEMA||body.operation!=='volume-identity-readonly'||
    body.scope!=='C996_FIXED_E_VOLUME'||typeof body.requestId!=='string'||
    !UUID.test(body.requestId))stop('VOLUME_ISSUE_SCOPE_DENIED');
 if(!/^[1-9][0-9]{0,17}$/.test(env.GITHUB_RUN_ID||'')||
    env.GITHUB_RUN_ATTEMPT!=='1')stop('VOLUME_RUN_INVALID');
 return Object.freeze({issueNumber:event.issue.number,requestId:body.requestId,
   runId:env.GITHUB_RUN_ID,attempt:'1'});
}
export function originalPcGate({
 platform=process.platform,hostname=os.hostname(),runnerName=process.env.RUNNER_NAME,
 nodePath=process.execPath,
}={}){
 return platform==='win32'&&hostname.toUpperCase()==='PC'&&
   /^zgmini-pc-0[1-6]$/.test(runnerName||'')&&
   path.win32.normalize(nodePath).toLowerCase()===NODE.toLowerCase()?
   null:'VOLUME_ORIGINAL_PC_IDENTITY_DENIED';
}

// Only internally selected fixed roots. Test fixture is accessible solely
// through importing this function; the Issue run always chooses 'operating'.
export function buildFixedVolumeProbe(mode,csSource){
 if(!['operating','handoff-fixture'].includes(mode)||
    typeof csSource!=='string'||csSource.length<1000||
    csSource.includes("'@")||!csSource.includes('class ZGmini996VolumeReadOnly'))
    throw Error('VOLUME_NATIVE_SOURCE_INVALID');
 const root=mode==='operating'?'E:\\':'C:\\';
 const entries=mode==='operating'?[
  ['VOLUME_ROOT','E:\\'],['ZGMINI','E:\\ZGmini'],
  ['AUTOMATION','E:\\ZGmini\\automation'],
  ['MAINTENANCE','E:\\ZGmini\\automation\\pc-maintenance'],
  ['LEASES','E:\\ZGmini\\automation\\pc-maintenance\\leases'],
  ['OLD_C','E:\\ZGmini\\automation\\pc-maintenance\\leases\\controller-recovery'],
  ['INSTALL','E:\\ZGmini\\automation\\pc-maintenance\\leases\\controller-install'],
 ]:[
  ['VOLUME_ROOT','C:\\'],['ZGMINI','C:\\Windows'],
  ['AUTOMATION','C:\\Windows\\System32'],
  ['MAINTENANCE','C:\\Windows\\System32\\drivers'],
  ['LEASES','C:\\Windows\\System32\\drivers\\etc'],
 ];
 const calls=["[Console]::Out.WriteLine('VOLUME_GUID='+[ZGmini996VolumeReadOnly]::VolumeGuid('"+root+"'))"];
 for(const [key,fixed] of entries)
   calls.push("[Console]::Out.WriteLine('"+key+"='+[ZGmini996VolumeReadOnly]::Identity('"+fixed+"'))");
 return "$ErrorActionPreference='Stop'\ntry {\nAdd-Type -TypeDefinition @'\n"+
   csSource+"\n'@\n"+calls.join('\n')+
   "\n} catch { [Console]::Out.WriteLine('NATIVE_STOP'); exit 2 }\n";
}
export function decodeFixedVolumeResponse(stdout,mode){
 const keys=mode==='operating'?
  ['VOLUME_GUID','VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE','LEASES','OLD_C','INSTALL']:
  ['VOLUME_GUID','VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE','LEASES'];
 if(typeof stdout!=='string')return fail('VOLUME_NATIVE_OUTPUT_INVALID');
 const lines=stdout.trim().split(/\r?\n/),rows={};
 if(lines.length!==keys.length)return fail('VOLUME_NATIVE_OUTPUT_INVALID');
 for(let i=0;i<keys.length;i++){
   if(!lines[i].startsWith(keys[i]+'='))
     return fail('VOLUME_NATIVE_OUTPUT_INVALID');
   rows[keys[i]]=lines[i].slice(keys[i].length+1);
 }
 if(!GUID.test(rows.VOLUME_GUID))return fail('VOLUME_GUID_INVALID');
 for(const k of keys.slice(1))
   if(!ID.test(rows[k])&&
     !(mode==='operating'&&['OLD_C','INSTALL'].includes(k)&&rows[k]==='ABSENT'))
     return fail('VOLUME_ID_INVALID');
 if(['VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE','LEASES']
   .some(k=>!ID.test(rows[k])))
   return fail('VOLUME_REQUIRED_PATH_MISSING');
 const serial=rows.VOLUME_ROOT.slice(0,16);
 if(keys.slice(1).some(k=>rows[k]!=='ABSENT'&&rows[k].slice(0,16)!==serial))
   return fail('VOLUME_SERIAL_MISMATCH');
 const partial=mode==='operating'&&(rows.OLD_C==='ABSENT'||rows.INSTALL==='ABSENT');
 return Object.freeze({
   schema:'ZGMINI_PC_VOLUME_IDENTITY_PROBE_V1',
   status:partial?'STATE_UNKNOWN':'PASS',
   code:partial?'VOLUME_ORIGINAL_C_DIR_MISSING':'VOLUME_IDS_READONLY_OBSERVED',
   volumeGuid:rows.VOLUME_GUID.replace(/\\volume\{/i,'\\Volume{'),volumeSerial:serial,
   directories:Object.fromEntries(keys.slice(1).map(k=>[k,
     rows[k]==='ABSENT'?{state:'ABSENT'}:
      {state:'PRESENT',fileId128:rows[k].slice(17)}])),
   source:'WIN32_GET_VOLUME_NAME_AND_FILE_ID_INFO',
   offlineVolumeVerified:false,ownerApprovalVerified:false,
   cExecutionAuthorized:false,operationalWrites:0,automaticRetries:0,
 });
}
export function probeFixedVolume(mode='operating',{
 platform=process.platform,spawn=spawnSync,
 csSource=fs.readFileSync(new URL('./pc-volume-identity-win32-readonly.cs',import.meta.url),'utf8'),
}={}){
 if(platform!=='win32')return fail('VOLUME_WINDOWS_ONLY');
 let command;
 try{command=buildFixedVolumeProbe(mode,csSource);}
 catch{return fail('VOLUME_NATIVE_SOURCE_INVALID');}
 let result;
 try{
  result=spawn(PS,['-NoProfile','-NonInteractive','-EncodedCommand',
     Buffer.from(command,'utf16le').toString('base64')],{
    encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:12000,
    shell:false,stdio:['ignore','pipe','pipe'],
  });
 }catch{return fail('VOLUME_NATIVE_PROBE_UNAVAILABLE');}
 if(result?.error||result?.status!==0||typeof result?.stdout!=='string')
   return fail('VOLUME_NATIVE_PROBE_UNAVAILABLE');
 return decodeFixedVolumeResponse(result.stdout,mode);
}
export function volumeText(r){
 return ['schema='+r.schema,'requestId='+r.requestId,
  'runId='+r.runId,'attempt='+r.attempt,'role=operating',
  'status='+r.status,'code='+r.code,
  'operationalWrites=0','automaticRetries=0'].join('\r\n')+'\r\n';
}
async function run(){
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const ctx=authenticateVolumeIssue(event,env);
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<1)
   stop('VOLUME_RESULT_CREDENTIAL_MISSING');
 const gate=originalPcGate();
 const proof=gate?fail(gate):probeFixedVolume('operating');
 const report=Object.freeze({...proof,requestId:ctx.requestId,runId:ctx.runId,
  issueNumber:ctx.issueNumber,attempt:ctx.attempt,role:'operating',
  host:os.hostname(),runnerName:env.RUNNER_NAME||''});
 const prefix='results/pc-volume-identity-'+ctx.runId+'-'+ctx.attempt+'-operating';
 const headers={authorization:'Bearer '+env.GITHUB_TOKEN,
  accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
  'content-type':'application/json'};
 const outputs=[[prefix+'.json',JSON.stringify(report,null,2)+'\n'],
  [prefix+'.txt',volumeText(report)]];
 const receipt=await uploadResultPairAtomic({outputs,headers,
  message:'results(c996): original volume identity A readonly '+ctx.runId});
 if(receipt.delivery!=='RESULT_PAIR_READBACK_VERIFIED')
   stop('VOLUME_RESULT_PAIR_UNVERIFIED');
 const response=await fetch('https://api.github.com/repos/'+REPO+
  '/issues/'+ctx.issueNumber+'/comments',{method:'POST',headers,
  body:JSON.stringify({body:'<!-- c996-readonly-volume:'+ctx.runId+' -->\n'+
   'C996 FIXED VOLUME READONLY '+report.status+' / '+report.code+
   '; verified '+prefix+'.json and '+prefix+'.txt; C writes=0; retry=0.'})});
 if(!response.ok)stop('VOLUME_ISSUE_ACK_UNVERIFIED');
 console.log('C996_VOLUME_READONLY '+report.status+' / '+report.code+' run='+ctx.runId);
 if(report.status!=='PASS')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await run();
