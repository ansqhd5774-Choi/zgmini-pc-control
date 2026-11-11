// Fixed Issue -> isolated Windows Runner -> sanitized JSON/TXT readback.
// This is source-only until the workflow is on main AND exact host/runner is verified.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
export const HOST = 'DESKTOP-N62L0NG';
export const SCHEMA = 'ZGMINI_C996_R5_READONLY_REQUEST_V1';
export const OPERATION = 'c996-r5-commit-log-readonly';
const LABEL = 'pc-c996-r5-readonly';
const MAX_BYTES = 32768;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const COLLECTOR = path.join(MODULE_DIR,'collector.mjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function stop(code) { const e=new Error(code);e.code=code;throw e; }

export function validateEvent(event,env) {
  if(env.GITHUB_REPOSITORY!==REPO || env.GITHUB_ACTOR!=='ansqhd5774-Choi' ||
    env.GITHUB_EVENT_NAME!=='issues' || event.action!=='opened' ||
    event.repository?.full_name!==REPO || event.repository?.private!==true ||
    event.issue?.user?.login!=='ansqhd5774-Choi' ||
    !event.issue?.labels?.some(x=>x.name===LABEL) ||
    !Number.isSafeInteger(event.issue.number) || event.issue.number<1) stop('ISSUE_AUTH_STOP');
  let body;
  try {body=JSON.parse(event.issue.body);}catch {stop('REQUEST_JSON_STOP');}
  if(!body || Object.keys(body).sort().join(',')!=='host,operation,requestId,schema' ||
    body.schema!==SCHEMA || body.operation!==OPERATION || body.host!==HOST ||
    typeof body.requestId!=='string' || !UUID.test(body.requestId)) stop('REQUEST_SCOPE_STOP');
  if(!/^[0-9]{1,18}$/.test(env.GITHUB_RUN_ID||'') ||
    !/^[1-9][0-9]{0,4}$/.test(env.GITHUB_RUN_ATTEMPT||'')) stop('RUN_ID_STOP');
  return {requestId:body.requestId,issueNumber:event.issue.number,
    runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT};
}

export function selectSafeReport(raw,ctx,hostname) {
  // Rebuild a fixed-schema report; never publish raw logs, absolute paths or credentials.
  const statuses=['COMPLETE','PARTIAL','STOPPED'];
  if(!raw || raw.schema!=='C996_R5_LOG_EVIDENCE_READONLY_V1' ||
    raw.host!==HOST || !statuses.includes(raw.status) ||
    raw.rawLogIncluded!==false || raw.operationalWrites!==0 ||
    raw.discardAttempts!==0 || raw.isoAttempts!==0) stop('REPORT_CONTRACT_STOP');
  const validCode=s=>typeof s==='string' && /^[A-Z0-9_]{1,80}$/.test(s);
  if(!validCode(raw.code))stop('REPORT_CODE_STOP');
  const pins=(raw.inputs||[]).map(v=>{
    if(!/^(ADK_WIM|FINAL_WIM|TEST_ISO|BIOS_BCD|UEFI_BCD)$/.test(v.id||'') ||
      !/^[a-f0-9]{64}$/.test(v.sha256||'') || !Number.isSafeInteger(v.bytes))
      stop('HASH_REPORT_STOP');
    return {id:v.id,matched:v.matched===true,bytes:v.bytes,sha256:v.sha256};
  });
  if(pins.length>5)stop('HASH_REPORT_STOP');
  const logs=(raw.logs||[]).map(v=>{
    if(!/^[A-Za-z0-9_.-]{1,96}\.log$/i.test(v.name||'') ||
      !/^[a-f0-9]{64}$/.test(v.sha256||'') || !Number.isSafeInteger(v.bytes) ||
      !Number.isSafeInteger(v.lines) && v.lines!==undefined ||
      !/^(R5_ROOT|ISO_ATTEMPT|ISO_LOGS|R5_LOGS)$/.test(v.directory||''))
      stop('LOG_REPORT_STOP');
    const counts={};
    for(const [k,n] of Object.entries(v.counts||{})){
      if(!/^(COMMIT_REQUEST|MOUNT_REQUEST|METADATA_MENTION|ERROR_MENTION|OPERATION_SUCCESS)$/.test(k) ||
        !Number.isSafeInteger(n)||n<0)stop('LOG_REPORT_STOP');
      counts[k]=n;
    }
    return {directory:v.directory,name:v.name,bytes:v.bytes,sha256:v.sha256,counts};
  });
  if(logs.length>16) stop('LOG_REPORT_STOP');
  return {schema:'ZGMINI_C996_R5_GITHUB_RESULT_V1',
    requestId:ctx.requestId,issueNumber:ctx.issueNumber,runId:ctx.runId,attempt:ctx.attempt,
    host:hostname,code:raw.code,status:raw.status,logCount:logs.length,
    pinCount:pins.filter(x=>x.matched).length,sourceClassification:'IMAGE_METADATA_DRIFT_CONFIRMED',
    rootCauseStage:'UNKNOWN',isoOnlyPassPreserved:true,operationalWrites:0,
    automaticRetries:0,rawLogIncluded:false,pins,logs};
}

function resultText(r) {
  return ['schema='+r.schema,'requestId='+r.requestId,'runId='+r.runId,
    'attempt='+r.attempt,'host='+r.host,'status='+r.status,'code='+r.code,
    'pinCount='+r.pinCount+'/5','logCount='+r.logCount,'rootCauseStage=UNKNOWN',
    'operationalWrites=0','rawLogIncluded=false',''].join('\r\n');
}
function bounded(value) {const s=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';
  if(Buffer.byteLength(s,'utf8')>MAX_BYTES)stop('RESULT_TOO_LARGE');return s;}

export function readCollectorResult(output,hostname,ctx) {
  const marker=/^RESULT_DIR=(C:\\Users\\ansqh\\AppData\\Local\\Temp\\C996_R5_READONLY_[a-f0-9]{32})\r?$/m;
  const m=typeof output==='string'&&output.match(marker);
  if(!m)stop('RESULT_DIRECTORY_NOT_REPORTED');
  const dir=m[1];
  const p=path.win32.join(dir,'summary.json');
  const s=fs.lstatSync(p);
  if(!s.isFile()||s.isSymbolicLink()||s.size>MAX_BYTES)stop('RESULT_FILE_INVALID');
  const raw=JSON.parse(fs.readFileSync(p,'utf8'));
  return selectSafeReport(raw,ctx,hostname);
}

export function runCollector(ctx,hostname) {
  if(hostname!==HOST) {
    return {schema:'ZGMINI_C996_R5_GITHUB_RESULT_V1',...ctx,host:hostname,
      status:'BLOCKED',code:'WRONG_HOST',pinCount:0,logCount:0,
      sourceClassification:'IMAGE_METADATA_DRIFT_CONFIRMED',
      rootCauseStage:'UNKNOWN',isoOnlyPassPreserved:true,
      operationalWrites:0,automaticRetries:0,rawLogIncluded:false,pins:[],logs:[]};
  }
  const child=spawnSync(process.execPath,[COLLECTOR],{cwd:MODULE_DIR,encoding:'utf8',
    timeout:180000,maxBuffer:16384,shell:false,windowsHide:true});
  try {
    const report=readCollectorResult(child.stdout,hostname,ctx);
    if(child.error || !Number.isInteger(child.status) ||
       (report.status==='COMPLETE' && child.status!==0) ||
       (report.status!=='COMPLETE' && child.status!==2))
      stop('COLLECTOR_EXIT_MISMATCH');
    return report;
  } catch(e) {
    return {schema:'ZGMINI_C996_R5_GITHUB_RESULT_V1',...ctx,host:hostname,
      status:'BLOCKED',code:e.code||'COLLECTOR_STOPPED',pinCount:0,logCount:0,
      sourceClassification:'IMAGE_METADATA_DRIFT_CONFIRMED',
      rootCauseStage:'UNKNOWN',isoOnlyPassPreserved:true,
      operationalWrites:0,automaticRetries:0,rawLogIncluded:false,pins:[],logs:[]};
  }
}

export async function uploadVerifiedPair(report,token,fetcher=fetch) {
  if(!token)stop('TOKEN_MISSING');
  const base='https://api.github.com/repos/'+REPO;
  const stem='results/c996-r5-'+report.runId+'-'+report.attempt;
  const files=[{file:stem+'.json',data:bounded(report)},
    {file:stem+'.txt',data:bounded(resultText(report))}];
  async function api(method,subpath,body){
    const res=await fetcher(base+subpath,{method,headers:{
      Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)});
    if(!res.ok)stop('GITHUB_HTTP_'+res.status);
    return res.json();
  }
  // Unique run/attempt path: never overwrite a previous result.
  for (const f of files) {
    await api('PUT','/contents/'+f.file,{message:'results(c996): sanitized R5 readonly '+report.runId,
      content:Buffer.from(f.data).toString('base64'),branch:'main'});
    const got=await api('GET','/contents/'+f.file+'?ref=main');
    const decoded=Buffer.from((got.content||'').replace(/\s/g,''),'base64').toString('utf8');
    if(decoded!==f.data)stop('RESULT_READBACK_MISMATCH');
  }
  await api('POST','/issues/'+report.issueNumber+'/comments',{
    body:'<!-- zgmini-c996-r5-result:'+report.runId+':'+report.attempt+' -->\n'+
      'C996 R5 readonly: '+report.status+' / '+report.code+
      '; result pairs verified at '+stem+'.json and '+stem+'.txt; '+
      'rootCauseStage=UNKNOWN; operationalWrites=0; no automatic retry.'});
  return {verified:true,json:files[0].file,txt:files[1].file};
}

async function main(){
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const ctx=validateEvent(event,env);
  const report=runCollector(ctx,os.hostname().toUpperCase());
  await uploadVerifiedPair(report,env.GITHUB_TOKEN);
  console.log('C996_RESULT_PUBLISHED_VERIFIED status='+report.status+
    ' code='+report.code+' runId='+ctx.runId);
  if(report.status!=='COMPLETE')process.exitCode=2;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await main();
