import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyDelta,runScopedOnce,KEY,EXPECTED_BASE_VERSION,EXPECTED_BASE_STORED_AT}
  from './inflation19-delta-b-contract.mjs';

const ids=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const version=tag=>'INFL19_PRESENTATION_'+tag.repeat(64);
const approval=Object.freeze({approved:true,schema:'ZGMINI_INFL19_DELTA_B_APPROVAL_V1',
  scope:'PC_STORED_WTI_AND_GAS_ONLY_D1_ONE_KEY_ONCE',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceSha:'708ed262d9425e45c0009c6470a8c7b11ac33884',key:KEY,
  expectedPublicSourceVersion:EXPECTED_BASE_VERSION,
  expectedPublicSourceStoredAt:EXPECTED_BASE_STORED_AT,expectedMaterialIds:['1','3'],
  maxD1Writes:1,maxProviderRequests:0,maxAutomaticRetries:0,allowCoreWrites:false,
  allowDbWrites:false,allowScoreWrites:false,allowSchedulerWrites:false,allowDirectDeploy:false,
  allowedMetadataOnlyIds:['18'],maxPublicGets:2,
  approvedHome:String.raw`E:\ZGmini\data\pc-writer`,
  operationalRoot:String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`,
  markerPath:String.raw`E:\ZGmini\automation\inflation19-public-delta-r1\ONE_SHOT_STARTED.json`});
const validate=p=>{if(p.indicators.length!==19)throw Error('BAD');};
const row=(id)=>({id,series:'TEST_'+id,unit:'USD',status:'READY',value:1,previousValue:0,
  observationDate:id==='1'?'2026-09-01':id==='3'?'2026-10-27':'2026-09-01',
  previousObservationDate:'2026-08-01',availableAt:'2026-11-01T00:00:00Z',
  sourceStoredAt:'2026-11-01T00:00:00Z',history:[{date:'2026-09-01',value:1}]});
function fixture() {
 const publicData={status:'READY',score:null,sourceVersion:EXPECTED_BASE_VERSION,
  sourceStoredAt:EXPECTED_BASE_STORED_AT,indicators:ids.map(row)};
 const pc=structuredClone(publicData);
 pc.sourceVersion=version('a');pc.sourceStoredAt=EXPECTED_BASE_STORED_AT+5000;
 pc.indicators[0].observationDate='2026-10-01';pc.indicators[0].value=2;
 pc.indicators[1].observationDate='2026-11-03';pc.indicators[1].value=3;
 pc.indicators.find(x=>x.id==='18').sourceStoredAt='2026-11-04T00:00:00Z';
 return {pc,publicData};
}
test('WTI and gas material + #18 metadata only: PASS_DRY_RUN',()=>{
 const {pc,publicData}=fixture();
 const x=classifyDelta(pc,publicData,{approval,validate});
 assert.deepEqual(x.materialIds,['1','3']);assert.deepEqual(x.metadataOnlyIds,['18']);
 assert.equal(x.d1Writes,0);assert.equal(x.status,'PASS_DRY_RUN');
});
test('gas remains stale => reject before any write',()=>{
 const {pc,publicData}=fixture();pc.indicators[1]=structuredClone(publicData.indicators[1]);
 assert.throws(()=>classifyDelta(pc,publicData,{approval,validate}),/REQUIRED_MATERIAL_SCOPE_DENIED/);
});
test('unexpected fourth-series change => reject',()=>{
 const {pc,publicData}=fixture();pc.indicators[2].value=2;
 assert.throws(()=>classifyDelta(pc,publicData,{approval,validate}),/REQUIRED_MATERIAL_SCOPE_DENIED/);
});
test('current public baseline changed by independent publisher => reject',()=>{
 const {pc,publicData}=fixture();publicData.sourceVersion=version('f');
 assert.throws(()=>classifyDelta(pc,publicData,{approval,validate}),/PUBLIC_BASE_MOVED/);
});
test('unapproved manifest always blocks',()=>{
 const {pc,publicData}=fixture();
 assert.throws(()=>classifyDelta(pc,publicData,{approval:{...approval,approved:false},validate}),/APPROVAL_DENIED/);
});
test('simulation DRY_RUN neither reserves marker nor writes D1',async()=>{
 const {pc,publicData}=fixture();let reserved=0,writes=0;
 const deps={verifyProvenance:async()=>{},previewStored:async()=>({ready:19,payload:pc}),
   readPublic:async()=>publicData,validate,verifyD1Binding:async()=>{},
   reserveOnce:async()=>{reserved++},writePinnedPayload:async()=>{writes++}};
 const x=await runScopedOnce({approval,deps,dryRun:true});
 assert.equal(x.status,'PASS_DRY_RUN');assert.equal(reserved,0);assert.equal(writes,0);
});
test('single pinned existing CAS write + public GET readback',async()=>{
 const {pc,publicData}=fixture();let reserved=0,writes=0,reads=0;
 const deps={verifyProvenance:async()=>{},previewStored:async()=>({ready:19,payload:pc}),
   readPublic:async()=>++reads===1?publicData:pc,validate,verifyD1Binding:async()=>{},
   reserveOnce:async()=>{reserved++},writePinnedPayload:async p=>{writes++;
     assert.deepEqual(p,pc);return {status:'READBACK_VERIFIED',key:KEY}}};
 const x=await runScopedOnce({approval,deps,dryRun:false});
 assert.equal(x.status,'PASS');assert.equal(x.d1Writes,1);
 assert.equal(reserved,1);assert.equal(writes,1);assert.equal(reads,2);
});
test('ambiguous writer failure retains one-shot and reports STATE_UNKNOWN without retry',async()=>{
 const {pc,publicData}=fixture();let reserved=0,writes=0;
 const deps={verifyProvenance:async()=>{},previewStored:async()=>({ready:19,payload:pc}),
   readPublic:async()=>publicData,validate,verifyD1Binding:async()=>{},
   reserveOnce:async()=>{reserved++},writePinnedPayload:async()=>{writes++;throw Error('NETWORK_UNCERTAIN')}};
 const x=await runScopedOnce({approval,deps,dryRun:false});
 assert.equal(x.status,'STATE_UNKNOWN');assert.equal(reserved,1);assert.equal(writes,1);
});
