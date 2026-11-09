import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireCoreLockBounded,performR6RegisteredOnce} from './operation.mjs';

const auth={request:{requestId:'a3b44168-e96e-48b2-b787-10aa1a0e001a',
 approvalManifestSha256:'a'.repeat(64)},
 approval:{installedSourceSha:'b'.repeat(40),mode:'ONE_YEAR',maxBlsCalls:7,
  maxDolCalls:2},overlay:{files:Array(13).fill({})}};

function inject({lockOccupied=false,claimError=null,runError=null,
 releaseFails=false,probeError=null}={}){
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
 const d1ReadProbe=async()=>{calls.push('D1_READ');
  if(probeError)throw probeError;return true;};
 const claim=()=>{calls.push('CLAIM');if(claimError)throw claimError;return{file:'fixture'};};
 const run=async()=>{calls.push('RUN');if(runError)throw runError;
  return{status:'SUCCESS',code:'R6_B_COLLECT_PUBLISH_VERIFIED',
   providerRequests:9,blsRequests:7,dolRequests:2,groupResults:[],
   sqlite:'COLLECTOR_RECORDED',publication:'VERIFIED',sourceStoredAt:1794206708243};};
 return{calls,verifyOverlay,providerFieldsLoader,d1ReadProbe,lockFactory,claim,run};
}

test('D1 read preflight precedes single collect/publish and releases lock',async()=>{
 const f=inject();
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','D1_READ','CLAIM','RUN','UNLOCK']);
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

test('duplicate request claim: no provider work and lock released',async()=>{
 const claimError=Object.assign(new Error('R6_B_REQUEST_ALREADY_CLAIMED'),
  {code:'R6_B_REQUEST_ALREADY_CLAIMED'});
 const f=inject({claimError});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','D1_READ','CLAIM','UNLOCK']);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_REQUEST_ALREADY_CLAIMED');
 assert.equal(result.firstFail,'PREFLIGHT');
});

test('post-claim provider or D1 failure stays STATE_UNKNOWN; never auto retries',async()=>{
 const runError=Object.assign(new Error('D1_PUBLICATION_READBACK_MISMATCH'),
  {code:'D1_PUBLICATION_READBACK_MISMATCH'});
 const f=inject({runError});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','D1_READ','CLAIM','RUN','UNLOCK']);
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
 assert.deepEqual(f.calls,['VERIFY','LOCK','D1_READ','CLAIM','RUN','UNLOCK']);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'R6_B_CORE_LOCK_RELEASE_UNVERIFIED');
 assert.equal(result.firstFail,'CORE_LOCK_RELEASE');
 assert.equal(result.retry,'READ_EXISTING_CORE_LOCK_NO_AUTO_RETRY');
 assert.notEqual(result.status,'SUCCESS');
});

test('D1 read authorization failure leaves claim and provider untouched',async()=>{
 const probeError=Object.assign(new Error('R6_B_D1_AUTH_UNAVAILABLE'),
  {code:'R6_B_D1_AUTH_UNAVAILABLE'});
 const f=inject({probeError});
 const result=await performR6RegisteredOnce({auth,...f});
 assert.deepEqual(f.calls,['VERIFY','LOCK','D1_READ','UNLOCK']);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_D1_AUTH_UNAVAILABLE');
 assert.equal(result.lastPass,'REGISTERED_KEY_PRESENT');
 assert.equal(result.firstFail,'PREFLIGHT');
 assert.notEqual(result.providerRequests,9);
});

const lockError=code=>Object.assign(new Error(code),{code});

test('bounded Core lock: immediate idle acquires without sleeping',async()=>{
 const lock={held:()=>true,release:()=>true};
 const calls=[];
 const got=await acquireCoreLockBounded('fixture','request',{
  createLock:()=>{calls.push('LOCK');return lock;},
  now:()=>100,sleep:async(ms)=>calls.push(`WAIT_${ms}`)});
 assert.equal(got,lock);
 assert.deepEqual(calls,['LOCK']);
});

test('bounded Core lock: occupied owner naturally releases within two polls',async()=>{
 let clock=100,attempt=0;
 const waits=[];
 const lock={held:()=>true,release:()=>true};
 const got=await acquireCoreLockBounded('fixture','request',{
  createLock:()=>{attempt++;
   if(attempt<=2)throw lockError('R6_B_CORE_LOCK_OCCUPIED');
   return lock;},
  now:()=>clock,sleep:async(ms)=>{waits.push(ms);clock+=ms;}});
 assert.equal(got,lock);
 assert.equal(attempt,3);
 assert.deepEqual(waits,[5_000,5_000]);
});

test('bounded Core lock: five-minute exhaustion remains BLOCKED with zero claim/provider',async()=>{
 const f=inject();
 let clock=0,attempt=0;
 const waits=[];
 const lockFactory=()=>acquireCoreLockBounded('fixture','request',{
  createLock:()=>{attempt++;f.calls.push('LOCK');
   throw lockError('R6_B_CORE_LOCK_OCCUPIED');},
  now:()=>clock,sleep:async(ms)=>{waits.push(ms);clock+=ms;}});
 const result=await performR6RegisteredOnce({auth,...f,lockFactory});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_CORE_LOCK_OCCUPIED');
 assert.equal(result.firstFail,'PREFLIGHT');
 assert.equal(clock,300_000);
 assert.equal(attempt,61);
 assert.equal(waits.length,60);
 assert.deepEqual(waits,Array(60).fill(5_000));
 assert.ok(!f.calls.includes('D1_READ')&&!f.calls.includes('CLAIM')&&
  !f.calls.includes('RUN')&&!f.calls.includes('UNLOCK'));
});

test('bounded Core lock: delayed timer cannot acquire after five-minute deadline',async()=>{
 let clock=0,attempts=0;
 await assert.rejects(acquireCoreLockBounded('fixture','request',{
  createLock:()=>{attempts++;
   if(attempts===1)throw lockError('R6_B_CORE_LOCK_OCCUPIED');
   return{held:()=>true,release:()=>true};},
  now:()=>clock,sleep:async()=>{clock+=310_000;}}),
 e=>e.code==='R6_B_CORE_LOCK_OCCUPIED');
 assert.equal(attempts,1);
});


test('bounded Core lock: natural release after two minutes still acquires safely',async()=>{
 let clock=0,attempt=0;
 const lock={held:()=>true,release:()=>true};
 const got=await acquireCoreLockBounded('fixture','request',{
  createLock:()=>{attempt++;
   if(clock<120_000)throw lockError('R6_B_CORE_LOCK_OCCUPIED');
   return lock;},
  now:()=>clock,sleep:async(ms)=>{clock+=ms;}});
 assert.equal(got,lock);
 assert.equal(clock,120_000);
 assert.equal(attempt,25);
});

test('bounded Core lock: non-EEXIST create failure stops without waiting',async()=>{
 let waits=0,attempts=0;
 await assert.rejects(acquireCoreLockBounded('fixture','request',{
  createLock:()=>{attempts++;throw lockError('R6_B_CORE_LOCK_CREATE_STOP');},
  now:()=>0,sleep:async()=>{waits++;}}),
 e=>e.code==='R6_B_CORE_LOCK_CREATE_STOP');
 assert.equal(attempts,1);
 assert.equal(waits,0);
});

test('bounded Core lock: ownership UNKNOWN stops immediately, never claiming',async()=>{
 const f=inject();
 let calls=0,clock=0;
 const lockFactory=()=>acquireCoreLockBounded('fixture','request',{
  createLock:()=>{f.calls.push('LOCK');throw lockError('R6_B_CORE_LOCK_UNKNOWN');},
  now:()=>clock,sleep:async(ms)=>{calls++;clock+=ms;}});
 const result=await performR6RegisteredOnce({auth,...f,lockFactory});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'R6_B_CORE_LOCK_UNKNOWN');
 assert.equal(result.firstFail,'PREFLIGHT');
 assert.equal(calls,0);
 assert.deepEqual(f.calls,['VERIFY','LOCK']);
});


test('manual requests with different IDs run the same UTC day; same request never replays',async t=>{
 const {mkdtempSync,readdirSync,rmSync,writeFileSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const path=await import('node:path');
 const pcHome=mkdtempSync(path.join(tmpdir(),'r6-request-claim-'));
 t.after(()=>rmSync(pcHome,{recursive:true,force:true}));
 // Preserve historic date claims as evidence; they must not block a new request.
 const oldDaily=path.join(pcHome,'employment-r6-registered-one_year-'+
  new Date().toISOString().slice(0,10)+'.claim.json');
 writeFileSync(oldDaily,JSON.stringify({schema:'R6_REGISTERED_ONE_SHOT_CLAIM_V1',
  requestId:'a3b44168-e96e-48b2-b787-10aa1a0e0099',mode:'ONE_YEAR'}));
 const r1=inject();const {claim:unusedClaim1,...first}=r1;
 const a=await performR6RegisteredOnce({auth,pcHome,...first});
 assert.equal(a.status,'SUCCESS');
 const r2=inject();const {claim:unusedClaim2,...second}=r2;
 const duplicate=await performR6RegisteredOnce({auth,pcHome,...second});
 assert.equal(duplicate.status,'BLOCKED');
 assert.equal(duplicate.code,'R6_B_REQUEST_ALREADY_CLAIMED');
 assert.ok(!r2.calls.includes('RUN'));
 const nextAuth={...auth,request:{...auth.request,
  requestId:'a3b44168-e96e-48b2-b787-10aa1a0e001b'}};
 const r3=inject();const {claim:unusedClaim3,...third}=r3;
 const next=await performR6RegisteredOnce({auth:nextAuth,pcHome,...third});
 assert.equal(next.status,'SUCCESS');
 const claims=readdirSync(pcHome).filter(f=>f.endsWith('.claim.json'));
 assert.equal(claims.length,3);
 assert.ok(claims.includes(path.basename(oldDaily)));
});


test('historically claimed request is blocked even after the claim filename migration',async t=>{
 const {mkdtempSync,rmSync,writeFileSync,readdirSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const path=await import('node:path');
 const pcHome=mkdtempSync(path.join(tmpdir(),'r6-legacy-claim-'));
 t.after(()=>rmSync(pcHome,{recursive:true,force:true}));
 const oldDaily=path.join(pcHome,'employment-r6-registered-one_year-2026-11-09.claim.json');
 writeFileSync(oldDaily,JSON.stringify({schema:'R6_REGISTERED_ONE_SHOT_CLAIM_V1',
  requestId:auth.request.requestId,mode:'ONE_YEAR'}));
 const f=inject();const {claim:unusedClaim,...realClaim}=f;
 const result=await performR6RegisteredOnce({auth,pcHome,...realClaim});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_B_REQUEST_ALREADY_CLAIMED');
 assert.ok(!f.calls.includes('RUN'));
 assert.deepEqual(readdirSync(pcHome),[path.basename(oldDaily)]);
});
