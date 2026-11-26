// ISOLATED TEMP FIXTURE ONLY. Deliberately cannot act on the operating PC.
// Demonstrates exact raw-byte Supervisor lease CAS, a persistent one-use claim,
// directory handoff and bounded rollback without starting/stopping any Runner.
// Production use would require a separately authorized B implementation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const sha64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const oneUse=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{7,63}$/.test(x);
const validPid=x=>Number.isSafeInteger(x)&&x>0;
const denial=(status,code)=>Object.freeze({schema:'ZGMINI_ORPHAN_LEASE_TEMP_TRANSACTION_V1',
 status,code,operatingWrites:0,runnerStops:0,runnerStarts:0,
 sourceOnlyFixture:true,operatingEffectAuthorized:false,
 leaseMutationAuthorized:false});

export function assertIsolatedOrphanRoot(root,{filesystem=fs,tempRoot=os.tmpdir()}={}){
 if(typeof root!=='string'||typeof tempRoot!=='string')
  throw Error('ORPHAN_FIXTURE_ROOT_INVALID');
 const realTemp=filesystem.realpathSync(tempRoot);
 const real=filesystem.realpathSync(root);
 const stat=filesystem.lstatSync(root);
 if(!stat.isDirectory()||stat.isSymbolicLink()||
    !path.basename(real).startsWith('zgmini-orphan-fixture-')||
    !real.toLowerCase().startsWith((realTemp+path.sep).toLowerCase())||
    real.toLowerCase()===realTemp.toLowerCase())
  throw Error('ORPHAN_FIXTURE_ROOT_OUTSIDE_TEMP');
 for(const part of ['pc-control','pc-control/leases',
  'pc-control/leases/supervisor']){
  const dir=path.join(real,part),st=filesystem.lstatSync(dir);
  if(!st.isDirectory()||st.isSymbolicLink()||
     !filesystem.realpathSync(dir).toLowerCase().startsWith(
       (real+path.sep).toLowerCase()))
   throw Error('ORPHAN_FIXTURE_DIRECTORY_UNSAFE');
 }
 return real;
}
const readExact=(io,file,max)=>{
 const st=io.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
    st.size<20||st.size>max)throw Error('ORPHAN_FIXTURE_FILE_UNSAFE');
 const data=io.readFileSync(file);
 if(!Buffer.isBuffer(data)||data.length!==st.size)
  throw Error('ORPHAN_FIXTURE_READ_UNSTABLE');
 return data;
};
// The private attestation is synthetic in tests; it is NOT an operating B.
// Never accept an Issue-controlled privateAttestation as a production grant.
export function swapOrphanLeaseInTemp({
 root,requestId,expected,privateAttestation,newOwner,oldPidAlive,
 newPidAlive,filesystem=fs,tempRoot=os.tmpdir(),
 injectFailure=null
}={}){
 let base,claimDir,backupDir,stagedDir,leaseDir,journal;
 try{base=assertIsolatedOrphanRoot(root,{filesystem,tempRoot});}
 catch{return denial('BLOCKED','ORPHAN_TEMP_SCOPE_DENIED');}
 if(!oneUse(requestId)||!sha64(expected?.ownerSha256)||
    !sha64(expected?.hostSha256)||!sha64(expected?.heartbeatSha256)||
    !validPid(newOwner?.pid)||typeof newOwner?.nonce!=='string'||
    newOwner.recoveryMode!=='ADOPT_EXISTING_SIX_NO_SPAWN'||
    typeof oldPidAlive!=='function'||typeof newPidAlive!=='function')
  return denial('BLOCKED','ORPHAN_TEMP_REQUEST_INVALID');
 if(privateAttestation?.scope!=='SYNTHETIC_TEMP_ONLY'||
    privateAttestation.noSpawnVerified!==true||
    privateAttestation.oldNonceSameAsNew!==true||
    privateAttestation.sixListenerIdentitiesVerified!==true||
    privateAttestation.workerCount!==0||
    privateAttestation.unrelatedLeasesAbsent!==true||
    privateAttestation.watchdogFenced!==true||
    privateAttestation.independentOperatorVerified!==true)
  return denial('BLOCKED','ORPHAN_TEMP_PRIVATE_PROOF_MISSING');
 const control=path.join(base,'pc-control');
 leaseDir=path.join(control,'leases','supervisor');
 const ownerFile=path.join(leaseDir,'owner.json'),
  hostFile=path.join(control,'host.json'),
  heartbeatFile=path.join(control,'SUPERVISOR_STATUS.json');
 let oldBytes;
 try{
  oldBytes=readExact(filesystem,ownerFile,8192);
  const hostBytes=readExact(filesystem,hostFile,65536),
   heartbeatBytes=readExact(filesystem,heartbeatFile,16384);
  if(hash(oldBytes)!==expected.ownerSha256||
     hash(hostBytes)!==expected.hostSha256||
     hash(heartbeatBytes)!==expected.heartbeatSha256)
   return denial('BLOCKED','ORPHAN_TEMP_CAS_PREIMAGE_CHANGED');
  const old=JSON.parse(oldBytes.toString('utf8'));
  if(!validPid(old.pid)||old.pid===newOwner.pid||
     old.nonce!==newOwner.nonce||
     !Number.isFinite(old.bootAt)||
     !Number.isFinite(newOwner.bootAt)||
     Math.abs(old.bootAt-newOwner.bootAt)>=10000||
     oldPidAlive(old.pid)!==false||newPidAlive(newOwner.pid)!==true)
   return denial('BLOCKED','ORPHAN_TEMP_OLD_NEW_IDENTITY_UNVERIFIED');
  const related=filesystem.readdirSync(path.join(control,'leases'));
  if(related.length!==1||related[0]!=='supervisor')
   return denial('BLOCKED','ORPHAN_TEMP_OTHER_RESOURCE_LEASE_PRESENT');
  if(injectFailure==='BEFORE_CLAIM')
   return denial('BLOCKED','ORPHAN_TEMP_SIMULATED_PRE_CLAIM');
  claimDir=path.join(base,'orphan-claim-'+requestId);
  try{filesystem.mkdirSync(claimDir);}
  catch(e){if(e?.code==='EEXIST')return denial('BLOCKED','ORPHAN_TEMP_CLAIM_REUSED_NO_RETRY');
   throw e;}
  // Durable one-use claim must precede any old lease rename.
  journal=path.join(claimDir,'journal.json');
  filesystem.writeFileSync(journal,JSON.stringify({
   schema:'ZGMINI_ORPHAN_TEMP_CLAIM_V1',requestId,
   phase:'PREPARED',ownerSha256:expected.ownerSha256})+'\n',{flag:'wx'});
  backupDir=path.join(claimDir,'old-supervisor');
  stagedDir=path.join(claimDir,'new-supervisor');
  filesystem.mkdirSync(stagedDir);
  filesystem.writeFileSync(path.join(stagedDir,'owner.json'),
   JSON.stringify(newOwner)+'\n',{flag:'wx'});
  if(injectFailure==='BEFORE_RENAME')return denial('BLOCKED','ORPHAN_TEMP_PRE_RENAME_FENCED');
  // Repeat all three exact CAS comparisons immediately before the effect.
  if(hash(readExact(filesystem,ownerFile,8192))!==expected.ownerSha256||
     hash(readExact(filesystem,hostFile,65536))!==expected.hostSha256||
     hash(readExact(filesystem,heartbeatFile,16384))!==expected.heartbeatSha256)
   return denial('BLOCKED','ORPHAN_TEMP_SECOND_CAS_CHANGED');
  filesystem.renameSync(leaseDir,backupDir);
  if(injectFailure==='AFTER_OLD_RENAMED')
   throw Error('ORPHAN_TEMP_INJECTED_AFTER_OLD_RENAMED');
  filesystem.renameSync(stagedDir,leaseDir);
  if(injectFailure==='AFTER_NEW_RENAMED')
   throw Error('ORPHAN_TEMP_INJECTED_AFTER_NEW_RENAMED');
  const after=readExact(filesystem,path.join(leaseDir,'owner.json'),8192);
  if(!Buffer.isBuffer(after)||JSON.parse(after.toString('utf8')).pid!==newOwner.pid)
   throw Error('ORPHAN_TEMP_NEW_OWNER_READBACK_FAILED');
  return denial('ISOLATED_SWAPPED','ORPHAN_TEMP_LEASE_CAS_SWAP_SIMULATED');
 }catch{
  // Never overwrite a possibly claimed lease or restart any process.
  // Restore only the provably unchanged OLD dir when the target is absent.
  if(backupDir&&leaseDir&&oldBytes){
   try{
    if(!filesystem.existsSync(leaseDir)&&filesystem.existsSync(backupDir)&&
       hash(readExact(filesystem,path.join(backupDir,'owner.json'),8192))===
       hash(oldBytes)){
      filesystem.renameSync(backupDir,leaseDir);
      return denial('ISOLATED_ROLLED_BACK','ORPHAN_TEMP_OLD_ONLY_RESTORED');
    }
   }catch{/* Keep all evidence for separate reconciliation. */}
  }
  return denial('RECOVERY_REQUIRED','ORPHAN_TEMP_OUTCOME_UNVERIFIED_NO_RETRY');
 }
}
