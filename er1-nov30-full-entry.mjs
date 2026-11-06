// Review-only B entry. GitHub PR is not a PC execution authorization.
// Source SHA and source-file hashes are pinned; only the existing scoped
// November ER1 issue contract may trigger the bounded operation after merge.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
export const PINNED_SOURCE_SHA='a6dd77d19ccfcb79ddcdd0b4a6f495ec3888e24a';
export const APPROVAL='ER1_NOV30_FULL_B_APPROVAL.json';
const TITLE='pc-er1-nov30-full';
const LABEL='pc-er1-approved';
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const REQUESTS=String.raw`E:\ZGmini\automation\er1-nov30-full\requests`;
const SOURCE_FILES={
 'private-collect':'scripts/pc-writer/market-calendar-nov30-er1-full-private.mjs',
 'score-publish':'scripts/pc-writer/market-calendar-nov30-er1-score-publish.mjs'
};
const BASE='scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs';
const PUBLIC_KEY='market-calendar:earnings-nov2026-er1-score-public';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const hash=body=>createHash('sha256').update(body).digest('hex');
const stop=code=>{throw Error(code)};
const safeCode=e=>/^NOV30_FULL_B_[A-Z0-9_]+$/.test(String(e?.message))?
 e.message:'NOV30_FULL_B_UNEXPECTED_STOP';
const exact=(obj,fields)=>!!obj&&typeof obj==='object'&&
 !Array.isArray(obj)&&Object.keys(obj).sort().join('|')===fields.slice().sort().join('|');

export function validateRequest(event,env,sourceSha=PINNED_SOURCE_SHA){
 if(env.GITHUB_REPOSITORY!==CONTROL||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event.issue?.user?.login!==OWNER||
  event.issue?.title!==TITLE||
  !event.issue?.labels?.some(x=>x.name===LABEL))
  stop('NOV30_FULL_B_ISSUE_SCOPE_STOP');
 let req;try{req=JSON.parse(event.issue.body)}catch{
  stop('NOV30_FULL_B_REQUEST_JSON_STOP');
 }
 if(!SHA40.test(sourceSha)||
  !exact(req,['schema','operation','sourceSha','requestId','chatId','from','through'])||
  req.schema!=='ZGMINI_ER1_NOV30_FULL_B_V1'||
  !Object.hasOwn(SOURCE_FILES,req.operation)||
  req.sourceSha!==sourceSha||req.from!=='2026-11-01'||
  req.through!=='2026-11-30'||
  !new RegExp('^pc-nov30-full-'+UUID+'$').test(req.requestId)||
  !new RegExp('^chat-'+UUID+'$').test(req.chatId))
  stop('NOV30_FULL_B_REQUEST_CONTRACT_STOP');
 return req;
}

export function validateApproval(m,sourceSha=PINNED_SOURCE_SHA){
 if(!SHA40.test(sourceSha)||
  m?.schema!=='ZGMINI_ER1_NOV30_FULL_APPROVAL_V1'||
  m.approvalState!=='APPROVED_B_NOV2026_FULL'||
  m.scope!=='PC_PRIVATE_NOV2026_ER1_FUTURE_COHORT_AND_D1_SCORE_ONLY'||
  m.sourceRepository!=='ansqhd5774-Choi/zgmini'||
  m.sourceSha!==sourceSha||
  m.outputKey!==PUBLIC_KEY||m.maxNewProviderRequestsPerRun!==17||
  m.maxAutomaticRetries!==0||m.onlyFutureScheduledDates!==true||
  m.reuseExistingRawCache!==true||m.requireLocalReadback!==true||
  m.allowCoreWrites!==false||m.allowSchedulerChanges!==false||
  m.allowExistingFeedWrites!==false||m.allowRawRowsPublic!==false||
  m.allowDirectDeployment!==false||
  !Array.isArray(m.files)||m.files.length!==3)
  stop('NOV30_FULL_B_APPROVAL_SCOPE_STOP');
 const expected=[BASE,...Object.values(SOURCE_FILES)];
 const names=m.files.map(f=>f.path);
 if(new Set(names).size!==3||expected.some(name=>!names.includes(name))||
  m.files.some(f=>!SHA64.test(f.sha256)))
  stop('NOV30_FULL_B_APPROVAL_SOURCE_FILES_STOP');
 return m;
}

export function validateEffects(stage,report){
 if(!report||!['PASS','PARTIAL','BLOCKED','STATE_UNKNOWN'].includes(report.status)||
  !Number.isInteger(report.providerCalls)||report.providerCalls<0||
  !Number.isInteger(report.d1Writes)||report.d1Writes<0||
  report.coreWrites!==0||report.schedulerWrites!==0||
  report.existingFeedWrites!==0||report.rawRowsPublic!==0)
  stop('NOV30_FULL_B_EFFECT_CONTRACT_STOP');
 if(stage==='private-collect'){
  if(report.schema!=='ZGMINI_NOV30_ER1_FULL_PRIVATE_V1'||
   report.providerCalls>17||report.d1Writes!==0)
   stop('NOV30_FULL_B_PRIVATE_EFFECT_STOP');
 }else if(stage==='score-publish'){
  if(report.schema!=='ZGMINI_NOV30_ER1_FULL_D1_PUBLISH_V1'||
   report.providerCalls!==0||report.d1Writes>1)
   stop('NOV30_FULL_B_PUBLISH_EFFECT_STOP');
 }else stop('NOV30_FULL_B_STAGE_STOP');
 return true;
}

const onlyHostEnv=env=>Object.fromEntries([
 'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA',
 'LOCALAPPDATA','TEMP','TMP'
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));

const readApproval=(workspace,sourceSha)=>{
 const file=path.join(workspace,'control',APPROVAL);
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)
  stop('NOV30_FULL_B_APPROVAL_FILE_STOP');
 return validateApproval(JSON.parse(fs.readFileSync(file,'utf8')),sourceSha);
};

const verifySource=(workspace,approval,stage)=>{
 const root=path.join(workspace,'source');
 const installed=execFileSync('git',['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  stdio:['ignore','pipe','ignore']}).trim();
 if(installed!==approval.sourceSha)stop('NOV30_FULL_B_SOURCE_SHA_STOP');
 for(const e of approval.files){
  const file=path.join(root,...e.path.split('/'));
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||
   stat.size>60000||hash(fs.readFileSync(file))!==e.sha256)
   stop('NOV30_FULL_B_SOURCE_HASH_STOP');
 }
 return path.join(root,...SOURCE_FILES[stage].split('/'));
};

export function resultFileName(issueNumber){
 if(!Number.isSafeInteger(issueNumber)||issueNumber<1)
  stop('NOV30_FULL_B_ISSUE_NUMBER_STOP');
 return `nov30-full-result-${issueNumber}.json`;
}

export function execute({env=process.env}={}){
 const report={schema:'ZGMINI_NOV30_FULL_B_ENTRY_RESULT_V1',status:'BLOCKED',
  code:'NOV30_FULL_B_NOT_STARTED',providerCalls:0,d1Writes:0,
  coreWrites:0,schedulerWrites:0,existingFeedWrites:0,rawRowsPublic:0};
 let outcome={...report};let reportPath;let childStarted=false;
 try{
  if(process.platform!=='win32')stop('NOV30_FULL_B_WINDOWS_ONLY');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const req=validateRequest(event,env);
  if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
   stop('NOV30_FULL_B_WORKSPACE_STOP');
  reportPath=path.join(env.GITHUB_WORKSPACE,resultFileName(event.issue.number));
  const approval=readApproval(env.GITHUB_WORKSPACE,PINNED_SOURCE_SHA);
  const script=verifySource(env.GITHUB_WORKSPACE,approval,req.operation);
  if(!fs.existsSync(NODE))stop('NOV30_FULL_B_NODE_STOP');
  fs.mkdirSync(REQUESTS,{recursive:true});
  const marker=path.join(REQUESTS,req.requestId+'.json');
  let fd;try{fd=fs.openSync(marker,'wx')}catch{
   stop('NOV30_FULL_B_REQUEST_ALREADY_ATTEMPTED');
  }
  try{fs.writeFileSync(fd,JSON.stringify({requestId:req.requestId,
   operation:req.operation,sourceSha:req.sourceSha,at:new Date().toISOString()}))}
  finally{fs.closeSync(fd)}
  const childReport=path.join(env.GITHUB_WORKSPACE,
   `nov30-full-${req.operation}-${event.issue.number}.json`);
  childStarted=true;
  const child=spawnSync(NODE,[script,childReport],{
   cwd:path.dirname(script),windowsHide:true,timeout:600000,
   encoding:'utf8',maxBuffer:8192,env:onlyHostEnv(env),shell:false
  });
  if(fs.existsSync(childReport)){
   const childValue=JSON.parse(fs.readFileSync(childReport,'utf8'));
   validateEffects(req.operation,childValue);
   outcome={...childValue,requestId:req.requestId,operation:req.operation};
  }
  if(child.error||child.signal||!fs.existsSync(childReport)){
   outcome.status='STATE_UNKNOWN';outcome.code='NOV30_FULL_B_CHILD_UNKNOWN';
  }else if((child.status===0)!==(outcome.status==='PASS')){
   outcome.status='STATE_UNKNOWN';outcome.code='NOV30_FULL_B_EXIT_MISMATCH';
  }
 }catch(e){
  // A post-spawn failure may follow private storage or D1 writes. Never
  // misclassify it as a clean prevalidation-only BLOCKED transition.
  outcome.status=childStarted?'STATE_UNKNOWN':'BLOCKED';
  outcome.code=safeCode(e);
 }
 try{if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(outcome)+'\n',{flag:'wx'})}
 catch{process.stderr.write('NOV30_FULL_B_REPORT_SAVE_STOP\n')}
 console.log('NOV30_FULL_B='+outcome.status+' CODE='+outcome.code);
 if(outcome.status!=='PASS')process.exitCode=1;
 return outcome;
}

export async function upload({env=process.env,fetcher=fetch}={}){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const f=path.join(env.GITHUB_WORKSPACE,resultFileName(event.issue.number));
 if(!fs.existsSync(f)||!env.GITHUB_TOKEN||
  env.GITHUB_REPOSITORY!==CONTROL||!Number.isSafeInteger(event.issue.number))return;
 const result=JSON.parse(fs.readFileSync(f,'utf8'));
 const body='November ER1 full '+String(result.operation??'B')+': **'+result.status+
  '** ('+result.code+')\n\n```json\n'+JSON.stringify(result,null,2)+'\n```';
 const response=await fetcher('https://api.github.com/repos/'+CONTROL+
  '/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json',
   'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!response.ok)stop('NOV30_FULL_B_RESULT_UPLOAD_STOP');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload')await upload();else execute();
}
