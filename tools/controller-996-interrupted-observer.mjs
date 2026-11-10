// #996 post-interruption physical reader. SOURCE ONLY; NO CLI/installation.
// It never adopts an old C claim, retries Workflow PUT/backlog close, archives
// a lease or emits raw owner/nonce/ledger/GitHub data. A consistent snapshot
// is NOT ownership proof or authority for a continuation operator.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {collect996ProtectedItems} from './controller-996-protection-attestation.mjs';
import {review996ProtectedR2Evidence} from './controller-996-r2-evidence-review.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='E:/ZGmini';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const APPROVAL_SHA='05bf8aa72b438b69d7c86f8798a72ec2c12fe3537489f2153069dabfe0695e7b';
const APPROVAL_COMMIT='7cff08ec6b27410baf10d8dc7130edb57b2de8c4';
const FP='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const ORIGINAL_BACKLOG='d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780';
const PIN=Object.freeze({
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 originalOwner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
 stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
 maintainer:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
});
const BASE='automation/pc-maintenance';
const MAP=Object.freeze({
 ledger:`${BASE}/ledger/${REQ}.json`,
 originalOwner:`${BASE}/leases/controller-install/owner.json`,
 recoveryMarker:`${BASE}/leases/controller-install/RECOVERY_REQUIRED.json`,
 controllerHost:'automation/pc-control/host.json',
 stagedHost:`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,
 maintainer:`${BASE}/MAINTENANCE_INSTALL.json`,
 cOwner:`${BASE}/leases/controller-recovery/owner.json`,
 backlog:`${BASE}/backlog/${REQ}.json`,
});
const C_MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED','BACKLOG_CLOSE_ATTEMPTED'];
const LATER=['PRE_ARCHIVE','ORIGINAL_LEASE_ARCHIVE_ATTEMPTED',
 'COMPLETE','OWN_CLAIM_ARCHIVE_ATTEMPTED'];
const LEASES=[
 `${BASE}/leases/controller-install`,
 `${BASE}/leases/controller-recovery`,
 `${BASE}/leases/controller-install-recovered-${REQ}`,
 `${BASE}/leases/controller-recovery-archived-${REQ}`,
];
const SHA=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const date=v=>typeof v==='string'?Date.parse(v):NaN;
const sha=v=>createHash('sha256').update(v).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const markerPath=name=>`${BASE}/leases/controller-recovery/${name}.json`;
function pathParts(rel){
 need(typeof rel==='string'&&!path.isAbsolute(rel)&&
  !rel.split('/').some(p=>!p||p==='.'||p==='..'),
  'C_INTERRUPTED_PATH_INVALID');
 return rel.split('/');
}
function checkedFile(root,rel){
 let current=root;
 need(fs.lstatSync(current).isDirectory()&&!fs.lstatSync(current).isSymbolicLink(),
  'C_INTERRUPTED_ROOT_REDIRECT');
 const parts=pathParts(rel);
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);
  const st=fs.lstatSync(current);
  need(!st.isSymbolicLink(),'C_INTERRUPTED_PATH_REDIRECT');
  if(i<parts.length-1)need(st.isDirectory(),'C_INTERRUPTED_PARENT_UNSAFE');
  else need(st.isFile()&&st.size>0&&st.size<=2_000_000,
   'C_INTERRUPTED_FILE_UNSAFE');
 }
 return fs.readFileSync(current);
}
function checkedPresence(root,rel){
 let current=root;
 need(fs.lstatSync(current).isDirectory()&&!fs.lstatSync(current).isSymbolicLink(),
  'C_INTERRUPTED_ROOT_REDIRECT');
 const parts=pathParts(rel);
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);
  let st;
  try{st=fs.lstatSync(current);}catch(e){
   if(e?.code==='ENOENT')return false;
   throw e;
  }
  need(!st.isSymbolicLink(),'C_INTERRUPTED_PATH_REDIRECT');
  need(st.isDirectory()||i===parts.length-1&&st.isFile(),
   'C_INTERRUPTED_PATH_TYPE_DRIFT');
 }
 return true;
}
function parse(bytes){
 const obj=JSON.parse(bytes.toString('utf8'));
 need(obj&&typeof obj==='object'&&!Array.isArray(obj),
  'C_INTERRUPTED_JSON_OBJECT_INVALID');
 return obj;
}
function pidAlive(pid){
 try{process.kill(pid,0);return true;}
 catch(e){return e?.code==='ESRCH'?false:null;}
}
function getOnly(route){
 const raw=execFileSync(GH,['api','--method','GET',route],
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1_000_000});
 return JSON.parse(raw);
}
function nativeLive(){
 const user=getOnly('user'),repo=getOnly('repos/'+REPO);
 need(user?.login==='ansqhd5774-Choi'&&repo?.full_name===REPO&&
  repo.private===true,'C_INTERRUPTED_GITHUB_IDENTITY_UNVERIFIED');
 const workflow=getOnly(`repos/${REPO}/actions/workflows/pc-job.yml`);
 const issue=getOnly(`repos/${REPO}/issues/996`);
 const runners=getOnly(`repos/${REPO}/actions/runners?per_page=100`);
 let body;try{body=JSON.parse(issue.body);}catch{}
 need(issue.number===996&&issue.state==='open'&&
  issue.user?.login==='ansqhd5774-Choi'&&
  issue.labels?.some(v=>v.name==='pc-maintenance')&&
  body?.requestId===REQ,'C_INTERRUPTED_ORIGINAL_ISSUE_UNVERIFIED');
 need(Number.isSafeInteger(workflow?.id)&&workflow.id>0&&
  workflow.path==='.github/workflows/pc-job.yml',
  'C_INTERRUPTED_WORKFLOW_IDENTITY_UNVERIFIED');
 const six=Array.from({length:6},(_,i)=>`zgmini-pc-0${i+1}`);
 need(runners?.total_count===runners?.runners?.length&&
  six.every(name=>runners.runners.filter(r=>r.name===name).length===1),
  'C_INTERRUPTED_RUNNER_INVENTORY_UNVERIFIED');
 // Registered names establish inventory only, not isolation or readiness.
 return {workflowState:workflow?.state,namedRunnersObserved:6,
  additionalRunnersObserved:runners.runners.length-6,authenticated:true};
}
const nativeProtected=()=>review996ProtectedR2Evidence(collect996ProtectedItems());
const failure=(code,checks=[])=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_OBSERVATION_V1',
 requestId:REQ,status:'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE',
 code,checks:Object.freeze(checks),claimProvenanceExternallyPinned:false,
 fullSourceBytePostcheckVerified:false,executionAuthorized:false,
 operationalWrites:0,issuePosts:0,pcRetries:0,
});
function assess({raw,exists,live,protection,isAlive,pin}){
 const checks=[];const verify=(name,ok)=>{
  checks.push(Object.freeze({name,passed:ok===true}));
  need(ok===true,'C_INTERRUPTED_'+name+'_UNVERIFIED');
 };
 const value=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,parse(v.bytes)]));
 verify('ORIGINAL_STATIC_PIN',Object.keys(PIN).every(k=>raw[k]?.sha===pin[k]));
 verify('LEASE_PATHS',exists[LEASES[0]]===true&&exists[LEASES[1]]===true&&
  exists[LEASES[2]]===false&&exists[LEASES[3]]===false);
 const old=value.originalOwner,c=value.cOwner;
 verify('OLD_OWNER_DEAD',Number.isSafeInteger(old.pid)&&old.pid>0&&
  isAlive(old.pid)===false);
 verify('C_OWNER_DEAD',c.requestId===REQ&&c.issueNumber===996&&
  Number.isSafeInteger(c.pid)&&c.pid>0&&isAlive(c.pid)===false&&
  typeof c.nonce==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(c.nonce)&&
  Number.isFinite(date(c.at)));
 const ledger=value.ledger;
 verify('LEDGER',ledger.requestId===REQ&&ledger.issueNumber===996&&
  ledger.firstFail==='INTAKE_PAUSED'&&ledger.code==='RUNNER_SET_DRIFT'&&
  ledger.status==='RECOVERY_REQUIRED');
 const marker=(name)=>value[name];
 const valid=(name)=>{
  const m=marker(name);
  return m.schema==='ZGMINI_CONTROLLER_996_C_MARKER_V1'&&
   m.requestId===REQ&&m.issueNumber===996&&m.name===name&&
   m.ownerNonce===c.nonce&&Number.isFinite(date(m.at))&&
   m.details&&typeof m.details==='object'&&!Array.isArray(m.details);
 };
 verify('MARKER_IDENTITY',C_MARKERS.every(valid)&&
  date(marker('PREPARED').at)>=date(c.at)&&
  date(marker('WORKFLOW_ENABLE_ATTEMPTED').at)>=date(marker('PREPARED').at)&&
  date(marker('BACKLOG_CLOSE_ATTEMPTED').at)>=date(marker('WORKFLOW_ENABLE_ATTEMPTED').at));
 const prepared=marker('PREPARED').details;
 verify('PREPARED_CONSENT_PIN',prepared.manifestSha256===APPROVAL_SHA&&
  prepared.manifestCommitSha===APPROVAL_COMMIT&&
  prepared.evidenceFingerprint===FP&&prepared.ownerNonce===c.nonce);
 const intent=marker('WORKFLOW_ENABLE_ATTEMPTED').details;
 verify('WORKFLOW_INTENT',intent.action==='ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE'&&
  intent.requestId===REQ&&intent.nonce===c.nonce&&
  intent.workflow===`repos/${REPO}/actions/workflows/pc-job.yml`&&
  intent.priorState==='disabled_manually');
 const close=marker('BACKLOG_CLOSE_ATTEMPTED').details;
 const backlog=value.backlog;
 verify('BACKLOG_COMMIT',close.originalSha===ORIGINAL_BACKLOG&&
  SHA(close.nextSha)&&raw.backlog.sha===close.nextSha&&
  close.ownerNonce===c.nonce&&
  close.operation==='CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE'&&
  Number.isFinite(date(close.resumeAt))&&
  backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&backlog.requestId===REQ&&
  backlog.resumedAt===close.resumeAt&&Array.isArray(backlog.windows)&&
  backlog.windows.length===1&&
  backlog.windows[0].pausedAt===backlog.pausedAt&&
  backlog.windows[0].resumedAt===close.resumeAt&&
  Number.isFinite(date(backlog.pausedAt))&&
  date(backlog.resumedAt)>=date(backlog.pausedAt)&&
  backlog.replays&&typeof backlog.replays==='object'&&
  !Array.isArray(backlog.replays)&&
  Object.values(backlog.replays).every(r=>r&&
   ['DONE','SKIPPED_RESULT_PRESENT'].includes(r.status)));
 verify('LATER_MARKERS_ABSENT',LATER.every(n=>exists[markerPath(n)]===false));
 verify('WORKFLOW_ACTIVE',live?.authenticated===true&&live.workflowState==='active');
 verify('NAMED_RUNNER_INVENTORY',live.namedRunnersObserved===6&&
  Number.isSafeInteger(live.additionalRunnersObserved)&&
  live.additionalRunnersObserved>=0);
 verify('CURRENT_PROTECTION',protection?.status==='CURRENT_PROTECTION_MATCHES_R1'&&
  protection.protectedFingerprint===FP&&protection.enabledTasks===2);
 verify('STATIC_MANIFESTS',value.controllerHost.controllerSourceSha===
  'badad9124157879d7a645b64f2768113d632355b'&&
  value.stagedHost.controllerSourceSha===
  '9db6fff689c488a59fe8771f013b7c5d3bafc0a8'&&
  value.maintainer.sourceSha==='16064e29fea0e53e7769a24d93d75b6f5292cfc0');
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_OBSERVATION_V1',
  requestId:REQ,status:'READONLY_INTERRUPTED_PHASE_CONSISTENT',
  code:'C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED',
  checks:Object.freeze(checks),
  checksPassed:checks.length,checksTotal:checks.length,
  backlogSha256:raw.backlog.sha,
  pausedAt:backlog.pausedAt,resumedAt:backlog.resumedAt,
  originalLeasePresent:true,cClaimPresent:true,
  laterArchiveMarkersPresent:false,workflowState:'active',
  claimProvenanceExternallyPinned:false,
  fullSourceBytePostcheckVerified:false,
  executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0,
 });
}
// No production CLI. All test ports are rejected on the original Windows.
export function collect996InterruptedEvidence({root=ROOT,testOnly=false,
 readLive=nativeLive,readProtected=nativeProtected,isAlive=pidAlive,
 pin=PIN}={}){
 try{
  if(testOnly){
   need(process.platform!=='win32'&&path.isAbsolute(root)&&
    path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
    path.basename(root).startsWith('zgmini-996-test-')&&
    readLive!==nativeLive&&readProtected!==nativeProtected&&isAlive!==pidAlive&&
    pin!==PIN&&Object.keys(PIN).every(k=>SHA(pin?.[k])),
    'C_INTERRUPTED_TEST_PORT_REJECTED');
  }else need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME&&
   path.win32.normalize(root).toLowerCase()===
    path.win32.normalize(ROOT).toLowerCase()&&
   readLive===nativeLive&&readProtected===nativeProtected&&isAlive===pidAlive&&
   pin===PIN,
   'C_INTERRUPTED_ORIGINAL_WINDOWS_ONLY');
  const rels={...MAP,...Object.fromEntries(C_MARKERS.map(n=>[n,markerPath(n)]))};
  const read=()=>{
   const out={};
   for(const [key,rel] of Object.entries(rels)){
    const bytes=checkedFile(root,rel);
    out[key]={bytes,sha:sha(bytes)};
   }
   return out;
  };
  const raw=read();
  const exists={};
  for(const p of [...LEASES,...LATER.map(markerPath)])exists[p]=checkedPresence(root,p);
  const live=readLive(),protection=readProtected();
  const again=read();
  need(Object.keys(raw).every(k=>raw[k].sha===again[k].sha),
   'C_INTERRUPTED_FILES_CHANGED_DURING_READ');
  const afterExists={};
  for(const p of [...LEASES,...LATER.map(markerPath)])
   afterExists[p]=checkedPresence(root,p);
  need(Object.keys(exists).every(p=>exists[p]===afterExists[p]),
   'C_INTERRUPTED_LEASE_OR_MARKER_CHANGED_DURING_READ');
  return assess({raw,exists,live,protection,isAlive,pin});
 }catch(e){
  return failure(/^C_INTERRUPTED_[A-Z0-9_]+$/.test(e?.code??'')?
   e.code:'C_INTERRUPTED_READ_OR_STATE_UNKNOWN');
 }
}
