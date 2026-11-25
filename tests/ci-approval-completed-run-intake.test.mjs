import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {observeCompletedRun,observePublishedControllerApprovals,createControllerPublicationPorts,publishExistingControllerApprovals,ciPublicationExitCode} from '../ci-approval/completed-run-intake.mjs';

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

test('publication adapter verifies blob and uses exact fixed Issue endpoint payload',async()=>{
 const v=publicationFixture(),writes=[];
 const ports=createControllerPublicationPorts({getJson:async route=>{
  assert.equal(route,'contents/'+v.path+'?ref=main');return v.record;
 },postIssue:async body=>{writes.push(body);return {number:42}},store:{loadReceipt:()=>null,saveReceipt:()=>{}}});
 assert.deepEqual(await ports.readManifest(v.target),v.bytes);
 await assert.rejects(()=>ports.readManifest('../bad'),/SOURCE_INVALID/);
 const body={title:'pc-controller-update',body:'fixture',labels:['pc-maintenance']};
 assert.equal((await ports.createIssue({...body,repository_full_name:'ignored'})).number,42);
 assert.deepEqual(writes,[body]);
 v.record.sha='d'.repeat(40);await assert.rejects(()=>ports.readManifest(v.target),/SOURCE_UNVERIFIED/);
});
test('prior inventory adapter includes closed requests and reads all pages without search index',async()=>{
 const v=publicationFixture(),calls=[];
 const ports=createControllerPublicationPorts({getJson:async route=>{
  calls.push(route);if(route.endsWith('page=1'))return Array.from({length:100},()=>({title:'other'}));
  return [{number:42,title:'pc-controller-update',state:'closed',body:JSON.stringify({targetControllerSha:v.target})}];
 },postIssue:()=>assert.fail('POST'),store:{}});
 assert.equal((await ports.findPriorRequests(v.target))[0].number,42);assert.equal(calls.length,2);
});
test('publication without a matched source CI cannot call write ports',async()=>{
 const v=publicationFixture();
 const result=await publishExistingControllerApprovals(v.event,{getJson:v.getJson,ports:{
  readRepository:()=>assert.fail('publisher called')},runId:123,attempt:1,emitReceipt:()=>assert.fail('receipt')});
 assert.equal(result.state,'PUBLICATION_PROCESSED');assert.equal(result.results[0].status,'NOT_SUBMITTED');
});
test('non-main publication cannot call publisher even if caller supplies ports',async()=>{
 const v=publicationFixture();v.event.ref='refs/heads/codex/test';
 const result=await publishExistingControllerApprovals(v.event,{getJson:()=>assert.fail('read'),ports:{},
  runId:123,attempt:1,emitReceipt:()=>assert.fail('receipt')});
 assert.equal(result.state,'IGNORED');assert.deepEqual(result.results,[]);
});

test('submission workflow is activation-gated, push-only and pinned to reviewed publisher source',()=>{
 const y=readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 const trigger=y.slice(0,y.indexOf('\npermissions:'));
 assert.match(trigger,/push:\s+branches: \[main\]/);
 assert.doesNotMatch(trigger,/workflow_run:|pull_request:|workflow_dispatch:|schedule:/);
 assert.match(y,/permissions: \{\}/);
 assert.match(y,/vars\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.match(y,/name: submit-controller-b/);
 assert.match(y,/name: Record Controller B request receipt/);
 assert.match(y,/ref: [a-f0-9]{40}\s+persist-credentials: false/);
 assert.match(y,/run: node ci-approval\/completed-run-intake\.mjs --publish-existing/);
 assert.match(y,/cancel-in-progress: false/);
 assert.doesNotMatch(y,/contents: write|id-token: write/);
});

test('CI publisher process exit fails on withheld or uncertain effects, not reused original requests',()=>{
 const processed=results=>({state:'PUBLICATION_PROCESSED',results});
 for(const status of ['STATE_UNKNOWN','NOT_SUBMITTED','AUTOMATION_BLOCKED']){
  assert.equal(ciPublicationExitCode(processed([{status}])),1,status);
  assert.equal(ciPublicationExitCode(processed([
   {status:'REQUEST_READBACK_VERIFIED'},{status}])) ,1,'mixed '+status);
 }
 assert.equal(ciPublicationExitCode(processed([
  {status:'REQUEST_READBACK_VERIFIED'},{status:'EXISTING_REQUEST_REUSED'}])),0);
 assert.equal(ciPublicationExitCode(processed([])),1);
 assert.equal(ciPublicationExitCode(processed(null)),1);
 assert.equal(ciPublicationExitCode({state:'EVIDENCE_MISSING'}),1);
 assert.equal(ciPublicationExitCode({state:'IGNORED'}),0);
 assert.equal(ciPublicationExitCode({state:'DISABLED'}),0);
 const moduleText=readFileSync(new URL('../ci-approval/completed-run-intake.mjs',import.meta.url),'utf8');
 assert.match(moduleText,/process\.exitCode=ciPublicationExitCode\(result\)/);
});
