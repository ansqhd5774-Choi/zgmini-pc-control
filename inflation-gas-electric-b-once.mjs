// Fixed B-grade private PC admission for natural gas #3 and industrial electricity #4.
// Research raw inputs only. No arbitrary process, Core, DB, D1, schedule, or publication.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_SHA='de262f47003e3c32fb685cf2c9b1e3edb1ec1b19';
export const TITLE='pc-inflation-gas-electric-approved-once';
export const RESULT='INFLATION_GAS_ELECTRIC_RESULT.json';
export const APPROVAL='INFLATION_GAS_ELECTRIC_B_APPROVAL.json';
export const WRITER=String.raw`E:\ZGmini\data\pc-writer`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
export const MARKER_ROOT=String.raw`E:\ZGmini\data\pc-writer\inflation-gas-electric-once-guard`;
export const SCRIPT='scripts/pc-writer/inflation-gas-electric-once.mjs';
export const SOURCE_FILE_HASHES=Object.freeze({
  [SCRIPT]:'abee3b4876884a0e0a632f08888a6708cc430c59c559e59437014b8b486508dd',
  'scripts/inflation-causal-gas-electric.mjs':'3f729b8637337f86088d85f3e37c7921477681066c05422a6bcebd91d6a2c541',
});
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST_ID=new RegExp(`^pc-inflation-gas-electric-${UUID}$`);
const CHAT_ID=new RegExp(`^chat-${UUID}$`);
const SHA=/^[0-9a-f]{64}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Error(code)};
function failCode(error){
  return /^GASEL_[A-Z0-9_]{2,75}$/.test(String(error?.message))?
    error.message:'GASEL_UNEXPECTED_STOP';
}
function regular(file,max){
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)
    stop('GASEL_FILE_SHAPE_DENIED');
  return fs.readFileSync(file);
}
function safeDir(directory){
  const stat=fs.lstatSync(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink()||
    path.win32.normalize(fs.realpathSync.native(directory)).toLowerCase()!==
      path.win32.normalize(directory).toLowerCase())
    stop('GASEL_PATH_REDIRECT_DENIED');
  return directory;
}
export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.repository?.private!==true||
    event?.issue?.user?.login!=='ansqhd5774-Choi'||event?.issue?.title!==TITLE)
    stop('GASEL_ISSUE_DENIED');
  let request;
  try{request=JSON.parse(event.issue.body)}catch{stop('GASEL_REQUEST_JSON_INVALID')}
  if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).sort().join('|')!==
      ['chatId','operation','requestId','schema','sourceSha'].sort().join('|')||
    request.schema!=='ZGMINI_INFLATION_GAS_ELECTRIC_ONCE_V1'||
    request.operation!=='collect-gas-electric-private-once'||
    request.sourceSha!==SOURCE_SHA||
    !REQUEST_ID.test(request.requestId)||!CHAT_ID.test(request.chatId))
    stop('GASEL_REQUEST_DENIED');
  return request;
}
export function verifyApproval(workspace){
  const approval=JSON.parse(regular(path.join(workspace,'control',APPROVAL),5000).toString('utf8'));
  if(approval.schema!=='ZGMINI_INFLATION_GAS_ELECTRIC_B_APPROVAL_V1'||
    approval.scope!=='GAS_ELECTRIC_PC_PRIVATE_ONCE'||
    approval.sourceRepository!==SOURCE_REPO||approval.sourceSha!==SOURCE_SHA||
    approval.writerHome!==WRITER||
    JSON.stringify(approval.outputRelatives)!==
      JSON.stringify(['inflation-causal-r1/gas-dhhngsp.json',
        'inflation-causal-r1/electricity-industrial-eia.json'])||
    approval.maxProviderRequests!==3||approval.maxAutomaticRetries!==0||
    approval.allowCoreWrites!==false||approval.allowDbWrites!==false||
    approval.allowD1Writes!==false||approval.allowSchedulerChanges!==false||
    approval.allowPublicRawData!==false||
    JSON.stringify(approval.sourceFileHashes)!==JSON.stringify(SOURCE_FILE_HASHES))
    stop('GASEL_APPROVAL_DENIED');
  return approval;
}
export function verifySource(workspace,{gitPath}={}){
  if(!SHA.test(SOURCE_SHA))stop('GASEL_SOURCE_UNPINNED');
  const root=safeDir(path.join(workspace,'source'));
  const git=gitPath??[
    String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files (x86)\Git\cmd\git.exe`,
  ].find(file=>fs.existsSync(file));
  if(!git)stop('GASEL_GIT_UNAVAILABLE');
  const actual=execFileSync(git,['-c','core.fsmonitor=false','-C',root,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024,
    stdio:['ignore','pipe','ignore']}).trim();
  if(actual!==SOURCE_SHA)stop('GASEL_SOURCE_SHA_DENIED');
  for(const [relative,expected] of Object.entries(SOURCE_FILE_HASHES)){
    if(!SHA.test(expected))stop('GASEL_FILE_HASH_UNPINNED');
    const file=path.join(root,...relative.split('/'));
    if(hash(regular(file,350000))!==expected)stop('GASEL_SOURCE_FILE_HASH_DENIED');
  }
  return path.join(root,...SCRIPT.split('/'));
}
export function configuredProviderKeys(variables){
  return {
    fred:Boolean(String(variables?.FRED_API_KEY||variables?.FRED_KEY||'').trim()),
    eia:Boolean(String(variables?.EIA_API_KEY||variables?.EIA_KEY||'').trim()),
  };
}
function verifyProviderKeys(){
  const data=regular(path.join(WRITER,'providers.env'),100000).toString('utf8');
  const variables=parseEnv(data);
  const keys=configuredProviderKeys(variables);
  if(!keys.fred&&!keys.eia)stop('GASEL_NO_PROVIDER_KEY_CONFIGURED');
  // One absent key is NON_BLOCKING: child captures the other provider and returns PARTIAL.
}
function childEnv(env){
  const allowed=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec',
    'APPDATA','LOCALAPPDATA','TEMP','TMP'];
  const safe=Object.fromEntries(allowed.filter(name=>typeof env[name]==='string')
    .map(name=>[name,env[name]]));
  return {...safe,ZGMINI_PC_HOME:WRITER};
}
export function validateChildResult(output){
  const ids=['DHHNGSP','EIA_INDUSTRIAL_US'];
  if(output?.status!=='PASS'||
    !['GAS_ELECTRIC_SAVED_READBACK','GAS_ELECTRIC_PREVIOUS_VALID_UNCHANGED'].includes(output.code)||
    output.ids!==2||output.providerCalls!==3||
    output.coreWrites!==0||output.dbWrites!==0||output.d1Writes!==0||
    output.schedulerWrites!==0||
    !output.latest||!output.counts||!output.fileSha256||
    Object.keys(output.latest).sort().join('|')!==ids.sort().join('|')||
    Object.keys(output.counts).sort().join('|')!==ids.sort().join('|')||
    Object.keys(output.fileSha256).sort().join('|')!==ids.sort().join('|')||
    !/^\d{4}-(0[1-9]|1[0-2])-[0-3]\d$/.test(output.latest.DHHNGSP)||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(output.latest.EIA_INDUSTRIAL_US)||
    Object.values(output.counts).some(n=>!Number.isInteger(n)||n<1)||
    Object.values(output.fileSha256).some(v=>v!==null&&!SHA.test(v)))
    stop('GASEL_CHILD_RESULT_CONTRACT_DENIED');
  return output;
}
export function summarizePartialResult(output){
  const ids=['DHHNGSP','EIA_INDUSTRIAL_US'];
  if(output?.status!=='PARTIAL'||output.code!=='GAS_ELECTRIC_PARTIAL_INPUTS'||
    output.coreWrites!==0||output.dbWrites!==0||output.d1Writes!==0||
    output.schedulerWrites!==0||
    !Number.isInteger(output.providerAttempts)||output.providerAttempts<0||
    output.providerAttempts>3||output.providerCalls!==output.providerAttempts||
    !output.latest||!output.counts||!output.fileSha256||!output.failures||
    typeof output.failures!=='object'||Array.isArray(output.failures)||
    Object.keys(output.failures).some(id=>!ids.includes(id))||
    Object.keys(output.failures).some(id=>
      typeof output.failures[id]!=='string'||
      !/^[A-Z0-9_]{3,75}$/.test(output.failures[id]))||
    Object.keys(output.latest).length!==1||
    Object.keys(output.counts).length!==1||
    Object.keys(output.fileSha256).length!==1)
    stop('GASEL_CHILD_PARTIAL_CONTRACT_DENIED');
  const successful=Object.keys(output.latest)[0];
  if(!ids.includes(successful)||
    Object.keys(output.counts)[0]!==successful||
    Object.keys(output.fileSha256)[0]!==successful||
    Object.hasOwn(output.failures,successful)||
    !Object.hasOwn(output.failures,ids.find(id=>id!==successful))||
    !Number.isInteger(output.counts[successful])||output.counts[successful]<1||
    (successful==='DHHNGSP'?
      !/^\d{4}-(0[1-9]|1[0-2])-[0-3]\d$/.test(output.latest[successful]):
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(output.latest[successful]))||
    (output.fileSha256[successful]!==null&&!SHA.test(output.fileSha256[successful])))
    stop('GASEL_CHILD_PARTIAL_CONTRACT_DENIED');
  return {counts:{[successful]:output.counts[successful]},
    latest:{[successful]:output.latest[successful]},
    fileSha256:{[successful]:output.fileSha256[successful]},
    failures:{[ids.find(id=>id!==successful)]:
      output.failures[ids.find(id=>id!==successful)]},
    providerAttempts:output.providerAttempts};
}
export function execute(env=process.env){
  let report={schema:'ZGMINI_INFLATION_GAS_ELECTRIC_PC_RESULT_V1',
    status:'BLOCKED',code:'GASEL_NOT_STARTED',sourceSha:SOURCE_SHA,
    providers:['FRED','EIA'],maxProviderRequests:3,
    coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')stop('GASEL_WINDOWS_ONLY');
    const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
    const req=validateRequest(event,env);
    if(!env.GITHUB_WORKSPACE||!path.win32.isAbsolute(env.GITHUB_WORKSPACE))
      stop('GASEL_WORKSPACE_DENIED');
    const workspace=safeDir(env.GITHUB_WORKSPACE);
    verifyApproval(workspace);
    const source=verifySource(workspace);
    regular(NODE,200000000);
    safeDir(WRITER);
    verifyProviderKeys();
    if(!fs.existsSync(MARKER_ROOT))fs.mkdirSync(MARKER_ROOT);
    safeDir(MARKER_ROOT);
    const marker=path.join(MARKER_ROOT,'ONCE_STARTED.json');
    try{fs.writeFileSync(marker,JSON.stringify({
      requestId:req.requestId,sourceSha:SOURCE_SHA,at:new Date().toISOString()
    }),{flag:'wx'});}
    catch(error){if(error?.code==='EEXIST')stop('GASEL_ALREADY_ATTEMPTED');throw error;}
    const child=spawnSync(NODE,[source],{cwd:path.dirname(source),env:childEnv(env),
      encoding:'utf8',windowsHide:true,shell:false,timeout:150000,maxBuffer:8192});
    if(child.error||child.signal){
      report.status='STATE_UNKNOWN';
      report.code='GASEL_CHILD_TERMINATION_UNKNOWN';
    }else if(child.status!==0){
      let failure;try{failure=JSON.parse(child.stdout.trim())}catch{}
      report.status=['BLOCKED','PARTIAL','RUNTIME_FAILED'].includes(failure?.status)?
        failure.status:'RUNTIME_FAILED';
      report.code=typeof failure?.code==='string'&&
        /^(?:GASEL_|GAS_|EIA_|FRED_|PROVIDER_|PRIVATE_|EXISTING_|PC_|APPROVED_)[A-Z0-9_]{2,75}$/.test(failure.code)?
        failure.code:'GASEL_CHILD_EXIT_NONZERO';
      if(report.status==='PARTIAL'){
        try{
          const partial=summarizePartialResult(failure);
          report={...report,...partial,code:'GAS_ELECTRIC_PARTIAL_INPUTS'};
        }catch{
          report.status='RUNTIME_FAILED';
          report.code='GASEL_CHILD_PARTIAL_CONTRACT_DENIED';
        }
      }else{
        report.providerAttempts=Number.isInteger(failure?.providerAttempts)&&
          failure.providerAttempts>=0&&failure.providerAttempts<=3?
          failure.providerAttempts:null;
      }
    }else{
      let output;try{output=JSON.parse(child.stdout.trim())}catch{
        stop('GASEL_CHILD_JSON_INVALID');
      }
      validateChildResult(output);
      report={...report,status:'PASS',code:output.code,
        requestId:req.requestId,latest:output.latest,counts:output.counts,
        fileSha256:output.fileSha256,sourceStoredAt:output.sourceStoredAt??null};
    }
  }catch(error){report.code=failCode(error);}
  try{
    fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),
      JSON.stringify(report)+'\n',{flag:'wx'});
  }catch{process.stderr.write('GASEL_RESULT_SAVE_DENIED\n')}
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
  const body=`Inflation natural-gas/electricity PC-private collection: **${report.status}** (${report.code})\n\n`+
    '```json\n'+JSON.stringify(report,null,2)+'\n```';
  const response=await fetcher(
    `https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,{
      method:'POST',headers:{accept:'application/vnd.github+json',
        authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
        'x-github-api-version':'2022-11-28'},body:JSON.stringify({body}),
    });
  if(!response.ok)throw Error('GASEL_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();
  else if(process.argv.length===2)execute();
  else throw Error('GASEL_UNEXPECTED_ARGUMENTS');
}
