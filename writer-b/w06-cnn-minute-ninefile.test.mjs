import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';
const load=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const m=load('approvals/writer-updates/w06-cnn-minute-ninefile-20261126.json');
test('W06 exact nine-file scope with no new effects, original PC receipts and R2 CAS',()=>{
 assert.equal(validateWriterBManifest(m),m);assert.equal(m.files.length,9);assert.equal(m.protectedFiles.length,15);
 assert.equal(m.candidateSourceSha,'0f0bb62e4d4879369e061e9289ed1c79d91f0044');assert.equal(m.baseHead,'d8ac245003e7b8e006c2345382d5c639c6d5f18b');assert.equal(m.baseConfigSourceSha,m.baseHead);
 const original=load('results/45727629197-1-seat-5.json').result.scopedPreimage.files;
 for(const f of m.files.filter(f=>f.change==='M'))assert.equal(f.beforeSha256,original.find(x=>x.path===f.path).sha256);
 const absent=load('results/45795171248-1-seat-2.json').result.scopedPreimage.files.find(f=>!f.exists);
 assert.deepEqual(m.files.filter(f=>f.change==='A').map(f=>[f.path,f.beforeSha256]),[[absent.path,null]]);
 const receipts=["results/writer-b-insert-preview-3792-90f59760-5dd7-4df4-95c5-af0139db34a2.json","results/writer-b-insert-preview-3786-2e93ec19-4a8e-4bc5-b2d5-b983490d5be6.json","results/writer-b-insert-preview-3795-ca22b9ae-ff44-4a52-8cb8-b8484d87c401.json","results/writer-b-insert-preview-3804-c4e4be53-32d3-4eaf-9510-4a243a5f4d32.json"].map(load);
 for(const r of receipts){const f=m.files.find(x=>x.path===r.filePath);assert.equal(r.status,'PASS_READONLY');assert.equal(f.beforeSha256,r.beforeSha256);assert.equal(f.afterSha256,r.afterSha256);assert.equal(f.insertions.length,r.insertions);assert.equal(m.runtimeDependencies.taskXmlSha256,r.taskXmlSha256);}
 const protectedRows=[...load('results/45795171248-1-seat-2.json').result.scopedPreimage.files,...load('results/45795567743-1-seat-1.json').result.scopedPreimage.files].filter(f=>f.exists);
 assert.deepEqual(m.protectedFiles,protectedRows.map(f=>({path:f.path,sha256:f.sha256})));
 assert.equal(m.files.find(f=>f.path.endsWith('/run-local.mjs')).insertions.length,2);
 assert.equal(Object.hasOwn(m,'coreMaintenance'),false);
 for(const effect of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(m[effect],false);
});

test('W06 minute bounded collection wait is one exact CAS Writer B file with protected Task consumer',()=>{
 const approved=load('approvals/writer-updates/w06-cnn-minute-bounded-eligibility-onefile-20261127.json');
 assert.equal(validateWriterBManifest(approved),approved);
 assert.equal(approved.baseHead,'393cee0da46515ff056543173fcd1253a858b3d7');
 assert.equal(approved.baseConfigSourceSha,approved.baseHead);
 assert.equal(approved.candidateSourceSha,'4a13569367ff0f1afc5138f971d86a8fa99c3329');
 assert.deepEqual(approved.files,[{
  path:'worker/public-feed-refresh.mjs',change:'M',
  beforeSha256:'193034cadb0dc49af3f6f435402fd23fe3e76ac085ffe270490363903bc4d052',
  afterSha256:'63923160a66a1cf958c9f2619d8535c2038772f1fc92f40c0025d16e33aecb4c'
 }]);
 const observed=load('results/45856284910-1-seat-3.json');
 assert.equal(observed.status,'PASS');
 assert.equal(observed.code,'WRITER_APPROVED_PREIMAGE_READONLY');
 assert.equal(observed.result.sourceHead,approved.baseHead);
 assert.equal(observed.result.approvedConfigSource,approved.baseHead);
 assert.equal(observed.result.sourceIdentityConsistent,true);
 const target=observed.result.scopedPreimage.files.find(x=>x.path===approved.files[0].path);
 assert.equal(target.sha256,approved.files[0].beforeSha256);
 assert.equal(target.trackedDirty,false);
 assert.deepEqual(approved.runtimeDependencies.consumers,[{
  id:'w06-minute-launcher',kind:'LAUNCHER',
  path:'E:\\ZGmini\\data\\pc-writer\\run-local-cnn-minute.vbs',
  sha256:'73c8cf4381fd328182a9fad0a7cb5753cf9093e58524f0c9a04be4df7032d733',
  dependsOn:['worker/public-feed-refresh.mjs']
 }]);
 assert.equal(approved.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.equal(approved.runCount,1);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(approved[key],false);
 assert.equal(Object.hasOwn(approved,'coreMaintenance'),false,
  'existing natural Core idle and task policy remain unchanged');
});
