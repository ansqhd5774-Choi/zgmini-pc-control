// Source-only candidate for the existing independent B maintainer.
// Deliberately no CLI, GitHub access, Controller hook, scheduler, or PC write.
// An authorized maintainer must separately authenticate the B issue, approval,
// live Windows provenance and exclusive host lease before consuming this plan.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isBuiltin} from 'node:module';

export const SOURCE_BUNDLE_OPERATION='pc-source-bundle-register';
export const SOURCE_BUNDLE_SCHEMA='ZGMINI_PC_SOURCE_BUNDLE_MANIFEST_V1';
export const SOURCE_BUNDLE_APPROVAL_SCHEMA='ZGMINI_PC_SOURCE_BUNDLE_B_APPROVAL_V1';
export const SOURCE_BUNDLE_ISSUE_TITLE='pc-source-bundle-register';
export const SOURCE_BUNDLE_SCOPE='HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY';
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const REL_SEGMENT=/^@?[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_FILES=8192;
const MAX_MANIFEST_BYTES=1024*1024;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST_ID=new RegExp(`^pc-(?:update-)?${UUID}$`);
const CHAT_ID=new RegExp(`^chat-${UUID}$`);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const requireObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const EXACT_ISSUE_FIELDS=['schema','requestId','chatId','operation','controlRepository',
  'targetControllerSha','approvalManifestSha256'];
const EXACT_APPROVAL_FIELDS=['schema','operation','scope','sourceRepository',
  'sourceBranch','sourceSha','sourceManifestPath','sourceManifestSha256',
  'entrypoint','installedControllerSha','hostPath','hostOriginalSha256',
  'hostProposedSha256','stageBundle','backupDirectory','approval','backup'];
const exactFields=(obj,keys)=>requireObject(obj)&&Object.keys(obj).length===keys.length
  &&keys.every(k=>own(obj,k));

/** Independent maintainer admission, before any GitHub/PC I/O. */
export function validateSourceBundleIssueEnvelope(request,{
  actor,controlRepository='ansqhd5774-Choi/zgmini-pc-control',
}={}){
  if(!exactFields(request,EXACT_ISSUE_FIELDS)
    ||request.schema!=='ZGMINI_PC_MAINTENANCE_REQUEST_V1'
    ||request.operation!==SOURCE_BUNDLE_OPERATION
    ||request.controlRepository!==controlRepository
    ||controlRepository!=='ansqhd5774-Choi/zgmini-pc-control'
    ||actor!=='ansqhd5774-Choi'
    ||!REQUEST_ID.test(request.requestId??'')
    ||!CHAT_ID.test(request.chatId??'')
    ||!SHA40.test(request.targetControllerSha??'')
    ||!SHA256.test(request.approvalManifestSha256??''))fail('BUNDLE_B_ISSUE_CONTRACT_INVALID');
  return Object.freeze({...request});
}

/** B approval manifest is fetched by its issue-pinned digest from main. */
export function validateSourceBundleBApproval(request,bytes,{actor,installedSha}={}){
  validateSourceBundleIssueEnvelope(request,{actor});
  if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>65536
    ||sha256(bytes)!==request.approvalManifestSha256)fail('BUNDLE_B_APPROVAL_BYTES_DRIFT');
  let manifest;
  try{manifest=JSON.parse(bytes.toString('utf8'));}
  catch{fail('BUNDLE_B_APPROVAL_JSON_INVALID');}
  if(!exactFields(manifest,EXACT_APPROVAL_FIELDS)
    ||manifest.schema!==SOURCE_BUNDLE_APPROVAL_SCHEMA
    ||manifest.operation!==SOURCE_BUNDLE_OPERATION
    ||manifest.scope!==SOURCE_BUNDLE_SCOPE
    ||manifest.sourceRepository!=='ansqhd5774-Choi/zgmini'
    ||!SHA40.test(manifest.sourceSha??'')
    ||!SHA256.test(manifest.sourceManifestSha256??'')
    ||!SHA256.test(manifest.hostOriginalSha256??'')
    ||!SHA256.test(manifest.hostProposedSha256??'')
    ||manifest.hostOriginalSha256===manifest.hostProposedSha256
    ||manifest.installedControllerSha!==request.targetControllerSha
    ||installedSha!==request.targetControllerSha
    ||!typeofString(manifest.sourceBranch)||!typeofString(manifest.entrypoint)
    ||!typeofString(manifest.sourceManifestPath))fail('BUNDLE_B_APPROVAL_CONTRACT_INVALID');
  safeRel(manifest.entrypoint);safeRel(manifest.sourceManifestPath);
  const expectedHost='E:/ZGmini/automation/pc-control/host.json';
  const expectedStage=`E:/ZGmini/automation/pc-control/source-bundles/source-${manifest.sourceSha}`;
  const expectedBackup=`E:/ZGmini/automation/pc-control/backups/source-${request.requestId}`;
  const expectedSourceManifest=`approvals/source-bundles/manifests/${manifest.sourceSha}.json`;
  if(manifest.hostPath!==expectedHost||manifest.stageBundle!==expectedStage
    ||manifest.backupDirectory!==expectedBackup
    ||manifest.sourceManifestPath!==expectedSourceManifest)
    fail('BUNDLE_B_APPROVAL_PATH_SCOPE');
  if(!requireObject(manifest.approval)||manifest.approval.grade!=='B'
    ||manifest.approval.scope!==SOURCE_BUNDLE_SCOPE
    ||!/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/[1-9]\d*$/.test(manifest.approval.ref??'')
    ||!requireObject(manifest.backup)||manifest.backup.strategy!=='VERSIONED_SNAPSHOT'
    ||manifest.backup.rollback!=='RESTORE_HOST_SHA256'
    ||manifest.backup.originalSha256!==manifest.hostOriginalSha256)
    fail('BUNDLE_B_APPROVAL_PROTECTION_INVALID');
  return Object.freeze({...manifest});
}

function safeRel(rel){
  if(typeof rel!=='string'||rel.length>240||rel.includes('\\')||rel.includes('%')
    ||rel.includes(':')||rel.includes('\0')||path.posix.isAbsolute(rel))fail('BUNDLE_UNSAFE_PATH');
  const segments=rel.split('/');
  if(!segments.length||segments.some(s=>!REL_SEGMENT.test(s)||s==='.'||s==='..'))
    fail('BUNDLE_UNSAFE_PATH');
  return rel;
}

function requireRealDirectory(dir,code){
  let stat,real;
  try{stat=fs.lstatSync(dir);real=fs.realpathSync.native(dir);}catch{fail(code);}
  if(!stat.isDirectory()||stat.isSymbolicLink()
    ||path.normalize(real).toLowerCase()!==path.normalize(path.resolve(dir)).toLowerCase())fail(code);
}

function readFileStrict(file){
  let stat;
  try{stat=fs.lstatSync(file);}catch{fail('BUNDLE_SOURCE_MISSING');}
  if(!stat.isFile()||stat.isSymbolicLink())fail('BUNDLE_SOURCE_NOT_REGULAR');
  return fs.readFileSync(file);
}

function verifyInventory(stageBundle,files,manifestBytes){
  const found=[];
  const walk=(dir,prefix='')=>{
    requireRealDirectory(dir,'BUNDLE_DIRECTORY_ALIAS');
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const rel=prefix?`${prefix}/${entry.name}`:entry.name;
      safeRel(rel);
      const abs=path.join(dir,entry.name);
      if(entry.isSymbolicLink())fail('BUNDLE_SYMLINK_FORBIDDEN');
      if(entry.isDirectory())walk(abs,rel);
      else if(entry.isFile())found.push(rel);
      else fail('BUNDLE_NON_REGULAR_FILE');
    }
  };
  walk(stageBundle);
  const expected=['manifest.json',...files.map(p=>`source/${p}`)].sort();
  const actual=found.sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail('BUNDLE_INVENTORY_NOT_CLOSED');
  if(!readFileStrict(path.join(stageBundle,'manifest.json')).equals(manifestBytes))
    fail('BUNDLE_MANIFEST_BYTES_DRIFT');
}

function verifyModules(sourceRoot,files){
  // Registration is inert. Close static/literal ESM imports, side-effect ESM
  // imports and literal CJS require. This deliberately does NOT pretend that
  // computed import(expr), require(variable), loaders or fs reads are closed;
  // those exact bytes need B source review. No source is executed here.
  const existing=new Set(files);
  for(const rel of files){
    if(!/\.(mjs|js|cjs)$/.test(rel))continue;
    const code=readFileStrict(path.join(sourceRoot,...rel.split('/'))).toString('utf8');
    const regex=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
    for(const match of code.matchAll(regex)){
      const spec=match[1];
      if(isBuiltin(spec))continue;
      if(spec.startsWith('file:')||spec.startsWith('/')||spec.startsWith('\\'))
        fail('BUNDLE_IMPORT_ESCAPE');
      if(spec.startsWith('.')){
        const target=path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec));
        safeRel(target);
        if(!existing.has(target)&&!existing.has(`${target}.js`)
          &&!existing.has(`${target}.mjs`)&&!existing.has(`${target}.cjs`)
          &&!existing.has(`${target}/index.js`))fail('BUNDLE_RELATIVE_IMPORT_UNCLOSED');
      }else{
        const base=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];
        const packageRoot=`node_modules/${base}/`;
        if(!existing.has(`${packageRoot}package.json`)
          ||!files.some(x=>x.startsWith(packageRoot)))
          fail('BUNDLE_PACKAGE_IMPORT_UNCLOSED');
        let config;
        try{config=JSON.parse(readFileStrict(path.join(sourceRoot,`${packageRoot}package.json`)));}
        catch{fail('BUNDLE_PACKAGE_METADATA_INVALID');}
        const subpath=spec.slice(base.length).replace(/^\//,'');
        const exportKey=subpath?`./${subpath}`:'.';
        const published=config.exports;
        const target=typeof published==='string'&&!subpath?published
          :typeof published==='object'&&published!==null?published[exportKey]??
            (!subpath&&published['.']===undefined?published:undefined):undefined;
        const candidates=[];
        const collect=(value)=>{
          if(typeof value==='string')candidates.push(value);
          else if(value&&typeof value==='object')for(const option of Object.values(value))collect(option);
        };
        collect(target);
        if(!candidates.length)candidates.push(subpath||config.module||config.main||'index.js');
        if(!candidates.some(x=>{
          if(!x.startsWith('./'))return false;
          const relative=path.posix.normalize(`${packageRoot}${x.slice(2)}`);
          return relative.startsWith(packageRoot)&&existing.has(relative);
        })&&!candidates.some(x=>{
          // Legacy `main` and explicit subpath use no ./ prefix.
          if(x.startsWith('.')||x.startsWith('/')||x.includes('..'))return false;
          const relative=`${packageRoot}${x}`;
          return existing.has(relative)||existing.has(`${relative}.js`);
        }))fail('BUNDLE_PACKAGE_ENTRYPOINT_UNCLOSED');
      }
    }
  }
}

/** Construct an immutable, exact-source host CAS overlay; performs no writes.
 * `approval` is trusted only AFTER the independent maintainer verifies B issue
 * identity, merged approval, installed version, and allowed operation scope.
 */
export function planSourceBundleRegistration({hostBytes,manifestBytes,approval,stageBundle}){
  if(!Buffer.isBuffer(hostBytes)||!Buffer.isBuffer(manifestBytes)
    ||!requireObject(approval)||typeof stageBundle!=='string')fail('BUNDLE_INPUT_INVALID');
  if(manifestBytes.length<1||manifestBytes.length>MAX_MANIFEST_BYTES)fail('BUNDLE_MANIFEST_SIZE');
  const digest=sha256(manifestBytes);
  if(approval.schema!==SOURCE_BUNDLE_APPROVAL_SCHEMA
    ||approval.operation!==SOURCE_BUNDLE_OPERATION
    ||approval.scope!=='HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY'
    ||approval.sourceRepository!=='ansqhd5774-Choi/zgmini'
    ||!SHA40.test(approval.sourceSha??'')||!SHA256.test(approval.sourceManifestSha256??'')
    ||!SHA256.test(approval.hostOriginalSha256??'')
    ||!SHA256.test(approval.hostProposedSha256??'')
    ||approval.sourceManifestSha256!==digest||approval.hostOriginalSha256!==sha256(hostBytes)
    ||approval.stageBundle!==stageBundle)fail('BUNDLE_APPROVAL_OR_HOST_CAS_MISMATCH');
  if(!path.isAbsolute(stageBundle)||!path.isAbsolute(approval.hostPath??''))
    fail('BUNDLE_ABSOLUTE_PATH_REQUIRED');
  requireRealDirectory(stageBundle,'BUNDLE_STAGE_ALIAS');
  requireRealDirectory(path.join(stageBundle,'source'),'BUNDLE_SOURCE_ALIAS');
  let manifest,host;
  try{manifest=JSON.parse(manifestBytes.toString('utf8'));host=JSON.parse(hostBytes.toString('utf8'));}
  catch{fail('BUNDLE_JSON_INVALID');}
  if(!requireObject(manifest)||manifest.schema!==SOURCE_BUNDLE_SCHEMA
    ||manifest.sourceRepository!==approval.sourceRepository
    ||manifest.sourceSha!==approval.sourceSha
    ||!typeofString(manifest.sourceBranch)
    ||!requireObject(manifest.files)||!typeofString(manifest.entrypoint))
    fail('BUNDLE_MANIFEST_CONTRACT');
  const files=Object.keys(manifest.files);
  if(files.length<1||files.length>MAX_FILES||!files.every(x=>SHA256.test(manifest.files[x])))
    fail('BUNDLE_FILE_HASH_LIST_INVALID');
  for(const rel of files){
    safeRel(rel);
    if(/(^|\/)(?:\.git|\.github)(?:\/|$)/.test(rel)
      ||/\.(?:exe|dll|node|cmd|bat|ps1|sh)$/i.test(rel))fail('BUNDLE_EXECUTABLE_FILE_FORBIDDEN');
    const bytes=readFileStrict(path.join(stageBundle,'source',...rel.split('/')));
    if(sha256(bytes)!==manifest.files[rel])fail('BUNDLE_SOURCE_BYTES_DRIFT');
  }
  safeRel(manifest.entrypoint);
  if(!own(manifest.files,manifest.entrypoint))fail('BUNDLE_ENTRYPOINT_NOT_INCLUDED');
  if(manifest.sourceBranch!==approval.sourceBranch
    ||manifest.entrypoint!==approval.entrypoint)fail('BUNDLE_ENTRYPOINT_APPROVAL_DRIFT');
  verifyInventory(stageBundle,files,manifestBytes);
  verifyModules(path.join(stageBundle,'source'),files);
  if(!requireObject(host)||host.schema!=='ZGMINI_PC_HOST_V1'
    ||!requireObject(host.approvedSources)||host.controllerSourceSha!==approval.installedControllerSha
    ||own(host.approvedSources,manifest.sourceSha))fail('BUNDLE_HOST_PRECONDITION');
  const proposed=structuredClone(host);
  proposed.approvedSources[manifest.sourceSha]={root:stageBundle,branch:manifest.sourceBranch,
    entrypoint:manifest.entrypoint,manifestSha256:digest};
  const proposedHostBytes=Buffer.from(JSON.stringify(proposed,null,2)+'\n');
  if(sha256(proposedHostBytes)!==approval.hostProposedSha256)
    fail('BUNDLE_HOST_PROPOSED_CAS_MISMATCH');
  return Object.freeze({operation:SOURCE_BUNDLE_OPERATION,sourceSha:manifest.sourceSha,
    stageBundle,fileCount:files.length,sourceManifestSha256:digest,
    hostOriginalSha256:approval.hostOriginalSha256,
    hostProposedSha256:approval.hostProposedSha256,proposedHostBytes});
}
const typeofString=x=>typeof x==='string'&&x.length>0&&x.length<=240;

/** Stages a brand-new inert bundle after the caller authenticated a merged B
 * manifest and fetched all bytes from its EXACT immutable source commit.
 * A pre-existing or partially staged directory is a stop, not a delete target.
 */
export function stageApprovedSourceBundle({manifestBytes,sourceFiles,stageBundle}){
  if(!Buffer.isBuffer(manifestBytes)||!requireObject(sourceFiles)||!path.isAbsolute(stageBundle??''))
    fail('BUNDLE_STAGE_INPUT_INVALID');
  let manifest;
  try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{fail('BUNDLE_MANIFEST_INVALID');}
  const list=Object.keys(manifest?.files??{});
  if(!requireObject(manifest)||manifest.schema!==SOURCE_BUNDLE_SCHEMA||list.length<1||list.length>MAX_FILES
    ||JSON.stringify(list.sort())!==JSON.stringify(Object.keys(sourceFiles).sort()))
    fail('BUNDLE_SOURCE_FILE_LIST_MISMATCH');
  const parent=path.dirname(stageBundle);
  requireRealDirectory(parent,'BUNDLE_STAGE_PARENT_ALIAS');
  const existing=fs.existsSync(stageBundle);
  let total=0;
  for(const rel of list){
    safeRel(rel);
    if(/\.(?:exe|dll|node|cmd|bat|ps1|sh)$/i.test(rel))fail('BUNDLE_EXECUTABLE_FILE_FORBIDDEN');
    const bytes=sourceFiles[rel];
    if(!Buffer.isBuffer(bytes)||!SHA256.test(manifest.files[rel]??'')
      ||sha256(bytes)!==manifest.files[rel])fail('BUNDLE_SOURCE_BYTES_DRIFT');
    total+=bytes.length;
    if(total>256*1024*1024)fail('BUNDLE_SOURCE_TOTAL_BYTES_TOO_LARGE');
  }
  const sourceRoot=path.join(stageBundle,'source');
  if(!existing){
    fs.mkdirSync(stageBundle);
    fs.mkdirSync(sourceRoot);
    for(const rel of list){
      const file=path.join(sourceRoot,...rel.split('/'));
      fs.mkdirSync(path.dirname(file),{recursive:true});
      requireRealDirectory(path.dirname(file),'BUNDLE_STAGE_PARENT_ALIAS');
      fs.writeFileSync(file,sourceFiles[rel],{flag:'wx'});
      if(sha256(readFileStrict(file))!==manifest.files[rel])fail('BUNDLE_STAGE_READBACK_FAILED');
    }
    fs.writeFileSync(path.join(stageBundle,'manifest.json'),manifestBytes,{flag:'wx'});
  }else{
    requireRealDirectory(stageBundle,'BUNDLE_EXISTING_STAGE_ALIAS');
    requireRealDirectory(sourceRoot,'BUNDLE_EXISTING_SOURCE_ALIAS');
    for(const rel of list){
      const file=path.join(sourceRoot,...rel.split('/'));
      if(sha256(readFileStrict(file))!==manifest.files[rel]
        ||!readFileStrict(file).equals(sourceFiles[rel]))
        fail('BUNDLE_EXISTING_STAGE_DRIFT');
    }
  }
  verifyInventory(stageBundle,list,manifestBytes);
  verifyModules(sourceRoot,list);
  return Object.freeze({stageBundle,sourceSha:manifest.sourceSha,reused:existing,
    manifestSha256:sha256(manifestBytes),fileCount:list.length,totalBytes:total});
}

const writeSynced=(file,bytes)=>{
  const fd=fs.openSync(file,'wx');
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
};

/** The only host-writing primitive. Invoked solely by the independently
 * installed B updater after Issue, PR/main, Windows provenance and lease
 * checks. It cannot stage source, execute it, alter DBs, or edit schedules.
 */
export function applyPreparedSourceBundleHostCas({
  plan,hostPath,backupDirectory,verifyAuthorizedLease,
}){
  if(process.platform!=='win32')fail('BUNDLE_B_WINDOWS_REQUIRED');
  if(typeof verifyAuthorizedLease!=='function')fail('BUNDLE_B_TRUSTED_LEASE_REQUIRED');
  verifyAuthorizedLease();
  if(!plan||!SHA256.test(plan.hostOriginalSha256??'')
    ||!SHA256.test(plan.hostProposedSha256??'')
    ||!Buffer.isBuffer(plan.proposedHostBytes)
    ||sha256(plan.proposedHostBytes)!==plan.hostProposedSha256
    ||!path.isAbsolute(hostPath??'')||!path.isAbsolute(backupDirectory??''))
    fail('BUNDLE_B_HOST_INPUT_INVALID');
  const before=readFileStrict(hostPath);
  if(sha256(before)!==plan.hostOriginalSha256)fail('BUNDLE_B_HOST_CAS_CHANGED');
  const beforeStat=fs.statSync(hostPath,{bigint:true});
  if(fs.existsSync(backupDirectory))fail('BUNDLE_B_BACKUP_ALREADY_EXISTS');
  requireRealDirectory(path.dirname(backupDirectory),'BUNDLE_B_BACKUP_PARENT_ALIAS');
  requireRealDirectory(path.dirname(hostPath),'BUNDLE_B_HOST_PARENT_ALIAS');
  const pending=path.join(path.dirname(hostPath),`.bundle-b-${plan.sourceSha}.tmp`);
  if(fs.existsSync(pending))fail('BUNDLE_B_PENDING_UNKNOWN');
  fs.mkdirSync(backupDirectory);
  const backup=path.join(backupDirectory,'HOST_BEFORE.bytes');
  const journal=path.join(backupDirectory,'HOST_B_APPLY_JOURNAL.json');
  writeSynced(backup,before);
  if(sha256(readFileStrict(backup))!==plan.hostOriginalSha256)
    fail('BUNDLE_B_BACKUP_READBACK_FAILED');
  writeSynced(journal,Buffer.from(JSON.stringify({schema:'ZGMINI_SOURCE_BUNDLE_HOST_JOURNAL_V1',
    phase:'PREPARED',old:plan.hostOriginalSha256,next:plan.hostProposedSha256})+'\n'));
  writeSynced(pending,plan.proposedHostBytes);
  verifyAuthorizedLease();
  const nowStat=fs.statSync(hostPath,{bigint:true});
  if(nowStat.dev!==beforeStat.dev||nowStat.ino!==beforeStat.ino
    ||sha256(readFileStrict(hostPath))!==plan.hostOriginalSha256)
    fail('BUNDLE_B_PRE_APPLY_HOST_CAS_CHANGED');
  fs.renameSync(pending,hostPath);
  try{
    if(sha256(readFileStrict(hostPath))!==plan.hostProposedSha256)
      fail('BUNDLE_B_POST_APPLY_READBACK_FAILED');
    verifyAuthorizedLease();
    writeSynced(path.join(backupDirectory,'APPLIED.json'),
      Buffer.from(JSON.stringify({status:'APPLIED',hostSha256:plan.hostProposedSha256})+'\n'));
    return {status:'APPLIED',hostSha256:plan.hostProposedSha256,
      previousHostSha256:plan.hostOriginalSha256,backupPreserved:true};
  }catch(error){
    try{
      // Losing the maintainer lease after the host swap is NOT permission to
      // roll back. Freeze the unknown outcome for a recovery operator.
      verifyAuthorizedLease();
      if(sha256(readFileStrict(hostPath))!==plan.hostProposedSha256)
        fail('BUNDLE_B_ROLLBACK_TARGET_DRIFT');
      const restore=path.join(path.dirname(hostPath),`.bundle-b-restore-${plan.sourceSha}.tmp`);
      writeSynced(restore,readFileStrict(backup));
      verifyAuthorizedLease();
      if(sha256(readFileStrict(hostPath))!==plan.hostProposedSha256)
        fail('BUNDLE_B_ROLLBACK_TARGET_DRIFT');
      fs.renameSync(restore,hostPath);
      if(sha256(readFileStrict(hostPath))!==plan.hostOriginalSha256)
        fail('BUNDLE_B_ROLLBACK_READBACK_FAILED');
      writeSynced(path.join(backupDirectory,'ROLLED_BACK.json'),
        Buffer.from(JSON.stringify({status:'ROLLED_BACK',code:error.code??'BUNDLE_B_AFTER_SWAP_FAILED'})+'\n'));
      return {status:'ROLLED_BACK',code:error.code??'BUNDLE_B_AFTER_SWAP_FAILED',backupPreserved:true};
    }catch{return {status:'RECOVERY_REQUIRED',code:'BUNDLE_B_ROLLBACK_UNVERIFIED',backupPreserved:true};}
  }
}
