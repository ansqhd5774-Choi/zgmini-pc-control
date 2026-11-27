// Source-only read path for a new, distinct orphan-six B request. This is
// NOT installed in the independent maintainer or wired to its live polling
// list. Only a separately approved, pinned receiver may supply the callbacks.
// No lease/file/process/Watchdog mutation, network access, or OS calls here.
import {createHash} from 'node:crypto';
import {
 ORPHAN_SIX_B_TITLE,ORPHAN_SIX_B_OPERATION,ORPHAN_SIX_B_SCOPE,
 validateOrphanSixBRequest,validateOrphanSixBManifest
} from './supervisor-orphan-six-b-admission.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const owner='ansqhd5774-Choi';
const label='pc-maintenance';
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const digest=x=>createHash('sha256').update(x).digest('hex');
const deny=code=>Object.freeze({
 status:'BLOCKED',code,executionStarted:false,
 effectAuthorized:false,runnerStopAuthorized:false,
 operationalWrites:0,automaticRetries:0,approvalSourceVerified:false
});
const positive=(candidate)=>Object.freeze({
 ...deny('ORPHAN_SIX_B_REVIEWED_SOURCE_ONLY'),
 status:'CANDIDATE_ONLY',approvalSourceVerified:true,
 requestId:candidate.requestId,
 manifestRawSha256:candidate.manifestRawSha256,
 installedControllerSha:candidate.installedControllerSha,
 installedMaintainerSha:candidate.installedMaintainerSha,
 approvalPrNumber:candidate.approvalPrNumber,
 nextAction:'SEPARATELY_APPROVED_INSTALLED_B_PRIVATE_RUNTIME_ATTESTATION_REQUIRED'
});
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
function exactlyOwnerLabel(issue){
 return issue?.title===ORPHAN_SIX_B_TITLE&&
  (issue?.state==='open'||issue?.state==='OPEN')&&
  Number.isSafeInteger(issue.number)&&issue.number>0&&
  issue?.author?.login===owner&&
  Array.isArray(issue.labels)&&
  issue.labels.some(l=>l?.name===label)&&
  typeof issue.body==='string'&&Buffer.byteLength(issue.body)<=16384;
}
function reviewedMerge(raw,prNum,sourceSha,reviewReadback){
 const reviews=reviewReadback?.items;
 if(reviewReadback?.complete!==true||reviewReadback?.source!=='GITHUB_CANONICAL_REVIEW_API')
  return false;
 if(raw?.number!==prNum||raw.state!=='closed'||raw.merged!==true||
    !validDate(raw.merged_at)||raw.base?.repo?.full_name!==repo||
    raw.head?.repo?.full_name!==repo||
    raw.head.sha!==sourceSha||!sha40(raw.head.sha)||
    !Array.isArray(reviews)||reviews.length>100)
  return false;
 // The canonical GitHub API (not Issue/manifest) supplies the review
 // provenance. Require an OWNER approval on the exact final head.
 // A later dismissal of the same review makes it ineligible.
 const accepted=reviews.filter(r=>r?.user?.login===owner&&
  r.commit_id===sourceSha&&r.state==='APPROVED'&&
  validDate(r.submitted_at)&&Date.parse(r.submitted_at)<=Date.parse(raw.merged_at));
 return accepted.length>0&&
  !reviews.some(r=>r?.user?.login===owner&&r.commit_id===sourceSha&&
   r.state==='DISMISSED'&&validDate(r.submitted_at)&&
   Date.parse(r.submitted_at)>=Date.parse(accepted.at(-1).submitted_at));
}
/**
 * Dependency callbacks are READ-only ports exposed by a separately
 * authenticated installed independent maintainer. Passing forged callback
 * results never creates an OS execution permission.
 *
 * getMainManifest: exact canonical approval path -> bytes (not parsed JSON)
 * getPullRequest / getReviews: canonical GitHub API readbacks
 * getInstalledReadback: same-host pinned local installation only
 * readOriginalOneUseClaim: existing durable effect ledger check
 */
export async function receiveOrphanSixBApprovalSource({
 issue,getMainManifest,getPullRequest,getReviews,
 getInstalledReadback,readOriginalOneUseClaim
}={}){
 if(!exactlyOwnerLabel(issue))
  return deny('ORPHAN_SIX_B_ISSUE_ORIGIN_UNVERIFIED');
 if([getMainManifest,getPullRequest,getReviews,
      getInstalledReadback,readOriginalOneUseClaim].some(x=>typeof x!=='function'))
  return deny('ORPHAN_SIX_B_RECEIVER_READ_PORTS_MISSING');
 let request;
 try{request=validateOrphanSixBRequest(JSON.parse(issue.body),{actor:owner,repo});}
 catch{return deny('ORPHAN_SIX_B_REQUEST_UNVERIFIED');}
 try{
  const existing=await readOriginalOneUseClaim(request.requestId);
  // A readback error is NOT absence, so a thrown callback blocks.
  if(existing!==null)return deny('ORPHAN_SIX_B_ORIGINAL_CLAIM_RECONCILE_FIRST');
  const canonicalPath='approvals/controller-orphan-six/'+
    request.approvalManifestSha256+'.json';
  const raw=await getMainManifest(canonicalPath,'main');
  if(!Buffer.isBuffer(raw)||raw.length<2||raw.length>16384||
      digest(raw)!==request.approvalManifestSha256)
   return deny('ORPHAN_SIX_B_APPROVAL_RAW_BYTES_UNVERIFIED');
  let manifest;
  try{manifest=JSON.parse(raw.toString('utf8'));}
  catch{return deny('ORPHAN_SIX_B_APPROVAL_JSON_INVALID');}
  const ref=manifest?.approval?.ref;
  const matched=/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/([1-9]\d*)$/.exec(ref??'');
  if(!matched)return deny('ORPHAN_SIX_B_APPROVAL_PR_REF_INVALID');
  const num=Number(matched[1]);
  if(!Number.isSafeInteger(num)||num<=0)return deny('ORPHAN_SIX_B_APPROVAL_PR_REF_INVALID');
  const [pr,reviews,installed]=await Promise.all([
    getPullRequest(num),getReviews(num),getInstalledReadback()
  ]);
  if(!reviewedMerge(pr,num,manifest?.approval?.reviewedSourceSha,reviews))
   return deny('ORPHAN_SIX_B_APPROVAL_REVIEW_OR_MERGE_UNVERIFIED');
  if(installed?.origin!=='PRIVATE_INDEPENDENT_B_MAINTAINER'||
     installed?.currentInstallVerified!==true||
     installed?.sourceFilesVerified!==true||
     installed?.controllerBPolicyUnchangedVerified!==true||
     installed?.installedControllerSha!==manifest.installedControllerSha||
     installed?.installedMaintainerSha!==manifest.installedMaintainerSha||
     installed?.maintenanceFilesSha256!==manifest.maintenanceFilesSha256)
   return deny('ORPHAN_SIX_B_INSTALLED_SOURCE_CAS_UNVERIFIED');
  const candidate=validateOrphanSixBManifest(request,raw,{
    actor:owner,repo,approvalPr:{
      number:num,state:pr.state,merged:pr.merged,
      headSha:pr.head.sha,baseRepo:pr.base.repo.full_name,
      reviewedByOwner:true
    }
  });
  if(candidate.status!=='CANDIDATE_ONLY'||
     candidate.scope!==ORPHAN_SIX_B_SCOPE||
     candidate.installedMaintainerSha!==installed.installedMaintainerSha)
   return deny('ORPHAN_SIX_B_SOURCE_CANDIDATE_UNVERIFIED');
  return positive(candidate);
 }catch{return deny('ORPHAN_SIX_B_APPROVAL_OR_INSTALLED_READBACK_UNKNOWN');}
}
