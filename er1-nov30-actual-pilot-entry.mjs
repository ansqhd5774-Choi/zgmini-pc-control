// Fixed B one-shot: PC-private November actuals and preview, no public writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const SOURCE_SHA='3c58c9232ad4880cf955e17a1edc9bda4b1f0543';
const SOURCE_HASH='4f267ae1344a999816be1d9385d8cb5dc0620ab0ec3bb65253e3eaf4e30b7720';
const SOURCE_BRANCH='codex/market-calendar-nov2026-er1-pilot-b-20261105';
const TITLE='pc-er1-nov30-actual-pilot-one-shot';
const LABEL='pc-er1-approved';
const NODE='E:\\ZGmini\\runtime\\node.exe';
const MARKER_DIR='E:\\ZGmini\\automation\\er1-nov30-actual-pilot';
const SCRIPT='scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs';
const APPROVAL='ER1_NOV30_ACTUAL_PILOT_B_APPROVAL.json';
const REPORT='ER1_NOV30_ACTUAL_PILOT_RESULT.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const stop=code=>{throw Error(code)};
const codeOf=e=>/^NOV30_PILOT_[A-Z0-9_]+$/.test(String(e?.message))?
 e.message:'NOV30_PILOT_ENTRY_UNEXPECTED_STOP';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const requestPattern=new RegExp('^pc-nov30-'+UUID+'$');
const chatPattern=new RegExp('^chat-'+UUID+'$');

export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==TITLE||
  !event.issue.labels?.some(x=>x.name===LABEL))
  stop('NOV30_PILOT_ISSUE_NOT_APPROVED');
 let req;try{req=JSON.parse(event.issue.body)}catch{stop('NOV30_PILOT_JSON_STOP')}
 const fields=['schema','operation','requestId','chatId','sourceSha','from','through'].sort().join('|');
 if(!req||typeof req!=='object'||Array.isArray(req)||
  Object.keys(req).sort().join('|')!==fields||
  req.schema!=='ZGMINI_ER1_NOV30_ACTUAL_PILOT_V1'||
  req.operation!=='probe-private-november-2026-actual-er1'||
  req.sourceSha!==SOURCE_SHA||req.from!=='2026-11-01'||req.through!=='2026-11-30'||
  !requestPattern.test(req.requestId)||!chatPattern.test(req.chatId))
  stop('NOV30_PILOT_REQUEST_CONTRACT_STOP');
 return req;
}

export function validateApproval(value){
 if(value?.schema!=='ZGMINI_ER1_NOV30_ACTUAL_PILOT_APPROVAL_V1'||
  value.approvalState!=='APPROVED_B_ONE_SHOT'||
  value.scope!=='PC_PRIVATE_2026_11_FUTURE_3_SYMBOL_ACTUAL_PILOT_ONLY'||
  value.sourceRepository!=='ansqhd5774-Choi/zgmini'||
  value.sourceBranch!==SOURCE_BRANCH||value.sourceSha!==SOURCE_SHA||
  value.sourceFile!==SCRIPT||value.sourceFileSha256!==SOURCE_HASH||
  value.maxProviderRequests!==3||value.maxAutomaticRetries!==0||
  value.onlyFutureScheduledDates!==true||value.requireActualHistory!==true||
  value.allowCoreReadOnly!==true||value.allowCoreWrites!==false||
  value.allowPrivateRawWrites!==true||value.allowLocalPreviewWrites!==true||
  value.allowD1Writes!==false||value.allowPublicRawData!==false||
  value.allowExistingFeedWrites!==false||
  value.allowSchedulerChanges!==false||value.allowDirectDeployment!==false)
  stop('NOV30_PILOT_APPROVAL_SCOPE_STOP');
 return true;
}
function verifyApproval(workspace){
 const file=path.join(workspace,'control',APPROVAL),stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)
  stop('NOV30_PILOT_APPROVAL_FILE_STOP');
 return validateApproval(JSON.parse(fs.readFileSync(file,'utf8')));
}
function verifySource(workspace){
 const directory=path.join(workspace,'source');
 const head=execFileSync('git',['-C',directory,'rev-parse','HEAD'],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  stdio:['ignore','pipe','ignore']}).trim();
 if(head!==SOURCE_SHA)stop('NOV30_PILOT_SOURCE_SHA_STOP');
 const file=path.join(directory,...SCRIPT.split('/')),stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>25000||
  sha256(fs.readFileSync(file))!==SOURCE_HASH)
  stop('NOV30_PILOT_SOURCE_HASH_STOP');
 return file;
}
const safeEnv=env=>Object.fromEntries([
 'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP'
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));

export function execute({env=process.env}={}){
 let report={schema:'ZGMINI_NOV30_ER1_PROBE_PUBLISH_V1',status:'BLOCKED',
  code:'NOV30_PILOT_NOT_STARTED',pilotOnly:true,providerCalls:0,d1Writes:0,
  coreWrites:0,schedulerWrites:0};
 try{
  if(process.platform!=='win32')stop('NOV30_PILOT_WINDOWS_ONLY');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateRequest(event,env);
  if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
   stop('NOV30_PILOT_WORKSPACE_STOP');
  verifyApproval(env.GITHUB_WORKSPACE);
  const source=verifySource(env.GITHUB_WORKSPACE);
  if(!fs.existsSync(NODE))stop('NOV30_PILOT_NODE_MISSING');
  fs.mkdirSync(MARKER_DIR,{recursive:true});
  const marker=path.join(MARKER_DIR,'ONE_SHOT_STARTED.json');
  let fd;try{fd=fs.openSync(marker,'wx')}
  catch{stop('NOV30_PILOT_ALREADY_ATTEMPTED')}
  try{fs.writeFileSync(fd,JSON.stringify({requestId:request.requestId,
   sourceSha:SOURCE_SHA,at:new Date().toISOString()}))}finally{fs.closeSync(fd)}
  const output=path.join(env.GITHUB_WORKSPACE,'nov30-actual-child-report.json');
  const child=spawnSync(NODE,[source,output],{
   cwd:path.dirname(source),windowsHide:true,timeout:160000,
   encoding:'utf8',maxBuffer:8192,env:safeEnv(env),shell:false
  });
  if(fs.existsSync(output)){
   const v=JSON.parse(fs.readFileSync(output,'utf8'));
   if(v?.schema==='ZGMINI_NOV30_ER1_PROBE_PUBLISH_V1')
    report={...v,requestId:request.requestId};
  }
  if(child.error||child.signal||!fs.existsSync(output)){
   report.status='STATE_UNKNOWN';report.code='NOV30_PILOT_CHILD_RESULT_UNKNOWN';
  }else if(child.status!==0&&report.status==='PASS'){
   report.status='STATE_UNKNOWN';report.code='NOV30_PILOT_CHILD_EXIT_MISMATCH';
  }
  if(report.d1Writes!==0||report.coreWrites!==0||report.schedulerWrites!==0||
   report.pilotOnly!==true){
   report.status='STATE_UNKNOWN';report.code='NOV30_PILOT_FORBIDDEN_EFFECT_REPORTED';
  }
 }catch(e){report.code=codeOf(e)}
 try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,REPORT),
  JSON.stringify(report)+'\n',{flag:'wx'})}
 catch{process.stderr.write('NOV30_PILOT_RESULT_SAVE_STOP\n')}
 console.log('NOV30_PILOT='+report.status+' CODE='+report.code+
  ' CALLS='+(report.providerCalls??0)+' D1='+(report.d1Writes??0));
 if(report.status!=='PASS')process.exitCode=1;
}
export async function upload({env=process.env,fetcher=fetch}={}){
 const file=path.join(env.GITHUB_WORKSPACE,REPORT);
 if(!fs.existsSync(file))return;
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||env.GITHUB_REPOSITORY!==REPO)return;
 const fence=String.fromCharCode(96).repeat(3);
 const body='ER1 November private actual pilot: **'+report.status+
  '** ('+report.code+'). No D1 publication.\n\n'+
  fence+'json\n'+JSON.stringify(report,null,2)+'\n'+fence;
 const response=await fetcher('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json',
   'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!response.ok)throw Error('NOV30_PILOT_RESULT_UPLOAD_STOP');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload')await upload();else execute();
}
