import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectOwnerDelegation as inspect} from '../ci-approval/owner-delegation.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi',issueUrl='https://api.github.com/repos/'+repo+'/issues/123';
function fixture(){
 const g={schema:'ZGMINI_CI_STANDING_DELEGATION_V1',effect:'B_WRITER_SOURCE',businessApprovalSha256:'a'.repeat(64),policyRevision:'b'.repeat(40),sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'codex/example',purpose:'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',allowedPaths:['lib/example.mjs','lib/second.mjs'],notBefore:'2026-11-25T00:00:00Z',notAfter:'2026-11-26T00:00:00Z'};
 const comment={id:456,issue_url:issueUrl,user:{id:327938088,login:owner,type:'User'},author_association:'OWNER',performed_via_github_app:null,created_at:g.notBefore,updated_at:g.notBefore,body:JSON.stringify(g)};
 const pin={issueNumber:123,commentId:456,bodySha256:createHash('sha256').update(comment.body).digest('hex')};
 const scope=Object.fromEntries(['effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose'].map(k=>[k,g[k]]));
 Object.assign(scope,{changedPaths:['lib/example.mjs'],targetSha:'c'.repeat(40),scopeDigest:'d'.repeat(64),authorityChangesExcluded:true});
 return {pin,repository:{id:1442936296,full_name:repo,private:true,owner:{id:327938088,login:owner}},issue:{number:123,url:issueUrl,state:'open'},comment,scope,now:'2026-11-25T01:00:00Z'};
}
const match='DELEGATION_SCOPE_MATCH_ONLY';
const changeGrant=(v,fn)=>{const g=JSON.parse(v.comment.body);fn(g);v.comment.body=JSON.stringify(g);v.pin.bodySha256=createHash('sha256').update(v.comment.body).digest('hex');};
const cases=[
 ['matching scope observation',()=>{},match],
 ['later candidate within same standing scope',v=>{v.scope.targetSha='e'.repeat(40);v.scope.scopeDigest='f'.repeat(64)},match],
 ['wrong owner numeric id',v=>{v.comment.user.id=12},'REJECTED'],
 ['bot or app',v=>{v.comment.performed_via_github_app={id:1}},'REJECTED'],
 ['edited grant',v=>{v.comment.updated_at='2026-11-25T00:01:00Z'},'REJECTED'],
 ['closed revocation issue',v=>{v.issue.state='closed'},'REJECTED'],
 ['wrong repository',v=>{v.repository.id=1},'REJECTED'],
 ['tampered body',v=>{v.comment.body+=' '},'REJECTED'],
 ['expired',v=>{v.now='2026-11-26T00:00:00Z'},'REJECTED'],
 ['other effect',v=>{v.scope.effect='C_ADMIN'},'OUT_OF_SCOPE'],
 ['other business approval',v=>{v.scope.businessApprovalSha256='e'.repeat(64)},'OUT_OF_SCOPE'],
 ['other policy revision',v=>{v.scope.policyRevision='e'.repeat(40)},'OUT_OF_SCOPE'],
 ['other branch',v=>{v.scope.sourceBranch='codex/other'},'OUT_OF_SCOPE'],
 ['other path',v=>{v.scope.changedPaths=['lib/third.mjs']},'OUT_OF_SCOPE'],
 ['authority changes not excluded',v=>{v.scope.authorityChangesExcluded=false},'OUT_OF_SCOPE'],
 ['grant cannot include workflow',v=>changeGrant(v,g=>{g.allowedPaths.push('.github/workflows/test.mjs')}),'INVALID'],
 ['grant cannot include C',v=>changeGrant(v,g=>{g.effect='C_ADMIN'}),'INVALID'],
 ['no independent pin',v=>{v.pin=null},'INVALID']
];
for(const [name,edit,state] of cases)test(name,()=>{const v=fixture();edit(v);const r=inspect(v);assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});
