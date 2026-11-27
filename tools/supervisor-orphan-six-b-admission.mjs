// Source-only admission gate for a NEW and SEPARATELY approved B effect:
// orphaned six GitHub Runner.Listener processes, graceful stop / existing R6.
// This module is not imported by the installed maintenance agent and has no
// CLI, Windows process control, lease mutation, network, or install effect.
import {createHash} from 'node:crypto';

export const ORPHAN_SIX_B_TITLE='pc-controller-orphan-six-graceful-once';
export const ORPHAN_SIX_B_OPERATION='controller-orphan-six-graceful-once';
export const ORPHAN_SIX_B_REQUEST_SCHEMA='ZGMINI_PC_ORPHAN_SIX_B_REQUEST_V1';
export const ORPHAN_SIX_B_MANIFEST_SCHEMA='ZGMINI_PC_ORPHAN_SIX_B_APPROVAL_V1';
export const ORPHAN_SIX_B_SCOPE='SEPARATELY_APPROVED_ORPHAN_GRACEFUL_SIX_B';
const REPO='ansqhd5774-Choi/zgmini-pc-control',ACTOR='ansqhd5774-Choi';
const reqId=/^pc-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).sort().join(',')===
 [...keys].sort().join(',');
const deny=code=>Object.freeze({status:'BLOCKED',code,
 permission:false,actuationAllowed:false,runnerStopAuthorized:false,
 operationalWrites:0,automaticRetries:0,canInstall:false});
const candidate=(code,extra={})=>Object.freeze({...deny(code),
 status:'CANDIDATE_ONLY',...extra});
const requestKeys=['schema','operation','controlRepository','requestId',
 'chatId','targetControllerSha','approvalManifestSha256'];
const manifestKeys=['schema','operation','requestId','installedControllerSha',
 'installedMaintainerSha','maintenanceFilesSha256','watchdogSourceSha256',
 'oldOwnerRawSha256','heartbeatRawSha256','hostRawSha256',
 'privateOriginalSixSeatDigestSha256','approval','effect'];
const effect=Object.freeze({
 mode:'SIX_ORPHAN_LISTENER_GRACEFUL_STOP_ONCE',
 stop:'EXACT_PINNED_PRIVATE_ORIGINAL_SIX_ONLY',
 signal:'CTRL_BREAK_ON_EXCLUSIVE_PINNED_CONSOLE_ONLY',
 independentMaintainer:true,
 preserveControllerBPolicy:true,
 noForceKill:true,
 noAutomaticRetry:true,
 requireDrainedJobs:true,
 requireWatchdogFenced:true,
 requireOriginalCAS:true,
 requireCrashSafeJournal:true,
 postcheck:'FRESH_R6_HEALTHY_STANDBY_2_READY_AND_RUNNER_SMOKE'
});
export const ORPHAN_SIX_B_FIXED_EFFECT=effect;
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function sanitized(x){return typeof x==='string'&&x.length>0&&x.length<=128&&
 /^[A-Za-z0-9:_-]+$/.test(x);}
function fail(code){throw Object.assign(Error(code),{code});}
export function validateOrphanSixBRequest(request,{actor=null,repo=REPO}={}){
 if(actor!==ACTOR||repo!==REPO)fail('ORPHAN_SIX_REQUEST_ACTOR_DENIED');
 if(!exact(request,requestKeys)||request.schema!==ORPHAN_SIX_B_REQUEST_SCHEMA||
    request.operation!==ORPHAN_SIX_B_OPERATION||
    request.controlRepository!==REPO||!reqId.test(request.requestId??'')||
    !sanitized(request.chatId)||!sha40(request.targetControllerSha)||
    !sha64(request.approvalManifestSha256))
  fail('ORPHAN_SIX_REQUEST_SCHEMA_DENIED');
 return Object.freeze({...request});
}
// The canonical approved raw bytes must be committed to main and tied to the
// independently authenticated PR identity. Neither JSON fields nor a valid
// Issue can self-approve a B effect. The result remains CANDIDATE_ONLY.
export function validateOrphanSixBManifest(request,bytes,{
 actor=null,repo=REPO,approvalPr=null
}={}){
 const checked=validateOrphanSixBRequest(request,{actor,repo});
 if(!(Buffer.isBuffer(bytes)||typeof bytes==='string')||
    Buffer.byteLength(bytes)<2||Buffer.byteLength(bytes)>16384)
  fail('ORPHAN_SIX_B_MANIFEST_BYTES_INVALID');
 const raw=Buffer.from(bytes);
 if(digest(raw)!==checked.approvalManifestSha256)
  fail('ORPHAN_SIX_B_MANIFEST_RAW_DIGEST_MISMATCH');
 let m;
 try{m=JSON.parse(raw.toString('utf8'));}catch{
  fail('ORPHAN_SIX_B_MANIFEST_JSON_INVALID');
 }
 if(!exact(m,manifestKeys)||m.schema!==ORPHAN_SIX_B_MANIFEST_SCHEMA||
    m.operation!==ORPHAN_SIX_B_OPERATION||
    m.requestId!==checked.requestId||
    m.installedControllerSha!==checked.targetControllerSha||
    !sha40(m.installedControllerSha)||!sha40(m.installedMaintainerSha)||
    !sha64(m.maintenanceFilesSha256)||!sha64(m.watchdogSourceSha256)||
    !sha64(m.oldOwnerRawSha256)||!sha64(m.heartbeatRawSha256)||
    !sha64(m.hostRawSha256)||!sha64(m.privateOriginalSixSeatDigestSha256))
  fail('ORPHAN_SIX_B_MANIFEST_CAS_DENIED');
 if(!exact(m.effect,Object.keys(effect))||
    Object.entries(effect).some(([key,value])=>m.effect[key]!==value))
  fail('ORPHAN_SIX_B_EFFECT_SCOPE_DENIED');
 const ap=m.approval;
 if(!exact(ap,['approved','grade','scope','ref','reviewedSourceSha'])||
    ap.approved!==true||ap.grade!=='B'||ap.scope!==ORPHAN_SIX_B_SCOPE||
    !sha40(ap.reviewedSourceSha)||
    !/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/[1-9]\d*$/.test(ap.ref??''))
  fail('ORPHAN_SIX_B_SEPARATE_APPROVAL_REQUIRED');
 const prNum=Number(ap.ref.split('/').at(-1));
 if(!approvalPr||approvalPr.number!==prNum||
    approvalPr.state!=='closed'||approvalPr.merged!==true||
    approvalPr.headSha!==ap.reviewedSourceSha||
    approvalPr.baseRepo!==REPO||
    approvalPr.reviewedByOwner!==true)
  fail('ORPHAN_SIX_B_APPROVAL_PR_IDENTITY_UNVERIFIED');
 // Do not expose private pins. Return only the raw approval identifier.
 return candidate('ORPHAN_SIX_B_EXACT_APPROVAL_SOURCE_CANDIDATE',{
  requestId:checked.requestId,manifestRawSha256:digest(raw),
  scope:ORPHAN_SIX_B_SCOPE,
  installedControllerSha:m.installedControllerSha,
  installedMaintainerSha:m.installedMaintainerSha,
  approvalPrNumber:prNum
 });
}

// A second boundary after source/approval validation: exact current private
// same-host state. Even a structurally positive record is NOT an operating-PC
// authorization. The installed B receiver must attest its own origin/lease,
// a frozen one-use claim, and the real Windows API at actual effect time.
export function assessOrphanSixBPrivatePreflight(candidateApproval,live,{
 now=Date.now()
}={}){
 if(candidateApproval?.status!=='CANDIDATE_ONLY'||
    candidateApproval.code!=='ORPHAN_SIX_B_EXACT_APPROVAL_SOURCE_CANDIDATE'||
    !sha64(candidateApproval.manifestRawSha256))
  return deny('ORPHAN_SIX_B_APPROVAL_SOURCE_NOT_VERIFIED');
 if(!obj(live)||live.source!=='PRIVATE_INDEPENDENT_WINDOWS_B'||
    live.host!=='PC'||live.installedMaintainerSha!==candidateApproval.installedMaintainerSha||
    live.installedControllerSha!==candidateApproval.installedControllerSha||
    live.verifiedMaintainerOrigin!==true||live.oneUseEffectClaimHeld!==true||
    live.currentInstallLeaseOwned!==true||live.oldOwnerDeadVerified!==true||
    live.originalSixSeatIdentityPinned!==true||live.exclusiveSixConsolesVerified!==true||
    live.currentWorkerCount!==0||live.relatedLeaseCount!==0||
    live.completeLeaseEnumerationVerified!==true||
    live.intakePausedAndDrainedVerified!==true||
    live.watchdogInFlightRecoveryExcludedVerified!==true||
    live.originalRawCASUnchangedVerified!==true||
    live.controllerBPolicyUnchangedVerified!==true||
    typeof live.observedAtUtc!=='string'||
    !Number.isFinite(Date.parse(live.observedAtUtc))||
    !Number.isFinite(now)||Date.parse(live.observedAtUtc)>now||
    now-Date.parse(live.observedAtUtc)>5000)
  return deny('ORPHAN_SIX_B_LIVE_OWNER_CAS_FENCE_UNVERIFIED');
 return candidate('ORPHAN_SIX_B_SAME_HOST_PREFLIGHT_CANDIDATE',{
  requestId:candidateApproval.requestId,
  manifestRawSha256:candidateApproval.manifestRawSha256,
  nextAction:'INSTALLED_INDEPENDENT_B_ONE_USE_EFFECT_CLAIM_AND_FRESH_ATTESTATION_REQUIRED'
 });
}
