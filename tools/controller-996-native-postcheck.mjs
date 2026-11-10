// #996 phase-aware read-only physical postcheck. NO CLI, PC writes or Issue
// posts. Does not reuse the original R1 observer after Workflow/Claim changes.
// This physical result alone never authorizes archive, replay or C completion.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {collect996ProtectedItems} from './controller-996-protection-attestation.mjs';
import {review996ProtectedR2Evidence} from './controller-996-r2-evidence-review.mjs';

const ROOT='E:/ZGmini';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ORIGINAL_BACKLOG='d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780';
const ORIGINAL=Object.freeze({
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
 stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
 maintainerManifest:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
});
const MAP=Object.freeze({
 ledger:'automation/pc-maintenance/ledger/'+REQ+'.json',
 controllerHost:'automation/pc-control/host.json',
 stagedHost:'automation/pc-control/backups/controller-update-'+REQ+'/stage/host.json',
 maintainerManifest:'automation/pc-maintenance/MAINTENANCE_INSTALL.json',
 backlog:'automation/pc-maintenance/backlog/'+REQ+'.json',
 own:'automation/pc-maintenance/leases/controller-recovery',
 ownArchived:'automation/pc-maintenance/leases/controller-recovery-archived-'+REQ,
 original:'automation/pc-maintenance/leases/controller-install',
 originalArchived:'automation/pc-maintenance/leases/controller-install-recovered-'+REQ,
});
const PHASES=['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED'];
const SHA=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');
const date=x=>typeof x==='string'?Date.parse(x):NaN;
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const fail=code=>Object.freeze({schema:'ZGMINI_CONTROLLER_996_NATIVE_POSTCHECK_V1',
 status:'POSTCHECK_UNVERIFIED',code,executionAuthorized:false,
 operationalWrites:0,workflowEnables:0,issuePosts:0,pcRetries:0});
function processIsAlive(pid){
 try{process.kill(pid,0);return true;}
 catch(e){return e?.code==='ESRCH'?false:null;}
}
function authenticatedWorkflowRead(){
 const get=route=>JSON.parse(execFileSync(GH,['api','--method','GET',route],{
  windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:1000000}));
 const user=get('user'),repo=get('repos/'+REPO);
 need(user?.login==='ansqhd5774-Choi'&&
  repo?.full_name===REPO&&repo.private===true,
  'C_POSTCHECK_GITHUB_ORIGIN_UNVERIFIED');
 const workflow=get('repos/'+REPO+'/actions/workflows/pc-job.yml');
 return workflow?.state;
}

function read(root,rel){
 need(typeof rel==='string'&&!path.isAbsolute(rel)&&
  !rel.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'),
  'C_POSTCHECK_PATH_UNSAFE');
 let current=root;
 const rootStat=fs.lstatSync(root);
 need(rootStat.isDirectory()&&!rootStat.isSymbolicLink(),
  'C_POSTCHECK_ROOT_REDIRECT');
 for(const part of rel.split('/')){
  current=path.join(current,part);
  need(!fs.lstatSync(current).isSymbolicLink(),'C_POSTCHECK_PATH_REDIRECT');
 }
 const stat=fs.lstatSync(current);
 need(stat.isFile()&&stat.size>0&&stat.size<=2_000_000,
  'C_POSTCHECK_FILE_UNSAFE');
 return fs.readFileSync(current);
}
function absent(root,rel){
 const target=path.join(root,...rel.split('/'));
 try{fs.lstatSync(target);return false;}
 catch(e){if(e?.code==='ENOENT')return true;throw e;}
}
function parse(bytes,code){
 let out;try{out=JSON.parse(bytes.toString('utf8'));}
 catch{need(false,code);}
 need(out&&typeof out==='object'&&!Array.isArray(out),code);
 return out;
}
function claimMarker(root,folder,name,owner){
 const data=parse(read(root,folder+'/'+name+'.json'),'C_POSTCHECK_CLAIM_MARKER_UNREADABLE');
 need(data.schema==='ZGMINI_CONTROLLER_996_C_MARKER_V1'&&
  data.requestId===REQ&&data.issueNumber===996&&
  data.ownerNonce===owner.nonce&&data.name===name&&
  Number.isFinite(date(data.at))&&data.details&&
  typeof data.details==='object'&&!Array.isArray(data.details),
  'C_POSTCHECK_CLAIM_MARKER_INVALID');
 return data;
}
function inspectPhysical({root,phase,expectedRaw,isOldOwnerAlive,
 readWorkflow,readProtected}){
 need(PHASES.includes(phase),'C_POSTCHECK_PHASE_INVALID');
 const oldArchived=phase!=='BACKLOG_CLOSED';
 const ownArchived=phase==='FINAL_ARCHIVED';
 const orig=oldArchived?MAP.originalArchived:MAP.original;
 const own=ownArchived?MAP.ownArchived:MAP.own;
 need((oldArchived?absent(root,MAP.original):absent(root,MAP.originalArchived))&&
  (ownArchived?absent(root,MAP.own):absent(root,MAP.ownArchived)),
  'C_POSTCHECK_UNEXPECTED_LEASE_PATH');
 const originalOwnerBytes=read(root,orig+'/owner.json');
 const recoveryBytes=read(root,orig+'/RECOVERY_REQUIRED.json');
 need(sha(originalOwnerBytes)===expectedRaw.owner&&
  sha(recoveryBytes)===expectedRaw.recoveryMarker,
  'C_POSTCHECK_ORIGINAL_LEASE_HASH_DRIFT');
 const oldOwner=parse(originalOwnerBytes,'C_POSTCHECK_ORIGINAL_OWNER_INVALID');
 need(Number.isSafeInteger(oldOwner.pid)&&oldOwner.pid>0&&
  isOldOwnerAlive(oldOwner.pid)===false,
  'C_POSTCHECK_ORIGINAL_OWNER_ACTIVE_OR_UNKNOWN');
 const ownOwner=parse(read(root,own+'/owner.json'),'C_POSTCHECK_OWN_OWNER_INVALID');
 need(ownOwner.requestId===REQ&&ownOwner.issueNumber===996&&
  Number.isSafeInteger(ownOwner.pid)&&ownOwner.pid>0&&
  typeof ownOwner.nonce==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(ownOwner.nonce),
  'C_POSTCHECK_OWN_CLAIM_IDENTITY_UNVERIFIED');
 const required=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED','BACKLOG_CLOSE_ATTEMPTED'];
 if(oldArchived)required.push('PRE_ARCHIVE','ORIGINAL_LEASE_ARCHIVE_ATTEMPTED');
 if(ownArchived)required.push('COMPLETE','OWN_CLAIM_ARCHIVE_ATTEMPTED');
 const markers=Object.fromEntries(required.map(name=>[
  name,claimMarker(root,own,name,ownOwner)]));
 const close=markers.BACKLOG_CLOSE_ATTEMPTED.details;
 need(close.originalSha===ORIGINAL_BACKLOG&&SHA(close.nextSha)&&
  Number.isFinite(date(close.resumeAt))&&
  close.ownerNonce===ownOwner.nonce,
  'C_POSTCHECK_BACKLOG_INTENT_INVALID');
 if(ownArchived){
  need(markers.COMPLETE.details.status==='INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED',
   'C_POSTCHECK_COMPLETION_MARKER_INVALID');
 }
 const staticDigest={};
 for(const key of ['ledger','controllerHost','stagedHost','maintainerManifest']){
  staticDigest[key]=sha(read(root,MAP[key]));
  need(staticDigest[key]===expectedRaw[key],
   'C_POSTCHECK_ORIGINAL_STATIC_FILE_DRIFT');
 }
 const backlogBytes=read(root,MAP.backlog);
 need(sha(backlogBytes)===close.nextSha,'C_POSTCHECK_BACKLOG_SHA_DRIFT');
 const backlog=parse(backlogBytes,'C_POSTCHECK_BACKLOG_JSON_INVALID');
 need(backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&backlog.requestId===REQ&&
  Array.isArray(backlog.windows)&&backlog.windows.length===1&&
  Number.isFinite(date(backlog.pausedAt))&&
  backlog.resumedAt===close.resumeAt&&
  backlog.windows[0]?.pausedAt===backlog.pausedAt&&
  backlog.windows[0]?.resumedAt===close.resumeAt&&
  date(backlog.resumedAt)>=date(backlog.pausedAt)&&
  backlog.replays&&typeof backlog.replays==='object'&&
  !Array.isArray(backlog.replays)&&
  Object.values(backlog.replays).every(row=>row&&
   ['DONE','SKIPPED_RESULT_PRESENT'].includes(row.status)),
  'C_POSTCHECK_BACKLOG_CLOSE_UNVERIFIED');
 need(readWorkflow()==='active','C_POSTCHECK_WORKFLOW_NOT_ACTIVE');
 const r2=readProtected();
 const protectedReview=review996ProtectedR2Evidence(r2);
 need(protectedReview.status==='CURRENT_PROTECTION_MATCHES_R1'&&
  Number.isFinite(date(r2.observedAt))&&
  date(r2.observedAt)>=date('2026-11-10T04:06:43.338Z'),
  'C_POSTCHECK_PROTECTED_R2_DRIFT');
 // A second read detects drift during the Workflow/Task probes. This is not
 // an OS-level atomic compare-and-swap against uncooperative writers.
 for(const key of ['ledger','controllerHost','stagedHost','maintainerManifest'])
  need(sha(read(root,MAP[key]))===staticDigest[key],
   'C_POSTCHECK_ORIGINAL_CHANGED_DURING_READ');
 need(sha(read(root,MAP.backlog))===close.nextSha,
  'C_POSTCHECK_BACKLOG_CHANGED_DURING_READ');
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_POSTCHECK_V1',
  status:'READONLY_PHASE_PHYSICAL_STATE_MATCHES_PINNED',
  code:'ORIGINAL_GITHUB_DISPOSITION_AND_C_OPERATOR_STILL_REQUIRED',
  phase,requestId:REQ,originalStaticFilesVerified:4,
  originalLeaseHashesVerified:2,protectedTasksEnabled:2,
  protectedFingerprint:protectedReview.protectedFingerprint,
  backlogSha256:close.nextSha,
  pausedAt:backlog.pausedAt,resumedAt:backlog.resumedAt,
  replays:structuredClone(backlog.replays),
  originalLeaseArchived:oldArchived,ownClaimArchived:ownArchived,
  issueReconciliationVerified:false,
  executionAuthorized:false,operationalWrites:0,workflowEnables:0,
  issuePosts:0,pcRetries:0,
 });
}

export function create996NativePostcheck({root=ROOT,testOnly=false,
 expectedRaw=ORIGINAL,readWorkflow=authenticatedWorkflowRead,
 isOldOwnerAlive=processIsAlive,
 readProtected=collect996ProtectedItems}={}){
 if(testOnly){
  need(process.platform!=='win32'&&path.isAbsolute(root)&&
   path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
   path.basename(root).startsWith('zgmini-996-test-')&&
   expectedRaw!==ORIGINAL&&readProtected!==collect996ProtectedItems,
   'C_POSTCHECK_TEST_ONLY_ROOT_OR_PORT_INVALID');
 }else{
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME&&
   path.win32.normalize(root).toLowerCase()===path.win32.normalize(ROOT).toLowerCase()&&
   expectedRaw===ORIGINAL&&readProtected===collect996ProtectedItems&&
   readWorkflow===authenticatedWorkflowRead&&
   isOldOwnerAlive===processIsAlive,
   'C_POSTCHECK_ORIGINAL_WINDOWS_REQUIRED');
 }
 need(expectedRaw&&Object.keys(expectedRaw).length===Object.keys(ORIGINAL).length&&
  Object.keys(ORIGINAL).every(k=>SHA(expectedRaw[k]))&&
  typeof readWorkflow==='function'&&typeof isOldOwnerAlive==='function'&&
  typeof readProtected==='function','C_POSTCHECK_REQUIRED_READERS_MISSING');
 return Object.freeze({
  inspect({phase}={}){
   try{return inspectPhysical({root,phase,expectedRaw,isOldOwnerAlive,
    readWorkflow,readProtected});}
   catch(e){return fail(/^C_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_POSTCHECK_STATE_OR_READ_UNKNOWN');}
  },
 });
}
