// #996 original Windows PC only: fixed-root observation, NO operational writes.
// The CLI emits a bounded, redacted JSON observation to stdout. It never
// archives a lease, enables a workflow, posts an Issue or retries a pc-job.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';

export const REQUEST_996=Object.freeze({
 requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
 issueNumber:996,
 controllerSha:'badad9124157879d7a645b64f2768113d632355b',
 targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
 maintainerSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
});
const sha=b=>createHash('sha256').update(b).digest('hex');
const hex40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const validTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const validRel=v=>typeof v==='string'&&/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(v);

// The test-only roots below are injected directly by code, never CLI input.
// Production defaults are fixed to the ORIGINAL Windows operating PC.
export const ORIGINAL_ROOTS=Object.freeze({
 control:'E:/ZGmini/automation/pc-control',
 maintenance:'E:/ZGmini/automation/pc-maintenance',
 writer:'E:/ZGmini/data/pc-writer',
});

function checkedRead(root,rel){
 need(typeof rel==='string'&&rel.length>0&&!path.isAbsolute(rel)&&
  !rel.split(/[\\/]/).some(part=>!part||part==='.'||part==='..'),
  'READ_PATH_INVALID');
 need(fs.lstatSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink(),
  'READ_ROOT_REDIRECT');
 let current=root;
 for(const part of rel.split(/[\\/]/)){
  current=path.join(current,part);
  need(!fs.lstatSync(current).isSymbolicLink(),'READ_PATH_REDIRECT');
 }
 const stat=fs.statSync(current);
 need(stat.isFile()&&stat.size<=2_000_000,'READ_FILE_UNSAFE');
 return fs.readFileSync(current);
}
function getFile(root,rel){
 const bytes=checkedRead(root,rel);
 return {bytes,sha256:sha(bytes),value:JSON.parse(bytes.toString('utf8'))};
}
function present(p){try{fs.lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function names(p){return fs.readdirSync(p).sort();}
function fileMap(root,host,sourceRead,sourceSha){
 const map=host?.controllerFiles;
 need(map&&typeof map==='object'&&!Array.isArray(map)&&Object.keys(map).length>=5,
  'CONTROLLER_MAP_INCOMPLETE');
 need(Object.keys(map).every(rel=>validRel(rel)&&hex64(map[rel])),
  'CONTROLLER_MAP_INVALID');
 return Object.keys(map).every(rel=>{
  const current=checkedRead(root,rel);
  return sha(current)===map[rel]&&current.equals(sourceRead(sourceSha,rel));
 });
}
function stageMap(root,host,sourceRead,sourceSha){
 const map=host?.controllerFiles;
 need(map&&typeof map==='object'&&!Array.isArray(map)&&Object.keys(map).length>=5,
  'STAGE_MAP_INCOMPLETE');
 need(Object.keys(map).every(rel=>validRel(rel)&&hex64(map[rel])),
  'STAGE_MAP_INVALID');
 const actual=[];
 for(const folder of ['controller','config']){
  for(const name of names(path.join(root,folder)))actual.push(`${folder}/${name}`);
 }
 need(actual.length===Object.keys(map).length&&actual.every(rel=>Object.hasOwn(map,rel)),
  'STAGE_FILE_SET_DRIFT');
 return Object.keys(map).every(rel=>{
  const current=checkedRead(root,rel);
  return sha(current)===map[rel]&&current.equals(sourceRead(sourceSha,rel));
 });
}
function maintainerMap(root,installed,sourceRead){
 const files=installed?.files,source=installed?.sourceSha;
 const original=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs'];
 const next=[...original,'tools/source-bundle-register.mjs'];
 const expected=source==='4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4'?original:next;
 if(installed?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'||
  !hex40(source)||!files||typeof files!=='object'||Array.isArray(files)||
  Object.keys(files).length!==expected.length||
  !Object.keys(files).every(rel=>expected.includes(rel)&&hex64(files[rel])))return false;
 return expected.every(rel=>{
  const current=checkedRead(root,rel);
  return sha(current)===files[rel]&&current.equals(sourceRead(source,rel));
 });
}
function ownerLive(pid){try{process.kill(pid,0);return true;}
 catch(e){return e.code==='ESRCH'?false:null;}}
function apiRead(route){
 const gh='C:/Program Files/GitHub CLI/gh.exe';
 const out=execFileSync(gh,['api',`repos/ansqhd5774-Choi/zgmini-pc-control/${route}`],
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4e6});
 return JSON.parse(out);
}
function gitRead(sourceSha,rel){
 need(hex40(sourceSha)&&/^(?:controller|config|tools)\/[a-z0-9./-]+$/.test(rel),
  'GIT_SOURCE_ARGUMENT_INVALID');
 return execFileSync('git',['show',`${sourceSha}:${rel}`],{
  cwd:'E:/ZGmini/projects/zgmini-pc-control',windowsHide:true,
  timeout:30000,maxBuffer:2e6});
}
function taskRead(name){
 const schtasks=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
 return sha(execFileSync(schtasks,['/Query','/TN',name,'/XML'],
  {windowsHide:true,timeout:15000,maxBuffer:2e6}));
}
const six=Array.from({length:6},(_,i)=>`zgmini-pc-0${i+1}`);

/** All output fields are curated: never serialize raw ledger, nonce, PID,
 * Issue body, tokens, config contents, GitHub CLI output or source file. */
export function collect996WindowsEvidence({roots=ORIGINAL_ROOTS,api=apiRead,
 isAlive=ownerLive,readTask=taskRead,sourceRead=gitRead,
 now=()=>new Date().toISOString()}={}){
 const id=REQUEST_996.requestId;
 const lease=path.join(roots.maintenance,'leases/controller-install');
 const backup=path.join(roots.control,'backups','controller-update-'+id);
 const stage=path.join(backup,'stage');
 const ledger=getFile(roots.maintenance,`ledger/${id}.json`);
 const owner=getFile(lease,'owner.json');
 const marker=getFile(lease,'RECOVERY_REQUIRED.json');
 const backlog=getFile(roots.maintenance,`backlog/${id}.json`);
 const host=getFile(roots.control,'host.json');
 const staged=getFile(stage,'host.json');
 const maintainer=getFile(roots.maintenance,'MAINTENANCE_INSTALL.json');
 const status=getFile(roots.control,'SUPERVISOR_STATUS.json');
 const supOwner=getFile(roots.control,'leases/supervisor/owner.json');
 const ledgerValue=ledger.value,ownerValue=owner.value,markerValue=marker.value;
 const backlogValue=backlog.value,hostValue=host.value,stageValue=staged.value;
 const maintainerValue=maintainer.value;
 const beforeFiles={stage:stageMap(stage,stageValue,sourceRead,REQUEST_996.targetSha),
  installed:fileMap(roots.control,hostValue,sourceRead,REQUEST_996.controllerSha),
  maintainer:maintainerMap(roots.maintenance,maintainerValue,sourceRead)};
 const windows=backlogValue.windows??[{pausedAt:backlogValue.pausedAt,
  resumedAt:backlogValue.resumedAt}];
 const matchingOwner=Number.isSafeInteger(ownerValue.pid)&&ownerValue.pid>0&&
  /^[a-f0-9-]{36}$/.test(ownerValue.nonce??'')&&
  ownerValue.nonce===markerValue.nonce&&markerValue.requestOwnerPid===ownerValue.pid&&
  validTime(ownerValue.at)&&validTime(markerValue.at)&&validTime(ledgerValue.updatedAt)&&
  Date.parse(ownerValue.at)<=Date.parse(markerValue.at)&&
  Math.abs(Date.parse(markerValue.at)-Date.parse(ledgerValue.updatedAt))<5000;
 const replayMap=backlogValue.replays;
 const backlogOpen=backlogValue.schema==='ZGMINI_PC_BACKLOG_V1'&&
  backlogValue.requestId===id&&Array.isArray(windows)&&windows.length>=1&&
  windows.length<=8&&windows.filter(w=>w?.resumedAt===null).length===1&&
  windows.at(-1)?.resumedAt===null&&validTime(windows.at(-1)?.pausedAt)&&
  backlogValue.resumedAt===null&&replayMap&&typeof replayMap==='object'&&
  !Array.isArray(replayMap)&&Object.values(replayMap).every(r=>
   r&&['DONE','SKIPPED_RESULT_PRESENT'].includes(r.status));
 const stageOnly=present(stage)&&!present(path.join(backup,'snapshot'))&&
  !present(path.join(backup,'PROTECTED_BEFORE.json'))&&
  names(backup).length===1&&names(backup)[0]==='stage'&&
  JSON.stringify(names(stage))===JSON.stringify(['config','controller','host.json']);
 const protectionNow={files:{},tasks:{}};
 for(const name of ['config.json','quota-runner.cmd','run-local.cmd']){
  if(present(path.join(roots.writer,name)))
   protectionNow.files[name]=sha(checkedRead(roots.writer,name));
 }
 for(const name of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'])
  protectionNow.tasks[name]=readTask(name);
 const workflow=api('actions/workflows/pc-job.yml');
 const runners=api('actions/runners?per_page=100');
 const original=api('issues/996');
 let originalBody=null;
 try{originalBody=JSON.parse(original.body);}catch{}
 const rows=runners?.runners??[];
 const runnerListComplete=Number.isSafeInteger(runners?.total_count)&&
  runners.total_count===rows.length&&rows.length<=100;
 const runnerCorrect=runnerListComplete&&six.every(name=>{
  const same=rows.filter(row=>row.name===name);
  return same.length===1&&same[0].status==='online'&&same[0].busy===false;
 });
 const independentRunners=Array.isArray(rows)?rows.filter(r=>!six.includes(r.name)).length:null;
 const supervisorCorrect=supOwner.value.pid===status.value.pid&&
  Number.isSafeInteger(status.value.pid)&&status.value.pid>0&&
  /^[a-f0-9-]{36}$/.test(supOwner.value.nonce??'')&&
  Number.isFinite(supOwner.value.bootAt)&&
  Math.abs(supOwner.value.bootAt-(Date.now()-os.uptime()*1000))<10000&&
  isAlive(status.value.pid)===true&&
  status.value.sourceSha===REQUEST_996.controllerSha&&
  status.value.mode==='LISTENING'&&status.value.children?.length===6&&
  validTime(status.value.at)&&Date.now()-Date.parse(status.value.at)<45000;
 // A second read detects concurrent changes during the GitHub and Task queries.
 const first={ledger:ledger.sha256,owner:owner.sha256,recoveryMarker:marker.sha256,
  backlog:backlog.sha256,controllerHost:host.sha256,stagedHost:staged.sha256,
  maintainerManifest:maintainer.sha256};
 const second={ledger:getFile(roots.maintenance,`ledger/${id}.json`).sha256,
  owner:getFile(lease,'owner.json').sha256,
  recoveryMarker:getFile(lease,'RECOVERY_REQUIRED.json').sha256,
  backlog:getFile(roots.maintenance,`backlog/${id}.json`).sha256,
  controllerHost:getFile(roots.control,'host.json').sha256,
  stagedHost:getFile(stage,'host.json').sha256,
  maintainerManifest:getFile(roots.maintenance,'MAINTENANCE_INSTALL.json').sha256};
 const supervisorOwnerStable=supOwner.sha256===
  getFile(roots.control,'leases/supervisor/owner.json').sha256;
 const afterFiles={stage:stageMap(stage,stageValue,sourceRead,REQUEST_996.targetSha),
  installed:fileMap(roots.control,hostValue,sourceRead,REQUEST_996.controllerSha),
  maintainer:maintainerMap(roots.maintenance,maintainerValue,sourceRead)};
 const checks={
  ledgerPinned:ledgerValue.requestId===id&&ledgerValue.issueNumber===996&&
   ledgerValue.installedShaBefore===REQUEST_996.controllerSha&&
   ledgerValue.targetSha===REQUEST_996.targetSha&&
   ledgerValue.status==='RECOVERY_REQUIRED'&&ledgerValue.phase==='RECOVERY_REQUIRED'&&
   ledgerValue.firstFail==='INTAKE_PAUSED'&&ledgerValue.code==='RUNNER_SET_DRIFT',
  ownerMatched:matchingOwner,ownerDead:matchingOwner&&isAlive(ownerValue.pid)===false,
  recoveryClaimAbsent:!present(path.join(roots.maintenance,'leases/controller-recovery')),
  stageOnly,stagedFilesVerified:stageOnly&&stageValue.controllerSourceSha===REQUEST_996.targetSha&&
   beforeFiles.stage&&afterFiles.stage,
  installedControllerVerified:hostValue.controllerSourceSha===REQUEST_996.controllerSha&&
   beforeFiles.installed&&afterFiles.installed,
  maintainerVerified:maintainerValue.sourceSha===REQUEST_996.maintainerSha&&
   beforeFiles.maintainer&&afterFiles.maintainer,
  backlogOpen:Boolean(backlogOpen),workflowDisabled:workflow.state==='disabled_manually',
  originalIssuePinned:original?.number===996&&original?.user?.login==='ansqhd5774-Choi'&&
   original?.title==='pc-controller-update'&&originalBody?.requestId===id&&
   originalBody?.targetControllerSha===REQUEST_996.targetSha,
  dedicatedRunnersReady:runnerCorrect,supervisorVerified:supervisorCorrect,
  runnerListComplete,
  noOtherControllerLeases:names(path.join(roots.control,'leases')).filter(name=>
   name!=='supervisor'&&!name.startsWith('supervisor.dead-')).length===0,
  stableRawDigests:supervisorOwnerStable&&
   Object.keys(first).every(k=>first[k]===second[k]),
  // Neither disabled_manually nor a journal prove the actual actor who
  // disabled the workflow. No durable pre-pause protection snapshot was found.
  workflowDisableActorVerified:false,
  protectedBaselineVerified:false,
 };
 return {
  schema:'ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1',
  requestId:id,issueNumber:996,observedAt:now(),
  status:Object.values(checks).every(Boolean)?'READONLY_VERIFIED':'C_EVIDENCE_GAPS',
  checks,firstFailedCheck:Object.keys(checks).find(k=>!checks[k])??null,
  digests:first,protectionNowFingerprint:sha(Buffer.from(JSON.stringify(protectionNow))),
  protectedBaselineSha256:null,independentRunnersObserved:independentRunners,
  backlogPauseWindowCount:Array.isArray(windows)?windows.length:null,
  operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false,
  next:'PRESERVE_RECOVERY_LOCK_AND_RESOLVE_UNPROVEN_C_PRECONDITIONS',
 };
}

export function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME,'ORIGINAL_WINDOWS_OPERATOR_REQUIRED');
 need(args.length===0,'READONLY_FIXED_USAGE');
 return collect996WindowsEvidence();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(main(),null,2));}
 catch(e){
  console.log(JSON.stringify({schema:'ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1',
   status:'STATE_UNKNOWN',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'READONLY_INSPECTION_FAILED',
   operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false}));
  process.exitCode=2;
 }
}
