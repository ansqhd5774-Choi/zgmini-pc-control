// Shadow-only verification of an independently pinned, owner-issued standing delegation.
// No credentials, writes, permission grant, or issue submission. A caller-provided pin
// and caller-provided scope observations do not establish independent authority.
import {createHash} from 'node:crypto';
const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi';
const repositoryId=1442936296,ownerId=327938088;
const sha=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(v=>Object.hasOwn(x,v));
const time=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().replace('.000Z','Z')===x;
const pathOk=p=>typeof p==='string'&&p.length<=180&&/^[a-zA-Z0-9._/-]+\.mjs$/.test(p)&&p.split('/').every(x=>x&&!x.startsWith('.'))&&!p.includes('..');
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
const effectRepo=Object.freeze({B_CONTROLLER_INSTALL:repo,B_WRITER_SOURCE:'ansqhd5774-Choi/zgmini'});
const effectPurpose=Object.freeze({B_CONTROLLER_INSTALL:'pc-controller-maintenance',B_WRITER_SOURCE:'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY'});
const pathInPilot=(effect,p)=>pathOk(p)&&(effect==='B_CONTROLLER_INSTALL'?p.startsWith('controller/'): /^(scripts\/pc-writer|lib|worker)\//.test(p));
export function inspectOwnerDelegation({pin,repository,issue,comment,scope,now}={}){
 if(!exact(pin,['issueNumber','commentId','bodySha256'])||!id(pin.issueNumber)||!id(pin.commentId)||!sha(pin.bodySha256,64)||!time(now))return out('INVALID','DELEGATION_PIN_OR_TIME_INVALID');
 if(repository?.id!==repositoryId||repository.full_name!==repo||repository.private!==true||repository.owner?.id!==ownerId||repository.owner?.login!==owner)return out('REJECTED','REPOSITORY_IDENTITY_MISMATCH');
 const issueUrl='https://api.github.com/repos/'+repo+'/issues/'+pin.issueNumber;
 if(issue?.number!==pin.issueNumber||issue.url!==issueUrl||issue.state!=='open'||issue.pull_request)return out('REJECTED','DELEGATION_ISSUE_NOT_ACTIVE');
 if(comment?.id!==pin.commentId||comment.issue_url!==issueUrl||comment.user?.id!==ownerId||comment.user?.login!==owner||comment.user?.type!=='User'||comment.author_association!=='OWNER'||comment.performed_via_github_app!==null)
  return out('REJECTED','OWNER_PROVENANCE_MISMATCH');
 if(!time(comment.created_at)||comment.updated_at!==comment.created_at||Date.parse(comment.created_at)>Date.parse(now))return out('REJECTED','DELEGATION_EDIT_OR_TIME_MISMATCH');
 if(typeof comment.body!=='string'||comment.body.length>16000||createHash('sha256').update(comment.body).digest('hex')!==pin.bodySha256)return out('REJECTED','DELEGATION_BODY_PIN_MISMATCH');
 let g;try{g=JSON.parse(comment.body)}catch{return out('INVALID','DELEGATION_JSON_INVALID')}
 if(!exact(g,['schema','effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose','allowedPaths','notBefore','notAfter'])||g.schema!=='ZGMINI_CI_STANDING_DELEGATION_V1'||!Object.hasOwn(effectRepo,g.effect)||g.sourceRepository!==effectRepo[g.effect]||g.purpose!==effectPurpose[g.effect]||!sha(g.businessApprovalSha256,64)||!sha(g.policyRevision,40)||typeof g.sourceBranch!=='string'||!/^codex\/[a-z0-9][a-z0-9._/-]{1,100}$/.test(g.sourceBranch)||g.sourceBranch.includes('..')||g.sourceBranch.includes('//')||g.sourceBranch.endsWith('/')||!Array.isArray(g.allowedPaths)||!g.allowedPaths.length||g.allowedPaths.length>32||!g.allowedPaths.every(p=>pathInPilot(g.effect,p))||new Set(g.allowedPaths.map(p=>p.toLowerCase())).size!==g.allowedPaths.length||!time(g.notBefore)||!time(g.notAfter))
  return out('INVALID','DELEGATION_SCOPE_INVALID');
 const t=Date.parse(now),start=Date.parse(g.notBefore),end=Date.parse(g.notAfter);
 if(start<Date.parse(comment.created_at)||end<=start||t<start||t>=end)return out('REJECTED','DELEGATION_NOT_CURRENT');
 if(!exact(scope,['effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose','changedPaths','targetSha','scopeDigest','authorityChangesExcluded'])||!sha(scope.targetSha,40)||!sha(scope.scopeDigest,64)||!Array.isArray(scope.changedPaths)||!scope.changedPaths.length||scope.changedPaths.length>32||new Set(scope.changedPaths.map(p=>typeof p==='string'?p.toLowerCase():p)).size!==scope.changedPaths.length)return out('INVALID','OBSERVED_SCOPE_INVALID');
 if(['effect','businessApprovalSha256','policyRevision','sourceRepository','sourceBranch','purpose'].some(k=>scope[k]!==g[k])||scope.authorityChangesExcluded!==true||!scope.changedPaths.every(p=>pathInPilot(g.effect,p)&&g.allowedPaths.includes(p)))
  return out('OUT_OF_SCOPE','DELEGATION_EFFECT_SCOPE_MISMATCH');
 return out('DELEGATION_SCOPE_MATCH_ONLY','INDEPENDENT_PIN_AND_LIVE_EXECUTION_PROOF_REQUIRED',{effect:g.effect,commentId:pin.commentId,delegationSha256:pin.bodySha256,targetSha:scope.targetSha,scopeDigest:scope.scopeDigest});
}
