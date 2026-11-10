// #996 continuation C preflight consistency review — PURE / SOURCE ONLY.
// All inputs must be independently fetched and authenticated by a future
// operator. This review NEVER authorizes a Windows filesystem mutation.
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ORIGINAL_ISSUES=[1217,1219,1226,1227];
const MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED'];
export const CONTINUATION_EFFECTS=Object.freeze([
  // NEW C-grade scope: proposal owner.json is written, then the proposal is
  // atomically moved to one fixed reservation name and retained forever.
  // This effect is NOT covered by the old phase-scoped #996 approval.
  'CREATE_AND_PRESERVE_FIXED_C_RESERVATION_VIA_ATOMIC_PROPOSAL_MOVE',
  'RESERVE_INDEPENDENT_CONTINUATION_C_CLAIM',
  'WRITE_SCOPED_DURABLE_RECOVERY_MARKERS',
  'ARCHIVE_ABANDONED_C_CLAIM_NO_DELETE',
  'ARCHIVE_INDEPENDENT_CONTINUATION_C_CLAIM',
  'VERIFY_DURABLE_READY_TO_RELEASE_INSTALL',
  'ARCHIVE_ORIGINAL_INSTALL_LEASE_LAST_NO_DELETE',
]);
const HEX=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const COMMIT=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=code=>Object.freeze({schema:'ZGMINI_CONTROLLER_996_C_CONTINUATION_GATE_V1',
  status:'C_CONTINUATION_REVIEW_BLOCKED',code,executionAuthorized:false,
  operationalWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0});

/** Candidate plan validator; an actual operator MUST do fresh physical CAS. */
export function review996ContinuationGate({manifest,manifestProof,consent,physical,
  gitSource,remote,conflicts}={}){
  // Old phase-scoped C approval cannot grant authority to archive the
  // abandoned owner claim or release an install lease in a new process.
  if(manifest?.schema!=='ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1'||
    manifest?.grade!=='C'||manifest.approved!==true||
    manifest.operation!=='ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE'||
    manifest.issueNumber!==996||manifest.originalRequestId!==REQ||
    !UUID(manifest.continuationRequestId)||
    manifest.continuationRequestId===REQ||
    !COMMIT(manifest.operatorCommit)||!HEX(manifest.operatorSha256)||
    !HEX(manifest.bootstrapSha256)||
    !HEX(manifest.packageSha256)||!HEX(manifest.sourceLockSha256)||
    !same(manifest.effects,CONTINUATION_EFFECTS)||
    manifest.workflowPutCount!==0||manifest.backlogWriteCount!==0||
    manifest.originalRequestRetryCount!==0||manifest.issuePostCount!==0)
    return fail('C_CONTINUATION_NEW_EXACT_SCOPE_MANIFEST_REQUIRED');
  // Manifest cannot contain its own SHA-256. A separately verified immutable
  // Git blob and its digest must be pinned by the new consent receipt.
  if(manifestProof?.status!=='IMMUTABLE_GIT_MANIFEST_BYTES_VERIFIED'||
    manifestProof.repository!=='ansqhd5774-Choi/zgmini-pc-control'||
    !COMMIT(manifestProof.gitCommit)||
    !HEX(manifestProof.manifestSha256)||
    manifestProof.contentMatchesCandidate!==true)
    return fail('C_CONTINUATION_MANIFEST_ORIGIN_UNVERIFIED');
  if(consent?.status!=='NEW_CONTINUATION_C_RECEIPT_INDEPENDENTLY_VERIFIED'||
    consent.continuationRequestId!==manifest.continuationRequestId||
    consent.manifestSha256!==manifestProof.manifestSha256||
    !HEX(consent.manifestSha256)||consent.revoked!==false||
    consent.oldConsentReused!==false||
    consent.operatorSha256!==manifest.operatorSha256||
    consent.bootstrapSha256!==manifest.bootstrapSha256||
    consent.packageSha256!==manifest.packageSha256||
    consent.sourceLockSha256!==manifest.sourceLockSha256)
    return fail('C_CONTINUATION_NEW_CONSENT_NOT_INDEPENDENTLY_VERIFIED');
  if(gitSource?.status!=='SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS'||
    gitSource.installed!==38||gitSource.staged!==39||
    gitSource.maintainer!==7||gitSource.total!==84||
    gitSource.executionAuthorized!==false||
    gitSource.originalWindowsReadback!==true)
    return fail('C_CONTINUATION_84_GIT_BYTES_ORIGINAL_PC_NOT_VERIFIED');
  const shaPins=manifest.originalPins;
  if(!shaPins||typeof shaPins!=='object'||Array.isArray(shaPins)||
    !['oldC','installOwner','installRecovery','backlog',
      'installed','stage','maintainer',...MARKERS].every(x=>HEX(shaPins[x]))||
    Object.keys(shaPins).length!==10)
    return fail('C_CONTINUATION_ORIGINAL_PIN_SET_INVALID');
  if(physical?.status!=='FRESH_ORIGINAL_WINDOWS_C_PREWRITE_MATCHES'||
    physical.originalRequestId!==REQ||
    physical.oldCClaimExists!==true||physical.installLeaseExists!==true||
    physical.oldCOwnerAlive!==false||physical.installOwnerAlive!==false||
    physical.newContinuationClaimExists!==false||
    physical.archiveDestinationExists!==false||
    physical.workflowState!=='active'||
    physical.protectionVerified!==true||
    physical.replayCount!==0||physical.replayJournalEmpty!==true||
    physical.markersExact!==true||physical.markerDetailsVerified!==true||
    physical.twoSnapshotsIdentical!==true||
    !same(physical.shaPins,shaPins))
    return fail('C_CONTINUATION_FRESH_PHYSICAL_OR_MARKER_MISMATCH');
  if(remote?.status!=='FRESH_GITHUB_READ_ONLY_RECONCILED'||
    remote.originalIssueNumber!==996||remote.originalRequestId!==REQ||
    remote.workflowState!=='active'||remote.replayDispatches!==0||
    !Array.isArray(remote.originalIssues)||
    !same(remote.originalIssues.map(x=>x.issueNumber).sort((a,b)=>a-b),
      ORIGINAL_ISSUES)||
    remote.originalIssues.some(x=>x.state!=='open'||x.resultVerified!==false||
      x.nextAction!=='OWNER_REPLAN_REVIEW_REQUIRED')||
    remote.originalIssues.length!==4)
    return fail('C_CONTINUATION_ORIGINAL_ISSUE_RECONCILIATION_INVALID');
  // Only maintenance installs and overlapping continuation claims can race
  // the three lease-directory moves. The long-lived maintenance receiver,
  // independent Core tasks, and Writer data/source lanes are NOT global idle
  // requirements. In particular, `writerActiveCount` (when provided for
  // context) must never become a blanket gate for unrelated work.
  // The real operator must independently authenticate these scoped physical
  // observations immediately before each move; this pure review never does.
  if(conflicts?.scope!=='CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES'||
    conflicts?.foreignInstallOwnerCount!==0||
    conflicts?.otherContinuationCount!==0||
    conflicts?.twoSnapshotsIdentical!==true||
    conflicts?.fresh!==true)
    return fail('C_CONTINUATION_SHARED_RESOURCE_CONFLICT_OR_UNKNOWN');
  return Object.freeze({schema:'ZGMINI_CONTROLLER_996_C_CONTINUATION_GATE_V1',
    status:'C_CONTINUATION_EVIDENCE_SHAPES_REVIEWED_ONLY',
    code:'INDEPENDENT_WINDOWS_C_OPERATOR_AND_LIVE_PREWRITE_CAS_REQUIRED',
    sourceFiles:84,originalUnresolvedIssues:4,
    executionAuthorized:false,operationalWrites:0,workflowPuts:0,
    backlogWrites:0,issuePosts:0});
}
