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
