// A/light evidence for a fixed ER1 Writer lane. Inspect report metadata only:
// local public output lives in SQLite and per-key D1 readback is not recorded
// in these JSON ledgers. Neither is inferred from a global VERIFIED flag.
import fs from 'node:fs';
import path from 'node:path';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SAFE_STATUS=/^[A-Z0-9_]{1,80}$/;
const MONTH=/^20[0-9]{2}-(0[1-9]|1[0-2])$/;
const OUT_KEY='market-calendar:earnings-er1-score-2026-11-public';
const safeTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?
 new Date(s).toISOString():null;
const safeStatus=s=>typeof s==='string'&&SAFE_STATUS.test(s)?s:null;
const safeCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=1_000_000?n:null;
const safeEpoch=n=>Number.isSafeInteger(n)&&n>0&&n<=8_640_000_000_000_000?
 safeTime(new Date(n).toISOString()):null;
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
export function inspectWriterPublicationEvidence(dataRoot,{fileSystem=fs}={}){
 const result={status:'STATE_UNKNOWN',code:'ER1_WRITER_EVIDENCE_UNAVAILABLE',
  observedAt:new Date().toISOString(),evidenceLevel:'LOCAL_WRITER_LEDGER_ONLY',
  writer:null,er1Future:null,ledger:null,
  output:{key:OUT_KEY,state:'NOT_OBSERVED',storedAt:null,bodySha256:null,
   reason:'LOCAL_SQLITE_NOT_OPENED'},
  d1:{perKeyReadback:'NOT_RECORDED',productionVerified:false},
  localOutputVerified:false,globalLedgerVerified:false,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
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
