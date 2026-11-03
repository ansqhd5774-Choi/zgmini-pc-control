// Immutable, one-shot Windows host admission for 40 candidate symbols only.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const SOURCE_SHA='55014d3c76ac1071dbe369c0a7fe72bd94ed0c5a';
const SCRIPT_SHA256='7dac30b034cdac5cf60580057676b655c2ab828752b82c594c4a95a1254c70c6';
const TITLE='pc-er1-dec31-symbol-batch-a-one-shot';
const LABEL='pc-er1-approved';
const PC_NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const ONCE_ROOT=String.raw`E:\ZGmini\automation\er1-dec31-symbol-batch-a`;
const SCRIPT=path.join('scripts','pc-writer','market-calendar-dec31-symbol-batch-a.mjs');
const APPROVAL='ER1_DEC31_SYMBOL_BATCH_A_B_APPROVAL.json';
const RESULT='ER1_DEC31_SYMBOL_BATCH_A_RESULT.json';
const stop=code=>{throw Error(code)};
const safeCode=e=>/^DEC31_BATCH_[A-Z0-9_]+$/.test(String(e?.message))?
  e.message:'DEC31_BATCH_ENTRY_UNEXPECTED_STOP';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
    event?.issue?.title!==TITLE||!event.issue.labels?.some(x=>x.name===LABEL))
    stop('DEC31_BATCH_ISSUE_NOT_APPROVED');
  let request;try{request=JSON.parse(event.issue.body)}catch{stop('DEC31_BATCH_BODY_INVALID')}
  if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).sort().join('|')!==
      ['chatId','from','operation','requestId','schema','sourceSha','through'].sort().join('|')||
    request.schema!=='ZGMINI_ER1_DEC31_SYMBOL_BATCH_A_V1'||
    request.operation!=='capture-december-2026-earnings-symbol-batch-a'||
    request.sourceSha!==SOURCE_SHA||
    request.from!=='2026-12-01'||request.through!=='2026-12-31'||
    !/^pc-dec31-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(request.requestId)||
    !/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(request.chatId))
    stop('DEC31_BATCH_CONTRACT_INVALID');
  return request;
}

const safeEnv=env=>Object.fromEntries([
  'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP'
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));

function verifySource(workspace){
  const directory=path.join(workspace,'source');
  const sha=execFileSync('git',['-C',directory,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,
    stdio:['ignore','pipe','ignore']}).trim();
  if(sha!==SOURCE_SHA)stop('DEC31_BATCH_SOURCE_SHA_MISMATCH');
  const filename=path.join(directory,SCRIPT);
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>20000||
    hash(fs.readFileSync(filename))!==SCRIPT_SHA256)
    stop('DEC31_BATCH_SOURCE_HASH_MISMATCH');
  return filename;
}

function verifyApproval(workspace){
  const filename=path.join(workspace,'control',APPROVAL);
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)
    stop('DEC31_BATCH_APPROVAL_FILE_INVALID');
  const p=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(p.schema!=='ZGMINI_ER1_DEC31_SYMBOL_BATCH_A_APPROVAL_V1'||
    p.scope!=='PC_PRIVATE_EARNINGSAPI_DECEMBER_SYMBOL_CANDIDATES_BATCH_A_ONLY'||
    p.sourceRepository!=='ansqhd5774-Choi/zgmini'||
    p.sourceBranch!=='codex/zgmini-gpt-workspace-20261025'||
    p.sourceSha!==SOURCE_SHA||
    p.sourceFile!=='scripts/pc-writer/market-calendar-dec31-symbol-batch-a.mjs'||
    p.sourceFileSha256!==SCRIPT_SHA256||p.candidateSymbolCount!==40||
    p.start!=='2026-12-01'||p.end!=='2026-12-31'||
    p.maxProviderRequests!==40||p.maxAutomaticRetries!==0||
    p.allowCoreReadOnly!==false||p.allowCoreWrites!==false||
    p.allowD1Writes!==false||p.allowSchedulerChanges!==false||
    p.allowChangesToExisting14DayFeed!==false||p.allowPublicRawData!==false)
    stop('DEC31_BATCH_APPROVAL_SCOPE_MISMATCH');
}

export function execute({env=process.env}={}){
  let report={schema:'ZGMINI_DEC31_SYMBOL_BATCH_A_V1',status:'BLOCKED',
    code:'DEC31_BATCH_NOT_STARTED',providerCalls:0,storedSymbols:0,
    decemberEventRows:0,coreWrites:0,d1Writes:0,schedulerWrites:0,publicationWrites:0};
  try{
    if(process.platform!=='win32')stop('DEC31_BATCH_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const request=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
      stop('DEC31_BATCH_WORKSPACE_INVALID');
    verifyApproval(env.GITHUB_WORKSPACE);
    const source=verifySource(env.GITHUB_WORKSPACE);
    if(!fs.existsSync(PC_NODE))stop('DEC31_BATCH_NODE_MISSING');
    fs.mkdirSync(ONCE_ROOT,{recursive:true});
    let fd;try{fd=fs.openSync(path.join(ONCE_ROOT,'ONE_SHOT_STARTED.json'),'wx')}
    catch{stop('DEC31_BATCH_ALREADY_ATTEMPTED')}
    try{fs.writeFileSync(fd,JSON.stringify({schema:'ZGMINI_DEC31_BATCH_ONCE_V1',
      requestId:request.requestId,sourceSha:SOURCE_SHA,at:new Date().toISOString()}))}
    finally{fs.closeSync(fd)}
    const output=path.join(env.GITHUB_WORKSPACE,'dec31-batch-child-report.json');
    const child=spawnSync(PC_NODE,[source,output],{
      cwd:path.dirname(source),windowsHide:true,timeout:660000,
      encoding:'utf8',maxBuffer:8192,env:safeEnv(env),shell:false});
    if(fs.existsSync(output)){
      const v=JSON.parse(fs.readFileSync(output,'utf8'));
      if(v?.schema==='ZGMINI_DEC31_SYMBOL_BATCH_A_V1')report={...v,requestId:request.requestId};
    }
    if(child.error||child.signal||!fs.existsSync(output)){
      report.status='STATE_UNKNOWN';report.code='DEC31_BATCH_CHILD_RESULT_UNKNOWN';
    }else if(child.status!==0&&report.status==='BATCH_COMPLETE'){
      report.status='STATE_UNKNOWN';report.code='DEC31_BATCH_CHILD_EXIT_MISMATCH';
    }
  }catch(e){report.code=safeCode(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('DEC31_BATCH_REPORT_SAVE_STOP\n')}
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} SAVED=${report.storedSymbols}/40 FOUND=${report.decemberEventRows}\n`);
  if(report.status!=='BATCH_COMPLETE')process.exitCode=1;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  const filename=path.join(env.GITHUB_WORKSPACE,RESULT);
  if(!fs.existsSync(filename))return;
  const report=JSON.parse(fs.readFileSync(filename,'utf8'));
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||env.GITHUB_REPOSITORY!==REPO)return;
  const body='ER1 December 2026 40-symbol private candidate batch: **'+report.status+
    '** ('+report.code+')\n\n```json\n'+JSON.stringify(report,null,2)+'\n```';
  const res=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!res.ok)throw Error('DEC31_BATCH_UPLOAD_FAILED');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else execute();
}
