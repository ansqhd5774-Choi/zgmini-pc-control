import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DATA_ROOT,MAX_BYTES,TARGETS,authorizeManualReceiver,assertAuthorizedManualReceiver,
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
