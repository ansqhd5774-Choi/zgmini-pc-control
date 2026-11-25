import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildWriterCandidate} from '../ci-approval/contract-adapter.mjs';
import {reviewWriterCandidate as review,inspectWriterPushCI as inspect} from '../ci-approval/writer-candidate-review.mjs';
const repo='ansqhd5774-Choi/zgmini',control=repo+'-pc-control',root='repos/'+control;
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const {status,coreMaintenance,...plan}=JSON.parse(readFileSync(new URL('../approvals/writer-updates/w05-r304-maintenance-window-20261119.json',import.meta.url),'utf8'));
 void status;void coreMaintenance;
 const bytes=Buffer.from('export const testValue=1;'),remoteBase='b'.repeat(40),targetSha=plan.candidateSourceSha,blob='c'.repeat(40);
 plan.files=[{...plan.files[0],afterSha256:hash(bytes)}];
 const path=plan.files[0].path;
 const g={schema:'ZGMINI_CI_STANDING_DELEGATION_V1',effect:'B_WRITER_SOURCE',businessApprovalSha256:'a'.repeat(64),policyRevision:'b'.repeat(40),sourceRepository:repo,sourceBranch:plan.sourceBranch,purpose:plan.scope,allowedPaths:[path],notBefore:'2026-11-25T00:00:00Z',notAfter:'2026-11-26T00:00:00Z'};
 const body=JSON.stringify(g),url='https://api.github.com/'+root+'/issues/123',scope={...Object.fromEntries(['effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose'].map(k=>[k,g[k]])),changedPaths:[path],targetSha,scopeDigest:buildWriterCandidate(plan).candidate.planSha256,authorityChangesExcluded:true};
 const delegation={pin:{issueNumber:123,commentId:456,bodySha256:hash(body)},scope,baseSha:remoteBase,now:'2026-11-25T01:00:00Z'};
 const responses={
 [root]:{id:1442936296,full_name:control,private:true,owner:{id:327938088,login:'ansqhd5774-Choi'}},
 [root+'/issues/123']:{number:123,url,state:'open'},
 [root+'/issues/comments/456']:{id:456,issue_url:url,user:{id:327938088,login:'ansqhd5774-Choi',type:'User'},author_association:'OWNER',performed_via_github_app:null,created_at:g.notBefore,updated_at:g.notBefore,body},
 ['repos/'+repo+'/branches/'+encodeURIComponent(g.sourceBranch)]:{name:g.sourceBranch,commit:{sha:targetSha}},
 ['repos/'+repo+'/compare/'+remoteBase+'...'+targetSha]:{status:'ahead',behind_by:0,ahead_by:1,total_commits:1,base_commit:{sha:remoteBase},merge_base_commit:{sha:remoteBase},commits:[{sha:targetSha}],files:[{filename:path,status:'added',sha:'f'.repeat(40)}]}};
 const ci={expected:{runId:10,jobId:20,attempt:1,targetSha,workflowBlobSha:blob,branch:plan.sourceBranch},run:{id:10,run_attempt:1,workflow_id:377770281,path:'.github/workflows/node.js.yml',event:'push',head_branch:plan.sourceBranch,head_sha:targetSha,repository:{id:1398455648,full_name:repo},status:'completed',conclusion:'success'},job:{id:20,run_id:10,run_attempt:1,head_sha:targetSha,name:'check',status:'completed',conclusion:'success',steps:['Run actions/checkout@v4','Install locked dependencies','Build','Type check','Regression tests','PC publication recovery tests','Lint changed source (ESLint)','Audit production dependency vulnerabilities (high or critical)'].map(name=>({name,status:'completed',conclusion:'success'}))},logs:'2026-11-25T00:00:00Z [command]/usr/bin/git log -1 --format=%H\n2026-11-25T00:00:01Z '+targetSha+'\n',workflowBlobSha:blob};
 const live={requestState:'NEW',resourceState:'READY',observedHead:plan.baseHead,observedConfigSha:plan.baseConfigSourceSha,rollbackVerified:true,runtimeDependenciesVerified:true,files:[{path,sha256:null,exists:false}]};
 return {plan,delegation,ci,live,getJson:async route=>structuredClone(responses[route]),readFileBytes:async()=>Buffer.from(bytes)};
}
const match='WRITER_CANDIDATE_REVIEW_MATCH_ONLY';
const cases=[
 ['local and remote ancestry remain distinct',()=>{},match],
 ['local config drift',v=>{v.live.observedConfigSha='f'.repeat(40)},'EVIDENCE_MISSING'],
 ['local file unexpectedly exists',v=>{v.live.files[0].exists=true},'REJECTED'],
 ['missing runtime dependency review',v=>{v.live.runtimeDependenciesVerified=false},'EVIDENCE_MISSING'],
 ['consumed request',v=>{v.live.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['wrong repository CI',v=>{v.ci.run.repository.id=1},'REJECTED'],
 ['skipped required CI step',v=>{v.ci.job.steps[5].conclusion='skipped'},'REJECTED'],
 ['wrong checked-out source',v=>{v.ci.logs=v.ci.logs.replace(v.plan.candidateSourceSha,'f'.repeat(40))},'REJECTED'],
 ['wrong workflow pin',v=>{v.ci.workflowBlobSha='f'.repeat(40)},'REJECTED'],
 ['wrong source file bytes',v=>{v.readFileBytes=async()=>Buffer.from('wrong')},'REJECTED'],
 ['extended maintenance stays on existing route',v=>{v.plan.coreMaintenance='PAUSE_NEW_STARTS_DRAIN_360S_V1'},'OUT_OF_SCOPE']
];
for(const [name,edit,state] of cases)test(name,async()=>{const v=fixture();edit(v);const r=await review(v);assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);if(state===match){assert.notEqual(r.localBaseSha,r.remoteBaseSha);assert.equal(r.candidate.status,'PROPOSED_NOT_APPROVED');}});
test('missing CI logs cannot pass',()=>{const {ci}=fixture();ci.logs='';assert.equal(inspect(ci).state,'EVIDENCE_MISSING');});
