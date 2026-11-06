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
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
const put=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const github=route=>JSON.parse(execFileSync(gh,['api',`repos/${repository}/${route}`],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:3e6}));

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

function observe(requestId){
 const ledgerFile=path.join(root,'ledger',requestId+'.json');
 const ledgerBytes=fs.readFileSync(ledgerFile),ledger=JSON.parse(ledgerBytes);
 const dir=path.join(root,'leases/controller-install');
 const ownerBytes=fs.readFileSync(path.join(dir,'owner.json')),markerBytes=fs.readFileSync(path.join(dir,'RECOVERY_REQUIRED.json'));
 const owner=JSON.parse(ownerBytes),marker=JSON.parse(markerBytes);
 const host=json(path.join(control,'host.json'));
 const validFile=p=>/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p);
 const controllerVerified=/^[a-f0-9]{40}$/.test(host.controllerSourceSha??'')&&Object.keys(host.controllerFiles??{}).length>=5&&
  Object.entries(host.controllerFiles).every(([p,h])=>validFile(p)&&/^[a-f0-9]{64}$/.test(h)&&digest(fs.readFileSync(path.join(control,p)))===h);
 const installed=json(path.join(root,'MAINTENANCE_INSTALL.json'));
 const maintenanceVerified=verifyMaintenanceManifest(installed,root);
 const issue=github('issues/'+ledger.issueNumber);let body;try{body=JSON.parse(issue.body);}catch{}
 const identityVerified=ledger.requestId===requestId&&Number.isSafeInteger(owner.pid)&&owner.pid>0&&
  /^[0-9a-f-]{36}$/.test(owner.nonce??'')&&marker.nonce===owner.nonce&&marker.requestOwnerPid===owner.pid&&
  Number.isFinite(Date.parse(ledger.updatedAt))&&Number.isFinite(Date.parse(marker.at))&&
  Math.abs(Date.parse(marker.at)-Date.parse(ledger.updatedAt))<5000&&
  Number.isFinite(Date.parse(owner.at))&&Date.parse(owner.at)<=Date.parse(marker.at)&&
  issue.user?.login==='ansqhd5774-Choi'&&issue.title==='pc-controller-update'&&
  body?.requestId===requestId&&body?.targetControllerSha===ledger.targetSha;
 const rows=github('actions/runners?per_page=100').runners;
 const names=Array.from({length:6},(_,i)=>'zgmini-pc-0'+(i+1));
 const state={ledger,identityVerified,ownerAlive:alive(owner.pid),actualSha:host.controllerSourceSha,controllerVerified,
  maintenanceVerified,backupExists:fs.existsSync(path.join(control,'backups','controller-update-'+requestId)),
  backlogExists:fs.existsSync(path.join(root,'backlog',requestId+'.json')),
  workflow:github('actions/workflows/pc-job.yml').state,
  runnerSetVerified:rows.length===6&&names.every(n=>rows.some(x=>x.name===n&&x.status==='online')),
  runnersIdle:rows.every(x=>x.busy===false),
  otherLeaseCount:fs.readdirSync(path.join(control,'leases')).filter(x=>x!=='supervisor'&&!x.startsWith('supervisor.dead-')).length};
 return {state,ownerBytes,markerBytes,ledgerBytes};
}

export function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'RECOVERY_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===5&&['inspect','abort-untouched'].includes(args[0])&&args[1]==='--request-id'&&args[3]==='--source-sha', 'RECOVERY_USAGE');
 const [mode,,id,,source]=args;
 need(/^pc-[a-z0-9-]{8,76}$/.test(id)&&/^[a-f0-9]{40}$/.test(source),'RECOVERY_IDENTITY_FORMAT');
 const g=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:4e6});
 g(['merge-base','--is-ancestor',source,'HEAD']);
 const pinned=g(['show',source+':tools/maintenance-recovery.mjs']);
 need(digest(pinned)===digest(fs.readFileSync(fileURLToPath(import.meta.url))),'RECOVERY_SOURCE_DRIFT');
 if(!fs.existsSync(path.join(root,'leases/controller-install'))){
  const result={schema:'ZGMINI_PC_RECOVERY_RESULT_V1',requestId:id,sourceSha:source,
   status:'NO_ACTIVE_INSTALL_LEASE',code:'REUSE_EXISTING_RECOVERY_EVIDENCE',changed:false,
   next:'CHECK_ORIGINAL_ISSUE_AND_ARCHIVE_RESULT_NOT_A_NEW_RECOVERY_OR_UPDATE_PASS'};
  if(mode==='inspect')return result;
  need(false,'RECOVERY_ALREADY_RELEASED_NO_RETRY');
 }
 const before=observe(id),decision=classifyRecovery(before.state);
 let result={schema:'ZGMINI_PC_RECOVERY_RESULT_V1',requestId:id,sourceSha:source,...decision,
  actualControllerSha:before.state.actualSha,operationalWrites:0};
 if(mode==='abort-untouched'){
  need(decision.status==='ABORT_UNTOUCHED_ELIGIBLE','RECOVERY_NOT_ELIGIBLE');
  const rel='approvals/maintenance-recoveries/'+id+'.json';
  const raw=fs.readFileSync(path.join(repo,rel));
  need(digest(g(['show','HEAD:'+rel]))===digest(raw),'RECOVERY_APPROVAL_UNCOMMITTED');
  const approval=JSON.parse(raw);
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
 try{console.log(JSON.stringify(main()));}catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'RECOVERY_INSPECTION_FAILED',changed:null,next:'INSPECT_ORIGINAL_LEASE_RECOVERY_CLAIM_AND_COMPLETION_RECORD_BEFORE_RETRY'}));process.exitCode=2;}
}
