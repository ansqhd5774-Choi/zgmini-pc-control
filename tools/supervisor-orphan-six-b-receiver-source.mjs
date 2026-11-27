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
const ownerDecisionSchema='ZGMINI_ORPHAN_SIX_B_OWNER_DECISION_V1';
const decisionFields=['schema','decision','requestId',
 'approvalManifestSha256','reviewedSourceSha','scope',
 'operation','effect','installedControllerSha'];
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join(',')===[...keys].sort().join(',');
function pinnedMergedSource(pr,number,sha){
 return pr?.number===number&&pr.state==='closed'&&pr.merged===true&&
  validDate(pr.merged_at)&&pr.base?.repo?.full_name===repo&&
  pr.head?.repo?.full_name===repo&&pr.head.sha===sha&&sha40(sha);
}
function ownerExactBEffectDecision(readback,issue,request,manifest,pr){
 if(readback?.source!=='GITHUB_CANONICAL_ISSUE_COMMENTS_API'||
    readback?.complete!==true||readback?.issueNumber!==issue.number||
    !Array.isArray(readback.items)||readback.items.length>1000)
  return false;
 const decisions=[];
 for(const item of readback.items){
  if(item?.user?.login!==owner)continue;
  if(!Number.isSafeInteger(item.id)||item.id<=0||
     typeof item.body!=='string'||Buffer.byteLength(item.body)>2048)
   return false;
  let record;
  try{record=JSON.parse(item.body);}catch{continue;}
  if(record?.schema!==ownerDecisionSchema)continue;
  // A malformed OWNER decision cannot be silently skipped.
  if(!exact(record,decisionFields)||
     !['APPROVE','REVOKE'].includes(record.decision)||
     record.operation!==ORPHAN_SIX_B_OPERATION||
     record.scope!==ORPHAN_SIX_B_SCOPE||
     record.effect!=='SIX_ORPHAN_LISTENER_GRACEFUL_STOP_ONCE'||
     record.requestId!==request.requestId||
     record.approvalManifestSha256!==request.approvalManifestSha256||
     record.reviewedSourceSha!==manifest.approval.reviewedSourceSha||
     record.installedControllerSha!==manifest.installedControllerSha||
     item.html_url!=='https://github.com/'+repo+'/issues/'+issue.number+
       '#issuecomment-'+item.id||
     !validDate(item.created_at)||item.updated_at!==item.created_at||
     Date.parse(item.created_at)<=Date.parse(pr.merged_at)||
     Date.parse(item.created_at)>Date.now())
   return false;
  decisions.push({at:Date.parse(item.created_at),id:item.id,decision:record.decision});
 }
 if(decisions.length===0)return false;
 // Exact second-resolution ties are ambiguous even when an API order differs.
 decisions.sort((a,b)=>a.at-b.at||a.id-b.id);
 const last=decisions.at(-1);
 if(decisions.length>1&&decisions.at(-2).at===last.at)return false;
 return last.decision==='APPROVE';
}
/**
 * Dependency callbacks are READ-only ports exposed by a separately
 * authenticated installed independent maintainer. An OWNER comment attesting
 * exact B effect is distinct from merging code or approving one's own PR.
 * Passing forged callback results never creates an OS execution permission.
 *
 * getMainManifest: exact canonical approval path -> bytes (not parsed JSON)
 * getPullRequest / getOwnerEffectComments: canonical GitHub API readbacks
 * getInstalledReadback: same-host pinned local installation only
 * readOriginalOneUseClaim: existing durable effect ledger check
 */
export async function receiveOrphanSixBApprovalSource({
 issue,getMainManifest,getPullRequest,getOwnerEffectComments,
 getInstalledReadback,readOriginalOneUseClaim
}={}){
 if(!exactlyOwnerLabel(issue))
  return deny('ORPHAN_SIX_B_ISSUE_ORIGIN_UNVERIFIED');
 if([getMainManifest,getPullRequest,getOwnerEffectComments,
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
  const [pr,comments,installed]=await Promise.all([
    getPullRequest(num),getOwnerEffectComments(issue.number),getInstalledReadback()
  ]);
  if(!pinnedMergedSource(pr,num,manifest?.approval?.reviewedSourceSha))
   return deny('ORPHAN_SIX_B_MERGED_SOURCE_UNVERIFIED');
  if(!ownerExactBEffectDecision(comments,issue,request,manifest,pr))
   return deny('ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
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
      ownerExactEffectApproved:true
    }
  });
  if(candidate.status!=='CANDIDATE_ONLY'||
     candidate.scope!==ORPHAN_SIX_B_SCOPE||
     candidate.installedMaintainerSha!==installed.installedMaintainerSha)
   return deny('ORPHAN_SIX_B_SOURCE_CANDIDATE_UNVERIFIED');
  return positive(candidate);
 }catch{return deny('ORPHAN_SIX_B_APPROVAL_OR_INSTALLED_READBACK_UNKNOWN');}
}
