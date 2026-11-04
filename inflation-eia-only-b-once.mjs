// Fixed private B-grade PC EIA-only second capture. No generic commands or FRED.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_SHA='4a3426c53836c019f93536064d94367f680eb742';
export const TITLE='pc-inflation-eia-only-approved-once';
export const APPROVAL='INFLATION_EIA_ONLY_B_APPROVAL.json';
export const RESULT='INFLATION_EIA_ONLY_RESULT.json';
export const WRITER=String.raw`E:\ZGmini\data\pc-writer`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
export const MARKER_ROOT=String.raw`E:\ZGmini\data\pc-writer\inflation-eia-only-once-guard`;
export const SCRIPT='scripts/pc-writer/inflation-eia-only-once.mjs';
export const FILE_HASHES=Object.freeze({
  [SCRIPT]:'d74b554ea94d2ba86f39c101c0a1e6272fceb10d811572cb389e2cca37f53bc0',
  'scripts/inflation-causal-gas-electric.mjs':'dd4242131f9eb99d876a777fcf72b20a6d625362149b05847a5b8639f7aed9d1',
});
const COMMIT_SHA=/^[0-9a-f]{40}$/;
const FILE_SHA=/^[0-9a-f]{64}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQ=new RegExp(`^pc-inflation-eia-only-${UUID}$`);
const CHAT=new RegExp(`^chat-${UUID}$`);
const stop=code=>{throw Error(code)};
const hash=x=>createHash('sha256').update(x).digest('hex');
const cleanFailure=e=>/^EIAONE_[A-Z0-9_]{2,80}$/.test(String(e?.message))?
  e.message:'EIAONE_UNEXPECTED_STOP';
export function isPinnedSourceCommit(){return COMMIT_SHA.test(SOURCE_SHA)}
function regular(file,max){
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)
    stop('EIAONE_FILE_SHAPE_DENIED');
  return fs.readFileSync(file);
}
function safeDir(dir){
  const st=fs.lstatSync(dir);
  if(!st.isDirectory()||st.isSymbolicLink()||
     path.win32.normalize(fs.realpathSync.native(dir)).toLowerCase()!==
     path.win32.normalize(dir).toLowerCase())
    stop('EIAONE_PATH_REDIRECT_DENIED');
  return dir;
}
export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.repository?.private!==true||
    event?.issue?.user?.login!=='ansqhd5774-Choi'||event?.issue?.title!==TITLE)
    stop('EIAONE_ISSUE_DENIED');
  let req;try{req=JSON.parse(event.issue.body)}catch{stop('EIAONE_JSON_INVALID')}
  if(!req||typeof req!=='object'||Array.isArray(req)||
    Object.keys(req).sort().join('|')!==
      ['chatId','operation','requestId','schema','sourceSha'].sort().join('|')||
    req.schema!=='ZGMINI_INFLATION_EIA_ONLY_ONCE_V1'||
    req.operation!=='collect-eia-only-private-once'||req.sourceSha!==SOURCE_SHA||
    !REQ.test(req.requestId)||!CHAT.test(req.chatId))stop('EIAONE_REQUEST_DENIED');
  return req;
}
export function verifyApproval(workspace){
  const doc=JSON.parse(regular(path.join(workspace,'control',APPROVAL),5000).toString('utf8'));
  if(doc.schema!=='ZGMINI_INFLATION_EIA_ONLY_B_APPROVAL_V1'||
    doc.scope!=='EIA_INDUSTRIAL_US_PRIVATE_ONCE'||
    doc.sourceRepository!==SOURCE_REPO||doc.sourceSha!==SOURCE_SHA||
    doc.writerHome!==WRITER||
    doc.outputRelative!=='inflation-causal-r1/electricity-industrial-eia.json'||
    doc.maxProviderRequests!==2||doc.maxAutomaticRetries!==0||
    doc.allowFredCalls!==false||doc.allowCoreWrites!==false||
    doc.allowDbWrites!==false||doc.allowD1Writes!==false||
    doc.allowSchedulerChanges!==false||doc.allowPublicRawData!==false||
    JSON.stringify(doc.sourceFileHashes)!==JSON.stringify(FILE_HASHES))
    stop('EIAONE_APPROVAL_DENIED');
  return doc;
}
export function verifySource(workspace,{gitPath}={}){
  if(!isPinnedSourceCommit())stop('EIAONE_SOURCE_SHA_UNPINNED');
  const root=safeDir(path.join(workspace,'source'));
  const git=gitPath??[
    String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files (x86)\Git\cmd\git.exe`,
  ].find(x=>fs.existsSync(x));
  if(!git)stop('EIAONE_GIT_UNAVAILABLE');
  const actual=execFileSync(git,['-c','core.fsmonitor=false','-C',root,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024,
    stdio:['ignore','pipe','ignore']}).trim();
  if(actual!==SOURCE_SHA)stop('EIAONE_SOURCE_SHA_DENIED');
  for(const [relative,expected] of Object.entries(FILE_HASHES)){
    if(!FILE_SHA.test(expected))stop('EIAONE_FILE_HASH_UNPINNED');
    const file=path.join(root,...relative.split('/'));
    if(hash(regular(file,350000))!==expected)stop('EIAONE_FILE_HASH_DENIED');
  }
  return path.join(root,...SCRIPT.split('/'));
}
export function configuredEiaKey(variables){
  return Boolean(String(variables?.EIA_API_KEY||variables?.EIA_KEY||'').trim());
}
function verifyEiaKey(){
  const env=parseEnv(regular(path.join(WRITER,'providers.env'),100000).toString('utf8'));
  if(!configuredEiaKey(env))stop('EIAONE_KEY_MISSING');
}
function childEnv(env){
  const names=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec',
    'APPDATA','LOCALAPPDATA','TEMP','TMP'];
  return {...Object.fromEntries(names.filter(k=>typeof env[k]==='string')
    .map(k=>[k,env[k]])),ZGMINI_PC_HOME:WRITER};
}
export function validateChildResult(output){
  const id='EIA_INDUSTRIAL_US';
  if(output?.status!=='PASS'||
    !['EIA_ONLY_SAVED_READBACK','EIA_ONLY_PREVIOUS_VALID_UNCHANGED'].includes(output.code)||
    output.ids!==1||output.providerCalls!==2||
    output.coreWrites!==0||output.dbWrites!==0||output.d1Writes!==0||
    output.schedulerWrites!==0||
    !output.counts||!output.latest||!output.fileSha256||
    Object.keys(output.counts).join('|')!==id||
    Object.keys(output.latest).join('|')!==id||
    Object.keys(output.fileSha256).join('|')!==id||
    !Number.isInteger(output.counts[id])||output.counts[id]<1||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(output.latest[id])||
    !FILE_SHA.test(output.fileSha256[id]))
    stop('EIAONE_CHILD_CONTRACT_DENIED');
  return output;
}
export function execute(env=process.env){
  let report={schema:'ZGMINI_INFLATION_EIA_ONLY_PC_RESULT_V1',
    status:'BLOCKED',code:'EIAONE_NOT_STARTED',sourceSha:SOURCE_SHA,
    provider:'EIA',maxProviderRequests:2,coreWrites:0,dbWrites:0,
    d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')stop('EIAONE_WINDOWS_ONLY');
    const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
    const req=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.win32.isAbsolute(env.GITHUB_WORKSPACE))
      stop('EIAONE_WORKSPACE_DENIED');
    const workspace=safeDir(env.GITHUB_WORKSPACE);
    verifyApproval(workspace);
    const source=verifySource(workspace);
    regular(NODE,200000000);safeDir(WRITER);verifyEiaKey();
    if(!fs.existsSync(MARKER_ROOT))fs.mkdirSync(MARKER_ROOT);
    safeDir(MARKER_ROOT);
    const marker=path.join(MARKER_ROOT,'ONCE_STARTED.json');
    try{fs.writeFileSync(marker,JSON.stringify({requestId:req.requestId,
      sourceSha:SOURCE_SHA,at:new Date().toISOString()}),{flag:'wx'})}
    catch(e){if(e?.code==='EEXIST')stop('EIAONE_ALREADY_ATTEMPTED');throw e}
    const child=spawnSync(NODE,[source],{cwd:path.dirname(source),
      env:childEnv(env),encoding:'utf8',windowsHide:true,shell:false,
      timeout:120000,maxBuffer:8192});
    if(child.error||child.signal){
      report.status='STATE_UNKNOWN';report.code='EIAONE_CHILD_TERMINATION_UNKNOWN';
    }else if(child.status!==0){
      let failed;try{failed=JSON.parse(child.stdout.trim())}catch{}
      report.status=failed?.status==='BLOCKED'?'BLOCKED':'RUNTIME_FAILED';
      report.code=typeof failed?.code==='string'&&
        /^(?:EIAONE_|EIA_|PROVIDER_|PRIVATE_|EXISTING_|PC_|APPROVED_)[A-Z0-9_]{2,80}$/.test(failed.code)?
        failed.code:'EIAONE_CHILD_EXIT_NONZERO';
      report.providerAttempts=Number.isInteger(failed?.providerAttempts)&&
        failed.providerAttempts>=0&&failed.providerAttempts<=2?failed.providerAttempts:null;
    }else{
      let output;try{output=JSON.parse(child.stdout.trim())}catch{stop('EIAONE_CHILD_JSON_INVALID')}
      validateChildResult(output);
      report={...report,status:'PASS',code:output.code,
        requestId:req.requestId,counts:output.counts,latest:output.latest,
        fileSha256:output.fileSha256,sourceStoredAt:output.sourceStoredAt??null};
    }
  }catch(e){report.code=cleanFailure(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),
    JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{process.stderr.write('EIAONE_RESULT_SAVE_DENIED\n')}
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} SERIES=${Object.keys(report.latest??{}).length}\n`);
  if(report.status!=='PASS')process.exitCode=1;
}
export async function upload(env=process.env,fetcher=fetch){
  const file=path.join(env.GITHUB_WORKSPACE,RESULT);
  if(!fs.existsSync(file))return;
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(!env.GITHUB_TOKEN||env.GITHUB_REPOSITORY!==CONTROL_REPO||
    !Number.isInteger(event.issue?.number))return;
  const body=`Inflation EIA industrial US PC-private collection: **${report.status}** (${report.code})\n\n`+
    '```json\n'+JSON.stringify(report,null,2)+'\n```';
  const response=await fetcher(
    `https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,{
      method:'POST',headers:{accept:'application/vnd.github+json',
        authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
        'x-github-api-version':'2022-11-28'},body:JSON.stringify({body}),
    });
  if(!response.ok)throw Error('EIAONE_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();
  else if(process.argv.length===2)execute();
  else throw Error('EIAONE_UNEXPECTED_ARGUMENTS');
}
