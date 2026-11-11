// #996 Windows archive adapter DESIGN CANDIDATE — SOURCE/TEST ONLY.
// NEVER invokes .NET Directory.Move, PowerShell, CMD or an original PC path.
// The exact immutable, consent-bound Windows implementation is separate work.
// .NET Directory.Move is only a candidate native primitive. Base WinPE is
// NOT assumed to contain .NET/PowerShell; verify the chosen image's optional
// components or select a separately pinned Win32 mover before C consent.
// A WinPE drive letter is never accepted as a volume identity.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:\\ZGmini';
const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const LEASES='E:\\ZGmini\\automation\\pc-maintenance\\leases';
const READY='READY_TO_RELEASE_INSTALL.json';
const H64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const error=code=>Object.freeze({status:'C_996_WINDOWS_ARCHIVE_TEST_BLOCKED',
  code,productionExecutable:false,executionAuthorized:false,
  workflowPuts:0,issuePosts:0,pcRetries:0});

/** This only constructs an unexecutable, immutable Windows path contract. */
export function plan996WindowsArchive(continuationId){
  need(UUID(continuationId),
    'C_996_WINDOWS_ARCHIVE_NEW_ID_INVALID');
  // controller-install is the ONLY canonical installation lock recognized by
  // maintenance-lock. Its archive MUST be the final state-changing move.
  const dirs=[
    ['oldC',`${LEASES}\\controller-recovery`,
      `${LEASES}\\controller-recovery-archived-${ORIGINAL}`],
    ['continuation',`${LEASES}\\controller-recovery-continuation-${continuationId}`,
      `${LEASES}\\controller-recovery-continuation-archived-${continuationId}`],
    ['install',`${LEASES}\\controller-install`,
      `${LEASES}\\controller-install-recovered-${ORIGINAL}`],
  ];
  const steps=dirs.map(([name,from,to])=>{
    need(path.win32.dirname(from)===LEASES&&
      path.win32.dirname(to)===LEASES&&
      path.win32.parse(from).root===path.win32.parse(to).root&&
      from!==to,'C_996_WINDOWS_ARCHIVE_PATH_UNSAFE');
    return Object.freeze({name,source:from,destination:to,
      intendedNativeOperation:'DOTNET_DIRECTORY_MOVE_NO_REPLACE'});
  });
  return Object.freeze({schema:'ZGMINI_CONTROLLER_996_WINDOWS_ARCHIVE_PLAN_V1',
    root:ROOT,originalRequestId:ORIGINAL,continuationId,
    steps:Object.freeze(steps),productionExecutable:false,
    executionAuthorized:false});
}

/**
 * Review the requested exclusion mechanism without touching a volume or
 * declaring caller-provided observations to be live OS evidence.
 */
export function plan996OfflineRecovery({continuationId,method}={}){
  const plan=plan996WindowsArchive(continuationId);
  const common={
    schema:'ZGMINI_CONTROLLER_996_OFFLINE_METHOD_REVIEW_V1',
    originalRequestId:ORIGINAL,continuationId,
    intendedCompletion:'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED',
    steps:plan.steps,executionAuthorized:false,productionExecutable:false,
    pcTopology:Object.freeze({physicalPcCount:2,
      existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
      recoveryBootPc:'기존 ZGMINI PC',bootEnvironment:'WinPE',
      additionalPcRequired:false}),
    operationalWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0,
  };
  if(method==='LOCK_VOLUME_THEN_PATH_RENAME'){
    return Object.freeze({...common,status:'UNSUPPORTED_METHOD',
      code:'C996_VOLUME_LOCK_DISALLOWS_PATH_RENAME',
      reason:'OPEN_FILES_PREVENT_LOCK_AND_LOCKED_VOLUME_REQUIRES_VOLUME_HANDLE_IO'});
  }
  if(method==='DISMOUNT_WITHOUT_EXCLUSIVE_HOST'){
    return Object.freeze({...common,status:'UNSUPPORTED_METHOD',
      code:'C996_DISMOUNT_IS_NOT_EXCLUSIVE',
      reason:'OTHER_ACCESS_CAN_REMOUNT_THE_VOLUME'});
  }
  if(method!=='EXISTING_ZGMINI_PC_WINPE_BOOT'){
    return Object.freeze({...common,status:'OWNER_DECISION_REQUIRED',
      code:'C996_OFFLINE_METHOD_NOT_SELECTED'});
  }
  const twoBootReview=plan996TwoBootRecovery(continuationId);
  return Object.freeze({...common,status:'OWNER_DECISION_REQUIRED',
    code:'C996_EXISTING_ZGMINI_PC_WINPE_APPROVAL_REQUIRED',
    // The legacy one-session three-move path collides with the online C claim.
    // Retain it as rejected history; expose ONLY two-boot moves as the proposal.
    legacySingleSessionSteps:plan.steps,
    steps:Object.freeze(twoBootReview.phases.flatMap(phase=>phase.moves)),
    twoBootReview,
    singleBootAlternative:plan996SingleBootRecovery(continuationId),
    selectedBootImageVerified:false,nativeMoverSelected:false,
    winPePowerShellAssumed:false,driveLetterTrusted:false,
    ownerDecisions:Object.freeze([
      'STOP_ORIGINAL_WINDOWS_WRITERS_AND_APPROVE_DOWNTIME',
      'SELECT_EXISTING_ZGMINI_PC_WINPE_WITH_SOLE_VOLUME_ACCESS',
      'INSPECT_BOOT_IMAGE_POWER_SHELL_DOTNET_OR_NATIVE_WIN32_CAPABILITY',
      'PIN_VOLUME_ID_AND_SERIAL_WITHOUT_ASSUMING_DRIVE_LETTER',
      'APPROVE_EXACT_SIGNED_TOOL_AND_OFFLINE_CONSENT_VERIFICATION',
      'PRESERVE_LIVE_OWNER_REVOCATION_CHECK_OR_APPROVE_EXACT_OFFLINE_VALIDITY',
    ]),
    preservation:Object.freeze(['VOLUME_ID','FILE_IDS','SHA256','ACL','PATH_MAPPING']),
    onlineReadbackRequired:Object.freeze(['ORIGINAL_CONTROLLER','PROTECTED_WRITER',
      'PC_JOB_WORKFLOW','CLOSED_BACKLOG','FOUR_ORIGINAL_JOB_DISPOSITIONS']),
    nextEffect:'NONE_UNTIL_EXACT_OWNER_SCOPE_AND_NATIVE_PROOF',
  });
}

// Source-only proposal: two WinPE boots on the SAME existing ZGMINI PC.
// Never use this proposal as a C execution/Owner-consent port.
export function plan996TwoBootRecovery(continuationId){
  const legacy=plan996WindowsArchive(continuationId);
  const oldC=Object.freeze({...legacy.steps[0],
    destination:`${LEASES}\\controller-recovery-interrupted-${ORIGINAL}`});
  const ownC=Object.freeze({name:'ownC',source:legacy.steps[0].source,
    destination:`${LEASES}\\controller-recovery-archived-${ORIGINAL}`,
    intendedNativeOperation:'DOTNET_DIRECTORY_MOVE_NO_REPLACE'});
  const install=legacy.steps[2];
  // The old single-session destination is also the new online claim's
  // archive path. Reusing it causes C_RECOVERY_ALREADY_ARCHIVED_OR_COMPLETED.
  need(oldC.destination!==ownC.destination&&
    path.win32.dirname(oldC.destination)===LEASES&&
    path.win32.dirname(ownC.destination)===LEASES,
    'C996_TWO_BOOT_CLAIM_ARCHIVE_COLLISION');
  const pc='기존 ZGMINI PC';
  const phases=[
    {id:'WINPE_FIRST_BOOT',pc,os:'WinPE',moves:[oldC],
      workflow:'READBACK_NO_MUTATION',installLease:'HELD'},
    {id:'ORIGINAL_WINDOWS_RESTORE',pc,os:'Windows',moves:[],
      workflow:'GET_VERIFY_ACTIVE_OR_STOP_NO_UNAPPROVED_PUT',
      backlog:'GET_VERIFY_CLOSED_OR_STOP_NO_UNAPPROVED_WRITE',
      originalJobs:'GET_VERIFY_FOUR_NO_AUTO_REPLAY',
      admission:'PROVE_GITHUB_PC_JOB_ADMISSION_FENCE_OR_STOP',
      handoff:'READY_FOR_SECOND_BOOT',installLease:'HELD'},
    // Keep the canonical install admission barrier until every C claim is
    // archived. The install lease MUST be the final state-changing move.
    {id:'WINPE_SECOND_BOOT',pc,os:'WinPE',moves:[ownC,install],
      requires:'SIGNED_BOOT_EPOCH_NONCE_SOURCE_PINS_AND_ONLINE_HANDOFF',
      installLease:'ARCHIVE_AFTER_ONLINE_READY'},
    {id:'ORIGINAL_WINDOWS_READBACK',pc,os:'Windows',moves:[],
      requires:'ORIGINAL_CONTROLLER_WORKFLOW_BACKLOG_PROTECTED_FILES_AND_JOB_RECEIPTS',
      installLease:'ARCHIVED'},
  ].map(p=>Object.freeze({...p,moves:Object.freeze(p.moves)}));
  return Object.freeze({schema:'ZGMINI_CONTROLLER_996_TWO_BOOT_REVIEW_V1',
    status:'SOURCE_ONLY_NOT_EXECUTABLE',executionAuthorized:false,
    productionExecutable:false,physicalPcCount:2,additionalPcRequired:false,
    existingPcName:pc,queuePcName:'공통 대기열 PC',winpeBootCount:2,
    phases:Object.freeze(phases),oldClaimArchive:oldC,
    newClaimArchive:ownC,installArchive:install,
    selectedBootImageVerified:false,nativeMoverSelected:false,
    winPePowerShellAssumed:false,driveLetterTrusted:false,
    verifiedVolumeIdentity:null,
    legacySingleSessionPlanExecutable:false,
    currentOperatorCompatible:false,
    currentOperatorBlockers:Object.freeze([
      'C_OWNER_OPERATOR_PREIMPORT_HARD_STOP',
      'ONLINE_PREFLIGHT_REQUIRES_OLD_C_CLAIM_AT_ORIGINAL_PATH',
      'CURRENT_OWNER_CONSENT_FORBIDS_NEW_WORKFLOW_AND_BACKLOG_WRITES',
      'ACTIVE_PC_JOB_ISSUE_ADMISSION_FENCE_NOT_PROVEN',
      'READY_FOR_SECOND_BOOT_DURABLE_SIGNED_HANDOFF_NOT_IMPLEMENTED',
    ]),
    ownerApprovalRequired:true,onlineAdmissionProofRequired:true,
    bootHandoffSignatureRequired:true,sourceLockRequired:true,
    originalPcWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0,
  });
}

// Alternative with ONE WinPE boot on the existing ZGMINI PC. The online
// preparation effects are NOT granted by this pure plan: they require a new
// exact C Owner scope and an independently proven pc-job admission fence.
export function plan996SingleBootRecovery(continuationId){
  const legacy=plan996WindowsArchive(continuationId);
  const oldC=Object.freeze({...legacy.steps[0],
    destination:`${LEASES}\\controller-recovery-interrupted-${ORIGINAL}`});
  const continuation=legacy.steps[1],install=legacy.steps[2];
  need(new Set([oldC.destination,continuation.destination,
    install.destination]).size===3&&
    [oldC,continuation,install].every(step=>
      path.win32.dirname(step.source)===LEASES&&
      path.win32.dirname(step.destination)===LEASES),
    'C996_SINGLE_BOOT_ARCHIVE_PATH_UNSAFE');
  const pc='기존 ZGMINI PC';
  const phases=[
    {id:'ORIGINAL_WINDOWS_PREPARE',pc,os:'Windows',moves:[],
      originalOldClaim:'RETAIN_UNTIL_WINPE',installLease:'HELD',
      continuation:'NEW_DISJOINT_C_CLAIM_ONLY_WITH_EXACT_OWNER_APPROVAL',
      workflow:'GET_VERIFY_ACTIVE_OR_STOP_NO_UNAPPROVED_PUT',
      backlog:'GET_VERIFY_CLOSED_OR_STOP_NO_UNAPPROVED_WRITE',
      jobs:'GET_VERIFY_FOUR_NO_AUTO_REPLAY',
      admission:'DRAIN_MATCHING_RUNNERS_THEN_OFFLINE_KEEP_WORKFLOW_ACTIVE',
      handoff:'SIGNED_DURABLE_READY_FOR_FINAL_WINPE_REQUIRED'},
    {id:'WINPE_SINGLE_BOOT',pc,os:'WinPE',
      moves:[oldC,continuation,install],
      requires:'OFFLINE_OWNER_APPROVAL_SOURCE_PINS_VOLUME_ID_AND_SIGNED_READY',
      installLease:'HELD_UNTIL_LAST_MOVE'},
    {id:'ORIGINAL_WINDOWS_READBACK',pc,os:'Windows',moves:[],
      requires:'CONTROLLER_PROTECTED_ITEMS_WORKFLOW_BACKLOG_JOBS_AND_ARCHIVE_RECEIPTS',
      runner:'REMAIN_OFFLINE_UNTIL_POSTCHECK_AND_RESUME_WITHIN_24H',
      installLease:'ARCHIVED'},
  ].map(phase=>Object.freeze({...phase,moves:Object.freeze(phase.moves)}));
  return Object.freeze({schema:'ZGMINI_CONTROLLER_996_SINGLE_WINPE_BOOT_REVIEW_V1',
    status:'SOURCE_ONLY_NOT_EXECUTABLE',executionAuthorized:false,
    productionExecutable:false,physicalPcCount:2,additionalPcRequired:false,
    existingPcName:pc,queuePcName:'공통 대기열 PC',winpeBootCount:1,
    phases:Object.freeze(phases),oldClaimArchive:oldC,
    continuationArchive:continuation,installArchive:install,
    currentOperatorCompatible:false,
    // WinPE base image does not guarantee .NET/PowerShell modules, and E:
    // from original Windows does not establish WinPE volume identity.
    selectedBootImageVerified:false,nativeMoverSelected:false,
    winPePowerShellAssumed:false,driveLetterTrusted:false,
    bootCapabilityDecision:'OWNER_MUST_PIN_AND_VERIFY_CHOSEN_WINPE_IMAGE',
    verifiedVolumeIdentity:null,
    admissionReviewModule:'tools/controller-996-offline-admission-review.mjs',
    githubQueueMaxHours:24,
    currentOperatorBlockers:Object.freeze([
      'C_OWNER_OPERATOR_PREIMPORT_HARD_STOP',
      'NEW_OWNER_SCOPE_AND_SIGNED_OFFLINE_HANDOFF_MISSING',
      'REAL_PC_JOB_ADMISSION_FENCE_NOT_PROVEN',
    ]),
    originalPcWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0,
    originalRequestRetries:0,automaticRetry:false,
  });
}

// Synthetic trace review only. Caller assertions are NOT runtime evidence.
export function simulate996TwoBootRecovery({continuationId,events=[]}={}){
  const plan=plan996TwoBootRecovery(continuationId);
  const fail=(code,completed=0)=>Object.freeze({status:'SYNTHETIC_BLOCKED',
    code,completed,installLeaseReleaseAuthorized:false,
    executionAuthorized:false,operationalWrites:0,automaticRetry:false,
    evidenceAuthenticated:false,ownerApprovalVerified:false,
    signatureCryptographicallyVerified:false});
  if(!Array.isArray(events)||events.length>4)
    return fail('C996_TWO_BOOT_EVENTS_INVALID');
  const seenBootEpochs=new Set();
  let onlineNonce=null,readySha=null,sourceSha=null;
  for(let i=0;i<events.length;i++){
    const e=events[i];
    if(!e||e.phase!==plan.phases[i].id)
      return fail('C996_TWO_BOOT_PHASE_ORDER_INVALID',i);
    if(typeof e.bootEpoch!=='string'||e.bootEpoch.length<8||
      seenBootEpochs.has(e.bootEpoch))
      return fail('C996_TWO_BOOT_BOOT_EPOCH_INVALID',i);
    seenBootEpochs.add(e.bootEpoch);
    if(i===0){
      if(e.oldCArchiveDestination!==plan.oldClaimArchive.destination||
        e.oldCArchived!==true||e.installLeaseHeld!==true||
        !['active','disabled_manually'].includes(e.workflowState)||
        e.workflowPutCount!==0||e.backlogWriteCount!==0)
        return fail('C996_TWO_BOOT_FIRST_BOOT_GUARD_FAILED',i);
    }else if(i===1){
      if(e.installLeaseHeld!==true||e.workflowState!=='active'||
        e.backlogClosed!==true||e.fourJobsVerified!==true||
        e.admissionProtected!==true||e.workflowPutCount!==0||
        e.backlogWriteCount!==0||e.issuePostCount!==0||!UUID(e.ownerNonce)||
        !H64(e.sourceSha256)||!H64(e.readyMarkerSha256))
        return fail('C996_TWO_BOOT_ONLINE_HANDOFF_UNVERIFIED',i);
      onlineNonce=e.ownerNonce;readySha=e.readyMarkerSha256;
      sourceSha=e.sourceSha256;
    }else if(i===2){
      if(e.installLeaseArchived!==true||e.ownClaimArchived!==true||
        e.ownerNonce!==onlineNonce||e.readyMarkerSha256!==readySha||
        e.sourceSha256!==sourceSha||e.signedHandoffVerified!==true||
        e.ownerApprovalFreshOrBoundedVerified!==true)
        return fail('C996_TWO_BOOT_SECOND_BOOT_GUARD_FAILED',i);
    }else if(e.installLeaseArchived!==true||e.ownClaimArchived!==true||
        e.workflowState!=='active'||e.backlogClosed!==true||
        e.controllerUnchanged!==true||e.protectedItemsUnchanged!==true||
        e.fourJobsVerified!==true||e.sourceSha256!==sourceSha){
      return fail('C996_TWO_BOOT_FINAL_READBACK_UNVERIFIED',i);
    }
  }
  return Object.freeze({status:events.length===4?
      'SYNTHETIC_SEQUENCE_REVIEWED_ONLY':'SYNTHETIC_INCOMPLETE',
    completed:events.length,installLeaseReleaseAuthorized:false,
    executionAuthorized:false,operationalWrites:0,automaticRetry:false,
    evidenceAuthenticated:false,ownerApprovalVerified:false,
    signatureCryptographicallyVerified:false});
}

// Synthetic ONE-boot review, not an authorization or a substitute for signed
// handoff verification, WinPE evidence, native file-ID readback, or C Owner
// consent. Every event below is untrusted, caller-supplied test data.
export function simulate996SingleBootRecovery({continuationId,events=[]}={}){
  const plan=plan996SingleBootRecovery(continuationId);
  const fail=(code,completed=0)=>Object.freeze({status:'SYNTHETIC_BLOCKED',
    code,completed,installLeaseReleaseAuthorized:false,
    executionAuthorized:false,operationalWrites:0,automaticRetry:false,
    evidenceAuthenticated:false,ownerApprovalVerified:false,
    signatureCryptographicallyVerified:false});
  if(!Array.isArray(events)||events.length>3)
    return fail('C996_SINGLE_BOOT_EVENTS_INVALID');
  const bootEpochs=new Set();
  let ownerNonce=null,sourceSha=null,readySha=null;
  for(let i=0;i<events.length;i++){
    const e=events[i];
    if(!e||e.phase!==plan.phases[i].id)
      return fail('C996_SINGLE_BOOT_PHASE_ORDER_INVALID',i);
    if(typeof e.bootEpoch!=='string'||e.bootEpoch.length<8||
      bootEpochs.has(e.bootEpoch))
      return fail('C996_SINGLE_BOOT_BOOT_EPOCH_INVALID',i);
    bootEpochs.add(e.bootEpoch);
    if(i===0){
      if(e.oldCAtOriginal!==true||e.installLeaseHeld!==true||
        e.workflowState!=='active'||e.backlogClosed!==true||
        e.fourJobsVerified!==true||e.admissionProtected!==true||
        e.sixMatchingRunnersOffline!==true||e.runnerAutoStartHeld!==true||
        e.workflowPutCount!==0||e.backlogWriteCount!==0||
        e.issuePostCount!==0||!UUID(e.ownerNonce)||
        !H64(e.sourceSha256)||!H64(e.readyMarkerSha256)||
        e.signedHandoffVerified!==true||
        e.ownerApprovalFreshOrBoundedVerified!==true)
        return fail('C996_SINGLE_BOOT_ONLINE_PREPARE_UNVERIFIED',i);
      ownerNonce=e.ownerNonce;sourceSha=e.sourceSha256;
      readySha=e.readyMarkerSha256;
    }else if(i===1){
      if(e.ownerNonce!==ownerNonce||e.sourceSha256!==sourceSha||
        e.readyMarkerSha256!==readySha||
        e.signedHandoffVerified!==true||
        e.ownerApprovalFreshOrBoundedVerified!==true||
        e.bootImageVerified!==true||e.nativeX64MoverVerified!==true||
        e.volumeIdentityPinned!==true||
        e.installLeaseHeldUntilFinalMove!==true||
        !Array.isArray(e.moves)||e.moves.length!==3)
        return fail('C996_SINGLE_BOOT_WINPE_HANDOFF_OR_MOVES_UNVERIFIED',i);
      for(let j=0;j<3;j++){
        const actual=e.moves[j],expected=plan.phases[1].moves[j];
        if(!actual||actual.name!==expected.name||
          actual.source!==expected.source||
          actual.destination!==expected.destination||
          actual.destinationAbsentBefore!==true||
          actual.sourceAbsentAfter!==true||actual.noReplace!==true||
          !/^[a-f0-9]{32}$/.test(actual.sourceFileId)||
          actual.archiveFileId!==actual.sourceFileId||
          !/^[a-f0-9]{16}$/.test(actual.sourceVolumeSerial)||
          actual.archiveVolumeSerial!==actual.sourceVolumeSerial)
          return fail('C996_SINGLE_BOOT_MOVE_ORDER_OR_IDENTITY_FAILED',i);
      }
    }else if(e.installLeaseArchived!==true||
      e.archivesVerified!==true||e.controllerUnchanged!==true||
      e.protectedItemsUnchanged!==true||e.workflowState!=='active'||
      e.backlogClosed!==true||e.fourJobsVerified!==true||
      e.runnerPostcheckBeforeResume!==true||
      e.sourceSha256!==sourceSha){
      return fail('C996_SINGLE_BOOT_FINAL_READBACK_UNVERIFIED',i);
    }
  }
  return Object.freeze({status:events.length===3?
      'SYNTHETIC_SEQUENCE_REVIEWED_ONLY':'SYNTHETIC_INCOMPLETE',
    completed:events.length,installLeaseReleaseAuthorized:false,
    executionAuthorized:false,operationalWrites:0,automaticRetry:false,
    evidenceAuthenticated:false,ownerApprovalVerified:false,
    signatureCryptographicallyVerified:false});
}

const relSafe=x=>typeof x==='string'&&x.length>0&&
  !x.includes('\\')&&!path.isAbsolute(x)&&
  x.split('/').every(p=>p&&p!=='.'&&p!=='..');
function safeDir(root,rel){
  need(relSafe(rel),'C_996_WINDOWS_ARCHIVE_REL_PATH_INVALID');
  let at=root;
  for(const part of [null,...rel.split('/')]){
    if(part!==null)at=path.join(at,part);
    const st=fs.lstatSync(at);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_996_WINDOWS_ARCHIVE_REDIRECT');
  }
  return at;
}
function safeFixtureRoot(root){
  if(typeof root!=='string'||!path.isAbsolute(root))return false;
  const base=path.resolve(os.tmpdir()),resolved=path.resolve(root);
  if(!resolved.startsWith(base+path.sep)||
      !path.basename(resolved).startsWith('zgmini-996-test-'))return false;
  try{
    let current=resolved;
    for(;;){
      const st=fs.lstatSync(current);
      if(!st.isDirectory()||st.isSymbolicLink())return false;
      if(current===base)break;
      current=path.dirname(current);
      if(current.length<base.length)return false;
    }
    return fs.realpathSync.native(resolved)===resolved;
  }catch{return false;}
}
function absent(root,rel){
  safeDir(root,path.posix.dirname(rel));
  const dest=path.join(root,...rel.split('/'));
  try{fs.lstatSync(dest);return false;}
  catch(e){if(e.code==='ENOENT')return true;throw e;}
}
function inventory(root,rel){
  const out=Object.create(null);
  const visit=(base,at)=>{
    for(const name of fs.readdirSync(at).sort()){
      const full=path.join(at,name),stat=fs.lstatSync(full);
      need(!stat.isSymbolicLink(),
        'C_996_WINDOWS_ARCHIVE_CONTENT_REDIRECT');
      const item=base?base+'/'+name:name;
      if(stat.isDirectory())visit(item,full);
      else{
        need(stat.isFile()&&stat.nlink===1&&stat.size>0&&
          stat.size<=2_000_000,
          'C_996_WINDOWS_ARCHIVE_CONTENT_UNSAFE');
        out[item]=sha(fs.readFileSync(full));
      }
    }
  };
  visit('',safeDir(root,rel));
  return out;
}
const sameInventory=(observed,expected)=>
  expected&&typeof expected==='object'&&!Array.isArray(expected)&&
  Object.keys(observed).length===Object.keys(expected).length&&
  Object.entries(observed).every(([p,digest])=>
    Object.hasOwn(expected,p)&&expected[p]===digest&&H64(digest));
function readyToRelease(root,plan,expected){
  need(sameInventory(inventory(root,'archives/oldC'),expected.oldC)&&
    sameInventory(inventory(root,'archives/continuation'),expected.continuation),
  'C_996_WINDOWS_ARCHIVE_PRE_RELEASE_DRIFT');
  const src=path.join(safeDir(root,'archives/continuation'),READY);
  let data,owner;
  try{data=JSON.parse(fs.readFileSync(src,'utf8'));}catch{}
  try{owner=JSON.parse(fs.readFileSync(path.join(
    safeDir(root,'archives/continuation'),'owner.json'),'utf8'));}catch{}
  need(data?.schema==='ZGMINI_996_CONTINUATION_READY_V1'&&
    data.name==='READY_TO_RELEASE_INSTALL'&&
    data.requestId===plan.continuationId&&
    data.originalRequestId===ORIGINAL&&
    data.finalReleasePending===true&&
    data.oldCArchiveOwnerSha256===expected.oldC['owner.json']&&
    data.installOwnerSha256===expected.install['owner.json']&&
    data.installRecoverySha256===expected.install['RECOVERY_REQUIRED.json']&&
    typeof owner?.nonce==='string'&&owner.nonce.length>0&&
    owner.requestId===plan.continuationId&&
    data.ownerNonce===owner.nonce&&
    H64(data.sourceLockSha256),
  'C_996_WINDOWS_ARCHIVE_READY_PROOF_INVALID');
}

/**
 * Test-only fault injection and behavioral contract; `port.moveNoReplace`
 * MUST be supplied by a disposable fixture. Never use this as an operator.
 */
export function simulate996WindowsArchiveAdapter({testOnly=false,root=null,
  plan=null,expected=null,readLive=null,port=null,
  failAfter=null}={}){
  if(!testOnly||process.platform==='win32')return error(
    'C_996_WINDOWS_ARCHIVE_PRODUCTION_DISABLED');
  try{
    need(safeFixtureRoot(root),
    'C_996_WINDOWS_ARCHIVE_FIXTURE_INVALID');
    need(plan?.schema==='ZGMINI_CONTROLLER_996_WINDOWS_ARCHIVE_PLAN_V1'&&
      plan.executionAuthorized===false&&
      JSON.stringify(plan)===JSON.stringify(plan996WindowsArchive(plan.continuationId))&&
      expected&&Object.keys(expected).length===3&&
      typeof readLive==='function'&&
      port&&typeof port.moveNoReplace==='function'&&
      [null,'AFTER_OLD_C','AFTER_CONTINUATION','AFTER_INSTALL'].includes(failAfter),
      'C_996_WINDOWS_ARCHIVE_TEST_PORT_UNVERIFIED');
    const nameMap={oldC:'oldC',install:'install',continuation:'continuation'};
    const local=step=>`leases/${step.name}`;
    const archive=step=>`archives/${step.name}`;
    // Preflight checks ALL three source snapshots; a missing/new archive
    // blocks before any test write, even if only the last step is contested.
    let postReleaseDifferentLeaseObserved=false;
    for(const step of plan.steps){
      need(Object.hasOwn(nameMap,step.name)&&
        sameInventory(inventory(root,local(step)),expected[step.name])&&
        Object.keys(expected[step.name]).length>0,
        'C_996_WINDOWS_ARCHIVE_SOURCE_DRIFT');
      need(absent(root,archive(step)),
        'C_996_WINDOWS_ARCHIVE_DESTINATION_EXISTS');
    }
    for(const step of plan.steps){
      // This is a contract test, not proof of a durable Windows release
      // intent. Every operation before the LAST install move must retain
      // the real canonical admission barrier.
      if(step.name!=='install')need(
        sameInventory(inventory(root,'leases/install'),expected.install),
        'C_996_WINDOWS_ARCHIVE_INSTALL_BARRIER_LOST');
      else readyToRelease(root,plan,expected);
      const state=readLive();
      need(state?.controllerConflictCount===0&&
        state?.writerConflictCount===0&&
        state?.protectionVerified===true&&
        state?.workflowState==='active',
        'C_996_WINDOWS_ARCHIVE_LATE_CONFLICT');
      need(sameInventory(inventory(root,local(step)),expected[step.name]),
        'C_996_WINDOWS_ARCHIVE_SOURCE_CHANGED');
      need(absent(root,archive(step)),
        'C_996_WINDOWS_ARCHIVE_LATE_DESTINATION_EXISTS');
      // Supplied port emulates .NET no-replace semantics in a temp fixture.
      // The production Windows implementation MUST NOT accept a JS port.
      port.moveNoReplace(root,local(step),archive(step));
      const sourceAbsent=absent(root,local(step));
      if(step.name==='install'&&!sourceAbsent){
        // A different canonical directory can appear after #996's final
        // release. This test cannot authenticate the new owner's legitimacy.
        need(!sameInventory(inventory(root,local(step)),expected.install),
          'C_996_WINDOWS_ARCHIVE_ORIGINAL_INSTALL_LEASE_STILL_ACTIVE');
        postReleaseDifferentLeaseObserved=true;
      }
      need((sourceAbsent||step.name==='install')&&
        sameInventory(inventory(root,archive(step)),expected[step.name]),
        'C_996_WINDOWS_ARCHIVE_POSTMOVE_UNKNOWN');
      if((step.name==='oldC'&&failAfter==='AFTER_OLD_C')||
        (step.name==='continuation'&&failAfter==='AFTER_CONTINUATION')||
        (step.name==='install'&&failAfter==='AFTER_INSTALL'))
        need(false,'C_996_WINDOWS_ARCHIVE_INJECTED_INTERRUPTION');
    }
    return Object.freeze({status:'C_996_WINDOWS_ARCHIVE_TEST_ONLY_PASS',
      steps:3,oldCBeforeInstall:true,continuationBeforeInstall:true,
      installArchivedLast:true,
      postReleaseDifferentLeaseObserved,postReleaseOwnerVerified:false,
      productionExecutable:false,executionAuthorized:false,
      workflowPuts:0,issuePosts:0,pcRetries:0});
  }catch(e){return error(/^C_996_WINDOWS_ARCHIVE_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_996_WINDOWS_ARCHIVE_STATE_UNKNOWN');}
}
