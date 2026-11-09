import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizationFixture,REQUEST_ID} from './fixture.mjs';
import {sanitizeManualBResult,uploadManualBReport} from './report.mjs';

const SUCCESS={status:'INFL_MANUAL_B_SAVED_VERIFIED',
 code:'INFL_MANUAL_B_READBACK_VERIFIED',requestId:REQUEST_ID,
 sourceSha256s:{bls:'1'.repeat(64),census:'2'.repeat(64)},
 storedStatus:'SAVED_READBACK',committed:{bls:'3'.repeat(64)}};

test('status reporter exports only bounded status and hashes',()=>{
 const result=sanitizeManualBResult({...SUCCESS,token:'SECRET',
  archives:{bls:{file:'E:\\SECRET'}}},REQUEST_ID,'12345');
 assert.equal(result.status,'INFL_MANUAL_B_SAVED_VERIFIED');
 assert.equal(result.sourceSha256s.census,'2'.repeat(64));
 assert.equal(JSON.stringify(result).includes('SECRET'),false);
 assert.equal(sanitizeManualBResult({...SUCCESS,requestId:'wrong'},
  REQUEST_ID,'12345').status,'INFL_MANUAL_B_STATE_UNKNOWN');
});

test('ambiguous or incomplete delivery cannot claim remote verified',async()=>{
 const {event,env}=authorizationFixture();env.GITHUB_RUN_ID='12345';
 env.GITHUB_TOKEN='x'.repeat(25);
 const created=new Map(),comments=[];
 const fetchFn=async(url,opts={})=>{
  if(url.endsWith('/comments')){comments.push(JSON.parse(opts.body).body);
   return {status:201};}
  if(opts.method==='PUT'){
   const content=Buffer.from(JSON.parse(opts.body).content,'base64');
   created.set(url,content);return {status:201};
  }
  const original=created.get(url.replace('?ref=main',''));
  if(!original||url.includes('.txt?'))return {status:404};
  return {status:200,json:async()=>({encoding:'base64',
   content:original.toString('base64')})};
 };
 const r=await uploadManualBReport({event,env,
  rawResult:JSON.stringify(SUCCESS),fetchFn});
 assert.equal(r.delivery,'RESULT_DELIVERY_UNVERIFIED');
 assert.equal(r.verified,1);assert.equal(r.created,2);
 assert(comments[0].includes('INFL_MANUAL_B_STATE_UNKNOWN'));
});

test('two exact independent readbacks qualify sanitized success',async()=>{
 const {event,env}=authorizationFixture();env.GITHUB_RUN_ID='12345';
 env.GITHUB_TOKEN='x'.repeat(25);
 const files=new Map();let comments=0;
 const fetchFn=async(url,opts={})=>{
  if(url.endsWith('/comments')){comments++;return {status:201};}
  if(opts.method==='PUT'){
   files.set(url,Buffer.from(JSON.parse(opts.body).content,'base64'));
   return {status:201};
  }
  const data=files.get(url.replace('?ref=main',''));
  return {status:200,json:async()=>({encoding:'base64',
   content:data.toString('base64')})};
 };
 const r=await uploadManualBReport({event,env,
  rawResult:JSON.stringify(SUCCESS),fetchFn});
 assert.equal(r.delivery,'RESULT_PAIR_READBACK_VERIFIED');
 assert.equal(r.verified,2);assert.equal(comments,1);
});
