// Read-only GitHub evidence collection for the standing delegation pilot.
// getJson must be an independently authenticated read adapter. No POST, actor
// impersonation, or authority issuance. A path diff is not a semantic review.
import {inspectOwnerDelegation} from './owner-delegation.mjs';
const control='ansqhd5774-Choi/zgmini-pc-control';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export async function collectDelegatedScope({pin,scope,baseSha,now,getJson}={}){
 if(!pin||!id(pin.issueNumber)||!id(pin.commentId)||!scope||!sha(baseSha)||!sha(scope.targetSha)||baseSha===scope.targetSha||typeof getJson!=='function')return out('INVALID','COLLECTOR_INPUT_INVALID');
 const source=scope.effect==='B_CONTROLLER_INSTALL'?control:scope.effect==='B_WRITER_SOURCE'?'ansqhd5774-Choi/zgmini':null;
 if(!source||scope.sourceRepository!==source||typeof scope.sourceBranch!=='string'||!/^codex\/[a-z0-9][a-z0-9._/-]{1,100}$/.test(scope.sourceBranch)||scope.sourceBranch.includes('..')||scope.sourceBranch.includes('//')||scope.sourceBranch.endsWith('/'))return out('OUT_OF_SCOPE','SOURCE_NOT_IN_PILOT');
 const root='repos/'+control,issuePath=root+'/issues/'+pin.issueNumber,commentPath=root+'/issues/comments/'+pin.commentId;
 const branchPath='repos/'+source+'/branches/'+encodeURIComponent(scope.sourceBranch);
 try{
  const [repository,issue,comment,branch,diff]=await Promise.all([
   getJson(root),getJson(issuePath),getJson(commentPath),getJson(branchPath),
   getJson('repos/'+source+'/compare/'+baseSha+'...'+scope.targetSha)]);
  if(branch?.name!==scope.sourceBranch||branch.commit?.sha!==scope.targetSha)return out('EVIDENCE_MISSING','CURRENT_BRANCH_HEAD_MISMATCH');
  if(diff?.status!=='ahead'||diff.behind_by!==0||diff.base_commit?.sha!==baseSha||diff.merge_base_commit?.sha!==baseSha||!Number.isSafeInteger(diff.total_commits)||diff.total_commits<1||diff.total_commits>100||diff.ahead_by!==diff.total_commits||!Array.isArray(diff.commits)||diff.commits.length!==diff.total_commits||diff.commits.at(-1)?.sha!==scope.targetSha||!Array.isArray(diff.files)||!diff.files.length||diff.files.length>32)
   return out('EVIDENCE_MISSING','DIFF_INCOMPLETE_OR_DIVERGED');
  if(diff.files.some(f=>!['added','modified'].includes(f?.status)||typeof f.filename!=='string'||!sha(f.sha))||new Set(diff.files.map(f=>f.filename.toLowerCase())).size!==diff.files.length)return out('OUT_OF_SCOPE','DIFF_FILE_SHAPE_NOT_SUPPORTED');
  const changedPaths=diff.files.map(f=>f.filename).sort();
  // Never derive authorityChangesExcluded from filenames. This independent
  // observation remains required by inspectOwnerDelegation.
  const checked=inspectOwnerDelegation({pin,repository,issue,comment,scope:{...scope,changedPaths},now});
  if(checked.state!=='DELEGATION_SCOPE_MATCH_ONLY')return out(checked.state,checked.reason);
  const [lastIssue,lastComment,lastBranch]=await Promise.all([getJson(issuePath),getJson(commentPath),getJson(branchPath)]);
  if(lastIssue?.state!==issue.state||lastIssue.number!==issue.number||lastIssue.url!==issue.url||lastComment?.id!==comment.id||lastComment.body!==comment.body||lastComment.updated_at!==comment.updated_at||lastBranch?.name!==branch.name||lastBranch.commit?.sha!==branch.commit.sha)return out('EVIDENCE_MISSING','SOURCE_CHANGED_DURING_READ');
  return out('DELEGATED_DIFF_OBSERVED_ONLY','LIVE_FILE_BYTES_AND_AUTHORITY_REVIEW_STILL_REQUIRED',{targetSha:scope.targetSha,baseSha,delegationSha256:checked.delegationSha256,changedPaths});
 }catch{return out('EVIDENCE_MISSING','GITHUB_READ_FAILED')}
}
