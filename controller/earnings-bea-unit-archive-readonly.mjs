// Fixed A-grade BEA unit profit archive attestation. No HTTP, SQLite, D1 or writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';

const SEGMENTS=['pc-writer','raw','earnings-bea-unit-profit-r1'];
const SERIES='A463RD3Q052SBEA';
const SOURCE_URL='https://fred.stlouisfed.org/graph/fredgraph.csv?id='+SERIES;
const SCHEMA='earnings-bea-unit-raw-r1-v1';
const SHA=/^[a-f0-9]{64}$/;
const noWrite=()=>({providerCalls:0,sqliteWrites:0,d1Writes:0,operationalWrites:0,rawExposed:false});
const state=(status,code,extra={})=>({status,code,sourceCount:0,verifiedCount:0,latest:null,...noWrite(),...extra});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function safeFile(filesystem,file,max){
 const stat=filesystem.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<20||stat.size>max)
  throw Error('BEA_UNIT_ARCHIVE_UNSAFE_FILE');
}
function checkSource(filesystem,folder,sha,now){
 const csvFile=path.join(folder,sha+'.csv'),metaFile=path.join(folder,sha+'.json');
 safeFile(filesystem,csvFile,100000);
 safeFile(filesystem,metaFile,10000);
 const csv=filesystem.readFileSync(csvFile);
 if(sha256(csv)!==sha)throw Error('BEA_UNIT_ARCHIVE_SHA_MISMATCH');
 let meta;
 try{meta=JSON.parse(filesystem.readFileSync(metaFile,'utf8'));}
 catch{throw Error('BEA_UNIT_ARCHIVE_META_INVALID');}
 if(!meta||meta.schemaVersion!==SCHEMA||meta.sourceVersion!==sha||
  meta.filename!==sha+'.csv'||meta.seriesId!==SERIES||meta.sourceUrl!==SOURCE_URL||
  meta.byteLength!==csv.length||!Number.isSafeInteger(meta.sourceStoredAt)||
  meta.sourceStoredAt<=0||meta.sourceStoredAt>now||
  meta.sourceRetrievedAt!==new Date(meta.sourceStoredAt).toISOString())
  throw Error('BEA_UNIT_ARCHIVE_META_MISMATCH');
 let decoded;
 try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(csv);}
 catch{throw Error('BEA_UNIT_ARCHIVE_ENCODING_INVALID');}
 const lines=decoded.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.shift()!=='observation_date,'+SERIES||lines.length<5)
  throw Error('BEA_UNIT_ARCHIVE_CSV_INVALID');
 let ordinal=null,lastEnd=null;
 for(const line of lines){
  const cells=line.split(',');
  if(cells.length!==2||!/^\d{4}-(01|04|07|10)-01$/.test(cells[0])||
    !/^-?\d+(?:\.\d+)?$/.test(cells[1])||!Number.isFinite(Number(cells[1])))
   throw Error('BEA_UNIT_ARCHIVE_CSV_INVALID');
  const [year,month]=cells[0].split('-').map(Number);
  const current=year*4+(month-1)/3;
  if(ordinal!==null&&current!==ordinal+1)throw Error('BEA_UNIT_ARCHIVE_PERIOD_GAP');
  ordinal=current;lastEnd=new Date(Date.UTC(year,month+2,0)).toISOString().slice(0,10);
 }
 if(Date.parse(lastEnd+'T23:59:59Z')>meta.sourceStoredAt)
  throw Error('BEA_UNIT_ARCHIVE_FUTURE_PERIOD');
 return {sourceVersion:sha,csvSha256:sha,sourceStoredAt:meta.sourceStoredAt,
  observedThrough:lastEnd,rowCount:lines.length,scope:'CSV_META_SHA_AND_PERIOD_VERIFIED'};
}
/** Only installed Controller supplies the fixed dataRoot; no request-controlled path. */
export function inspectBeaUnitArchiveReadonly(dataRoot,{filesystem=fs,now=Date.now()}={}){
 const unknown=state('STATE_UNKNOWN','BEA_UNIT_ARCHIVE_ROOT_UNVERIFIED');
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||!Number.isSafeInteger(now))
  return unknown;
 try{
  let folder=filesystem.realpathSync(dataRoot);
  if(path.basename(folder).toLowerCase()!=='data'||
     path.basename(path.dirname(folder)).toLowerCase()!=='zgmini')return unknown;
  for(const segment of SEGMENTS){
   folder=path.join(folder,segment);
   let stat;
   try{stat=filesystem.lstatSync(folder);}
   catch(error){
    if(error?.code==='ENOENT')return state('PASS','BEA_UNIT_ARCHIVE_NOT_STORED');
    throw error;
   }
   if(!stat.isDirectory()||stat.isSymbolicLink())
    throw Error('BEA_UNIT_ARCHIVE_UNSAFE_PATH');
  }
  const entries=filesystem.readdirSync(folder);
  if(entries.length>128)return state('STATE_UNKNOWN','BEA_UNIT_ARCHIVE_FILE_LIMIT');
  const names=entries.filter(name=>/^([a-f0-9]{64})\.(csv|json)$/.test(name));
  if(entries.length!==names.length)return state('STATE_UNKNOWN','BEA_UNIT_ARCHIVE_UNEXPECTED_FILE');
  const shas=new Set(names.map(name=>name.slice(0,64)));
  if(!shas.size)return state('PASS','BEA_UNIT_ARCHIVE_NOT_STORED');
  let latest=null;
  for(const sha of shas){
   if(!SHA.test(sha))throw Error('BEA_UNIT_ARCHIVE_INVALID_NAME');
   const row=checkSource(filesystem,folder,sha,now);
   if(!latest||row.sourceStoredAt>latest.sourceStoredAt)latest=row;
  }
  return state('PASS','BEA_UNIT_ARCHIVE_SHA_METADATA_READONLY',
   {sourceCount:shas.size,verifiedCount:shas.size,latest});
 }catch(error){
  const code=String(error?.message??'');
  return state('STATE_UNKNOWN',/^BEA_UNIT_ARCHIVE_[A-Z_]+$/.test(code)?code:'BEA_UNIT_ARCHIVE_UNREADABLE');
 }
}
