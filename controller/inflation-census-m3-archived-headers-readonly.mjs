// W01 fixed A/light: classify already archived 2025/2026 Census M3 API headers.
// Never fetch providers, print observation values or change operational files.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const DATA_ROOT=String.raw`E:\ZGmini\data`;
const ARCHIVE=/^census-m3-mtm-(2025|2026)-([a-f0-9]{64})\.json$/;
const REQUIRED=Object.freeze(['data_type_code','seasonally_adj','category_code','cell_value','us']);
const ALLOWED=new Set([...REQUIRED,'time','time_slot_date','time_slot_id','error_data']);
const MAX_BYTES=5_000_000;
const HASH=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>({status:'STATE_UNKNOWN',code,archives:[],archiveCount:0,invalidCount:0,
  providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false});
const fail=code=>Object.assign(new Error(code),{code});

function safeDirectory(dir){
  let stat;
  try{stat=fs.lstatSync(dir);}catch{throw fail('W01_CENSUS_ARCHIVE_DIR_UNAVAILABLE');}
  if(!stat.isDirectory()||stat.isSymbolicLink())
    throw fail('W01_CENSUS_ARCHIVE_DIR_UNSAFE');
  return fs.realpathSync.native(dir);
}
function classify(bytes){
  let obj;
  try{obj=JSON.parse(bytes.toString('utf8'));}
  catch{return {shape:'JSON_INVALID',missingRequired:[...REQUIRED],hasMonthlyDate:false,
    duplicateHeaderCount:0,unknownHeaderCount:0,rowCount:null};}
  if(!Array.isArray(obj)||obj.length<1||obj.length>20000||!Array.isArray(obj[0]))
    return {shape:'SHAPE_INVALID',missingRequired:[...REQUIRED],hasMonthlyDate:false,
      duplicateHeaderCount:0,unknownHeaderCount:0,rowCount:null};
  const headers=obj[0].map(v=>typeof v==='string'?v.trim().toLowerCase():null);
  const names=headers.filter(Boolean),keys=new Set(names);
  const duplicateHeaderCount=names.length-keys.size;
  const missingRequired=REQUIRED.filter(k=>!keys.has(k));
  const hasMonthlyDate=keys.has('time_slot_date')||keys.has('time');
  const unknownHeaderCount=[...keys].filter(k=>!ALLOWED.has(k)).length;
  // Mirror the actual Census collector's effective schema: only consumed
  // selector/date headers must be present exactly once. Unused supplier
  // metadata, including empty or repeated labels, remains diagnostic only.
  const consumed=[...REQUIRED,...['time_slot_date','time'].filter(key=>keys.has(key))];
  // Report ONLY fixed parser-consumed vocabulary. No provider-supplied column
  // names, response bodies, observation values, credentials or file paths.
  const duplicateConsumedHeaders=consumed.filter(key=>
    headers.filter(header=>header===key).length>1);
  const valid=!missingRequired.length&&hasMonthlyDate&&
    consumed.every(key=>headers.filter(header=>header===key).length===1);
  return {shape:valid?'HEADERS_VALID':'HEADERS_INVALID',missingRequired,hasMonthlyDate,
    duplicateHeaderCount,duplicateConsumedHeaders,unknownHeaderCount,rowCount:obj.length-1};
}

function inspectArchive(rawDir,name){
  const match=name.match(ARCHIVE);
  if(!match)throw fail('W01_CENSUS_ARCHIVE_NAME_DENIED');
  const file=path.join(rawDir,name);
  let stat;
  try{stat=fs.lstatSync(file);}catch{throw fail('W01_CENSUS_ARCHIVE_MISSING');}
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>MAX_BYTES)
    throw fail('W01_CENSUS_ARCHIVE_FILE_UNSAFE');
  const real=fs.realpathSync.native(file);
  if(path.dirname(real)!==rawDir)throw fail('W01_CENSUS_ARCHIVE_PATH_ESCAPE');
  const bytes=fs.readFileSync(file),digest=HASH(bytes);
  if(bytes.length!==stat.size||digest!==match[2])
    throw fail('W01_CENSUS_ARCHIVE_HASH_MISMATCH');
  const again=fs.readFileSync(file);
  if(again.length!==bytes.length||HASH(again)!==digest)
    throw fail('W01_CENSUS_ARCHIVE_READ_DRIFT');
  return {year:Number(match[1]),sourceSha256:digest,...classify(bytes)};
}
export function inspectInflationCensusM3ArchivedHeaders(dataRoot,{strictPlatform=true}={}){
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||
     (strictPlatform&&(process.platform!=='win32'||
       path.win32.normalize(dataRoot).toLowerCase()!==
       path.win32.normalize(DATA_ROOT).toLowerCase())))
    return stop('W01_CENSUS_ARCHIVE_ROOT_DENIED');
  try{
    const root=safeDirectory(dataRoot);
    const pcWriter=safeDirectory(path.join(root,'pc-writer'));
    const candidate=safeDirectory(path.join(pcWriter,'inflation-causal-candidates-r1'));
    const rawDir=safeDirectory(path.join(candidate,'raw'));
    const names=fs.readdirSync(rawDir).filter(n=>ARCHIVE.test(n)).sort();
    if(!names.length)return stop('W01_CENSUS_ARCHIVE_NOT_FOUND');
    if(names.length>32)return stop('W01_CENSUS_ARCHIVE_COUNT_LIMIT');
    const archives=names.map(n=>inspectArchive(rawDir,n));
    const available=new Set(archives.map(x=>x.year));
    const missingYears=[2025,2026].filter(y=>!available.has(y));
    const invalidCount=archives.filter(x=>x.shape!=='HEADERS_VALID').length;
    return {status:missingYears.length?'PARTIAL':invalidCount?'DIAGNOSED':'PASS',
      code:missingYears.length?'W01_CENSUS_ARCHIVE_YEAR_MISSING':
        invalidCount?'W01_CENSUS_ARCHIVE_HEADER_MISMATCH':
          'W01_CENSUS_ARCHIVE_HEADER_MATCH',
      archives,archiveCount:archives.length,invalidCount,missingYears,
      evidenceScope:'FIXED_2025_2026_ARCHIVE_HEADER_ONLY',
      providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false};
  }catch(e){
    return stop(/^W01_CENSUS_ARCHIVE_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
      'W01_CENSUS_ARCHIVE_READ_UNVERIFIED');
  }
}
