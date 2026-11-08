import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,APPROVAL_SCHEMA,SCOPE,SOURCE_REPO,
  validateWriterBManifest} from '../writer-b/contract.mjs';
import {verifyWriterBPreimage,verifyWriterBCandidate,
  verifyPreparedWriterCommit} from '../writer-b/installer.mjs';

const sha=value=>sha256(Buffer.from(value));
const base='a'.repeat(40);
const candidate='b'.repeat(40);
const next='c'.repeat(40);
const entrypoint='scripts/pc-writer/run-local.mjs';
const launcher='E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs';

function shared25(){
 const modified=[entrypoint,
  ...Array.from({length:11},(_,i)=>`worker/shared-r6-${i+1}.mjs`)];
 const added=Array.from({length:13},(_,i)=>`lib/combined-r6-${i+1}.mjs`);
 const files=[
  ...modified.map(path=>({path,change:'M',beforeSha256:sha(`old:${path}`),
   afterSha256:sha(`new:${path}`)})),
  ...added.map(path=>({path,change:'A',beforeSha256:null,
   afterSha256:sha(`new:${path}`)})),
 ];
 return {
  schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  sourceRepository:SOURCE_REPO,
  sourceBranch:'codex/employment-r6-writer25-main-20261108',
  candidateSourceSha:candidate,baseHead:base,baseConfigSourceSha:base,
  sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  configPath:'E:\\ZGmini\\data\\pc-writer\\config.json',
  coreTask:'ZGMINI-PC-Local-Core',files,
  protectedFiles:[{path:'lib/preserved-publication.mjs',
   sha256:sha('existing-untouched')}],
  runtimeDependencies:{taskXmlSha256:sha('approved-task-xml'),consumers:[{
   id:'core-launcher',kind:'LAUNCHER',path:launcher,
   sha256:sha('approved-launcher'),dependsOn:[entrypoint],
  }]},
  runCount:1,allowProviderCalls:false,allowDbChanges:false,
  allowD1Writes:false,allowTaskDefinitionChanges:false,
  allowOtherSourceChanges:false,
 };
}

function matchingPreimage(m){
 return {
  sourceRoot:m.sourceRoot,configPath:m.configPath,coreTask:m.coreTask,
  head:base,configSource:base,originalBranch:'main',coreTaskEnabled:true,
  originalConfigSha256:sha('original-config'),
  originalTaskDefinitionSha256:m.runtimeDependencies.taskXmlSha256,
  targetPathsClean:true,
  beforeSha256:Object.fromEntries(m.files.map(f=>[f.path,f.beforeSha256])),
  protectedSha256:Object.fromEntries(m.protectedFiles.map(f=>[f.path,f.sha256])),
  runtimeConsumerSha256:Object.fromEntries(m.runtimeDependencies.consumers
   .map(c=>[c.path,c.sha256])),
 };
}

test('25 unique M12/A13 Writer files pass exact scoped B preflight and overlay verification',()=>{
 const m=shared25();
 assert.equal(m.files.length,25);
 assert.equal(m.files.filter(x=>x.change==='M').length,12);
 assert.equal(m.files.filter(x=>x.change==='A').length,13);
 assert.strictEqual(validateWriterBManifest(m),m);
 const before=matchingPreimage(m);
 assert.strictEqual(verifyWriterBPreimage(m,before),before);
 const after=Object.fromEntries(m.files.map(f=>[f.path,f.afterSha256]));
 assert.deepEqual(verifyWriterBCandidate(m,{sourceSha:candidate,clean:true,
  sha256:after}).sha256,after);
 const prepared={sha:next,parent:base,baseTreeOid:'1'.repeat(40),
  preparedTreeOid:'2'.repeat(40),provenanceSha256:sha('provenance'),
  mode:'LOCAL_OVERLAY',localOnly:true,clean:true,
  changedPaths:m.files.map(f=>f.path),sha256:after};
 assert.strictEqual(verifyPreparedWriterCommit(m,prepared),prepared);
});

test('25-file plan rejects an old Task XML SHA and one lost shared target',()=>{
 const m=shared25();
 const before=matchingPreimage(m);
 before.originalTaskDefinitionSha256=sha('stale-task-xml');
 assert.throws(()=>verifyWriterBPreimage(m,before),
  {code:'WRITER_B_TASK_APPROVED_XML_SHA_STOP'});
 const after=Object.fromEntries(m.files.map(f=>[f.path,f.afterSha256]));
 delete after[entrypoint];
 assert.throws(()=>verifyWriterBCandidate(m,{sourceSha:candidate,clean:true,
  sha256:after}),{code:'WRITER_B_CANDIDATE_SOURCE_STOP'});
});

test('two owners may not supply two conflicting versions of the same shared path',()=>{
 const m=shared25();
 m.files.push({...m.files[0],afterSha256:sha('unrelated-owner-overwrite')});
 assert.throws(()=>validateWriterBManifest(m),
  {code:'WRITER_B_FILE_DUPLICATE_STOP'});
});
