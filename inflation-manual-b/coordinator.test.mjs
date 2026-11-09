import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizationFixture,REQUEST_ID} from './fixture.mjs';
import {authorizeManualReceiver,DATA_ROOT,MAX_BYTES,SOURCE_FILES} from './contract.mjs';
import {performOfficialManualB,verifyOfficialBytes,verifyManualOutcome,
 verifyManualPreimage} from './coordinator.mjs';

function auth(){const x=authorizationFixture();return authorizeManualReceiver({
 event:x.event,env:x.env,manifestBytes:x.bytes});}
function preimage(a){return {sourceRoot:a.manifest.sourceRoot,
 sourceHead:a.manifest.sourceSha,configSource:a.manifest.sourceSha,
 sourceFiles:Object.fromEntries(SOURCE_FILES.map((name,i)=>
  [name,a.manifest.sourceFiles[i].sha256])),dataRoot:DATA_ROOT,
 otherWriterActive:false};}
function raw(){return {bls:Buffer.from('BLS-FLATFILE'),
 census:Buffer.from('CENSUS-XLSX')};}
function stored(){return {status:'SAVED_READBACK',requestId:REQUEST_ID,
 apiCalls:0,dbWrites:0,d1Writes:0,coreCheckpointWrites:0,
 archives:{bls:{hash:'1'.repeat(64)},census:{hash:'2'.repeat(64)}},
 writes:{bls:{sha256:'3'.repeat(64)},census:{sha256:'4'.repeat(64)}}};}
function adapter(a){
 const calls=[],io={
  async acquireSharedLock(){calls.push('lock');},
  async readSourcePreimage(){calls.push('source');return preimage(a);},
  async fetchExactSources(){calls.push('download');return raw();},
  async preflightParse(){calls.push('parse');},
  async assertCoreIdle(){calls.push('idle');},
  async acquireCoreLease(){calls.push('corelock');},
  async verifyCoreLease(){calls.push('coreproof');},
  async releaseCoreLease(){calls.push('coreunlock');},
  async claimOnce(){calls.push('claim');},
  async applyData(){calls.push('store');return stored();},
  async readbackStored(){calls.push('readback');},
  async journalPhase(phase){calls.push('journal:'+phase);},
  async releaseSharedLock(x){calls.push('release:'+x.retain);},
 };return {io,calls};
}

test('one-shot happy path validates before claiming and verifies readback',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 const r=await performOfficialManualB(a,io);
 assert.equal(r.status,'INFL_MANUAL_B_SAVED_VERIFIED');
 assert.equal(r.code,'INFL_MANUAL_B_READBACK_VERIFIED');
 assert.deepEqual(r.committed,{bls:'3'.repeat(64),census:'4'.repeat(64)});
 assert.deepEqual(calls,['lock','source','download','parse','idle',
  'corelock','claim','journal:CLAIMED','source','coreproof','store','readback',
  'journal:COMPLETED','coreunlock','release:false']);
});
test('shared lock refusal is a harmless, unclaimed stop',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 io.acquireSharedLock=()=>{throw Object.assign(new Error('busy'),
  {code:'INFL_MANUAL_B_SHARED_BUSY_STOP'});};
 const r=await performOfficialManualB(a,io);
 assert.equal(r.status,'INFL_MANUAL_B_PREFLIGHT_STOP');
 assert.equal(r.code,'INFL_MANUAL_B_SHARED_BUSY_STOP');
 assert.deepEqual(calls,[]);
});
test('wrong source SHA stops before download and claim',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 io.readSourcePreimage=()=>({...preimage(a),sourceHead:'f'.repeat(40)});
 const r=await performOfficialManualB(a,io);
 assert.equal(r.code,'INFL_MANUAL_B_PC_PREIMAGE_STOP');
 assert.deepEqual(calls,['lock','release:false']);
});
test('bad live workbook is rejected before claim with no data writes',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 io.preflightParse=()=>{throw Object.assign(new Error('bad workbook'),
  {code:'INFL_MANUAL_B_XLSX_IMPORT_STOP'});};
 const r=await performOfficialManualB(a,io);
 assert.equal(r.status,'INFL_MANUAL_B_PREFLIGHT_STOP');
 assert.equal(r.code,'INFL_MANUAL_B_XLSX_IMPORT_STOP');
 assert(!calls.includes('claim')&&!calls.includes('store'));
 assert.equal(calls.at(-1),'release:false');
});
test('post-claim preimage drift is recorded as untouched stop',async()=>{
 const a=auth(),{io,calls}=adapter(a);let n=0;
 io.readSourcePreimage=()=>{n++;return n===1?preimage(a):
  {...preimage(a),configSource:'0'.repeat(40)};};
 const r=await performOfficialManualB(a,io);
 assert.equal(r.code,'INFL_MANUAL_B_PC_PREIMAGE_STOP');
 assert(calls.includes('journal:CLAIMED'));
 assert(calls.includes('journal:CLAIMED_UNTOUCHED_STOP'));
 assert(!calls.includes('store'));
 assert(calls.includes('coreunlock'));
 assert.equal(calls.at(-1),'release:false');
});
test('partial commit after mutation intent retains lock for recovery',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 io.applyData=()=>{throw Object.assign(new Error('partially committed'),
  {code:'INFL_MANUAL_STORE_PARTIAL_COMMIT'});};
 const r=await performOfficialManualB(a,io);
 assert.equal(r.status,'INFL_MANUAL_B_RECOVERY_REQUIRED');
 assert.equal(r.code,'INFL_MANUAL_STORE_PARTIAL_COMMIT');
 assert(calls.includes('journal:RECOVERY_REQUIRED'));
 assert(calls.includes('coreunlock'));
 assert.equal(calls.at(-1),'release:true');
});
test('Core lease race stops before one-shot claim and write',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 io.acquireCoreLease=()=>{throw Object.assign(new Error('occupied'),
  {code:'INFL_MANUAL_B_CORE_LEASE_BUSY_STOP'});};
 const r=await performOfficialManualB(a,io);
 assert.equal(r.code,'INFL_MANUAL_B_CORE_LEASE_BUSY_STOP');
 assert(!calls.includes('claim')&&!calls.includes('store'));
 assert.equal(calls.at(-1),'release:false');
});
test('ambiguous readback after saved files retains lock',async()=>{
 const a=auth(),{io,calls}=adapter(a);
 io.readbackStored=()=>{throw new Error('unknown state');};
 const r=await performOfficialManualB(a,io);
 assert.equal(r.status,'INFL_MANUAL_B_RECOVERY_REQUIRED');
 assert.equal(r.code,'INFL_MANUAL_B_UNEXPECTED_STOP');
 assert.equal(calls.at(-1),'release:true');
});
test('already equal values produce explicit unchanged status',async()=>{
 const a=auth(),{io}=adapter(a);
 io.applyData=()=>({...stored(),status:'UNCHANGED',writes:undefined});
 const r=await performOfficialManualB(a,io);
 assert.equal(r.code,'INFL_MANUAL_B_UNCHANGED');
 assert.deepEqual(r.committed,{});
});
test('source size and result attempts outside scope are rejected',()=>{
 assert.throws(()=>verifyOfficialBytes({bls:Buffer.alloc(MAX_BYTES.bls+1),
  census:Buffer.from('x')}),e=>e.code==='INFL_MANUAL_B_SOURCE_BYTES_STOP');
 assert.throws(()=>verifyManualOutcome({...stored(),dbWrites:1},REQUEST_ID),
  e=>e.code==='INFL_MANUAL_B_RESULT_SCOPE_STOP');
 const a=auth();assert.throws(()=>verifyManualPreimage(a.manifest,
  {...preimage(a),otherWriterActive:true}),
  e=>e.code==='INFL_MANUAL_B_PC_PREIMAGE_STOP');
});
