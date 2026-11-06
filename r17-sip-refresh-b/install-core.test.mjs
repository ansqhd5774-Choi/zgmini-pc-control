import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  BASELINE_SOURCE,CANDIDATE_SOURCE,CONFIG_PATH,CORE_TASK,SOURCE_ROOT,TARGET,PROTECTED,
  TARGET_STATUS_ARGS,
  validateScopeManifest,validatePcPreimage,validateCandidateInspection,
  validateCandidateBytes,performAuthorizedInstall,
} from './install-core.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('./APPROVED_SCOPE.json',import.meta.url),'utf8'));
const existing='scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs';
const protectedFiles=Object.fromEntries(Object.entries(PROTECTED));
const preimage=()=>({sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,
  coreTask:CORE_TASK,head:BASELINE_SOURCE,configSource:BASELINE_SOURCE,
  originalBranch:'r17-writer-b/pc-r17-12345678-1234-4123-8123-123456789abc',
  targetPathsClean:true,coreTaskEnabled:true,
  existingSha256:{[existing]:TARGET[existing].beforeSha256},protectedSha256:protectedFiles});
const candidate=()=>({sourceSha:CANDIDATE_SOURCE,clean:true,
  filesSha256:Object.fromEntries(Object.entries(TARGET).map(([p,x])=>[p,x.targetSha256]))});
const auth={registeredB:true,exactOneShot:true,
  requestId:'fixture-r17-sip-once',manifestSha256:'a'.repeat(64)};

test('one-file source scope exact; no publisher, DB or task-definition writes',()=>{
  assert.equal(validateScopeManifest(manifest),manifest);
  assert.equal(Object.keys(TARGET).length,1);
  assert.equal(Object.values(TARGET).filter(x=>x.status==='M').length,1);
  assert.equal(Object.values(TARGET).filter(x=>x.status==='A').length,0);
  assert.equal(Object.keys(TARGET).some(p=>p.includes('publication')),false);
  for(const flag of ['allowProviderCalls','allowD1Writes','allowDbChanges',
    'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[flag],false);
  assert.throws(()=>validateScopeManifest({...manifest,allowD1Writes:true}),
    {code:'SIP_B_MANIFEST_SCOPE_STOP'});
  assert.throws(()=>validateScopeManifest({...manifest,files:{...manifest.files,'extra':{}}}),
    {code:'SIP_B_MANIFEST_SCOPE_STOP'});
});

test('actual PC baseline must match approved source and exact target file preimage',()=>{
  assert.equal(validatePcPreimage(preimage()).head,BASELINE_SOURCE);
  for(const bad of [{head:'0'.repeat(40)},{originalBranch:''},
    {originalBranch:'bad..branch'},
    {configSource:'0'.repeat(40)},{targetPathsClean:false},
    {existingSha256:{[existing]:'0'.repeat(64)}},{protectedSha256:{}}, 
    {coreTaskEnabled:false}]){
    assert.throws(()=>validatePcPreimage({...preimage(),...bad}),
      {code:'SIP_B_PC_PREIMAGE_STOP'});
  }
});

test('unrelated tracked dirty state is preserved; any target dirty status still stops',()=>{
  assert.deepEqual(TARGET_STATUS_ARGS,
    ['status','--porcelain=v1','--untracked-files=all','--',...Object.keys(TARGET),...Object.keys(PROTECTED)]);
  // The Windows adapter passes precisely these paths to Git status. A change
  // outside them does not alter the targetPathsClean finding.
  assert.equal(validatePcPreimage({...preimage(),unrelatedTrackedDirty:true}).head,
    BASELINE_SOURCE);
  assert.throws(()=>validatePcPreimage({...preimage(),
    unrelatedTrackedDirty:true,targetPathsClean:false}),
  {code:'SIP_B_PC_PREIMAGE_STOP'});
});

test('real Git fixture: unrelated dirty survives target branch switch; target dirty refuses',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r17-sip-scope-'));
  const run=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',
    stdio:['ignore','pipe','pipe']}).trim();
  const changed=Object.keys(TARGET).find(p=>TARGET[p].status==='M');
  const added=Object.keys(TARGET).filter(p=>TARGET[p].status==='A');
  const write=(name,value)=>{const file=path.join(root,...name.split('/'));
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  try{
    run('init','-q');run('config','user.name','ZGMINI Fixture');
    run('config','user.email','fixture@example.invalid');
    write(changed,'original\n');write('unrelated-note.txt','original\n');
    run('add','--',changed,'unrelated-note.txt');run('commit','-qm','baseline');
    const baseBranch=run('branch','--show-current');
    run('switch','-qc','sip-target');
    write(changed,'SIP code\n');for(const name of added)write(name,'new SIP module\n');
    run('add','--',...Object.keys(TARGET));run('commit','-qm','one target file');
    run('switch','-q',baseBranch);

    write('unrelated-note.txt','USER WORK PRESERVED\n');
    assert.equal(run(...TARGET_STATUS_ARGS),'');
    run('switch','-q','sip-target');
    assert.equal(fs.readFileSync(path.join(root,'unrelated-note.txt'),'utf8'),
      'USER WORK PRESERVED\n');

    run('switch','-q',baseBranch);
    write(changed,'USER TARGET DIRTY\n');
    assert.notEqual(run(...TARGET_STATUS_ARGS),'');
    assert.throws(()=>run('switch','-q','sip-target'));
    assert.equal(fs.readFileSync(path.join(root,...changed.split('/')),'utf8'),
      'USER TARGET DIRTY\n');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('candidate checkout exact one path and hashes',()=>{
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
    'switchToPreparedCommit','assertExactOneFileSource','replaceConfigSourceOnly',
    'assertConfigSource','restoreCoreExactState','assertCoreExactState',
    'restoreConfigExactly','restoreOriginalSourceExactly',
    'assertOriginalSourceAndConfig','releaseSharedWriterLock'])io[name]=make(name);
  io.inspectPcPreimage=make('inspectPcPreimage',snapshot);
  io.inspectPinnedCandidate=make('inspectPinnedCandidate',candidateInspection);
  io.prepareIsolatedExactOneFileCommit=make('prepareIsolatedExactOneFileCommit',{
    commit:'f'.repeat(40),parent:BASELINE_SOURCE,clean:true,onlyOneFile:true});
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
    'claimOnce','backupExactSourceAndConfig','prepareIsolatedExactOneFileCommit']);
  assert.ok(io.events.indexOf('waitForCoreDrain')<io.events.indexOf('switchToPreparedCommit'));
  assert.ok(io.events.indexOf('switchToPreparedCommit')<io.events.indexOf('replaceConfigSourceOnly'));
  assert.equal(io.events.at(-1),'releaseSharedWriterLock');
});

test('preflight failure consumes no claim and changes no operation',async()=>{
  const io=fakeIo({snapshot:{...preimage(),targetPathsClean:false}});
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

test('Core pause failure after an attempted disable still restores Core state',async()=>{
  const io=fakeIo({faultAt:'pauseCoreWithoutDefinitionChange'});
  const result=await performAuthorizedInstall(auth,io);
  assert.equal(result.status,'SIP_B_INSTALL_STOP');
  assert.ok(io.events.includes('restoreCoreExactState'));
  assert.ok(io.events.includes('assertCoreExactState'));
  assert.deepEqual(io.releaseArgs,{retain:false});
});
