import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {verifyExactIssue,probeCensusCdn,URL,ISSUE_TITLE,SCHEMA} from '../tools/http32-census-cdn-once.mjs';
const requestId='5e379064-b5c9-486c-a7c9-1862634b42b7';
function permitted(){
 return {event:{action:'opened',issue:{title:ISSUE_TITLE,body:JSON.stringify({
  schema:SCHEMA,operation:'census-cdn-connectivity-once',requestId}),
  user:{login:'ansqhd5774-Choi'}},
  sender:{login:'ansqhd5774-Choi'},
  repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true}},
  env:{GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
   GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ATTEMPT:'1'},hostname:'PC'};
}
test('exact user, repository, host, issue and request ID must all match',()=>{
 const good=permitted();assert.equal(verifyExactIssue(good),requestId);
 for(const mutate of [
  x=>x.hostname='ANOTHER_PC',
  x=>x.env.GITHUB_RUN_ATTEMPT='2',
  x=>x.event.repository.private=false,
  x=>x.event.sender.login='bot',
  x=>x.event.issue.user.login='bot',
  x=>x.event.issue.title='some-other-issue',
  x=>x.event.issue.body=JSON.stringify({schema:SCHEMA,operation:'census-cdn-connectivity-once',
   requestId,url:'https://evil.example/'}),
  x=>x.event.issue.body=JSON.stringify({schema:SCHEMA,operation:'census-cdn-connectivity-once',
   requestId:'NOT_A_UUID'})
 ]){
  const f=permitted();mutate(f);assert.equal(verifyExactIssue(f),null);
 }
});
test('exactly one GET to fixed Census CDN returns bounded HTTP 200 metadata and cancels CSV body',async()=>{
 let n=0,canceled=0;
 const r=await probeCensusCdn({requestId,now:()=>new Date('2026-11-17T00:00:00Z'),
  fetchImpl:async (url,init)=>{
   n++;assert.equal(url,URL);assert.equal(init.method,'GET');
   assert.equal(init.redirect,'manual');assert.equal(init.headers.accept,'text/csv');
   return {status:200,headers:{get:key=>({
    'content-type':'text/csv;charset=UTF-8',
    'last-modified':'Thu, 12 Nov 2026 15:00:32 GMT',
    authorization:'SHOULD_NOT_LEAK'
   })[key]},body:{cancel:async()=>{canceled++;}}};
  }});
 assert.equal(n,1);assert.equal(canceled,1);
 assert.equal(r.status,'PASS');assert.equal(r.httpStatus,200);
 assert.equal(r.contentType,'CSV');
 assert.equal(r.lastModified,'2026-11-12T15:00:32.000Z');
 assert.equal(r.providerCalls,1);assert.equal(r.operationalWrites,0);
 assert.equal(r.d1Writes,0);assert.equal(r.scheduleChanged,false);
 assert.equal(r.automaticRetries,0);
 assert.ok(!JSON.stringify(r).includes('SHOULD_NOT_LEAK'));
});
test('redirect 302, HTML 200 and HTTP 404 cannot be reported healthy',async()=>{
 for(const [status,contentType,code] of [[302,'text/csv','REDIRECT_NOT_FOLLOWED'],
  [200,'text/html','NOT_CSV_CONTENT_TYPE'],[404,'text/csv','HTTP_NOT_200']]){
  const r=await probeCensusCdn({requestId,fetchImpl:async()=>({
   status,headers:{get:()=>contentType},body:{cancel:async()=>{}}
  })});
  assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,code);
  assert.equal(r.httpStatus,status);
 }
});
test('network exception terminates without retries, raw exception or credentials in output',async()=>{
 let called=0;
 const r=await probeCensusCdn({requestId,fetchImpl:async()=>{
  called++;throw new Error('SENSITIVE_SECRETS_HERE');
 }});
 assert.equal(called,1);assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'NETWORK_OR_TIMEOUT_FAILED');
 assert.equal(r.automaticRetries,0);
 assert.ok(!JSON.stringify(r).includes('SENSITIVE_SECRETS_HERE'));
});

test('025 completed Census CDN Issue intake is retired while the fixed read-only probe remains',()=>{
 assert.equal(existsSync(new URL('../.github/workflows/pc-census-cdn-connectivity-once.yml',import.meta.url)),false);
 assert.equal(existsSync(new URL('../.github/workflows/pc-process-inventory-readonly.yml',import.meta.url)),true);
 assert.equal(URL,'https://cdn.www.census.gov/econ/bfs/csv/bfs_monthly.csv');
 assert.equal(ISSUE_TITLE,'pc-census-cdn-connectivity-once');
});
