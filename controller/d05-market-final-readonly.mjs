// D05 fixed A-grade: observe existing market final outputs in PC SQLite.
// No provider, score calculation, D1, API or database mutation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openSqliteReadonly} from './common.mjs';

const DOMAINS=Object.freeze(['inflation','employment','rates','credit','growth',
 'consumption','earnings','liquidity','fundFlows','breadth','dollarFx','commodities']);
const MAX_BODY=2_000_000;
const MAX_DB=64*1024**3;
const sha=x=>createHash('sha256').update(x).digest('hex');
const day=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const validScore=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const base=(code,opened=false)=>({status:'STATE_UNKNOWN',code,sqliteOpened:opened,
 scope:'MARKET_OVERALL_AND_12_DOMAINS_ONLY',sameEventVerified:false,
 localStoredSnapshotMatched:false,
 d1Readback:'NOT_PERFORMED',apiReadback:'NOT_PERFORMED',oneYearPitVerified:false,
 providerCalls:0,d1Writes:0,operationalWrites:0});
const validVersion=x=>typeof x==='string'&&x.length>0&&x.length<=160;

// Keep the originally saved score and its observation/version separate from
// the SQLite stored_at clock. The latter alone is not a calculation receipt.
export function projectD05MarketRow(row,key){
 if(typeof row?.body!=='string'||Buffer.byteLength(row.body,'utf8')>MAX_BODY||
  !Number.isSafeInteger(row.stored_at)||row.stored_at<=0||
  !Number.isFinite(new Date(row.stored_at).getTime()))return null;
 let body;
 try{body=JSON.parse(row.body);}catch{return null;}
 if(body?.status!=='SUCCESS'||!day(body.asOfDate)||
  body?.overall?.status!=='READY'||!Array.isArray(body.domains)||
  body.domains.length!==DOMAINS.length)return null;
 const indexed=new Map(body.domains.map(d=>[d?.id,d]));
 if(indexed.size!==DOMAINS.length||
  DOMAINS.some(id=>!indexed.has(id)))return null;
 const input=[['overall',body.overall],...DOMAINS.map(id=>[id,indexed.get(id)])];
 if(input.some(([,x])=>x?.status!=='READY'||!validScore(x.score)||
  (x.asOfDate!=null&&x.asOfDate!==body.asOfDate)))return null;
 const items=input.map(([id,x])=>({id,score:x.score,asOfDate:body.asOfDate,
  methodologyVersion:validVersion(x.methodologyVersion)?x.methodologyVersion:null}));
 // updatedAt has not been proven to be the actual calculatedAt for every
 // output; never synthesize it from a storage timestamp.
 return {snapshotKey:key,storedAt:row.stored_at,asOfDate:body.asOfDate,
  bodySha256:sha(Buffer.from(row.body,'utf8')),outputs:items,
  outputCount:items.length,calculatedAt:null,
  calculationReceiptVerified:false};
}

export function compareD05MarketStored(current,dated,{dayKey}={}){
 const out=base('D05_MARKET_FINAL_STORED_UNVERIFIED',true);
 const a=projectD05MarketRow(current,'current');
 const b=projectD05MarketRow(dated,dayKey);
 if(!a||!b)return {...out,code:'D05_MARKET_FINAL_ROW_INVALID'};
 if(!day(dayKey)||new Date(b.storedAt).toISOString().slice(0,10)!==dayKey)
  return {...out,code:'D05_MARKET_STORED_DAY_MISMATCH'};
 const identical=a.bodySha256===b.bodySha256&&a.storedAt===b.storedAt;
 return {...out,status:identical?'PASS':'BLOCKED',
  code:identical?'D05_MARKET_13_STORED_SNAPSHOT_MATCHED':'D05_MARKET_CURRENT_DAY_MISMATCH',
  sameEventVerified:false,localStoredSnapshotMatched:identical,
  localCurrent:a,localDated:b};
}

export function inspectD05MarketFinalReadonly(dataRoot,{fileSystem=fs,
 openDatabase=openSqliteReadonly}={}){
 let db;
 try{
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
   return base('D05_MARKET_DATA_ROOT_INVALID');
  const root=(fileSystem.realpathSync.native??fileSystem.realpathSync)(dataRoot);
  const file=path.join(dataRoot,'pc-writer','storage','core.sqlite');
  const stat=fileSystem.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>MAX_DB)
   return base('D05_MARKET_DB_UNSAFE');
  const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(file);
  const relative=path.relative(root,real);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||
   path.isAbsolute(relative))return base('D05_MARKET_DB_PATH_UNSAFE');
  db=openDatabase(file);
  const read=k=>db.prepare(
   'SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=? LIMIT 1').get(k);
  const current=read('current');
  if(!Number.isSafeInteger(current?.stored_at)||current.stored_at<=0||
   !Number.isFinite(new Date(current.stored_at).getTime()))
   return base('D05_MARKET_CURRENT_NOT_STORED',true);
  const key=new Date(current.stored_at).toISOString().slice(0,10);
  return compareD05MarketStored(current,read(key),{dayKey:key});
 }catch(error){
  return base(error?.code==='ENOENT'?'D05_MARKET_DB_NOT_FOUND':
   'D05_MARKET_SQLITE_READ_UNVERIFIED',Boolean(db));
 }finally{
  if(db){try{db.exec('ROLLBACK');}catch{}try{db.close();}catch{}}
 }
}
