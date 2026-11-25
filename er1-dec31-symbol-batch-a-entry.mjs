// Immutable, one-shot Windows host admission for 40 candidate symbols only.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

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


//
// Narrow user-approved #173 recovery path. Reuses this existing one-shot
// Windows admission, GitHub workflow and private raw collector. The original
// 40-call issue/approval/marker path above is deliberately unchanged.
//
const PAIR_TITLE='pc-er1-dec31-symbol-pair-resume-once';
const PAIR_APPROVAL='ER1_DEC31_SYMBOL_PAIR_RESUME_B_APPROVAL.json';
const PAIR_RESULT='ER1_DEC31_SYMBOL_PAIR_RESUME_RESULT.json';
const PAIR_SOURCE_SHA='e9895abee60bc74e30380372143daf10cb3333ee';
const PAIR_SOURCE_BLOB='a2ce20772f0415c461e2b8a027b16f8e28bef1fc';
const PAIR_ONCE_ROOT=String.raw`E:\ZGmini\automation\er1-dec31-symbol-pair-resume`;
const PAIR_ORIGINAL_REQUEST='pc-dec31-a237c95a-dedb-4d19-854c-eb1234878eab';
const PAIR_UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const pairStop=code=>{throw Error(code)};
const pairCode=e=>/^DEC31_PAIR_[A-Z0-9_]+$/.test(String(e?.message))?
  e.message:'DEC31_PAIR_UNEXPECTED_STOP';
const exactPairFields=(v,names)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join('|')===names.slice().sort().join('|');

export function validatePairRequest(event,env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event.issue?.user?.login!==OWNER||
    event.issue?.title!==PAIR_TITLE||
    !event.issue?.labels?.some(x=>x.name===LABEL))
    pairStop('DEC31_PAIR_REQUEST_OWNER_STOP');
  let r;try{r=JSON.parse(event.issue.body)}catch{pairStop('DEC31_PAIR_REQUEST_JSON_STOP')}
  if(!exactPairFields(r,['schema','requestId','chatId','operation','sourceSha',
    'originalIssueNumber','from','through'])||
    r.schema!=='ZGMINI_ER1_DEC31_PAIR_RESUME_V1'||
    r.operation!=='resume-december-2026-tol-casy-private-only'||
    r.sourceSha!==PAIR_SOURCE_SHA||r.originalIssueNumber!==173||
    r.from!=='2026-12-01'||r.through!=='2026-12-31'||
    !new RegExp('^pc-dec31-pair-'+PAIR_UUID+String.fromCharCode(36)).test(r.requestId)||
    !new RegExp('^chat-'+PAIR_UUID+String.fromCharCode(36)).test(r.chatId))
    pairStop('DEC31_PAIR_REQUEST_CONTRACT_STOP');
  return r;
}

export function validatePairApproval(v){
  if(!exactPairFields(v,[
    'schema','approvalState','scope','originalIssueNumber','originalRequestId',
    'originalSourceSha','sourceRepository','sourceSha','sourceFile','sourceGitBlobSha1',
    'fixedExistingSymbols','symbols','periodStart','periodEnd','maxProviderRequests',
    'maxAutomaticRetries','privateRawStorageOnly','requireOriginalOneShotMarker',
    'requireUnmodifiedExistingRaw','allowPaidPlanChange','allowNewProvider',
    'allowCoreWrites','allowD1Writes','allowSchedulerChanges','allowPublicRawData',
    'allowDeploymentChanges'])||
    v.schema!=='ZGMINI_ER1_DEC31_SYMBOL_PAIR_RESUME_APPROVAL_V1'||
    v.approvalState!=='USER_APPROVED_IN_CHAT_2026-11-26'||
    v.scope!=='PC_PRIVATE_EARNINGSAPI_DEC2026_TOL_CASY_PAIR_RESUME_ONLY'||
    v.originalIssueNumber!==173||v.originalRequestId!==PAIR_ORIGINAL_REQUEST||
    v.originalSourceSha!==SOURCE_SHA||
    v.sourceRepository!=='ansqhd5774-Choi/zgmini'||
    v.sourceSha!==PAIR_SOURCE_SHA||
    v.sourceFile!=='scripts/pc-writer/market-calendar-dec31-symbol-batch-a.mjs'||
    v.sourceGitBlobSha1!==PAIR_SOURCE_BLOB||v.fixedExistingSymbols!==38||
    JSON.stringify(v.symbols)!=='["TOL","CASY"]'||
    v.periodStart!=='2026-12-01'||v.periodEnd!=='2026-12-31'||
    v.maxProviderRequests!==2||v.maxAutomaticRetries!==0||
    v.privateRawStorageOnly!==true||
    v.requireOriginalOneShotMarker!==true||
    v.requireUnmodifiedExistingRaw!==true||
    v.allowPaidPlanChange!==false||v.allowNewProvider!==false||
    v.allowCoreWrites!==false||v.allowD1Writes!==false||
    v.allowSchedulerChanges!==false||v.allowPublicRawData!==false||
    v.allowDeploymentChanges!==false)
    pairStop('DEC31_PAIR_APPROVAL_SCOPE_STOP');
  return v;
}

function verifyPairApproval(workspace){
  const file=path.join(workspace,'control',PAIR_APPROVAL);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>4096)
    pairStop('DEC31_PAIR_APPROVAL_FILE_STOP');
  return validatePairApproval(JSON.parse(fs.readFileSync(file,'utf8')));
}

function verifyPairSource(workspace){
  const directory=path.join(workspace,'source');
  const sha=execFileSync('git',['-C',directory,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,
    stdio:['ignore','pipe','ignore']}).trim();
  if(sha!==PAIR_SOURCE_SHA)pairStop('DEC31_PAIR_SOURCE_PIN_STOP');
  const file=path.join(directory,SCRIPT);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>20000)
    pairStop('DEC31_PAIR_SOURCE_FILE_STOP');
  // git hash-object hashes the exact checked-out file bytes (not tree metadata).
  const blob=execFileSync('git',['-C',directory,'hash-object',file],{
    encoding:'utf8',windowsHide:true,timeout:15000,
    stdio:['ignore','pipe','ignore']}).trim();
  if(blob!==PAIR_SOURCE_BLOB)pairStop('DEC31_PAIR_SOURCE_BLOB_STOP');
  return file;
}

function verifyOriginalOneShot(){
  const marker=path.join(ONCE_ROOT,'ONE_SHOT_STARTED.json');
  const stat=fs.lstatSync(marker);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>2048)
    pairStop('DEC31_PAIR_ORIGINAL_MARKER_STOP');
  const v=JSON.parse(fs.readFileSync(marker,'utf8'));
  if(v.schema!=='ZGMINI_DEC31_BATCH_ONCE_V1'||
    v.requestId!==PAIR_ORIGINAL_REQUEST||v.sourceSha!==SOURCE_SHA||
    typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at)))
    pairStop('DEC31_PAIR_ORIGINAL_MARKER_STOP');
}

// Public issue report holds *only* bounded outcome counts, not proprietary
// vendor body, per-symbol event dates, credential, local path or source payload.
export async function executePair({env=process.env}={}){
  let report={schema:'ZGMINI_DEC31_SYMBOL_PAIR_RESUME_RESULT_V1',
    status:'BLOCKED',code:'DEC31_PAIR_NOT_STARTED',
    originalIssueNumber:173,providerCalls:0,retries:0,
    verifiedExisting:0,newStored:0,totalStored:0,
    coreWrites:0,d1Writes:0,schedulerWrites:0,
    publicationWrites:0,paidPlanChanges:0};
  let began=false;
  try{
    if(process.platform!=='win32')pairStop('DEC31_PAIR_WINDOWS_ONLY');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const request=validatePairRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
      pairStop('DEC31_PAIR_WORKSPACE_STOP');
    verifyPairApproval(env.GITHUB_WORKSPACE);
    const source=verifyPairSource(env.GITHUB_WORKSPACE);
    verifyOriginalOneShot();
    if(!fs.existsSync(PC_NODE))pairStop('DEC31_PAIR_NODE_STOP');
    fs.mkdirSync(PAIR_ONCE_ROOT,{recursive:true});
    let fd;
    try{fd=fs.openSync(path.join(PAIR_ONCE_ROOT,'ONE_SHOT_STARTED.json'),'wx')}
    catch{pairStop('DEC31_PAIR_ALREADY_ATTEMPTED')}
    try{fs.writeFileSync(fd,JSON.stringify({
      schema:'ZGMINI_DEC31_PAIR_ONCE_V1',requestId:request.requestId,
      sourceSha:PAIR_SOURCE_SHA,originalRequestId:PAIR_ORIGINAL_REQUEST,
      at:new Date().toISOString()}))}
    finally{fs.closeSync(fd)}
    began=true;
    const mod=await import(pathToFileURL(source).href);
    if(typeof mod.runDec31Batch!=='function')
      pairStop('DEC31_PAIR_SOURCE_EXPORT_STOP');
    const out=await mod.runDec31Batch({resumeMissingPairOnly:true});
    if(out?.schema!=='ZGMINI_DEC31_SYMBOL_BATCH_A_V1'||
      !['BATCH_COMPLETE','PARTIAL','BLOCKED','STATE_UNKNOWN'].includes(out.status)||
      !Number.isInteger(out.providerCalls)||out.providerCalls<0||out.providerCalls>2||
      !Number.isInteger(out.reusedStoredSymbols)||out.reusedStoredSymbols<0||
      out.reusedStoredSymbols>38||
      !Number.isInteger(out.newStoredSymbols)||out.newStoredSymbols<0||
      out.newStoredSymbols>2||
      out.retries!==0||out.coreWrites!==0||out.d1Writes!==0||
      out.schedulerWrites!==0||out.publicationWrites!==0)
      pairStop('DEC31_PAIR_EFFECT_CONTRACT_STOP');
    report={...report,status:out.status==='BATCH_COMPLETE'?'PASS':out.status,
      code:out.status==='BATCH_COMPLETE'?'DEC31_PAIR_PRIVATE_RAW_VERIFIED':out.code,
      providerCalls:out.providerCalls,retries:out.retries,
      verifiedExisting:out.reusedStoredSymbols,
      newStored:out.newStoredSymbols,totalStored:out.storedSymbols};
    if(report.status==='PASS'&&
      (report.providerCalls!==2||report.verifiedExisting!==38||
       report.newStored!==2||report.totalStored!==40))
      pairStop('DEC31_PAIR_COMPLETION_CONTRACT_STOP');
  }catch(error){
    report.status=began?'STATE_UNKNOWN':'BLOCKED';
    report.code=pairCode(error);
  }
  try{
    if(env.GITHUB_WORKSPACE&&path.isAbsolute(env.GITHUB_WORKSPACE))
      fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,PAIR_RESULT),
        JSON.stringify(report)+'\n',{flag:'wx'});
  }catch{process.stderr.write('DEC31_PAIR_RESULT_SAVE_STOP\n')}
  process.stdout.write('STATUS='+report.status+' CODE='+report.code+
    ' REQUESTS='+report.providerCalls+' STORED='+report.newStored+'\n');
  if(report.status!=='PASS')process.exitCode=1;
  return report;
}

export async function uploadPair({env=process.env,fetcher=fetch}={}){
  const filename=path.join(env.GITHUB_WORKSPACE??'',PAIR_RESULT);
  if(!fs.existsSync(filename)||env.GITHUB_REPOSITORY!==REPO||
    !env.GITHUB_TOKEN)return;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!Number.isSafeInteger(event.issue?.number)||
    event.issue?.title!==PAIR_TITLE)return;
  const result=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(result.schema!=='ZGMINI_DEC31_SYMBOL_PAIR_RESUME_RESULT_V1')return;
  const summary={
    schema:result.schema,status:result.status,code:result.code,
    originalIssueNumber:173,providerCalls:result.providerCalls,
    verifiedExisting:result.verifiedExisting,
    newStored:result.newStored,totalStored:result.totalStored,
    coreWrites:0,d1Writes:0,schedulerWrites:0,publicationWrites:0};
  const response=await fetcher('https://api.github.com/repos/'+REPO+
    '/issues/'+event.issue.number+'/comments',{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},
    body:JSON.stringify({body:'ER1 private TOL/CASY pair resume:\n\n```json\n'+
      JSON.stringify(summary,null,2)+'\n```'})});
  if(!response.ok)throw Error('DEC31_PAIR_UPLOAD_STOP');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();
  else if(process.argv[2]==='--pair-resume')await executePair();
  else if(process.argv[2]==='--upload-pair')await uploadPair();
  else execute();
}
