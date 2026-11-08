import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {proveIsolatedOldNewFixtures,runWindowsCrossVersionProof}
  from './windows-cross-version-proof.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const put=(file,value)=>{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value));
};
const get=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const fixtureUrl=symbol=>'https://getmarkethistory.com/api/v1/bars/stocks/'+
  symbol+'/1h?end=2026-10-28&format=jsonl&columns=timestamp%2Cclose%2Csymbol%2Cis_gap';

// Minimal disk-backed adapters test the PROOF HARNESS itself. They are NOT
// evidence of compatibility between any actual installed Windows versions.
function fakeRuntime({duplicateFetch=false,resetBudget=false}={}){
  const registry={
    registerDefinition({dataRoot,definition}){
      const file=path.join(dataRoot,'theme-config','definitions',
        definition.id+'.json');
      if(!fs.existsSync(file))put(file,definition);
      return {sha256:digest(fs.readFileSync(file)),
        internalId:'registered-'+definition.id};
    },
    readRegistered(dataRoot,id){
      const file=path.join(dataRoot,'theme-config','definitions',id+'.json');
      return {sha256:digest(fs.readFileSync(file)),internalId:'registered-'+id};
    },
  };
  const tool={
    async runConfiguredOnce({dataRoot,id,end,fetchImpl}){
      const stateFile=path.join(dataRoot,'themes','registered-'+id,
        'state','configured-cycle.json');
      const complete=fs.existsSync(stateFile)?get(stateFile):null;
      if(complete?.complete){
        if(duplicateFetch)await fetchImpl(new URL(fixtureUrl('AAA')),
          {redirect:'error'});
        return {providerCalls:0,d1Writes:0};
      }
      const requests=complete?['BBB','SPY']:['AAA'];
      for(const symbol of requests)await fetchImpl(new URL(fixtureUrl(symbol)),
        {redirect:'error'});
      put(stateFile,{definitionSha256:registry.readRegistered(dataRoot,id).sha256,
        start:'2023-01-01',end,complete:Boolean(complete)});
      return {collection:{providerCalls:requests.length},d1Writes:0};
    },
    planRegistered(){return {status:'PRIVATE_HISTORY_PENDING'};},
    async runConfiguredSchedule({dataRoot,now,fetchImpl}){
      const file=path.join(dataRoot,'theme-config','state','scheduled-budget.json');
      const prior=fs.existsSync(file)?get(file):null;
      if(prior?.day===now.toISOString().slice(0,10)&&!resetBudget)
        return {providerCallsToday:prior.calls,d1Writes:0};
      await fetchImpl(new URL(fixtureUrl('AAA')),{redirect:'error'});
      put(file,{day:now.toISOString().slice(0,10),calls:1});
      return {providerCallsToday:1,d1Writes:0};
    },
  };
  const store={createThemeCheckpointStore({dataRoot}){
    const base=path.join(dataRoot,'theme-platform','checkpoints');
    const leaf=(key,revision)=>path.join(base,key,`revision-${revision}.json`);
    const load=async key=>{
      const dir=path.join(base,key);
      if(!fs.existsSync(dir))return null;
      const files=fs.readdirSync(dir);
      if(!files.length)return null;
      const revision=Math.max(...files.map(x=>Number(x.slice(9,-5))));
      const envelope=get(leaf(key,revision));
      assert.equal(envelope.hash,digest(JSON.stringify(envelope.state)));
      return envelope.state;
    };
    return {load,save:async(key,state,expected)=>{
      if((await load(key))?.revision!==expected&&
        !((await load(key))===null&&expected===0))
        throw Object.assign(Error('THEME_CHECKPOINT_CAS_CONFLICT'),
          {code:'THEME_CHECKPOINT_CAS_CONFLICT'});
      put(leaf(key,state.revision),{hash:digest(JSON.stringify(state)),state});
    }};
  }};
  return {registry,tool,store};
}

test('two directions and isolated checkpoint/lease fixtures, no external effects',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cross-version-fixture-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const oldFetch=globalThis.fetch;
  const metrics=await proveIsolatedOldNewFixtures({
    oldRuntime:fakeRuntime(),newRuntime:fakeRuntime(),runnerTemp:root});
  assert.equal(globalThis.fetch,oldFetch);
  assert.deepEqual(metrics.simulations.map(x=>x.direction),
    ['OLD_TO_NEW','NEW_TO_OLD']);
  assert.equal(metrics.sharedLeaseCollisionRejected,true);
  assert.equal(metrics.oneShotReplayRejected,true);
  assert.equal(metrics.mockFetchCalls,8);
  assert.equal(metrics.d1Writes,0);
  assert.equal(metrics.externalNetworkCalls,0);
});

test('same-day budget regression cannot pass fixture',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cross-version-budget-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const oldFetch=globalThis.fetch;
  await assert.rejects(proveIsolatedOldNewFixtures({
    oldRuntime:fakeRuntime(),newRuntime:fakeRuntime({resetBudget:true}),
    runnerTemp:root}),/B_CROSS_DAILY_BUDGET_RESET/);
  assert.equal(globalThis.fetch,oldFetch);
});

test('duplicate provider GET regression cannot pass fixture',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cross-version-duplicate-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  await assert.rejects(proveIsolatedOldNewFixtures({
    oldRuntime:fakeRuntime({duplicateFetch:true}),
    newRuntime:fakeRuntime(),runnerTemp:root}),
  /B_CROSS_SAME_WINDOW_DUPLICATE_GET/);
});

test('unproven/non-Windows input cannot load any candidate module',async()=>{
  let loaded=0;
  await assert.rejects(runWindowsCrossVersionProof({platform:'linux',
    load:async()=>{loaded++;}}),/B_CROSS_WINDOWS_REQUIRED/);
  await assert.rejects(runWindowsCrossVersionProof({platform:'win32',
    load:async()=>{loaded++;}}),/B_CROSS_INPUT_PIN/);
  assert.equal(loaded,0);
});
