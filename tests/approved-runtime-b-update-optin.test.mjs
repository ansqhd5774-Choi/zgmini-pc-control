import {test} from 'node:test';
import assert from 'node:assert/strict';
import {command} from '../tools/update.mjs';

const requestId='c6575a52-e81c-40a6-99a9-4050fdbf5810';

test('real patched updater source routes opt-in status once before legacy slug parser',async()=>{
 const args=['approved-runtime-b-status','--request-id',requestId];
 const observed=[];
 const actual=await command(args,{approvedRuntimeBHook:{async command(x){observed.push(x);return {status:'NOT_CLAIMED',requestId};}}});
 assert.deepEqual(actual,{status:'NOT_CLAIMED',requestId});
 assert.deepEqual(observed,[args]);
});

test('real updater fails closed when new B hook absent or invalid',async()=>{
 const args=['approved-runtime-b-apply','--request-id',requestId,'--manifest-file','E:\\ZGmini\\data\\pc-maintenance\\approved\\abc.json'];
 await assert.rejects(command(args),{code:'B_UPDATE_HOOK_NOT_INSTALLED'});
 await assert.rejects(command(args,{approvedRuntimeBHook:{}}),{code:'B_UPDATE_HOOK_INVALID'});
});
