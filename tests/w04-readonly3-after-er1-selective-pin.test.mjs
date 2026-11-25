import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {manifestFingerprint,validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const files=[
 {path:'controller/employment-r6-candidate-readonly.mjs',sha256:'c79214e912154982bc88a35c7dfd236a441d566b062b1b437bc45fa261657825'},
 {path:'controller/employment-r6-collection-evidence-readonly.mjs',sha256:'5968df52d1fa8e8338f0fe991933d15af8384f96b37a8eca114a5365064dd3e6'},
 {path:'controller/employment-r6-raw-run-attestation-readonly.mjs',sha256:'48d4d7eea2ab06a7c20c73ef9888947594000be98729a45363647d14ee5897d7'},
];
const fingerprint='b49bd0af86c73f1a98d75415dae500678f62c0fa2a6564d7bb0f65d810e45714';

test('W04 post-ER1 overlay pins exactly the three already-reviewed read-only source bytes',()=>{
 for(const f of files){
  const actual=createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex');
  assert.equal(actual,f.sha256,f.path);
 }
 assert.equal(manifestFingerprint(files).sha256,fingerprint);
 assert.equal(validateControllerOnlyInstallDelta(files.map(f=>f.path),files),true);
});

test('W04 post-ER1 selective install rejects unrelated config or ER1 changes',()=>{
 assert.throws(
  ()=>validateControllerOnlyInstallDelta([...files.map(f=>f.path),'controller/operations.mjs'],files),
  /SELECTIVE|UPDATE|DELTA|FILE|INVALID/i,
 );
});
