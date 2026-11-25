import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {manifestFingerprint,CONTROLLER_POST_OPERATIONS} from '../tools/maintenance-contract.mjs';
import {reviewControllerCandidate as review} from '../ci-approval/controller-candidate-review.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control',root='repos/'+repo;
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const targetSha='a'.repeat(40),baseSha='b'.repeat(40),tested='c'.repeat(40),blob='d'.repeat(40),bytes=Buffer.from('export const value=1;');
 const path='controller/example.mjs',allowFiles=[{path,sha256:hash(bytes)}];
 const plan={installedSha:baseSha,targetSha,allowFiles,purpose:'pc-controller-maintenance',postOperation:CONTROLLER_POST_OPERATIONS[0],postSourceBranch:'main',postSourceSha:'e'.repeat(40)};
 const g={schema:'ZGMINI_CI_STANDING_DELEGATION_V1',effect:'B_CONTROLLER_INSTALL',businessApprovalSha256:'a'.repeat(64),policyRevision:'b'.repeat(40),sourceRepository:repo,sourceBranch:'codex/example',purpose:plan.purpose,allowedPaths:[path],notBefore:'2026-11-25T00:00:00Z',notAfter:'2026-11-26T00:00:00Z'};
 const url='https://api.github.com/'+root+'/issues/123',body=JSON.stringify(g),scope={...Object.fromEntries(['effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose'].map(k=>[k,g[k]])),changedPaths:[path],targetSha,scopeDigest:manifestFingerprint(allowFiles).sha256,authorityChangesExcluded:true};
 const delegation={pin:{issueNumber:123,commentId:456,bodySha256:hash(body)},scope,baseSha,now:'2026-11-25T01:00:00Z'};
 const responses={
 [root]:{id:1442936296,full_name:repo,private:true,owner:{id:327938088,login:'ansqhd5774-Choi'}},
 [root+'/issues/123']:{number:123,url,state:'open'},
 [root+'/issues/comments/456']:{id:456,issue_url:url,user:{id:327938088,login:'ansqhd5774-Choi',type:'User'},author_association:'OWNER',performed_via_github_app:null,created_at:g.notBefore,updated_at:g.notBefore,body},
 [root+'/branches/codex%2Fexample']:{name:g.sourceBranch,commit:{sha:targetSha}},
 [root+'/compare/'+baseSha+'...'+targetSha]:{status:'ahead',behind_by:0,ahead_by:1,total_commits:1,base_commit:{sha:baseSha},merge_base_commit:{sha:baseSha},commits:[{sha:targetSha}],files:[{filename:path,status:'modified',sha:'f'.repeat(40)}]}};
 const expected={runId:10,jobId:20,attempt:1,headSha:targetSha,baseSha,workflowBlobSha:blob};
 const ci={expected,run:{id:10,run_attempt:1,head_sha:targetSha,path:'.github/workflows/controller-maintenance-source-tests.yml',event:'pull_request',repository:{full_name:repo},status:'completed',conclusion:'success'},job:{id:20,run_id:10,run_attempt:1,head_sha:targetSha,name:'source-only',status:'completed',conclusion:'success',steps:['Confirm source-only isolated CI host','Check CI scope selection regressions'].map(name=>({name,status:'completed',conclusion:'success'}))},logs:'2026-11-25T00:00:00Z [command]git checkout --progress --force '+tested+'\n2026-11-25T00:00:01Z CI_TESTED_INTEGRATION_SHA='+tested+'\n',commit:{sha:tested,tree:{sha:'f'.repeat(40)},parents:[{sha:baseSha},{sha:targetSha}]},workflowBlobSha:blob};
 const live={requestState:'NEW',resourceState:'READY',installedSha:baseSha,rollbackVerified:true,postcheckBound:true};
 return {plan,delegation,ci,live,getJson:async route=>structuredClone(responses[route]),readFileBytes:async()=>Buffer.from(bytes)};
}
const cases=[
 ['complete shadow flow',()=>{},'CANDIDATE_REVIEW_MATCH_ONLY'],
 ['consumed request',v=>{v.live.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['live drift',v=>{v.live.installedSha='f'.repeat(40)},'EVIDENCE_MISSING'],
 ['unverified rollback',v=>{v.live.rollbackVerified=false},'EVIDENCE_MISSING'],
 ['manifest digest mismatch',v=>{v.delegation.scope.scopeDigest='0'.repeat(64)},'REJECTED'],
 ['failed CI',v=>{v.ci.run.conclusion='failure'},'REJECTED'],
 ['source bytes mismatch',v=>{v.readFileBytes=async()=>Buffer.from('changed')},'REJECTED'],
 ['integration bytes mismatch',v=>{const original=v.readFileBytes;v.readFileBytes=async(r,s,p)=>s===v.ci.commit.sha?Buffer.from('changed'):original(r,s,p)},'REJECTED'],
 ['missing file evidence',v=>{v.readFileBytes=async()=>null},'EVIDENCE_MISSING'],
 ['missing delegation',v=>{v.delegation.pin=null},'INVALID']
];
for(const [name,edit,state] of cases)test(name,async()=>{const v=fixture();edit(v);const r=await review(v);assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);if(state==='CANDIDATE_REVIEW_MATCH_ONLY')assert.equal(r.candidate.status,'PROPOSED_NOT_APPROVED');else assert.equal(Object.hasOwn(r,'candidate'),false);});

test('source review does not require a live operating PC snapshot',async()=>{
 const v=fixture();delete v.live;
 const r=await review(v);
 assert.equal(r.state,'SOURCE_REVIEW_MATCH_ONLY');
 assert.equal(r.reason,'LIVE_CHECKS_DEFERRED_TO_EXECUTION');
 assert.equal(r.candidate.status,'PROPOSED_NOT_APPROVED');
 assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
});
test('source-only review still rejects failed CI',async()=>{
 const v=fixture();delete v.live;v.ci.run.conclusion='failure';
 const r=await review(v);assert.equal(r.state,'REJECTED');assert.equal(r.canExecute,false);
});
test('invalid provided live snapshot cannot become source-only',async()=>{
 const v=fixture();v.live=null;
 const r=await review(v);assert.equal(r.state,'EVIDENCE_MISSING');assert.equal(r.canExecute,false);
});
