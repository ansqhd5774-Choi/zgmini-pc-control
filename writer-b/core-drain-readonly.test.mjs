import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCoreDrainProbe,validateCoreDrainSummary} from './core-drain-readonly.mjs';
const raw=o=>Buffer.from(JSON.stringify({ok:true,enabled:true,
 state:3,instances:0,relatedProcesses:0,unknownProcessLines:0,...o}));
test('Core snapshot reports only bounded numeric/boolean evidence',()=>{
 const s=summarizeCoreDrainProbe(raw({}),false);
 assert.deepEqual(s,{status:'SNAPSHOT',enabled:true,state:3,instances:0,
  relatedProcesses:0,unknownProcessLines:0,cycleLockPresent:false,
  drainReadyIfDisabled:true});
 assert.equal(validateCoreDrainSummary(s),true);
});
test('actual active Core/lock blocks hypothetical drain without hiding cause',()=>{
 const s=summarizeCoreDrainProbe(raw({state:4,instances:1,
  relatedProcesses:2}),true);
 assert.equal(s.drainReadyIfDisabled,false);
 assert.equal(validateCoreDrainSummary(s),true);
 assert.equal(validateCoreDrainSummary({...s,drainReadyIfDisabled:true}),false);
});
test('rejects secrets, extra keys, malformed and fabricated probe data',()=>{
 assert.throws(()=>summarizeCoreDrainProbe(raw({commandLine:'secret'}),false),
  {code:'WRITER_B_DRAIN_PROBE_CONTRACT_STOP'});
 assert.throws(()=>summarizeCoreDrainProbe(Buffer.from('not json'),false),
  {code:'WRITER_B_DRAIN_PROBE_JSON_STOP'});
 assert.equal(validateCoreDrainSummary({status:'UNAVAILABLE'}),true);
});
