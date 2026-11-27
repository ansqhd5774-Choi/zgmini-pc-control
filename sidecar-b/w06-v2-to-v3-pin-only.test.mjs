import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TARGET,NEXT_SUCCESSOR_SCHEMA,SCHEMA,SUCCESSOR_SCHEMA,R3_AFTER,V2_AFTER,
 sha256,validateManifest,verifyCandidateBytes,verifyObservation,applyOneFile} from './contract.mjs';

const V2_SOURCE='393cee0da46515ff056543173fcd1253a858b3d7';
const nextSource='c8ed53a3991212dd1778742cda8a86ac133e0796';
const old=fs.readFileSync(new URL('./approved/archive-run-w06-v2.mjs',import.meta.url));
const oldPin=`const APPROVED='${V2_SOURCE}';`;
const nextPin=`const APPROVED='${nextSource}';`;
assert.equal(sha256(old),V2_AFTER);
assert.equal(old.toString('utf8').split(oldPin).length,2);
const after=fs.readFileSync(new URL('./approved/archive-run-w06-v3.mjs',import.meta.url));
const expected=Buffer.from(old.toString('utf8').replace(oldPin,nextPin),'utf8');
assert.deepEqual(after,expected);
assert.equal(sha256(after),'894411dea16462c4ee305f7ec80102d81662063f5f76c8a8384f04977e860ac3');
const manifest=()=>({schema:NEXT_SUCCESSOR_SCHEMA,status:'APPROVED_B',
 requestId:'965ad702-1af9-4cf3-9003-93e9555ebc41',target:TARGET,
 beforeSha256:V2_AFTER,afterSha256:sha256(after),
 approvedContentSha256:sha256(after),approvedSourceSha:'d'.repeat(40),
 installedHead:nextSource,installedConfigSource:nextSource,
 taskDefinitionSha256:'b'.repeat(64),wrapperSha256:'c'.repeat(64),
 allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
 allowTaskChanges:false,runCount:1});
const observed=m=>({target:TARGET,regularFile:true,realPathMatches:true,
 beforeSha256:m.beforeSha256,head:m.installedHead,configSource:m.installedConfigSource,
 taskDefinitionSha256:m.taskDefinitionSha256,wrapperSha256:m.wrapperSha256,
 active:false,leaseOwned:true,sharedInstallLockOwned:true,sourceApproved:true});
const stop=(fn,code)=>assert.throws(fn,e=>e.code===code);
const draft=JSON.parse(fs.readFileSync(new URL('../drafts/w06-cnn-sidecar-v3-pin-20261128.json',import.meta.url),'utf8'));
test('exact V3 draft is byte-complete but explicitly not executable B approval',()=>{
 assert.equal(draft.schema,NEXT_SUCCESSOR_SCHEMA);
 assert.equal(draft.status,'DRAFT_UNAPPROVED');
 assert.equal(draft.beforeSha256,V2_AFTER);
 assert.equal(draft.afterSha256,sha256(after));
 assert.equal(draft.approvedContentSha256,sha256(after));
 assert.equal(draft.approvedSourceSha,'42ab63b28e0c2617486a7b7dba550101960e5cf7');
 assert.equal(draft.installedHead,nextSource);
 assert.equal(draft.installedConfigSource,nextSource);
 assert.equal(draft.runCount,1);
 stop(()=>validateManifest(draft),'SIDECAR_B_SCOPE_STOP');
 const projected={...draft,status:'APPROVED_B'};
 assert.equal(validateManifest(projected),projected);
 assert.equal(verifyCandidateBytes(projected,after),after);
});


test('V3 requires full installed V2 preimage and only new source pin',()=>{
 const m=manifest();
 assert.notEqual(m.schema,SCHEMA);assert.notEqual(m.schema,SUCCESSOR_SCHEMA);
 assert.equal(validateManifest(m),m);assert.equal(m.beforeSha256,V2_AFTER);
 assert.equal(verifyCandidateBytes(m,after),after);
 assert.equal(verifyObservation(m,observed(m)).head,nextSource);
 assert.equal(sha256(Buffer.from(after.toString('utf8').replace(nextPin,oldPin),'utf8')),V2_AFTER);
});
test('V3 rejects old preimage, unchanged pin, source drift and any expanded effect',()=>{
 const m=manifest();
 stop(()=>validateManifest({...m,beforeSha256:R3_AFTER}),'SIDECAR_B_SCOPE_STOP');
 stop(()=>validateManifest({...m,installedHead:V2_SOURCE,installedConfigSource:V2_SOURCE}),'SIDECAR_B_SCOPE_STOP');
 stop(()=>validateManifest({...m,installedConfigSource:'f'.repeat(40)}),'SIDECAR_B_SCOPE_STOP');
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges'])
  stop(()=>validateManifest({...m,[key]:true}),'SIDECAR_B_SCOPE_STOP');
 stop(()=>verifyObservation(m,{...observed(m),beforeSha256:R3_AFTER}),'SIDECAR_B_PREIMAGE_STOP');
 stop(()=>verifyObservation(m,{...observed(m),head:V2_SOURCE}),'SIDECAR_B_LINEAGE_STOP');
});
test('V3 rejects all content mutations even with matching substituted hashes',()=>{
 const m=manifest(),changed=Buffer.concat([after,Buffer.from('\n// unauthorized edit')]);
 stop(()=>verifyCandidateBytes({...m,afterSha256:sha256(changed),
   approvedContentSha256:sha256(changed)},changed),'SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
 const wrong=Buffer.from(old.toString('utf8').replace(oldPin,"const APPROVED='f'.repeat(40);"),'utf8');
 stop(()=>verifyCandidateBytes({...m,afterSha256:sha256(wrong),
   approvedContentSha256:sha256(wrong)},wrong),'SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
});
test('V3 preimage drift stops before B claim and backup',async()=>{
 const m=manifest(),events=[];
 const io={async acquire(){events.push('acquire')},
  async observe(){events.push('observe');return {...observed(m),beforeSha256:R3_AFTER}},
  async claimOnce(){events.push('claim')},async backup(){events.push('backup')},
  async atomicReplace(){events.push('replace')},async readbackSha256(){return m.afterSha256},
  async restoreBackup(){events.push('restore')},async release(){events.push('release')}};
 await assert.rejects(applyOneFile(m,after,io),e=>e.code==='SIDECAR_B_PREIMAGE_STOP');
 assert.deepEqual(events,['acquire','observe','release']);
});
test('V3 exact CAS and atomic readback preserve one-shot transaction path',async()=>{
 const m=manifest(),events=[];let stored=V2_AFTER;
 const io={async acquire(){events.push('acquire')},
  async observe(){events.push('observe');return observed(m)},
  async claimOnce(){events.push('claim')},async backup(){events.push('backup')},
  async atomicReplace(){events.push('replace');stored=sha256(after)},
  async readbackSha256(){events.push('readback');return stored},
  async restoreBackup(){events.push('restore');stored=V2_AFTER},
  async release(){events.push('release')}};
 const x=await applyOneFile(m,after,io);
 assert.equal(x.status,'APPLIED_SOURCE_ONLY');
 assert.deepEqual(events,['acquire','observe','claim','backup','observe',
  'replace','readback','release']);
});
