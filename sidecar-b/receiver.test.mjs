import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveApprovedSidecarB} from './receiver.mjs';
test('a receiver without a pinned approved Issue stops before PC I/O',async()=>{
 await assert.rejects(receiveApprovedSidecarB({}),e=>e.code==='SIDECAR_B_EVENT_ORIGIN_STOP');
});
