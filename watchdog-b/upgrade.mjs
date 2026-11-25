// Narrow Windows B transaction: upgrade only the *independent watchdog*
// using the existing operational Actions Runner. Never hand off the maintainer
// or stop/kill any running process from the Runner.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {protection} from '../tools/install-runner-watchdog.mjs';
import {TARGET,ORIGINAL,REPLACEMENT,INITIAL_SCOPE,FINAL_SCOPE,
  APPROVED_CONTROLLER_SHA,NEXT_TARGET,NEXT_SOURCE_SHA,
  parseCanonicalBody,validateRequest,validateR3Request,decideUpgradeState,error} from './contract.mjs';
import {R4_TARGET,R4_PREIMAGE_SHA256,R4_SOURCE_SHA256,
 validateR4Request,verifyR4ControllerHost,projectR4InstalledManifest}
 from './standby-r4-contract.mjs';

const repoRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const home='E:/ZGmini/automation/pc-watchdog';
const maintenance='E:/ZGmini/automation/pc-maintenance';
const controller='E:/ZGmini/automation/pc-control';
const manifestFor=body=>path.join(repoRoot,'approvals/watchdog-upgrades',
 body.targetSha===R4_TARGET?R4_TARGET+'.json':
 body.targetSha===NEXT_TARGET?NEXT_TARGET+'.json':TARGET+'-r2.json');
const sourceFile=path.join(repoRoot,'tools/runner-watchdog.mjs');
const installedFile=path.join(home,'runner-watchdog.mjs');
const installedManifest=path.join(home,'INSTALL.json');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const requireFile=file=>{
 const info=fs.lstatSync(file);
 if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)
  throw error('WATCHDOG_B_FILE_ALIAS_OR_HARDLINK');
 return info;
};
const requireDirectory=file=>{
 const info=fs.lstatSync(file);
 if(!info.isDirectory()||info.isSymbolicLink())
  throw error('WATCHDOG_B_DIRECTORY_ALIAS');
};
const alive=pid=>{
 if(!Number.isSafeInteger(pid)||pid<=0)return null;
 try{process.kill(pid,0);return true;}
 catch(e){return e.code==='ESRCH'?false:null;}
};
const safeCode=reason=>/^[A-Z][A-Z0-9_]{2,90}$/.test(String(reason??''))
  ?reason:'WATCHDOG_B_UNCLASSIFIED';
const writeOnce=(file,record)=>fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n',
 {flag:'wx',mode:0o600});
function localAcl(file){
 const cmd='C:/Windows/System32/icacls.exe';
 let output;
 try{output=execFileSync(cmd,[file],{encoding:'utf8',windowsHide:true,
   timeout:15000,maxBuffer:64_000});}
 catch{throw error('WATCHDOG_B_ACL_READ_FAILED');}
 const rows=output.replace(/\r/g,'').split('\n').filter(Boolean);
 const prefix=path.win32.normalize(file).toLowerCase();
 const first=(rows[0]??'').trimStart();
 if(!first.toLowerCase().startsWith(prefix))
  throw error('WATCHDOG_B_ACL_PARSE_UNCERTAIN');
 const entries=[first.slice(prefix.length),...rows.slice(1)]
  .map(row=>row.trim()).filter(row=>row.includes(':('));
 if(entries.length===0||entries.some(row=>row.length>300))
  throw error('WATCHDOG_B_ACL_PARSE_UNCERTAIN');
 return entries.sort().join('|');
}
// Source-approved Controller identity is checked at transaction time; the
// historical first-install Watchdog protection snapshot is NOT reset/replaced.
export function requireCurrentProtection({historical,current}){
 if(!historical||typeof historical!=='object'||Array.isArray(historical)
   ||!current||typeof current!=='object'||Array.isArray(current))
   throw error('WATCHDOG_B_PROTECTION_SCHEMA_INVALID');
 const fixed=new Set([
  'ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea',
  'ZGMINI-PC-Iran-Progress-R13',
  'E:/ZGmini/data/pc-writer/config.json',
  'E:/ZGmini/data/pc-writer/quota-runner.cmd',
  'E:/ZGmini/data/pc-writer/run-local.cmd',
  'E:/ZGmini/automation/pc-control/host.json']);
 if([...Object.keys(historical),...Object.keys(current)]
    .some(key=>!fixed.has(key))
   ||Object.keys(historical).some(key=>!Object.hasOwn(current,key))
   ||current['ZGMINI-PC-Iran-Progress-R13']!=='APPROVED_RETIRED_ABSENT'
   ||!(/^[a-f0-9]{64}$/.test(current['ZGMINI-PC-Local-Core']??''))
   ||!(/^[a-f0-9]{64}$/.test(current['ZGMINI-PC-Local-Korea']??''))
   ||!(/^[a-f0-9]{64}$/.test(
      current['E:/ZGmini/automation/pc-control/host.json']??'')))
   throw error('WATCHDOG_B_PROTECTED_SHAPE_OR_IRAN_INVALID');
 // Core and Korea Task digests are immutable since the first-install snapshot.
 // Approved Writer/Controller/Iran transitions do not authorize Task drift.
 for(const task of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']){
  if(!Object.hasOwn(historical,task)||historical[task]!==current[task])
   throw error('WATCHDOG_B_CORE_KOREA_TASK_DRIFT');
 }
 for(const [key,value] of Object.entries(current)){
  if(key==='ZGMINI-PC-Iran-Progress-R13')continue;
  if(!/^[a-f0-9]{64}$/.test(String(value??'')))
   throw error('WATCHDOG_B_PROTECTED_VALUE_INVALID');
 }
 return true;
}
export function verifyApprovedControllerHost(host,expected=APPROVED_CONTROLLER_SHA,
  readSource=(rel)=>fs.readFileSync(path.join(controller,rel))){
 if(host?.controllerSourceSha!==expected
   ||!host.controllerFiles||typeof host.controllerFiles!=='object'
   ||Array.isArray(host.controllerFiles)
   ||Object.keys(host.controllerFiles).length===0)
  throw error('WATCHDOG_B_APPROVED_CONTROLLER_SHA_DRIFT');
 for(const [relative,expectedHash] of Object.entries(host.controllerFiles)){
  const exactPath=path.resolve(controller,relative);
  if(!exactPath.startsWith(path.resolve(controller)+path.sep)
    ||!(/^[a-f0-9]{64}$/.test(expectedHash))
    ||digest(readSource(relative))!==expectedHash)
   throw error('WATCHDOG_B_CONTROLLER_FILE_HASH_DRIFT');
 }
 return true;
}
export function verifyWatchdogUpgradeSnapshot({sourceBytes,installBytes,
  sourceHash,install,owner,status,aliveOwner,existingClaim,now=Date.now(),
  expectedSourceSha=ORIGINAL,expectedScope=INITIAL_SCOPE}){
 if(digest(sourceBytes)!==expectedSourceSha||sourceHash!==expectedSourceSha)
  throw error('WATCHDOG_B_PREIMAGE_SHA_MISMATCH');
 if(install.sha256!==expectedSourceSha||install.scope!==expectedScope)
  throw error('WATCHDOG_B_PREIMAGE_INSTALL_MISMATCH');
 if(decideUpgradeState({existingClaim,installedDigest:sourceHash,
   expectedDigest:expectedSourceSha,status,owner,ownerAlive:aliveOwner,now})!=='READY')
  throw error('WATCHDOG_B_ACTIVE_OWNER_OR_CAS_STOP');
 if(!Buffer.isBuffer(installBytes)||installBytes.length<10)
  throw error('WATCHDOG_B_PREIMAGE_MANIFEST_INVALID');
 return true;
}
export async function execute(){
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'
   ||!process.env.RUNNER_NAME||process.env.GITHUB_RUN_ATTEMPT!=='1'
   ||process.env.GITHUB_EVENT_ACTION!=='opened')
  throw error('WATCHDOG_B_EXACT_ACTIONS_RUNNER_REQUIRED');
 const eventPath=process.env.GITHUB_EVENT_PATH;
 if(!eventPath||!path.isAbsolute(eventPath))throw error('WATCHDOG_B_EVENT_MISSING');
 const event=readJSON(eventPath);
 const body=parseCanonicalBody(event?.issue?.body);
 const approvalBytes=fs.readFileSync(manifestFor(body)),approval=JSON.parse(approvalBytes);
 const newBytes=fs.readFileSync(sourceFile);
 requireDirectory(home);
 requireFile(installedFile);requireFile(installedManifest);
 const oldBytes=fs.readFileSync(installedFile);
 const oldManifestBytes=fs.readFileSync(installedManifest);
 const installed=JSON.parse(oldManifestBytes);
 const r4=body.targetSha===R4_TARGET;
 const r3=body.targetSha===NEXT_TARGET;
 const oldSha=r4?R4_PREIMAGE_SHA256:r3?REPLACEMENT:ORIGINAL;
 const nextSha=r4?R4_SOURCE_SHA256:r3?NEXT_SOURCE_SHA:REPLACEMENT;
 const targetSha=r4?R4_TARGET:r3?NEXT_TARGET:TARGET;
 const oldScope=r3||r4?FINAL_SCOPE:INITIAL_SCOPE;
 const request=r4
  ?validateR4Request(event,body,approval,installed,digest(newBytes),
    digest(approvalBytes),digest(oldManifestBytes))
  :r3?validateR3Request(event,body,approval,installed,
    digest(newBytes),digest(approvalBytes))
  :validateRequest(event,body,approval,installed,digest(newBytes),digest(approvalBytes));
 if(!Number.isSafeInteger(request.issueNumber)||request.issueNumber<1)
  throw error('WATCHDOG_B_ISSUE_NUMBER_INVALID');
 if(fs.existsSync(path.join(maintenance,'leases/controller-install'))
   ||fs.existsSync(path.join(controller,'DRAIN'))
   ||fs.existsSync(path.join(home,'PAUSE')))
  throw error('WATCHDOG_B_SHARED_TRANSITION_ACTIVE');
 const startup=path.join(process.env.APPDATA??'',
  'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_CONTROL.vbs');
 requireFile(startup);
 if(digest(fs.readFileSync(startup))!==installed.startupSha256)
  throw error('WATCHDOG_B_GUARDIAN_STARTUP_DRIFT');
 const historicalProtection=readJSON(path.join(home,'PROTECTION_BEFORE.json'));
 const protectionBefore=protection();
 requireCurrentProtection({historical:historicalProtection,current:protectionBefore});
 const controllerHost=readJSON(path.join(controller,'host.json'));
 verifyApprovedControllerHost(controllerHost,r4?R4_TARGET:APPROVED_CONTROLLER_SHA);
 if(r4)verifyR4ControllerHost(controllerHost);
 const owner=readJSON(path.join(home,'receiver/owner.json'));
 const status=readJSON(path.join(home,'STATUS.json'));
 const requests=path.join(home,'upgrades');
 if(fs.existsSync(requests))requireDirectory(requests);
 const claim=path.join(requests,request.requestId+'.json');
 verifyWatchdogUpgradeSnapshot({sourceBytes:oldBytes,installBytes:oldManifestBytes,
  sourceHash:digest(oldBytes),install:installed,owner,status,
  aliveOwner:alive(owner?.pid),existingClaim:fs.existsSync(claim),
  expectedSourceSha:oldSha,expectedScope:oldScope});
 const originalSourceAcl=localAcl(installedFile);
 const originalManifestAcl=localAcl(installedManifest);
 // Preflight is complete: this B request becomes single-use BEFORE any write.
 fs.mkdirSync(requests,{recursive:true});
 const attempt={schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
  requestId:request.requestId,issueNumber:request.issueNumber,
  targetSha,installedSourceSha256Before:oldSha,
  targetSourceSha256:nextSha,status:'RUNNING',code:'WATCHDOG_B_ATTEMPT_CLAIMED',
  writes:0,at:new Date().toISOString()};
 writeOnce(claim,attempt);
 let stage='CLAIMED';
 const backup=path.join(home,'backups','watchdog-upgrade-'+request.requestId);
 const publish=(status,code,writes)=>{
  const record={...attempt,status,code,writes,stage,at:new Date().toISOString()};
  fs.writeFileSync(claim,JSON.stringify(record,null,2)+'\n');
  return record;
 };
 try{
  if(fs.existsSync(backup))throw error('WATCHDOG_B_BACKUP_CONFLICT');
  fs.mkdirSync(backup,{recursive:true});
  const backupCode=path.join(backup,'runner-watchdog.mjs');
  const backupManifest=path.join(backup,'INSTALL.json');
  fs.writeFileSync(backupCode,oldBytes,{flag:'wx'});
  fs.writeFileSync(backupManifest,oldManifestBytes,{flag:'wx'});
  if(digest(fs.readFileSync(backupCode))!==oldSha
    ||!fs.readFileSync(backupManifest).equals(oldManifestBytes))
    throw error('WATCHDOG_B_BACKUP_MISMATCH');
  stage='BACKUP_VERIFIED';
  // Use same-directory copies: preserve ACL identity before replacing files.
  const stagedScript=installedFile+'.approved-'+request.requestId+'.tmp';
  const stagedManifest=installedManifest+'.approved-'+request.requestId+'.tmp';
  fs.copyFileSync(installedFile,stagedScript,fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(installedManifest,stagedManifest,fs.constants.COPYFILE_EXCL);
  if(localAcl(stagedScript)!==originalSourceAcl
    ||localAcl(stagedManifest)!==originalManifestAcl)
    throw error('WATCHDOG_B_STAGED_ACL_MISMATCH');
  fs.writeFileSync(stagedScript,newBytes);
  const updated=r4
   ?projectR4InstalledManifest(installed,request,new Date().toISOString())
   :{...installed,sha256:nextSha,scope:FINAL_SCOPE,
     approvedTargetSourceSha:targetSha,upgradedAt:new Date().toISOString()};
  fs.writeFileSync(stagedManifest,JSON.stringify(updated,null,2)+'\n');
  if(digest(fs.readFileSync(stagedScript))!==nextSha
    ||localAcl(stagedScript)!==originalSourceAcl
    ||localAcl(stagedManifest)!==originalManifestAcl)
    throw error('WATCHDOG_B_STAGED_BYTES_OR_ACL_MISMATCH');
  stage='STAGED';
  // At-time-of-use safeguards: do not update during someone else's change.
  if(digest(fs.readFileSync(installedFile))!==oldSha
    ||!fs.readFileSync(installedManifest).equals(oldManifestBytes)
    ||fs.existsSync(path.join(maintenance,'leases/controller-install'))
    ||fs.existsSync(path.join(home,'PAUSE'))
    ||JSON.stringify(protectionBefore)!==JSON.stringify(protection()))
    throw error('WATCHDOG_B_PREWRITE_CAS_OR_PROTECTION_STOP');
  fs.renameSync(stagedScript,installedFile);
  stage='SOURCE_REPLACED';
  fs.renameSync(stagedManifest,installedManifest);
  stage='SOURCE_AND_MANIFEST_REPLACED';
  const result=readJSON(installedManifest);
  if(digest(fs.readFileSync(installedFile))!==nextSha
    ||result.sha256!==nextSha||result.scope!==FINAL_SCOPE
    ||(r4&&(result.standby?.mode!=='ACTIVE_1_STANDBY_1'||
       result.standby?.approved!==true||
       result.approvedTargetSourceSha!==R4_TARGET))
    ||localAcl(installedFile)!==originalSourceAcl
    ||localAcl(installedManifest)!==originalManifestAcl
    ||digest(fs.readFileSync(startup))!==installed.startupSha256
    ||JSON.stringify(protectionBefore)!==JSON.stringify(protection()))
    throw error('WATCHDOG_B_POSTWRITE_MISMATCH');
  // Do NOT kill the existing Watchdog, restart Guardian, or launch a maintainer
  // handoff from the Runner. The new bridge activates on natural Watchdog restart.
  return publish('STAGED','WATCHDOG_B_APPROVED_SOURCE_STAGED_AWAITING_NATURAL_RESTART',2);
 }catch(err){
  // The exact backup and single-use claim are preserved for recovery.
  return publish(stage==='CLAIMED'||stage==='BACKUP_VERIFIED'||stage==='STAGED'
    ?'BLOCKED':'RECOVERY_REQUIRED',safeCode(err?.code??err?.message),
    stage==='SOURCE_REPLACED'?1:stage==='SOURCE_AND_MANIFEST_REPLACED'?2:0);
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{const result=await execute();console.log(JSON.stringify(result));
  if(result.status!=='STAGED')process.exitCode=1;
 }catch(e){console.log(JSON.stringify({schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
  status:'BLOCKED',code:safeCode(e.code??e.message),writes:0}));
  process.exitCode=1;}
}
