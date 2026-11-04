// Fixed, read-only, private EIA industrial electricity PC saved-file proof.
// No provider requests, GitHub checkout execution, Core/DB/D1/scheduler writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const SOURCE_SHA='ff04b60fec5d6ece19cd3842eadcbf04965d230b';
export const TITLE='pc-inflation-eia-readback-once';
export const WRITER=String.raw`E:\ZGmini\data\pc-writer`;
export const FILE='inflation-causal-r1/electricity-industrial-eia.json';
export const SCHEMA='ZGMINI_INFLATION_EIA_SAVED_READBACK_V1';
export const REQUEST_SCHEMA='ZGMINI_INFLATION_EIA_READBACK_ONCE_V1';
const SOURCE_VERSION='INFLATION_CAUSAL_GAS_ELECTRIC_R1';
const HASH=/^[a-f0-9]{64}$/;
const MONTH=/^(?:19|20)\d\d-(?:0[1-9]|1[0-2])$/;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQ=new RegExp(`^pc-inflation-eia-readback-${UUID}$`);
const CHAT=new RegExp(`^chat-${UUID}$`);
const stop=code=>{throw Error(code)};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const failure=e=>/^EIAREADBACK_[A-Z0-9_]{2,80}$/.test(String(e?.message))?
  e.message:'EIAREADBACK_UNEXPECTED_STOP';

function safeDir(dir){
  const stat=fs.lstatSync(dir);
  if(!stat.isDirectory()||stat.isSymbolicLink())stop('EIAREADBACK_DIRECTORY_DENIED');
  const canonical=fs.realpathSync.native(dir);
  if(process.platform==='win32'&&
    path.win32.normalize(canonical).toLowerCase()!==path.win32.normalize(dir).toLowerCase())
    stop('EIAREADBACK_DIRECTORY_REDIRECT_DENIED');
  return dir;
}
function regular(file,max=10000000){
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)
    stop('EIAREADBACK_FILE_DENIED');
  return fs.readFileSync(file);
}
function iso(value){
  return typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&
    Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
}
export function resultName(issueNumber){
  if(!Number.isSafeInteger(issueNumber)||issueNumber<1||issueNumber>999999999)
    stop('EIAREADBACK_ISSUE_NUMBER_DENIED');
  return `INFLATION_EIA_READBACK_RESULT_${issueNumber}.json`;
}
export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_ACTOR!==OWNER||
    env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
    event?.action!=='opened'||event?.repository?.private!==true||
    event?.repository?.full_name!==CONTROL_REPO||
    event?.issue?.user?.login!==OWNER||event?.issue?.title!==TITLE)
    stop('EIAREADBACK_ISSUE_DENIED');
  resultName(event.issue.number);
  let request;
  try{request=JSON.parse(event.issue.body)}catch{stop('EIAREADBACK_ISSUE_JSON_INVALID')}
  if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).sort().join('|')!==
      ['chatId','operation','requestId','schema','sourceSha'].sort().join('|')||
    request.schema!==REQUEST_SCHEMA||
    request.operation!=='verify-eia-saved-readonly-once'||
    request.sourceSha!==SOURCE_SHA||!REQ.test(request.requestId)||!CHAT.test(request.chatId)||
    request.requestId.slice('pc-inflation-eia-readback-'.length)!==request.chatId.slice('chat-'.length))
    stop('EIAREADBACK_REQUEST_DENIED');
  return request;
}
export function savedReadback(writer=WRITER){
  safeDir(writer);
  const root=safeDir(path.join(writer,'inflation-causal-r1'));
  const bytes=regular(path.join(root,'electricity-industrial-eia.json'));
  let data;
  try{data=JSON.parse(bytes.toString('utf8'))}catch{stop('EIAREADBACK_JSON_INVALID')}
  if(data?.schemaVersion!==1||data?.sourceVersion!==SOURCE_VERSION||
    data?.source!=='EIA_INDUSTRIAL_ELECTRICITY_US'||
    data?.unit!=='CENTS_PER_KWH'||data?.frequency!=='MONTHLY'||
    data?.facets?.stateid!=='US'||data?.facets?.sectorid!=='IND'||
    !iso(data.sourceStoredAt)||!Array.isArray(data.observations)||
    data.observations.length<1||data.observations.length>1000)
    stop('EIAREADBACK_CONTRACT_DENIED');
  let previous='';
  for(const row of data.observations){
    if(!MONTH.test(row?.month??'')||row.month<=previous||
      row.unit!=='cents_per_kWh'||typeof row.value!=='number'||
      !Number.isFinite(row.value)||row.value<0)
      stop('EIAREADBACK_MONTHLY_ROW_DENIED');
    previous=row.month;
  }
  const archive=data.rawArchive;
  if(!HASH.test(archive?.sha256??'')||
    archive?.file!==`raw/electricity-${archive.sha256}.json`)
    stop('EIAREADBACK_ARCHIVE_PATH_DENIED');
  const archiveFolder=safeDir(path.join(root,'raw'));
  const raw=regular(path.join(archiveFolder,`electricity-${archive.sha256}.json`));
  if(sha(raw)!==archive.sha256)stop('EIAREADBACK_ARCHIVE_HASH_DENIED');
  let decoded;
  try{decoded=JSON.parse(raw.toString('utf8'))}catch{stop('EIAREADBACK_ARCHIVE_JSON_INVALID')}
  if(!Array.isArray(decoded)||decoded.length<1||decoded.length>1000||
    !decoded.every(x=>x?.stateid==='US'&&x?.sectorid==='IND'&&
      MONTH.test(x?.period??'')))
    stop('EIAREADBACK_ARCHIVE_CONTRACT_DENIED');
  return {count:data.observations.length,latest:previous,
    sourceStoredAt:data.sourceStoredAt,fileSha256:sha(bytes),
    rawArchiveSha256:archive.sha256};
}
function eventFromEnv(env){
  return JSON.parse(regular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
}
function workspaceFromEnv(env){
  if(!env.GITHUB_WORKSPACE||!path.isAbsolute(env.GITHUB_WORKSPACE))
    stop('EIAREADBACK_WORKSPACE_DENIED');
  return safeDir(env.GITHUB_WORKSPACE);
}
export function execute(env=process.env){
  let report={schema:SCHEMA,status:'BLOCKED',code:'EIAREADBACK_NOT_STARTED',
    sourceSha:SOURCE_SHA,providerCalls:0,coreWrites:0,dbWrites:0,
    d1Writes:0,schedulerWrites:0};
  let issueNumber;
  try{
    if(process.platform!=='win32')stop('EIAREADBACK_WINDOWS_ONLY');
    const event=eventFromEnv(env);
    const request=validateRequest(event,env);
    issueNumber=event.issue.number;
    workspaceFromEnv(env);
    report={...report,issueNumber,requestId:request.requestId,
      chatId:request.chatId,runId:String(env.GITHUB_RUN_ID??'')};
    const proof=savedReadback();
    report={...report,status:'PASS',code:'EIA_SAVED_PRIVATE_READBACK_VERIFIED',
      ...proof};
  }catch(e){report={...report,code:failure(e)};}
  if(issueNumber){
    try{
      const target=path.join(workspaceFromEnv(env),resultName(issueNumber));
      fs.writeFileSync(target,JSON.stringify(report)+'\n',{flag:'wx'});
    }catch{
      report={...report,status:'BLOCKED',code:'EIAREADBACK_RESULT_SAVE_DENIED'};
    }
  }
  process.stdout.write(`STATUS=${report.status} CODE=${report.code} SERIES=${report.count?1:0}\n`);
  if(report.status!=='PASS')process.exitCode=1;
  return report;
}
export async function upload(env=process.env,fetcher=fetch){
  const event=eventFromEnv(env);
  const request=validateRequest(event,env);
  const reportPath=path.join(workspaceFromEnv(env),resultName(event.issue.number));
  let report;
  try{report=JSON.parse(regular(reportPath,4000).toString('utf8'))}
  catch{stop('EIAREADBACK_REPORT_UNAVAILABLE')}
  if(report.schema!==SCHEMA||report.issueNumber!==event.issue.number||
    report.requestId!==request.requestId||report.chatId!==request.chatId||
    report.sourceSha!==SOURCE_SHA||report.runId!==String(env.GITHUB_RUN_ID??'')||
    !['PASS','BLOCKED','RUNTIME_FAILED','STATE_UNKNOWN'].includes(report.status)||
    !/^(?:EIA_SAVED_PRIVATE_READBACK_VERIFIED|EIAREADBACK_[A-Z0-9_]{2,80})$/.test(report.code)||
    !env.GITHUB_TOKEN)stop('EIAREADBACK_STALE_OR_UNTRUSTED_REPORT_DENIED');
  const sanitized={schema:report.schema,status:report.status,code:report.code,
    issueNumber:report.issueNumber,requestId:report.requestId,sourceSha:report.sourceSha,
    count:report.count??null,latest:report.latest??null,
    sourceStoredAt:report.sourceStoredAt??null,fileSha256:report.fileSha256??null,
    rawArchiveSha256:report.rawArchiveSha256??null,providerCalls:0,coreWrites:0,
    dbWrites:0,d1Writes:0,schedulerWrites:0};
  const body='Inflation EIA industrial US — saved-file **read-only** proof: '+
    `**${sanitized.status}** (${sanitized.code})\n\n`+
    '```json\n'+JSON.stringify(sanitized,null,2)+'\n```';
  const response=await fetcher(`https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body}),
  });
  if(!response.ok)stop('EIAREADBACK_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload'&&process.argv.length===3)await upload();
  else if(process.argv.length===2)execute();
  else stop('EIAREADBACK_ARGUMENTS_DENIED');
}
