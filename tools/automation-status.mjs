// Read-only fixed-root operational summary. No Issue creation or execution.
import fs from 'node:fs';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {maintenanceLockStatus} from './maintenance-lock.mjs';
import {maintenanceNextAction,dedicatedPcRunnerRows} from './update.mjs';
const control='E:/ZGmini/automation/pc-control',maintenance='E:/ZGmini/automation/pc-maintenance';
const repo='ansqhd5774-Choi/zgmini-pc-control',gh='C:/Program Files/GitHub CLI/gh.exe';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
// Only the six ZGMINI operating seats determine Controller runtime health.
// Independently registered handoff/other runners must not falsify this status.
export function dedicatedPcRunnersOnline(rows){
 return dedicatedPcRunnerRows(rows,{requireOnline:true})!==null;
}
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
  &&hash(readBytes(path.join(rootDir,p)))===files[p]);
}
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{code:c});};
const live=pid=>{if(!Number.isSafeInteger(pid)||pid<=0)return null;try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};

export function summarizeAutomation(s){
 const base=maintenanceNextAction(s);
 const healthy=s.controllerFilesVerified===true&&s.supervisorAlive===true&&s.supervisorIdentityVerified===true&&
  s.supervisorFresh===true&&s.supervisorChildrenVerified===true&&s.runnerSetOnline===true&&s.workflowState==='active';
 return {...base,runtimeState:healthy?'HEALTHY':'UNVERIFIED',
  controllerState:healthy?'HEALTHY':'UNVERIFIED',
  maintenanceState:s.maintenanceFilesVerified===true&&s.receiverIdentityVerified===true&&s.receiverFresh===true&&s.receiverListening===true?'HEALTHY':'UNVERIFIED',
  automationState:healthy&&s.maintenanceFilesVerified===true&&s.receiverIdentityVerified===true&&s.receiverFresh===true&&s.receiverListening===true?'HEALTHY':'PARTIAL_OR_UNVERIFIED',
  installedOperations:s.installedOperations??[],
  next:base.state==='NO_ACTIVE_INSTALL_LEASE'&&!healthy?'DIAGNOSE_CURRENT_RUNTIME_WITHOUT_REPLAYING_OLD_UPDATE':base.next,
  intakeToolPermission:'NOT_TESTED_BY_PC_STATUS',
  intakeNote:'GitHub read access and Runner health do not prove this chat may submit a maintenance request.'};
}

export function collectAutomationStatus(args=process.argv.slice(2)){
 need(process.platform==='win32','STATUS_WINDOWS_REQUIRED');
 need(args.length===0||(args.length===2&&args[0]==='--request-id'&&/^pc-[a-z0-9-]{8,76}$/.test(args[1])),'STATUS_ARGS');
 const codes=[];const observe=(label,f)=>{try{return f();}catch{codes.push(label);return null;}};
 const host=observe('CONTROLLER_MANIFEST_UNAVAILABLE',()=>read(control+'/host.json'));
 const installed=observe('MAINTENANCE_MANIFEST_UNAVAILABLE',()=>read(maintenance+'/MAINTENANCE_INSTALL.json'));
 const maintenanceVerified=observe('MAINTENANCE_FILES_UNVERIFIED',()=>{
  return verifyMaintenanceManifest(installed,maintenance);
 });
 const receiver=observe('RECEIVER_STATUS_UNAVAILABLE',()=>read(maintenance+'/RECEIVER_STATUS.json'));
 const receiverOwner=observe('RECEIVER_OWNER_UNAVAILABLE',()=>read(maintenance+'/leases/receiver/owner.json'));
 const verified=observe('CONTROLLER_FILES_UNVERIFIED',()=>{
  need(Object.keys(host?.controllerFiles??{}).length>=5,'FILES_MISSING');
  return Object.entries(host.controllerFiles).every(([p,h])=>{
   need(/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p),'FILE_PATH');
   return hash(fs.readFileSync(path.join(control,p)))===h;
  });
 });
 const supervisor=observe('SUPERVISOR_STATUS_UNAVAILABLE',()=>read(control+'/SUPERVISOR_STATUS.json'));
 const owner=observe('SUPERVISOR_OWNER_UNAVAILABLE',()=>read(control+'/leases/supervisor/owner.json'));
 const lock=observe('INSTALL_LEASE_UNAVAILABLE',()=>maintenanceLockStatus(maintenance,'controller-install'));
 const github=route=>JSON.parse(execFileSync(gh,['api',`repos/${repo}/${route}`],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:2e6}));
 const rows=observe('RUNNERS_QUERY_UNAVAILABLE',()=>github('actions/runners?per_page=100').runners);
 const workflow=observe('WORKFLOW_QUERY_UNAVAILABLE',()=>github('actions/workflows/pc-job.yml').state);
 const operations=observe('INSTALLED_OPERATIONS_UNAVAILABLE',()=>Object.keys(read(control+'/config/operations.json').operations));
 const ledger=args.length?observe('REQUEST_LEDGER_UNAVAILABLE',()=>read(maintenance+'/ledger/'+args[1]+'.json')):null;
 const state={actualControllerSha:host?.controllerSourceSha??null,
  installedReadbackCode:verified===true?null:'CONTROLLER_FILES_UNVERIFIED',
  lockReadbackCode:lock?null:'INSTALL_LEASE_UNAVAILABLE',
  ledgerReadbackCode:args.length&&!ledger?'REQUEST_LEDGER_UNAVAILABLE':null,
  installLock:lock??{held:true,recoveryRequired:true},ledger,
  controllerFilesVerified:verified===true,supervisorAlive:live(owner?.pid),
  supervisorIdentityVerified:Boolean(owner?.nonce&&owner.pid===supervisor?.pid&&supervisor.sourceSha===host?.controllerSourceSha),
  supervisorFresh:Date.now()-Date.parse(supervisor?.at??'')>=0&&Date.now()-Date.parse(supervisor?.at??'')<45000,
  supervisorChildrenVerified:supervisor?.mode==='LISTENING'&&supervisor?.children?.length===6&&Array.from({length:6},(_,i)=>i+1).every(seat=>supervisor.children.filter(c=>c.seat===seat&&c.alive===true&&live(c.pid)===true).length===1),
  runnerSetOnline:dedicatedPcRunnersOnline(rows),
  workflowState:workflow,installedOperations:operations};
 Object.assign(state,{maintenanceFilesVerified:maintenanceVerified===true,
  receiverIdentityVerified:Boolean(receiverOwner?.nonce&&receiver?.pid===receiverOwner.pid&&live(receiverOwner.pid)===true),
  receiverFresh:Date.now()-Date.parse(receiver?.at??'')>=0&&Date.now()-Date.parse(receiver?.at??'')<180000,
  receiverListening:receiver?.status==='LISTENING'});
 return {schema:'ZGMINI_PC_AUTOMATION_STATUS_V1',observedAt:new Date().toISOString(),
  freshnessSeconds:45,collectorSource:'tools/automation-status.mjs',...summarizeAutomation(state),
  actualControllerSha:state.actualControllerSha,maintenanceSourceSha:installed?.sourceSha??null,
  installLock:state.installLock,workflowState:workflow,
  receiverObservedAt:receiver?.at??null,receiverStatus:receiver?.status??null,maintenanceFilesVerified:state.maintenanceFilesVerified,
  runners:rows?.map(x=>({name:x.name,status:x.status,busy:x.busy}))??null,
  historicalRequest:ledger?{requestId:ledger.requestId,status:ledger.status,code:ledger.code}:null,
  diagnostics:codes,operationalWrites:0,providerCalls:0,dbD1Writes:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(collectAutomationStatus()));}catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:e.code??'STATUS_FAILED',operationalWrites:0}));process.exitCode=2;}
}
