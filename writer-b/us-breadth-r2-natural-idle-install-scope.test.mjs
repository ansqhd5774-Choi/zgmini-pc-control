import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest,approvedCoreDrainWindowMs}
 from './contract.mjs';

const load=name=>JSON.parse(fs.readFileSync(
  new URL('../approvals/writer-updates/'+name+'.json',import.meta.url),'utf8'));
const previouslyApproved=load('us-breadth-paid-r2-guarded-fourfile-approved-20261127');
const natural=load('us-breadth-paid-r2-guarded-fourfile-natural-idle-20261127');

test('natural-idle B is exact original R2 scope with only less intrusive Core timing',()=>{
  assert.equal(validateWriterBManifest(natural),natural);
  assert.equal(validateWriterBManifest(previouslyApproved),previouslyApproved);
  const reconstructed={...natural,coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_360S_V1'};
  assert.deepEqual(reconstructed,previouslyApproved);
  assert.equal(Object.hasOwn(natural,'coreMaintenance'),false);
  assert.equal(approvedCoreDrainWindowMs(natural.coreMaintenance),null);
  assert.equal(natural.files.length,4);
  assert.equal(natural.runCount,1);
  assert.equal(natural.baseHead,natural.baseConfigSourceSha);
  assert.equal(natural.candidateSourceSha,
    'f7ea89305df8471ffb1827d974fc2e0c223d0b09');
});

test('natural-idle path retains approved 4 source hashes, effects and task CAS',()=>{
  assert.deepEqual(natural.files,previouslyApproved.files);
  assert.deepEqual(natural.runtimeDependencies,previouslyApproved.runtimeDependencies);
  for(const field of ['allowProviderCalls','allowDbChanges','allowD1Writes',
    'allowTaskDefinitionChanges','allowOtherSourceChanges']){
    assert.equal(natural[field],false);
  }
  assert.equal(natural.files[2].afterSha256,
    '6f194b20a13c21e1c458094069a3f709f4833ab5fd10fc522844581fae191ea1');
  assert.equal(natural.runtimeDependencies.taskXmlSha256,
    'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
});

test('a proposed natural-idle manifest or expanded effect is rejected',()=>{
  assert.throws(()=>validateWriterBManifest({...natural,status:'PROPOSED_NOT_APPROVED'}),
    {code:'WRITER_B_SOURCE_CONTRACT_STOP'});
  assert.throws(()=>validateWriterBManifest({...natural,allowDbChanges:true}),
    {code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
});
