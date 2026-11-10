// #996 C-grade original Windows OWNER operator CANDIDATE — NO CLI.
// This file is not installed, approved or executable in the current project.
// It has no test or synthetic authorization port and never adopts the old
// C owner. Only a NEW independently read, exact Owner approval AND immutable
// local/Git bundle AND fresh original-Windows evidence can cross the write
// boundary. An interruption is STATE_UNKNOWN: no retry, rollback or cleanup.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ROOT='E:/ZGmini';
const NODE='E:/ZGmini/runtime/node.exe';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const PS='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const LEASES=ROOT+'/automation/pc-maintenance/leases';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const LOCAL_LOCK=path.join(DIR,'controller-996-c-native-owner-source-lock.json');
const LOCAL_PACKAGE=path.resolve(DIR,'../artifacts/controller-996/zgmini-996-c-native-owner-package.zip');
const LOCK_REPO='tools/controller-996-c-native-owner-source-lock.json';
const PACKAGE_REPO='artifacts/controller-996/zgmini-996-c-native-owner-package.zip';
const SELF_REPO='tools/controller-996-c-native-owner-operator.mjs';
const FILES=[
  SELF_REPO,
  'tools/controller-996-c-native-trusted-bootstrap.mjs',
  'tools/controller-996-c-installed-gh-get-readonly.mjs',
  'tools/controller-996-native-continuation-consent-reader.mjs',
  'tools/controller-996-original-four-jobs-readonly.mjs',
  'tools/controller-996-continuation-gate.mjs',
  'tools/controller-996-c-original-prewrite-readonly.mjs',
  'tools/controller-996-c-original-stage-readonly.mjs',
  'tools/controller-996-c-physical-disposition-readonly.mjs',
  'tools/controller-996-git-byte-offline-readonly-r4.mjs',
  'tools/controller-996-git-byte-offline-manifest-r4.json',
  'tools/controller-996-interrupted-observer.mjs',
  'tools/controller-996-protection-attestation.mjs',
  'tools/controller-996-r2-evidence-review.mjs',
  'tools/controller-996-windows-archive-adapter.mjs',
  'tools/controller-996-windows-observer.mjs',
];
const sha=x=>createHash('sha256').update(x).digest('hex');
const blobSHA=x=>createHash('sha1').update(Buffer.from(`blob ${x.length}\0`))
  .update(x).digest('hex');
const H40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const H64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const stop=(code,phase='NO_WRITE')=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_OWNER_C_RESULT_V1',
  status:phase==='NO_WRITE'?'BLOCKED_BEFORE_C_WRITE':
    'STATE_UNKNOWN_PRESERVE_ALL_C_CLAIMS',
  code,phase,executionAuthorized:false,automaticRetry:false,
  cleanupPerformed:false,workflowPuts:0,backlogWrites:0,
  issuePosts:0,originalRequestRetries:0,
});
const safeCode=e=>/^C_996_OWNER_[A-Z0-9_]+$/.test(e?.code??'')?
  e.code:'C_996_OWNER_STATE_UNKNOWN';
const rel=x=>typeof x==='string'&&!x.includes('\\')&&
  !path.isAbsolute(x)&&x.split('/').every(p=>p&&p!=='.'&&p!=='..');

function originalWindows(){
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
    !process.env.RUNNER_NAME&&!process.env.GH_HOST&&
    path.win32.normalize(process.execPath).toLowerCase()===
      path.win32.normalize(NODE).toLowerCase(),
  'C_996_OWNER_ORIGINAL_WINDOWS_ONLY');
}
function safeFile(full,limit){
  const st=fs.lstatSync(full);
  need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
    st.size>0&&st.size<=limit,'C_996_OWNER_BUNDLE_FILE_UNSAFE');
  return fs.readFileSync(full);
}
function safeLeaseDirectory(relPath){
  need(relPath===''||rel(relPath),'C_996_OWNER_LEASE_REL_UNSAFE');
  let at=ROOT;
  for(const segment of [null,...('automation/pc-maintenance/leases'+
    (relPath?'/'+relPath:'')).split('/')]){
    if(segment!==null)at=path.join(at,segment);
    const st=fs.lstatSync(at);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_996_OWNER_LEASE_PARENT_REDIRECT');
  }
  return at;
}
function absent(full){
  try{fs.lstatSync(full);return false;}
  catch(e){if(e?.code==='ENOENT')return true;throw e;}
}
function writeOnce(dir,name,data){
  need(/^(?:owner|PREPARED|OLD_C_CLAIM_ARCHIVE_ATTEMPTED|READY_TO_RELEASE_INSTALL)\.json$/.test(name),
    'C_996_OWNER_MARKER_NOT_ALLOWED');
  const bytes=Buffer.from(JSON.stringify(data)+'\n');
  need(bytes.length>0&&bytes.length<=16_384,
    'C_996_OWNER_MARKER_TOO_LARGE');
  const full=path.join(dir,name),fd=fs.openSync(full,'wx',0o600);
  try{fs.writeSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  need(sha(safeFile(full,16_384))===sha(bytes),
    'C_996_OWNER_MARKER_READBACK_DRIFT');
  return sha(bytes);
}
// Native .NET Directory.Move is the no-replace primitive tested on an
// isolated Windows NTFS fixture. Same-parent only. No ExecutionPolicy bypass.
function moveNoReplace(from,to,{files,ownerMode,actorPid=null,nonce=null}){
  const source=path.win32.normalize(from).toLowerCase();
  const target=path.win32.normalize(to).toLowerCase();
  const parent=path.win32.normalize(LEASES).toLowerCase();
  need(path.win32.dirname(source)===parent&&
    path.win32.dirname(target)===parent&&
    source!==target&&source.startsWith(parent+'\\')&&
    target.startsWith(parent+'\\'),
    'C_996_OWNER_MOVE_NOT_SAME_PARENT');
  safeLeaseDirectory(path.basename(from));
  safeLeaseDirectory('');
  need(absent(to),'C_996_OWNER_ARCHIVE_DESTINATION_PRESENT');
  // The source inventory is built only from physically rechecked manifest
  // pins or the new fsynced owner/marker hashes in this module, never a
  // caller-provided permission port. The native child repeats this CAS.
  need(files&&typeof files==='object'&&!Array.isArray(files)&&
    Object.keys(files).length>=1&&Object.keys(files).length<=7&&
    H64(files['owner.json'])&&Object.entries(files).every(([k,v])=>
      /^(?:owner|PREPARED|WORKFLOW_ENABLE_ATTEMPTED|BACKLOG_CLOSE_ATTEMPTED|RECOVERY_REQUIRED|OLD_C_CLAIM_ARCHIVE_ATTEMPTED|READY_TO_RELEASE_INSTALL)\.json$/.test(k)&&
      H64(v))&&
    ['LIVE_NEW','DEAD_OLD','DEAD_INSTALL'].includes(ownerMode)&&
    (ownerMode!=='LIVE_NEW'||
      Number.isSafeInteger(actorPid)&&actorPid>0&&UUID(nonce)),
  'C_996_OWNER_NATIVE_INVENTORY_INVALID');
  const quoted=x=>`'${x.replaceAll("'","''")}'`;
  const quotedSource=quoted(from.replaceAll('/','\\'));
  const destination=quoted(to.replaceAll('/','\\'));
  const fixedParent=quoted(LEASES.replaceAll('/','\\'));
  const json=quoted(JSON.stringify(files));
  const mode=quoted(ownerMode);
  const expectedNonce=quoted(nonce??'');
  const expectedPid=ownerMode==='LIVE_NEW'?actorPid:0;
  // No writes/logs in the native child except the final Directory.Move.
  // SHA, reparse, owner PID/nonce, exact entries and destination are checked
  // inside the child immediately before that move. This is not a proof of
  // hostile-process atomic snapshot isolation; review hold remains intact.
  const script=[
    "$ErrorActionPreference='Stop'",
    `$s=${quotedSource};$d=${destination};$parent=${fixedParent}`,
    `$expect=ConvertFrom-Json -InputObject ${json}`,
    `$mode=${mode};$nonce=${expectedNonce};$actor=${expectedPid}`,
    "if(-not [string]::Equals([IO.Path]::GetDirectoryName($s),$parent,[StringComparison]::OrdinalIgnoreCase) -or -not [string]::Equals([IO.Path]::GetDirectoryName($d),$parent,[StringComparison]::OrdinalIgnoreCase)){throw 'NOT_SAME_PARENT'}",
    "foreach($p in @('E:\\','E:\\ZGmini','E:\\ZGmini\\automation','E:\\ZGmini\\automation\\pc-maintenance',$parent,$s)){ $i=Get-Item -LiteralPath $p -Force -ErrorAction Stop; if(-not $i.PSIsContainer -or (($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)){throw 'REPARSE_OR_NON_DIRECTORY'} }",
    "if($null -ne (Get-Item -LiteralPath $d -Force -ErrorAction SilentlyContinue)){throw 'DEST_EXISTS'}",
    "$expectedNames=@($expect.PSObject.Properties.Name | Sort-Object)",
    "$actualNames=@(Get-ChildItem -LiteralPath $s -Force | ForEach-Object {$_.Name} | Sort-Object)",
    "if($actualNames.Count -ne $expectedNames.Count){throw 'INVENTORY_COUNT'}",
    "for($j=0;$j -lt $actualNames.Count;$j++){if($actualNames[$j] -cne $expectedNames[$j]){throw 'INVENTORY_NAMES'}}",
    "foreach($n in $expectedNames){$f=Join-Path $s $n;$i=Get-Item -LiteralPath $f -Force -ErrorAction Stop;if($i.PSIsContainer -or (($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)){throw 'FILE_REPARSE'};$observed=(Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLowerInvariant();if($observed -cne $expect.$n){throw 'PIN_DRIFT'}}",
    "$owner=Get-Content -LiteralPath (Join-Path $s 'owner.json') -Raw -Encoding UTF8 | ConvertFrom-Json",
    "if($null -eq $owner -or $null -eq $owner.pid -or [int]$owner.pid -le 0){throw 'OWNER_PID_INVALID'}",
    "if($mode -ceq 'LIVE_NEW'){if([int]$owner.pid -ne $actor -or $owner.nonce -cne $nonce -or $null -eq (Get-Process -Id $actor -ErrorAction SilentlyContinue)){throw 'NEW_OWNER_DRIFT'}}",
    "if($mode -ceq 'DEAD_OLD'){if([string]::IsNullOrEmpty($owner.nonce) -or $null -ne (Get-Process -Id ([int]$owner.pid) -ErrorAction SilentlyContinue)){throw 'OLD_OWNER_LIVE'};foreach($n in @('PREPARED.json','WORKFLOW_ENABLE_ATTEMPTED.json','BACKLOG_CLOSE_ATTEMPTED.json')){$marker=Get-Content -LiteralPath (Join-Path $s $n) -Raw -Encoding UTF8 | ConvertFrom-Json;if($marker.ownerNonce -cne $owner.nonce){throw 'OLD_NONCE_DRIFT'}}}",
    "if($mode -ceq 'DEAD_INSTALL' -and $null -ne (Get-Process -Id ([int]$owner.pid) -ErrorAction SilentlyContinue)){throw 'INSTALL_OWNER_LIVE'}",
    "[IO.Directory]::Move($s,$d)",
  ].join(';');
  try{execFileSync(PS,['-NoProfile','-NonInteractive','-Command',script],{
    encoding:'utf8',windowsHide:true,timeout:30_000,
    maxBuffer:100_000,stdio:['ignore','pipe','pipe'],
  });}catch{need(false,'C_996_OWNER_NATIVE_MOVE_UNKNOWN');}
  need(absent(from)&&fs.lstatSync(to).isDirectory(),
    'C_996_OWNER_NATIVE_MOVE_POSTCHECK_UNKNOWN');
}

function gitContentAtCommit(relFile,commit){
  need([...FILES,LOCK_REPO,PACKAGE_REPO].includes(relFile)&&H40(commit),
    'C_996_OWNER_GIT_SOURCE_PATH_INVALID');
  const route=`repos/${REPO}/contents/${relFile}?ref=${commit}`;
  let data;
  try{data=JSON.parse(execFileSync(GH,['api','--method','GET',route],{
    encoding:'utf8',windowsHide:true,timeout:30_000,
    maxBuffer:24_000_000,stdio:['ignore','pipe','pipe'],
  }));}catch{need(false,'C_996_OWNER_GIT_CONTENT_UNAVAILABLE');}
  need(data?.type==='file'&&data.path===relFile&&
    data.encoding==='base64'&&H40(data.sha)&&
    Number.isSafeInteger(data.size)&&data.size>0&&data.size<=16_000_000&&
    typeof data.content==='string',
    'C_996_OWNER_GIT_CONTENT_INVALID');
  const normalized=data.content.replace(/\s/g,'');
  need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized),
    'C_996_OWNER_GIT_BASE64_INVALID');
  const bytes=Buffer.from(normalized,'base64');
  need(bytes.length===data.size&&bytes.toString('base64')===normalized&&
    blobSHA(bytes)===data.sha,'C_996_OWNER_GIT_BYTES_UNVERIFIED');
  return bytes;
}
function checkSourceBundle(manifest,manifestCommitSha){
  const operator=safeFile(fileURLToPath(import.meta.url),2_000_000);
  const packageBytes=safeFile(LOCAL_PACKAGE,16_000_000);
  const lockBytes=safeFile(LOCAL_LOCK,100_000);
  need(sha(operator)===manifest.operatorSha256&&
    sha(packageBytes)===manifest.packageSha256&&
    sha(lockBytes)===manifest.sourceLockSha256,
    'C_996_OWNER_SOURCE_BYTES_NOT_PINNED');
  for(const [relFile,local,commit] of [
    [SELF_REPO,operator,manifest.operatorCommit],
    [LOCK_REPO,lockBytes,manifestCommitSha],
    [PACKAGE_REPO,packageBytes,manifestCommitSha],
  ])need(gitContentAtCommit(relFile,commit).equals(local),
    'C_996_OWNER_GIT_COMMIT_SOURCE_DRIFT');
  let lock;try{lock=JSON.parse(lockBytes.toString('utf8'));}catch{}
  need(lock?.schema==='ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1'&&
    same(Object.keys(lock).sort(),['schema','files'].sort())&&lock.files&&
    same(Object.keys(lock.files).sort(),FILES.slice().sort()),
    'C_996_OWNER_SOURCE_LOCK_SCHEMA_INVALID');
  for(const repoFile of FILES){
    need(H64(lock.files[repoFile]),'C_996_OWNER_SOURCE_LOCK_DIGEST_INVALID');
    const full=path.join(DIR,path.basename(repoFile));
    const local=safeFile(full,2_000_000);
    need(sha(local)===lock.files[repoFile]&&
      gitContentAtCommit(repoFile,manifest.operatorCommit).equals(local),
      'C_996_OWNER_IMPORT_SOURCE_LOCK_DRIFT');
  }
  return {operator,packageBytes,lockBytes};
}

function classifierPins(original,continuation,sourceLockSha256,readySha256){
  const oldC={
    'owner.json':original.oldC,
    'PREPARED.json':original.PREPARED,
    'WORKFLOW_ENABLE_ATTEMPTED.json':original.WORKFLOW_ENABLE_ATTEMPTED,
    'BACKLOG_CLOSE_ATTEMPTED.json':original.BACKLOG_CLOSE_ATTEMPTED,
  };
  const install={'owner.json':original.installOwner,
    'RECOVERY_REQUIRED.json':original.installRecovery};
  return {oldC,install,continuationBeforeReady:continuation,
    readySha256,sourceLockSha256};
}
function phases(continuationId,manifest,reservationOwnerSha256,continuation,
  expected){
  return {continuationRequestId:continuationId,
    pins:{originalPins:manifest.originalPins,reservationOwnerSha256,
      classifierPins:classifierPins(manifest.originalPins,continuation,
        manifest.sourceLockSha256,expected.readySha256)}};
}

// This source deliberately exposes NO testOnly/write port. Only the real
// Windows operator, after owner consent and source readback, may call it.
export async function run996NativeOwnerCOnce({manifestCommitSha}={}){
  let phase='NO_WRITE';
  try{
    originalWindows();
    need(H40(manifestCommitSha),'C_996_OWNER_MANIFEST_COMMIT_REQUIRED');
    // REVIEW HOLD: The dependency import closure has not been independently
    // authenticated before the first dynamic import. The native child now
    // checks pinned source inventory, but its real Windows race behavior and
    // original-PC approval binding have not been verified. This candidate is
    // intentionally NEVER executable, even with a future signed manifest and
    // exact Owner consent. Remove only after separate review and approval.
    need(false,'C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED');
    const [{create996InstalledGhGetReadOnly},
      {create996ContinuationConsentEvidenceReader},
      {create996FourOriginalJobsReadOnlyReader}]=await Promise.all([
      import('./controller-996-c-installed-gh-get-readonly.mjs'),
      import('./controller-996-native-continuation-consent-reader.mjs'),
      import('./controller-996-original-four-jobs-readonly.mjs'),
    ]);
    const consentReader=create996ContinuationConsentEvidenceReader({
      githubReader:create996InstalledGhGetReadOnly()});
    const consent=await consentReader.readOnce({manifestCommitSha});
    let manifest;try{manifest=JSON.parse(consent.rawManifestBytes.toString('utf8'));}
    catch{need(false,'C_996_OWNER_CONSENT_MANIFEST_INVALID');}
    checkSourceBundle(manifest,manifestCommitSha);
    const jobs=await create996FourOriginalJobsReadOnlyReader({
      githubReader:create996InstalledGhGetReadOnly()}).readOnce();
    need(jobs?.status==='FOUR_ORIGINAL_JOBS_UNRESOLVED_GET_ONLY'&&
      jobs.originalIssueCount===4,
      'C_996_OWNER_ORIGINAL_JOBS_UNVERIFIED');
    const [{collect996OriginalCPrewriteReadOnly},
      {inspect996COriginalStageReadOnly},
      {plan996WindowsArchive}]=await Promise.all([
      import('./controller-996-c-original-prewrite-readonly.mjs'),
      import('./controller-996-c-original-stage-readonly.mjs'),
      import('./controller-996-windows-archive-adapter.mjs'),
    ]);
    const preflight=()=>{
      const r=collect996OriginalCPrewriteReadOnly();
      need(r.status==='C_ORIGINAL_PREWRITE_FILE_PINS_OBSERVED_ONLY'&&
        r.originalWindowsReadback===true&&r.filesReadTwice===10&&
        r.sourceBytesReadAgain===84&&r.oldOwnersObservedDead===true&&
        r.backlogReplayCount===0&&r.protectedR1ChecksPassed===14&&
        same(r.pins,manifest.originalPins),
        'C_996_OWNER_FRESH_ORIGINAL_PIN_DRIFT');
    };
    preflight();
    const plan=plan996WindowsArchive(manifest.continuationRequestId);
    need(plan.steps.length===3&&plan.steps[2].name==='install'&&
      plan.originalRequestId===REQ&&
      manifest.effects.includes(
        'CREATE_AND_PRESERVE_FIXED_C_RESERVATION_VIA_ATOMIC_PROPOSAL_MOVE'),
      'C_996_OWNER_ARCHIVE_PLAN_OR_EFFECT_INVALID');
    // Final read-only CAS before the FIRST operating-PC mutation.
    preflight();
    const id=manifest.continuationRequestId,nonce=randomUUID();
    need(UUID(id)&&UUID(nonce),'C_996_OWNER_ID_INVALID');
    const reservationName='controller-recovery-continuation-reservation';
    const proposalName=`controller-recovery-continuation-proposal-${id}`;
    const continuationName=`controller-recovery-continuation-${id}`;
    const fixed=path.join(LEASES,reservationName);
    const proposal=path.join(LEASES,proposalName);
    const continuation=path.join(LEASES,continuationName);
    safeLeaseDirectory('');
    need(absent(fixed)&&absent(proposal)&&absent(continuation),
      'C_996_OWNER_RESERVATION_COLLISION');
    // From here, any failure is STATE_UNKNOWN; NEVER retry or clean up.
    phase='RESERVATION_PROPOSAL';
    fs.mkdirSync(proposal);
    const reservationOwner={schema:'ZGMINI_996_C_FIXED_RESERVATION_OWNER_V1',
      continuationRequestId:id,originalRequestId:REQ,pid:process.pid,
      nonce,at:new Date().toISOString()};
    const reservationOwnerSha256=writeOnce(proposal,'owner.json',reservationOwner);
    moveNoReplace(proposal,fixed,{files:{'owner.json':reservationOwnerSha256},
      ownerMode:'LIVE_NEW',actorPid:process.pid,nonce});
    need(sha(safeFile(path.join(fixed,'owner.json'),16_384))===
      reservationOwnerSha256,'C_996_OWNER_RESERVATION_READBACK_CHANGED');
    phase='CONTINUATION_CLAIM';
    fs.mkdirSync(continuation);
    const at=new Date().toISOString(),claim={
      schema:'ZGMINI_996_CONTINUATION_CLAIM_V1',requestId:id,
      originalRequestId:REQ,pid:process.pid,nonce,at};
    const c={};
    c['owner.json']=writeOnce(continuation,'owner.json',claim);
    c['PREPARED.json']=writeOnce(continuation,'PREPARED.json',{
      schema:claim.schema,requestId:id,originalRequestId:REQ,
      ownerNonce:nonce,sourceLockSha256:manifest.sourceLockSha256,
      originalClaimSha256:manifest.originalPins.oldC,at});
    let readySha256='0'.repeat(64);
    const stage=(expectedPhase)=>{
      const r=inspect996COriginalStageReadOnly(phases(id,manifest,
        reservationOwnerSha256,c,{readySha256}));
      need(r.status==='C_STAGE_LIVE_INVENTORY_READ_ONLY'&&
        r.phase===expectedPhase&&r.originalWindowsReadback===true&&
        r.twiceIdentical===true&&r.sourceBytesVerified===true&&
        r.sourceFilesVerified===84&&r.fixedReservationOwnerObserved===true,
        'C_996_OWNER_LIVE_STAGE_CAS_UNKNOWN');
      return r;
    };
    stage('ORIGINAL_WITH_CONTINUATION_CLAIM_RESERVED');
    // Canonical install lease remains untouched until the FINAL move.
    phase='OLD_C_ARCHIVE';
    c['OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json']=writeOnce(continuation,
      'OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json',{
        schema:claim.schema,requestId:id,ownerNonce:nonce,
        oldClaimSha256:manifest.originalPins.oldC,
        at:new Date().toISOString()});
    stage('ORIGINAL_WITH_CONTINUATION_CLAIM_RESERVED');
    moveNoReplace(plan.steps[0].source,plan.steps[0].destination,{
      files:classifierPins(manifest.originalPins,c,
        manifest.sourceLockSha256,readySha256).oldC,
      ownerMode:'DEAD_OLD'});
    stage('AFTER_OLD_C_ARCHIVED_INSTALL_HELD');
    phase='READY_AND_CONTINUATION_ARCHIVE';
    readySha256=writeOnce(continuation,'READY_TO_RELEASE_INSTALL.json',{
      schema:'ZGMINI_996_CONTINUATION_READY_V1',
      name:'READY_TO_RELEASE_INSTALL',requestId:id,originalRequestId:REQ,
      ownerNonce:nonce,sourceLockSha256:manifest.sourceLockSha256,
      oldCArchiveOwnerSha256:manifest.originalPins.oldC,
      installOwnerSha256:manifest.originalPins.installOwner,
      installRecoverySha256:manifest.originalPins.installRecovery,
      finalReleasePending:true,at:new Date().toISOString(),
    });
    stage('AFTER_OLD_C_ARCHIVED_READY_NOT_YET_ARCHIVED');
    moveNoReplace(plan.steps[1].source,plan.steps[1].destination,{
      files:{...c,'READY_TO_RELEASE_INSTALL.json':readySha256},
      ownerMode:'LIVE_NEW',actorPid:process.pid,nonce});
    stage('AFTER_CONTINUATION_ARCHIVED_READY_INSTALL_HELD');
    phase='INSTALL_ARCHIVE_LAST';
    stage('AFTER_CONTINUATION_ARCHIVED_READY_INSTALL_HELD');
    // New independent GET reader; a deleted/edited/revoked/ambiguous Owner
    // comment after the earlier consent stops the final install move.
    const lastConsent=await create996ContinuationConsentEvidenceReader({
      githubReader:create996InstalledGhGetReadOnly()}).readOnce({
      manifestCommitSha});
    need(lastConsent?.status==='C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY'&&
      lastConsent.consentCommentId===consent.consentCommentId&&
      lastConsent.manifestSha256===consent.manifestSha256&&
      lastConsent.operatorSha256===consent.operatorSha256&&
      lastConsent.bootstrapSha256===consent.bootstrapSha256&&
      lastConsent.sourceLockSha256===consent.sourceLockSha256&&
      lastConsent.packageSha256===consent.packageSha256&&
      lastConsent.rawManifestBytes.equals(consent.rawManifestBytes),
    'C_996_OWNER_FINAL_OWNER_CONSENT_REVOKED_OR_CHANGED');
    checkSourceBundle(manifest,manifestCommitSha);
    stage('AFTER_CONTINUATION_ARCHIVED_READY_INSTALL_HELD');
    moveNoReplace(plan.steps[2].source,plan.steps[2].destination,{
      files:classifierPins(manifest.originalPins,c,
        manifest.sourceLockSha256,readySha256).install,
      ownerMode:'DEAD_INSTALL'});
    // FINAL move above is the last write. Everything below is read-only.
    phase='READONLY_POSTCHECK';
    const result=stage('AFTER_INSTALL_ARCHIVED');
    need(result.installBarrierRetained===false,
      'C_996_OWNER_INSTALL_POSTCHECK_UNKNOWN');
    return Object.freeze({
      schema:'ZGMINI_CONTROLLER_996_NATIVE_OWNER_C_RESULT_V1',
      status:'C_ARCHIVES_POSTCHECKED_ONLY',
      code:'C_RECOVERY_EFFECTS_PERFORMED_NO_AUTOMATIC_JOB_REPLAY',
      sourceLocked:true,ownerConsentReadbackId:consent.consentCommentId,
      completedArchiveMoves:3,fixedReservationPreserved:true,
      originalRequestRetries:0,workflowPuts:0,backlogWrites:0,
      issuePosts:0,automaticRetry:false,cleanupPerformed:false,
    });
  }catch(e){return stop(safeCode(e),phase);}
}
