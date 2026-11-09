import test from 'node:test';
import assert from 'node:assert/strict';
import {performR6RegisteredOnce} from './operation.mjs';

const auth={request:{requestId:'a3b44168-e96e-48b2-b787-10aa1a0e001a',
 approvalManifestSha256:'a'.repeat(64)},
 approval:{installedSourceSha:'b'.repeat(40),mode:'ONE_YEAR',maxBlsCalls:7,
  maxDolCalls:2},overlay:{files:Array(13).fill({})}};

function inject({lockOccupied=false,claimError=null,runError=null,releaseFails=false}={}){
 const calls=[];
 let held=true;
 const verifyOverlay=()=>{calls.push('VERIFY');return{core:'fixture-db-id'};};
 const providerFieldsLoader=async()=>({BLS_API_KEY:'test-only-not-a-real-key'});
 const lockFactory=()=>{calls.push('LOCK');
  if(lockOccupied)throw Object.assign(new Error('R6_B_CORE_LOCK_OCCUPIED'),
   {code:'R6_B_CORE_LOCK_OCCUPIED'});
  return{held:()=>held,release:()=>{calls.push('UNLOCK');
   if(releaseFails)return false;
   held=false;return true;}};};
 const claim=()=>{calls.push('CLAIM');if(claimError)throw claimError;return{file:'fixture'};};
 const run=async()=>{calls.push('RUN');if(runError)throw runError;
  return{status:'SUCCESS',code:'R6_B_COLLECT_PUBLISH_VERIFIED',
   providerRequests:9,blsRequests:7,dolRequests:2,groupResults:[],
   sqlite:'COLLECTOR_RECORDED',publication:'VERIFIED',sourceStoredAt:1794206708243};};
 return{calls,verifyOverlay,providerFieldsLoader,lockFactory,claim,run};
}

test('injected authorized path executes a single collect/publish and releases lock',async()=>{
 const f=inject();
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(result.status,'SUCCESS');
 assert.equal(result.code,'R6_B_COLLECT_PUBLISH_VERIFIED');
 assert.equal(result.lastPass,'PUBLISH_READBACK');
 assert.equal(result.firstFail,null);
});

test('active Core lock: no claim, network or SQLite operation',async()=>{
 const f=inject({lockOccupied:true});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK']);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_CORE_LOCK_OCCUPIED');
 assert.equal(result.firstFail,'PREFLIGHT');
});

test('same-day claim conflict: no provider work and lock released',async()=>{
 const claimError=Object.assign(new Error('R6_B_TODAY_ALREADY_CLAIMED'),
  {code:'R6_B_TODAY_ALREADY_CLAIMED'});
 const f=inject({claimError});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','CLAIM','UNLOCK']);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_TODAY_ALREADY_CLAIMED');
 assert.equal(result.firstFail,'PREFLIGHT');
});

test('post-claim provider or D1 failure stays STATE_UNKNOWN; never auto retries',async()=>{
 const runError=Object.assign(new Error('D1_PUBLICATION_READBACK_MISMATCH'),
  {code:'D1_PUBLICATION_READBACK_MISMATCH'});
 const f=inject({runError});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.firstFail,'COLLECT_OR_PUBLISH');
 assert.equal(result.lastPass,'ONE_SHOT_CLAIMED');
 assert.equal(result.retry,'READ_EXISTING_CLAIM_AND_DB_NO_RETRY');
 assert.notEqual(result.status,'SUCCESS');
});

test('source mismatch preflight: prevents lock, claim and run',async()=>{
 const f=inject();
 const verifyOverlay=()=>{f.calls.push('VERIFY');
  throw Object.assign(new Error('R6_B_INSTALLED_SOURCE_STOP'),
   {code:'R6_B_INSTALLED_SOURCE_STOP'});};
 const result=await performR6RegisteredOnce({auth,...f,verifyOverlay});
 assert.deepEqual(f.calls,['VERIFY']);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_INSTALLED_SOURCE_STOP');
 assert.equal(result.firstFail,'PREFLIGHT');
});

test('Core lock release unverified downgrades apparent success without deleting lock',async()=>{
 const f=inject({releaseFails:true});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'R6_B_CORE_LOCK_RELEASE_UNVERIFIED');
 assert.equal(result.firstFail,'CORE_LOCK_RELEASE');
 assert.equal(result.retry,'READ_EXISTING_CORE_LOCK_NO_AUTO_RETRY');
 assert.notEqual(result.status,'SUCCESS');
});
