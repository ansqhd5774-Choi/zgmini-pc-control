// Fixed-root operator recovery. Does not install, kill, delete leases or retry.
// First supported write: archive a dead pre-validation install lease whose
// original Controller is byte-verified and whose update never staged or paused.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const control='E:/ZGmini/automation/pc-control',root='E:/ZGmini/automation/pc-maintenance';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repository='ansqhd5774-Choi/zgmini-pc-control',gh='C:/Program Files/GitHub CLI/gh.exe';
const digest=b=>createHash('sha256').update(b).digest('hex');
export function verifyMaintenanceManifest(installed,rootDir,readBytes=fs.readFileSync){
 // Verified final pre-upgrade Windows six-file source (464 POSTFF V2).
 // A newer source must carry its seventh runtime module, even if its manifest
 // falsely shrinks to six internally consistent file hashes.
 const legacySixSource='4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4';
 const original=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs'];
 const next=[...original,'tools/source-bundle-register.mjs'];
 const files=installed?.files;
 if(installed?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'
  ||!files||typeof files!=='object'||Array.isArray(files))return false;
 const keys=Object.keys(files),expected=keys.length===6&&installed.sourceSha===legacySixSource
  ?original:keys.length===7&&/^[a-f0-9]{40}$/.test(installed.sourceSha??'')?next:null;
 if(!expected||!keys.every(p=>expected.includes(p)))return false;
 return expected.every(p=>/^[a-f0-9]{64}$/.test(files[p]??'')
  &&digest(readBytes(path.join(rootDir,p)))===files[p]);
}
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
// Operator-only, bounded evidence labels: never return raw paths, source bytes,
// Git/GitHub stderr or credentials when an inspect step fails.
export function inspectEvidenceFile(file,label,readFile=fs.readFileSync){
 need(/^[A-Z][A-Z0-9_]+$/.test(label),'RECOVERY_INVALID_EVIDENCE_LABEL');
 let bytes;
 try{bytes=readFile(file);}catch(e){
  need(false,label+(e?.code==='ENOENT'?'_MISSING':'_UNREADABLE'));
 }
 let value;
 try{value=JSON.parse(bytes);}catch{need(false,label+'_INVALID_JSON');}
 need(value!==null&&typeof value==='object'&&!Array.isArray(value),label+'_INVALID_JSON');
 return {bytes,value};
}
const inspectStep=(label,fn)=>{try{return fn();}catch(e){
 if(typeof e?.code==='string'&&/^(RECOVERY_|ROLLBACK_)[A-Z0-9_]+$/.test(e.code))throw e;
 need(false,label);
}};
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
const put=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const github=route=>inspectStep('RECOVERY_GITHUB_QUERY_UNAVAILABLE',()=>JSON.parse(execFileSync(gh,['api',`repos/${repository}/${route}`],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:3e6})));

export function classifyRecovery(s){
 const checks={
  REQUEST_IDENTITY:s.identityVerified===true,
  DEAD_INSTALL_OWNER:s.ownerAlive===false,
  PREVALIDATION_ONLY:s.ledger?.status==='RECOVERY_REQUIRED'&&s.ledger?.firstFail==='RECEIVED'
    &&s.ledger?.phase==='RECOVERY_REQUIRED'&&!s.ledger?.postIssueNumber,
  ORIGINAL_BYTES:s.controllerVerified===true&&s.actualSha===s.ledger?.installedShaBefore,
  NO_UPDATE_ARTIFACTS:s.backupExists===false&&s.backlogExists===false,
  NO_PAUSE:s.ledger?.intakePaused===false&&s.ledger?.workflowEnabled===true&&s.workflow==='active',
  RUNNERS_IDLE:s.runnerSetVerified===true&&s.runnersIdle===true&&s.otherLeaseCount===0,
  MAINTAINER_BYTES:s.maintenanceVerified===true,
 };
 const failed=Object.keys(checks).filter(k=>!checks[k]);
 return {status:failed.length?'RECOVERY_REQUIRED':'ABORT_UNTOUCHED_ELIGIBLE',
  code:failed[0]??'PREVALIDATION_ABORT_VERIFIED',checks,
  next:failed.length?'RECONCILE_FAILED_CHECKS_NO_INSTALL_OR_LOCK_CHANGE':'ARCHIVE_DEAD_LEASE_PRESERVE_ORIGINAL_REQUEST'};
}

export function archiveUntouched({root:base,requestId,ownerBytes,markerBytes,ledgerBytes,observe,isAlive=alive}){
 const dir=path.join(base,'leases/controller-install');
 const claim=path.join(base,'leases/controller-recovery');
 fs.mkdirSync(claim); // Separate atomic single-recovery reservation.
 const claimFile=path.join(claim,'owner.json'),claimNonce=randomUUID();
 // If this write fails the empty claim remains fail-closed for inspection.
 put(claimFile,{pid:process.pid,nonce:claimNonce,requestId,at:new Date().toISOString()});
 let keep=false;
 try{
  const current=()=>{
   need(fs.readFileSync(path.join(dir,'owner.json')).equals(ownerBytes)&&
    fs.readFileSync(path.join(dir,'RECOVERY_REQUIRED.json')).equals(markerBytes)&&
    fs.readFileSync(path.join(base,'ledger',requestId+'.json')).equals(ledgerBytes),'RECOVERY_EVIDENCE_CHANGED');
   need(isAlive(JSON.parse(ownerBytes).pid)===false,'RECOVERY_OWNER_NOT_DEAD');
  };
  current();
  const state=observe();need(classifyRecovery(state).status==='ABORT_UNTOUCHED_ELIGIBLE','RECOVERY_NOT_ELIGIBLE');
  const out=path.join(base,'recovery');fs.mkdirSync(out,{recursive:true});
  const id=requestId+'-'+randomUUID(),record=path.join(out,id+'.json');
  const archive=path.join(out,id+'.lease');
  const result={schema:'ZGMINI_PC_RECOVERY_RESULT_V1',requestId,status:'PREPARED',
   code:'PREVALIDATION_ABORT_PREPARED',actualControllerSha:state.actualSha,
   originalLedgerSha256:digest(ledgerBytes),ownerSha256:digest(ownerBytes),markerSha256:digest(markerBytes),
   archiveName:path.basename(archive),at:new Date().toISOString(),controllerChanged:false,
   originalRequestRetried:false,coreDbD1Writes:0};
  put(record,result);
  current();
  // Preserve the whole lease and original request. No unlink of recovery marker.
  fs.renameSync(dir,archive);keep=true;
  const complete={...result,status:'ABORTED_UNTOUCHED',code:'DEAD_PREVALIDATION_LEASE_ARCHIVED',
   next:'VERIFY_EXISTING_WATCHDOG_AND_SUPERVISOR_THEN_FIX_PREFLIGHT_BEFORE_NEW_APPROVED_REQUEST'};
  put(path.join(out,id+'.complete.json'),complete);
  keep=false;return complete;
 }finally{if(!keep){need(json(claimFile).nonce===claimNonce,'RECOVERY_CLAIM_CHANGED');fs.unlinkSync(claimFile);fs.rmdirSync(claim);}}
}

export function verifyOperatingRunners(rows){
 const names=Array.from({length:6},(_,i)=>'zgmini-pc-0'+(i+1));
 if(!Array.isArray(rows))return {runnerSetVerified:false,runnersIdle:false};
 const operating=rows.filter(x=>names.includes(x?.name));
 return {runnerSetVerified:operating.length===6&&names.every(n=>operating.filter(x=>x.name===n&&x.status==='online').length===1),
  runnersIdle:operating.length===6&&operating.every(x=>x.busy===false)};
}

// A GitHub runner-list 403 is an unknown observation, not proof of offline
// runners. Preserve read-only ledger diagnostics but fail closed for recovery.
export function inspectOperatingRunners(query){
 let result;
 try{result=query();}catch{return {
  ...verifyOperatingRunners(null),runnerQueryStatus:'UNAVAILABLE'};}
 if(!Array.isArray(result?.runners))return {
  ...verifyOperatingRunners(null),runnerQueryStatus:'UNVERIFIED'};
 return {...verifyOperatingRunners(result.runners),runnerQueryStatus:'VERIFIED'};
}

function observe(requestId){
 const ledgerFile=path.join(root,'ledger',requestId+'.json');
 const {bytes:ledgerBytes,value:ledger}=inspectEvidenceFile(ledgerFile,'RECOVERY_REQUEST_LEDGER');
 const dir=path.join(root,'leases/controller-install');
 const {bytes:ownerBytes,value:owner}=inspectEvidenceFile(path.join(dir,'owner.json'),'RECOVERY_INSTALL_OWNER');
 const {bytes:markerBytes,value:marker}=inspectEvidenceFile(path.join(dir,'RECOVERY_REQUIRED.json'),'RECOVERY_INSTALL_MARKER');
 const host=inspectEvidenceFile(path.join(control,'host.json'),'RECOVERY_CONTROLLER_HOST').value;
 const validFile=p=>/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p);
 const controllerVerified=/^[a-f0-9]{40}$/.test(host.controllerSourceSha??'')&&Object.keys(host.controllerFiles??{}).length>=5&&
  Object.entries(host.controllerFiles).every(([p,h])=>validFile(p)&&/^[a-f0-9]{64}$/.test(h)&&inspectStep('RECOVERY_CONTROLLER_FILES_UNREADABLE',()=>digest(fs.readFileSync(path.join(control,p)))===h));
 const installed=inspectEvidenceFile(path.join(root,'MAINTENANCE_INSTALL.json'),'RECOVERY_MAINTENANCE_MANIFEST').value;
 const maintenanceVerified=inspectStep('RECOVERY_MAINTENANCE_FILES_UNREADABLE',()=>verifyMaintenanceManifest(installed,root));
 const issue=github('issues/'+ledger.issueNumber);let body;try{body=JSON.parse(issue.body);}catch{}
 const identityVerified=ledger.requestId===requestId&&Number.isSafeInteger(owner.pid)&&owner.pid>0&&
  /^[0-9a-f-]{36}$/.test(owner.nonce??'')&&marker.nonce===owner.nonce&&marker.requestOwnerPid===owner.pid&&
  Number.isFinite(Date.parse(ledger.updatedAt))&&Number.isFinite(Date.parse(marker.at))&&
  Math.abs(Date.parse(marker.at)-Date.parse(ledger.updatedAt))<5000&&
  Number.isFinite(Date.parse(owner.at))&&Date.parse(owner.at)<=Date.parse(marker.at)&&
  issue.user?.login==='ansqhd5774-Choi'&&issue.title==='pc-controller-update'&&
  body?.requestId===requestId&&body?.targetControllerSha===ledger.targetSha;
 const operatingRunners=inspectOperatingRunners(()=>github('actions/runners?per_page=100'));
 const state={ledger,identityVerified,ownerAlive:alive(owner.pid),actualSha:host.controllerSourceSha,controllerVerified,
  maintenanceVerified,backupExists:fs.existsSync(path.join(control,'backups','controller-update-'+requestId)),
  backlogExists:fs.existsSync(path.join(root,'backlog',requestId+'.json')),
  workflow:github('actions/workflows/pc-job.yml').state,
  ...operatingRunners,
  otherLeaseCount:inspectStep('RECOVERY_CONTROL_LEASES_UNREADABLE',()=>fs.readdirSync(path.join(control,'leases')).filter(x=>x!=='supervisor'&&!x.startsWith('supervisor.dead-')).length)};
 return {state,ownerBytes,markerBytes,ledgerBytes};
}


// Separate approved installed-state reconciliation, for a historical
// POSTCHECK_OUTCOME_UNKNOWN after a new Controller is serving verified A jobs.
// Preserve the original update journal as UNKNOWN: never report a postcheck
// that never ran, never reinstall, and never silently unlock a lease.
const REC2960='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
const TARGET2960='b9a423cf38d0967d6ed336912a66433f79502d3d';
const proof2960={issueNumber:2982,runId:45186420113,jobId:137733094098,
 runnerName:'zgmini-pc-04',resultPath:'results/45186420113-1-seat-4.json'};
const REC3409='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
const TARGET3409='6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4';
const REC3516='pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1';
const TARGET3516='83679b013ac9a9820331d93311ec97e572b18e13';
// This is the original independent operating read, never the missing #3519.
const proof3516={issueNumber:3528,runId:45579963186,jobId:139087219551,
 runnerName:'zgmini-pc-03',resultPath:'results/pc-process-inventory-45579963186-1-operating.json'};
const proof3409={issueNumber:3438,runId:45457196689,jobId:138669741465,
 runnerName:'zgmini-pc-03',resultPath:'results/45457196689-1-seat-3.json'};
// Exact, fixed historical contracts only. This table grants no execution
// right: the independent Windows operator, committed approved manifest, live
// seven-file CAS, protected baseline and A receipt checks remain mandatory.
export function fixedInstalledRecoveryCase(id){
 if(id===REC2960)return Object.freeze({issueNumber:2960,postIssueNumber:2965,
  targetSha:TARGET2960,postSourceBranch:'main',
  postSourceSha:'2b69dcbc7ade75815e0c152fd0e2112ddaa5b333',
  proofSourceBranch:'main',
  proofSourceSha:'2b69dcbc7ade75815e0c152fd0e2112ddaa5b333',
  proof:proof2960,allowUnchangedBaseline:false});
 if(id===REC3409)return Object.freeze({issueNumber:3409,postIssueNumber:3410,
  targetSha:TARGET3409,postSourceBranch:'codex/employment-1y-reader-r1',
  postSourceSha:'50769db23ac6a5f55203855f5231d12dc0595bb4',
  proofSourceBranch:'main',
  proofSourceSha:'8410a857d2d8cd47beae811152a676c6eee07a75',
  proof:proof3409,allowUnchangedBaseline:true});
 if(id===REC3516)return Object.freeze({issueNumber:3516,postIssueNumber:3519,
  targetSha:TARGET3516,postSourceBranch:'main',
  postSourceSha:'b6049aac81b3442a58b08050ee138921f87a09e6',
  // Independently attested readonly run on the already-installed Controller.
  // Unlike #3409 this is an operating process inventory, NOT a core-status run.
  proofType:'OPERATING_PROCESS_INVENTORY',
  proofSourceBranch:'main',
  proofSourceSha:'8bd11c9a396e19e7881ce7d21cd52c3cb520f6e2',
  proof:proof3516,allowUnchangedBaseline:true});
 return null;
}
// #3409's original recovery approval and its Writer preimage remain immutable.
const W04_3409_ORIGINAL_SOURCE='fcb098d20fb9a6c48f371786c69f7f1fdf5bc34a';
const W04_3409_POST_WRITER_APPROVAL='approvals/maintenance-recoveries/'+REC3409+'.post-writer.json';
const W04_3409_ORIGINAL_APPROVAL='approvals/maintenance-recoveries/'+REC3409+'.installed.json';
const W04_WRITER_B_APPROVAL='approvals/writer-updates/w04-eta538-scheduled-release-safe-drain-pending-20261125.json';
const W04_WRITER_B_RECEIPT='results/writer-b-source-install-821f15bd-9709-45bf-b7e3-8b2ce33ae978.json';
const W04_WRITER_B_ID='821f15bd-9709-45bf-b7e3-8b2ce33ae978';
const W04_WRITER_B_SHA='d8ac245003e7b8e006c2345382d5c639c6d5f18b';
const W04_WRITER_B_MANIFEST_SHA='4102978f3c365d43bf0126f5eae6b885bec0ff523b8558a97345c5bcadb5eea0';
const W04_WRITER_B_RUN=45467625998;

// The earlier, immutable V1 approval must remain binding for 6/7 CAS files.
// Only the already approved W04 Writer B config.source transition may differ.
export function validateW043409PostWriterBridge({
 approval,oldApprovalRaw,writerManifestRaw,writerReceiptRaw,writerIssue,writerBytes
}) {
 const old=JSON.parse(oldApprovalRaw), writer=JSON.parse(writerManifestRaw);
 const receipt=JSON.parse(writerReceiptRaw), current=JSON.parse(writerBytes);
 const expectedKeys=['ledgerSha256','ownerSha256','markerSha256','backlogSha256',
  'snapshotSha256','protectionSha256','writerSha256'];
 need(approval?.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V2'&&
  approval.approved===true&&approval.operation==='RECONCILE_INSTALLED'&&
  approval.requestId===REC3409&&approval.issueNumber===3409&&
  /^[a-f0-9]{40}$/.test(approval.sourceSha??'')&&
  approval.sourceSha!==W04_3409_ORIGINAL_SOURCE&&
  approval.targetControllerSha===TARGET3409&&
  old?.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'&&
  old.approved===true&&old.operation==='RECONCILE_INSTALLED'&&
  old.requestId===REC3409&&old.sourceSha===W04_3409_ORIGINAL_SOURCE&&
  old.targetControllerSha===TARGET3409&&
  approval.previousRecoveryApprovalSha256===digest(oldApprovalRaw)&&
  JSON.stringify(approval.proof)===JSON.stringify(old.proof),
  'W04_POSTWRITER_ORIGINAL_APPROVAL_DRIFT');
 need(approval.casDigests&&old.casDigests&&
  Object.keys(approval.casDigests).length===7&&
  expectedKeys.every(k=>/^[a-f0-9]{64}$/.test(approval.casDigests[k]??''))&&
  expectedKeys.filter(k=>k!=='writerSha256').every(k=>
   approval.casDigests[k]===old.casDigests[k])&&
  approval.casDigests.writerSha256!==old.casDigests.writerSha256&&
  old.approvedCurrentWriterConfigSha256===old.casDigests.writerSha256&&
  approval.approvedCurrentWriterConfigSha256===approval.casDigests.writerSha256&&
  approval.casDigests.writerSha256===digest(writerBytes),
  'W04_POSTWRITER_CAS_SCOPE_CHANGED');
 let issueBody;try{issueBody=JSON.parse(writerIssue?.body);}catch{}
 need(writerIssue?.number===3461&&writerIssue?.title==='pc-writer-source-install'&&
  writerIssue?.user?.login==='ansqhd5774-Choi'&&
  writerIssue?.labels?.some(l=>l.name==='pc-writer-b-install')&&
  issueBody?.schema==='ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1'&&
  issueBody.requestId===W04_WRITER_B_ID&&
  issueBody.operation==='pc-writer-source-install'&&
  issueBody.controlRepository===repository&&
  issueBody.approvalManifestPath===W04_WRITER_B_APPROVAL&&
  issueBody.approvalManifestSha256===W04_WRITER_B_MANIFEST_SHA&&
  digest(writerManifestRaw)===W04_WRITER_B_MANIFEST_SHA&&
  writer.schema==='ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1'&&
  writer.status==='APPROVED_B'&&
  writer.scope==='PC_WRITER_APPROVED_FILE_OVERLAY_ONLY'&&
  writer.configPath==='E:\\ZGmini\\data\\pc-writer\\config.json'&&
  writer.baseConfigSourceSha===writer.baseHead&&
  receipt.schema==='ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1'&&
  receipt.requestId===W04_WRITER_B_ID&&
  receipt.runId===String(W04_WRITER_B_RUN)&&
  receipt.status==='WRITER_B_INSTALLED_VERIFIED'&&
  receipt.code==='WRITER_B_INSTALL_VERIFIED'&&
  receipt.mode==='LOCAL_OVERLAY'&&receipt.localOnly===true&&
  receipt.candidateSourceSha===writer.candidateSourceSha&&
  receipt.manifestSha256===W04_WRITER_B_MANIFEST_SHA&&
  receipt.sourceSha===W04_WRITER_B_SHA&&
  current?.source===W04_WRITER_B_SHA&&
  Array.isArray(receipt.changedPaths)&&
  receipt.changedPaths.length===writer.files.length&&
  writer.files.every(f=>receipt.changedPaths.includes(f.path))&&
  approval.writerBReceiptSha256===digest(writerReceiptRaw),
  'W04_POSTWRITER_B_AUTHORIZATION_UNVERIFIED');
 return true;
}

// #2960 remains unchanged. #3409 may preserve an independently approved
// Writer-only transition ONLY after verifying the original B installation.
export function permittedInstalledRecoveryProtection(fixed,choice,writerBVerified=false){
 return choice?.allowed===true&&(
  fixed?.allowUnchangedBaseline===true?
   choice.code==='RECOVERY_ORIGINAL_PROTECTION_UNCHANGED'||
    (writerBVerified===true&&choice.preservedWriterConfig===true):
   fixed?.allowUnchangedBaseline===false&&choice.preservedWriterConfig===true);
}
export function classifyInstalledReconciliationProof(proof){
 const checks={
  ORIGINAL_LEDGER:proof?.originalLedger===true,
  EXACT_OWNER_AND_DEAD:proof?.ownerAndMarker===true&&proof?.ownerDead===true,
  CURRENT_TARGET_BYTES:proof?.controllerVerified===true,
  MAINTAINER_BYTES:proof?.maintenanceVerified===true,
  ACTIVE_WORKFLOW:proof?.workflowActive===true,
  BACKLOG_RECONCILED:proof?.backlogReconciled===true,
  CURRENT_SUPERVISOR:proof?.supervisorVerified===true,
  CURRENT_PROTECTION:proof?.protectedWriterPreserved===true,
  EXACT_SOURCE_AND_CAS:proof?.sourceAndCasVerified===true,
  CURRENT_A_SUCCESS:proof?.currentAReceiptVerified===true,
  INDEPENDENT_OPERATOR:proof?.operatorVerified===true,
 };
 const first=Object.keys(checks).find(k=>!checks[k]);
 return {status:first?'RECOVERY_REQUIRED':'INSTALLED_RECONCILIATION_ELIGIBLE',
  code:first??'INSTALLED_RECONCILIATION_PREFLIGHT_VERIFIED',checks,
  originalPostcheckVerified:false,originalLedgerPreserved:true};
}
function verifyInstalledRecoverySupervisor(targetSha){
 const owner=json(path.join(control,'leases/supervisor/owner.json'));
 const status=json(path.join(control,'SUPERVISOR_STATUS.json'));
 const time=Date.parse(status?.at??'');
 if(owner?.pid!==status?.pid||!Number.isSafeInteger(owner?.pid)||
  owner.pid<=0||status?.sourceSha!==targetSha||
  status?.mode!=='LISTENING'||!Array.isArray(status?.children)||
  status.children.length!==6||!Number.isFinite(time)||
  Date.now()-time<0||Date.now()-time>=45000)return false;
 if(alive(owner.pid)!==true)return false;
 return status.children.every(child=>child?.alive===true&&
  Number.isSafeInteger(child.pid)&&child.pid>0&&alive(child.pid)===true);
}
async function reconcileInstalledRecoveryFixed({id,source,g,before}){
 const fixed=fixedInstalledRecoveryCase(id);
 need(fixed!==null,'INSTALLED_RECOVERY_SCOPE_NOT_ALLOWED');
 const targetSha=fixed.targetSha,proofCase=fixed.proof;
 const {verifyRecoveryOperator,protectedSnapshot,loadApprovedPackage}=await import('./update.mjs');
 const {selectPreservedRecoveryProtection}=await import('./maintenance-contract.mjs');
 const {readFixedReadonlyBytes}=await import('../controller/fixed-readonly-bytes.mjs');
 const postWriterRequested=id===REC3409&&source!==W04_3409_ORIGINAL_SOURCE;
 const rel=postWriterRequested?W04_3409_POST_WRITER_APPROVAL:
  'approvals/maintenance-recoveries/'+id+'.installed.json';
 const raw=inspectStep('INSTALLED_RECOVERY_APPROVAL_MISSING',()=>fs.readFileSync(path.join(repo,rel)));
 need(digest(raw)===digest(g(['show','HEAD:'+rel],'INSTALLED_RECOVERY_APPROVAL_NOT_COMMITTED')),
  'INSTALLED_RECOVERY_APPROVAL_DRIFT');
 let approval;try{approval=JSON.parse(raw);}catch{need(false,'INSTALLED_RECOVERY_APPROVAL_INVALID');}
 const exactPaths=['tools/maintenance-recovery.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs'];
 need(approval?.schema===(postWriterRequested?
  'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V2':
  'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1')&&
  approval.approved===true&&approval.operation==='RECONCILE_INSTALLED'&&
  approval.requestId===id&&approval.issueNumber===fixed.issueNumber&&
  approval.sourceSha===source&&approval.targetControllerSha===targetSha&&
  /^[a-f0-9]{64}$/.test(approval.approvedCurrentWriterConfigSha256??'')&&
  Array.isArray(approval.files)&&approval.files.length===exactPaths.length&&
  exactPaths.every(p=>approval.files.filter(x=>x?.path===p).length===1),
  'INSTALLED_RECOVERY_APPROVAL_SCOPE_INVALID');
 for(const file of approval.files){
  need(exactPaths.includes(file.path)&&/^[a-f0-9]{64}$/.test(file.sha256??'')&&
   digest(g(['show',source+':'+file.path],'INSTALLED_RECOVERY_SOURCE_UNAVAILABLE'))===file.sha256&&
   digest(fs.readFileSync(path.join(repo,file.path)))===file.sha256,
   'INSTALLED_RECOVERY_SOURCE_DRIFT');
 }
 const fileSpecs={
  ledger:[path.join(root,'ledger',id+'.json'),root,131072],
  owner:[path.join(root,'leases/controller-install/owner.json'),root,4096],
  marker:[path.join(root,'leases/controller-install/RECOVERY_REQUIRED.json'),root,4096],
  backlog:[path.join(root,'backlog',id+'.json'),root,131072],
  snapshot:[path.join(control,'backups/controller-update-'+id,'snapshot/host.json'),control,65536],
  protection:[path.join(control,'backups/controller-update-'+id,'PROTECTED_BEFORE.json'),control,65536],
  writer:['E:/ZGmini/data/pc-writer/config.json','E:/ZGmini/data',131072],
 };
 const bytes={};
 const take=()=>{
  const result={};
  for(const [k,[file,verifiedRoot,maxBytes]] of Object.entries(fileSpecs)){
   const part=readFixedReadonlyBytes(file,{verifiedRoot,minBytes:1,maxBytes});
   need(part?.ok===true,'INSTALLED_RECOVERY_'+k.toUpperCase()+'_UNVERIFIED');
   result[k]=part.bytes;
  }
  return result;
 };
 Object.assign(bytes,take());
 const cas=Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k+'Sha256',digest(b)]));
 need(approval.casDigests&&Object.keys(approval.casDigests).length===7&&
  Object.keys(cas).every(k=>approval.casDigests[k]===cas[k])&&
  approval.approvedCurrentWriterConfigSha256===cas.writerSha256,
  'INSTALLED_RECOVERY_CAS_CHANGED');
 let postWriterVerified=false;
 if(postWriterRequested){
  const readPinned=rel=>{
   // Evidence is a historical Git object, not an executable local file.
   // Windows checkout may CRLF-convert writer-updates/results JSON while
   // the pinned SHA256 authorizes the exact committed LF bytes.
   const bytes=g(['show','HEAD:'+rel],'W04_POSTWRITER_EVIDENCE_NOT_COMMITTED');
   if(rel===W04_3409_ORIGINAL_APPROVAL){
    const local=inspectStep('W04_POSTWRITER_ORIGINAL_APPROVAL_MISSING',
     ()=>fs.readFileSync(path.join(repo,rel)));
    need(digest(local)===digest(bytes),'W04_POSTWRITER_ORIGINAL_APPROVAL_DRIFT');
   }
   return bytes;
  };
  postWriterVerified=validateW043409PostWriterBridge({
   approval,
   oldApprovalRaw:readPinned(W04_3409_ORIGINAL_APPROVAL),
   writerManifestRaw:readPinned(W04_WRITER_B_APPROVAL),
   writerReceiptRaw:readPinned(W04_WRITER_B_RECEIPT),
   writerIssue:github('issues/3461'),
   writerBytes:bytes.writer
  });
 }

 // The prior B scope and its original postcheck source are authoritative;
 // a successful independent A result cannot redefine that approved contract.
 const originalPackage=loadApprovedPackage(id,path.join(root,'approved',id+'.json'),
  {recovery:true});
 need(originalPackage.issue.requestId===id&&
  originalPackage.manifest.targetSha===targetSha&&
  originalPackage.manifest.postOperation==='core-status'&&
  originalPackage.manifest.postSourceBranch===fixed.postSourceBranch&&
  originalPackage.manifest.postSourceSha===fixed.postSourceSha,
  'INSTALLED_RECOVERY_ORIGINAL_APPROVAL_UNVERIFIED');
 const ledger=JSON.parse(bytes.ledger),owner=JSON.parse(bytes.owner);
 const marker=JSON.parse(bytes.marker),backlog=JSON.parse(bytes.backlog);
 const baseline=JSON.parse(bytes.protection);
 const original=ledger.requestId===id&&ledger.issueNumber===fixed.issueNumber&&
  ledger.status==='RECOVERY_REQUIRED'&&ledger.phase==='RECOVERY_REQUIRED'&&
  ledger.firstFail==='POSTCHECK_PENDING'&&
  ledger.code==='POSTCHECK_OUTCOME_UNKNOWN'&&ledger.postIssueNumber===fixed.postIssueNumber&&
  ledger.targetSha===targetSha;
 const chronology=Number.isFinite(Date.parse(ledger.updatedAt))&&
  Number.isFinite(Date.parse(marker.at))&&
  Number.isFinite(Date.parse(owner.at))&&
  Date.parse(owner.at)<=Date.parse(marker.at)&&
  Math.abs(Date.parse(marker.at)-Date.parse(ledger.updatedAt))<5000;
 const ownerMatch=Number.isSafeInteger(owner.pid)&&owner.pid>0&&
  /^[0-9a-f-]{36}$/.test(owner.nonce??'')&&
  owner.pid===marker.requestOwnerPid&&owner.nonce===marker.nonce&&chronology;
 const pending=Array.isArray(backlog.windows)&&backlog.windows.length>=1&&
  backlog.windows.every(w=>typeof w.pausedAt==='string'&&
   typeof w.resumedAt==='string'&&Number.isFinite(Date.parse(w.resumedAt))&&
   Date.parse(w.resumedAt)>=Date.parse(w.pausedAt))&&
  backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&backlog.requestId===id&&
  backlog.replays!==null&&typeof backlog.replays==='object'&&
  !Array.isArray(backlog.replays)&&Object.values(backlog.replays).every(
   item=>['DONE','SKIPPED_RESULT_PRESENT'].includes(item?.status));
 const protectedChoice=selectPreservedRecoveryProtection(baseline,
  protectedSnapshot(),{approvedCurrentWriterConfigSha256:approval.approvedCurrentWriterConfigSha256});
 const post=github('issues/'+fixed.postIssueNumber);
 let postBody;try{postBody=JSON.parse(post.body);}catch{}
 const postExact=post.number===fixed.postIssueNumber&&post.title==='PC Update '+id+' postcheck'&&
  post.user?.login==='ansqhd5774-Choi'&&
  post.labels?.some(l=>l.name==='pc-job')&&
  postBody?.schema==='ZGMINI_PC_JOB_V1'&&
  postBody.requestId===id+'-postcheck'&&
  postBody.operation==='core-status'&&
  postBody.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  postBody.sourceBranch===fixed.postSourceBranch&&
  postBody.sourceSha===fixed.postSourceSha;
 const fixedProof=approval.proof;
 need(fixedProof&&Object.keys(proofCase).length+1===Object.keys(fixedProof).length&&
  Object.keys(proofCase).every(k=>fixedProof[k]===proofCase[k])&&
  /^[a-f0-9]{64}$/.test(fixedProof.resultSha256??''),
  'INSTALLED_RECOVERY_A_PROOF_SCOPE_INVALID');
 // resultSha256 is an additional pinned field, not a selectable path.
 const rcpt=g(['show','HEAD:'+proofCase.resultPath],'INSTALLED_RECOVERY_A_RESULT_MISSING');
 need(digest(rcpt)===fixedProof.resultSha256,'INSTALLED_RECOVERY_A_RESULT_DRIFT');
 const receipt=JSON.parse(rcpt);
 // Original postcheck (#3410/#2965) and the later successful independent A
 // are different requests. Pin and verify both; never equate their source SHAs.
 const evidenceIssue=github('issues/'+proofCase.issueNumber);
 let evidenceBody;try{evidenceBody=JSON.parse(evidenceIssue.body);}catch{}
 const is3516=fixed.proofType==='OPERATING_PROCESS_INVENTORY';
 // An independently emitted inventory receipt is narrowly permitted for
 // #3516 only. It cannot impersonate the missing original #3519 postcheck.
 const proofIssueExact=is3516?(
  evidenceIssue.number===3528&&evidenceIssue.title==='pc-process-inventory-readonly'&&
  evidenceIssue.user?.login==='ansqhd5774-Choi'&&
  evidenceBody?.schema==='ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1'&&
  evidenceBody.operation==='process-inventory-readonly'&&
  evidenceBody.role==='operating'&&
  evidenceBody.probe==='w04-3516-maintenance-status-readonly'&&
  evidenceBody.requestId===receipt.requestId
 ):(
  evidenceIssue.number===proofCase.issueNumber&&
  evidenceIssue.title==='pc-job'&&
  evidenceIssue.user?.login==='ansqhd5774-Choi'&&
  evidenceIssue.labels?.some(l=>l.name==='pc-job')&&
  evidenceBody?.schema==='ZGMINI_PC_JOB_V1'&&
  evidenceBody.operation==='core-status'&&
  evidenceBody.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  evidenceBody.sourceBranch===fixed.proofSourceBranch&&
  evidenceBody.sourceSha===fixed.proofSourceSha&&
  evidenceBody.requestId===receipt.requestId
 );
 const run=github('actions/runs/'+proofCase.runId);
 const job=github('actions/jobs/'+proofCase.jobId);
 const expectedStep=is3516?'Collect read-only runtime process snapshot on existing operating PC':
  'Execute fixed host allowlist entry';
 const step=job.steps?.filter(s=>s.name===expectedStep);
 const commonSuccess=postExact&&proofIssueExact&&run?.id===proofCase.runId&&
  run.event==='issues'&&run.status==='completed'&&run.conclusion==='success'&&
  job?.id===proofCase.jobId&&job.run_id===run.id&&
  job.runner_name===proofCase.runnerName&&
  job.status==='completed'&&job.conclusion==='success'&&
  Array.isArray(step)&&step.length===1&&step[0].conclusion==='success'&&
  Number.isFinite(Date.parse(receipt.observedAtUtc??receipt.finishedAt))&&
  Date.parse(receipt.observedAtUtc??receipt.finishedAt)>Date.parse(ledger.updatedAt);
 const status3516=receipt.w043516MaintenanceStatus;
 const inventoryVerified=is3516&&
  run.head_sha===fixed.proofSourceSha&&
  run.path==='.github/workflows/pc-process-inventory-readonly.yml'&&
  run.display_title==='pc-process-inventory-readonly'&&
  job.name==='operating-process-snapshot'&&
  receipt.schema==='ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1'&&
  receipt.issueNumber===proofCase.issueNumber&&
  receipt.runId===String(proofCase.runId)&&
  receipt.attempt==='1'&&receipt.role==='operating'&&
  receipt.status==='PASS'&&receipt.code==='W04_3516_STATUS_OBSERVED'&&
  receipt.operationalWrites===0&&receipt.providerCalls===0&&
  receipt.d1Writes===0&&receipt.automaticRetries===0&&
  status3516?.requestId===id&&status3516.actualControllerSha===targetSha&&
  status3516.workflowState==='active'&&
  status3516?.historicalRequest?.status==='RECOVERY_REQUIRED'&&
  status3516.historicalRequest.code==='POSTCHECK_OUTCOME_UNKNOWN'&&
  status3516.historicalRequest.postIssueNumber===fixed.postIssueNumber&&
  status3516.protectedStateUnchanged===true&&
  status3516.protectedDifferenceClass==='UNCHANGED'&&
  status3516?.recoveryCas?.status==='LINEAGE_CORRELATED'&&
  status3516.recoveryCas.originalLedgerMatches===true&&
  status3516.recoveryCas.ownerMarkerMatches===true&&
  status3516.recoveryCas.recoveryTimelineMatches===true&&
  status3516.recoveryCas.ownerAlive===false&&
  status3516.recoveryCas.recoveryEligible===false&&
  Object.keys(status3516.recoveryCas.casDigests??{}).length===7&&
  Object.keys(cas).every(k=>
   status3516.recoveryCas.casDigests[k]===cas[k]);
 const coreVerified=!is3516&&
  job.name==='approved-pc-job'&&
  receipt.schema==='ZGMINI_PC_RESULT_V1'&&receipt.status==='PASS'&&
  receipt.code==='CORE_READONLY_DIAGNOSIS'&&receipt.operation==='core-status'&&
  receipt.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  receipt.requestedSourceSha===fixed.proofSourceSha&&
  receipt.sourceBranch===fixed.proofSourceBranch&&
  receipt.actualExecutionSha===targetSha&&
  receipt.protectedStateUnchanged===true&&receipt.providerCalls===0&&
  receipt.d1Writes===0&&receipt.sqliteOpened===false;
 const success=commonSuccess&&(inventoryVerified||coreVerified);
 // An independent inventory is read-only evidence, never original postcheck
 // PASS. All existing live-owner, Supervisor, CAS and protection checks below
 // are still required independently immediately before lease archive.
 // Existing maintainer source/issue/Controller path already validated by
 // the original independent inspection; never infer six Runner API states
 // from a 403 or substitute new A success for the missing #2965 result.
 verifyRecoveryOperator();
 const proof={
  originalLedger:original&&before.state.identityVerified===true,
  ownerAndMarker:ownerMatch&&before.state.identityVerified===true&&
   before.ownerBytes.equals(bytes.owner)&&before.markerBytes.equals(bytes.marker),
  ownerDead:before.state.ownerAlive===false&&alive(owner.pid)===false,
  controllerVerified:before.state.controllerVerified===true&&
   before.state.actualSha===targetSha,
  maintenanceVerified:before.state.maintenanceVerified===true,
  workflowActive:before.state.workflow==='active',
  backlogReconciled:pending,
  supervisorVerified:verifyInstalledRecoverySupervisor(targetSha),
  protectedWriterPreserved:permittedInstalledRecoveryProtection(fixed,protectedChoice,postWriterVerified),
  sourceAndCasVerified:true,currentAReceiptVerified:success,
  operatorVerified:true
 };
 const verdict=classifyInstalledReconciliationProof(proof);
 need(verdict.status==='INSTALLED_RECONCILIATION_ELIGIBLE',verdict.code);
 const claim=path.join(root,'leases/controller-recovery');
 const leaseDir=path.join(root,'leases/controller-install');
 const leaseStat=fs.lstatSync(leaseDir);
 need(leaseStat.isDirectory()&&!leaseStat.isSymbolicLink(),
  'INSTALLED_RECOVERY_LEASE_DIRECTORY_UNSAFE');
 need(!fs.existsSync(claim),'INSTALLED_RECOVERY_OTHER_CLAIM_ACTIVE');
 fs.mkdirSync(claim);
 const nonce=randomUUID(),claimFile=path.join(claim,'owner.json');
 let retain=true;
 fs.writeFileSync(claimFile,JSON.stringify({pid:process.pid,nonce,requestId:id})+'\n',
  {flag:'wx',mode:0o600});
 const recoveryDir=path.join(root,'recovery');
 fs.mkdirSync(recoveryDir,{recursive:true});
 const recoveryStat=fs.lstatSync(recoveryDir);
 need(recoveryStat.isDirectory()&&!recoveryStat.isSymbolicLink(),
  'INSTALLED_RECOVERY_ARCHIVE_DIRECTORY_UNSAFE');
 const stem=id+'-installed-'+nonce,record=path.join(recoveryDir,stem+'.json');
 const archive=path.join(recoveryDir,stem+'.lease');
 const prepared={schema:'ZGMINI_PC_INSTALLED_RECOVERY_RESULT_V1',
  requestId:id,status:'PREPARED',code:'INSTALLED_RECOVERY_ARCHIVE_PREPARED',
  historicalPostcheck:'OUTCOME_UNKNOWN',historicalLedgerPreserved:true,
  installedSha:targetSha,sourceSha:source,originalRequestRetried:false,
  runnerApiSetVerified:false,controllerChanged:false,workflowChanged:false,
  writerChanged:false,dbD1Writes:0,casDigests:cas};
 try{
  const now=take();
  need(Object.keys(now).every(k=>bytes[k].equals(now[k]))&&
   before.state.ownerAlive===false&&alive(owner.pid)===false&&
   verifyInstalledRecoverySupervisor(targetSha)&&
   permittedInstalledRecoveryProtection(fixed,
    selectPreservedRecoveryProtection(baseline,protectedSnapshot(),
     {approvedCurrentWriterConfigSha256:approval.approvedCurrentWriterConfigSha256}),
    postWriterVerified),
   'INSTALLED_RECOVERY_PREARCHIVE_CAS_DRIFT');
  // A fresh independent runtime+workflow readback is required at the exact
  // archive boundary. The seven-file CAS alone cannot prove live Controller
  // files or the GitHub intake did not change since initial inspection.
  const live=observe(id);
  need(live.state.identityVerified===true&&
   live.state.controllerVerified===true&&
   live.state.actualSha===targetSha&&
   live.state.maintenanceVerified===true&&
   live.state.ownerAlive===false&&
   live.state.workflow==='active'&&
   live.ledgerBytes.equals(bytes.ledger)&&
   live.ownerBytes.equals(bytes.owner)&&
   live.markerBytes.equals(bytes.marker),
   'INSTALLED_RECOVERY_FINAL_RUNTIME_DRIFT');
  // Commit the audit record first: a crash here leaves an inspectable claim,
  // not a synthetic success. The original ledger is never changed.
  fs.writeFileSync(record,JSON.stringify(prepared,null,2)+'\n',
   {flag:'wx',mode:0o600});
  fs.renameSync(leaseDir,archive);
  need(fs.readFileSync(path.join(archive,'owner.json')).equals(bytes.owner)&&
   fs.readFileSync(path.join(archive,'RECOVERY_REQUIRED.json')).equals(bytes.marker)&&
   !fs.existsSync(path.join(root,'leases/controller-install')),
   'INSTALLED_RECOVERY_ARCHIVE_READBACK_FAILED');
  const result={...prepared,status:'RECOVERED_INSTALLED_STATE',
   code:'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
   leaseArchived:true,archivedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(recoveryDir,stem+'.complete.json'),
   JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  retain=false;
  return result;
 }finally{
  if(!retain){
   need(json(claimFile).nonce===nonce,'INSTALLED_RECOVERY_CLAIM_CHANGED');
   fs.unlinkSync(claimFile);fs.rmdirSync(claim);
  }
 }
}
export function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'RECOVERY_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===5&&['inspect','abort-untouched','reconcile-installed'].includes(args[0])&&args[1]==='--request-id'&&args[3]==='--source-sha', 'RECOVERY_USAGE');
 const [mode,,id,,source]=args;
 need(/^pc-[a-z0-9-]{8,76}$/.test(id)&&/^[a-f0-9]{40}$/.test(source),'RECOVERY_IDENTITY_FORMAT');
 const g=(args,label)=>inspectStep(label,()=>execFileSync('git',args,{cwd:repo,windowsHide:true,maxBuffer:4e6}));
 g(['merge-base','--is-ancestor',source,'HEAD'],'RECOVERY_SOURCE_ANCESTRY_UNVERIFIED');
 const pinned=g(['show',source+':tools/maintenance-recovery.mjs'],'RECOVERY_PINNED_TOOL_UNAVAILABLE');
 const toolBytes=inspectStep('RECOVERY_EXECUTABLE_UNREADABLE',()=>fs.readFileSync(fileURLToPath(import.meta.url)));
 need(digest(pinned)===digest(toolBytes),'RECOVERY_SOURCE_DRIFT');
 if(!fs.existsSync(path.join(root,'leases/controller-install'))){
  const result={schema:'ZGMINI_PC_RECOVERY_RESULT_V1',requestId:id,sourceSha:source,
   status:'NO_ACTIVE_INSTALL_LEASE',code:'REUSE_EXISTING_RECOVERY_EVIDENCE',changed:false,
   next:'CHECK_ORIGINAL_ISSUE_AND_ARCHIVE_RESULT_NOT_A_NEW_RECOVERY_OR_UPDATE_PASS'};
  if(mode==='inspect')return result;
  need(false,'RECOVERY_ALREADY_RELEASED_NO_RETRY');
 }
 const before=observe(id);
 if(mode==='reconcile-installed')return reconcileInstalledRecoveryFixed({id,source,g,before});
 const decision=classifyRecovery(before.state);
 let result={schema:'ZGMINI_PC_RECOVERY_RESULT_V1',requestId:id,sourceSha:source,...decision,
  actualControllerSha:before.state.actualSha,operationalWrites:0};
 if(mode==='abort-untouched'){
  need(decision.status==='ABORT_UNTOUCHED_ELIGIBLE','RECOVERY_NOT_ELIGIBLE');
  const rel='approvals/maintenance-recoveries/'+id+'.json';
  const raw=inspectStep('RECOVERY_APPROVAL_UNREADABLE',()=>fs.readFileSync(path.join(repo,rel)));
  need(digest(g(['show','HEAD:'+rel],'RECOVERY_APPROVAL_SOURCE_UNAVAILABLE'))===digest(raw),'RECOVERY_APPROVAL_UNCOMMITTED');
  const approval=inspectStep('RECOVERY_APPROVAL_INVALID_JSON',()=>JSON.parse(raw));
  need(approval.schema==='ZGMINI_PC_RECOVERY_APPROVAL_V1'&&approval.approved===true&&
   approval.operation==='ABORT_UNTOUCHED'&&approval.requestId===id&&approval.sourceSha===source&&
   approval.issueNumber===before.state.ledger.issueNumber&&approval.installedSha===before.state.actualSha&&
   approval.toolSha256===digest(pinned)&&approval.ledgerSha256===digest(before.ledgerBytes)&&
   approval.ownerSha256===digest(before.ownerBytes)&&approval.markerSha256===digest(before.markerBytes),
   'RECOVERY_APPROVAL_MISMATCH');
  result={...archiveUntouched({root,requestId:id,...before,observe:()=>observe(id).state}),sourceSha:source};
 }
 // Automatic result upload; never repeat a recovery because upload failed.
 if(mode==='abort-untouched'){
  const out=path.join(root,'recovery',id+'-'+randomUUID()+'.txt');
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  try{execFileSync(gh,['issue','comment',String(before.state.ledger.issueNumber),'--repo',repository,'--body-file',out],{windowsHide:true,timeout:30000,stdio:'pipe'});result.reportUpload='VERIFIED';}
  catch{result.reportUpload='PENDING';}
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main()));}catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'RECOVERY_INSPECTION_FAILED',changed:null,next:'INSPECT_ORIGINAL_LEASE_RECOVERY_CLAIM_AND_COMPLETION_RECORD_BEFORE_RETRY'}));process.exitCode=2;}
}
