// #996 second ORIGINAL Windows READ-ONLY snapshot. NOT a C operator.
// Verify every imported source byte BEFORE loading the observer modules.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isBuiltin} from 'node:module';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ROOT='E:/ZGmini';
const NODE='E:/ZGmini/runtime/node.exe';
const LOCK_SHA256='cef975fbfcf0c608144a5d3de9162e0fb05e4ec1aada0b72cba2f5a9328b6ce6';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const LOCK='controller-996-interrupted-readonly-source-lock-r2.json';
const ENTRY='controller-996-interrupted-readonly-cli-r2.mjs';
const FILES=Object.freeze([
  'controller-996-interrupted-observer.mjs',
  'controller-996-protection-attestation.mjs',
  'controller-996-r2-evidence-review.mjs',
  'controller-996-windows-observer.mjs',
  'controller-996-interrupted-evidence-r2.mjs',
]);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const hash=x=>createHash('sha256').update(x).digest('hex');
const SHA=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);

function checkedRead(folder,name){
  need(FILES.includes(name)||name===LOCK,'C_R2_PACKAGE_UNLISTED_FILE');
  const parent=fs.lstatSync(folder),p=path.join(folder,name),st=fs.lstatSync(p);
  need(parent.isDirectory()&&!parent.isSymbolicLink()&&
    st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
    st.size>0&&st.size<=2_000_000,'C_R2_PACKAGE_FILE_UNSAFE');
  return fs.readFileSync(p);
}

function sourceImports(bytes){
  const str=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  need(!/\bimport\s*\(/.test(str)&&!/\brequire\s*\(/.test(str),
    'C_R2_PACKAGE_DYNAMIC_IMPORT_OR_REQUIRE');
  const refs=[];
  for(const line of str.split(/\r?\n/)){
    if(!/^\s*import\s+/.test(line))continue;
    const m=line.match(/^\s*import\s+.+?\s+from\s+(['"])([^'"]+)\1\s*;\s*$/);
    need(m,'C_R2_PACKAGE_IMPORT_UNRECOGNIZED');
    if(m[2].startsWith('node:')){
      need(isBuiltin(m[2]),'C_R2_PACKAGE_NODE_IMPORT_UNKNOWN');
      continue;
    }
    need(/^\.\/controller-996-[a-z0-9-]+\.mjs$/.test(m[2])&&
      FILES.includes(m[2].slice(2)),'C_R2_PACKAGE_EXTERNAL_IMPORT');
    refs.push(m[2].slice(2));
  }
  return refs.sort();
}

export function verify996InterruptedReadonlyPackageR2({folder=DIR,
  expectedLockSha256=LOCK_SHA256,testOnly=false}={}){
  if(testOnly){
    need(process.platform!=='win32'&&path.isAbsolute(folder)&&
      path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)&&
      path.basename(folder).startsWith('zgmini-996-test-')&&
      SHA(expectedLockSha256),'C_R2_TEST_PORT_REJECTED');
  }else{
    need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
      !process.env.RUNNER_NAME&&folder===DIR&&
      expectedLockSha256===LOCK_SHA256,
      'C_R2_ORIGINAL_WINDOWS_ONLY');
    const pack=path.win32.resolve(folder).toLowerCase();
    const original=path.win32.resolve(ROOT).toLowerCase();
    need(path.win32.isAbsolute(folder)&&!pack.startsWith('\\\\')&&
      pack!==original&&!pack.startsWith(original+'\\')&&
      path.win32.normalize(fs.realpathSync.native(folder)).toLowerCase()===
        path.win32.normalize(folder).toLowerCase(),
      'C_R2_PACKAGE_ROOT_REDIRECT');
  }
  const actual=fs.readdirSync(folder).filter(n=>
    /^controller-996-.*\.mjs$/.test(n)).sort();
  need(actual.join('|')===[ENTRY,...FILES].sort().join('|'),
    'C_R2_PACKAGE_EXTRA_OR_MISSING_MODULE');
  const lockBytes=checkedRead(folder,LOCK);
  need(hash(lockBytes)===expectedLockSha256,
    'C_R2_PACKAGE_LOCK_SHA_DRIFT');
  let lock;try{lock=JSON.parse(lockBytes.toString('utf8'));}catch{}
  need(lock?.schema==='ZGMINI_CONTROLLER_996_INTERRUPTED_READONLY_SOURCE_LOCK_R2'&&
    lock.requestId===REQ&&
    lock.entries?.join('|')===
      [FILES[0],FILES[4]].join('|')&&
    lock.files&&typeof lock.files==='object'&&!Array.isArray(lock.files)&&
    Object.keys(lock.files).sort().join('|')===FILES.slice().sort().join('|'),
    'C_R2_PACKAGE_LOCK_SCHEMA_DRIFT');
  for(const name of FILES){
    const entry=lock.files[name],content=checkedRead(folder,name);
    need(entry&&SHA(entry.sha256)&&entry.sha256===hash(content)&&
      Array.isArray(entry.imports)&&
      entry.imports.slice().sort().join('|')===sourceImports(content).join('|')&&
      entry.imports.every(ref=>FILES.includes(ref)),
      'C_R2_PACKAGE_MODULE_DRIFT');
  }
  return Object.freeze({status:'READONLY_R2_SOURCE_PACKAGE_5_VERIFIED',
    moduleCount:FILES.length,executionAuthorized:false});
}

function originalWindowsOnly(){
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
    !process.env.RUNNER_NAME&&
    path.win32.normalize(process.execPath).toLowerCase()===
      path.win32.normalize(NODE).toLowerCase(),
    'C_R2_ORIGINAL_WINDOWS_ONLY');
  for(const rel of [ROOT,ROOT+'/automation',ROOT+'/automation/pc-maintenance']){
    const st=fs.lstatSync(rel);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_R2_ORIGINAL_ROOT_UNVERIFIED');
  }
  const node=fs.lstatSync(NODE);
  need(node.isFile()&&!node.isSymbolicLink(),
    'C_R2_ORIGINAL_NODE_UNVERIFIED');
}

const stopped=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_EVIDENCE_R2',
  requestId:REQ,status:'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE',
  code:/^C_R2_[A-Z0-9_]{3,100}$/.test(code??'')?code:'C_R2_ENTRY_FAILURE',
  claimProvenanceExternallyPinned:false,
  fullSourceBytePostcheckVerified:false,
  executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0,
});

export async function main(args=process.argv.slice(2)){
  need(args.length===0,'C_R2_FIXED_USAGE');
  originalWindowsOnly();
  verify996InterruptedReadonlyPackageR2();
  const {collect996InterruptedEvidenceR2}=await import(
    './controller-996-interrupted-evidence-r2.mjs');
  return collect996InterruptedEvidenceR2();
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().then(result=>{
    console.log(JSON.stringify(result,null,2));
    if(result.status!=='READONLY_EVIDENCE_SNAPSHOT_CONSISTENT')
      process.exitCode=2;
  }).catch(e=>{
    console.log(JSON.stringify(stopped(e?.code),null,2));
    process.exitCode=2;
  });
}
