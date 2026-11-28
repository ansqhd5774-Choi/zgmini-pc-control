import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REPO,WORKFLOWS,triage,markerFor,caseKeyFor,recurrenceCandidates} from '../scripts/ci-failure-issue.mjs';

const event=(overrides={})=>({
 action:'completed',repository:{full_name:REPO,private:true},
 workflow_run:{id:123456,run_attempt:1,name:WORKFLOWS[0],
  status:'completed',conclusion:'failure',event:'pull_request',
  head_sha:'a'.repeat(40),head_repository:{full_name:REPO},...overrides}
});
const failureJob={id:87,name:'source-check',conclusion:'failure',steps:[
 {name:'checkout',conclusion:'success'},{name:'Regression tests',conclusion:'failure'}]};
function fixture({existing=false,comments=[],commentPage2=[]}={}){
 const calls=[];
 let lastPostedComment=null;
 const hash=caseKeyFor(WORKFLOWS[0],'source-check','Regression tests',123456,1,87,2);
 const marker=markerFor(hash);
 const issue={number:6200,body:marker+'\nold failure',
  user:{login:'github-actions[bot]'}};
 const request=async(resource,{method='GET',body}={})=>{
  calls.push({resource,method,body});
  if(resource==='actions/runs/123456/attempts/1/jobs?per_page=100')
   return {total_count:1,jobs:[failureJob]};
  if(resource==='issues?state=open&per_page=100&page=1')
   return existing?[issue]:[];
  if(resource==='issues/6200/comments?per_page=100')return comments;
  if(resource==='issues/6200/comments?per_page=100&page=2')return commentPage2;
  if(resource==='issues/6200/comments'&&method==='POST'){
   lastPostedComment=body.body;return {id:1};
  }
  if(resource==='issues/comments/1')return {id:1,body:lastPostedComment};
  if(resource==='issues'&&method==='POST')return {...issue,body:body.body};
  if(resource==='issues/6200')return {...issue,body:marker+'\ncreated'};
  throw Error('unexpected route '+method+' '+resource);
 };
 return {request,calls,hash,marker};
}

test('exact failed job and step produce one metadata-only Issue with verified identity',async()=>{
 const f=fixture();
 const result=await triage({event:event(),request:f.request});
 assert.deepEqual(result,{state:'CREATED',issue:6200});
 const post=f.calls.find(x=>x.resource==='issues'&&x.method==='POST');
 assert.match(post.body.title,/\[CI\]/);
 assert.ok(post.body.body.includes(f.marker));
 assert.match(post.body.body,/actions\/runs\/123456/);
 assert.match(post.body.body,/HEAD: /);
 assert.doesNotMatch(post.body.body,/secret value|job log|raw trace/i);
 assert.equal(f.calls.filter(x=>x.method==='POST').length,1);
});
test('same failure class links to existing Issue and repeated run is idempotent',async()=>{
 const f=fixture({existing:true});
 const result=await triage({event:event(),request:f.request});
 assert.deepEqual(result,{state:'COMMENTED',issue:6200});
 assert.equal(f.calls.filter(x=>x.method==='POST'&&x.resource==='issues').length,0);
 assert.equal(f.calls.filter(x=>x.method==='POST'&&x.resource.endsWith('/comments')).length,1);
 const duplicate=fixture({existing:true,comments:[
  {body:'<!-- zgmini-ci-run:123456:1:job:87:step:2 -->\nalready reported'}]});
 assert.deepEqual(await triage({event:event(),request:duplicate.request}),
  {state:'REUSED',issue:6200});
 assert.equal(duplicate.calls.filter(x=>x.method==='POST').length,0);
});
test('success, cancelled, unknown workflow and fork origin cause no GitHub API calls',async()=>{
 for(const changed of [{conclusion:'success'},{conclusion:'cancelled'},
  {name:'unlisted workflow'},{head_repository:{full_name:'outsider/fork'}}]){
  let calls=0;
  const r=await triage({event:event(changed),request:async()=>{calls++;throw Error('must not call');}});
  assert.deepEqual(r,{state:'IGNORED'});assert.equal(calls,0);
 }
});
test('incomplete GitHub evidence fails closed without Issue writes',async()=>{
 const request=async(resource)=>{
  if(resource.startsWith('actions/runs/'))return {total_count:101,jobs:[]};
  throw Error('must not write or enumerate');
 };
 await assert.rejects(triage({event:event(),request}),/CI_INCIDENT_JOB_INVENTORY_INCOMPLETE/);
});
test('tracked workflows and intake permission are fixed, without schedule or PC operations',()=>{
 const yml=readFileSync(new URL('../.github/workflows/ci-failure-issue-intake.yml',import.meta.url),'utf8');
 for(const name of WORKFLOWS)assert.ok(yml.includes("'"+name+"'"));
 assert.match(yml,/workflow_run:/);
 assert.match(yml,/issues: write/);
 assert.match(yml,/actions: read/);
 assert.match(yml,/ref: main/);
 assert.doesNotMatch(yml,/schedule:|issue_comment:|workflow_dispatch:|pc-job\.yml/);
});

test('timed out second attempt records the exact attempt and timeout metadata',async()=>{
 const calls=[];
 const issue={number:6201,user:{login:'github-actions[bot]'}};
 const request=async(resource,{method='GET',body}={})=>{
  calls.push({resource,method,body});
  if(resource==='actions/runs/123456/attempts/2/jobs?per_page=100')
   return {total_count:1,jobs:[{id:88,name:'CI timeout',conclusion:'timed_out',steps:[]}]};
  if(resource==='issues?state=open&per_page=100&page=1')return [];
  if(resource==='issues'&&method==='POST')return {...issue,body:body.body};
  if(resource==='issues/6201')return {...issue,body:markerFor(caseKeyFor(WORKFLOWS[0],'CI timeout','JOB_TIMEOUT',123456,2,88,0))};
  throw Error('unexpected route '+resource);
 };
 assert.deepEqual(await triage({event:event({run_attempt:2,conclusion:'timed_out'}),request}),
  {state:'CREATED',issue:6201});
 assert.equal(calls.some(x=>x.resource==='actions/runs/123456/attempts/1/jobs?per_page=100'),false);
 const created=calls.find(x=>x.resource==='issues'&&x.method==='POST');
 assert.match(created.body.body,/Attempt: 2/);
 assert.match(created.body.body,/Conclusion: timed_out/);
 assert.match(created.body.title,/JOB_TIMEOUT/);
});
test('invalid run identity fails closed without GitHub API requests',async()=>{
 for(const changed of [{id:0},{run_attempt:0},{head_sha:'invalid'}]){
  let calls=0;
  await assert.rejects(triage({event:event(changed),request:async()=>{calls++;throw Error('unexpected');}}),
   /CI_INCIDENT_RUN_IDENTITY_INVALID/);
  assert.equal(calls,0);
 }
});
test('GitHub job retrieval errors are propagated with zero issue writes',async()=>{
 const calls=[];
 await assert.rejects(triage({event:event(),request:async(resource,{method='GET'}={})=>{
  calls.push({resource,method});throw Error('CI_INCIDENT_GITHUB_HTTP_403');
 }}),/CI_INCIDENT_GITHUB_HTTP_403/);
 assert.deepEqual(calls.map(x=>x.method),['GET']);
});
test('the 100-comment boundary checks the next page and reuses an exact receipt',async()=>{
 const receipt='<!-- zgmini-ci-run:123456:1:job:87:step:2 -->';
 const f=fixture({existing:true,
  comments:Array.from({length:100},()=>({body:'different observed run'})),
  commentPage2:[{body:receipt+'\noriginal evidence'}]});
 const result=await triage({event:event(),request:f.request});
 assert.deepEqual(result,{state:'REUSED',issue:6200});
 assert.ok(f.calls.some(c=>c.resource==='issues/6200/comments?per_page=100&page=2'));
 assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('incomplete 1000-comment evidence fails closed without writes',async()=>{
 const calls=[];
 const hash=caseKeyFor(WORKFLOWS[0],'source-check','Regression tests',123456,1,87,2);
 const request=async(resource,{method='GET'}={})=>{
  calls.push({resource,method});
  if(resource.startsWith('actions/runs/'))return {total_count:1,jobs:[failureJob]};
  if(resource==='issues?state=open&per_page=100&page=1')return [{
   number:6200,body:markerFor(hash),user:{login:'github-actions[bot]'}}];
  if(/^issues\/6200\/comments\?per_page=100/.test(resource))
   return Array.from({length:100},()=>({body:'different incident'}));
  throw Error('must not write');
 };
 await assert.rejects(triage({event:event(),request}),/CI_INCIDENT_COMMENTS_UNVERIFIED/);
 assert.equal(calls.filter(c=>c.method==='POST').length,0);
});
test('an incorrect Issue creation readback is rejected',async()=>{
 let wrote=0;
 const request=async(resource,{method='GET',body}={})=>{
  if(resource==='actions/runs/123456/attempts/1/jobs?per_page=100')
   return {total_count:1,jobs:[failureJob]};
  if(resource==='issues?state=open&per_page=100&page=1')return [];
  if(resource==='issues'&&method==='POST'){wrote++;return {number:6202};}
  if(resource==='issues/6202')return {number:6202,body:'missing marker'};
  throw Error('unexpected route '+resource);
 };
 await assert.rejects(triage({event:event(),request}),/CI_INCIDENT_ISSUE_CREATE_READBACK/);
 assert.equal(wrote,1);
});

test('failure intake queues overlapping events instead of replacing earlier pending failures',()=>{
 const yml=readFileSync(new URL('../.github/workflows/ci-failure-issue-intake.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.match(yml,/concurrency:\n  group: ci-failure-issue-intake\n  queue: max\n  cancel-in-progress: false/);
 assert.match(yml,/workflow_run:/);
});

test('nonempty GitHub job count with omitted jobs fails closed before Issue writes',async()=>{
 const calls=[];
 const request=async(resource,{method='GET'}={})=>{
  calls.push({resource,method});
  if(resource==='actions/runs/123456/attempts/1/jobs?per_page=100')
   return {total_count:1,jobs:[]};
  throw Error('must not enumerate or write Issues');
 };
 await assert.rejects(triage({event:event(),request}),/CI_INCIDENT_JOB_INVENTORY_INCOMPLETE/);
 assert.deepEqual(calls.map(c=>c.method),['GET']);
});
test('created Issue isolates unverified causes by exact run and records its execution scope',async()=>{
 const f=fixture();
 assert.deepEqual(await triage({event:event(),request:f.request}),{state:'CREATED',issue:6200});
 const created=f.calls.find(x=>x.resource==='issues'&&x.method==='POST');
 assert.ok(created.body.body.includes('원인 미확정, 실행별 독립 사건'));
 assert.ok(created.body.body.includes('분류: 실행·Job·Step 위치만 확인됨'));
 assert.ok(created.body.body.includes('zgmini-ci-run:123456:1:job:87:step:2'));
 assert.doesNotMatch(created.body.body,/묶음 기준: 같은 Workflow\/Job\/Step/);

});

test('unknown causes in identical CI steps are separated by run and attempt',()=>{
 const a=caseKeyFor(WORKFLOWS[0],'source-check','Regression tests',123456,1,87,2);
 const b=caseKeyFor(WORKFLOWS[0],'source-check','Regression tests',123457,1,87,2);
 const c=caseKeyFor(WORKFLOWS[0],'source-check','Regression tests',123456,2,87,2);
 assert.notEqual(a,b);
 assert.notEqual(a,c);
});

test('all failing jobs and failed steps are reported without conflating causes',async()=>{
 const calls=[],stored=new Map();
 let issueNumber=6300;
 const request=async(resource,{method='GET',body}={})=>{
  calls.push({resource,method,body});
  if(resource==='actions/runs/123456/attempts/1/jobs?per_page=100')
   return {total_count:2,jobs:[
    {id:87,name:'source-check',conclusion:'failure',steps:[
     {number:1,name:'Unit',conclusion:'failure'},
     {number:2,name:'Integration',conclusion:'failure'}]},
    {id:88,name:'security-check',conclusion:'failure',steps:[
     {number:1,name:'Secret scan',conclusion:'failure'}]}
   ]};
  if(resource==='issues?state=open&per_page=100&page=1')return [];
  if(resource==='issues'&&method==='POST'){
   const n=issueNumber++;
   stored.set(n,{number:n,body:body.body});
   return {number:n};
  }
  const match=resource.match(/^issues\/(\d+)$/);
  if(match&&method==='GET')return stored.get(Number(match[1]));
  throw Error('unexpected '+method+' '+resource);
 };
 const result=await triage({event:event(),request});
 assert.equal(result.state,'MULTIPLE_INCIDENTS');
 assert.deepEqual(result.incidents.map(i=>i.state),['CREATED','CREATED','CREATED']);
 const posted=calls.filter(c=>c.resource==='issues'&&c.method==='POST');
 assert.equal(posted.length,3);
 assert.ok(posted.some(x=>x.body.body.includes('- Job ID: 88')));
 assert.ok(posted.some(x=>x.body.body.includes('- Step: Integration')));
 assert.ok(posted.every(x=>x.body.body.includes('원인 미확정')));
 assert.equal(new Set(posted.map(x=>x.body.body.match(/zgmini-ci-failure:([a-f0-9]+)/)?.[1])).size,3);
});

test('missing failed-job identity is refused before incident writes',async()=>{
 const calls=[];
 await assert.rejects(triage({event:event(),request:async(resource,{method='GET'}={})=>{
  calls.push({resource,method});
  if(resource.startsWith('actions/runs/'))return {total_count:1,jobs:[
   {name:'anonymous',conclusion:'failure',steps:[{name:'Unit',conclusion:'failure'}]}]};
  throw Error('unexpected Issue access');
 }}),/CI_INCIDENT_JOB_IDENTITY_INVALID/);
 assert.equal(calls.length,1);
});

test('PC isolated C996 and Secret Scan retain independent checks after unrelated failed steps',()=>{
 const c996=readFileSync(new URL('../.github/workflows/c996-r5-readonly-source-checks.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const secret=readFileSync(new URL('../.github/workflows/pc-secret-scan.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 for(const [yml,names,guard] of [
  [c996,['Validate pinned workflow security scanner',
   'Audit changed GitHub Actions workflow security'],
   "!cancelled() && steps.checkout.outcome == 'success' && steps.node_setup.outcome == 'success' && steps.queue_host.outcome == 'success'"],
  [secret,['Verify Oxlint source selector and SHA256 guard',
   'Lint changed JavaScript and TypeScript with pinned Oxlint'],
   "!cancelled() && steps.queue_host.outcome == 'success' && steps.checkout.outcome == 'success' && steps.node_setup.outcome == 'success'"]
 ]){
  for(const name of names)
   assert.ok(yml.includes("      - name: "+name+"\n        if: "+String.fromCharCode(36)+"{{ "+guard+" }}"),
    'missing isolated execution: '+name);
  assert.doesNotMatch(yml,/continue-on-error:\s*true/);
 }
});

test('101 attempt jobs are fully paged, including a failure on page two',async()=>{
 const calls=[],stored=new Map();
 let issue=7500;
 const jobs=Array.from({length:101},(_,i)=>({
  id:10000+i,name:'job-'+i,conclusion:i===0||i===100?'failure':'success',
  steps:i===0||i===100?[{name:'Unit',number:1,conclusion:'failure'}]:[]}));
 const prefix='actions/runs/123456/attempts/1/jobs?per_page=100';
 const request=async(resource,{method='GET',body}={})=>{
  calls.push({resource,method});
  if(resource===prefix)return {total_count:101,jobs:jobs.slice(0,100)};
  if(resource===prefix+'&page=2')return {total_count:101,jobs:jobs.slice(100)};
  if(resource==='issues?state=open&per_page=100&page=1')return [];
  if(resource==='issues'&&method==='POST'){
   const number=issue++;
   stored.set(number,{number,body:body.body});return {number};
  }
  const m=resource.match(/^issues\/(\d+)$/);
  if(m)return stored.get(Number(m[1]));
  throw Error('unexpected '+resource);
 };
 const result=await triage({event:event(),request});
 assert.equal(result.state,'MULTIPLE_INCIDENTS');
 assert.equal(result.incidents.length,2);
 assert.ok(calls.some(c=>c.resource===prefix+'&page=2'));
 assert.equal(issue,7502);
});
test('short second job page fails closed without creating an Issue',async()=>{
 const jobs=Array.from({length:100},(_,i)=>({
  id:11000+i,name:'job-'+i,conclusion:'success',steps:[]}));
 let wrote=false;
 const request=async(resource,{method='GET'}={})=>{
  if(resource.endsWith('/jobs?per_page=100'))return {total_count:101,jobs};
  if(resource.endsWith('/jobs?per_page=100&page=2'))
   return {total_count:101,jobs:[]};
  wrote=wrote||method==='POST';throw Error('unexpected Issue access');
 };
 await assert.rejects(triage({event:event(),request}),/CI_INCIDENT_JOB_INVENTORY_INCOMPLETE/);
 assert.equal(wrote,false);
});
test('comment acknowledgement requires an exact remote receipt readback',async()=>{
 const hash=caseKeyFor(WORKFLOWS[0],'source-check','Regression tests',123456,1,87,2);
 let posts=0;
 const request=async(resource,{method='GET'}={})=>{
  if(resource.startsWith('actions/runs/'))return {total_count:1,jobs:[failureJob]};
  if(resource==='issues?state=open&per_page=100&page=1')
   return [{number:6200,body:markerFor(hash),user:{login:'github-actions[bot]'}}];
  if(resource==='issues/6200/comments?per_page=100')return [];
  if(resource==='issues/6200/comments'&&method==='POST'){posts++;return {id:5};}
  if(resource==='issues/comments/5')return {id:5,body:'missing receipt'};
  throw Error('unexpected route '+resource);
 };
 await assert.rejects(triage({event:event(),request}),/CI_INCIDENT_ISSUE_COMMENT_READBACK/);
 assert.equal(posts,1);
});

test('historical closed CI candidates require exact workflow, job, step and are capped',()=>{
 const data=[
  {number:100,body:'**CI 실패 관측**\n- Workflow: CI-A\n- Job: test\n- Step: regression'},
  {number:101,body:'**CI 실패 관측**\n- Workflow: CI-A\n- Job: test\n- Step: regression'},
  {number:102,body:'**CI 실패 관측**\n- Workflow: CI-A\n- Job: test\n- Step: regression'},
  {number:103,body:'**CI 실패 관측**\n- Workflow: CI-A\n- Job: test\n- Step: regression'},
  {number:104,body:'**CI 실패 관측**\n- Workflow: CI-A\n- Job: test\n- Step: different'},
  {number:105,pull_request:{url:'pr'},body:'**CI 실패 관측**\n- Workflow: CI-A\n- Job: test\n- Step: regression'}
 ];
 assert.deepEqual(recurrenceCandidates(data,{workflow:'CI-A',job:'test',step:'regression'}),[100,101,102]);
 assert.deepEqual(recurrenceCandidates(data,{workflow:'CI-A',job:'test',step:'different'}),[104]);
 assert.deepEqual(recurrenceCandidates(data,{workflow:'CI-A',job:'other',step:'regression'}),[]);
});
test('new CI failure lists previously closed matching step as candidate without claiming same cause',async()=>{
 const calls=[];
 const issueBody='**CI 실패 관측 (원인 미확정, 실행별 독립 사건)**\n'+
  '- Workflow: '+WORKFLOWS[0]+'\n- Job: source-check\n- Step: Regression tests';
 let created;
 const request=async(resource,{method='GET',body}={})=>{
  calls.push({resource,method});
  if(resource==='actions/runs/123456/attempts/1/jobs?per_page=100')
   return {total_count:1,jobs:[failureJob]};
  if(resource==='issues?state=open&per_page=100&page=1')return [];
  if(resource==='issues?state=closed&per_page=100&page=1')
   return [{number:5000,body:issueBody},
    {number:5001,body:issueBody.replace('Regression tests','another failure')}];
  if(resource==='issues'&&method==='POST'){
   created={number:6200,body:body.body};return created;
  }
  if(resource==='issues/6200')return created;
  throw Error('unexpected route '+resource);
 };
 const result=await triage({event:event(),request});
 assert.deepEqual(result,{state:'CREATED',issue:6200});
 assert.match(created.body,/이전 종결 CI 관측 후보.*#5000/);
 assert.doesNotMatch(created.body,/#5001/);
 assert.match(created.body,/재발 판정: 미확인/);
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
});
test('closed issue read failure does not block original incident submission or assert no recurrence',async()=>{
 const calls=[];
 let created;
 const request=async(resource,{method='GET',body}={})=>{
  calls.push({resource,method});
  if(resource==='actions/runs/123456/attempts/1/jobs?per_page=100')
   return {total_count:1,jobs:[failureJob]};
  if(resource==='issues?state=open&per_page=100&page=1')return [];
  if(resource.startsWith('issues?state=closed'))throw Error('403 read-only candidate lookup');
  if(resource==='issues'&&method==='POST'){
   created={number:6200,body:body.body};return created;
  }
  if(resource==='issues/6200')return created;
  throw Error('unexpected route '+resource);
 };
 assert.deepEqual(await triage({event:event(),request}),{state:'CREATED',issue:6200});
 assert.match(created.body,/HISTORY_UNAVAILABLE/);
 assert.match(created.body,/재발 판정: 미확인/);
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
});

// Use exact GitHub public attempt metadata; all writes below are in-memory fakes.
const publicEvent=(patch={})=>{
 const r={full_name:REPO,id:1442936296,private:false};
 const e=event({repository:r,head_repository:r,workflow_id:415136577,
  path:'.github/workflows/c996-r5-readonly-source-checks.yml',...patch});
 e.repository=r;return e;
};
test('Public CI failure verifies exact attempt before existing metadata-only Issue intake',async()=>{
 const e=publicEvent(),f=fixture();
 const calls=[];
 const result=await triage({event:e,request:async(resource,options)=>{
  calls.push(resource);
  if(resource==='actions/runs/123456/attempts/1')return structuredClone(e.workflow_run);
  return f.request(resource,options);
 }});
 assert.deepEqual(result,{state:'CREATED',issue:6200});
 assert.equal(calls[0],'actions/runs/123456/attempts/1');
 assert.equal(f.calls.filter(x=>x.method==='POST').length,1);
 const posted=f.calls.find(x=>x.method==='POST');
 assert.match(posted.body.body,/actions\/runs\/123456/);
 assert.doesNotMatch(posted.body.body,/secret value|raw trace|job log/i);
 assert.ok(!calls.some(x=>/\/logs|\/artifacts/.test(x)));
});
test('Public success, cancellation, skipped, fork, unknown path or missing privacy do not intake',async()=>{
 const inputs=[publicEvent({conclusion:'success'}),publicEvent({conclusion:'cancelled'}),
  publicEvent({conclusion:'skipped'}),publicEvent({head_repository:{full_name:'other/fork',id:1,private:false}}),
  publicEvent({path:'.github/workflows/other.yml'}),publicEvent({workflow_id:0}),publicEvent()];
 inputs.at(-1).repository={full_name:REPO,id:1442936296};
 for(const e of inputs){
  let calls=0;
  assert.deepEqual(await triage({event:e,request:async()=>{calls++;throw Error('unexpected');}}),{state:'IGNORED'});
  assert.equal(calls,0);
 }
});
test('Public stale or mismatched exact run attempt cannot write an Issue',async()=>{
 for(const patch of [{run_attempt:2},{head_sha:'b'.repeat(40)},{conclusion:'success'},{workflow_id:1},
   {path:'.github/workflows/other.yml'},{repository:{full_name:REPO,id:1442936296,private:true}}]){
  const e=publicEvent(),calls=[];
  await assert.rejects(triage({event:e,request:async(resource,{method='GET'}={})=>{
   calls.push({resource,method});
   return {...e.workflow_run,...patch};
  }}),/CI_INCIDENT_PUBLIC_RUN_IDENTITY_UNVERIFIED/);
  assert.deepEqual(calls,[{resource:'actions/runs/123456/attempts/1',method:'GET'}]);
 }
});
test('Public intake timeout and repeated exact receipt preserve idempotency',async()=>{
 const e=publicEvent({conclusion:'timed_out'});
 const f=fixture({existing:true,comments:[{body:'<!-- zgmini-ci-run:123456:1:job:87:step:2 -->'}]});
 assert.deepEqual(await triage({event:e,request:async(resource,options)=>{
  if(resource==='actions/runs/123456/attempts/1')return e.workflow_run;
  return f.request(resource,options);
 }}),{state:'REUSED',issue:6200});
 assert.equal(f.calls.filter(x=>x.method==='POST').length,0);
});
