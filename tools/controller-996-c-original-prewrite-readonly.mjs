// #996 original Windows C PREWRITE READER, NOT A C OPERATOR.
// Reads the ten exact interrupted files twice and joins the existing R1
// runtime/protection + R4 84-Git-byte read-only checks. The resulting hashes
// may be used to prepare a FUTURE consent manifest. They do NOT authenticate
// a new owner, prove no Writer/Controller conflict, or permit an archive.
// No mkdir, rename, unlink, chmod, writeFile, workflow PUT, Issue POST or retry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {collect996InterruptedEvidence} from './controller-996-interrupted-observer.mjs';
import {verify996OfflineGitBytesReadOnly} from './controller-996-git-byte-offline-readonly-r4.mjs';

const ROOT='E:/ZGmini';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const B='automation/pc-maintenance';
const MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED','BACKLOG_CLOSE_ATTEMPTED'];
const FILES=Object.freeze({
  oldC:`${B}/leases/controller-recovery/owner.json`,
  installOwner:`${B}/leases/controller-install/owner.json`,
  installRecovery:`${B}/leases/controller-install/RECOVERY_REQUIRED.json`,
  backlog:`${B}/backlog/${REQ}.json`,
  installed:'automation/pc-control/host.json',
  stage:`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,
  maintainer:`${B}/MAINTENANCE_INSTALL.json`,
  PREPARED:`${B}/leases/controller-recovery/PREPARED.json`,
  WORKFLOW_ENABLE_ATTEMPTED:`${B}/leases/controller-recovery/WORKFLOW_ENABLE_ATTEMPTED.json`,
  BACKLOG_CLOSE_ATTEMPTED:`${B}/leases/controller-recovery/BACKLOG_CLOSE_ATTEMPTED.json`,
});
const NO_ARCHIVES=Object.freeze([
  `${B}/leases/controller-recovery-archived-${REQ}`,
  `${B}/leases/controller-install-recovered-${REQ}`,
  `${B}/leases/controller-recovery-continuation-reservation`,
]);
const DIGEST=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const simple=o=>o&&typeof o==='object'&&!Array.isArray(o);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));

function checked(root,rel,kind='file'){
  need(typeof rel==='string'&&!path.isAbsolute(rel)&&!rel.includes('\\')&&
    rel.split('/').every(p=>p&&p!=='.'&&p!=='..'),
    'C_996_PREWRITE_REL_PATH_INVALID');
  let current=root;
  const segments=[null,...rel.split('/')];
  for(let i=0;i<segments.length;i++){
    if(segments[i]!==null)current=path.join(current,segments[i]);
    const st=fs.lstatSync(current,{bigint:true});
    need(!st.isSymbolicLink()&&
      (i===segments.length-1&&kind==='file'?
        st.isFile()&&st.nlink===1n&&st.size>0n&&st.size<=2_000_000n:
        st.isDirectory()),'C_996_PREWRITE_PATH_UNSAFE');
  }
  return current;
}
function readPinned(root){
  const result={};
  for(const [key,rel] of Object.entries(FILES)){
    const full=checked(root,rel);
    const before=fs.lstatSync(full,{bigint:true});
    const bytes=fs.readFileSync(full);
    const after=fs.lstatSync(full,{bigint:true});
    need(before.dev===after.dev&&before.ino===after.ino&&
      before.size===after.size&&before.mtimeNs===after.mtimeNs&&
      before.ctimeNs===after.ctimeNs&&
      BigInt(bytes.length)===after.size,
      'C_996_PREWRITE_FILE_CHANGED_DURING_READ');
    let obj;try{obj=JSON.parse(bytes.toString('utf8'));}catch{}
    need(simple(obj),'C_996_PREWRITE_FILE_JSON_INVALID');
    result[key]={sha:DIGEST(bytes),value:obj,
      identity:[String(after.dev),String(after.ino),String(after.size),
        String(after.mtimeNs),String(after.ctimeNs)]};
  }
  return result;
}
function checkDirectory(root,rel,expected){
  const entries=fs.readdirSync(checked(root,rel,'directory')).sort();
  need(same(entries,expected.slice().sort()),
    'C_996_PREWRITE_CLAIM_FILE_SET_CHANGED');
}
function absent(root,rel){
  const full=path.join(checked(root,path.posix.dirname(rel),'directory'),
    path.posix.basename(rel));
  try{fs.lstatSync(full);return false;}
  catch(e){if(e?.code==='ENOENT')return true;throw e;}
}
function presence(root){
  checkDirectory(root,`${B}/leases/controller-recovery`,
    ['owner.json',...MARKERS.map(x=>x+'.json')]);
  checkDirectory(root,`${B}/leases/controller-install`,
    ['owner.json','RECOVERY_REQUIRED.json']);
  need(NO_ARCHIVES.every(p=>absent(root,p)),
    'C_996_PREWRITE_ARCHIVE_OR_RESERVATION_PRESENT');
  const names=fs.readdirSync(checked(root,`${B}/leases`,'directory'));
  need(!names.some(n=>n.startsWith('controller-recovery-continuation-')),
    'C_996_PREWRITE_OTHER_CONTINUATION_PRESENT');
  return names.filter(n=>n.startsWith('controller-')).sort();
}
function staleOwner(owner,isAlive){
  return Number.isSafeInteger(owner?.pid)&&owner.pid>0&&
    isAlive(owner.pid)===false;
}
function physicalContract(evidence,isAlive){
  const c=evidence.oldC.value,install=evidence.installOwner.value;
  need(c.requestId===REQ&&c.issueNumber===996&&
    typeof c.nonce==='string'&&c.nonce.length>0&&
    validTime(c.at)&&staleOwner(c,isAlive)&&staleOwner(install,isAlive),
    'C_996_PREWRITE_OLD_OWNER_OR_INSTALL_PID_UNKNOWN');
  for(const m of MARKERS){
    const marker=evidence[m].value;
    need(marker.schema==='ZGMINI_CONTROLLER_996_C_MARKER_V1'&&
      marker.requestId===REQ&&marker.issueNumber===996&&
      marker.name===m&&marker.ownerNonce===c.nonce&&
      validTime(marker.at)&&simple(marker.details),
      'C_996_PREWRITE_MARKER_PROVENANCE_INVALID');
  }
  const backlog=evidence.backlog.value;
  need(backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&
    backlog.requestId===REQ&&validTime(backlog.pausedAt)&&
    validTime(backlog.resumedAt)&&
    simple(backlog.replays)&&Object.keys(backlog.replays).length===0,
    'C_996_PREWRITE_BACKLOG_NOT_EMPTY_OR_UNVERIFIED');
  need(evidence.installed.value.controllerSourceSha===
    'badad9124157879d7a645b64f2768113d632355b'&&
    evidence.stage.value.controllerSourceSha===
    '9db6fff689c488a59fe8771f013b7c5d3bafc0a8'&&
    evidence.maintainer.value.sourceSha===
    '16064e29fea0e53e7769a24d93d75b6f5292cfc0',
    'C_996_PREWRITE_SOURCE_VERSIONS_CHANGED');
}
const fail=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_C_ORIGINAL_PREWRITE_READONLY_V1',
  status:'C_ORIGINAL_PREWRITE_NOT_READY',code,
  pins:null,originalWindowsReadback:false,
  independentOwnerHandoffVerified:false,
  exactNewConsentVerified:false,writerControllerConflictVerified:false,
  prewriteCasAuthorized:false,executionAuthorized:false,
  originalPcWrites:0,workflowPuts:0,backlogWrites:0,issuePosts:0,
  pcRetries:0,cleanupPerformed:false,
});
const realAlive=pid=>{
  try{process.kill(pid,0);return true;}
  catch(e){return e?.code==='ESRCH'?false:null;}
};

/**
 * Two *read-only* physical observations. Original Windows mode uses only
 * hardwired paths, GH/Windows protection checks and sealed R4 Git bytes.
 * The Linux TEMP fixture allows tests but never claims original-PC evidence.
 * No caller-supplied readback can ever produce `executionAuthorized=true`.
 */
export function collect996OriginalCPrewriteReadOnly({testOnly=false,
  root=ROOT,isAlive=realAlive,r1=null,r4=null,betweenSnapshots=null}={}){
  try{
    const temp=path.resolve(os.tmpdir()),at=path.resolve(root);
    if(testOnly){
      need(process.platform!=='win32'&&path.isAbsolute(root)&&
        at.startsWith(temp+path.sep)&&
        path.basename(at).startsWith('zgmini-996-test-')&&
        isAlive!==realAlive&&typeof r1==='function'&&
        typeof r4==='function',
        'C_996_PREWRITE_TEST_ROOT_OR_PORT_REJECTED');
    }else{
      need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
        !process.env.RUNNER_NAME&&isAlive===realAlive&&r1===null&&
        r4===null&&betweenSnapshots===null&&
        path.win32.normalize(root).toLowerCase()===
          path.win32.normalize(ROOT).toLowerCase(),
        'C_996_PREWRITE_ORIGINAL_WINDOWS_ONLY');
    }
    const firstPresence=presence(root),first=readPinned(root);
    physicalContract(first,isAlive);
    const oldR1=testOnly?r1():collect996InterruptedEvidence();
    need(oldR1?.status==='READONLY_INTERRUPTED_PHASE_CONSISTENT'&&
      oldR1.checksPassed===14&&oldR1.checksTotal===14&&
      oldR1.workflowState==='active'&&
      oldR1.executionAuthorized===false,
      'C_996_PREWRITE_R1_LIVE_PROTECTION_UNVERIFIED');
    let bytes;
    if(!testOnly)bytes=fs.readFileSync(new URL(
      './controller-996-git-byte-offline-manifest-r4.json',import.meta.url));
    const gitR4=testOnly?r4():verify996OfflineGitBytesReadOnly({
      manifestBytes:bytes,
      expectedManifestSha256:
        '0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f',
    });
    need(gitR4?.status==='SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS'&&
      gitR4.total===84&&gitR4.installed===38&&
      gitR4.staged===39&&gitR4.maintainer===7&&
      gitR4.executionAuthorized===false,
      'C_996_PREWRITE_R4_GIT_BYTES_UNVERIFIED');
    if(testOnly&&betweenSnapshots)betweenSnapshots();
    const secondPresence=presence(root),second=readPinned(root);
    physicalContract(second,isAlive);
    need(same(firstPresence,secondPresence)&&
      Object.keys(FILES).every(k=>first[k].sha===second[k].sha&&
        same(first[k].identity,second[k].identity)),
      'C_996_PREWRITE_TWO_PHYSICAL_SNAPSHOTS_DRIFT');
    return Object.freeze({
      schema:'ZGMINI_CONTROLLER_996_C_ORIGINAL_PREWRITE_READONLY_V1',
      status:'C_ORIGINAL_PREWRITE_FILE_PINS_OBSERVED_ONLY',
      originalRequestId:REQ,
      originalWindowsReadback:!testOnly,
      pins:Object.freeze(Object.fromEntries(Object.keys(FILES).map(k=>[k,second[k].sha]))),
      filesReadTwice:10,sourceBytesReadAgain:84,
      oldOwnersObservedDead:true,backlogReplayCount:0,
      protectedR1ChecksPassed:14,
      independentOwnerHandoffVerified:false,
      exactNewConsentVerified:false,writerControllerConflictVerified:false,
      prewriteCasAuthorized:false,executionAuthorized:false,
      originalPcWrites:0,workflowPuts:0,backlogWrites:0,
      issuePosts:0,pcRetries:0,cleanupPerformed:false,
    });
  }catch(e){return fail(/^C_996_PREWRITE_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_996_PREWRITE_READ_OR_STATE_UNKNOWN');}
}
