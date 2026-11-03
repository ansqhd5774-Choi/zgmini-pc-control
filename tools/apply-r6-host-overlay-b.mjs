// Operator-only B-grade host update primitive. NOT a pc-job operation.
// No executable entrypoint: requires separately audited maintenance lease,
// workflow-pause observation, Windows provenance, and exact B approval record.
// Core SQLite, tasks and existing source bundles are never written.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {R6_SOURCE_FILES,R6_EXACT_SOURCE_SHA,R6_CANONICAL_MANIFEST_SHA256}
  from './stage-r6-host-registration.mjs';

const digest=b=>createHash('sha256').update(b).digest('hex');
const SHA256=/^[a-f0-9]{64}$/;
const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const SEATS=Array.from({length:6},(_,i)=>`zgmini-pc-0${i+1}`);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const readRegular=file=>{
  const s=fs.lstatSync(file);
  if(!s.isFile()||s.isSymbolicLink())fail('R6_B_NON_REGULAR_FILE');
  return fs.readFileSync(file);
};
const fileId=file=>{
  const st=fs.statSync(file,{bigint:true});
  if(!st.isFile())fail('R6_B_DB_NOT_REGULAR');
  return {actual:fs.realpathSync(file),dev:st.dev,ino:st.ino,size:st.size,mtimeNs:st.mtimeNs};
};
const sameId=(x,y)=>Object.keys(x).every(k=>x[k]===y[k]);

function validateProbe(actual){
  if(!actual||actual.workflowState!=='disabled_manually'
    ||actual.installLeaseHeldByThisOperator!==true||actual.inFlightPcJobs!==0
    ||actual.uploadsPending!==0||actual.controlRepository!=='ansqhd5774-Choi/zgmini-pc-control'
    ||!Array.isArray(actual.runners)||actual.runners.length!==6
    ||!SEATS.every(name=>actual.runners.some(x=>x.name===name&&x.online===true&&x.busy===false)))
    fail('R6_B_IDLE_LEASE_NOT_VERIFIED');
  const age=Math.abs(Date.now()-Date.parse(actual.observedAt??''));
  if(!Number.isFinite(age)||age>30000)fail('R6_B_PROBE_STALE');
}

function inspectApproval({approval,hostBytes,proposedHost,stageBundle,corePath,manifestSha256}){
  if(approval?.schema!=='ZGMINI_R6_HOST_B_APPLY_V1'
    ||approval.scope!=='PC_CONTROL_HOST_R6_ONLY'
    ||approval.sourceSha!==R6_EXACT_SOURCE_SHA
    ||approval.sourceManifestSha256!==manifestSha256
    ||!SHA256.test(approval.hostSha256??'')
    ||!SHA256.test(approval.proposedHostSha256??'')
    ||!['hostPath','candidatePath','stageBundle','backupDirectory']
      .every(k=>path.isAbsolute(approval[k]??''))
    ||approval.stageBundle!==stageBundle
    ||digest(hostBytes)!==approval.hostSha256)fail('R6_B_APPROVAL_OR_HOST_CAS_MISMATCH');

  let before;
  try{before=JSON.parse(hostBytes.toString('utf8'));}catch{fail('R6_B_HOST_JSON_INVALID');}
  if(before.schema!=='ZGMINI_PC_HOST_V1'
    ||before.controllerSourceSha!==approval.installedControllerSha
    ||!before.approvedSources||Object.hasOwn(before.approvedSources,R6_EXACT_SOURCE_SHA)
    ||Object.hasOwn(before,'employmentR6CandidatePath'))
    fail('R6_B_HOST_PRECONDITION_CHANGED');

  const expected=structuredClone(before);
  expected.approvedSources[R6_EXACT_SOURCE_SHA]={root:stageBundle,
    branch:'codex/employment-1y-reader-r1',entrypoint:ENTRY,
    manifestSha256};
  expected.employmentR6CandidatePath=approval.candidatePath;
  if(JSON.stringify(expected)!==JSON.stringify(proposedHost))fail('R6_B_HOST_SCOPE_EXPANDED');
  const proposedBytes=Buffer.from(JSON.stringify(proposedHost,null,2)+'\n');
  if(digest(proposedBytes)!==approval.proposedHostSha256)fail('R6_B_PROPOSED_HOST_DRIFT');

  const manifestBytes=readRegular(path.join(stageBundle,'manifest.json'));
  if(digest(manifestBytes)!==manifestSha256)fail('R6_B_MANIFEST_DRIFT');
  let manifest;
  try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{fail('R6_B_MANIFEST_INVALID');}
  const listed=Object.keys(manifest.files??{}).sort();
  if(listed.length!==R6_SOURCE_FILES.length
    ||listed.some((x,i)=>x!==[...R6_SOURCE_FILES].sort()[i]))fail('R6_B_MANIFEST_FILE_SCOPE');
  for(const rel of R6_SOURCE_FILES){
    const source=path.join(stageBundle,'source',rel);
    if(!SHA256.test(manifest.files[rel])||digest(readRegular(source))!==manifest.files[rel])
      fail('R6_B_SOURCE_FILE_DRIFT');
  }

  const core=fileId(corePath),candidate=fileId(approval.candidatePath);
  if(core.actual===candidate.actual||(core.dev===candidate.dev&&core.ino===candidate.ino))
    fail('R6_B_CANDIDATE_CORE_ALIAS');
  return {proposedBytes,core,candidate};
}

function writeNewSynced(file,bytes){
  const fd=fs.openSync(file,'wx');
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

/** Do not wire to a general chat or Runner. The `runtimeProbe` callback must
 * come from a separately validated independent-maintainer lease reader.
 * `windowsProvenance` is an independent signed/verified Windows-origin result,
 * never a field of the user-provided approval JSON. */
function doApply({approval,proposedHost,runtimeProbe,windowsProvenance},
  {allowSyntheticWindows=false,manifestSha256=R6_CANONICAL_MANIFEST_SHA256}={}){
  if(process.platform!=='win32'&&!allowSyntheticWindows)fail('R6_B_WINDOWS_REQUIRED');
  if(windowsProvenance?.verified!==true
    ||windowsProvenance?.sameUserAndSession!==true
    ||windowsProvenance?.maintainerIndependent!==true)fail('R6_B_WINDOWS_ORIGIN_NOT_VERIFIED');
  validateProbe(runtimeProbe?.());
  const hostPath=approval?.hostPath;
  if(!path.isAbsolute(hostPath??''))fail('R6_B_HOST_PATH_INVALID');
  const hostBytes=readRegular(hostPath);
  const initialId=fileId(hostPath);
  let hostObject;
  try{hostObject=JSON.parse(hostBytes.toString('utf8'));}catch{fail('R6_B_HOST_JSON_INVALID');}
  const corePath=path.join(hostObject.dataRoot??'','pc-writer','storage','core.sqlite');
  if(!path.isAbsolute(corePath))fail('R6_B_CORE_PATH_INVALID');
  const checked=inspectApproval({approval,hostBytes,proposedHost,
    stageBundle:approval.stageBundle,corePath,manifestSha256});

  if(fs.existsSync(approval.backupDirectory))fail('R6_B_BACKUP_EXISTS');
  const backupParent=fs.realpathSync(path.dirname(approval.backupDirectory));
  if(path.dirname(approval.backupDirectory)!==backupParent)fail('R6_B_BACKUP_PARENT_ALIAS');
  const pending=path.join(path.dirname(hostPath),
    `.r6-b-pending-${approval.hostSha256.slice(0,16)}.tmp`);
  if(fs.existsSync(pending))fail('R6_B_PENDING_TEMP_EXISTS');
  // Keep both backup and journal; they are operator-local, never uploaded.
  fs.mkdirSync(approval.backupDirectory,{recursive:false});
  const backup=path.join(approval.backupDirectory,'HOST_BEFORE.bytes');
  const ledger=path.join(approval.backupDirectory,'HOST_B_APPLY_JOURNAL.json');
  writeNewSynced(backup,hostBytes);
  if(digest(readRegular(backup))!==approval.hostSha256)fail('R6_B_BACKUP_READBACK_FAILED');
  writeNewSynced(ledger,Buffer.from(JSON.stringify({schema:'R6_B_JOURNAL_V1',
    state:'PREPARED',beforeSha256:approval.hostSha256,
    targetSha256:approval.proposedHostSha256})+'\n'));
  writeNewSynced(pending,checked.proposedBytes);
  if(digest(readRegular(pending))!==approval.proposedHostSha256)
    fail('R6_B_PENDING_READBACK_FAILED');
  validateProbe(runtimeProbe?.());
  if(!sameId(initialId,fileId(hostPath))
    ||digest(readRegular(hostPath))!==approval.hostSha256
    ||!sameId(checked.core,fileId(corePath))
    ||!sameId(checked.candidate,fileId(approval.candidatePath)))
    fail('R6_B_PRE_APPLY_CAS_CHANGED');

  // Same-directory rename is atomic on supported Windows local volumes.
  fs.renameSync(pending,hostPath);
  try{
    if(digest(readRegular(hostPath))!==approval.proposedHostSha256)
      fail('R6_B_POST_APPLY_READBACK_FAILED');
    if(!sameId(checked.core,fileId(corePath))
      ||!sameId(checked.candidate,fileId(approval.candidatePath)))
      fail('R6_B_DB_IDENTITY_CHANGED');
    validateProbe(runtimeProbe?.());
    writeNewSynced(path.join(approval.backupDirectory,'APPLIED.json'),
      Buffer.from(JSON.stringify({status:'APPLIED',newHostSha256:approval.proposedHostSha256})+'\n'));
    return {status:'APPLIED',hostSha256:approval.proposedHostSha256,
      previousHostSha256:approval.hostSha256,sourceSha:R6_EXACT_SOURCE_SHA,
      coreModified:false,candidateModified:false,backupPreserved:true};
  }catch(error){
    try{
      if(digest(readRegular(hostPath))!==approval.proposedHostSha256)
        fail('R6_B_ROLLBACK_TARGET_DRIFT');
      const restore=path.join(path.dirname(hostPath),
        `.r6-b-restore-${approval.hostSha256.slice(0,16)}.tmp`);
      writeNewSynced(restore,readRegular(backup));
      fs.renameSync(restore,hostPath);
      if(digest(readRegular(hostPath))!==approval.hostSha256)
        fail('R6_B_ROLLBACK_UNVERIFIED');
      writeNewSynced(path.join(approval.backupDirectory,'ROLLED_BACK.json'),
        Buffer.from(JSON.stringify({status:'ROLLED_BACK',reason:error.code??'R6_B_POST_APPLY_FAILED'})+'\n'));
      return {status:'ROLLED_BACK',code:error.code??'R6_B_POST_APPLY_FAILED',
        coreModified:false,candidateModified:false,backupPreserved:true};
    }catch{return {status:'RECOVERY_REQUIRED',code:'R6_B_ROLLBACK_UNVERIFIED',
      coreModified:false,candidateModified:false,backupPreserved:true};}
  }
}

/** Production entrypoint: never accepts a test mode or a substituted manifest. */
export function applyPreparedR6HostB(input){return doApply(input);}

/** Isolated non-Windows fixture only; NEVER import into installed operations. */
export function simulateR6HostApplyBFixture(input,fixtureManifestSha256){
  if(!SHA256.test(fixtureManifestSha256??''))fail('R6_B_SYNTHETIC_MANIFEST_HASH_REQUIRED');
  return doApply(input,{allowSyntheticWindows:true,manifestSha256:fixtureManifestSha256});
}
