// #996 phase-scoped C consent provenance review -- pure/source-only.
// Callers MUST independently authenticate GitHub Issue/comments and immutable
// `git show <commit>:<path>` bytes. This module makes NO API/file/PC calls and
// cannot grant operational execution rights, even after a matching receipt.
import {createHash} from 'node:crypto';

const owner='ansqhd5774-Choi';
const repo=`${owner}/zgmini-pc-control`;
const issueNumber=996;
const requestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const controllerSha='badad9124157879d7a645b64f2768113d632355b';
const targetSha='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const maintainerSha='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const manifestPath='docs/CONTROLLER_996_C_APPROVAL_R1.json';
const rawKeys=['ledger','owner','recoveryMarker','backlog','controllerHost',
 'stagedHost','maintainerManifest'];
const writerNames=['config.json','quota-runner.cmd','run-local.cmd'];
const taskNames=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
const gaps=['workflowDisableActorVerified','protectedBaselineVerified'];
const manifestKeys=['schema','approved','grade','operation','executionScope',
 'authorizationMode','requestId','issueNumber','controllerSha','targetSha',
 'maintainerSha','acceptsUnprovenGitHubDisableActor',
 'acceptsMissingHistoricalProtectedBaseline',
 'acceptsNoAllActorsImmutabilityProof','acceptedGaps','allowedEffects',
 'phaseScopedSourceProof','evidenceObservedAt','protectedItemsObservedAt',
 'protectionNowFingerprint','evidenceSha256','protectedItemsSha256',
 'protectedTaskEnabled'];
const causalKeys=['maintainerSourceSha','failureFirstPhase','failureCode',
 'reachedBackup','reachedControllerSwitch',
 'claimsIndependentDisableActorAudit','claimsAllActorsProtectedImmutability'];
const allowedEffects=['CREATE_AND_ARCHIVE_OWN_C_RECOVERY_CLAIM',
 'WRITE_C_SCOPED_AUDIT_AND_ATTEMPT_MARKERS',
 'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
 'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE',
 'READ_ONLY_DISPOSITION_NO_REPLAY',
 'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK'];
const isSha256=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const isSha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const digest=b=>createHash('sha256').update(b).digest('hex');
const exactKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const safeJson=bytes=>{
 try {
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 } catch {return null;}
};
const fail=code=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_C_CONSENT_REVIEW_V1',
 status:'CONSENT_UNVERIFIED',code,executionAuthorized:false,
 pcWritesAuthorized:0,workflowEnablesAuthorized:0,
});

export function build996ConsentComment(manifestSha256){
 if(!isSha256(manifestSha256))throw Error('CONSENT_DIGEST_INVALID');
 return [
  'ZGMINI_CONTROLLER_996_C_CONSENT_V1',
  `issueNumber: ${issueNumber}`,
  `requestId: ${requestId}`,
  `manifestSha256: ${manifestSha256}`,
  'authorizationMode: PHASE_SCOPED_EVIDENCE_EXCEPTION',
  'acceptedUnproven: workflowDisableActorVerified=false,protectedBaselineVerified=false,allActorsProtectedImmutability=unproven',
 ].join('\n');
}

/**
 * Raw inputs MUST come from an independently authenticated GitHub/immutable
 * Git source reader. The returned review is NOT authority to call any port.
 */
export function review996CConsent({originalIssue,commentsReadback,gitRead,
 operatorManifestBytes}={}){
 if(originalIssue?.number!==issueNumber||
  originalIssue?.user?.login!==owner||
  originalIssue?.title!=='pc-controller-update')
  return fail('ORIGINAL_ISSUE_AUTHORITY_UNVERIFIED');
 const body=safeJson(Buffer.from(typeof originalIssue.body==='string'?
  originalIssue.body:''));
 if(body?.requestId!==requestId||body?.targetControllerSha!==targetSha)
  return fail('ORIGINAL_ISSUE_BODY_MISMATCH');
 if(gitRead?.repository!==repo||gitRead?.path!==manifestPath||
  !isSha40(gitRead?.commitSha)||
  !Buffer.isBuffer(gitRead?.bytes)||
  !Buffer.isBuffer(operatorManifestBytes)||
  gitRead.bytes.length===0||gitRead.bytes.length>65_536||
  !gitRead.bytes.equals(operatorManifestBytes))
  return fail('IMMUTABLE_GIT_APPROVAL_SOURCE_UNVERIFIED');
 const manifest=safeJson(gitRead.bytes);
 if(!exactKeys(manifest,manifestKeys)||
  manifest.schema!=='ZGMINI_CONTROLLER_996_C_APPROVAL_V1'||
  manifest.approved!==true||manifest.grade!=='C'||
  manifest.operation!=='RECONCILE_INTAKE_PAUSED_ONLY'||
  manifest.executionScope!=='ORIGINAL_WINDOWS_ONE_SHOT'||
  manifest.authorizationMode!=='PHASE_SCOPED_EVIDENCE_EXCEPTION'||
  manifest.issueNumber!==issueNumber||manifest.requestId!==requestId||
  manifest.controllerSha!==controllerSha||manifest.targetSha!==targetSha||
  manifest.maintainerSha!==maintainerSha||
  manifest.acceptsUnprovenGitHubDisableActor!==true||
  manifest.acceptsMissingHistoricalProtectedBaseline!==true||
  manifest.acceptsNoAllActorsImmutabilityProof!==true||
  !exactKeys(manifest.phaseScopedSourceProof,causalKeys)||
  manifest.phaseScopedSourceProof.maintainerSourceSha!==maintainerSha||
  manifest.phaseScopedSourceProof.failureFirstPhase!=='INTAKE_PAUSED'||
  manifest.phaseScopedSourceProof.failureCode!=='RUNNER_SET_DRIFT'||
  manifest.phaseScopedSourceProof.reachedBackup!==false||
  manifest.phaseScopedSourceProof.reachedControllerSwitch!==false||
  manifest.phaseScopedSourceProof.claimsIndependentDisableActorAudit!==false||
  manifest.phaseScopedSourceProof.claimsAllActorsProtectedImmutability!==false||
  !Array.isArray(manifest.acceptedGaps)||
  manifest.acceptedGaps.join(',')!==gaps.join(',')||
  !Array.isArray(manifest.allowedEffects)||
  manifest.allowedEffects.join(',')!==allowedEffects.join(',')||
  !Number.isFinite(Date.parse(manifest.evidenceObservedAt))||
  !Number.isFinite(Date.parse(manifest.protectedItemsObservedAt))||
  !isSha256(manifest.protectionNowFingerprint)||
  !exactKeys(manifest.evidenceSha256,rawKeys)||
  rawKeys.some(k=>!isSha256(manifest.evidenceSha256[k]))||
  !exactKeys(manifest.protectedItemsSha256,['files','tasks'])||
  !exactKeys(manifest.protectedItemsSha256.files,writerNames)||
  !exactKeys(manifest.protectedItemsSha256.tasks,taskNames)||
  writerNames.some(k=>!isSha256(manifest.protectedItemsSha256.files[k]))||
  taskNames.some(k=>!isSha256(manifest.protectedItemsSha256.tasks[k]))||
  !exactKeys(manifest.protectedTaskEnabled,taskNames)||
  taskNames.some(k=>typeof manifest.protectedTaskEnabled[k]!=='boolean'))
  return fail('C_MANIFEST_SCOPE_OR_EVIDENCE_UNVERIFIED');
 if(commentsReadback?.complete!==true||
  !Array.isArray(commentsReadback.comments)||
  commentsReadback.comments.length>10_000)
  return fail('CONSENT_COMMENT_PAGINATION_UNVERIFIED');
 const receiptHash=digest(gitRead.bytes);
 const matchingPrefix=commentsReadback.comments.filter(c=>
  typeof c?.body==='string'&&c.body.includes('ZGMINI_CONTROLLER_996_C_CONSENT_V1'));
 if(matchingPrefix.length!==1)
  return fail('CONSENT_MISSING_OR_CONFLICTING');
 const comment=matchingPrefix[0];
 if(comment?.user?.login!==owner||
  !Number.isSafeInteger(comment?.id)||comment.id<1||
  comment.body.replace(/\r\n/g,'\n').trim()!==build996ConsentComment(receiptHash))
  return fail('CONSENT_AUTHOR_OR_EXACT_RECEIPT_UNVERIFIED');
 const consentDate=Date.parse(comment.created_at??'');
 if(!Number.isFinite(consentDate)||
  consentDate<Date.parse(manifest.evidenceObservedAt)||
  consentDate<Date.parse(manifest.protectedItemsObservedAt))
  return fail('CONSENT_PRECEDES_PINNED_EVIDENCE');
 const revocations=commentsReadback.comments.filter(c=>
  c?.user?.login===owner&&
  typeof c.body==='string'&&
  c.body.includes('ZGMINI_CONTROLLER_996_C_REVOKE_V1')&&
  Number.isFinite(Date.parse(c.created_at??''))&&
  Date.parse(c.created_at)>=consentDate);
 if(revocations.length)return fail('CONSENT_REVOKED');
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_C_CONSENT_REVIEW_V1',
  status:'CONSENT_PROVENANCE_REVIEWED_ONLY',
  code:'NATIVE_INDEPENDENT_READBACK_AND_C_EXECUTION_APPROVAL_REQUIRED',
  manifestSha256:receiptHash,manifestCommitSha:gitRead.commitSha,
  consentCommentId:comment.id,
  acceptedUnprovenChecks:gaps,
  allowedEffects,
  executionAuthorized:false,pcWritesAuthorized:0,
  workflowEnablesAuthorized:0,
 });
}
