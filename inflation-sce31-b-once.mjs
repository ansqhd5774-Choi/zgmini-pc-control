// Immutable, separately admitted B-grade PC-private SCE collection.
// This is not a general-purpose command runner and never touches Core, D1 or schedules.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_SHA='f0f70b2bdc091e6f2db7ddac71324b7bdb53dbbd';
export const TITLE='pc-inflation-sce31-approved-once';
export const LABEL='pc-inflation-sce31-approved';
export const RESULT='INFLATION_SCE31_CAPTURE_RESULT.json';
export const WRITER=String.raw`E:\ZGmini\data\pc-writer`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
export const MARKER_ROOT=String.raw`E:\ZGmini\automation\inflation-sce31-once`;
export const SCRIPT='scripts/pc-writer/inflation-sce31-once.mjs';
export const SOURCE_FILE_HASHES=Object.freeze({
  [SCRIPT]:'934d18754a263a8c752269eda02e8ad497f25445f566c4b1ee52e25482f3ec95',
  'scripts/inflation-sce-collector.mjs':'823a1d33f9b019efdfdb1fce645cb57a7dd536f08baf0a3ffc7c1ad5acc9eaf4',
  'scripts/inflation-sce-source.mjs':'5110a6bbda7a31462df012e4f2e116f4e6e7790098a645ba02bb777d21d2e47d',
});
const REQUEST_ID=/^pc-sce31-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHAT_ID=/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Error(code)};
const code=e=>/^SCE31_[A-Z0-9_]{1,90}$/.test(String(e?.message))?e.message:'SCE31_UNEXPECTED_STOP';

export function validateRequest(event,env) {
  if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
     env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
     event?.action!=='opened'||event?.repository?.private!==true||
     event?.issue?.user?.login!=='ansqhd5774-Choi'||event?.issue?.title!==TITLE||
     !event?.issue?.labels?.some(x=>x.name===LABEL))stop('SCE31_ACTOR_OR_ISSUE_DENIED');
  let req;
  try{req=JSON.parse(event.issue.body)}catch{stop('SCE31_REQUEST_JSON_INVALID')}
  if(!req||Array.isArray(req)||typeof req!=='object'||
     Object.keys(req).sort().join('|')!==['chatId','operation','requestId','schema','sourceSha'].sort().join('|')||
     req.schema!=='ZGMINI_INFLATION_SCE31_ONCE_V1'||
     req.operation!=='collect-sce31-private-once'||req.sourceSha!==SOURCE_SHA||
     !REQUEST_ID.test(req.requestId)||!CHAT_ID.test(req.chatId))stop('SCE31_REQUEST_CONTRACT_DENIED');
  return req;
}

function verifiedRegular(file,maxBytes) {
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>maxBytes)
    stop('SCE31_FILE_SHAPE_DENIED');
  return fs.readFileSync(file);
}
function verifiedDirectory(folder) {
  const stat=fs.lstatSync(folder);
  if(!stat.isDirectory()||stat.isSymbolicLink()||
     path.win32.normalize(fs.realpathSync.native(folder)).toLowerCase()!==
       path.win32.normalize(folder).toLowerCase())stop('SCE31_PATH_REDIRECT_DENIED');
  return folder;
}
function verifyApproval(workspace) {
  const data=JSON.parse(verifiedRegular(path.join(workspace,'control','INFLATION_SCE31_B_APPROVAL.json'),5000).toString('utf8'));
  if(data.schema!=='ZGMINI_INFLATION_SCE31_B_APPROVAL_V1'||
     data.scope!=='SCE31_PC_PRIVATE_ONE_SHOT'||data.sourceSha!==SOURCE_SHA||
     data.sourceRepository!==SOURCE_REPO||data.writerHome!==WRITER||
     data.outputRelative!=='inflation-causal/sce31'||
     data.maxAutomaticRetries!==0||data.maxProviderRequests!==3||
     data.allowCoreWrites!==false||data.allowD1Writes!==false||
     data.allowSchedulerChanges!==false||data.allowPublicRawData!==false||
     JSON.stringify(data.sourceFileHashes)!==JSON.stringify(SOURCE_FILE_HASHES))
    stop('SCE31_APPROVAL_CONTRACT_DENIED');
}
function verifySource(workspace) {
  const sourceRoot=verifiedDirectory(path.join(workspace,'source'));
  const git=process.platform==='win32'?[
    String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files (x86)\Git\cmd\git.exe`,
  ].find(x=>fs.existsSync(x)):null;
  if(!git)stop('SCE31_GIT_UNAVAILABLE');
  const actual=execFileSync(git,['-c','core.fsmonitor=false','-C',sourceRoot,'rev-parse','HEAD'],
    {encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024,stdio:['ignore','pipe','ignore']}).trim();
  if(actual!==SOURCE_SHA)stop('SCE31_SOURCE_SHA_DENIED');
  for(const [relative,expected] of Object.entries(SOURCE_FILE_HASHES)){
    const full=path.join(sourceRoot,...relative.split('/'));
    if(hash(verifiedRegular(full,300000))!==expected)stop('SCE31_SOURCE_FILE_HASH_DENIED');
  }
  return path.join(sourceRoot,...SCRIPT.split('/'));
}
function childEnv(env) {
  const safe=Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP']
    .filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
  return {...safe,ZGMINI_PC_HOME:WRITER};
}
export function execute({env=process.env}={}){
  let report={schema:'ZGMINI_INFLATION_SCE31_PC_RESULT_V1',status:'BLOCKED',
    code:'SCE31_NOT_STARTED',sourceSha:SOURCE_SHA,provider:'NYFED',
    providerRequestsMax:3,coreWrites:0,d1Writes:0,schedulerWrites:0};
  try {
    if(process.platform!=='win32')stop('SCE31_WINDOWS_ONLY');
    const event=JSON.parse(verifiedRegular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
    const req=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.win32.isAbsolute(env.GITHUB_WORKSPACE))
      stop('SCE31_WORKSPACE_INVALID');
    const workspace=verifiedDirectory(env.GITHUB_WORKSPACE);
    verifyApproval(workspace);
    const source=verifySource(workspace);
    verifiedRegular(NODE,200000000);
    verifiedDirectory(WRITER);
    if(!fs.existsSync(MARKER_ROOT))fs.mkdirSync(MARKER_ROOT);
    verifiedDirectory(MARKER_ROOT);
    // A create-only marker prevents a second provider call after partial/unknown execution.
    const marker=path.join(MARKER_ROOT,'ONCE_STARTED.json');
    fs.writeFileSync(marker,JSON.stringify({requestId:req.requestId,sourceSha:SOURCE_SHA,
      at:new Date().toISOString()}),{flag:'wx'});
    const child=spawnSync(NODE,[source],{cwd:path.dirname(source),env:childEnv(env),
      encoding:'utf8',windowsHide:true,shell:false,timeout:120000,maxBuffer:4096});
    if(child.error||child.signal){report.status='STATE_UNKNOWN';report.code='SCE31_CHILD_TERMINATION_UNKNOWN';}
    else if(child.status!==0) {report.status='RUNTIME_FAILED';report.code='SCE31_CHILD_EXIT_NONZERO';}
    else {
      let output;try{output=JSON.parse(child.stdout.trim())}catch{stop('SCE31_CHILD_JSON_INVALID')}
      if(output.status!=='PASS'||output.code!=='SCE31_ONESHOT_SAVED_READBACK'||
        output.coreWrites!==0||output.d1Writes!==0||!Number.isInteger(output.count)||
        !/^20\d\d-\d\d-01$/.test(output.latestMonth)||!/^[a-f0-9]{64}$/.test(output.downloadSha256))
        stop('SCE31_CHILD_RESULT_CONTRACT_DENIED');
      report={...report,status:'PASS',code:output.code,latestMonth:output.latestMonth,
        storedMonths:output.count,storedAt:output.fetchedAt,
        downloadSha256:output.downloadSha256,requestId:req.requestId};
    }
  }catch(e){report.code=code(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('SCE31_RESULT_SAVE_DENIED\n')}
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} MONTHS=${report.storedMonths??0}\n`);
  if(report.status!=='PASS')process.exitCode=1;
}
export async function upload({env=process.env,fetcher=fetch}={}){
  const file=path.join(env.GITHUB_WORKSPACE,RESULT);
  if(!fs.existsSync(file))return;
  const result=JSON.parse(fs.readFileSync(file,'utf8'));
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!env.GITHUB_TOKEN||env.GITHUB_REPOSITORY!==CONTROL_REPO||
     !Number.isInteger(event.issue?.number))return;
  const body=`Inflation #31 PC-private capture: **${result.status}** (${result.code})\n\n`+
    '```json\n'+JSON.stringify(result,null,2)+'\n```';
  const response=await fetcher(`https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!response.ok)throw Error('SCE31_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else execute();
}
