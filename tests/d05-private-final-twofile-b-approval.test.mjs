import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWriterBManifest} from '../writer-b/contract.mjs';
import {validatePreviewSpec} from '../writer-b/insert-preview-readonly.mjs';

const manifest=JSON.parse(readFileSync(new URL(
 '../approvals/writer-updates/d05-private-final-events-twofile-20261124.json',import.meta.url)));
const preview=JSON.parse(readFileSync(new URL(
 '../approvals/writer-previews/d05-private-final-anchor-r2-20261124.json',import.meta.url)));

test('D05 private actual score event B manifest validates and reuses exact readonly preview',()=>{
 assert.strictEqual(validateWriterBManifest(manifest),manifest);
 assert.strictEqual(validatePreviewSpec(preview),preview);
 assert.equal(manifest.files.length,2);
 const [cycle,helper]=manifest.files;
 assert.equal(cycle.path,preview.filePath);
 assert.equal(cycle.change,'M');
 assert.equal(cycle.beforeSha256,preview.beforeSha256);
 assert.deepEqual(cycle.insertions,preview.insertions);
 assert.equal(cycle.afterSha256,'539ecf4f4650125a21c221874e02e4d004318aea1c3082e49dba8bc3f0c16255');
 assert.equal(cycle.candidateSha256,'432761ed76b63a96a808a3cd4a8aa339281cc83d51c9e7877c757d3c167d7a84');
 assert.equal(helper.path,'lib/score-history/d05-private-theme-final-events-r1.mjs');
 assert.equal(helper.change,'A');
 assert.equal(helper.beforeSha256,null);
 assert.equal(helper.afterSha256,'b6367b8cc213258bd18e764c7aadf7acc2ea6b1547b85cf73f920c5aa260e4cf');
 assert.equal(manifest.candidateSourceSha,'4f67d290908e46847694c1111ca1b1e6ddc751a3');
 assert.equal(manifest.baseHead,preview.baseHead);
 assert.equal(manifest.baseConfigSourceSha,manifest.baseHead);
 assert.equal(manifest.runtimeDependencies.taskXmlSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.equal(manifest.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(manifest.runCount,1);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
   'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[key],false);
 for(const path of ['lib/score-history/d05-final-score-output-events-r1.mjs',
  'lib/score-history/d05-final-theme-candidate-readback-r1.mjs'])
  assert.ok(manifest.protectedFiles.some(x=>x.path===path));
});
test('D05 B manifest refuses invalid source/protection/side-effect changes',()=>{
 for(const modified of [
  {...manifest,allowD1Writes:true},
  {...manifest,sourceRoot:'E:\\ZGmini\\projects\\unknown'},
  {...manifest,coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_999S_V1'},
  {...manifest,files:[{...manifest.files[0],beforeSha256:'f'.repeat(64)},manifest.files[1],
   manifest.files[0]]}
 ])assert.throws(()=>validateWriterBManifest(modified));
});
