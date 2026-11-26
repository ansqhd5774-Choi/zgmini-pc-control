import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isScopedWriterPath} from './contract.mjs';
import {isSafePreimagePath,validatePreimageApproval} from '../controller/preimage-manifest-contract.mjs';

const approved=[
 'worker/feed-collectors/fear-greed.ts',
 'worker/public-feed-collectors.ts',
];
const rejected=[
 'worker/other.ts','worker/feed-collectors/another.ts',
 'lib/other.ts','worker/public-feed-collectors.ts/../secrets.ts',
 'worker/../worker/public-feed-collectors.ts',
 'WORKER/PUBLIC-FEED-COLLECTORS.TS',
 'worker/public-feed-collectors.tsx',
 'worker/public-feed-collectors.js',
];
test('W06 exact TypeScript source dependencies share A and B scope',()=>{
 for(const file of approved){
  assert.equal(isSafePreimagePath(file),true,file);
  assert.equal(isScopedWriterPath(file),true,file);
 }
 for(const file of rejected){
  assert.equal(isSafePreimagePath(file),false,file);
  assert.equal(isScopedWriterPath(file),false,file);
 }
 assert.equal(isSafePreimagePath('scripts/pc-writer/local-cycle.mjs'),true);
 assert.equal(isScopedWriterPath('scripts/pc-writer/local-cycle.mjs'),true);
});
test('W06 A approval still requires hash-bound exact manifest and rejects other TS',()=>{
 const mk=files=>Buffer.from(JSON.stringify({
  schema:'ZGMINI_WRITER_PREIMAGE_SCOPE_APPROVAL_V1',
  status:'APPROVED_A_READONLY',scope:'PC_WRITER_APPROVED_SOURCE_PREIMAGE',
  sourceRoot:'projects/zgmini-earnings-history-pc-release',
  files:files.map(path=>({path,change:'M'})),allowOtherPaths:false,
 }));
 const manifestPath='approvals/writer-preimage/w06-cnn-exact-ts.json';
 const good=mk(approved);
 const digest=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(validatePreimageApproval(good,{
  expectedSha256:digest(good),manifestPath,
 }).files.length,2);
 assert.throws(()=>validatePreimageApproval(good,{
  expectedSha256:'0'.repeat(64),manifestPath,
 }),{code:'PREIMAGE_STAGE_MANIFEST_HASH_STOP'});
 const bad=mk(['worker/other.ts']);
 assert.throws(()=>validatePreimageApproval(bad,{
  expectedSha256:digest(bad),manifestPath,
 }),{code:'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP'});
});
