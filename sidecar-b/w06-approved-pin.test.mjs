import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCHEMA,SUCCESSOR_SCHEMA,R3_AFTER,TARGET,sha256,validateManifest,verifyCandidateBytes} from './contract.mjs';
import {APPROVED_CANDIDATE,SUCCESSOR_CANDIDATE} from './pinned-candidate.mjs';
const original=fs.readFileSync(new URL('./approved/archive-run.mjs',import.meta.url));
const candidate=fs.readFileSync(new URL('./approved/archive-run-w06-v2.mjs',import.meta.url));
const installed='393cee0da46515ff056543173fcd1253a858b3d7',former='e4b768530335182f422ebd51d163a6f5b754361c',expected='eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b';
test('W06 successor candidate changes ONLY the installed local Writer source pin',()=>{
 assert.equal(APPROVED_CANDIDATE,'sidecar-b/approved/archive-run.mjs');
 assert.equal(SUCCESSOR_CANDIDATE,'sidecar-b/approved/archive-run-w06-v2.mjs');
 assert.equal(sha256(original),R3_AFTER);assert.equal(sha256(candidate),expected);
 assert.equal(original.length,candidate.length);
 assert.equal(candidate.toString('utf8').split(installed).length,2);
 assert.deepEqual(Buffer.from(candidate.toString('utf8').replace(installed,former),'utf8'),original);
});
test('W06 V2 exact after bytes and V1 historical candidate are separate immutable fixtures',()=>{
 const m={schema:SUCCESSOR_SCHEMA,status:'APPROVED_B',requestId:'8f265fcb-45b7-43b8-acd2-40976524db91',target:TARGET,beforeSha256:R3_AFTER,afterSha256:expected,approvedContentSha256:expected,approvedSourceSha:'b'.repeat(40),installedHead:installed,installedConfigSource:installed,taskDefinitionSha256:'c'.repeat(64),wrapperSha256:'d'.repeat(64),allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,allowTaskChanges:false,runCount:1};
 assert.equal(validateManifest(m),m);assert.equal(verifyCandidateBytes(m,candidate),candidate);
 assert.throws(()=>verifyCandidateBytes(m,original),e=>e.code==='SIDECAR_B_CANDIDATE_HASH_STOP');
 assert.throws(()=>validateManifest({...m,schema:SCHEMA}),e=>e.code==='SIDECAR_B_SCOPE_STOP');
});
