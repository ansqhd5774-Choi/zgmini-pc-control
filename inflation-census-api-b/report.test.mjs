import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sanitizeCensusBResult,publishCensusBReceipt} from './report.mjs';
const REQUEST=randomUUID(),SHA='a'.repeat(40),CONTROL='b'.repeat(40);
const proof={request:{requestId:REQUEST},manifest:{installedSourceSha:SHA},controlSha:CONTROL};
const env={GITHUB_RUN_ID:'43900000000',GITHUB_TOKEN:'fixture-safe-token-123456789000'};
const raw={status:'PASS',code:'W01_CENSUS_B_SAVED_READBACK',
 requestId:REQUEST,sourceSha:SHA,providerCalls:2,stored:'SAVED_READBACK',
 publicWrites:0,d1Writes:0,taskChanges:0,replay:'FORBIDDEN'};
test('only two-GET Census #28 saved outcome may be reported PASS',()=>{
 const result=sanitizeCensusBResult(raw,proof,env);
 assert.equal(result.status,'PASS');
 assert.equal(result.providerCalls,2);
 assert.equal(result.schema,'ZGMINI_W01_CENSUS_M3_API_B_RESULT_V1');
 for(const mutate of [
  x=>x.providerCalls=3,
  x=>x.stored='INVALID',
  x=>x.d1Writes=1,
  x=>x.sourceSha='c'.repeat(40),
  x=>x.requestId=randomUUID(),
  x=>x.replay='ALLOWED'
 ]){
  const x={...raw};mutate(x);
  assert.equal(sanitizeCensusBResult(x,proof,env).status,'STATE_UNKNOWN');
 }
});
test('sanitized unknown result excludes private provider bodies and raw data',()=>{
 const value=sanitizeCensusBResult({...raw,status:'STATE_UNKNOWN',
  code:'W01_CENSUS_B_CORE_RELEASE_UNVERIFIED_STOP',providerCalls:null,
  providerBody:'PRIVATE_RAW',credential:'SECRET'},proof,env);
 const s=JSON.stringify(value);
 assert.equal(value.status,'STATE_UNKNOWN');
 assert.ok(!s.includes('PRIVATE_RAW'));
 assert.ok(!s.includes('SECRET'));
 assert.equal(value.providerCalls,null);
});
test('create-only JSON and TXT are independently read back before origin receipt',async()=>{
 const stored=new Map(),calls=[];
 const mock=async(url,init={})=>{
  calls.push({url,method:init.method??'GET'});
  if(url.endsWith('/comments')){
   return {status:201};
  }
  const file=url.split('?')[0];
  if(init.method==='PUT'){
   const body=JSON.parse(init.body);
   stored.set(file,body.content);
   return {status:201};
  }
  return {status:stored.has(file)?200:404,
   json:async()=>({encoding:'base64',content:stored.get(file)??''})};
 };
 const result=await publishCensusBReceipt({
  proof,env,event:{issue:{number:1793}},raw,fetchApi:mock});
 assert.deepEqual(result,{status:'PASS',verified:2,created:2});
 assert.equal(calls.filter(x=>x.method==='PUT').length,2);
 assert.equal(calls.filter(x=>x.method==='GET').length,2);
 assert.equal(calls.filter(x=>x.url.endsWith('/comments')).length,1);
 for(const payload of stored.values()){
  const s=Buffer.from(payload,'base64').toString('utf8');
  assert.ok(!s.includes('fixture-safe-token'));
  assert.ok(!s.includes('PRIVATE_RAW'));
 }
});
