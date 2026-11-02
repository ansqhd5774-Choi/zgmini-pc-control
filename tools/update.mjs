import fs from 'node:fs';import path from 'node:path';import {execFileSync,spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {protectedState,nativeTaskXml} from '../controller/operations.mjs';
const root='E:/ZGmini/automation/pc-control',repo='E:/ZGmini/projects/zgmini-pc-control',remote='ansqhd5774-Choi/zgmini-pc-control',gh='C:/Program Files/GitHub CLI/gh.exe';
const g=args=>execFileSync('git',args,{cwd:repo,windowsHide:true,encoding:'utf8'}),api=(route,args=[])=>{const text=execFileSync(gh,['api','repos/'+remote+'/'+route,...args],{windowsHide:true,encoding:'utf8',maxBuffer:4000000});return text?JSON.parse(text):null;};
const need=(x,c)=>{if(!x)throw Object.assign(Error(c),{code:c});},sha=b=>createHash('sha256').update(b).digest('hex');
let disabled=false,backupVerified=false,backupName=null;
try{
 need(g(['status','--porcelain']).trim()==='','CONTROL_DIRTY');
 // Only the separate, installed maintenance agent supplies this optional pin.
 // The original one-shot manual use remains HEAD-based for compatibility.
 const sourceSha=process.env.ZGMINI_CONTROL_UPDATE_TARGET_SHA||g(['rev-parse','HEAD']).trim();
 need(/^[a-f0-9]{40}$/.test(sourceSha)&&g(['cat-file','-t',sourceSha]).trim()==='commit','CONTROL_TARGET_COMMIT');
 const targetFiles=g(['ls-tree','-r','--name-only',sourceSha]).trim().split(/\r?\n/).filter(x=>x.startsWith('controller/')||x==='config/operations.json');
 const staged=new Map(targetFiles.map(rel=>[rel,execFileSync('git',['show',sourceSha+':'+rel],{cwd:repo,windowsHide:true})]));
 const hostBefore=JSON.parse(fs.readFileSync(path.join(root,'host.json')));
 need(Object.keys(hostBefore.controllerFiles).every(rel=>staged.has(rel)),'CONTROLLER_FILE_REMOVAL_NOT_APPROVED');
 const runners=api('actions/runners').runners;need(runners.length===6&&runners.every(x=>!x.busy&&/^zgmini-pc-0[1-6]$/.test(x.name)),'RUNNERS_NOT_IDLE');
 // Validate a restorable hash-bound backup BEFORE interrupting request intake.
 const backup=path.join(root,'backups','controller-'+Date.now());backupName=path.basename(backup);
 fs.mkdirSync(backup,{recursive:true});for(const rel of ['controller','config'])fs.cpSync(path.join(root,rel),path.join(backup,rel),{recursive:true});fs.copyFileSync(path.join(root,'host.json'),path.join(backup,'host.json'));
 const host=JSON.parse(fs.readFileSync(path.join(root,'host.json')));for(const [rel,expected] of Object.entries(host.controllerFiles))need(sha(fs.readFileSync(path.join(root,rel)))===expected,'CURRENT_CONTROLLER_DRIFT');
 const backed=JSON.parse(fs.readFileSync(path.join(backup,'host.json')));
 need(sha(fs.readFileSync(path.join(backup,'host.json')))===sha(fs.readFileSync(path.join(root,'host.json'))),'BACKUP_HOST_DRIFT');
 for(const [rel,expected] of Object.entries(backed.controllerFiles))need(sha(fs.readFileSync(path.join(backup,rel)))===expected,'BACKUP_FILE_VERIFICATION_FAILED');
 backupVerified=true;
 api('actions/workflows/pc-job.yml/disable',['--method','PUT']);disabled=true;
 need(api('actions/runs?status=in_progress&per_page=30').total_count===0&&api('actions/runs?status=queued&per_page=30').total_count===0,'CONTROL_JOBS_PENDING_STOP');
 need(fs.readdirSync(path.join(root,'leases')).every(x=>x==='supervisor'),'JOB_LEASE_PRESENT_STOP');
 const before=protectedState('E:/ZGmini/data',{queryTask:nativeTaskXml}),state=JSON.parse(fs.readFileSync(path.join(root,'SUPERVISOR_STATUS.json'))),owner=JSON.parse(fs.readFileSync(path.join(root,'leases/supervisor/owner.json')));
 need(state.pid===owner.pid&&Date.now()-Date.parse(state.at)<45000,'SUPERVISOR_IDENTITY_STALE');
 need(sha(fs.readFileSync(path.join(root,'host.json')))===sha(fs.readFileSync(path.join(backup,'host.json'))),'CONTROLLER_DRIFT_DURING_DRAIN');
 execFileSync('taskkill.exe',['/PID',String(state.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:15000});
 for(let i=0;i<10;i++){let alive=true;try{process.kill(state.pid,0);}catch{alive=false;}if(!alive)break;await new Promise(r=>setTimeout(r,500));if(i===9)throw Object.assign(Error('SUPERVISOR_STILL_PRESENT'),{code:'SUPERVISOR_STILL_PRESENT'});}
 let offlineObserved=false,offlineCount=0;for(let i=0;i<10;i++){const a=api('actions/runners').runners;offlineCount=a.filter(x=>x.status==='offline').length;if(offlineCount){offlineObserved=true;break;}await new Promise(r=>setTimeout(r,1000));}
 const hashes={};for(const [rel,bytes] of staged){const dest=path.join(root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);need(sha(fs.readFileSync(dest))===sha(bytes),'CONTROLLER_APPLY_READBACK_FAILED');hashes[rel]=sha(bytes);}
 host.controllerFiles=hashes;host.controllerSourceSha=sourceSha;fs.writeFileSync(path.join(root,'host.json'),JSON.stringify(host,null,2));
 const lease=path.resolve(root,'leases/supervisor'),archived=path.resolve(backup,'supervisor-lease');need(lease.startsWith(path.resolve(root)+path.sep)&&archived.startsWith(path.resolve(root)+path.sep),'OWN_LEASE_PATH');fs.renameSync(lease,archived);
 const child=spawn(process.execPath,[path.join(root,'controller/supervisor.mjs')],{cwd:root,windowsHide:true,detached:true,stdio:'ignore'});child.unref();
 let afterRunners;for(let i=0;i<20;i++){afterRunners=api('actions/runners').runners;if(afterRunners.length===6&&afterRunners.every(x=>x.status==='online'))break;await new Promise(r=>setTimeout(r,1500));}
 need(afterRunners.every(x=>x.status==='online'),'RECONNECT_NOT_CONFIRMED');const after=protectedState('E:/ZGmini/data',{queryTask:nativeTaskXml});need(JSON.stringify(before)===JSON.stringify(after),'PROTECTED_STATE_DRIFT');
 api('actions/workflows/pc-job.yml/enable',['--method','PUT']);disabled=false;
 const report={status:'CONTROLLER_UPDATED_SIX_RECONNECTED',at:new Date().toISOString(),controlSourceSha:sourceSha,backup:backupName,backupVerified,offlineObserved,offlineCountObserved:offlineCount,onlineAfter:afterRunners.length,oldSupervisorPid:state.pid,newSupervisorPid:child.pid,existingCoreStopped:false,protectedStateUnchanged:true,beforeSha256:sha(JSON.stringify(before)),afterSha256:sha(JSON.stringify(after)),registrationCredentialsReused:true,workflowReenabled:true};fs.writeFileSync(path.join(root,'UPDATE_RESULT_'+Date.now()+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){console.error(JSON.stringify({status:'UPDATE_STOP',code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'UPDATE_ENVIRONMENT_ERROR',backup:backupName,backupVerified,controlWorkflowDisabled:disabled,instruction:'INSPECT_BEFORE_RETRY_NO_CORE_CHANGES'}));process.exitCode=1;}
