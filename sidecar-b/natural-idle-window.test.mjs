import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitNaturalSidecarIdle} from './natural-idle-window.mjs';
import {projectSidecarBResourceFlagsReadonly as flags} from './operating-probe.mjs';

const snapshot=(overrides={})=>flags({
 coreQuiet:true,sidecarActive:false,controllerInstallBusy:false,
 sharedWriterLockPresent:false,...overrides
});
const code=(expected)=>(error)=>error?.code===expected;

test('bounded B prelease wait observes natural Core and Sidecar idle',async()=>{
 let t=0,reads=0,sleeps=0;
 const seq=[snapshot({coreQuiet:false}),snapshot({sidecarActive:true}),snapshot()];
 await awaitNaturalSidecarIdle({
  observe:()=>{reads++;return seq[Math.min(reads-1,seq.length-1)];},
  pause:async ms=>{t+=ms;sleeps++;},
  clock:()=>t,windowMs:20_000,stepMs:5_000
 });
 assert.equal(reads,3);
 assert.equal(sleeps,2);
 assert.equal(t,10_000);
});

test('busy shared maintenance owner stops without waiting or claiming',async()=>{
 let sleeps=0;
 await assert.rejects(awaitNaturalSidecarIdle({
  observe:()=>snapshot({sharedWriterLockPresent:true}),
  pause:async()=>{sleeps++;},clock:()=>0
 }),code('SIDECAR_B_PROBE_RESOURCE_STOP'));
 assert.equal(sleeps,0);
});

test('unknown or partial probe is never treated as natural idle',async()=>{
 await assert.rejects(awaitNaturalSidecarIdle({
  observe:()=>flags({coreQuiet:true}),pause:async()=>{},
  clock:()=>0
 }),code('SIDECAR_B_IDLE_WINDOW_OBSERVATION_STOP'));
});

test('quiet never observed fails closed at bounded deadline',async()=>{
 let t=0,reads=0;
 await assert.rejects(awaitNaturalSidecarIdle({
  observe:()=>{reads++;return snapshot({coreQuiet:false,sidecarActive:true});},
  pause:async ms=>{t+=ms;},clock:()=>t,
  windowMs:12_000,stepMs:5_000
 }),code('SIDECAR_B_PROBE_RESOURCE_STOP'));
 assert.equal(t,12_000);
 assert.ok(reads>=3&&reads<=5);
});

test('read-only wait may find an actual Core and Sidecar quiet gap after four minutes',async()=>{
 let t=0,reads=0;
 await awaitNaturalSidecarIdle({
  observe:()=>{reads++;return t<305_000?
   snapshot({coreQuiet:false,sidecarActive:true}):snapshot();},
  pause:async ms=>{t+=ms;},
  clock:()=>t,
 });
 assert.equal(t,305_000);
 assert.equal(reads,62);
});
test('seven-minute timeout remains a hard fail closed with no operational side effects',async()=>{
 let t=0,reads=0;
 await assert.rejects(awaitNaturalSidecarIdle({
  observe:()=>{reads++;return snapshot({coreQuiet:false,sidecarActive:true});},
  pause:async ms=>{t+=ms;},clock:()=>t,
 }),code('SIDECAR_B_PROBE_RESOURCE_STOP'));
 assert.equal(t,420_000);
 assert.ok(reads>=84&&reads<=86);
});

test('invalid observation contract fails before any read',async()=>{
 let reads=0;
 await assert.rejects(awaitNaturalSidecarIdle({
  observe:()=>{reads++;return snapshot();},
  pause:async()=>{},clock:()=>0,
  windowMs:420_001
 }),code('SIDECAR_B_IDLE_WINDOW_CONTRACT_STOP'));
 assert.equal(reads,0);
});
