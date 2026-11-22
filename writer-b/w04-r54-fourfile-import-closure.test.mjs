import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/w04-r54-fourfile-import-closure-20261122.json',
 import.meta.url),'utf8'));

test('R54 revised fourfile Writer B manifest retains exact standing scope',()=>{
 assert.equal(validateWriterBManifest(manifest),manifest);
 assert.equal(manifest.status,'APPROVED_B');
 assert.equal(manifest.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(manifest.baseHead,manifest.baseConfigSourceSha);
 assert.deepEqual(manifest.files.map(f=>[f.path,f.change]),[
  ['lib/market-score/composite-model-r1.mjs','M'],
  ['lib/market-score/employment-r54-calculation-event.mjs','A'],
  ['lib/economic-employment-stored-display-r4.mjs','A'],
  ['worker/market-operational-store.mjs','M'],
 ]);
 assert.equal(manifest.files[2].beforeSha256,null);
 assert.equal(manifest.files[2].afterSha256,
  'd8c9d08a68ac7c1987d82d3a485c12c1909f6e0e31e01023247b1e1a8326172f');
 assert.deepEqual(manifest.files.filter(f=>f.change==='M').map(f=>f.insertions.length),[1,2]);
});

test('no other files, source imports, providers, database, task, or protected W01 writes are authorized',()=>{
 assert.deepEqual(manifest.protectedFiles.map(f=>f.path),[
  'lib/market-score/domain-adapter-r1.mjs',
  'scripts/pc-writer/run-local.mjs',
 ]);
 for(const effect of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[effect],false);
 assert.equal(manifest.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.throws(()=>validateWriterBManifest({...manifest,status:'PENDING_B_APPROVAL'}),{
  code:'WRITER_B_SOURCE_CONTRACT_STOP',
 });
});
