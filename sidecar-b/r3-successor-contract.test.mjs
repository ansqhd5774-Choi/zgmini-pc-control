import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCHEMA,SUCCESSOR_SCHEMA,PREIMAGE,R3_AFTER,TARGET,sha256,validateManifest,verifyCandidateBytes,verifyObservation,applyOneFile} from './contract.mjs';
const R3=fs.readFileSync(new URL('./approved/archive-run.mjs',import.meta.url));
const old='e4b768530335182f422ebd51d163a6f5b754361c',next='a'.repeat(40);
const bytes=Buffer.from(R3.toString('utf8').replace("const APPROVED='"+old+"';","const APPROVED='"+next+"';"),'utf8');
const manifest={schema:SUCCESSOR_SCHEMA,status:'APPROVED_B',requestId:'8f265fcb-45b7-43b8-acd2-40976524db91',target:TARGET,beforeSha256:R3_AFTER,afterSha256:sha256(bytes),approvedContentSha256:sha256(bytes),approvedSourceSha:'b'.repeat(40),installedHead:next,installedConfigSource:next,taskDefinitionSha256:'c'.repeat(64),wrapperSha256:'d'.repeat(64),allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,allowTaskChanges:false,runCount:1};
const obs={target:TARGET,regularFile:true,realPathMatches:true,beforeSha256:R3_AFTER,head:next,configSource:next,taskDefinitionSha256:manifest.taskDefinitionSha256,wrapperSha256:manifest.wrapperSha256,active:false,leaseOwned:true,sharedInstallLockOwned:true,sourceApproved:true};
const stop=(f,c)=>assert.throws(f,e=>e.code===c);
test('R3 exact installed bytes may only advance by one independently bound source pin',()=>{
 assert.equal(sha256(R3),R3_AFTER);assert.equal(validateManifest(manifest),manifest);assert.equal(verifyCandidateBytes(manifest,bytes),bytes);assert.equal(verifyObservation(manifest,obs),obs);
 for(const delta of [{schema:SCHEMA},{beforeSha256:PREIMAGE},{beforeSha256:'f'.repeat(64)},{installedConfigSource:'e'.repeat(40)},{allowTaskChanges:true},{runCount:2}])stop(()=>validateManifest({...manifest,...delta}),'SIDECAR_B_SCOPE_STOP');
 for(const delta of [{beforeSha256:PREIMAGE},{head:old},{configSource:old},{sourceApproved:false},{active:true},{leaseOwned:false}])assert.throws(()=>verifyObservation(manifest,{...obs,...delta}));
});
test('candidate with wrong pin or any extra byte change is rejected even with its own approved hash',async()=>{
 for(const altered of [Buffer.from(bytes.toString('utf8').replace(next,'f'.repeat(40))),Buffer.concat([bytes,Buffer.from('// unrelated change\\n')]),Buffer.from(bytes.toString('utf8').replace('if(diff)throw','if(false)throw'))]){
  const hash=sha256(altered),m={...manifest,afterSha256:hash,approvedContentSha256:hash};
  stop(()=>verifyCandidateBytes(m,altered),'SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
  await assert.rejects(applyOneFile(m,altered,{}),e=>e.code==='SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
 }
});
