// Fixed, independently admitted B one-shot for December 2026 private PC input.
// GitHub issue arguments cannot inject commands, source revisions or paths.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SOURCE_SHA='462941884db7ad2ebb25a7e5872296d074a10c23';
const SCRIPT_SHA256='746f9071d45555c02bfbf39fcfce9c81707431fe4c6cc180d9e97fb86733f03c';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const TITLE='pc-er1-dec31-capture-one-shot';
const LABEL='pc-er1-approved';
const ROOT=String.raw`E:\ZGmini\automation\er1-dec31-capture`;
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const RESULT='ER1_DEC31_CAPTURE_RESULT.json';
const SOURCE_SCRIPT=path.join('scripts','pc-writer','market-calendar-dec31-forward-capture.mjs');
const APPROVAL_FILE='ER1_DEC31_CAPTURE_B_APPROVAL.json';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Error(code)};
const errorCode=e=>/^DEC31_[A-Z0-9_]+$/.test(String(e?.message))?e.message:'DEC31_ENTRY_UNEXPECTED_STOP';

export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
    event?.issue?.title!==TITLE||
    !event.issue.labels?.some(x=>x.name===LABEL))stop('DEC31_ISSUE_NOT_APPROVED');
  let req;try{req=JSON.parse(event.issue.body)}catch{stop('DEC31_ISSUE_BODY_INVALID')}
  if(!req||typeof req!=='object'||Array.isArray(req)||
    Object.keys(req).sort().join('|')!==[
      'chatId','from','operation','requestId','schema','sourceSha','through'].sort().join('|')||
    req.schema!=='ZGMINI_ER1_DEC31_CAPTURE_V1'||
    req.operation!=='capture-earnings-calendar-through-2026-12-31'||
    req.sourceSha!==SOURCE_SHA||req.from!=='2026-12-01'||req.through!=='2026-12-31'||
    !/^pc-dec31-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(req.requestId)||
    !/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(req.chatId))
    stop('DEC31_ISSUE_CONTRACT_INVALID');
  return req;
}

const safeEnvironment=env=>Object.fromEntries([
  'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP',
].filter(x=>typeof env[x]==='string').map(x=>[x,env[x]]));

function verifySource(workspace){
  const directory=path.join(workspace,'source');
  const actualSha=execFileSync('git',['-C',directory,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,stdio:['ignore','pipe','ignore']}).trim();
  if(actualSha!==SOURCE_SHA)stop('DEC31_SOURCE_PIN_MISMATCH');
  const file=path.join(directory,SOURCE_SCRIPT);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>20000||
    digest(fs.readFileSync(file))!==SCRIPT_SHA256)
    stop('DEC31_SOURCE_FILE_HASH_MISMATCH');
  return file;
}

function verifyApproval(workspace){
  const file=path.join(workspace,'control',APPROVAL_FILE);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)
    stop('DEC31_APPROVAL_FILE_INVALID');
  const approval=JSON.parse(fs.readFileSync(file,'utf8'));
  if(approval.schema!=='ZGMINI_ER1_DEC31_CAPTURE_APPROVAL_V1'||
    approval.scope!=='PC_PRIVATE_CALENDAR_DATES_2026_12_01_THROUGH_2026_12_31_ONLY'||
    approval.sourceRepository!=='ansqhd5774-Choi/zgmini'||
    approval.sourceBranch!=='codex/zgmini-gpt-workspace-20261025'||
    approval.sourceSha!==SOURCE_SHA||approval.sourceFileSha256!==SCRIPT_SHA256||
    approval.start!=='2026-12-01'||approval.end!=='2026-12-31'||
    approval.maxProviderRequests!==31||approval.maxAutomaticRetries!==0||
    approval.allowCoreReadOnly!==true||approval.allowCoreWrites!==false||
    approval.allowD1Writes!==false||approval.allowSchedulerChanges!==false||
    approval.allowChangesToExisting14DayFeed!==false||approval.allowPublicRawData!==false)
    stop('DEC31_APPROVAL_SCOPE_MISMATCH');
}

export function execute({env=process.env}={}){
  let report={schema:'ZGMINI_DEC31_JOB_V1',status:'BLOCKED',code:'DEC31_NOT_STARTED',
    range:['2026-12-01','2026-12-31'],providerCalls:0,coveredDayCount:0,
    coreWrites:0,d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')stop('DEC31_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const request=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
      stop('DEC31_WORKSPACE_INVALID');
    verifyApproval(env.GITHUB_WORKSPACE);
    const source=verifySource(env.GITHUB_WORKSPACE);
    if(!fs.existsSync(NODE))stop('DEC31_NODE_MISSING');
    fs.mkdirSync(ROOT,{recursive:true});
    const marker=path.join(ROOT,'ONE_SHOT_STARTED.json');
    // Strict create-once marker prevents accidental second full API run.
    let fd;try{fd=fs.openSync(marker,'wx')}catch{stop('DEC31_ALREADY_ATTEMPTED')}
    try{fs.writeFileSync(fd,JSON.stringify({schema:'ZGMINI_DEC31_ONCE_V1',
      requestId:request.requestId,sourceSha:SOURCE_SHA,at:new Date().toISOString()}))}
    finally{fs.closeSync(fd)}
    const output=path.join(env.GITHUB_WORKSPACE,'dec31-child-report.json');
    const child=spawnSync(NODE,[source,output],{
      cwd:path.dirname(source),windowsHide:true,timeout:450000,
      encoding:'utf8',maxBuffer:8192,env:safeEnvironment(env),shell:false});
    if(fs.existsSync(output)){
      const value=JSON.parse(fs.readFileSync(output,'utf8'));
      if(value?.schema==='ZGMINI_DEC31_PRIVATE_CAPTURE_V1')
        report={...value,requestId:request.requestId};
    }
    if(child.error||child.signal||!fs.existsSync(output)){
      report.status='STATE_UNKNOWN';report.code='DEC31_CHILD_RESULT_UNKNOWN';
    }else if(child.status!==0&&report.status==='PASS'){
      report.status='STATE_UNKNOWN';report.code='DEC31_CHILD_EXIT_MISMATCH';
    }
  }catch(e){report.code=errorCode(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('DEC31_WORKFLOW_RESULT_SAVE_STOP\n')}
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} COVERED=${report.coveredDayCount}/31 CALLS=${report.providerCalls}\n`);
  if(report.status!=='PASS')process.exitCode=1;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  const file=path.join(env.GITHUB_WORKSPACE,RESULT);
  if(!fs.existsSync(file))return;
  const result=JSON.parse(fs.readFileSync(file,'utf8'));
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||env.GITHUB_REPOSITORY!==REPO)return;
  const body=`ER1 December 2026 private calendar capture: **${result.status}** (${result.code})\n\n`+
    '```json\n'+JSON.stringify(result,null,2)+'\n```';
  const response=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!response.ok)throw Error('DEC31_UPLOAD_FAILED');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else execute();
}
