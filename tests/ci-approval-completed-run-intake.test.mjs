import {test} from 'node:test';
import {publishExactControllerApprovalPair} from '../ci-approval/approval-pr-publisher.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {observeCompletedRun,observePublishedControllerApprovals,createControllerPublicationPorts,publishExistingControllerApprovals,createAutoApprovalContextReader,ciPublicationExitCode,publishConfiguredControllerApproval,createConfiguredSelectivePreparer,createControllerPrPublicationIo,initialControllerPublicationPolicy} from '../ci-approval/completed-run-intake.mjs';

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

test('submission workflow is activation-gated, source-event driven and pinned to publisher source',()=>{
 const y=readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 const trigger=y.slice(0,y.indexOf('\npermissions:'));
 assert.match(trigger,/push:\s+branches: \[main\]/);
 assert.match(trigger,/workflow_run:\s+workflows: \['ZGMINI Controller Maintenance Source Tests'\]\s+types: \[completed\]/);
 assert.match(trigger,/'controller\/\*\*'/);
 // A merged CI automation source change must not be lost to push path filtering.
 assert.match(trigger,/'ci-approval\/\*\*'/);
 assert.match(trigger,/'approvals\/controller-updates\/\*\.json'/);
 assert.doesNotMatch(trigger,/pull_request:|workflow_dispatch:|schedule:/);
 assert.match(y,/permissions: \{\}/);
 assert.match(y,/vars\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.match(y,/name: submit-controller-b/);
 assert.match(y,/name: Record Controller B request receipt/);
 // Keep the privileged workflow on the last reviewed 4/4-green publisher source.
 // A publisher implementation change requires an explicit new fixed pin.
 assert.match(y,/ref: b1f245922207cac2176cf2f76811818eb8071403\s+persist-credentials: false/);
 assert.match(y,/run: node ci-approval\/completed-run-intake\.mjs --publish-existing/);
 assert.match(y,/cancel-in-progress: false/);
 assert.match(y,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(y,/github\.event\.workflow_run\.head_repository\.id == 1442936296/);
 assert.match(y,/vars\.ZGMINI_CI_CONTROLLER_B_POLICY != ''/);
 assert.match(y,/ZGMINI_CI_CONTROLLER_B_POLICY: \$\{\{ vars\.ZGMINI_CI_CONTROLLER_B_POLICY \}\}/);
 assert.match(y,/contents: write/);
 assert.match(y,/pull-requests: write/);
 assert.doesNotMatch(y,/id-token: write|administration: write|persist-credentials: true/);
});

test('configured source merge becomes eligible on first main push containing it',async()=>{
 const merged='b'.repeat(40),before='a'.repeat(40),after='d'.repeat(40);
 const push={repository:{...repository},ref:'refs/heads/main',deleted:false,
  forced:false,before,after};
 const policy={targetSha:'c'.repeat(40),sourcePrNumber:28,approvalPrNumber:29};
 const source={number:28,merged:true,merge_commit_sha:merged,
  base:{ref:'main',repo:repository},head:{ref:'codex/source',repo:repository,sha:'e'.repeat(40)}};
 const reads=[];
 const getJson=async route=>{
  reads.push(route);
  if(route==='pulls/28')return source;
  if(route==='compare/'+merged+'...'+before)return {status:'diverged',behind_by:1};
  if(route==='compare/'+merged+'...'+after)return {status:'ahead',behind_by:0,
   base_commit:{sha:merged},merge_base_commit:{sha:merged}};
  throw Error('unexpected route: '+route);
 };
 let writes=0;
 const result=await publishConfiguredControllerApproval(push,{policy,getJson,
  runId:123,attempt:1,emitReceipt:()=>assert.fail('no receipt expected'),
  ports:{readAutoApprovalContext:()=>{},readApprovalPrFiles:()=>{},
   mergeApprovalPr:()=>{writes++;throw Error('must not merge')},
   readRepository:async()=>null}});
 assert.equal(result.state,'PUBLICATION_PROCESSED');
 assert.equal(result.results[0].code,'MAINTENANCE_CI_REPOSITORY_DENIED');
 assert.equal(writes,0);
 assert.deepEqual(reads,['pulls/28','compare/'+merged+'...'+before,
  'compare/'+merged+'...'+after]);
});

test('configured auto approval context binds initial grant and exact PR scope',async()=>{
 const v=publicationFixture(),repo=repository.full_name,head='d'.repeat(40);
 const policy={targetSha:v.target,approvalPrNumber:29,sourcePrNumber:28,sourceWorkflowBlobSha:head,
  businessApprovalSha256:'a'.repeat(64),policyRevision:head,sourceBranch:'codex/example-selective',
  delegationPin:{issueNumber:123,commentId:456,bodySha256:'b'.repeat(64)},authorityChangesExcluded:true};
 const manifest={targetSha:v.target,installedSha:'e'.repeat(40),purpose:'pc-controller-maintenance',
  selectiveSource:{branch:policy.sourceBranch},allowFiles:[{path:'controller/example.mjs',sha256:'c'.repeat(64)}]};
 const bytes=Buffer.from(JSON.stringify(manifest)),blob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 const read=createAutoApprovalContextReader({policy,getJson:async route=>{
  if(route==='pulls/29')return {number:29,head:{sha:head,repo:{full_name:repo}},base:{ref:'main',repo:{full_name:repo}}};
  if(route==='contents/'+v.path+'?ref='+head)return {path:v.path,type:'file',encoding:'base64',sha:blob,content:bytes.toString('base64')};
  if(route==='issues/comments/456')return {id:456};
  if(route==='compare/'+manifest.installedSha+'...'+v.target)return {status:'ahead'};
  throw Error('unexpected route');
 },readJobLogs:async()=>''});
 const ctx=await read(v.target,29);
 assert.deepEqual(ctx.delegation.pin,policy.delegationPin);
 assert.equal(ctx.delegation.scope.businessApprovalSha256,policy.businessApprovalSha256);
 assert.equal(ctx.delegation.scope.authorityChangesExcluded,true);
 assert.equal((await ctx.getJson('repos/'+repo+'/issues/comments/456')).id,456);
 assert.equal((await ctx.getJson('repos/'+repo+'/compare/'+manifest.installedSha+'...'+v.target)).status,'ahead');
 assert.throws(()=>ctx.getJson('repos/'+repo+'/../secrets'),/SOURCE_INVALID/);
 await assert.rejects(()=>read(v.target,30),/POLICY_SCOPE_MISMATCH/);
 await assert.rejects(()=>ctx.readFileBytes('other/repo',head,v.path),/SOURCE_INVALID/);
 assert.throws(()=>ctx.getJson('repos/'+repo+'/actions/secrets'),/SOURCE_INVALID/);
 // Candidate bytes never replace the independently supplied policy.
 policy.delegationPin.bodySha256='0'.repeat(64);
 assert.equal((await read(v.target,29)).delegation.pin.bodySha256,'b'.repeat(64));
});
test('missing independent policy does not create an automated approval read port',()=>{
 const ports=createControllerPublicationPorts({getJson:()=>{},postIssue:()=>{},store:{}});
 assert.equal(ports.readAutoApprovalContext,undefined);
 assert.throws(()=>createAutoApprovalContextReader({policy:{},getJson:()=>{},readJobLogs:()=>{}}),/AUTO_POLICY_UNVERIFIED/);
});

test('CI publisher process exit fails on withheld or uncertain effects, not reused original requests',()=>{
 const processed=results=>({state:'PUBLICATION_PROCESSED',results});
 for(const status of ['STATE_UNKNOWN','NOT_SUBMITTED','AUTOMATION_BLOCKED']){
  assert.equal(ciPublicationExitCode(processed([{status}])),1,status);
  assert.equal(ciPublicationExitCode(processed([
   {status:'REQUEST_READBACK_VERIFIED'},{status}])),1,'mixed '+status);
 }
 assert.equal(ciPublicationExitCode(processed([
  {status:'REQUEST_READBACK_VERIFIED'},{status:'EXISTING_REQUEST_REUSED'}])),0);
 assert.equal(ciPublicationExitCode(processed([])),1);
 assert.equal(ciPublicationExitCode(processed(null)),1);
 assert.equal(ciPublicationExitCode({state:'EVIDENCE_MISSING'}),1);
 assert.equal(ciPublicationExitCode({state:'IGNORED'}),0);
 assert.equal(ciPublicationExitCode({state:'DISABLED'}),0);
 assert.equal(ciPublicationExitCode({state:'DISABLED'}, {publish:true}),1);
 assert.equal(ciPublicationExitCode({state:'IGNORED'}, {publish:true}),0);
 for(const state of ['STATE_UNKNOWN','NOT_SUBMITTED','AUTOMATION_BLOCKED','DISABLED','UNEXPECTED'])
  assert.equal(ciPublicationExitCode({state}, {publish:true}),1,state);
 assert.equal(ciPublicationExitCode(undefined,{publish:true}),1);
 const moduleText=readFileSync(new URL('../ci-approval/completed-run-intake.mjs',import.meta.url),'utf8');
 assert.match(moduleText,/process\.exitCode=ciPublicationExitCode\(result,\{publish:process\.argv\[2\]===\'--publish-existing\'\}\)/);
});

test('configured source event rejects unrelated or unmerged source before any write',async()=>{
 const e=event(),policy={targetSha:'c'.repeat(40),approvalPrNumber:29,sourcePrNumber:28};
 const base={number:28,merged:true,merge_commit_sha:'b'.repeat(40),base:{ref:'main',repo:repository},
  head:{repo:repository,sha:'d'.repeat(40)}};
 const opts={policy,runId:123,attempt:1,emitReceipt:()=>assert.fail('receipt'),
  ports:{readRepository:()=>assert.fail('unrelated event reached publisher')}};
 const getJson=async route=>route==='pulls/28'?base:e.workflow_run;
 assert.equal((await publishConfiguredControllerApproval(e,{...opts,getJson})).code,'CONFIGURED_SOURCE_EVENT_NOT_MATCHED');
 assert.equal((await publishConfiguredControllerApproval(e,{...opts,getJson:async()=>({...base,merged:false})})).code,'CONFIGURED_SOURCE_NOT_MERGED');
});
test('staged approval does not construct a PR-number-dependent context before PR allocation',async()=>{
 const staged={installPlan:{targetSha:'a'.repeat(40)},targetSha:'a'.repeat(40),
  sourcePrNumber:28};
 assert.equal(initialControllerPublicationPolicy(staged),null);
 const initial=createControllerPublicationPorts({getJson:async()=>({}),postIssue:()=>{},
  store:{loadReceipt:()=>{},saveReceipt:()=>{}},
  autoApprovalPolicy:initialControllerPublicationPolicy(staged),readJobLogs:async()=>{},
  putMerge:()=>assert.fail('not allowed before PR allocation')});
 assert.equal(initial.readAutoApprovalContext,undefined);
 assert.equal(initial.mergeApprovalPr,undefined);
 const ready={...staged,approvalPrNumber:29,sourceWorkflowBlobSha:'a'.repeat(40),
  businessApprovalSha256:'b'.repeat(64),policyRevision:'c'.repeat(40),
  sourceBranch:'codex/example-selective',
  delegationPin:{issueNumber:1,commentId:2,bodySha256:'d'.repeat(64)}};
 const final=createControllerPublicationPorts({getJson:async()=>({}),postIssue:()=>{},
  store:{loadReceipt:()=>{},saveReceipt:()=>{}},autoApprovalPolicy:ready,
  readJobLogs:async()=>{},putMerge:async()=>({merged:true})});
 assert.equal(typeof final.readAutoApprovalContext,'function');
 assert.equal(typeof final.mergeApprovalPr,'function');
});
test('configured exact merge API receives immutable head CAS',async()=>{
 const calls=[],policy={approvalPrNumber:29,targetSha:'a'.repeat(40),sourcePrNumber:28,
  sourceWorkflowBlobSha:'b'.repeat(40),businessApprovalSha256:'c'.repeat(64),policyRevision:'d'.repeat(40),
  sourceBranch:'codex/example-selective',delegationPin:{issueNumber:1,commentId:2,bodySha256:'e'.repeat(64)}};
 const ports=createControllerPublicationPorts({autoApprovalPolicy:policy,getJson:async()=>[],readJobLogs:async()=>'',store:{},
  putMerge:async(n,body)=>{calls.push([n,body]);return {merged:true}}});
 assert.throws(()=>ports.mergeApprovalPr(30,'f'.repeat(40)),/PR_INVALID/);
 assert.throws(()=>ports.mergeApprovalPr(29,'invalid'),/PR_INVALID/);
 await ports.mergeApprovalPr(29,'f'.repeat(40));
 assert.deepEqual(calls,[[29,{sha:'f'.repeat(40),merge_method:'merge'}]]);
});
test('staged approval reports original uncertain bootstrap code without any repeated write',async()=>{
 const e=event(),policy={targetSha:'c'.repeat(40),sourcePrNumber:28};
 const source={number:28,merged:true,merge_commit_sha:'b'.repeat(40),
  base:{ref:'main',repo:repository},head:{repo:repository,sha:e.workflow_run.head_sha}};
 let stageCount=0,downstream=0;
 const args={policy,runId:123,attempt:1,emitReceipt:()=>assert.fail('receipt'),
  getJson:async route=>route==='pulls/28'?source:e.workflow_run,
  ports:{readRepository:()=>{downstream++;throw Error('unexpected submission')}},
  stageApprovalPr:async()=>{stageCount++;return {state:'STATE_UNKNOWN',
   code:'CI_APPROVAL_PRIOR_BRANCH_WITHOUT_PR'};}};
 const result=await publishConfiguredControllerApproval(e,args);
 assert.equal(result.state,'PUBLICATION_PROCESSED');
 assert.equal(result.results[0].status,'STATE_UNKNOWN');
 assert.equal(result.results[0].code,'CI_APPROVAL_PRIOR_BRANCH_WITHOUT_PR');
 assert.equal(ciPublicationExitCode(result,{publish:true}),1);
 assert.equal(stageCount,1);assert.equal(downstream,0);
});
test('staged approval preserves fixed publisher errors but never leaks arbitrary failures',async()=>{
 const e=event(),policy={targetSha:'c'.repeat(40),sourcePrNumber:28};
 const source={number:28,merged:true,merge_commit_sha:'b'.repeat(40),
  base:{ref:'main',repo:repository},head:{repo:repository,sha:e.workflow_run.head_sha}};
 const args={policy,runId:123,attempt:1,emitReceipt:()=>assert.fail('receipt'),
  getJson:async route=>route==='pulls/28'?source:e.workflow_run,
  ports:{readRepository:()=>assert.fail('must not submit')}};
 for(const [staged,expected] of [
  [async()=>{throw Error('CI_APPROVAL_DIFF_DENIED')},'CI_APPROVAL_DIFF_DENIED'],
  [async()=>({state:'STATE_UNKNOWN',code:'UNTRUSTED_INJECTED'}),'CI_APPROVAL_PR_PUBLICATION_UNVERIFIED'],
  [async()=>{throw Error('raw secret value')},'CI_PUBLICATION_ADAPTER_FAILED']
 ]){
  const result=await publishConfiguredControllerApproval(e,{...args,stageApprovalPr:staged});
  assert.equal(result.results[0].status,'STATE_UNKNOWN');
  assert.equal(result.results[0].code,expected);
  assert.equal(ciPublicationExitCode(result,{publish:true}),1);
 }
});

test('matched source event enters existing merge and submit path, not generic push intake',async()=>{
 const e=event(),policy={targetSha:'c'.repeat(40),approvalPrNumber:29,sourcePrNumber:28};
 const source={number:28,merged:true,merge_commit_sha:'b'.repeat(40),base:{ref:'main',repo:repository},
  head:{repo:repository,sha:e.workflow_run.head_sha}};
 const reads=[];
 const result=await publishConfiguredControllerApproval(e,{policy,runId:123,attempt:1,
  getJson:async route=>route==='pulls/28'?source:e.workflow_run,
  ports:{readAutoApprovalContext:()=>{},readApprovalPrFiles:()=>{},mergeApprovalPr:()=>assert.fail('merge'),
   readRepository:async()=>{reads.push('repo');return null;}},emitReceipt:()=>assert.fail('receipt')});
 assert.deepEqual(reads,['repo']);
 assert.equal(result.results[0].code,'MAINTENANCE_CI_REPOSITORY_DENIED');
 assert.equal(ciPublicationExitCode(result,{publish:true}),1);
});

function exactPrPublisherFixture(){
 const main='a'.repeat(40),target='b'.repeat(40),
  paths=['approvals/controller-updates/'+target+'.json',
   'approvals/controller-selective-targets/'+target+'.json'];
 const branch='codex/ci-controller-b-'+target,events=[],state={
  branchSha:null,pr:null,seed:null,final:false,created:0,updates:0,commits:new Map(),trees:new Map()};
 let next=3;
 const head=()=>String(next++).padStart(40,'c');
 const prepare=async number=>{
  const approval='https://github.com/'+repository.full_name+'/pull/'+number;
  const files=[
   {path:paths[0],bytes:Buffer.from(JSON.stringify({schema:'manifest',targetSha:target,approval:{ref:approval}}))},
   {path:paths[1],bytes:Buffer.from(JSON.stringify({schema:'pin',targetSha:target,approvalRef:approval}))}
  ];
  return {state:'SELECTIVE_APPROVAL_FILES_PREPARED',canPublish:false,canExecute:false,
   targetSha:target,sourcePrNumber:15,approvalPrNumber:number,
   files:files.map(f=>({...f,sha256:createHash('sha256').update(f.bytes).digest('hex')}))};
 };
 const io={
  readRepository:async()=>({id:1442936296,full_name:repository.full_name,private:true,
   owner:{login:'ansqhd5774-Choi'}}),
  readMain:async()=>({commit:{sha:main}}),
  readCommit:async sha=>sha===main?{sha,tree:{sha:'d'.repeat(40)}}:
   {sha,tree:{sha:state.commits.get(sha)?.tree??'e'.repeat(40)}},
  readBranch:async name=>state.branchSha?{
   ref:'refs/heads/'+name,object:{type:'commit',sha:state.branchSha}}:null,
  readPrs:async()=>state.pr?[state.pr]:[],
  readPr:async number=>({...state.pr,head:{...state.pr.head,sha:state.branchSha}}),
  readPrFiles:async()=>state.final?paths.map(filename=>({filename,status:'added'})):
   [{filename:paths[0],status:'added'}],
  readBytes:async(ref,path)=>{
   if(ref!==state.branchSha)return null;
   if(state.final)return (await prepare(state.pr.number)).files.find(f=>f.path===path)?.bytes??null;
   if(path===paths[0])return state.seed;
   return null;
  },
  createTree:async args=>{
   events.push('tree');const sha=head();state.trees.set(sha,args.tree);
   if(args.tree.length===1)state.seed=Buffer.from(args.tree[0].content);
   return {sha};
  },
  createCommit:async args=>{
   events.push('commit');const sha=head();state.commits.set(sha,args);
   return {sha};
  },
  createBranch:async args=>{events.push('branch');state.branchSha=args.sha;},
  createPr:async args=>{
   events.push('pr');state.created++;
   state.pr={number:42,state:'open',merged:false,draft:false,
    head:{ref:branch,repo:{full_name:repository.full_name},sha:state.branchSha},
    base:{ref:'main',repo:{full_name:repository.full_name}}};
  },
  updateBranch:async(name,args)=>{events.push('update');state.updates++;
   state.branchSha=args.sha;state.final=true;}
 };
 return {state,events,io,prepare,target,main,paths};
}
test('two-stage exact approval publisher creates one PR and only two final files',async()=>{
 const f=exactPrPublisherFixture();
 const input={targetSha:f.target,sourcePrNumber:15,sourceMainSha:f.main,
  prepare:f.prepare,io:f.io};
 const first=await publishExactControllerApprovalPair(input);
 assert.equal(first.state,'EXACT_APPROVAL_PR_READY');
 assert.equal(first.prNumber,42);assert.equal(f.state.created,1);
 assert.equal(f.state.updates,1);
 assert.deepEqual(f.events,['tree','commit','branch','pr','tree','commit','update']);
 const second=await publishExactControllerApprovalPair(input);
 assert.equal(second.state,'EXACT_APPROVAL_PR_READY');
 assert.equal(second.existing,true);assert.equal(f.state.created,1);
 assert.equal(f.state.updates,1);
});
test('merged original exact approval PR is reused read-only by a later event',async()=>{
 const f=exactPrPublisherFixture(),args={targetSha:f.target,sourcePrNumber:15,
  sourceMainSha:f.main,prepare:f.prepare,io:f.io};
 const initial=await publishExactControllerApprovalPair(args);
 assert.equal(initial.state,'EXACT_APPROVAL_PR_READY');
 const before=f.events.length;
 f.state.pr.state='closed';f.state.pr.merged=true;
 f.state.pr.merge_commit_sha='f'.repeat(40);
 const observed=await publishExactControllerApprovalPair(args);
 assert.equal(observed.state,'EXACT_APPROVAL_PR_READY');
 assert.equal(observed.prNumber,42);assert.equal(observed.existing,true);
 assert.equal(f.events.length,before);assert.equal(f.state.created,1);
});
test('previous PR with deleted branch never triggers another seed or PR POST',async()=>{
 const f=exactPrPublisherFixture(),args={targetSha:f.target,sourcePrNumber:15,
  sourceMainSha:f.main,prepare:f.prepare,io:f.io};
 await publishExactControllerApprovalPair(args);
 f.state.pr.state='closed';f.state.pr.merged=true;
 f.state.pr.merge_commit_sha='f'.repeat(40);
 f.state.branchSha=null;
 const before=f.events.length;
 const observed=await publishExactControllerApprovalPair(args);
 assert.equal(observed.state,'STATE_UNKNOWN');
 assert.equal(observed.code,'CI_APPROVAL_PRIOR_PR_WITHOUT_BRANCH_NO_REPOST');
 assert.equal(observed.prNumber,42);
 assert.equal(f.events.length,before);assert.equal(f.state.created,1);
});
test('closed unmerged approval PR is not treated as approved or rewritten',async()=>{
 const f=exactPrPublisherFixture(),args={targetSha:f.target,sourcePrNumber:15,
  sourceMainSha:f.main,prepare:f.prepare,io:f.io};
 await publishExactControllerApprovalPair(args);
 f.state.pr.state='closed';f.state.pr.merged=false;
 const before=f.events.length;
 await assert.rejects(()=>publishExactControllerApprovalPair(args),/CI_APPROVAL_PR_IDENTITY_DENIED/);
 assert.equal(f.events.length,before);
});
test('publisher never writes a branch when independent approval preparation fails',async()=>{
 const f=exactPrPublisherFixture();
 await assert.rejects(()=>publishExactControllerApprovalPair({
  targetSha:f.target,sourceMainSha:f.main,sourcePrNumber:15,
  prepare:async()=>({state:'EVIDENCE_MISSING'}),io:f.io
 }),/CI_APPROVAL_PREPARATION_DENIED/);
 assert.deepEqual(f.events,[]);
});
test('uncertain previous seeded branch without PR is not silently retried',async()=>{
 const f=exactPrPublisherFixture(),args={targetSha:f.target,sourceMainSha:f.main,
  sourcePrNumber:15,prepare:f.prepare,io:f.io};
 f.io.createPr=async()=>{throw Error('API lost response')};
 await assert.rejects(()=>publishExactControllerApprovalPair(args),/API lost response/);
 const count=f.events.length;
 const result=await publishExactControllerApprovalPair(args);
 assert.equal(result.code,'CI_APPROVAL_PRIOR_BRANCH_WITHOUT_PR');
 assert.equal(f.events.length,count);
});
test('publisher rejects a PR that brings an unrelated file into the final diff',async()=>{
 const f=exactPrPublisherFixture(),orig=f.io.readPrFiles;
 f.io.readPrFiles=async()=>[{filename:f.paths[0],status:'added'},
  {filename:'tools/maintenance-agent.mjs',status:'modified'}];
 const args={targetSha:f.target,sourceMainSha:f.main,sourcePrNumber:15,
  prepare:f.prepare,io:f.io};
 await assert.rejects(()=>publishExactControllerApprovalPair(args),/CI_APPROVAL_DIFF_DENIED/);
 assert.equal(f.state.updates,0);
});

test('configured publication policy requires independently pinned effect scope before PR writes',()=>{
 const target='f'.repeat(40),policy={targetSha:target,sourceMainSha:'e'.repeat(40),
  sourcePrNumber:42,sourceWorkflowBlobSha:'d'.repeat(40),policyRevision:'c'.repeat(40),
  businessApprovalSha256:'a'.repeat(64),sourceBranch:'codex/example-selective',
  delegationPin:{issueNumber:1,commentId:2,bodySha256:'b'.repeat(64)},
  installPlan:{installedSha:'a'.repeat(40),targetSha:target,purpose:'pc-controller-maintenance',
   postOperation:'core-status',allowFiles:[{path:'controller/entry.mjs',sha256:'c'.repeat(64)}]}};
 const x=createConfiguredSelectivePreparer({policy,getJson:async()=>{},readJobLogs:async()=>''});
 assert.equal(x.branch,'codex/ci-controller-b-'+target);
 assert.equal(x.plan.targetSha,target);
 assert.throws(()=>createConfiguredSelectivePreparer({policy:{...policy,installPlan:{
  ...policy.installPlan,targetSha:'b'.repeat(40)}},getJson:async()=>{},readJobLogs:async()=>''}),/STAGING_POLICY_INVALID/);
 assert.throws(()=>createConfiguredSelectivePreparer({policy:{...policy,businessApprovalSha256:''},
  getJson:async()=>{},readJobLogs:async()=>''}),/STAGING_POLICY_INVALID/);
});
test('fixed GitHub approval PR ports cannot write other branches or arbitrary files',async()=>{
 const target='f'.repeat(40),calls=[],github=async(route,body,method)=>{
  calls.push([route,body,method]);return {sha:'a'.repeat(40)};
 };
 const io=createControllerPrPublicationIo({targetSha:target,getJson:async()=>{},github});
 assert.throws(()=>io.createTree({tree:[{path:'tools/update.mjs',mode:'100644',type:'blob',content:'x'}]}),/TREE_DENIED/);
 assert.throws(()=>io.createBranch({ref:'refs/heads/main',sha:'a'.repeat(40)}),/BRANCH_DENIED/);
 assert.throws(()=>io.createPr({head:'main',base:'main',draft:false}),/INPUT_DENIED/);
 assert.throws(()=>io.updateBranch('main',{sha:'a'.repeat(40),force:false}),/BRANCH_DENIED/);
 assert.equal(calls.length,0);
});

test('GitHub ref reader GET and branch writer PATCH use their distinct REST endpoints',async()=>{
 const target='a'.repeat(40),branch='codex/ci-controller-b-'+target;
 const suffix=encodeURIComponent(branch),gets=[],writes=[];
 const io=createControllerPrPublicationIo({targetSha:target,
  getJson:async route=>{gets.push(route);return {ref:'refs/heads/'+branch,
   object:{type:'commit',sha:'b'.repeat(40)}};},
  github:async(route,body,method)=>{writes.push({route,body,method});return {object:{sha:body.sha}};}});
 const read=await io.readBranch(branch);
 assert.equal(read.object.sha,'b'.repeat(40));
 await io.updateBranch(branch,{sha:'c'.repeat(40),force:false});
 assert.deepEqual(gets,['git/ref/heads/'+suffix]);
 assert.deepEqual(writes,[{route:'git/refs/heads/'+suffix,
  body:{sha:'c'.repeat(40),force:false},method:'PATCH'}]);
});

test('publisher rejects a preparer result bound to wrong approval PR without committing final pair',async()=>{
 const f=exactPrPublisherFixture(),normal=f.prepare;
 const prepared=async n=>n===2147483647?normal(n):{...(await normal(n)),approvalPrNumber:n+1};
 await assert.rejects(()=>publishExactControllerApprovalPair({
  targetSha:f.target,sourcePrNumber:15,sourceMainSha:f.main,prepare:prepared,io:f.io
 }),/CI_APPROVAL_PREPARATION_DENIED/);
 assert.equal(f.state.created,1);
 assert.equal(f.state.updates,0);
 assert.equal(f.events.filter(x=>x==='tree').length,1);
});
test('publisher rejects incorrect original source identity and altered output bytes before the first write',async()=>{
 const f=exactPrPublisherFixture(),base=f.prepare;
 for(const prepare of [
  async n=>({...await base(n),sourcePrNumber:16}),
  async n=>{const x=await base(n);x.files[1].bytes=Buffer.from('{}');return x;},
  async n=>{const x=await base(n);x.canPublish=true;return x;}
 ]){
  await assert.rejects(()=>publishExactControllerApprovalPair({
   targetSha:f.target,sourcePrNumber:15,sourceMainSha:f.main,prepare,io:f.io
  }),/CI_APPROVAL_PREPARATION_DENIED/);
  assert.deepEqual(f.events,[]);
 }
});
