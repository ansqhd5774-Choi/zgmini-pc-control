// Fixed A-grade R3-11 PC archive audit. Never returns raw CSV/meta, private paths or credentials.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const REL=['pc-writer','raw','earnings-recession','bea-manufacturing-profits-r5'];
const SERIES='N400RC1Q027SBEA',URL='https://fred.stlouisfed.org/graph/fredgraph.csv?id='+SERIES;
const SHA=/^[a-f0-9]{64}$/;
const noWrite=()=>({providerCalls:0,sqliteWrites:0,d1Writes:0,operationalWrites:0,rawExposed:false});
const blank=code=>({status:'STATE_UNKNOWN',code,sourceCount:0,verifiedCount:0,invalidCount:0,latest:null,...noWrite()});
function fail(code){throw Error(code);}
function safeFile(fsApi,file,max){
 const st=fsApi.lstatSync(file);
 if(st.isSymbolicLink()||!st.isFile())fail('BEA_MFG_ARCHIVE_UNSAFE_PATH');
 if(st.size<1||st.size>max)fail('BEA_MFG_ARCHIVE_FILE_SIZE_INVALID');
}
function ordinal(d){
 if(typeof d!=='string'||!/^(?:19|20)\d{2}-(01|04|07|10)-01$/.test(d))fail('BEA_MFG_ARCHIVE_CSV_INVALID');
 const y=Number(d.slice(0,4)),m=Number(d.slice(5,7));
 return {index:y*4+(m-1)/3,period:y+'-Q'+((m-1)/3+1),
   end:Date.UTC(y,m+2,0,23,59,59)};
}
function pair(folder,sha,fsApi,now){
 const csv=path.join(folder,sha+'.csv'),json=path.join(folder,sha+'.json');
 safeFile(fsApi,csv,100_000);safeFile(fsApi,json,10_000);
 const bytes=fsApi.readFileSync(csv);
 if(createHash('sha256').update(bytes).digest('hex')!==sha)
   fail('BEA_MFG_ARCHIVE_SHA_MISMATCH');
 let meta;
 try{meta=JSON.parse(fsApi.readFileSync(json,'utf8'));}
 catch{fail('BEA_MFG_ARCHIVE_METADATA_INVALID');}
 if(!meta||typeof meta!=='object'||Array.isArray(meta)
   ||meta.schemaVersion!=='earnings-bea-manufacturing-raw-r5-v1'
   ||meta.sourceVersion!==sha||meta.seriesId!==SERIES||meta.sourceUrl!==URL
   ||meta.file!==sha+'.csv'||meta.historicalMode!=='CURRENT_VINTAGE_NOT_PIT'
   ||meta.unit!=='BILLIONS_USD_SAAR'
   ||!Number.isSafeInteger(meta.sourceStoredAt)||meta.sourceStoredAt<=0
   ||meta.sourceStoredAt>now
   ||meta.sourceRetrievedAt!==new Date(meta.sourceStoredAt).toISOString())
   fail('BEA_MFG_ARCHIVE_METADATA_MISMATCH');
 const lines=bytes.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.shift()!=='observation_date,'+SERIES||lines.length<5)
   fail('BEA_MFG_ARCHIVE_CSV_INVALID');
 let prev=null,last=null;
 for(const line of lines){
   const cells=line.split(',');
   if(cells.length!==2||!/^[-+]?\d+(?:\.\d+)?$/.test(cells[1])||!Number.isFinite(Number(cells[1])))
     fail('BEA_MFG_ARCHIVE_CSV_INVALID');
   const point=ordinal(cells[0]);
   if(prev!==null&&point.index!==prev+1)fail('BEA_MFG_ARCHIVE_NONCONTIGUOUS');
   prev=point.index;last=point;
 }
 if(meta.rowCount!==lines.length||meta.latestPeriod!==last.period||last.end>meta.sourceStoredAt)
   fail('BEA_MFG_ARCHIVE_PERIOD_MISMATCH');
 return {sourceVersion:sha,csvSha256:sha,sourceStoredAt:meta.sourceStoredAt,
   rowCount:lines.length,observedThrough:last.period,scope:'CSV_META_SHA_AND_PERIOD_VERIFIED'};
}
/** Only the installed Controller supplies dataRoot. No Issue-controlled path/input. */
export function inspectBeaMfgArchiveReadonly(dataRoot,{filesystem=fs,now=Date.now()}={}){
 const initial=blank('BEA_MFG_ARCHIVE_ROOT_UNVERIFIED');
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||!Number.isSafeInteger(now))
   return initial;
 try{
   let folder=filesystem.realpathSync(dataRoot);
   if(path.basename(folder).toLowerCase()!=='data'
     ||path.basename(path.dirname(folder)).toLowerCase()!=='zgmini')return initial;
   for(const name of REL){
     folder=path.join(folder,name);
     // existsSync follows symlinks: a dangling link is NOT evidence of no archive.
     let st;
     try{st=filesystem.lstatSync(folder);}
     catch(error){
       if(error?.code==='ENOENT')
         return {...initial,status:'PASS',code:'BEA_MFG_ARCHIVE_NOT_STORED'};
       throw error;
     }
     if(st.isSymbolicLink()||!st.isDirectory())fail('BEA_MFG_ARCHIVE_UNSAFE_PATH');
   }
   const entries=filesystem.readdirSync(folder);
   if(entries.length>64)return {...initial,code:'BEA_MFG_ARCHIVE_FILE_COUNT_LIMIT'};
   const shas=new Set(entries.filter(x=>x.endsWith('.csv')&&SHA.test(x.slice(0,-4)))
      .map(x=>x.slice(0,-4)).concat(entries.filter(x=>x.endsWith('.json')&&SHA.test(x.slice(0,-5)))
      .map(x=>x.slice(0,-5))));
   if(!shas.size)return {...initial,status:'PASS',code:'BEA_MFG_ARCHIVE_NOT_STORED'};
   if(shas.size>32)return {...initial,code:'BEA_MFG_ARCHIVE_FILE_COUNT_LIMIT'};
   let verifiedCount=0,invalidCount=0,latest=null,firstFail=null;
   for(const sha of shas){
     try{
       const current=pair(folder,sha,filesystem,now);
       if(latest&&current.sourceStoredAt===latest.sourceStoredAt
         &&current.sourceVersion!==latest.sourceVersion)
         fail('BEA_MFG_ARCHIVE_AMBIGUOUS_LATEST');
       verifiedCount++;
       if(!latest||current.sourceStoredAt>latest.sourceStoredAt)latest=current;
     }catch(error){
       invalidCount++;
       const code=String(error?.message??'');
       if(!firstFail)firstFail=/^BEA_MFG_ARCHIVE_[A-Z_]+$/.test(code)?
         code:'BEA_MFG_ARCHIVE_UNREADABLE';
     }
   }
   return {status:invalidCount?'STATE_UNKNOWN':'PASS',
     code:invalidCount?firstFail:'BEA_MFG_ARCHIVE_SHA_METADATA_READONLY',
     sourceCount:shas.size,verifiedCount,invalidCount,latest,...noWrite()};
 }catch(error){
   const code=String(error?.message??'');
   return {...initial,code:/^BEA_MFG_ARCHIVE_[A-Z_]+$/.test(code)?
     code:'BEA_MFG_ARCHIVE_UNREADABLE'};
 }
}
