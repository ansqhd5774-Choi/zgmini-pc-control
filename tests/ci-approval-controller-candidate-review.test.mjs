import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {manifestFingerprint,CONTROLLER_POST_OPERATIONS,prepareControllerUpdateRequest,validateControllerSelectivePin} from '../tools/maintenance-contract.mjs';
import {reviewControllerCandidate as review,prepareSelectiveApprovalPublication} from '../ci-approval/controller-candidate-review.mjs';
import {submitExistingControllerApprovalFromCi,mergeAndSubmitPreparedControllerApproval} from '../tools/maintenance-request.mjs';
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

function publicationFixture(){
 const v=fixture(),p=v.plan,sourceHead='1'.repeat(40),sourceMainSha='2'.repeat(40),merged='3'.repeat(40);
 p.postOperation='core-status';
 const original=v.getJson,workflow=Buffer.from('reviewed source workflow fixture');
 const workflowBlobSha=createHash('sha1').update(Buffer.from('blob '+workflow.length+'\0')).update(workflow).digest('hex');
 const repoData={full_name:repo,id:1442936296,private:true};
 const pr={number:28,merged:true,merge_commit_sha:merged,head:{sha:sourceHead,repo:repoData},base:{ref:'main',repo:repoData}};
 const run={...v.ci.run,head_sha:sourceHead,workflow_id:416355595,repository:repoData,head_repository:repoData};
 const job={...v.ci.job,head_sha:sourceHead};
 const tested={...v.ci.commit,parents:[{sha:p.installedSha},{sha:sourceHead}]};
 const ancestor=(a,b)=>({status:a===b?'identical':'ahead',behind_by:0,base_commit:{sha:a},merge_base_commit:{sha:a}});
 const inputs={plan:p,delegation:v.delegation,sourcePrNumber:28,approvalPrNumber:29,sourceMainSha,
  policy:{sourceWorkflowBlobSha:workflowBlobSha,delegationPin:v.delegation.pin,
   businessApprovalSha256:v.delegation.scope.businessApprovalSha256},
  getJson:async route=>{
   if(route===root+'/git/commits/'+p.targetSha)return {sha:p.targetSha,parents:[{sha:p.installedSha}]};
   if(route===root+'/pulls/28')return pr;
   if(route===root+'/actions/workflows/416355595/runs?head_sha='+sourceHead+'&event=pull_request&status=success&per_page=100')return {workflow_runs:[run]};
   if(route===root+'/actions/runs/'+run.id)return run;
   if(route===root+'/compare/'+merged+'...'+sourceMainSha)return ancestor(merged,sourceMainSha);
   if(route===root+'/branches/main')return {commit:{sha:sourceMainSha}};
   if(route===root+'/compare/'+sourceMainSha+'...'+sourceMainSha)return ancestor(sourceMainSha,sourceMainSha);
   if(route===root+'/actions/runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs?per_page=100')return {total_count:1,jobs:[job]};
   if(route===root+'/git/commits/'+tested.sha)return tested;
   return original(route);
  },
  readJobLogs:async()=>v.ci.logs,
  readFileBytes:async(r,s,path)=>path.startsWith('.github/')?workflow:Buffer.from('export const value=1;')
 };
 return {inputs,v,sourceHead,sourceMainSha,run,pr,job,tested};
}
test('materializes exact existing manifest and selective pin from different source and overlay commits',async()=>{
 const f=publicationFixture(),r=await prepareSelectiveApprovalPublication(f.inputs);
 assert.equal(r.state,'SELECTIVE_APPROVAL_FILES_PREPARED',r.reason);
 assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 assert.notEqual(r.testedSha,r.targetSha);assert.equal(r.sourcePrNumber,28);assert.equal(r.approvalPrNumber,29);
 const [m,p]=r.files,manifest=JSON.parse(m.bytes),pin=JSON.parse(p.bytes);
 assert.equal(manifest.approval.ref,'https://github.com/'+repo+'/pull/29');
 assert.equal(manifest.selectiveSource.mainSha,f.sourceMainSha);
 assert.equal(m.sha256,hash(m.bytes));assert.equal(p.sha256,hash(p.bytes));
 assert.equal(prepareControllerUpdateRequest(m.bytes,{installedSha:f.v.plan.installedSha}).targetControllerSha,f.v.plan.targetSha);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
});
for(const [name,edit,state] of [
 ['missing independently installed policy',f=>{delete f.inputs.policy},'EVIDENCE_MISSING'],
 ['unrelated business scope',f=>{f.inputs.policy.businessApprovalSha256='0'.repeat(64)},'REJECTED'],
 ['same PR used for both roles',f=>{f.inputs.approvalPrNumber=28},'EVIDENCE_MISSING'],
 ['different tested file',f=>{const read=f.inputs.readFileBytes;f.inputs.readFileBytes=async(r,s,p)=>s===f.tested.sha&&!p.startsWith('.github/')?Buffer.from('changed'):read(r,s,p)},'REJECTED'],
 ['untrusted CI workflow bytes',f=>{f.inputs.policy.sourceWorkflowBlobSha='0'.repeat(40)},'REJECTED'],
 ['non-merged source PR',f=>{f.pr.merged=false},'EVIDENCE_MISSING']
])test('selective publication rejects '+name,async()=>{
 const f=publicationFixture();edit(f);const r=await prepareSelectiveApprovalPublication(f.inputs);
 assert.equal(r.state,state,r.reason);assert.equal(r.files,undefined);assert.equal(r.canExecute,false);
});

async function automaticSubmissionFixture(){
 const f=publicationFixture(),ctx=f.inputs;
 // Replace the historical fixture grant with a current simulated direct-owner
 // grant. Keep its original pin, exact scope and authenticated-read structure.
 const route=root+'/issues/comments/'+ctx.delegation.pin.commentId,read=ctx.getJson;
 const comment=await read(route),now=Date.now();
 const start=new Date(now-60000).toISOString().replace(/\.\d{3}Z$/,'Z');
 const end=new Date(now+3600000).toISOString().replace(/\.\d{3}Z$/,'Z');
 const grant=JSON.parse(comment.body);grant.notBefore=start;grant.notAfter=end;
 comment.body=JSON.stringify(grant);comment.created_at=start;comment.updated_at=start;
 ctx.delegation.pin.bodySha256=hash(comment.body);ctx.delegation.now=new Date(now).toISOString().replace(/\.\d{3}Z$/,'Z');
 ctx.policy.sourcePrNumber=28;
 ctx.getJson=async p=>p===route?structuredClone(comment):read(p);
 const prepared=await prepareSelectiveApprovalPublication(ctx);
 assert.equal(prepared.state,'SELECTIVE_APPROVAL_FILES_PREPARED',prepared.reason);
 const [m,pin]=prepared.files,approvalHead='4'.repeat(40),approvalMerge='5'.repeat(40);
 const owner={login:'ansqhd5774-Choi',id:327938088,type:'User'};
 const bot={login:'github-actions[bot]',id:41898282,type:'Bot'};
 const pr={...f.pr,number:29,merged_by:bot,merge_commit_sha:approvalMerge,head:{...f.pr.head,sha:approvalHead}};
 const run={...f.run,id:999,head_sha:approvalHead};
 const store={receipt:null,posts:0,actual:null};
 const readFile=ctx.readFileBytes;
 ctx.readFileBytes=async(r,revision,path)=>path===pin.path?Buffer.from(pin.bytes):readFile(r,revision,path);
 const ports={readRepository:async()=>({id:1442936296,private:true,full_name:repo,owner}),
  readManifest:async()=>m.bytes,readMergedManifest:async()=>m.bytes,readApprovalPr:async()=>pr,
  listRuns:async()=>({workflow_runs:[run]}),readRun:async()=>run,
  readAutoApprovalContext:async()=>ctx,
  readApprovalPrFiles:async()=>[m,pin].map(x=>({filename:x.path,status:'added'})),
  loadReceipt:async()=>store.receipt,
  saveReceipt:async(key,value)=>{store.receipt=structuredClone(value)},findPriorRequests:async()=>[],
  createIssue:async e=>{store.posts++;store.actual={number:42,state:'open',user:bot,title:e.title,body:e.body,labels:e.labels.map(name=>({name}))};return {number:42}},
  readIssue:async()=>store.actual};
 return {ctx,m,pin,ports,store,input:{targetSha:f.v.plan.targetSha,approvalSha256:m.sha256,runId:1000,attempt:1}};
}
test('auto-published exact pair reuses initial approval and submits without a second owner merge',async()=>{
 const f=await automaticSubmissionFixture(),r=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(r.status,'REQUEST_READBACK_VERIFIED');assert.equal(f.store.posts,1);
});
test('bot merge without independently configured original approval cannot submit',async()=>{
 const f=await automaticSubmissionFixture();delete f.ports.readAutoApprovalContext;
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(f.input,f.ports),/AUTO_APPROVAL_CONTEXT_REQUIRED/);
 assert.equal(f.store.posts,0);
});
test('auto publication with different main selective pin cannot submit',async()=>{
 const f=await automaticSubmissionFixture(),read=f.ctx.readFileBytes;
 f.ctx.readFileBytes=async(r,s,p)=>s==='main'&&p===f.pin.path?Buffer.from('{}'):read(r,s,p);
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(f.input,f.ports),/AUTO_APPROVAL_PIN_MISMATCH/);
 assert.equal(f.store.posts,0);
});

async function mergeSubmissionFixture(){
 const f=await automaticSubmissionFixture(),merged=await f.ports.readApprovalPr(29);
 const open={...merged,state:'open',merged:false,draft:false,merged_by:null,merge_commit_sha:null};
 let current=open;f.merges=0;
 f.ports.readApprovalPr=async()=>current;
 f.ports.readApprovalPrFiles=async()=>[f.m,f.pin].map(x=>({filename:x.path,status:'added'}));
 const read=f.ctx.readFileBytes;
 f.ctx.readFileBytes=async(r,s,p)=>p===f.m.path?Buffer.from(f.m.bytes):read(r,s,p);
 f.ports.mergeApprovalPr=async(n,head)=>{
  assert.equal(n,29);assert.equal(head,open.head.sha);f.merges++;current=merged;
 };
 f.mergeInput={targetSha:f.input.targetSha,approvalPrNumber:29,runId:1000,attempt:1};
 return f;
}
test('one CI flow merges exact tested approval PR and immediately submits without push event',async()=>{
 const f=await mergeSubmissionFixture(),r=await mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports);
 assert.equal(r.status,'REQUEST_READBACK_VERIFIED');assert.equal(f.merges,1);assert.equal(f.store.posts,1);
 assert.match(r.receiptMarker,/^ZGMINI_CI_CONTROLLER_B_RECEIPT=42:/);
 const second=await mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports);
 assert.equal(second.code,'MAINTENANCE_CI_EXISTING_RECEIPT_NO_REPOST');assert.equal(f.merges,1);assert.equal(f.store.posts,1);
});
test('unrelated PR file stops merge and submission',async()=>{
 const f=await mergeSubmissionFixture();
 f.ports.readApprovalPrFiles=async()=>[{filename:f.m.path,status:'added'},{filename:f.pin.path,status:'added'},{filename:'tools/update.mjs',status:'modified'}];
 await assert.rejects(()=>mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports),/MERGE_DIFF_DENIED/);
 assert.equal(f.merges,0);assert.equal(f.store.posts,0);
});
test('uncertain merge response with exact successful readback continues once',async()=>{
 const f=await mergeSubmissionFixture(),merge=f.ports.mergeApprovalPr;
 f.ports.mergeApprovalPr=async(...args)=>{await merge(...args);throw Error('lost response')};
 const r=await mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports);
 assert.equal(r.status,'REQUEST_READBACK_VERIFIED');assert.equal(f.merges,1);assert.equal(f.store.posts,1);
});
test('uncertain merge without merged readback never submits or repeats merge',async()=>{
 const f=await mergeSubmissionFixture();f.ports.mergeApprovalPr=async()=>{f.merges++;throw Error('lost response')};
 const r=await mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports);
 assert.equal(r.code,'MAINTENANCE_CI_MERGE_OUTCOME_UNKNOWN');assert.equal(f.merges,1);assert.equal(f.store.posts,0);
});
test('changed merged manifest prevents same-run submission',async()=>{
 const f=await mergeSubmissionFixture(),read=f.ctx.readFileBytes;
 f.ctx.readFileBytes=async(r,s,p)=>s==='main'&&p===f.m.path?Buffer.from('{}'):read(r,s,p);
 const r=await mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports);
 assert.equal(r.code,'MAINTENANCE_CI_MERGE_READBACK_MISMATCH');assert.equal(f.merges,1);assert.equal(f.store.posts,0);
});
test('missing approval context denies both merge and issue',async()=>{
 const f=await mergeSubmissionFixture();delete f.ports.readAutoApprovalContext;
 await assert.rejects(()=>mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports),/AUTO_APPROVAL_CONTEXT_REQUIRED/);
 assert.equal(f.merges,0);assert.equal(f.store.posts,0);
});

test('metadata-only automatic approval does not require a second PR CI',async()=>{
 const f=await mergeSubmissionFixture();
 f.ports.listRuns=async()=>assert.fail('redundant approval PR CI queried');
 f.ports.readRun=async()=>assert.fail('redundant approval PR CI queried');
 const result=await mergeAndSubmitPreparedControllerApproval(f.mergeInput,f.ports);
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');
 assert.equal(f.merges,1);assert.equal(f.store.posts,1);
});
test('already merged bot approval with extra files is denied',async()=>{
 const f=await automaticSubmissionFixture();
 f.ports.readApprovalPrFiles=async()=>[{filename:f.m.path,status:'added'},{filename:f.pin.path,status:'added'},{filename:'tools/update.mjs',status:'modified'}];
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(f.input,f.ports),/MERGE_DIFF_DENIED/);
 assert.equal(f.store.posts,0);
});
