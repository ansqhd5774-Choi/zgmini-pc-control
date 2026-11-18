import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOnce,changeSummary,summarizeIssues,runWatch} from '../agent-handoff/intake-watch-5s.mjs';
const response=(status,data=[],extra={})=>({status,headers:{get:k=>extra[k]??null},json:async()=>data});
const issue=(number,updated_at='2026-11-17T01:00:00Z')=>({number,updated_at,labels:[{name:'agent-handoff'}]});

test('single narrow GET, no dispatch or writes',async()=>{
  let count=0;
  const r=await checkOnce({token:'test',fetchImpl:async(url,args)=>{count++;assert.equal(args.method,'GET');assert.match(url,/state=open&labels=agent-handoff/);return response(200,[issue(123)],{etag:'"x"'});}});
  assert.equal(count,1);assert.equal(r.state,'INITIAL_INVENTORY');assert.equal(r.issues[0].issueNumber,123);assert.equal(r.noWrite,true);
});
test('conditional ETag 304 reports no new work',async()=>{
 const before=[{issueNumber:123,updatedAt:'today'}];
 const r=await checkOnce({token:'test',etag:'"x"',previous:before,fetchImpl:async(url,args)=>{assert.equal(args.headers['If-None-Match'],'"x"');return response(304);}});
 assert.equal(r.state,'UNCHANGED');assert.equal(r.issues,before);
});
test('new, updated and closed issue changes retain identity',()=>{
 const prev=summarizeIssues([issue(2),issue(3)]),next=summarizeIssues([issue(3,'new'),issue(4)]);
 const c=changeSummary(prev,next);
 assert.deepEqual(c.newIssueNumbers,[4]);assert.deepEqual(c.updatedIssueNumbers,[3]);assert.deepEqual(c.noLongerOpenIssueNumbers,[2]);
});
test('incomplete page is rejected',()=>assert.throws(()=>summarizeIssues(Array(100).fill(null)),/INCOMPLETE_PAGE_STOP/));
test('authentication and rate-limit failures cannot be success',async()=>{
 await assert.rejects(()=>checkOnce({fetchImpl:async()=>response(200)}),/AUTH_REQUIRED/);
 for(const code of [403,429]){const r=await checkOnce({token:'test',fetchImpl:async()=>response(code)});assert.equal(r.needsBackoff,true);assert.equal(r.state,'RATE_LIMIT_OR_FORBIDDEN');}
});
test('watcher polls 5s without overlap; limits use increasing backoff',async()=>{
 let active=0,maxActive=0,calls=0;const delays=[];const controller=new AbortController();
 await runWatch({token:'test',signal:controller.signal,clock:()=>1000,sleep:async ms=>{delays.push(ms);if(delays.length>=3)controller.abort();},fetchImpl:async()=>{active++;maxActive=Math.max(maxActive,active);calls++;const code=calls>=2?429:304;active--;return response(code);},onReport:()=>{}});
 assert.equal(maxActive,1);assert.equal(calls,3);assert.deepEqual(delays,[5000,60000,120000]);
});
