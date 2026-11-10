// #996 C stage-aware ORIGINAL WINDOWS reader — READ-ONLY, NOT AN OPERATOR.
// Native E: lease inventories, old-claim archive fallback, fixed reservation,
// original 10 hashes, owner PIDs, protection/Workflow and two file identities.
// No lease move, cleanup, retry, mutation or independent C authority.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classify996CPhysicalDisposition} from
  './controller-996-c-physical-disposition-readonly.mjs';
import {create996InstalledGhGetReadOnly} from
  './controller-996-c-installed-gh-get-readonly.mjs';
import {collect996ProtectedItems} from './controller-996-protection-attestation.mjs';
import {review996ProtectedR2Evidence} from './controller-996-r2-evidence-review.mjs';

const ROOT='E:/ZGmini';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const BASE='automation/pc-maintenance';
const LEASES=BASE+'/leases';
const MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED','BACKLOG_CLOSE_ATTEMPTED'];
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const HEX=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const result=(status,code,other={})=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_C_ORIGINAL_STAGE_READONLY_V1',status,code,
  independentAuthentication:false,sourceBytesVerified:false,
  independentWorkflowReadbackVerified:false,
  executionAuthorized:false,
  productionExecutable:false,originalPcWrites:0,workflowPuts:0,
  backlogWrites:0,issuePosts:0,pcRetries:0,cleanupPerformed:false,...other,
});

function directory(root,rel){
  need(typeof rel==='string'&&!path.isAbsolute(rel)&&!rel.includes('\\')&&
    rel.split('/').every(x=>x&&x!=='.'&&x!=='..'),
    'C_STAGE_PATH_INVALID');
  let at=root;
  for(const segment of [null,...rel.split('/')]){
    if(segment!==null)at=path.join(at,segment);
    const st=fs.lstatSync(at);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_STAGE_PARENT_OR_REPARSE_UNSAFE');
  }
  return at;
}
function file(root,rel){
  const full=path.join(directory(root,path.posix.dirname(rel)),
    path.posix.basename(rel));
  const before=fs.lstatSync(full,{bigint:true});
  need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1n&&
    before.size>0n&&before.size<=2_000_000n,'C_STAGE_FILE_UNSAFE');
  const content=fs.readFileSync(full),after=fs.lstatSync(full,{bigint:true});
  const identity=[before.dev,before.ino,before.size,before.mtimeNs,
    before.ctimeNs].map(String);
  need(content.length===Number(before.size)&&same(identity,
    [after.dev,after.ino,after.size,after.mtimeNs,after.ctimeNs].map(String)),
    'C_STAGE_FILE_CHANGED_DURING_READ');
  let value;try{value=JSON.parse(content.toString('utf8'));}catch{}
  need(value&&typeof value==='object'&&!Array.isArray(value),
    'C_STAGE_JSON_INVALID');
  return {sha:sha(content),identity,value};
}
function optionalDir(root,rel){
  const full=path.join(directory(root,path.posix.dirname(rel)),
    path.posix.basename(rel));
  try{const st=fs.lstatSync(full);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_STAGE_LEASE_PATH_UNSAFE');return true;
  }catch(e){if(e?.code==='ENOENT')return false;throw e;}
}
function inventory(root,rel){
  if(!optionalDir(root,rel))return {present:false,files:null,ids:null};
  const names=fs.readdirSync(directory(root,rel)).sort();
  need(names.length>0&&names.length<=7&&names.every(x=>
    /^(?:owner|PREPARED|WORKFLOW_ENABLE_ATTEMPTED|BACKLOG_CLOSE_ATTEMPTED|RECOVERY_REQUIRED|OLD_C_CLAIM_ARCHIVE_ATTEMPTED|READY_TO_RELEASE_INSTALL)\.json$/.test(x)),
  'C_STAGE_LEASE_INVENTORY_UNSAFE');
  const files={},ids={};
  for(const name of names){
    const item=file(root,rel+'/'+name);
    files[name]=item.sha;ids[name]=item.identity;
  }
  return {present:true,files,ids};
}
// R1's authenticated native workflow getter is not separately exported, and
// R1 itself assumes the old C claim still exists. Reusing R1 after archive
// would be false evidence. No approved shared post-archive workflow adapter
// exists, so the real original-Windows stage reader MUST fail closed here.
const nativeWorkflow=()=>
  create996InstalledGhGetReadOnly().readWorkflowStateReadOnly();
const nativeProtected=()=>review996ProtectedR2Evidence(collect996ProtectedItems());
const alive=pid=>{try{process.kill(pid,0);return true;}
  catch(e){return e?.code==='ESRCH'?false:null;}};
function namesFor(id){return {
  oldC:'controller-recovery',
  oldCArchive:`controller-recovery-archived-${REQ}`,
  continuation:`controller-recovery-continuation-${id}`,
  continuationArchive:`controller-recovery-continuation-archived-${id}`,
  install:'controller-install',
  installArchive:`controller-install-recovered-${REQ}`,
};}
function round(root,id,pins,actorPid,readWorkflow,readProtected,isAlive){
  const names=namesFor(id),all=fs.readdirSync(directory(root,LEASES));
  const allowed=new Set([...Object.values(names),
    'controller-recovery-continuation-reservation']);
  need(!all.some(n=>n.startsWith('controller-recovery-continuation-')&&
    !allowed.has(n)),'C_STAGE_FOREIGN_CONTINUATION_PRESENT');
  const full={};
  for(const [key,name] of Object.entries(names))
    full[key]=inventory(root,LEASES+'/'+name);
  const reservation=inventory(root,
    LEASES+'/controller-recovery-continuation-reservation');
  need(reservation.present&&Object.keys(reservation.files).length===1&&
    HEX(pins.reservationOwnerSha256)&&
    reservation.files['owner.json']===pins.reservationOwnerSha256,
    'C_STAGE_FIXED_RESERVATION_MISSING_OR_DRIFT');
  const res=file(root,LEASES+'/controller-recovery-continuation-reservation/owner.json');
  need(res.value.continuationRequestId===id&&
    res.value.originalRequestId===REQ&&
    Number.isSafeInteger(res.value.pid)&&res.value.pid===actorPid&&
    typeof res.value.nonce==='string'&&res.value.nonce.length>=8&&
    isAlive(actorPid)===true,'C_STAGE_RESERVATION_OWNER_NOT_CURRENT');
  const cont=full.continuation.present?'continuation':'continuationArchive';
  const owner=full[cont].present?file(root,
    `${LEASES}/${names[cont]}/owner.json`).value:null;
  need(owner&&owner.requestId===id&&owner.originalRequestId===REQ&&
    owner.nonce===res.value.nonce&&owner.pid===actorPid,
    'C_STAGE_CONTINUATION_OWNER_UNVERIFIED');
  const ready=full[cont].files?.['READY_TO_RELEASE_INSTALL.json']?
    file(root,`${LEASES}/${names[cont]}/READY_TO_RELEASE_INSTALL.json`).value:null;
  const old=full.oldC.present?'oldC':'oldCArchive';
  const inst=full.installArchive.present?'installArchive':'install';
  need(full[old].present&&full[inst].present,
    'C_STAGE_ORIGINAL_CLAIM_OR_INSTALL_MISSING');
  for(const [key,filename,where] of [
    ['oldC','owner.json',old],...MARKERS.map(m=>[m,m+'.json',old]),
    ['installOwner','owner.json',inst],
    ['installRecovery','RECOVERY_REQUIRED.json',inst],
  ])need(HEX(pins.originalPins?.[key])&&
    full[where].files[filename]===pins.originalPins[key],
    'C_STAGE_ORIGINAL_LEASE_SHA_CHANGED');
  const staticPaths={backlog:`${BASE}/backlog/${REQ}.json`,
    installed:'automation/pc-control/host.json',
    stage:`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,
    maintainer:`${BASE}/MAINTENANCE_INSTALL.json`};
  const staticPins={};
  for(const [k,p] of Object.entries(staticPaths)){
    const item=file(root,p);
    need(HEX(pins.originalPins?.[k])&&item.sha===pins.originalPins[k],
      'C_STAGE_STATIC_OR_BACKLOG_SHA_CHANGED');
    staticPins[k]={sha:item.sha,id:item.identity};
  }
  const oldOwner=file(root,`${LEASES}/${names[old]}/owner.json`).value;
  const oldInstall=file(root,`${LEASES}/${names[inst]}/owner.json`).value;
  need(isAlive(oldOwner.pid)===false&&isAlive(oldInstall.pid)===false,
    'C_STAGE_ORIGINAL_OWNER_PID_REACTIVATED');
  const protectedState=readProtected();
  need(protectedState?.status==='CURRENT_PROTECTION_MATCHES_R1',
    'C_STAGE_PROTECTION_UNKNOWN');
  const workflowState=readWorkflow();
  need(workflowState==='active','C_STAGE_WORKFLOW_NOT_ACTIVE');
  const canonicalNewOwner=full.install.present&&
    full.installArchive.present&&
    !same(full.install.files,pins.classifierPins.install);
  return {paths:Object.fromEntries(Object.entries(full).map(([k,v])=>
      [k,{present:v.present,files:v.files}])),
    identities:Object.fromEntries(Object.entries(full).map(([k,v])=>[k,v.ids])),
    staticPins,owner:{requestId:owner.requestId,
      originalRequestId:owner.originalRequestId,nonce:owner.nonce,
      pid:owner.pid},ready,
    reservation:{sha:res.sha,id:res.identity},
    workflowState,protectionFingerprint:protectedState.protectedFingerprint,
    canonicalNewOwner};
}

/** Only a future separately approved operator may use this readback as ONE
 * input to its own fresh move-time gate; this function never approves a move. */
export function inspect996COriginalStageReadOnly({testOnly=false,root=ROOT,
  continuationRequestId,pins,readWorkflow=nativeWorkflow,
  readProtected=nativeProtected,isAlive=alive,actorPid=process.pid,
  betweenReads=null}={}){
  try{
    const at=path.resolve(root),temp=path.resolve(os.tmpdir());
    need(UUID(continuationRequestId)&&pins?.classifierPins&&
      pins?.originalPins&&HEX(pins.reservationOwnerSha256),
      'C_STAGE_INPUT_PINS_INVALID');
    if(testOnly)need(process.platform!=='win32'&&
      at.startsWith(temp+path.sep)&&path.basename(at).startsWith('zgmini-996-test-')&&
      readWorkflow!==nativeWorkflow&&readProtected!==nativeProtected&&
      isAlive!==alive&&Number.isSafeInteger(actorPid),
      'C_STAGE_TEST_PORT_REJECTED');
    else need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
      !process.env.RUNNER_NAME&&readWorkflow===nativeWorkflow&&
      readProtected===nativeProtected&&isAlive===alive&&
      actorPid===process.pid&&betweenReads===null&&
      path.win32.normalize(root).toLowerCase()===
      path.win32.normalize(ROOT).toLowerCase(),
      'C_STAGE_ORIGINAL_WINDOWS_ONLY');
    const first=round(root,continuationRequestId,pins,actorPid,
      readWorkflow,readProtected,isAlive);
    if(testOnly&&betweenReads)betweenReads();
    const second=round(root,continuationRequestId,pins,actorPid,
      readWorkflow,readProtected,isAlive);
    need(same(first,second),'C_STAGE_TWO_SNAPSHOTS_DRIFT');
    // A legitimate NEW controller-install owner may appear after original
    // lease release. Never archive/delete/retry or call it the old owner.
    if(second.canonicalNewOwner)return result(
      'C_STAGE_NEW_INSTALL_OWNER_OBSERVED_READONLY',
      'C_STAGE_POST_RELEASE_NEW_INSTALL_OWNER_UNAUTHENTICATED');
    const classification=classify996CPhysicalDisposition({
      snapshot:{schema:'ZGMINI_CONTROLLER_996_C_PHYSICAL_SNAPSHOT_V1',
        originalRequestId:REQ,continuationRequestId,
        readOnly:true,twoSnapshotsIdentical:true,fresh:true,
        conflicts:{scope:'CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES',
          workflowState:second.workflowState,protectionVerified:true,
          foreignInstallOwnerCount:0,otherContinuationCount:0,
          twoSnapshotsIdentical:true,fresh:true},
        paths:second.paths,continuationOwner:second.owner,ready:second.ready},
      pins:pins.classifierPins,
    });
    need(classification.status==='C_DISPOSITION_SNAPSHOT_CLASSIFIED_ONLY',
      'C_STAGE_DISPOSITION_ORIGINAL_PIN_MISMATCH');
    return result('C_STAGE_LIVE_INVENTORY_READ_ONLY',classification.code,{
      phase:classification.phase,originalWindowsReadback:!testOnly,
      originalFilesPinned:10,twiceIdentical:true,
      fixedReservationOwnerObserved:true,
      installBarrierRetained:second.paths.install.present,
    });
  }catch(e){return result('C_STAGE_READONLY_BLOCKED',
    /^C_STAGE_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
      'C_STAGE_READ_OR_STATE_UNKNOWN');}
}
