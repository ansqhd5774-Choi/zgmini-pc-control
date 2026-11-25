import test from 'node:test';
import assert from 'node:assert/strict';
import {performHistoryRepair,authorizeHistoryRepair} from './history-repair.mjs';
import {sanitizeR6BResult,r6BTextResult} from './report.mjs';
import {createHash} from 'node:crypto';
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

test('report projects exact History count, proof and no other effects',()=>{
 const request={requestId:'fixture',approvalManifestSha256:'b'.repeat(64)};
 const env={R6_B_EFFECT_OUTCOME:'success',GITHUB_RUN_ID:'1'};
 const raw={requestId:'fixture',approvalManifestSha256:request.approvalManifestSha256,
 status:'SUCCESS',code:'W04_HISTORY_REPAIR_COMMITTED',mode:'HISTORY_REPAIR',
 sourceSha:'551640c3094738f7803d6a7f799098a55c21523c',selectionSha256:digest,
 approvedCount:2,historyRowsAdded:2,providerRequests:0,blsRequests:0,dolRequests:0,groupResults:[],
 sqlite:'HISTORY_REPAIR_VERIFIED',publication:'NOT_ATTEMPTED',backupVerified:true,
 historicalVersionAttested:false,lastPass:'HISTORY_READBACK',firstFail:null};
 const r=sanitizeR6BResult({...raw,privateRows:['NEVER_EXPOSE']},request,env);
 assert.equal(r.status,'SUCCESS');assert.equal(r.historyRowsAdded,2);
 assert.equal(r.selectionSha256,digest);assert.ok(r6BTextResult(r).includes('HISTORY_ROWS_ADDED=2'));
 assert.ok(!JSON.stringify(r).includes('NEVER_EXPOSE'));
 for(const change of [{historyRowsAdded:1},{providerRequests:1},{backupVerified:false},
  {historicalVersionAttested:true},{approvalManifestSha256:'c'.repeat(64)}]){
  assert.equal(sanitizeR6BResult({...raw,...change},request,env).status,'STATE_UNKNOWN');
 }
 assert.equal(sanitizeR6BResult(raw,request,{...env,R6_B_EFFECT_OUTCOME:'failure'}).status,'STATE_UNKNOWN');
});
test('approval is exact owner event and fixed History-only effects',()=>{
 const approval={schema:'ZGMINI_W04_HISTORY_REPAIR_B_APPROVAL_V1',status:'APPROVED_B',
 scope:'CORE_MISSING_STATE_CLAIMS_HISTORY_ONLY',sourceSha:'551640c3094738f7803d6a7f799098a55c21523c',
 sourceManifestSha256:'508ce1aa31163ea73f7c658ab03adea50235c8dca38fa5dd12f670f114edd751',
 receiptSha256:'2163132e165e45e08edff062722465dac1ff3a2d17ce999ec98a479d6e32547b',
 evidenceDigest:'30afbbec30466fa3e93442c78514ccb5125ca57ae4609dfdd5b9f44716c3acc5',
 selectionSha256:digest,approvedCount:2,effects:{historyInserts:true,coreBackup:true,providerCalls:false,
 d1Writes:false,currentWrites:false,schemaWrites:false,taskWrites:false,sourceWrites:false}};
 const make=(m,actor='ansqhd5774-Choi')=>{
  const approvalBytes=Buffer.from(JSON.stringify(m)),repo='ansqhd5774-Choi/zgmini-pc-control';
  const req={schema:'ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1',requestId:'c9e5b130-4e7a-4a24-a588-717d7faef26d',
   chatId:'c9e5b130-4e7a-4a24-a588-717d7faef26e',operation:'employment-r6-registered-data-once',
   approvalManifestSha256:createHash('sha256').update(approvalBytes).digest('hex')};
  return {approvalBytes,env:{GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
   GITHUB_ACTOR:actor,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40)},event:{action:'opened',
   repository:{full_name:repo,private:true},sender:{login:actor},issue:{user:{login:actor},
   title:'pc-employment-r6-registered-data-once',labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}}};
 };
 assert.equal(authorizeHistoryRepair(make(approval)).approval.approvedCount,2);
 assert.throws(()=>authorizeHistoryRepair(make(approval,'other')),/OWNER_EVENT_STOP/);
 assert.throws(()=>authorizeHistoryRepair(make({...approval,effects:{...approval.effects,d1Writes:true}})),/APPROVAL_SCOPE_STOP/);
 assert.throws(()=>authorizeHistoryRepair(make({...approval,approvedCount:2881})),/APPROVAL_SCOPE_STOP/);
});
