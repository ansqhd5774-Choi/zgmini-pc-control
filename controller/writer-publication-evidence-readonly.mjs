// A/light evidence for a fixed ER1 Writer lane. Local output is read using
// readOnly/query_only SQLite; per-key D1 readback is not in the global ledger.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SAFE_STATUS=/^[A-Z0-9_]{1,80}$/;
const MONTH=/^20[0-9]{2}-(0[1-9]|1[0-2])$/;
const OUT_KEY='market-calendar:earnings-er1-score-2026-11-public';
const MAX_OUTPUT_BODY=4_000_000;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const safeTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?
 new Date(s).toISOString():null;
const safeStatus=s=>typeof s==='string'&&SAFE_STATUS.test(s)?s:null;
const safeCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=1_000_000?n:null;
const safeEpoch=n=>Number.isSafeInteger(n)&&n>0&&n<=8_640_000_000_000_000?
 safeTime(new Date(n).toISOString()):null;
const safeStoredAt=v=>Number.isSafeInteger(v)&&v>0?v:
 typeof v==='string'?safeTime(v):null;

export function readER1LocalOutput(dataRoot,{fileSystem=fs,
 openDatabase=(filename)=>new DatabaseSync(filename,{readOnly:true,timeout:1000})}={}){
 const filename=path.join(dataRoot,'pc-writer','storage','core.sqlite');
 let db;
 try{
  const root=fileSystem.realpathSync.native(dataRoot);
  const stat=fileSystem.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||!Number.isSafeInteger(stat.size)||
   stat.size<100||stat.size>2_000_000_000)return {state:'DB_FILE_UNSAFE',sqliteOpened:false};
  const real=fileSystem.realpathSync.native(filename);
  const rel=path.relative(root,real);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))
   return {state:'DB_PATH_UNSAFE',sqliteOpened:false};
  db=openDatabase(filename);
  db.exec('PRAGMA query_only=ON');
  const row=db.prepare("SELECT stored_at,body FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key='current' LIMIT 1").get(OUT_KEY);
  if(!row)return {state:'NOT_FOUND',sqliteOpened:true};
  if(typeof row.body!=='string'||Buffer.byteLength(row.body)>MAX_OUTPUT_BODY)
   return {state:'INVALID_BODY',sqliteOpened:true};
  return {state:'READ',storedAt:safeStoredAt(row.stored_at),
   bodySha256:hash(Buffer.from(row.body,'utf8')),sqliteOpened:true};
 }catch(error){return {state:'READ_FAILED',sqliteOpened:!!db,
  errorCode:/^SQLITE_[A-Z_]+$|^ERR_[A-Z_]+$/.test(error?.code??'')?
   error.code:'SQLITE_READ_ERROR'};}
 finally{try{db?.close();}catch{}}
}
function readLedger(dataRoot,filename,{fileSystem=fs}={}){
 const read=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer',filename),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131_072});
 if(!read.ok)return {state:read.reason};
 try{
  const o=JSON.parse(read.bytes.toString('utf8'));
  if(!o||typeof o!=='object'||Array.isArray(o))throw Error('INVALID');
  return {state:'READY',value:o};
 }catch{return {state:'INVALID'};}
}
export function inspectWriterPublicationEvidence(dataRoot,{fileSystem=fs,
 readOutput=readER1LocalOutput}={}){
 const result={status:'STATE_UNKNOWN',code:'ER1_WRITER_EVIDENCE_UNAVAILABLE',
  observedAt:new Date().toISOString(),evidenceLevel:'LOCAL_WRITER_AND_OUTPUT_READONLY',
  writer:null,er1Future:null,ledger:null,
  output:{key:OUT_KEY,state:'NOT_OBSERVED',storedAt:null,bodySha256:null},
  d1:{perKeyReadback:'NOT_RECORDED',productionVerified:false},
  localOutputVerified:false,globalLedgerVerified:false,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
 const output=readOutput(dataRoot,{fileSystem});
 result.sqliteOpened=output.sqliteOpened===true;
 result.output={key:OUT_KEY,state:output.state,
  storedAt:output.storedAt??null,bodySha256:output.bodySha256??null};
 result.localOutputVerified=output.state==='READ'&&
  /^[a-f0-9]{64}$/.test(output.bodySha256??'')&&output.storedAt!==null;
 const writer=readLedger(dataRoot,'local-writer-last-run.json',{fileSystem});
 const ledger=readLedger(dataRoot,'local-publication-ledger.json',{fileSystem});
 if(writer.state!=='READY')return {...result,writer:{state:writer.state}};
 const w=writer.value;
 const months=(Array.isArray(w.er1Future?.months)?w.er1Future.months:[])
  .filter(x=>x&&typeof x==='object'&&MONTH.test(x.month))
  .slice(0,24).map(x=>({month:x.month,status:safeStatus(x.status),
   sqliteDays:safeCount(x.sqliteDays),privateDays:safeCount(x.privateDays),
   scoreableIssuers:safeCount(x.scoreableIssuers)}));
 const failed=(Array.isArray(w.failures)?w.failures:[])
  .filter(x=>x?.id==='market-calendar-er1-future'||
   x?.id===`feed:${OUT_KEY}`).slice(0,3).map(x=>({stage:x.id,reason:safeStatus(x.reason)}));
 result.writer={at:safeTime(w.at),source:SHA40.test(w.source??'')?w.source:null,
  mode:w.mode==='PUBLISH'?'PUBLISH':w.mode==='DRY_RUN'?'DRY_RUN':null,
  status:safeStatus(w.status)};
 result.er1Future={status:safeStatus(w.er1Future?.status),months,failures:failed};
 if(ledger.state==='READY'){
  const l=ledger.value;
  result.ledger={state:'READY',status:safeStatus(l.status),
   at:safeEpoch(l.at),
   sourceMatchesWriter:l.source===result.writer.source};
  // Global ledger success is not evidence for this specific output key.
  result.globalLedgerVerified=Boolean(result.writer.mode==='PUBLISH'&&
   l.source===result.writer.source&&l.status==='VERIFIED');
 }else result.ledger={state:ledger.state};
 result.status='PASS';result.code='ER1_WRITER_METADATA_READONLY';
 return result;
}
