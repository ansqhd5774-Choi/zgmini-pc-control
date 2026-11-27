import test from 'node:test';
import assert from 'node:assert/strict';
import {observePublicSourceCompletion} from '../ci-approval/public-completed-run-observe.mjs';

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

test('public source CI is observed by an independent exact run read, never approved',async()=>{
 const e=event(),seen=[];
 const r=await observePublicSourceCompletion({event:e,env:env(),getRun:async id=>{
  seen.push(id);return structuredClone(e.workflow_run);
 }});
 assert.deepEqual(seen,[e.workflow_run.id]);
 assert.equal(r.state,'OBSERVED_ONLY');
 assert.equal(r.code,'PUBLIC_CI_COMPLETION_SOURCE_OBSERVED');
 assert.equal(r.runId,e.workflow_run.id);
 assert.equal(r.headSha,e.workflow_run.head_sha);
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
  const r=await observePublicSourceCompletion({event:e,env:env(),getRun:async()=>run});
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
 }});
 assert.equal(broken.code,'PUBLIC_CI_COMPLETION_API_READ_FAILED');
 assert.equal(broken.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(broken),/token or network unavailable/);
});
