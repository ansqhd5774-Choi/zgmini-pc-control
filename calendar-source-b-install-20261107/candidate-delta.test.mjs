import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNameStatusZ} from './candidate-delta.mjs';
test('exact two tracked dirty paths and status without file content',()=>{
 const r=parseNameStatusZ(Buffer.from('M\0scripts/pc-writer/release-calendar.mjs\0M\0lib/release-calendar.mjs\0'));
 assert.deepEqual(r,[{status:'M',path:'scripts/pc-writer/release-calendar.mjs'},
  {status:'M',path:'lib/release-calendar.mjs'}]);
});
test('unsafe, renamed or malformed NUL status output stops',()=>{
 for(const bad of ['R100\0lib/a.mjs\0lib/b.mjs\0','M\0../secret\0',
  'M\0lib/a.mjs\0D\0lib/a.mjs\0','M\0lib/a.mjs','M\0lib/../../tmp/x\0']){
  assert.throws(()=>parseNameStatusZ(bad),/CAL_A_DIRTY_LIST_(?:FORMAT|SCOPE)_STOP/);
 }
});
