// Approved Controller updater. Must be called by the independent PC maintenance
// listener, NEVER from a GitHub Actions job or a supervisor child process.
// Preserves the original update.mjs workflow: drain, protect, backup, stop only
// the dedicated supervisor, replace controller/config, reconnect six listeners.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {applyApprovedUpdate} from './maintenance-apply.mjs';
import {validateUpdateRequest,validateMaintenanceRequest,
 validateControllerConfigTransition,controllerAdmissionForPurpose,
 validateR6HostIssueEnvelope,validateR6HostRegistrationRequest,classifyR6HostRecovery,
 decideR6RecoveryReentry,sameR6RecoveryClaim,verifyR6HistoricCompletion,
 R6_HOST_SOURCE_SHA,R6_HOST_SOURCE_MANIFEST_SHA256,
 R6_HOST_CANDIDATE_SHA256} from './maintenance-contract.mjs';
import {acquireMaintenanceLock,maintenanceLockStatus} from './maintenance-lock.mjs';

const controlRoot='E:/ZGmini/automation/pc-control';
const maintenanceRoot='E:/ZGmini/automation/pc-maintenance';
const checkout='E:/ZGmini/projects/zgmini-pc-control';
const controlRepository='ansqhd5774-Choi/zgmini-pc-control';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const node='E:/ZGmini/runtime/node.exe';
const requiredRunners=Array.from({length:6},(_,n)=>`zgmini-pc-0${n+1}`);
const sha256=x=>createHash('sha256').update(x).digest('hex');
const need=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
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
 const expected=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs',
  'tools/maintenance-ancestry.vbs'];
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

const hashFiles=(root,files)=>Object.fromEntries(files.map(rel=>[rel,sha256(fs.readFileSync(path.join(root,rel)))]));
function installedManifest() {
 const host=json(hostPath),installedSha=host.controllerSourceSha;
 need(validSha(installedSha),'INSTALLED_SHA_INVALID');
 for(const [rel,expected] of Object.entries(host.controllerFiles??{})) {
  need(/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel),'INSTALLED_FILE_PATH');
  need(sha256(fs.readFileSync(path.join(controlRoot,rel)))===expected,'CURRENT_CONTROLLER_DRIFT');
 }
 return {host,installedSha};
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

function protectedSnapshot() {
 // Existing Core task XML hashes + PC writer config hashes, read-only.
 const dataRoot='E:/ZGmini/data',out={files:{},tasks:{}};
 for(const name of ['config.json','quota-runner.cmd','run-local.cmd']) {
  const f=path.join(dataRoot,'pc-writer',name);
  if(fs.existsSync(f))out.files[name]=sha256(fs.readFileSync(f));
 }
 const schtasks=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
 for(const name of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13']) {
  out.tasks[name]=sha256(execFileSync(schtasks,['/Query','/TN',name,'/XML'],{windowsHide:true,timeout:15000}));
 }
 return out;
}

function makePorts(packageData,issueNumber) {
 const {issue,manifest}=packageData,request={requestId:issue.requestId,chatId:issue.chatId,
  installedSha:manifest.installedSha,targetSha:manifest.targetSha,postOperation:manifest.postOperation};
 const ledgerFile=path.join(recordDir,request.requestId+'.json');
 const backlogFile=path.join(maintenanceRoot,'backlog',request.requestId+'.json');
 const backupRoot=path.join(controlRoot,'backups','controller-update-'+request.requestId);
 const stageRoot=path.join(backupRoot,'stage');
 const snapshotRoot=path.join(backupRoot,'snapshot');
 let plannedFiles=[],protectedBefore,oldOwner,pausedByUs=false,postIssueNumber,reconnectStartedAt=0;
 const apiRunners=()=>github('actions/runners?per_page=100').runners;
 const runnersCorrect=rows=>rows?.length===6&&requiredRunners.every(n=>rows.some(x=>x.name===n));
 const available=rows=>runnersCorrect(rows)&&rows.every(x=>x.status==='online'&&!x.busy);
 const waitForReconnect=async(pid,sourceSha,code)=>{
  const deadline=Date.now()+600000;
  let stable=0;
  for(;;){
   const status=fs.existsSync(path.join(controlRoot,'SUPERVISOR_STATUS.json'))?json(path.join(controlRoot,'SUPERVISOR_STATUS.json')):null;
   const rows=apiRunners();
   const listeners=freshListenerCount(controlRoot,reconnectStartedAt);
   const matched=status?.pid===pid&&status.sourceSha===sourceSha&&Date.now()-Date.parse(status.at)<45000&&status.children?.length===6&&listeners===6;
   const state=reconnectState({now:Date.now(),deadline,matched,online:runnersCorrect(rows)&&rows.every(x=>x.status==='online')});
   writeJson(path.join(maintenanceRoot,'reconnect',request.requestId+'.json'),{at:new Date().toISOString(),state,supervisorPid:pid,sourceSha,freshListeners:listeners,onlineCount:rows.filter(x=>x.status==='online').length,deadline:new Date(deadline).toISOString()});
   if(state==='PASS'){if(++stable>=2)return;}else stable=0;
   if(state==='TIMEOUT')throw Object.assign(Error(code),{code});
   await wait(3000);
  }
 };
 const result={request,ports:{
  fingerprint:x=>sha256(JSON.stringify({issue,manifest,targetSha:x.targetSha})),
  read:async id=>fs.existsSync(path.join(recordDir,id+'.json'))?json(path.join(recordDir,id+'.json')):null,
  persist:async x=>writeJson(ledgerFile,{...x,issueNumber,postIssueNumber}),
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
   need(['core-status','fear-greed-archive-status'].includes(manifest.postOperation),'POST_OPERATION_NOT_APPROVED');
   need(validSha(manifest.postSourceSha),'POST_SOURCE_INVALID');
   need(typeof manifest.postSourceBranch==='string'&&/^[a-z0-9][a-z0-9./_-]{1,120}$/i.test(manifest.postSourceBranch),'POST_SOURCE_BRANCH');
   need(git(['status','--porcelain']).trim()==='','CONTROL_DIRTY');
   git(['fetch','--no-tags','origin','main']);
   need(git(['cat-file','-t',manifest.targetSha]).trim()==='commit','TARGET_NOT_COMMIT');
   need(git(['merge-base','--is-ancestor',manifest.targetSha,'refs/remotes/origin/main']).trim()==='','TARGET_NOT_ON_MAIN');
   need(git(['merge-base','--is-ancestor',manifest.installedSha,manifest.targetSha]).trim()==='','TARGET_NOT_DESCENDANT');
   const diff=git(['diff','--name-only',manifest.installedSha,manifest.targetSha,'--']).trim().split(/\r?\n/).filter(Boolean);
   // tools/docs/tests/reports are not deployed into the six Runner host. Changes
   // to a live workflow or executable script still require a different approval.
   need(!diff.some(p=>p.startsWith('.github/')||p.startsWith('scripts/')),'UNAPPROVED_INFRA_CHANGE');
   const changed=diff.filter(p=>p.startsWith('controller/')||p.startsWith('config/')).sort();
   const declared=manifest.allowFiles?.map(x=>x.path).sort();
   need(Array.isArray(declared)&&JSON.stringify(changed)===JSON.stringify(declared),'ALLOWFILE_DIFF_MISMATCH');
   const listing=git(['ls-tree','-r','--name-only',manifest.targetSha,'--','controller','config']).trim().split(/\r?\n/).filter(Boolean);
   need(listing.length>=5&&listing.every(p=>/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p)),'TARGET_TREE_PATH');
   const oldOperations=JSON.parse(fs.readFileSync(path.join(controlRoot,'config/operations.json')));
   const nextOperations=JSON.parse(git(['show',manifest.targetSha+':config/operations.json']));
   validateControllerConfigTransition(oldOperations,nextOperations,controllerAdmissionForPurpose(manifest.purpose));
   for(const item of manifest.allowFiles){
    need(/^[a-f0-9]{64}$/.test(item.sha256),'ALLOWFILE_HASH');
    need(sha256(git(['show',manifest.targetSha+':'+item.path],{encoding:null}))===item.sha256,'ALLOWFILE_HASH_MISMATCH');
   }
   plannedFiles=listing;
   const pr=github('pulls/'+manifest.approval.ref.split('/').pop());
   need(pr.merged===true&&validSha(pr.merge_commit_sha),'APPROVAL_PR_NOT_MERGED');
   need(git(['merge-base','--is-ancestor',pr.merge_commit_sha,manifest.targetSha]).trim()==='','APPROVAL_PR_TARGET_MISMATCH');
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
   need(github('actions/workflows/pc-job.yml').state==='disabled_manually','WORKFLOW_DISABLE_NOT_CONFIRMED');
  },
  didPauseIntake:()=>pausedByUs,
  waitForDrain:async()=>{
   // Jobs (including result-upload) must finish normally. A quiet double-check
   // avoids replacing files during a newly completed upload's last lease.
   let quiet=0;
   for(let n=0;n<180;n++){
    const rows=apiRunners();need(runnersCorrect(rows),'RUNNER_SET_DRIFT');
    const busy=rows.some(x=>x.busy),leases=fs.readdirSync(path.join(controlRoot,'leases')).filter(x=>x!=='supervisor');
    const pending=['in_progress','queued','waiting'].map(status=>github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0).reduce((a,b)=>a+b,0);
    if(!busy&&!leases.length&&!pending){quiet++;if(quiet>=2)return;}else quiet=0;
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
  },
  stopOwnSupervisor:async()=>{
   const current=readOwner();need(current.owner.pid===oldOwner.owner.pid&&current.owner.nonce===oldOwner.owner.nonce,'SUPERVISOR_OWNER_CHANGED');
   verifyIndependent(current.owner.pid);
   // Read-only controls are checked again just before stopping the dedicated tree.
   need(available(apiRunners()),'RUNNERS_NOT_IDLE');
   execFileSync('taskkill.exe',['/PID',String(current.owner.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:15000});
   for(let n=0;n<30;n++){let running=true;try{process.kill(current.owner.pid,0);}catch{running=false;}if(!running)return;await wait(500);}
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
   need(github('actions/workflows/pc-job.yml').state==='active','WORKFLOW_ENABLE_NOT_CONFIRMED');
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
     if(state.replays[key])throw Object.assign(Error('BACKLOG_REPLAY_OUTCOME_UNKNOWN'),{code:'BACKLOG_REPLAY_OUTCOME_UNKNOWN'});
     const comments=github(`issues/${original.number}/comments?per_page=100`);
     if(comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes('zgmini-pc-result:'))){
       state.replays[key]={status:'SKIPPED_RESULT_PRESENT'};writeJson(backlogFile,state);continue;
     }
     let body;try{body=JSON.parse(original.body);}catch{throw Object.assign(Error('BACKLOG_ORIGINAL_BODY_INVALID'),{code:'BACKLOG_ORIGINAL_BODY_INVALID'});}
     const keys=['schema','requestId','chatId','operation','sourceRepository','sourceBranch','sourceSha'];
     need(Object.keys(body).sort().join(',')===keys.sort().join(',')&&body.schema==='ZGMINI_PC_JOB_V1'&&
       /^[a-z0-9-]{8,80}$/.test(body.requestId),'BACKLOG_ORIGINAL_REQUEST_INVALID');
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
        const list=github('issues?state=all&per_page=100');
        const found=list.filter(x=>x.title===`PC Update ${issue.requestId} postcheck`&&x.body===body);
        if(found.length===1)postIssueNumber=found[0].number;
      }catch{}
      if(!postIssueNumber)throw Object.assign(Error('POSTCHECK_OUTCOME_UNKNOWN'),{code:'POSTCHECK_OUTCOME_UNKNOWN'});
    }
    writeJson(ledgerFile,{...ledger,postIssueNumber});
   }
   for(let n=0;n<100;n++){
    let comments;
    try{comments=github(`issues/${postIssueNumber}/comments?per_page=100`);}
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
     const runnerSetVerified=runnersCorrect(runnerState)&&runnerState.every(x=>x.status==='online');
     return {status:result.status,code:result.code,actualExecutionSha:result.actualExecutionSha,
       issueNumber:postIssueNumber,protectedStateUnchanged,runnerSetVerified,
       postSourceVerified:result.requestedSourceSha===manifest.postSourceSha&&
         result.sourceRepository==='ansqhd5774-Choi/zgmini'&&
         result.sourceBranch===manifest.postSourceBranch&&
         result.controlSourceSha===manifest.targetSha};
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
  restore:async()=>{
   // A postcheck may have failed after the new listener came online. Stop its
   // tree only AFTER pausing intake and observing zero jobs/uploads again.
   if(!pausedByUs){
     // Durable pause record BEFORE disabling; an API acknowledgement may be
     // lost even when the disable succeeded. The second window is replayed
     // after the verified rollback reconnects the original six Runners.
     need(fs.existsSync(backlogFile),'BACKLOG_STATE_MISSING');
     writeJson(backlogFile,openRollbackPause(json(backlogFile),new Date().toISOString()));
     github('actions/workflows/pc-job.yml/disable','PUT');pausedByUs=true;
   }
   need(github('actions/workflows/pc-job.yml').state==='disabled_manually','ROLLBACK_WORKFLOW_NOT_DISABLED');
   let stable=0;
   for(let n=0;n<180;n++){
    const rows=apiRunners(),leases=fs.readdirSync(path.join(controlRoot,'leases')).filter(x=>x!=='supervisor');
    const pending=['in_progress','queued','waiting'].map(status=>github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0).reduce((a,b)=>a+b,0);
    if(runnersCorrect(rows)&&rows.every(x=>!x.busy)&&!leases.length&&!pending){if(++stable>=2)break;}else stable=0;
    await wait(3000);
   }
   need(stable>=2,'ROLLBACK_DRAIN_TIMEOUT');
   const ownerFile=path.join(controlRoot,'leases/supervisor/owner.json');
   if(fs.existsSync(ownerFile)){
    const owner=json(ownerFile);let alive=true;try{process.kill(owner.pid,0);}catch{alive=false;}
    if(alive){
      const current=readOwner();verifyIndependent(current.owner.pid);
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
  verifyPrevious:async({installedSha,requireRunning})=>{
   if(installedManifest().installedSha!==installedSha)return false;
   if(requireRunning){
    const s=json(path.join(controlRoot,'SUPERVISOR_STATUS.json'));
    if(s.sourceSha!==installedSha||Date.now()-Date.parse(s.at)>45000||!available(apiRunners()))return false;
   }
   return JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore??protectedSnapshot());
  },
  inspectAfterUncertain:async()=>({actualControllerSha:installedManifest().installedSha,
   workflowState:github('actions/workflows/pc-job.yml').state,runners:apiRunners().map(x=>({name:x.name,status:x.status,busy:x.busy}))})
 }};
 return result;
}

function loadApprovedPackage(requestId,file) {
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
 need(actual.state==='open'&&actual.title==='pc-controller-update','MAINTENANCE_REQUEST_CANCELED');
 need(actual.labels?.some(x=>x.name==='pc-maintenance')&&!actual.pull_request,'MAINTENANCE_LABEL');
 const validated=validateUpdateRequest(issue,raw,{actor:data.actor,
  controlRepository,installedSha:installedManifest().installedSha});
 return {...data,issue:validated.request,manifest:validated.manifest};
}

// Recovery-status reads must survive a partially switched/missing host.json.
// Never infer a successful install from the journal alone. An unreadable lock
// is treated as a held recovery lock so the receiver cannot start another job.
export function readMaintenanceRecoveryStatus(requestId,{
 readInstalled=()=>installedManifest().installedSha,
 readLedger=()=>{const file=path.join(recordDir,requestId+'.json');return fs.existsSync(file)?json(file):null;},
 readLock=()=>maintenanceLockStatus(maintenanceRoot,'controller-install'),
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
 const state={status:'STATUS',actualControllerSha,installedReadbackCode,ledger,ledgerReadbackCode,
  installLock,lockReadbackCode};
 return {...state,guidance:maintenanceNextAction(state)};
}

// Current lock observation wins over a historical failed request. Never infer
// that an absent lock proves recovery/installation success; reuse its evidence.
export function maintenanceNextAction(s){
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
  const keys=['schema','requestId','chatId','operation','sourceRepository','sourceBranch','sourceSha'];
  need(Object.keys(body).sort().join(',')===keys.sort().join(',')
    &&body.schema==='ZGMINI_PC_JOB_V1'&&/^[a-z0-9-]{8,80}$/.test(body.requestId),
    'R6_HOST_BACKLOG_ORIGINAL_REQUEST_INVALID');
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
   const rows=github('actions/runners?per_page=100').runners;
   need(Array.isArray(rows)&&rows.length===6
     &&requiredRunners.every(name=>rows.some(row=>row.name===name)),
     'R6_HOST_RUNNER_SET_DRIFT');
   const active=['in_progress','queued','waiting'].reduce((sum,status)=>
     sum+(github(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=1`).total_count||0),0);
   const leases=fs.readdirSync(path.join(controlRoot,'leases')).filter(x=>x!=='supervisor');
   if(rows.every(x=>x.status==='online'&&!x.busy)&&active===0&&leases.length===0){
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
 need(Array.isArray(seatRows)&&seatRows.length===6&&requiredRunners.every(name=>
  seatRows.some(x=>x.name===name&&x.status==='online'&&!x.busy)),
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
  need(Array.isArray(freshRunners)&&freshRunners.length===6
   &&requiredRunners.every(name=>freshRunners.some(x=>x.name===name&&x.status==='online')),
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
 need(cmd==='apply'&&args.length===5&&args[1]==='--request-id'&&args[3]==='--manifest-file','MAINTENANCE_ARGS');
 const data=loadApprovedPackage(requestId,args[4]);
 const {request,ports}=makePorts(data,data.issueNumber);
 // Read-only prerequisite checks before taking the shared installation lease.
 // They are repeated by validate under the lease to prevent a stale preflight
 // from granting permission to stop or switch a changed process.
 readOwner();
 installedManifest();
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
 catch(error){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'UPDATE_ENVIRONMENT_ERROR',actualControllerSha:null}));process.exitCode=1;}
}
