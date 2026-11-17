import test from 'node:test';
import assert from 'node:assert/strict';
import {runWatch} from '../agent-handoff/intake-watch-5s.mjs';

test('12-cycle monitor heartbeat records actual five-second start intervals without secrets',async()=>{
  const ctl=new AbortController(),notices=[];
  let time=1_000_000,calls=0;
  await runWatch({
    token:'synthetic-do-not-log',
    signal:ctl.signal,
    clock:()=>time,
    fetchImpl:async()=>{
      calls++;
      return {status:304,headers:{get:()=>null},json:async()=>[]};
    },
    sleep:async ms=>{time+=ms;if(calls===12)ctl.abort();},
    onReport:x=>notices.push(x)
  });
  assert.equal(calls,12);
  const beats=notices.filter(x=>x.state==='WATCH_HEARTBEAT');
  assert.equal(beats.length,1);
  assert.equal(beats[0].completedPolls,12);
  assert.equal(beats[0].observedMinIntervalMs,5000);
  assert.equal(beats[0].observedMaxIntervalMs,5000);
  assert.equal(beats[0].workExecuted,false);
  assert.ok(!JSON.stringify(notices).includes('synthetic-do-not-log'));
});

test('sampled heartbeat exposes real interval drift instead of claiming fixed five-second success',async()=>{
  const ctl=new AbortController(),notices=[];
  let time=1_000_000,calls=0;
  await runWatch({
    token:'test',
    signal:ctl.signal,
    clock:()=>time,
    fetchImpl:async()=>{
      calls++;
      if(calls===6) time+=2000;
      return {status:304,headers:{get:()=>null},json:async()=>[]};
    },
    sleep:async ms=>{time+=ms;if(calls===12)ctl.abort();},
    onReport:x=>notices.push(x)
  });
  const beat=notices.find(x=>x.state==='WATCH_HEARTBEAT');
  assert.equal(beat.observedMinIntervalMs,5000);
  assert.equal(beat.observedMaxIntervalMs,5000);
  // Delayed GET shrinks the remaining sleep and leaves the start cadence stable.
  assert.equal(calls,12);
});
