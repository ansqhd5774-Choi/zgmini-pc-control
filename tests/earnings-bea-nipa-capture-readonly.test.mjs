import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectBeaNipaCaptureReadonly,computeBeaNipaStoredAttestation} from '../controller/earnings-bea-nipa-capture-readonly.mjs';
import {appendBeaJournalPhase} from '../direct-writer-b/bea-native-source-once.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const REQUEST='0ac25f3d-e307-41d4-8fcc-62c933f5b9d3';
const M='dc85fe197c60a11cb62d0e5fc636a3e45152d3528d925ee1ed74f9a73dc83090';
const prep=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-bea-a-'));
  const data=path.join(root,'ZGmini','data'),home=path.join(data,'pc-writer');
  fs.mkdirSync(home,{recursive:true});
  t.after(()=>fs.rmSync(root,{force:true,recursive:true}));
  return {data,home};
};
const writeAttempt=home=>{
  const folder=path.join(home,'bea-nipa-source-b-once',REQUEST);
  fs.mkdirSync(path.join(folder,'hooks-empty'),{recursive:true});
  fs.writeFileSync(path.join(folder,'journal.jsonl'),
    JSON.stringify({status:'CLAIMED',at:'2026-11-23T10:55:22.000Z'})+'\n');
  fs.writeFileSync(path.join(folder,'attempt.json'),JSON.stringify({
    schema:'ZGMINI_BEA_NIPA_SINGLE_ATTEMPT_V1',requestId:REQUEST,
    sourceSha:'7'.repeat(40),manifestSha256:M,
    attemptedAt:'2026-11-23T10:55:22.000Z'})+'\n');
  return folder;
};
const writeSource=home=>{
  const rows=['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'].map((period,i)=>({
    TableName:'T11500',SeriesCode:'A463RD',LineNumber:'7',
    TimePeriod:period,DataValue:String(250+i),CL_UNIT:'USD',UNIT_MULT:'0'}));
  const bytes=Buffer.from(JSON.stringify({BEAAPI:{Results:{Data:rows}}}));
  const version=sha(bytes),httpSha='c'.repeat(64);
  const folder=path.join(home,'raw','earnings-bea-unit-nipa-r1');
  fs.mkdirSync(folder,{recursive:true});
  const stored=1795400000000;
  fs.writeFileSync(path.join(folder,version+'.json'),bytes);
  fs.writeFileSync(path.join(folder,version+'.meta.json'),JSON.stringify({
    schemaVersion:'earnings-bea-unit-nipa-raw-r1-v1',
    transport:'BEA_API_JSON',storageScope:'BEA_NIPA_TARGET_FIELDS_ONLY',
    sourceHttpSha256:httpSha,dataset:'NIPA',tableName:'T11500',
    seriesCode:'A463RD',lineNumber:'7',frequency:'Q',
    sourceVersion:version,sourceStoredAt:stored,
    sourceRetrievedAt:new Date(stored).toISOString(),
    observedThrough:'2026-06-30',sourceByteLength:bytes.length,
    file:version+'.json'
  })+'\n');
  return {version,httpSha,stored,folder};
};
test('missing BEA archive reports absence without treating claim as a provider call',t=>{
  const {data,home}=prep(t);
  writeAttempt(home);
  const out=inspectBeaNipaCaptureReadonly(data);
  assert.equal(out.status,'PASS');
  assert.equal(out.code,'BEA_NIPA_PRIVATE_ARCHIVE_NOT_STORED');
  assert.equal(out.markedAttempts,1);
  assert.equal(out.storedSourceCount,0);
  assert.equal(out.providerCalls,0);
  assert.equal(out.rawExposed,false);
});
test('sanitized immutable archive and bounded journal readback agree',t=>{
  const {data,home}=prep(t);
  const journal=writeAttempt(home);
  const src=writeSource(home);
  fs.appendFileSync(path.join(journal,'journal.jsonl'),JSON.stringify({
    phase:'BEA_NATIVE_ARCHIVE_READBACK_VERIFIED',
    sourceVersion:src.version,sourceHttpSha256:src.httpSha,
    sourceStoredAt:src.stored,observedThrough:'2026-06-30'
  })+'\n');
  const out=inspectBeaNipaCaptureReadonly(data);
  assert.equal(out.status,'PASS');
  assert.equal(out.code,'BEA_NIPA_PRIVATE_ARCHIVE_READBACK_VERIFIED');
  assert.equal(out.completedJournalAttempts,1);
  assert.equal(out.verifiedSourceCount,1);
  assert.equal(out.latest.sourceVersion,src.version);
  assert.equal(out.calculation.status,'STORED_SOURCE_CALCULATED');
  assert.equal(out.calculation.sourceVersion,src.version);
  assert.equal(out.calculation.historyPoints,5);
  assert.equal(out.calculation.latestQuarter,'2026Q2');
  assert.equal(out.calculation.previousQuarter,'2026Q1');
  assert.equal(out.calculation.observationPeriodEnd,'2026-06-30');
  assert.match(out.calculation.calculationSha256,/^[a-f0-9]{64}$/);
  assert.equal(out.calculation.rawExposed,false);
  assert.equal('currentValue' in out.calculation,false);
  assert.equal('previousValue' in out.calculation,false);
  assert.equal('history' in out.calculation,false);

  assert.equal(out.providerCalls,0);
});
test('tampered private source is never reported as success',t=>{
  const {data,home}=prep(t);
  writeAttempt(home);
  const src=writeSource(home);
  fs.appendFileSync(path.join(src.folder,src.version+'.json'),' ');
  const out=inspectBeaNipaCaptureReadonly(data);
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(out.code,'BEA_NIPA_READONLY_METADATA_MISMATCH');
  assert.equal(out.operationalWrites,0);
});
test('unsafe archive redirection is not followed',t=>{
  const {data,home}=prep(t);
  const target=path.join(home,'actual');
  fs.mkdirSync(target);
  try{fs.symlinkSync(target,path.join(home,'raw'),'dir');}
  catch(e){if(['EPERM','EACCES','ENOTSUP'].includes(e.code)){t.skip('symlinks unavailable');return;}throw e;}
  const out=inspectBeaNipaCaptureReadonly(data);
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(out.code,'BEA_NIPA_READONLY_UNSAFE_DIRECTORY');
});

test('real B phase writer preserves independent A archive and checkpoint readback',t=>{
  const {data,home}=prep(t);
  const journal=writeAttempt(home);
  const src=writeSource(home);
  const file=path.join(journal,'journal.jsonl');
  appendBeaJournalPhase(file,'BEA_NATIVE_COLLECTOR_ENTERED');
  fs.appendFileSync(file,JSON.stringify({
    phase:'BEA_NATIVE_ARCHIVE_READBACK_VERIFIED',
    sourceVersion:src.version,sourceHttpSha256:src.httpSha,
    sourceStoredAt:src.stored,observedThrough:'2026-06-30'
  })+'\n');
  const out=inspectBeaNipaCaptureReadonly(data);
  assert.equal(out.status,'PASS');
  assert.equal(out.code,'BEA_NIPA_PRIVATE_ARCHIVE_READBACK_VERIFIED');
  assert.equal(out.completedJournalAttempts,1);
  assert.equal(out.verifiedSourceCount,1);
  assert.equal(out.latest.sourceVersion,src.version);
});

test('real B failure phases remain readable without inventing provider success',t=>{
  const {data,home}=prep(t);
  const journal=writeAttempt(home);
  const file=path.join(journal,'journal.jsonl');
  appendBeaJournalPhase(file,'BEA_NATIVE_COLLECTOR_ENTERED');
  appendBeaJournalPhase(file,'BEA_NATIVE_ATTEMPT_FAILED',
    'DIRECT_B_BEA_HTTP_UNAVAILABLE');
  const out=inspectBeaNipaCaptureReadonly(data);
  assert.equal(out.status,'PASS');
  assert.equal(out.code,'BEA_NIPA_PRIVATE_ARCHIVE_NOT_STORED');
  assert.equal(out.completedJournalAttempts,0);
  assert.equal(out.storedSourceCount,0);
  assert.equal(out.providerCalls,0);
  const rows=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rows.length,3);
  assert.equal(rows[2].code,'DIRECT_B_BEA_HTTP_UNAVAILABLE');
});

test('stored native BEA Level/0 six rows calculate from latest five without external calls',()=>{
  const rows=['2025Q1','2025Q2','2025Q3','2025Q4','2026Q1','2026Q2']
    .map((TimePeriod,i)=>({TableName:'T11500',SeriesCode:'A463RD',
      LineNumber:'7',CL_UNIT:'Level',UNIT_MULT:'0',
      TimePeriod,DataValue:String((210+i*7)/1000)}));
  const basis={sourceVersion:'a'.repeat(64),
    sourceStoredAt:Date.parse('2026-11-23T11:58:05Z'),
    observedThrough:'2026-06-30'};
  const one=computeBeaNipaStoredAttestation({BEAAPI:{Results:{Data:rows}}},basis);
  assert.equal(one.status,'STORED_SOURCE_CALCULATED');
  assert.equal(one.unit,'USD_PER_REAL_GVA_UNIT');
  assert.equal(one.latestQuarter,'2026Q2');
  assert.equal(one.previousQuarter,'2026Q1');
  assert.equal(one.historyPoints,5);
  assert.equal(one.providerCalls,0);
  assert.equal(one.operationalWrites,0);
  assert.equal(one.rawExposed,false);
  const reversed=computeBeaNipaStoredAttestation({BEAAPI:{Results:{Data:rows.slice().reverse()}}},basis);
  assert.equal(reversed.calculationSha256,one.calculationSha256);
  for(const mutate of [
    rows=>{rows[0].UNIT_MULT='3';},
    rows=>{rows[0].CL_UNIT='PercentChange';},
    rows=>{rows[0].TableName='T10101';},
    rows=>{rows[5].TimePeriod='2026Q1';},
    rows=>{rows[5].DataValue='0,25';},
    rows=>{rows[5].TimePeriod='2026Q4';}
  ]){
    const changed=rows.map(row=>({...row}));mutate(changed);
    assert.throws(()=>computeBeaNipaStoredAttestation({
      BEAAPI:{Results:{Data:changed}}},basis),/BEA_NIPA_CALC_/);
  }
  assert.throws(()=>computeBeaNipaStoredAttestation({BEAAPI:{Results:{Data:rows}}},
    {...basis,observedThrough:'2026-03-31'}),/BEA_NIPA_CALC_SOURCE_PERIOD_MISMATCH/);
});
