// A/light ER1 evidence. Local output is readOnly/query_only SQLite; D1 metadata
// is from the authenticated Writer's existing local publication ledger.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/;
const SAFE_STATUS=/^[A-Z0-9_]{1,80}$/;
const MONTH=/^20[0-9]{2}-(0[1-9]|1[0-2])$/;
const OUT_KEY=/^market-calendar:earnings-er1-score-20[0-9]{2}-(0[1-9]|1[0-2])-public$/;
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
  const rows=db.prepare("SELECT feed_key,stored_at,body FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key LIKE 'market-calendar:earnings-er1-score-%-public' AND snapshot_key='current' ORDER BY feed_key DESC LIMIT 24").all();
  const row=rows.find(item=>OUT_KEY.test(item.feed_key));
  if(!row)return {state:'NOT_FOUND',key:null,sqliteOpened:true};
  if(typeof row.body!=='string'||Buffer.byteLength(row.body)>MAX_OUTPUT_BODY)
   return {state:'INVALID_BODY',key:row.feed_key,sqliteOpened:true};
  return {state:'READ',key:row.feed_key,storedAt:safeStoredAt(row.stored_at),
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

/**
 * R44 evidence from already written, bounded PC report files. Unlike the
 * legacy ER1 helper this never opens SQLite, so it cannot create WAL sidecars.
 * Reports are evidence of producer behavior, not independent DB/D1 readbacks.
 */
export function inspectDeltaR44CheckpointEvidence(dataRoot,{fileSystem=fs}={}){
 const collection=readLedger(dataRoot,'local-collection-last-run.json',{fileSystem});
 const writer=readLedger(dataRoot,'local-writer-last-run.json',{fileSystem});
 const c=collection.state==='READY'?collection.value:{};
 const w=writer.state==='READY'?writer.value:{};
 const inputStatuses=new Set(['READY_PRIVATE','CACHED_PRIVATE','EXISTING_INPUT_INVALID_PRESERVED',
  'FAILED_PREVIOUS_INPUT_PRESERVED','SKIPPED_KOREA_LANE']);
 const outputStatuses=new Set(['READY_OUTPUT','UNCHANGED','NEWER_OUTPUT_PRESERVED',
  'SOURCE_INPUT_MISSING','SOURCE_INPUT_INVALID_PRESERVED','SOURCE_CSV_INVALID_PRESERVED',
  'SOURCE_COVERAGE_INVALID','SAVED_MONTH_INVALID_PRESERVED','SAVED_MONTH_INCOMPLETE',
  'NO_MATCHED_MARKETCAP']);
 const pick=(s,allowed)=>allowed.has(s)?s:null;
 const input=c.deltaScreener??{};
 const output=w.deltaR44??{};
 const counts=output.counts??{};
 const keys=['one','two','three','missing','conflicting'];
 const validCounts=keys.every(k=>safeCount(counts[k])!==null);
 const calendarTickers=safeCount(output.calendarTickers);
 const coveredTickers=safeCount(output.coveredTickers);
 const consistent=validCounts&&calendarTickers!==null&&coveredTickers!==null&&
  counts.one+counts.two+counts.three===coveredTickers&&
  coveredTickers+counts.missing+counts.conflicting===calendarTickers;
 const collectionAt=safeTime(c.at),writerAt=safeTime(w.at);
 const isOutputReported=consistent&&['READY_OUTPUT','UNCHANGED'].includes(output.status);
 const feedKey='market-calendar:earnings-marketcap-r44-2026-11-public';
 const failedStages=Array.isArray(w.failures)?w.failures:[];
 return {
  status:collection.state==='READY'&&writer.state==='READY'?'PASS':'STATE_UNKNOWN',
  evidenceLevel:'PC_CHECKPOINT_REPORTS_ONLY_NO_SQLITE_OPEN',
  input:{checkpointState:collection.state,at:collectionAt,
   status:pick(input.status,inputStatuses),
   rowCount:safeCount(input.rowCount),usableTickerCount:safeCount(input.usableTickerCount),
   sourceAsOf:input.asOf==='2026-11-03'?'2026-11-03':null},
  writer:{checkpointState:writer.state,at:writerAt,
   source:SHA40.test(w.source??'')?w.source:null,
   mode:w.mode==='PUBLISH'?'PUBLISH':w.mode==='DRY_RUN'?'DRY_RUN':null,
   status:safeStatus(w.status),deltaStatus:pick(output.status,outputStatuses),
   calendarTickerCount:calendarTickers,coveredTickerCount:coveredTickers,
   counts:consistent?Object.fromEntries(keys.map(k=>[k,counts[k]])):null,
   reportedLocalReadback:isOutputReported,
   failedOutputStage:failedStages.some(x=>x?.id==='market-calendar-r44-delta'),
   failedFeedStage:failedStages.some(x=>x?.id==='feed:'+feedKey)},
  lastWriterStartedAfterLastCollectionStart:collectionAt&&writerAt?
   Date.parse(writerAt)>=Date.parse(collectionAt):null,
  independentRawShaReadback:false,independentSqliteOutputReadback:false,
  d1PerKeyReadback:'NOT_RECORDED',productionApiUiVerified:false,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false,
 };
}

export function inspectWriterPublicationEvidence(dataRoot,{fileSystem=fs,
 readOutput=readER1LocalOutput}={}){
 const result={status:'STATE_UNKNOWN',code:'ER1_WRITER_EVIDENCE_UNAVAILABLE',
  observedAt:new Date().toISOString(),evidenceLevel:'LOCAL_WRITER_AND_OUTPUT_READONLY',
  writer:null,er1Future:null,ledger:null,
  deltaR44:null,
  output:{key:null,state:'NOT_OBSERVED',storedAt:null,bodySha256:null},
  d1:{perKeyReadback:'NOT_RECORDED',matchedToLocal:false,
   productionVerified:false,publicApiUiVerified:false,
   verificationScope:'AT_WRITER_PUBLISH_TIME'},
  localOutputVerified:false,globalLedgerVerified:false,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
 result.deltaR44=inspectDeltaR44CheckpointEvidence(dataRoot,{fileSystem});
 const output=readOutput(dataRoot,{fileSystem});
 result.sqliteOpened=output.sqliteOpened===true;
 result.output={key:OUT_KEY.test(output.key??'')?output.key:null,state:output.state,
  storedAt:output.storedAt??null,bodySha256:output.bodySha256??null};
 result.localOutputVerified=output.state==='READ'&&
  SHA64.test(output.bodySha256??'')&&output.storedAt!==null;
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
   (result.output.key&&x?.id===`feed:${result.output.key}`)).slice(0,3)
  .map(x=>({stage:x.id,reason:safeStatus(x.reason)}));
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
  const readback=(Array.isArray(l.er1FeedReadbacks)?l.er1FeedReadbacks:[])
   .slice(0,24).find(x=>x&&x.key===result.output.key);
  if(readback&&OUT_KEY.test(readback.key)){
   const status=safeStatus(readback.status);
   const observedAt=safeTime(readback.observedAt);
   const d1Sha=SHA64.test(readback.d1BodySha256??'')?
    readback.d1BodySha256:null;
   const d1StoredAt=safeStoredAt(readback.d1StoredAt);
   const localSame=result.localOutputVerified&&
    readback.localStoredAt===result.output.storedAt&&
    readback.localBodySha256===result.output.bodySha256;
   const ledgerAt=safeEpoch(l.at);
   const writerAt=result.writer.at;
   const matchingRun=Boolean(result.writer.mode==='PUBLISH'&&
    ['VERIFIED','VERIFIED_WITH_GAPS'].includes(result.writer.status)&&
    l.source===result.writer.source&&['VERIFIED','PARTIAL'].includes(l.status)&&
    writerAt&&ledgerAt&&
    Date.parse(ledgerAt)>=Date.parse(writerAt)&&
    observedAt&&Date.parse(observedAt)>=Date.parse(writerAt)&&
    Date.parse(observedAt)<=Date.parse(ledgerAt));
   const matched=Boolean(localSame&&status==='MATCHED'&&observedAt&&
    d1StoredAt===result.output.storedAt&&d1Sha===result.output.bodySha256&&
    matchingRun);
   result.d1={perKeyReadback:matched?'VERIFIED':status??'INVALID_RECORD',
    matchedToLocal:matched,productionVerified:false,publicApiUiVerified:false,
    verificationScope:'AT_WRITER_PUBLISH_TIME',
    evidenceState:matched?'VERIFIED':status==='MATCHED'?'STALE':'UNMATCHED',
    observedAt,d1StoredAt,d1BodySha256:d1Sha,
   };
  }
 }else result.ledger={state:ledger.state};
 result.status='PASS';result.code='ER1_WRITER_METADATA_READONLY';
 return result;
}

