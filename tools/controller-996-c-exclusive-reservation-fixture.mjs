// #996 C continuation shared fencing prototype: ISOLATED LINUX TEMP ONLY.
// This is NOT a Windows/PC operator, an approval, or a reusable live lock.
// It demonstrates why per-UUID continuation claims alone are not exclusive:
// two unrelated UUIDs MUST contend on one fixed directory first.
// The additional fixed reservation is a NEW proposed operational effect;
// production must not use it without a new immutable scope/owner approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const FIXED_NAME='controller-recovery-continuation-reservation';
const OLD='controller-recovery';
const INSTALL='controller-install';
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const HEX=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hash=b=>createHash('sha256').update(b).digest('hex');
const error=code=>Object.assign(new Error(code),{code});
const need=(test,code)=>{if(!test)throw error(code);};
const failure=code=>Object.freeze({
  schema:'ZGMINI_996_C_SHARED_RESERVATION_FIXTURE_V1',
  status:'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE',code,
  executionAuthorized:false,productionExecutable:false,
  originalPcWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0,
  pcRetries:0,cleanupPerformed:false,
});
const success=(id,nonce)=>Object.freeze({
  schema:'ZGMINI_996_C_SHARED_RESERVATION_FIXTURE_V1',
  status:'ISOLATED_SHARED_RESERVATION_AND_CLAIM_ONLY',
  fixedReservation:FIXED_NAME,continuationRequestId:id,
  nonce,canonicalInstallPreserved:true,
  executionAuthorized:false,productionExecutable:false,
  originalPcWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0,
  pcRetries:0,cleanupPerformed:false,
});

function checkedDirectory(dir){
  const st=fs.lstatSync(dir);
  need(st.isDirectory()&&!st.isSymbolicLink(),
    'C_996_SHARED_RESERVATION_REDIRECT_OR_NON_DIRECTORY');
}
function checkedFixtureRoot(root){
  need(typeof root==='string'&&path.isAbsolute(root),
    'C_996_SHARED_RESERVATION_TEST_ROOT_UNSAFE');
  const base=path.resolve(os.tmpdir()),resolved=path.resolve(root);
  need(resolved.startsWith(base+path.sep)&&
    /^zgmini-996-test-c-reservation-[a-f0-9]{32}$/.test(path.basename(resolved)),
    'C_996_SHARED_RESERVATION_TEST_ROOT_UNSAFE');
  let current=resolved;
  for(;;){
    checkedDirectory(current);
    if(current===base)break;
    current=path.dirname(current);
    need(current.startsWith(base),
      'C_996_SHARED_RESERVATION_TEST_ROOT_UNSAFE');
  }
  need(fs.realpathSync.native(resolved)===resolved,
    'C_996_SHARED_RESERVATION_TEST_ROOT_REDIRECT');
  return path.join(resolved,'leases');
}
function pinnedOwner(dir){
  checkedDirectory(dir);
  const file=path.join(dir,'owner.json');
  const st=fs.lstatSync(file);
  need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
    st.size>0&&st.size<=16_384,
    'C_996_SHARED_RESERVATION_ORIGINAL_OWNER_UNSAFE');
  return hash(fs.readFileSync(file));
}
function absent(file){
  try{fs.lstatSync(file);return false;}
  catch(e){if(e?.code==='ENOENT')return true;throw e;}
}
function writeOnce(dir,name,record){
  checkedDirectory(dir);
  need(name==='owner.json',
    'C_996_SHARED_RESERVATION_OWNER_FILE_INVALID');
  const bytes=Buffer.from(JSON.stringify(record)+'\n');
  need(bytes.length>0&&bytes.length<16_384,
    'C_996_SHARED_RESERVATION_OWNER_BOUNDS');
  const file=path.join(dir,name),fd=fs.openSync(file,'wx',0o600);
  try{fs.writeSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  need(fs.readFileSync(file).equals(bytes),
    'C_996_SHARED_RESERVATION_OWNER_READBACK_DRIFT');
  return hash(bytes);
}
function noConflict(readSynthetic){
  const state=readSynthetic();
  need(state?.workflowState==='active'&&
    state?.protectionVerified===true&&
    state?.writerActiveCount===0&&
    state?.controllerActiveCount===0&&
    state?.otherContinuationCount===0,
    'C_996_SHARED_RESERVATION_SYNTHETIC_CONFLICT');
}

/**
 * Demonstration only. It creates a fixed, exclusive mkdir on a disposable
 * Linux TEMP root. The caller must have pre-created two dummy owner.json
 * directories. There is deliberately no release/unlink/retry/rollback path.
 * The canonical controller-install directory is never moved or changed.
 */
export function simulate996CSharedReservation({testOnly=false,root=null,
  continuationRequestId=null,nonce=null,sourceLockSha256=null,
  readSynthetic=null,failAfter=null}={}){
  if(!testOnly||process.platform==='win32')return failure(
    'C_996_SHARED_RESERVATION_PRODUCTION_DISABLED');
  try{
    need(UUID(continuationRequestId)&&UUID(nonce)&&
      HEX(sourceLockSha256)&&continuationRequestId!==ORIGINAL&&
      typeof readSynthetic==='function'&&
      [null,'AFTER_FENCE','AFTER_FENCE_OWNER','AFTER_CLAIM'].includes(failAfter),
      'C_996_SHARED_RESERVATION_INPUT_INVALID');
    const leases=checkedFixtureRoot(root);
    checkedDirectory(leases);
    const names=fs.readdirSync(leases).sort();
    const fixed=path.join(leases,FIXED_NAME);
    if(!absent(fixed))return failure('C_996_SHARED_RESERVATION_BUSY');
    need(JSON.stringify(names)===JSON.stringify([INSTALL,OLD].sort()),
      'C_996_SHARED_RESERVATION_UNEXPECTED_LEASE');
    const old=path.join(leases,OLD),install=path.join(leases,INSTALL);
    const oldSha=pinnedOwner(old),installSha=pinnedOwner(install);
    noConflict(readSynthetic);
    // The fixed name is independent of continuationRequestId. A second
    // process must fail mkdir rather than create a new parallel UUID claim.
    try{fs.mkdirSync(fixed,{mode:0o700});}
    catch(e){if(e?.code==='EEXIST')return failure(
      'C_996_SHARED_RESERVATION_BUSY');throw e;}
    if(failAfter==='AFTER_FENCE')throw error(
      'C_996_SHARED_RESERVATION_INJECTED_AFTER_FENCE');
    const owner={schema:'ZGMINI_996_C_SHARED_RESERVATION_FIXTURE_V1',
      originalRequestId:ORIGINAL,continuationRequestId,nonce,
      sourceLockSha256,phase:'RESERVED_TEST_ONLY'};
    const ownerSha=writeOnce(fixed,'owner.json',owner);
    if(failAfter==='AFTER_FENCE_OWNER')throw error(
      'C_996_SHARED_RESERVATION_INJECTED_AFTER_FENCE_OWNER');
    noConflict(readSynthetic);
    need(pinnedOwner(old)===oldSha&&pinnedOwner(install)===installSha,
      'C_996_SHARED_RESERVATION_ORIGINAL_DRIFT');
    need(pinnedOwner(fixed)===ownerSha,
      'C_996_SHARED_RESERVATION_FENCE_OWNER_DRIFT');
    const claim=path.join(leases,
      'controller-recovery-continuation-'+continuationRequestId);
    need(absent(claim),'C_996_SHARED_RESERVATION_DUPLICATE_CLAIM');
    fs.mkdirSync(claim,{mode:0o700});
    if(failAfter==='AFTER_CLAIM')throw error(
      'C_996_SHARED_RESERVATION_INJECTED_AFTER_CLAIM');
    writeOnce(claim,'owner.json',{...owner,phase:'CLAIMED_TEST_ONLY'});
    need(pinnedOwner(old)===oldSha&&pinnedOwner(install)===installSha,
      'C_996_SHARED_RESERVATION_INSTALL_OR_OLD_CHANGED');
    return success(continuationRequestId,nonce);
  }catch(e){
    return failure(/^C_996_SHARED_RESERVATION_[A-Z0-9_]+$/.test(e?.code??'')?
      e.code:'C_996_SHARED_RESERVATION_STATE_UNKNOWN');
  }
}
