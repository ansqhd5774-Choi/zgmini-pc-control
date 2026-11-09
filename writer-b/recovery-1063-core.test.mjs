import test from 'node:test';
import assert from 'node:assert/strict';
import {attestPreparedSnapshot,attestGitIntegrity,reconcileWriterB1063,
 INCIDENT_ID,PREPARED_SHA,BASE_SHA,BEFORE_SHA,AFTER_SHA,FINGERPRINT,MODULE}
 from './recovery-1063-core.mjs';

function snapshot(enabled=false){return {
 status:'PASS',code:'WRITER_B_1063_RECOVERY_EVIDENCE_READONLY',
 incident:'WRITER_B_1063',requestId:INCIDENT_ID,
 operationalWrites:0,providerCalls:0,d1Writes:0,
 journal:{sha256:FINGERPRINT.journal,lastPhase:'RECOVERY_REQUIRED',entryCount:10},
 backups:{matchPreimage:true,configSha256:FINGERPRINT.backupConfig,
  taskXmlSha256:FINGERPRINT.backupTask,moduleSha256:BEFORE_SHA,
  preimageSha256:FINGERPRINT.backupPreimage},
 provenance:{present:true,sha256:FINGERPRINT.provenance,
  preparedLocalSha:PREPARED_SHA},
 lock:{state:'PRESENT',matchesRequest:true,owner:INCIDENT_ID},
 source:{head:PREPARED_SHA,configSource:PREPARED_SHA,headEqualsConfig:true,
  headIsPreparedLocal:true,sourcePair:'INCIDENT_PREPARED_PAIR',
  branchKind:'INCIDENT_LOCAL_BRANCH',
  module:{path:MODULE,sha256:AFTER_SHA,state:'AFTER'},
  configSha256:FINGERPRINT.config,baseHead:BASE_SHA},
 coreTask:{name:'ZGMINI-PC-Local-Core',enabled,
  coreQuietSnapshot:!enabled,definitionMatchesOriginalExceptEnabled:true,
  xmlSha256:FINGERPRINT.disabledTaskXml},
};}
const gitProof=()=>({head:PREPARED_SHA,branch:`writer-b/${INCIDENT_ID}`,
 ref:PREPARED_SHA,tree:'a'.repeat(40),provenanceTree:'a'.repeat(40),
 parent:BASE_SHA,singleParent:true,baseTree:'b'.repeat(40),
 provenanceBaseTree:'b'.repeat(40),
 trackedClean:true,untrackedClean:true});
function harness({mutate=()=>{},failStep=null}={}){
 let enabled=false,locked=true,once=false;const log=[];
 const call=(name)=>{log.push(name);if(name===failStep)throw Error('INJECTED_FAILURE');};
 return {log,locked:()=>locked,enabled:()=>enabled,io:{
  inspect:()=>{call('inspect');const s=snapshot(enabled);
   if(!locked)s.lock.state='ABSENT';mutate(s);return s;},
  gitIntegrity:()=>{call('gitIntegrity');return gitProof();},
  reserveOnce:()=>{call('reserveOnce');assert.equal(once,false);once=true;},
  enableCore:()=>{call('enableCore');enabled=true;},
  appendPhase:async p=>{call(`append:${p}`);},
  finalizeLock:async id=>{call('finalizeLock');assert.equal(id,INCIDENT_ID);locked=false;},
 }};
}
test('expected prepared evidence is eligible for guarded roll-forward',()=>{
 assert.equal(attestPreparedSnapshot(snapshot()),true);
 assert.equal(attestGitIntegrity(gitProof()),true);
});
test('one exact transition: verify Task, then release same-owner lock',async()=>{
 const h=harness();const r=await reconcileWriterB1063(h.io);
 assert.equal(r.status,'WRITER_B_1063_CORE_RECOVERED');
 assert.equal(r.installationVerified,false);
 assert.equal(h.enabled(),true);assert.equal(h.locked(),false);
 assert.deepEqual(h.log.slice(-3),['append:CORE_RESUMED','finalizeLock','append:FINALIZED']);
});
for(const [label,mutate] of [
 ['journal drift',s=>s.journal.entryCount=11],
 ['lock foreign owner',s=>s.lock.owner='OTHER_OWNER'],
 ['live source/config mismatch',s=>s.source.configSource=BASE_SHA],
 ['module not AFTER',s=>s.source.module.sha256=BEFORE_SHA],
 ['Task definition drift',s=>s.coreTask.definitionMatchesOriginalExceptEnabled=false],
 ['Task already enabled',s=>s.coreTask.enabled=true],
 ['unknown Core process',s=>s.coreTask.coreQuietSnapshot=false],
 ])test(label+' blocks before any operational write',async()=>{
 const h=harness({mutate});const r=await reconcileWriterB1063(h.io);
 assert.equal(r.status,'WRITER_B_1063_PREFLIGHT_STOP');
 assert.equal(h.enabled(),false);assert.equal(h.locked(),true);
 assert.equal(h.log.includes('reserveOnce'),false);
});
for(const failStep of ['reserveOnce','enableCore','append:CORE_RESUMED','finalizeLock'])
test('injected '+failStep+' cannot falsely mark verified',async()=>{
 const h=harness({failStep});const r=await reconcileWriterB1063(h.io);
 assert.equal(r.verified,false);assert.notEqual(r.status,'WRITER_B_1063_CORE_RECOVERED');
 if(failStep!=='finalizeLock')assert.equal(h.locked(),true);
});
