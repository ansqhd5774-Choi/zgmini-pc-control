// Independently scoped B one-shot admission for private 2026-11 calendar input.
// No Core/DB/D1/source/rotation/install changes. Only this pinned capture runs.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SOURCE_SHA='11a971cb5d3514c2d1e1798def58465fb8a74035';
const SCRIPT_SHA256='af087611406ca5e343b7e0c27c529524e36445fee27518537100a6badf31d39b';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const ISSUE_TITLE='pc-er1-nov30-capture-one-shot';
const ISSUE_LABEL='pc-er1-approved';
const ROOT=String.raw`E:\ZGmini\automation\er1-nov30-capture`;
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const RESULT='ER1_NOV30_CAPTURE_RESULT.json';
const SOURCE_SCRIPT=path.join('scripts','pc-writer','market-calendar-nov30-forward-capture.mjs');
const APPROVAL_FILE='ER1_NOV30_CAPTURE_B_APPROVAL.json';
const sha256=x=>createHash('sha256').update(x).digest('hex');
const err=code=>{throw Error(code)};
const code=e=>/^NOV30_[A-Z0-9_]+$/.test(String(e?.message))?e.message:'NOV30_ENTRY_UNEXPECTED_STOP';

export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
    event?.issue?.title!==ISSUE_TITLE||
    !event.issue.labels?.some(x=>x.name===ISSUE_LABEL))err('NOV30_ISSUE_NOT_APPROVED');
  let r;try{r=JSON.parse(event.issue.body)}catch{err('NOV30_ISSUE_BODY_INVALID')}
  if(Object.keys(r).sort().join('|')!==[
    'chatId','from','operation','requestId','schema','sourceSha','through'].sort().join('|')||
    r.schema!=='ZGMINI_ER1_NOV30_CAPTURE_V1'||
    r.operation!=='capture-earnings-calendar-through-2026-11-30'||
    r.sourceSha!==SOURCE_SHA||r.from!=='2026-11-01'||r.through!=='2026-11-30'||
    !/^pc-nov30-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.requestId)||
    !/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.chatId))
    err('NOV30_ISSUE_CONTRACT_INVALID');
  return r;
}

const sanitizedEnv=env=>Object.fromEntries([
  'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP',
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));

function verifySource(workspace){
  const folder=path.join(workspace,'source');
  const source=path.join(folder,SOURCE_SCRIPT);
  const actual=execFileSync('git',['-C',folder,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,stdio:['ignore','pipe','ignore']}).trim();
  if(actual!==SOURCE_SHA)err('NOV30_SOURCE_PIN_MISMATCH');
  const stat=fs.lstatSync(source);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>20000||
    sha256(fs.readFileSync(source))!==SCRIPT_SHA256)
    err('NOV30_SOURCE_FILE_HASH_MISMATCH');
  return source;
}

function verifyApproval(workspace){
  const file=path.join(workspace,'control',APPROVAL_FILE);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)
    err('NOV30_APPROVAL_FILE_INVALID');
  const approval=JSON.parse(fs.readFileSync(file,'utf8'));
  if(approval.schema!=='ZGMINI_ER1_NOV30_CAPTURE_APPROVAL_V1'||
    approval.scope!=='PC_PRIVATE_CALENDAR_DATES_2026_11_01_THROUGH_2026_11_30_ONLY'||
    approval.sourceSha!==SOURCE_SHA||approval.sourceFileSha256!==SCRIPT_SHA256||
    approval.start!=='2026-11-01'||approval.end!=='2026-11-30'||
    approval.maxProviderRequests!==30||approval.maxAutomaticRetries!==0||
    approval.allowCoreReadOnly!==true||approval.allowCoreWrites!==false||
    approval.allowD1Writes!==false||approval.allowSchedulerChanges!==false||
    approval.allowChangesToExisting14DayFeed!==false||approval.allowPublicRawData!==false)
    err('NOV30_APPROVAL_SCOPE_MISMATCH');
}

export function execute({env=process.env}={}){
  let report={schema:'ZGMINI_NOV30_JOB_V1',status:'BLOCKED',code:'NOV30_NOT_STARTED',
    range:['2026-11-01','2026-11-30'],providerCalls:0,coveredDayCount:0,
    coreWrites:0,d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')err('NOV30_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const request=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
      err('NOV30_WORKSPACE_INVALID');
    verifyApproval(env.GITHUB_WORKSPACE);
    const source=verifySource(env.GITHUB_WORKSPACE);
    if(!fs.existsSync(NODE))err('NOV30_NODE_MISSING');
    fs.mkdirSync(ROOT,{recursive:true});
    const marker=path.join(ROOT,'ONE_SHOT_STARTED.json');
    // Persistent create-only admission prevents duplicate API charges, even
    // across different GitHub Actions runs and runner seats on this PC.
    let fd;try{fd=fs.openSync(marker,'wx')}catch{err('NOV30_ALREADY_ATTEMPTED')}
    try{fs.writeFileSync(fd,JSON.stringify({schema:'ZGMINI_NOV30_ONCE_V1',
      requestId:request.requestId,sourceSha:SOURCE_SHA,at:new Date().toISOString()}))}
    finally{fs.closeSync(fd)}
    const output=path.join(env.GITHUB_WORKSPACE,'nov30-child-report.json');
    const child=spawnSync(NODE,[source,output],{
      cwd:path.dirname(source),windowsHide:true,timeout:360000,
      encoding:'utf8',maxBuffer:8192,env:sanitizedEnv(env),shell:false});
    if(fs.existsSync(output)){
      const result=JSON.parse(fs.readFileSync(output,'utf8'));
      if(result?.schema==='ZGMINI_NOV30_PRIVATE_CAPTURE_V1')
        report={...result,requestId:request.requestId};
    }
    if(child.error||child.signal||!fs.existsSync(output)){
      report.status='STATE_UNKNOWN';report.code='NOV30_CHILD_RESULT_UNKNOWN';
    }else if(child.status!==0&&report.status==='PASS'){
      report.status='STATE_UNKNOWN';report.code='NOV30_CHILD_EXIT_MISMATCH';
    }
  }catch(e){report.code=code(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('NOV30_WORKFLOW_RESULT_SAVE_STOP\n')}
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} COVERED=${report.coveredDayCount}/30 CALLS=${report.providerCalls}\n`);
  if(report.status!=='PASS')process.exitCode=1;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  const file=path.join(env.GITHUB_WORKSPACE,RESULT);
  if(!fs.existsSync(file))return;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||
    env.GITHUB_REPOSITORY!==REPO)return;
  const body=`ER1 2026-11-01~30 collection: **${data.status}** (${data.code})\n\n`+
    '```json\n'+JSON.stringify(data,null,2)+'\n```';
  const res=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!res.ok)throw Error('NOV30_UPLOAD_FAILED');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();
  else execute();
}
