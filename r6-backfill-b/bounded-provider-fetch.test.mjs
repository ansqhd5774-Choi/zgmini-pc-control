import test from 'node:test';
import assert from 'node:assert/strict';
import {createR6BBoundedPhysicalFetch} from './bounded-provider-fetch.mjs';

const BLS='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const DOL='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const ETA='https://oui.doleta.gov/unemploy/csv/ar539.csv';
const b=()=>({method:'POST',body:JSON.stringify({seriesid:['LNS14000000'],startyear:'2016',endyear:'2025'})});
const d=()=>({method:'POST',body:new URLSearchParams({level:'us',final_yr:'2026',
 strtdate:'2016',enddate:'2026',filetype:'xml',submit:'Submit'}).toString()});

test('no approved B execution means zero provider calls',async()=>{
 let network=0;
 const physical=createR6BBoundedPhysicalFetch({originalFetch:async()=>{network++;},
   heldCoreLock:{verifyHeld:()=>true}});
 await assert.rejects(physical.fetch(BLS,b()),{code:'R6_B_PHYSICAL_NETWORK_NOT_AUTHORIZED'});
 assert.deepEqual(physical.snapshot(),{bls:0,dol:0,total:0});
 assert.equal(network,0);
});

test('Core lock loss blocks even when a fixture supplied network permission',async()=>{
 let allowed=true,network=0;
 const physical=createR6BBoundedPhysicalFetch({originalFetch:async()=>{network++;},
   heldCoreLock:{verifyHeld:()=>allowed},allowPhysicalNetwork:true});
 await physical.fetch(BLS,b());
 allowed=false;
 await assert.rejects(physical.fetch(BLS,b()),{code:'R6_B_PHYSICAL_NETWORK_NOT_AUTHORIZED'});
 assert.equal(network,1);
 assert.deepEqual(physical.snapshot(),{bls:1,dol:0,total:1});
});

test('exact R6 BLS/DOL 18+2 calls count before reply and refuse 21st',async()=>{
 let network=0;
 const physical=createR6BBoundedPhysicalFetch({originalFetch:async()=>{
   network++;return {ok:true,status:200};},heldCoreLock:{verifyHeld:()=>true},
   allowPhysicalNetwork:true});
 for(let i=0;i<18;i++)await physical.fetch(BLS,b());
 await physical.fetch(DOL,d());
 await physical.fetch(ETA,{});
 await assert.rejects(physical.fetch(BLS,b()),{code:'R6_B_PROVIDER_REQUEST_CAP_STOP'});
 await assert.rejects(physical.fetch(DOL,d()),{code:'R6_B_PROVIDER_REQUEST_CAP_STOP'});
 assert.deepEqual(physical.snapshot(),{bls:18,dol:2,total:20});
 assert.equal(network,20);
});

test('unapproved URL, malformed body and incorrect verbs refuse before network',async()=>{
 let network=0;
 const physical=createR6BBoundedPhysicalFetch({originalFetch:async()=>{network++;},
   heldCoreLock:{verifyHeld:()=>true},allowPhysicalNetwork:true});
 await assert.rejects(physical.fetch('https://api.cloudflare.com/client/v4',{}),
   {code:'R6_B_PROVIDER_URL_OR_METHOD_STOP'});
 await assert.rejects(physical.fetch(BLS,{method:'GET'}),
   {code:'R6_B_PROVIDER_URL_OR_METHOD_STOP'});
 await assert.rejects(physical.fetch(BLS,{method:'POST',body:JSON.stringify({registrationkey:'secret'})}),
   {code:'R6_B_BLS_BODY_STOP'});
 await assert.rejects(physical.fetch(DOL,{method:'POST',body:'x=y'}),
   {code:'R6_B_DOL_BODY_STOP'});
 assert.equal(network,0);
 assert.deepEqual(physical.snapshot(),{bls:0,dol:0,total:0});
});

test('unknown network outcome consumes one physical attempted-call slot',async()=>{
 const physical=createR6BBoundedPhysicalFetch({originalFetch:async()=>{throw Error('timeout');},
   heldCoreLock:{verifyHeld:()=>true},allowPhysicalNetwork:true});
 await assert.rejects(physical.fetch(ETA,{}),/timeout/);
 assert.deepEqual(physical.snapshot(),{bls:0,dol:1,total:1});
});

test('physical fetch always disallows redirects outside the fixed allowlist',async()=>{
  let observed=null;
  const physical=createR6BBoundedPhysicalFetch({
    originalFetch:async(_url,init)=>{observed=init;return {ok:true,status:200};},
    heldCoreLock:{verifyHeld:()=>true},allowPhysicalNetwork:true,
  });
  await physical.fetch(BLS,{...b(),redirect:'follow'});
  assert.equal(observed?.redirect,'error');
  assert.deepEqual(physical.snapshot(),{bls:1,dol:0,total:1});
});
