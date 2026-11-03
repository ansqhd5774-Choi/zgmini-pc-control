// Owner-approved B one-shot to publish sanitized December HTML using saved PC data.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const SOURCE_SHA='83b9b59301e4a2a90511cdc0250cc9a88598e9c5';
const SCRIPT_HASH='7992075d1aea2d8a4f5ccc5e288c9e11181ae0ebc7facb4919560f95ab6c0dc8';
const TITLE='pc-er1-dec31-html-publish-v2-one-shot';
const LABEL='pc-er1-approved';
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const ONCE=String.raw`E:\ZGmini\automation\er1-dec31-html-publish-v2`;
const SCRIPT=path.join('scripts','pc-writer','market-calendar-dec31-publish.mjs');
const APPROVAL='ER1_DEC31_HTML_PUBLISH_V2_B_APPROVAL.json';
const RESULT='ER1_DEC31_HTML_PUBLISH_V2_RESULT.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Error(code)};
const safeCode=e=>/^DEC31_PUBLISH_[A-Z0-9_]+$/.test(e?.message??'')?
 e.message:'DEC31_PUBLISH_ENTRY_UNEXPECTED_STOP';

export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==TITLE||!event.issue.labels?.some(x=>x.name===LABEL))
  stop('DEC31_PUBLISH_ISSUE_NOT_APPROVED');
 let request;try{request=JSON.parse(event.issue.body)}catch{stop('DEC31_PUBLISH_REQUEST_JSON_STOP')}
 if(!request||Object.keys(request).sort().join('|')!==
   ['schema','operation','requestId','chatId','sourceSha','from','through'].sort().join('|')||
   request.schema!=='ZGMINI_ER1_DEC31_HTML_PUBLISH_V2'||
   request.operation!=='publish-saved-december-2026-html-only'||
   request.sourceSha!==SOURCE_SHA||
   request.from!=='2026-12-01'||request.through!=='2026-12-31'||
   !/^pc-dec31-[0-9a-f-]{36}$/.test(request.requestId)||
   !/^chat-[0-9a-f-]{36}$/.test(request.chatId))
  stop('DEC31_PUBLISH_REQUEST_CONTRACT_STOP');
 return request;
}
const safeEnv=env=>Object.fromEntries([
 'SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP'
].filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));

function approvedFile(workspace){
 const f=path.join(workspace,'control',APPROVAL);
 const stat=fs.lstatSync(f);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)
  stop('DEC31_PUBLISH_APPROVAL_FILE_STOP');
 const p=JSON.parse(fs.readFileSync(f,'utf8'));
 if(p.schema!=='ZGMINI_ER1_DEC31_HTML_PUBLISH_APPROVAL_V2'||
   p.scope!=='PC_SAVED_DEC2026_HTML_ONLY_D1_KEY_ONE_SHOT'||
   p.sourceRepository!=='ansqhd5774-Choi/zgmini'||
   p.sourceSha!==SOURCE_SHA||p.sourceFile!==
    'scripts/pc-writer/market-calendar-dec31-publish.mjs'||
   p.sourceFileSha256!==SCRIPT_HASH||p.expectedEvents!==38||
   p.outputKey!=='market-calendar:earnings-dec2026-display-html'||
   p.allowProviderCalls!==false||p.allowExistingFeedWrites!==false||
   p.allowRawVendorPublic!==false||p.allowFormulaChanges!==false||
   p.allowSchedulerChanges!==false||p.allowDirectDeployment!==false)
  stop('DEC31_PUBLISH_APPROVAL_SCOPE_STOP');
}
function verifiedSource(workspace){
 const root=path.join(workspace,'source');
 const sha=execFileSync('git',['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  stdio:['ignore','pipe','ignore']}).trim();
 if(sha!==SOURCE_SHA)stop('DEC31_PUBLISH_SOURCE_SHA_STOP');
 const f=path.join(root,SCRIPT),stat=fs.lstatSync(f);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>20000||
  hash(fs.readFileSync(f))!==SCRIPT_HASH)
  stop('DEC31_PUBLISH_SOURCE_HASH_STOP');
 return f;
}

export function execute({env=process.env}={}){
 let result={schema:'ZGMINI_DEC31_HTML_PUBLISH_V1',status:'BLOCKED',
  code:'DEC31_PUBLISH_NOT_STARTED',providerCalls:0,existingFeedWrites:0,
  scoreFormulaChanges:0,d1Writes:0};
 try{
  if(process.platform!=='win32')stop('DEC31_PUBLISH_WINDOWS_ONLY');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateRequest(event,env);
  if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
   stop('DEC31_PUBLISH_WORKSPACE_STOP');
  approvedFile(env.GITHUB_WORKSPACE);
  const f=verifiedSource(env.GITHUB_WORKSPACE);
  if(!fs.existsSync(NODE))stop('DEC31_PUBLISH_NODE_MISSING');
  fs.mkdirSync(ONCE,{recursive:true});
  const marker=path.join(ONCE,'ONE_SHOT_STARTED.json');
  let fd;try{fd=fs.openSync(marker,'wx')}catch{stop('DEC31_PUBLISH_ALREADY_ATTEMPTED')}
  try{fs.writeFileSync(fd,JSON.stringify({requestId:request.requestId,at:new Date().toISOString(),sourceSha:SOURCE_SHA}))}
  finally{fs.closeSync(fd)}
  const output=path.join(env.GITHUB_WORKSPACE,'dec31-html-child-report.json');
  const child=spawnSync(NODE,[f,output],{cwd:path.dirname(f),windowsHide:true,
   timeout:790000,encoding:'utf8',maxBuffer:8192,env:safeEnv(env),shell:false});
  if(fs.existsSync(output)){
   const v=JSON.parse(fs.readFileSync(output,'utf8'));
   if(v?.schema==='ZGMINI_DEC31_HTML_PUBLISH_V1')result={...v,requestId:request.requestId};
  }
  if(child.error||child.signal||!fs.existsSync(output)){
   result.status='STATE_UNKNOWN';result.code='DEC31_PUBLISH_CHILD_RESULT_UNKNOWN';
  }else if(child.status!==0&&result.status==='PASS'){
   result.status='STATE_UNKNOWN';result.code='DEC31_PUBLISH_CHILD_EXIT_MISMATCH';
  }
 }catch(e){result.code=safeCode(e)}
 try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(result)+'\n',{flag:'wx'})}
 catch{process.stderr.write('DEC31_PUBLISH_REPORT_SAVE_STOP\n')}
 console.log('DEC31_HTML_PUBLISH='+result.status+' CODE='+result.code+' COUNT='+(result.eventCount??0));
 if(result.status!=='PASS')process.exitCode=1;
}

export async function upload({env=process.env,fetcher=fetch}={}){
 const f=path.join(env.GITHUB_WORKSPACE,RESULT);
 if(!fs.existsSync(f))return;
 const report=JSON.parse(fs.readFileSync(f,'utf8'));
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 if(!env.GITHUB_TOKEN||!Number.isInteger(event.issue.number)||env.GITHUB_REPOSITORY!==REPO)return;
 const body='ER1 December 2026 HTML-only D1 publish: **'+report.status+
  '** ('+report.code+')\n\n```json\n'+JSON.stringify(report,null,2)+'\n```';
 const response=await fetcher(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
   'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
 if(!response.ok)throw Error('DEC31_PUBLISH_UPLOAD_STOP');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload')await upload();else execute();
}
