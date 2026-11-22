import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';

const path=new URL('../approvals/writer-updates/w04-r54-stored-event-threefile-candidate-20261122.json',import.meta.url);
const staged=JSON.parse(fs.readFileSync(path,'utf8'));

test('R54 source candidate is not install-authorized until exact B effect approval',()=>{
 assert.equal(staged.status,'PENDING_B_APPROVAL');
 assert.throws(()=>validateWriterBManifest(staged),{code:'WRITER_B_SOURCE_CONTRACT_STOP'});
});
test('approved-shape trial preserves exact three-file CAS and unrelated Writer changes',()=>{
 const candidate={...staged,status:'APPROVED_B'};
 assert.equal(validateWriterBManifest(candidate),candidate);
 assert.deepEqual(candidate.files.map(x=>[x.path,x.change]),[
  ['lib/market-score/composite-model-r1.mjs','M'],
  ['lib/market-score/employment-r54-calculation-event.mjs','A'],
  ['worker/market-operational-store.mjs','M'],
 ]);
 assert.deepEqual(candidate.files.filter(x=>x.change==='M').map(x=>x.insertions.length),[1,2]);
 assert.equal(candidate.files[0].afterSha256,'f1b9fa0afce1fd05f23638193d24ecf55ae599cf358956fb629c8a8321cc8b22');
 assert.equal(candidate.files[1].afterSha256,'a9abdac19e5b554f118b77b331a7cf39b5b46a071101360b96dc590f918e49ea');
 assert.equal(candidate.files[2].afterSha256,'330b29c25dafb63e5b8fdd75ecf52e886480e7d44b40e2dc9d7d3643e952ef8b');
 assert.deepEqual(candidate.protectedFiles.map(x=>x.path),[
  'lib/market-score/domain-adapter-r1.mjs',
  'scripts/pc-writer/run-local.mjs',
 ]);
 assert.equal(candidate.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 for(const effect of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(candidate[effect],false);
});
