// REAL Node filesystem I/O, but deliberately locked to an isolated test
// fixture below os.tmpdir(). NEVER INSTALL/LOAD THIS AS A PC RECEIVER.
// No shell, Task Scheduler, network, GitHub, production paths or code execution.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const check=(truth,code)=>{if(!truth)fail(code);};
const exact=(a,b,code)=>check(a===b,code);
const sorted=x=>[...x].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);

function ensureFixture(root){
 check(typeof root==='string'&&path.isAbsolute(root),'B_FIXTURE_ROOT');
 const real=fs.realpathSync.native(root),temp=fs.realpathSync.native(os.tmpdir());
 const relative=path.relative(temp,real);
 check(relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&
  relative.split(path.sep).length===1&&path.basename(real).startsWith('zgmini-b-fixture-'),
  'B_FIXTURE_ROOT');
 const marker=path.join(real,'SIMULATION_ONLY.json');
 check(fs.existsSync(marker)&&!fs.lstatSync(marker).isSymbolicLink()&&
  fs.readFileSync(marker,'utf8').trim()==='ZGMINI_B_DISPOSABLE_FIXTURE_V1',
  'B_FIXTURE_MARKER');
 return real;
}
function fileWithin(root,...pieces){
 const target=path.resolve(root,...pieces);
 const rel=path.relative(root,target);
 check(rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel),
  'B_FIXTURE_PATH_ESCAPE');
 let current=root;
 for(const segment of rel.split(path.sep)){
  current=path.join(current,segment);
  if(fs.existsSync(current)){
   const stat=fs.lstatSync(current);
   check(!stat.isSymbolicLink(),'B_FIXTURE_REPARSE');
  }
 }
 return target;
}
function makeParents(root,file){
 const relative=path.relative(root,path.dirname(file));
 let current=root;
 for(const segment of relative.split(path.sep).filter(Boolean)){
  current=fileWithin(root,path.relative(root,current),segment);
  if(!fs.existsSync(current))fs.mkdirSync(current);
  check(fs.lstatSync(current).isDirectory(),'B_FIXTURE_PARENT');
 }
}
function read(root,file,allowAbsent=false){
 fileWithin(root,path.relative(root,file));
 if(!fs.existsSync(file)){
  if(allowAbsent)return null;
  fail('B_FIXTURE_FILE_MISSING');
 }
 const stat=fs.lstatSync(file);
 check(stat.isFile()&&!stat.isSymbolicLink(),'B_FIXTURE_NONFILE');
 return fs.readFileSync(file);
}
function writeNew(root,file,bytes,mode=0o600){
 makeParents(root,file);
 fileWithin(root,path.relative(root,file));
 fs.writeFileSync(file,bytes,{flag:'wx',mode});
 const fd=fs.openSync(file,'r+');
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replaceExact(root,file,bytes,expected,id){
 const actual=read(root,file,true);
 exact(actual===null?null:sha(actual),expected,'B_FIXTURE_CAS_DRIFT');
 const temp=fileWithin(root,path.relative(root,file)+'.tmp.'+id);
 const mode=fs.existsSync(file)?fs.statSync(file).mode&0o777:0o600;
 writeNew(root,temp,bytes,mode);
 fs.renameSync(temp,file);
 exact(sha(read(root,file)),sha(bytes),'B_FIXTURE_RENAME_DRIFT');
}
function copySameFolder(root,source,target){
 fileWithin(root,path.relative(root,source));
 fileWithin(root,path.relative(root,target));
 const original=read(root,source);
 fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
 const sourceMode=fs.statSync(source).mode&0o777;
 fs.chmodSync(target,sourceMode);
 const fd=fs.openSync(target,'r+');
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 exact(sha(read(root,target)),sha(original),'B_FIXTURE_BACKUP_DRIFT');
 exact(fs.statSync(target).mode&0o777,sourceMode,'B_FIXTURE_MODE_DRIFT');
}

/**
 * An untrusted Issue cannot invoke this helper against operating paths:
 * its only possible root is a marker-bearing top-level disposable TEMP dir.
 * The approvedManifestSha256 and source blobs are locally injected fixture
 * data, NOT production Git provenance/authentication.
 */
export function makeIsolatedWindowsFixtureAdapter({
 fixtureRoot,manifest,requestId,approvedManifestSha256,approvedSourceSha,
 approvedApprovalRef,sourceBlobs,zipBlob,launcherBlobs,activeRecordBytes,
 faultAt=null,
}){
 const root=ensureFixture(fixtureRoot);
 const id=requestId;
 check(typeof id==='string'&&/^[a-zA-Z0-9_-]{12,128}$/.test(id),
  'B_FIXTURE_REQUEST');
 const p=manifest.profileId;
 check(/^[a-zA-Z0-9_-]{2,63}$/.test(p),'B_FIXTURE_PROFILE');
 const prefix=fileWithin(root,'profiles',p);
 check(fs.existsSync(prefix)&&fs.lstatSync(prefix).isDirectory(),
  'B_FIXTURE_PROFILE_MISSING');
 const launchRoot=fileWithin(root,'profiles',p,'launchers');
 const versionsRoot=fileWithin(root,'profiles',p,'versions');
 const stageRoot=fileWithin(root,'profiles',p,'staging',id);
 const stageVersion=fileWithin(root,'profiles',p,'staging',id,manifest.bundle.version);
 const versionFinal=fileWithin(root,'profiles',p,'versions',manifest.bundle.version);
 const journalFile=fileWithin(root,'profiles',p,'journals',id+'.jsonl');
 const lockFile=fileWithin(root,'shared-writer-b.lock');
 let lock=null;
 const targetEntries=()=>[
  ...manifest.activation.launchers.map(l=>({
   name:l.name,target:fileWithin(root,'profiles',p,'launchers',l.name),
   before:l.beforeSha256,after:l.afterSha256,
   bytes:launcherBlobs?.[l.name],
  })),
  {name:manifest.activation.activeRecord.name,
   target:fileWithin(root,'profiles',p,manifest.activation.activeRecord.name),
   before:manifest.activation.activeRecord.beforeSha256,
   after:manifest.activation.activeRecord.afterSha256,
   bytes:activeRecordBytes},
 ];
 const log=phase=>{
  makeParents(root,journalFile);
  const f=fs.openSync(journalFile,'a',0o600);
  try{fs.writeSync(f,JSON.stringify({phase,requestId:id})+'\n');fs.fsyncSync(f);}
  finally{fs.closeSync(f);}
 };
 const inject=phase=>{if(faultAt===phase)fail('B_FIXTURE_FAULT_'+phase.toUpperCase());};
 const exactExistingVersion=()=>{
  check(fs.existsSync(versionFinal)&&fs.lstatSync(versionFinal).isDirectory()&&
   !fs.lstatSync(versionFinal).isSymbolicLink(),
   'B_FIXTURE_IMMUTABLE_MISSING');
  const found=[];
  const walk=(directory,prefix='')=>{
   for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    check(!entry.isSymbolicLink(),'B_FIXTURE_IMMUTABLE_REPARSE');
    const rel=prefix?prefix+'/'+entry.name:entry.name;
    const target=fileWithin(root,'profiles',p,'versions',manifest.bundle.version,
     ...rel.split('/'));
    if(entry.isDirectory())walk(target,rel);
    else{
     check(entry.isFile(),'B_FIXTURE_IMMUTABLE_TYPE');
     const bytes=read(root,target);
     found.push({path:rel,sha256:sha(bytes),bytes:bytes.length});
    }
   }
  };
  walk(versionFinal);
  const expected=sorted(manifest.bundle.files),actual=sorted(found);
  check(actual.length===expected.length&&actual.every((x,i)=>
   x.path===expected[i].path&&x.sha256===expected[i].sha256&&
   x.bytes===expected[i].bytes),'B_FIXTURE_IMMUTABLE_HASH_DRIFT');
  return sha(Buffer.from(JSON.stringify(actual)));
 };
 const inspect=()=>{
  const xml=read(root,fileWithin(root,'profiles',p,'task.xml'));
  const taskState=JSON.parse(read(root,fileWithin(root,'profiles',p,'task-state.json')).toString('utf8'));
  const s={task:{name:taskState.name,time:taskState.time,
   state:taskState.state,xmlSha256:sha(xml)},
   launchers:manifest.activation.launchers.map(l=>({
    name:l.name,sha256:sha(read(root,fileWithin(root,'profiles',p,'launchers',l.name))),
   })),
   activeRecord:{name:manifest.activation.activeRecord.name,
    sha256:(()=>{
     const bytes=read(root,fileWithin(root,'profiles',p,manifest.activation.activeRecord.name),true);
     return bytes===null?null:sha(bytes);
    })()},
   bundleVersion:null,fileListSha256:null};
  if(fs.existsSync(versionFinal)){
   s.bundleVersion=manifest.bundle.version;
   s.fileListSha256=exactExistingVersion();
  }
  return s;
 };
 const assertLock=lease=>check(lock!==null&&lock===lease&&
  read(root,lockFile).toString('utf8')===id,'B_FIXTURE_NOT_LOCKED');
 const journalOwned=()=>check(fs.existsSync(journalFile),'B_FIXTURE_JOURNAL_MISSING');
 const backups=()=>targetEntries().map(entry=>({...entry,
  backup:fileWithin(root,path.relative(root,entry.target)+'.backup.'+id)}));
 return {
  async authenticatePinnedApproval({pin,rawSha256}){
   inject('authorize');
   return {verified:pin.requestId===id&&
     rawSha256===approvedManifestSha256&&
     pin.sourceSha===approvedSourceSha&&
     pin.approvalRef===approvedApprovalRef,
    rawSha256};
  },
  async inspectPreimage(){inject('preimage');return inspect();},
  async acquireSharedWriterLock({requestId}){
   exact(requestId,id,'B_FIXTURE_REQUEST_DRIFT');
   inject('lock');
   const fd=fs.openSync(lockFile,'wx',0o600);
   try{fs.writeSync(fd,id);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   lock={id};return lock;
  },
  async verifyPreimageUnderLock({lock:lease}){
   assertLock(lease);inject('under-lock');return inspect();
  },
  async stageVerifiedBundle({lock:lease,plan}){
   assertLock(lease);inject('stage');
   check(Buffer.isBuffer(zipBlob)&&sha(zipBlob)===manifest.bundle.zipSha256,
    'B_FIXTURE_ZIP_HASH');
   if(fs.existsSync(versionFinal)){
    const existingDigest=exactExistingVersion();
    exact(existingDigest,plan.fileListSha256,'B_FIXTURE_IMMUTABLE_HASH_DRIFT');
    log('EXACT_IMMUTABLE_VERSION_REUSED');
    return {verified:true,fileListSha256:existingDigest,
     stageVersion:versionFinal,reused:true};
   }
   check(!fs.existsSync(stageRoot),'B_FIXTURE_STAGE_ALREADY_EXISTS');
   const actual=[];
   for(const f of manifest.bundle.files){
    const bytes=sourceBlobs?.[f.path];
    check(Buffer.isBuffer(bytes)&&bytes.length===f.bytes&&sha(bytes)===f.sha256,
     'B_FIXTURE_SOURCE_HASH');
    const file=fileWithin(root,'profiles',p,'staging',id,manifest.bundle.version,
     ...f.path.split('/'));
    writeNew(root,file,bytes);
    actual.push({path:f.path,sha256:sha(read(root,file)),bytes:bytes.length});
    inject('stage-after-file');
   }
   const digest=sha(Buffer.from(JSON.stringify(sorted(actual))));
   exact(digest,plan.fileListSha256,'B_FIXTURE_STAGE_READBACK');
   log('STAGED');
   return {verified:true,fileListSha256:digest,stageVersion};
  },
  async backupPreimages({lock:lease}){
   assertLock(lease);inject('backup');
   log('BACKUP_STARTED');
   for(const entry of backups()){
    const bytes=read(root,entry.target,true);
    exact(bytes===null?null:sha(bytes),entry.before,'B_FIXTURE_BACKUP_PREIMAGE');
    if(bytes!==null)copySameFolder(root,entry.target,entry.backup);
    inject('backup-after-file');
   }
   log('BACKUP_DONE');
   return {complete:true,journalId:id};
  },
  async casActivate({lock:lease,staged,backup}){
   assertLock(lease);journalOwned();
   exact(backup.journalId,id,'B_FIXTURE_JOURNAL_ID');
   if(staged.reused){
    exact(staged.stageVersion,versionFinal,'B_FIXTURE_REUSED_VERSION_ID');
    exact(exactExistingVersion(),staged.fileListSha256,
     'B_FIXTURE_REUSED_VERSION_DRIFT');
    log('EXACT_IMMUTABLE_VERSION_RECONFIRMED');
   }else{
    exact(staged.stageVersion,stageVersion,'B_FIXTURE_STAGE_ID');
    inject('activation-before-version');
    fs.renameSync(stageVersion,versionFinal);
    log('IMMUTABLE_VERSION_ACTIVATED');
   }
   for(const entry of backups()){
    const bytes=entry.bytes;
    check(Buffer.isBuffer(bytes)&&sha(bytes)===entry.after,
     'B_FIXTURE_LAUNCHER_HASH');
    log('CAS_INTENT_'+entry.name);
    replaceExact(root,entry.target,bytes,entry.before,id);
    log('CAS_DONE_'+entry.name);
    inject('activation-after-file');
   }
   return {activated:true};
  },
  async readBack({lock:lease}){assertLock(lease);inject('readback');return inspect();},
  async commit({lock:lease}){
   assertLock(lease);inject('commit');log('COMMITTED');return {committed:true};
  },
  async rollback({lock:lease,backup}){
   assertLock(lease);journalOwned();
   exact(backup.journalId,id,'B_FIXTURE_JOURNAL_ID');
   log('ROLLBACK_STARTED');
   for(const entry of backups().reverse()){
    const actual=read(root,entry.target,true);
    const digest=actual===null?null:sha(actual);
    check(digest===entry.before||digest===entry.after,
     'B_FIXTURE_ROLLBACK_CONCURRENT_DRIFT');
    if(digest===entry.before)continue;
    if(entry.before===null){
     fs.unlinkSync(entry.target); // transaction-created fixture file only
    }else{
     const original=read(root,entry.backup);
     exact(sha(original),entry.before,'B_FIXTURE_BACKUP_CORRUPTED');
     replaceExact(root,entry.target,original,digest,id);
    }
   }
   inject('rollback-after-restore');
   log('ROLLBACK_DONE');
   return {rolledBack:true};
  },
  async verifyRollback({lock:lease}){
   assertLock(lease);inject('verify-rollback');return inspect();
  },
  async releaseSharedWriterLock({lock:lease}){
   assertLock(lease);inject('unlock');
   fs.unlinkSync(lockFile);lock=null;
  },
  async recordResult({report}){
   const resultRoot=fileWithin(root,'results');
   if(!fs.existsSync(resultRoot))fs.mkdirSync(resultRoot);
   const json=fileWithin(root,'results',id+'.json');
   const txt=fileWithin(root,'results',id+'.txt');
   writeNew(root,json,Buffer.from(JSON.stringify(report)+'\n'));
   writeNew(root,txt,Buffer.from(
    'REQUEST_ID='+id+'\nSTATUS='+report.status+'\nCODE='+(report.code??'NONE')+'\n'));
   return {json:true,txt:true};
  },
 };
}
