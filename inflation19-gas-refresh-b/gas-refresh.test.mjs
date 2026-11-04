import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runGasRefresh,GAS_RELATIVE} from './gas-refresh.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'infl-gas-refresh-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const folder=path.join(root,'inflation-causal-r1');fs.mkdirSync(folder);
 const file=path.join(root,...GAS_RELATIVE.split('/'));
 const observations=Array.from({length:20},(_,i)=>({
  date:`2026-10-${String(i+1).padStart(2,'0')}`,value:2.5,
 }));
 const doc={schemaVersion:1,sourceVersion:'INFLATION_CAUSAL_GAS_ELECTRIC_R1',
  source:'FRED_DHHNGSP',sourceStoredAt:'2026-10-27T00:00:00.000Z',
  observations};
 fs.writeFileSync(file,JSON.stringify(doc));
 return {root,file,doc,priorSha:sha(fs.readFileSync(file))};
}
const fredUrl='https://api.stlouisfed.org/fred/series/observations?series_id=DHHNGSP';
const requested=async quotaFetch=>quotaFetch(fredUrl,{method:'GET',redirect:'manual'});

test('one FRED-only GET updates historical file and validates readback',async t=>{
 const {root,file,doc,priorSha}=fixture(t);
 let provider=0;
 const result=await runGasRefresh({base:root,expectedBase:root,expectedPriorSha:priorSha,
  fredKey:'fixture-key',quotaFetch:async()=>{provider++;return {ok:true}},
  collector:async({quotaFetch})=>{
   await requested(quotaFetch);
   const next={...doc,sourceStoredAt:'2026-11-05T00:00:00.000Z',
    observations:[...doc.observations,{date:'2026-11-03',value:2.63}]};
   fs.writeFileSync(file,JSON.stringify(next));
   return {status:'SAVED_READBACK',source:'FRED_DHHNGSP',
    latest:'2026-11-03',count:21,providerRequests:1,
    fileSha256:sha(fs.readFileSync(file))};
  }});
 assert.equal(provider,1);assert.equal(result.status,'PASS');
 assert.equal(result.latest,'2026-11-03');assert.equal(result.providerCalls,1);
 assert.equal(result.coreWrites,0);assert.equal(result.dbWrites,0);
});

test('stale FRED response with no announced Nov 03 observation is NOT PASS',async t=>{
 const {root,file,priorSha}=fixture(t);
 let calls=0;
 await assert.rejects(runGasRefresh({base:root,expectedBase:root,
  expectedPriorSha:priorSha,fredKey:'fixture-key',quotaFetch:async()=>({ok:true}),
  collector:async({quotaFetch})=>{
   await requested(quotaFetch);calls++;
   return {status:'UNCHANGED',source:'FRED_DHHNGSP',providerRequests:1,
    latest:'2026-10-20',count:20};
  }}),/GAS_REFRESH_READBACK_MISMATCH/);
 assert.equal(calls,1);
 assert.equal(sha(fs.readFileSync(file)),priorSha);
});

test('2026-11-03 official value mismatch fails even when date/count valid',async t=>{
 const {root,file,doc,priorSha}=fixture(t);
 await assert.rejects(runGasRefresh({base:root,expectedBase:root,
  expectedPriorSha:priorSha,fredKey:'fixture-key',quotaFetch:async()=>({ok:true}),
  collector:async({quotaFetch})=>{
   await requested(quotaFetch);
   fs.writeFileSync(file,JSON.stringify({...doc,
    observations:[...doc.observations,{date:'2026-11-03',value:2.64}]}));
   return {status:'SAVED_READBACK',source:'FRED_DHHNGSP',
    latest:'2026-11-03',count:21,providerRequests:1,
    fileSha256:sha(fs.readFileSync(file))};
  }}),/GAS_REFRESH_READBACK_MISMATCH/);
});

test('old file SHA drift stops before provider and without changes',async t=>{
 const {root,file,priorSha}=fixture(t);
 let called=false;
 await assert.rejects(runGasRefresh({base:root,expectedBase:root,
  expectedPriorSha:'a'.repeat(64),fredKey:'fixture-key',
  quotaFetch:async()=>{called=true},collector:async()=>{called=true}}),
  /GAS_REFRESH_PRIOR_SHA_DRIFT/);
 assert.equal(called,false);assert.equal(sha(fs.readFileSync(file)),priorSha);
});

test('missing key rejects without source fetch',async t=>{
 const {root,priorSha}=fixture(t);let called=false;
 await assert.rejects(runGasRefresh({base:root,expectedBase:root,
  expectedPriorSha:priorSha,fredKey:'',quotaFetch:async()=>{called=true},
  collector:async()=>{called=true}}),/GAS_REFRESH_KEY_MISSING/);
 assert.equal(called,false);
});

test('EIA domain and second FRED request are both forbidden',async t=>{
 const {root,priorSha}=fixture(t);
 const args={base:root,expectedBase:root,expectedPriorSha:priorSha,
  fredKey:'fixture-key',quotaFetch:async()=>({ok:true})};
 await assert.rejects(runGasRefresh({...args,collector:async({quotaFetch})=>{
  await quotaFetch('https://api.eia.gov/v2/electricity/retail-sales',{
   method:'GET',redirect:'manual'});
 }}),/GAS_REFRESH_PROVIDER_DENIED/);
 await assert.rejects(runGasRefresh({...args,collector:async({quotaFetch})=>{
  await requested(quotaFetch);await requested(quotaFetch);
 }}),/GAS_REFRESH_PROVIDER_DENIED/);
});

test('symlinked output directory is denied before GET',async t=>{
 const {root,priorSha}=fixture(t);
 const alias=path.join(root,'alias');fs.symlinkSync(root,alias,'dir');
 let called=false;
 await assert.rejects(runGasRefresh({base:alias,expectedBase:alias,
  expectedPriorSha:priorSha,fredKey:'fixture-key',
  quotaFetch:async()=>{called=true},collector:async()=>{called=true}}),
  /GAS_REFRESH_HOME_REDIRECT/);
 assert.equal(called,false);
});

test('regressing last observation is never accepted as PASS',async t=>{
 const {root,file,doc,priorSha}=fixture(t);
 await assert.rejects(runGasRefresh({base:root,expectedBase:root,
  expectedPriorSha:priorSha,fredKey:'fixture-key',quotaFetch:async()=>({ok:true}),
  collector:async({quotaFetch})=>{
   await requested(quotaFetch);fs.writeFileSync(file,JSON.stringify({...doc,
    observations:doc.observations.slice(0,-1)}));
   return {status:'SAVED_READBACK',source:'FRED_DHHNGSP',
    latest:'2026-10-19',count:19,providerRequests:1,
    fileSha256:sha(fs.readFileSync(file))};
  }}),/GAS_REFRESH_RESULT_INVALID/);
});
