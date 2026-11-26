import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';
import {validatePreviewSpec} from './insert-preview-readonly.mjs';

const approved=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/us-breadth-paid-r2-backfill-insert-fourfile-20261127.json',
 import.meta.url),'utf8'));
const preview=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-previews/us-breadth-paid-r2-archive-insert-20261127.json',
 import.meta.url),'utf8'));
const original=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/us-breadth-paid-r2-backfill-fourfile-20261127.json',
 import.meta.url),'utf8'));

test('R2 B overlay retains exact PC before/CAS and A-verified insert-only after SHA',()=>{
 assert.equal(validateWriterBManifest(approved),approved);
 assert.equal(validatePreviewSpec(preview),preview);
 assert.equal(approved.baseHead,'c8ed53a3991212dd1778742cda8a86ac133e0796');
 assert.equal(approved.baseConfigSourceSha,approved.baseHead);
 assert.equal(approved.candidateSourceSha,'10be1e52138d5a59b9464e9b04f39d5bdcdcfb32');
 const [core,...others]=approved.files;
 assert.equal(core.path,preview.filePath);
 assert.equal(core.change,'M');
 assert.equal(core.beforeSha256,preview.beforeSha256);
 assert.equal(core.candidateSha256,original.files[0].afterSha256);
 assert.equal(core.afterSha256,'06ff928141a68378d3011106261cb5b38eaa6ef5791e7e0f9b77f5d041906844');
 assert.deepEqual(core.insertions,preview.insertions);
 assert.equal(core.insertions.length,2);
 assert.ok(core.insertions.every(i=>i.position==='before'));
 assert.deepEqual(others,original.files.slice(1));
 assert.equal(approved.files.length,4);
});

test('R2 B insertion cannot widen effects or source consumers',()=>{
 const effects=['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'];
 for(const effect of effects){
  assert.equal(approved[effect],false);
  assert.throws(()=>validateWriterBManifest({...approved,[effect]:true}));
 }
 assert.equal(approved.runCount,1);
 assert.equal(approved.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(approved.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.deepEqual(approved.runtimeDependencies.consumers,original.runtimeDependencies.consumers);
 assert.equal(approved.protectedFiles.length,0);
 const inserted=approved.files[0].insertions.map(i=>i.text).join('\n');
 assert.doesNotMatch(inserted,/asset-r10-sp500-refresh|earnings-risk-provisional-r23-hook/);
 assert.match(inserted,/maxFiles:40-used/);
 assert.match(inserted,/assetTypes:\['stock_daily'\]/);
 assert.match(inserted,/checkApprovedPcRuntime/);
});
