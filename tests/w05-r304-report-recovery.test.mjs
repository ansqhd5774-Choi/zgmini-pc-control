import test from 'node:test';
import assert from 'node:assert/strict';
import {writeAndVerify} from '../w05-r304-service-b/report.mjs';

const url='https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/contents/results/w05-fixture.json';
const env={GITHUB_TOKEN:'fixture-token'};

test('W05 one-shot result recovery accepts only byte-identical existing GitHub content',async()=>{
 const data='{"status":"PASS"}\n';
 const calls=[];
 const fetchApi=async(address,opts)=>{
  calls.push({address,method:opts.method});
  if(opts.method==='PUT')return {status:422};
  return {ok:true,json:async()=>({encoding:'base64',
   content:Buffer.from(data).toString('base64')})};
 };
 await writeAndVerify(url,data,env,fetchApi);
 assert.deepEqual(calls.map(x=>x.method),['PUT','GET']);
 assert.equal(calls[1].address,url+'?ref=main');
});

test('W05 differing preexisting data never passes reconciliation',async()=>{
 const fetchApi=async(address,opts)=>opts.method==='PUT'?{status:422}:
  {ok:true,json:async()=>({encoding:'base64',
   content:Buffer.from('different').toString('base64')})};
 await assert.rejects(writeAndVerify(url,'expected',env,fetchApi),
  {code:'W05_B_REMOTE_RESULT_HASH_STOP'});
});

test('W05 absent, unreadable or malformed readback never becomes a result',async()=>{
 for(const response of [
  {ok:false},
  {ok:true,json:async()=>({encoding:'raw',content:'same'})},
  {ok:true,json:async()=>({encoding:'base64',content:'not-base64'})}
 ]){
  const fetchApi=async(address,opts)=>opts.method==='PUT'?{status:422}:response;
  await assert.rejects(writeAndVerify(url,'same',env,fetchApi),
   {code:'W05_B_REMOTE_RESULT_READBACK_STOP'});
 }
});
