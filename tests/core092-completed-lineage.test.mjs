import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyCompletedCoreLineage} from '../tools/core092-completed-lineage-readonly.mjs';
import {classifyCompletedCoreLineage as classifyPackagedControllerLineage} from '../controller/core-completed-lineage-readonly.mjs';
import {validateWriterBManifest} from '../writer-b/contract.mjs';
const sha='a'.repeat(40),hash='b'.repeat(64),id='12345678-1234-4123-8123-123456789abc';
const fixture=()=>({
 cycle:{coreCycleId:id,lane:'core',coreCheckoutSourceSha:sha,
 coreOriginEvidence:'TASK_ENGINE_WMI_CAPTURED_AT_START',coreOriginCode:'CORE_TASK_ENGINE_CAPTURED_AT_START',
 coreCycleStartedAt:'2026-11-22T00:00:00.000Z',at:'2026-11-22T00:03:00.000Z',
 coreProcessPid:12,coreParentPid:11,coreNodeCreatedAtMs:Date.parse('2026-11-22T00:00:00.000Z'),
 coreEntrypointSha256:hash,coreProofFileSha256:{'core-cycle-id.mjs':hash,'core-origin-runtime.mjs':hash,'core-origin-wmi.mjs':hash},
 publishRequested:true,publicationExit:0,collectionExit:0,status:'COMPLETE'},
 collection:{coreCycleId:id,at:'2026-11-22T00:01:00.000Z',status:'COMPLETE'},
 writer:{coreCycleId:id,source:sha,at:'2026-11-22T00:02:00.000Z',mode:'PUBLISH',status:'VERIFIED'},
 identity:{status:'VERIFIED',sourceSha:sha,approvedSourceSha:sha,files:[{path:'scripts/pc-writer/local-cycle.mjs',sha256:hash}]},
 proofHashes:{'core-cycle-id.mjs':hash,'core-origin-runtime.mjs':hash,'core-origin-wmi.mjs':hash}});
test('completed natural-cycle origin links collection and Writer without claiming all business data',()=>{
 const r=classifyCompletedCoreLineage(fixture());assert.equal(r.status,'PASS');
 assert.equal(r.collectionWriterSameCycleVerified,true);assert.equal(r.allBusinessDataVerified,false);
 assert.equal(r.operationalWrites,0);
});
test('cross-cycle and other sources cannot pass on nearby timestamps',()=>{
 for(const mutate of [x=>x.writer.coreCycleId='22345678-1234-4123-8123-123456789abc',
  x=>delete x.collection.coreCycleId,x=>x.writer.source='c'.repeat(40),
  x=>x.identity.approvedSourceSha='c'.repeat(40),x=>x.cycle.lane='korea']){
  const x=fixture();mutate(x);assert.equal(classifyCompletedCoreLineage(x).status,'UNVERIFIED');
 }
});
test('unverified startup, changed proof, stale process and incomplete publication stay unverified',()=>{
 for(const mutate of [x=>x.cycle.coreOriginEvidence='START_ONLY_UNVERIFIED',
  x=>x.cycle.coreOriginCode='CORE_TASK_ENGINE_NOT_VISIBLE',
  x=>x.cycle.coreProofFileSha256['core-origin-wmi.mjs']='c'.repeat(64),
  x=>x.cycle.coreEntrypointSha256='c'.repeat(64),
  x=>x.cycle.coreNodeCreatedAtMs-=40000,x=>x.collection.at='2026-11-21T00:01:00.000Z',
  x=>x.cycle.publicationExit=1,x=>x.identity.status='UNVERIFIED',
  x=>{x.identity.files=[];delete x.cycle.coreEntrypointSha256;},
  x=>x.writer.at='2026-11-22T00:00:30.000Z',
  x=>x.writer.mode='DRY_RUN',x=>x.writer.status='FAILED']){
  const x=fixture();mutate(x);assert.equal(classifyCompletedCoreLineage(x).status,'UNVERIFIED');
 }
});
test('startup correction installs one diagnostic source and protects six business execution files',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../approvals/writer-updates/core092-origin-hidden-task-onefile-20261122.json',import.meta.url)));
 assert.equal(validateWriterBManifest(m),m);assert.equal(m.files.length,1);
 assert.equal(m.files[0].path,'scripts/pc-writer/core-origin-wmi.mjs');
 assert.equal(m.baseHead,'8d60425b1ccfc69b5710a8c9347aaa1e7451b3a5');
 assert.equal(m.protectedFiles.length,6);assert.equal(m.allowTaskDefinitionChanges,false);
 assert.equal(m.allowD1Writes,false);assert.equal(m.allowProviderCalls,false);
 assert.equal(m.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
});

test('packaged Controller readonly reader preserves approved 092 verdict semantics',()=>{
 const valid=fixture();
 assert.deepEqual(classifyPackagedControllerLineage(valid),classifyCompletedCoreLineage(valid));
 for(const mutate of [x=>x.writer.coreCycleId='22345678-1234-4123-8123-123456789abc',
  x=>x.identity.approvedSourceSha='c'.repeat(40),x=>x.cycle.publicationExit=1]){
  const invalid=fixture();mutate(invalid);
  assert.deepEqual(classifyPackagedControllerLineage(invalid),classifyCompletedCoreLineage(invalid));
  assert.equal(classifyPackagedControllerLineage(invalid).status,'UNVERIFIED');
 }
});
