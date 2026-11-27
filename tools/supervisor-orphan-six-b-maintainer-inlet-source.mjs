// Source-only candidate adapter for a future independently approved B maintainer.
// No installed receiver route, CLI, GitHub calls, filesystem, lease, Windows
// signal, or change to the nine pinned maintenance files is made here.
// All callbacks are read-only. A CANDIDATE_ONLY result grants NO OS authority.
import {ORPHAN_SIX_B_TITLE,validateOrphanSixBRequest}
 from './supervisor-orphan-six-b-admission.mjs';
import {receiveOrphanSixBApprovalSource}
 from './supervisor-orphan-six-b-receiver-source.mjs';
import {parseOrphanSixBFlatRequest} from './supervisor-orphan-six-b-flat-request.mjs';
export {parseOrphanSixBFlatRequest};

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const LABEL='pc-maintenance';
const reject=code=>Object.freeze({
 status:'BLOCKED',code,executionStarted:false,
 approvalSourceVerified:false,effectAuthorized:false,
 runnerStopAuthorized:false,operationalWrites:0,automaticRetries:0
});

export async function inspectOrphanSixBMaintainerInletSource({
 issue,attestCurrentMaintainerSource,readOriginalOneUseClaim,
 getMainManifest,getPullRequest,getOwnerEffectComments,getInstalledReadback
}={}){
 // A future trusted installed maintainer still owns every OS/write boundary.
 if(issue?.title!==ORPHAN_SIX_B_TITLE||
    (issue.state!=='OPEN'&&issue.state!=='open')||
    !Number.isSafeInteger(issue.number)||issue.number<1||
    issue.author?.login!==OWNER||
    !Array.isArray(issue.labels)||!issue.labels.some(x=>x?.name===LABEL))
  return reject('ORPHAN_SIX_B_UNTRUSTED_ISSUE');
 try{
  const parsed=parseOrphanSixBFlatRequest(issue.body);
  validateOrphanSixBRequest(parsed,{actor:OWNER,repo:REPO});
 }catch{return reject('ORPHAN_SIX_B_RAW_REQUEST_INVALID');}
 if([attestCurrentMaintainerSource,readOriginalOneUseClaim,
    getMainManifest,getPullRequest,getOwnerEffectComments,
    getInstalledReadback].some(x=>typeof x!=='function'))
  return reject('ORPHAN_SIX_B_SOURCE_READ_PORTS_MISSING');
 try{
  // A source-only test may inject this attestation, but the adapter neither
  // creates evidence nor permits an install/signal. Real source must be
  // attested by the installed independent B maintainer before use.
  const installed=await attestCurrentMaintainerSource();
  if(installed?.origin!=='PRIVATE_INDEPENDENT_B_MAINTAINER'||
     installed.verifiedNinePinnedMaintainerFiles!==true||
     installed.currentMaintainerSourceUnchangedVerified!==true)
   return reject('ORPHAN_SIX_B_MAINTAINER_SOURCE_UNVERIFIED');
  const result=await receiveOrphanSixBApprovalSource({issue,
   readOriginalOneUseClaim,getMainManifest,getPullRequest,
   getOwnerEffectComments,getInstalledReadback});
  // Even a verified source candidate MUST remain non-executable.
  if(result?.status!=='CANDIDATE_ONLY')return reject(result?.code??'ORPHAN_SIX_B_SOURCE_BLOCKED');
  return Object.freeze({...reject(result.code),status:'CANDIDATE_ONLY',
   approvalSourceVerified:true,requestId:result.requestId,
   manifestRawSha256:result.manifestRawSha256,
   nextAction:'SEPARATE_INSTALLED_B_PRIVATE_CAS_AND_EFFECT_APPROVAL_REQUIRED'});
 }catch{return reject('ORPHAN_SIX_B_SOURCE_READBACK_UNKNOWN');}
}
