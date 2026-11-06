import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BASELINE_SOURCE,CANDIDATE_SOURCE,CONFIG_PATH,CORE_TASK,SOURCE_ROOT,TARGET,
  validateScopeManifest,validatePcPreimage,validateCandidateInspection,
  validateCandidateBytes,performAuthorizedInstall,
} from './r17-sip-b-install-core.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('./R17_SIP_B_SCOPE_DRAFT.json',import.meta.url),'utf8'));
const existing='scripts/pc-writer/us-breadth-provisional-cycle.mjs';
const absent=Object.keys(TARGET).filter(p=>TARGET[p].status==='A');
const preimage=()=>({sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,
  coreTask:CORE_TASK,head:BASELINE_SOURCE,configSource:BASELINE_SOURCE,
  worktreeClean:true,coreTaskEnabled:true,
  existingSha256:{[existing]:TARGET[existing].beforeSha256},absent});
const candidate=()=>({sourceSha:CANDIDATE_SOURCE,clean:true,
  filesSha256:Object.fromEntries(Object.entries(TARGET).map(([p,x])=>[p,x.targetSha256]))});
const auth={registeredB:true,exactOneShot:true,
  requestId:'fixture-r17-sip-once',manifestSha256:'a'.repeat(64)};

test('three-file draft scope exact; no publisher, DB or task-definition writes',()=>{
  assert.equal(validateScopeManifest(manifest),manifest);
  assert.equal(Object.keys(TARGET).length,3);
  assert.equal(Object.values(TARGET).filter(x=>x.status==='M').length,1);
  assert.equal(Object.values(TARGET).filter(x=>x.status==='A').length,2);
  assert.equal(Object.keys(TARGET).some(p=>p.includes('publication')),false);
  for(const flag of ['allowProviderCalls','allowD1Writes','allowDbChanges',
    'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[flag],false);
  assert.throws(()=>validateScopeManifest({...manifest,allowD1Writes:true}),
    {code:'SIP_B_MANIFEST_SCOPE_STOP'});
  assert.throws(()=>validateScopeManifest({...manifest,files:{...manifest.files,'extra':{}}}),
    {code:'SIP_B_MANIFEST_SCOPE_STOP'});
});

test('actual PC baseline must match local configured source, clean tree and exact preimage',()=>{
  assert.equal(validatePcPreimage(preimage()).head,BASELINE_SOURCE);
  for(const bad of [{head:'0'.repeat(40)},
    {configSource:'0'.repeat(40)},{worktreeClean:false},
    {existingSha256:{[existing]:'0'.repeat(64)}},{absent:[]},
    {coreTaskEnabled:false}]){
    assert.throws(()=>validatePcPreimage({...preimage(),...bad}),
      {code:'SIP_B_PC_PREIMAGE_STOP'});
  }
});

test('candidate checkout exact three paths and hashes',()=>{
  assert.equal(validateCandidateInspection(candidate()).clean,true);
  assert.throws(()=>validateCandidateInspection({...candidate(),clean:false}),
    {code:'SIP_B_CANDIDATE_INSPECTION_STOP'});
  assert.throws(()=>validateCandidateInspection({...candidate(),filesSha256:{}}),
    {code:'SIP_B_CANDIDATE_INSPECTION_STOP'});
  assert.throws(()=>validateCandidateBytes({}),{code:'SIP_B_CANDIDATE_PATHS_STOP'});
  assert.throws(()=>validateCandidateBytes(Object.fromEntries(Object.keys(TARGET)
    .map(p=>[p,Buffer.from('wrong bytes')]))),{code:'SIP_B_CANDIDATE_BYTES_STOP'});
});

function fakeIo({faultAt=null,snapshot=preimage(),candidateInspection=candidate()}={}){
  const events=[];
  const io={events};
  const make=(name,value)=>async(...args)=>{
    events.push(name);
    if(name===faultAt||(Array.isArray(faultAt)&&faultAt.includes(name)))
      throw new Error('fixture-failure');
    return typeof value==='function'?value(...args):value;
  };
  for(const name of ['acquireSharedWriterLock','claimOnce','backupExactSourceAndConfig',
    'pauseCoreWithoutDefinitionChange','waitForCoreDrain','assertCoreQuiet',
    'switchToPreparedCommit','assertExactThreeFileSource','replaceConfigSourceOnly',
    'assertConfigSource','restoreCoreExactState','assertCoreExactState',
    'restoreConfigExactly','restoreOriginalSourceExactly',
    'assertOriginalSourceAndConfig','releaseSharedWriterLock'])io[name]=make(name);
  io.inspectPcPreimage=make('inspectPcPreimage',snapshot);
  io.inspectPinnedCandidate=make('inspectPinnedCandidate',candidateInspection);
  io.prepareIsolatedExactThreeFileCommit=make('prepareIsolatedExactThreeFileCommit',{
    commit:'f'.repeat(40),parent:BASELINE_SOURCE,clean:true,onlyThreeFiles:true});
  const release=io.releaseSharedWriterLock;
  io.releaseSharedWriterLock=async args=>{io.releaseArgs=args;return release(args);};
  return io;
}

test('source-only dry-run coordinator follows single-claim and bounded source/config mutation order',async()=>{
  const io=fakeIo();
  const result=await performAuthorizedInstall(auth,io);
  assert.equal(result.status,'SIP_B_INSTALLED_VERIFIED');
  assert.deepEqual(io.events.slice(0,6),[
    'acquireSharedWriterLock','inspectPcPreimage','inspectPinnedCandidate',
    'claimOnce','backupExactSourceAndConfig','prepareIsolatedExactThreeFileCommit']);
  assert.ok(io.events.indexOf('waitForCoreDrain')<io.events.indexOf('switchToPreparedCommit'));
  assert.ok(io.events.indexOf('switchToPreparedCommit')<io.events.indexOf('replaceConfigSourceOnly'));
  assert.equal(io.events.at(-1),'releaseSharedWriterLock');
});

test('preflight failure consumes no claim and changes no operation',async()=>{
  const io=fakeIo({snapshot:{...preimage(),worktreeClean:false}});
  const result=await performAuthorizedInstall(auth,io);
  assert.deepEqual(result,{status:'SIP_B_PREFLIGHT_STOP',code:'SIP_B_PC_PREIMAGE_STOP'});
  assert.equal(io.events.includes('claimOnce'),false);
  assert.equal(io.events.includes('switchToPreparedCommit'),false);
  assert.equal(io.events.includes('replaceConfigSourceOnly'),false);
});

test('post-switch failure triggers source/config restore and core restoration',async()=>{
  const io=fakeIo({faultAt:'assertConfigSource'});
  const result=await performAuthorizedInstall(auth,io);
  assert.equal(result.status,'SIP_B_INSTALL_STOP');
  assert.ok(io.events.includes('restoreConfigExactly'));
  assert.ok(io.events.includes('restoreOriginalSourceExactly'));
  assert.ok(io.events.includes('restoreCoreExactState'));
});

test('unregistered adapter cannot run, even with source manifest',async()=>{
  const io=fakeIo();
  await assert.rejects(performAuthorizedInstall({...auth,registeredB:false},io),
    {code:'SIP_B_NOT_REGISTERED_OR_AUTHORIZED_STOP'});
  assert.deepEqual(io.events,[]);
});

test('uncertain rollback retains shared Writer lock for manual reconciliation',async()=>{
  const io=fakeIo({faultAt:['assertConfigSource','restoreOriginalSourceExactly']});
  const result=await performAuthorizedInstall(auth,io);
  assert.equal(result.status,'SIP_B_RECOVERY_REQUIRED');
  assert.equal(result.recovery,'MANUAL_RECONCILIATION_REQUIRED');
  assert.equal(io.events.at(-1),'releaseSharedWriterLock');
  assert.deepEqual(io.releaseArgs,{retain:true});
});
