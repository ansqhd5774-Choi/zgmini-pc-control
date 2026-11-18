import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectDeltaR44CheckpointEvidence} from '../controller/market-calendar-r44-runtime-readonly.mjs';

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r44-evidence-'));
 const base=path.join(root,'pc-writer');fs.mkdirSync(base);
 return {root,base,write:(filename,obj)=>fs.writeFileSync(
  path.join(base,filename),JSON.stringify(obj)),
  close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('R44 fixed report summaries are bounded, sanitized and never open SQLite',()=>{
 const f=fixture();try{
  f.write('local-collection-last-run.json',{at:'2026-11-15T12:40:00.000Z',
   deltaScreener:{status:'READY_PRIVATE',rowCount:4894,usableTickerCount:4838,
    asOf:'2026-11-03',rawCSV:'PRIVATE_BYTES'}});
  f.write('local-writer-last-run.json',{at:'2026-11-15T12:37:00.000Z',
   source:'a'.repeat(40),mode:'PUBLISH',status:'VERIFIED',deltaR44:{
    status:'READY_OUTPUT',calendarTickers:2974,coveredTickers:2700,
    counts:{one:2000,two:500,three:200,missing:270,conflicting:4},
    grades:{DAC:1,raw:'PRIVATE_PROFILE'}},
   failures:[]});
  const before=fs.readdirSync(f.base).sort();
  const result=inspectDeltaR44CheckpointEvidence(f.root);
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'R44_BOTH_PRODUCER_REPORTS_READY');
  assert.equal(result.input.rowCount,4894);
  assert.equal(result.writer.calendarTickerCount,2974);
  assert.equal(result.writer.counts.conflicting,4);
  assert.equal(result.lastWriterStartedAfterLastCollectionStart,false);
  assert.equal(result.writer.reportedLocalReadback,true);
  assert.equal(result.independentSqliteOutputReadback,false);
  assert.equal(result.d1PerKeyReadback,'NOT_RECORDED');
  assert.equal(result.sqliteOpened,false);
  assert.deepEqual(fs.readdirSync(f.base).sort(),before);
  assert.equal(JSON.stringify(result).includes('PRIVATE_BYTES'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE_PROFILE'),false);
 }finally{f.close();}
});
test('malformed counts and missing private source can never prove R44 completion',()=>{
 const f=fixture();try{
  f.write('local-writer-last-run.json',{at:'2026-11-15T13:00:00Z',
   deltaR44:{status:'READY_OUTPUT',calendarTickers:2974,coveredTickers:2700,
    counts:{one:3000,two:500,three:200,missing:0,conflicting:0}}});
  const result=inspectDeltaR44CheckpointEvidence(f.root);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.evidenceStatus,'R44_PRODUCER_REPORTS_NOT_YET_COMPLETE');
  assert.equal(result.writer.reportedLocalReadback,false);
  assert.equal(result.writer.counts,null);
  assert.equal(result.independentRawShaReadback,false);
 }finally{f.close();}
});
test('an invalid path returns an explicit state without reading host files',()=>{
 const result=inspectDeltaR44CheckpointEvidence('relative/path');
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.input.checkpointState,'INVALID_ROOT');
 assert.equal(result.writer.checkpointState,'INVALID_ROOT');
 assert.equal(result.operationalWrites,0);
});

test('R44 exact Writer D1 receipt is verified only with identical key, epoch and SHA',()=>{
 const f=fixture();try{
  const sha='a'.repeat(64);
  f.write('local-collection-last-run.json',{at:'2026-11-15T13:20:00Z',
   deltaScreener:{status:'CACHED_PRIVATE',rowCount:4894,usableTickerCount:4838,
    asOf:'2026-11-03'}});
  const base={at:'2026-11-15T13:30:00Z',mode:'PUBLISH',status:'VERIFIED',
   deltaR44:{status:'UNCHANGED',calendarTickers:3035,coveredTickers:2750,
    counts:{one:2553,two:181,three:16,missing:283,conflicting:2}},
   deltaR44D1:{key:'market-calendar:earnings-marketcap-r44-2026-11-public',
    status:'MATCHED',localStoredAt:1794790000000,d1StoredAt:1794790000000,
    localBodySha256:sha,d1BodySha256:sha},failures:[]};
  f.write('local-writer-last-run.json',base);
  const r=inspectDeltaR44CheckpointEvidence(f.root);
  assert.equal(r.d1PerKeyReadback,'VERIFIED_AT_WRITER_PUBLISH_TIME');
  assert.equal(r.d1Readback.exactMatchAtWriterTime,true);
  assert.equal(r.productionApiUiVerified,false);
  f.write('local-writer-last-run.json',{...base,deltaR44D1:{...base.deltaR44D1,
   d1BodySha256:'b'.repeat(64)}});
  const mismatched=inspectDeltaR44CheckpointEvidence(f.root);
  assert.equal(mismatched.d1Readback.exactMatchAtWriterTime,false);
  assert.equal(mismatched.d1PerKeyReadback,'MATCHED');
  f.write('local-writer-last-run.json',{...base,mode:'DRY_RUN'});
  assert.equal(inspectDeltaR44CheckpointEvidence(f.root).d1Readback.exactMatchAtWriterTime,false);
 }finally{f.close();}
});
