// Fixed A/light R44 evidence from already-saved PC checkpoints. No SQLite handle.
import fs from 'node:fs';
import path from 'node:path';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const statusesInput=new Set(['READY_PRIVATE','CACHED_PRIVATE','EXISTING_INPUT_INVALID_PRESERVED',
 'FAILED_PREVIOUS_INPUT_PRESERVED','SKIPPED_KOREA_LANE']);
const statusesOutput=new Set(['READY_OUTPUT','UNCHANGED','NEWER_OUTPUT_PRESERVED',
 'SOURCE_INPUT_MISSING','SOURCE_INPUT_INVALID_PRESERVED','SOURCE_CSV_INVALID_PRESERVED',
 'SOURCE_COVERAGE_INVALID','SAVED_MONTH_INVALID_PRESERVED','SAVED_MONTH_INCOMPLETE',
 'NO_MATCHED_MARKETCAP']);
const FEED_KEY='market-calendar:earnings-marketcap-r44-2026-11-public';
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000?n:null;
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?
 new Date(v).toISOString():null;
const value=(v,allow)=>allow.has(v)?v:null;
const status=v=>typeof v==='string'&&/^[A-Z0-9_]{1,80}$/.test(v)?v:null;
function readReport(dataRoot,name,fileSystem){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return {state:'INVALID_ROOT'};
 try{
  const root=(fileSystem.realpathSync.native??fileSystem.realpathSync)(dataRoot);
  const file=path.join(dataRoot,'pc-writer',name);
  const result=readFixedReadonlyBytes(file,{fileSystem,verifiedRoot:root,
   minBytes:2,maxBytes:131072});
  if(!result.ok)return {state:result.reason};
  const json=JSON.parse(result.bytes.toString('utf8'));
  if(!json||typeof json!=='object'||Array.isArray(json))
   return {state:'INVALID_REPORT'};
  return {state:'READY',value:json};
 }catch{return {state:'UNREADABLE'};}
}
export function inspectDeltaR44CheckpointEvidence(dataRoot,{fileSystem=fs}={}){
 const collection=readReport(dataRoot,'local-collection-last-run.json',fileSystem);
 const writer=readReport(dataRoot,'local-writer-last-run.json',fileSystem);
 const c=collection.state==='READY'?collection.value:{};
 const w=writer.state==='READY'?writer.value:{};
 const input=c.deltaScreener??{};
 const output=w.deltaR44??{};
 const gradeCounts=output.counts??{};
 const keys=['one','two','three','missing','conflicting'];
 const validCounts=keys.every(key=>count(gradeCounts[key])!==null);
 const calendarTickers=count(output.calendarTickers),coveredTickers=count(output.coveredTickers);
 const consistent=validCounts&&calendarTickers!==null&&coveredTickers!==null&&
  gradeCounts.one+gradeCounts.two+gradeCounts.three===coveredTickers&&
  coveredTickers+gradeCounts.missing+gradeCounts.conflicting===calendarTickers;
 const collectionAt=stamp(c.at),writerAt=stamp(w.at);
 const outputStatus=value(output.status,statusesOutput);
 const reportedLocalReadback=consistent&&['READY_OUTPUT','UNCHANGED'].includes(outputStatus);
 const failures=Array.isArray(w.failures)?w.failures:[];
 const inputStatus=value(input.status,statusesInput);
 const reportedInput=collection.state==='READY'&&
  ['READY_PRIVATE','CACHED_PRIVATE'].includes(inputStatus)&&
  count(input.rowCount)===4894&&count(input.usableTickerCount)!==null;
 const bothRead=collection.state==='READY'&&writer.state==='READY';
 return {
  status:bothRead?'PASS':'STATE_UNKNOWN',
  code:bothRead?'R44_CHECKPOINTS_READ':'R44_CHECKPOINTS_UNAVAILABLE',
  evidenceStatus:reportedInput&&reportedLocalReadback?
   'R44_BOTH_PRODUCER_REPORTS_READY':'R44_PRODUCER_REPORTS_NOT_YET_COMPLETE',
  evidenceLevel:'PC_FIXED_CHECKPOINT_FILES_ONLY',
  input:{checkpointState:collection.state,at:collectionAt,
   status:inputStatus,rowCount:count(input.rowCount),
   usableTickerCount:count(input.usableTickerCount),
   sourceAsOf:input.asOf==='2026-11-03'?'2026-11-03':null},
  writer:{checkpointState:writer.state,at:writerAt,
   source:SHA40.test(w.source??'')?w.source:null,
   mode:w.mode==='PUBLISH'?'PUBLISH':w.mode==='DRY_RUN'?'DRY_RUN':null,
   status:status(w.status),deltaStatus:outputStatus,
   calendarTickerCount:calendarTickers,coveredTickerCount:coveredTickers,
   counts:consistent?Object.fromEntries(keys.map(key=>[key,gradeCounts[key]])):null,
   reportedLocalReadback,
   failedOutputStage:failures.some(x=>x?.id==='market-calendar-r44-delta'),
   failedFeedStage:failures.some(x=>x?.id==='feed:'+FEED_KEY)},
  lastWriterStartedAfterLastCollectionStart:collectionAt&&writerAt?
   Date.parse(writerAt)>=Date.parse(collectionAt):null,
  independentRawShaReadback:false,independentSqliteOutputReadback:false,
  d1PerKeyReadback:'NOT_RECORDED',productionApiUiVerified:false,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false
 };
}
