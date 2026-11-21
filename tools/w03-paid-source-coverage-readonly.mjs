// Bounded, fixed-source W03 derived lineage coverage. Proprietary prices never leave the PC.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:\\ZGmini\data';
const MODE='MARKETPARQUET_PAID_SPLIT_ADJUSTED_1H_NY_PROXY_V1';
const SHA=/^[a-f0-9]{64}$/,DATE=/^20\d\d-\d\d-\d\d$/;
const SYMBOLS=['SPY','WISE','IGV','XSW','AIQ'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const date=s=>typeof s==='string'&&DATE.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const unknown=code=>({status:'STATE_UNKNOWN',code});
function safeFile(file,root,max,sys){
 const rel=path.win32.relative(root,file);
 if(!rel||rel.startsWith('..')||path.win32.isAbsolute(rel))throw Error('PATH_OUTSIDE');
 let pos=root;
 for(const part of rel.split(/[\\/]/).slice(0,-1)){
  const st=sys.lstatSync(pos);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('UNSAFE_DIRECTORY');
  pos=path.win32.join(pos,part);
 }
 const dir=sys.lstatSync(pos),stat=sys.lstatSync(file);
 if(!dir.isDirectory()||dir.isSymbolicLink()||!stat.isFile()||
    stat.isSymbolicLink()||stat.size<2||stat.size>max)throw Error('UNSAFE_FILE');
 const bytes=sys.readFileSync(file);
 if(bytes.length!==stat.size)throw Error('UNSTABLE_FILE');
 return bytes;
}
function json(file,root,max,sys){return JSON.parse(safeFile(file,root,max,sys).toString('utf8'));}
function entries(dir,limit,sys){
 const all=sys.readdirSync(dir,{withFileTypes:true});
 if(all.length>limit)throw Error('TOO_MANY_FILES');
 return all;
}
function payload(raw){
 const text=raw.toString('utf8').trim();
 let rpc;
 if(text.startsWith('{'))rpc=JSON.parse(text);
 else {
  const blocks=text.split(/\r?\n/).filter(s=>s.startsWith('data: '));
  if(blocks.length!==1)throw Error('RPC_FORMAT');
  rpc=JSON.parse(blocks[0].slice(6));
 }
 if(rpc.error||rpc.result?.isError||!rpc.result)throw Error('RPC_ERROR');
 return rpc.result.structuredContent??
  JSON.parse(rpc.result.content.find(x=>x.type==='text').text);
}
function verifyGeneration(home,universe,root,report,record,sys){
 const pointer=json(path.win32.join(home,universe,'ACTIVE.json'),root,4096,sys);
 if(!date(pointer.date)||pointer.date!==report.sourceLatestDate||
   !['.',`generations/${pointer.date}`].includes(pointer.directory))
  throw Error('ACTIVE_NOT_CURRENT');
 const dir=pointer.directory==='.'?path.win32.join(home,universe):
  path.win32.join(home,universe,'generations',pointer.date);
 const names=entries(dir,80,sys).map(e=>{
  if(e.isSymbolicLink())throw Error('SYMLINK');
  return e.name;
 });
 const receiptNames=names.filter(s=>/^20\d\d-\d\d-\d\d_20\d\d-\d\d-\d\d\.json\.receipt\.json$/.test(s)).sort();
 if(!receiptNames.length||receiptNames.length>24)throw Error('RECEIPT_COUNT');
 const proofs=receiptNames.map(n=>json(path.win32.join(dir,n),root,10000,sys));
 if(!proofs.every(p=>p.schema==='ZGMINI_PAID_HOURLY_RESPONSE_V1'&&p.plan==='full'&&
   p.asset==='etf_1hour'&&p.priceMode===MODE&&
   p.universeSha256===universe&&SHA.test(p.sha256??'')&&
   date(p.start)&&date(p.end)&&p.start<=p.end&&
   Array.isArray(p.symbols)&&p.symbols.length<=200&&
   SYMBOLS.every(s=>p.symbols.includes(s))&&
   sha(JSON.stringify([...p.symbols].sort()))===universe))
  throw Error('RECEIPT_INVALID');
 const phases={confirmed:report.confirmedDate,provisional:report.provisionalDate,
  sourceLatest:report.sourceLatestDate,confirmedLagHours:0,provisionalLagHours:0,
  clockBasis:'PROVIDER_PUBLISHED_PROXY_BAR_END'};
 const sourceVersion=sha(JSON.stringify({registry:record.registrySha256,proofs,
  priceMode:MODE,phases}));
 if(sourceVersion!==record.sourceVersion)return null;
 const seen=Object.fromEntries(SYMBOLS.map(s=>[s,new Set()]));
 let verified=0,totalBytes=0;
 for(let i=0;i<receiptNames.length;i++){
  const r=proofs[i],file=path.win32.join(dir,receiptNames[i].replace('.receipt.json',''));
  const bytes=safeFile(file,root,16000000,sys);totalBytes+=bytes.length;
  if(totalBytes>128000000||sha(bytes)!==r.sha256)throw Error('RECEIPT_BYTES_MISMATCH');
  const value=payload(bytes);
  if(!Array.isArray(value.columns)||!Array.isArray(value.rows)||value.truncated!==false||
    value.rows.length>200)throw Error('COVERAGE_ROWS_INVALID');
  const di=value.columns.indexOf('trade_date'),oi=value.columns.indexOf('observations');
  if(di<0||oi<0)throw Error('COVERAGE_COLUMNS');
  let prev='';
  for(const row of value.rows){
   const d=row[di];
   if(!date(d)||d<r.start||d>r.end||d<=prev)throw Error('COVERAGE_DATE');
   prev=d;
   const observations=typeof row[oi]==='string'?JSON.parse(row[oi]):row[oi];
   if(!Array.isArray(observations)||observations.length>200)throw Error('COVERAGE_BARS');
   const rowSeen=new Set();
   for(const bar of observations){
    if(!bar||typeof bar.symbol!=='string'||rowSeen.has(bar.symbol)||
      !r.symbols.includes(bar.symbol)||!Number.isFinite(bar.close)||bar.close<=0||
      typeof (bar.bar_time??bar.timestamp)!=='string'||
      !(bar.bar_time??bar.timestamp).startsWith(d))
      throw Error('COVERAGE_BAR_INVALID');
    rowSeen.add(bar.symbol);
    if(SYMBOLS.includes(bar.symbol))seen[bar.symbol].add(d);
   }
  }
  verified++;
 }
 const spyDays=[...seen.SPY].sort();
 const perSymbol=Object.fromEntries(SYMBOLS.map(s=>{
  const days=[...seen[s]].filter(d=>seen.SPY.has(d)).sort();
  let consecutive=0,longest=0,longestBeforeNov02=0,first40ContinuousDate=null;
  let maxContinuousEndingInWiseAumWindow=0,daysWith40ContinuousInWiseAumWindow=0;
  for(const d of spyDays){
   consecutive=seen[s].has(d)?consecutive+1:0;
   longest=Math.max(longest,consecutive);
   if(d<'2026-11-02')longestBeforeNov02=Math.max(longestBeforeNov02,consecutive);
   if(!first40ContinuousDate&&consecutive>=40)first40ContinuousDate=d;
   if(d>='2026-06-30'&&d<'2026-11-02'){
    maxContinuousEndingInWiseAumWindow=Math.max(maxContinuousEndingInWiseAumWindow,consecutive);
    if(consecutive>=40)daysWith40ContinuousInWiseAumWindow++;
   }
  }
  return [s,{storedSessions:days.length,firstDate:days[0]??null,
   lastDate:days.at(-1)??null,first40RealSessionsDate:days[39]??null,
   longestContinuousSpySessions:longest,
   longestContinuousSpySessionsBefore20261102:longestBeforeNov02,
   first40ContinuousSpySessionsDate:first40ContinuousDate,
   maxContinuousEndingIn20260630To20261101:maxContinuousEndingInWiseAumWindow,
   daysWith40ContinuousEndingIn20260630To20261101:daysWith40ContinuousInWiseAumWindow,
   sessionsBefore20261102:days.filter(d=>d<'2026-11-02').length,
   sessionsOnOrAfter20261102:days.filter(d=>d>='2026-11-02').length}];
 }));
 return {status:'PASS',code:'W03_PAID_SOURCE_VERSION_VERIFIED',
  receiptCount:verified,sourceVersion,matchedUniverseSha256:universe,
  spySessions:spyDays.length,perSymbol};
}
export function inspectW03PaidSourceCoverage({root=ROOT,fileSystem=fs,report,record}={}){
 if(!report||!record||!SHA.test(record.sourceVersion??'')||
   !SHA.test(record.registrySha256??'')||!date(report.sourceLatestDate)||
   !date(report.confirmedDate)||!date(report.provisionalDate))
  return unknown('W03_SOURCE_PROVENANCE_UNAVAILABLE');
 const home=path.win32.join(root,'pc-writer','marketparquet-paid','hourly-selected');
 try{
  const items=entries(home,40,fileSystem);
  const dirs=items.filter(x=>x.isDirectory()&&SHA.test(x.name));
  if(dirs.length>16)return unknown('W03_SOURCE_GENERATIONS_AMBIGUOUS');
  const matches=[];
  for(const d of dirs){
   try{
    const result=verifyGeneration(home,d.name,root,report,record,fileSystem);
    if(result)matches.push(result);
   }catch{continue;}
  }
  if(matches.length!==1)return unknown(matches.length?
   'W03_SOURCE_MULTIPLE_MATCHES':'W03_SOURCE_VERSION_NOT_FOUND');
  return matches[0];
 }catch{return unknown('W03_SOURCE_STORE_UNAVAILABLE');}
}
