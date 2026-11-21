// Fixed, sanitized W03 private paid-theme runtime readback. No provider/DB/D1/network writes.
// No Issue arguments select a path, asset or theme; only the approved operating PC.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:\\ZGmini\\data';
const SHA=/^[0-9a-f]{64}$/;
const DATE=/^20\d\d-\d\d-\d\d$/;
const CODE=/^[A-Z][A-Z0-9_]{0,79}$/;
const ID='ai-software';
const STATUS='PRIVATE_STORED_READBACK_VERIFIED';
const UNKNOWN=(code,extra={})=>({status:'STATE_UNKNOWN',code,...extra,operationalWrites:0,providerCalls:0,d1Writes:0});
const digest=b=>createHash('sha256').update(b).digest('hex');
const safeCode=s=>typeof s==='string'&&CODE.test(s)?s:null;
const safeDate=s=>typeof s==='string'&&DATE.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?s:null;

function readFixedJson(filename,root,maxBytes,fileSystem){
 let fd;
 try{
  // Only constant paths and a validated digest-named private derivative are allowed.
  const rel=path.win32.relative(root,filename);
  if(!rel||rel.startsWith('..')||path.win32.isAbsolute(rel))
   return {ok:false,code:'W03_PATH_OUTSIDE_DATA_ROOT'};
  let walk=root;
  for(const seg of rel.split(/[\\/]/).slice(0,-1)){
   const d=fileSystem.lstatSync(walk);
   if(!d.isDirectory()||d.isSymbolicLink())return {ok:false,code:'W03_PATH_UNSAFE'};
   walk=path.win32.join(walk,seg);
  }
  const parent=fileSystem.lstatSync(walk);
  if(!parent.isDirectory()||parent.isSymbolicLink())return {ok:false,code:'W03_PATH_UNSAFE'};
  const stat=fileSystem.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>maxBytes)
   return {ok:false,code:'W03_FILE_UNSAFE'};
  fd=fileSystem.openSync(filename,'r');
  const before=fileSystem.fstatSync(fd);
  if(!before.isFile()||before.size!==stat.size||before.size>maxBytes)
   return {ok:false,code:'W03_FILE_CHANGED'};
  const bytes=Buffer.alloc(before.size);
  let offset=0;
  while(offset<bytes.length){
   const count=fileSystem.readSync(fd,bytes,offset,bytes.length-offset,offset);
   if(count<=0)return {ok:false,code:'W03_FILE_CHANGED'};
   offset+=count;
  }
  const after=fileSystem.fstatSync(fd);
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)
   return {ok:false,code:'W03_FILE_CHANGED'};
  const obj=JSON.parse(bytes.toString('utf8'));
  if(!obj||typeof obj!=='object'||Array.isArray(obj))
   return {ok:false,code:'W03_JSON_INVALID'};
  return {ok:true,value:obj,bodySha256:digest(bytes)};
 }catch(e){
  return {ok:false,code:e?.code==='ENOENT'?'W03_FILE_NOT_FOUND':'W03_FILE_UNAVAILABLE'};
 }finally{if(fd!==undefined)try{fileSystem.closeSync(fd)}catch{}}
}

export function inspectW03PaidPrivateReadonly({root=ROOT,fileSystem=fs}={}){
 // Runtime call passes no root or fileSystem; injection is only for isolated tests.
 const base=path.win32.join(root,'pc-writer','marketparquet-paid');
 const run=readFixedJson(path.win32.join(base,'theme-last-run.json'),root,524288,fileSystem);
 if(!run.ok)return UNKNOWN('W03_LAST_RUN_'+run.code);
 const report=run.value;
 const common={cycleStatus:safeCode(report.status),confirmedDate:safeDate(report.confirmedDate),
  sourceLatestDate:safeDate(report.sourceLatestDate),lastRunBodySha256:run.bodySha256};
 if(report.status!=='PRIVATE_CALCULATED')
  return UNKNOWN('W03_CYCLE_NOT_CALCULATED',common);
 const privateResult=Array.isArray(report.privateResults)?
  report.privateResults.find(r=>r?.id===ID):null;
 const failure=Array.isArray(report.results)?report.results.find(r=>r?.id===ID):null;
 if(privateResult?.status!=='PRIVATE_CALCULATED_NOT_PUBLISHED')
  return UNKNOWN('W03_AI_SOFTWARE_NOT_CALCULATED',
   {...common,themeResultStatus:safeCode(failure?.status),
    themeFailureCode:safeCode(failure?.code)});
 const stored=report.privateStored;
 if(stored?.status!==STATUS)
  return UNKNOWN('W03_PRIVATE_STORE_NOT_VERIFIED',
   {...common,privateStoreStatus:safeCode(stored?.status),
    privateStoreCode:safeCode(stored?.code)});
 if(!SHA.test(stored.bodySha256??'')||!Number.isInteger(stored.count)||
   stored.count<1||stored.count>163)
  return UNKNOWN('W03_PRIVATE_STORE_METADATA_INVALID',common);
 const filename=path.win32.join(base,'derived','private-theme-'+stored.bodySha256+'.json');
 const privateFile=readFixedJson(filename,root,8*1024*1024,fileSystem);
 if(!privateFile.ok)return UNKNOWN('W03_DERIVED_'+privateFile.code,common);
 if(privateFile.bodySha256!==stored.bodySha256)
  return UNKNOWN('W03_DERIVED_HASH_MISMATCH',common);
 const record=privateFile.value,items=record.themes;
 if(record.schema!=='ZGMINI_PAID_PRIVATE_DERIVED_V1'||
   !SHA.test(record.sourceVersion??'')||!SHA.test(record.registrySha256??'')||
   record.confirmedDate!==common.confirmedDate||
   !Array.isArray(items)||items.length!==stored.count)
  return UNKNOWN('W03_DERIVED_METADATA_MISMATCH',common);
 const item=items.find(t=>t?.id===ID);
 if(!item||item.configured!==true||item.confirmedObservationDate!==common.confirmedDate||
   !Array.isArray(item.history)||item.history.length>252)
  return UNKNOWN('W03_DERIVED_AI_SOFTWARE_MISSING',common);
 const dates=item.history;
 let prev='';
 for(const point of dates){
  const date=safeDate(point?.date);
  if(!date||date<=prev||!Number.isFinite(point?.score)||
    point.score<0||point.score>100)return UNKNOWN('W03_DERIVED_SCORE_INVALID',common);
  prev=date;
 }
 if(prev!==common.confirmedDate)return UNKNOWN('W03_DERIVED_LAST_DATE_MISMATCH',common);
 return {status:'PASS',code:dates.length===252?
  'W03_AI_PRIVATE_252_READBACK_VERIFIED':'W03_AI_PRIVATE_PARTIAL_HISTORY',
  ...common,themeId:ID,privateStoreStatus:STATUS,privateThemeCount:stored.count,
  privateBodySha256:stored.bodySha256,historyPoints:dates.length,
  firstDate:dates.length?dates[0].date:null,lastDate:prev,
  sourceVersion:record.sourceVersion,registrySha256:record.registrySha256,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
