import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOnce,runWatch,retryDelayMs} from '../agent-handoff/intake-watch-5s.mjs';
const headers=(map={})=>({get:name=>Object.hasOwn(map,name)?map[name]:null});
const response=(status,h={})=>({status,headers:headers(h),json:async()=>[]});

test('GitHub retry-after is honored instead of fixed 60s',async()=>{
 const result=await checkOnce({token:'test',nowMs:1_000_000,
   fetchImpl:async()=>response(429,{'retry-after':'180'})});
 assert.equal(result.state,'RATE_LIMIT_OR_FORBIDDEN');
 assert.equal(result.retryAfterMs,180_000);
});

test('GitHub exhausted primary quota waits for reset epoch',async()=>{
 const result=await checkOnce({token:'test',nowMs:1_000_000,
   fetchImpl:async()=>response(403,{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1500'})});
 assert.equal(result.retryAfterMs,501_000);
});

test('longer Retry-After and reset choose the larger delay',()=>{
 assert.equal(retryDelayMs(headers({'retry-after':'600','x-ratelimit-remaining':'0','x-ratelimit-reset':'1100'}),1_000_000),600_000);
 assert.equal(retryDelayMs(headers({'retry-after':'120','x-ratelimit-remaining':'0','x-ratelimit-reset':'1400'}),1_000_000),401_000);
});

test('304 conditional responses back off only when remaining quota low',async()=>{
 const a=await checkOnce({token:'test',nowMs:1_000_000,etag:'"ok"',previous:[],
   fetchImpl:async()=>response(304,{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1600'})});
 assert.equal(a.state,'UNCHANGED'); assert.equal(a.needsBackoff,true);assert.equal(a.retryAfterMs,601_000);
 const b=await checkOnce({token:'test',etag:'"ok"',previous:[],
   fetchImpl:async()=>response(304,{'x-ratelimit-remaining':'900'})});
 assert.equal(b.needsBackoff,false);assert.equal(b.retryAfterMs,null);
});

test('expired or revoked credentials stop once, with no repeated requests or secret reporting',async()=>{
 const notices=[],delays=[];let calls=0;
 const result=await runWatch({token:'test-sensitive-credential',
   fetchImpl:async()=>{calls++;return response(401);},
   sleep:async ms=>delays.push(ms),onReport:x=>notices.push(x)});
 assert.equal(result.state,'AUTH_REJECTED_STOP');
 assert.equal(calls,1); assert.equal(delays.length,0);
 assert.deepEqual(notices.map(x=>x.state),['WATCH_AUTH_REJECTED_STOP']);
 assert.ok(!JSON.stringify(notices).includes('test-sensitive-credential'));
});

test('GitHub explicitly stated 429 wait is not shortened by 5s timer',async()=>{
 const controller=new AbortController(),delays=[];let calls=0;
 await runWatch({token:'test',signal:controller.signal,clock:()=>1_000_000,
   fetchImpl:async()=>{calls++;return response(429,{'retry-after':'600'});},
   sleep:async ms=>{delays.push(ms);controller.abort();},onReport:()=>{}});
 assert.equal(calls,1);assert.deepEqual(delays,[600_000]);
});
