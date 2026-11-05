// Operator-only in-place update of a demonstrably stopped maintenance receiver.
// No Runner job, process kill, lock deletion, Core, SQLite or D1 mutation.
import fs from 'node:fs';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
const root='E:/ZGmini/automation/pc-maintenance';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// A previously approved six-file receiver remains valid during its one-time
// handoff. Replacement bytes use the separately pinned seven-file target set.
const legacyFiles=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs','tools/maintenance-ancestry.vbs'];
const targetFiles=[...legacyFiles,'tools/maintenance-admission-queue.mjs'];
const handoffSourceFiles=[...targetFiles,'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'];
export function requireInstalledHandoffFiles(installed){
 const actual=Object.keys(installed?.files??{});
 const previous=[legacyFiles,targetFiles].find(list=>actual.length===list.length
   &&list.every(rel=>Object.hasOwn(installed.files,rel)));
 need(previous,'HANDOFF_INSTALLED_FILE_SET_INVALID');
 return [...previous];
}
export function restorePriorHandoffFiles(installDir,backupDir,previous,newlyWritten=[],io=fs){
 need(Array.isArray(previous)&&[legacyFiles,targetFiles].some(list=>
   previous.length===list.length&&list.every(rel=>previous.includes(rel))),
   'HANDOFF_INSTALLED_FILE_SET_INVALID');
 const newFiles=targetFiles.filter(file=>!previous.includes(file));
 need(Array.isArray(newlyWritten)&&newlyWritten.every(rel=>newFiles.includes(rel)),
   'HANDOFF_NEW_FILE_SET_INVALID');
 for(const rel of [...previous,'MAINTENANCE_INSTALL.json'])
  io.copyFileSync(path.join(backupDir,rel),path.join(installDir,rel));
 // Never delete an independently appeared file after an exclusive-create race.
 for(const rel of newlyWritten){
  const newlyAdded=path.join(installDir,rel);
  if(io.existsSync(newlyAdded))io.unlinkSync(newlyAdded);
 }
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
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
 need(approval.schema==='ZGMINI_MAINTENANCE_HANDOFF_V1'&&approval.targetSha===target&&approval.approved===true&&['STOPPED_RECEIVER_IN_PLACE_ONLY','COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'].includes(approval.scope),'HANDOFF_APPROVAL_REQUIRED');
 const before=read(root+'/MAINTENANCE_INSTALL.json');
 need(before.sourceSha===approval.installedSha,'HANDOFF_INSTALLED_SHA_MISMATCH');
 need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
  // Prior install retains its own valid installed manifest and file set.
  const previousFiles=requireInstalledHandoffFiles(before);
  for(const rel of previousFiles)
   need(sha(fs.readFileSync(path.join(root,rel)))===before.files[rel],'HANDOFF_EXISTING_DRIFT');
  // A new target file must not overwrite a pre-existing untracked local file.
  for(const rel of targetFiles.filter(file=>!previousFiles.includes(file)))
   need(!fs.existsSync(path.join(root,rel)),'HANDOFF_TARGET_FILE_CONFLICT');
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
 const groups=execFileSync('C:/Windows/System32/whoami.exe',['/groups'],{encoding:'utf8',windowsHide:true});
 need(groups.includes('S-1-16-8192')&&!groups.includes('S-1-16-12288'),'HANDOFF_MEDIUM_TOKEN_REQUIRED');
 const bytes={};
  need(Object.keys(approval.files??{}).length===handoffSourceFiles.length
    &&handoffSourceFiles.every(file=>Object.hasOwn(approval.files,file)),
    'HANDOFF_APPROVAL_FILE_SET_INVALID');
  for(const rel of handoffSourceFiles){
  bytes[rel]=git(['show',target+':'+rel]);
  need(sha(bytes[rel])===approval.files[rel],'HANDOFF_SOURCE_HASH_MISMATCH');
  need(sha(fs.readFileSync(path.join(repo,rel)))===approval.files[rel],'HANDOFF_CHECKOUT_SOURCE_DRIFT');
 }
 const {startupVbs,launchStartup}=await import(pathToFileURL(path.join(repo,'tools/bootstrap-maintenance.mjs')));
 const startupBytes=Buffer.from(startupVbs());
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
  for(const rel of [...previousFiles,'MAINTENANCE_INSTALL.json']){
  const b=fs.readFileSync(path.join(root,rel)),dest=path.join(backup,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});snapshot[rel]=sha(b);
 }
 const oldStartup=fs.readFileSync(startup);fs.writeFileSync(backup+'/startup.vbs',oldStartup,{flag:'wx'});snapshot['startup.vbs']=sha(oldStartup);
 fs.writeFileSync(backup+'/SNAPSHOT.json',JSON.stringify(snapshot,null,2),{flag:'wx'});
 const result={schema:'ZGMINI_MAINTENANCE_HANDOFF_RESULT_V1',targetSha:target,installedShaBefore:before.sourceSha,status:'RUNNING',backup};
 const persist=()=>fs.writeFileSync(record,JSON.stringify({...result,at:new Date().toISOString()},null,2));persist();
  let reservation=null;
  const newlyWritten=[];
 try{
  requirePriorStopped(priorOwner);need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
  reservation=reserveReceiverSlot(root+'/leases/receiver');
  reservation.verify();
  requireStopped(priorOwner);
  need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
   for(const rel of targetFiles){
    const isNew=!previousFiles.includes(rel);
    fs.writeFileSync(path.join(root,rel),bytes[rel],isNew?{flag:'wx'}:undefined);
    if(isNew)newlyWritten.push(rel);
   }
   const manifest={...before,sourceSha:target,startupSha256:sha(startupBytes),files:Object.fromEntries(targetFiles.map(p=>[p,sha(bytes[p])])),capabilities:{cooperativeStop:true},updatedAt:new Date().toISOString()};
  fs.writeFileSync(root+'/MAINTENANCE_INSTALL.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(startup,startupBytes);
  reservation.verify();
  reservation.release();reservation=null;
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
     result.status='PASS';result.code='STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED';result.receiverPid=current.pid;persist();return result;
    }
   }
  }
  throw Object.assign(Error('HANDOFF_ORIGIN_NOT_VERIFIED'),{code:'HANDOFF_ORIGIN_NOT_VERIFIED'});
 }catch(error){
  const prewrite=reservationFailureStatus(error);
  if(prewrite){
   result.status=prewrite;
   result.code=error.code;
   persist();
   return result;
  }
  try{
   if(reservation){reservation.verify();requireStopped(priorOwner);}
   else requirePriorStopped(priorOwner);
   for(const [rel,hash]of Object.entries(snapshot))need(sha(fs.readFileSync(path.join(backup,rel)))===hash,'HANDOFF_BACKUP_DRIFT');
    restorePriorHandoffFiles(root,backup,previousFiles,newlyWritten);
   fs.writeFileSync(startup,oldStartup);
   if(reservation){reservation.release();reservation=null;}
   // File rollback alone does not prove that the former receiver restarted.
   // Never claim ROLLED_BACK without a new Windows origin/reconnect proof.
   result.status=rollbackStatus({filesRestored:true,receiverReattested:false});
   result.recoveryState='FILES_RESTORED_RECEIVER_RECONNECT_UNVERIFIED';
  }catch{result.status='RECOVERY_REQUIRED';}
  result.code=/^[A-Z_]+$/.test(error.code??'')?error.code:'HANDOFF_EXECUTION_ERROR';persist();return result;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await main();console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;}
 catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:e.code??'HANDOFF_ENVIRONMENT_ERROR'}));process.exitCode=1;}
}

