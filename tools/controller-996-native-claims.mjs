// #996 fixed original-Windows low-level claim/intent primitives.
// This module has NO CLI and does not grant permission to use its methods.
// A separate authenticated C-grade operator MUST verify the immutable Git
// consent receipt and physical preflight before calling any mutating method.
// The test-only root is confined to a fresh isolated temp tree; production
// mode accepts ONLY the original E: maintenance root, never the new PC.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {RECOVERY_996} from './controller-996-c-transaction.mjs';

const ROOT='E:/ZGmini/automation/pc-maintenance';
const REQUEST=RECOVERY_996.requestId;
const SHA=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const fixedName=n=>typeof n==='string'&&/^[A-Z0-9_]{3,64}$/.test(n);
const markerNames=new Set(['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
 'PRE_ARCHIVE','ORIGINAL_LEASE_ARCHIVE_ATTEMPTED',
 'COMPLETE','OWN_CLAIM_ARCHIVE_ATTEMPTED']);

function safeDirectory(folder){
 const stat=fs.lstatSync(folder);
 need(stat.isDirectory()&&!stat.isSymbolicLink(),'C_PATH_REDIRECT_OR_NOT_DIRECTORY');
}
function safeFile(folder,name){
 safeDirectory(folder);
 const target=path.join(folder,name);
 const stat=fs.lstatSync(target);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=256000,
  'C_PROTECTED_READ_FILE_UNSAFE');
 return fs.readFileSync(target);
}
function jsonFile(folder,name){
 let parsed;
 try{parsed=JSON.parse(safeFile(folder,name));}
 catch(e){need(false,e?.code==='C_PATH_REDIRECT_OR_NOT_DIRECTORY'?e.code:'C_MARKER_UNREADABLE');}
 need(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'C_MARKER_INVALID');
 return parsed;
}
function writeOnce(folder,name,body){
 need(name==='owner.json'||
  (fixedName(name.replace(/\.json$/,''))&&name.endsWith('.json')),
  'C_MARKER_NAME_INVALID');
 safeDirectory(folder);
 const file=path.join(folder,name),bytes=Buffer.from(JSON.stringify(body)+'\n');
 need(bytes.length<=16384,'C_MARKER_TOO_LARGE');
 // O_EXCL ensures a process restarted after uncertainty cannot overwrite the
 // first attempt marker. Leave a partial/corrupt marker untouched for triage.
 const fd=fs.openSync(file,'wx',0o600);
 try{fs.writeSync(fd,bytes,0,bytes.length);fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
 need(safeFile(folder,name).equals(bytes),'C_MARKER_READBACK_MISMATCH');
 return hash(bytes);
}
function originalLeaseDigests(lease){
 return {owner:hash(safeFile(lease,'owner.json')),
  recoveryMarker:hash(safeFile(lease,'RECOVERY_REQUIRED.json'))};
}

/** Returns a fixed-root non-executable set of primitives. Creating this
 * object is read-only. No extra method recovers a stale/unknown claim. */
export function create996NativeClaimStore({root=ROOT,testOnly=false,
 now=()=>new Date().toISOString(),uuid=randomUUID,
 isPidAlive=pid=>{try{process.kill(pid,0);return true;}
  catch(e){return e?.code==='ESRCH'?false:null;}}}={}){
 if(testOnly){
  need(process.platform!=='win32'&&path.isAbsolute(root)&&
   path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
   path.basename(root).startsWith('zgmini-996-test-'),
   'C_TEST_ONLY_ROOT_REJECTED');
 }else need(process.platform==='win32'&&
  path.win32.normalize(root).toLowerCase()===
   path.win32.normalize(ROOT).toLowerCase()&&
  !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,
  'C_ORIGINAL_WINDOWS_PC_REQUIRED');
 const leases=path.join(root,'leases'),claim=path.join(leases,'controller-recovery');
 const original=path.join(leases,'controller-install');
 const ownArchived=path.join(leases,`controller-recovery-archived-${REQUEST}`);
 const originalArchived=path.join(leases,`controller-install-recovered-${REQUEST}`);
 const owner={requestId:REQUEST,issueNumber:996,pid:process.pid,
  nonce:uuid(),at:now()};
 const ownRead=()=>{
  const read=jsonFile(claim,'owner.json');
  need(read.requestId===REQUEST&&read.issueNumber===996&&
   read.nonce===owner.nonce&&read.pid===owner.pid,'C_OWN_CLAIM_OWNER_MISMATCH');
  return read;
 };
 return Object.freeze({
  claimPaths:Object.freeze({root,claim,original,ownArchived,originalArchived}),
  // Durable atomically-owned C claim; NEVER replace the abandoned install
  // lease, and never silently reclaim another recovery claim.
  reserveClaim(){
   safeDirectory(root);safeDirectory(leases);
   need(!fs.existsSync(ownArchived)&&!fs.existsSync(originalArchived),
    'C_RECOVERY_ALREADY_ARCHIVED_OR_COMPLETED');
   try{fs.mkdirSync(claim);}catch(e){
    need(false,e?.code==='EEXIST'?'C_RECOVERY_CLAIM_BUSY':
     'C_RECOVERY_CLAIM_CREATE_UNCERTAIN');
   }
   writeOnce(claim,'owner.json',owner);
   return Object.freeze({...owner});
  },
  ownClaimReadback(){return ownRead();},
  recordOnce(name,details={}){
   need(markerNames.has(name),'C_MARKER_NOT_ALLOWED');
   ownRead();
   need(details&&typeof details==='object'&&!Array.isArray(details),
    'C_MARKER_DETAILS_INVALID');
   return writeOnce(claim,`${name}.json`,{
    schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',requestId:REQUEST,
    issueNumber:996,ownerNonce:owner.nonce,name,at:now(),details});
  },
  hasMarker(name){
   need(markerNames.has(name),'C_MARKER_NOT_ALLOWED');
   ownRead();
   if(!fs.existsSync(path.join(claim,`${name}.json`)))return false;
   const m=jsonFile(claim,`${name}.json`);
   need(m.schema==='ZGMINI_CONTROLLER_996_C_MARKER_V1'&&
    m.requestId===REQUEST&&m.ownerNonce===owner.nonce&&m.name===name,
    'C_MARKER_OWNER_OR_NAME_DRIFT');
   return true;
  },
  archiveOriginalLease({ownerSha,recoveryMarkerSha}={}){
   ownRead();
   need(this.hasMarker('PRE_ARCHIVE')&&
    this.hasMarker('ORIGINAL_LEASE_ARCHIVE_ATTEMPTED'),
    'C_ORIGINAL_LEASE_ARCHIVE_INTENTS_MISSING');
   need(SHA(ownerSha)&&SHA(recoveryMarkerSha),'C_ORIGINAL_LEASE_DIGEST_INVALID');
   need(!fs.existsSync(originalArchived),'C_ORIGINAL_LEASE_ARCHIVED_ALREADY');
   const current=originalLeaseDigests(original);
   need(current.owner===ownerSha&&current.recoveryMarker===recoveryMarkerSha,
    'C_ORIGINAL_LEASE_CAS_MISMATCH');
   const old=jsonFile(original,'owner.json');
   need(Number.isSafeInteger(old.pid)&&old.pid>0&&isPidAlive(old.pid)===false,
    'C_ORIGINAL_INSTALL_OWNER_ALIVE_OR_UNKNOWN');
   fs.renameSync(original,originalArchived);
   const after=originalLeaseDigests(originalArchived);
   need(after.owner===ownerSha&&after.recoveryMarker===recoveryMarkerSha,
    'C_ORIGINAL_LEASE_ARCHIVE_READBACK_FAILED');
   return true;
  },
  archiveOwnClaim(){
   ownRead();
   need(this.hasMarker('COMPLETE')&&this.hasMarker('OWN_CLAIM_ARCHIVE_ATTEMPTED'),
    'C_OWN_CLAIM_COMPLETE_INTENTS_MISSING');
   need(!fs.existsSync(ownArchived)&&fs.existsSync(originalArchived)&&
    !fs.existsSync(original),'C_OWN_CLAIM_ARCHIVE_PRECONDITION');
   fs.renameSync(claim,ownArchived);
   const read=jsonFile(ownArchived,'owner.json');
   need(read.nonce===owner.nonce&&read.requestId===REQUEST,
    'C_OWN_CLAIM_ARCHIVE_READBACK_FAILED');
   return true;
  },
 });
}
