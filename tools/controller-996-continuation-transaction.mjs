// #996 proposed C continuation transaction — ISOLATED TEST ONLY.
// This is NOT a production operator, CLI, approval receipt or Windows runner.
// Production is unconditionally rejected before any filesystem operation.
// No Workflow PUT, backlog rename, Issue post, PC retry or source installation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const CORE='badad9124157879d7a645b64f2768113d632355b';
const STAGED='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const MAINT='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const MAINT_FILES=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs',
  'tools/source-bundle-register.mjs'];
const MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED'];
const SHA=b=>createHash('sha256').update(b).digest('hex');
const H64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const stable=a=>JSON.stringify(a);
const sorted=a=>a.slice().sort();
function safeTestRoot(root){
  if(typeof root!=='string'||!path.isAbsolute(root))return false;
  const base=path.resolve(os.tmpdir()),resolved=path.resolve(root);
  if(!resolved.startsWith(base+path.sep)||
    !path.basename(resolved).startsWith('zgmini-996-test-'))return false;
  try{
    let current=resolved;
    for(;;){
      const st=fs.lstatSync(current);
      if(!st.isDirectory()||st.isSymbolicLink())return false;
      if(current===base)break;
      current=path.dirname(current);
      if(current.length<base.length)return false;
    }
    return fs.realpathSync.native(resolved)===resolved;
  }catch{return false;}
}
const relSafe=x=>typeof x==='string'&&!x.includes('\\')&&
  x.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!path.isAbsolute(x);
const ctrlRel=x=>/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(x);

function checked(root,rel,directory=false){
  need(relSafe(rel),'C_CONTINUATION_PATH_INVALID');
  let at=root;
  for(const [i,part] of rel.split('/').entries()){
    const parent=fs.lstatSync(at);
    need(parent.isDirectory()&&!parent.isSymbolicLink(),
      'C_CONTINUATION_PARENT_REDIRECT');
    at=path.join(at,part);
    const st=fs.lstatSync(at);
    need(!st.isSymbolicLink(),'C_CONTINUATION_PATH_REDIRECT');
    if(i===rel.split('/').length-1){
      need(directory?st.isDirectory():st.isFile()&&st.nlink===1&&
        st.size>0&&st.size<=2_000_000,'C_CONTINUATION_TARGET_UNSAFE');
    }
  }
  return at;
}
const file=(root,rel)=>fs.readFileSync(checked(root,rel));
const entry=(root,rel)=>{
  const content=file(root,rel);
  let data;
  try{data=JSON.parse(content.toString('utf8'));}catch{}
  need(data&&typeof data==='object'&&!Array.isArray(data),
    'C_CONTINUATION_JSON_INVALID');
  return {data,sha:SHA(content)};
};
const dirNames=(root,rel)=>sorted(fs.readdirSync(checked(root,rel,true)));
const absent=(root,rel)=>{
  try{checked(root,rel,true);return false;}
  catch(e){if(e.code==='ENOENT')return true;throw e;}
};
// Test-only no-clobber layout: atomically reserve a NEW archive directory,
// then move the old directory into its private `payload` child. A pre-existing
// archive path cannot be silently replaced by rename(2) on POSIX. A crash
// after reservation intentionally leaves the old directory and reservation
// untouched, so a second run refuses rather than guessing the disposition.
// This does NOT provide a Windows production move adapter or a hostile
// same-user TOCTOU guarantee; those require a separately approved operator.
function archiveInReservedDirectory(root,fromRel,toRel,
  {afterReserve=null,beforeReserve=null,verifySource=null}={}){
  need(absent(root,toRel),'C_CONTINUATION_ARCHIVE_DESTINATION_EXISTS');
  const from=checked(root,fromRel,true);
  const to=path.join(root,...toRel.split('/'));
  if(beforeReserve)beforeReserve({fromRel,toRel}); // Only test injection.
  try{fs.mkdirSync(to,{mode:0o700});}
  catch(e){if(e.code==='EEXIST')need(false,
    'C_CONTINUATION_ARCHIVE_RESERVATION_TAKEN');throw e;}
  const st=fs.lstatSync(to);
  need(st.isDirectory()&&!st.isSymbolicLink()&&
    sorted(fs.readdirSync(to)).length===0,
    'C_CONTINUATION_ARCHIVE_RESERVATION_UNSAFE');
  if(afterReserve)throw Object.assign(Error('injected'),{
    code:afterReserve});
  if(verifySource)verifySource();
  const payload=path.join(to,'payload');
  need(absent(root,toRel+'/payload'),
    'C_CONTINUATION_ARCHIVE_PAYLOAD_EXISTS');
  fs.renameSync(checked(root,fromRel,true),payload);
  need(!fs.existsSync(from)&&fs.lstatSync(payload).isDirectory(),
    'C_CONTINUATION_ARCHIVE_MOVE_UNCERTAIN');
  return toRel+'/payload';
}
const ensureLive=readLive=>{
  const state=readLive();
  need(state?.workflowState==='active'&&state?.protectionVerified===true&&
    state?.controllerConflictCount===0&&state?.writerConflictCount===0,
    'C_CONTINUATION_SHARED_STATE_NOT_VERIFIED');
};
const sameSHA=(current,pinned,name)=>need(H64(pinned)&&current===pinned,
  'C_CONTINUATION_'+name+'_SHA_DRIFT');

function sourceSet(root,manifest,base,sourceSha,count,gitShow,stage=false){
  need(manifest?.controllerSourceSha===sourceSha&&
    manifest?.controllerFiles&&typeof manifest.controllerFiles==='object'&&
    !Array.isArray(manifest.controllerFiles),
    'C_CONTINUATION_SOURCE_MANIFEST_INVALID');
  const files=sorted(Object.keys(manifest.controllerFiles));
  need(files.length===count&&files.every(x=>
    ctrlRel(x)&&H64(manifest.controllerFiles[x])),
    'C_CONTINUATION_SOURCE_SET_INVALID');
  if(stage){
    const observed=[];
    for(const d of ['controller','config']){
      for(const name of dirNames(root,base+'/'+d))observed.push(d+'/'+name);
    }
    need(stable(sorted(observed))===stable(files)&&
      stable(dirNames(root,base))===stable(['config','controller','host.json']),
      'C_CONTINUATION_STAGE_EXTRA_FILE');
  }
  for(const rel of files){
    const actual=file(root,base+'/'+rel);
    sameSHA(SHA(actual),manifest.controllerFiles[rel],'SOURCE');
    const committed=gitShow(sourceSha,rel);
    need(Buffer.isBuffer(committed)&&actual.equals(committed),
      'C_CONTINUATION_GIT_SOURCE_BYTE_MISMATCH');
  }
  return files.length;
}
function maintSet(root,manifest,gitShow){
  need(manifest?.schema==='ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&
    manifest?.sourceSha===MAINT&&manifest.files&&
    typeof manifest.files==='object'&&!Array.isArray(manifest.files)&&
    stable(sorted(Object.keys(manifest.files)))===stable(sorted(MAINT_FILES)),
    'C_CONTINUATION_MAINTAINER_MANIFEST_INVALID');
  for(const rel of MAINT_FILES){
    need(H64(manifest.files[rel]),'C_CONTINUATION_MAINTAINER_MAP_INVALID');
    const actual=file(root,'automation/pc-maintenance/'+rel);
    sameSHA(SHA(actual),manifest.files[rel],'MAINTAINER');
    const committed=gitShow(MAINT,rel);
    need(Buffer.isBuffer(committed)&&actual.equals(committed),
      'C_CONTINUATION_GIT_MAINTAINER_BYTE_MISMATCH');
  }
  return MAINT_FILES.length;
}

function inspect(root,consent,gitShow,isAlive,readLive){
  ensureLive(readLive);
  const prefix='automation/pc-maintenance';
  const owner=`${prefix}/leases/controller-recovery`;
  const install=`${prefix}/leases/controller-install`;
  const cont=`${prefix}/leases/controller-recovery-continuation-${consent.requestId}`;
  const contArchive=`${prefix}/leases/controller-recovery-continuation-archived-${consent.requestId}`;
  const oldCArchive=`${prefix}/leases/controller-recovery-archived-${REQ}`;
  const oldInstallArchive=`${prefix}/leases/controller-install-recovered-${REQ}`;
  need(absent(root,cont)&&absent(root,contArchive)&&
    absent(root,oldCArchive)&&absent(root,oldInstallArchive),
    'C_CONTINUATION_ARCHIVE_OR_ACTIVE_CLAIM_EXISTS');
  need(stable(dirNames(root,owner))===stable(sorted([
    'owner.json',...MARKERS.map(x=>x+'.json')])),
    'C_CONTINUATION_OLD_C_CLAIM_SET_INVALID');
  const current={oldC:entry(root,owner+'/owner.json'),
    installOwner:entry(root,install+'/owner.json'),
    installRecovery:entry(root,install+'/RECOVERY_REQUIRED.json'),
    backlog:entry(root,`${prefix}/backlog/${REQ}.json`),
    installed:entry(root,'automation/pc-control/host.json'),
    stage:entry(root,`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`),
    maintainer:entry(root,`${prefix}/MAINTENANCE_INSTALL.json`)};
  for(const marker of MARKERS)current[marker]=entry(root,owner+'/'+marker+'.json');
  const pinned=consent.pins;
  for(const k of Object.keys(current))sameSHA(current[k].sha,pinned[k],k.toUpperCase());
  const c=current.oldC.data,installOwner=current.installOwner.data;
  need(c.requestId===REQ&&c.issueNumber===996&&
    typeof c.nonce==='string'&&c.nonce.length>0&&
    Number.isSafeInteger(c.pid)&&c.pid>0&&isAlive(c.pid)===false&&
    Number.isSafeInteger(installOwner.pid)&&installOwner.pid>0&&
    isAlive(installOwner.pid)===false,
    'C_CONTINUATION_OLD_OWNER_UNVERIFIED');
  for(const m of MARKERS){
    const marker=current[m].data;
    need(marker.schema==='ZGMINI_CONTROLLER_996_C_MARKER_V1'&&
      marker.requestId===REQ&&marker.issueNumber===996&&
      marker.name===m&&marker.ownerNonce===c.nonce,
      'C_CONTINUATION_MARKER_PROVENANCE_INVALID');
  }
  const backlog=current.backlog.data;
  need(backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&backlog.requestId===REQ&&
    backlog.pausedAt===consent.pausedAt&&
    backlog.resumedAt===consent.resumedAt&&
    stable(backlog.replays)==='{}',
    'C_CONTINUATION_BACKLOG_NOT_VERIFIED_EMPTY');
  const stageBase=`automation/pc-control/backups/controller-update-${REQ}/stage`;
  const sourceFiles={
    installed:sourceSet(root,current.installed.data,'automation/pc-control',CORE,38,gitShow),
    staged:sourceSet(root,current.stage.data,stageBase,STAGED,39,gitShow,true),
    maintainer:maintSet(root,current.maintainer.data,gitShow),
  };
  return {current,sourceFiles,paths:{owner,install,cont,contArchive,
    oldCArchive,oldInstallArchive}};
}

function writeOnce(root,dir,name,data){
  checked(root,dir,true);
  need(/^[A-Z0-9_]{3,55}\.json$/.test(name)||name==='owner.json',
    'C_CONTINUATION_MARKER_NAME_INVALID');
  const destination=path.join(root,...dir.split('/'),name);
  const content=Buffer.from(JSON.stringify(data)+'\n');
  need(content.length<16_384,'C_CONTINUATION_MARKER_TOO_LARGE');
  const fd=fs.openSync(destination,'wx',0o600);
  try{fs.writeSync(fd,content);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  need(file(root,dir+'/'+name).equals(content),
    'C_CONTINUATION_MARKER_WRITE_READBACK_UNCERTAIN');
}
function assertPreserved(root,from,to,pins){
  sameSHA(SHA(file(root,to+'/owner.json')),
    pins[from==='oldC'?'oldC':'installOwner'],'ARCHIVED_OWNER');
  if(from==='oldC'){
    for(const marker of MARKERS)
      sameSHA(SHA(file(root,to+'/'+marker+'.json')),
        pins[marker],'ARCHIVED_MARKER');
  }else sameSHA(SHA(file(root,to+'/RECOVERY_REQUIRED.json')),
    pins.installRecovery,'ARCHIVED_RECOVERY');
}
const failure=code=>Object.freeze({status:'C_CONTINUATION_TEST_STATE_UNKNOWN',
  code,executionAuthorized:false,productionExecutable:false,
  originalRequestRetried:false,workflowPuts:0,backlogWrites:0,issuePosts:0});

/** Mutating simulation is permitted ONLY inside a dedicated disposable temp
 * fixture on non-Windows systems. A production invocation always refuses.
 * The future approved Windows operator must be separately implemented and
 * verified; this function cannot be converted with a CLI flag. */
export function simulate996Continuation({testOnly=false,root=null,consent=null,
  independentConsentVerified=false,sourceRead=null,isAlive=null,
  readLive=null,now=()=>new Date().toISOString(),
  uuid=randomUUID,failAfter=null,beforeArchiveReserve=null}={}){
  if(!testOnly||process.platform==='win32')return failure(
    'C_CONTINUATION_PRODUCTION_NOT_APPROVED');
  try{
    need(safeTestRoot(root),
      'C_CONTINUATION_TEST_ROOT_REJECTED');
    need(consent?.schema==='ZGMINI_CONTROLLER_996_CONTINUATION_CANDIDATE_V1'&&
      consent.operation==='ARCHIVE_OLD_C_CLAIM_THEN_INSTALL_LEASE'&&
      consent.approved===true&&independentConsentVerified===true&&
      UUID(consent.requestId)&&consent.requestId!==REQ&&
      consent.originalRequestId===REQ&&H64(consent.sourceLockSha256)&&
      consent.pins&&typeof consent.pins==='object'&&
      ['oldC','installOwner','installRecovery','backlog','installed','stage',
       'maintainer',...MARKERS].every(k=>H64(consent.pins[k]))&&
      typeof sourceRead==='function'&&typeof isAlive==='function'&&
      typeof readLive==='function'&&typeof now==='function'&&
      typeof uuid==='function'&&
      (beforeArchiveReserve===null||typeof beforeArchiveReserve==='function')&&
      [null,'AFTER_RESERVE','AFTER_OLD_C_RESERVATION',
        'AFTER_OLD_C_ARCHIVE','AFTER_RELEASE_INTENT',
        'AFTER_CONTINUATION_ARCHIVE','AFTER_INSTALL_RESERVATION',
        'AFTER_INSTALL_ARCHIVE'].includes(failAfter),
      'C_CONTINUATION_CONSENT_OR_PORT_NOT_VERIFIED');
    const first=inspect(root,consent,sourceRead,isAlive,readLive);
    const second=inspect(root,consent,sourceRead,isAlive,readLive);
    need(stable(Object.fromEntries(Object.entries(first.current)
      .map(([k,v])=>[k,v.sha])))===
      stable(Object.fromEntries(Object.entries(second.current)
        .map(([k,v])=>[k,v.sha]))),
      'C_CONTINUATION_PRECLAIM_EVIDENCE_CHANGED');
    const p=second.paths,owner={schema:'ZGMINI_996_CONTINUATION_CLAIM_V1',
      requestId:consent.requestId,originalRequestId:REQ,
      pid:process.pid,nonce:uuid(),at:now()};
    need(UUID(owner.nonce),'C_CONTINUATION_NONCE_INVALID');
    const cdir=path.join(root,...p.cont.split('/'));
    fs.mkdirSync(cdir); // Exclusively creates a NEW claim; never adopts old.
    writeOnce(root,p.cont,'owner.json',owner);
    const ownRead=()=>{
      const current=entry(root,p.cont+'/owner.json').data;
      need(current.schema===owner.schema&&current.requestId===owner.requestId&&
        current.originalRequestId===REQ&&current.pid===owner.pid&&
        current.nonce===owner.nonce&&current.at===owner.at,
        'C_CONTINUATION_OWN_CLAIM_OWNER_CHANGED');
    };
    ownRead();
    writeOnce(root,p.cont,'PREPARED.json',{schema:owner.schema,
      requestId:consent.requestId,ownerNonce:owner.nonce,
      sourceLockSha256:consent.sourceLockSha256,
      oldClaimSha256:consent.pins.oldC,at:now()});
    if(failAfter==='AFTER_RESERVE')throw Object.assign(Error('injected'),{
      code:'C_CONTINUATION_INJECTED_AFTER_RESERVE'});
    // The old install lease still blocks other Controller installs while the
    // abandoned C claim is archived. Release the install lease LAST.
    ensureLive(readLive);
    ownRead();
    need(absent(root,p.oldCArchive),
      'C_CONTINUATION_OLD_C_ARCHIVE_DESTINATION_EXISTS');
    sameSHA(SHA(file(root,p.owner+'/owner.json')),consent.pins.oldC,'OLD_C');
    writeOnce(root,p.cont,'OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json',{
      source:REQ,oldClaimSha256:consent.pins.oldC,at:now()});
    const oldCArchived=archiveInReservedDirectory(root,p.owner,p.oldCArchive,{
      beforeReserve:beforeArchiveReserve,
      verifySource:()=>assertPreserved(root,'oldC',p.owner,consent.pins),
      afterReserve:failAfter==='AFTER_OLD_C_RESERVATION'?
        'C_CONTINUATION_INJECTED_AFTER_OLD_C_RESERVATION':null});
    assertPreserved(root,'oldC',oldCArchived,consent.pins);
    if(failAfter==='AFTER_OLD_C_ARCHIVE')throw Object.assign(Error('injected'),{
      code:'C_CONTINUATION_INJECTED_AFTER_OLD_C_ARCHIVE'});
    // The installed Controller's real admission barrier is the canonical
    // `controller-install` directory. The new C claim does NOT fence other
    // installers. Archive the new claim before releasing this barrier.
    ensureLive(readLive);
    ownRead();
    need(absent(root,p.contArchive),
      'C_CONTINUATION_NEW_CLAIM_ARCHIVE_DESTINATION_EXISTS');
    const releaseIntent={schema:'ZGMINI_996_CONTINUATION_READY_V1',
      name:'READY_TO_RELEASE_INSTALL',requestId:consent.requestId,
      originalRequestId:REQ,ownerNonce:owner.nonce,
      sourceLockSha256:consent.sourceLockSha256,
      oldCArchiveOwnerSha256:consent.pins.oldC,
      installOwnerSha256:consent.pins.installOwner,
      installRecoverySha256:consent.pins.installRecovery,
      // This is NOT a DONE marker; the final lease move has not happened.
      finalReleasePending:true,at:now()};
    writeOnce(root,p.cont,'READY_TO_RELEASE_INSTALL.json',releaseIntent);
    const intentSha=SHA(file(root,p.cont+'/READY_TO_RELEASE_INSTALL.json'));
    if(failAfter==='AFTER_RELEASE_INTENT')throw Object.assign(Error('injected'),{
      code:'C_CONTINUATION_INJECTED_AFTER_RELEASE_INTENT'});
    const continuationArchived=archiveInReservedDirectory(root,p.cont,p.contArchive);
    const contPayload=continuationArchived;
    sameSHA(SHA(file(root,contPayload+'/owner.json')),
      SHA(Buffer.from(JSON.stringify(owner)+'\n')),
      'CONTINUATION_OWNER');
    sameSHA(SHA(file(root,contPayload+'/READY_TO_RELEASE_INSTALL.json')),
      intentSha,'RELEASE_INTENT');
    need(stable(entry(root,contPayload+'/READY_TO_RELEASE_INSTALL.json').data)===
      stable(releaseIntent),'C_CONTINUATION_RELEASE_INTENT_DRIFT');
    if(failAfter==='AFTER_CONTINUATION_ARCHIVE')throw Object.assign(Error('injected'),{
      code:'C_CONTINUATION_INJECTED_AFTER_CONTINUATION_ARCHIVE'});
    // All remaining writes MUST be limited to exactly the final lease move.
    ensureLive(readLive);
    need(absent(root,p.oldInstallArchive),
      'C_CONTINUATION_INSTALL_ARCHIVE_DESTINATION_EXISTS');
    assertPreserved(root,'oldC',oldCArchived,consent.pins);
    sameSHA(SHA(file(root,contPayload+'/READY_TO_RELEASE_INSTALL.json')),
      intentSha,'RELEASE_INTENT');
    sameSHA(SHA(file(root,p.install+'/owner.json')),
      consent.pins.installOwner,'INSTALL_OWNER');
    sameSHA(SHA(file(root,p.install+'/RECOVERY_REQUIRED.json')),
      consent.pins.installRecovery,'INSTALL_RECOVERY');
    const installArchived=archiveInReservedDirectory(root,p.install,
      p.oldInstallArchive,{
        beforeReserve:beforeArchiveReserve,
        verifySource:()=>assertPreserved(root,'install',p.install,consent.pins),
        afterReserve:failAfter==='AFTER_INSTALL_RESERVATION'?
          'C_CONTINUATION_INJECTED_AFTER_INSTALL_RESERVATION':null});
    // After this move: read-only postchecks, NO further filesystem writes.
    if(failAfter==='AFTER_INSTALL_ARCHIVE')throw Object.assign(Error('injected'),{
      code:'C_CONTINUATION_INJECTED_AFTER_INSTALL_ARCHIVE'});
    assertPreserved(root,'install',installArchived,consent.pins);
    need(absent(root,p.install)&&absent(root,p.owner)&&absent(root,p.cont),
      'C_CONTINUATION_POSTCHECK_INCOMPLETE');
    assertPreserved(root,'oldC',p.oldCArchive+'/payload',consent.pins);
    assertPreserved(root,'install',p.oldInstallArchive+'/payload',consent.pins);
    return Object.freeze({status:'C_CONTINUATION_TEST_ARCHIVED_IN_ORDER',
      code:'ISOLATED_SIMULATION_ONLY',sourceFiles:second.sourceFiles,
      archivedCClaimBeforeInstallLease:true,
      continuationClaimBeforeInstallLease:true,installLeaseLast:true,
      productionExecutable:false,
      executionAuthorized:false,originalRequestRetried:false,
      workflowPuts:0,backlogWrites:0,issuePosts:0});
  }catch(e){return failure(/^C_CONTINUATION_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_CONTINUATION_SIMULATION_STATE_UNKNOWN');}
}
