import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCHEMA,SUCCESSOR_SCHEMA,R3_AFTER,TARGET,sha256,validateManifest,verifyCandidateBytes,verifyObservation} from './contract.mjs';
const m=JSON.parse(fs.readFileSync(new URL('../approvals/sidecar-b/w06-cnn-r3-installed-writer-v2-20261126.json',import.meta.url),'utf8'));
const installed='393cee0da46515ff056543173fcd1253a858b3d7';
const original=fs.readFileSync(new URL('./approved/archive-run.mjs',import.meta.url));
const old='e4b768530335182f422ebd51d163a6f5b754361c';
const candidate=Buffer.from(original.toString('utf8').replace("const APPROVED='"+old+"';","const APPROVED='"+installed+"';"),'utf8');
test('W06 approved successor pins exact installed Writer local overlay and original Task/Sidecar byte identities',()=>{
 assert.equal(validateManifest(m),m);assert.equal(m.schema,SUCCESSOR_SCHEMA);assert.notEqual(m.schema,SCHEMA);
 assert.equal(m.target,TARGET);assert.equal(m.beforeSha256,R3_AFTER);
 assert.equal(sha256(original),R3_AFTER);assert.equal(sha256(candidate),m.afterSha256);
 assert.equal(verifyCandidateBytes(m,candidate),candidate);
 assert.equal(m.approvedContentSha256,m.afterSha256);assert.equal(m.installedHead,installed);
 assert.equal(m.installedConfigSource,installed);
 assert.equal(m.approvedSourceSha,'e8d226d9572d6de7bb24b9f62ac2bf6b30715607');
 assert.equal(m.taskDefinitionSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.equal(m.wrapperSha256,'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c');
 assert.equal(m.runCount,1);
 for(const k of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges'])assert.equal(m[k],false);
});
test('W06 Sidecar B fails closed on different installed source and any altered bytes',()=>{
 assert.throws(()=>validateManifest({...m,installedHead:'f'.repeat(40)}),e=>e.code==='SIDECAR_B_SCOPE_STOP');
 assert.throws(()=>verifyCandidateBytes(m,original),e=>e.code==='SIDECAR_B_CANDIDATE_HASH_STOP');
 const bad=Buffer.concat([candidate,Buffer.from('\n// unauthorized')]);
 const modified={...m,afterSha256:sha256(bad),approvedContentSha256:sha256(bad)};
 assert.throws(()=>verifyCandidateBytes(modified,bad),e=>e.code==='SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
});
