// Operator-only in-place update of a demonstrably stopped maintenance receiver.
// No Runner job, process kill, lock deletion, Core, SQLite or D1 mutation.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
const root='E:/ZGmini/automation/pc-maintenance';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs','tools/maintenance-ancestry.vbs'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const git=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:3000000});
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
export function requireStopped(owner,isAlive=alive){
 need(!owner||(Number.isSafeInteger(owner.pid)&&owner.pid>0&&isAlive(owner.pid)===false),'HANDOFF_RECEIVER_NOT_PROVEN_STOPPED');
}
const owner=()=>fs.existsSync(root+'/leases/receiver/owner.json')?read(root+'/leases/receiver/owner.json'):null;
export async function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'HANDOFF_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===2&&args[0]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[1]),'HANDOFF_PIN_REQUIRED');
 const target=args[1];
 need(git(['status','--porcelain']).toString().trim()==='','HANDOFF_CHECKOUT_DIRTY');
 git(['merge-base','--is-ancestor',target,'HEAD']);
 need(git(['branch','--show-current']).toString().trim()==='main','HANDOFF_MAIN_REQUIRED');
 const approval=read(path.join(repo,'approvals/maintenance-handoffs',target+'.json'));
 need(approval.schema==='ZGMINI_MAINTENANCE_HANDOFF_V1'&&approval.targetSha===target&&approval.approved===true&&['STOPPED_RECEIVER_IN_PLACE_ONLY','COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'].includes(approval.scope),'HANDOFF_APPROVAL_REQUIRED');
 const before=read(root+'/MAINTENANCE_INSTALL.json');
 need(before.sourceSha===approval.installedSha,'HANDOFF_INSTALLED_SHA_MISMATCH');
 need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
 const priorOwner=owner();
 if(priorOwner&&alive(priorOwner.pid)===true&&before.capabilities?.cooperativeStop===true&&approval.scope==='COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'){
  fs.writeFileSync(root+'/STOP_REQUEST.json',JSON.stringify({schema:'ZGMINI_MAINTENANCE_STOP_V1',pid:priorOwner.pid,nonce:priorOwner.nonce,sourceSha:before.sourceSha}),{flag:'wx'});
  for(let n=0;n<90&&alive(priorOwner.pid)!==false;n++)await new Promise(r=>setTimeout(r,1000));
 }
 requireStopped(owner());
 const startup=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
 const groups=execFileSync('C:/Windows/System32/whoami.exe',['/groups'],{encoding:'utf8',windowsHide:true});
 need(groups.includes('S-1-16-8192')&&!groups.includes('S-1-16-12288'),'HANDOFF_MEDIUM_TOKEN_REQUIRED');
 for(const rel of files)need(sha(fs.readFileSync(path.join(root,rel)))===before.files[rel],'HANDOFF_EXISTING_DRIFT');
 const bytes={};
 for(const rel of [...files,'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs']){
  bytes[rel]=git(['show',target+':'+rel]);
  need(sha(bytes[rel])===approval.files[rel],'HANDOFF_SOURCE_HASH_MISMATCH');
  need(sha(fs.readFileSync(path.join(repo,rel)))===approval.files[rel],'HANDOFF_CHECKOUT_SOURCE_DRIFT');
 }
 const {startupVbs,launchStartup}=await import(pathToFileURL(path.join(repo,'tools/bootstrap-maintenance.mjs')));
 const startupBytes=Buffer.from(startupVbs());
 const record=root+'/handoff-'+target+'.json',backup=root+'/backups/handoff-'+target;
 need(!fs.existsSync(record)&&!fs.existsSync(backup),'HANDOFF_ALREADY_ATTEMPTED');
 // Exact byte snapshots; recovery restores only these approved maintenance files.
 fs.mkdirSync(backup,{recursive:true});
 const snapshot={};
 for(const rel of [...files,'MAINTENANCE_INSTALL.json']){
  const b=fs.readFileSync(path.join(root,rel)),dest=path.join(backup,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});snapshot[rel]=sha(b);
 }
 const oldStartup=fs.readFileSync(startup);fs.writeFileSync(backup+'/startup.vbs',oldStartup,{flag:'wx'});snapshot['startup.vbs']=sha(oldStartup);
 fs.writeFileSync(backup+'/SNAPSHOT.json',JSON.stringify(snapshot,null,2),{flag:'wx'});
 const result={schema:'ZGMINI_MAINTENANCE_HANDOFF_RESULT_V1',targetSha:target,installedShaBefore:before.sourceSha,status:'RUNNING',backup};
 const persist=()=>fs.writeFileSync(record,JSON.stringify({...result,at:new Date().toISOString()},null,2));persist();
 try{
  requireStopped(owner());need(!fs.existsSync(root+'/leases/controller-install'),'HANDOFF_UPDATE_ACTIVE');
  for(const rel of files)fs.writeFileSync(path.join(root,rel),bytes[rel]);
  const manifest={...before,sourceSha:target,startupSha256:sha(startupBytes),files:Object.fromEntries(files.map(p=>[p,sha(bytes[p])])),capabilities:{cooperativeStop:true},updatedAt:new Date().toISOString()};
  fs.writeFileSync(root+'/MAINTENANCE_INSTALL.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(startup,startupBytes);
  launchStartup(startup);
  for(let i=0;i<30;i++){
   await new Promise(r=>setTimeout(r,1000));const current=owner();
   if(current&&current.nonce!==priorOwner?.nonce&&alive(current.pid)===true){
    const proofFile=root+'/receivers/'+current.nonce+'.json';
    if(fs.existsSync(proofFile)){
     const proof=read(proofFile);
     need(proof.sourceSha===target&&proof.pid===current.pid&&proof.startupSha256===sha(startupBytes),'HANDOFF_PROOF_MISMATCH');
     result.status='PASS';result.code='STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED';result.receiverPid=current.pid;persist();return result;
    }
   }
  }
  throw Object.assign(Error('HANDOFF_ORIGIN_NOT_VERIFIED'),{code:'HANDOFF_ORIGIN_NOT_VERIFIED'});
 }catch(error){
  try{
   requireStopped(owner());
   for(const [rel,hash]of Object.entries(snapshot))need(sha(fs.readFileSync(path.join(backup,rel)))===hash,'HANDOFF_BACKUP_DRIFT');
   for(const rel of [...files,'MAINTENANCE_INSTALL.json'])fs.copyFileSync(path.join(backup,rel),path.join(root,rel));
   fs.writeFileSync(startup,oldStartup);
   result.status='ROLLED_BACK';
  }catch{result.status='RECOVERY_REQUIRED';}
  result.code=/^[A-Z_]+$/.test(error.code??'')?error.code:'HANDOFF_EXECUTION_ERROR';persist();return result;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await main();console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;}
 catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:e.code??'HANDOFF_ENVIRONMENT_ERROR'}));process.exitCode=1;}
}
