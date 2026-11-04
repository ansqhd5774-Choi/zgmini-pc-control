// BATCH20 continuation: one bounded PC-private run only. No Core/D1/cron writes.
// Original #363 pilot workflow/marker and fixed source SHA stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const OWNER='ansqhd5774-Choi',CONTROL=OWNER+'/zgmini-pc-control';
const SOURCE_SHA='a646050a74c691ac6550ededdc9b7fc695c19848';
const BATCH_SCRIPT='scripts/pc-writer/market-calendar-nov30-er1-batch20-once.mjs';
const BATCH_HASH='cb73b5d280bc00c6fb131bfc76d2515e72c7460f6d274266fbb96b23fcff79ed';
const BASE_SCRIPT='scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs';
const BASE_HASH='56480419432a9be8b9ae7bc945e4448f6876913268604bd65d09dae1d8912412';
const APPROVAL='ER1_NOV30_BATCH20_RECOVERY_B_APPROVAL.json';
const REPORT='ER1_NOV30_BATCH20_RECOVERY_RESULT.json';
const ISSUE_TITLE='pc-er1-nov30-batch20-recovery-once';
const NODE='E:\\ZGmini\\runtime\\node.exe';
const MARKER_DIR='E:\\ZGmini\\automation\\er1-nov30-batch20-recovery-replay1';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const stop=code=>{throw Error(code)};
const codeOf=e=>/^NOV30_BATCH20_[A-Z0-9_]+$/.test(String(e?.message))?
 e.message:'NOV30_BATCH20_UNEXPECTED_STOP';
const digest=data=>createHash('sha256').update(data).digest('hex');
const exactKeys=(value,keys)=>value&&typeof value==='object'&&
 !Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.sort().join('|');

export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==CONTROL||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==ISSUE_TITLE||
  !event.issue.labels?.some(x=>x.name==='pc-er1-approved'))
  stop('NOV30_BATCH20_ISSUE_SCOPE_STOP');
 let req;try{req=JSON.parse(event.issue.body)}catch{
  stop('NOV30_BATCH20_REQUEST_JSON_STOP')}
 if(!exactKeys(req,['schema','operation','sourceSha','requestId','chatId',
   'from','through'])||
  req.schema!=='ZGMINI_ER1_NOV30_BATCH20_B_V1'||
  req.operation!=='batch20-private-actual-er1'||
  req.sourceSha!==SOURCE_SHA||req.from!=='2026-11-01'||
  req.through!=='2026-11-30'||
  !new RegExp('^pc-nov20-'+UUID+'$').test(req.requestId)||
  !new RegExp('^chat-'+UUID+'$').test(req.chatId))
  stop('NOV30_BATCH20_REQUEST_CONTRACT_STOP');
 return req;
}
export function validateApproval(m){
 if(m?.schema!=='ZGMINI_ER1_NOV30_BATCH20_APPROVAL_V1'||
  m.approvalState!=='APPROVED_B_ONE_SHOT'||
  m.scope!=='PC_PRIVATE_2026_11_FUTURE_20_SYMBOL_ACTUALS_MAX17_GET'||
  m.approvalBasis!=='2026-11-05 November ER1 actual EPS/revenue collection authorized by user continuation; PC_AUTOMATION_STANDARD section 5; pilot issue 363 PASS'||
  m.sourceRepository!=='ansqhd5774-Choi/zgmini'||
  m.sourceSha!==SOURCE_SHA||
  m.batchSourceFile!==BATCH_SCRIPT||m.batchSourceSha256!==BATCH_HASH||
  m.dependentSourceFile!==BASE_SCRIPT||m.dependentSourceSha256!==BASE_HASH||
  m.maxCalendarSymbols!==20||m.maxNewProviderRequests!==17||
  m.maxAutomaticRetries!==0||m.onlyFutureScheduledDates!==true||
  m.reuseExistingPilotRaw!==true||m.requireLocalReadback!==true||
  m.allowCoreReadOnly!==true||
  m.allowCoreWrites!==false||m.allowPrivateRawWrites!==true||
  m.allowLocalPreviewWrites!==true||m.allowD1Writes!==false||
  m.allowExistingFeedWrites!==false||m.allowSchedulerChanges!==false||
  m.allowDirectDeployment!==false)
  stop('NOV30_BATCH20_APPROVAL_SCOPE_STOP');
 return true;
}
function verifyManifest(dir){
 const f=path.join(dir,'control',APPROVAL),s=fs.lstatSync(f);
 if(!s.isFile()||s.isSymbolicLink()||s.size>4096)
  stop('NOV30_BATCH20_MANIFEST_FILE_STOP');
 return validateApproval(JSON.parse(fs.readFileSync(f,'utf8')));
}
function fileHash(dir,relative,want){
 const file=path.join(dir,...relative.split('/'));
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>30000||
  digest(fs.readFileSync(file))!==want)
  stop('NOV30_BATCH20_SOURCE_HASH_STOP');
 return file;
}
function verifySource(dir){
 const root=path.join(dir,'source');
 const sha=execFileSync('git',['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  stdio:['ignore','pipe','ignore']}).trim();
 if(sha!==SOURCE_SHA)stop('NOV30_BATCH20_SOURCE_SHA_STOP');
 fileHash(root,BASE_SCRIPT,BASE_HASH);
 return fileHash(root,BATCH_SCRIPT,BATCH_HASH);
}
const cleanEnv=env=>Object.fromEntries([
 'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA',
 'LOCALAPPDATA','TEMP','TMP'
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
export function issueArtifactNames(issueNumber){
 if(!Number.isSafeInteger(issueNumber)||issueNumber<1)
  stop('NOV30_BATCH20_ISSUE_NUMBER_STOP');
 return {child:'nov30-batch20-private-child-'+issueNumber+'.json',
  report:REPORT.replace(/\.json$/,'-'+issueNumber+'.json')};
}
export function execute({env=process.env}={}){
 let report={schema:'ZGMINI_NOV30_ER1_BATCH20_V1',status:'BLOCKED',
  code:'NOV30_BATCH20_NOT_STARTED',pilotOnly:true,candidateLimit:20,
  providerRequestLimit:17,providerCalls:0,d1Writes:0,coreWrites:0,
  schedulerWrites:0,existingFeedWrites:0,star3Count:0,highestScore:null};
 let reportFile=path.join(env.GITHUB_WORKSPACE??'',REPORT);
 try{
  if(process.platform!=='win32')stop('NOV30_BATCH20_WINDOWS_ONLY');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateRequest(event,env);
  if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
   stop('NOV30_BATCH20_WORKSPACE_STOP');
  const names=issueArtifactNames(event.issue.number);
  reportFile=path.join(env.GITHUB_WORKSPACE,names.report);
  verifyManifest(env.GITHUB_WORKSPACE);
  const source=verifySource(env.GITHUB_WORKSPACE);
  if(!fs.existsSync(NODE))stop('NOV30_BATCH20_NODE_MISSING');
  fs.mkdirSync(MARKER_DIR,{recursive:true});
  const marker=path.join(MARKER_DIR,'ONE_SHOT_STARTED.json');
  let fd;try{fd=fs.openSync(marker,'wx')}catch{
   stop('NOV30_BATCH20_ALREADY_ATTEMPTED')}
  try{fs.writeFileSync(fd,JSON.stringify({requestId:request.requestId,
   sourceSha:SOURCE_SHA,at:new Date().toISOString()}))}finally{fs.closeSync(fd)}
  const output=path.join(env.GITHUB_WORKSPACE,names.child);
  const child=spawnSync(NODE,[source,output],{
   cwd:path.dirname(source),windowsHide:true,timeout:270000,
   encoding:'utf8',maxBuffer:8192,env:cleanEnv(env),shell:false
  });
  if(fs.existsSync(output)){
   const v=JSON.parse(fs.readFileSync(output,'utf8'));
   if(v?.schema==='ZGMINI_NOV30_ER1_BATCH20_V1')
    report={...v,requestId:request.requestId};
  }
  if(child.error||child.signal||!fs.existsSync(output)){
   report.status='STATE_UNKNOWN';report.code='NOV30_BATCH20_CHILD_UNKNOWN';
  }else if(child.status!==0&&report.status==='PASS'){
   report.status='STATE_UNKNOWN';report.code='NOV30_BATCH20_EXIT_MISMATCH';
  }
  if(report.d1Writes!==0||report.coreWrites!==0||
   report.schedulerWrites!==0||report.existingFeedWrites!==0||
   report.pilotOnly!==true||report.candidateLimit!==20||
   report.providerRequestLimit!==17||report.providerCalls>17||
   report.selectedSymbols>20||report.scoreableIssuers>20){
   report.status='STATE_UNKNOWN';report.code='NOV30_BATCH20_EFFECT_VIOLATION';
  }
 }catch(e){report.code=codeOf(e)}
 try{fs.writeFileSync(reportFile,
  JSON.stringify(report)+'\n',{flag:'wx'})}
 catch{process.stderr.write('NOV30_BATCH20_RESULT_SAVE_STOP\n')}
 console.log('NOV30_BATCH20='+report.status+' CODE='+report.code+
  ' GET='+(report.providerCalls??0)+' SCOREABLE='+
  (report.scoreableIssuers??0)+' STAR3='+(report.star3Count??0));
 if(report.status!=='PASS')process.exitCode=1;
}
export async function upload({env=process.env,fetcher=fetch}={}){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const file=path.join(env.GITHUB_WORKSPACE,
  issueArtifactNames(event.issue.number).report);
 if(!fs.existsSync(file))return;
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||
  env.GITHUB_REPOSITORY!==CONTROL)return;
 const fence=String.fromCharCode(96).repeat(3);
 const body='November ER1 bounded batch20 private: **'+report.status+
  '** ('+report.code+'). **No D1 publication.**\n\n'+
  fence+'json\n'+JSON.stringify(report,null,2)+'\n'+fence;
 const response=await fetcher('https://api.github.com/repos/'+CONTROL+
  '/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json',
   'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!response.ok)throw Error('NOV30_BATCH20_REPORT_UPLOAD_STOP');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload')await upload();else execute();
}
