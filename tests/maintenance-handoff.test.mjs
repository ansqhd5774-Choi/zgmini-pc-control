import test from 'node:test';import assert from 'node:assert/strict';
import {requireStopped}from'../tools/handoff-maintenance.mjs';
test('only absent or proven dead receiver may be handed over',()=>{
 assert.doesNotThrow(()=>requireStopped(null));
 assert.doesNotThrow(()=>requireStopped({pid:123},()=>false));
 for(const value of [true,null])assert.throws(()=>requireStopped({pid:123},()=>value),/NOT_PROVEN_STOPPED/);
 assert.throws(()=>requireStopped({pid:0},()=>false),/NOT_PROVEN_STOPPED/);
});
