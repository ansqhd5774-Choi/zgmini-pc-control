import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';

const oldApproval=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/us-breadth-paid-r2-backfill-insert-fourfile-20261127.json',
 import.meta.url),'utf8'));
const proposal=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/us-breadth-paid-r2-post-250-guard-proposal-20261127.json',
 import.meta.url),'utf8'));

test('post-250-guard R2 Writer B proposal cannot be consumed as owner approval',()=>{
 assert.equal(proposal.status,'PROPOSED_NOT_APPROVED');
 assert.throws(()=>validateWriterBManifest(proposal),
   {code:'WRITER_B_SOURCE_CONTRACT_STOP'});
 assert.equal(validateWriterBManifest(oldApproval),oldApproval);
});

test('proposal preserves verified Core insertion, installation CAS and effects exactly',()=>{
 const restored=structuredClone(proposal);
 restored.status=oldApproval.status;
 restored.candidateSourceSha=oldApproval.candidateSourceSha;
 restored.files[2].afterSha256=oldApproval.files[2].afterSha256;
 assert.deepEqual(restored,oldApproval);
 assert.equal(proposal.files.length,4);
 assert.deepEqual(proposal.files[0].insertions,oldApproval.files[0].insertions);
 assert.equal(proposal.files[0].beforeSha256,
   'f69fb3cc1a6fdb85af34054f016b10dcbc7b1dcbf76e51c32b617121fe22d05d');
 assert.equal(proposal.files[0].afterSha256,
   '06ff928141a68378d3011106261cb5b38eaa6ef5791e7e0f9b77f5d041906844');
 assert.equal(proposal.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
   'allowTaskDefinitionChanges','allowOtherSourceChanges'])
   assert.equal(proposal[key],false);
});

test('proposed R2 guarded source and published target hash are pinned, not an effect grant',()=>{
 assert.equal(proposal.candidateSourceSha,
   'f7ea89305df8471ffb1827d974fc2e0c223d0b09');
 assert.equal(proposal.files[2].path,'scripts/pc-writer/us-breadth-paid-r2-cycle.mjs');
 assert.equal(proposal.files[2].afterSha256,
   '6f194b20a13c21e1c458094069a3f709f4833ab5fd10fc522844581fae191ea1');
 assert.equal(proposal.files[2].beforeSha256,oldApproval.files[2].beforeSha256);
 // This only proves that the candidate has the same syntactic B scope. It does
 // not authenticate owner approval, PC original CAS/lease or a real install.
 const shaped={...proposal,status:'APPROVED_B'};
 assert.equal(validateWriterBManifest(shaped),shaped);
});
