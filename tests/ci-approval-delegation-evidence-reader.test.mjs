import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectDelegatedScope as collect} from '../ci-approval/delegation-evidence-reader.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi',root='repos/'+repo;
function fixture(){
 const g={schema:'ZGMINI_CI_STANDING_DELEGATION_V1',effect:'B_CONTROLLER_INSTALL',businessApprovalSha256:'a'.repeat(64),policyRevision:'b'.repeat(40),sourceRepository:repo,sourceBranch:'codex/example',purpose:'pc-controller-maintenance',allowedPaths:['controller/example.mjs'],notBefore:'2026-11-25T00:00:00Z',notAfter:'2026-11-26T00:00:00Z'};
 const url='https://api.github.com/'+root+'/issues/123',body=JSON.stringify(g),baseSha='c'.repeat(40),targetSha='d'.repeat(40);
 const pin={issueNumber:123,commentId:456,bodySha256:createHash('sha256').update(body).digest('hex')};
 const scope={...Object.fromEntries(['effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose'].map(k=>[k,g[k]])),changedPaths:['untrusted-placeholder'],targetSha,scopeDigest:'e'.repeat(64),authorityChangesExcluded:true};
 const responses={
 [root]:{id:1442936296,full_name:repo,private:true,owner:{id:327938088,login:owner}},
 [root+'/issues/123']:{number:123,url,state:'open'},
 [root+'/issues/comments/456']:{id:456,issue_url:url,user:{id:327938088,login:owner,type:'User'},author_association:'OWNER',performed_via_github_app:null,created_at:g.notBefore,updated_at:g.notBefore,body},
 [root+'/branches/codex%2Fexample']:{name:g.sourceBranch,commit:{sha:targetSha}},
 [root+'/compare/'+baseSha+'...'+targetSha]:{status:'ahead',behind_by:0,ahead_by:1,total_commits:1,base_commit:{sha:baseSha},merge_base_commit:{sha:baseSha},commits:[{sha:targetSha}],files:[{filename:'controller/example.mjs',status:'modified',sha:'f'.repeat(40)}]}};
 return {pin,scope,baseSha,now:'2026-11-25T01:00:00Z',responses,diff:responses[root+'/compare/'+baseSha+'...'+targetSha],branch:responses[root+'/branches/codex%2Fexample']};
}
const cases=[
 ['derive exact observed paths',()=>{},'DELEGATED_DIFF_OBSERVED_ONLY'],
 ['branch drift',v=>{v.branch.commit.sha='f'.repeat(40)},'EVIDENCE_MISSING'],
 ['diverged base',v=>{v.diff.behind_by=1},'EVIDENCE_MISSING'],
 ['incomplete commits',v=>{v.diff.total_commits=2},'EVIDENCE_MISSING'],
 ['rename excluded',v=>{v.diff.files[0].status='renamed'},'OUT_OF_SCOPE'],
 ['undelegated file',v=>{v.diff.files[0].filename='controller/other.mjs'},'OUT_OF_SCOPE'],
 ['semantic review not supplied',v=>{v.scope.authorityChangesExcluded=false},'OUT_OF_SCOPE'],
 ['invalid effect',v=>{v.scope.effect='C_ADMIN'},'OUT_OF_SCOPE'],
 ['missing grant',v=>{delete v.responses[root+'/issues/comments/456']},'EVIDENCE_MISSING'],
 ['revoked during read',v=>{v.revoke=true},'EVIDENCE_MISSING']
];
for(const [name,edit,state] of cases)test(name,async()=>{const v=fixture();edit(v);const reads={};const getJson=async route=>{reads[route]=(reads[route]??0)+1;if(!Object.hasOwn(v.responses,route))throw Error('not found');const value=structuredClone(v.responses[route]);if(v.revoke&&route===root+'/issues/123'&&reads[route]>1)value.state='closed';return value;};const r=await collect({...v,getJson});assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);if(state==='DELEGATED_DIFF_OBSERVED_ONLY')assert.deepEqual(r.changedPaths,['controller/example.mjs']);});
