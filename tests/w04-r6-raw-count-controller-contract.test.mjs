import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../controller/common.mjs';
import {projectR6RawCountAggregate,validateBundle} from '../controller/employment-r6-candidate-readonly.mjs';

const SOURCE='76c5de87a29be9646fcbf2b6ec071914443ce762';
const req={schema:'ZGMINI_PC_JOB_V1',requestId:'w04-raw-123456',chatId:'w04',
 operation:'employment-r6-candidate-stage-readonly',
 sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/w04-pit-safe-aggregate-source-only-20261125',sourceSha:SOURCE};
const policy={operations:{'employment-r6-candidate-stage-readonly':{}},
 sourceRepository:'ansqhd5774-Choi/zgmini'};
const group={releaseGroup:'BLS_EMPLOYMENT_SITUATION',metadataKeys:1,
 bodyVerifiedKeys:1,runCertifiedKeys:1,privateSourceHash:'SECRET_SOURCE_HASH'};
const month={retrievalMonth:'2026-11',metadataKeys:1,
 bodyVerifiedKeys:1,runCertifiedKeys:1};
const raw={kind:'W04_R6_RAW_AGGREGATE_COUNT_ONLY_V1',
 status:'SOURCE_ONLY_NOT_RUNTIME_ATTESTATION',
 metadataKeys:1,bodyVerifiedKeys:1,runCertifiedKeys:1,
 rawSnapshotByGroup:[group],rawSnapshotByMonth:[month],
 historicalPitAttested:false,repairAuthorized:false,
 runtimeAuthorizationVerified:false,promotionApproved:false,
 providerCalls:0,d1Writes:0,
 path:'SECRET_PATH',body:'SECRET_BODY'};

test('new Controller option allowed only with explicit true and separate PIT mode',()=>{
 assert.equal(validateRequest({...req,rawAggregateSourceOnly:true},policy).rawAggregateSourceOnly,true);
 assert.equal(validateRequest(req,policy).rawAggregateSourceOnly,undefined);
 for(const extra of [{rawAggregateSourceOnly:false},{rawAggregateSourceOnly:1},
  {rawAggregateSourceOnly:true,pit0605Raw:true},
  {rawAggregateSourceOnly:true,pit04Offset:0},
  {rawAggregateSourceOnly:true,pit0408Private:true}]){
  assert.throws(()=>validateRequest({...req,...extra},policy));
 }
});
test('Controller raw aggregation projection permits count-only, strips private fields',()=>{
 const value=projectR6RawCountAggregate(raw);
 assert.deepEqual([value.metadataKeys,value.bodyVerifiedKeys,value.runCertifiedKeys],[1,1,1]);
 assert.equal(value.rawSnapshotByGroup[0].releaseGroup,'BLS_EMPLOYMENT_SITUATION');
 assert.doesNotMatch(JSON.stringify(value),/SECRET_|privateSourceHash|sourceSha|sourceHash|requestKey|body/);
 assert.equal(value.promotionApproved,false);
 assert.equal(value.historicalPitAttested,false);
});
test('Controller rejects false attestation, bad labels, duplicated buckets and mismatched totals',()=>{
 for(const invalid of [
  {...raw,promotionApproved:true},{...raw,historicalPitAttested:true},
  {...raw,metadataKeys:2},{...raw,runCertifiedKeys:2},
  {...raw,rawSnapshotByGroup:[group,group]},
  {...raw,rawSnapshotByMonth:[{...month,retrievalMonth:'2026-13'}]},
  {...raw,rawSnapshotByGroup:[{...group,releaseGroup:'UNAPPROVED'}]},
  {...raw,rawSnapshotByMonth:[]},
 ])assert.throws(()=>projectR6RawCountAggregate(invalid),/R6_RAW_AGGREGATE_RESULT_INVALID/);
});
test('Controller source mode is pinned and cannot reuse an old approved source',()=>{
 const host={approvedSources:{}};
 const context={host,workspace:'/tmp/source-test'};
 assert.throws(()=>validateBundle({...req,rawAggregateSourceOnly:true,
   sourceSha:'0193056bdb47bcf6c911f17623b6c302c8199c4c'},context),
  /R6_RAW_AGGREGATE_SCOPE_NOT_APPROVED/);
 assert.throws(()=>validateBundle({...req,rawAggregateSourceOnly:false},context),
  /R6_RAW_AGGREGATE_SCOPE_NOT_APPROVED/);
});
