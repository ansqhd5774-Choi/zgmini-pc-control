#!/usr/bin/env node
// Narrow C-grade continuation of the already-approved, already-SWITCHED #4263.
// No Controller file copy, new B request, forced process stop or new install.
// This entry may only be run from an independently authenticated Windows user.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='E:/ZGmini/automation/pc-maintenance';
const CONTROL='E:/ZGmini/automation/pc-control';
const SOURCE='E:/ZGmini/projects/zgmini-pc-control';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const REQUEST='pc-update-3f1c0413-37dd-4b44-900e-75c709d492ff';
const ISSUE=4263;
const OLD='3c7d4cfefacf072fd35cb19706b352c64c5e4fd2';
const TARGET='555f95708984580cd7d5a0fd05a80b718e867710';
const MANIFEST_SHA='e36ab64432b5c4e8891140fdec5d226de77f1821fe73f0d11a836a0fc14a8939';
const APPROVAL_MERGE='ac0e806a929bcab05b72115edd5d673b172839f3';
const RECOVERY_PR=4264; // exact reviewed/merged origin, not an operator argument
const LOCAL='tools/controller-public-b-recover-4263.mjs';
const ledgerPath=path.join(ROOT,'ledger',REQUEST+'.json');
const backlogPath=path.join(ROOT,'backlog',REQUEST+'.json');
const leaseDir=path.join(ROOT,'leases/controller-install');
const leaseOwner=path.join(leaseDir,'owner.json');
const claimDir=path.join(ROOT,'leases/controller-recovery');
const backupDir=path.join(CONTROL,'backups','controller-update-'+REQUEST);
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(value,code)=>{if(!value)throw Object.assign(Error(code),{code});};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const goodFile=p=>{const s=fs.lstatSync(p);return s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<3000000;};
const stillRunning=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
const github=route=>JSON.parse(execFileSync(GH,['api',route],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:5000000}));
const upstream=route=>github('repos/'+REPO+'/'+route);
const mainBytes=(p,ref='main')=>{
 const v=upstream('contents/'+p+'?ref='+ref);
 need(v?.type==='file'&&v?.encoding==='base64'&&typeof v.content==='string',
  'B4263_SOURCE_UNAVAILABLE');
 return Buffer.from(v.content,'base64');
};
export function classify4263Evidence(e){
 if(e?.originalLedger!==true)return 'B4263_ORIGINAL_LEDGER_UNVERIFIED';
 if(e?.ownerDead!==true)return 'B4263_OWNER_NOT_PROVEN_DEAD';
 if(e?.leaseExact!==true)return 'B4263_INSTALL_LEASE_UNVERIFIED';
 if(e?.installedTarget!==true)return 'B4263_TARGET_CAS_UNVERIFIED';
 if(e?.supervisorHealthy!==true)return 'B4263_SUPERVISOR_UNVERIFIED';
 if(e?.sixIdle!==true)return 'B4263_RUNNERS_UNVERIFIED';
 if(e?.workflowPaused!==true)return 'B4263_WORKFLOW_NOT_PAUSED';
 if(e?.backupProtected!==true)return 'B4263_BACKUP_PROTECTION_UNVERIFIED';
 if(e?.backlogOriginal!==true)return 'B4263_BACKLOG_NOT_ORIGINAL';
 if(e?.claimAbsent!==true)return 'B4263_PRIOR_RECOVERY_CLAIM';
 return 'B4263_RECOVERY_PREFLIGHT_ONLY';
}
function sourceAndOwner(){
 need(process.platform==='win32'&&os.hostname().toUpperCase()==='PC'&&
  !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&!process.env.GITHUB_RUN_ID,
  'B4263_INDEPENDENT_WINDOWS_REQUIRED');
 need(path.resolve(fileURLToPath(import.meta.url)).toLowerCase()===
  path.resolve(SOURCE,LOCAL).toLowerCase(),'B4263_OPERATOR_PATH_DRIFT');
 const user=github('user'),r=github('repos/'+REPO);
 need(user?.id===327938088&&user?.login==='ansqhd5774-Choi'&&
  r?.id===1442936296&&r?.private===false&&r?.owner?.id===327938088,
  'B4263_GITHUB_OWNER_UNVERIFIED');
 need(upstream('pulls/4260')?.merge_commit_sha===APPROVAL_MERGE,
  'B4263_EFFECT_APPROVAL_UNVERIFIED');
 const sourcePr=upstream('pulls/'+RECOVERY_PR);
 need(sourcePr?.number===RECOVERY_PR&&sourcePr?.merged===true&&
  sourcePr?.user?.id===327938088&&sourcePr?.base?.ref==='main'&&
  sourcePr?.head?.repo?.full_name===REPO&&sourcePr?.base?.repo?.full_name===REPO&&
  /^[a-f0-9]{40}$/.test(sourcePr?.merge_commit_sha??''),
  'B4263_SOURCE_PR_NOT_MERGED');
 const merge=sourcePr.merge_commit_sha;
 const history=upstream('compare/'+merge+'...main');
 need(history?.behind_by===0&&history?.merge_base_commit?.sha===merge,
  'B4263_SOURCE_NOT_ON_MAIN');
 need(goodFile(fileURLToPath(import.meta.url))&&
  fs.readFileSync(fileURLToPath(import.meta.url)).equals(mainBytes(LOCAL,merge))&&
  mainBytes(LOCAL,merge).equals(mainBytes(LOCAL)),
  'B4263_OPERATOR_SOURCE_CAS_FAILED');
 return merge;
}
async function attestedModules(merge){
 // Trust every transitive local runtime byte BEFORE evaluating any project
 // module. A GitHub token can attest the reviewed merge; it is not Windows
 // operator authority. Both independent proofs are required separately.
 const list=['tools/controller-public-b-operator-once.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'];
 const sources=new Map();
 for(const rel of list){
  const file=path.join(SOURCE,rel);
  need(goodFile(file)&&fs.realpathSync(file).toLowerCase()===
   path.resolve(file).toLowerCase(),'B4263_DEPENDENCY_UNSAFE');
  const bytes=fs.readFileSync(file),trusted=mainBytes(rel,merge);
  need(bytes.equals(trusted)&&trusted.equals(mainBytes(rel)),
   'B4263_DEPENDENCY_SOURCE_CAS_FAILED');
  sources.set(rel,bytes.toString('utf8'));
 }
 const allowed=new Set(list);
 for(const [rel,code] of sources){
  for(const item of code.matchAll(/\b(?:from\s+|import\s+)(['"])([^'"]+)\1/g)){
   const spec=item[2];if(spec.startsWith('node:'))continue;
   need(spec.startsWith('./')||spec.startsWith('../'),
    'B4263_UNPINNED_IMPORT');
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec));
   need(allowed.has(resolved),'B4263_UNPINNED_IMPORT');
  }
  for(const item of code.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)){
   const spec=item[2];
   need(spec.startsWith('node:')||allowed.has(
    path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec))),
    'B4263_UNPINNED_DYNAMIC_IMPORT');
  }
 }
 return await import('./update.mjs');
}
function verifyLedger(ledger,issue){
 let body=null;try{body=JSON.parse(issue.body);}catch{}
 return issue.number===ISSUE&&issue.state==='open'&&
  issue.user?.id===327938088&&issue.title==='pc-controller-update'&&
  issue.labels?.some(x=>x.name==='pc-maintenance')&&
  body?.requestId===REQUEST&&body?.operation==='controller-update'&&
  body?.targetControllerSha===TARGET&&body?.approvalManifestSha256===MANIFEST_SHA&&
  ledger?.schema==='ZGMINI_PC_UPDATE_RESULT_V1'&&ledger?.requestId===REQUEST&&
  ledger?.issueNumber===ISSUE&&ledger?.status==='RUNNING'&&
  ledger?.phase==='SWITCHED'&&ledger?.lastPass==='SWITCHED'&&
  ledger?.firstFail===null&&ledger?.installedShaBefore===OLD&&
  ledger?.targetSha===TARGET&&ledger?.postIssueNumber==null;
}
function preflight(update){
 const issue=upstream('issues/'+ISSUE);
 const ledgerRaw=fs.readFileSync(ledgerPath),ledger=JSON.parse(ledgerRaw);
 need(verifyLedger(ledger,issue),'B4263_ORIGINAL_LEDGER_UNVERIFIED');
 const manifestRaw=mainBytes('approvals/controller-updates/'+TARGET+'.json');
 need(hash(manifestRaw)===MANIFEST_SHA,'B4263_APPROVAL_BYTES_CHANGED');
 const manifest=JSON.parse(manifestRaw);
 const pin=JSON.parse(mainBytes('approvals/controller-selective-targets/'+TARGET+'.json'));
 update.validateControllerSelectivePin(manifest,pin);
 need(manifest.installedSha===OLD&&manifest.targetSha===TARGET&&
  manifest.approval?.ref==='https://github.com/'+REPO+'/pull/4260'&&
  manifest.controllerOnlyInstall===true&&
  Array.isArray(manifest.allowFiles)&&manifest.allowFiles.length===4&&
  manifest.checks?.manifestSha256==='006d8d2c3ed9c78581e34e0713c97d74dff6b1bb09a278fde5f25fa9c1db68b8',
  'B4263_APPROVAL_SCOPE_CHANGED');
 const data={actor:'ansqhd5774-Choi',issue:JSON.parse(issue.body),
  manifest,manifestRawBase64:manifestRaw.toString('base64')};
 const ownerRaw=fs.readFileSync(leaseOwner),owner=JSON.parse(ownerRaw);
 need(Number.isSafeInteger(owner.pid)&&owner.pid>0&&/^[a-f0-9-]{36}$/.test(owner.nonce??'')&&
  Number.isFinite(Date.parse(owner.at))&&
  Date.parse(owner.at)>=Date.parse(issue.created_at)-30000&&
  Date.parse(owner.at)<=Date.parse(ledger.updatedAt)+30000&&
  stillRunning(owner.pid)===false&&!fs.existsSync(path.join(leaseDir,'RECOVERY_REQUIRED.json')),
  'B4263_DEAD_INSTALL_OWNER_UNVERIFIED');
 const host=read(path.join(CONTROL,'host.json'));
 need(host.controllerSourceSha===TARGET&&update.prevalidationInventory(host)!==null,
  'B4263_INSTALLED_TARGET_UNVERIFIED');
 // A self-consistent host.json is NOT independent proof of the four approved
 // target bytes; compare each live source directly with the merged B manifest.
 for(const file of manifest.allowFiles){
  const live=path.join(CONTROL,file.path);
  need(host.controllerFiles[file.path]===file.sha256&&goodFile(live)&&
   hash(fs.readFileSync(live))===file.sha256,
   'B4263_TARGET_FOUR_FILE_SHA256_MISMATCH');
 }
 for(const [rel,h] of Object.entries(host.controllerFiles)){
  need(/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel)&&
   /^[a-f0-9]{64}$/.test(h)&&goodFile(path.join(CONTROL,rel))&&
   hash(fs.readFileSync(path.join(CONTROL,rel)))===h,
   'B4263_INSTALLED_FILE_CAS');
 }
 const status=read(path.join(CONTROL,'SUPERVISOR_STATUS.json'));
 const supervisor=read(path.join(CONTROL,'leases/supervisor/owner.json'));
 need(supervisor.pid===status.pid&&status.sourceSha===TARGET&&
  status.mode==='LISTENING'&&status.children?.length===6&&
  Date.now()-Date.parse(status.at)<45000&&Date.now()-Date.parse(status.at)>=0&&
  Number.isSafeInteger(supervisor.pid)&&stillRunning(supervisor.pid)===true&&
  status.children.every(x=>x.alive===true&&stillRunning(x.pid)===true),
  'B4263_SUPERVISOR_NOT_HEALTHY');
 update.verifyPublicOwnerBWindows(data,ISSUE,supervisor.pid);
 const runners=upstream('actions/runners?per_page=100').runners;
 need(update.dedicatedPcRunnerRows(runners,{requireOnline:true,requireIdle:true})!==null,
  'B4263_SIX_RUNNERS_NOT_IDLE');
 need(upstream('actions/workflows/pc-job.yml').state==='disabled_manually',
  'B4263_WORKFLOW_NOT_PAUSED');
 const snapshot=read(path.join(backupDir,'snapshot/host.json'));
 const previous=read(path.join(backupDir,'previous-host.json'));
 need(snapshot.controllerSourceSha===OLD&&
  update.prevalidationInventory(snapshot)!==null&&
  JSON.stringify(snapshot)===JSON.stringify(previous)&&
  Object.entries(snapshot.controllerFiles??{}).every(([rel,d])=>
   goodFile(path.join(backupDir,'snapshot',rel))&&
   hash(fs.readFileSync(path.join(backupDir,'snapshot',rel)))===d),
  'B4263_SNAPSHOT_NOT_VERIFIED');
 // The previous Supervisor owner was moved by the original switch. Never
 // mistake an unchanged six-Runner tree for a completed version handoff.
 const priorOwner=read(path.join(backupDir,'previous-supervisor-lease/owner.json'));
 need(Number.isSafeInteger(priorOwner.pid)&&priorOwner.pid>0&&
  priorOwner.nonce!==supervisor.nonce&&priorOwner.pid!==supervisor.pid&&
  stillRunning(priorOwner.pid)===false,'B4263_PREVIOUS_SUPERVISOR_UNVERIFIED');
 const originalProtection=read(path.join(backupDir,'PROTECTED_BEFORE.json'));
 need(JSON.stringify(originalProtection)===JSON.stringify(update.protectedSnapshot()),
  'B4263_PROTECTED_STATE_DRIFT');
 const backlogRaw=fs.readFileSync(backlogPath),backlog=JSON.parse(backlogRaw);
 const windows=update.backlogPauseWindows(backlog);
 need(backlog.requestId===REQUEST&&windows.length===1&&windows[0].resumedAt===null&&
  Object.keys(backlog.replays??{}).length===0,
  'B4263_BACKLOG_UNVERIFIED');
 need(!fs.existsSync(claimDir),'B4263_EXISTING_RECOVERY_CLAIM');
 return {data,ledger,ledgerRaw,ownerRaw,owner,supervisor,status,backlogRaw,
  originalProtection};
}
function validateUnchanged(pre){
 need(fs.readFileSync(leaseOwner).equals(pre.ownerRaw)&&stillRunning(pre.owner.pid)===false&&
  fs.readFileSync(ledgerPath).equals(pre.ledgerRaw)&&
  fs.readFileSync(backlogPath).equals(pre.backlogRaw),
  'B4263_PRE_EFFECT_CAS_CHANGED');
}
function writeExclusive(p,v){fs.writeFileSync(p,JSON.stringify(v)+'\n',{flag:'wx',mode:0o600});}
function record(phase,extra={}){
 const file=path.join(claimDir,'record.json'),tmp=file+'.new';
 const previous=fs.existsSync(file)?read(file):{};
 const next={...previous,...extra,schema:'ZGMINI_B4263_RESUME_V1',
  requestId:REQUEST,phase,at:new Date().toISOString()};
 writeExclusive(tmp,next);fs.renameSync(tmp,file);
 return next;
}
async function continueOriginal(pre,update){
 const {request,ports}=update.makePorts(pre.data,ISSUE,{publicOwnerBOperator:true});
 await ports.prepareInterruptedPublicBSwitch();
 validateUnchanged(pre);
 // No second installer. Recovery reservation records the first intended
 // operational effect BEFORE enabling intake; unknown completion keeps claims.
 fs.mkdirSync(claimDir);
 writeExclusive(path.join(claimDir,'owner.json'),{requestId:REQUEST,pid:process.pid,nonce:randomUUID()});
 record('PREPARED',{originalLedgerSha256:hash(pre.ledgerRaw),
  originalOwnerSha256:hash(pre.ownerRaw),originalBacklogSha256:hash(pre.backlogRaw)});
 const receiptRoot=path.join(ROOT,'recovery');
 fs.mkdirSync(receiptRoot,{recursive:true});
 writeExclusive(path.join(receiptRoot,REQUEST+'-before-resume.json'),{
  requestId:REQUEST,ledgerRawBase64:pre.ledgerRaw.toString('base64'),
  originalLedgerSha256:hash(pre.ledgerRaw)});
 try{
  validateUnchanged(pre);
  need(upstream('actions/workflows/pc-job.yml').state==='disabled_manually',
   'B4263_PRE_EFFECT_WORKFLOW_DRIFT');
  record('WORKFLOW_ENABLE_ATTEMPTED');
  await ports.resumeIntake();
  need(upstream('actions/workflows/pc-job.yml').state==='active',
   'B4263_WORKFLOW_RESUME_UNVERIFIED');
  await ports.persist({...pre.ledger,phase:'INTAKE_RESUMED',lastPass:'INTAKE_RESUMED',
   updatedAt:new Date().toISOString(),recoverySource:'B4263_EXACT_INTERRUPTED_SWITCH'});
  record('INTAKE_RESUMED');
  await ports.reconcileBacklog(request);
  await ports.persist({...read(ledgerPath),phase:'BACKLOG_RECONCILED',lastPass:'BACKLOG_RECONCILED',
   updatedAt:new Date().toISOString()});
  record('BACKLOG_RECONCILED');
  await ports.persist({...read(ledgerPath),phase:'POSTCHECK_PENDING',lastPass:'POSTCHECK_PENDING',
   updatedAt:new Date().toISOString()});
  record('POSTCHECK_PENDING');
  const post=await ports.postcheck(request);
  need(post?.status==='PASS'&&post.actualExecutionSha===TARGET&&
   post.protectedStateUnchanged===true&&post.runnerSetVerified===true&&
   post.postSourceVerified===true,'B4263_POSTCHECK_NOT_VERIFIED');
  const host=read(path.join(CONTROL,'host.json'));
  need(host.controllerSourceSha===TARGET&&
   JSON.stringify(update.protectedSnapshot())===JSON.stringify(pre.originalProtection)&&
   upstream('actions/workflows/pc-job.yml').state==='active',
   'B4263_FINAL_RUNTIME_NOT_VERIFIED');
  need(fs.readFileSync(leaseOwner).equals(pre.ownerRaw)&&stillRunning(pre.owner.pid)===false,
   'B4263_LEASE_OWNER_CHANGED');
  record('POSTCHECK_VERIFIED_LEASE_ARCHIVE_PENDING',{postIssueNumber:post.issueNumber});
  const leaseArchived=path.join(receiptRoot,REQUEST+'-switched-recovered.lease');
  need(!fs.existsSync(leaseArchived),'B4263_RECOVERY_ARCHIVE_EXISTS');
  fs.renameSync(leaseDir,leaseArchived); // archive entire dead lease, never delete
  const result={...read(ledgerPath),status:'PASS',phase:'PASS',lastPass:'PASS',
   code:'APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED',
   actualInstalledSha:TARGET,workflowEnabled:true,protectedStateUnchanged:true,
   postcheck:post,interruptedSourcePhase:'SWITCHED',recoveryLeaseArchived:true,
   updatedAt:new Date().toISOString()};
  await ports.persist(result);
  need(read(ledgerPath).status==='PASS'&&
   read(ledgerPath).actualInstalledSha===TARGET,'B4263_FINAL_LEDGER_READBACK_FAILED');
  record('DONE',{status:'PASS',controllerSha:TARGET,
   leaseArchived:true,postIssueNumber:post.issueNumber});
  const archivedClaim=path.join(receiptRoot,REQUEST+'-switched-recovery-claim');
  need(!fs.existsSync(archivedClaim),'B4263_CLAIM_ARCHIVE_EXISTS');
  fs.renameSync(claimDir,archivedClaim);
  return {status:'PASS',code:'B4263_ORIGINAL_REQUEST_RECOVERED',
   requestId:REQUEST,controllerSha:TARGET,postIssueNumber:post.issueNumber,
   originalRequestRetried:false,newBRequestCreated:false};
 }catch(error){
  // Preserve the original install lease, recovery claim and phase journal.
  // A Workflow PUT or Issue POST may already have taken effect; never retry.
  return {status:'RECOVERY_REQUIRED',code:'B4263_OUTCOME_RECONCILE_NO_RETRY',
   phase:read(path.join(claimDir,'record.json')).phase,
   cause:/^[A-Z0-9_]{2,100}$/.test(error?.code??'')?error.code:'UNVERIFIED',
   requestId:REQUEST};
 }
}
export async function main(args=process.argv.slice(2)){
 need(args.length===1&&['inspect','recover'].includes(args[0]),'B4263_USAGE');
 const merge=sourceAndOwner();
 const update=await attestedModules(merge);
 const pre=preflight(update);
 if(args[0]==='inspect')return {status:'PASS',code:'B4263_RECOVERY_PREFLIGHT_ONLY',
  requestId:REQUEST,controllerSha:TARGET,operationalWrites:0,
  workflowChanged:false,leaseChanged:false};
 return continueOriginal(pre,update);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=await main();console.log(JSON.stringify(r));if(r.status!=='PASS')process.exitCode=2;}
 catch(e){
  const attempted=fs.existsSync(claimDir)||
   fs.existsSync(path.join(ROOT,'recovery',REQUEST+'-switched-recovery-claim'))||
   fs.existsSync(path.join(ROOT,'recovery',REQUEST+'-switched-recovered.lease'));
  console.log(JSON.stringify({status:attempted?'RECOVERY_REQUIRED':'BLOCKED',
   code:attempted?'B4263_OUTCOME_RECONCILE_NO_RETRY':
    /^[A-Z0-9_]{2,100}$/.test(e?.code??'')?e.code:'B4263_PRE_EFFECT_UNVERIFIED',
   operationalWrites:attempted?null:0}));
  process.exitCode=2;
 }
}
