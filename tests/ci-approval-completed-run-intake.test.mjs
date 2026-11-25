import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {observeCompletedRun,observePublishedControllerApprovals} from '../ci-approval/completed-run-intake.mjs';

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

function publicationFixture(){
 const before='a'.repeat(40),after='b'.repeat(40),target='c'.repeat(40);
 const path='approvals/controller-updates/'+target+'.json';
 const bytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_UPDATE_V1',targetSha:target,approval:{ref:'https://github.com/'+repository.full_name+'/pull/3573'}}));
 const blob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
 const event={repository:{...repository},ref:'refs/heads/main',deleted:false,forced:false,before,after};
 const diff={status:'ahead',behind_by:0,base_commit:{sha:before},merge_base_commit:{sha:before},files:[{filename:path,status:'added',sha:blob}]};
 const record={type:'file',path,sha:blob,encoding:'base64',content:bytes.toString('base64')};
 return {event,diff,record,bytes,path,target,getJson:async route=>{
  if(route==='compare/'+before+'...'+after)return diff;
  if(route==='contents/'+path+'?ref='+after)return record;
  throw Error('unexpected route');
 }};
}
test('approval publication after source CI is observed at exact immutable revision',async()=>{
 const v=publicationFixture(),r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.state,'APPROVAL_PUBLICATION_OBSERVED_ONLY');
 assert.equal(r.entries[0].state,'EXISTING_MANIFEST_OBSERVED_ONLY');
 assert.equal(r.entries[0].revision,v.event.after);
 assert.equal(r.entries[0].manifestSha256,createHash('sha256').update(v.bytes).digest('hex'));
 assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
});
test('non-main publication does not read API',async()=>{
 const v=publicationFixture();v.event.ref='refs/heads/codex/test';
 const r=await observePublishedControllerApprovals(v.event,{getJson:async()=>assert.fail('unexpected read')});
 assert.equal(r.state,'IGNORED');
});
test('changed existing approval is not accepted as new publication',async()=>{
 const v=publicationFixture();v.diff.files[0].status='modified';
 const r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.entries[0].state,'EXISTING_APPROVAL_CHANGE_REQUIRES_REVIEW');
 assert.equal(r.canExecute,false);
});
test('manifest bytes mismatch is isolated to that approval',async()=>{
 const v=publicationFixture();v.record.content=Buffer.from('{}').toString('base64');
 const r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.entries[0].state,'APPROVAL_READ_UNVERIFIED');
 assert.equal(r.canExecute,false);
});
test('unrelated main changes need no approval lookup',async()=>{
 const v=publicationFixture();v.diff.files=[{filename:'docs/example.md',status:'added'}];
 const r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.state,'IGNORED');assert.deepEqual(r.entries,[]);
});
test('incomplete publication diff is not approved',async()=>{
 const v=publicationFixture();v.diff.files=Array(300).fill(v.diff.files[0]);
 const r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.state,'EVIDENCE_MISSING');assert.equal(r.canPublish,false);
});

test('published approval links exact merged PR and successful CI through shared resolver',async()=>{
 const v=publicationFixture(),run=event().workflow_run,read=v.getJson;
 const calls=[];
 v.getJson=async route=>{
  calls.push(route);
  if(route==='pulls/3573')return {number:3573,merged:true,base:{ref:'main',repo:repository},head:{sha:run.head_sha,repo:repository}};
  if(route==='actions/workflows/416355595/runs?head_sha='+run.head_sha+'&event=pull_request&status=success&per_page=100')return {workflow_runs:[run]};
  if(route==='actions/runs/'+run.id)return run;
  return read(route);
 };
 const r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.entries[0].ciState,'SOURCE_CI_MATCH_ONLY');
 assert.deepEqual(r.entries[0].sourceCI,{approvalPr:3573,headSha:run.head_sha,runId:run.id});
 assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 assert.ok(calls.includes('actions/runs/'+run.id));
});
test('unavailable source CI preserves observed manifest but does not claim successful match',async()=>{
 const v=publicationFixture(),r=await observePublishedControllerApprovals(v.event,v);
 assert.equal(r.entries[0].state,'EXISTING_MANIFEST_OBSERVED_ONLY');
 assert.equal(r.entries[0].ciState,'SOURCE_CI_UNVERIFIED');
 assert.equal(r.entries[0].sourceCI,undefined);
 assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
});
