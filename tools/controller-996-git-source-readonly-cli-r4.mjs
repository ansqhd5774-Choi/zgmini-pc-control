// #996 ORIGINAL WINDOWS 84 Git bytes OFFLINE/read-only proof. NOT a C operator.
// Only bundled SHA256/Git blob pins: never execute git.exe or any subprocess,
// contact a network service, move original files or perform a PC retry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isBuiltin} from 'node:module';
import {fileURLToPath} from 'node:url';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ROOT='E:/ZGmini';
const NODE='E:/ZGmini/runtime/node.exe';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const ENTRY='controller-996-git-source-readonly-cli-r4.mjs';
const SOURCE='controller-996-git-byte-offline-readonly-r4.mjs';
const MANIFEST='controller-996-git-byte-offline-manifest-r4.json';
const LOCK='controller-996-git-source-readonly-source-lock-r4.json';
const CMD='RUN_996_GIT_SOURCE_READONLY_R4_ONCE.cmd';
const LOCK_SHA256='d9671e500891b1935ddd2b12e38fd1a0b4c3a202c541a814afb3cc508543bb2f';
const SOURCE_SHA256='bc5a5e5cb0c6ced192f5a6c3b9898b8ac3e319076e07bd2de3b9d9872ff5facd';
const MANIFEST_SHA256='0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f';
const IMPORTS=['node:crypto','node:fs','node:os','node:path'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function checkedFile(folder,name){
  need([ENTRY,SOURCE,LOCK,MANIFEST,CMD].includes(name),
    'C_R4_PACKAGE_FILE_NOT_LISTED');
  const parent=fs.lstatSync(folder),file=path.join(folder,name),st=fs.lstatSync(file);
  need(parent.isDirectory()&&!parent.isSymbolicLink()&&
    st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
    st.size>0&&st.size<=2_000_000,'C_R4_PACKAGE_FILE_UNSAFE');
  return fs.readFileSync(file);
}
function sourceImports(bytes){
  const code=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  need(!/\bimport\s*\(/.test(code)&&!/\brequire\s*\(/.test(code),
    'C_R4_SOURCE_DYNAMIC_LOAD_DENIED');
  const refs=[];
  for(const line of code.split(/\r?\n/)){
    if(!/^\s*import\s+/.test(line))continue;
    const match=line.match(/^\s*import\s+.+?\s+from\s+(['"])([^'"]+)\1\s*;\s*$/);
    need(match&&match[2].startsWith('node:')&&isBuiltin(match[2]),
      'C_R4_SOURCE_IMPORT_UNVERIFIED');
    refs.push(match[2]);
  }
  return refs.sort();
}
function originalWindowsOnly(){
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
    !process.env.RUNNER_NAME&&
    path.win32.normalize(process.execPath).toLowerCase()===
      path.win32.normalize(NODE).toLowerCase(),
    'C_R4_ORIGINAL_WINDOWS_ONLY');
  for(const dir of [ROOT,ROOT+'/automation',ROOT+'/automation/pc-control',
    ROOT+'/automation/pc-maintenance']){
    const st=fs.lstatSync(dir);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_R4_ORIGINAL_SOURCE_ROOT_UNVERIFIED');
  }
}
/** Verifies the standalone R4 source closure BEFORE importing the checker. */
export function verify996GitSourcePackageR4({folder=DIR,
  expectedLockSha256=LOCK_SHA256,testOnly=false}={}){
  if(testOnly){
    const base=path.resolve(os.tmpdir()),full=path.resolve(folder);
    need(process.platform!=='win32'&&path.isAbsolute(folder)&&
      full.startsWith(base+path.sep)&&
      path.basename(full).startsWith('zgmini-996-test-')&&
      /^[a-f0-9]{64}$/.test(expectedLockSha256),
      'C_R4_TEST_FIXTURE_ROOT_INVALID');
  }else{
    originalWindowsOnly();
    const pack=path.win32.resolve(folder).toLowerCase();
    const origin=path.win32.resolve(ROOT).toLowerCase();
    need(folder===DIR&&expectedLockSha256===LOCK_SHA256&&
      path.win32.isAbsolute(folder)&&!pack.startsWith('\\\\')&&
      pack!==origin&&!pack.startsWith(origin+'\\')&&
      path.win32.normalize(fs.realpathSync.native(folder)).toLowerCase()===
        path.win32.normalize(folder).toLowerCase(),
      'C_R4_PACKAGE_ROOT_REDIRECT');
  }
  need(same(fs.readdirSync(folder).sort(),
    [ENTRY,SOURCE,LOCK,MANIFEST,CMD].sort()),
    'C_R4_PACKAGE_EXTRA_OR_MISSING');
  const lockBytes=checkedFile(folder,LOCK);
  need(sha(lockBytes)===expectedLockSha256,
    'C_R4_PACKAGE_SOURCE_LOCK_SHA_DRIFT');
  let lock;try{lock=JSON.parse(lockBytes.toString('utf8'));}catch{}
  need(lock?.schema==='ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_LOCK_R4'&&
    lock.requestId===REQ&&lock.module===SOURCE&&
    lock.moduleSha256===SOURCE_SHA256&&
    lock.manifestSha256===MANIFEST_SHA256&&
    same(lock.imports,IMPORTS)&&Object.keys(lock).length===6,
    'C_R4_PACKAGE_SOURCE_LOCK_INVALID');
  const bytes=checkedFile(folder,SOURCE);
  need(sha(bytes)===lock.moduleSha256&&
    same(sourceImports(bytes),IMPORTS),
    'C_R4_PACKAGE_SOURCE_MODULE_DRIFT');
  need(sha(checkedFile(folder,MANIFEST))===lock.manifestSha256,
    'C_R4_PACKAGE_MANIFEST_SHA_DRIFT');
  return Object.freeze({status:'READONLY_R4_SOURCE_PACKAGE_VERIFIED',
    modules:1,manifestFiles:84,
    executionAuthorized:false,operationalWrites:0});
}
const stopped=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_R4',
  status:'SOURCE_BYTES_UNVERIFIED',
  code:/^C_(?:R4|996)_[A-Z0-9_]+$/.test(code??'')?code:
    'C_R4_READONLY_UNKNOWN',
  originalWindowsReadback:false,executionAuthorized:false,
  operationalWrites:0,workflowPuts:0,backlogWrites:0,
  issuePosts:0,pcRetries:0,
});

export async function main(args=process.argv.slice(2)){
  need(args.length===0,'C_R4_FIXED_USAGE');
  originalWindowsOnly();
  verify996GitSourcePackageR4();
  const {verify996OfflineGitBytesReadOnly}=await import(
    './controller-996-git-byte-offline-readonly-r4.mjs');
  const result=verify996OfflineGitBytesReadOnly({
    manifestBytes:checkedFile(DIR,MANIFEST),
    expectedManifestSha256:MANIFEST_SHA256,
  });
  if(result.status!=='SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS')return result;
  return Object.freeze({...result,
    schema:'ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_R4',
    originalWindowsReadback:true,executionAuthorized:false,
    operationalWrites:0,workflowPuts:0,backlogWrites:0,
    issuePosts:0,pcRetries:0});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().then(result=>{
    console.log(JSON.stringify(result,null,2));
    if(result.status!=='SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS')
      process.exitCode=2;
  }).catch(e=>{
    console.log(JSON.stringify(stopped(e?.code),null,2));
    process.exitCode=2;
  });
}
