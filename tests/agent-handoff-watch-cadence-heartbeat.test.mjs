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
  assert.equal(beats[0].successfulReadsInWindow,12);
  assert.equal(beats[0].failedReadsInWindow,0);
  assert.equal(beats[0].backoffCyclesInWindow,0);
  assert.equal(beats[0].completeUnthrottledWindow,true);
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

test('earlier GitHub 429 stays visible when final poll succeeds, and next heartbeat resets counts',async()=>{
 const ctl=new AbortController(),reports=[];
 let time=1_000_000,calls=0;
 const response=status=>({status,headers:{get:()=>null},json:async()=>[]});
 await runWatch({token:'synthetic-no-log',signal:ctl.signal,clock:()=>time,
   fetchImpl:async()=>response(++calls===1?429:304),
   sleep:async ms=>{time+=ms;if(calls===24)ctl.abort();},
   onReport:x=>reports.push(x)});
 const beats=reports.filter(x=>x.state==='WATCH_HEARTBEAT');
 assert.equal(beats.length,2);
 assert.equal(beats[0].completedPolls,12);
 assert.equal(beats[0].successfulReadsInWindow,11);
 assert.equal(beats[0].failedReadsInWindow,1);
 assert.equal(beats[0].backoffCyclesInWindow,1);
 assert.equal(beats[0].backoffActive,false); // last poll alone is insufficient
 assert.equal(beats[0].completeUnthrottledWindow,false);
 assert.equal(beats[1].completedPolls,24);
 assert.equal(beats[1].successfulReadsInWindow,12);
 assert.equal(beats[1].failedReadsInWindow,0);
 assert.equal(beats[1].backoffCyclesInWindow,0);
 assert.equal(beats[1].completeUnthrottledWindow,true);
 assert.ok(!JSON.stringify(reports).includes('synthetic-no-log'));
});

test('low-quota HTTP 200 is a successful read but not an unthrottled window',async()=>{
 const ctl=new AbortController(),reports=[];
 let time=1_000_000,calls=0;
 await runWatch({token:'test',signal:ctl.signal,clock:()=>time,
   fetchImpl:async()=>{
     calls++;
     return {status:calls===1?200:304,
       headers:{get:name=>name==='x-ratelimit-remaining'&&calls===1?'20':null},
       json:async()=>[]};
   },
   sleep:async ms=>{time+=ms;if(calls===12)ctl.abort();},
   onReport:x=>reports.push(x)});
 const beat=reports.find(x=>x.state==='WATCH_HEARTBEAT');
 assert.equal(beat.successfulReadsInWindow,12);
 assert.equal(beat.failedReadsInWindow,0);
 assert.equal(beat.backoffCyclesInWindow,1);
 assert.equal(beat.backoffActive,false);
 assert.equal(beat.completeUnthrottledWindow,false);
});

test('thrown read error increments failed count without leaking exception body',async()=>{
 const ctl=new AbortController(),reports=[];
 let time=1_000_000,calls=0;
 await runWatch({token:'test',signal:ctl.signal,clock:()=>time,
   fetchImpl:async()=>{
     calls++;
     if(calls===1)throw Error('Authorization leak: github_pat_secret-C:\\Users\\private');
     return {status:304,headers:{get:()=>null}};
   },
   sleep:async ms=>{time+=ms;if(calls===12)ctl.abort();},
   onReport:x=>reports.push(x)});
 const beat=reports.find(x=>x.state==='WATCH_HEARTBEAT');
 assert.equal(beat.failedReadsInWindow,1);
 assert.equal(beat.successfulReadsInWindow,11);
 assert.equal(beat.backoffCyclesInWindow,1);
 assert.equal(beat.completeUnthrottledWindow,false);
 assert.ok(!JSON.stringify(reports).includes('github_pat_secret'));
});
