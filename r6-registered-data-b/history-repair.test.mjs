import test from 'node:test';
import assert from 'node:assert/strict';
import {performHistoryRepair} from './history-repair.mjs';
const digest='a'.repeat(64);
function fixture(){
 const calls=[],auth={request:{requestId:'fixture',approvalManifestSha256:'b'.repeat(64)},approval:{sourceSha:'c'.repeat(40),selectionSha256:digest,approvedCount:2}};
 const db={exec:x=>calls.push(x),close:()=>calls.push('close')};
 const deps={auth,acquire:async()=>({held:()=>true,release:()=>{calls.push('release');return true;}}),
 claim:()=>calls.push('claim'),load:async()=>({receipt:{},preview:()=>({eligible:2,selectionSha256:digest}),
 apply:()=>{calls.push('apply');return {status:'HISTORY_REPAIR_COMMITTED',inserted:2,selectionSha256:digest,historicalVersionAttested:false,providerCalls:0,d1Writes:0};}}),
 open:async()=>({db}),snapshot:async()=>({backupVerified:true,bytes:100,write:x=>calls.push(x.phase)})};
 return {calls,deps};
}
test('existing lease, selection, backup, claim and transaction are ordered; no provider or D1',async()=>{
 const {calls,deps}=fixture(),r=await performHistoryRepair(deps);
 assert.equal(r.status,'SUCCESS');assert.equal(r.historyRowsAdded,2);assert.equal(r.providerRequests,0);assert.equal(r.publication,'NOT_ATTEMPTED');
 assert.deepEqual(calls,['BEGIN','ROLLBACK','BACKUP_VERIFIED','claim','APPLYING','apply','COMMITTED_VERIFIED','close','release']);
});
test('selection drift stops before backup, claim or apply',async()=>{
 const {calls,deps}=fixture();deps.load=async()=>({preview:()=>({eligible:1,selectionSha256:digest})});
 const r=await performHistoryRepair(deps);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'W04_REPAIR_SELECTION_DRIFT');assert.deepEqual(calls,['BEGIN','ROLLBACK','close','release']);
});
test('backup failure prevents claim and DB write',async()=>{
 const {calls,deps}=fixture();deps.snapshot=async()=>{throw Error('W04_REPAIR_BACKUP_CHECK_STOP');};
 const r=await performHistoryRepair(deps);assert.equal(r.status,'BLOCKED');assert.ok(!calls.includes('claim'));assert.ok(!calls.includes('apply'));
});
test('post-claim exception is unknown, not retryable success',async()=>{
 const {calls,deps}=fixture();const load=deps.load;deps.load=async()=>({...await load(),apply:()=>{throw Error('W04_REPAIR_SELECTION_DRIFT');}});
 const r=await performHistoryRepair(deps);assert.equal(r.status,'STATE_UNKNOWN');assert.ok(calls.includes('claim'));assert.ok(!calls.includes('COMMITTED_VERIFIED'));
});
