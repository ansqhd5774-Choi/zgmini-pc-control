// Source-only fixture: actual Writer HEAD was read on the authorized Windows PC.
// This is NOT an approval or install instruction. No provider/DB/D1/Task effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 TARGET,NEXT_SUCCESSOR_SCHEMA,V2_AFTER,sha256,
 validateManifest,verifyCandidateBytes,verifyObservation
} from './contract.mjs';
const BEFORE='393cee0da46515ff056543173fcd1253a858b3d7';
const HEAD='c8ed53a3991212dd1778742cda8a86ac133e0796';
const AFTER='894411dea16462c4ee305f7ec80102d81662063f5f76c8a8384f04977e860ac3';
const v2=fs.readFileSync(new URL('./approved/archive-run-w06-v2.mjs',import.meta.url));
const v3=fs.readFileSync(new URL('./approved/archive-run-w06-v3.mjs',import.meta.url));
const from=`const APPROVED='${BEFORE}';`,to=`const APPROVED='${HEAD}';`;
const m=()=>({
 schema:NEXT_SUCCESSOR_SCHEMA,status:'APPROVED_B',
 requestId:'965ad702-1af9-4cf3-9003-93e9555ebc41',target:TARGET,
 beforeSha256:V2_AFTER,afterSha256:AFTER,approvedContentSha256:AFTER,
 approvedSourceSha:'d'.repeat(40),installedHead:HEAD,installedConfigSource:HEAD,
 taskDefinitionSha256:'b'.repeat(64),wrapperSha256:'c'.repeat(64),
 allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
 allowTaskChanges:false,runCount:1
});
const obs=manifest=>({
 target:TARGET,regularFile:true,realPathMatches:true,
 beforeSha256:V2_AFTER,head:HEAD,configSource:HEAD,
 taskDefinitionSha256:manifest.taskDefinitionSha256,
 wrapperSha256:manifest.wrapperSha256,active:false,
 leaseOwned:true,sharedInstallLockOwned:true,sourceApproved:true
});
test('operating Writer HEAD c8ed53 pins ONLY one literal in the exact installed V2 bytes',()=>{
 assert.equal(sha256(v2),V2_AFTER);
 assert.equal(v2.length,11478);
 assert.equal(v3.length,v2.length);
 assert.equal(v2.toString('utf8').split(from).length,2);
 assert.equal(v3.toString('utf8').split(to).length,2);
 assert.equal(v3.toString('utf8'),v2.toString('utf8').replace(from,to));
 assert.equal(sha256(v3),AFTER);
 assert.equal(sha256(Buffer.from(v3.toString('utf8').replace(to,from),'utf8')),V2_AFTER);
});
test('candidate is accepted under independently pinned V3 contract only',()=>{
 const manifest=m();
 assert.equal(validateManifest(manifest),manifest);
 assert.equal(verifyCandidateBytes(manifest,v3),v3);
 assert.equal(verifyObservation(manifest,obs(manifest)).beforeSha256,V2_AFTER);
});
test('source/config drift, stale CAS, arbitrary after bytes and wider effects fail closed',()=>{
 const manifest=m();
 const mutations=[
  {installedHead:'f'.repeat(40)},{installedConfigSource:'f'.repeat(40)},
  {beforeSha256:'f'.repeat(64)},{allowProviderCalls:true},
  {allowDbChanges:true},{allowD1Writes:true},{allowTaskChanges:true},
  {runCount:2}
 ];
 for(const changed of mutations)
  assert.throws(()=>validateManifest({...manifest,...changed}),e=>e.code==='SIDECAR_B_SCOPE_STOP');
 assert.throws(()=>verifyObservation(manifest,{...obs(manifest),beforeSha256:'f'.repeat(64)}),
  e=>e.code==='SIDECAR_B_PREIMAGE_STOP');
 const changedBytes=Buffer.concat([v3,Buffer.from('// inserted unapproved code')]);
 const changedHash=sha256(changedBytes);
 assert.throws(()=>verifyCandidateBytes({...manifest,afterSha256:changedHash,
  approvedContentSha256:changedHash},changedBytes),
 e=>e.code==='SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
 assert.throws(()=>verifyCandidateBytes(manifest,v2),
 e=>e.code==='SIDECAR_B_CANDIDATE_HASH_STOP');
});
