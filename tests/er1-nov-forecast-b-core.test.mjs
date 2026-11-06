import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runNovemberForecastB,NOV_FORECAST_PUBLIC_KEY,
  NOV_FORECAST_B_APPROVAL} from '../er1-nov-forecast-b-core.mjs';
import {loadSavedNovemberDays} from '../er1-nov30-forecast-shadow.mjs';

const sourceSha='a'.repeat(40),asOf='2026-11-06';
const approval={scope:NOV_FORECAST_B_APPROVAL,sourceSha,
  month:'2026-11',outputKey:NOV_FORECAST_PUBLIC_KEY,
  maxProviderCalls:0,allowCoreWrites:false,maxD1Writes:1};
const savedDays=Array.from({length:30},(_,i)=>({
  day:'2026-11-'+String(i+1).padStart(2,'0'),
  body:{date:'2026-11-'+String(i+1).padStart(2,'0'),
    pre:[],after:[],notSupplied:[]},
  storedAt:'2026-11-06T05:00:00Z'
}));
const hash=s=>createHash('sha256').update(s).digest('hex');
const make=(overrides={})=>{
  const calls={load:0,stage:0,d1:0};
  const args={approval,sourceSha,asOf,
    loadSavedNovemberDays:async()=>{calls.load++;return {savedDays}},
    adapter:days=>days,scorer:rows=>rows,publicSerializer:rows=>rows,
    prepareForecastMonth:({month,savedDays})=>{
      const body=JSON.stringify({scores:[{ticker:'GAIN',score:90}]});
      return {month,publicKey:NOV_FORECAST_PUBLIC_KEY,body,
        bodySha256:hash(body),readyForStage:true,scoreableIssuers:2,
        missingOneStar:1,star3Count:0,providerCalls:0,rawRowsPublic:0,
        sourceStoredAt:savedDays[0].storedAt};
    },
    stageForecastMonth:async(p,{saveDerived})=>{
      const staged=await saveDerived(p.body);
      if(staged!==p.bodySha256)throw Error('ER1_FORECAST_BRIDGE_STAGE_READBACK_STOP');
      return {bodySha256:staged,readyForB:true};
    },
    publishForecastMonth:async(p,receipt,{syncD1})=>{
      const verified=await syncD1.run();
      if(receipt.bodySha256!==p.bodySha256)
        throw Error('ER1_FORECAST_BRIDGE_STAGE_READBACK_STOP');
      return {publicKey:p.publicKey,bodySha256:p.bodySha256,
        d1Writes:Number(verified.wrote),providerCalls:0,code:verified.code};
    },
    saveDerived:async body=>{calls.stage++;return hash(body)},
    syncD1:{publicKey:NOV_FORECAST_PUBLIC_KEY,run:async()=>{
      calls.d1++;return {code:'NOV30_ER1_D1_VERIFIED',wrote:true};}},
    remote:{},core:'fixture',clock:()=>Date.parse('2026-11-06T14:00:00Z'),
    ...overrides};
  return {args,calls};
};

test('exact November saved forecast publishes once, with one-star coverage',async()=>{
  const {args,calls}=make(),out=await runNovemberForecastB(args);
  assert.equal(out.status,'PASS');
  assert.equal(out.inputDays,30);
  assert.equal(out.estimatedIssuers,2);
  assert.equal(out.missingOneStar,1);
  assert.equal(out.providerCalls,0);
  assert.equal(out.coreWrites,0);
  assert.equal(out.d1Writes,1);
  assert.deepEqual(calls,{load:1,stage:1,d1:1});
});

test('B reuses A private-first 30-day read loop',async()=>{
  const byDay=new Map(savedDays.map(r=>[r.day,r]));
  const {args}=make({loadSavedNovemberDays:()=>loadSavedNovemberDays({
    pcHome:'/tmp/er1-forecast-test',
    privateGet:day=>Number(day.slice(-2))>16?byDay.get(day):null,
    coreGet:day=>Number(day.slice(-2))<=16?byDay.get(day):null
  })});
  const out=await runNovemberForecastB(args);
  assert.equal(out.status,'PASS');
  assert.equal(out.inputDays,30);
});

test('wrong month or source aborts before any local or remote work',async()=>{
  for(const bad of [{sourceSha:'b'.repeat(40)},
    {approval:{...approval,month:'2026-12'}},
    {asOf:'2026-12-01'},
    {syncD1:{publicKey:'market-calendar:earnings-dec2026-er1-score-public',
      run:async()=>{throw Error('D1_CALLED');}}}]){
    const {args,calls}=make(bad),out=await runNovemberForecastB(args);
    assert.equal(out.status,'BLOCKED');
    assert.deepEqual(calls,{load:0,stage:0,d1:0});
  }
});

test('missing saved days never stage and never publish',async()=>{
  const {args,calls}=make({loadSavedNovemberDays:async()=>({savedDays:[]}),
    prepareForecastMonth:()=>{throw Error('ER1_FORECAST_BRIDGE_SAVED_DAYS_INCOMPLETE')}});
  const out=await runNovemberForecastB(args);
  assert.equal(out.status,'BLOCKED');
  assert.deepEqual(calls,{load:0,stage:0,d1:0});
});

test('derived checksum failure stops D1 before effect',async()=>{
  const {args,calls}=make({saveDerived:async()=>{calls.stage++;return 'bad'}});
  const out=await runNovemberForecastB(args);
  assert.equal(out.status,'BLOCKED');
  assert.equal(calls.d1,0);
});

test('uncertain D1 outcome is STATE_UNKNOWN, not PASS',async()=>{
  const {args}=make({syncD1:{publicKey:NOV_FORECAST_PUBLIC_KEY,
    run:async()=>{throw Error('D1_RECEIPT_LOST')}}});
  const out=await runNovemberForecastB(args);
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.notEqual(out.code,'NOV30_ER1_D1_VERIFIED');
});

test('matched result reports zero additional D1 writes',async()=>{
  const {args}=make({syncD1:{publicKey:NOV_FORECAST_PUBLIC_KEY,
    run:async()=>({code:'NOV30_ER1_D1_ALREADY_MATCHED',wrote:false})}});
  const out=await runNovemberForecastB(args);
  assert.equal(out.status,'PASS');
  assert.equal(out.d1Writes,0);
});
