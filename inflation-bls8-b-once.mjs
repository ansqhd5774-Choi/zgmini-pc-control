// Fixed B-grade private self-hosted PC collection admission for BLS PPI 8 series.
// No arbitrary command, site publication, Core, D1, DB, scheduler, or credential output.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_SHA='17e176454dcf62d5096981b4e2d7f2d112232605';
export const TITLE='pc-inflation-bls8-approved-once';
export const RESULT='INFLATION_BLS8_RESULT.json';
export const APPROVAL='INFLATION_BLS8_B_APPROVAL.json';
export const WRITER=String.raw`E:\ZGmini\data\pc-writer`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
// PC inventory verified the writer parent; no separate automation-root assumption.
export const MARKER_ROOT=String.raw`E:\ZGmini\data\pc-writer\inflation-bls8-once-guard`;
export const SCRIPT='scripts/pc-writer/inflation-bls8-once.mjs';
export const SOURCE_FILE_HASHES=Object.freeze({
  [SCRIPT]:'3495bc11056d2fbd410122d878a4991e917f35782d542d4c10c91411e448f298',
  'scripts/inflation-causal-bls8.mjs':'061524721b92aa72d3bf8e63baf96b3335a0a1822ad12449e8d0006e776f59c9',
});
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST_ID=new RegExp(`^pc-inflation-bls8-${UUID}$`);
const CHAT_ID=new RegExp(`^chat-${UUID}$`);
const SHA=/^[0-9a-f]{64}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Error(code)};
function failCode(e){return /^BLS8_[A-Z0-9_]{1,70}$/.test(String(e?.message))?e.message:'BLS8_UNEXPECTED_STOP'}
function regular(file,max){
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)stop('BLS8_FILE_SHAPE_DENIED');
  return fs.readFileSync(file);
}
function safeDir(dir){
  const st=fs.lstatSync(dir);
  if(!st.isDirectory()||st.isSymbolicLink()||
     path.win32.normalize(fs.realpathSync.native(dir)).toLowerCase()!==
       path.win32.normalize(dir).toLowerCase())stop('BLS8_PATH_REDIRECT_DENIED');
  return dir;
}
export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
     env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
     event?.action!=='opened'||event?.repository?.private!==true||
     event?.issue?.user?.login!=='ansqhd5774-Choi'||event?.issue?.title!==TITLE)
    stop('BLS8_ISSUE_DENIED');
  let req;try{req=JSON.parse(event.issue.body);}catch{stop('BLS8_REQUEST_JSON_INVALID')}
  if(!req||typeof req!=='object'||Array.isArray(req)||
    Object.keys(req).sort().join('|')!==['chatId','operation','requestId','schema','sourceSha'].sort().join('|')||
    req.schema!=='ZGMINI_INFLATION_BLS8_ONCE_V1'||
    req.operation!=='collect-bls8-private-once'||req.sourceSha!==SOURCE_SHA||
    !REQUEST_ID.test(req.requestId)||!CHAT_ID.test(req.chatId))stop('BLS8_REQUEST_DENIED');
  return req;
}
export function verifyApproval(workspace){
  const c=JSON.parse(regular(path.join(workspace,'control',APPROVAL),5000).toString('utf8'));
  if(c.schema!=='ZGMINI_INFLATION_BLS8_B_APPROVAL_V1'||
     c.scope!=='BLS8_PC_PRIVATE_ONCE'||c.sourceRepository!==SOURCE_REPO||
     c.sourceSha!==SOURCE_SHA||c.writerHome!==WRITER||
     c.outputRelative!=='inflation-causal-r1/bls-ppi8.json'||
     c.maxProviderRequests!==1||c.maxAutomaticRetries!==0||
     c.allowCoreWrites!==false||c.allowDbWrites!==false||
     c.allowD1Writes!==false||c.allowSchedulerChanges!==false||
     c.allowPublicRawData!==false||
     JSON.stringify(c.sourceFileHashes)!==JSON.stringify(SOURCE_FILE_HASHES))
    stop('BLS8_APPROVAL_DENIED');
  return c;
}
export function verifySource(workspace,{gitPath}={}){
  const root=safeDir(path.join(workspace,'source'));
  const git=gitPath??[
    String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files (x86)\Git\cmd\git.exe`,
  ].find(x=>fs.existsSync(x));
  if(!git)stop('BLS8_GIT_UNAVAILABLE');
  const actual=execFileSync(git,['-c','core.fsmonitor=false','-C',root,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024,
    stdio:['ignore','pipe','ignore']}).trim();
  if(actual!==SOURCE_SHA)stop('BLS8_SOURCE_SHA_DENIED');
  for(const [relative,expected] of Object.entries(SOURCE_FILE_HASHES)){
    if(!SHA.test(expected))stop('BLS8_MANIFEST_HASH_INVALID');
    const file=path.join(root,...relative.split('/'));
    if(hash(regular(file,300000))!==expected)stop('BLS8_SOURCE_FILE_HASH_DENIED');
  }
  return path.join(root,...SCRIPT.split('/'));
}
function verifyProviderKey(){
  const data=regular(path.join(WRITER,'providers.env'),100000).toString('utf8');
  const parsed=parseEnv(data);
  if(!String(parsed?.BLS_API_KEY||parsed?.BLS_REGISTRATION_KEY||'').trim())
    stop('BLS8_REGISTERED_KEY_NOT_CONFIGURED');
}
function childEnv(env){
  const safe=Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec',
    'APPDATA','LOCALAPPDATA','TEMP','TMP'].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
  return {...safe,ZGMINI_PC_HOME:WRITER};
}
export function validateChildResult(output){
  if(output?.status!=='PASS'||!['BLS8_SAVED_READBACK','BLS8_PREVIOUS_VALID_UNCHANGED'].includes(output.code)||
    output.ids!==8||output.providerCalls!==1||output.coreWrites!==0||
    output.dbWrites!==0||output.d1Writes!==0||output.schedulerWrites!==0||
    !output.latest||!output.counts||Object.keys(output.latest).length!==8||
    Object.keys(output.counts).length!==8||
    Object.values(output.latest).some(x=>!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(x))||
    Object.values(output.counts).some(x=>!Number.isInteger(x)||x<1))
      stop('BLS8_CHILD_RESULT_CONTRACT_DENIED');
  return output;
}
export function execute(env=process.env){
  let report={schema:'ZGMINI_INFLATION_BLS8_PC_RESULT_V1',status:'BLOCKED',
    code:'BLS8_NOT_STARTED',sourceSha:SOURCE_SHA,provider:'BLS',
    maxProviderRequests:1,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')stop('BLS8_WINDOWS_ONLY');
    const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
    const req=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.win32.isAbsolute(env.GITHUB_WORKSPACE))
      stop('BLS8_WORKSPACE_DENIED');
    const workspace=safeDir(env.GITHUB_WORKSPACE);
    verifyApproval(workspace);
    const source=verifySource(workspace);
    regular(NODE,200000000);
    safeDir(WRITER);
    verifyProviderKey();
    if(!fs.existsSync(MARKER_ROOT))fs.mkdirSync(MARKER_ROOT);
    safeDir(MARKER_ROOT);
    const marker=path.join(MARKER_ROOT,'ONCE_STARTED.json');
    try{fs.writeFileSync(marker,JSON.stringify({requestId:req.requestId,sourceSha:SOURCE_SHA,
      at:new Date().toISOString()}),{flag:'wx'});}
    catch(e){if(e?.code==='EEXIST')stop('BLS8_ALREADY_ATTEMPTED');throw e;}
    const child=spawnSync(NODE,[source],{cwd:path.dirname(source),env:childEnv(env),
      encoding:'utf8',windowsHide:true,shell:false,timeout:90000,maxBuffer:8192});
    if(child.error||child.signal){report.status='STATE_UNKNOWN';report.code='BLS8_CHILD_TERMINATION_UNKNOWN';}
    else if(child.status!==0){
      let failed;try{failed=JSON.parse(child.stdout.trim());}catch{}
      report.status=failed?.status==='BLOCKED'?'BLOCKED':'RUNTIME_FAILED';
      report.code=typeof failed?.code==='string'&&
        /^(?:BLS8_|BLS_|LOCAL_|EXISTING_|PROVIDER_|APPROVED_)[A-Z0-9_]{2,70}$/.test(failed.code)?
        failed.code:'BLS8_CHILD_EXIT_NONZERO';
      report.providerAttempts=Number.isInteger(failed?.providerAttempts)&&failed.providerAttempts>=0&&failed.providerAttempts<=1?
        failed.providerAttempts:null;
    }
    else{
      let output;try{output=JSON.parse(child.stdout.trim())}catch{stop('BLS8_CHILD_JSON_INVALID')}
      validateChildResult(output);
      report={...report,status:'PASS',code:output.code,storedAt:output.sourceStoredAt??null,
        latest:output.latest,counts:output.counts,fileSha256:output.fileSha256??null,
        requestId:req.requestId};
    }
  }catch(e){report.code=failCode(e)}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(report)+'\n',{flag:'wx'});}
  catch{process.stderr.write('BLS8_RESULT_SAVE_DENIED\n')}
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
  const body=`Inflation BLS PPI8 PC-private collection: **${report.status}** (${report.code})\n\n`+
    '```json\n'+JSON.stringify(report,null,2)+'\n```';
  const response=await fetcher(`https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!response.ok)throw Error('BLS8_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();
  else if(process.argv.length===2)execute();
  else throw Error('BLS8_UNEXPECTED_ARGUMENTS');
}
