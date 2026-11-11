// #996 Windows archive adapter DESIGN CANDIDATE — SOURCE/TEST ONLY.
// NEVER invokes .NET Directory.Move, PowerShell, CMD or an original PC path.
// The exact immutable, consent-bound Windows implementation is separate work.
// The intended native primitive is [System.IO.Directory]::Move(source,dest),
// which refuses an already-existing destination and cross-volume moves.
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
  return Object.freeze({...common,status:'OWNER_DECISION_REQUIRED',
    code:'C996_EXISTING_ZGMINI_PC_WINPE_APPROVAL_REQUIRED',
    ownerDecisions:Object.freeze([
      'STOP_ORIGINAL_WINDOWS_WRITERS_AND_APPROVE_DOWNTIME',
      'SELECT_EXISTING_ZGMINI_PC_WINPE_WITH_SOLE_VOLUME_ACCESS',
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
