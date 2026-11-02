// Approved Controller updater. Must be called by the independent PC maintenance
// listener, NEVER from a GitHub Actions job or a supervisor child process.
// Preserves the original update.mjs workflow: drain, protect, backup, stop only
// the dedicated supervisor, replace controller/config, reconnect six listeners.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyApprovedUpdate} from './maintenance-apply.mjs';
import {validateUpdateRequest,validateMaintenanceRequest,
 validateControllerConfigTransition} from './maintenance-contract.mjs';
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

// The process must not inherit the Runner Actions job. On Windows also verify
// its ancestry via CIM before using taskkill /T against the supervisor tree.
function verifyIndependent(supervisorPid) {
 need(process.platform==='win32','WINDOWS_PC_REQUIRED');
 need(!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&!process.env.GITHUB_RUN_ID,'MAINTENANCE_PROCESS_NOT_INDEPENDENT');
 const checker=path.join(maintenanceRoot,'tools/maintenance-ancestry.vbs');
 need(fs.existsSync(checker),'MAINTENANCE_ANCESTRY_CHECK_MISSING');
 const result=execFileSync('cscript.exe',['//NoLogo','//B',checker,
  String(process.pid),String(supervisorPid)],{windowsHide:true,encoding:'utf8',timeout:12000}).trim();
 need(result==='INDEPENDENT','MAINTENANCE_PROCESS_NOT_INDEPENDENT');
}

function readOwner() {
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
 let plannedFiles=[],protectedBefore,oldOwner,pausedByUs=false,postIssueNumber;
 const apiRunners=()=>github('actions/runners?per_page=100').runners;
 const runnersCorrect=rows=>rows?.length===6&&requiredRunners.every(n=>rows.some(x=>x.name===n));
 const available=rows=>runnersCorrect(rows)&&rows.every(x=>x.status==='online'&&!x.busy);
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
   validateControllerConfigTransition(oldOperations,nextOperations);
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
   const child=spawn(node,[path.join(controlRoot,'controller/supervisor.mjs')],{cwd:controlRoot,windowsHide:true,detached:true,stdio:'ignore'});child.unref();
   for(let n=0;n<40;n++){
    const status=fs.existsSync(path.join(controlRoot,'SUPERVISOR_STATUS.json'))?json(path.join(controlRoot,'SUPERVISOR_STATUS.json')):null;
    if(status?.pid===child.pid&&status.sourceSha===manifest.targetSha&&Date.now()-Date.parse(status.at)<30000&&
      status.children?.length===6&&runnersCorrect(apiRunners())&&apiRunners().every(x=>x.status==='online')){
      need(JSON.stringify(protectedSnapshot())===JSON.stringify(protectedBefore),'PROTECTED_STATE_DRIFT');return;
    }
    await wait(1500);
   }
   throw Object.assign(Error('SIX_RUNNERS_RECONNECT_NOT_VERIFIED'),{code:'SIX_RUNNERS_RECONNECT_NOT_VERIFIED'});
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
   const child=spawn(node,[path.join(controlRoot,'controller/supervisor.mjs')],{cwd:controlRoot,windowsHide:true,detached:true,stdio:'ignore'});child.unref();
   for(let n=0;n<40;n++){
    const s=fs.existsSync(path.join(controlRoot,'SUPERVISOR_STATUS.json'))?json(path.join(controlRoot,'SUPERVISOR_STATUS.json')):null;
    if(s?.pid===child.pid&&s.sourceSha===manifest.installedSha&&runnersCorrect(apiRunners())&&apiRunners().every(x=>x.status==='online'))return;
    await wait(1500);
   }
   throw Object.assign(Error('ROLLBACK_RECONNECT_FAILED'),{code:'ROLLBACK_RECONNECT_FAILED'});
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
 return {status:'STATUS',actualControllerSha,installedReadbackCode,ledger,ledgerReadbackCode,
  installLock,lockReadbackCode};
}

export async function command(args=process.argv.slice(2)) {
 need(args.length>=1,'MAINTENANCE_SUBCOMMAND_REQUIRED');
 const cmd=args[0],requestId=safeId(args[2]);
 if(cmd==='status'){
  need(args.length===3&&args[1]==='--request-id','MAINTENANCE_ARGS');
  return readMaintenanceRecoveryStatus(requestId);
 }
 need(cmd==='apply'&&args.length===5&&args[1]==='--request-id'&&args[3]==='--manifest-file','MAINTENANCE_ARGS');
 const data=loadApprovedPackage(requestId,args[4]);
 const {request,ports}=makePorts(data,data.issueNumber);
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
