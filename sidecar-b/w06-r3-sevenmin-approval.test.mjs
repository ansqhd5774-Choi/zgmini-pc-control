import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateManifest,verifyCandidateBytes,sha256,R3_AFTER,SUCCESSOR_SCHEMA} from './contract.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const previous=read('approvals/sidecar-b/w06-cnn-r3-installed-writer-v2-ready-20261126.json');
const next=read('approvals/sidecar-b/w06-cnn-r3-installed-writer-v2-sevenmin-20261126.json');
const priorRun=read('results/cnn-sidecar-b-4b28c137-b01e-4dd0-907c-6e9f7b99e04a.json');
const core=read('results/pc-process-inventory-45809374212-1-operating.json');
const resource=read('results/pc-process-inventory-45809610562-1-operating.json');
test('W06 V2 seven-minute successor retains exact approved source effects with new one-shot request identity',()=>{
 assert.equal(validateManifest(next),next);assert.equal(next.schema,SUCCESSOR_SCHEMA);
 assert.equal(next.requestId,'a7e845b2-39d3-4e52-8500-71c818b37d9f');
 assert.notEqual(next.requestId,previous.requestId);
 assert.deepEqual({...next,requestId:previous.requestId},previous);
 assert.equal(next.beforeSha256,R3_AFTER);
 assert.equal(next.installedHead,'393cee0da46515ff056543173fcd1253a858b3d7');
 assert.equal(next.approvedSourceSha,'e8d226d9572d6de7bb24b9f62ac2bf6b30715607');
 const priorR3=fs.readFileSync(new URL('./approved/archive-run.mjs',import.meta.url));
 const old="const APPROVED='e4b768530335182f422ebd51d163a6f5b754361c';";
 const replacement="const APPROVED='393cee0da46515ff056543173fcd1253a858b3d7';";
 const bytes=Buffer.from(priorR3.toString('utf8').replace(old,replacement),'utf8');
 assert.equal(sha256(bytes),next.afterSha256);assert.equal(verifyCandidateBytes(next,bytes),bytes);
 for(const k of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges'])assert.equal(next[k],false);
 assert.equal(next.runCount,1);
});
test('previous installation failure changed nothing, new independent A samples show a real Core idle transition',()=>{
 assert.equal(priorRun.requestId,previous.requestId);
 assert.equal(priorRun.status,'SIDECAR_B_PREFLIGHT_OR_RUNTIME_STOP');
 assert.equal(priorRun.code,'SIDECAR_B_PROBE_RESOURCE_STOP');
 assert.equal(priorRun.applied,false);assert.equal(priorRun.changedFileCount,0);
 assert.equal(priorRun.backupVerified,false);
 assert.equal(core.status,'PASS');assert.equal(core.code,'CNN_B_CORE_READINESS_COLLECTED');
 assert.equal(core.cnnSidecarBCore.coreQuiet,true);
 assert.equal(core.cnnSidecarBCore.coreCycleLockPresent,false);
 assert.equal(resource.status,'PASS');assert.equal(resource.code,'CNN_B_RESOURCE_SNAPSHOT_COLLECTED');
 assert.deepEqual([resource.cnnSidecarBResources.coreQuiet,resource.cnnSidecarBResources.sidecarActive,
  resource.cnnSidecarBResources.controllerInstallBusy,resource.cnnSidecarBResources.sharedWriterLockPresent],
  [false,true,false,false]);
 assert.ok(Date.parse(resource.observedAtUtc)>Date.parse(core.observedAtUtc));
});
