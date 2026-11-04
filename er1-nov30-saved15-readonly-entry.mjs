// A-grade diagnostic: reuse #369 private PC checkpoint, compute in memory only.
// No provider GET, private data rewrite, D1, Core, scheduler, or public publication.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const SOURCE_SHA='1ec5c9755761306cd5e449a0c141e9f7b92f4908';
const SOURCE='scripts/pc-writer/market-calendar-nov30-er1-saved15-readonly.mjs';
const SOURCE_HASH='3b1c1dad731e69374405e3cf5b188c2f3cf8d6267fb7a47598302c7acc91b721';
const BASE='scripts/pc-writer/market-calendar-nov30-er1-probe-publish.mjs';
const BASE_HASH='c87197852e9e656c6ac2ec682dfc1a7968007b6e4e4fce0f15606c88fd698b00';
const APPROVAL='ER1_NOV30_SAVED15_READONLY_A_CONTRACT.json';
const REPORT='ER1_NOV30_SAVED15_READONLY_RESULT.json';
const TITLE='pc-er1-nov30-saved15-readonly';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const stop=code=>{throw Error(code)};
const errorCode=e=>/^NOV30_READONLY_[A-Z0-9_]+$/.test(String(e?.message))?
 e.message:'NOV30_READONLY_UNEXPECTED_STOP';
const sha256=data=>createHash('sha256').update(data).digest('hex');
export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==TITLE||
  !event.issue.labels?.some(x=>x.name==='pc-er1-approved'))
  stop('NOV30_READONLY_ISSUE_STOP');
 let request;try{request=JSON.parse(event.issue.body)}catch{
  stop('NOV30_READONLY_JSON_STOP')}
 if(!request||typeof request!=='object'||Array.isArray(request)||
  Object.keys(request).sort().join('|')!==
   ['schema','operation','sourceSha','requestId','chatId','asOf'].sort().join('|')||
  request.schema!=='ZGMINI_ER1_NOV30_SAVED15_READONLY_A_V1'||
  request.operation!=='inspect-saved15-private-er1'||
  request.sourceSha!==SOURCE_SHA||request.asOf!=='2026-11-04'||
  !new RegExp('^pc-nov15-'+UUID+'$').test(request.requestId)||
  !new RegExp('^chat-'+UUID+'$').test(request.chatId))
  stop('NOV30_READONLY_REQUEST_STOP');
 return request;
}
export function validateApproval(a){
 if(a?.schema!=='ZGMINI_ER1_NOV30_SAVED15_READONLY_A_CONTRACT_V1'||
  a.approvalState!=='APPROVED_A_READONLY'||
  a.sourceRepository!=='ansqhd5774-Choi/zgmini'||
  a.sourceSha!==SOURCE_SHA||a.sourceFile!==SOURCE||
  a.sourceFileSha256!==SOURCE_HASH||a.dependentSourceFile!==BASE||
  a.dependentSourceSha256!==BASE_HASH||a.asOf!=='2026-11-04'||
  a.maxProviderRequests!==0||a.allowPrivateDataWrites!==false||
  a.allowD1Writes!==false||a.allowCoreWrites!==false||
  a.allowExistingFeedWrites!==false||a.allowSchedulerChanges!==false||
  a.allowDirectDeployment!==false||a.outputOnlySanitizedAggregates!==true)
  stop('NOV30_READONLY_APPROVAL_STOP');
 return true;
}
function verify(root){
 const config=path.join(root,'control',APPROVAL),info=fs.lstatSync(config);
 if(!info.isFile()||info.isSymbolicLink()||info.size>4096)
  stop('NOV30_READONLY_APPROVAL_FILE_STOP');
 validateApproval(JSON.parse(fs.readFileSync(config,'utf8')));
 const source=path.join(root,'source');
 const head=execFileSync('git',['-C',source,'rev-parse','HEAD'],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  stdio:['ignore','pipe','ignore']}).trim();
 if(head!==SOURCE_SHA)stop('NOV30_READONLY_SHA_STOP');
 for(const [relative,want] of [[SOURCE,SOURCE_HASH],[BASE,BASE_HASH]]){
  const file=path.join(source,...relative.split('/')),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>25000||
   sha256(fs.readFileSync(file))!==want)stop('NOV30_READONLY_FILE_HASH_STOP');
 }
 return path.join(source,...SOURCE.split('/'));
}
export async function execute({env=process.env}={}){
 let report={schema:'ZGMINI_NOV30_ER1_SAVED15_READONLY_V1',
  status:'BLOCKED',code:'NOV30_READONLY_NOT_STARTED',
  providerCalls:0,localWrites:0,d1Writes:0,coreWrites:0,
  existingFeedWrites:0,schedulerWrites:0,pilotOnly:true};
 try{
  if(process.platform!=='win32')stop('NOV30_READONLY_WINDOWS_ONLY');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateRequest(event,env);
  if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
   stop('NOV30_READONLY_WORKSPACE_STOP');
  const source=verify(env.GITHUB_WORKSPACE);
  const {inspectSavedNovemberBatch20}=await import(pathToFileURL(source).href);
  const result=await inspectSavedNovemberBatch20();
  if(result?.schema!=='ZGMINI_NOV30_ER1_SAVED15_READONLY_V1')
   stop('NOV30_READONLY_RESULT_SCHEMA_STOP');
  report={...result,requestId:request.requestId};
  if(report.providerCalls!==0||report.localWrites!==0||
   report.d1Writes!==0||report.coreWrites!==0||
   report.existingFeedWrites!==0||report.schedulerWrites!==0||
   report.pilotOnly!==true||report.selectedSymbols>20||
   report.cachedObservedSymbols>20||report.scoreableIssuers>20){
   report.status='STATE_UNKNOWN';report.code='NOV30_READONLY_EFFECT_STOP';
  }
 }catch(e){report.code=errorCode(e)}
 try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,REPORT),
  JSON.stringify(report)+'\n',{flag:'wx'})}
 catch{process.stderr.write('NOV30_READONLY_REPORT_SAVE_STOP\n')}
 console.log('NOV30_SAVED15='+report.status+' CODE='+report.code+
  ' CACHED='+(report.cachedObservedSymbols??0)+' SCOREABLE='+
  (report.scoreableIssuers??0)+' STAR3='+(report.star3Count??0));
 if(report.status!=='PASS')process.exitCode=1;
}
export async function upload({env=process.env,fetcher=fetch}={}){
 const file=path.join(env.GITHUB_WORKSPACE,REPORT);
 if(!fs.existsSync(file))return;
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||
  env.GITHUB_REPOSITORY!==REPO)return;
 const fence=String.fromCharCode(96).repeat(3);
 const body='ER1 November saved15 compute-only A: **'+report.status+
  '** ('+report.code+'). Provider GET **0**, D1 writes **0**.\n\n'+
  fence+'json\n'+JSON.stringify(report,null,2)+'\n'+fence;
 const response=await fetcher('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json',
   'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!response.ok)throw Error('NOV30_READONLY_UPLOAD_STOP');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload')await upload();else await execute();
}
