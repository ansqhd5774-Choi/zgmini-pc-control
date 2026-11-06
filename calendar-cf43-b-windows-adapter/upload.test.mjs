import test from 'node:test';
import assert from 'node:assert/strict';
import {safeResult} from './upload.mjs';

test('only bounded B status, source SHA and operation counts can leave PC',()=>{
 const result=safeResult({status:'CAL_CF43_B_SOURCE_ALIGNED_VERIFIED',
  code:'E:\\private\\TOKEN_PASSWORD',sourceSha:'a'.repeat(40),
  operationalWrites:4,rawConfig:'secret bearer key',backupPaths:['E:\\key']},
 'pc-calendar-a',123);
 assert.equal(result.status,'CAL_CF43_B_SOURCE_ALIGNED_VERIFIED');
 assert.equal(result.code,'CAL_CF43_UNEXPECTED_STOP');
 assert.equal(result.sourceSha,'a'.repeat(40));
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(JSON.stringify(result).includes('TOKEN'),false);
 assert.equal(result.providerCalls,0);
 assert.equal(result.dbWrites,0);
});
