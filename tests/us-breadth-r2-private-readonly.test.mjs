import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectUsBreadthR2PrivateReadonly} from '../controller/us-breadth-r2-private-readonly.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-r2-readonly-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const base=path.join(root,'pc-writer','marketparquet-paid');
 fs.mkdirSync(base,{recursive:true});
 return {root,base};
}
function saveReceipt(base,type,date,{valid=true}={}){
 const dir=path.join(base,type);fs.mkdirSync(dir,{recursive:true});
 const bytes=Buffer.from('PAR1xxPAR1');
 const stem=path.join(dir,date+'.parquet');
 const receipt={schema:'ZGMINI_MP_PAID_FILE_V1',plan:valid?'full':'free',
  assetType:type,date,bytes:bytes.length,rows:2,
  sha256:hash(bytes),projectionSha256:'a'.repeat(64)};
 fs.writeFileSync(stem,bytes);
 fs.writeFileSync(stem+'.rows.json','{"rows":[]}');
 fs.writeFileSync(stem+'.json',JSON.stringify(receipt));
}
function savePrivate(base,record,{corrupt=false}={}){
 const dir=path.join(base,'derived','us-breadth-r2');
 fs.mkdirSync(dir,{recursive:true});
 const content=Buffer.from(JSON.stringify(record)+'\n');
 const name=record.lastDate+'-'+hash(content)+'.json';
 fs.writeFileSync(path.join(dir,name),corrupt?Buffer.concat([content,Buffer.from('x')]):content);
}
test('missing paid source remains state unknown with zero operations',()=>{
 const r=inspectUsBreadthR2PrivateReadonly(os.tmpdir()+'/zg-r2-absent-source-xyz');
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
 assert.equal(r.sqliteOpened,false);
});
test('fixed stock and ETF receipt inventory and immutable private hash without source leak',t=>{
 const {root,base}=fixture(t);
 saveReceipt(base,'stock_daily','2026-11-24');
 saveReceipt(base,'stock_daily','2026-11-25');
 saveReceipt(base,'etf_daily','2026-11-25');
 const privateRecord={schema:'ZGMINI_US_PAID_BREADTH_R2_PRIVATE_V1',
  firstDate:'2026-11-25',lastDate:'2026-11-25',comparedSessions:1,
  fullYearHistory:false,points:[{date:'2026-11-25',
   risingPct:50,unchangedPct:20,fallingPct:30}],
  sourceReceipts:[{date:'2026-11-24',sha256:'secret'},
   {date:'2026-11-25',sha256:'secret2'}],
  credential:'NOT_FOR_PUBLIC'};
 savePrivate(base,privateRecord);
 const r=inspectUsBreadthR2PrivateReadonly(root);
 assert.equal(r.status,'PASS');
 assert.equal(r.stockDaily.receiptDates,2);
 assert.equal(r.stockDaily.selectedMetadataValid,2);
 assert.equal(r.stockDaily.selectedRawFilesPresent,2);
 assert.equal(r.etfDaily.receiptDates,1);
 assert.equal(r.stockDaily.sourceShaReadbackVerified,false);
 assert.equal(r.stockDaily.calendarContinuityVerified,false);
 assert.equal(r.privateOutput.state,'PRIVATE_FILE_SHA_READBACK_VERIFIED');
 assert.equal(r.privateOutput.comparedSessions,1);
 assert.equal(r.privateOutput.publicD1Verified,false);
 assert.doesNotMatch(JSON.stringify(r),/NOT_FOR_PUBLIC|secret2|credential|marketparquet-paid/);
 assert.equal(r.providerCalls,0);assert.equal(r.operationalWrites,0);
});
test('corrupt private output cannot be represented as verified',t=>{
 const {root,base}=fixture(t);
 savePrivate(base,{schema:'ZGMINI_US_PAID_BREADTH_R2_PRIVATE_V1',
  firstDate:'2026-11-25',lastDate:'2026-11-25',comparedSessions:1,
  fullYearHistory:false,points:[{date:'2026-11-25'}],
  sourceReceipts:[{},{}]},{corrupt:true});
 const r=inspectUsBreadthR2PrivateReadonly(root);
 assert.equal(r.status,'PASS');
 assert.equal(r.privateOutput.state,'OUTPUT_SHA_MISMATCH');
});
test('invalid paid receipt is counted and no file presence claims source hashes',t=>{
 const {root,base}=fixture(t);
 saveReceipt(base,'stock_daily','2026-11-25',{valid:false});
 const r=inspectUsBreadthR2PrivateReadonly(root);
 assert.equal(r.stockDaily.selectedMetadataValid,0);
 assert.equal(r.stockDaily.selectedInvalidOrMissing,1);
 assert.equal(r.stockDaily.fullHistoryVerified,false);
 assert.equal(r.stockDaily.sourceShaReadbackVerified,false);
});
test('empty but present paid storage does not imply missing provider access',t=>{
 const {root}=fixture(t);
 const r=inspectUsBreadthR2PrivateReadonly(root);
 assert.equal(r.status,'PASS');
 assert.equal(r.stockDaily.state,'DIRECTORY_UNAVAILABLE');
 assert.equal(r.privateOutput.state,'DIRECTORY_UNAVAILABLE');
});
