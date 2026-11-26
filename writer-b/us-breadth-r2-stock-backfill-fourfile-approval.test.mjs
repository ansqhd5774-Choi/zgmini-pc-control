import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';

const approval=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/us-breadth-paid-r2-backfill-fourfile-20261127.json',
 import.meta.url),'utf8'));
const files=[
 'scripts/pc-writer/local-cycle.mjs',
 'scripts/pc-writer/marketparquet-paid-store.mjs',
 'scripts/pc-writer/us-breadth-paid-r2-cycle.mjs',
 'scripts/pc-writer/us-breadth-paid-r2-stored.mjs',
];

test('R2 stock backfill overlay is exactly four approved modified files',()=>{
 assert.equal(validateWriterBManifest(approval),approval);
 assert.equal(approval.baseHead,'c8ed53a3991212dd1778742cda8a86ac133e0796');
 assert.equal(approval.baseConfigSourceSha,approval.baseHead);
 assert.equal(approval.candidateSourceSha,'10be1e52138d5a59b9464e9b04f39d5bdcdcfb32');
 assert.deepEqual(approval.files.map(x=>x.path),files);
 assert.ok(approval.files.every(x=>x.change==='M'&&x.beforeSha256!==x.afterSha256));
 assert.equal(approval.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(approval.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.deepEqual(approval.runtimeDependencies.consumers.map(x=>x.kind),['LAUNCHER']);
 assert.deepEqual(approval.runtimeDependencies.consumers[0].dependsOn,files);
 assert.deepEqual(approval.protectedFiles,[]);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges']){
  assert.equal(approval[key],false);
 }
});
test('R2 stock backfill approval cannot silently widen the installation effects',()=>{
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges']){
  assert.throws(()=>validateWriterBManifest({...approval,[key]:true}),
   {code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
 }
 assert.throws(()=>validateWriterBManifest({...approval,runCount:2}),
  {code:'WRITER_B_SOURCE_CONTRACT_STOP'});
});
