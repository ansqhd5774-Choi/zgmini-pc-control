// One-off private, read-only PC inventory for the 19 approved inflation inputs.
// Never collects, computes a score, changes Core or returns raw values.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const ISSUE_TITLE='pc-inflation-19-inventory-readonly-once';
export const REQUEST_SCHEMA='ZGMINI_INFLATION_19_INVENTORY_V1';
export const PC_HOME=String.raw`E:\ZGmini\data\pc-writer`;
export const RESULT='INFLATION_19_INVENTORY_RESULT.json';
export const APPROVAL='INFLATION_19_INVENTORY_B_APPROVAL.json';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST_ID=new RegExp(`^pc-inflation19-${UUID}$`);
const CHAT_ID=new RegExp(`^chat-${UUID}$`);
const MONTH=/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;
const SHA=/^[a-f0-9]{64}$/;
const MAX_FILE=3_000_000;
const EXPECTED_IDS=Object.freeze([
  '1','3','4','5','6','7','8','9','10','11','12','13','14',
  '18','19','21','25','26','31',
]);
const FRED_PIT=Object.freeze({'1':'MCOILWTICO','12':'CES0500000003',
  '13':'ECIALLCIV','14':'PRS85006111','19':'IREXFUELS'});
const PPI_IDS=Object.freeze({'5':'WPU1017','6':'WPU102502',
  '7':'WPU081','8':'WPU061','9':'WPU012','10':'WPU0221',
  '11':'WPU029','25':'WPUID61'});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const absent=(reason='NOT_VERIFIED_IN_APPROVED_STORAGE')=>({status:'UNVERIFIED',reason});
function regular(file,max=MAX_FILE){
  try {const s=fs.lstatSync(file);return s.isFile()&&!s.isSymbolicLink()&&
    s.size>0&&s.size<=max?s:null;}catch{return null;}
}
function directory(folder){
  try{const s=fs.lstatSync(folder);return s.isDirectory()&&!s.isSymbolicLink();}
  catch{return false;}
}
function readJson(file,max=MAX_FILE){
  const st=regular(file,max);if(!st)return null;
  try{
    const bytes=fs.readFileSync(file),after=regular(file,max);
    if(!after||st.size!==after.size||st.mtimeMs!==after.mtimeMs||st.ino!==after.ino)return null;
    return {body:JSON.parse(bytes.toString('utf8')),sha256:digest(bytes)};
  }catch{return null;}
}
function seriesSummary(rows,{min=1}={}){
  if(!Array.isArray(rows)||rows.length<min||rows.length>20000)return null;
  let first=null,latest=null,count=0,prev='';
  for(const row of rows){
    const date=row?.observationDate??row?.date;
    if(typeof date!=='string'||!MONTH.test(date)||date<=prev||
      !Number.isFinite(row?.value))return null;
    first??=date;latest=date;prev=date;count++;
  }
  return {status:'SAVED_VERIFIED',count,firstObservation:first,latestObservation:latest};
}
function inspectGscpi(home){
  const dir=path.join(home,'supply-r10'),parsed=readJson(path.join(dir,'gscpi.json'));
  const raw=regular(path.join(dir,'gscpi.xlsx'),8_000_000);
  const manifest=readJson(path.join(dir,'extra-manifest.json'),65536);
  const matched=Array.isArray(manifest?.body)&&manifest.body.some(x=>x?.id==='gscpi'&&x.status==='STORED');
  const summary=parsed?.body?.source==='NY_FED_GSCPI'?
    seriesSummary(parsed.body.rows,{min:180}):null;
  if(!summary)return absent('GSCPI_PARSED_NOT_VERIFIED');
  let rawValid=false;
  if(raw){
    const header=Buffer.alloc(8),fd=fs.openSync(path.join(dir,'gscpi.xlsx'),'r');
    try{fs.readSync(fd,header,0,8,0);}finally{fs.closeSync(fd)}
    rawValid=header.toString('hex')==='d0cf11e0a1b11ae1'||
      header.subarray(0,4).toString('hex')==='504b0304';
  }
  return {...summary,status:rawValid&&matched?'SAVED_VERIFIED':'PARTIAL_SAVED',
    parsedSha256:parsed.sha256,rawPresent:rawValid,manifestVerified:matched};
}
function inspectPce(home){
  const dir=path.join(home,'supply-r10'),file=readJson(path.join(dir,'DPCERA3M086SBEA.json'));
  if(!file)return absent('PCE_SUPPLY_FILE_MISSING_OR_INVALID');
  const summary=seriesSummary(file.body.rows,{min:24});
  if(!summary)return absent('PCE_SUPPLY_ROWS_INVALID');
  const manifest=readJson(path.join(dir,'extra-manifest.json'),65536)?.body;
  const manifestVerified=Array.isArray(manifest)&&manifest.some(x=>
    x?.id==='DPCERA3M086SBEA'&&x.status==='STORED');
  const rawPresent=Boolean(regular(path.join(dir,'DPCERA3M086SBEA.csv'),8_000_000));
  return {...summary,status:manifestVerified&&rawPresent?'SAVED_VERIFIED':'PARTIAL_SAVED',
    parsedSha256:file.sha256,manifestVerified,rawPresent};
}
function inspectSce(home){
  const doc=readJson(path.join(home,'inflation-causal','sce31','latest.json'),65536)?.body;
  if(doc?.status!=='STORED'||doc.source!=='NY_FED_SCE_ONE_YEAR_MEDIAN'||
    !Number.isInteger(doc.count)||doc.count<24||!SHA.test(doc.downloadSha256??''))
    return absent('SCE31_CHECKPOINT_NOT_VERIFIED');
  const dir=path.join(home,'inflation-causal','sce31');
  const rawFile=path.join(dir,`${doc.downloadSha256}.xlsx`);
  if(!regular(rawFile,8_000_000)||
    !regular(path.join(dir,`${doc.downloadSha256}.json`),8_000_000))
    return absent('SCE31_ARCHIVE_NOT_VERIFIED');
  if(digest(fs.readFileSync(rawFile))!==doc.downloadSha256)
    return absent('SCE31_ARCHIVE_HASH_MISMATCH');
  return {status:'SAVED_VERIFIED',count:doc.count,latestObservation:doc.latestMonth,
    downloadSha256:doc.downloadSha256,storedAt:doc.fetchedAt};
}
function tableExists(db,name){
  return Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").get(name));
}
function inspectPit(db,id,series){
  if(!tableExists(db,'api_history_snapshots_v1'))return absent('PC_PIT_SNAPSHOT_TABLE_NOT_FOUND');
  const row=db.prepare(`SELECT row_count,latest_observation_date,retrieved_at,
    history_mode,status,chunk_hashes_json FROM api_history_snapshots_v1
    WHERE provider='FRED' AND dataset=? ORDER BY retrieved_at DESC LIMIT 1`).get(series);
  if(!row||!Number.isInteger(row.row_count)||row.row_count<1||
    !MONTH.test(row.latest_observation_date??''))return absent('PIT_SERIES_NOT_STORED');
  let hashes;try{hashes=JSON.parse(row.chunk_hashes_json);}catch{return absent('PIT_CHUNK_MANIFEST_INVALID');}
  if(!Array.isArray(hashes)||!hashes.length||hashes.length>100||
    hashes.some(x=>typeof x!=='string'||!SHA.test(x)))return absent('PIT_CHUNK_MANIFEST_INVALID');
  if(!tableExists(db,'api_history_chunks_v1'))return absent('PIT_CHUNK_TABLE_NOT_FOUND');
  // Chunk table may contain historic snapshots; test exact content-addressed links below.
  const countHash=db.prepare('SELECT row_count FROM api_history_chunks_v1 WHERE provider=\'FRED\' AND dataset=? AND chunk_sha256=?');
  let linked=0;
  for(const hash of hashes){const c=countHash.get(series,hash);if(!c)return absent('PIT_CHUNK_MISSING');linked+=Number(c.row_count)||0;}
  if(linked!==row.row_count)return absent('PIT_CHUNK_COUNT_MISMATCH');
  return {status:row.history_mode==='INITIAL_RELEASE_ONLY'?'SAVED_VERIFIED':'PARTIAL_SAVED',
    source:'FRED_INITIAL_RELEASE',series,
    count:row.row_count,latestObservation:row.latest_observation_date,
    retrievedAt:row.retrieved_at,historyMode:row.history_mode,
    snapshotStatus:row.status,chunks:hashes.length};
}
function inspectMacro(db){
  const out={};
  for(const [id,name] of [['1','MCOILWTICO'],['3','DHHNGSP'],
    ['18','DTWEXBGS'],['26','DPCERA3M086SBEA']])out[id]=absent(`MACRO_${name}_NOT_VERIFIED`);
  if(!tableExists(db,'market_input_batches_v1'))return out;
  const row=db.prepare("SELECT body,stored_at FROM market_input_batches_v1 WHERE batch_key LIKE 'macro:%' ORDER BY stored_at DESC LIMIT 1").get();
  if(!row||typeof row.body!=='string'||row.body.length>2_000_000)return out;
  try{
    const body=row.body.startsWith('gzip:')?
      gunzipSync(Buffer.from(row.body.slice(5),'base64'),{maxOutputLength:30_000_000}).toString('utf8'):
      row.body;
    const parsed=JSON.parse(body);
    for(const id of Object.keys(out)){
      const name=id==='1'?'MCOILWTICO':id==='3'?'DHHNGSP':id==='18'?'DTWEXBGS':'DPCERA3M086SBEA';
      const summary=seriesSummary(parsed?.series?.[name]);
      if(summary)out[id]={...summary,series:name,storedAt:row.stored_at};
    }
  }catch{/* Fail closed on invalid compression/schema. */}
  return out;
}
export function inspectPcInflation19(home,{openDb=file=>new DatabaseSync(file,{readOnly:true,timeout:1000})}={}){
  const inputs=Object.fromEntries(EXPECTED_IDS.map(id=>[id,absent()]));
  for(const [id,series] of Object.entries(PPI_IDS))inputs[id]=absent(`BLS_${series}_NOT_CHECKED_IN_EXISTING_STORE`);
  if(!path.isAbsolute(home)||path.basename(path.resolve(home)).toLowerCase()!=='pc-writer'||
    !directory(home))return {status:'BLOCKED',code:'APPROVED_HOME_UNAVAILABLE',inputs};
  inputs['21']=inspectGscpi(home);
  inputs['26']=inspectPce(home);
  inputs['31']=inspectSce(home);
  const dbFile=path.join(home,'storage','core.sqlite');
  if(regular(dbFile,10_000_000_000)){
    let db;
    try{
      db=openDb(dbFile);db.exec('PRAGMA query_only=ON');
      const macro=inspectMacro(db);
      for(const [id,s] of Object.entries(macro))if(s.status==='SAVED_VERIFIED')inputs[id]=s;
      for(const [id,series] of Object.entries(FRED_PIT)){
        const pit=inspectPit(db,id,series);
        if(pit.status==='SAVED_VERIFIED')inputs[id]=pit;
      }
    }catch{/* Preserve per-series UNVERIFIED; never infer an empty DB. */}
    finally{try{db?.close()}catch{}}
  }
  const counts={saved:Object.values(inputs).filter(x=>x.status==='SAVED_VERIFIED').length,
    partial:Object.values(inputs).filter(x=>x.status==='PARTIAL_SAVED').length,
    unverified:Object.values(inputs).filter(x=>x.status==='UNVERIFIED').length};
  return {status:'PASS',code:'INFLATION_19_PC_PRIVATE_READONLY_INVENTORY',
    inputs,counts,excluded20:'EXCLUDED_BY_USER',providerCalls:0,dbWrites:0,
    coreWrites:0,d1Writes:0,schedulerWrites:0,rawValuesOutput:0};
}
export function validateRequest(event,env){
  if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_EVENT_NAME!=='issues'||
    env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
    event?.repository?.private!==true||event?.action!=='opened'||
    event.issue?.user?.login!=='ansqhd5774-Choi'||event.issue?.title!==ISSUE_TITLE)
    throw Error('INFLATION19_ISSUE_DENIED');
  let body;try{body=JSON.parse(event.issue.body);}catch{throw Error('INFLATION19_INVALID_JSON')}
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!==['chatId','controlSha','operation','requestId','schema'].sort().join('|')||
    body.schema!==REQUEST_SCHEMA||body.operation!=='readonly-private-inventory-once'||
    !/^[a-f0-9]{40}$/.test(body.controlSha??'')||body.controlSha!==env.GITHUB_SHA||
    !REQUEST_ID.test(body.requestId)||!CHAT_ID.test(body.chatId))
    throw Error('INFLATION19_REQUEST_DENIED');
  return body;
}
export function verifyApproval(workspace){
  if(typeof workspace!=='string'||!path.isAbsolute(workspace)||!directory(workspace))
    throw Error('INFLATION19_WORKSPACE_DENIED');
  const approval=readJson(path.join(workspace,'control',APPROVAL),65536)?.body;
  if(approval?.schema!=='ZGMINI_INFLATION_19_B_APPROVAL_V1'||
    approval?.scope!=='PRIVATE_READONLY_STORED_INPUT_INVENTORY'||
    approval?.dataHome!==PC_HOME||approval?.inputCount!==19||
    approval?.maxProviderRequests!==0||approval?.maxAutomaticRetries!==0||
    approval?.coreWrites!==false||approval?.dbWrites!==false||
    approval?.d1Writes!==false||approval?.schedulerWrites!==false||
    !SHA.test(approval?.scriptSha256??''))
    throw Error('INFLATION19_APPROVAL_DENIED');
  const script=path.join(workspace,'control','inflation-19-inventory-b-once.mjs');
  const st=regular(script,300000);
  if(!st||digest(fs.readFileSync(script))!==approval.scriptSha256)
    throw Error('INFLATION19_SOURCE_HASH_DENIED');
  return approval;
}
export function execute(env=process.env){
  let result={status:'BLOCKED',code:'INFLATION19_NOT_STARTED',providerCalls:0,
    dbWrites:0,coreWrites:0,d1Writes:0,schedulerWrites:0};
  try{
    if(process.platform!=='win32')throw Error('INFLATION19_WINDOWS_ONLY');
    const data=readJson(env.GITHUB_EVENT_PATH,100000);
    if(!data)throw Error('INFLATION19_EVENT_UNAVAILABLE');
    const req=validateRequest(data.body,env);
    verifyApproval(env.GITHUB_WORKSPACE);
    result={...inspectPcInflation19(PC_HOME),requestId:req.requestId};
  }catch(e){result.code=/^INFLATION19_/.test(e.message)?e.message:'INFLATION19_UNEXPECTED_STOP'}
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,RESULT),JSON.stringify(result),{flag:'wx'});}
  catch{process.stderr.write('INFLATION19_RESULT_SAVE_FAILED\n')}
  process.stdout.write(`STATUS=${result.status} CODE=${result.code} SAVED=${result.counts?.saved??0}\n`);
  if(result.status!=='PASS')process.exitCode=1;
}
export async function upload(env=process.env,fetcher=fetch){
  const result=readJson(path.join(env.GITHUB_WORKSPACE,RESULT),65536);
  const event=readJson(env.GITHUB_EVENT_PATH,100000);
  if(!result||!event||!env.GITHUB_TOKEN||env.GITHUB_REPOSITORY!==CONTROL_REPO||
    !Number.isInteger(event.body.issue?.number))return;
  const body='Inflation 19 PC read-only inventory: **'+result.body.status+'** ('+result.body.code+')\n\n'+
    '```json\n'+JSON.stringify(result.body,null,2)+'\n```';
  const response=await fetcher(`https://api.github.com/repos/${CONTROL_REPO}/issues/${event.body.issue.number}/comments`,{
    method:'POST',headers:{accept:'application/vnd.github+json',
      authorization:`Bearer ${env.GITHUB_TOKEN}`,'content-type':'application/json',
      'x-github-api-version':'2022-11-28'},body:JSON.stringify({body})});
  if(!response.ok)throw Error('INFLATION19_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--upload')await upload();
  else if(process.argv.length===2)execute();
  else throw Error('INFLATION19_ARGUMENTS_DENIED');
}
