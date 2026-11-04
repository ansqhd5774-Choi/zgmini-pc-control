import test from 'node:test';
import assert from 'node:assert/strict';
import {FILES,R54_B_SCHEMA,preflight} from '../tools/theme-nine-r54-sixfile-b.mjs';

const approved=()=>({schema:R54_B_SCHEMA,status:'APPROVED_B',
 scope:'R54_FIXED_SIXFILE_SOURCE_ONLY',runCount:1,noProviderCalls:true,
 noD1Writes:true,noTaskChanges:true,noControllerChanges:true,files:FILES});
const validGate=()=>({publisherConsentVerified:true,taskIdleVerified:true,
 maintenanceLeaseVerified:true,activeR54ProcessAbsent:true,
 sourceRootVerified:true,scoreReplayApproved:true,
 observedAt:new Date().toISOString()});

test('source update scope is exactly the 6 audited R54/R51/R48/Reader files',()=>{
 assert.equal(FILES.length,6);
 assert.equal(new Set(FILES.map(x=>x.path)).size,6);
 assert.deepEqual(FILES.map(x=>x.path),[
  'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  'worker/theme-nine-r37-public.mjs']);
 for(const row of FILES){
  assert.match(row.old,/^[a-f0-9]{64}$/);
  assert.match(row.next,/^[a-f0-9]{64}$/);
  assert.notEqual(row.old,row.next);
 }
 assert.equal(FILES.at(-1).next,
  '30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85');
});

test('B approval contract cannot be broadened to additional files or writes',()=>{
 const changes=[
  {...approved(),scope:'ALL_WRITER_FILES'},
  {...approved(),noProviderCalls:false},
  {...approved(),noD1Writes:false},
  {...approved(),runCount:2},
  {...approved(),files:[...FILES,{path:'data.sqlite',old:'a'.repeat(64),next:'b'.repeat(64)}]},
 ];
 for(const manifest of changes){
  assert.throws(()=>preflight({manifest,gate:validGate()}),
   /R54_B_MANIFEST_SCOPE_DENIED/);
 }
});

test('B operation refuses missing verified runtime lease/consent before filesystem access',()=>{
 const badGates=[null,{},
  {...validGate(),maintenanceLeaseVerified:false},
  {...validGate(),publisherConsentVerified:false},
  {...validGate(),taskIdleVerified:false},
  {...validGate(),observedAt:'2026-01-01T00:00:00Z'}];
 for(const gate of badGates){
  assert.throws(()=>preflight({manifest:approved(),gate}),
   /R54_B_RUNTIME_GATE_REQUIRED/);
 }
});
