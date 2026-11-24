import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
 W05_FIVE_OPERATION,W05_SOURCE_FILES,
 summarizeW05FiveKeyEvidence,compareW05FiveKeyWithApprovedReaders,
 inspectW05FiveKeyD1ApiReadback
} from '../controller/w05-five-key-d1-api-readback-readonly.mjs';

const SLOTS=['inflation19','inflation7','calendar','theme','employment'];
const SOURCE='a'.repeat(40),SHA='c'.repeat(64);
const fixture=(status='STRUCTURAL_MATCH_NOT_RUNTIME_PROOF')=>({
 schema:'ZGMINI_W05_FIVE_KEY_INPLACE_PREWORK_R12',
 keysChecked:5,results:SLOTS.map((slot,i)=>({
  slot,status,d1StoredAt:1795220442315,d1BodySha256:SHA,
  d1ReadAt:'2026-11-24T07:00:00.000Z',
  apiObservedAt:'2026-11-24T07:00:01.000Z',
  ...(slot==='theme'?{rollingAndSidecarsVerified:true}:{}),
  secret:'DO_NOT_EXPOSE',body:{privateMetadata:'DO_NOT_EXPOSE'},
  password:'DO_NOT_EXPOSE',unexpected:'DO_NOT_EXPOSE',index:i
 }))});
test('W05 added readback is A/light, fixed dispatch and no visitor-triggered operation',()=>{
 const policy=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.equal(policy.operations[W05_FIVE_OPERATION].grade,'A');
 assert.equal(policy.operations[W05_FIVE_OPERATION].resource,'light');
 assert.ok(policy.operations[W05_FIVE_OPERATION].timeoutSeconds>=90);
 assert.equal(policy.mutationsEnabled,false);
 const dispatch=readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 assert.match(dispatch,/request\.operation==='w05-five-key-d1-api-readback-readonly'/);
 assert.match(dispatch,/await inspectW05FiveKeyD1ApiReadback\(dataRoot\)/);
});
test('exact installed source must contain complete paid, inflation, employment validation closure',()=>{
 assert.equal(new Set(W05_SOURCE_FILES).size,W05_SOURCE_FILES.length);
 assert.equal(W05_SOURCE_FILES.length,12);
 for(const p of ['scripts/api-site/compare-five-public-readbacks-r1.mjs',
  'scripts/api-site/five-key-inplace-readback-prework-r12.mjs',
  'scripts/api-site/five-key-public-api-reader-r1.mjs',
  'worker/theme-paid-contract.mjs',
  'worker/employment-r6-public-display.mjs',
  'lib/market-score/employment-r6-formula.mjs'])
  assert.ok(W05_SOURCE_FILES.includes(p),p);
 assert.ok(W05_SOURCE_FILES.every(p=>!p.startsWith('/')&&!p.includes('..')));
});
test('actual observed 5 source/API fixture matches remain PARTIAL without active deployment attestation',()=>{
 const r=summarizeW05FiveKeyEvidence(fixture(),{sourceSha:SOURCE});
 assert.equal(r.status,'PARTIAL');
 assert.equal(r.code,'W05_FIVE_KEY_STRUCTURAL_ONLY_DEPLOYMENT_UNVERIFIED');
 assert.deepEqual(r.results.map(row=>row.slot),SLOTS);
 assert.deepEqual(r.results.map(row=>row.status),
  Array(5).fill('STRUCTURAL_MATCH_NOT_RUNTIME_PROOF'));
 assert.equal(r.keysChecked,5);
 assert.equal(r.structuralMatches,5);
 assert.equal(r.liveD1ApiCompared,true);
 assert.equal(r.sourceCheckoutVerified,true);
 assert.equal(r.deploymentIdentityVerified,false);
 assert.equal(r.ownerAuthorizationVerified,false);
 assert.equal(r.runtimeVerified,false);
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
 assert.equal(r.operationalWrites,0);assert.equal(r.sqliteOpened,false);
 assert.doesNotMatch(JSON.stringify(r),/DO_NOT_EXPOSE|privateMetadata|password|secret|body/);
 assert.equal(r.results.find(v=>v.slot==='theme').rollingAndSidecarsVerified,false);
});
test('actual mismatches and partial results never convert into PASS',()=>{
 const x=fixture();
 x.results[2].status='PUBLIC_BODY_MISMATCH';
 x.results[3].status='THEME_READER_BRANCH_UNVERIFIED';
 const r=summarizeW05FiveKeyEvidence(x,{sourceSha:SOURCE});
 assert.equal(r.status,'PARTIAL');
 assert.equal(r.code,'W05_FIVE_KEY_COMPARISON_PARTIAL_OR_UNVERIFIED');
 assert.equal(r.structuralMatches,3);
 assert.deepEqual(r.results.map(v=>v.status),x.results.map(v=>v.status));
 assert.equal(r.deploymentIdentityVerified,false);
});
test('missing or malicious receipt cannot claim a live public comparison',()=>{
 for(const x of [
  null,{},fixture(),{...fixture(),keysChecked:4},
  {...fixture(),results:fixture().results.slice(0,4)},
  {...fixture(),results:fixture().results.map((r,i)=>i===0?{...r,slot:'unapproved'}:r)},
  {...fixture(),results:fixture().results.map((r,i)=>i===0?{...r,status:'ALLOWED\nsecret'}:r)}
 ]){
  const input=x===null?x:x===undefined?x:x;
  const evidence=summarizeW05FiveKeyEvidence(input&&input===fixture()?null:input);
  if(input?.results?.length===5&&input?.schema==='ZGMINI_W05_FIVE_KEY_INPLACE_PREWORK_R12'&&
     input.keysChecked===5&&input.results.every((v,i)=>v.slot===SLOTS[i]&&
     /^[A-Z][A-Z0-9_]{2,90}$/.test(v.status))){
    assert.equal(evidence.status,'PARTIAL');
  }else{
    assert.equal(evidence.status,'STATE_UNKNOWN');
    assert.equal(evidence.liveD1ApiCompared,false);
  }
 }
});
test('receipt sanitizer drops malformed optional hashes and timestamps, never outputs raw payloads',()=>{
 const receipt=fixture();
 receipt.results[0].d1BodySha256='bad';
 receipt.results[0].d1ReadAt='malformed';
 receipt.results[0].apiObservedAt='2026-11-24T07:00:01+00:00';
 const x=summarizeW05FiveKeyEvidence(receipt,{sourceSha:'wrong'});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.sourceCheckoutVerified,false);
 assert.equal(x.sourceSha,null);
 assert.equal(x.results[0].d1BodySha256,undefined);
 assert.equal(x.results[0].d1ReadAt,undefined);
 assert.equal(x.results[0].apiObservedAt,undefined);
 assert.doesNotMatch(JSON.stringify(x),/DO_NOT_EXPOSE/);
});
test('no dynamic approved reader or throw in collector can be upgraded to success',async()=>{
 const missing=await compareW05FiveKeyWithApprovedReaders({});
 assert.equal(missing.status,'STATE_UNKNOWN');
 assert.equal(missing.code,'W05_APPROVED_READERS_NOT_AVAILABLE');
 let observed=0;
 const failed=await compareW05FiveKeyWithApprovedReaders({
  queryFixed:async()=>null,readApi:async()=>({statusCode:200,body:{}}),
  createAdapter:()=>({}),collect:async()=>{observed++;throw Error('SECRET');}
 });
 assert.equal(observed,1);
 assert.equal(failed.status,'STATE_UNKNOWN');
 assert.equal(failed.code,'W05_READBACK_EXECUTION_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(failed),/SECRET/);
});
test('bounded 5-key operation forwards only supplied reads, not arbitrary operations',async()=>{
 const sql=[];
 const result=await compareW05FiveKeyWithApprovedReaders({
  queryFixed:async(q,p)=>{sql.push({q,p});return null;},
  readApi:async()=>({statusCode:503,body:null}),
  createAdapter:fn=>({query:fn}),
  collect:async ({db,readApi})=>{
   const a=await db.query('FIXED_SQL_FROM_OWNER',['fixed']);
   assert.equal(a,null);
   const b=await readApi();
   assert.equal(b.statusCode,503);
   return fixture('API_NOT_READY');
  },
  sourceSha:SOURCE
 });
 assert.deepEqual(sql,[{q:'FIXED_SQL_FROM_OWNER',p:['fixed']}]);
 assert.equal(result.structuralMatches,0);
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.runtimeVerified,false);
});
test('invalid data root and missing config fail closed without touching provider, database or credentials',async()=>{
 const invalid=await inspectW05FiveKeyD1ApiReadback('not-absolute');
 assert.equal(invalid.code,'W05_DATA_ROOT_INVALID');
 const dir=mkdtempSync(path.join(os.tmpdir(),'zgmini-w05-five-key-'));
 try{
  const absent=await inspectW05FiveKeyD1ApiReadback(dir);
  assert.equal(absent.status,'STATE_UNKNOWN');
  assert.equal(absent.code,'W05_WRITER_CONFIG_NOT_AVAILABLE');
  mkdirSync(path.join(dir,'pc-writer'),{recursive:true});
  writeFileSync(path.join(dir,'pc-writer','config.json'),'{bad');
  const malformed=await inspectW05FiveKeyD1ApiReadback(dir);
  assert.equal(malformed.code,'W05_WRITER_CONFIG_INVALID');
  writeFileSync(path.join(dir,'pc-writer','config.json'),JSON.stringify({
   source:SOURCE,account:'b'.repeat(32),core:'123e4567-e89b-12d3-a456-426614174000'}));
  const absentSource=await inspectW05FiveKeyD1ApiReadback(dir);
  assert.equal(absentSource.status,'STATE_UNKNOWN');
  assert.equal(absentSource.code,'W05_SOURCE_CHECKOUT_UNVERIFIED');
  assert.equal(absentSource.deploymentIdentityVerified,false);
  assert.equal(absentSource.liveD1ApiCompared,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
