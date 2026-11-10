// #996 interrupted-C physical readback prototype — SOURCE/ISOLATED TEST ONLY.
// Reads real bytes from a uniquely named disposable *Linux* TEMP fixture,
// never a real Windows installation or E:\ZGmini. This prototype deliberately
// cannot authenticate an original Windows machine, live Writer, owner PID,
// previous Claim provenance, GitHub consent, or a trusted source of SHA pins.
// It performs no writes, network calls, lock acquisition, cleanup or retry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classify996CPhysicalDisposition} from
  './controller-996-c-physical-disposition-readonly.mjs';

const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ROOT_NAME=/^zgmini-996-test-physical-[a-f0-9]{32}$/;
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const SHA=b=>createHash('sha256').update(b).digest('hex');
const error=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_C_PHYSICAL_FIXTURE_READBACK_V1',
  status:'C_PHYSICAL_FIXTURE_READBACK_BLOCKED',code,
  liveOriginalPcVerified:false,independentAuthentication:false,
  executionAuthorized:false,productionExecutable:false,
  operationalWrites:0,workflowPuts:0,backlogWrites:0,
  issuePosts:0,pcRetries:0,cleanupPerformed:false,
});
const need=(condition,code)=>{if(!condition)throw Object.assign(Error(code),{code});};
function safeDirectory(directory){
  let at=directory;
  for(;;){
    const stat=fs.lstatSync(at);
    need(stat.isDirectory()&&!stat.isSymbolicLink(),
      'C_PHYSICAL_FIXTURE_REDIRECT_OR_NON_DIRECTORY');
    const parent=path.dirname(at);
    if(parent===at)break;
    at=parent;
  }
}
function safeFixtureRoot(root){
  if(typeof root!=='string'||!path.isAbsolute(root)||
    process.platform==='win32')return false;
  const base=path.resolve(os.tmpdir()),resolved=path.resolve(root);
  if(!resolved.startsWith(base+path.sep)||
    !ROOT_NAME.test(path.basename(resolved)))return false;
  try{
    safeDirectory(resolved);
    return fs.realpathSync.native(resolved)===resolved;
  }catch{return false;}
}
function readFileBounded(file){
  const st=fs.lstatSync(file);
  need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
    st.size>0&&st.size<=2_000_000,
    'C_PHYSICAL_FIXTURE_FILE_UNSAFE');
  const content=fs.readFileSync(file);
  need(content.length===st.size,
    'C_PHYSICAL_FIXTURE_FILE_CHANGED_DURING_READ');
  return content;
}
function jsonFile(file){
  const content=readFileBounded(file);
  let data;
  try{data=JSON.parse(content.toString('utf8'));}
  catch{need(false,'C_PHYSICAL_FIXTURE_JSON_UNVERIFIED');}
  need(data!==null&&typeof data==='object'&&!Array.isArray(data),
    'C_PHYSICAL_FIXTURE_JSON_NOT_OBJECT');
  return data;
}
function maybeDirectoryInventory(leases,name){
  const dir=path.join(leases,name);
  let st;
  try{st=fs.lstatSync(dir);}
  catch(e){
    if(e?.code==='ENOENT')return {present:false,files:null};
    throw e;
  }
  need(st.isDirectory()&&!st.isSymbolicLink(),
    'C_PHYSICAL_FIXTURE_CLAIM_REDIRECT');
  const files=Object.create(null);
  for(const entry of fs.readdirSync(dir).sort()){
    need(/^(?:owner|PREPARED|WORKFLOW_ENABLE_ATTEMPTED|BACKLOG_CLOSE_ATTEMPTED|RECOVERY_REQUIRED|OLD_C_CLAIM_ARCHIVE_ATTEMPTED|READY_TO_RELEASE_INSTALL)\.json$/.test(entry),
      'C_PHYSICAL_FIXTURE_UNEXPECTED_CLAIM_ENTRY');
    files[entry]=SHA(readFileBounded(path.join(dir,entry)));
  }
  need(Object.keys(files).length>0,
    'C_PHYSICAL_FIXTURE_EMPTY_CLAIM');
  return {present:true,files};
}
function optionalMarker(leases,names,filename){
  for(const name of names){
    const dir=path.join(leases,name);
    if(fs.existsSync(dir)){
      const marker=path.join(dir,filename);
      if(fs.existsSync(marker))return jsonFile(marker);
    }
  }
  return null;
}
function collectRound(root,id){
  const leases=path.join(root,'automation','pc-maintenance','leases');
  safeDirectory(leases);
  const names={
    oldC:'controller-recovery',
    oldCArchive:`controller-recovery-archived-${ORIGINAL}`,
    continuation:`controller-recovery-continuation-${id}`,
    continuationArchive:`controller-recovery-continuation-archived-${id}`,
    install:'controller-install',
    installArchive:`controller-install-recovered-${ORIGINAL}`,
  };
  const all=fs.readdirSync(leases);
  const known=new Set(Object.values(names));
  need(!all.some(name=>name.startsWith('controller-recovery-continuation-')&&
      !known.has(name)),
    'C_PHYSICAL_FIXTURE_OTHER_CONTINUATION_DETECTED');
  const paths={};
  for(const [key,name] of Object.entries(names))
    paths[key]=maybeDirectoryInventory(leases,name);
  const live=jsonFile(path.join(root,'live.json'));
  need(live.schema==='ZGMINI_996_PHYSICAL_FIXTURE_LIVE_V1'&&
    live.originalRequestId===ORIGINAL&&live.conflicts&&
    typeof live.conflicts==='object'&&!Array.isArray(live.conflicts),
    'C_PHYSICAL_FIXTURE_CONFLICTS_UNVERIFIED');
  const continuationOwner=optionalMarker(leases,
    [names.continuation,names.continuationArchive],'owner.json');
  const ready=optionalMarker(leases,
    [names.continuation,names.continuationArchive],
    'READY_TO_RELEASE_INSTALL.json');
  return {paths,conflicts:live.conflicts,continuationOwner,ready};
}

/**
 * No real Windows support; no caller-provided "verified" flag is accepted.
 * Actual SHA input still requires a separately proven original-PC source.
 * The two immediate fixture reads demonstrate only synthetic snapshot
 * consistency, not an atomic operating-PC CAS or independent owner identity.
 */
export function inspect996CPhysicalFixtureReadOnly({testOnly=false,root=null,
  continuationRequestId=null,pins=null,betweenReads=null}={}){
  if(!testOnly)return error('C_PHYSICAL_FIXTURE_PRODUCTION_DISABLED');
  if(!safeFixtureRoot(root))return error('C_PHYSICAL_FIXTURE_ROOT_REJECTED');
  if(!UUID(continuationRequestId)||
    (betweenReads!==null&&typeof betweenReads!=='function'))
    return error('C_PHYSICAL_FIXTURE_INPUT_INVALID');
  try{
    const first=collectRound(root,continuationRequestId);
    if(betweenReads)betweenReads(); // Test-only fault hook; this module does not mutate.
    const second=collectRound(root,continuationRequestId);
    need(JSON.stringify(first)===JSON.stringify(second),
      'C_PHYSICAL_FIXTURE_DOUBLE_READ_DRIFT');
    const result=classify996CPhysicalDisposition({
      snapshot:{schema:'ZGMINI_CONTROLLER_996_C_PHYSICAL_SNAPSHOT_V1',
        originalRequestId:ORIGINAL,continuationRequestId,
        readOnly:true,twoSnapshotsIdentical:true,fresh:true,
        ...second},
      pins,
    });
    return Object.freeze({
      schema:'ZGMINI_CONTROLLER_996_C_PHYSICAL_FIXTURE_READBACK_V1',
      status:result.status==='C_DISPOSITION_SNAPSHOT_CLASSIFIED_ONLY'?
        'C_PHYSICAL_FIXTURE_SNAPSHOT_CLASSIFIED_ONLY':
        'C_PHYSICAL_FIXTURE_READBACK_BLOCKED',
      phase:result.phase,code:result.code,
      liveOriginalPcVerified:false,independentAuthentication:false,
      executionAuthorized:false,productionExecutable:false,
      operationalWrites:0,workflowPuts:0,backlogWrites:0,
      issuePosts:0,pcRetries:0,cleanupPerformed:false,
    });
  }catch(e){
    return error(/^C_PHYSICAL_FIXTURE_[A-Z0-9_]+$/.test(e?.code??'')?
      e.code:'C_PHYSICAL_FIXTURE_READ_STATE_UNKNOWN');
  }
}
