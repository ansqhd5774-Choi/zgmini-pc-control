// Fixed, read-only inventory on already registered ZGMINI self-hosted Windows runners.
// No child processes, system configuration changes, source installation, or operational data access.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';

export const REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='pc-host-inventory-readonly';
export const SCHEMA='ZGMINI_PC_HOST_INVENTORY_REQUEST_V1';
const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES=['operating','handoff'];
const QUEUE_HOST='DESKTOP-N62L0NG';
function stop(code){const error=new Error(code);error.code=code;throw error;}
function clean(s,max=120){return String(s||'').replace(/[^\x20-\x7e]/g,'?').slice(0,max);}
export function authenticate(event,env,role){
 if(!ROLES.includes(role) || env.GITHUB_REPOSITORY!==REPOSITORY ||
    env.GITHUB_ACTOR!=='ansqhd5774-Choi' || env.GITHUB_EVENT_NAME!=='issues' ||
    event?.action!=='opened' || event?.repository?.full_name!==REPOSITORY ||
    event?.repository?.private!==true || event?.issue?.user?.login!=='ansqhd5774-Choi' ||
    event?.issue?.title!==TITLE || !Number.isSafeInteger(event.issue.number) ||
    event.issue.number<1) stop('ADMISSION_DENIED');
 let body;
 try{body=JSON.parse(event.issue.body);}catch{stop('REQUEST_JSON_INVALID');}
 if(!body || Object.keys(body).sort().join(',')!=='operation,requestId,role,schema' ||
    body.schema!==SCHEMA || body.operation!=='host-inventory-readonly' ||
    body.role!==role || typeof body.requestId!=='string' ||
    !REQUEST_ID.test(body.requestId)) stop('REQUEST_SCOPE_INVALID');
 if(!/^[1-9][0-9]{0,17}$/.test(env.GITHUB_RUN_ID||'') ||
    !/^[1-9][0-9]{0,4}$/.test(env.GITHUB_RUN_ATTEMPT||'')) stop('RUN_ID_INVALID');
 return {role,requestId:body.requestId,issueNumber:event.issue.number,
  runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT};
}
export function validateSeat(role,hostname,runnerName,computername){
 const host=clean(hostname,64).toUpperCase();
 const machine=clean(computername,64).toUpperCase();
 if(!host || !machine || host!==machine) return 'HOST_IDENTITY_UNVERIFIED';
 if(role==='operating'){
  if(host===QUEUE_HOST) return 'OPERATING_HOST_COLLIDES_WITH_QUEUE';
  return /^zgmini-pc-0[1-6]$/.test(runnerName)?'MATCH':'OPERATING_RUNNER_MISMATCH';
 }
 if(role==='handoff'){
  if(host!==QUEUE_HOST) return 'HANDOFF_HOST_MISMATCH';
  return runnerName==='zgmini-handoff-ci-spare-01'?'MATCH':'HANDOFF_RUNNER_MISMATCH';
 }
 return 'ROLE_INVALID';
}
function disk(root){
 try{
  if(!fs.existsSync(root))return {drive:root.slice(0,2),present:false};
  if(typeof fs.statfsSync!=='function')return {drive:root.slice(0,2),present:true,capacityMiB:null,freeMiB:null};
  const s=fs.statfsSync(root,{bigint:true});
  const mib=1048576n;
  return {drive:root.slice(0,2),present:true,
   capacityMiB:Number(s.blocks*s.bsize/mib),freeMiB:Number(s.bavail*s.bsize/mib)};
 }catch{return {drive:root.slice(0,2),present:true,capacityMiB:null,freeMiB:null};}
}
export function collectInventory(ctx,env=process.env){
 const hostname=clean(os.hostname(),64).toUpperCase();
 const runnerName=clean(env.RUNNER_NAME,80);
 const seat=validateSeat(ctx.role,hostname,runnerName,env.COMPUTERNAME);
 const base={schema:'ZGMINI_PC_HOST_INVENTORY_RESULT_V1',requestId:ctx.requestId,
  issueNumber:ctx.issueNumber,runId:ctx.runId,attempt:ctx.attempt,
  role:ctx.role,host:hostname,runnerName,
  expectedLabel:ctx.role==='operating'?'zgmini-pc-control':'zgmini-handoff-ci-isolated',
  status:seat==='MATCH'?'PASS':'BLOCKED',
  code:seat==='MATCH'?'READONLY_HOST_INVENTORY_COLLECTED':seat,
  operationalWrites:0,providerCalls:0,sqliteOpened:false,d1Writes:0,
  automaticRetries:0};
 if(seat!=='MATCH')return base;
 const processors=os.cpus();
 return {...base,
  os:{platform:clean(os.platform(),24),version:clean(os.version(),80),
   release:clean(os.release(),40),arch:clean(os.arch(),20)},
  cpu:{model:clean(processors[0]?.model||'UNKNOWN',120),logicalCount:processors.length},
  memory:{totalMiB:Math.floor(os.totalmem()/1048576),
   freeMiB:Math.floor(os.freemem()/1048576)},
  disks:[disk('C:\\'),disk('E:\\')],
  node:{version:clean(process.version,32),arch:clean(process.arch,20),
   executableAtApprovedOperatingPath:path.win32.normalize(process.execPath).toLowerCase()===
    'e:\\zgmini\\runtime\\node.exe'},
  installedLayout:{
   zgminiRoot:fs.existsSync('E:\\ZGmini'),
   operatingNode:fs.existsSync('E:\\ZGmini\\runtime\\node.exe'),
   controller:fs.existsSync('E:\\ZGmini\\automation\\pc-control'),
   controlCheckout:fs.existsSync('E:\\ZGmini\\projects\\zgmini-pc-control')
  }};
}
export function toText(r){
 const lines=['schema='+r.schema,'requestId='+r.requestId,'runId='+r.runId,
  'attempt='+r.attempt,'role='+r.role,'host='+r.host,'runner='+r.runnerName,
  'expectedLabel='+r.expectedLabel,'status='+r.status,'code='+r.code,
  'operationalWrites=0','automaticRetries=0'];
 if(r.memory)lines.push('memory.totalMiB='+r.memory.totalMiB,
  'memory.freeMiB='+r.memory.freeMiB);
 return lines.join('\r\n')+'\r\n';
}
async function run(){
 const env=process.env;
 const role=process.argv[2];
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const ctx=authenticate(event,env,role);
 const report=collectInventory(ctx,env);
 const stem='results/pc-host-inventory-'+ctx.runId+'-'+ctx.attempt+'-'+role;
 const outputs=[[stem+'.json',JSON.stringify(report,null,2)+'\n'],[stem+'.txt',toText(report)]];
 const headers={authorization:'Bearer '+env.GITHUB_TOKEN,
  accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
  'content-type':'application/json'};
 const uploaded=await uploadResultPairAtomic({outputs,headers,
  message:'results(inventory): sanitized read-only '+ctx.role+' '+ctx.runId});
 if(uploaded.delivery!=='RESULT_PAIR_READBACK_VERIFIED')stop(uploaded.delivery);
 const url='https://api.github.com/repos/'+REPOSITORY+'/issues/'+ctx.issueNumber+'/comments';
 // Comments are secondary evidence; the immutable result pair is authoritative.
 const ack=await fetch(url,{method:'POST',headers,body:JSON.stringify({
  body:'<!-- zgmini-pc-inventory:'+ctx.runId+':'+ctx.role+' -->\n'+
   'READONLY HOST INVENTORY '+ctx.role+': '+report.status+' / '+report.code+
   '; verified '+stem+'.json and '+stem+'.txt; operationalWrites=0; retries=0.'
 })});
 if(!ack.ok)stop('ISSUE_COMMENT_UNVERIFIED');
 console.log('HOST_INVENTORY_RESULT_VERIFIED role='+role+' status='+report.status+
  ' code='+report.code+' runId='+ctx.runId);
 if(report.status!=='PASS')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 // Windows paths differ from URL pathnames: use a direct file URL comparison below.
}
import {fileURLToPath} from 'node:url';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
