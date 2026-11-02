// Fixed, separately owned maintenance leases. Never touch Core/Korea/Iran locks.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';

const need=(x,c)=>{if(!x)throw Object.assign(Error(c),{code:c});};
const names=new Set(['receiver','controller-install']);
export function acquireMaintenanceLock(root,name){
 need(names.has(name),'MAINTENANCE_LOCK_NAME');
 need(path.isAbsolute(root)&&path.resolve(root)!==path.parse(root).root&&fs.existsSync(root),'MAINTENANCE_LOCK_ROOT');
 const leaseRoot=path.join(root,'leases');fs.mkdirSync(leaseRoot,{recursive:true});
 const dir=path.join(leaseRoot,name);
 try{fs.mkdirSync(dir);}catch(error){
  if(error?.code==='EEXIST'&&name==='receiver'){
   // Only a demonstrably dead, non-recovery receiver lease can be archived.
   // Never silently reclaim the controller-install lease after a crash.
   let old=null;try{old=JSON.parse(fs.readFileSync(path.join(dir,'owner.json')));}catch{}
   let active=true;
   if(Number.isSafeInteger(old?.pid)&&old.pid>0){try{process.kill(old.pid,0);}catch(e){if(e?.code==='ESRCH')active=false;}}
   if(!active&&old?.nonce&&!fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json'))){
    fs.renameSync(dir,path.join(leaseRoot,'receiver-stale-'+Date.now()));
    fs.mkdirSync(dir);
   }else throw Object.assign(Error('MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'),{code:'MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'});
  }else if(error?.code==='EEXIST')throw Object.assign(Error('MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'),{code:'MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'});
  else throw error;
 }
 const nonce=randomUUID(),owner={pid:process.pid,nonce,bootAt:Date.now()-os.uptime()*1000,at:new Date().toISOString()};
 fs.writeFileSync(path.join(dir,'owner.json'),JSON.stringify(owner)+'\n',{flag:'wx'});
 let released=false;
 return {
  owner,
  release(){
   if(released)return;
   need(JSON.parse(fs.readFileSync(path.join(dir,'owner.json'))).nonce===nonce,'MAINTENANCE_LOCK_OWNER_CHANGED');
   fs.unlinkSync(path.join(dir,'owner.json'));fs.rmdirSync(dir);released=true;
  },
  holdForRecovery(){
   need(!released,'MAINTENANCE_LOCK_ALREADY_RELEASED');
   const marker=path.join(dir,'RECOVERY_REQUIRED.json');
   fs.writeFileSync(marker,JSON.stringify({requestOwnerPid:owner.pid,nonce,at:new Date().toISOString(),next:'INSPECT_INSTALL_SHA_PROCESS_AND_LEDGER'})+'\n',{flag:'wx'});
  }
 };
}

export function maintenanceLockStatus(root,name){
 need(names.has(name),'MAINTENANCE_LOCK_NAME');
 const dir=path.join(root,'leases',name);
 if(!fs.existsSync(dir))return {held:false};
 let owner=null;try{owner=JSON.parse(fs.readFileSync(path.join(dir,'owner.json')));}catch{}
 return {held:true,ownerPid:Number.isSafeInteger(owner?.pid)?owner.pid:null,
  recoveryRequired:fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json'))};
}
