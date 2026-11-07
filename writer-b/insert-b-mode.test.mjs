import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVAL_SCHEMA,SCOPE,SOURCE_REPO,sha256,
 validateWriterBManifest} from './contract.mjs';
import {verifyWriterBCandidate,verifyPreparedWriterCommit} from './installer.mjs';
import {applyApprovedInsertions,materializeApprovedWriterFile} from './insert-only-patch.mjs';

const target='scripts/pc-writer/run-local.mjs';
const original=Buffer.from("const old=true;\n// publication\n",'utf8');
const insertions=[{anchor:'// publication',position:'before',
 text:"const inflation=true;\n"}];
const result=applyApprovedInsertions(original,insertions);
const candidate=Buffer.from('// approved candidate source\n');
const H=x=>sha256(x);
const BASE='a'.repeat(40),SOURCE='b'.repeat(40),CHILD='c'.repeat(40);
function manifest(){return {
 schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
 sourceRepository:SOURCE_REPO,sourceBranch:'main',candidateSourceSha:SOURCE,
 baseHead:BASE,baseConfigSourceSha:BASE,
 sourceRoot:String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`,
 configPath:String.raw`E:\ZGmini\data\pc-writer\config.json`,
 coreTask:'ZGMINI-PC-Local-Core',
 files:[{path:target,change:'M',beforeSha256:H(original),
   afterSha256:H(result),candidateSha256:H(candidate),insertions}],
 protectedFiles:[],runtimeDependencies:{taskXmlSha256:'2'.repeat(64),
  consumers:[{id:'core-launcher',kind:'LAUNCHER',
   path:String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`,
   sha256:H(Buffer.from('launcher')),dependsOn:[target]}]},
 runCount:1,allowProviderCalls:false,allowDbChanges:false,
 allowD1Writes:false,allowTaskDefinitionChanges:false,
 allowOtherSourceChanges:false,
};}

test('bounded B insertion declares both candidate and real-PC after hashes',()=>{
 const m=manifest();
 assert.equal(validateWriterBManifest(m),m);
 verifyWriterBCandidate(m,{sourceSha:SOURCE,clean:true,
  sha256:{[target]:H(candidate)}});
 verifyPreparedWriterCommit(m,{sha:CHILD,parent:BASE,
  baseTreeOid:'d'.repeat(40),preparedTreeOid:'e'.repeat(40),
  provenanceSha256:'f'.repeat(64),mode:'LOCAL_OVERLAY',localOnly:true,
  clean:true,changedPaths:[target],sha256:{[target]:H(result)}});
});

test('B insertion candidate must match exact candidate blob, not PC postimage',()=>{
 const m=manifest();
 assert.throws(()=>verifyWriterBCandidate(m,{sourceSha:SOURCE,clean:true,
  sha256:{[target]:H(result)}}),{code:'WRITER_B_CANDIDATE_HASH_STOP'});
 assert.throws(()=>verifyPreparedWriterCommit(m,{sha:CHILD,parent:BASE,
  baseTreeOid:'d'.repeat(40),preparedTreeOid:'e'.repeat(40),
  provenanceSha256:'f'.repeat(64),mode:'LOCAL_OVERLAY',localOnly:true,
  clean:true,changedPaths:[target],sha256:{[target]:H(candidate)}}),
  {code:'WRITER_B_PREPARED_HASH_STOP'});
});

test('actual staged overlay preserves all PC bytes except pinned insertions',()=>{
 const entry=manifest().files[0];
 assert.deepEqual(materializeApprovedWriterFile(entry,candidate,original),result);
 assert.throws(()=>materializeApprovedWriterFile(entry,candidate,
  Buffer.from('drift\n')),{code:'WRITER_B_INSERT_PREIMAGE_DRIFT_STOP'});
 assert.throws(()=>materializeApprovedWriterFile(entry,
  Buffer.from('wrong\n'),original),{code:'WRITER_B_INSERT_CANDIDATE_DRIFT_STOP'});
 entry.afterSha256='0'.repeat(64);
 assert.throws(()=>materializeApprovedWriterFile(entry,candidate,original),
  {code:'WRITER_B_INSERT_AFTER_SHA_STOP'});
});

test('B insertion cannot be used to add a file or bypass required fields',()=>{
 const m=manifest();m.files[0].change='A';m.files[0].beforeSha256=null;
 assert.throws(()=>validateWriterBManifest(m),
  {code:'WRITER_B_INSERT_TARGET_SCOPE_STOP'});
 m.files[0].change='M';m.files[0].beforeSha256=H(original);
 delete m.files[0].candidateSha256;
 assert.throws(()=>validateWriterBManifest(m),
  {code:'WRITER_B_FILE_CONTRACT_STOP'});
});

test('legacy four-field full-blob M manifest retains existing behavior',()=>{
 const m=manifest();m.files[0]={path:target,change:'M',
  beforeSha256:H(original),afterSha256:H(candidate)};
 validateWriterBManifest(m);
 verifyWriterBCandidate(m,{sourceSha:SOURCE,clean:true,
  sha256:{[target]:H(candidate)}});
});
