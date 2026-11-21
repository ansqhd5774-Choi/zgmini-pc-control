import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectW03PaidSourceCoverage} from '../tools/w03-paid-source-coverage-readonly.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const symbols=['SPY','WISE','IGV','XSW','AIQ'];
const mode='MARKETPARQUET_PAID_SPLIT_ADJUSTED_1H_NY_PROXY_V1';
const dates=Array.from({length:70},(_,i)=>
 new Date(Date.parse('2026-09-01T00:00:00Z')+i*86400000).toISOString().slice(0,10));
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w03-covered-source-'));
 const sorted=[...symbols].sort(),universe=sha(JSON.stringify(sorted));
 const home=path.win32.join(root,'pc-writer','marketparquet-paid','hourly-selected',universe);
 fs.mkdirSync(home,{recursive:true});
 const rows=dates.map((d,i)=>{
  const active=i<10?['SPY']:i<54?['SPY','WISE']:symbols;
  return [d,JSON.stringify(active.map(symbol=>({
   symbol,bar_time:d+' 15:00:00',close:100+i
  })))];
 });
 const raw=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,result:{structuredContent:{
  columns:['trade_date','observations'],rows,truncated:false,row_count:rows.length}}}));
 const basename=dates[0]+'_'+dates.at(-1)+'.json';
 const receipt={schema:'ZGMINI_PAID_HOURLY_RESPONSE_V1',plan:'full',asset:'etf_1hour',
  priceMode:mode,start:dates[0],end:dates.at(-1),universeSha256:universe,
  symbols,sha256:sha(raw),sourceStoredAt:'2026-11-20T17:00:00Z',rows:rows.length};
 const receiptFile=path.win32.join(home,basename+'.receipt.json');
 const dataFile=path.win32.join(home,basename);
 fs.writeFileSync(dataFile,raw);fs.writeFileSync(receiptFile,JSON.stringify(receipt));
 fs.writeFileSync(path.win32.join(home,'ACTIVE.json'),
  JSON.stringify({date:dates.at(-1),directory:'.'}));
 const registrySha256='b'.repeat(64);
 const phases={confirmed:dates.at(-1),provisional:dates.at(-1),
  sourceLatest:dates.at(-1),confirmedLagHours:0,provisionalLagHours:0,
  clockBasis:'PROVIDER_PUBLISHED_PROXY_BAR_END'};
 const sourceVersion=sha(JSON.stringify({registry:registrySha256,proofs:[receipt],
  priceMode:mode,phases}));
 return {root,record:{registrySha256,sourceVersion},
  report:{confirmedDate:dates.at(-1),provisionalDate:dates.at(-1),sourceLatestDate:dates.at(-1)},
  dataFile,receiptFile,clean:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('exact stored receipt lineage gives metadata only for five selected tickers',()=>{
 const x=fixture();try{
  const r=inspectW03PaidSourceCoverage(x);
  assert.equal(r.status,'PASS');
  assert.equal(r.code,'W03_PAID_SOURCE_VERSION_VERIFIED');
  assert.equal(r.sourceVersion,x.record.sourceVersion);
  assert.equal(r.receiptCount,1);
  assert.equal(r.spySessions,70);
  assert.equal(r.perSymbol.WISE.storedSessions,60);
  assert.equal(r.perSymbol.WISE.first40RealSessionsDate,dates[49]);
  assert.equal(r.perSymbol.IGV.storedSessions,16);
  assert.equal(r.perSymbol.IGV.first40RealSessionsDate,null);
  assert.equal(r.perSymbol.SPY.storedSessions,70);
  assert.doesNotMatch(JSON.stringify(r),/close|bar_time|rawPrice/);
 }finally{x.clean();}
});
test('stored source not matching exact derived source version is never attributed',()=>{
 const x=fixture();try{
  x.record.sourceVersion='a'.repeat(64);
  assert.equal(inspectW03PaidSourceCoverage(x).code,'W03_SOURCE_VERSION_NOT_FOUND');
 }finally{x.clean();}
});
test('tampered raw price bytes are rejected despite matching provenance receipts',()=>{
 const x=fixture();try{
  fs.writeFileSync(x.dataFile,Buffer.from('{}'));
  assert.equal(inspectW03PaidSourceCoverage(x).code,'W03_SOURCE_VERSION_NOT_FOUND');
 }finally{x.clean();}
});
test('missing stored generation remains explicitly unknown',()=>{
 const x=fixture();try{
  fs.rmSync(path.win32.dirname(x.dataFile),{recursive:true,force:true});
  assert.equal(inspectW03PaidSourceCoverage(x).code,'W03_SOURCE_VERSION_NOT_FOUND');
 }finally{x.clean();}
});
