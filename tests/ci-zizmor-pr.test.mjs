import test from 'node:test';
import assert from 'node:assert/strict';
import {ZIZMOR_ZIP_SHA256,selectChangedActionFiles,verifyZizmorArchive,summarizeZizmorRuleIds}
  from '../tools/ci-zizmor-pr.mjs';

test('audit only valid changed workflow or local action paths',()=>{
 const existing=p=>p!=='.github/workflows/deleted.yml';
 assert.deepEqual(selectChangedActionFiles([
  '.github/workflows/ci.yml','.github/workflows/ci.yml',
  '.github/workflows/scan.yaml','.github/actions/security/action.yml',
  '.github/workflows/deleted.yml','.github/workflows/../private.yml',
  'tools/maintenance-agent.mjs','.github/workflows/secrets.txt',
  'C:/escape.yml','../outside.yml'
 ],existing),[
  '.github/actions/security/action.yml',
  '.github/workflows/ci.yml','.github/workflows/scan.yaml'
 ]);
});
test('missing PR compare proof cannot be interpreted as a clean security audit',()=>{
 assert.throws(()=>selectChangedActionFiles(null),
   /ZIZMOR_CHANGED_SCOPE_UNVERIFIED/);
});
test('tampered external release hash is rejected before execution',()=>{
 assert.match(ZIZMOR_ZIP_SHA256,/^[0-9a-f]{64}$/);
 assert.throws(()=>verifyZizmorArchive(Buffer.from('tampered')),
   /ZIZMOR_ARCHIVE_SHA256_MISMATCH/);
});

test('failed audit exposes only fixed-form rule IDs, never paths or source excerpts',()=>{
 const noisy="error[template-injection]: location private-path\\n"+
  "   showing private snippet\\nwarning[excessive-permissions]: other-path\\n"+
  "error[template-injection]: repeated";
 assert.deepEqual(summarizeZizmorRuleIds(noisy,''),[
  'excessive-permissions','template-injection'
 ]);
 const metadata=summarizeZizmorRuleIds(noisy,'').join(',');
 assert.doesNotMatch(metadata,/private|location|snippet|other-path/);
});

test('malformed or oversized audit output never exposes unsafe content',()=>{
 assert.deepEqual(summarizeZizmorRuleIds('error[not valid]',''),[]);
 assert.deepEqual(summarizeZizmorRuleIds('error[valid]','x'.repeat(8*1024*1024+1)),[]);
 assert.deepEqual(summarizeZizmorRuleIds('',''),[]);
});
