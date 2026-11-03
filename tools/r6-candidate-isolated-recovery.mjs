// R6-only source fixture. Not connected to a pc-job, Controller, or maintainer.
// An independently authenticated Windows B-grade handoff must invoke this after
// recording exact SHA/backup/idle/lease state. Never opens or changes Core DB.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const R6_CANDIDATE_NAME='EMPLOYMENT_R6_CANDIDATE.sqlite';
export const R6_VERIFIED_ARCHIVE_SHA256=
  'ad8fcb8e2db72319475742414e72847cf97f388f09a5984601726d0d8ad32622';
export const R6_VERIFIED_ARCHIVE_BYTES=20111360;
const E_ROOT='E:\\ZGmini';
const ROOT_NAMES=Object.freeze(['analysis','data','migration','projects']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const sameStat=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&
  a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
const fileStat=f=>fs.statSync(f,{bigint:true});
const isContained=(root,file)=>file===root||file.startsWith(root+path.sep);
function requireWindows({synthetic=false}={}){
  if(!synthetic&&process.platform!=='win32')stop('R6_WINDOWS_REQUIRED');
}
function requireSafePath(target,base){
  if(!path.isAbsolute(target)||!path.isAbsolute(base)||!isContained(base,path.resolve(target)))
    stop('R6_PATH_OUTSIDE_APPROVED_ROOT');
  // Reject any reparse-point/junction in the existing ancestor chain. This
  // intentionally also rejects compatibility links from C: to E:.
  let cursor=target;
  for(;;){
    const st=fs.lstatSync(cursor);
    if(st.isSymbolicLink())stop('R6_REPARSE_POINT_FORBIDDEN');
    const real=fs.realpathSync.native(cursor);
    if(path.normalize(real).toLowerCase()!==path.normalize(cursor).toLowerCase())
      stop('R6_PATH_ALIAS_FORBIDDEN');
    if(path.resolve(cursor)===path.resolve(base))break;
    const parent=path.dirname(cursor);
    if(parent===cursor)stop('R6_APPROVED_ROOT_UNREACHABLE');
    cursor=parent;
  }
}

/** Only four bounded, fixed E: locations are scanned; no C: or user-profile walk.
 * A capped/inaccessible scan is INCONCLUSIVE, not proof of absence. */
export function findR6CandidateBounded({scanBase=E_ROOT,
  directoryLimit=400,entryLimit=24000,depthLimit=5}={},options={}){
  requireWindows(options);
  if(!options.synthetic&&path.win32.normalize(scanBase).toLowerCase()!==E_ROOT.toLowerCase())
    stop('R6_SCAN_BASE_NOT_APPROVED');
  if(![directoryLimit,entryLimit,depthLimit].every(Number.isSafeInteger)
    ||directoryLimit<1||directoryLimit>400||entryLimit<1||entryLimit>24000
    ||depthLimit<0||depthLimit>5)stop('R6_SCAN_BOUND_INVALID');
  const found=[];let visited=0,entries=0;
  const queue=ROOT_NAMES.map(x=>({dir:path.join(scanBase,x),depth:0}));
  const blocked=[];
  try{
    requireSafePath(scanBase,scanBase);
    if(!fs.lstatSync(scanBase).isDirectory())stop('R6_SCAN_BASE_NOT_DIRECTORY');
  }catch{return {status:'INCONCLUSIVE',candidatePaths:[],visitedDirectories:0,
    inspectedEntries:0,code:'R6_SCAN_BASE_UNAVAILABLE',
    coverage:'FOUR_APPROVED_E_ROOTS_ONLY',globalAbsenceProven:false};}
  while(queue.length){
    const {dir,depth}=queue.shift();
    if(!fs.existsSync(dir)){
      blocked.push('R6_SCAN_ROOT_ABSENT_OR_UNAVAILABLE');break;
    }
    try{
      requireSafePath(dir,scanBase);
      if(!fs.lstatSync(dir).isDirectory())stop('R6_SCAN_NOT_DIRECTORY');
      if(++visited>directoryLimit)stop('R6_SCAN_DIRECTORY_LIMIT');
      const list=fs.readdirSync(dir,{withFileTypes:true});
      entries+=list.length;
      if(entries>entryLimit)stop('R6_SCAN_ENTRY_LIMIT');
      for(const ent of list){
        if(ent.isSymbolicLink())continue;
        const full=path.join(dir,ent.name);
        if(ent.isFile()&&ent.name.toLowerCase()===R6_CANDIDATE_NAME.toLowerCase()){
          requireSafePath(full,scanBase);
          found.push(full);
          if(found.length>8)stop('R6_SCAN_CANDIDATE_LIMIT');
        }else if(ent.isDirectory()&&depth<depthLimit&&
          !['.git','node_modules','.next','dist','build','.cache'].includes(ent.name)){
          queue.push({dir:full,depth:depth+1});
        }
      }
    }catch(e){blocked.push(e.code??'R6_SCAN_IO_ERROR');break;}
  }
  return {status:blocked.length?'INCONCLUSIVE':found.length?'FOUND':'NOT_FOUND',
    candidatePaths:found,visitedDirectories:visited,inspectedEntries:entries,
    code:blocked[0]??'R6_SCAN_COMPLETE',
    coverage:'FOUR_APPROVED_E_ROOTS_ONLY',globalAbsenceProven:false};
}

/** Byte hash and SQLite quick_check happen on a *new disposable copy*.
 * Existing source and optional WAL/SHM are only read. No SQL against Core. */
export function inspectR6SqliteReadOnly(file,{approvedRoot,verificationParent,
  expectedSha256,expectedBytes,allowSidecars=false},options={}){
  requireWindows(options);
  let tempDir;
  try{
    requireSafePath(file,approvedRoot);
    requireSafePath(verificationParent,approvedRoot);
    const original=fileStat(file);
    if(!original.isFile())stop('R6_CANDIDATE_NOT_REGULAR');
    if(original.size<4096n||original.size>1073741824n)stop('R6_CANDIDATE_SIZE_INVALID');
    const bytes=fs.readFileSync(file);
    const fileHash=sha(bytes);
    if(expectedBytes!==undefined&&bytes.length!==expectedBytes)stop('R6_ARCHIVE_SIZE_MISMATCH');
    if(expectedSha256!==undefined&&fileHash!==expectedSha256)stop('R6_ARCHIVE_SHA_MISMATCH');
    if(bytes.subarray(0,16).toString('ascii')!=='SQLite format 3\0')
      stop('R6_SQLITE_HEADER_INVALID');
    const sidecars=[];
    for(const suffix of ['-wal','-shm']){
      const p=file+suffix;
      if(fs.existsSync(p)){
        if(!allowSidecars)stop('R6_ARCHIVE_SIDECAR_UNEXPECTED');
        requireSafePath(p,approvedRoot);
        const s=fileStat(p);
        if(!s.isFile()||s.size>134217728n)stop('R6_CANDIDATE_SIDECAR_INVALID');
        sidecars.push({source:p,suffix,stat:s,bytes:fs.readFileSync(p)});
      }
    }
    if(!sameStat(original,fileStat(file)))stop('R6_CANDIDATE_CHANGED_DURING_READ');
    for(const x of sidecars){if(!sameStat(x.stat,fileStat(x.source)))
      stop('R6_CANDIDATE_WAL_CHANGED_DURING_READ');}
    tempDir=fs.mkdtempSync(path.join(verificationParent,'r6-verify-'));
    const copy=path.join(tempDir,R6_CANDIDATE_NAME);
    fs.writeFileSync(copy,bytes,{flag:'wx'});
    for(const x of sidecars)fs.writeFileSync(copy+x.suffix,x.bytes,{flag:'wx'});
    if(sha(fs.readFileSync(copy))!==fileHash)stop('R6_CANDIDATE_COPY_MISMATCH');
    const db=new DatabaseSync(copy,{readOnly:true});
    let quickCheck;
    try{
      db.exec('PRAGMA query_only=ON');
      quickCheck=db.prepare('PRAGMA quick_check').all();
    }finally{db.close();}
    if(quickCheck.length!==1||quickCheck[0]?.quick_check!=='ok')
      stop('R6_CANDIDATE_QUICK_CHECK_FAILED');
    if(!sameStat(original,fileStat(file)))stop('R6_CANDIDATE_CHANGED_AFTER_CHECK');
    return {status:'VERIFIED',sha256:fileHash,size:bytes.length,
      readOnly:true,sqliteQuickCheck:'ok',sidecars:sidecars.length,
      sourceUnmodified:true};
  }catch(e){return {status:'UNUSABLE',code:e.code??'R6_CANDIDATE_SQLITE_ERROR',
    sourceUnmodified:true};}
  finally{
    if(tempDir){
      // The verifier owns only this newly-created isolated disposable folder.
      // A failed cleanup must never be generalized to source/DB deletion.
      try{fs.rmSync(tempDir,{recursive:true,force:false});}catch{}
    }
  }
}

/** B-only conditional isolation restore. Never creates or overwrites the old
 * candidate. All source hash/quick_check and target readback gates are required.
 * A partial failed copy is left in its NEW location for manual recovery. */
export function restoreVerifiedR6ArchiveIsolated({scan,archivePath,archiveRoot,
  verificationParent,isolationParent,isolationName},options={}){
  requireWindows(options);
  if(scan?.status!=='NOT_FOUND'&&scan?.status!=='ORIGINAL_UNUSABLE')
    return {status:'BLOCKED',code:'R6_ORIGINAL_ABSENCE_NOT_PROVEN'};
  // Four E:\ZGmini roots cannot prove absence elsewhere on the PC. The
  // independent B maintainer must attest original unusability separately.
  if(scan.status==='NOT_FOUND'&&scan.operatorConfirmedOriginUnavailable!==true)
    return {status:'BLOCKED',code:'R6_ORIGINAL_UNAVAILABLE_NOT_ATTESTED'};
  if(scan.status==='ORIGINAL_UNUSABLE'&&scan.existingVerified===true)
    return {status:'BLOCKED',code:'R6_ORIGINAL_ALREADY_VERIFIED'};
  if(!/^[A-Za-z0-9_-]{6,64}$/.test(isolationName??''))
    return {status:'BLOCKED',code:'R6_ISOLATION_NAME_INVALID'};
  const inspected=inspectR6SqliteReadOnly(archivePath,{approvedRoot:archiveRoot,
    verificationParent,expectedSha256:R6_VERIFIED_ARCHIVE_SHA256,
    expectedBytes:R6_VERIFIED_ARCHIVE_BYTES},options);
  if(inspected.status!=='VERIFIED')return {status:'BLOCKED',code:inspected.code};
  let created=false;
  try{
    requireSafePath(isolationParent,archiveRoot);
    const dir=path.join(isolationParent,isolationName);
    if(fs.existsSync(dir))stop('R6_ISOLATION_ALREADY_EXISTS');
    fs.mkdirSync(dir,{recursive:false});created=true;
    const destination=path.join(dir,R6_CANDIDATE_NAME);
    fs.copyFileSync(archivePath,destination,fs.constants.COPYFILE_EXCL);
    const back=inspectR6SqliteReadOnly(destination,{approvedRoot:archiveRoot,
      verificationParent,expectedSha256:R6_VERIFIED_ARCHIVE_SHA256,
      expectedBytes:R6_VERIFIED_ARCHIVE_BYTES},options);
    if(back.status!=='VERIFIED')stop('R6_ISOLATED_READBACK_FAILED');
    return {status:'RESTORED_ISOLATED_VERIFIED',candidatePath:destination,
      sha256:back.sha256,size:back.size,originalRetained:true,
      existingDataOverwritten:false,coreModified:false,hostRegistered:false};
  }catch(e){return {status:created?'RECOVERY_REQUIRED':'BLOCKED',
    code:e.code??'R6_ISOLATED_RESTORE_FAILED',existingDataOverwritten:false,
    coreModified:false,hostRegistered:false};}
}
