// Separate one-shot host adapter for December 2026 symbol endpoint verification.
// Neither GitHub Issue input nor a mutable branch can select executable code.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SOURCE_SHA='744f95cf8d422fd37d7d736464d39d535b5f7e86';
const SCRIPT_SHA256='74b5c7c39620e0b2779dda8da7a5296101425513b10d5b2099f69213cdaa639b';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const TITLE='pc-er1-dec31-symbol-probe-one-shot';
const LABEL='pc-er1-approved';
const ROOT=String.raw`E:\ZGmini\automation\er1-dec31-symbol-probe`;
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const RESULT='ER1_DEC31_SYMBOL_PROBE_RESULT.json';
const SCRIPT=path.join('scripts','pc-writer','market-calendar-dec31-symbol-probe.mjs');
const APPROVAL='ER1_DEC31_SYMBOL_PROBE_B_APPROVAL.json';
const stop=code=>{throw Error(code)};
const errorCode=e=>/^DEC31_SYMBOL_[A-Z0-9_]+$/.test(String(e?.message))?
  e.message:'DEC31_SYMBOL_ENTRY_UNEXPECTED_STOP';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
    event?.issue?.title!==TITLE||!event.issue.labels?.some(x=>x.name===LABEL))
    stop('DEC31_SYMBOL_ISSUE_NOT_APPROVED');
  let req;try{req=JSON.parse(event.issue.body)}catch{stop('DEC31_SYMBOL_ISSUE_BODY_INVALID')}
  const fields=['chatId','from','operation','requestId','schema','sourceSha','through'].sort().join('|');
  if(!req||typeof req!=='object'||Array.isArray(req)||
    Object.keys(req).sort().join('|')!==fields||
    req.schema!=='ZGMINI_ER1_DEC31_SYMBOL_PROBE_V1'||
    req.operation!=='probe-earningsapi-symbol-december-2026'||
    req.sourceSha!==SOURCE_SHA||req.from!=='2026-12-01'||req.through!=='2026-12-31'||
    !/^pc-dec31-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(req.requestId)||
    !/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(req.chatId))
    stop('DEC31_SYMBOL_ISSUE_CONTRACT_INVALID');
  return req;
}

const safeEnv=env=>Object.fromEntries([
  'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP',
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));

function verifySource(workspace){
  const directory=path.join(workspace,'source');
  const sha=execFileSync('git',['-C',directory,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,
    stdio:['ignore','pipe','ignore']}).trim();
  if(sha!==SOURCE_SHA)stop('DEC31_SYMBOL_SOURCE_PIN_MISMATCH');
  const filename=path.join(directory,SCRIPT);
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>20000||
    digest(fs.readFileSync(filename))!==SCRIPT_SHA256)
    stop('DEC31_SYMBOL_SOURCE_HASH_MISMATCH');
  return filename;
}

function verifyApproval(workspace){
  const filename=path.join(workspace,'control',APPROVAL);
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)
    stop('DEC31_SYMBOL_APPROVAL_FILE_INVALID');
  const v=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(v.schema!=='ZGMINI_ER1_DEC31_SYMBOL_PROBE_APPROVAL_V1'||
    v.scope!=='PC_PRIVATE_EXISTING_EARNINGSAPI_SYMBOL_PROBE_ONLY'||
    v.sourceRepository!=='ansqhd5774-Choi/zgmini'||
    v.sourceBranch!=='codex/zgmini-gpt-workspace-20261025'||
    v.sourceSha!==SOURCE_SHA||
    v.sourceFile!=='scripts/pc-writer/market-calendar-dec31-symbol-probe.mjs'||
    v.sourceFileSha256!==SCRIPT_SHA256||
    JSON.stringify(v.symbols)!=='["BOX","COST","ORCL"]'||
    v.start!=='2026-12-01'||v.end!=='2026-12-31'||
    v.maxProviderRequests!==3||v.maxAutomaticRetries!==0||
    v.allowCoreReadOnly!==false||v.allowCoreWrites!==false||
    v.allowD1Writes!==false||v.allowSchedulerChanges!==false||
    v.allowChangesToExisting14DayFeed!==false||v.allowPublicRawData!==false)
    stop('DEC31_SYMBOL_APPROVAL_SCOPE_MISMATCH');
}

export function execute({env=process.env}={}){
  let report={schema:'ZGMINI_DEC31_SYMBOL_PROBE_V1',status:'BLOCKED',
    code:'DEC31_SYMBOL_NOT_STARTED',providerCalls:0,stagedSymbols:0,
    decemberEventRows:0,coreWrites:0,d1Writes:0,schedulerWrites:0,publicationWrites:0};
  try{
    if(process.platform!=='win32')stop('DEC31_SYMBOL_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const request=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
      stop('DEC31_SYMBOL_WORKSPACE_INVALID');
    verifyApproval(env.GITHUB_WORKSPACE);
    const source=verifySource(env.GITHUB_WORKSPACE);
    if(!fs.existsSync(NODE))stop('DEC31_SYMBOL_NODE_MISSING');
    fs.mkdirSync(ROOT,{recursive:true});
    const marker=path.join(ROOT,'ONE_SHOT_STARTED.json');
    let fd;try{fd=fs.openSync(marker,'wx')}catch{stop('DEC31_SYMBOL_ALREADY_ATTEMPTED')}
    try{fs.writeFileSync(fd,JSON.stringify({schema:'ZGMINI_DEC31_SYMBOL_ONCE_V1',
      requestId:request.requestId,sourceSha:SOURCE_SHA,at:new Date().toISOString()}))}
    finally{fs.closeSync(fd)}
    const output=path.join(env.GITHUB_WORKSPACE,'dec31-symbol-child-report.json');
    const child=spawnSync(NODE,[source,output],{
      cwd:path.dirname(source),windowsHide:true,timeout:120000,
      encoding:'utf8',maxBuffer:8192,env:safeEnv(env),shell:false});
    if(fs.existsSync(output)){
      const v=JSON.parse(fs.readFileSync(output,'utf8'));
      if(v?.schema==='ZGMINI_DEC31_SYMBOL_PROBE_V1')report={...v,requestId:request.requestId};
    }
    if(child.error||child.signal||!fs.existsSync(output)){
      report.status='STATE_UNKNOWN';report.code='DEC31_SYMBOL_CHILD_RESULT_UNKNOWN';
    }else if(child.status!==0&&['PROBE_POSITIVE','INCONCLUSIVE'].includes(report.status)){
      report.status='STATE_UNKNOWN';report.code='DEC31_SYMBOL_CHILD_EXIT_MISMATCH';
    }
  }catch(e){report.code=errorCode(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('DEC31_SYMBOL_WORKFLOW_RESULT_SAVE_STOP\n')}
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} CALLS=${report.providerCalls} DATES=${report.decemberEventRows}\n`);
  if(report.status!=='PROBE_POSITIVE')process.exitCode=1;
}

export async function upload({env=process.env,fetcher=fetch}={}){
  const file=path.join(env.GITHUB_WORKSPACE,RESULT);
  if(!fs.existsSync(file))return;
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||env.GITHUB_REPOSITORY!==REPO)return;
  const body='ER1 December 2026 existing-provider symbol probe: **'+report.status+
    '** ('+report.code+')\n\n```json\n'+JSON.stringify(report,null,2)+'\n```';
  const response=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!response.ok)throw Error('DEC31_SYMBOL_UPLOAD_FAILED');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();else execute();
}
