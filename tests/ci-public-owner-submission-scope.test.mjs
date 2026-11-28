import test from 'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{readOwnerApprovedSubmissionScope,ownerSubmissionPolicy}from'../ci-approval/public-owner-submission-scope.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control',src='a'.repeat(40),merge='b'.repeat(40);
const policy={schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2',enabled:true,
 workflowId:430972394,workflowBlobSha:'c'.repeat(40),workflowPath:'.github/workflows/ci-approval-controller-b.yml',
 repositoryVisibility:'public',installedSha:'d'.repeat(40),targetSha:'e'.repeat(40),manifestSha256:'f'.repeat(64)};
function fixture(){
 const owner={id:327938088,login:'ansqhd5774-Choi',type:'User'};
 const files=Object.fromEntries(['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs','maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs','source-bundle-register.mjs','bootstrap-maintenance.mjs','handoff-maintenance.mjs'].map(x=>['tools/'+x,'1'.repeat(64)]));
 const approval={schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',approved:true,installedSha:'2'.repeat(40),targetSha:src,scope:'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE',files,ciControllerBPolicy:structuredClone(policy),publisherApprovalRef:'https://github.com/'+repo+'/pull/12'};
 const pr={number:12,merged:true,user:owner,merged_by:owner,merge_commit_sha:merge,base:{ref:'main',repo:{full_name:repo}},head:{repo:{full_name:repo}}};
 let historical=null,calls=0;
 const pack=a=>{const b=Buffer.from(JSON.stringify(a));return{type:'file',path:'approvals/maintenance-handoffs/'+src+'.json',encoding:'base64',content:b.toString('base64'),sha:createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')};};
 return{approval,pr,setHistorical:x=>historical=x,get calls(){return calls;},async getJson(route){calls++;if(route==='pulls/12')return pr;return pack(route.endsWith('?ref=main')?approval:historical??approval);}};
}
test('publisher verifies Owner immutable approval, without a local receiver installation',async()=>{const f=fixture(),scope=await readOwnerApprovedSubmissionScope({getJson:f.getJson,handoffSourceSha:src});assert.equal(f.calls,3);assert.equal(scope.executionAuthorized,false);assert.deepEqual(ownerSubmissionPolicy(scope),policy);assert.equal(Object.hasOwn(scope,'files'),false);});
test('serialized policy, variable values and fabricated scopes never become authority',async()=>{const f=fixture(),s=await readOwnerApprovedSubmissionScope({getJson:f.getJson,handoffSourceSha:src});for(const bad of [policy,JSON.parse(JSON.stringify(s)),{...s},null])assert.throws(()=>ownerSubmissionPolicy(bad));});
test('bot authors or mergers cannot approve their own publication scope',async()=>{for(const field of ['user','merged_by']){const f=fixture();f.pr[field]={id:1,login:'github-actions[bot]',type:'Bot'};await assert.rejects(readOwnerApprovedSubmissionScope({getJson:f.getJson,handoffSourceSha:src}));}});
test('unmerged, foreign or non-main approval is rejected',async()=>{for(const mutate of [p=>p.merged=false,p=>p.base.ref='draft',p=>p.head.repo.full_name='foreign/repo',p=>p.merge_commit_sha='bad']){const f=fixture();mutate(f.pr);await assert.rejects(readOwnerApprovedSubmissionScope({getJson:f.getJson,handoffSourceSha:src}));}});
test('mutable main approval must equal original Owner merge bytes',async()=>{const f=fixture(),old=structuredClone(f.approval);f.setHistorical(old);f.approval.ciControllerBPolicy.targetSha='9'.repeat(40);await assert.rejects(readOwnerApprovedSubmissionScope({getJson:f.getJson,handoffSourceSha:src}));});
test('grant scope and real handoff contract cannot be widened',async()=>{for(const mutate of [a=>a.approved=false,a=>a.targetSha='9'.repeat(40),a=>delete a.files['tools/update.mjs'],a=>a.ciControllerBPolicy.allowAll=true,a=>a.ciControllerBPolicy.installedSha=a.ciControllerBPolicy.targetSha,a=>a.publisherApprovalRef='https://evil/pull/12']){const f=fixture();mutate(f.approval);await assert.rejects(readOwnerApprovedSubmissionScope({getJson:f.getJson,handoffSourceSha:src}));}});
