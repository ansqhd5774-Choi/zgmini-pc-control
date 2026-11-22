import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreviewSpec} from './insert-preview-readonly.mjs';

const base={
 schema:'ZGMINI_WRITER_B_INSERT_PREVIEW_SPEC_V1',
 sourceRoot:String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`,
 baseHead:'aabb9e85441fc1150ba572a840245ab4a05c35c4',
 beforeSha256:'a'.repeat(64),
 insertions:[{anchor:'const knownUniqueAnchor=true;',position:'after',text:'const injected=true;\n'}],
};

test('R54 preview accepts only the two required shared modules',()=>{
 for(const filePath of [
  'lib/market-score/composite-model-r1.mjs',
  'worker/market-operational-store.mjs',
 ]){
  const spec={...base,filePath};
  assert.equal(validatePreviewSpec(spec),spec);
 }
});

test('existing Writer preview paths remain valid',()=>{
 const spec={...base,filePath:'scripts/pc-writer/run-local.mjs'};
 assert.equal(validatePreviewSpec(spec),spec);
});

test('all other lib/worker paths and traversal remain disallowed',()=>{
 for(const filePath of [
  'lib/market-score/domain-adapter-r1.mjs',
  'worker/market-score-r1.mjs',
  'worker/../market-operational-store.mjs',
  'lib/market-score/../../worker/market-operational-store.mjs',
  'lib/market-score/employment-r54-calculation-event.mjs',
  'scripts/pc-writer/../../worker/market-operational-store.mjs',
 ]){
  assert.throws(()=>validatePreviewSpec({...base,filePath}),{
   code:'WRITER_B_PREVIEW_SPEC_STOP',
  },filePath);
 }
});
