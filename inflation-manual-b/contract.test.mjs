import test from 'node:test';
import assert from 'node:assert/strict';
import {
 APPROVAL_SCHEMA_V2,DATA_ROOT,MAX_BYTES,SOURCE_POLICY_V2,TARGETS,
 V2_EXECUTABLE_SHA256,
 authorizeManualReceiver,assertAuthorizedManualReceiver,
 sha256,validateApprovalManifest,verifiedPinnedManifestBytes,
} from './contract.mjs';
import {manifest,authorizationFixture} from './fixture.mjs';
const code=(fn,expected)=>assert.throws(fn,error=>error.code===expected);

test('manifest pins exactly two official static URLs and two PC targets',()=>{
 const m=manifest();assert.equal(validateApprovalManifest(m),m);
 assert.equal(Object.keys(m.providerUrls).length,2);
 assert.equal(Object.keys(m.targetFiles).length,2);
 assert.equal(DATA_ROOT,String.raw`E:\ZGmini\data\pc-writer`);
});
test('B approval cannot grant other side effects',()=>{
 for(const key of ['allowDbWrites','allowD1Writes','allowTaskChanges',
  'allowSourceChanges','allowOtherWrites']){
  const m=manifest();m[key]=true;
  code(()=>validateApprovalManifest(m),'INFL_MANUAL_B_MANIFEST_SCOPE_STOP');
 }
});
test('manifest cannot change URL, output path, size, scope or installed source',()=>{
 for(const change of [
  m=>{m.providerUrls.bls='https://example.com/file';},
  m=>{m.targetFiles.census='C:\\temp\\data.json';},
  m=>{m.maxBytes.bls=25_000_000;},
  m=>{m.scope='ALL_PC_FILES';},
  m=>{m.sourceRoot='C:\\ZGmini';},
  m=>{m.runCount=2;},
  m=>{m.coreLeaseMode='NONE';},
 ]){const m=manifest();change(m);
  code(()=>validateApprovalManifest(m),'INFL_MANUAL_B_MANIFEST_SCOPE_STOP');}
});
test('source module list rejects omitted, swapped or wrong SHA',()=>{
 for(const change of [
  m=>{m.sourceFiles.pop();},
  m=>{m.sourceFiles.reverse();},
  m=>{m.sourceFiles[0].sha256='not-a-sha';},
 ]){const m=manifest();change(m);
  code(()=>validateApprovalManifest(m),'INFL_MANUAL_B_SOURCE_FILES_STOP');}
});
test('exact owner Issue and verified manifest raw bytes yield non-forgeable authorization',()=>{
 const f=authorizationFixture();const a=authorizeManualReceiver({
  event:f.event,env:f.env,manifestBytes:f.bytes});
 assert.equal(assertAuthorizedManualReceiver(a),a);
 code(()=>assertAuthorizedManualReceiver({...a}),
  'INFL_MANUAL_B_AUTH_OBJECT_STOP');
});
test('unapproved event actor, title, label, run attempt and public repo stop',()=>{
 for(const change of [
  f=>{f.env.GITHUB_ACTOR='somebody-else';},
  f=>{f.event.issue.title='pc-job';},
  f=>{f.event.issue.labels=[];},
  f=>{f.env.GITHUB_RUN_ATTEMPT='2';},
  f=>{f.event.repository.private=false;},
 ]){const f=authorizationFixture();change(f);
  code(()=>authorizeManualReceiver({event:f.event,env:f.env,
   manifestBytes:f.bytes}),'INFL_MANUAL_B_EVENT_AUTH_STOP');}
});
test('mutated manifest or raw hash is rejected before authorization',()=>{
 const f=authorizationFixture();
 code(()=>authorizeManualReceiver({event:f.event,env:f.env,
  manifestBytes:Buffer.concat([f.bytes,Buffer.from(' ')])}),
  'INFL_MANUAL_B_MANIFEST_HASH_STOP');
 f.event.issue.body=JSON.stringify({...f.request,
  approvalManifestSha256:'0'.repeat(64)});
 code(()=>authorizeManualReceiver({event:f.event,env:f.env,
  manifestBytes:f.bytes}),'INFL_MANUAL_B_MANIFEST_HASH_STOP');
});
test('pinned manifest accepts Git CRLF checkout but hashes HEAD blob bytes',()=>{
 const f=authorizationFixture();
 const crlf=Buffer.from(f.bytes.toString('utf8').replace(/\r?\n/g,'\r\n'));
 assert.equal(verifiedPinnedManifestBytes(crlf,f.bytes),f.bytes);
 assert.equal(verifiedPinnedManifestBytes(f.bytes,f.bytes),f.bytes);
 assert.equal(sha256(verifiedPinnedManifestBytes(crlf,f.bytes)),sha256(f.bytes));
 const mutated=Buffer.concat([crlf,Buffer.from(' ')]);
 code(()=>verifiedPinnedManifestBytes(mutated,f.bytes),
  'INFL_MANUAL_B_MANIFEST_WORKTREE_DRIFT_STOP');
 code(()=>verifiedPinnedManifestBytes(f.bytes,Buffer.from('bad')),
  'INFL_MANUAL_B_MANIFEST_GIT_BLOB_STOP');
});
test('requestId and manifest path cannot be arbitrary inputs',()=>{
 for(const change of [
  r=>{r.requestId='retry';},
  r=>{r.approvalManifestPath='../secrets.json';},
  r=>{r.operation='shell';},
 ]){const f=authorizationFixture(),r={...f.request};change(r);
  f.event.issue.body=JSON.stringify(r);
  code(()=>authorizeManualReceiver({event:f.event,env:f.env,
   manifestBytes:f.bytes}),'INFL_MANUAL_B_REQUEST_SCOPE_STOP');}
});

test('V2 approval is explicit: unchanged V1 pins and fixed effects',()=>{
 const prior=manifest();
 assert.equal(validateApprovalManifest(prior),prior);
 const v2={...prior,schema:APPROVAL_SCHEMA_V2,
  sourcePolicy:SOURCE_POLICY_V2,
  sourceFiles:prior.sourceFiles.map((entry,i)=>({...entry,
   sha256:V2_EXECUTABLE_SHA256[i]}))};
 delete v2.sourceSha;
 assert.equal(validateApprovalManifest(v2),v2);
 assert.deepEqual(v2.sourceFiles.map(x=>x.path),
  prior.sourceFiles.map(x=>x.path));
 assert.deepEqual(v2.sourceFiles.map(x=>x.sha256),V2_EXECUTABLE_SHA256);
 assert.deepEqual(v2.providerUrls,prior.providerUrls);
 assert.deepEqual(v2.targetFiles,prior.targetFiles);
 for(const change of [
  m=>{m.sourcePolicy='ALLOW_ANY_SOURCE';},
  m=>{m.sourceSha='1'.repeat(40);},
  m=>{m.allowSourceChanges=true;},
  m=>{m.runCount=2;},
  m=>{m.sourceFiles[1].sha256='f'.repeat(64);}, 
  m=>{m.sourceFiles.pop();},
 ]){
  const altered=structuredClone(v2);change(altered);
  assert.throws(()=>validateApprovalManifest(altered));
 }
 const tamperedV1={...prior,sourcePolicy:SOURCE_POLICY_V2};
 code(()=>validateApprovalManifest(tamperedV1),
  'INFL_MANUAL_B_MANIFEST_FIELDS_STOP');
});
test('V2 still requires owner Issue and signed exact manifest blob',()=>{
 const f=authorizationFixture();
 const m={...manifest(),schema:APPROVAL_SCHEMA_V2,
  sourcePolicy:SOURCE_POLICY_V2};
 m.sourceFiles=m.sourceFiles.map((entry,i)=>({...entry,sha256:V2_EXECUTABLE_SHA256[i]}));
 delete m.sourceSha;
 const bytes=Buffer.from(JSON.stringify(m));
 const req={...f.request,approvalManifestSha256:sha256(bytes)};
 f.event.issue.body=JSON.stringify(req);
 assert.equal(authorizeManualReceiver({event:f.event,env:f.env,
  manifestBytes:bytes}).manifest.schema,APPROVAL_SCHEMA_V2);
 const changed=Buffer.from(bytes.toString('utf8')+' ');
 code(()=>authorizeManualReceiver({event:f.event,env:f.env,
  manifestBytes:changed}),'INFL_MANUAL_B_MANIFEST_HASH_STOP');
});

test('V2 rejects exact-shape but newly signed arbitrary executable hash',()=>{
 const p=manifest();
 const v2={...p,schema:APPROVAL_SCHEMA_V2,
  sourcePolicy:SOURCE_POLICY_V2,
  sourceFiles:p.sourceFiles.map((entry,i)=>({...entry,
   sha256:V2_EXECUTABLE_SHA256[i]}))};
 delete v2.sourceSha;
 v2.sourceFiles[1].sha256='e'.repeat(64);
 code(()=>validateApprovalManifest(v2),'INFL_MANUAL_B_SOURCE_CLOSURE_STOP');
 // Deliberately leave V1's original behavior intact.
 const v1=manifest();v1.sourceFiles[1].sha256='e'.repeat(64);
 assert.equal(validateApprovalManifest(v1),v1);
});
