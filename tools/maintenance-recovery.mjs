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
const installedRecoveryCases=Object.freeze({
 [REC2960]:Object.freeze({issueNumber:2960,postIssueNumber:2965,
  targetSha:TARGET2960,postSourceBranch:'main',
  postSourceSha:'2b69dcbc7ade75815e0c152fd0e2112ddaa5b333',
  proof:proof2960}),
 'pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0':Object.freeze({
  issueNumber:3409,postIssueNumber:3410,
  targetSha:'6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4',
  postSourceBranch:'codex/employment-1y-reader-r1',
  postSourceSha:'50769db23ac6a5f55203855f5231d12dc0595bb4',
  proof:Object.freeze({issueNumber:3438,runId:45457196689,jobId:138669741465,
   runnerName:'zgmini-pc-03',resultPath:'results/45457196689-1-seat-3.json'})})
});
export function installedRecoveryCase(requestId){
 return Object.hasOwn(installedRecoveryCases,requestId)?
  installedRecoveryCases[requestId]:null;
}
// #2960 allowed a pinned Writer config delta; #3409 has independently
// proven exact protection equality. Never widen either case to arbitrary drift.
export function installedRecoveryProtectionAllowed(scope,choice){
 return choice?.allowed===true&&(
  scope?.issueNumber===2960&&choice.preservedWriterConfig===true||
  scope?.issueNumber===3409&&
   choice.code==='RECOVERY_ORIGINAL_PROTECTION_UNCHANGED');
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
async function reconcileInstalledRecovery({id,source,g,before}){
 const scope=installedRecoveryCase(id);
 need(scope!==null,'INSTALLED_RECOVERY_SCOPE_NOT_ALLOWED');
 const {verifyRecoveryOperator,protectedSnapshot,loadApprovedPackage}=await import('./update.mjs');
 const {selectPreservedRecoveryProtection}=await import('./maintenance-contract.mjs');
 const {readFixedReadonlyBytes}=await import('../controller/fixed-readonly-bytes.mjs');
 const rel='approvals/maintenance-recoveries/'+id+'.installed.json';
 const raw=inspectStep('INSTALLED_RECOVERY_APPROVAL_MISSING',()=>fs.readFileSync(path.join(repo,rel)));
 need(digest(raw)===digest(g(['show','HEAD:'+rel],'INSTALLED_RECOVERY_APPROVAL_NOT_COMMITTED')),
  'INSTALLED_RECOVERY_APPROVAL_DRIFT');
 let approval;try{approval=JSON.parse(raw);}catch{need(false,'INSTALLED_RECOVERY_APPROVAL_INVALID');}
 const exactPaths=['tools/maintenance-recovery.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs'];
 need(approval?.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'&&
  approval.approved===true&&approval.operation==='RECONCILE_INSTALLED'&&
  approval.requestId===id&&approval.issueNumber===scope.issueNumber&&
  approval.sourceSha===source&&approval.targetControllerSha===scope.targetSha&&
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
 // The prior B scope and its original postcheck source are authoritative;
 // a successful independent A result cannot redefine that approved contract.
 const originalPackage=loadApprovedPackage(id,path.join(root,'approved',id+'.json'),
  {recovery:true});
 need(originalPackage.issue.requestId===id&&
  originalPackage.manifest.targetSha===scope.targetSha&&
  originalPackage.manifest.postOperation==='core-status'&&
  originalPackage.manifest.postSourceBranch===scope.postSourceBranch&&
  originalPackage.manifest.postSourceSha===scope.postSourceSha,
  'INSTALLED_RECOVERY_ORIGINAL_APPROVAL_UNVERIFIED');
 const ledger=JSON.parse(bytes.ledger),owner=JSON.parse(bytes.owner);
 const marker=JSON.parse(bytes.marker),backlog=JSON.parse(bytes.backlog);
 const baseline=JSON.parse(bytes.protection);
 const original=ledger.requestId===id&&ledger.issueNumber===scope.issueNumber&&
  ledger.status==='RECOVERY_REQUIRED'&&ledger.phase==='RECOVERY_REQUIRED'&&
  ledger.firstFail==='POSTCHECK_PENDING'&&
  ledger.code==='POSTCHECK_OUTCOME_UNKNOWN'&&
  ledger.postIssueNumber===scope.postIssueNumber&&ledger.targetSha===scope.targetSha;
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
 const post=github('issues/'+scope.postIssueNumber);
 let postBody;try{postBody=JSON.parse(post.body);}catch{}
 const postExact=post.number===scope.postIssueNumber&&
  post.title==='PC Update '+id+' postcheck'&&
  post.user?.login==='ansqhd5774-Choi'&&
  post.labels?.some(l=>l.name==='pc-job')&&
  postBody?.schema==='ZGMINI_PC_JOB_V1'&&
  postBody.requestId===id+'-postcheck'&&
  postBody.operation==='core-status'&&
  postBody.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  postBody.sourceBranch===scope.postSourceBranch&&
  postBody.sourceSha===scope.postSourceSha;
 const fixedProof=approval.proof,fixed=scope.proof;
 need(fixedProof&&Object.keys(fixed).length+1===Object.keys(fixedProof).length&&
  Object.keys(fixed).every(k=>fixedProof[k]===fixed[k])&&
  /^[a-f0-9]{64}$/.test(fixedProof.resultSha256??''),
  'INSTALLED_RECOVERY_A_PROOF_SCOPE_INVALID');
 // resultSha256 is an additional pinned field, not a selectable path.
 const rcpt=g(['show','HEAD:'+fixed.resultPath],'INSTALLED_RECOVERY_A_RESULT_MISSING');
 need(digest(rcpt)===fixedProof.resultSha256,'INSTALLED_RECOVERY_A_RESULT_DRIFT');
 const receipt=JSON.parse(rcpt);
 const run=github('actions/runs/'+fixed.runId);
 const job=github('actions/jobs/'+fixed.jobId);
 const step=job.steps?.filter(s=>s.name==='Execute fixed host allowlist entry');
 const success=postExact&&run?.id===fixed.runId&&
  run.event==='issues'&&run.status==='completed'&&run.conclusion==='success'&&
  job?.id===fixed.jobId&&job.run_id===run.id&&
  job.runner_name===fixed.runnerName&&job.name==='approved-pc-job'&&
  job.status==='completed'&&job.conclusion==='success'&&
  Array.isArray(step)&&step.length===1&&step[0].conclusion==='success'&&
  receipt.schema==='ZGMINI_PC_RESULT_V1'&&receipt.status==='PASS'&&
  receipt.code==='CORE_READONLY_DIAGNOSIS'&&receipt.operation==='core-status'&&
  receipt.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  receipt.requestedSourceSha===postBody.sourceSha&&
  receipt.actualExecutionSha===scope.targetSha&&
  receipt.protectedStateUnchanged===true&&receipt.providerCalls===0&&
  receipt.d1Writes===0&&receipt.sqliteOpened===false&&
  Number.isFinite(Date.parse(receipt.finishedAt))&&
  Date.parse(receipt.finishedAt)>Date.parse(ledger.updatedAt);
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
   before.state.actualSha===scope.targetSha,
  maintenanceVerified:before.state.maintenanceVerified===true,
  workflowActive:before.state.workflow==='active',
  backlogReconciled:pending,
  supervisorVerified:verifyInstalledRecoverySupervisor(scope.targetSha),
  protectedWriterPreserved:installedRecoveryProtectionAllowed(scope,protectedChoice),
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
  installedSha:scope.targetSha,sourceSha:source,originalRequestRetried:false,
  runnerApiSetVerified:false,controllerChanged:false,workflowChanged:false,
  writerChanged:false,dbD1Writes:0,casDigests:cas};
 try{
  const now=take();
  need(Object.keys(now).every(k=>bytes[k].equals(now[k]))&&
   before.state.ownerAlive===false&&alive(owner.pid)===false&&
   verifyInstalledRecoverySupervisor(scope.targetSha)&&
   selectPreservedRecoveryProtection(baseline,protectedSnapshot(),
    {approvedCurrentWriterConfigSha256:approval.approvedCurrentWriterConfigSha256}).allowed===true,
   'INSTALLED_RECOVERY_PREARCHIVE_CAS_DRIFT');
  // A fresh independent runtime+workflow readback is required at the exact
  // archive boundary. The seven-file CAS alone cannot prove live Controller
  // files or the GitHub intake did not change since initial inspection.
  const live=observe(id);
  need(live.state.identityVerified===true&&
   live.state.controllerVerified===true&&
   live.state.actualSha===scope.targetSha&&
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
 if(mode==='reconcile-installed')return reconcileInstalledRecovery({id,source,g,before});
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
