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
