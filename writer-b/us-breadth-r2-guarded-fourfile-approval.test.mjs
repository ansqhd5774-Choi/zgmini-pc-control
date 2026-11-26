import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';

const read=name=>JSON.parse(fs.readFileSync(
  new URL('../approvals/writer-updates/'+name+'.json',import.meta.url),'utf8'));
const original=read('us-breadth-paid-r2-backfill-insert-fourfile-20261127');
const proposal=read('us-breadth-paid-r2-post-250-guard-proposal-20261127');
const approved=read('us-breadth-paid-r2-guarded-fourfile-approved-20261127');

test('guarded R2 approval reuses prior exact approved effect; no broadened install scope',()=>{
  assert.equal(original.status,'APPROVED_B');
  assert.equal(proposal.status,'PROPOSED_NOT_APPROVED');
  assert.equal(approved.status,'APPROVED_B');
  assert.equal(validateWriterBManifest(original),original);
  assert.equal(validateWriterBManifest(approved),approved);
  const normalized=structuredClone(approved);
  normalized.candidateSourceSha=original.candidateSourceSha;
  normalized.files[2].afterSha256=original.files[2].afterSha256;
  assert.deepEqual(normalized,original,
    'only the verified guarded source pin and R2 cycle after hash may differ');
  assert.equal(approved.runCount,1);
  assert.equal(approved.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
  assert.equal(approved.files.length,4);
  assert.equal(approved.protectedFiles.length,0);
  for(const field of ['allowProviderCalls','allowDbChanges','allowD1Writes',
      'allowTaskDefinitionChanges','allowOtherSourceChanges']){
    assert.equal(approved[field],false);
  }
});

test('approved R2 source equals the previously CI-verified guard proposal',()=>{
  assert.deepEqual(approved,{...proposal,status:'APPROVED_B'});
  assert.equal(approved.candidateSourceSha,
    'f7ea89305df8471ffb1827d974fc2e0c223d0b09');
  assert.deepEqual(approved.files.map(f=>f.path),[
    'scripts/pc-writer/local-cycle.mjs',
    'scripts/pc-writer/marketparquet-paid-store.mjs',
    'scripts/pc-writer/us-breadth-paid-r2-cycle.mjs',
    'scripts/pc-writer/us-breadth-paid-r2-stored.mjs',
  ]);
  assert.equal(approved.files[2].afterSha256,
    '6f194b20a13c21e1c458094069a3f709f4833ab5fd10fc522844581fae191ea1');
});

test('a proposed status remains rejected and any protective edit fails approval',()=>{
  assert.throws(()=>validateWriterBManifest({...approved,status:'PROPOSED_NOT_APPROVED'}),
    {code:'WRITER_B_SOURCE_CONTRACT_STOP'});
  assert.throws(()=>validateWriterBManifest({...approved,allowProviderCalls:true}),
    {code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
  assert.throws(()=>validateWriterBManifest({...approved,files:[
    ...approved.files,approved.files[2],
  ]}),{code:'WRITER_B_FILE_DUPLICATE_STOP'});
});
