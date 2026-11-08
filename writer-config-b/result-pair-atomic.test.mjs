import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadResultPairAtomic} from './result-pair-atomic.mjs';
import {createGitPairFixture} from './result-pair-test-fixture.mjs';

const outputs=[['results/writer-config-b-proof-990-100.json','{"ok":true}\n'],
 ['results/writer-config-b-proof-990-100.txt','status=PASS\n']];
const headers={authorization:'Bearer '+('x'.repeat(30))};
test('atomic one-commit delivery creates and confirms both independent bytes',async()=>{
 const f=createGitPairFixture();
 const r=await uploadResultPairAtomic({outputs,headers,fetchApi:f.fetchApi});
 assert.deepEqual([r.created,r.verified,f.counts.commits,f.counts.updates],[2,2,1,1]);
 assert.equal(f.files.get(outputs[0][0]).toString(),outputs[0][1]);
 assert.equal(f.files.get(outputs[1][0]).toString(),outputs[1][1]);
});
for(const already of [[outputs[0][0]],[outputs[1][0]],
 [outputs[0][0],outputs[1][0]]]){
 test('preexisting output path rejects all mutations: '+already.join(','),async()=>{
  const f=createGitPairFixture({existingPaths:already});
  const r=await uploadResultPairAtomic({outputs,headers,fetchApi:f.fetchApi});
  assert.deepEqual([r.created,r.verified,f.counts.commits,f.counts.updates],
   [0,0,0,0]);
  already.forEach(path=>assert.equal(f.files.get(path).toString(),'old result'));
 });
}
test('non-fast-forward conflict cannot leave partial published pair',async()=>{
 const f=createGitPairFixture({rejectRefUpdate:true});
 const r=await uploadResultPairAtomic({outputs,headers,fetchApi:f.fetchApi});
 assert.deepEqual([r.created,r.verified,f.counts.commits,f.counts.updates],
  [0,0,1,1]);
 assert.equal(f.files.size,0);
});
test('lost PATCH response reconciles by read only and does not reapply',async()=>{
 const f=createGitPairFixture({throwAfterUpdate:true});
 const r=await uploadResultPairAtomic({outputs,headers,fetchApi:f.fetchApi});
 assert.deepEqual([r.created,r.verified,f.counts.commits,f.counts.updates],
  [2,2,1,1]);
 assert.equal(f.files.size,2);
});
test('malformed successful ref response is checked by independent ref read',async()=>{
 const f=createGitPairFixture({malformedPatchResponse:true});
 const r=await uploadResultPairAtomic({outputs,headers,fetchApi:f.fetchApi});
 assert.deepEqual([r.created,r.verified,f.counts.commits,f.counts.updates],
  [2,2,1,1]);
});
test('unexpected paths and non-JSON/TXT pair cannot be published',async()=>{
 const f=createGitPairFixture();
 for(const bad of [
  [['data/secret.json','x'],['data/secret.txt','x']],
  [['results/x.json','x'],['results/y.txt','x']],
  [['results/x.json',''],['results/x.txt','x']],
 ])await assert.rejects(uploadResultPairAtomic({outputs:bad,headers,
  fetchApi:f.fetchApi}),/CONFIG_B_PAIR_INPUT_STOP/);
 assert.equal(f.counts.commits,0);
});
