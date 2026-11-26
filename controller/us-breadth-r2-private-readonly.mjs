/**
 * Fixed, non-sensitive US paid breadth R2 inventory for existing core-status.
 * Reads only directory names, a bounded window of private receipt metadata,
 * and a single immutable calculated-output file. No provider/DB/Task access.
 * This is not raw parquet SHA verification or proof of D1/public publication.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const SHA=/^[a-f0-9]{64}$/;
const RECEIPT=/^(\d{4}-\d{2}-\d{2})\.parquet\.json$/;
const PRIVATE=/^(\d{4}-\d{2}-\d{2})-([a-f0-9]{64})\.json$/;
const TYPES=['stock_daily','etf_daily'];
const LIMIT_DATES=2000;
const WINDOW=251;
const MAX_RECEIPT_BYTES=16384;
const MAX_PRIVATE_BYTES=8*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const validDay=s=>typeof s==='string'&&DATE.test(s)
  &&Number.isFinite(Date.parse(s+'T00:00:00Z'))
  &&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;

function isDirectory(fsys,file){
 try{const s=fsys.lstatSync(file);return s.isDirectory()&&!s.isSymbolicLink();}
 catch{return false;}
}
function fileStat(fsys,file,maxBytes){
 try{const s=fsys.lstatSync(file);
  return s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=maxBytes?s:null;
 }catch{return null;}
}
function fixedBytes(fsys,file,maxBytes){
 const before=fileStat(fsys,file,maxBytes);
 if(!before)return null;
 try{
  const bytes=fsys.readFileSync(file);
  const after=fileStat(fsys,file,maxBytes);
  return bytes.length===before.size&&after?.size===before.size
    &&after?.mtimeMs===before.mtimeMs?bytes:null;
 }catch{return null;}
}
function inspectDates(fsys,home,type){
 const directory=path.join(home,type);
 const result={state:'NOT_OBSERVED',receiptDates:0,firstDate:null,
  lastDate:null,latest251FirstDate:null,latest251Candidates:0,selectedMetadataValid:0,
  selectedRawFilesPresent:0,selectedProjectionsPresent:0,
  selectedInvalidOrMissing:0,fullHistoryVerified:false,
  sourceShaReadbackVerified:false,calendarContinuityVerified:false};
 if(!isDirectory(fsys,directory))return {...result,state:'DIRECTORY_UNAVAILABLE'};
 let entries;
 try{entries=fsys.readdirSync(directory);}catch{return {...result,state:'LIST_FAILED'};}
 const dates=entries.map(n=>n.match(RECEIPT)?.[1]??null).filter(validDay).sort();
 if(dates.length>LIMIT_DATES)
  return {...result,state:'DATE_COUNT_EXCEEDS_BOUNDED_LIMIT',receiptDates:dates.length};
 result.receiptDates=dates.length;
 result.firstDate=dates[0]??null;
 result.lastDate=dates.at(-1)??null;
 const selected=dates.slice(-WINDOW);
 result.latest251FirstDate=selected[0]??null;
 result.latest251Candidates=selected.length;
 for(const date of selected){
  const stem=path.join(directory,date+'.parquet');
  const bytes=fixedBytes(fsys,stem+'.json',MAX_RECEIPT_BYTES);
  let receipt=null;
  try{receipt=bytes?JSON.parse(bytes.toString('utf8')):null;}catch{}
  const metadataValid=receipt?.schema==='ZGMINI_MP_PAID_FILE_V1'
   &&receipt.plan==='full'&&receipt.assetType===type
   &&receipt.date===date&&SHA.test(receipt.sha256)
   &&SHA.test(receipt.projectionSha256)
   &&Number.isSafeInteger(receipt.bytes)&&receipt.bytes>0
   &&Number.isSafeInteger(receipt.rows)&&receipt.rows>0;
  if(metadataValid)result.selectedMetadataValid++;
  const raw=fileStat(fsys,stem,16*1024*1024);
  const projection=fileStat(fsys,stem+'.rows.json',32*1024*1024);
  if(raw&&metadataValid&&raw.size===receipt.bytes)result.selectedRawFilesPresent++;
  if(projection)result.selectedProjectionsPresent++;
  if(!metadataValid||!raw||raw.size!==receipt.bytes||!projection)
   result.selectedInvalidOrMissing++;
 }
 result.state='INVENTORIED_FILE_METADATA_ONLY';
 return result;
}
function inspectPrivate(fsys,home){
 const base=path.join(home,'derived','us-breadth-r2');
 const out={state:'NOT_OBSERVED',lastDate:null,comparedSessions:null,
  historyComplete:null,fileSha256:null,
  sourceReceiptsReadbackVerified:false,publicD1Verified:false};
 if(!isDirectory(fsys,base))return {...out,state:'DIRECTORY_UNAVAILABLE'};
 let entries;
 try{entries=fsys.readdirSync(base);}catch{return {...out,state:'LIST_FAILED'};}
 const candidates=entries.filter(n=>PRIVATE.test(n)).sort().reverse();
 if(!candidates.length)return {...out,state:'NO_PRIVATE_OUTPUT'};
 if(candidates.length>1&&candidates[0].slice(0,10)===candidates[1].slice(0,10))
  return {...out,state:'PRIVATE_SAME_DATE_AMBIGUOUS'};
 const name=candidates[0],matched=name.match(PRIVATE);
 const bytes=fixedBytes(fsys,path.join(base,name),MAX_PRIVATE_BYTES);
 if(!bytes)return {...out,state:'OUTPUT_UNREADABLE'};
 if(digest(bytes)!==matched[2])return {...out,state:'OUTPUT_SHA_MISMATCH'};
 let record;
 try{record=JSON.parse(bytes.toString('utf8'));}catch{return {...out,state:'OUTPUT_JSON_INVALID'};}
 const pct=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
 const source='MARKETPARQUET_PAID_SPLIT_ADJUSTED_DAILY';
 if(record?.schema!=='ZGMINI_US_PAID_BREADTH_R2_PRIVATE_V1'
  ||record.source!==source||record.priceMode!=='SPLIT_ADJUSTED_DAILY_CLOSE'
  ||record.phase!=='CONFIRMED'||record.publicationAllowed!==false
  ||record.sourceLatestProviderDateVerified!==false
  ||record.lastDate!==matched[1]||!validDay(record.firstDate)
  ||!Array.isArray(record.points)
  ||!Array.isArray(record.sourceReceipts)
  ||record.points.length<1||record.points.length>250
  ||record.comparedSessions!==record.points.length
  ||record.sourceReceipts.length!==record.points.length+1
  ||record.fullYearHistory!==(record.points.length===250)
  ||record.points[0]?.date!==record.firstDate
  ||record.points.at(-1)?.date!==record.lastDate)
  return {...out,state:'OUTPUT_CONTRACT_UNVERIFIED'};
 for(let n=0;n<record.sourceReceipts.length;n++){
  const receipt=record.sourceReceipts[n];
  if(!validDay(receipt?.date)||!SHA.test(receipt?.sha256)
   ||!SHA.test(receipt?.projectionSha256)
   ||n>0&&receipt.date<=record.sourceReceipts[n-1].date)
   return {...out,state:'OUTPUT_CONTRACT_UNVERIFIED'};
 }
 for(let n=0;n<record.points.length;n++){
  const point=record.points[n];
  if(!validDay(point?.date)||point.date!==record.sourceReceipts[n+1].date
   ||!pct(point.risingPct)||!pct(point.unchangedPct)||!pct(point.fallingPct)
   ||Math.abs(point.risingPct+point.unchangedPct+point.fallingPct-100)>1e-7)
   return {...out,state:'OUTPUT_CONTRACT_UNVERIFIED'};
 }
 return {...out,state:'PRIVATE_FILE_SHA_READBACK_VERIFIED',
  lastDate:record.lastDate,comparedSessions:record.comparedSessions,
  historyComplete:record.fullYearHistory,fileSha256:matched[2]};
}
export function inspectUsBreadthR2PrivateReadonly(dataRoot,{fileSystem=fs}={}){
 const fail={status:'STATE_UNKNOWN',code:'US_R2_PRIVATE_READONLY_UNAVAILABLE',
  source:'FIXED_PC_MARKETPARQUET_PAID_RECEIPTS',evidenceLevel:'FILE_METADATA_ONLY',
  stockDaily:null,etfDaily:null,privateOutput:null,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return fail;
 const root=path.join(dataRoot,'pc-writer'),home=path.join(root,'marketparquet-paid');
 if(!isDirectory(fileSystem,root)||!isDirectory(fileSystem,home))
  return {...fail,code:'US_R2_PAID_STORAGE_UNAVAILABLE'};
 try{
  const inventory=TYPES.map(type=>inspectDates(fileSystem,home,type));
  const privateOutput=inspectPrivate(fileSystem,home);
  return {...fail,status:'PASS',code:'US_R2_PRIVATE_RECEIPTS_INVENTORIED',
   stockDaily:inventory[0],etfDaily:inventory[1],privateOutput};
 }catch{return {...fail,code:'US_R2_PRIVATE_READ_FAILED'};}
}
