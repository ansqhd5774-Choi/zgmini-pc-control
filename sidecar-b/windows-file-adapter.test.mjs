import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowsSidecarIO} from './windows-file-adapter.mjs';

test('Windows adapter requires an independently trusted protection probe',()=>{
 assert.throws(()=>createWindowsSidecarIO({requestId:'not-authorized'}),
  e=>e.code==='SIDECAR_B_TRUSTED_PROBE_STOP'||e.code==='SIDECAR_B_WINDOWS_ONLY_STOP');
});
test('one-file I/O adapter never runs on a non-Windows host',()=>{
 if(process.platform!=='win32')
  assert.throws(()=>createWindowsSidecarIO({
   requestId:'not-authorized',observeProtected:()=>({})
  }),e=>e.code==='SIDECAR_B_WINDOWS_ONLY_STOP');
});
