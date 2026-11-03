// A-grade, read-only inventory for #21. #20 is excluded and #31 is not yet
// registered. No provider calls, SQL, arbitrary path, raw values or writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const MAX_JSON_BYTES = 3_000_000;
const MAX_RAW_BYTES = 8_000_000;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function safeDir(dir) {
  try {const s=fs.lstatSync(dir);return s.isDirectory()&&!s.isSymbolicLink();}
  catch {return false;}
}

function regularFile(file, maxBytes) {
  try {
    const info=fs.lstatSync(file);
    return info.isFile()&&!info.isSymbolicLink()&&info.size>0&&info.size<=maxBytes?info:null;
  } catch {return null;}
}

function readJson(file,maxBytes=MAX_JSON_BYTES) {
  const before=regularFile(file,maxBytes);
  if(!before)return {status:fs.existsSync(file)?'INVALID_FILE':'MISSING'};
  try {
    const bytes=fs.readFileSync(file);
    const after=regularFile(file,maxBytes);
    if(!after||before.size!==after.size||before.mtimeMs!==after.mtimeMs||
      before.ino!==after.ino||bytes.length!==before.size)return {status:'UNSTABLE'};
    return {status:'READ',value:JSON.parse(bytes.toString('utf8')),
      sha256:createHash('sha256').update(bytes).digest('hex'),
      fileModifiedAt:after.mtime.toISOString()};
  }catch{return {status:'INVALID_JSON'};}
}

function verifySeries(source) {
  if(source?.source!=='NY_FED_GSCPI'||!Array.isArray(source.rows)||source.rows.length<180)
    return {status:'INVALID_SCHEMA'};
  let previous='',previousIndex=null;
  for(const row of source.rows) {
    const date=row?.observationDate??'';
    const index=MONTH.test(date)?Number(date.slice(0,4))*12+Number(date.slice(5,7)):null;
    if(!MONTH.test(row?.observationDate??'')||row.observationDate<=previous||
      (previousIndex!==null&&index!==previousIndex+1)||
      typeof row.value!=='number'||!Number.isFinite(row.value))return {status:'INVALID_ROWS'};
    previous=row.observationDate;previousIndex=index;
  }
  return {status:'VALID_PARSED',count:source.rows.length,
    firstMonth:source.rows[0].observationDate.slice(0,7),
    lastMonth:source.rows.at(-1).observationDate.slice(0,7),
    vintageMethod:'CURRENT_VINTAGE_ONLY'};
}

function inspectRaw(file) {
  const before=regularFile(file,MAX_RAW_BYTES);
  if(!before)return {status:fs.existsSync(file)?'INVALID_FILE':'MISSING'};
  try {
    const bytes=fs.readFileSync(file),after=regularFile(file,MAX_RAW_BYTES);
    if(!after||before.ino!==after.ino||before.size!==after.size||
      before.mtimeMs!==after.mtimeMs||bytes.length!==before.size)return {status:'UNSTABLE'};
    const magic=bytes.subarray(0,8).toString('hex');
    if((magic==='d0cf11e0a1b11ae1'&&bytes.length<512)||
      (magic.startsWith('504b0304')&&bytes.length<64)||
      (magic!=='d0cf11e0a1b11ae1'&&!magic.startsWith('504b0304')))
      return {status:'INVALID_FORMAT'};
    return {status:'VALID_RAW_CONTAINER',bytes:bytes.length,
      format:magic==='d0cf11e0a1b11ae1'?'OLE_BIFF':'OOXML_ZIP',
      sha256:createHash('sha256').update(bytes).digest('hex')};
  }catch{return {status:'READ_FAILED'};}
}

export function inspectInflationCausalSaved(dataRoot) {
  const output={status:'PASS',code:'INFLATION_CAUSAL_SAVED_STATUS_READONLY',
    excluded20:{status:'EXCLUDED_BY_USER'},
    gscpi21:{status:'MISSING'},
    sce31:{status:'NOT_REGISTERED'},
    // #30 is an independent study candidate, not gated on #21/#31.
    manufacturing30:{status:'NOT_EVALUATED_IN_21_READONLY'},
    providerCalls:0,dbWrites:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)){
    output.status='BLOCKED';output.code='DATA_ROOT_NOT_ABSOLUTE';return output;
  }
  const pcHome=path.join(dataRoot,'pc-writer');
  const supply=path.join(pcHome,'supply-r10');
  if(!safeDir(dataRoot)||!safeDir(pcHome)){
    output.status='BLOCKED';output.code='DATA_ROOT_UNAVAILABLE';return output;
  }
  if(!safeDir(supply))return output;
  // Fixed files under an already-authorized local data root only.
  const parsed=readJson(path.join(supply,'gscpi.json'));
  const raw=inspectRaw(path.join(supply,'gscpi.xlsx'));
  const checkpoint=readJson(path.join(pcHome,'local-supply-r10-collection.json'),65536);
  const manifest=readJson(path.join(supply,'extra-manifest.json'),65536);
  const inputsPresent=Boolean(regularFile(path.join(supply,'inputs.json'),MAX_JSON_BYTES));
  const validation=parsed.status==='READ'?verifySeries(parsed.value):{status:parsed.status};
  const manifestRecord=manifest.status==='READ'&&Array.isArray(manifest.value)?
    manifest.value.find(item=>item?.id==='gscpi'):null;
  const reportedStatus=typeof checkpoint.value?.status==='string'&&
    /^[A-Z_]{2,40}$/.test(checkpoint.value.status)?checkpoint.value.status:null;
  const checkedAt=checkpoint.value?.checkedAt;
  const checkedAtIso=Number.isSafeInteger(checkedAt)&&checkedAt>=0&&checkedAt<=8640000000000000?
    new Date(checkedAt).toISOString():null;
  output.gscpi21={
    status:parsed.status==='MISSING'&&raw.status==='MISSING'?'MISSING':
      validation.status==='VALID_PARSED'&&raw.status==='VALID_RAW_CONTAINER'&&
      manifestRecord?.status==='STORED'?'SAVED_STRUCTURE_VERIFIED':
      validation.status==='VALID_PARSED'?'PARTIAL_SAVED':'NOT_VERIFIED',
    parsedStatus:validation.status,rawStatus:raw.status,
    manifestStatus:manifestRecord?.status==='STORED'?'STORED':manifest.status,
    checkpointStatus:reportedStatus,checkpointCheckedAt:checkedAtIso,
    parsedSha256:parsed.sha256??null,rawSha256:raw.sha256??null,
    rowCount:validation.count??0,firstMonth:validation.firstMonth??null,
    lastMonth:validation.lastMonth??null,rawFormat:raw.format??null,
    rawBytes:raw.bytes??null,inputsPresent,
    fileModifiedAt:parsed.fileModifiedAt??null,
    historyMode:'CURRENT_VINTAGE_ONLY',rawToParsedEqualityVerified:false,
  };
  return output;
}
