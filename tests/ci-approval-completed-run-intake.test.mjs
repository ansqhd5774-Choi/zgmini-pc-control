import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeCompletedRun} from '../ci-approval/completed-run-intake.mjs';

const repository={id:1442936296,full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true};
const event=()=>({action:'completed',repository:{...repository},workflow_run:{
 id:45623579994,run_attempt:1,workflow_id:416355595,
 path:'.github/workflows/controller-maintenance-source-tests.yml',
 event:'pull_request',repository:{...repository},head_repository:{...repository},
 head_sha:'742d5843a59742f3215f20884fb58acd4cb8e8ce',status:'completed',conclusion:'success'
}});
test('completion re-reads exact run identity without granting authority',async()=>{
 const e=event();let reads=0;
 const r=await observeCompletedRun(e,{getRun:async n=>{reads++;assert.equal(n,e.workflow_run.id);return {...e.workflow_run,pull_requests:[{head:{sha:'a'.repeat(40)}}]}}});
 assert.equal(reads,1);assert.equal(r.state,'CI_COMPLETION_OBSERVED_ONLY');
 assert.equal(r.headSha,e.workflow_run.head_sha);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
});
for(const [name,change] of [
 ['wrong action',e=>e.action='requested'],
 ['failed run',e=>e.workflow_run.conclusion='failure'],
 ['wrong workflow',e=>e.workflow_run.workflow_id=42],
 ['wrong path',e=>e.workflow_run.path='.github/workflows/other.yml'],
 ['fork',e=>e.workflow_run.head_repository={...repository,id:42}],
 ['public repo',e=>e.repository.private=false],
 ['invalid run id',e=>e.workflow_run.id='123'],
 ['unrelated event',e=>e.workflow_run.event='push']
])test(name+' is ignored without API calls',async()=>{
 const e=event();change(e);let reads=0;
 const r=await observeCompletedRun(e,{getRun:async()=>{reads++;return e.workflow_run}});
 assert.equal(reads,0);assert.equal(r.state,'IGNORED');assert.equal(r.canPublish,false);
});
for(const [name,change] of [
 ['different run',r=>r.id++],['different attempt',r=>r.run_attempt++],
 ['different head',r=>r.head_sha='a'.repeat(40)],['cancelled',r=>r.conclusion='cancelled']
])test('API '+name+' cannot validate event',async()=>{
 const e=event(),run={...e.workflow_run};change(run);
 const r=await observeCompletedRun(e,{getRun:async()=>run});
 assert.equal(r.state,'EVIDENCE_MISSING');assert.equal(r.canExecute,false);
});
test('unavailable authenticated read is not success',async()=>{
 const r=await observeCompletedRun(event(),{getRun:async()=>{throw Error('unavailable')}});
 assert.equal(r.state,'EVIDENCE_MISSING');assert.equal(r.canPublish,false);
});
