// Fixed, sanitized W03 private paid-theme runtime readback. No provider/DB/D1/network writes.
// No Issue arguments select a path, asset or theme; only the approved operating PC.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';
import {inspectW03PaidSourceCoverage} from './w03-paid-source-coverage-readonly.mjs';

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
 // Publisher changes only the top-level status after the private calculation and
 // local SHA readback. Do not mistake an unchanged public CAS for no private run.
 if(!['PRIVATE_CALCULATED','UNCHANGED_READBACK_VERIFIED',
   'D1_CAS_READBACK_VERIFIED'].includes(report.status))
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
 const sourceCoverage=dates.length<252?
  inspectW03PaidSourceCoverage({root,fileSystem,report,record}):null;
 return {status:dates.length===252?'PASS':'PARTIAL',code:dates.length===252?
  'W03_AI_PRIVATE_252_READBACK_VERIFIED':'W03_AI_PRIVATE_PARTIAL_HISTORY',
  ...common,themeId:ID,privateStoreStatus:STATUS,privateThemeCount:stored.count,
  privateBodySha256:stored.bodySha256,historyPoints:dates.length,
  firstDate:dates.length?dates[0].date:null,lastDate:prev,
  sourceVersion:record.sourceVersion,registrySha256:record.registrySha256,
  ...(sourceCoverage?{sourceCoverage}:{}),
  operationalWrites:0,providerCalls:0,d1Writes:0};
}

 
// D05: reuse the exact already-approved final-output Reader, not the scorer.
// Fixed PC paths only; no request-supplied file, import, command or time range.
// Candidate data and scores never leave the PC; only counts, dates and digests.
const D05_SOURCE_ROOT='E:/ZGmini/projects/zgmini-earnings-history-pc-release';
const D05_PINS=Object.freeze({
 'lib/score-history/d05-final-theme-candidate-readback-r1.mjs':'1eab44663396b43aa29d25d0c9618b5bf1cce5850199fa36251b6f43aaaa6267',
 'lib/score-history/d05-final-score-output-events-r1.mjs':'07283b49b13914f86f41ae54dbf88f95f5ea9f92db3e2276871ef3a6e80793b0',
 'worker/theme-paid-contract.mjs':'a02fc6d6ccddfad2ed3abb33132b44f188e4249c0fdbb6be3e5d0cf7ca08a91b'
});
const D05_CANDIDATE=/^theme-([a-f0-9]{64})\.json$/;
const d05Unknown=code=>UNKNOWN(code,{scope:'PAID_PUBLIC_FINAL_OUTPUTS_ONLY',
 expectedThemeCount:30,actualFinalOutputCoverageVerified:false,
 oneYearComplete:false});
const d05Iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&
 new Date(x).toISOString()===x;
const kstDay=ms=>new Date(ms+32400000).toISOString().slice(0,10);

export function summarizeD05ThemeCandidates(names,readOne,{
 now=Date.now(),deadline=Date.now()+90000,receipt=null
}={}){
 if(!Array.isArray(names)||names.length>10000||
    names.some(n=>typeof n!=='string'||!D05_CANDIDATE.test(n))||
    new Set(names).size!==names.length)return d05Unknown('D05_THEME_ARCHIVE_INVENTORY_INVALID');
 const days=new Map(),seen=new Map();
 let scanned=0,valid=0,rejected=0,conflicts=0,actualEvents=0,receiptMatch=false;
 let latest=null;
 for(const name of [...names].sort()){
  if(Date.now()>deadline)break;
  scanned++;
  let rows;
  try{rows=readOne(name);}catch{rejected++;continue;}
  if(!Array.isArray(rows)||rows.some(e=>!e||
   !/^theme:[a-z][a-z0-9-]{0,119}$/.test(e.scoreId??'')||
   e.phase!=='CONFIRMED'||!d05Iso(e.calculatedAt)||
   Date.parse(e.calculatedAt)>now||e.calculatedDateKst!==kstDay(Date.parse(e.calculatedAt))||
   !safeDate(e.asOfDate)||!SHA.test(e.eventId??'')||
   !Number.isFinite(e.score)||e.score<0||e.score>100)){rejected++;continue;}
  valid++;
  actualEvents+=rows.length;
  if(receipt?.status==='LOCAL_FINAL_THEME_OUTPUT_VERIFIED'&&
   receipt.candidateBodySha256===D05_CANDIDATE.exec(name)[1]&&
   Number.isInteger(receipt.scoreCount)&&receipt.scoreCount===rows.length&&rows.length>0&&
   rows.every(e=>e.calculatedAt===receipt.calculatedAt)&&
   SHA.test(receipt.outputEventsSha256??'')&&
   digest(Buffer.from(JSON.stringify(rows.map(e=>e.eventId).sort())))===receipt.outputEventsSha256)
   receiptMatch=true;
  for(const e of rows){
   const clock=e.scoreId+'|'+e.calculatedAt;
   const prior=seen.get(clock);
   if(prior&&prior!==e.eventId){conflicts++;continue;}
   seen.set(clock,e.eventId);
   const key=e.scoreId+'|'+e.calculatedDateKst;
   const old=days.get(key);
   if(!old||old.calculatedAt<e.calculatedAt)days.set(key,e);
   if(latest===null||e.calculatedAt>latest)latest=e.calculatedAt;
  }
 }
 const dates=new Map(),themes=new Set();
 for(const e of days.values()){
  themes.add(e.scoreId);
  if(!dates.has(e.calculatedDateKst))dates.set(e.calculatedDateKst,new Set());
  dates.get(e.calculatedDateKst).add(e.scoreId);
 }
 const sorted=[...dates.keys()].sort();
 const lastDay=sorted.at(-1)??null,lastCount=dates.get(lastDay)?.size??0;
 const completeScan=scanned===names.length&&rejected===0&&conflicts===0;
 const coverage=completeScan&&themes.size===30&&lastCount===30;
 return {status:coverage?'PASS':'PARTIAL',
  code:coverage?'D05_THEME_FINAL_OUTPUTS_READBACK_VERIFIED':'D05_THEME_FINAL_OUTPUTS_INCOMPLETE',
  scope:'PAID_PUBLIC_FINAL_OUTPUTS_ONLY',expectedThemeCount:30,
  candidateFiles:names.length,scannedCandidateFiles:scanned,
  validCandidateFiles:valid,rejectedCandidateFiles:rejected,clockConflicts:conflicts,
  archiveScanComplete:completeScan,actualOutputEvents:actualEvents,
  dailyFinalScorePoints:days.size,distinctThemeCount:themes.size,distinctCalculationDates:dates.size,
  complete30Dates:[...dates.values()].filter(x=>x.size===30).length,
  earliestCalculatedDate:sorted[0]??null,latestCalculatedDate:lastDay,
  latestCalculatedAt:latest,latestDateThemeCount:lastCount,
  currentReceiptMatched:receiptMatch,
  dailyEventsSha256:digest(Buffer.from(JSON.stringify([...days.values()].map(e=>e.eventId).sort()))),
  actualFinalOutputCoverageVerified:coverage,oneYearComplete:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}

export async function inspectD05PaidThemeFinalOutputsReadonly(){
 try{
  const sourceRoot=fs.realpathSync.native(D05_SOURCE_ROOT);
  const dataRoot=fs.realpathSync.native(ROOT);
  const read=(filename,root,maxBytes)=>readFixedReadonlyBytes(filename,
   {verifiedRoot:root,minBytes:2,maxBytes});
  const pinsMatch=()=>Object.entries(D05_PINS).every(([rel,expected])=>{
   const v=read(path.join(sourceRoot,rel),sourceRoot,256*1024);
   return v.ok&&digest(v.bytes)===expected;
  });
  if(!pinsMatch())return d05Unknown('D05_THEME_READER_SOURCE_HASH_MISMATCH');
  const dir=path.join(dataRoot,'pc-writer','marketparquet-paid','derived');
  const leaf=fs.lstatSync(dir);
  const resolved=fs.realpathSync.native(dir),rel=path.relative(dataRoot,resolved);
  if(!leaf.isDirectory()||leaf.isSymbolicLink()||!rel||rel==='..'||
   rel.startsWith('..'+path.sep)||path.isAbsolute(rel))
   return d05Unknown('D05_THEME_ARCHIVE_PATH_UNSAFE');
  const names=fs.readdirSync(dir).filter(n=>D05_CANDIDATE.test(n));
  if(names.length>10000)return d05Unknown('D05_THEME_ARCHIVE_INVENTORY_INVALID');
  const run=read(path.join(dataRoot,'pc-writer','marketparquet-paid','theme-last-run.json'),
   dataRoot,524288);
  let receipt=null;
  if(run.ok)try{receipt=JSON.parse(run.bytes.toString('utf8')).d05FinalOutputReadback??null;}catch{}
  // Three exact immutable approved modules, no caller-supplied code.
  const {readStoredPaidThemeFinalScoreDays}=await import(pathToFileURL(
   path.join(sourceRoot,'lib/score-history/d05-final-theme-candidate-readback-r1.mjs')).href);
  const now=Date.now(),fromDay=kstDay(now-365*86400000),toDay=kstDay(now);
  const result=summarizeD05ThemeCandidates(names,name=>{
   const expected=path.join(dir,name);
   const bytes=read(expected,dataRoot,1800000);
   if(!bytes.ok)throw Error('D05_THEME_CANDIDATE_READ_UNVERIFIED');
   // Feed only this bounded, safely opened immutable candidate to the existing
   // Reader; it validates filename SHA, contract, clock and final scores.
   const fileSystem={readdirSync:d=>{
    if(d!==dir)throw Error('D05_THEME_DIRECTORY_SCOPE');return [name];
   },readFileSync:f=>{
    if(f!==expected)throw Error('D05_THEME_FILE_SCOPE');return bytes.bytes;
   }};
   return readStoredPaidThemeFinalScoreDays({directory:dir,fromDay,toDay,now,fileSystem}).points;
  },{now,receipt,deadline:now+90000});
  if(!pinsMatch())return d05Unknown('D05_THEME_READER_SOURCE_CHANGED');
  const after=fs.readdirSync(dir).filter(n=>D05_CANDIDATE.test(n)).sort();
  if(JSON.stringify([...names].sort())!==JSON.stringify(after))
   return {...result,status:'PARTIAL',code:'D05_THEME_ARCHIVE_CHANGED_DURING_READ',
    archiveScanComplete:false,actualFinalOutputCoverageVerified:false};
  return result;
 }catch{return d05Unknown('D05_THEME_ARCHIVE_READ_UNVERIFIED');}
}
