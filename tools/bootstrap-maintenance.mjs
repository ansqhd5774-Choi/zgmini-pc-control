// One-time local operator bootstrap only. Not callable by pc-job or a Runner.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const repo='E:/ZGmini/projects/zgmini-pc-control';
const root='E:/ZGmini/automation/pc-control-maintenance';
const control='E:/ZGmini/automation/pc-control';
const remote='ansqhd5774-Choi/zgmini-pc-control';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const schtasks=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
const taskName='ZGMINI-PC-Control-Maintenance';
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(yes,code)=>{if(!yes)throw Object.assign(Error(code),{code});};
const git=(args,options={})=>execFileSync('git',['-C',repo,...args],{windowsHide:true,encoding:options.binary?undefined:'utf8',timeout:45000});
const api=(route,method='GET',body)=>{
 const args=['api','-X',method,'repos/'+remote+'/'+route];if(body)args.push('--input','-');
 const output=execFileSync(gh,args,{windowsHide:true,encoding:'utf8',timeout:30000,input:body?JSON.stringify(body):undefined});
 return output?.trim()?JSON.parse(output):null;
};
const sourceSha=process.argv[2];
let phase='PREFLIGHT';
try{
 need(/^[a-f0-9]{40}$/.test(sourceSha??''),'BOOTSTRAP_SHA_REQUIRED');
 need(!fs.existsSync(root),'MAINTENANCE_ROOT_ALREADY_EXISTS');
 const groups=execFileSync('whoami.exe',['/groups','/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true});
 need(Number(groups.match(/S-1-16-(\d+)/)?.[1])===8192,'MAINTENANCE_ELEVATION_NOT_ALLOWED');
 need(git(['status','--porcelain']).trim()==='','CONTROL_CHECKOUT_DIRTY');
 need(git(['cat-file','-t',sourceSha]).trim()==='commit','BOOTSTRAP_TARGET_COMMIT_NOT_FOUND');
 try{git(['merge-base','--is-ancestor',sourceSha,'HEAD']);}catch{throw Object.assign(Error('BOOTSTRAP_SOURCE_NOT_IN_CHECKOUT'),{code:'BOOTSTRAP_SOURCE_NOT_IN_CHECKOUT'});}
 const remoteUrl=git(['remote','get-url','origin']).trim();
 need(['https://github.com/'+remote+'.git','git@github.com:'+remote+'.git'].includes(remoteUrl),'UNEXPECTED_CONTROL_REMOTE');
 const names=['contract.mjs','processor.mjs','agent.mjs'];
 const source=new Map();
 for(const name of names){
  const rel='maintenance/'+name,fromCommit=git(['show',sourceSha+':'+rel],{binary:true});
  need(fs.existsSync(path.join(repo,rel))&&sha(fs.readFileSync(path.join(repo,rel)))===sha(fromCommit),'BOOTSTRAP_WORKTREE_DRIFT');
  source.set(name,fromCommit);
 }
 const updater=git(['show',sourceSha+':tools/update.mjs'],{binary:true});
 need(sha(fs.readFileSync(path.join(repo,'tools/update.mjs')))===sha(updater),'MAINTENANCE_UPDATER_DRIFT');
 need(fs.existsSync(path.join(control,'host.json')),'CONTROLLER_HOST_NOT_FOUND');
 const before=fs.readFileSync(path.join(control,'host.json'));
 need(JSON.parse(before).controllerSourceSha!==sourceSha,'CONTROLLER_ALREADY_AT_BOOTSTRAP_TARGET');
 try{execFileSync(schtasks,['/Query','/TN',taskName],{windowsHide:true,stdio:'ignore',timeout:10000});
  throw Object.assign(Error('MAINTENANCE_TASK_EXISTS'),{code:'MAINTENANCE_TASK_EXISTS'});
 }catch(error){if(error.code==='MAINTENANCE_TASK_EXISTS')throw error;}
 const r=api('actions/runners?per_page=100')?.runners;
 need(Array.isArray(r)&&r.length===6&&r.every(x=>/^zgmini-pc-0[1-6]$/.test(x.name)),'EXISTING_RUNNERS_CHANGED');
 for(const [name,color] of [['pc-controller-update','1d76db'],['pc-job-replay','c2e0c6']]){
  let exists=false;
  try{exists=api('labels/'+name)?.name===name;}catch{}
  if(!exists)api('labels','POST',{name,color,description:'Fixed ZGMINI private PC maintenance protocol'});
 }
 phase='CREATE_OWN_MAINTENANCE_ROOT';
 fs.mkdirSync(root,{recursive:false});
 for(const [name,bytes] of source)fs.writeFileSync(path.join(root,name),bytes,{flag:'wx'});
 fs.mkdirSync(path.join(root,'ledger'));
 const config={schema:'ZGMINI_PC_MAINTENANCE_BOOTSTRAP_V1',controlRepository:remote,sourceSha,
  approvedBootstrapTargetSha:sourceSha,updateToolSha256:sha(updater),
  files:Object.fromEntries([...source].map(([name,bytes])=>[name,sha(bytes)])),
  installedAt:new Date().toISOString(),maxRunners:6};
 fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
 phase='CREATE_ONLY_OWN_TASK';
 const node='E:\\ZGmini\\runtime\\node.exe';const script='E:\\ZGmini\\automation\\pc-control-maintenance\\agent.mjs';
 const taskRun=`\"${node}\" \"${script}\"`;
 execFileSync(schtasks,['/Create','/TN',taskName,'/SC','MINUTE','/MO','1','/RL','LIMITED','/IT','/TR',taskRun],
  {windowsHide:true,timeout:15000,stdio:'ignore'});
 phase='VERIFY_OWN_TASK';
 const xml=execFileSync(schtasks,['/Query','/TN',taskName,'/XML'],{windowsHide:true,timeout:10000,maxBuffer:262144});
 const taskText=xml[0]===0xff&&xml[1]===0xfe?xml.subarray(2).toString('utf16le'):xml.toString('utf8');
 need(taskText.includes('pc-control-maintenance')&&taskText.includes('agent.mjs'),'MAINTENANCE_TASK_ACTION_MISMATCH');
 need(sha(fs.readFileSync(path.join(control,'host.json')))===sha(before),'CONTROLLER_HOST_CHANGED_DURING_BOOTSTRAP');
 const result={status:'MAINTENANCE_BOOTSTRAP_INSTALLED',sourceSha,taskName,root,runnerCountBefore:6,
  existingControllerUnchanged:true,controllerSourceSha:JSON.parse(before).controllerSourceSha,
  taskXmlSha256:sha(xml),files:config.files,adminElevation:false,at:new Date().toISOString(),
  next:'GITHUB_PC_CONTROLLER_UPDATE_ISSUE_NOT_COMMAND'};
 fs.writeFileSync(path.join(root,'BOOTSTRAP_RESULT.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'BOOTSTRAP_ENVIRONMENT_ERROR',phase,
  maintenanceRootExists:fs.existsSync(root),instruction:'INSPECT_OWN_TASK_AND_FILES_NO_AUTOMATIC_RETRY'}));process.exitCode=1;}
