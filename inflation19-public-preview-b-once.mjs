// ZGMINI private fixed B read-only PC preview for 19 collected inflation inputs.
// Explicit source SHA and 3 fixed source file hashes; no provider calls or D1 writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_SHA='a86229cecd483f39afb501d32ae23e3128134e4e';
export const TITLE='pc-inflation19-public-preview-readonly-once';
export const SCHEMA='ZGMINI_INFLATION_19_PUBLIC_PREVIEW_V1';
export const APPROVAL='INFLATION19_PUBLIC_PREVIEW_B_APPROVAL.json';
export const WRITER=String.raw`E:\ZGmini\data\pc-writer`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
export const ENTRY='scripts/pc-writer/inflation-causal-public-preview-r1.mjs';
export const HASHES=Object.freeze({
 [ENTRY]:'34a62afc6ae4aa7f654cfd51405282a0b628fc82a8c69538f1bcae49766b0bed',
 'lib/inflation-causal-public-catalog.mjs':'db4e05baaa62b51a0a783ce66466c18bb02a924894fc3aca605f473cbe3632e5',
 'worker/inflation-causal-public-r1.mjs':'86c5003c3b37cac16e3e5e9b5ed610f9e00f29ee6005cb2abb91fb04abea951f',
});
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQ=new RegExp('^pc-infl19-preview-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const stop=x=>{throw Error(x)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const regular=(p,max=300000)=>{const st=fs.lstatSync(p);if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)stop('INFLPRE_FILE_INVALID');return fs.readFileSync(p);};
function dir(p){const st=fs.lstatSync(p);if(!st.isDirectory()||st.isSymbolicLink())stop('INFLPRE_DIR_INVALID');}
export function resultName(n){if(!Number.isInteger(n)||n<1||n>999999999)stop('INFLPRE_ISSUE_NUMBER_INVALID');return 'INFL19_PUBLIC_PREVIEW_'+n+'.json';}
export function validate(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.repository?.private!==true||
  event?.repository?.full_name!==REPO||event?.issue?.user?.login!=='ansqhd5774-Choi'||
  event?.issue?.title!==TITLE||env.GITHUB_RUN_ATTEMPT!=='1')
  stop('INFLPRE_ISSUE_DENIED');
 resultName(event.issue.number);
 let body;try{body=JSON.parse(event.issue.body)}catch{stop('INFLPRE_JSON_INVALID')}
 if(!body||Array.isArray(body)||Object.keys(body).sort().join('|')!==
   ['schema','operation','sourceSha','requestId','chatId'].sort().join('|')||
  body.schema!==SCHEMA||body.operation!=='verify-private-19-public-preview-readonly-once'||
  body.sourceSha!==SOURCE_SHA||!REQ.test(body.requestId)||!CHAT.test(body.chatId)||
  body.requestId.slice('pc-infl19-preview-'.length)!==body.chatId.slice('chat-'.length))
  stop('INFLPRE_REQUEST_DENIED');
 return body;
}
export function validatePreview(r){
 if(!r||!['PASS_READONLY','PENDING'].includes(r.status)||
  !['INFL19_PUBLIC_PREVIEW','INFL19_PUBLIC_INPUTS_UNAVAILABLE'].includes(r.code)||
  !Number.isInteger(r.ready)||r.ready<0||r.ready>19||
  !r.missing||typeof r.missing!=='object'||Array.isArray(r.missing)||
  Object.keys(r.missing).some(k=>!['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'].includes(k))||
  Object.values(r.missing).some(v=>typeof v!=='string'||!/^[A-Z0-9_]{3,80}$/.test(v))||
  !r.latest||typeof r.latest!=='object'||Array.isArray(r.latest)||
  Object.keys(r.latest).length!==r.ready||
  Object.values(r.latest).some(x=>typeof x!=='string'||!/^(?:19|20)\d\d-(0[1-9]|1[0-2])(?:-[0-3]\d)?$/.test(x))||
  r.providerCalls!==0||r.coreWrites!==0||r.dbWrites!==0||r.d1Writes!==0||r.schedulerWrites!==0||
  (r.status==='PENDING'&&r.ready!==0)||
  (r.status==='PASS_READONLY'&&r.ready===0)||
  (r.ready===19&&Object.keys(r.missing).length>0)||
  (r.ready+Object.keys(r.missing).length!==19))
  stop('INFLPRE_CHILD_RESULT_INVALID');
 return r;
}
function fixedSource(workspace){
 dir(workspace);
 const manifest=JSON.parse(regular(path.join(workspace,'control',APPROVAL),7000));
 if(manifest.schema!=='ZGMINI_INFLATION_19_PREVIEW_B_APPROVAL_V1'||
  manifest.scope!=='INFLATION_19_PRIVATE_READONLY_PREVIEW'||
  manifest.sourceSha!==SOURCE_SHA||manifest.writerHome!==WRITER||
  manifest.maxProviderRequests!==0||manifest.maxAutomaticRetries!==0||
  manifest.coreWrites!==false||manifest.dbWrites!==false||
  manifest.d1Writes!==false||manifest.schedulerWrites!==false||
  JSON.stringify(manifest.sourceFileHashes)!==JSON.stringify(HASHES))
  stop('INFLPRE_APPROVAL_DENIED');
 const root=path.join(workspace,'source');dir(root);
 const git=[String.raw`C:\Program Files\Git\cmd\git.exe`,String.raw`C:\Program Files (x86)\Git\cmd\git.exe`].find(fs.existsSync);
 if(!git)stop('INFLPRE_GIT_MISSING');
 const actual=execFileSync(git,['-c','core.fsmonitor=false','-C',root,'rev-parse','HEAD'],{encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();
 if(actual!==SOURCE_SHA)stop('INFLPRE_SOURCE_SHA_DENIED');
 for(const [relative,expected] of Object.entries(HASHES))
  if(hash(regular(path.join(root,...relative.split('/'))))!==expected)
   stop('INFLPRE_SOURCE_FILE_HASH_DENIED');
 dir(WRITER);regular(NODE,200000000);
 return path.join(root,...ENTRY.split('/'));
}
function envLimited(env){
 return Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP'].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
}
export function execute(env=process.env){
 let report={schema:SCHEMA,status:'BLOCKED',code:'INFLPRE_NOT_STARTED',
  sourceSha:SOURCE_SHA,ready:null,missing:{},latest:{},providerCalls:0,
  coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
 let issue;
 try{
  if(process.platform!=='win32')stop('INFLPRE_WINDOWS_ONLY');
  const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000));
  const request=validate(event,env);issue=event.issue.number;
  const ws=env.GITHUB_WORKSPACE;if(!ws||!path.win32.isAbsolute(ws))stop('INFLPRE_WORKSPACE_DENIED');
  const script=fixedSource(ws);
  report={...report,issueNumber:issue,requestId:request.requestId,
   chatId:request.chatId,runId:String(env.GITHUB_RUN_ID??''),actualExecutionSha:SOURCE_SHA};
  const child=spawnSync(NODE,[script],{cwd:path.dirname(script),env:envLimited(env),
   shell:false,encoding:'utf8',windowsHide:true,timeout:150000,maxBuffer:8192});
  if(child.error||child.signal){report.status='STATE_UNKNOWN';report.code='INFLPRE_CHILD_STATE_UNKNOWN'}
  else{
   let result;try{result=JSON.parse(child.stdout.trim())}catch{stop('INFLPRE_CHILD_JSON_INVALID')}
   if(child.status!==0&&result.status==='BLOCKED'){
    report={...report,status:'BLOCKED',code:/^(?:INFL19_|INFLATION_CAUSAL_PUBLIC_)[A-Z0-9_]{2,80}$/.test(result.code??'')?result.code:'INFLPRE_CHILD_BLOCKED',firstFail:'PC_SOURCE_PREVIEW',lastPass:'SOURCE_HASH_VERIFIED'};
   }else{
    if(child.status!==0&&result.status!=='PENDING')stop('INFLPRE_CHILD_EXIT_FAILED');
    validatePreview(result);
   report={...report,status:result.status==='PENDING'?'PARTIAL':'PASS',
    code:result.code,ready:result.ready,missing:result.missing,latest:result.latest,
    sourceVersion:result.sourceVersion??null,lastPass:'SOURCE_HASH_VERIFIED'};
   }
  }
 }catch(e){report={...report,status:'BLOCKED',
  code:/^INFLPRE_[A-Z0-9_]{3,80}$/.test(e?.message??'')?e.message:'INFLPRE_UNEXPECTED',
  firstFail:'PC_PREVIEW_PREFLIGHT'};}
 if(issue){
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,resultName(issue)),
    JSON.stringify(report)+'\n',{flag:'wx'});}
  catch{report.status='STATE_UNKNOWN';report.code='INFLPRE_RESULT_SAVE_DENIED';}
 }
 console.log('STATUS='+report.status+' CODE='+report.code+' READY='+report.ready);
 if(report.status!=='PASS')process.exitCode=1;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000));
 const r=validate(event,env);
 const ws=env.GITHUB_WORKSPACE;if(!ws||!path.win32.isAbsolute(ws))stop('INFLPRE_WORKSPACE_DENIED');
 const report=JSON.parse(regular(path.join(ws,resultName(event.issue.number)),10000));
 if(report.schema!==SCHEMA||report.issueNumber!==event.issue.number||
  report.requestId!==r.requestId||report.chatId!==r.chatId||
  report.runId!==String(env.GITHUB_RUN_ID??'')||report.sourceSha!==SOURCE_SHA||
  !['PASS','PARTIAL','BLOCKED','STATE_UNKNOWN'].includes(report.status)||
  !env.GITHUB_TOKEN)stop('INFLPRE_STALE_RESULT_DENIED');
 const safe={schema:report.schema,status:report.status,code:report.code,
  issueNumber:report.issueNumber,requestId:report.requestId,
  actualExecutionSha:report.actualExecutionSha??null,
  ready:report.ready??null,missing:report.missing,latest:report.latest,
  sourceVersion:report.sourceVersion??null,lastPass:report.lastPass??null,
  firstFail:report.firstFail??null,providerCalls:0,coreWrites:0,
  dbWrites:0,d1Writes:0,schedulerWrites:0};
 const response=await fetcher('https://api.github.com/repos/'+REPO+'/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,
   'content-type':'application/json','x-github-api-version':'2022-11-28'},
  body:JSON.stringify({body:'Inflation 19 PC private public-summary **read-only preflight**: **'+safe.status+'** ('+safe.code+')\n\n```json\n'+JSON.stringify(safe,null,2)+'\n```'})
 });
 if(!response.ok)stop('INFLPRE_COMMENT_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload'&&process.argv.length===3)await upload();
 else if(process.argv.length===2)execute();
 else stop('INFLPRE_ARGS_DENIED');
}
