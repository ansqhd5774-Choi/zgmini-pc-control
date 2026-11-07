import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {createD30FeatureBReadOnlyHost,traceD30CoreTaskChain}
  from '../calendar-source-d30/windows-b-probe-host.mjs';
import {D30_WINDOWS_SOURCE_ROOT} from '../calendar-source-d30/windows-preview.mjs';
import {makeD30BManifestDraft} from '../calendar-source-d30/windows-b-simulator.mjs';
import {inspectD30WindowsBReadOnlyPreflight}
  from '../calendar-source-d30/windows-b-preflight.mjs';

const DATA=String.raw`E:\ZGmini\data\pc-writer`;
const ROOT=D30_WINDOWS_SOURCE_ROOT;
const WRAPPER=path.win32.join(DATA,'archive-sidecar-r7','run-original-then-archive.vbs');
const NESTED=path.win32.join(DATA,'cutover-evidence','inflation-r37-fixture','run-local-core.vbs');
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const LOCAL=path.win32.join(ROOT,'scripts','pc-writer','local-cycle.mjs');
const task=Buffer.from(`<Task><Actions><Exec><Command>C:\\Windows\\System32\\wscript.exe</Command><Arguments>&quot;${WRAPPER}&quot;</Arguments></Exec></Actions></Task>`);
const wrapper=Buffer.from(`Set shell = CreateObject("WScript.Shell")\r\nCall shell.Run("${NESTED}")\r\nCall shell.Run("archive-run.mjs")\r\n`);
const inner=Buffer.from(`Set shell=CreateObject("WScript.Shell")\r\nWScript.Quit shell.Run("""${NODE}"" ""${LOCAL}"" --publish",0,True)\r\n`);

test('actual Task XML -> fixed wrapper -> nested VBS -> Node/local-cycle chain is traced without execution',()=>{
  const paths=[];
  const result=traceD30CoreTaskChain({taskXml:task,resolvePath:p=>p,readVbs:file=>{
    paths.push(file);return file===WRAPPER?wrapper:file===NESTED?inner:null;}});
  assert.equal(result.chainVerified,true);
  assert.equal(result.archiveReferenced,true);
  assert.equal(result.observedVbsCount,2);
  assert.deepEqual(paths,[WRAPPER,NESTED]);
  assert.ok(!JSON.stringify(result).includes('shell.Run'));
});

test('quota-runner is a valid existing Core entry without a literal --publish flag',()=>{
  const quota=path.win32.join(ROOT,'scripts','pc-writer','quota-runner.mjs');
  const innerQuota=Buffer.from(`Set shell=CreateObject("WScript.Shell")\r\n`+
    `WScript.Quit shell.Run("""${NODE}"" ""${quota}"" --lane core",0,True)\r\n`);
  const r=traceD30CoreTaskChain({taskXml:task,readVbs:file=>
    file===WRAPPER?wrapper:file===NESTED?innerQuota:null});
  assert.equal(r.chainVerified,true);
  assert.equal(r.launchEntry,'quota-runner.mjs');
});

test('unresolved nested VBS source is explicit STOP, never a fabricated Task proof',()=>{
  const result=traceD30CoreTaskChain({taskXml:task,resolvePath:p=>p,readVbs:file=>
    file===WRAPPER?wrapper:Buffer.from('Set shell=CreateObject("WScript.Shell")')});
  assert.equal(result.chainVerified,false);
  assert.equal(result.reason,'ER1_D30_B_NODE_SOURCE_UNRESOLVED');
});

test('C: compatibility junction is accepted only when independently resolved to fixed E: files',()=>{
  const alias=p=>p.replace(/^E:/i,'C:');
  const aliasedTask=Buffer.from(task.toString().replaceAll(WRAPPER,alias(WRAPPER)));
  const aliasedWrapper=Buffer.from(wrapper.toString().replaceAll(NESTED,alias(NESTED)));
  const aliasedInner=Buffer.from(inner.toString().replaceAll(NODE,alias(NODE))
    .replaceAll(LOCAL,alias(LOCAL)));
  const result=traceD30CoreTaskChain({taskXml:aliasedTask,
    resolvePath:p=>p.replace(/^C:/i,'E:'),
    readVbs:p=>p===alias(WRAPPER)?aliasedWrapper:p===alias(NESTED)?aliasedInner:null});
  assert.equal(result.chainVerified,true);
  const unknown=traceD30CoreTaskChain({taskXml:aliasedTask,
    resolvePath:p=>p,readVbs:()=>aliasedWrapper});
  assert.equal(unknown.chainVerified,false);
  assert.equal(unknown.reason,'ER1_D30_B_TASK_WRAPPER_MISMATCH');
});

function fixture(){
  const calls=[];
  const files=Object.fromEntries(makeD30BManifestDraft().files.map(f=>
    [path.win32.join(ROOT,...f.path.split('/')),Buffer.from('fixture') ]));
  const map=new Map([
    [WRAPPER,wrapper],[NESTED,inner],
    [path.win32.join(DATA,'config.json'),Buffer.from(JSON.stringify({source:'a'.repeat(40)}))],
    [path.win32.join(DATA,'local-writer-last-run.json'),
      Buffer.from(JSON.stringify({source:'a'.repeat(40)}))],
    ...Object.entries(files),
  ]);
  const io={
    taskXml:()=>task,realpath:p=>p,
    git:args=>args[0]==='rev-parse'?'a'.repeat(40):'',
    read:(file,root,max)=>{calls.push(['read',file]);assert.ok([ROOT,DATA].includes(root));
      assert.ok(max<=2_000_000);if(!map.has(file))throw Error('unavailable');return map.get(file);},
    lockExists:p=>{calls.push(['lock',p]);return false;},
  };
  const host=createD30FeatureBReadOnlyHost({
    evidenceId:{issue:999,requestId:'synthetic-feature-one-shot'},io});
  return {host,io,calls,map};
}

test('feature-owned host exposes all eight bounded read-only inspections',async()=>{
  const {host}=fixture();
  const names=['inspectSourceGit','inspectTaskLaunchChain',
    'inspectWriterConfig','inspectWriterCheckpoint',
    'inspectSourceConsumers','inspectExactFileHashes',
    'inspectSharedSourceLock','inspectReadOnlyEvidenceId'];
  for(const name of names)assert.equal(typeof host[name],'function');
  assert.equal((await host.inspectTaskLaunchChain()).chainVerified,true);
  assert.equal((await host.inspectWriterConfig()).sourceSha,'a'.repeat(40));
  assert.equal((await host.inspectWriterCheckpoint()).sourceSha,'a'.repeat(40));
  const consumers=await host.inspectSourceConsumers();
  assert.equal(consumers[1].sourceSha,null);
  assert.equal(consumers[1].archiveWrapperObserved,true);
  assert.equal((await host.inspectReadOnlyEvidenceId()).issue,999);
});

test('feature-owned host scopes tracked Git changes to pinned three-file inventory',async()=>{
  const {io}=fixture();const calls=[];
  io.git=args=>{calls.push(args);return args[0]==='rev-parse'?'a'.repeat(40):
    ' M scripts/pc-writer/earnings-api-local.mjs';};
  const host=createD30FeatureBReadOnlyHost({io});
  const git=await host.inspectSourceGit();
  const names=makeD30BManifestDraft().files.map(f=>f.path);
  assert.deepEqual(calls[1],['status','--porcelain','--untracked-files=no','--',...names]);
  assert.equal(git.trackedDirty,true);
  assert.equal(git.sourceTrackedDirtyScope,'PINNED_TARGET_3FILES');
});

test('unknown sidecar binding does not become a fabricated corroboration',async()=>{
  const {host}=fixture();
  const result=await inspectD30WindowsBReadOnlyPreflight({host});
  // Fixture file content is not #682, so preimage CAS still prevents passing.
  assert.equal(result.code,'ER1_D30_B_PREVIEW_BEFORE_SHA_DRIFT');
  assert.equal(result.operationalWrites,0);
});

test('fixed exact 3-file read rejects a fourth or reordered file request',async()=>{
  const {host}=fixture();
  await assert.rejects(host.inspectExactFileHashes(['lib/unapproved.mjs']),
    {code:'ER1_D30_B_EXACT_SCOPE_STOP'});
});
