import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectCrossVersionRuntimeEvidence,RUNTIME_PROOF_SCHEMA} from
 './runtime-compatibility-evidence.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const OLD='1111111111111111',NEXT='2222222222222222';
const SOURCE_OLD='a'.repeat(40),SOURCE_NEW='b'.repeat(40);
const ROOT='E:\\ZGmini\\data\\pc-writer\\common-job';
function fixture({changedClosure=false,readbackDrift=false}={}){
 const runtime='export const scheduledLock="state/scheduled.lock";\n';
 const beforeBytes=Buffer.from(runtime),afterBytes=Buffer.from(changedClosure?
  runtime+'export const version=2;\n':runtime);
 const oldFiles=[{path:'scripts/job.mjs',sha256:sha(beforeBytes),bytes:beforeBytes.length}];
 const newFiles=[{path:'scripts/job.mjs',sha256:sha(afterBytes),bytes:afterBytes.length}];
 const stateSha=sha('synthetic-state-only');
 const proof={schema:RUNTIME_PROOF_SCHEMA,
  identity:{profileId:'common-job',oldVersion:OLD,newVersion:NEXT,
   oldSourceSha:SOURCE_OLD,newSourceSha:SOURCE_NEW,taskXmlSha256:sha('Task XML')},
  closure:{oldFiles,newFiles,unresolvedDynamicFiles:[],unresolvedImports:[],
   externalRuntimeFiles:[],analyzerSourceSha:'c'.repeat(40)},
  crossReads:[
   {writer:'old',reader:'new',fixtureInputSha256:sha('fixture'),
    stateAfterWriteSha256:stateSha,readerObservedSha256:stateSha,result:'READ_OK'},
   {writer:'new',reader:'old',fixtureInputSha256:sha('fixture'),
    stateAfterWriteSha256:stateSha,readerObservedSha256:stateSha,result:'READ_OK'},
  ],
  lock:{path:ROOT+'\\state\\scheduled.lock',events:[
   'OLD_ACQUIRE_WX','NEW_DENIED_WHILE_OLD_HELD','OLD_RELEASE',
   'NEW_ACQUIRE_WX','OLD_DENIED_WHILE_NEW_HELD','NEW_RELEASE',
  ]},
  effects:{providerCalls:0,d1Writes:0,productionDbWrites:0,externalNetworkCalls:0},
  provenance:{runnerRequestId:'a08a54e5-8f26-4875-a6c4-39c23b008111',
   runnerResultSha256:sha('synthetic ledger'),harnessSourceSha:'d'.repeat(40),
   runtimeHostFingerprintSha256:sha('synthetic host')},
 };
 const rawProofBytes=Buffer.from(JSON.stringify(proof));
 const expected={...proof.identity,sharedLockPath:proof.lock.path,oldFiles,newFiles};
 const readImmutableFile=async({version,path})=>{
  assert.equal(path,'scripts/job.mjs');
  if(version===OLD)return readbackDrift?Buffer.from('changed'):beforeBytes;
  assert.equal(version,NEXT);return afterBytes;
 };
 return {proof,rawProofBytes,approvedProofSha256:sha(rawProofBytes),
  expected,readImmutableFile};
}
function raw(f){f.rawProofBytes=Buffer.from(JSON.stringify(f.proof));
 f.approvedProofSha256=sha(f.rawProofBytes);return f;}
test('identical runtime closure is only an offline fast-path candidate, never authorization',async()=>{
 const f=fixture();
 const r=await inspectCrossVersionRuntimeEvidence(f);
 assert.equal(r.status,'OFFLINE_FORMAT_ONLY');
 assert.equal(r.compatibilityCandidate,'IDENTICAL_CLOSURE_FAST_PATH');
 assert.equal(r.closureByteReadbackVerified,true);
 assert.equal(r.trustedRunnerProvenanceVerified,false);
 assert.equal(r.activationAllowed,false);
});
test('changed runtime closure requires cross-read candidate and still cannot authorize',async()=>{
 const f=fixture({changedClosure:true});
 const r=await inspectCrossVersionRuntimeEvidence(f);
 assert.equal(r.compatibilityCandidate,'CROSS_READ_PROOF_CANDIDATE');
 assert.equal(r.activationAllowed,false);
});
test('mock transcript SHA alone never authenticates Runner provenance or activation',async()=>{
 const f=fixture();delete f.readImmutableFile;
 const r=await inspectCrossVersionRuntimeEvidence(f);
 assert.equal(r.closureByteReadbackVerified,false);
 assert.equal(r.trustedRunnerProvenanceVerified,false);
 assert.equal(r.activationAllowed,false);
});
test('raw proof, source identity, installed byte drift, dynamic import unknown all reject',async()=>{
 const f=fixture();
 await assert.rejects(inspectCrossVersionRuntimeEvidence({
  ...f,approvedProofSha256:sha('wrong')}),e=>e.code==='B_RUNTIME_PROOF_PIN_MISMATCH');
 await assert.rejects(inspectCrossVersionRuntimeEvidence({
  ...f,expected:{...f.expected,newSourceSha:'f'.repeat(40)}}),
 e=>e.code==='B_RUNTIME_PROOF_IDENTITY_DRIFT');
 const drift=fixture({readbackDrift:true});
 await assert.rejects(inspectCrossVersionRuntimeEvidence(drift),
 e=>e.code==='B_RUNTIME_PROOF_FILE_BYTES_DRIFT');
 const dyn=fixture();dyn.proof.closure.unresolvedDynamicFiles.push('computed path');raw(dyn);
 await assert.rejects(inspectCrossVersionRuntimeEvidence(dyn),
 e=>e.code==='B_RUNTIME_PROOF_CLOSURE_UNKNOWN');
});
test('no spoof via boolean PASS, lock omission, unsafe effects, or inverted directions',async()=>{
 const bool=fixture();bool.proof.crossReads=[{result:true},{result:true}];raw(bool);
 await assert.rejects(inspectCrossVersionRuntimeEvidence(bool),
 e=>e.code==='B_RUNTIME_PROOF_DIRECTION_FIELDS');
 const lock=fixture();lock.proof.lock.events=['OLD_ACQUIRE_WX'];raw(lock);
 await assert.rejects(inspectCrossVersionRuntimeEvidence(lock),
 e=>e.code==='B_RUNTIME_PROOF_LOCK_INTERLEAVING');
 const unsafe=fixture();unsafe.proof.effects.providerCalls=1;raw(unsafe);
 await assert.rejects(inspectCrossVersionRuntimeEvidence(unsafe),
 e=>e.code==='B_RUNTIME_PROOF_UNSAFE_EFFECT');
 const order=fixture();order.proof.crossReads.reverse();raw(order);
 await assert.rejects(inspectCrossVersionRuntimeEvidence(order),
 e=>e.code==='B_RUNTIME_PROOF_CROSS_READS');
});
