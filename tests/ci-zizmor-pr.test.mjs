import test from 'node:test';
import assert from 'node:assert/strict';
import {ZIZMOR_ZIP_SHA256,selectChangedActionFiles,verifyZizmorArchive}
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
