import test from 'node:test';
import assert from 'node:assert/strict';
import {validBacklogOriginalPcJob,classifyBacklogOriginal} from '../tools/update.mjs';

const base={
 schema:'ZGMINI_PC_JOB_V1',
 requestId:'pc-job-20261108-verified',
 chatId:'theme_20261109',
 operation:'core-status',
 sourceRepository:'ansqhd5774-Choi/zgmini-pc-control',
 sourceBranch:'main',
 sourceSha:'a'.repeat(40)
};
const preimage={
 ...base,
 operation:'writer-install-preimage-readonly',
 preimageManifestPath:'approvals/writer-preimage/writer-preimage-20261108.json',
 preimageManifestSha256:'b'.repeat(64)
};

test('legacy seven-field pc-job is still valid',()=>{
 assert.equal(validBacklogOriginalPcJob(base),true);
});
test('approved nine-field preimage pc-job is valid during backlog replay',()=>{
 assert.equal(validBacklogOriginalPcJob(preimage),true);
});
test('seven-field preimage operation remains structurally valid',()=>{
 assert.equal(validBacklogOriginalPcJob({...base,operation:'writer-install-preimage-readonly'}),true);
});
test('partial preimage scope is rejected',()=>{
 const {preimageManifestSha256,...partial}=preimage;
 assert.equal(validBacklogOriginalPcJob(partial),false);
});
test('preimage fields on another operation are rejected',()=>{
 assert.equal(validBacklogOriginalPcJob({...preimage,operation:'core-status'}),false);
});
test('additional unexpected fields are rejected',()=>{
 assert.equal(validBacklogOriginalPcJob({...preimage,unexpected:true}),false);
 assert.equal(validBacklogOriginalPcJob({...base,unexpected:true}),false);
});
test('preimage path traversal and invalid path are rejected',()=>{
 for(const path of ['approvals/writer-preimage/../escape.json',
                     '/approvals/writer-preimage/valid-name.json',
                     'approvals/writer-preimage/Xy.json',
                     'approvals/writer-preimage/valid-name.txt']){
  assert.equal(validBacklogOriginalPcJob({...preimage,preimageManifestPath:path}),false,path);
 }
});
test('invalid SHA format and non-string scoped values are rejected',()=>{
 for(const sha of ['A'.repeat(64),'b'.repeat(63),37]){
  assert.equal(validBacklogOriginalPcJob({...preimage,preimageManifestSha256:sha}),false);
 }
 assert.equal(validBacklogOriginalPcJob({...preimage,preimageManifestPath:null}),false);
});
test('incorrect schema and requestId are rejected',()=>{
 assert.equal(validBacklogOriginalPcJob({...preimage,schema:'OTHER'}),false);
 assert.equal(validBacklogOriginalPcJob({...base,requestId:'bad'}),false);
});
test('non-object or array bodies are rejected',()=>{
 for(const v of [null,undefined,[],false,'{}']){
  assert.equal(validBacklogOriginalPcJob(v),false);
 }
});

test('malformed backlog request is a durable rejection candidate, never allowed',()=>{
 for(const body of ['{',JSON.stringify({...preimage,preimageManifestPath:'approvals/writer-updates/other-scope.json'})]){
 const r=classifyBacklogOriginal(body);assert.equal(r.valid,false);assert.match(r.originalBodySha256,/^[a-f0-9]{64}$/);
 assert.equal(Object.hasOwn(r,'body'),false);
 }
});
test('valid backlog preserves optional scoped fields for existing dispatch validation',()=>{
 const r=classifyBacklogOriginal(JSON.stringify(preimage));assert.equal(r.valid,true);assert.deepEqual(r.body,preimage);
});
test('unobservable body is not silently rejected as malformed',()=>{
 assert.throws(()=>classifyBacklogOriginal(null),{code:'BACKLOG_BODY_UNOBSERVABLE'});
});
