import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOnce,runWatch,retryDelayMs,safeWatchReadErrorCode,safeWatchFatalErrorCode} from '../agent-handoff/intake-watch-5s.mjs';
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

test('poller never emits thrown credential-like exception text to its observation log',async()=>{
 const controller=new AbortController(),reports=[],delays=[];
 const secret='github_pat_sensitive-test-token';
 let requests=0;
 await runWatch({token:secret,signal:controller.signal,clock:()=>1_000_000,
   fetchImpl:async()=>{requests++;throw Error('HTTP request failed with token='+secret+' and host=C:\\private\\watcher');},
   sleep:async ms=>{delays.push(ms);controller.abort();},
   onReport:x=>reports.push(x)});
 assert.equal(requests,1);
 assert.deepEqual(delays,[60_000]);
 assert.equal(reports.length,1);
 assert.equal(reports[0].state,'WATCH_READ_FAILED');
 assert.equal(reports[0].code,'WATCH_REQUEST_FAILED');
 assert.ok(!JSON.stringify(reports).includes(secret));
 assert.ok(!JSON.stringify(reports).includes('C:\\private'));
});

test('only source-defined diagnostics survive log sanitization',()=>{
 assert.equal(safeWatchReadErrorCode(Error('HANDOFF_WATCH_INVALID_ISSUE_STOP')),
   'HANDOFF_WATCH_INVALID_ISSUE_STOP');
 assert.equal(safeWatchReadErrorCode({name:'AbortError',message:'Bearer secret'}),
   'REQUEST_TIMEOUT');
 assert.equal(safeWatchReadErrorCode(Error('HANDOFF_WATCH_INVALID_ISSUE_STOP Bearer secret')),
   'WATCH_REQUEST_FAILED');
 assert.equal(safeWatchFatalErrorCode(Error('HANDOFF_WATCH_AUTH_REJECTED_STOP')),
   'HANDOFF_WATCH_AUTH_REJECTED_STOP');
 for(const raw of ['Bearer github_pat_sensitive','gh auth error C:\\Users\\someone','HANDOFF_WATCH_FATAL_STOP private']){
   assert.equal(safeWatchReadErrorCode(Error(raw)),'WATCH_REQUEST_FAILED');
   assert.equal(safeWatchFatalErrorCode(Error(raw)),'HANDOFF_WATCH_FATAL_STOP');
 }
});
