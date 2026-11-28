import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observePublicSourceCompletion} from '../ci-approval/public-completed-run-observe.mjs';
// Reuse the existing hosted source-only step for the shared Native A
// effect-binding regression. No public self-hosted admission or workflow pin changes.
import './ci-native-a-execute.test.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const repository=()=>({id:1442936296,full_name:REPO,private:false,
 owner:{id:327938088,login:'ansqhd5774-Choi'}});
const event=()=>({action:'completed',repository:repository(),
 workflow_run:{id:46050000000,run_attempt:1,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',head_sha:'a'.repeat(40),status:'completed',
  conclusion:'success',repository:repository(),
  head_repository:{id:1442936296,full_name:REPO}}});
const env=()=>({GITHUB_EVENT_NAME:'workflow_run',GITHUB_REPOSITORY:REPO,
 GITHUB_REF:'refs/heads/main',GITHUB_SHA:'b'.repeat(40),
 RUNNER_ENVIRONMENT:'github-hosted'});

const SOURCE_PATH='.github/workflows/controller-maintenance-source-tests.yml';
const PIN='a8f49337200d2e7ce902ab3ecf23d42c811fabe2';
const sourceBytes=readFileSync(new URL('../'+SOURCE_PATH,import.meta.url));
const reviewedWorkflow=()=>({type:'file',path:SOURCE_PATH,encoding:'base64',sha:PIN,
 content:sourceBytes.toString('base64')});
const jobs=e=>({total_count:2,jobs:[
 {id:991,run_id:e.workflow_run.id,name:'public-source-only',status:'completed',
  conclusion:'success',steps:[
   {name:'Verify exact public source-only event origin',status:'completed',conclusion:'success'},
   {name:'Verify public source/runner isolation and deferred B approval',
    status:'completed',conclusion:'success'}]},
 {id:992,run_id:e.workflow_run.id,name:'source-only',status:'completed',conclusion:'skipped'}
]});
const proof=e=>({getJobs:async()=>jobs(e),getWorkflow:async()=>reviewedWorkflow()});


test('public source CI is observed by an independent exact run read, never approved',async()=>{
 const e=event(),seen=[];
 const r=await observePublicSourceCompletion({event:e,env:env(),getRun:async id=>{
  seen.push(id);return structuredClone(e.workflow_run);
 },...proof(e)});
 assert.deepEqual(seen,[e.workflow_run.id]);
 assert.equal(r.state,'OBSERVED_ONLY');
 assert.equal(r.code,'PUBLIC_CI_COMPLETION_SOURCE_OBSERVED');
 assert.equal(r.runId,e.workflow_run.id);
 assert.equal(r.headSha,e.workflow_run.head_sha);
 assert.equal(r.sourceJobId,991);
 assert.equal(r.reviewedWorkflowBlobSha,PIN);
 for(const key of ['canPublish','canExecute','approvalVerified','selfHostedAuthorized',
  'controllerBAuthorized'])assert.equal(r[key],false,key);
 for(const key of ['operationalWrites','providerCalls','d1Writes'])
  assert.equal(r[key],0,key);
});

for(const [name,change] of [
 ['foreign repository',({e})=>e.repository.id++],
 ['private repository',({e})=>e.repository.private=true],
 ['foreign owner',({e})=>e.repository.owner.id++],
 ['foreign sender repository',({e})=>e.workflow_run.repository.id++],
 ['forked run',({e})=>e.workflow_run.head_repository.id++],
 ['failed run',({e})=>e.workflow_run.conclusion='failure'],
 ['cancelled run',({e})=>e.workflow_run.status='cancelled'],
 ['non-PR run',({e})=>e.workflow_run.event='push'],
 ['different source workflow',({e})=>e.workflow_run.workflow_id=2],
 ['different workflow path',({e})=>e.workflow_run.path='other.yml'],
 ['invalid head SHA',({e})=>e.workflow_run.head_sha='main'],
 ['unbound attempt',({e})=>e.workflow_run.run_attempt=0],
 ['request action',({e})=>e.action='requested'],
 ['non-main observer',({v})=>v.GITHUB_REF='refs/heads/topic'],
 ['wrong event type',({v})=>v.GITHUB_EVENT_NAME='push'],
 ['self-hosted context',({v})=>v.RUNNER_ENVIRONMENT='self-hosted'],
 ['different CI repository',({v})=>v.GITHUB_REPOSITORY='attacker/repo'],
 ['missing observer checkout SHA',({v})=>v.GITHUB_SHA=''],
]){
 test(name+' is not allowed to read run or submit',async()=>{
  const e=event(),v=env();change({e,v});let reads=0;
  const r=await observePublicSourceCompletion({event:e,env:v,getRun:async()=>{reads++;return {};}});
  assert.equal(r.state,'IGNORED');assert.equal(reads,0);
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

for(const [name,change] of [
 ['run ID mismatch',r=>r.id++],
 ['attempt mismatch',r=>r.run_attempt++],
 ['head mismatch',r=>r.head_sha='c'.repeat(40)],
 ['source workflow mismatch',r=>r.workflow_id=9],
 ['run repository switched to private',r=>r.repository.private=true],
 ['run now failed',r=>r.conclusion='failure']
]){
 test(name+' fails closed after authenticated read',async()=>{
  const e=event(),run=structuredClone(e.workflow_run);change(run);
  const r=await observePublicSourceCompletion({event:e,env:env(),getRun:async()=>run,
   ...proof(e)});
  assert.equal(r.state,'EVIDENCE_MISSING');
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_API_MISMATCH');
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

test('missing/failed authenticated read is neither approval nor execution',async()=>{
 const e=event();
 const missing=await observePublicSourceCompletion({event:e,env:env()});
 assert.equal(missing.code,'PUBLIC_CI_COMPLETION_READ_PORT_MISSING');
 const broken=await observePublicSourceCompletion({event:e,env:env(),getRun:async()=>{
  throw Error('token or network unavailable');
 },...proof(e)});
 assert.equal(broken.code,'PUBLIC_CI_COMPLETION_API_READ_FAILED');
 assert.equal(broken.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(broken),/token or network unavailable/);
});


test('success without the authenticated job or workflow read cannot count',async()=>{
 const e=event();
 for(const x of [
  {getRun:async()=>e.workflow_run,getWorkflow:async()=>reviewedWorkflow()},
  {getRun:async()=>e.workflow_run,getJobs:async()=>jobs(e)}
 ]){
  const r=await observePublicSourceCompletion({event:e,env:env(),...x});
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_READ_PORT_MISSING');
 }
});

for(const [name,mutate] of [
 ['missing job',x=>{x.jobs=[];x.total_count=0;}],
 ['truncated first page',x=>{x.total_count=3;}],
 ['duplicate successful job',x=>{x.jobs[1]={...x.jobs[0],id:999};}],
 ['public job skipped',x=>{x.jobs[0].conclusion='skipped';}],
 ['private job activated',x=>{x.jobs[1].conclusion='success';}],
 ['wrong run binding',x=>{x.jobs[0].run_id++;}],
 ['missing security step',x=>{x.jobs[0].steps.pop();}],
 ['failed security step',x=>{x.jobs[0].steps[0].conclusion='failure';}],
 ['duplicate required step',x=>{x.jobs[0].steps.push({...x.jobs[0].steps[0]});}]
]){
 test(name+' cannot become Public CI source proof',async()=>{
  const e=event(),j=jobs(e);mutate(j);
  const r=await observePublicSourceCompletion({event:e,env:env(),
   getRun:async()=>e.workflow_run,getJobs:async()=>j,
   getWorkflow:async()=>reviewedWorkflow()});
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_JOB_EVIDENCE_UNVERIFIED');
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

for(const [name,change] of [
 ['wrong trusted blob',x=>{x.sha='f'.repeat(40);}],
 ['modified workflow bytes',x=>{x.content=Buffer.from('fake').toString('base64');}],
 ['missing bytes',x=>{delete x.content;}],
 ['wrong path',x=>{x.path='other.yml';}],
 ['wrong encoding',x=>{x.encoding='utf-8';}]
]){
 test(name+' cannot promote PR-edited workflow',async()=>{
  const e=event(),f=reviewedWorkflow();change(f);
  const r=await observePublicSourceCompletion({event:e,env:env(),
   getRun:async()=>e.workflow_run,getJobs:async()=>jobs(e),
   getWorkflow:async()=>f});
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_WORKFLOW_BLOB_UNVERIFIED');
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

test('actual immutable main workflow bytes equal the reviewed pinned Git blob',async()=>{
 const {createHash}=await import('node:crypto');
 const h=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length))
  .update(Buffer.from([0])).update(sourceBytes).digest('hex');
 assert.equal(h,PIN);
});

test('Public CI observer is hosted and read-only; original Private B gate remains',async()=>{
 const {readFileSync}=await import('node:fs');
 const {URL}=await import('node:url');
 const y=readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 const hosted=y.split('  observe-public-source:')[1]?.split('  submit-controller-b:')[0];
 const existing=y.split('  submit-controller-b:')[1];
 assert.ok(hosted);
 assert.ok(existing);
 assert.match(hosted,/github\.event\.repository\.private == false/);
 assert.match(hosted,/github\.event_name == 'workflow_run'/);
 assert.match(hosted,/runs-on: ubuntu-latest/);
 assert.match(hosted,/contents: read/);
 assert.match(hosted,/actions: read/);
 assert.match(hosted,/node ci-approval\/public-completed-run-observe\.mjs/);
 assert.doesNotMatch(hosted,/self-hosted|contents: write|issues: write|pull-requests: write|workflow_dispatch/);
 assert.match(existing,/github\.event\.repository\.private == true/);
 assert.match(existing,/vars\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.match(existing,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 const verify=readFileSync(new URL('../.github/workflows/controller-maintenance-source-tests.yml',import.meta.url),'utf8');
 const publicCi=verify.split('  public-source-only:')[1]?.split('  source-only:')[0];
 assert.match(publicCi,/node --test --test-concurrency=1 tests\/ci-approval-public-completed-run-observe\.test\.mjs/);
});
