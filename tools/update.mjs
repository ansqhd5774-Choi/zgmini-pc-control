// Approved Controller updater. Must be called by the independent PC maintenance
// listener, NEVER from a GitHub Actions job or a supervisor child process.
// Preserves the original update.mjs workflow: drain, protect, backup, stop only
// the dedicated supervisor, replace controller/config, reconnect six listeners.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {TextDecoder} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {applyApprovedUpdate,maintenanceCliFailureReport} from './maintenance-apply.mjs';
import {validateUpdateRequest,validateMaintenanceRequest,
validateControllerConfigTransition,controllerAdmissionForPurpose,
  readAllMaintenancePages,validateInfrastructureDelta,
  validateControllerOnlyInstallDelta,validateControllerSelectivePin,
  validateControllerImportClosure,controllerImportScanRoots,
  deployableControllerTreePaths,
  isControllerSourceTestPath,
  CONTROL_UPDATE_SENSITIVE_PATHS,CONTROLLER_POST_OPERATIONS,INSTALLABLE_FILES,
 validateR6HostIssueEnvelope,validateR6HostRegistrationRequest,classifyR6HostRecovery,
 decideR6RecoveryReentry,sameR6RecoveryClaim,verifyR6HistoricCompletion,
 R6_HOST_SOURCE_SHA,R6_HOST_SOURCE_MANIFEST_SHA256,
 selectPreservedRecoveryProtection,recoveryProtectedSnapshotStillPinned,
 verifiedRunningPostcheckFailure,classifyMaintenancePostcheckLink,
 R6_HOST_CANDIDATE_SHA256,validateR54BIssueEnvelope,
 validateR54BManifestRequest,R54_B_ISSUE_TITLE,R54_B_OPERATION,
 R54_B_SOURCE_FILES,SOURCE_BUNDLE_OPERATION,SOURCE_BUNDLE_ISSUE_TITLE,
 validateSourceBundleIssueEnvelope,validateSourceBundleBApproval}
  from './maintenance-contract.mjs';
import {acquireMaintenanceLock,maintenanceLockStatus} from './maintenance-lock.mjs';
import {planSourceBundleRegistration,stageApprovedSourceBundle,
 applyPreparedSourceBundleHostCas} from './source-bundle-register.mjs';

const controlRoot='E:/ZGmini/automation/pc-control';
const maintenanceRoot='E:/ZGmini/automation/pc-maintenance';
export const maintenanceOriginFiles=Object.freeze([
 'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
 'tools/source-bundle-register.mjs',
]);
const checkout='E:/ZGmini/projects/zgmini-pc-control';
const controlRepository='ansqhd5774-Choi/zgmini-pc-control';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const node='E:/ZGmini/runtime/node.exe';
const requiredRunners=Array.from({length:6},(_,n)=>`zgmini-pc-0${n+1}`);
// The six dedicated PC seats are the maintenance resource. An independently
// scoped runner registered in the same repository must not count as a seventh
// PC seat or block drain/reconnect of the six named seats.
export function dedicatedPcRunnerRows(rows,{requireOnline=false,requireIdle=false}={}) {
 if(!Array.isArray(rows))return null;
 const selected=[];
 for(const name of requiredRunners){
  const matches=rows.filter(row=>row?.name===name);
  if(matches.length!==1)return null;
  const row=matches[0];
  if(requireOnline&&row.status!=='online')return null;
  if(requireIdle&&row.busy!==false)return null;
  selected.push(row);
 }
 return selected;
}
// Reject paginated or incomplete GitHub Runner snapshots before touching
// workflow state or maintenance leases; an unobserved page can hide a duplicate.
export function requireCompleteRunnerInventory(response){
 need(Array.isArray(response?.runners)&&Number.isSafeInteger(response?.total_count)
   &&response.total_count===response.runners.length,'RUNNER_INVENTORY_INCOMPLETE');
 const selected=dedicatedPcRunnerRows(response.runners);
 need(selected!==null,'RUNNER_SET_DRIFT');
 need(selected.every(row=>typeof row.busy==='boolean'
   &&['online','offline'].includes(row.status)),'RUNNER_STATE_INVALID');
 return selected;
}
const sha256=x=>createHash('sha256').update(x).digest('hex');
const need=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
// Accept the same optional preimage manifest scope as controller/common.mjs.
// The independent maintenance updater cannot import controller files during recovery.
export function validBacklogOriginalPcJob(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return false;
 const base=['schema','requestId','chatId','operation','sourceRepository','sourceBranch','sourceSha'];
 const extra=['preimageManifestPath','preimageManifestSha256'];
 const keys=Object.keys(body);
 const scoped=body.operation==='writer-install-preimage-readonly'&&
  keys.length===base.length+extra.length&&extra.every(k=>Object.hasOwn(body,k));
 const pit04=body.operation==='employment-r6-candidate-stage-readonly'&&
  Object.hasOwn(body,'pit04Offset');
 const allowed=scoped?[...base,...extra]:pit04?[...base,'pit04Offset']:base;
 if(keys.length!==allowed.length||!allowed.every(k=>Object.hasOwn(body,k))||
    keys.some(k=>!allowed.includes(k)))return false;
 if(pit04&&(!Number.isSafeInteger(body.pit04Offset)||
   body.pit04Offset<0||body.pit04Offset>50000))return false;
 if(scoped){
  if(typeof body.preimageManifestPath!=='string'||
     !/^approvals\/writer-preimage\/[a-z0-9][a-z0-9-]{3,79}\.json$/.test(body.preimageManifestPath)||
     typeof body.preimageManifestSha256!=='string'||
     !/^[0-9a-f]{64}$/.test(body.preimageManifestSha256))return false;
 }
 return body.schema==='ZGMINI_PC_JOB_V1'&&/^[a-z0-9-]{8,80}$/.test(body.requestId);
}

// A malformed queued request is a terminal rejection, never an executable replay.
// Preserve exact original bytes digest and reason instead of stranding a switched Controller.
export function classifyBacklogOriginal(text){
 if(typeof text!=='string')throw Object.assign(Error('BACKLOG_BODY_UNOBSERVABLE'),{code:'BACKLOG_BODY_UNOBSERVABLE'});
 let body;try{body=JSON.parse(text);}catch{return {valid:false,code:'BACKLOG_ORIGINAL_BODY_INVALID',originalBodySha256:sha256(text)};}
 if(!validBacklogOriginalPcJob(body))return {valid:false,code:'BACKLOG_ORIGINAL_REQUEST_INVALID',originalBodySha256:sha256(text)};
 return {valid:true,body,originalBodySha256:sha256(text)};
}

const wait=ms=>new Promise(r=>setTimeout(r,ms));
// Runner state can change after draining and backup. Retry only Busy seats,
// while rechecking the original owner and protection before each sample.
export async function waitForSupervisorStopIdle({
 readRunners,verifySafety,pause=wait,now=()=>Date.now()
}){
 const started=now(),deadline=started+30000;
 let retryCount=0,observedBusy=false;
 for(;;){
  verifySafety();
  const seats=dedicatedPcRunnerRows(readRunners(),{requireOnline:true});
  need(seats!==null,'RUNNERS_NOT_ONLINE');
  if(seats.every(seat=>seat.busy===false))
   return {retryCount,elapsedMs:Math.max(0,now()-started),observedBusy};
  observedBusy=true;
  const remaining=deadline-now();
  // Exhaustion is an observed Busy refusal, not a successful stop.
  // Preserve only bounded non-sensitive counters on the exact failure.
  if(remaining<=0)throw Object.assign(Error('RUNNERS_NOT_IDLE'),{
   code:'RUNNERS_NOT_IDLE',supervisorIdleWait:{
    retryCount,elapsedMs:Math.max(0,now()-started),observedBusy:true
   }
  });
  await pause(Math.min(3000,remaining));
  retryCount++;
 }
}
// GitHub workflow disable/enable states can be eventually consistent.
// A bounded, read-only observation never substitutes for an exact state
// confirmation; unknown states and exhausted readbacks remain fail-closed.
export async function confirmExactWorkflowState(readState,expected,{pause=wait}={}){
 need(typeof readState==='function'&&
  (expected==='active'||expected==='disabled_manually')&&
  typeof pause==='function','WORKFLOW_STATE_PROBE_INVALID');
 for(let attempt=0;attempt<6;attempt++){
  let state;
  try{state=await readState();}catch{/* No evidence: retry only a GET. */}
  if(state===expected)return true;
  if(state!==undefined&&state!=='active'&&state!=='disabled_manually')return false;
  if(attempt<5)await pause(1000);
 }
 return false;
}
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);};
const git=(args,options={})=>execFileSync('git',args,{cwd:checkout,encoding:Object.hasOwn(options,'encoding')?options.encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8e6});
const github=(route,method='GET',input)=>{
 const args=['api',`repos/${controlRepository}/${route}`,'--method',method];
 if(input)args.push('--input',input);
 const out=execFileSync(gh,args,{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4e6});
 return out.trim()?JSON.parse(out):{};
};
const hostPath=path.join(controlRoot,'host.json');
const recordDir=path.join(maintenanceRoot,'ledger');
const safeId=x=>{need(/^pc-[a-z0-9-]{8,76}$/.test(x??''),'MAINTENANCE_REQUEST_ID');return x;};
const validSha=x=>/^[a-f0-9]{40}$/.test(x??'');
const R6_HOST_TITLE='pc-r6-host-register';
const R6_SOURCE_MANIFEST_PATH='drafts/employment-r6/source-manifest.json';
const R6_STAGE_TOOL_HASH='66400ce7eca77997b92b1b42e72f409c0e9fdb6154599fd61d93e7825cca2a0a';
const R6_APPLY_TOOL_HASH='ab79308af8010cf04091fb440c04c70f725679fbc50f1ade9149a5e666682be1';
const R54_TASK_NAME='ZGMINI-PC-Theme-Nine-R54-Public';
const R54_TASK_ACTION='E:\\ZGmini\\data\\pc-writer\\theme-nine-r54\\scripts\\pc-writer\\THEME_NINE_R54_PUBLIC_CYCLE.cmd';
const R54_TASK_ACTION_SHA256='0dea186a956dbc1471a4063e8c64dd5a230549477860e699bbb450a06d4360f4';
const R54_TASK_EXCEPTION='ONE_TIME_R54_TASK_PAUSE_RESTORE_B';
const R54_B_SOURCE_LEASE_DIR='E:/ZGmini/data/pc-writer/theme-nine-r54/R54_B_SOURCE_EXCLUSIVE.lock';
const R54_B_LEASE_SCHEMA='ZGMINI_R54_SOURCE_EXCLUSIVE_V1';
const R54_B_WRITER_ROOT='E:/ZGmini/data/pc-writer/theme-nine-r54';
const R54_B_GUARD_ORIGINALS=Object.freeze([
 Object.freeze({path:'scripts/pc-writer/r54-source-lease.mjs',old:null}),
 Object.freeze({path:'scripts/pc-writer/theme-ten-r78-repair-and-retry.mjs',
  old:'8e6548196fc253701a141a4a60f812eec3c07f77b8f2ed300fe39215a48fa1d3'}),
 Object.freeze({path:'scripts/pc-writer/theme-ten-r80-rebase-once.mjs',
  old:'78541f9d6f097b3009afee626488a0e164a6f9837e450d57745c958d748455f2'}),
]);
// V3 is a separate, still-unissued 9-path B proposal. It must never be
// substituted for the installed V2 six-file contract or applied by that
// helper. Every entry is pinned here because update.mjs may only import
// modules already present in the independently installed maintainer.
export const R54_B_V3_FIXED_SOURCE_TRANSITIONS=Object.freeze([
 {path:'scripts/pc-writer/r54-source-lease.mjs',old:null,
  next:'297eda7b8b028d74c1525d83b095e28f3cf2f56f1ff9bf569f73fd74636f29c6'},
 {path:'scripts/pc-writer/theme-ten-r78-repair-and-retry.mjs',
  old:'8e6548196fc253701a141a4a60f812eec3c07f77b8f2ed300fe39215a48fa1d3',
  next:'0b688e3477e9155567e9d93d98dd0baf3a77f5419ed903c56aaf3624ffcf424c'},
 {path:'scripts/pc-writer/theme-ten-r80-rebase-once.mjs',
  old:'78541f9d6f097b3009afee626488a0e164a6f9837e450d57745c958d748455f2',
  next:'cf9883b512e4528ce2e29fcf7c95b2c9a7125802932454656df81bad97abf3c3'},
 {path:'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  old:'c6e4699d62bdef991911561623e37c205fd8bb6e5aa69907c3e93e36908fd31e',
  interim:'a16c97ff9e29210a367a076d1a16a5e883a299b737ad588989ddfe95cbecd201',
  next:'2bebba925eb367de5e15fb9ed62161b01243b76e1cdfb9a804246b1cb0c13f5d'},
 {path:'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  old:'fe079b1e2e5d2f824f6e0ff251bd2a01677fe1a477072c619b614402fbd90ae4',
  next:'5a50761756be6081c71df7aa30869ed43547fbb867e476b7c581072939c27560'},
 {path:'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  old:'dfc326e2738c1b8b82451510104ac6ad502e2a9876e0a3a76d939c412e907bb7',
  next:'7378d04bccea4c68ab93ce3b1b829b5bc0a742db49b88d1e7530482c4ea8b6cc'},
 {path:'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  old:'f2a688da40d7b5ee90ed2a27a40af05b9c63116284930f1cc26041064737d012',
  next:'85686106412b2c4a5af51ce5de6b844729bad02441cf9bab1e51ae369a3a4a27'},
 {path:'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  old:'7a10fe41710dbc1a21c9f3e343c538cd96b6c5695b683f04dce48af85ede6e7e',
  next:'fc55ee3a2c998a4dfa7c5edd9230a68fab3954dd745b39bbe39a6177363bf45a'},
 {path:'worker/theme-nine-r37-public.mjs',
  old:'e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33',
  next:'30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85'},
].map(x=>Object.freeze(x)));

/** Pure nine-path baseline and staging policy. This is NOT B admission or
 * permission to mutate source; a fixed native host must attest every byte. */
export function inspectR54Bv3SourceTransition({originalRows,candidateRows,
 taskPauseCount=0,taskRestoreCount=0}={}){
 const pins=R54_B_V3_FIXED_SOURCE_TRANSITIONS;
 const exact=(rows,field)=>Array.isArray(rows)&&rows.length===pins.length&&
  pins.every((x,i)=>rows[i]?.path===x.path&&rows[i]?.sha256===x[field]);
 need(taskPauseCount===0&&taskRestoreCount===0,
  'R54_B_V3_NO_TASK_MUTATION_AT_PREFLIGHT');
 need(exact(originalRows,'old'),'R54_B_V3_ORIGINAL_NINE_SHA_DRIFT');
 need(exact(candidateRows,'next'),'R54_B_V3_CANDIDATE_NINE_SHA_DRIFT');
 const guarded=pins.find(x=>x.interim);
 need(guarded?.path==='scripts/pc-writer/theme-nine-r54-public-connect.mjs'
  &&guarded.interim!==guarded.old&&guarded.interim!==guarded.next,
  'R54_B_V3_INTERIM_GUARD_INVALID');
 return Object.freeze({status:'V3_SOURCE_PLAN_VALIDATED_NOT_INSTALLABLE',
  fixedPaths:pins.length,writerPaths:6,guardPaths:3,
  taskDisableLimit:1,taskRestoreLimit:1,
  phases:['SOURCE_BASELINE','TASK_XML_BACKUP','TASK_DISABLE',
   'NATURAL_DRAIN_AND_EXCLUSIVE_OS_FREEZE','INSTALL_GUARD_HELPER_AND_R78_R80',
   'CONNECTOR_ORIGINAL_TO_INTERIM','SIX_WRITER_CAS_TO_FINAL',
   'VERIFY_NINE_FINAL','RESTORE_TASK_OR_HOLD_FOR_RECOVERY'],
  hasTrustedStartFreeze:false,canInstall:false});
}

/** Read-only, pinned approved six-file baseline; never follows reparse points.
 * A mismatch is not fixed by copying an old source or resetting a checkout.
 * Collect all six SHA states before returning BLOCKED, so the existing
 * one-shot result can name the real drift without another PC invocation.
 * This inventory is diagnostic only; it is not an operator freeze attestation. */
export function classifyR54PinnedHash(spec,actual){
 return actual===null?'MISSING':actual===spec.old?'OLD'
  :actual===spec.next?'NEXT':'UNKNOWN';
}
export function inspectR54BOriginalSource({root=R54_B_WRITER_ROOT,fsImpl=fs}={}){
 need(typeof root==='string'&&path.isAbsolute(root),
  'R54_B_SOURCE_ROOT_INVALID');
 // A reparse/symlink root must not become trusted merely because realpath()
 // resolves to ordinary files. Reject the requested path before resolution.
 need(!fsImpl.lstatSync(root).isSymbolicLink(),
  'R54_B_SOURCE_ROOT_REDIRECT');
 const base=fsImpl.realpathSync.native(root);
 need(fsImpl.statSync(base).isDirectory()&&
  !fsImpl.lstatSync(base).isSymbolicLink(),
  'R54_B_SOURCE_ROOT_REDIRECT');
 const rows=R54_B_SOURCE_FILES;
 const out=[];
 for(const spec of rows){
  need(spec.path.split('/').every(x=>/^[\w.-]+$/.test(x)&&x!=='.'&&x!=='..'),
   'R54_B_SOURCE_RELATIVE_DENIED');
  const target=path.join(base,...spec.path.split('/'));
  let current=base,missing=false;
  for(const part of spec.path.split('/')){
   current=path.join(current,part);
   try{need(!fsImpl.lstatSync(current).isSymbolicLink(),
     'R54_B_SOURCE_REPARSE_DENIED');}
   catch(error){
    if(error?.code==='ENOENT'){
     missing=true;break;
    }
    throw error;
   }
  }
  if(spec.old===null){
   need(missing,'R54_B_GUARD_HELPER_UNEXPECTEDLY_PRESENT');
   out.push({path:spec.path,actual:null,state:'OLD',
    expectedOld:null,approvedNext:spec.next??null});
   continue;
  }
  if(missing){
   out.push({path:spec.path,actual:null,state:'MISSING',
    expectedOld:spec.old,approvedNext:spec.next});
   continue;
  }
  const real=fsImpl.realpathSync.native(target);
  need(real.toLowerCase().startsWith(base.toLowerCase()+path.sep.toLowerCase())&&
   fsImpl.statSync(real).isFile(),'R54_B_SOURCE_PATH_OUTSIDE');
  const actual=sha256(fsImpl.readFileSync(real));
  out.push({path:spec.path,actual,
   state:classifyR54PinnedHash(spec,actual),
   expectedOld:spec.old,approvedNext:spec.next});
 }
 if(out.some(row=>row.state!=='OLD')){
  throw Object.assign(Error('R54_B_ORIGINAL_SOURCE_SHA_DRIFT'),{
   code:'R54_B_ORIGINAL_SOURCE_SHA_DRIFT',sourceInventory:out});
 }
 // The existing source lock must not be abandoned by an unknown owner.
 const lockDir=path.join(base,path.basename(R54_B_SOURCE_LEASE_DIR));
 need(!fsImpl.existsSync(lockDir),'R54_B_EXISTING_SOURCE_LEASE_RECONCILE');
 return {status:'R54_B_ORIGINAL_SIX_SHA_VERIFIED',root:base,
  files:out,sourceChanges:0,taskChanges:0};
}

/** One atomic NTFS arbiter, shared with the guarded R54 connector/R78/R80.
 * This function never steals a stale lock or deletes another owner's bytes.
 * Test-only fs/path overrides must NEVER come from an Issue or manifest. */
export function acquireR54BSourceLease({leaseDir=R54_B_SOURCE_LEASE_DIR,
 fsImpl=fs,pid=process.pid,nonce=randomUUID(),now=new Date().toISOString()}={}){
 need(typeof leaseDir==='string'&&path.isAbsolute(leaseDir)&&
  typeof nonce==='string'&&/^[a-f0-9-]{36}$/i.test(nonce)&&
  Number.isSafeInteger(pid)&&pid>0,'R54_B_SOURCE_LEASE_ARGS');
 const parent=path.dirname(leaseDir);
 need(fsImpl.statSync(parent).isDirectory()&&
  !fsImpl.lstatSync(parent).isSymbolicLink(),
  'R54_B_SOURCE_LEASE_PARENT_UNSAFE');
 try{fsImpl.mkdirSync(leaseDir,{recursive:false});}
 catch(error){
  if(error?.code==='EEXIST')return Object.freeze({status:'BUSY',owned:false});
  throw Object.assign(Error('R54_B_SOURCE_LEASE_ACQUIRE_UNKNOWN',{cause:error}),
   {code:'R54_B_SOURCE_LEASE_ACQUIRE_UNKNOWN'});
 }
 const owner=path.join(leaseDir,'OWNER.json');
 const record=JSON.stringify({schema:R54_B_LEASE_SCHEMA,pid,nonce,at:now})+'\n';
 let fd;
 try{
  fd=fsImpl.openSync(owner,'wx',0o600);
  fsImpl.writeFileSync(fd,record);
  fsImpl.fsyncSync(fd);
 }catch(error){
  // mkdir might already be visible. Keep it for explicit reconciliation.
  throw Object.assign(Error('R54_B_SOURCE_LEASE_OWNER_UNKNOWN',{cause:error}),
   {code:'R54_B_SOURCE_LEASE_OWNER_UNKNOWN'});
 }finally{if(fd!==undefined)fsImpl.closeSync(fd);}
 let released=false;
 const owned=()=>{
  if(released)return false;
  try{return fsImpl.readFileSync(owner,'utf8')===record;}
  catch{return false;}
 };
 const release=()=>{
  need(!released&&owned(),'R54_B_SOURCE_LEASE_OWNER_DRIFT');
  try{
   fsImpl.unlinkSync(owner);
   fsImpl.rmdirSync(leaseDir);
   released=true;
  }catch(error){
   throw Object.assign(Error('R54_B_SOURCE_LEASE_RELEASE_UNKNOWN',{cause:error}),
    {code:'R54_B_SOURCE_LEASE_RELEASE_UNKNOWN'});
  }
  return true;
 };
 return Object.freeze({status:'ACQUIRED',owned:true,owner,leaseDir,
  nonce,assertHeld:owned,release});
}
/** Legacy read-only proof fixture. This is not used to authorize the live
 * B transaction, which performs its own fixed Windows checks before swaps. */
export function r54BStartFreezeReady(proof={}){
 const {authorization,baseline,closedRoutes,sourceRows,observedAt}=proof??{};
 const norm=x=>typeof x==='string'?x.replace(/\//g,'\\').toLowerCase():'';
 if(authorization?.grade!=='B'||authorization.scope!==R54_TASK_EXCEPTION
  ||authorization.taskName!==R54_TASK_NAME||authorization.singleUse!==true
  ||authorization.preserveTaskDefinition!==true
  ||authorization.allowForceTermination!==false
  ||authorization.allowOtherTaskChanges!==false)return false;
 if(baseline?.name!==R54_TASK_NAME
  ||norm(baseline.actionPath)!==norm(R54_TASK_ACTION)
  ||baseline.actionSha256!==R54_TASK_ACTION_SHA256
  ||baseline.enabled!==false
  ||!/^[a-f0-9]{64}$/.test(baseline.definitionDigest??'')
  ||baseline.durableXmlBackupReadback!==true)return false;
 if(closedRoutes?.taskName!==R54_TASK_NAME
  ||closedRoutes.schedulerStartDisabled!==true
  ||closedRoutes.taskNotRunning!==true||closedRoutes.childProcessCount!==0
  ||closedRoutes.conflictingSourceLaunches!==0
  ||closedRoutes.installWindowExclusivityVerified!==true
  ||closedRoutes.relevantLocksClear!==true
  ||closedRoutes.exclusiveBLeaseHeld!==true)return false;
 if(!Array.isArray(sourceRows)||sourceRows.length!==R54_B_SOURCE_FILES.length
  ||!R54_B_SOURCE_FILES.every((pin,i)=>sourceRows[i]?.path===pin.path
    &&sourceRows[i]?.actual===pin.old))return false;
 return typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt))
  &&Math.abs(Date.now()-Date.parse(observedAt))<60000;
}
// The Windows Task adapter is wired through runR54BApprovedOneShot and can
// only manage one pinned R54 Task after durable backup. Task Disable itself
// is not interpreted as a global Writer freeze; six-file CAS and a live
// bounded process scan remain mandatory.
export function inspectR54TaskXml(raw,actionBytes){
 need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<65536,
  'R54_TASK_XML_BYTES_INVALID');
 need(Buffer.isBuffer(actionBytes)&&sha256(actionBytes)===R54_TASK_ACTION_SHA256,
  'R54_TASK_ACTION_SOURCE_DRIFT');
 let xml;
 try{
  const utf16=raw[0]===0xff&&raw[1]===0xfe;
  xml=new TextDecoder(utf16?'utf-16le':'utf-8',{fatal:true})
   .decode(utf16?raw.subarray(2):raw);
 }catch{throw Object.assign(Error('R54_TASK_XML_ENCODING_INVALID'),
  {code:'R54_TASK_XML_ENCODING_INVALID'});}
 const settings=[...xml.matchAll(/<Settings(?:\s[^>]*)?>([\s\S]*?)<\/Settings>/gi)];
 const actions=[...xml.matchAll(/<Actions(?:\s[^>]*)?>([\s\S]*?)<\/Actions>/gi)];
 need(settings.length===1&&actions.length===1,'R54_TASK_XML_SHAPE_INVALID');
 const enabled=[...settings[0][1].matchAll(/<Enabled>(true|false)<\/Enabled>/gi)];
 const execs=[...actions[0][1].matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 need(enabled.length===1&&execs.length===1,'R54_TASK_XML_ACTION_INVALID');
 const commands=[...execs[0][1].matchAll(/<Command>([^<]+)<\/Command>/gi)];
 need(commands.length===1,'R54_TASK_XML_COMMAND_INVALID');
 // No XML entity expansion or arguments: this pinned CMD needs none.
 const action=commands[0][1];
 const normalize=s=>s.replace(/\//g,'\\').toLowerCase();
 need(!action.includes('&')&&normalize(action)===normalize(R54_TASK_ACTION),
  'R54_TASK_ACTION_CHANGED');
 const normalized=xml.replace(/(<Settings(?:\s[^>]*)?>[\s\S]*?<Enabled>)(?:true|false)(<\/Enabled>[\s\S]*?<\/Settings>)/i,
  '$1ORIGINAL_ENABLED$2');
 need(normalized!==xml,'R54_TASK_ENABLED_TAG_MISSING');
 // Task Scheduler may reindent XML or rewrite the declaration. Preserve the
 // backed-up bytes, but compare the relevant XML structure after restoration.
 const canonical=normalized.replace(/^\s*<\?xml[^>]*\?>/i,'')
  .replace(/>\s+</g,'><').trim();
 return {name:R54_TASK_NAME,xml:raw,xmlSha256:sha256(raw),
  enabled:enabled[0][1].toLowerCase()==='true',
  actionPath:action,actionSha256:R54_TASK_ACTION_SHA256,
  definitionDigest:sha256(Buffer.from(canonical,'utf8'))};
}

/** Fixed-vector Windows schtasks port; shell=false, exactly one Task name. */
export function r54FixedSchtasks(args,{platform=process.platform,
 systemRoot=process.env.SystemRoot,spawnTask=spawnSync}={}){
 need(platform==='win32'&&typeof systemRoot==='string'
  &&path.win32.isAbsolute(systemRoot)
  &&Array.isArray(args),'R54_TASK_WINDOWS_EXECUTOR_REQUIRED');
 const allowed=JSON.stringify(args)===JSON.stringify(['/Query','/TN',R54_TASK_NAME,'/XML'])
  ||['/Disable','/Enable'].some(mode=>JSON.stringify(args)===
   JSON.stringify(['/Change','/TN',R54_TASK_NAME,mode]));
 need(allowed,'R54_TASK_COMMAND_OUT_OF_SCOPE');
 const bin=path.win32.join(systemRoot,'System32','schtasks.exe');
 return spawnTask(bin,[...args],{shell:false,windowsHide:true,encoding:null,
  timeout:15000,maxBuffer:65536});
}

// Fixed-path, read-only Windows admission observation for the one R54 B
// operation. Neither Issue JSON nor a caller-selected executable supplies a
// command. This is intentionally NOT a start fence and never returns READY.
const R54_B_PROCESS_PATTERN=/(?:theme-nine-r54|theme-ten-r7[89]|theme-ten-r80|theme-ten-r81|THEME_NINE_R54_PUBLIC)/i;
export function parseR54BProcessCsv(buffer){
 need(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=4*1024*1024,
  'R54_B_FIXED_PROCESS_OUTPUT_INVALID');
 const utf16le=buffer[0]===0xff&&buffer[1]===0xfe;
 need(!(buffer[0]===0xfe&&buffer[1]===0xff)&&
  (!utf16le||buffer.length%2===0),'R54_B_FIXED_PROCESS_ENCODING_UNKNOWN');
 let src;
 try{
  const start=utf16le?2:buffer[0]===0xef&&buffer[1]===0xbb&&buffer[2]===0xbf?3:0;
  src=new TextDecoder(utf16le?'utf-16le':'utf-8',{fatal:true})
   .decode(buffer.subarray(start)).replace(/\r\n/g,'\n');
 }catch{need(false,'R54_B_FIXED_PROCESS_ENCODING_UNKNOWN');}
 need(!src.includes('\u0000')&&!src.includes('\uFFFD'),
  'R54_B_FIXED_PROCESS_ENCODING_UNKNOWN');
 const records=[];let row=[],field='',quoted=false;
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(c==='"'){
   if(quoted&&src[i+1]==='"'){field+='"';i++;}
   else quoted=!quoted;
  }else if(c===','&&!quoted){row.push(field);field='';}
  else if(c==='\n'&&!quoted){row.push(field);if(row.some(x=>x.trim()))records.push(row);row=[];field='';}
  else field+=c;
 }
 need(!quoted,'R54_B_FIXED_PROCESS_CSV_UNCLOSED_QUOTE');
 if(field||row.length){row.push(field);if(row.some(x=>x.trim()))records.push(row);}
 const index=records.findIndex(r=>r.includes('ProcessId')&&r.includes('ParentProcessId'));
 need(index>=0,'R54_B_FIXED_PROCESS_HEADER_MISSING');
 const header=records[index].map(x=>x.trim());
 const required=['Node','CommandLine','ExecutablePath','Name','ParentProcessId','ProcessId'];
 need(required.every(x=>header.includes(x)),'R54_B_FIXED_PROCESS_COLUMN_MISSING');
 const ids=new Set();
 return records.slice(index+1).map(r=>{
  need(r.length===header.length,'R54_B_FIXED_PROCESS_ROW_MALFORMED');
  const at=k=>r[header.indexOf(k)].trim();
  const pid=Number(at('ProcessId')),parent=Number(at('ParentProcessId'));
  need(Number.isSafeInteger(pid)&&pid>0&&Number.isSafeInteger(parent)&&parent>=0
   &&!ids.has(pid),'R54_B_FIXED_PROCESS_PID_UNKNOWN');
  ids.add(pid);
  return {pid,parent,name:at('Name'),cmd:at('CommandLine'),exe:at('ExecutablePath')};
 });
}

export function classifyR54BProcessTree(items){
 need(Array.isArray(items),'R54_B_FIXED_PROCESS_ITEMS_INVALID');
 const roots=new Set();
 for(const p of items){
  const name=(p.name??'').toLowerCase();
  if(/^(?:node|cmd|wscript|cscript|npm|npx)(?:\.exe)?$/.test(name)
   &&(!p.cmd||!p.exe))need(false,'R54_B_FIXED_PROCESS_LAUNCHER_REDACTED');
  if(R54_B_PROCESS_PATTERN.test(`${p.cmd??''} ${p.exe??''}`))roots.add(p.pid);
 }
 const active=new Set(roots);let changed=true;
 while(changed){changed=false;for(const p of items){
  if(active.has(p.parent)&&!active.has(p.pid)){active.add(p.pid);changed=true;}
 }}
 return {roots:roots.size,descendants:active.size-roots.size,
  active:[...active].sort((a,b)=>a-b)};
}

/** Fixed read-only WMI output: PID,parent,match only. Command lines stay in
 * Windows WMI memory and are never copied into a report or Issue. The bundled
 * maintenance-ancestry.vbs runs under cscript; WMIC is not required. */
export function parseR54BScopedWmiSnapshot(buffer){
 need(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=4*1024*1024,
  'R54_B_FIXED_PROCESS_OUTPUT_INVALID');
 let src;
 try{src=new TextDecoder('utf-8',{fatal:true}).decode(buffer)
   .replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trim();}
 catch{need(false,'R54_B_FIXED_PROCESS_ENCODING_UNKNOWN');}
 const lines=src.split('\n');
 need(lines.shift()==='PID,PARENT,MATCH','R54_B_FIXED_PROCESS_HEADER_MISSING');
 const items=[],seen=new Set();
 for(const line of lines){
  need(/^\d+,\d+,[01?]$/.test(line),'R54_B_FIXED_PROCESS_ROW_MALFORMED');
  const [id,parent,match]=line.split(','),pid=Number(id),ppid=Number(parent);
  need(Number.isSafeInteger(pid)&&pid>0&&Number.isSafeInteger(ppid)&&ppid>=0
   &&!seen.has(pid),'R54_B_FIXED_PROCESS_PID_UNKNOWN');
  seen.add(pid);items.push({pid,parent:ppid,match});
 }
 need(items.length>0,'R54_B_FIXED_PROCESS_SNAPSHOT_EMPTY');
 need(!items.some(x=>x.match==='?'),'R54_B_FIXED_PROCESS_VISIBILITY_UNKNOWN');
 const active=new Set(items.filter(x=>x.match==='1').map(x=>x.pid));
 const roots=active.size;
 let changed=true;
 while(changed){changed=false;for(const x of items){
  if(active.has(x.parent)&&!active.has(x.pid)){active.add(x.pid);changed=true;}
 }}
 return {roots,descendants:active.size-roots,
  active:[...active].sort((a,b)=>a-b)};
}

/** A native Win32 observation; MUST NOT be accepted as a freeze proof.
 * Dependencies are injectable for isolated tests only. `r54-b-apply` invokes
 * this with zero arguments, so no Issue field can override fixed OS ports. */
export function observeR54BWindowsReadOnly({platform=process.platform,
 systemRoot=process.env.SystemRoot,run=spawnSync,readAction=file=>fs.readFileSync(file),
 inspectSource=()=>inspectR54BOriginalSource(),
 inspectTask=inspectR54TaskXml,now=()=>new Date().toISOString()}={}){
 need(platform==='win32'&&typeof systemRoot==='string'
  &&/^[a-z]:\\windows$/i.test(systemRoot),'R54_B_FIXED_NATIVE_WINDOWS_REQUIRED');
 const fixed=(exe,args)=>{
  const binary=path.win32.join(systemRoot,'System32',exe);
  const out=run(binary,args,{shell:false,windowsHide:true,encoding:null,
   timeout:20000,maxBuffer:4*1024*1024});
  if(exe==='cscript.exe'&&out?.error?.code==='ENOENT')
   need(false,'R54_B_FIXED_WMI_HOST_UNAVAILABLE');
  need(out?.status===0&&!out?.error&&!out?.signal&&Buffer.isBuffer(out.stdout),
   'R54_B_FIXED_OS_OBSERVATION_FAILED');
  return out.stdout;
 };
 const census=()=>parseR54BScopedWmiSnapshot(fixed('cscript.exe',
  ['//NoLogo',path.win32.join(maintenanceRoot,'tools','maintenance-ancestry.vbs'),
   'R54_SCAN']));
 const task=()=>inspectTask(fixed('schtasks.exe',
  ['/Query','/TN',R54_TASK_NAME,'/XML']),readAction(R54_TASK_ACTION));
 const sourceFirst=inspectSource(),taskFirst=task(),processFirst=census();
 const sourceSecond=inspectSource(),taskSecond=task(),processSecond=census();
 need(sourceFirst?.status==='R54_B_ORIGINAL_SIX_SHA_VERIFIED'
  &&JSON.stringify(sourceFirst.files)===JSON.stringify(sourceSecond?.files),
  'R54_B_FIXED_SOURCE_CHANGED_DURING_OBSERVATION');
 need(taskFirst.xmlSha256===taskSecond.xmlSha256
  &&taskFirst.definitionDigest===taskSecond.definitionDigest,
  'R54_B_FIXED_TASK_CHANGED_DURING_OBSERVATION');
 need(processFirst.active.length===0&&processSecond.active.length===0,
  'R54_B_FIXED_ACTIVE_WRITER_PRESENT');
 return Object.freeze({status:'OBSERVED_ONLY_NEEDS_INDEPENDENT_FREEZE',
  observedAt:now(),taskName:R54_TASK_NAME,taskOriginallyEnabled:taskFirst.enabled,
  taskXmlSha256:taskFirst.xmlSha256,verifiedOriginalPaths:sourceFirst.files.length,
  processScans:2,manualEntrypointFreezeVerified:false,
  exclusiveStartFenceHeld:false,taskChanges:0,sourceChanges:0});
}

/** Read-only Query, durable baseline, one-task Disable and exact Restore.
 * runTask is an independently trusted, shell:false schtasks fixed-vector port.
 * Required on Windows; tests inject a no-OS mock. No manual entrypoint fence.
 */
export function createR54WindowsTaskAdapter({requestId,authorization,
 runTask=r54FixedSchtasks,readActionBytes=file=>fs.readFileSync(file),
 backupBase=path.join(maintenanceRoot,'r54-task-backups'),
 platform=process.platform}={}){
 need(platform==='win32'&&/^pc-[a-z0-9-]{8,76}$/.test(requestId??'')
  &&typeof runTask==='function'&&typeof readActionBytes==='function',
  'R54_TASK_TRUSTED_WINDOWS_ADAPTER_REQUIRED');
 need(authorization?.grade==='B'&&authorization.scope===R54_TASK_EXCEPTION
  &&authorization.taskName===R54_TASK_NAME&&authorization.singleUse===true
  &&authorization.preserveTaskDefinition===true
  &&authorization.allowForceTermination===false
  &&authorization.allowOtherTaskChanges===false,
  'R54_TASK_B_EXCEPTION_REQUIRED');
 const taskDir=path.join(backupBase,'r54-'+requestId);
 const backupFile=path.join(taskDir,'BASELINE.json');
 let baseline=null,saved=false;
 const perform=(args,code)=>{
  const out=runTask([...args]);
  need(out?.status===0&&!out.error&&!out.signal&&Buffer.isBuffer(out.stdout),code);
  return out.stdout;
 };
 const inspect=()=>{
  const output=perform(['/Query','/TN',R54_TASK_NAME,'/XML'],'R54_TASK_QUERY_FAILED');
  return inspectR54TaskXml(output,readActionBytes(R54_TASK_ACTION));
 };
 const saveBaseline=()=>{
  need(!saved&&!fs.existsSync(backupFile),'R54_TASK_BASELINE_ALREADY_EXISTS');
  const original=inspect();
  fs.mkdirSync(taskDir,{recursive:true});
  const data={schema:'ZGMINI_R54_TASK_BASELINE_V1',requestId,
   name:R54_TASK_NAME,enabled:original.enabled,
   xmlBase64:original.xml.toString('base64'),xmlSha256:original.xmlSha256,
   definitionDigest:original.definitionDigest,
   actionSha256:original.actionSha256};
  const fd=fs.openSync(backupFile,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(data)+'\n');fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
  const after=json(backupFile);
  need(after.requestId===requestId&&after.xmlSha256===original.xmlSha256
   &&sha256(Buffer.from(after.xmlBase64,'base64'))===original.xmlSha256,
   'R54_TASK_BASELINE_NOT_DURABLE');
  baseline=original;saved=true;
  return {...original,durableXmlBackupReadback:true};
 };
 const disable=()=>{
  need(saved&&baseline,'R54_TASK_BASELINE_REQUIRED');
  const before=inspect();
  need(before.definitionDigest===baseline.definitionDigest
   &&before.enabled===baseline.enabled,'R54_TASK_CHANGED_BEFORE_DISABLE');
  if(before.enabled){
   perform(['/Change','/TN',R54_TASK_NAME,'/Disable'],'R54_TASK_DISABLE_FAILED');
  }
  // No retry on ambiguous schtasks results. The host must reconcile first.
  const after=inspect();
  need(after.enabled===false&&after.definitionDigest===baseline.definitionDigest,
   'R54_TASK_DISABLE_READBACK_UNCERTAIN');
  return after;
 };
 const restore=({writerSixHashVerified=false}={})=>{
  need(saved&&baseline&&writerSixHashVerified===true,
   'R54_TASK_RESTORE_SOURCE_UNVERIFIED');
  const before=inspect();
  need(before.enabled===false&&before.definitionDigest===baseline.definitionDigest,
   'R54_TASK_RESTORE_PRESTATE_DRIFT');
  if(baseline.enabled){
   perform(['/Change','/TN',R54_TASK_NAME,'/Enable'],'R54_TASK_RESTORE_FAILED');
  }
  const after=inspect();
  need(after.enabled===baseline.enabled
   &&after.definitionDigest===baseline.definitionDigest,
   'R54_TASK_RESTORE_READBACK_DRIFT');
  return after;
 };
 return Object.freeze({inspect,saveBaseline,disable,restore});
}

const R54_B_SOURCE_COMMIT='99ddea206a5d07c029c85e980779bef712c8a4cc';
const R54_B_CANDIDATE_REPOSITORY='ansqhd5774-Choi/zgmini';

/** Downloads only the six approved pinned blobs, never a mutable branch or
 * arbitrary Issue-provided path. No Writer/source or Task changes here. */
export function fetchR54BPinnedCandidateBytes({readRemote=(rel)=>{
 const route=`repos/${R54_B_CANDIDATE_REPOSITORY}/contents/${rel}?ref=${R54_B_SOURCE_COMMIT}`;
 const out=execFileSync(gh,['api',route],{encoding:'utf8',windowsHide:true,
  timeout:45000,maxBuffer:2*1024*1024});
 const obj=JSON.parse(out);
 need(obj?.type==='file'&&obj.encoding==='base64'&&
  typeof obj.content==='string'&&obj.size>0&&obj.size<2*1024*1024,
  'R54_B_CANDIDATE_SOURCE_RESPONSE_INVALID');
 return Buffer.from(obj.content.replace(/\s/g,''),'base64');
}}={}){
 const blobs=new Map();
 for(const spec of R54_B_SOURCE_FILES){
  const value=readRemote(spec.path);
  need(Buffer.isBuffer(value)&&sha256(value)===spec.next,
   'R54_B_CANDIDATE_SOURCE_SHA_DRIFT');
  blobs.set(spec.path,value);
 }
 return blobs;
}

/** Source-only B transaction primitive: connector absent while the five
 * support files move. The host must first disable the one R54 Task, naturally
 * drain its processes, and keep its own source lease during this function.
 * Every backup is durable outside the Writer tree, and no blind retry occurs.
 * Injectable specs/hooks are for isolated fixture tests, never Issue fields. */
export async function applyR54BPinnedSixConnectorLast({installedRoot,
 backupRoot,requestId,candidateBytes,verifyWindow,files=R54_B_SOURCE_FILES}={}){
 need(/^pc-[a-z0-9-]{8,76}$/.test(requestId??'')&&
  typeof installedRoot==='string'&&path.isAbsolute(installedRoot)&&
  typeof backupRoot==='string'&&path.isAbsolute(backupRoot)&&
  typeof verifyWindow==='function'&&candidateBytes instanceof Map&&
  Array.isArray(files)&&files.length===6,
  'R54_B_FIXED_SOURCE_ARGUMENTS');
 const root=fs.realpathSync.native(installedRoot);
 need(!fs.lstatSync(installedRoot).isSymbolicLink()&&
  fs.statSync(root).isDirectory(),'R54_B_SOURCE_ROOT_REDIRECT');
 const safeBackupParent=fs.realpathSync.native(path.dirname(backupRoot));
 need(!safeBackupParent.toLowerCase().startsWith(root.toLowerCase()+path.sep.toLowerCase())
  &&safeBackupParent.toLowerCase()!==root.toLowerCase(),
  'R54_B_BACKUP_INSIDE_WRITER_DENIED');
 const connector=files.find(x=>x.path==='scripts/pc-writer/theme-nine-r54-public-connect.mjs');
 need(connector&&files.filter(x=>x.path===connector.path).length===1&&
  new Set(files.map(x=>x.path)).size===6,'R54_B_CONNECTOR_FIXED_SCOPE');
 const rows=files.map(spec=>{
  need(/^[a-f0-9]{64}$/.test(spec.old)&&/^[a-f0-9]{64}$/.test(spec.next)&&
   spec.path.split('/').every(x=>/^[\w.-]+$/.test(x)&&x!=='.'&&x!=='..'),
   'R54_B_SOURCE_PATH_DENIED');
  const file=path.join(root,...spec.path.split('/'));
  let p=root;
  for(const segment of spec.path.split('/')){
   p=path.join(p,segment);
   need(!fs.lstatSync(p).isSymbolicLink(),'R54_B_SOURCE_REPARSE_DENIED');
  }
  need(sha256(fs.readFileSync(file))===spec.old,
   'R54_B_INSTALLED_SOURCE_SHA_DRIFT');
  const bytes=candidateBytes.get(spec.path);
  need(Buffer.isBuffer(bytes)&&sha256(bytes)===spec.next,
   'R54_B_CANDIDATE_SOURCE_SHA_DRIFT');
  const backup=path.join(backupRoot,...spec.path.split('/'));
  const stage=file+'.R54_B_'+requestId+'.stage';
  const parked=file+'.R54_B_'+requestId+'.old';
  need(!fs.existsSync(stage)&&!fs.existsSync(parked)&&
   !fs.existsSync(backup),'R54_B_SOURCE_PRIOR_ATTEMPT_RECONCILE');
  return {...spec,file,backup,stage,parked,bytes};
 });
 need(!fs.existsSync(backupRoot),'R54_B_BACKUP_ALREADY_EXISTS');
 fs.mkdirSync(backupRoot,{recursive:true});
 const journal=path.join(backupRoot,'JOURNAL.jsonl');
 const fd=fs.openSync(journal,'wx',0o600);
 let seq=0,mutationStarted=false;
 const record=(phase,rel=null)=>{
  fs.writeSync(fd,JSON.stringify({schema:'R54_B_SIXFILE_CONNECTOR_LAST_V1',
   requestId,seq:seq++,phase,file:rel})+'\n');fs.fsyncSync(fd);
 };
 const saveExact=(target,bytes)=>{
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const fileFd=fs.openSync(target,'wx',0o600);
  try{fs.writeFileSync(fileFd,bytes);fs.fsyncSync(fileFd);}
  finally{fs.closeSync(fileFd);}
  need(sha256(fs.readFileSync(target))===sha256(bytes),
   'R54_B_DURABLE_BYTES_READBACK_FAILED');
 };
 const actual=row=>fs.existsSync(row.file)?sha256(fs.readFileSync(row.file)):null;
 const allState=hashField=>rows.every(x=>actual(x)===x[hashField]);
 try{
  record('PREPARING');
  for(const row of rows){
   saveExact(row.backup,fs.readFileSync(row.file));
   need(sha256(fs.readFileSync(row.backup))===row.old,'R54_B_BACKUP_SHA_DRIFT');
   saveExact(row.stage,row.bytes);
  }
  record('STAGED_AND_BACKED_UP');
  need(await verifyWindow()===true,'R54_B_SOURCE_COLLISION_BEFORE_SWAP');
  need(allState('old'),'R54_B_CAS_ORIGINAL_CHANGED');
  const move=async row=>{
   need(await verifyWindow()===true,'R54_B_SOURCE_COLLISION_DURING_SWAP');
   need(actual(row)===row.old,'R54_B_CAS_CHANGED_DURING_SWAP');
   record('SWAP_ATTEMPT',row.path);
   mutationStarted=true;
   fs.renameSync(row.file,row.parked);
   fs.renameSync(row.stage,row.file);
   need(actual(row)===row.next,'R54_B_FILE_READBACK_FAILED');
   record('FILE_APPLIED',row.path);
  };
  // Quarantine the connector BEFORE touching the five support files.
  const c=rows.find(x=>x.path===connector.path);
  record('CONNECTOR_QUARANTINE_ATTEMPT',c.path);
  mutationStarted=true;
  fs.renameSync(c.file,c.parked);
  need(!fs.existsSync(c.file)&&sha256(fs.readFileSync(c.parked))===c.old,
   'R54_B_CONNECTOR_QUARANTINE_UNCERTAIN');
  record('CONNECTOR_QUARANTINED',c.path);
  for(const row of rows.filter(x=>x!==c))await move(row);
  need(await verifyWindow()===true,'R54_B_SOURCE_COLLISION_BEFORE_CONNECTOR');
  record('CONNECTOR_INSTALL_ATTEMPT',c.path);
  fs.renameSync(c.stage,c.file);
  need(allState('next'),'R54_B_FINAL_SIX_SHA_INVALID');
  record('SIX_SOURCE_VERIFIED');
  // Original bytes remain safely in backupRoot; remove only exact own
  // parked sidecars after all six new hashes have been verified.
  for(const row of rows){
   need(sha256(fs.readFileSync(row.parked))===row.old,
    'R54_B_PARKED_ORIGINAL_SHA_DRIFT');
   fs.unlinkSync(row.parked);
  }
  record('SUCCEEDED');
  return {status:'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED',changed:6,
   backupRoot,journal,sourceIntegrityVerified:true};
 }catch(error){
  if(mutationStarted){
   try{record('ROLLBACK_STARTED');}catch{/* preserve original failure */}
   let unknown=false;
   // Hide the connector FIRST, so no new R54 reader can see mixed support
   // files during reverse repair. Connector is restored LAST.
   const c=rows.find(x=>x.path===connector.path);
   try{
    const state=actual(c);
    if(state===c.next)fs.renameSync(c.file,
     c.file+'.R54_B_'+requestId+'.rejected');
    else if(state===c.old){
     need(!fs.existsSync(c.parked),'R54_B_CONNECTOR_PARK_CONFLICT');
     fs.renameSync(c.file,c.parked);
    }else need(state===null,'R54_B_CONNECTOR_UNKNOWN_BYTES');
    need(!fs.existsSync(c.file),'R54_B_CONNECTOR_STILL_EXPOSED');
   }catch{unknown=true;}
   for(const row of [...rows.filter(x=>x!==c)].reverse()){
    try{
     const current=actual(row);
     if(current===row.old)continue;
     if(current!==null&&current!==row.next){unknown=true;continue;}
     need(sha256(fs.readFileSync(row.backup))===row.old,
      'R54_B_BACKUP_SHA_DRIFT');
     if(current===row.next)fs.renameSync(row.file,
      row.file+'.R54_B_'+requestId+'.rejected');
     fs.copyFileSync(row.backup,row.file,fs.constants.COPYFILE_EXCL);
     if(actual(row)!==row.old)unknown=true;
    }catch{unknown=true;}
   }
   try{
    if(!unknown){
     need(sha256(fs.readFileSync(c.backup))===c.old,
      'R54_B_CONNECTOR_BACKUP_SHA_DRIFT');
     fs.copyFileSync(c.backup,c.file,fs.constants.COPYFILE_EXCL);
     need(actual(c)===c.old,'R54_B_CONNECTOR_ROLLBACK_SHA_DRIFT');
    }
   }catch{unknown=true;}
   if(unknown||!allState('old')){
    try{record('RECOVERY_REQUIRED');}catch{}
    throw Object.assign(Error('R54_B_MIXED_SOURCE_RECOVERY_REQUIRED'),
     {code:'R54_B_MIXED_SOURCE_RECOVERY_REQUIRED',cause:error});
   }
   try{record('ROLLED_BACK_VERIFIED');}
   catch{throw Object.assign(Error('R54_B_JOURNAL_RECOVERY_REQUIRED'),
    {code:'R54_B_JOURNAL_RECOVERY_REQUIRED',cause:error});}
  }
  throw error;
 }finally{fs.closeSync(fd);}
}

/** Production-only fixed Windows process observation (no arbitrary command).
 * The installed maintenance-ancestry.vbs uses WMI, not removed wmic.exe. */
export function scanR54BActiveWindowsProcesses({platform=process.platform,
 systemRoot=process.env.SystemRoot,run=spawnSync}={}){
 need(platform==='win32'&&typeof systemRoot==='string'&&
  /^[a-z]:\\windows$/i.test(systemRoot),'R54_B_WINDOWS_WMI_REQUIRED');
 const output=run(path.win32.join(systemRoot,'System32','cscript.exe'),
  ['//NoLogo',path.win32.join(maintenanceRoot,'tools','maintenance-ancestry.vbs'),
   'R54_SCAN'],{shell:false,windowsHide:true,encoding:null,
   timeout:20000,maxBuffer:4*1024*1024});
 need(output?.status===0&&!output?.error&&!output?.signal&&
  Buffer.isBuffer(output.stdout),'R54_B_WMI_READ_FAILED');
 return parseR54BScopedWmiSnapshot(output.stdout);
}

/** Actual one-shot B host path. This function is called only after the normal
 * trusted Issue+manifest admission in command('r54-b-apply'). No Issue can
 * choose files, a Task, OS commands, commit, or retry count. */
export async function runR54BApprovedOneShot({requestId,
 taskFactory=createR54WindowsTaskAdapter,
 sourceScan=scanR54BActiveWindowsProcesses,
 loadCandidates=fetchR54BPinnedCandidateBytes,
 acquireInstall=()=>acquireMaintenanceLock(maintenanceRoot,'controller-install'),
 acquireWriter=()=>acquireR54BSourceLease(),
 writerRoot=R54_B_WRITER_ROOT,
 backupBase=path.join(maintenanceRoot,'ledger'),
 pause=wait,
 applyFiles=applyR54BPinnedSixConnectorLast,
 inspectOriginal=inspectR54BOriginalSource,
 readPinnedHashes=()=>R54_B_SOURCE_FILES.map(x=>sha256(fs.readFileSync(
  path.join(writerRoot,...x.path.split('/')))))}={}){
 need(/^pc-[a-z0-9-]{8,76}$/.test(requestId??''),
  'R54_B_REQUEST_ID_INVALID');
 // Read-only preparation occurs before any maintenance/Task/source write.
 const backupRoot=path.join(backupBase,'R54_B_'+requestId);
 let candidateBytes,installLease,lastPass='NONE';
 try{
  candidateBytes=loadCandidates();
  lastPass='R54_B_CANDIDATES_LOADED';
  const baselineSource=inspectOriginal({root:writerRoot});
  need(baselineSource.files.length===6,'R54_B_SIX_ORIGINALS_REQUIRED');
  lastPass='R54_B_ORIGINAL_SIX_SHA_VERIFIED';
  need(!fs.existsSync(backupRoot),'R54_B_PREVIOUS_ATTEMPT_RECONCILE');
  installLease=acquireInstall();
 }catch(error){
  // Downloads and the six-source inventory are read-only. An unavailable
  // private GitHub blob must not be escalated into an imaginary partial swap.
  const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:
   /^[A-Z0-9_]+$/.test(error?.message??'')?error.message:
   'R54_B_READONLY_PREPARATION_FAILED';
  return {status:'BLOCKED',code,lastPass,taskWrites:0,writerFilesChanged:0,
   controllerWrites:0,providerCalls:0,d1Writes:0,
   firstFail:code,
   ...(Array.isArray(error?.sourceInventory)
    ?{sourceInventory:error.sourceInventory}:{}),
   protectedStateUnchanged:true,noAutomaticRetry:true};
 }
 let writerLease=null,task=null,taskBaseline=null,taskDisabled=false;
 let taskDisableAttempted=false,taskRestoreAttempted=false;
 let recover=false,writerChanged=false,restored=false;
 try{
  writerLease=acquireWriter();
  need(writerLease.status==='ACQUIRED'&&writerLease.assertHeld(),
   'R54_B_SOURCE_LEASE_BUSY');
  task=taskFactory({requestId,authorization:{grade:'B',
   scope:R54_TASK_EXCEPTION,taskName:R54_TASK_NAME,singleUse:true,
   preserveTaskDefinition:true,allowForceTermination:false,
   allowOtherTaskChanges:false}});
  taskBaseline=task.saveBaseline();
  need(taskBaseline.durableXmlBackupReadback===true&&
   taskBaseline.name===R54_TASK_NAME,'R54_B_TASK_BASELINE_NOT_DURABLE');
  taskDisableAttempted=true;
  task.disable();taskDisabled=true;
  const windowClear=()=>{
   const current=task.inspect();
   if(current.enabled!==false||current.definitionDigest!==taskBaseline.definitionDigest)
    return false;
   if(!writerLease.assertHeld())return false;
   return sourceScan().active.length===0;
  };
  let drained=false;
  for(let n=0;n<60;n++){
   if(windowClear()){drained=true;break;}
   if(n<59)await pause(1000);
  }
  need(drained,'R54_B_NATURAL_DRAIN_PENDING');
  // The applier checks the entire six-file CAS again and checks the same
  // live collision window before every rename, not merely a stale snapshot.
  const result=await applyFiles({installedRoot:writerRoot,backupRoot,requestId,
   candidateBytes,verifyWindow:windowClear});
  need(result.status==='SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED',
   'R54_B_SIX_SOURCE_NOT_VERIFIED');
  writerChanged=true;
  const final=readPinnedHashes().every((x,i)=>x===R54_B_SOURCE_FILES[i].next);
  need(final,'R54_B_SIX_FINAL_READBACK_DRIFT');
  taskRestoreAttempted=true;
  const after=task.restore({writerSixHashVerified:true});
  need(after.enabled===taskBaseline.enabled&&
   after.definitionDigest===taskBaseline.definitionDigest,
   'R54_B_TASK_RESTORE_UNVERIFIED');
  restored=true;
  return {status:'SUCCEEDED',code:'R54_B_SIXFILE_TASK_RESTORED',
   writerFilesChanged:6,taskChanged:taskBaseline.enabled,
   taskDefinitionPreserved:true,taskRestored:true,
   providerCalls:0,d1Writes:0,controllerWrites:0,
   candidatesFromCommit:R54_B_SOURCE_COMMIT};
 }catch(error){
  // Restore the original Task only when the source is conclusively all old
  // or all new. A mixed/unknown source must remain stopped for recovery.
  let old=false,newer=false;
  try{
   const checks=readPinnedHashes();
   old=checks.every((x,i)=>x===R54_B_SOURCE_FILES[i].old);
   newer=checks.every((x,i)=>x===R54_B_SOURCE_FILES[i].next);
  }catch{/* missing connector, partial rename, or inaccessible source */}
  if(taskDisableAttempted&&!taskDisabled){
   // An interrupted schtasks /Disable may have succeeded despite an error.
   // Observe its actual state; do not retry or guess the Task mutation.
   try{
    const current=task.inspect();
    if(current.enabled===taskBaseline.enabled&&
     current.definitionDigest===taskBaseline.definitionDigest)restored=true;
    else recover=true;
   }catch{recover=true;}
  }
  if(taskDisabled&&taskBaseline&&(old||newer)&&
   !restored&&!taskRestoreAttempted){
   try{taskRestoreAttempted=true;task.restore({writerSixHashVerified:true});
    restored=true;}
   catch{recover=true;}
  }
  if(taskDisableAttempted&&!restored)recover=true;
  const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:
   /^[A-Z0-9_]+$/.test(error?.message??'')?error.message:
   'R54_B_ONE_SHOT_EXECUTION_FAILED';
  return {status:recover?'RECOVERY_REQUIRED':'BLOCKED',code,
   writerFilesChanged:writerChanged?6:old?0:null,
   taskRestored:restored,sourceOldVerified:old,sourceNewVerified:newer,
   providerCalls:0,d1Writes:0,controllerWrites:0,
   noAutomaticRetry:true};
 }finally{
  if(recover){
   try{installLease.holdForRecovery();}catch{}
  }else{
   if(writerLease?.status==='ACQUIRED')writerLease.release();
   installLease.release();
  }
 }
}
const sameR6WindowsPath=(left,right)=>path.win32.normalize(left).toLowerCase()===path.win32.normalize(right).toLowerCase();
const r6FileIdentity=file=>{const s=fs.statSync(file,{bigint:true});
 need(s.isFile(),'R6_HOST_DB_NOT_REGULAR');
 return {realpath:fs.realpathSync(file),dev:String(s.dev),ino:String(s.ino),
  size:String(s.size),mtimeNs:String(s.mtimeNs)};
};
export function reconnectState({now,deadline,matched,online}){
 return matched&&online?'PASS':now<deadline?'WAIT':'TIMEOUT';
}
export function freshListenerCount(root,startedAt){
 let count=0;
 for(let seat=1;seat<=6;seat++){
  const dir=path.join(root,'runners',String(seat).padStart(2,'0'),'_diag');
  if(!fs.existsSync(dir))continue;
  const logs=fs.readdirSync(dir).filter(p=>/^Runner_[0-9]{8}-[0-9]{6}-utc\.log$/.test(p)).map(p=>({p:path.join(dir,p),stat:fs.statSync(path.join(dir,p))})).sort((a,b)=>b.stat.birthtimeMs-a.stat.birthtimeMs);
  const log=logs[0];if(!log||log.stat.birthtimeMs<startedAt-2000)continue;
  const fd=fs.openSync(log.p,'r');let bytes;
  try{const size=fs.fstatSync(fd).size;bytes=Buffer.alloc(Math.min(size,65536));fs.readSync(fd,bytes,0,bytes.length,Math.max(0,size-bytes.length));}finally{fs.closeSync(fd);}
  const text=bytes.toString('utf8'),positive=Math.max(text.lastIndexOf('Listening for Jobs'),text.lastIndexOf('Runner reconnected.'));
  const conflict=Math.max(text.lastIndexOf('A session for this runner already exists.'),text.lastIndexOf('Runner listener exit'));
  if(positive>=0&&positive>conflict)count++;
 }
 return count;
}

// The process must not inherit the Runner Actions job. An approved Startup
// origin proof is required: walking beyond the long-lived receiver to an
// already exited WScript would be unknowable and could reuse a stale PID.
function verifyIndependent(supervisorPid) {
 need(process.platform==='win32','WINDOWS_PC_REQUIRED');
 need(!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&!process.env.GITHUB_RUN_ID,'MAINTENANCE_PROCESS_NOT_INDEPENDENT');
 const checker=path.join(maintenanceRoot,'tools/maintenance-ancestry.vbs');
 need(fs.existsSync(checker),'MAINTENANCE_ANCESTRY_CHECK_MISSING');
 const installed=json(path.join(maintenanceRoot,'MAINTENANCE_INSTALL.json'));
 need(installed.schema==='ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&validSha(installed.sourceSha)&&
  /^[a-f0-9]{64}$/.test(installed.startupSha256??''),'MAINTENANCE_ORIGIN_UNKNOWN');
 const expected=maintenanceOriginFiles;
 need(Object.keys(installed.files??{}).length===expected.length,'MAINTENANCE_SELF_DRIFT');
 for(const rel of expected){
  need(/^[a-f0-9]{64}$/.test(installed.files[rel]??'')&&
   sha256(fs.readFileSync(path.join(maintenanceRoot,rel)))===installed.files[rel],'MAINTENANCE_SELF_DRIFT');
 }
 const appData=process.env.APPDATA;
 need(typeof appData==='string'&&path.isAbsolute(appData),'MAINTENANCE_ORIGIN_UNKNOWN');
 const startup=path.join(appData,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
 need(sha256(fs.readFileSync(startup))===installed.startupSha256,'MAINTENANCE_ORIGIN_UNKNOWN');
 const owner=json(path.join(maintenanceRoot,'leases/receiver/owner.json'));
 need(Number.isSafeInteger(owner.pid)&&owner.pid>0&&/^[0-9a-f-]{36}$/.test(owner.nonce??'')&&
  Math.abs(owner.bootAt-(Date.now()-os.uptime()*1000))<10000,'MAINTENANCE_ORIGIN_UNKNOWN');
 const proof=json(path.join(maintenanceRoot,'receivers',owner.nonce+'.json'));
 need(proof.schema==='ZGMINI_PC_RECEIVER_ORIGIN_V1'&&
  proof.sourceSha===installed.sourceSha&&proof.startupSha256===installed.startupSha256&&
  proof.pid===owner.pid&&proof.nonce===owner.nonce&&proof.bootAt===owner.bootAt&&
  /^[0-9]{14}\.[0-9]{6}[+-][0-9]{3}$/.test(proof.created??'')&&
  /^[0-9]{1,9}$/.test(proof.session??'')&&/^S-1-[0-9-]{4,100}$/.test(proof.sid??''),
  'MAINTENANCE_ORIGIN_UNKNOWN');
 let result='UNKNOWN';
 try{result=execFileSync('cscript.exe',['//NoLogo',checker,'VERIFY',
  String(process.pid),String(supervisorPid),String(owner.pid),proof.created,proof.session,proof.sid],
  {windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:4096}).trim();}
 catch{throw Object.assign(Error('MAINTENANCE_PROCESS_NOT_INDEPENDENT'),{code:'MAINTENANCE_PROCESS_NOT_INDEPENDENT'});}
 need(result==='INDEPENDENT','MAINTENANCE_PROCESS_NOT_INDEPENDENT');
}

function readOwner() {
 need(fs.existsSync(path.join(controlRoot,'leases/supervisor/owner.json')),'SUPERVISOR_OWNER_MISSING');
 need(fs.existsSync(path.join(controlRoot,'SUPERVISOR_STATUS.json')),'SUPERVISOR_STATUS_MISSING');
 const owner=json(path.join(controlRoot,'leases/supervisor/owner.json'));
 const status=json(path.join(controlRoot,'SUPERVISOR_STATUS.json'));
 need(Number.isSafeInteger(owner.pid)&&owner.pid>0&&owner.pid===status.pid,'SUPERVISOR_IDENTITY_MISMATCH');
 need(/^[0-9a-f-]{36}$/.test(owner.nonce),'SUPERVISOR_OWNER_NONCE');
 need(Math.abs(owner.bootAt-(Date.now()-os.uptime()*1000))<10000,'SUPERVISOR_BOOT_MISMATCH');
 need(Date.now()-Date.parse(status.at)<45000,'SUPERVISOR_IDENTITY_STALE');
 need(status.mode==='LISTENING'&&status.children?.length===6,'SUPERVISOR_NOT_HEALTHY');
 return {owner,status};
}
export function recoveryOperatorProofStatus({exitCode,stdout,errorCode}={}){
 if(exitCode===0&&typeof stdout==='string'&&stdout.trim()==='INDEPENDENT_OPERATOR')
  return {verified:true,code:'RECOVERY_OPERATOR_VERIFIED'};
 return {verified:false,code:errorCode==='ETIMEDOUT'?'RECOVERY_OPERATOR_PROOF_TIMEOUT':
  errorCode==='ENOENT'?'RECOVERY_OPERATOR_PROOF_TOOL_UNAVAILABLE':'RECOVERY_OPERATOR_ATTESTATION_UNVERIFIED'};
}
export function verifyRecoveryOperator(supervisorPid=0){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'RECOVERY_OPERATOR_REQUIRED');
 const installed=json(path.join(maintenanceRoot,'MAINTENANCE_INSTALL.json'));
 for(const [rel,expected]of Object.entries(installed.files??{})){
  need(/^tools\/[a-z0-9.-]+$/.test(rel)&&sha256(fs.readFileSync(path.join(maintenanceRoot,rel)))===expected,'MAINTENANCE_SELF_DRIFT');
 }
 let observation;
 try{observation={exitCode:0,stdout:execFileSync('cscript.exe',['//NoLogo',path.join(maintenanceRoot,'tools/maintenance-ancestry.vbs'),'OPERATOR',String(process.pid),String(supervisorPid)],{encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:4096})};}
 catch(error){observation={exitCode:error.status,errorCode:error.code};}
 const proof=recoveryOperatorProofStatus(observation);
 need(proof.verified,proof.code);
}

const hashFiles=(root,files)=>Object.fromEntries(files.map(rel=>[rel,sha256(fs.readFileSync(path.join(root,rel)))]));
// Candidate files are not the running Controller. A failed preparation can be
// isolated only inside this request's previously absent namespace. Never delete
// artifacts, follow links, or use this check as a runtime/protection proof.
export function isolatedControllerStage(backupRoot,plannedFiles,{io=fs}={}){
 if(!path.isAbsolute(backupRoot)||!Array.isArray(plannedFiles)||
  plannedFiles.some(p=>typeof p!=='string'||!/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p)))return false;
 const allowed=new Set(['stage','stage/controller','stage/config','stage/host.json',...plannedFiles.map(p=>'stage/'+p)]);
 const visit=(dir,prefix='')=>{
  const stat=io.lstatSync(dir);if(!stat.isDirectory()||stat.isSymbolicLink())return false;
  for(const name of io.readdirSync(dir)){
   const rel=prefix?prefix+'/'+name:name;
   if(!allowed.has(rel))return false;
   const file=path.join(dir,name),item=io.lstatSync(file);
   if(item.isSymbolicLink())return false;
   if(item.isDirectory()){if(!visit(file,rel))return false;}
   else if(!item.isFile()||item.nlink>1)return false;
  }
  return true;
 };
 try{return visit(backupRoot);}catch(error){return error.code==='ENOENT'&&!io.existsSync(backupRoot);}
}
function installedManifest() {
 const host=json(hostPath),installedSha=host.controllerSourceSha;
 need(validSha(installedSha),'INSTALLED_SHA_INVALID');
 for(const [rel,expected] of Object.entries(host.controllerFiles??{})) {
  need(/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel),'INSTALLED_FILE_PATH');
  need(sha256(fs.readFileSync(path.join(controlRoot,rel)))===expected,'CURRENT_CONTROLLER_DRIFT');
 }
 return {host,installedSha};
}

// No-effect classification requires a complete, stable file inventory, not
// merely valid digests for an attacker-truncated host.controllerFiles subset.
// Scope this to prevalidation proof; older installed manifests remain readable.
export function prevalidationInventory(host){
 const files=host?.controllerFiles;
 if(!files||typeof files!=='object'||Array.isArray(files)||
   Object.keys(files).length<INSTALLABLE_FILES.length||
   INSTALLABLE_FILES.some(rel=>!/^[a-f0-9]{64}$/.test(files[rel]??'')))
   return null;
 return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}

// GitHub does not replay Issue `opened` events while a workflow is disabled.
// A failed postcheck may pause intake a SECOND time during rollback. Preserve
// every pause interval; never silently replace the first successful replay.
export function backlogPauseWindows(state){
 need(state?.schema==='ZGMINI_PC_BACKLOG_V1','BACKLOG_STATE_INVALID');
 const windows=Array.isArray(state.windows)?state.windows:
  [{pausedAt:state.pausedAt,resumedAt:state.resumedAt}];
 need(windows.length>=1&&windows.length<=8,'BACKLOG_WINDOWS_INVALID');
 for(const window of windows){
  const start=Date.parse(window?.pausedAt??''),end=window?.resumedAt==null?null:Date.parse(window.resumedAt);
  need(Number.isFinite(start)&&(end===null||(Number.isFinite(end)&&end>=start)),
   'BACKLOG_WINDOW_INVALID');
 }
 return windows;
}
export function openRollbackPause(state,time){
 const windows=backlogPauseWindows(state);
 need(windows.every(w=>w.resumedAt),'BACKLOG_PRIOR_PAUSE_OPEN');
 need(Number.isFinite(Date.parse(time)),'BACKLOG_PAUSE_TIME_INVALID');
 return {...state,windows:[...windows,{pausedAt:time,resumedAt:null}]};
}
export function closeLatestPause(state,time){
 const windows=backlogPauseWindows(state).map(w=>({...w}));
 const open=windows.filter(w=>!w.resumedAt);
 need(open.length===1,'BACKLOG_OPEN_WINDOW_NOT_UNIQUE');
 const next=windows.at(-1);
 need(!next.resumedAt&&Number.isFinite(Date.parse(time))&&Date.parse(time)>=Date.parse(next.pausedAt),
  'BACKLOG_RESUME_TIME_INVALID');
 next.resumedAt=time;
 return {...state,windows,resumedAt:state.resumedAt??time};
}
export function backlogIssueInPause(entry,window){
 const created=Date.parse(entry?.created_at??''),start=Date.parse(window.pausedAt)-2000,
   end=Date.parse(window.resumedAt??'');
 return !entry?.pull_request&&entry?.user?.login==='ansqhd5774-Choi'&&
   entry?.labels?.some(x=>x.name==='pc-job')&&Number.isFinite(created)&&
   created>=start&&created<=end&&
   !String(entry?.title??'').startsWith('Maintenance replay ');
}

const retiredIranTask='ZGMINI-PC-Iran-Progress-R13';
const taskNotFound=text=>/cannot find the file|cannot find the specified|does not exist|지정.*(?:파일|작업|경로).*찾을 수 없|찾을 수 없.*(?:파일|작업|경로)/i.test(text);
const decodeTaskOutput=bytes=>new TextDecoder('euc-kr').decode(bytes);
const taskMissingError=bytes=>[decodeTaskOutput(bytes),Buffer.from(bytes).toString('utf8')].some(taskNotFound);
export function confirmRetiredIranAbsent({exact,inventory}){
 // An intentionally removed task is a protected state, not a missing guard.
 // A nonzero exit alone could mean ACCESS_DENIED. Fail closed on uncertainty.
 need(exact&&!exact.error&&!exact.signal,'RETIRED_IRAN_QUERY_UNCERTAIN');
 need(exact.status!==0,'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE');
 need(exact.status===1&&taskMissingError(exact.stderr??Buffer.alloc(0)),
  'RETIRED_IRAN_QUERY_UNCERTAIN');
 need(inventory&&!inventory.error&&!inventory.signal&&inventory.status===0,
  'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 const names=decodeTaskOutput(inventory.stdout??Buffer.alloc(0)).split(/\r?\n/)
  .map(line=>line.match(/^\s*"([^"]+)"\s*,/)?.[1]??null).filter(Boolean);
 need(names.length>0,'RETIRED_IRAN_INVENTORY_UNAVAILABLE');
 need(!names.some(name=>/ZGMINI-PC-Iran/i.test(name)),'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE');
 return 'APPROVED_RETIRED_ABSENT';
}
function retiredIranEvidence(schtasks){
 const opt={windowsHide:true,timeout:15000,maxBuffer:4000000};
 const exact=spawnSync(schtasks,['/Query','/TN',retiredIranTask,'/XML'],opt);
 // Inventory is mandatory even when the direct query failed: reject name drift
 // and distinguish a genuine absence from an untrustworthy query environment.
 const inventory=spawnSync(schtasks,['/Query','/FO','CSV','/NH'],opt);
 return confirmRetiredIranAbsent({exact,inventory});
}
export function protectedSnapshot() {
 // Existing Core task XML hashes + PC writer config hashes, read-only.
 const dataRoot='E:/ZGmini/data',out={files:{},tasks:{}};
 for(const name of ['config.json','quota-runner.cmd','run-local.cmd']) {
  const f=path.join(dataRoot,'pc-writer',name);
  if(fs.existsSync(f))out.files[name]=sha256(fs.readFileSync(f));
 }
 const schtasks=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
 for(const name of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']) {
  out.tasks[name]=sha256(execFileSync(schtasks,['/Query','/TN',name,'/XML'],{windowsHide:true,timeout:15000}));
 }
 out.tasks[retiredIranTask]=retiredIranEvidence(schtasks);
 return out;
}

export function makePorts(packageData,issueNumber,{recoveryOperator=false,
 approvedRecoveryWriterConfigSha256=null}={}) {
 const {issue,manifest}=packageData,request={requestId:issue.requestId,chatId:issue.chatId,
  installedSha:manifest.installedSha,targetSha:manifest.targetSha,postOperation:manifest.postOperation};
 const ledgerFile=path.join(recordDir,request.requestId+'.json');
 const backlogFile=path.join(maintenanceRoot,'backlog',request.requestId+'.json');
 const backupRoot=path.join(controlRoot,'backups','controller-update-'+request.requestId);
 const stageRoot=path.join(backupRoot,'stage');
 const snapshotRoot=path.join(backupRoot,'snapshot');
 let plannedFiles=[],protectedBefore,prevalidationBaseline,oldOwner,pausedByUs=false,postIssueNumber,reconnectStartedAt=0;
 const apiRunners=()=>requireCompleteRunnerInventory(github('actions/runners?per_page=100'));
 const runnersCorrect=rows=>dedicatedPcRunnerRows(rows)!==null;
 const available=rows=>dedicatedPcRunnerRows(rows,{requireOnline:true,requireIdle:true})!==null;
 const waitForReconnect=async(pid,sourceSha,code)=>{
  const deadline=Date.now()+600000;
  let stable=0;
  for(;;){
   const status=fs.existsSync(path.join(controlRoot,'SUPERVISOR_STATUS.json'))?json(path.join(controlRoot,'SUPERVISOR_STATUS.json')):null;
   const rows=apiRunners();
   const listeners=freshListenerCount(controlRoot,reconnectStartedAt);
   const matched=status?.pid===pid&&status.sourceSha===sourceSha&&Date.now()-Date.parse(status.at)<45000&&status.children?.length===6&&listeners===6;
   const seats=dedicatedPcRunnerRows(rows);
   const online=seats!==null&&seats.every(x=>x.status==='online');
   const state=reconnectState({now:Date.now(),deadline,matched,online});
   writeJson(path.join(maintenanceRoot,'reconnect',request.requestId+'.json'),{at:new Date().toISOString(),state,supervisorPid:pid,sourceSha,freshListeners:listeners,onlineCount:seats?.filter(x=>x.status==='online').length??0,deadline:new Date(deadline).toISOString()});
   if(state==='PASS'){if(++stable>=2)return;}else stable=0;
   if(state==='TIMEOUT')throw Object.assign(Error(code),{code});
   await wait(3000);
  }
 };
 const result={request,ports:{
  fingerprint:x=>sha256(JSON.stringify({issue,manifest,targetSha:x.targetSha})),
  read:async id=>fs.existsSync(path.join(recordDir,id+'.json'))?json(path.join(recordDir,id+'.json')):null,
  persist:async x=>{
   // The coordinator persists a new phase after postcheck returns/throws.
   // Retain only this request's latest observed execution link, never reuse
   // a previous Issue or mistake an observation for postcheck PASS.
   const prior=fs.existsSync(ledgerFile)?json(ledgerFile):null;
   const postcheckLink=prior?.postcheckLink?.requestId===request.requestId?
    prior.postcheckLink:null;
   writeJson(ledgerFile,{...x,issueNumber,postIssueNumber,
    ...(postcheckLink?{postcheckLink}:{})});
  },
  // Capture a read-only baseline BEFORE acquiring the install lease, while
  // immutable source/owner/protected-state evidence is available. This does
  // not change Core tasks, supervisor processes or the intake workflow.
  capturePrevalidationBaseline:async()=>{
   const current=installedManifest(),{owner,status}=readOwner();
   need(current.installedSha===manifest.installedSha&&status.sourceSha===manifest.installedSha,
    'PREVALIDATION_SOURCE_MISMATCH');
   const files=prevalidationInventory(current.host);
   need(files!==null,'PREVALIDATION_FILES_INCOMPLETE');
   prevalidationBaseline={stageNamespaceInitiallyAbsent:!fs.existsSync(backupRoot),installedSha:current.installedSha,ownerPid:owner.pid,
    ownerNonce:owner.nonce,files,protected:protectedSnapshot()};
  },
  // A prevalidation exception has not reached stage/pause/stop/switch. A
  // busy independent A Runner is NOT a controller mutation and must not make
  // an otherwise proven no-effect failure retain an install-wide recovery
  // lease. Still require live original supervisor identity, pinned file bytes,
  // unchanged Core protection and a freshly read active intake workflow.
  verifyPrevalidationUntouched:async({installedSha})=>{
   if(!prevalidationBaseline||prevalidationBaseline.installedSha!==installedSha)return false;
   const current=installedManifest(),{owner,status}=readOwner();
   const files=prevalidationInventory(current.host);
   if(files===null||JSON.stringify(files)!==JSON.stringify(prevalidationBaseline.files))return false;
   if(current.installedSha!==installedSha||status.sourceSha!==installedSha||
     owner.pid!==prevalidationBaseline.ownerPid||owner.nonce!==prevalidationBaseline.ownerNonce)return false;
   try {process.kill(owner.pid,0);} catch {return false;}
   if(JSON.stringify(protectedSnapshot())!==JSON.stringify(prevalidationBaseline.protected))return false;
   return github('actions/workflows/pc-job.yml').state==='active';
  },
  verifyStagingFailureIsolated:async({installedSha})=>{
   if(prevalidationBaseline?.stageNamespaceInitiallyAbsent!==true||
    !isolatedControllerStage(backupRoot,plannedFiles))return false;
   return await result.ports.verifyPrevalidationUntouched({installedSha})===true;
  },
  inspect:async()=>({installedSha:installedManifest().installedSha,
   insideRunnerTree:false,githubActions:Boolean(process.env.GITHUB_ACTIONS||process.env.RUNNER_NAME)}),
  validate:async()=>{
   const {host}=installedManifest();
   const owner=readOwner();verifyIndependent(owner.owner.pid);oldOwner=owner;
   need(github('actions/workflows/pc-job.yml').state==='active','WORKFLOW_NOT_ACTIVE_PREEXISTING');
   need(issue.targetControllerSha===manifest.targetSha&&validSha(manifest.targetSha),'TARGET_SHA_MISMATCH');
   need(manifest.installedSha===host.controllerSourceSha,'INSTALLED_SHA_MISMATCH');
   need(manifest.backup?.strategy==='VERSIONED_SNAPSHOT'&&manifest.backup?.rollback?.sha===manifest.installedSha,'BACKUP_CONTRACT');
   need(manifest.checks?.status==='PASS'&&manifest.checks.targetSha===manifest.targetSha,'TARGET_TEST_EVIDENCE');
   need(manifest.approval?.grade==='B'&&/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/\d+$/.test(manifest.approval.ref),'APPROVAL_REFERENCE_REQUIRED');
    need(CONTROLLER_POST_OPERATIONS.includes(manifest.postOperation),'POST_OPERATION_NOT_APPROVED');
   need(validSha(manifest.postSourceSha),'POST_SOURCE_INVALID');
   need(typeof manifest.postSourceBranch==='string'&&/^[a-z0-9][a-z0-9./_-]{1,120}$/i.test(manifest.postSourceBranch),'POST_SOURCE_BRANCH');
    // The target is staged from immutable `git show <sha>:<path>` bytes.
    // Do not block on unrelated docs, local evidence or other draft work.
    // Changes to installable, workflow or approval paths still fail closed.
    need(git(['status','--porcelain','--untracked-files=all','--',
      ...CONTROL_UPDATE_SENSITIVE_PATHS]).trim()==='','CONTROL_DIRTY');
   git(['fetch','--no-tags','origin','main']);
   const selective=manifest.selectiveSource??null;
   if(selective){
    // Only a manifest-pinned branch head is fetched, never an Issue path or
    // arbitrary executable. This is an overlay commit, not the public main SHA.
    git(['fetch','--no-tags','origin',selective.branch]);
    need(git(['rev-parse','FETCH_HEAD']).trim()===manifest.targetSha,
     'SELECTIVE_TARGET_BRANCH_DRIFT');
   }
   need(git(['cat-file','-t',manifest.targetSha]).trim()==='commit','TARGET_NOT_COMMIT');
   if(selective){
    need(git(['merge-base','--is-ancestor',selective.mainSha,
     'refs/remotes/origin/main']).trim()==='','SELECTIVE_SOURCE_NOT_ON_MAIN');
    const parents=git(['rev-list','--parents','-n','1',manifest.targetSha]).trim().split(/\s+/);
    need(parents.length===2&&parents[1]===manifest.installedSha,
     'SELECTIVE_TARGET_PARENT_MISMATCH');
   }else{
    need(git(['merge-base','--is-ancestor',manifest.targetSha,
     'refs/remotes/origin/main']).trim()==='','TARGET_NOT_ON_MAIN');
   }
   need(git(['merge-base','--is-ancestor',manifest.installedSha,manifest.targetSha]).trim()==='','TARGET_NOT_DESCENDANT');
   const diff=git(['diff','--name-only',manifest.installedSha,manifest.targetSha,'--']).trim().split(/\r?\n/).filter(Boolean);
   if(selective){
    const declared=manifest.allowFiles.map(f=>f.path).sort();
    // For this mode *all* changed paths, including docs/tools/workflows,
    // must be precisely the reviewed Controller/config paths.
    need(JSON.stringify([...diff].sort())===JSON.stringify(declared),
     'SELECTIVE_NONSCOPED_DIFF');
    const pinPath='approvals/controller-selective-targets/'+manifest.targetSha+'.json';
    let pinBytes;
    try{pinBytes=git(['show','refs/remotes/origin/main:'+pinPath]);}
    catch{throw Object.assign(Error('SELECTIVE_PIN_NOT_ON_MAIN'),{code:'SELECTIVE_PIN_NOT_ON_MAIN'});}
    let pin;
    try{pin=JSON.parse(pinBytes);}catch{throw Object.assign(Error('SELECTIVE_PIN_INVALID'),{code:'SELECTIVE_PIN_INVALID'});}
    validateControllerSelectivePin(manifest,pin);
    for(const item of manifest.allowFiles){
     if(selective.customPaths.includes(item.path))continue;
     need(sha256(git(['show',selective.mainSha+':'+item.path],{encoding:null}))===item.sha256,
      'SELECTIVE_MAIN_SOURCE_HASH_MISMATCH');
    }
   }
   // tools/docs/tests/reports are not deployed into the six Runner host. Changes
   // to a live workflow or executable script still require a different approval.
   if(manifest.controllerOnlyInstall===true)
    validateControllerOnlyInstallDelta(diff,manifest.allowFiles);
   else
    validateInfrastructureDelta(diff,manifest.infrastructureEvidence,
     rel=>git(['show',manifest.targetSha+':'+rel],{encoding:null}));
   if(manifest.infrastructureEvidence){
    const infraPr=github('pulls/'+manifest.infrastructureEvidence.approvalRef.split('/').pop());
    need(infraPr.merged===true&&validSha(infraPr.merge_commit_sha),'INFRA_APPROVAL_PR_NOT_MERGED');
    git(['merge-base','--is-ancestor',infraPr.merge_commit_sha,manifest.targetSha]);
   }
   const changed=diff.filter(p=>(p.startsWith('controller/')||p.startsWith('config/'))&&
    !isControllerSourceTestPath(p)).sort();
   const declared=manifest.allowFiles?.map(x=>x.path).sort();
   need(Array.isArray(declared)&&JSON.stringify(changed)===JSON.stringify(declared),'ALLOWFILE_DIFF_MISMATCH');
   const listing=git(['ls-tree','-r','--name-only',manifest.targetSha,'--','controller','config']).trim().split(/\r?\n/).filter(Boolean);
   // Only exact colocated source tests stay in Git and CI, never on the live host.
   // Unknown Controller tree entries continue to fail closed.
   const deployed=deployableControllerTreePaths(listing);
   // Fail closed against the full target tree (not main) before any staging,
   // intake pause or Controller mutation. A one-file overlay must not import
   // modules that were never installed in its immutable baseline.
   // An unchanged entry/operations module can still import a missing target
   // dependency; verify these runtime roots as well as changed overlay files.
   validateControllerImportClosure(deployed,controllerImportScanRoots(changed),
     rel=>git(['show',manifest.targetSha+':'+rel]));
   const oldOperations=JSON.parse(fs.readFileSync(path.join(controlRoot,'config/operations.json')));
   const nextOperations=JSON.parse(git(['show',manifest.targetSha+':config/operations.json']));
   validateControllerConfigTransition(oldOperations,nextOperations,controllerAdmissionForPurpose(manifest.purpose));
    need(nextOperations.operations?.[manifest.postOperation]?.grade==='A'&&
      nextOperations.operations[manifest.postOperation].resource==='light',
    'POST_OPERATION_NOT_INSTALLED_READONLY');
   for(const item of manifest.allowFiles){
    need(/^[a-f0-9]{64}$/.test(item.sha256),'ALLOWFILE_HASH');
    need(sha256(git(['show',manifest.targetSha+':'+item.path],{encoding:null}))===item.sha256,'ALLOWFILE_HASH_MISMATCH');
   }
   plannedFiles=deployed;
   const pr=github('pulls/'+manifest.approval.ref.split('/').pop());
   need(pr.merged===true&&validSha(pr.merge_commit_sha),'APPROVAL_PR_NOT_MERGED');
   if(selective){
    need(git(['merge-base','--is-ancestor',pr.merge_commit_sha,
     'refs/remotes/origin/main']).trim()==='','SELECTIVE_APPROVAL_NOT_ON_MAIN');
    const pinPath='approvals/controller-selective-targets/'+manifest.targetSha+'.json';
    let approvedPin;
    try{approvedPin=JSON.parse(git(['show',pr.merge_commit_sha+':'+pinPath]));}
    catch{throw Object.assign(Error('SELECTIVE_PIN_NOT_IN_APPROVAL_PR'),
     {code:'SELECTIVE_PIN_NOT_IN_APPROVAL_PR'});}
    validateControllerSelectivePin(manifest,approvedPin);
   }else{
    need(git(['merge-base','--is-ancestor',pr.merge_commit_sha,
     manifest.targetSha]).trim()==='','APPROVAL_PR_TARGET_MISMATCH');
   }
   protectedBefore=protectedSnapshot();
  },
  stage:async()=>{
   need(!fs.existsSync(backupRoot),'UPDATE_BACKUP_ALREADY_EXISTS');
   fs.mkdirSync(path.join(stageRoot,'controller'),{recursive:true});fs.mkdirSync(path.join(stageRoot,'config'),{recursive:true});
   const hashes={};
   for(const rel of plannedFiles){
    const bytes=git(['show',manifest.targetSha+':'+rel],{encoding:null});
    fs.writeFileSync(path.join(stageRoot,rel),bytes,{flag:'wx'});hashes[rel]=sha256(bytes);
   }
   const host={...installedManifest().host,controllerSourceSha:manifest.targetSha,controllerFiles:hashes};
   writeJson(path.join(stageRoot,'host.json'),host);
   need(Object.entries(hashes).every(([rel,d])=>sha256(fs.readFileSync(path.join(stageRoot,rel)))===d),'STAGE_DIGEST_FAILED');
  },
  pauseIntake:async()=>{
   need(github('actions/workflows/pc-job.yml').state==='active','WORKFLOW_NOT_ACTIVE_PREEXISTING');
   const at=new Date().toISOString();
   writeJson(backlogFile,{schema:'ZGMINI_PC_BACKLOG_V1',requestId:request.requestId,
     pausedAt:at,resumedAt:null,replays:{},windows:[{pausedAt:at,resumedAt:null}]});
   github('actions/workflows/pc-job.yml/disable','PUT');pausedByUs=true;
   need(await confirmExactWorkflowState(()=>github('actions/workflows/pc-job.yml').state,
    'disabled_manually'),'WORKFLOW_DISABLE_NOT_CONFIRMED');
  },
  didPauseIntake:()=>pausedByUs,
  waitForDrain:async()=>{
   // Jobs (including result-upload) must finish normally. A quiet double-check
   // avoids replacing files during a newly completed upload's last lease.
   let quiet=0;
   for(let n=0;n<180;n++){
    const rows=apiRunners(),seats=dedicatedPcRunnerRows(rows);
    need(seats!==null,'RUNNER_SET_DRIFT');
    need(seats.every(x=>x.status==='online'),'RUNNERS_NOT_ONLINE');
    const busy=seats.some(x=>x.busy),leases=fs.readdirSync(path.join(controlRoot,'leases')).filter(x=>x!=='supervisor');
    const pending=['in_progress','queued','waiting'].map(status=>github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0).reduce((a,b)=>a+b,0);
    if(!busy&&!leases.length&&!pending){
     quiet++;
     if(quiet>=2){
      // Verify GitHub intake is still paused before backup and supervisor stop.
      // A drift discovered here remains before those runtime-mutation steps.
      need(github('actions/workflows/pc-job.yml').state==='disabled_manually',
       'WORKFLOW_STATE_DRIFT_BEFORE_DRAIN');
      return;
     }
    }else quiet=0;
    await wait(3000);
   }
   throw Object.assign(Error('DRAIN_WAIT_TIMEOUT'),{code:'DRAIN_WAIT_TIMEOUT'});
  },
  backup:async()=>{
   fs.mkdirSync(snapshotRoot,{recursive:true});
   for(const rel of ['controller','config'])fs.cpSync(path.join(controlRoot,rel),path.join(snapshotRoot,rel),{recursive:true,errorOnExist:true,force:false});
   fs.copyFileSync(hostPath,path.join(snapshotRoot,'host.json'));
   const host=json(path.join(snapshotRoot,'host.json'));
   need(Object.entries(host.controllerFiles).every(([rel,d])=>sha256(fs.readFileSync(path.join(snapshotRoot,rel)))===d),'BACKUP_VERIFY_FAILED');
   need(JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore),'PROTECTED_STATE_DRIFT');
   writeJson(path.join(backupRoot,'PROTECTED_BEFORE.json'),protectedBefore);
  },
  stopOwnSupervisor:async()=>{
   const verifyStopSafety=()=>{
    const current=readOwner();
    need(current.owner.pid===oldOwner.owner.pid&&current.owner.nonce===oldOwner.owner.nonce,'SUPERVISOR_OWNER_CHANGED');
    verifyIndependent(current.owner.pid);
    need(JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore),'PROTECTED_STATE_DRIFT');
   };
   // Online and Idle remain required. Busy alone may settle during the bounded
   // 30-second retry; never stop a changed or unverified Supervisor.
   const idleWait=await waitForSupervisorStopIdle({readRunners:apiRunners,verifySafety:verifyStopSafety});
   verifyStopSafety();
   execFileSync('taskkill.exe',['/PID',String(oldOwner.owner.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:15000});
   for(let n=0;n<30;n++){let running=true;try{process.kill(oldOwner.owner.pid,0);}catch{running=false;}if(!running)return idleWait;await wait(500);}
   throw Object.assign(Error('SUPERVISOR_STILL_PRESENT'),{code:'SUPERVISOR_STILL_PRESENT'});
  },
  switchVersion:async()=>{
   for(const rel of ['controller','config']){
    fs.renameSync(path.join(controlRoot,rel),path.join(backupRoot,'previous-'+rel));
    fs.renameSync(path.join(stageRoot,rel),path.join(controlRoot,rel));
   }
   fs.renameSync(hostPath,path.join(backupRoot,'previous-host.json'));
   fs.renameSync(path.join(stageRoot,'host.json'),hostPath);
   need(installedManifest().installedSha===manifest.targetSha,'SWITCH_VERIFY_FAILED');
  },
  reconnect:async()=>{
   const lease=path.join(controlRoot,'leases/supervisor');
   const prior=path.join(backupRoot,'previous-supervisor-lease');
   need(fs.existsSync(lease)&&!fs.existsSync(prior),'SUPERVISOR_LEASE_UNEXPECTED');
   fs.renameSync(lease,prior);
   reconnectStartedAt=Date.now();
   const child=spawn(node,[path.join(controlRoot,'controller/supervisor.mjs')],{cwd:controlRoot,windowsHide:true,detached:true,stdio:'ignore'});child.unref();
   await waitForReconnect(child.pid,manifest.targetSha,'SIX_RUNNERS_RECONNECT_NOT_VERIFIED');
   need(JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore),'PROTECTED_STATE_DRIFT');
  },
  resumeIntake:async()=>{
   need(installedManifest().installedSha===manifest.targetSha||installedManifest().installedSha===manifest.installedSha,'INTAKE_SHA_UNKNOWN');
   github('actions/workflows/pc-job.yml/enable','PUT');pausedByUs=false;
   need(await confirmExactWorkflowState(()=>github('actions/workflows/pc-job.yml').state,
    'active'),'WORKFLOW_ENABLE_NOT_CONFIRMED');
   if(fs.existsSync(backlogFile)){
     const backlog=json(backlogFile);
     writeJson(backlogFile,closeLatestPause(backlog,new Date().toISOString()));
   }
  },
  reconcileBacklog:async()=>{
   need(fs.existsSync(backlogFile),'BACKLOG_STATE_MISSING');
   let state=json(backlogFile);
   const windows=backlogPauseWindows(state);
   need(windows.every(w=>w.resumedAt),'BACKLOG_WINDOW_NOT_CLOSED');
   // A workflow disabled on an Issue `opened` event does not replay it when
   // enabled again. Find the durable original Issues in that exact window.
   const candidates=new Map();
   for(const window of windows){
     const from=Date.parse(window.pausedAt)-2000,to=Date.parse(window.resumedAt);
     need(Number.isFinite(from)&&Number.isFinite(to)&&to>=from,'BACKLOG_TIME_INVALID');
     for(let page=1;page<=20;page++){
       const list=github(`issues?state=all&since=${encodeURIComponent(new Date(from).toISOString())}&per_page=100&page=${page}`);
       need(Array.isArray(list),'BACKLOG_LIST_INVALID');
       for(const entry of list){
         if(backlogIssueInPause(entry,window))candidates.set(entry.number,entry);
       }
       if(list.length<100)break;
       need(page<20,'BACKLOG_LIST_TRUNCATED');
     }
   }
   for(const original of [...candidates.values()].sort((a,b)=>a.number-b.number)){
     const key=String(original.number);
     if(state.replays[key]?.status==='DONE'||state.replays[key]?.status==='SKIPPED_RESULT_PRESENT')continue;
     if(state.replays[key]?.status==='REJECTED_INVALID_ORIGINAL'){
       const rejected=classifyBacklogOriginal(original.body);
       need(!rejected.valid&&rejected.originalBodySha256===state.replays[key].originalBodySha256,
        'BACKLOG_REJECTED_ORIGINAL_CHANGED');continue;
     }
     if(state.replays[key])throw Object.assign(Error('BACKLOG_REPLAY_OUTCOME_UNKNOWN'),{code:'BACKLOG_REPLAY_OUTCOME_UNKNOWN'});
     const comments=readAllMaintenancePages(page=>github(`issues/${original.number}/comments?per_page=100&page=${page}`));
     if(comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes('zgmini-pc-result:'))){
       state.replays[key]={status:'SKIPPED_RESULT_PRESENT'};writeJson(backlogFile,state);continue;
     }
     const decision=classifyBacklogOriginal(original.body);
     if(!decision.valid){
       state.replays[key]={status:'REJECTED_INVALID_ORIGINAL',reason:decision.code,
        originalBodySha256:decision.originalBodySha256,replayed:false};
       writeJson(backlogFile,state);continue;
     }
     const body=decision.body;
     const marker=`Maintenance replay ${request.requestId} original #${original.number}`;
     state.replays[key]={status:'POSTING',originalRequestId:body.requestId};writeJson(backlogFile,state);
     const input=path.join(maintenanceRoot,'approved',request.requestId+'.replay-'+original.number+'.json');
     writeJson(input,{title:marker,body:original.body,labels:['pc-job']});
     let repost;
     try{repost=github('issues','POST',input);}catch{throw Object.assign(Error('BACKLOG_REPLAY_OUTCOME_UNKNOWN'),{code:'BACKLOG_REPLAY_OUTCOME_UNKNOWN'});}
     need(Number.isSafeInteger(repost.number),'BACKLOG_REPLAY_OUTCOME_UNKNOWN');
     state.replays[key]={status:'DONE',originalRequestId:body.requestId,replayIssueNumber:repost.number};
     writeJson(backlogFile,state);
     // Never change the original Issue body or another chat's request ledger.
     const notification=`<!-- zgmini-pc-backlog-replay:${request.requestId}:${original.number} -->\n`+
       `This request arrived during a verified maintenance pause. Equivalent fixed request: #${repost.number}. `+
       `Use its result JSON and the original requestId to verify actual execution.`;
     const commentFile=path.join(maintenanceRoot,'approved',request.requestId+'.replay-comment-'+original.number+'.json');
     writeJson(commentFile,{body:notification});
     try{github(`issues/${original.number}/comments`,'POST',commentFile);}catch{/* replay ledger remains durable */}
   }
  },
  postcheck:async()=>{
   const ledger=json(ledgerFile);postIssueNumber=ledger.postIssueNumber;
   if(!postIssueNumber){
    const resultId=issue.requestId+'-postcheck';
    const body=JSON.stringify({schema:'ZGMINI_PC_JOB_V1',requestId:resultId,chatId:issue.chatId,
      operation:manifest.postOperation,sourceRepository:'ansqhd5774-Choi/zgmini',
      sourceBranch:manifest.postSourceBranch,sourceSha:manifest.postSourceSha});
    const input=path.join(maintenanceRoot,'approved',issue.requestId+'.postcheck-input.json');
    writeJson(input,{title:`PC Update ${issue.requestId} postcheck`,body,labels:['pc-job']});
    writeJson(ledgerFile,{...ledger,postcheckCreationAttempted:true,
      postcheckTitle:`PC Update ${issue.requestId} postcheck`});
    try{
      const posted=github('issues','POST',input);
      need(Number.isSafeInteger(posted.number),'POSTCHECK_OUTCOME_UNKNOWN');postIssueNumber=posted.number;
    }catch{
      try{
        const list=readAllMaintenancePages(page=>github(`issues?state=all&per_page=100&page=${page}`));
        const found=list.filter(x=>x.title===`PC Update ${issue.requestId} postcheck`&&x.body===body);
        if(found.length===1)postIssueNumber=found[0].number;
      }catch{}
      if(!postIssueNumber)throw Object.assign(Error('POSTCHECK_OUTCOME_UNKNOWN'),{code:'POSTCHECK_OUTCOME_UNKNOWN'});
    }
    writeJson(ledgerFile,{...ledger,postIssueNumber,postcheckLink:{
     schema:'ZGMINI_MAINTENANCE_POSTCHECK_LINK_V1',requestId:issue.requestId,
     issueNumber:postIssueNumber,state:'ISSUE_CREATED',code:'POSTCHECK_ISSUE_CREATED',
     runId:null,jobId:null,observedAtUtc:new Date().toISOString()}});
   }
   for(let n=0;n<100;n++){
    let comments;
    try{comments=readAllMaintenancePages(page=>github(`issues/${postIssueNumber}/comments?per_page=100&page=${page}`));}
    catch{throw Object.assign(Error('POSTCHECK_OUTCOME_UNKNOWN'),{code:'POSTCHECK_OUTCOME_UNKNOWN'});}
    for(const comment of comments){
     if(comment.user?.login!=='github-actions[bot]')continue;
     const match=comment.body?.match(/```json\s*([\s\S]*?)```/);
     if(!match)continue;
     let result;try{result=JSON.parse(match[1]);}catch{continue;}
     if(result.requestId!==issue.requestId+'-postcheck')continue;
     if(result.status==='PASS')await waitForReconnect(readOwner().owner.pid,manifest.targetSha,'RUNNER_RECONNECT_OUTCOME_UNKNOWN');
     // The A-grade diagnostic reports execution provenance, not the B-grade
     // maintainer's Core/Korea/Iran protection attestation. Verify that here.
     const protectedStateUnchanged=JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore);
     const runnerState=apiRunners();
     const runnerSetVerified=dedicatedPcRunnerRows(runnerState,{requireOnline:true})!==null;
     return {status:result.status,code:result.code,actualExecutionSha:result.actualExecutionSha,
       issueNumber:postIssueNumber,protectedStateUnchanged,runnerSetVerified,
       postSourceVerified:result.requestedSourceSha===manifest.postSourceSha&&
         result.sourceRepository==='ansqhd5774-Choi/zgmini'&&
         result.sourceBranch===manifest.postSourceBranch&&
         result.controlSourceSha===manifest.targetSha};
    }
    // Existing request only: bounded Run/Job observation explains the first
    // missing link. No repost, label re-drive, workflow toggle or lease write.
    if(n%5===0){
     let confirmed=null;
     try{
      const liveIssue=github('issues/'+postIssueNumber);
      const runs=readAllMaintenancePages(page=>github(
       `actions/workflows/pc-job.yml/runs?event=issues&created=${encodeURIComponent('>='+liveIssue.created_at)}&per_page=100&page=${page}`).workflow_runs,
       {maxPages:3});
      const expectedTitle=`PC Update ${issue.requestId} postcheck`;
      const linkedRuns=runs.filter(r=>r.event==='issues'&&r.display_title===expectedTitle&&
       Number.isFinite(Date.parse(r.created_at))&&
       Date.parse(r.created_at)>=Date.parse(liveIssue.created_at));
      const selected=linkedRuns.length===1?linkedRuns[0]:null;
      const jobs=selected?readAllMaintenancePages(page=>github(
       `actions/runs/${selected.id}/jobs?per_page=100&page=${page}`).jobs,
       {maxPages:3}):null;
      const link=classifyMaintenancePostcheckLink({
       requestId:issue.requestId,issueNumber:postIssueNumber,
       operation:manifest.postOperation,sourceBranch:manifest.postSourceBranch,
       sourceSha:manifest.postSourceSha,issue:liveIssue,runs,jobs});
      const liveLedger=json(ledgerFile);
      // Store a bounded, nonsecret observation only when the evidence moves.
      // A temporarily failed GitHub lookup must not erase earlier evidence.
      const prior=liveLedger.postcheckLink;
      if(link.state!=='STATE_UNKNOWN' &&
       (!prior||Object.entries(link).some(([key,value])=>prior[key]!==value))){
       writeJson(ledgerFile,{...liveLedger,postcheckLink:{
        ...link,observedAtUtc:new Date().toISOString()}});
      }
      for(const job of jobs??[])if(selected&&verifiedRunningPostcheckFailure({
       ledger:liveLedger,manifest,issue:liveIssue,run:selected,job})){
       confirmed={issueNumber:postIssueNumber,runId:selected.id,jobId:job.id,
        runnerName:job.runner_name};break;
      }
     }catch{/* Failed observation remains UNKNOWN, not installation failure. */}
     if(confirmed)throw Object.assign(Error('POSTCHECK_EXECUTION_FAILED_VERIFIED'),{
      code:'POSTCHECK_EXECUTION_FAILED_VERIFIED',postcheckFailureEvidence:confirmed});
    }
    await wait(3000);
   }
   throw Object.assign(Error('POSTCHECK_OUTCOME_UNKNOWN'),{code:'POSTCHECK_OUTCOME_UNKNOWN'});
  },
  verifyBackup:async()=>{
   if(!fs.existsSync(path.join(snapshotRoot,'host.json')))return false;
   const host=json(path.join(snapshotRoot,'host.json'));
   return host.controllerSourceSha===manifest.installedSha&&Object.entries(host.controllerFiles).every(([rel,d])=>fs.existsSync(path.join(snapshotRoot,rel))&&sha256(fs.readFileSync(path.join(snapshotRoot,rel)))===d);
  },
  preflightRecoveryRestore:async()=>{
   if(!recoveryOperator)return;
   // No rollback mutation marker exists yet; restore rechecks live state.
   if(!pausedByUs)apiRunners();
   need(protectedBefore!==undefined,'RECOVERY_PROTECTION_NOT_PINNED');
   need(JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore),
    'RECOVERY_PROTECTION_PREFLIGHT_CHANGED');
  },
  restoreMarksMutation:recoveryOperator,
  restore:async({beforeMutation}={})=>{
   const markMutation=async()=>{
    if(recoveryOperator){
     need(typeof beforeMutation==='function','RECOVERY_MUTATION_CALLBACK_REQUIRED');
     await beforeMutation();
    }
   };
   // The independent recovery operator must prove that the runner inventory
   // endpoint is readable before touching intake. Drain still rechecks the
   // live roster after pause; this is not an idle/availability shortcut.
   if(recoveryOperator&&!pausedByUs)apiRunners();
   if(recoveryOperator)need(recoveryProtectedSnapshotStillPinned(protectedBefore,
    protectedSnapshot()),'RECOVERY_PROTECTION_PREPAUSE_CHANGED');
   // A postcheck may have failed after the new listener came online. Stop its
   // tree only AFTER pausing intake and observing zero jobs/uploads again.
   if(!pausedByUs){
     // Durable pause record BEFORE disabling; an API acknowledgement may be
     // lost even when the disable succeeded. The second window is replayed
     // after the verified rollback reconnects the original six Runners.
     need(fs.existsSync(backlogFile),'BACKLOG_STATE_MISSING');
     const pause=openRollbackPause(json(backlogFile),new Date().toISOString());
     await markMutation(); // durable claim before first intake/backlog write
     writeJson(backlogFile,pause);
     github('actions/workflows/pc-job.yml/disable','PUT');pausedByUs=true;
   }
   need(github('actions/workflows/pc-job.yml').state==='disabled_manually','ROLLBACK_WORKFLOW_NOT_DISABLED');
   let stable=0;
   for(let n=0;n<180;n++){
    const rows=apiRunners(),leases=fs.readdirSync(path.join(controlRoot,'leases')).filter(x=>x!=='supervisor');
    const pending=['in_progress','queued','waiting'].map(status=>github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0).reduce((a,b)=>a+b,0);
    if(dedicatedPcRunnerRows(rows,{requireIdle:true})!==null&&!leases.length&&!pending){if(++stable>=2)break;}else stable=0;
    await wait(3000);
   }
   need(stable>=2,'ROLLBACK_DRAIN_TIMEOUT');
   // Job drain may overlap a separately approved Writer B source update.
   // Never stop the live Supervisor or switch Controller files on a stale CAS.
   if(recoveryOperator)need(recoveryProtectedSnapshotStillPinned(protectedBefore,
    protectedSnapshot()),'RECOVERY_PROTECTION_PRESWITCH_CHANGED');
   // An already paused intake may reach its first mutation only after drain.
   // Keep the claim durable before process termination or file rename.
   await markMutation();
   const ownerFile=path.join(controlRoot,'leases/supervisor/owner.json');
   if(fs.existsSync(ownerFile)){
    const owner=json(ownerFile);let alive=true;try{process.kill(owner.pid,0);}catch{alive=false;}
    if(alive){
      const current=readOwner();if(recoveryOperator)verifyRecoveryOperator(current.owner.pid);else verifyIndependent(current.owner.pid);
      need(current.status.sourceSha===manifest.targetSha,'ROLLBACK_SUPERVISOR_SOURCE_UNKNOWN');
      execFileSync('taskkill.exe',['/PID',String(current.owner.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:15000});
      let stopped=false;
      for(let n=0;n<30;n++){try{process.kill(current.owner.pid,0);}catch{stopped=true;break;}await wait(500);}
      need(stopped,'ROLLBACK_SUPERVISOR_STILL_PRESENT');
    }
   }
   for(const rel of ['controller','config']){
    const existing=path.join(controlRoot,rel),failed=path.join(backupRoot,'failed-'+rel);
    if(fs.existsSync(existing))fs.renameSync(existing,failed);
    fs.cpSync(path.join(snapshotRoot,rel),existing,{recursive:true,errorOnExist:true,force:false});
   }
   if(fs.existsSync(hostPath))fs.renameSync(hostPath,path.join(backupRoot,'failed-host.json'));
   fs.copyFileSync(path.join(snapshotRoot,'host.json'),hostPath);
  },
  reconnectPrevious:async()=>{
   // Only the old immutable snapshot has been restored by this point.
   const ownerFile=path.join(controlRoot,'leases/supervisor/owner.json');
   if(fs.existsSync(ownerFile)){
    const old=json(ownerFile);let alive=true;try{process.kill(old.pid,0);}catch{alive=false;}
    need(!alive,'SUPERVISOR_LEASE_OWNER_ACTIVE');
    fs.renameSync(path.join(controlRoot,'leases/supervisor'),path.join(backupRoot,'rollback-supervisor-lease'));
   }
   reconnectStartedAt=Date.now();
   const child=spawn(node,[path.join(controlRoot,'controller/supervisor.mjs')],{cwd:controlRoot,windowsHide:true,detached:true,stdio:'ignore'});child.unref();
   await waitForReconnect(child.pid,manifest.installedSha,'ROLLBACK_RECONNECT_FAILED');
  },
  verifyRestoredPrevious:async installedSha=>{
   // Require the whole saved host and all installed Controller bytes, not
   // merely a matching source label. prepareRecovery loaded the old protection.
   if(installedManifest().installedSha!==installedSha)return false;
   need(fs.readFileSync(hostPath).equals(fs.readFileSync(path.join(snapshotRoot,'host.json'))),
    'RECOVERY_PREVIOUS_HOST_DRIFT');
   const current=readOwner();
   need(current.status.sourceSha===installedSha,'RECOVERY_PREVIOUS_SUPERVISOR_DRIFT');
   need(dedicatedPcRunnerRows(apiRunners(),{requireOnline:true})!==null,
    'RECOVERY_PREVIOUS_RUNNERS_NOT_ONLINE');
   for(const child of current.status.children){
    need(child.alive===true,'RECOVERY_PREVIOUS_CHILD_NOT_ALIVE');
    try{process.kill(child.pid,0);}catch{need(false,'RECOVERY_PREVIOUS_CHILD_NOT_ALIVE');}
   }
   need(protectedBefore!==undefined&&JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore),
    'RECOVERY_PREVIOUS_PROTECTION_DRIFT');
   return true;
  },
  verifyPrevious:async({installedSha,requireRunning,requireIdle=true})=>{
   if(installedManifest().installedSha!==installedSha)return false;
   if(requireRunning){
    const s=json(path.join(controlRoot,'SUPERVISOR_STATUS.json'));
    const rows=apiRunners();
    const runnersVerified=requireIdle?available(rows):dedicatedPcRunnerRows(rows,{requireOnline:true})!==null;
    if(s.sourceSha!==installedSha||Date.now()-Date.parse(s.at)>45000||!runnersVerified)return false;
   }
   return JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore??protectedSnapshot());
  },
  prepareRecovery:async()=>{
   need(recoveryOperator,'RECOVERY_OPERATOR_REQUIRED');verifyRecoveryOperator();
   need(fs.existsSync(path.join(backupRoot,'PROTECTED_BEFORE.json')),'RECOVERY_PROTECTION_BASELINE_MISSING');
   const originalProtection=json(path.join(backupRoot,'PROTECTED_BEFORE.json'));
   // A separately approved independent recovery may pin the live Writer config
   // only. Do not edit the historic baseline or permit any other Task/file drift.
   need(approvedRecoveryWriterConfigSha256===null||recoveryOperator,
    'RECOVERY_WRITER_CAS_REQUIRES_INDEPENDENT_OPERATOR');
   const decision=selectPreservedRecoveryProtection(originalProtection,
    protectedSnapshot(),{approvedCurrentWriterConfigSha256:
     approvedRecoveryWriterConfigSha256});
   need(decision.allowed,decision.code);
   protectedBefore=decision.baseline;
   const backlog=json(backlogFile),windows=backlogPauseWindows(backlog);
   const wf=github('actions/workflows/pc-job.yml').state;
   if(windows.some(w=>!w.resumedAt)){
    need(wf==='disabled_manually','RECOVERY_PAUSE_STATE_UNKNOWN');pausedByUs=true;
   }else need(wf==='active','RECOVERY_WORKFLOW_STATE_UNKNOWN');
  },
  inspectAfterUncertain:async()=>({actualControllerSha:installedManifest().installedSha,
   workflowState:github('actions/workflows/pc-job.yml').state,runners:apiRunners().map(x=>({name:x.name,status:x.status,busy:x.busy}))})
 }};
 return result;
}

// Recovery can outlive the original one-shot Issue. This is only an Issue
// identity predicate: a separately approved independent recovery operator
// still needs the exact ledger/owner/marker/backup CAS before any effect.
export function admittedMaintenanceIssueState(issue,{recovery=false}={}){
 return issue?.title==='pc-controller-update'&&(
  issue.state==='open'||
  (recovery===true&&issue.state==='closed'&&issue.state_reason==='completed'));
}

export function loadApprovedPackage(requestId,file,{recovery=false}={}) {
 const expected=path.join(maintenanceRoot,'approved',requestId+'.json');
 need(path.resolve(file)===path.resolve(expected),'APPROVAL_FILE_PATH');
 const data=json(expected),{issue,manifest,manifestRawBase64}=data;
 need(issue?.requestId===requestId&&issue?.operation==='controller-update'&&issue?.controlRepository===controlRepository,'MAINTENANCE_REQUEST_MISMATCH');
 need(data.actor==='ansqhd5774-Choi'&&Number.isSafeInteger(data.issueNumber),'MAINTENANCE_ACTOR_NOT_APPROVED');
 need(validSha(issue.targetControllerSha)&&manifest.targetSha===issue.targetControllerSha,'TARGET_SHA_MISMATCH');
 const raw=Buffer.from(manifestRawBase64??'','base64');
 need(raw.length>0&&raw.length<=32768&&sha256(raw)===issue.approvalManifestSha256,'APPROVAL_MANIFEST_HASH_MISMATCH');
 const actual=github('issues/'+data.issueNumber);
 let liveRequest;try{liveRequest=JSON.parse(actual.body);}catch{throw Object.assign(Error('MAINTENANCE_ISSUE_INVALID'),{code:'MAINTENANCE_ISSUE_INVALID'});}
 const authenticated=validateMaintenanceRequest(liveRequest,{actor:actual.user?.login,controlRepository});
 need(actual.user?.login===data.actor&&JSON.stringify(authenticated)===JSON.stringify(issue),'MAINTENANCE_ISSUE_IDENTITY');
 need(admittedMaintenanceIssueState(actual,{recovery}),'MAINTENANCE_REQUEST_CANCELED');
 need(actual.labels?.some(x=>x.name==='pc-maintenance')&&!actual.pull_request,'MAINTENANCE_LABEL');
 const validated=validateUpdateRequest(issue,raw,{actor:data.actor,
  controlRepository,installedSha:recovery?manifest.installedSha:installedManifest().installedSha});
 return {...data,issue:validated.request,manifest:validated.manifest};
}

// A read-only, fixed-root view of exactly one update's preserved artifacts.
// Presence and well-formedness are evidence, NOT a recovery/installation GO.
// No issue data or operator-supplied filesystem paths reach this observation.
export function readControllerUpdateArtifacts(requestId,{
 fsImpl=fs,backupBase=path.join(controlRoot,'backups'),
 backlogBase=path.join(maintenanceRoot,'backlog'),
 leaseBase=path.join(maintenanceRoot,'leases'),
}={}){
 need(/^pc-[a-z0-9-]{8,76}$/.test(requestId??''),'MAINTENANCE_REQUEST_ID');
 const entry=(p,type)=>{
  try{
   const st=fsImpl.lstatSync(p);
   if(st.isSymbolicLink())return 'UNSAFE';
   return type==='directory'?(st.isDirectory()?'PRESENT':'UNSAFE')
    :(st.isFile()?'PRESENT':'UNSAFE');
  }catch(error){return error?.code==='ENOENT'?'ABSENT':'UNKNOWN';}
 };
 const child=(parent,p,type)=>{
  if(parent==='ABSENT')return 'ABSENT';
  if(parent!=='PRESENT')return 'UNKNOWN';
  return entry(p,type);
 };
 const backupBaseState=entry(backupBase,'directory');
 const backupPath=path.join(backupBase,'controller-update-'+requestId);
 const backupRoot=child(backupBaseState,backupPath,'directory');
 const stageRoot=child(backupRoot,path.join(backupPath,'stage'),'directory');
 const snapshotRoot=child(backupRoot,path.join(backupPath,'snapshot'),'directory');
 const stagedHost=child(stageRoot,path.join(backupPath,'stage','host.json'),'file');
 const originalHost=child(snapshotRoot,path.join(backupPath,'snapshot','host.json'),'file');
 const protectedBefore=child(backupRoot,path.join(backupPath,'PROTECTED_BEFORE.json'),'file');
 const previousHost=child(backupRoot,path.join(backupPath,'previous-host.json'),'file');
 const backlogBaseState=entry(backlogBase,'directory');
 const backlogPath=path.join(backlogBase,requestId+'.json');
 const backlogFile=child(backlogBaseState,backlogPath,'file');
 let backlog={file:backlogFile,windows:null,openWindows:null,replayCount:null};
 if(backlogFile==='PRESENT'){
  try{
   const bytes=fsImpl.readFileSync(backlogPath);
   need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=131072,
    'MAINTENANCE_BACKLOG_READBACK_INVALID');
   const data=JSON.parse(bytes.toString('utf8'));
   need(data?.schema==='ZGMINI_PC_BACKLOG_V1'&&data.requestId===requestId
    &&Array.isArray(data.windows)&&data.windows.length>=1&&data.windows.length<=64
    &&data.windows.every(w=>w&&typeof w.pausedAt==='string'
     &&Number.isFinite(Date.parse(w.pausedAt))
     &&(w.resumedAt===null||typeof w.resumedAt==='string'
      &&Number.isFinite(Date.parse(w.resumedAt))
      &&Date.parse(w.resumedAt)>=Date.parse(w.pausedAt)))
    &&data.replays&&typeof data.replays==='object'&&!Array.isArray(data.replays),
    'MAINTENANCE_BACKLOG_READBACK_INVALID');
   backlog={file:'PRESENT',windows:data.windows.length,
    openWindows:data.windows.filter(w=>w.resumedAt===null).length,
    replayCount:Object.keys(data.replays).length};
  }catch{backlog={file:'UNVERIFIED',windows:null,openWindows:null,replayCount:null};}
 }
 const leaseBaseState=entry(leaseBase,'directory');
 const leasePath=path.join(leaseBase,'controller-install');
 const leaseDir=child(leaseBaseState,leasePath,'directory');
 const ownerFile=child(leaseDir,path.join(leasePath,'owner.json'),'file');
 const recoveryMarker=child(leaseDir,path.join(leasePath,'RECOVERY_REQUIRED.json'),'file');
 let ownerMarkerMatch=null;
 if(ownerFile==='PRESENT'&&recoveryMarker==='PRESENT'){
  try{
   const owner=JSON.parse(fsImpl.readFileSync(path.join(leasePath,'owner.json'),'utf8'));
   const marker=JSON.parse(fsImpl.readFileSync(path.join(leasePath,'RECOVERY_REQUIRED.json'),'utf8'));
   ownerMarkerMatch=Number.isSafeInteger(owner?.pid)&&owner.pid>0
    &&/^[a-f0-9-]{36}$/i.test(owner?.nonce??'')
    &&marker?.requestOwnerPid===owner.pid&&marker?.nonce===owner.nonce;
  }catch{ownerMarkerMatch=false;}
 }
 const objects={backupRoot,stageRoot,snapshotRoot,stagedHost,originalHost,
  protectedBefore,previousHost};
 const unexpected=[...Object.values(objects),backlog.file,leaseDir,ownerFile,recoveryMarker]
  .some(v=>['UNSAFE','UNKNOWN','UNVERIFIED'].includes(v));
 const invalidLease=leaseDir==='PRESENT'&&(ownerFile!=='PRESENT'
  ||recoveryMarker==='PRESENT'&&ownerMarkerMatch!==true);
 return {schema:'ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1',requestId,
  status:unexpected||invalidLease?'UNVERIFIED':'OBSERVED',
  artifacts:objects,backlog,
  lease:{directory:leaseDir,ownerFile,recoveryMarker,ownerMarkerMatch},
  operationalWrites:0,originalRequestRetried:false,
  recoveryComplete:false,installSuccessProven:false};
}

// Recovery-status reads must survive a partially switched/missing host.json.
// Never infer a successful install from the journal alone. An unreadable lock
// is treated as a held recovery lock so the receiver cannot start another job.
export function readMaintenanceRecoveryStatus(requestId,{
 readInstalled=()=>installedManifest().installedSha,
 readLedger=()=>{const file=path.join(recordDir,requestId+'.json');return fs.existsSync(file)?json(file):null;},
 readLock=()=>maintenanceLockStatus(maintenanceRoot,'controller-install'),
 readArtifacts=()=>readControllerUpdateArtifacts(requestId),
}={}){
 let actualControllerSha=null,installedReadbackCode=null,ledger=null,ledgerReadbackCode=null,
   installLock={held:true,recoveryRequired:true},lockReadbackCode=null;
 try{
  const sha=readInstalled();
  if(validSha(sha))actualControllerSha=sha;
  else installedReadbackCode='INSTALLED_SHA_UNVERIFIED';
 }catch{installedReadbackCode='INSTALLED_MANIFEST_UNAVAILABLE';}
 try{ledger=readLedger();}
 catch{ledgerReadbackCode='UPDATE_LEDGER_UNAVAILABLE';}
 try{
  const observed=readLock();
  if(!observed||typeof observed.held!=='boolean')throw Error('invalid lock status');
  installLock=observed;
 }catch{lockReadbackCode='UPDATE_LOCK_UNAVAILABLE';}
 let artifacts=null,artifactReadbackCode=null;
 try{artifacts=readArtifacts();if(artifacts?.status!=='OBSERVED')
  artifactReadbackCode='UPDATE_ARTIFACTS_UNVERIFIED';}
 catch{artifactReadbackCode='UPDATE_ARTIFACTS_UNAVAILABLE';}
 const state={status:'STATUS',actualControllerSha,installedReadbackCode,ledger,ledgerReadbackCode,
  installLock,lockReadbackCode,artifacts,artifactReadbackCode};
 return {...state,guidance:maintenanceNextAction(state)};
}

// Current lock observation wins over a historical failed request. Never infer
// that an absent lock proves recovery/installation success; reuse its evidence.
export function maintenanceNextAction(s){
 if(s.artifactReadbackCode)
  return {state:'STATE_UNKNOWN',next:'READ_ONLY_RECONCILE_STAGE_BACKLOG_LEASE',
   blockScope:'SHARED_INSTALL_ONLY'};
 if(s.artifacts?.backlog?.openWindows>0)
  return {state:'RECOVERY_REVIEW_REQUIRED',next:'VERIFY_OPEN_BACKLOG_AND_ORIGINAL_OWNER',
   blockScope:'SHARED_INSTALL_ONLY'};
 // STAGED is past prevalidation: a prior terminal BLOCKED record is not proof
 // that the filesystem staging and intake artifacts were reconciled.
 if(s.artifacts?.artifacts?.stageRoot==='PRESENT'
  &&s.ledger?.firstFail==='STAGED'&&s.ledger?.status==='BLOCKED')
  return {state:'STAGED_EVIDENCE_REVIEW_REQUIRED',
   next:'PRESERVE_STAGE_VERIFY_BACKLOG_INSTALL_LEASE_AND_RUNTIME',
   blockScope:'SHARED_INSTALL_ONLY'};
 if(s.lockReadbackCode||s.installedReadbackCode||s.ledgerReadbackCode)
  return {state:'STATE_UNKNOWN',next:'READ_ONLY_RECONCILE_FAILED_READBACK',blockScope:'SHARED_INSTALL_ONLY'};
 if(s.installLock?.held){
  return {state:s.installLock.recoveryRequired?'RECOVERY_REQUIRED':'INSTALL_LEASE_HELD',
   next:s.installLock.recoveryRequired?'USE_CONTROLLER_RECOVERY_RUNBOOK':'OBSERVE_EXISTING_OWNER_NO_DUPLICATE_REQUEST',
   blockScope:'SHARED_INSTALL_ONLY'};
 }
 return {state:'NO_ACTIVE_INSTALL_LEASE',
  next:s.ledger?.status==='RECOVERY_REQUIRED'?'REUSE_ARCHIVE_EVIDENCE_AND_VERIFY_CURRENT_RUNTIME':'VERIFY_TARGET_MANIFEST_AND_CURRENT_RUNTIME',
  blockScope:'NONE_FROM_INSTALL_LEASE',
  updateSuccessProven:false};
}

// The host-only R6 B path reuses this *installed* maintainer and its install
// lease. No general pc-job argument, arbitrary command, or mutable downloaded
// executable is permitted. The two source helpers are copied from reviewed
// Git blobs only after exact SHA-256 verification.
function readR6GitHubBytes(repository,relative,ref){
 need(repository===controlRepository||repository==='ansqhd5774-Choi/zgmini',
  'R6_HOST_SOURCE_REPOSITORY_NOT_ALLOWED');
 need(/^[a-z0-9][a-z0-9./_-]{1,150}$/i.test(relative)&&!relative.includes('..'),
  'R6_HOST_SOURCE_PATH_INVALID');
 need(ref==='main'||ref===R6_HOST_SOURCE_SHA,'R6_HOST_SOURCE_REF_INVALID');
 const route=`repos/${repository}/contents/${relative}?ref=${ref}`;
 const response=execFileSync(gh,['api',route],{
  windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:4e6});
 let file;try{file=JSON.parse(response);}catch{need(false,'R6_HOST_SOURCE_API_INVALID');}
 need(file?.type==='file'&&file.encoding==='base64'
   &&typeof file.content==='string'&&file.content.length<=500000,
   'R6_HOST_SOURCE_API_INVALID');
 const compact=file.content.replace(/\s/g,'');
 need(/^[A-Za-z0-9+/]*={0,2}$/.test(compact),'R6_HOST_SOURCE_BASE64_INVALID');
 return Buffer.from(compact,'base64');
}

// Additive source bundle registration. Existing R6, R54 and Controller B
// paths remain unchanged. This operation never invokes the new source.
function readBundleSourceBytes(relative,sourceSha){
 need(validSha(sourceSha),'BUNDLE_SOURCE_SHA_INVALID');
 need(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/.test(relative??'')
   &&!relative.split('/').some(x=>x==='.'||x==='..'||x==='')
   &&!relative.includes('\\'),'BUNDLE_SOURCE_RELATIVE_PATH_INVALID');
 const route=`repos/ansqhd5774-Choi/zgmini/contents/${relative}?ref=${sourceSha}`;
 const raw=execFileSync(gh,['api',route],{encoding:'utf8',windowsHide:true,
  timeout:60000,maxBuffer:8e6});
 let object;try{object=JSON.parse(raw);}catch{need(false,'BUNDLE_GITHUB_SOURCE_API_INVALID');}
 need(object?.type==='file'&&object.encoding==='base64'
  &&typeof object.content==='string'&&object.content.length<6e6,
  'BUNDLE_GITHUB_SOURCE_NOT_CONTENT_FILE');
 const compact=object.content.replace(/\s/g,'');
 need(/^[A-Za-z0-9+/]*={0,2}$/.test(compact),'BUNDLE_GITHUB_SOURCE_ENCODING');
 const bytes=Buffer.from(compact,'base64');
 need(bytes.length<=4*1024*1024,'BUNDLE_GITHUB_FILE_TOO_LARGE');
 return bytes;
}

function loadApprovedBundlePackage(requestId,file){
 const expected=path.join(maintenanceRoot,'approved',requestId+'.json');
 need(path.resolve(file)===path.resolve(expected),'BUNDLE_APPROVED_PACKAGE_PATH');
 const data=json(expected),{issue,manifestRawBase64}=data;
 need(issue?.requestId===requestId&&issue.operation===SOURCE_BUNDLE_OPERATION
  &&issue.controlRepository===controlRepository,'BUNDLE_APPROVED_REQUEST_MISMATCH');
 need(data.actor==='ansqhd5774-Choi'&&Number.isSafeInteger(data.issueNumber),
  'BUNDLE_APPROVED_ACTOR_INVALID');
 const raw=Buffer.from(manifestRawBase64??'','base64');
 need(raw.length>0&&raw.length<=65536&&sha256(raw)===issue.approvalManifestSha256,
  'BUNDLE_APPROVED_BYTES_DRIFT');
 const actual=github('issues/'+data.issueNumber);
 let body;try{body=JSON.parse(actual.body);}catch{need(false,'BUNDLE_ISSUE_READBACK_INVALID');}
 const authenticated=validateSourceBundleIssueEnvelope(body,{actor:actual.user?.login});
 need(JSON.stringify(authenticated)===JSON.stringify(issue)
  &&actual.user?.login===data.actor&&actual.state==='open'
  &&actual.title===SOURCE_BUNDLE_ISSUE_TITLE&&!actual.pull_request
  &&actual.labels?.some(x=>x.name==='pc-maintenance'),
  'BUNDLE_ISSUE_IDENTITY_DRIFT');
 const manifest=validateSourceBundleBApproval(issue,raw,{actor:data.actor,
  installedSha:installedManifest().installedSha});
 need(JSON.stringify(data.manifest)===JSON.stringify(JSON.parse(raw)),
  'BUNDLE_APPROVED_PACKAGE_DRIFT');
 return {...data,issue:authenticated,manifest};
}

function readSourceBundleStatus(requestId){
 const state=readMaintenanceRecoveryStatus(requestId);
 const backup=path.join(controlRoot,'backups','source-'+requestId);
 let hostSha256=null,hostReadbackCode=null;
 try{hostSha256=sha256(fs.readFileSync(hostPath));}
 catch{hostReadbackCode='BUNDLE_HOST_UNREADABLE';}
 return {...state,hostSha256,hostReadbackCode,
  backupExists:fs.existsSync(backup),
  appliedMarker:fs.existsSync(path.join(backup,'APPLIED.json')),
  rollbackMarker:fs.existsSync(path.join(backup,'ROLLED_BACK.json'))};
}

async function applySourceBundleOnly(requestId,packageFile){
 const {issue,manifest,issueNumber}=loadApprovedBundlePackage(requestId,packageFile);
 const ledgerFile=path.join(recordDir,requestId+'.json');
 need(process.platform==='win32','BUNDLE_WINDOWS_REQUIRED');
 need(!fs.existsSync(ledgerFile),'BUNDLE_EXISTING_LEDGER_RECONCILE_FIRST');
 need(!fs.existsSync(manifest.backupDirectory),'BUNDLE_BACKUP_ALREADY_EXISTS');
 const {owner}=readOwner();verifyIndependent(owner.pid);
 const installed=installedManifest();
 need(installed.installedSha===manifest.installedControllerSha,
  'BUNDLE_INSTALLED_CONTROLLER_DRIFT');
 // The B approval PR must be merged into the current main; a Draft is not permission.
 const pr=github('pulls/'+manifest.approval.ref.split('/').pop());
 need(pr.merged===true&&validSha(pr.merge_commit_sha),'BUNDLE_APPROVAL_PR_NOT_MERGED');
 const manifestApprovalPath=`approvals/source-bundles/${issue.approvalManifestSha256}.json`;
 let manifestInApprovalPr=false;
 for(let page=1;page<=10;page++){
  const rows=github('pulls/'+manifest.approval.ref.split('/').pop()+`/files?per_page=100&page=${page}`);
  need(Array.isArray(rows),'BUNDLE_APPROVAL_PR_FILES_UNVERIFIED');
  manifestInApprovalPr=rows.some(row=>row.filename===manifestApprovalPath
   &&['added','modified'].includes(row.status));
  if(manifestInApprovalPr||rows.length<100)break;
 }
 need(manifestInApprovalPr,'BUNDLE_APPROVAL_PR_DID_NOT_AUTHORIZE_MANIFEST');
 const approvedRaw=readR6GitHubBytes(controlRepository,manifestApprovalPath,'main');
 need(sha256(approvedRaw)===issue.approvalManifestSha256,
  'BUNDLE_APPROVAL_MAIN_MANIFEST_DRIFT');
 git(['fetch','--no-tags','origin','main']);
 need(git(['merge-base','--is-ancestor',pr.merge_commit_sha,'refs/remotes/origin/main']).trim()==='',
  'BUNDLE_APPROVAL_PR_NOT_ON_MAIN');
 need(path.resolve(path.dirname(manifest.stageBundle))===
  path.resolve(path.join(controlRoot,'source-bundles')),'BUNDLE_STAGE_ROOT_SCOPE');
 const beforeHost=fs.readFileSync(hostPath);
 // Source manifest belongs to approved control main: embedding its own source
 // commit SHA inside that same source commit would create a hash fixed-point.
 const sourceManifestBytes=readR6GitHubBytes(controlRepository,manifest.sourceManifestPath,'main');
 need(sha256(sourceManifestBytes)===manifest.sourceManifestSha256,
  'BUNDLE_SOURCE_MANIFEST_DRIFT');
 let sourceManifest;
 try{sourceManifest=JSON.parse(sourceManifestBytes.toString('utf8'));}
 catch{need(false,'BUNDLE_SOURCE_MANIFEST_JSON_INVALID');}
 need(sourceManifest?.schema==='ZGMINI_PC_SOURCE_BUNDLE_MANIFEST_V1'
  &&sourceManifest.sourceSha===manifest.sourceSha
  &&sourceManifest.sourceBranch===manifest.sourceBranch
  &&sourceManifest.entrypoint===manifest.entrypoint
  &&sourceManifest.sourceRepository===manifest.sourceRepository
  &&sourceManifest.files&&typeof sourceManifest.files==='object'
  &&Object.keys(sourceManifest.files).length>0
  &&Object.keys(sourceManifest.files).length<=8192,'BUNDLE_SOURCE_MANIFEST_SCOPE');
 const sourceFiles={};
 let sourceTotalBytes=0;
 for(const relative of Object.keys(sourceManifest.files)){
  const bytes=readBundleSourceBytes(relative,manifest.sourceSha);
  need(sha256(bytes)===sourceManifest.files[relative],'BUNDLE_SOURCE_FILE_DRIFT');
  sourceTotalBytes+=bytes.length;
  need(sourceTotalBytes<=256*1024*1024,'BUNDLE_SOURCE_TOTAL_BYTES_TOO_LARGE');
  sourceFiles[relative]=bytes;
 }
 const lock=acquireMaintenanceLock(maintenanceRoot,'controller-install');
 let retained=false,modified=false,result;
 const save=fields=>{
  const previous=fs.existsSync(ledgerFile)?json(ledgerFile):{};
  writeJson(ledgerFile,{...previous,schema:'ZGMINI_SOURCE_BUNDLE_B_LEDGER_V1',
   requestId,issueNumber,targetControllerSha:issue.targetControllerSha,...fields});
 };
 try{
  save({status:'RUNNING',phase:'LEASE_ACQUIRED',lastPass:'SOURCE_BYTES_PINNED',
   sourceSha:manifest.sourceSha,hostOriginalSha256:sha256(beforeHost),
   hostProposedSha256:null,
   leaseOwnerNonce:lock.owner.nonce,leaseOwnerPid:lock.owner.pid});
  const base=path.dirname(manifest.stageBundle);
  if(!fs.existsSync(base))fs.mkdirSync(base);
  const staged=stageApprovedSourceBundle({manifestBytes:sourceManifestBytes,
   sourceFiles,stageBundle:manifest.stageBundle});
  need(staged.manifestSha256===manifest.sourceManifestSha256,
   'BUNDLE_STAGE_MANIFEST_DRIFT');
  const plan=planSourceBundleRegistration({hostBytes:beforeHost,
   manifestBytes:sourceManifestBytes,approval:manifest,stageBundle:manifest.stageBundle});
  save({status:'RUNNING',phase:'BUNDLE_STAGED',lastPass:'SEALED_FILES_VERIFIED',
   stagedFiles:staged.fileCount,hostOriginalSha256:plan.hostOriginalSha256,
   hostProposedSha256:plan.hostProposedSha256});
  const verifyAuthorizedLease=()=>{
   const live=json(path.join(maintenanceRoot,'leases/controller-install/owner.json'));
   need(live.pid===process.pid&&live.nonce===lock.owner.nonce,
    'BUNDLE_LEASE_OWNER_CHANGED');
   const current=readOwner();
   need(current.owner.pid===owner.pid&&current.owner.nonce===owner.nonce,
    'BUNDLE_MAINTAINER_OWNER_CHANGED');
   verifyIndependent(current.owner.pid);
  };
  // Additive host key CAS, not a task/DB/source execution: no six-seat global
  // idle gate, extra Controller install or workflow disable is necessary.
  const applied=applyPreparedSourceBundleHostCas({plan,hostPath:manifest.hostPath,
   backupDirectory:manifest.backupDirectory,verifyAuthorizedLease});
  modified=applied.status!=='ROLLED_BACK';
  if(applied.status==='RECOVERY_REQUIRED'){
   result={status:'RECOVERY_REQUIRED',code:applied.code,
    lastPass:'HOST_CAS_ATTEMPTED',firstFail:applied.code,
    actualControllerSha:installed.installedSha};
   save({status:'RECOVERY_REQUIRED',phase:'HOST_OUTCOME_UNKNOWN',result});
   lock.holdForRecovery();retained=true;return result;
  }
  need(sha256(fs.readFileSync(hostPath))===(applied.status==='APPLIED'
   ?plan.hostProposedSha256:plan.hostOriginalSha256),
   'BUNDLE_HOST_POST_APPLY_CAS_FAILED');
  // No database, checkpoint, task or workflow handle is opened for writing.
  // Unlike Controller replacement, this additive host-key CAS must not block
  // legitimate concurrent Core/Writer progress on an unrelated file snapshot.
  result={status:applied.status==='APPLIED'?'PASS':'ROLLED_BACK',
   code:applied.status==='APPLIED'?'BUNDLE_REGISTERED':applied.code,
   lastPass:applied.status==='APPLIED'?'HOST_CAS_READBACK':'HOST_ROLLBACK_READBACK',
   firstFail:applied.status==='APPLIED'?null:applied.code,
   sourceSha:manifest.sourceSha,actualControllerSha:installed.installedSha,
   sourceExecuted:false,dbChanged:false,schedulesChanged:false};
  save({status:result.status,phase:'COMPLETED',result});
  return result;
 }catch(error){
  const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'BUNDLE_B_PREFLIGHT_UNKNOWN';
  let hostOriginal=false;
  try{hostOriginal=sha256(fs.readFileSync(hostPath))===sha256(beforeHost);}catch{}
  const attempted=fs.existsSync(manifest.backupDirectory)||modified;
  // A concurrent host change *before* this updater's first host-write/backup
  // is an ordinary CAS refusal, not a reason to retain the shared B lease.
  const recovery=attempted;
  result={status:recovery?'RECOVERY_REQUIRED':'BLOCKED',code,
   firstFail:code,lastPass:hostOriginal?'HOST_BYTES_UNCHANGED':'SOURCE_BYTES_PINNED',
   actualControllerSha:installed.installedSha};
  save({status:result.status,phase:recovery?'RECOVERY_REQUIRED':'BUNDLE_STAGING_BLOCKED',result});
  if(recovery){lock.holdForRecovery();retained=true;}
  return result;
 }finally{if(!retained)lock.release();}
}

function loadApprovedR6HostPackage(requestId,file){
 const expected=path.join(maintenanceRoot,'approved',requestId+'.json');
 need(path.resolve(file)===path.resolve(expected),'R6_HOST_APPROVAL_FILE_PATH');
 const data=json(expected),{issue,manifestRawBase64}=data;
 need(issue?.requestId===requestId&&issue.operation==='employment-r6-host-register'
   &&issue.controlRepository===controlRepository,'R6_HOST_MAINTENANCE_REQUEST_MISMATCH');
 need(data.actor==='ansqhd5774-Choi'&&Number.isSafeInteger(data.issueNumber),
   'R6_HOST_MAINTENANCE_ACTOR_NOT_APPROVED');
 const raw=Buffer.from(manifestRawBase64??'','base64');
 need(raw.length>0&&raw.length<=32768&&sha256(raw)===issue.approvalManifestSha256,
   'R6_HOST_APPROVAL_MANIFEST_DRIFT');
 const actual=github('issues/'+data.issueNumber);
 let actualBody;try{actualBody=JSON.parse(actual.body);}catch{need(false,'R6_HOST_ISSUE_READBACK_INVALID');}
 const authenticated=validateR6HostIssueEnvelope(actualBody,{
  actor:actual.user?.login,controlRepository});
 need(JSON.stringify(authenticated)===JSON.stringify(issue)
   &&actual.user?.login===data.actor
   &&actual.state==='open'&&actual.title===R6_HOST_TITLE
   &&actual.labels?.some(x=>x.name==='pc-maintenance')&&!actual.pull_request,
   'R6_HOST_ISSUE_IDENTITY_DRIFT');
 const {manifest}=validateR6HostRegistrationRequest(issue,raw,{
  actor:data.actor,controlRepository,installedSha:installedManifest().installedSha});
 need(data.manifest&&JSON.stringify(data.manifest)===JSON.stringify(JSON.parse(raw)),
   'R6_HOST_APPROVED_PACKAGE_CHANGED');
 return {...data,issue:authenticated,manifest};
}

async function importPinnedR6HostHelpers(requestId){
 const items=[
  ['stage-r6-host-registration.mjs',R6_STAGE_TOOL_HASH],
  ['apply-r6-host-overlay-b.mjs',R6_APPLY_TOOL_HASH],
 ];
 need(git(['status','--porcelain']).trim()==='','R6_HOST_CONTROL_CHECKOUT_DIRTY');
 git(['fetch','--no-tags','origin','main']);
 const root=path.join(maintenanceRoot,'approved','host-r6-modules-'+requestId);
 need(!fs.existsSync(root),'R6_HOST_MODULES_ALREADY_STAGED');
 fs.mkdirSync(root);
 for(const [filename,digest] of items){
  const source=git(['show','refs/remotes/origin/main:tools/'+filename],{encoding:null});
  need(sha256(source)===digest,'R6_HOST_MODULE_SOURCE_DRIFT');
  const dest=path.join(root,filename);
  fs.writeFileSync(dest,source,{flag:'wx'});
  need(sha256(fs.readFileSync(dest))===digest,'R6_HOST_MODULE_READBACK_FAILED');
 }
 // These modules only import built-in Node modules and their verified sibling.
 const staged=await import(pathToFileURL(path.join(root,items[0][0])).href);
 const applied=await import(pathToFileURL(path.join(root,items[1][0])).href);
 need(typeof staged.draftR6HostRegistration==='function'
   &&typeof applied.applyPreparedR6HostB==='function','R6_HOST_MODULE_EXPORT_INVALID');
 return {staged,applied};
}

function readR6HostStatus(requestId){
 const current=readMaintenanceRecoveryStatus(requestId);
 const backup=path.join(controlRoot,'backups','r6-host-'+requestId);
 let hostSha256=null,hostReadbackCode=null;
 try{hostSha256=sha256(fs.readFileSync(hostPath));}
 catch{hostReadbackCode='R6_HOST_BYTES_UNAVAILABLE';}
 const guidance=current.installLock?.held&&current.installLock.recoveryRequired
  ?{state:'RECOVERY_REQUIRED',next:'INSPECT_R6_HOST_BACKUP_JOURNAL_AND_INTAKE_NO_CONTROLLER_ABORT',blockScope:'SHARED_HOST_APPLY_ONLY'}
  :current.guidance;
 let recovery=null;
 if(current.ledger?.status==='RECOVERY_REQUIRED'){
  try{
   const completion=path.join(maintenanceRoot,'recovery','host-r6-'+requestId+'.json');
   const archive=path.join(maintenanceRoot,'recovery','host-r6-'+requestId+'.lease');
   const done=fs.existsSync(completion)?json(completion):null;
   recovery=done?.schema==='ZGMINI_R6_HOST_RECOVERY_V1'
    &&done.requestId===requestId&&done.status==='RECOVERY_COMPLETED'
    &&done.leaseArchive===archive&&fs.existsSync(archive)
    &&current.installLock?.held===false
    ?{status:'ARCHIVED_RECOVERY_EVIDENCE',code:done.code,
      historicalHostOutcome:done.hostOutcome,archiveVerified:true,
      currentRuntimeVerified:false}
    :readR6HostRecoveryEvidence(requestId,current.ledger,hostSha256,current.installLock);
  }
  catch{recovery={status:'STATE_UNKNOWN',code:'R6_HOST_RECOVERY_INSPECTION_FAILED',
   next:'READ_ONLY_RECONCILE_R6_HOST_EVIDENCE_NO_MUTATION'};}
 }
 return {...current,guidance,hostSha256,hostReadbackCode,recovery,
  backupExists:fs.existsSync(backup),
  appliedMarker:fs.existsSync(path.join(backup,'APPLIED.json')),
  rollbackMarker:fs.existsSync(path.join(backup,'ROLLED_BACK.json'))};
}

function readR6HostRecoveryEvidence(requestId,ledger,hostSha256,installLock){
 const leaseDir=path.join(maintenanceRoot,'leases/controller-install');
 const backupDir=path.join(controlRoot,'backups','r6-host-'+requestId);
 const safeRead=file=>{try{return json(file);}catch{return null;}};
 const owner=safeRead(path.join(leaseDir,'owner.json'));
 const marker=safeRead(path.join(leaseDir,'RECOVERY_REQUIRED.json'));
 const markerMatches=Boolean(owner&&marker&&owner.nonce===marker.nonce
   &&owner.pid===marker.requestOwnerPid&&owner.nonce===ledger.leaseOwnerNonce
   &&owner.pid===ledger.leaseOwnerPid);
 let ownerDead=false;
 if(Number.isSafeInteger(owner?.pid)&&owner.pid>0){
  try{process.kill(owner.pid,0);}catch(e){if(e?.code==='ESRCH')ownerDead=true;}
 }
 let protectedSame=false,dbIdentitySame=false;
 try{protectedSame=sha256(Buffer.from(JSON.stringify(protectedSnapshot())))===ledger.protectedBeforeSha256;}
 catch{/* deny recovery without a comparable protected-before snapshot */}
 try{
  dbIdentitySame=JSON.stringify(r6FileIdentity(ledger.coreBefore.realpath))===JSON.stringify(ledger.coreBefore)
   &&JSON.stringify(r6FileIdentity(ledger.candidateBefore.realpath))===JSON.stringify(ledger.candidateBefore);
 }catch{/* unknown identity is never safe to reconcile */}
 let backupSha256=null;
 try{
  const f=path.join(backupDir,'HOST_BEFORE.bytes'),stat=fs.lstatSync(f);
  if(stat.isFile()&&!stat.isSymbolicLink())backupSha256=sha256(fs.readFileSync(f));
 }catch{/* backup can be absent before a host switch */}
 const journal=safeRead(path.join(backupDir,'HOST_B_APPLY_JOURNAL.json'));
 const applied=safeRead(path.join(backupDir,'APPLIED.json'));
 const rolledBack=safeRead(path.join(backupDir,'ROLLED_BACK.json'));
 const journalValid=journal?.schema==='R6_B_JOURNAL_V1'&&journal?.state==='PREPARED'
   &&journal.beforeSha256===ledger.hostOriginalSha256
   &&journal.targetSha256===ledger.hostProposedSha256;
 const appliedMarkerValid=applied?.status==='APPLIED'
   &&applied.newHostSha256===ledger.hostProposedSha256;
 const rollbackMarkerValid=rolledBack?.status==='ROLLED_BACK'
   &&sha256(fs.readFileSync(hostPath))===ledger.hostOriginalSha256;
 const backlogFile=path.join(maintenanceRoot,'backlog',requestId+'.json');
 let backlogExists=false;
 try{if(fs.existsSync(backlogFile)){
  const backlog=json(backlogFile),windows=backlogPauseWindows(backlog);
  backlogExists=backlog.requestId===requestId
   &&(!ledger.pauseAttempted||windows[0].pausedAt===ledger.pauseStartedAt);
 }}catch{/* malformed backlog cannot authorize workflow resume */}
 let workflowState='UNKNOWN';
 try{workflowState=github('actions/workflows/pc-job.yml').state;}catch{/* offline readback is UNKNOWN */}
 const decision=classifyR6HostRecovery({ledgerStatus:ledger.status,
  installLeaseHeld:installLock?.held===true&&installLock?.recoveryRequired===true,
  markerMatches,ownerDead,protectedSame,dbIdentitySame,
  workflowState,backlogExists,pauseAttempted:ledger.pauseAttempted===true,hostSha256,
  originalSha256:ledger.hostOriginalSha256,proposedSha256:ledger.hostProposedSha256,
  backupSha256,journalValid,appliedMarkerValid,rollbackMarkerValid});
 return {observedAt:new Date().toISOString(),...decision,hostSha256,
  workflowState,backlogExists,ownerDead,markerMatches,protectedSame,dbIdentitySame,
  backupReadbackVerified:backupSha256===ledger.hostOriginalSha256,
  journalValid,appliedMarkerValid,rollbackMarkerValid};
}


function replayR6Backlog(requestId,backlogFile){
 let state=json(backlogFile);
 const windows=backlogPauseWindows(state);
 need(state.requestId===requestId,'R6_HOST_BACKLOG_REQUEST_ID_DRIFT');
 const ledger=json(path.join(recordDir,requestId+'.json'));
 need(ledger.pauseAttempted===true&&windows[0].pausedAt===ledger.pauseStartedAt,
  'R6_HOST_BACKLOG_START_DRIFT');
 need(windows.length>0&&windows.every(w=>w.resumedAt),'R6_HOST_BACKLOG_WINDOW_UNCLOSED');
 const candidates=new Map();
 for(const window of windows){
  const from=Date.parse(window.pausedAt)-2000,to=Date.parse(window.resumedAt);
  need(Number.isFinite(from)&&Number.isFinite(to)&&to>=from,'R6_HOST_BACKLOG_TIME_INVALID');
  for(let page=1;page<=20;page++){
   const list=github(`issues?state=all&since=${encodeURIComponent(new Date(from).toISOString())}&per_page=100&page=${page}`);
   need(Array.isArray(list),'R6_HOST_BACKLOG_LIST_INVALID');
   for(const issue of list)if(backlogIssueInPause(issue,window))candidates.set(issue.number,issue);
   if(list.length<100)break;
   need(page<20,'R6_HOST_BACKLOG_LIST_TRUNCATED');
  }
 }
 for(const original of [...candidates.values()].sort((a,b)=>a.number-b.number)){
  const key=String(original.number);
  if(['DONE','SKIPPED_RESULT_PRESENT'].includes(state.replays[key]?.status))continue;
  const marker=`Maintenance replay ${requestId} original #${original.number}`;
  if(state.replays[key]?.status==='POSTING'){
   // The POST ACK may have been lost. Discover an exact previously accepted
   // request before changing the journal; NEVER submit a second candidate.
   const matches=[];
   for(const window of windows){
    const since=new Date(Date.parse(window.pausedAt)-2000).toISOString();
    for(let page=1;page<=20;page++){
     const rows=github(`issues?state=all&since=${encodeURIComponent(since)}&per_page=100&page=${page}`);
     need(Array.isArray(rows),'R6_HOST_REPLAY_READBACK_UNAVAILABLE');
     for(const found of rows)if(found.title===marker&&found.body===original.body
       &&found.user?.login==='ansqhd5774-Choi'
       &&found.labels?.some(x=>x.name==='pc-job')&&!found.pull_request)
       matches.push(found.number);
     if(rows.length<100)break;
     need(page<20,'R6_HOST_REPLAY_SEARCH_TRUNCATED');
    }
   }
   const unique=[...new Set(matches)];
   need(unique.length===1,'R6_HOST_BACKLOG_REPLAY_OUTCOME_UNKNOWN');
   state.replays[key]={status:'DONE',originalRequestId:state.replays[key].originalRequestId,
    replayIssueNumber:unique[0],recoveredFromLostAcknowledgement:true};
   writeJson(backlogFile,state);
   continue;
  }
  need(!state.replays[key],'R6_HOST_BACKLOG_REPLAY_OUTCOME_UNKNOWN');
  const comments=github(`issues/${original.number}/comments?per_page=100`);
  if(comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes('zgmini-pc-result:'))){
   state.replays[key]={status:'SKIPPED_RESULT_PRESENT'};
   writeJson(backlogFile,state);
   continue;
  }
  let body;try{body=JSON.parse(original.body);}catch{need(false,'R6_HOST_BACKLOG_ORIGINAL_BODY_INVALID');}
  need(validBacklogOriginalPcJob(body),'R6_HOST_BACKLOG_ORIGINAL_REQUEST_INVALID');
  state.replays[key]={status:'POSTING',originalRequestId:body.requestId};
  writeJson(backlogFile,state);
  const input=path.join(maintenanceRoot,'approved',requestId+'.replay-'+original.number+'.json');
  writeJson(input,{title:marker,body:original.body,labels:['pc-job']});
  let repost;
  try{repost=github('issues','POST',input);}
  catch{need(false,'R6_HOST_BACKLOG_REPLAY_OUTCOME_UNKNOWN');}
  need(Number.isSafeInteger(repost.number),'R6_HOST_BACKLOG_REPLAY_OUTCOME_UNKNOWN');
  state.replays[key]={status:'DONE',originalRequestId:body.requestId,replayIssueNumber:repost.number};
  writeJson(backlogFile,state);
  const notification=`<!-- zgmini-pc-backlog-replay:${requestId}:${original.number} -->\n`+
   `This request arrived during a verified maintenance pause. Equivalent fixed request: #${repost.number}.`;
  const commentInput=path.join(maintenanceRoot,'approved',requestId+'.replay-comment-'+original.number+'.json');
  writeJson(commentInput,{body:notification});
  try{github(`issues/${original.number}/comments`,'POST',commentInput);}catch{/* durable replay ledger */}
 }
}

async function applyR6HostOnly(requestId,packageFile){
 const {issue,manifest,issueNumber}=loadApprovedR6HostPackage(requestId,packageFile);
 const ledgerFile=path.join(recordDir,requestId+'.json');
 const backlogFile=path.join(maintenanceRoot,'backlog',requestId+'.json');
 need(!fs.existsSync(ledgerFile),'R6_HOST_EXISTING_LEDGER_RECONCILE_FIRST');
 need(!fs.existsSync(manifest.backupDirectory),'R6_HOST_BACKUP_ALREADY_EXISTS');
 need(process.platform==='win32','R6_HOST_WINDOWS_REQUIRED');
 const {owner}=readOwner();
 verifyIndependent(owner.pid);
 const installed=installedManifest();
 need(installed.installedSha===manifest.installedControllerSha,
  'R6_HOST_CONTROLLER_NOT_INSTALLED');
 const policy=json(path.join(controlRoot,'config/operations.json'));
 const r6Op=policy.operations?.['employment-r6-candidate-stage-readonly'];
 need(r6Op?.grade==='A'&&r6Op.resource==='heavy'
   &&r6Op.timeoutSeconds===240&&r6Op.minimumFreeMiB===1536,
   'R6_HOST_CONTROLLER_OPERATION_NOT_INSTALLED');
 const pr=github('pulls/'+manifest.approval.ref.split('/').pop());
 need(pr.merged===true&&validSha(pr.merge_commit_sha),'R6_HOST_APPROVAL_PR_NOT_MERGED');
 git(['fetch','--no-tags','origin','main']);
 need(git(['merge-base','--is-ancestor',pr.merge_commit_sha,'refs/remotes/origin/main']).trim()==='',
  'R6_HOST_APPROVAL_PR_NOT_ON_MAIN');
 const beforeHost=fs.readFileSync(hostPath);
 need(sha256(beforeHost)===manifest.hostOriginalSha256,'R6_HOST_ORIGINAL_BYTES_CHANGED');
 const originalProtected=protectedSnapshot();
 const protectedBeforeSha256=sha256(Buffer.from(JSON.stringify(originalProtected)));
 const candidateBytes=fs.readFileSync(manifest.candidatePath);
 need(sha256(candidateBytes)===R6_HOST_CANDIDATE_SHA256,
  'R6_HOST_CANDIDATE_BYTES_CHANGED');
 const coreBefore=r6FileIdentity(path.join(installed.host.dataRoot,'pc-writer/storage/core.sqlite'));
 const candidateBefore=r6FileIdentity(manifest.candidatePath);
 need(coreBefore.realpath!==candidateBefore.realpath
   &&!(coreBefore.dev===candidateBefore.dev&&coreBefore.ino===candidateBefore.ino),
   'R6_HOST_DB_IDENTITY_ALIAS');
 const lock=acquireMaintenanceLock(maintenanceRoot,'controller-install');
 let retained=false,paused=false,result=null;
 const save=fields=>{
  // Preserve the BEFORE proof across every phase. An uncertain post-swap
  // recovery must never reconstruct pre-mutation identity from current bytes.
  const previous=fs.existsSync(ledgerFile)?json(ledgerFile):{};
  writeJson(ledgerFile,{...previous,schema:'ZGMINI_R6_HOST_B_LEDGER_V1',
   requestId,issueNumber,targetControllerSha:issue.targetControllerSha,...fields});
 };
 try{
 try{
  save({status:'RUNNING',phase:'LEASE_ACQUIRED',firstFail:null,lastPass:'B_CONTRACT_VERIFIED',
   hostOriginalSha256:manifest.hostOriginalSha256,hostProposedSha256:manifest.proposedSha256,
   protectedBeforeSha256,coreBefore,candidateBefore,
   leaseOwnerNonce:lock.owner.nonce,leaseOwnerPid:lock.owner.pid,
   workflowInitiallyActive:true});
  const modules=await importPinnedR6HostHelpers(requestId);
  const rawManifest=readR6GitHubBytes(controlRepository,R6_SOURCE_MANIFEST_PATH,'main');
  need(sha256(rawManifest)===R6_HOST_SOURCE_MANIFEST_SHA256,
   'R6_HOST_SOURCE_MANIFEST_DRIFT');
  const sourceManifest=JSON.parse(rawManifest.toString('utf8'));
  const files={};
  for(const rel of modules.staged.R6_SOURCE_FILES){
   const bytes=readR6GitHubBytes('ansqhd5774-Choi/zgmini',rel,R6_HOST_SOURCE_SHA);
   need(sha256(bytes)===sourceManifest.files?.[rel],'R6_HOST_SOURCE_BYTES_DRIFT');
   files[rel]=bytes;
  }
  need(github('actions/workflows/pc-job.yml').state==='active',
   'R6_HOST_WORKFLOW_NOT_ACTIVE_PREEXISTING');
  const at=new Date().toISOString();
  writeJson(backlogFile,{schema:'ZGMINI_PC_BACKLOG_V1',requestId,
   pausedAt:at,resumedAt:null,replays:{},windows:[{pausedAt:at,resumedAt:null}]});
  save({status:'RUNNING',phase:'PAUSE_ATTEMPTED',pauseAttempted:true,pauseStartedAt:at,
   lastPass:'SOURCE_BYTES_VERIFIED'});
  // Mark the attempt before the network call: an ACK can be lost after GitHub
  // has already disabled intake. Always reconcile its actual state on error.
  paused=true;
  try{github('actions/workflows/pc-job.yml/disable','PUT');}
  catch{need(github('actions/workflows/pc-job.yml').state==='disabled_manually',
    'R6_HOST_WORKFLOW_DISABLE_OUTCOME_UNKNOWN');}
  need(github('actions/workflows/pc-job.yml').state==='disabled_manually',
   'R6_HOST_WORKFLOW_DISABLE_NOT_CONFIRMED');
  let quiet=0;
  for(let n=0;n<180;n++){
   const inventory=github('actions/runners?per_page=100');
   need(Array.isArray(inventory?.runners)&&Number.isSafeInteger(inventory?.total_count)
     &&inventory.total_count===inventory.runners.length,
     'R6_HOST_RUNNER_INVENTORY_INCOMPLETE');
   const seats=dedicatedPcRunnerRows(inventory.runners);
   need(seats!==null,'R6_HOST_RUNNER_SET_DRIFT');
   need(seats.every(row=>typeof row.busy==='boolean'
     &&['online','offline'].includes(row.status)),'R6_HOST_RUNNER_STATE_INVALID');
   const active=['in_progress','queued','waiting'].reduce((sum,status)=>
     sum+(github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0),0);
   const leases=fs.readdirSync(path.join(controlRoot,'leases')).filter(x=>x!=='supervisor');
   if(seats.every(x=>x.status==='online'&&!x.busy)&&active===0&&leases.length===0){
    if(++quiet>=2)break;
   }else quiet=0;
   need(n<179,'R6_HOST_DRAIN_WAIT_TIMEOUT');
   await wait(3000);
  }
  save({status:'RUNNING',phase:'DRAIN_VERIFIED',lastPass:'WORKFLOW_PAUSED_AND_DRAINED'});
  const stageRoot=path.dirname(manifest.stageBundle);
  const approvedStageRoot=path.join(controlRoot,'source-bundles');
  need(path.resolve(stageRoot)===path.resolve(approvedStageRoot),
   'R6_HOST_STAGE_ROOT_OUTSIDE_CONTROL');
  if(!fs.existsSync(stageRoot))fs.mkdirSync(stageRoot);
  const proposal=modules.staged.draftR6HostRegistration({
   installedHost:installed.host,sourceFiles:files,manifestBytes:rawManifest,
   sourceSha:R6_HOST_SOURCE_SHA,candidatePath:manifest.candidatePath,stageRoot});
  need(sameR6WindowsPath(proposal.stageBundle,manifest.stageBundle)
   &&proposal.manifestSha256===manifest.sourceManifestSha256
   &&proposal.existingApprovalsPreserved,'R6_HOST_SOURCE_STAGE_SCOPE_CHANGED');
  need(sha256(Buffer.from(JSON.stringify(proposal.proposedHost,null,2)+'\n'))===manifest.proposedSha256,
   'R6_HOST_PROPOSAL_SHA_CHANGED');
  save({status:'RUNNING',phase:'BUNDLE_STAGED',lastPass:'R6_SOURCE_16_FILE_READBACK_VERIFIED'});
  const runtimeProbe=()=>{
   const current=readOwner();
   need(current.owner.pid===owner.pid&&current.owner.nonce===owner.nonce,
    'R6_HOST_SUPERVISOR_OWNER_CHANGED');
   verifyIndependent(current.owner.pid);
   need(sha256(fs.readFileSync(manifest.candidatePath))===manifest.candidateSha256,
    'R6_HOST_CANDIDATE_BYTES_CHANGED');
   const liveLease=json(path.join(maintenanceRoot,'leases/controller-install/owner.json'));
   const owned=liveLease.pid===process.pid&&liveLease.nonce===lock.owner.nonce;
   const rows=github('actions/runners?per_page=100').runners;
   const active=['in_progress','queued','waiting'].reduce((sum,status)=>
     sum+(github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0),0);
   return {controlRepository,workflowState:github('actions/workflows/pc-job.yml').state,
    installLeaseHeldByThisOperator:owned,inFlightPcJobs:active,
    uploadsPending:fs.existsSync(path.join(controlRoot,'leases/result-upload'))?1:0,
    runners:rows.map(row=>({name:row.name,online:row.status==='online',busy:row.busy})),
    observedAt:new Date().toISOString()};
  };
  const applied=modules.applied.applyPreparedR6HostB({
   approval:{schema:manifest.schema,scope:manifest.scope,sourceSha:manifest.sourceSha,
    sourceManifestSha256:manifest.sourceManifestSha256,
    installedControllerSha:manifest.installedControllerSha,hostSha256:manifest.hostOriginalSha256,
    proposedHostSha256:manifest.proposedSha256,hostPath:manifest.hostPath,
    candidatePath:manifest.candidatePath,stageBundle:proposal.stageBundle,
    backupDirectory:manifest.backupDirectory},
   proposedHost:proposal.proposedHost,runtimeProbe,
   // verifyIndependent performed the actual Windows WMI origin check above;
   // these are NOT fields accepted from the external Issue or manifest.
   windowsProvenance:{verified:true,sameUserAndSession:true,maintainerIndependent:true}});
  need(JSON.stringify(protectedSnapshot())===JSON.stringify(originalProtected),
   'R6_HOST_PROTECTED_OPERATION_CHANGED');
  if(applied.status==='RECOVERY_REQUIRED'){
   result={status:'RECOVERY_REQUIRED',code:applied.code,lastPass:'BUNDLE_STAGED',
    firstFail:applied.code,actualControllerSha:installed.installedSha};
   save({status:'RECOVERY_REQUIRED',phase:'ROLLBACK_UNVERIFIED',result});
   lock.holdForRecovery();retained=true;
   return result;
  }
  const expectedSha=applied.status==='APPLIED'
   ?manifest.proposedSha256:manifest.hostOriginalSha256;
  need(sha256(fs.readFileSync(hostPath))===expectedSha,'R6_HOST_POST_APPLY_CAS_FAILED');
  result={status:applied.status==='APPLIED'?'PASS':'ROLLED_BACK',
   code:applied.status==='APPLIED'?'R6_HOST_APPLIED':applied.code,
   lastPass:applied.status==='APPLIED'?'HOST_B_READBACK_VERIFIED':'HOST_B_ROLLBACK_VERIFIED',
   firstFail:applied.status==='APPLIED'?null:applied.code,
   actualControllerSha:installed.installedSha,protectedStateUnchanged:true};
  save({status:'RUNNING',phase:applied.status,lastPass:result.lastPass});
 }catch(error){
  const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'R6_HOST_RUNTIME_PREFLIGHT_FAILED';
  const journal=fs.existsSync(path.join(manifest.backupDirectory,'HOST_B_APPLY_JOURNAL.json'));
  let protectedUnchanged=false,hostUnchanged=false;
  try{protectedUnchanged=JSON.stringify(protectedSnapshot())===JSON.stringify(originalProtected);}
  catch{/* unknown means protection cannot be attested */}
  try{hostUnchanged=sha256(fs.readFileSync(hostPath))===manifest.hostOriginalSha256;}
  catch{/* unknown host bytes cannot be dismissed */}
  // The B primitive creates its backup directory before its journal. A crash
  // in that interval is partial staging, never a harmless clean preflight.
  const backupPartial=fs.existsSync(manifest.backupDirectory);
  const needsRecovery=journal||backupPartial||!protectedUnchanged||!hostUnchanged;
  const stagePartial=fs.existsSync(path.join(maintenanceRoot,'approved','host-r6-modules-'+requestId))
    ||fs.existsSync(manifest.stageBundle);
  result={status:needsRecovery?'RECOVERY_REQUIRED':'BLOCKED',code,
   lastPass:hostUnchanged?'HOST_BYTES_UNCHANGED':'B_CONTRACT_VERIFIED',
   firstFail:code,actualControllerSha:installed.installedSha,
   protectedStateUnchanged:protectedUnchanged};
  save({status:result.status,phase:needsRecovery?'RECOVERY_REQUIRED'
    :stagePartial?'STAGING_PARTIAL_HOST_UNCHANGED':'PRE_APPLY_BLOCKED',result});
  if(needsRecovery){lock.holdForRecovery();retained=true;return result;}
 }
 // A terminal host result does not excuse abandoning requests received during
 // the disabled workflow interval. Never replay one with unknown POST outcome.
 if(paused&&!retained){
  try{
   github('actions/workflows/pc-job.yml/enable','PUT');
   need(github('actions/workflows/pc-job.yml').state==='active',
    'R6_HOST_WORKFLOW_ENABLE_NOT_CONFIRMED');
   const backlog=json(backlogFile);
   writeJson(backlogFile,closeLatestPause(backlog,new Date().toISOString()));
   replayR6Backlog(requestId,backlogFile);
   result.workflowEnabled=true;
   save({status:result.status,phase:'TERMINAL',result});
  }catch(error){
   const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'R6_HOST_BACKLOG_OR_WORKFLOW_UNKNOWN';
   let workflowEnabled=null;
   try{workflowEnabled=github('actions/workflows/pc-job.yml').state==='active';}
   catch{/* network outcome unknown: retain lease for supported recovery */}
   result={...result,status:'RECOVERY_REQUIRED',code,firstFail:code,
    workflowEnabled};
   save({status:'RECOVERY_REQUIRED',phase:'INTAKE_RECONCILIATION_REQUIRED',result});
   lock.holdForRecovery();retained=true;
  }
 }
 return result;
 }finally{if(!retained)lock.release();}
}

// Exceptional operator-only B recovery. The existing Controller recovery
// program only supports its own controller-update journal; this path preserves
// the original R6 request and lease while reconciling exactly that host.
function recoverR6HostOnly(requestId,packageFile,mode){
 need(['reconcile-intake','rollback-host'].includes(mode),'R6_RECOVERY_MODE_NOT_ALLOWED');
 need(process.platform==='win32','R6_RECOVERY_WINDOWS_REQUIRED');
 const {manifest,issueNumber}=loadApprovedR6HostPackage(requestId,packageFile);
 const owner=readOwner();verifyIndependent(owner.owner.pid);
 const recordDirPath=path.join(maintenanceRoot,'recovery');
 const recordFile=path.join(recordDirPath,'host-r6-'+requestId+'.json');
 const archive=path.join(recordDirPath,'host-r6-'+requestId+'.lease');
 const previous=fs.existsSync(recordFile)?json(recordFile):null;
 const phases=['PREPARED','HOST_ROLLED_BACK','PENDING_PRESERVED','ARCHIVE_PREPARED','RECOVERY_COMPLETED'];
 need(!previous||(previous.schema==='ZGMINI_R6_HOST_RECOVERY_V1'
  &&previous.requestId===requestId&&previous.issueNumber===issueNumber
  &&previous.mode===mode&&previous.originalHostSha256===manifest.hostOriginalSha256
  &&previous.proposedHostSha256===manifest.proposedSha256
  &&phases.includes(previous.status)),'R6_RECOVERY_PRIOR_PHASE_REQUIRES_INSPECTION');
 const status=readR6HostStatus(requestId),decision=status.recovery;
 const leaseDir=path.join(maintenanceRoot,'leases/controller-install');
 // The archive and completion record may both have been committed before the
 // final GitHub acknowledgement disappeared. Recover the result by readback;
 // never acquire a new claim or re-run the host/intake changes in this case.
 if(previous?.status==='RECOVERY_COMPLETED'&&!fs.existsSync(leaseDir)){
  const ledger=status.ledger;
  let archiveVerified=false,ownerMarkerMatches=false,protectedSame=false,
   dbIdentitySame=false,backlogVerified=false,workflowActive=false;
  try{
   const stat=fs.lstatSync(archive);
   archiveVerified=stat.isDirectory()&&!stat.isSymbolicLink()
    &&previous.leaseArchive===archive;
   const originalOwner=json(path.join(archive,'owner.json')),
    originalMarker=json(path.join(archive,'RECOVERY_REQUIRED.json'));
   ownerMarkerMatches=originalOwner.pid===ledger.leaseOwnerPid
    &&originalOwner.nonce===ledger.leaseOwnerNonce
    &&originalMarker.requestOwnerPid===originalOwner.pid
    &&originalMarker.nonce===originalOwner.nonce;
   protectedSame=sha256(Buffer.from(JSON.stringify(protectedSnapshot())))===
    ledger.protectedBeforeSha256;
   dbIdentitySame=JSON.stringify(r6FileIdentity(ledger.coreBefore.realpath))===
    JSON.stringify(ledger.coreBefore)
    &&JSON.stringify(r6FileIdentity(ledger.candidateBefore.realpath))===
      JSON.stringify(ledger.candidateBefore);
   const backlogFile=path.join(maintenanceRoot,'backlog',requestId+'.json');
   if(ledger.pauseAttempted===true){
    const backlog=json(backlogFile),windows=backlogPauseWindows(backlog);
    backlogVerified=backlog.requestId===requestId
     &&windows[0].pausedAt===ledger.pauseStartedAt
     &&windows.every(window=>window.resumedAt)
     &&Object.values(backlog.replays??{}).every(item=>
       ['DONE','SKIPPED_RESULT_PRESENT'].includes(item.status));
   }else backlogVerified=true;
   workflowActive=github('actions/workflows/pc-job.yml').state==='active';
  }catch{/* Missing or changed evidence must not acknowledge a completed recovery. */}
  need(verifyR6HistoricCompletion({status:decision?.status,
    recordStatus:previous.status,archiveVerified,originalLeaseAbsent:true,
    ownerMarkerMatches,protectedSame,dbIdentitySame,backlogVerified,
    workflowActive,hostOutcome:previous.hostOutcome,
    hostSha256:status.hostSha256,originalSha256:manifest.hostOriginalSha256,
    proposedSha256:manifest.proposedSha256}),
   'R6_RECOVERY_ARCHIVED_COMPLETION_UNVERIFIED');
  return {status:'HISTORICAL_COMPLETE',code:'R6_RECOVERY_ALREADY_COMPLETED',
   requestId,hostOutcome:previous.hostOutcome,workflowEnabled:true,
   protectedStateUnchanged:true,originalRequestRetried:false,
   readOnlyResultRecovered:true};
 }
 const archivedFinish=Boolean(previous?.status==='ARCHIVE_PREPARED'
  &&!fs.existsSync(leaseDir)&&fs.existsSync(archive));
 const reentry=decideR6RecoveryReentry({mode,previous,decision,
  hostSha256:status.hostSha256,originalSha256:manifest.hostOriginalSha256,
  proposedSha256:manifest.proposedSha256,archivedFinish});
 const resumedRollback=reentry.resumedRollback===true;
 need(status.ledger?.status==='RECOVERY_REQUIRED'
  &&(decision?.status==='ELIGIBLE'||archivedFinish),
  decision?.code??'R6_RECOVERY_EVIDENCE_NOT_ELIGIBLE');
 need(reentry.allowed===true,reentry.code??'R6_RECOVERY_MODE_DOES_NOT_MATCH_ACTUAL_HOST');
 const seatRows=github('actions/runners?per_page=100').runners;
 need(dedicatedPcRunnerRows(seatRows,{requireOnline:true,requireIdle:true})!==null,
  'R6_RECOVERY_RUNNERS_NOT_IDLE');
 const active=['in_progress','queued','waiting'].reduce((sum,state)=>sum+
  (github(`actions/workflows/pc-job.yml/runs?status=${state}&per_page=1`).total_count||0),0);
 need(active===0,'R6_RECOVERY_PC_JOB_IN_FLIGHT');
 // Reconciliation/rollback is an exceptional B write, not an automatic
 // retransmission of the original request. Pin this incident's raw evidence
 // in a separately committed technical recovery manifest before taking lease.
 const leaseEvidencePath=archivedFinish?archive:leaseDir;
 const initialLeaseEvidence={owner:fs.readFileSync(path.join(leaseEvidencePath,'owner.json')),
  marker:fs.readFileSync(path.join(leaseEvidencePath,'RECOVERY_REQUIRED.json')),
  ledger:fs.readFileSync(path.join(recordDir,requestId+'.json'))};
 const recoveryApprovalPath='approvals/host-r6-recoveries/'+requestId+'.json';
 git(['fetch','--no-tags','origin','main']);
 let recoveryApproval,recoveryApprovalRaw;
 try{recoveryApprovalRaw=git(['show','refs/remotes/origin/main:'+recoveryApprovalPath]);
  recoveryApproval=JSON.parse(recoveryApprovalRaw);}
 catch{need(false,'R6_RECOVERY_APPROVAL_NOT_FOUND_OR_INVALID');}
 const keys=['schema','approved','mode','requestId','issueNumber','installedControllerSha',
  'maintainerSourceSha','originalManifestSha256','ledgerSha256',
  'leaseOwnerSha256','leaseMarkerSha256','hostOriginalSha256','hostProposedSha256'];
 need(Object.keys(recoveryApproval).sort().join(',')===keys.sort().join(',')
  &&recoveryApproval.schema==='ZGMINI_R6_HOST_RECOVERY_APPROVAL_V1'
  &&recoveryApproval.approved===true&&recoveryApproval.mode===mode
  &&recoveryApproval.requestId===requestId&&recoveryApproval.issueNumber===issueNumber
  &&recoveryApproval.installedControllerSha===manifest.installedControllerSha
  &&recoveryApproval.maintainerSourceSha===json(path.join(maintenanceRoot,'MAINTENANCE_INSTALL.json')).sourceSha,
  'R6_RECOVERY_APPROVAL_MISMATCH');
 // The approval is tied to raw signed Issue and exact local pre-failure data;
 // never accept a reconstructed JSON object as the original byte hash.
 need(recoveryApproval.originalManifestSha256===
   json(path.join(maintenanceRoot,'approved',requestId+'.json')).issue.approvalManifestSha256
   &&recoveryApproval.ledgerSha256===sha256(initialLeaseEvidence.ledger)
   &&recoveryApproval.leaseOwnerSha256===sha256(initialLeaseEvidence.owner)
   &&recoveryApproval.leaseMarkerSha256===sha256(initialLeaseEvidence.marker)
   &&recoveryApproval.hostOriginalSha256===manifest.hostOriginalSha256
   &&recoveryApproval.hostProposedSha256===manifest.proposedSha256,
  'R6_RECOVERY_APPROVAL_EVIDENCE_DRIFT');
 // All Controller/R6 host recoveries share the same fixed atomic reservation.
 const claimDir=path.join(maintenanceRoot,'leases/controller-recovery');
 const claimRecord=path.join(claimDir,'owner.json');
 const claimProof={requestId,mode,ledgerSha256:sha256(initialLeaseEvidence.ledger),
  leaseOwnerSha256:sha256(initialLeaseEvidence.owner),
  leaseMarkerSha256:sha256(initialLeaseEvidence.marker),
  approvalSha256:sha256(recoveryApprovalRaw)};
 try{fs.mkdirSync(claimDir);}catch(error){
  if(error?.code!=='EEXIST')throw error;
  // Reclaim only a fully pinned, dead claim for THIS incident. Keep the old
  // directory as evidence, and let any competing Controller claim win the
  // atomic mkdir race rather than deleting or replacing its reservation.
  let stale;
  try{stale=json(claimRecord);}catch{need(false,'R6_RECOVERY_CLAIM_OWNER_UNVERIFIED');}
  need(sameR6RecoveryClaim(stale,claimProof),
   'R6_RECOVERY_CLAIM_NOT_SAME_VERIFIED_REQUEST');
  let dead=false;
  try{process.kill(stale.pid,0);}catch(e){if(e?.code==='ESRCH')dead=true;}
  need(dead,'R6_RECOVERY_CLAIM_OWNER_NOT_PROVEN_DEAD');
  const retained=path.join(recordDirPath,'host-r6-'+requestId+'.claim-'+stale.nonce);
  need(!fs.existsSync(retained),'R6_RECOVERY_CLAIM_ALREADY_RETAINED');
  fs.mkdirSync(recordDirPath,{recursive:true});
  fs.renameSync(claimDir,retained);
  fs.mkdirSync(claimDir); // EEXIST means another recovery won; fail closed.
 }
 const claimNonce=randomUUID();
 try{fs.writeFileSync(claimRecord,JSON.stringify({requestId,pid:process.pid,
  nonce:claimNonce,at:new Date().toISOString(),...claimProof})+'\n',{flag:'wx'});}
 catch{try{fs.rmdirSync(claimDir);}catch{}throw Object.assign(Error('R6_RECOVERY_CLAIM_WRITE_FAILED'),
  {code:'R6_RECOVERY_CLAIM_WRITE_FAILED'});}
 let retainClaim=false;
 const leaseCas=()=>need(fs.readFileSync(path.join(leaseEvidencePath,'owner.json')).equals(initialLeaseEvidence.owner)
  &&fs.readFileSync(path.join(leaseEvidencePath,'RECOVERY_REQUIRED.json')).equals(initialLeaseEvidence.marker)
  &&fs.readFileSync(path.join(recordDir,requestId+'.json')).equals(initialLeaseEvidence.ledger),
  'R6_RECOVERY_ORIGINAL_LEASE_OR_LEDGER_CHANGED');
 const saveRecovery=fields=>{
  const prior=fs.existsSync(recordFile)?json(recordFile):null;
  if(prior){
   need(prior.schema==='ZGMINI_R6_HOST_RECOVERY_V1'
    &&prior.requestId===requestId&&prior.mode===mode
    &&prior.originalHostSha256===manifest.hostOriginalSha256
    &&prior.proposedHostSha256===manifest.proposedSha256
    &&phases.includes(prior.status),'R6_RECOVERY_RECORD_DRIFT');
   if(phases.indexOf(prior.status)>=phases.indexOf(fields.status))return prior;
  }
  const next={schema:'ZGMINI_R6_HOST_RECOVERY_V1',requestId,issueNumber,mode,
   originalHostSha256:manifest.hostOriginalSha256,
   proposedHostSha256:manifest.proposedSha256,...prior,
   at:new Date().toISOString(),...fields};
  writeJson(recordFile,next);
  return next;
 };
 try{
  const prior=fs.existsSync(recordFile)?json(recordFile):null;
  need(JSON.stringify(prior)===JSON.stringify(previous),
   'R6_RECOVERY_PRIOR_PHASE_CHANGED');
  leaseCas();
  if(archivedFinish){
   // The lease rename may have succeeded before the completion journal was
   // acknowledged. Never rename a second time or repeat backlog mutations.
   need(previous?.workflowEnabled===true
    &&['APPLIED','ROLLED_BACK','ORIGINAL_READBACK_NO_APPLY_PASS'].includes(previous.hostOutcome)
    &&github('actions/workflows/pc-job.yml').state==='active'
    &&status.recovery?.protectedSame===true&&status.recovery?.dbIdentitySame===true
    &&status.hostSha256===(previous.hostOutcome==='APPLIED'
      ?manifest.proposedSha256:manifest.hostOriginalSha256),
    'R6_RECOVERY_ARCHIVED_FINISH_PROOF_FAILED');
   const backlogFile=path.join(maintenanceRoot,'backlog',requestId+'.json');
   if(status.ledger?.pauseAttempted){
    need(fs.existsSync(backlogFile),'R6_RECOVERY_ARCHIVED_BACKLOG_MISSING');
    const backlog=json(backlogFile),windows=backlogPauseWindows(backlog);
    need(backlog.requestId===requestId
     &&windows[0].pausedAt===status.ledger.pauseStartedAt
     &&windows.every(w=>w.resumedAt)
     &&Object.values(backlog.replays??{}).every(x=>['DONE','SKIPPED_RESULT_PRESENT'].includes(x.status)),
     'R6_RECOVERY_ARCHIVED_BACKLOG_UNVERIFIED');
   }
   saveRecovery({status:'RECOVERY_COMPLETED',code:'R6_RECOVERY_LEASE_ARCHIVED',
    hostOutcome:previous.hostOutcome,workflowEnabled:true,leaseArchive:archive});
   retainClaim=false;
   return {status:'RECOVERY_COMPLETED',code:'R6_RECOVERY_LEASE_ARCHIVED',
    requestId,hostOutcome:previous.hostOutcome,workflowEnabled:true,
    protectedStateUnchanged:true,originalRequestRetried:false,
    recoveredFromLostArchiveAcknowledgement:true};
  }
  const same=readR6HostStatus(requestId).recovery;
  need(same?.status==='ELIGIBLE'&&same.action===decision.action
    &&same.hostSha256===decision.hostSha256
    &&same.ownerDead&&same.markerMatches&&same.protectedSame&&same.dbIdentitySame,
    'R6_RECOVERY_EVIDENCE_DRIFT');
  if(previous&&phases.indexOf(previous.status)>=phases.indexOf('HOST_ROLLED_BACK')){
   need(mode!=='rollback-host'||resumedRollback,
    'R6_RECOVERY_REPORTED_ROLLBACK_HOST_DRIFT');
  }
  saveRecovery({status:'PREPARED',code:'R6_RECOVERY_PRECHECK_VERIFIED',
   preHostSha256:previous?.preHostSha256??status.hostSha256});
  if(reentry.operation==='ROLLBACK_HOST'){
   const backupFile=path.join(manifest.backupDirectory,'HOST_BEFORE.bytes');
   const before=fs.readFileSync(backupFile);
   need(sha256(before)===manifest.hostOriginalSha256
     &&sha256(fs.readFileSync(hostPath))===manifest.proposedSha256,
     'R6_RECOVERY_ROLLBACK_CAS_CHANGED');
   leaseCas();
   need(sha256(Buffer.from(JSON.stringify(protectedSnapshot())))===
    status.ledger.protectedBeforeSha256
    &&JSON.stringify(r6FileIdentity(status.ledger.coreBefore.realpath))===
      JSON.stringify(status.ledger.coreBefore)
    &&JSON.stringify(r6FileIdentity(status.ledger.candidateBefore.realpath))===
      JSON.stringify(status.ledger.candidateBefore),
    'R6_RECOVERY_ROLLBACK_PROTECTED_CAS_CHANGED');
   const tmp=path.join(path.dirname(hostPath),'.r6-recovery-'+requestId+'.tmp');
   if(fs.existsSync(tmp)){
    const s=fs.lstatSync(tmp);
    need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1
     &&sha256(fs.readFileSync(tmp))===manifest.hostOriginalSha256,
     'R6_RECOVERY_ROLLBACK_TEMP_DRIFT');
   }else{
    const fd=fs.openSync(tmp,'wx');
    try{fs.writeFileSync(fd,before);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   }
   need(sha256(fs.readFileSync(hostPath))===manifest.proposedSha256,
    'R6_RECOVERY_HOST_CHANGED_DURING_RESTORE');
   retainClaim=true; // Host mutation has begun; never auto-clear on failure.
   fs.renameSync(tmp,hostPath);
   need(sha256(fs.readFileSync(hostPath))===manifest.hostOriginalSha256,
    'R6_RECOVERY_ROLLBACK_READBACK_FAILED');
   const marker=path.join(manifest.backupDirectory,'ROLLED_BACK.json');
   if(!fs.existsSync(marker))fs.writeFileSync(marker,
    JSON.stringify({status:'ROLLED_BACK',reason:'R6_HOST_RECOVERY_VERIFIED'})+'\n',{flag:'wx'});
   saveRecovery({status:'HOST_ROLLED_BACK',code:'R6_HOST_ORIGINAL_BYTES_VERIFIED'});
  }else if(resumedRollback){
   // A crash after the atomic host rename but before the rollback marker is
   // harmless only when PREPARED proved the proposed bytes and current live
   // bytes, journal, backup, DB and protected state all match the same request.
   const marker=path.join(manifest.backupDirectory,'ROLLED_BACK.json');
   if(!fs.existsSync(marker)){
    retainClaim=true;
    fs.writeFileSync(marker,JSON.stringify({status:'ROLLED_BACK',
     reason:'R6_HOST_RECOVERY_VERIFIED'})+'\n',{flag:'wx'});
   }
   saveRecovery({status:'HOST_ROLLED_BACK',code:'R6_HOST_ORIGINAL_BYTES_VERIFIED'});
  }
  // A crash after writing .tmp but before host CAS leaves a future B attempt
  // blocked. Preserve that exact old-owner temp as evidence; never unlink it.
  const pending=path.join(path.dirname(hostPath),
   '.r6-b-pending-'+manifest.hostOriginalSha256.slice(0,16)+'.tmp');
  const retained=path.join(manifest.backupDirectory,'PENDING_TEMP_PRESERVED.bytes');
  need(!(fs.existsSync(pending)&&fs.existsSync(retained)),
   'R6_RECOVERY_PENDING_ARCHIVE_CONFLICT');
  if(fs.existsSync(pending)){
   const stat=fs.lstatSync(pending);
   need(stat.isFile()&&!stat.isSymbolicLink(),'R6_RECOVERY_PENDING_NOT_REGULAR');
   need(!fs.existsSync(retained),'R6_RECOVERY_PENDING_ARCHIVE_ALREADY_EXISTS');
   if(!fs.existsSync(manifest.backupDirectory))fs.mkdirSync(manifest.backupDirectory);
   const pendingSha=sha256(fs.readFileSync(pending));
   retainClaim=true;
   fs.renameSync(pending,retained);
   need(sha256(fs.readFileSync(retained))===pendingSha,
    'R6_RECOVERY_PENDING_PRESERVATION_UNVERIFIED');
   saveRecovery({status:'PENDING_PRESERVED',code:'R6_HOST_PENDING_TEMP_ARCHIVED',
    pendingSha256:pendingSha});
  }else if(fs.existsSync(retained)){
   const s=fs.lstatSync(retained);
   need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,
    'R6_RECOVERY_PRESERVED_PENDING_NOT_REGULAR');
   const pendingSha=sha256(fs.readFileSync(retained));
   need((previous?.pendingSha256===pendingSha
     ||['PREPARED','HOST_ROLLED_BACK'].includes(previous?.status)
       &&pendingSha===manifest.proposedSha256),
    'R6_RECOVERY_PRESERVED_PENDING_SHA_DRIFT');
   saveRecovery({status:'PENDING_PRESERVED',code:'R6_HOST_PENDING_TEMP_ARCHIVED',
    pendingSha256:pendingSha});
  }else if(previous?.status==='PENDING_PRESERVED'){
   need(false,'R6_RECOVERY_PRESERVED_PENDING_MISSING');
  }
  const workflow=github('actions/workflows/pc-job.yml').state;
  need(['disabled_manually','active'].includes(workflow),'R6_RECOVERY_INTAKE_STATE_UNKNOWN');
  retainClaim=true; // Enable ACK can be lost; never report a safe no-op.
  if(workflow==='disabled_manually'){
   try{github('actions/workflows/pc-job.yml/enable','PUT');}
   catch{need(github('actions/workflows/pc-job.yml').state==='active',
     'R6_RECOVERY_ENABLE_OUTCOME_UNKNOWN');}
  }
  need(github('actions/workflows/pc-job.yml').state==='active',
   'R6_RECOVERY_WORKFLOW_NOT_ACTIVE');
  const backlogFile=path.join(maintenanceRoot,'backlog',requestId+'.json');
  if(fs.existsSync(backlogFile)){
   const backlog=json(backlogFile),windows=backlogPauseWindows(backlog);
   if(windows.at(-1).resumedAt===null)
    writeJson(backlogFile,closeLatestPause(backlog,new Date().toISOString()));
   replayR6Backlog(requestId,backlogFile);
  }
  const after=readR6HostStatus(requestId).recovery;
  need(after?.status==='ELIGIBLE'&&after.action==='RECONCILE_INTAKE'
   &&after.workflowState==='active'&&after.protectedSame&&after.dbIdentitySame,
   'R6_RECOVERY_POSTCHECK_NOT_VERIFIED');
  need(fs.existsSync(leaseDir),'R6_RECOVERY_ORIGINAL_LEASE_MISSING');
  need(!fs.existsSync(archive),'R6_RECOVERY_ARCHIVE_ALREADY_EXISTS');
  saveRecovery({status:'ARCHIVE_PREPARED',code:'R6_RECOVERY_INTAKE_BACKLOG_VERIFIED',
   hostOutcome:after.hostOutcome,workflowEnabled:true});
  // Capture again immediately before renaming the exact old lease. No cleanup
  // of the journal/backup/staged source, which remain evidence and rollback.
  leaseCas();
  const freshOwner=readOwner();verifyIndependent(freshOwner.owner.pid);
  const freshRunners=github('actions/runners?per_page=100').runners;
  need(dedicatedPcRunnerRows(freshRunners,{requireOnline:true})!==null,
   'R6_RECOVERY_FINAL_RUNNER_SET_UNVERIFIED');
  need(readR6HostStatus(requestId).recovery?.ownerDead===true,
   'R6_RECOVERY_ORIGINAL_OWNER_REAPPEARED');
  fs.renameSync(leaseDir,archive);
  saveRecovery({status:'RECOVERY_COMPLETED',code:'R6_RECOVERY_LEASE_ARCHIVED',
   hostOutcome:after.hostOutcome,workflowEnabled:true,leaseArchive:archive});
  retainClaim=false;
  const messageFile=path.join(recordDirPath,'host-r6-'+requestId+'.comment.json');
  writeJson(messageFile,{body:`R6 host B recovery result: RECOVERY_COMPLETED / ${after.hostOutcome}\n`+
   `ORIGINAL_REQUEST: ${requestId}\nWORKFLOW_ENABLED: true\n`+
   `LEASE_ARCHIVED: true\nPROTECTED_STATE_UNCHANGED: true\n`+
   `PC_RUN_NOT_RETRIED: true`});
  try{github('issues/'+issueNumber+'/comments','POST',messageFile);}catch{/* remote upload pending; never repeat mutation */}
  return {status:'RECOVERY_COMPLETED',code:'R6_RECOVERY_LEASE_ARCHIVED',
   requestId,hostOutcome:after.hostOutcome,workflowEnabled:true,
   protectedStateUnchanged:true,originalRequestRetried:false};
 }finally{
  if(!retainClaim){
   need(json(claimRecord).nonce===claimNonce,'R6_RECOVERY_CLAIM_OWNER_CHANGED');
   fs.unlinkSync(claimRecord);fs.rmdirSync(claimDir);
  }
 }
}

export async function command(args=process.argv.slice(2)) {
 need(args.length>=1,'MAINTENANCE_SUBCOMMAND_REQUIRED');
 const cmd=args[0],requestId=safeId(args[2]);
 if(cmd==='source-bundle-status'){
  need(args.length===3&&args[1]==='--request-id','MAINTENANCE_ARGS');
  return readSourceBundleStatus(requestId);
 }
 if(cmd==='source-bundle-apply'){
  need(args.length===5&&args[1]==='--request-id'&&args[3]==='--manifest-file',
   'MAINTENANCE_ARGS');
  try{return await applySourceBundleOnly(requestId,args[4]);}
  catch(error){
   const state=readSourceBundleStatus(requestId);
   const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'BUNDLE_B_PREFLIGHT_UNKNOWN';
   const uncertain=Boolean(state.ledger||state.backupExists||state.installLock?.held);
   return {status:uncertain?'UNKNOWN':'BLOCKED',
    code:uncertain?'BUNDLE_B_OUTCOME_UNKNOWN':code,
    firstFail:uncertain?'BUNDLE_B_OUTCOME_UNKNOWN':code,
    actualControllerSha:state.actualControllerSha};
  }
 }
 if(cmd==='r54-b-status'){
  need(args.length===3&&args[1]==='--request-id','MAINTENANCE_ARGS');
  // Status is read-only and may include a prior one-shot backup/journal.
  const backupRoot=path.join(maintenanceRoot,'ledger','R54_B_'+requestId);
  let phase=null;
  try{
   const lines=fs.readFileSync(path.join(backupRoot,'JOURNAL.jsonl'),'utf8')
    .trimEnd().split('\n');
   phase=JSON.parse(lines.at(-1)).phase;
  }catch{/* no source journal yet, or recovery read needed */}
  return {...readMaintenanceRecoveryStatus(requestId),
   writerSourceApplyEnabled:true,r54BJournalPhase:phase,
   r54BBackupExists:fs.existsSync(backupRoot)};
 }
 if(cmd==='r54-b-apply'){
  need(args.length===5&&args[1]==='--request-id'&&args[3]==='--manifest-file',
   'MAINTENANCE_ARGS');
  // Admission is still independently rechecked against the GitHub Issue and
  // installed Controller manifest. No file modifications precede this check.
  const approvedPath=path.join(maintenanceRoot,'approved',requestId+'.json');
  need(path.resolve(args[4])===path.resolve(approvedPath),'R54_B_APPROVAL_FILE_PATH');
  const pkg=json(approvedPath),issue=pkg.issue;
  need(issue?.requestId===requestId&&issue.operation===R54_B_OPERATION
   &&pkg.actor==='ansqhd5774-Choi'&&Number.isSafeInteger(pkg.issueNumber),
   'R54_B_PACKAGE_IDENTITY');
  const actual=github('issues/'+pkg.issueNumber);
  need(actual.state==='open'&&actual.title===R54_B_ISSUE_TITLE
   &&actual.user?.login==='ansqhd5774-Choi'
   &&actual.labels?.some(x=>x.name==='pc-maintenance')&&!actual.pull_request,
   'R54_B_ISSUE_CANCELED');
  const approvedIssue=validateR54BIssueEnvelope(JSON.parse(actual.body),{
   actor:actual.user.login,controlRepository});
  need(JSON.stringify(approvedIssue)===JSON.stringify(issue),'R54_B_ISSUE_IDENTITY');
  const raw=Buffer.from(pkg.manifestRawBase64??'','base64');
  validateR54BManifestRequest(approvedIssue,raw,{
   actor:pkg.actor,controlRepository,installedSha:installedManifest().installedSha});
  // The validated B Issue is the only entry. No caller-specified source,
  // Task, command, additional file, or retry parameter reaches the host.
  const result=await runR54BApprovedOneShot({requestId});
  return {...result,actualControllerSha:installedManifest().installedSha};
 }
 if(cmd==='host-r6-status'){
  need(args.length===3&&args[1]==='--request-id','MAINTENANCE_ARGS');
  return readR6HostStatus(requestId);
 }
 if(cmd==='host-r6-recover'){
  need(args.length===7&&args[1]==='--request-id'&&args[3]==='--manifest-file'
   &&args[5]==='--mode','MAINTENANCE_ARGS');
  return recoverR6HostOnly(requestId,args[4],args[6]);
 }
 if(cmd==='host-r6-apply'){
  need(args.length===5&&args[1]==='--request-id'&&args[3]==='--manifest-file','MAINTENANCE_ARGS');
  try{return await applyR6HostOnly(requestId,args[4]);}
  catch(error){
   // A failed read-only preflight occurs before a host journal/lease exists.
   // Do not turn an ambiguous partial apply into a harmless BLOCKED result.
   const state=readR6HostStatus(requestId);
   const code=/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'R6_HOST_PREFLIGHT_UNKNOWN';
   const uncertain=Boolean(state.ledger||state.backupExists||state.installLock?.held);
   let workflowEnabled=null;
   try{workflowEnabled=github('actions/workflows/pc-job.yml').state==='active';}
   catch{/* not observed; never infer from absence of an install lease */}
   return {status:uncertain?'UNKNOWN':'BLOCKED',
    code:uncertain?'R6_HOST_OUTCOME_UNKNOWN':code,
    firstFail:uncertain?'R6_HOST_OUTCOME_UNKNOWN':code,
    actualControllerSha:state.actualControllerSha,workflowEnabled};
  }
 }
 if(cmd==='status'){
  need(args.length===3&&args[1]==='--request-id','MAINTENANCE_ARGS');
  return readMaintenanceRecoveryStatus(requestId);
 }
 need(['apply','preflight'].includes(cmd)&&args.length===5&&args[1]==='--request-id'&&args[3]==='--manifest-file','MAINTENANCE_ARGS');
 let data,request,ports,preInstallOperation='loadApprovedPackage';
 try{
 data=loadApprovedPackage(requestId,args[4]);
 preInstallOperation='makePorts';({request,ports}=makePorts(data,data.issueNumber));
 // Read-only prerequisite checks before taking the shared installation lease.
 // They are repeated by validate under the lease to prevent a stale preflight
 // from granting permission to stop or switch a changed process.
 preInstallOperation='readOwner';readOwner();
 preInstallOperation='installedManifest';installedManifest();
 preInstallOperation='capturePrevalidationBaseline';await ports.capturePrevalidationBaseline();
 }catch(error){error.failureStage='PRE_INSTALL';error.failureOperation=preInstallOperation;throw error;}
 if(cmd==='preflight')return {status:'PASS',code:'PRE_INSTALL_READONLY_VERIFIED',actualControllerSha:installedManifest().installedSha,requestId,installAttempted:false};
 const installLock=acquireMaintenanceLock(maintenanceRoot,'controller-install');
 let retained=false;
 try{
  const result=await applyApprovedUpdate(request,ports);
  if(result.status==='RECOVERY_REQUIRED'){installLock.holdForRecovery();retained=true;}
  return result;
 }finally{if(!retained)installLock.release();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await command();console.log(JSON.stringify(result));if(result.status==='RECOVERY_REQUIRED')process.exitCode=2;}
 catch(error){console.log(JSON.stringify(maintenanceCliFailureReport(error)));process.exitCode=1;}
}


