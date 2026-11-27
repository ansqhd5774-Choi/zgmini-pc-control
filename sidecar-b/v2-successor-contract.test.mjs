import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 TARGET,SCHEMA,SUCCESSOR_SCHEMA,V2_SUCCESSOR_SCHEMA,
 PREIMAGE,R3_AFTER,V2_AFTER,sha256,validateManifest,verifyCandidateBytes,
 verifyObservation,applyOneFile
} from './contract.mjs';
import {V2_SUCCESSOR_CANDIDATE} from './pinned-candidate.mjs';

// The installed V2 SHA was independently confirmed by the existing PC
// #4270 read-only observation. No runtime Writer SHA is assumed by this test.
const installedV2=fs.readFileSync(new URL('./approved/archive-run-w06-v2.mjs',import.meta.url));
const former='393cee0da46515ff056543173fcd1253a858b3d7';
const next='a'.repeat(40);
const sourceLiteral=x=>`const APPROVED='${x}';`;
const replacement=Buffer.from(installedV2.toString('utf8').replace(sourceLiteral(former),sourceLiteral(next)),'utf8');
const manifest=()=>({
 schema:V2_SUCCESSOR_SCHEMA,status:'APPROVED_B',
 requestId:'8f265fcb-45b7-43b8-acd2-40976524db91',target:TARGET,
 beforeSha256:V2_AFTER,afterSha256:sha256(replacement),
 approvedContentSha256:sha256(replacement),
 approvedSourceSha:'b'.repeat(40),installedHead:next,
 installedConfigSource:next,taskDefinitionSha256:'c'.repeat(64),
 wrapperSha256:'d'.repeat(64),allowProviderCalls:false,
 allowDbChanges:false,allowD1Writes:false,allowTaskChanges:false,runCount:1
});
const observation=m=>({
 target:TARGET,regularFile:true,realPathMatches:true,
 beforeSha256:m.beforeSha256,head:m.installedHead,
 configSource:m.installedConfigSource,
 taskDefinitionSha256:m.taskDefinitionSha256,
 wrapperSha256:m.wrapperSha256,active:false,leaseOwned:true,
 sharedInstallLockOwned:true,sourceApproved:true
});
const stop=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('new V3 successor is tied to exactly installed V2 bytes, not historic R3',()=>{
 assert.equal(sha256(installedV2),V2_AFTER);
 assert.equal(installedV2.toString('utf8').split(sourceLiteral(former)).length,2);
 assert.equal(replacement.length,installedV2.length);
 assert.equal(replacement.toString('utf8').split(sourceLiteral(next)).length,2);
 assert.equal(V2_SUCCESSOR_CANDIDATE,'sidecar-b/approved/archive-run-w06-v3.mjs');
 const m=manifest();
 assert.equal(validateManifest(m),m);
 assert.equal(verifyCandidateBytes(m,replacement),replacement);
 assert.equal(verifyObservation(m,observation(m)).beforeSha256,V2_AFTER);
 for(const change of [
  {schema:SCHEMA},{schema:SUCCESSOR_SCHEMA},
  {beforeSha256:PREIMAGE},{beforeSha256:R3_AFTER},
  {beforeSha256:'f'.repeat(64)},
  {installedConfigSource:'f'.repeat(40)},
  {installedHead:former},
  {allowDbChanges:true},{allowD1Writes:true},{allowTaskChanges:true},
  {allowProviderCalls:true},{runCount:2}
 ])stop(()=>validateManifest({...m,...change}),'SIDECAR_B_SCOPE_STOP');
});
test('only an identical V2 file with one source SHA replacement can pass',()=>{
 const m=manifest();
 const unchanged={...m,afterSha256:V2_AFTER,approvedContentSha256:V2_AFTER};
 stop(()=>verifyCandidateBytes(unchanged,installedV2),'SIDECAR_B_SCOPE_STOP');
 for(const bytes of [
  Buffer.concat([replacement,Buffer.from('// extra code\\n')]),
  Buffer.from(replacement.toString('utf8').replace('SOURCE_DIRTY','SOURCE_RELAXED'),'utf8'),
  Buffer.from(replacement.toString('utf8').replace(sourceLiteral(next),sourceLiteral('f'.repeat(40))),'utf8')
 ]){
  const digest=sha256(bytes),changed={...m,afterSha256:digest,approvedContentSha256:digest};
  stop(()=>verifyCandidateBytes(changed,bytes),'SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
 }
});
test('a stale V2 observation stops before claim, backup or mutation',async()=>{
 const m=manifest(),events=[];
 const io={
  async acquire(){events.push('acquire')},
  async observe(){events.push('observe');return {...observation(m),beforeSha256:R3_AFTER}},
  async claimOnce(){events.push('claim')},
  async backup(){events.push('backup')},
  async atomicReplace(){events.push('replace')},
  async readbackSha256(){events.push('readback');return m.afterSha256},
  async restoreBackup(){events.push('restore')},
  async release(){events.push('release')}
 };
 await assert.rejects(applyOneFile(m,replacement,io),e=>e.code==='SIDECAR_B_PREIMAGE_STOP');
 assert.deepEqual(events,['acquire','observe','release']);
});
test('existing V2 and R3 approved flows remain distinct from new V3',()=>{
 assert.notEqual(V2_AFTER,R3_AFTER);
 assert.notEqual(V2_AFTER,PREIMAGE);
 const m=manifest();
 stop(()=>validateManifest({...m,schema:SUCCESSOR_SCHEMA,afterSha256:m.afterSha256}),
  'SIDECAR_B_SCOPE_STOP');
 stop(()=>verifyCandidateBytes(m,installedV2),'SIDECAR_B_CANDIDATE_HASH_STOP');
});
