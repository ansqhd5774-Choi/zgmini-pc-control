#!/usr/bin/env node
// One-shot A-grade READ ONLY diagnostic of the exact cscript //NoLogo probe.
// Never invoke the R17 B installer or modify source, config, Task, DB, or Core.
// Run --diagnose without a GitHub token; run --report with token to comment.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const PROBE_SHA='7050dc256e8165827e5a4296dc3d3e2d18408c94508bdf8b51975f5499c95a13';
const FIXTURE_SHA='22261ee72d757c9372ed9e0b806e27e4ad65ad9c1d5e274fa82f8e914755fa1d';
const ID=/^pc-r17-probe-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CHAT=/^chat-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const MAGIC='R17_B_WSH_OK';
const MAX=16_384;
const SCHEMA='ZGMINI_R17_B_PROBE_DIAG_RESULT_V1';
const ALLOWED_CODES=new Set(['R17_B_DIAG_SETUP_STOP','R17_B_DIAG_EVENT_STOP',
  'R17_B_DIAG_PATH_STOP','R17_B_DIAG_HASH_STOP','R17_B_DIAG_RUNTIME_STOP',
  'R17_B_DIAG_RESULT_UNVERIFIED']);
const ENCODINGS=new Set(['UTF8_BOM','UTF16LE_BOM','UTF16BE_BOM',
  'UTF16LE_LIKELY','UTF16BE_LIKELY','UTF8_OR_ANSI','EMPTY']);
const SHAPES=new Set(['EXPECTED_SUCCESS','EXPECTED_PROBE_STOP','JSON_OTHER',
  'JSON_EXTRA_TEXT','NOT_JSON','EMPTY']);
const EXEC_STATES=new Set(['EXIT_ZERO','EXIT_NONZERO','SPAWN_ERROR','TIMEOUT','NO_STATUS']);
const simpleObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exactKeys=(x,keys)=>simpleObject(x)&&Object.keys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k));
function assert(ok,code){if(!ok){const e=new Error(code);e.code=code;throw e;}}
const sha256=b=>createHash('sha256').update(b).digest('hex');

export function authorizeDiagnostic(event,env){
  assert(env?.GITHUB_REPOSITORY===REPO&&env?.GITHUB_EVENT_NAME==='issues'&&
    env?.GITHUB_EVENT_ACTION==='opened'&&env?.GITHUB_ACTOR===OWNER&&
    env?.GITHUB_RUN_ATTEMPT==='1'&&
    /^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??'')&&
    /^\d{1,18}$/.test(env?.GITHUB_RUN_ID??'')&&
    SHA40.test(env?.GITHUB_SHA??'')&&env.GITHUB_SHA===env?.R17_CONTROL_SHA,
  'R17_B_DIAG_EVENT_STOP');
  const issue=event?.issue;
  assert(event?.action==='opened'&&event?.repository?.private===true&&
    event?.repository?.full_name===REPO&&event?.sender?.login===OWNER&&
    issue?.user?.login===OWNER&&
    issue?.title==='pc-r17-writer-probe-diagnostic'&&
    issue?.labels?.some(l=>l?.name==='pc-r17-writer-b-probe-diag')&&
    !issue?.pull_request&&Number.isSafeInteger(issue?.number)&&issue.number>0&&
    typeof issue?.body==='string'&&Buffer.byteLength(issue.body,'utf8')<=4096,
  'R17_B_DIAG_EVENT_STOP');
  let body;
  try{body=JSON.parse(issue.body);}catch{assert(false,'R17_B_DIAG_EVENT_STOP');}
  assert(exactKeys(body,['schema','requestId','chatId','operation','controlRepository',
    'expectedProbeSha256','expectedFixtureSha256'])&&
    body.schema==='ZGMINI_R17_B_PROBE_DIAG_REQUEST_V1'&&
    ID.test(body.requestId??'')&&CHAT.test(body.chatId??'')&&
    body.operation==='r17-probe-diagnostic-readonly-once'&&
    body.controlRepository===REPO&&body.expectedProbeSha256===PROBE_SHA&&
    body.expectedFixtureSha256===FIXTURE_SHA,
  'R17_B_DIAG_EVENT_STOP');
  return body;
}

function bytesOf(raw){return Buffer.isBuffer(raw)?raw:Buffer.alloc(0);}
function encodingOf(bytes){
  if(bytes.length===0)return 'EMPTY';
  if(bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)return 'UTF8_BOM';
  if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return 'UTF16LE_BOM';
  if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)return 'UTF16BE_BOM';
  const even=Math.ceil(bytes.length/2),odd=Math.floor(bytes.length/2);
  let oddZeros=0,evenZeros=0;
  for(let i=0;i<bytes.length;i++)if(bytes[i]===0){if(i%2)oddZeros++;else evenZeros++;}
  if(odd>=3&&oddZeros/odd>0.3&&evenZeros/even<0.1)return 'UTF16LE_LIKELY';
  if(even>=3&&evenZeros/even>0.3&&oddZeros/odd<0.1)return 'UTF16BE_LIKELY';
  return 'UTF8_OR_ANSI';
}
function parseKind(text){
  if(!text.trim())return 'EMPTY';
  try{
    const value=JSON.parse(text.trim());
    if(simpleObject(value)&&value.ok===false&&value.code==='R17_B_WINDOWS_PROBE_STOP')
      return 'EXPECTED_PROBE_STOP';
    if(exactKeys(value,['ok','enabled','state','instances','relatedProcesses',
      'unknownProcessLines'])&&value.ok===true&&typeof value.enabled==='boolean'&&
      Number.isInteger(value.state)&&Number.isInteger(value.instances)&&
      value.instances>=0&&Number.isInteger(value.relatedProcesses)&&
      value.relatedProcesses>=0&&Number.isInteger(value.unknownProcessLines)&&
      value.unknownProcessLines>=0)return 'EXPECTED_SUCCESS';
    return 'JSON_OTHER';
  }catch{
    const start=text.indexOf('{'),end=text.lastIndexOf('}');
    if(start>=0&&end>start){
      try{JSON.parse(text.slice(start,end+1));return 'JSON_EXTRA_TEXT';}catch{}
    }
    return 'NOT_JSON';
  }
}
function stdoutFeatures(raw,kind){
  const bytes=bytesOf(raw),encoding=encodingOf(bytes);
  const text=bytes.toString('utf8'); // matches exactly the failed installer decoding path.
  const trimmed=text.trim();
  const nonAscii=Array.from(text).filter(c=>c==='\ufffd').length;
  const bannerObserved=/Windows Script Host|Microsoft \(R\)/i.test(text.slice(0,300));
  const magicUtf8=trimmed===MAGIC;
  const decodedUtf16=encoding==='UTF16LE_BOM'||encoding==='UTF16LE_LIKELY'?
    bytes.subarray(encoding==='UTF16LE_BOM'?2:0).toString('utf16le').trim():'';
  const data={stdoutBytes:bytes.length,
    encodingHint:encoding,
    nulBytes:bytes.reduce((n,v)=>n+(v===0?1:0),0),
    utf8ReplacementCount:nonAscii,
    firstToken:trimmed.startsWith('{')?'JSON_BRACE':
      magicUtf8?'FIXTURE_MAGIC':trimmed?'OTHER':'EMPTY',
    noLogoArgSent:true,bannerObserved,
    shape:kind==='fixture'?(magicUtf8?'FIXTURE_MAGIC_MATCH':
      decodedUtf16===MAGIC?'FIXTURE_UTF16_MATCH':'FIXTURE_MAGIC_MISMATCH'):
      parseKind(text)};
  return data;
}

export function analyzeCscriptResult(result,kind){
  assert(kind==='probe'||kind==='fixture','R17_B_DIAG_RUNTIME_STOP');
  const stdout=bytesOf(result?.stdout),stderr=bytesOf(result?.stderr);
  const status=Number.isSafeInteger(result?.status)&&result.status>=0&&result.status<=32767?
    result.status:null;
  const execState=result?.error?.code==='ETIMEDOUT'?'TIMEOUT':
    result?.error?'SPAWN_ERROR':status===0?'EXIT_ZERO':
    status!==null?'EXIT_NONZERO':'NO_STATUS';
  return {kind,execState,exitCode:status,stderrBytes:stderr.length,
    ...stdoutFeatures(stdout,kind)};
}

function checkedRead(file,root,digest){
  const stat=fs.lstatSync(file);
  assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=MAX,
    'R17_B_DIAG_PATH_STOP');
  const real=fs.realpathSync.native(file);
  const parent=fs.realpathSync.native(root);
  assert(real.toLowerCase().startsWith(parent.toLowerCase()+path.sep),
    'R17_B_DIAG_PATH_STOP');
  assert(sha256(fs.readFileSync(file))===digest,'R17_B_DIAG_HASH_STOP');
}

export function runReadOnlyDiagnostic({event,env,scriptRoot,runCscript}={}){
  const request=authorizeDiagnostic(event,env);
  assert(process.platform==='win32'||typeof runCscript==='function',
    'R17_B_DIAG_RUNTIME_STOP');
  const root=scriptRoot??path.join(env.GITHUB_WORKSPACE??'','r17-control','r17-writer-b');
  const diagRoot=path.join(root,'probe-diag');
  const fixture=path.join(diagRoot,'r17-b-echo-fixture.js');
  const probe=path.join(root,'r17-b-windows-probe.js');
  checkedRead(fixture,diagRoot,FIXTURE_SHA);
  checkedRead(probe,root,PROBE_SHA);
  const executable=path.join(env.SystemRoot??String.raw`C:\Windows`,'System32','cscript.exe');
  if(!runCscript)assert(fs.existsSync(executable),'R17_B_DIAG_RUNTIME_STOP');
  const execute=runCscript??((exe,script)=>spawnSync(exe,['//NoLogo',script],
    {encoding:null,shell:false,windowsHide:true,timeout:20_000,maxBuffer:MAX}));
  const mini=analyzeCscriptResult(execute(executable,fixture),'fixture');
  const original=analyzeCscriptResult(execute(executable,probe),'probe');
  return {schema:SCHEMA,requestId:request.requestId,status:'DIAGNOSTIC_COMPLETE',
    code:'R17_B_DIAG_READONLY',runId:env.GITHUB_RUN_ID,
    fixture:mini,probe:original,sourceWrites:0,taskWrites:0,configWrites:0,
    installReruns:0};
}

function validOne(raw,kind){
  const allowedShape=kind==='fixture'?
    new Set(['FIXTURE_MAGIC_MATCH','FIXTURE_UTF16_MATCH','FIXTURE_MAGIC_MISMATCH']):SHAPES;
  return exactKeys(raw,['kind','execState','exitCode','stderrBytes','stdoutBytes',
    'encodingHint','nulBytes','utf8ReplacementCount','firstToken',
    'noLogoArgSent','bannerObserved','shape'])&&raw.kind===kind&&
    EXEC_STATES.has(raw.execState)&&
    (raw.exitCode===null||(Number.isSafeInteger(raw.exitCode)&&raw.exitCode>=0&&raw.exitCode<=32767))&&
    [raw.stderrBytes,raw.stdoutBytes,raw.nulBytes,raw.utf8ReplacementCount]
      .every(n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX)&&
    ENCODINGS.has(raw.encodingHint)&&
    ['JSON_BRACE','FIXTURE_MAGIC','OTHER','EMPTY'].includes(raw.firstToken)&&
    raw.noLogoArgSent===true&&typeof raw.bannerObserved==='boolean'&&
    allowedShape.has(raw.shape);
}

export function sanitizeDiagnosticResult(raw,requestId,runId){
  const base={schema:SCHEMA,requestId,status:'STATE_UNKNOWN',
    code:'R17_B_DIAG_RESULT_UNVERIFIED',
    runId:/^\d{1,18}$/.test(runId??'')?runId:null,
    sourceWrites:0,taskWrites:0,configWrites:0,installReruns:0};
  if(!simpleObject(raw)||raw.requestId!==requestId)return base;
  if(raw.status==='DIAGNOSTIC_SETUP_STOP'&&
    exactKeys(raw,['schema','requestId','status','code','runId',
      'sourceWrites','taskWrites','configWrites','installReruns'])&&
    raw.schema===SCHEMA&&ALLOWED_CODES.has(raw.code))
    return {...base,status:'DIAGNOSTIC_SETUP_STOP',code:raw.code};
  if(!exactKeys(raw,['schema','requestId','status','code','runId',
    'fixture','probe','sourceWrites','taskWrites','configWrites','installReruns'])||
    raw.schema!==SCHEMA||raw.status!=='DIAGNOSTIC_COMPLETE'||
    raw.code!=='R17_B_DIAG_READONLY'||raw.runId!==runId||
    !validOne(raw.fixture,'fixture')||!validOne(raw.probe,'probe')||
    raw.sourceWrites!==0||raw.taskWrites!==0||raw.configWrites!==0||
    raw.installReruns!==0)return base;
  return {...base,status:raw.status,code:raw.code,
    fixture:{...raw.fixture},probe:{...raw.probe}};
}

export function readSafeResult(file){
  try{const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size===0||stat.size>MAX)return '{}';
    return fs.readFileSync(file,'utf8');
  }catch{return '{}';}
}

export async function commentDiagnostic({event,env,readResult,apiFetch=fetch}={}){
  const request=authorizeDiagnostic(event,env);
  assert(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
    'R17_B_DIAG_EVENT_STOP');
  let raw;
  try{const content=readResult();raw=typeof content==='string'&&
    Buffer.byteLength(content,'utf8')<=MAX?JSON.parse(content):null;}catch{raw=null;}
  const result=sanitizeDiagnosticResult(raw,request.requestId,env.GITHUB_RUN_ID);
  const json=JSON.stringify(result,null,2);
  const body=`<!-- zgmini-r17-probe-diag:${request.requestId} -->\n`+
    `R17 Windows probe read-only diagnostic: **${result.status}** (${result.code})\n`+
    'PC_SOURCE_WRITES=0 TASK_WRITES=0 CONFIG_WRITES=0 INSTALL_RERUNS=0\n'+
    'NEXT=READBACK_AND_FIX_SEPARATELY_NO_AUTO_B_RETRY\n\n'+
    '```json\n'+json+'\n```';
  const response=await apiFetch(
    `https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,{
      method:'POST',headers:{accept:'application/vnd.github+json',
        authorization:`Bearer ${env.GITHUB_TOKEN}`,
        'content-type':'application/json','x-github-api-version':'2022-11-28',
        'user-agent':'zgmini-r17-b-probe-readonly'},body:JSON.stringify({body}),
    });
  assert(response?.status===201,'R17_B_DIAG_RUNTIME_STOP');
  return {status:result.status,code:result.code};
}

async function main(){
  const mode=process.argv[2];
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    if(mode==='--diagnose'){
      const result=runReadOnlyDiagnostic({event,env});
      process.stdout.write(JSON.stringify(result)+'\n');
    }else if(mode==='--report'){
      const result=await commentDiagnostic({event,env,
        readResult:()=>readSafeResult(path.join(env.RUNNER_TEMP??'',
          'r17-b-probe-diag-result.json'))});
      process.stdout.write(`R17_B_DIAG_COMMENT ${result.status}\n`);
    }else throw new Error('R17_B_DIAG_RUNTIME_STOP');
  }catch(error){
    const code=ALLOWED_CODES.has(error?.code)?error.code:'R17_B_DIAG_SETUP_STOP';
    if(mode==='--diagnose'){
      let requestId=null;try{
        const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
        const body=JSON.parse(event.issue.body);
        if(ID.test(body.requestId??''))requestId=body.requestId;
      }catch{}
      const result={schema:SCHEMA,requestId,status:'DIAGNOSTIC_SETUP_STOP',
        code,runId:process.env.GITHUB_RUN_ID??null,sourceWrites:0,
        taskWrites:0,configWrites:0,installReruns:0};
      process.stdout.write(JSON.stringify(result)+'\n');
    }else process.stderr.write('R17_B_DIAG_REPORT_UNVERIFIED\n');
    process.exitCode=1;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await main();
