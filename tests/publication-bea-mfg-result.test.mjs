import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBeaMfgResult} from '../tools/publication-bea-mfg-result.mjs';

const sha='a'.repeat(64),key='detail:earnings-bea-manufacturing-profit:r1';
const sourceStoredAt=1793191354160;
const pre={status:'PASS_READONLY_ARCHIVE_PREFLIGHT',sourceVersion:sha,
  sourceStoredAt,period:'2026-Q2',yoyPercent:54.60548815840656,
  rawWrites:0,sqliteWrites:0,d1Writes:0};
const applied={status:'READBACK_VERIFIED',key,sourceVersion:sha,
  sourceStoredAt,period:'2026-Q2',yoyPercent:54.60548815840656,
  sqliteWrites:0,scoreWrites:0,storedAt:sourceStoredAt+2000,
  d1Readback:'READBACK_VERIFIED'};
const read=x=>parseBeaMfgResult(JSON.stringify(x),{phase:'PREFLIGHT',expectedSha:sha});
const finish=(x,pin=read(pre))=>parseBeaMfgResult(JSON.stringify(x),
  {phase:'APPLY',expectedSha:sha,expectedKey:key,preflight:pin});

test('source-only manufacturing B preflight binds immutable CSV sha and quarter',()=>{
  const pin=read(pre);
  assert.deepEqual(pin,{sourceVersion:sha,sourceStoredAt,period:'2026-Q2',
    yoyPercent:pre.yoyPercent});
  assert.deepEqual(finish(applied),{status:'PASS',key,d1Result:'READBACK_VERIFIED',
    sourceVersion:sha,sourceStoredAt,storedAt:sourceStoredAt+2000});
  const old={...applied,status:'ALREADY_STORED',d1Readback:'ALREADY_STORED'};
  assert.equal(finish(old).d1Result,'ALREADY_STORED');
});

test('preflight cannot be inferred from a zero-write assertion or arbitrary output',()=>{
  for(const edit of [
    x=>x.status='READY',x=>x.rawWrites=1,x=>x.sqliteWrites=1,
    x=>x.d1Writes=1,x=>x.sourceVersion='b'.repeat(64),
    x=>x.sourceStoredAt=0,x=>x.period='2026Q2',
    x=>x.yoyPercent=null,x=>x.shell='rm -rf /',
  ]){
    const bad=structuredClone(pre);edit(bad);
    assert.throws(()=>read(bad),/PUBLICATION_BEA_MFG_/);
  }
  for(const bad of ['', 'WARN\\n'+JSON.stringify(pre), '{broken}',JSON.stringify([pre])])
    assert.throws(()=>parseBeaMfgResult(bad,{phase:'PREFLIGHT',expectedSha:sha}),
      /PUBLICATION_BEA_MFG_/);
});

test('apply requires actual single-key readback and exact immutable preflight pins',()=>{
  for(const edit of [
    x=>x.key='detail:earnings-bea-unit-profit:v1',
    x=>x.status='WRITE_SUBMITTED',x=>x.d1Readback='ALREADY_STORED',
    x=>x.sourceVersion='b'.repeat(64),
    x=>x.sourceStoredAt=sourceStoredAt+1,
    x=>x.period='2026-Q1',x=>x.yoyPercent=32,
    x=>x.sqliteWrites=1,x=>x.scoreWrites=1,
    x=>x.storedAt=sourceStoredAt-1,x=>delete x.storedAt,
    x=>x.providerCalls=1,
  ]){
    const bad=structuredClone(applied);edit(bad);
    assert.throws(()=>finish(bad),/PUBLICATION_BEA_MFG_/);
  }
  assert.throws(()=>parseBeaMfgResult(JSON.stringify(applied),
    {phase:'APPLY',expectedSha:sha,expectedKey:key}),
    /PUBLICATION_BEA_MFG_APPLY_INVALID/);
  assert.throws(()=>finish(applied,{...read(pre),sourceStoredAt:sourceStoredAt-10}),
    /PUBLICATION_BEA_MFG_APPLY_INVALID/);
});
