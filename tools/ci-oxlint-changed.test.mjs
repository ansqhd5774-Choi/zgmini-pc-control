import test from 'node:test';
import assert from 'node:assert/strict';
import {OXLINT_ARCHIVE_SHA256,selectSourceFiles,verifyArchive} from './ci-oxlint-changed.mjs';

test('select only changed existing JS/TS without path traversal',()=>{
 const existing=p=>p!=='tools/removed.mjs';
 assert.deepEqual(selectSourceFiles([
  'tools/a.mjs','tools/a.mjs','tests/b.test.mjs','controller/c.ts',
  'README.md','tools/removed.mjs','../outside.js','C:/private.js',
  'node_modules/lodash/index.js','.github/workflows/example.yml'
 ],existing),['controller/c.ts','tests/b.test.mjs','tools/a.mjs']);
});
test('unknown changed-file scope is not falsely marked clean',()=>{
 assert.throws(()=>selectSourceFiles(null),/OXLINT_CHANGE_SCOPE_UNVERIFIED/);
});
test('download integrity mismatch fails closed',()=>{
 assert.match(OXLINT_ARCHIVE_SHA256,/^[a-f0-9]{64}$/);
 assert.throws(()=>verifyArchive(Buffer.from('tampered')),
  /OXLINT_ARCHIVE_SHA256_MISMATCH/);
});
