// Operator-only in-place update of a demonstrably stopped maintenance receiver.
// No Runner job, process kill, lock deletion, Core, SQLite or D1 mutation.
import fs from 'node:fs';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {installedControllerBPolicy} from './maintenance-contract.mjs';
import {execFileSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
const root='E:/ZGmini/automation/pc-maintenance';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// The initial handoff grows an approved six-file receiver to seven files.
// Subsequent seven-to-seven handoffs require a separate, explicit V2 approval.
// Neither mode may load unpinned checkout bytes or mutate an active receiver.
export const priorRuntimeFiles=Object.freeze([
 'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
]);
export const nextRuntimeFiles=Object.freeze([...priorRuntimeFiles,
 'tools/source-bundle-register.mjs']);
const newRuntimeFile='tools/source-bundle-register.mjs';
const handoffSourceFiles=[...nextRuntimeFiles,
 'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'];
const sixToSeven='SIX_TO_SEVEN';
const sevenToSeven='SEVEN_TO_SEVEN';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
export function requireOriginalStartupBytes(installed,bytes){
 need(Buffer.isBuffer(bytes)&&/^[a-f0-9]{64}$/.test(installed?.startupSha256??'')
  &&sha(bytes)===installed.startupSha256,'HANDOFF_STARTUP_DRIFT');
}
const exact=(actual,expected)=>actual&&typeof actual==='object'&&!Array.isArray(actual)
  &&Object.keys(actual).length===expected.length
  &&Object.keys(actual).every(name=>expected.includes(name))
  &&expected.every(name=>/^[a-f0-9]{64}$/.test(actual[name]??''));
export function requireSixToSevenContract(installedFiles,approvedFiles){
 need(exact(installedFiles,priorRuntimeFiles),'HANDOFF_INSTALLED_FILE_SET_MISMATCH');
 need(exact(approvedFiles,handoffSourceFiles),'HANDOFF_TARGET_FILE_SET_MISMATCH');
}
export function requireSevenToSevenContract(installedFiles,approvedFiles){
 need(exact(installedFiles,nextRuntimeFiles),'HANDOFF_INSTALLED_FILE_SET_MISMATCH');
 need(exact(approvedFiles,handoffSourceFiles),'HANDOFF_TARGET_FILE_SET_MISMATCH');
}
export function requireHandoffApproval(approval,target,installedSha){
 const valid=approval?.targetSha===target&&approval?.installedSha===installedSha
  &&approval?.approved===true
  &&['STOPPED_RECEIVER_IN_PLACE_ONLY','COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'].includes(approval?.scope);
 need(valid,'HANDOFF_APPROVAL_REQUIRED');
 if(approval.schema==='ZGMINI_MAINTENANCE_HANDOFF_V1'
    &&approval.transition===undefined)return sixToSeven;
 if(approval.schema==='ZGMINI_MAINTENANCE_HANDOFF_V2'
    &&approval.transition===sevenToSeven){
  need(/^[a-f0-9]{40}$/.test(installedSha??'')
    &&/^[a-f0-9]{40}$/.test(approval.installedSha??'')
    &&/^[a-f0-9]{40}$/.test(target??'')
    &&installedSha!==target,'HANDOFF_APPROVAL_REQUIRED');
  return sevenToSeven;
 }
 need(false,'HANDOFF_APPROVAL_REQUIRED');
}
export function approvedRuntimeChanges(mode,installedFiles,approvedFiles,policyOnlyContext=null){
 if(mode===sixToSeven)requireSixToSevenContract(installedFiles,approvedFiles);
 else if(mode===sevenToSeven)requireSevenToSevenContract(installedFiles,approvedFiles);
 else need(false,'HANDOFF_TRANSITION_UNSUPPORTED');
 const changes=nextRuntimeFiles.filter(rel=>installedFiles[rel]!==approvedFiles[rel]);
 // A separately approved V2 policy-pin rotation can change only the installed
 // manifest. Never require a dummy executable diff to authorize this effect.
 // Every other no-op handoff retains the historical fail-closed rejection.
 need(changes.length>0||mode===sevenToSeven&&
  approvedPolicyOnlyHandoff(policyOnlyContext?.before,policyOnlyContext?.approval,policyOnlyContext?.target),
  'HANDOFF_NO_RUNTIME_CHANGE');
 return changes;
}
// CI authentication is NOT activated by source merging. It is installed
// only when the independent Windows handoff is itself approved for this
// exact installed->target transition and explicitly carries the fixed
// workload pin. The old manifest is part of the existing byte-for-byte
// rollback snapshot; no environment or caller event can mutate this field.
export function approvedHandoffCiPolicy(before,approval,nextManifest){
 if(!Object.hasOwn(approval??{},'ciControllerBPolicy'))
  return before?.ciControllerBPolicy;
 need(approval?.schema==='ZGMINI_MAINTENANCE_HANDOFF_V2'&&
    approval.transition==='SEVEN_TO_SEVEN'&&approval.approved===true&&
    approval.installedSha===before?.sourceSha&&
    approval.targetSha===nextManifest?.sourceSha&&
    approval.targetSha!==approval.installedSha,
   'HANDOFF_CI_POLICY_APPROVAL_REQUIRED');
 const policy=approval.ciControllerBPolicy;
 try{
  const verified=installedControllerBPolicy({...nextManifest,ciControllerBPolicy:policy});
  need(verified!==null,'HANDOFF_CI_POLICY_INVALID');
 }catch{need(false,'HANDOFF_CI_POLICY_INVALID');}
 return structuredClone(policy);
}
// Policy-only 7->7 is an *explicitly approved* source transition, never an
// automatic authorization derived from CI success, a candidate PR or a new
// workflow hash. The installed policy's other identity fields are preserved.
export function approvedPolicyOnlyHandoff(before,approval,target){
 const prior=before?.ciControllerBPolicy,proposed=approval?.ciControllerBPolicy;
 // A policy-only rotation may change only the pinned workflow *bytes*.
 // Public V2's one-effect grant must not be enlarged by this no-file-write
 // exception. Changing target/manifest/installed baseline requires the
 // separately approved ordinary maintainer update path instead.
 const stable=['schema','enabled','workflowId','workflowPath'];
 if(prior?.schema==='ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2')
  stable.push('repositoryVisibility','installedSha','targetSha','manifestSha256');
 if(!prior||!proposed||!/^[a-f0-9]{40}$/.test(prior.workflowBlobSha??'')||
    prior.workflowBlobSha===proposed.workflowBlobSha||
    stable.some(k=>prior[k]!==proposed[k]))
  return false;
 try{
  const candidate={...before,sourceSha:target,
   files:Object.fromEntries(nextRuntimeFiles.map(rel=>[rel,approval.files?.[rel]]))};
  const checked=approvedHandoffCiPolicy(before,approval,candidate);
  return checked?.workflowBlobSha===proposed.workflowBlobSha;
 }catch{return false;}
}
export function handoffFilePlan(mode,installedFiles,approvedFiles,policyOnlyContext=null){
 const changes=approvedRuntimeChanges(mode,installedFiles,approvedFiles,policyOnlyContext);
 return {
  installed:mode===sixToSeven?[...priorRuntimeFiles]:[...nextRuntimeFiles],
  writes:mode===sixToSeven?[...nextRuntimeFiles]:changes,
  rollbackAdded:mode===sixToSeven?[newRuntimeFile]:[],
 };
}
// A previously installed seventh file must be an ordinary, unshared file under
// the fixed maintenance root. Hash equality alone does not prove write scope:
// a hard link, symlink or parent junction can alias an unapproved location.
export function requireDirectInstalledFiles(installRoot,relFiles,io=fs){
 need(path.isAbsolute(installRoot),'HANDOFF_PATH_ALIAS');
 // Walk from the volume root, not merely the installation directory: on
 // Windows a parent junction can redirect the entire trusted E: or APPDATA
 // subtree even when every file below it has the expected approved hash.
 const absoluteRoot=path.resolve(installRoot),volumeRoot=path.parse(absoluteRoot).root;
 need(absoluteRoot!==volumeRoot,'HANDOFF_PATH_ALIAS');
 let ancestor=volumeRoot;
 for(const part of path.relative(volumeRoot,absoluteRoot).split(path.sep).filter(Boolean)){
  ancestor=path.join(ancestor,part);
  const stat=io.lstatSync(ancestor);
  need(stat.isDirectory()&&!stat.isSymbolicLink(),'HANDOFF_PATH_ALIAS');
 }
 for(const rel of relFiles){
  need(typeof rel==='string'&&!path.isAbsolute(rel)
    &&rel.split('/').every(p=>p&&p!=='.'&&p!=='..'),'HANDOFF_PATH_ALIAS');
  let current=absoluteRoot;
  const parts=rel.split('/');
  for(const part of parts.slice(0,-1)){
   current=path.join(current,part);
   const parent=io.lstatSync(current);
   need(parent.isDirectory()&&!parent.isSymbolicLink(),'HANDOFF_PATH_ALIAS');
  }
  const file=io.lstatSync(path.join(current,parts.at(-1)));
  need(file.isFile()&&!file.isSymbolicLink()&&file.nlink===1,'HANDOFF_PATH_ALIAS');
 }
}
// Old handoff journals are immutable operational evidence. A crashed or
// unverified handoff cannot be silently superseded by a different target SHA.
export function requireNoUnfinishedHandoff(installRoot,io=fs){
 const names=io.readdirSync(installRoot).filter(n=>/^handoff-[a-f0-9]{40}\.json$/.test(n));
 for(const name of names){
  let record=null;
  try{record=JSON.parse(io.readFileSync(path.join(installRoot,name),'utf8'));}
  catch{need(false,'HANDOFF_PRIOR_RECOVERY_REQUIRED');}
  need(['PASS','BLOCKED','ROLLED_BACK'].includes(record?.status),
   'HANDOFF_PRIOR_RECOVERY_REQUIRED');
 }
}
export function requireOwnedInstallGuard(installRoot,guard,io=fs){
 need(Number.isSafeInteger(guard?.owner?.pid)&&/^[0-9a-f-]{36}$/.test(guard?.owner?.nonce??''),
  'HANDOFF_UPDATE_ACTIVE');
 let current=null;
 try{current=JSON.parse(io.readFileSync(path.join(installRoot,'leases/controller-install/owner.json'),'utf8'));}
 catch{need(false,'HANDOFF_UPDATE_ACTIVE');}
 need(current.pid===guard.owner.pid&&current.nonce===guard.owner.nonce,
  'HANDOFF_UPDATE_ACTIVE');
}
export function requireHandoffProbeGuard(installRoot,guard,target,io=fs){
 requireOwnedInstallGuard(installRoot,guard,io);
 let marker=null;
 try{marker=JSON.parse(io.readFileSync(path.join(installRoot,'HANDOFF_RECEIVER_PROBE_GUARD.json'),'utf8'));}
 catch{need(false,'HANDOFF_PROBE_GUARD_LOST');}
 need(marker.schema==='ZGMINI_HANDOFF_RECEIVER_PROBE_V1'
  &&marker.targetSha===target&&marker.pid===guard.owner.pid
  &&marker.nonce===guard.owner.nonce,'HANDOFF_PROBE_GUARD_LOST');
}
const git=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:3000000});
// Unrelated docs/results edits do not affect this exact approved handoff.
export function requireHandoffCheckoutScope(target,runGit=git){
 need(/^[a-f0-9]{40}$/.test(target),'HANDOFF_PIN_REQUIRED');
 const approvalFile=`approvals/maintenance-handoffs/${target}.json`;
 need(String(runGit(['status','--porcelain','--',...handoffSourceFiles,approvalFile])).trim()==='',
   'HANDOFF_CHECKOUT_DIRTY');
}
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
export function requireStopped(owner,isAlive=alive){
 need(Number.isSafeInteger(owner?.pid)&&owner.pid>0&&/^[0-9a-f-]{36}$/.test(owner?.nonce??'')
   &&isAlive(owner.pid)===false,'HANDOFF_RECEIVER_NOT_PROVEN_STOPPED');
}
export function requireNoReplacement(prior,current){
 need(prior&&(!current||(current.pid===prior.pid&&current.nonce===prior.nonce)),
   'HANDOFF_RECEIVER_CHANGED');
}
// Once the new receiver's startup was requested, a failed attestation is not
// permission to overwrite its executable files or to delete its new module.
export function requireRollbackWindow({startupInvoked=false,prior,current,reservationOwner=null}={}){
 need(startupInvoked!==true,'HANDOFF_NEW_RECEIVER_MAY_BE_RUNNING');
 const ownedReservation=reservationOwner&&current
  &&reservationOwner.pid===current.pid&&reservationOwner.nonce===current.nonce;
 if(!ownedReservation)requireNoReplacement(prior,current);
}
export function requireReceiverOrigin(prior,proof,installed,capture=null){
 const correct=Number.isSafeInteger(prior?.pid)&&prior.pid>0
   &&/^[0-9a-f-]{36}$/.test(prior?.nonce??'')
   &&Number.isFinite(prior?.bootAt)&&prior.bootAt>0
   &&proof?.schema==='ZGMINI_PC_RECEIVER_ORIGIN_V1'
   &&proof.pid===prior.pid&&proof.nonce===prior.nonce&&proof.bootAt===prior.bootAt
   &&proof.sourceSha===installed?.sourceSha
   &&proof.startupSha256===installed?.startupSha256
   &&/^[0-9]{14}\.[0-9]{6}[+-][0-9]{3}$/.test(proof?.created??'')
   &&/^[0-9]{1,9}$/.test(String(proof?.session??''))
   &&/^S-1-[0-9-]{4,100}$/.test(proof?.sid??'');
 need(correct,'HANDOFF_RECEIVER_ORIGIN_NOT_PROVEN');
 if(capture!==null)need(capture.trim()===`ATTESTED|${proof.created}|${proof.session}|${proof.sid}`,
   'HANDOFF_RECEIVER_ORIGIN_NOT_PROVEN');
}
export function requireNewReceiverOrigin(prior,priorProof,current,proof,installed,capture,currentAfter,isAlive=alive){
 need(typeof capture==='string'&&capture.trim().startsWith('ATTESTED|')
   &&prior?.nonce&&current?.nonce&&current.nonce!==prior.nonce
   &&proof?.created!==priorProof?.created,'HANDOFF_NEW_RECEIVER_NOT_PROVEN');
 requireReceiverOrigin(current,proof,installed,capture);
 need(isAlive(current.pid)===true
   &&currentAfter?.pid===current.pid&&currentAfter?.nonce===current.nonce,
   'HANDOFF_NEW_RECEIVER_NOT_PROVEN');
}
export function requireCurrentReceiverIdentity(prior,proof,installed,identity){
 requireReceiverOrigin(prior,proof,installed);
 need(typeof identity==='string'&&identity.trim()===`IDENTIFIED|${proof.created}|${proof.session}|${proof.sid}`,
   'HANDOFF_RECEIVER_IDENTITY_NOT_PROVEN');
}
// Reserve the empty receiver lease directory atomically only after its former
// process is proven dead. A recovery marker prevents stale-lease reclamation if
// this operator exits before the exact files and startup have been switched.
// Never replace, archive, or delete a lease owned by another process.
export function reserveReceiverSlot(leaseDir,io=fs){
 need(path.isAbsolute(leaseDir)&&path.basename(leaseDir)==='receiver',
   'HANDOFF_RESERVATION_PATH_INVALID');
 try{io.mkdirSync(leaseDir);}catch{need(false,'HANDOFF_RECEIVER_LEASE_BUSY');}
 const markerFile=path.join(leaseDir,'RECOVERY_REQUIRED.json');
 const ownerFile=path.join(leaseDir,'owner.json');
 const identity={pid:process.pid,nonce:randomUUID(),at:new Date().toISOString()};
 try{
  io.writeFileSync(markerFile,JSON.stringify({schema:'ZGMINI_HANDOFF_RECOVERY_V1',...identity})+'\n',
    {flag:'wx',mode:0o600});
  io.writeFileSync(ownerFile,JSON.stringify(identity)+'\n',{flag:'wx',mode:0o600});
 }catch{need(false,'HANDOFF_RESERVATION_INCOMPLETE');}
 let released=false;
 const verify=()=>{
  need(!released,'HANDOFF_RESERVATION_ALREADY_RELEASED');
  let ownerRecord,markerRecord;
  try{ownerRecord=JSON.parse(io.readFileSync(ownerFile,'utf8'));
   markerRecord=JSON.parse(io.readFileSync(markerFile,'utf8'));}
  catch{need(false,'HANDOFF_RESERVATION_LOST');}
  need(ownerRecord.pid===identity.pid&&ownerRecord.nonce===identity.nonce
    &&markerRecord.schema==='ZGMINI_HANDOFF_RECOVERY_V1'
    &&markerRecord.pid===identity.pid&&markerRecord.nonce===identity.nonce,
    'HANDOFF_RESERVATION_LOST');
 };
 return {owner:identity,verify,release(){
  verify();
  // Keep the directory held until the final rmdir. Missing owner or marker
  // also fail closed in maintenance-lock.mjs, including after a crash here.
  io.unlinkSync(ownerFile);io.unlinkSync(markerFile);io.rmdirSync(leaseDir);
  released=true;
 }};
}
export function reservationFailureStatus(error){
 if(error?.code==='HANDOFF_RESERVATION_INCOMPLETE')return 'RECOVERY_REQUIRED';
 if(['HANDOFF_RECEIVER_LEASE_BUSY','HANDOFF_RESERVATION_PATH_INVALID'].includes(error?.code))return 'BLOCKED';
 return null;
}
export function rollbackStatus({filesRestored=false,receiverReattested=false}={}){
 return filesRestored&&receiverReattested?'ROLLED_BACK':'RECOVERY_REQUIRED';
}
export function preserveRollbackReservation(reservation){
 // Files restored without a restarted, independently attested receiver are
 // RECOVERY_REQUIRED. Keep the lease marker for the supported recovery path.
 if(reservation)reservation.verify();
}
const owner=()=>{
 const file=root+'/leases/receiver/owner.json';
 if(!fs.existsSync(file))return null;
 try{return read(file);}
 catch{need(false,'HANDOFF_RECEIVER_NOT_PROVEN_STOPPED');}
};
function requirePriorStopped(prior){
 requireStopped(prior);
 requireNoReplacement(prior,owner());
}
export async function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'HANDOFF_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===2&&args[0]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[1]),'HANDOFF_PIN_REQUIRED');
 const target=args[1];
 requireHandoffCheckoutScope(target);
 git(['merge-base','--is-ancestor',target,'HEAD']);
 need(git(['branch','--show-current']).toString().trim()==='main','HANDOFF_MAIN_REQUIRED');
 const approval=read(path.join(repo,'approvals/maintenance-handoffs',target+'.json'));
 const before=read(root+'/MAINTENANCE_INSTALL.json');
 need(before.sourceSha===approval.installedSha,'HANDOFF_INSTALLED_SHA_MISMATCH');
 const mode=requireHandoffApproval(approval,target,before.sourceSha);
 const filePlan=handoffFilePlan(mode,before.files,approval.files,{before,approval,target});
 const installedRuntimeFiles=filePlan.installed;
 if(mode===sevenToSeven){
  requireNoUnfinishedHandoff(root);
  need(!fs.existsSync(root+'/HANDOFF_RECEIVER_PROBE_GUARD.json'),
   'HANDOFF_PRIOR_RECOVERY_REQUIRED');
  requireDirectInstalledFiles(root,[...installedRuntimeFiles,'MAINTENANCE_INSTALL.json']);
  for(const rel of ['leases','backups','receivers']){
   if(rel==='backups'&&!fs.existsSync(path.join(root,rel)))continue;
   const dir=fs.lstatSync(path.join(root,rel));
   need(dir.isDirectory()&&!dir.isSymbolicLink(),'HANDOFF_PATH_ALIAS');
  }
 }
 if(mode===sixToSeven)
  need(!fs.existsSync(path.join(root,newRuntimeFile)),'HANDOFF_UNMANAGED_TARGET_PRESENT');
 else need(fs.existsSync(path.join(root,newRuntimeFile)),'HANDOFF_EXISTING_DRIFT');
 need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
 // Verify the installed WMI proof helper before executing it or trusting its receiver record.
 for(const rel of installedRuntimeFiles)
  need(sha(fs.readFileSync(path.join(root,rel)))===before.files[rel],'HANDOFF_EXISTING_DRIFT');
 const priorOwner=owner();
 need(Number.isSafeInteger(priorOwner?.pid)&&priorOwner.pid>0
   &&/^[0-9a-f-]{36}$/.test(priorOwner.nonce??''),'HANDOFF_RECEIVER_NOT_PROVEN_STOPPED');
 let priorProof=null;
 try{priorProof=read(root+'/receivers/'+priorOwner.nonce+'.json');}
 catch{need(false,'HANDOFF_RECEIVER_ORIGIN_NOT_PROVEN');}
 requireReceiverOrigin(priorOwner,priorProof,before);
 // Validate replacement bytes and token BEFORE asking the receiver to stop.
 // A missing file, dirty checkout or elevated operator must leave it running.
 const startup=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
 const oldStartup=fs.readFileSync(startup);
 if(mode===sevenToSeven){
  const stat=fs.lstatSync(startup);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'HANDOFF_PATH_ALIAS');
 }
 requireOriginalStartupBytes(before,oldStartup);
 const groups=execFileSync('C:/Windows/System32/whoami.exe',['/groups'],{encoding:'utf8',windowsHide:true});
 need(groups.includes('S-1-16-8192')&&!groups.includes('S-1-16-12288'),'HANDOFF_MEDIUM_TOKEN_REQUIRED');
 const bytes={};
 for(const rel of handoffSourceFiles){
  bytes[rel]=git(['show',target+':'+rel]);
  need(sha(bytes[rel])===approval.files[rel],'HANDOFF_SOURCE_HASH_MISMATCH');
  need(sha(fs.readFileSync(path.join(repo,rel)))===approval.files[rel],'HANDOFF_CHECKOUT_SOURCE_DRIFT');
 }
 const {startupVbs,launchStartup}=await import(pathToFileURL(path.join(repo,'tools/bootstrap-maintenance.mjs')));
 const startupBytes=Buffer.from(startupVbs());
 // Authorize the exact optional CI policy BEFORE stopping the receiver,
 // creating backup/claim files, or replacing any maintainer executable.
 // Reject malformed or unapproved policy without starting a B mutation.
 const nextFiles=Object.fromEntries(nextRuntimeFiles.map(rel=>[rel,sha(bytes[rel])]));
 const approvedCiPolicy=approvedHandoffCiPolicy(before,approval,{
  ...before,sourceSha:target,startupSha256:sha(startupBytes),
  files:nextFiles,capabilities:{cooperativeStop:true}});
 const record=root+'/handoff-'+target+'.json',backup=root+'/backups/handoff-'+target;
 need(!fs.existsSync(record)&&!fs.existsSync(backup),'HANDOFF_ALREADY_ATTEMPTED');
 const priorAlive=alive(priorOwner.pid);
 need(priorAlive!==null,'HANDOFF_RECEIVER_NOT_PROVEN_STOPPED');
 if(priorAlive===true){
  need(before.capabilities?.cooperativeStop===true
    &&approval.scope==='COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE','HANDOFF_RECEIVER_NOT_PROVEN_STOPPED');
  let identity=null;
  // New pinned helper is hash-verified above. It checks only the current
  // receiver identity against its original startup proof. Explorer ancestry
  // may legitimately have vanished since that proof was captured.
  try{identity=execFileSync('C:/Windows/System32/cscript.exe',
    ['//NoLogo',path.join(repo,'tools/maintenance-ancestry.vbs'),'IDENTIFY',String(priorOwner.pid)],
    {encoding:'utf8',windowsHide:true});}
  catch{need(false,'HANDOFF_RECEIVER_IDENTITY_NOT_PROVEN');}
  requireCurrentReceiverIdentity(priorOwner,priorProof,before,identity);
  fs.writeFileSync(root+'/STOP_REQUEST.json',JSON.stringify({schema:'ZGMINI_MAINTENANCE_STOP_V1',pid:priorOwner.pid,nonce:priorOwner.nonce,sourceSha:before.sourceSha}),{flag:'wx'});
  for(let n=0;n<90&&alive(priorOwner.pid)!==false;n++)await new Promise(r=>setTimeout(r,1000));
 }
 requirePriorStopped(priorOwner);
 // Exact byte snapshots; recovery restores only these approved maintenance files.
 fs.mkdirSync(backup,{recursive:true});
 const snapshot={};
 for(const rel of [...installedRuntimeFiles,'MAINTENANCE_INSTALL.json']){
  const b=fs.readFileSync(path.join(root,rel)),dest=path.join(backup,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});snapshot[rel]=sha(b);
 }
 requireOriginalStartupBytes(before,fs.readFileSync(startup));
 fs.writeFileSync(backup+'/startup.vbs',oldStartup,{flag:'wx'});snapshot['startup.vbs']=sha(oldStartup);
 fs.writeFileSync(backup+'/SNAPSHOT.json',JSON.stringify(snapshot,null,2),{flag:'wx'});
 const result={schema:'ZGMINI_MAINTENANCE_HANDOFF_RESULT_V1',targetSha:target,installedShaBefore:before.sourceSha,status:'RUNNING',backup};
 const persist=()=>fs.writeFileSync(record,JSON.stringify({...result,at:new Date().toISOString()},null,2));persist();
 let reservation=null,sharedGuard=null,startupInvoked=false;
 try{
  requirePriorStopped(priorOwner);need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
  if(mode===sevenToSeven)
   requireDirectInstalledFiles(root,[...installedRuntimeFiles,'MAINTENANCE_INSTALL.json']);
  if(mode===sevenToSeven){
   // The receiver lease must be released before its replacement can start.
   // A separate controller-install lease therefore stays held through the
   // independent Windows CAPTURE, preventing unverified B work in the gap.
   const {acquireMaintenanceLock}=await import(pathToFileURL(path.join(repo,'tools/maintenance-lock.mjs')));
   sharedGuard=acquireMaintenanceLock(root,'controller-install');
   requireOwnedInstallGuard(root,sharedGuard);
   fs.writeFileSync(root+'/HANDOFF_RECEIVER_PROBE_GUARD.json',JSON.stringify({
    schema:'ZGMINI_HANDOFF_RECEIVER_PROBE_V1',targetSha:target,
    pid:sharedGuard.owner.pid,nonce:sharedGuard.owner.nonce,at:new Date().toISOString(),
   })+'\n',{flag:'wx',mode:0o600});
   requireHandoffProbeGuard(root,sharedGuard,target);
  }
  reservation=reserveReceiverSlot(root+'/leases/receiver');
  reservation.verify();
  requireStopped(priorOwner);
  if(sharedGuard)requireHandoffProbeGuard(root,sharedGuard,target);
  else need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
  if(mode===sevenToSeven)
   requireDirectInstalledFiles(root,[...installedRuntimeFiles,'MAINTENANCE_INSTALL.json']);
  for(const rel of filePlan.writes){
   // Seven-to-seven only writes byte-different files; never creates or deletes
   // the preexisting seventh module.
   fs.writeFileSync(path.join(root,rel),bytes[rel],
    mode===sixToSeven&&rel===newRuntimeFile?{flag:'wx'}:undefined);
  }
  if(sharedGuard)requireHandoffProbeGuard(root,sharedGuard,target);
  for(const rel of nextRuntimeFiles)
   need(sha(fs.readFileSync(path.join(root,rel)))===sha(bytes[rel]),
    'HANDOFF_POSTWRITE_HASH_MISMATCH');
  const manifest={...before,sourceSha:target,startupSha256:sha(startupBytes),
   files:nextFiles,capabilities:{cooperativeStop:true},updatedAt:new Date().toISOString()};
  if(approvedCiPolicy!==undefined)manifest.ciControllerBPolicy=approvedCiPolicy;
  fs.writeFileSync(root+'/MAINTENANCE_INSTALL.json',JSON.stringify(manifest,null,2)+'\n');
  if(mode===sevenToSeven)
   requireDirectInstalledFiles(path.dirname(startup),[path.basename(startup)]);
  fs.writeFileSync(startup,startupBytes);
  reservation.verify();
  reservation.release();reservation=null;
  startupInvoked=true;
  launchStartup(startup);
  for(let i=0;i<30;i++){
   await new Promise(r=>setTimeout(r,1000));const current=owner();
   if(current&&current.nonce!==priorOwner?.nonce&&alive(current.pid)===true){
    const proofFile=root+'/receivers/'+current.nonce+'.json';
    if(fs.existsSync(proofFile)){
     const proof=read(proofFile);
     need(sha(fs.readFileSync(root+'/tools/maintenance-ancestry.vbs'))===manifest.files['tools/maintenance-ancestry.vbs'],
       'HANDOFF_NEW_SCRIPT_DRIFT');
     let capture=null;
     try{capture=execFileSync('C:/Windows/System32/cscript.exe',
       ['//NoLogo',root+'/tools/maintenance-ancestry.vbs','CAPTURE',String(current.pid)],
       {encoding:'utf8',windowsHide:true});}
     catch{need(false,'HANDOFF_RECEIVER_ORIGIN_NOT_PROVEN');}
     requireNewReceiverOrigin(priorOwner,priorProof,current,proof,
       {sourceSha:target,startupSha256:sha(startupBytes)},capture,owner());
      if(sharedGuard){
       requireHandoffProbeGuard(root,sharedGuard,target);
       // Archive our exact probe marker only after Windows CAPTURE. While the
       // shared B lease is still held, the receiver returns QUEUED without
       // claiming any pending B request.
       fs.renameSync(root+'/HANDOFF_RECEIVER_PROBE_GUARD.json',
        root+'/handoff-'+target+'.verified-guard.json');
       sharedGuard.release();sharedGuard=null;
      }
     result.status='PASS';result.code='STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED';result.receiverPid=current.pid;persist();return result;
    }
   }
  }
  throw Object.assign(Error('HANDOFF_ORIGIN_NOT_VERIFIED'),{code:'HANDOFF_ORIGIN_NOT_VERIFIED'});
 }catch(error){
  const prewrite=reservationFailureStatus(error);
   if(prewrite){
    // Once the V2 shared guard was acquired, even a prewrite failure needs
    // a recovery owner: the prior receiver was already stopped.
    result.status=sharedGuard?'RECOVERY_REQUIRED':prewrite;
   result.code=error.code;
    if(sharedGuard)try{requireOwnedInstallGuard(root,sharedGuard);sharedGuard.holdForRecovery();}catch{}
   persist();
   return result;
  }
  try{
   requireRollbackWindow({startupInvoked,prior:priorOwner,current:owner(),
    reservationOwner:reservation?.owner??null});
   if(reservation){reservation.verify();requireStopped(priorOwner);}
   else requirePriorStopped(priorOwner);
   for(const [rel,hash]of Object.entries(snapshot))need(sha(fs.readFileSync(path.join(backup,rel)))===hash,'HANDOFF_BACKUP_DRIFT');
    const added=path.join(root,newRuntimeFile);
    if(filePlan.rollbackAdded.includes(newRuntimeFile)&&fs.existsSync(added)){
    need(sha(fs.readFileSync(added))===sha(bytes[newRuntimeFile]),'HANDOFF_NEW_FILE_DRIFT');
    fs.unlinkSync(added); // Only the newly added, byte-verified file; never preexisting data.
   }
    for(const rel of [...installedRuntimeFiles,'MAINTENANCE_INSTALL.json'])
    fs.copyFileSync(path.join(backup,rel),path.join(root,rel));
   fs.writeFileSync(startup,oldStartup);
   preserveRollbackReservation(reservation);
   // File rollback alone does not prove that the former receiver restarted.
   // Never claim ROLLED_BACK without a new Windows origin/reconnect proof.
   result.status=rollbackStatus({filesRestored:true,receiverReattested:false});
   result.recoveryState='FILES_RESTORED_RECEIVER_RECONNECT_UNVERIFIED';
  }catch{result.status='RECOVERY_REQUIRED';}
   if(sharedGuard)try{requireOwnedInstallGuard(root,sharedGuard);sharedGuard.holdForRecovery();}
    catch{result.status='RECOVERY_REQUIRED';}
   result.code=/^[A-Z_]+$/.test(error.code??'')?error.code:'HANDOFF_EXECUTION_ERROR';persist();return result;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await main();console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;}
 catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:e.code??'HANDOFF_ENVIRONMENT_ERROR'}));process.exitCode=1;}
}
