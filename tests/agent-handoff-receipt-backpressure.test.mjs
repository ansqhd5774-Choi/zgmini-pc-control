import test from 'node:test';
import assert from 'node:assert/strict';
import {runWatch} from '../agent-handoff/intake-watch-5s.mjs';

const issues = Array.from({length:27},(_,i)=>({
  number:i+1,
  updated_at:'2026-11-17T02:00:00Z',
  labels:[{name:'agent-handoff'}]
}));
const response = data => ({status:200,headers:{get:()=>null},json:async()=>data});

test('a 27-issue initial burst verifies every receipt with one serial lane',async()=>{
  const controller=new AbortController();
  const seen=[],reports=[];
  let active=0,maxActive=0,listGets=0;
  await runWatch({
    token:'synthetic-test-token',
    signal:controller.signal,
    clock:()=>1_000_000,
    fetchImpl:async (_url,opts)=>{
      assert.equal(opts.method,'GET');
      listGets++;
      return response(issues);
    },
    receiptVerifier:async({issueNumber})=>{
      active++;
      maxActive=Math.max(maxActive,active);
      seen.push(issueNumber);
      await Promise.resolve();
      active--;
      return {issueNumber,receiptVerified:true,chatDelivered:false,noWrite:true};
    },
    sleep:async()=>{
      // Drain the receipt lane in microtasks without any 5-second wall delay.
      for(let i=0;i<1000;i++) await Promise.resolve();
      controller.abort();
    },
    onReport:item=>reports.push(item)
  });
  assert.equal(listGets,1);
  assert.equal(maxActive,1);
  assert.deepEqual([...seen].sort((a,b)=>a-b),issues.map(x=>x.number));
  assert.ok(reports.some(x=>x.state==='RECEIPT_BACKPRESSURE_DEFERRED'&&x.deferredCount===2));
  assert.ok(reports.filter(x=>x.state==='RECEIPT_OBSERVED').every(x=>x.workExecuted===false));
});

test('a stalled receipt does not delay repeated five-second intake list checks',async()=>{
  const controller=new AbortController();
  const delays=[],reports=[];
  let listGets=0,receiptStarts=0;
  await runWatch({
    token:'synthetic-test-token',
    signal:controller.signal,
    clock:()=>1_000_000,
    fetchImpl:async()=>{listGets++;return response(issues);},
    receiptVerifier:async()=>{
      receiptStarts++;
      return new Promise(()=>{}); // Only the receipt lane is intentionally stalled.
    },
    sleep:async(ms)=>{
      delays.push(ms);
      for(let i=0;i<8;i++) await Promise.resolve();
      if(delays.length===4) controller.abort();
    },
    onReport:item=>reports.push(item)
  });
  assert.equal(listGets,4);
  assert.equal(receiptStarts,1);
  assert.deepEqual(delays,[5000,5000,5000,5000]);
  assert.equal(reports.filter(x=>x.state==='RECEIPT_BACKPRESSURE_DEFERRED').length,1);
});

test('transient receipt 429 is retained and retried after server hint even when list never changes',async()=>{
  const controller=new AbortController();
  const reports=[],sleeps=[];let now=1_000_000,listGets=0,receiptGets=0;
  await runWatch({token:'synthetic-secret',signal:controller.signal,clock:()=>now,
    fetchImpl:async()=>{
      listGets++;
      if(listGets===1)return response([issues[0]]);
      return {status:304,headers:{get:()=>null}};
    },
    receiptVerifier:async({issueNumber})=>{
      receiptGets++;
      if(receiptGets===1){
        const error=new Error('HANDOFF_RECEIPT_READ_HTTP_429');
        error.httpStatus=429;error.retryAfterMs=120_000;
        throw error;
      }
      return {issueNumber,receiptVerified:true,chatDelivered:false,noWrite:true};
    },
    sleep:async ms=>{
      sleeps.push(ms);now+=ms;
      for(let i=0;i<30;i++)await Promise.resolve();
      if(reports.some(x=>x.state==='RECEIPT_OBSERVED')||sleeps.length>40)controller.abort();
    },
    onReport:x=>reports.push(x)
  });
  assert.equal(receiptGets,2);
  assert.ok(listGets>=24);
  assert.ok(reports.some(x=>x.state==='RECEIPT_RETRY_DEFERRED'&&x.waitMs===120_000));
  assert.equal(reports.filter(x=>x.state==='RECEIPT_OBSERVED').length,1);
  assert.ok(!JSON.stringify(reports).includes('synthetic-secret'));
  assert.ok(sleeps.every(ms=>ms===5000)); // independent list lane never inherits receipt backoff
});

test('receipt-only 401 stops the watcher rather than silently dropping its authentication failure',async()=>{
  const controller=new AbortController(),reports=[];let listGets=0,receiptGets=0;
  const result=await runWatch({token:'synthetic-secret',signal:controller.signal,clock:()=>1_000_000,
    fetchImpl:async()=>{listGets++;return response([issues[0]]);},
    receiptVerifier:async()=>{receiptGets++;throw Error('HANDOFF_RECEIPT_READ_HTTP_401');},
    sleep:async()=>{for(let i=0;i<25;i++)await Promise.resolve();},
    onReport:x=>reports.push(x)
  });
  assert.equal(result.state,'AUTH_REJECTED_STOP');
  assert.equal(listGets,1);
  assert.equal(receiptGets,1);
  assert.ok(reports.some(x=>x.state==='WATCH_RECEIPT_AUTH_REJECTED_STOP'));
  assert.ok(!JSON.stringify(reports).includes('synthetic-secret'));
});

test('receipt retry stops after three failures beyond the initial attempt',async()=>{
  const controller=new AbortController(),reports=[];let now=1_000_000,tries=0,loops=0;
  await runWatch({token:'synthetic',signal:controller.signal,clock:()=>now,
    fetchImpl:async()=>response([{...issues[0],updated_at:'2026-11-17T01:00:00Z'}]),
    receiptVerifier:async()=>{tries++;throw Error('HANDOFF_RECEIPT_READ_HTTP_503');},
    sleep:async ms=>{
      now+=ms;loops++;
      for(let i=0;i<30;i++)await Promise.resolve();
      if(reports.some(x=>x.state==='RECEIPT_RETRY_EXHAUSTED')||loops>200)controller.abort();
    },
    onReport:x=>reports.push(x)
  });
  assert.equal(tries,4);
  assert.equal(reports.filter(x=>x.state==='RECEIPT_RETRY_DEFERRED').length,3);
  assert.equal(reports.filter(x=>x.state==='RECEIPT_RETRY_EXHAUSTED').length,1);
});
