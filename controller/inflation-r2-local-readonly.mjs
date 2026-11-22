// W01 R2 exact-key local projection inspection. A/light, fixed read-only scope.
// No provider calls, D1 access, data writes, or user-selected SQL/paths.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const W01_R2_KEY='detail:inflation:v1';
const hash=body=>createHash('sha256').update(Buffer.from(body,'utf8')).digest('hex');
const safeDay=v=>typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&
 Number.isFinite(Date.parse(v+'T00:00:00Z'))&&
 new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const status=(code,extra={})=>({status:'STATE_UNKNOWN',code,key:W01_R2_KEY,
 providerCalls:0,d1Writes:0,operationalWrites:0,...extra});

export function inspectInflationR2Row(row){
 if(!row)return status('W01_R2_LOCAL_ROW_MISSING');
 if(typeof row.body!=='string'||Buffer.byteLength(row.body,'utf8')>262144||
   !Number.isSafeInteger(Number(row.stored_at))||Number(row.stored_at)<=0)
  return status('W01_R2_ROW_INVALID');
 let envelope;try{envelope=JSON.parse(row.body);}catch{
  return status('W01_R2_ROW_INVALID_JSON');
 }
 const p=envelope?.payload,meta=envelope?.projection,trend=p?.trend;
 if(!p||!meta||!Array.isArray(trend)||trend.length>12)
  return status('W01_R2_CONTRACT_INVALID',{storedAt:Number(row.stored_at),bodySha256:hash(row.body)});
 const last=trend.at(-1);
 const valid= p.status==='READY'&&p.methodologyVersion==='INFLATION_R2_R29_56_IA'&&
  typeof p.score==='number'&&Number.isFinite(p.score)&&p.score>=0&&p.score<=100&&
  safeDay(p.asOfDate)&&meta.status==='READY'&&
  typeof meta.sourceVersion==='string'&&meta.sourceVersion.length>0&&
  Number.isSafeInteger(meta.sourceStoredAt)&&meta.sourceStoredAt>0&&
  Number.isSafeInteger(meta.builtAt)&&meta.builtAt>0&&
  Number.isSafeInteger(Number(row.stored_at))&&
  trend.length>0&&safeDay(last?.label)&&typeof last.value==='number'&&
  Number.isFinite(last.value);
 const values={storedAt:Number(row.stored_at),bodySha256:hash(row.body),
  projectionStatus:meta.status??null,payloadStatus:p.status??null,
  methodologyVersion:p.methodologyVersion??null,score:Number.isFinite(p.score)?p.score:null,
  asOfDate:safeDay(p.asOfDate)?p.asOfDate:null,
  trendLength:trend.length,lastTrendLabel:safeDay(last?.label)?last.label:null,
  lastTrendValue:Number.isFinite(last?.value)?last.value:null,
  sourceVersion:typeof meta.sourceVersion==='string'?meta.sourceVersion:null,
  sourceStoredAt:Number.isSafeInteger(meta.sourceStoredAt)?meta.sourceStoredAt:null,
  projectionBuiltAt:Number.isSafeInteger(meta.builtAt)?meta.builtAt:null,
  trendDateMatchesAsOf:valid&&last.label===p.asOfDate,
  trendValueMatchesScore:valid&&last.value===p.score};
 if(!valid)return status('W01_R2_CONTRACT_INVALID',values);
 return {status:'PASS',code:values.trendDateMatchesAsOf&&values.trendValueMatchesScore?
  'W01_R2_LOCAL_DATE_VALUE_MATCH':'W01_R2_LOCAL_DATE_VALUE_MISMATCH',
  key:W01_R2_KEY,...values,providerCalls:0,d1Writes:0,operationalWrites:0};
}

// Fixed local report metadata; never expose full Writer config or report bodies.
function fixedMetadata(dataRoot,fileSystem,name){
 const file=path.join(dataRoot,'pc-writer',name);
 try{
  const stat=fileSystem.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>131072)
   return null;
  const record=JSON.parse(fileSystem.readFileSync(file,'utf8'));
  if(!record||typeof record!=='object'||Array.isArray(record))return null;
  const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)?v:null;
  const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&
   new Date(v).toISOString()===v?v:null;
  return name==='config.json'?{configSource:sha(record.source)}:
   name==='local-cycle-last-run.json'?
    {coreCycleAt:instant(record.at),coreCycleStatus:typeof record.status==='string'&&
     /^[A-Z_]{1,50}$/.test(record.status)?record.status:null}:
    {writerAt:instant(record.at),writerSource:sha(record.source)};
 }catch{return null;}
}

export function inspectInflationR2LocalReadonly(dataRoot,{
 fileSystem=fs,openDatabase=file=>new DatabaseSync(file,{readOnly:true,timeout:1000})
}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return status('W01_R2_ROOT_INVALID',{sqliteOpened:false});
 const file=path.join(dataRoot,'pc-writer','storage','core.sqlite');
 let db;
 try{
  const canonical=fileSystem.realpathSync.native(dataRoot);
  const stat=fileSystem.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>2_000_000_000)
   return status('W01_R2_DB_FILE_UNSAFE',{sqliteOpened:false});
  const real=fileSystem.realpathSync.native(file);
  const relative=path.relative(canonical,real);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))
   return status('W01_R2_DB_PATH_UNSAFE',{sqliteOpened:false});
  db=openDatabase(file);
  db.exec('PRAGMA query_only=ON');
  const row=db.prepare('SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?')
   .get(W01_R2_KEY);
  return {...inspectInflationR2Row(row),sqliteOpened:true,
   config:fixedMetadata(dataRoot,fileSystem,'config.json'),
   core:fixedMetadata(dataRoot,fileSystem,'local-cycle-last-run.json'),
   writer:fixedMetadata(dataRoot,fileSystem,'local-writer-last-run.json'),
   runtimeWriterSourceVerified:false,
   evidenceScope:'LOCAL_SQLITE_ONLY_NOT_D1_OR_PRODUCTION'};
 }catch(error){
  return status('W01_R2_LOCAL_READ_FAILED',{sqliteOpened:Boolean(db),
   errorCode:/^SQLITE_[A-Z_]+$/.test(error?.code??'')?error.code:'READ_ERROR'});
 }finally{try{db?.close();}catch{}}
}
