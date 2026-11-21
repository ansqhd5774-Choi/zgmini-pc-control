import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from '../writer-b/contract.mjs';
import {validatePreviewSpec} from '../writer-b/insert-preview-readonly.mjs';
import {verifyWriterBPreimage,verifyWriterBCandidate,verifyPreparedWriterCommit} from '../writer-b/installer.mjs';

const manifest=JSON.parse(fs.readFileSync(
 new URL('../approvals/writer-updates/core092-natural-cycle-sixfile-20261121.json',import.meta.url),'utf8'));
const sample=Object.fromEntries(manifest.files.map(f=>[f.path,f]));

test('six exact runtime paths, installed A source pins, no unrelated writes or Task definitions',()=>{
 const valid=validateWriterBManifest(manifest);
 assert.equal(valid,manifest);
 assert.equal(manifest.files.length,6);
 assert.equal(manifest.files.filter(f=>f.change==='A').length,3);
 assert.equal(manifest.files.filter(f=>f.change==='M').length,3);
 assert.equal(manifest.baseHead,'a206220cc11045c24660e814124edbba9c0ff49f');
 assert.equal(manifest.candidateSourceSha,'4d035ee046ddd508a43913bdc170dcd6288f47fd');
 assert.equal(manifest.sourceRoot,String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`);
 assert.equal(manifest.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(manifest.runtimeDependencies.taskXmlSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.deepEqual(manifest.protectedFiles,[{path:'scripts/pc-writer/collection-events.mjs',
  sha256:'0085ea065382b8530fe3b45000d12bdb961801e183f5bd161ad897e2c53ad2ba'}]);
 assert.equal(manifest.runtimeDependencies.consumers.length,1);
 assert.equal(manifest.runtimeDependencies.consumers[0].sha256,'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c');
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[key],false);
});
test('installed preimage, expected insert-after SHA, and preview insertions cannot drift',()=>{
 const rows=[
  ['local-cycle','2cfa0f9ae794e36d0a2fcf865a571258c5d3a4e1709557a5e4c1059dde46da75','0cb4a9834c466d778415a12a4f8bdb62e66596dbd39ea2dd1b7550e982a0708d'],
  ['collect-local','82b3a5554d77986985ded9fb4ac9876554757b9699e09c15ac9ffbc08236a9f5','dd2ec67a4a26860215c4e94e4df9b0f4d4fdeb4532e0775600a810f6a966c706'],
  ['run-local','75613735df17a269869cc4c53b7771229da914eb7f09e0fe10e37215e085c5e4','9cfbd0736e305aabdee0bf285c92515949eafe0c83968b9029961a37e6bf6c3b']
 ];
 for(const [name,before,after] of rows){
  const spec=JSON.parse(fs.readFileSync(new URL(
   '../approvals/writer-previews/core092-'+name+'-r1.json',import.meta.url),'utf8'));
  validatePreviewSpec(spec);
  const entry=sample[spec.filePath];
  assert.equal(spec.baseHead,manifest.baseHead);
  assert.equal(spec.beforeSha256,before);
  assert.equal(entry.beforeSha256,before);
  assert.equal(entry.afterSha256,after);
  assert.deepEqual(entry.insertions,spec.insertions);
  assert.notEqual(entry.afterSha256,entry.candidateSha256);
 }
});
test('B preimage CAB and approved branch candidate are both fail closed',()=>{
 const preimage={
  sourceRoot:manifest.sourceRoot,configPath:manifest.configPath,
  coreTask:manifest.coreTask,head:manifest.baseHead,
  configSource:manifest.baseConfigSourceSha,
  originalConfigSha256:'a'.repeat(64),
  originalTaskDefinitionSha256:manifest.runtimeDependencies.taskXmlSha256,
  originalBranch:'main',coreTaskEnabled:true,targetPathsClean:true,
  beforeSha256:Object.fromEntries(manifest.files.map(f=>[f.path,f.beforeSha256])),
  protectedSha256:Object.fromEntries(manifest.protectedFiles.map(f=>[f.path,f.sha256])),
  runtimeConsumerSha256:Object.fromEntries(manifest.runtimeDependencies.consumers.map(f=>[f.path,f.sha256]))
 };
 assert.equal(verifyWriterBPreimage(manifest,preimage),preimage);
 assert.throws(()=>verifyWriterBPreimage(manifest,{...preimage,head:'b'.repeat(40)}),
  /WRITER_B_PC_PREIMAGE_STOP/);
 assert.throws(()=>verifyWriterBPreimage(manifest,{...preimage,
  beforeSha256:{...preimage.beforeSha256,[manifest.files[0].path]:'b'.repeat(64)}}),
  /WRITER_B_TARGET_PREIMAGE_SHA_STOP/);
 const candidate={sourceSha:manifest.candidateSourceSha,clean:true,sha256:Object.fromEntries(
  manifest.files.map(f=>[f.path,f.candidateSha256??f.afterSha256]))};
 assert.equal(verifyWriterBCandidate(manifest,candidate),candidate);
 assert.throws(()=>verifyWriterBCandidate(manifest,{...candidate,clean:false}),
  /WRITER_B_CANDIDATE_SOURCE_STOP/);
});
test('prepared transaction must be isolated and exact six-path source-only local commit',()=>{
 const expected={sha:'e'.repeat(40),parent:manifest.baseHead,baseTreeOid:'c'.repeat(40),
  preparedTreeOid:'d'.repeat(40),provenanceSha256:'a'.repeat(64),
  mode:'LOCAL_OVERLAY',localOnly:true,clean:true,
  changedPaths:manifest.files.map(f=>f.path),
  sha256:Object.fromEntries(manifest.files.map(f=>[f.path,f.afterSha256]))};
 assert.equal(verifyPreparedWriterCommit(manifest,expected),expected);
 assert.throws(()=>verifyPreparedWriterCommit(manifest,{...expected,parent:'b'.repeat(40)}),
  /WRITER_B_PREPARED_SCOPE_STOP/);
});
