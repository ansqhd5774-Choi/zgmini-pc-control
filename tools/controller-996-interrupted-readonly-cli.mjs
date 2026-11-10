// #996 interrupted C: self-contained READ-ONLY verification entrypoint.
// This file imports no non-builtin source until a fixed source-lock has been
// verified. It NEVER invokes the native C operator or mutates its lease.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isBuiltin} from 'node:module';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ROOT='E:/ZGmini';
const NODE='E:/ZGmini/runtime/node.exe';
const LOCK_SHA256='ab2b58f7dc2ef528052add141d81e4d4eb2a7d5cf8b1673d07e1ff50901fee10';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const LOCK='controller-996-interrupted-readonly-source-lock-r1.json';
const FILES=Object.freeze([
 'controller-996-interrupted-observer.mjs',
 'controller-996-protection-attestation.mjs',
 'controller-996-r2-evidence-review.mjs',
 'controller-996-windows-observer.mjs',
]);
const SHA64=/^[a-f0-9]{64}$/;
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const hash=x=>createHash('sha256').update(x).digest('hex');

function checkedRead(folder,name){
 need(FILES.includes(name)||name===LOCK,'C_READONLY_PACKAGE_UNLISTED_FILE');
 const root=fs.lstatSync(folder);
 need(root.isDirectory()&&!root.isSymbolicLink(),
  'C_READONLY_PACKAGE_ROOT_REDIRECT');
 const target=path.join(folder,name),st=fs.lstatSync(target);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=2_000_000,
  'C_READONLY_PACKAGE_FILE_UNSAFE');
 return fs.readFileSync(target);
}

function sourceImports(bytes){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 need(!/\bimport\s*\(/.test(text)&&!/\brequire\s*\(/.test(text),
  'C_READONLY_PACKAGE_DYNAMIC_IMPORT_OR_REQUIRE');
 const refs=[];
 for(const line of text.split(/\r?\n/)){
  if(!/^\s*import\s+/.test(line))continue;
  const m=line.match(/^\s*import\s+.+?\s+from\s+(['"])([^'"]+)\1\s*;\s*$/);
  need(m,'C_READONLY_PACKAGE_IMPORT_UNRECOGNIZED');
  if(m[2].startsWith('node:')){
   need(isBuiltin(m[2]),'C_READONLY_PACKAGE_NODE_IMPORT_UNKNOWN');
   continue;
  }
  need(/^\.\/controller-996-[a-z0-9-]+\.mjs$/.test(m[2])&&
   FILES.includes(m[2].slice(2)),
   'C_READONLY_PACKAGE_EXTERNAL_IMPORT');
  refs.push(m[2].slice(2));
 }
 return refs.sort();
}

// Only this pure test port permits a temporary fixture outside Windows.
export function verify996InterruptedReadonlyPackage({folder=DIR,
 expectedLockSha256=LOCK_SHA256,testOnly=false}={}){
 if(testOnly){
  need(process.platform!=='win32'&&path.isAbsolute(folder)&&
   path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)&&
   path.basename(folder).startsWith('zgmini-996-test-')&&
   SHA64.test(expectedLockSha256),
   'C_READONLY_TEST_PORT_REJECTED');
 }else{
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME&&folder===DIR&&
   expectedLockSha256===LOCK_SHA256,
   'C_READONLY_ORIGINAL_WINDOWS_ONLY');
  const pack=path.win32.resolve(folder).toLowerCase();
  const original=path.win32.resolve(ROOT).toLowerCase();
  need(path.win32.isAbsolute(folder)&&!pack.startsWith('\\\\')&&
   pack!==original&&!pack.startsWith(original+'\\'),
   'C_READONLY_PACKAGE_INSIDE_ORIGINAL_ROOT');
  need(path.win32.normalize(fs.realpathSync.native(folder)).toLowerCase()===
   path.win32.normalize(folder).toLowerCase(),
   'C_READONLY_PACKAGE_ROOT_REDIRECT');
 }
 const names=fs.readdirSync(folder).filter(n=>
  /^controller-996-.*\.mjs$/.test(n)).sort();
 need(names.join('|')===
  ['controller-996-interrupted-readonly-cli.mjs',...FILES].sort().join('|'),
  'C_READONLY_PACKAGE_EXTRA_OR_MISSING_MODULE');
 const lockBytes=checkedRead(folder,LOCK);
 need(hash(lockBytes)===expectedLockSha256,
  'C_READONLY_PACKAGE_LOCK_SHA_DRIFT');
 let lock;try{lock=JSON.parse(lockBytes.toString('utf8'));}catch{}
 need(lock?.schema==='ZGMINI_CONTROLLER_996_INTERRUPTED_READONLY_SOURCE_LOCK_R1'&&
  lock.requestId===REQ&&lock.entry===FILES[0]&&
  lock.files&&typeof lock.files==='object'&&!Array.isArray(lock.files)&&
  Object.keys(lock.files).sort().join('|')===FILES.slice().sort().join('|'),
  'C_READONLY_PACKAGE_LOCK_SCHEMA_DRIFT');
 for(const name of FILES){
  const bytes=checkedRead(folder,name),entry=lock.files[name];
  need(entry&&SHA64.test(entry.sha256)&&entry.sha256===hash(bytes)&&
   Array.isArray(entry.imports)&&entry.imports.every(x=>FILES.includes(x))&&
   entry.imports.slice().sort().join('|')===sourceImports(bytes).join('|'),
   'C_READONLY_PACKAGE_MODULE_DRIFT');
 }
 return Object.freeze({status:'READONLY_SOURCE_PACKAGE_4_VERIFIED',
  moduleCount:FILES.length,sourceLockSha256:expectedLockSha256,
  executionAuthorized:false});
}

function originalWindowsOnly(){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME,'C_READONLY_ORIGINAL_WINDOWS_ONLY');
 need(path.win32.normalize(process.execPath).toLowerCase()===
  path.win32.normalize(NODE).toLowerCase(),
  'C_READONLY_ORIGINAL_NODE_REQUIRED');
 for(const folder of [ROOT,ROOT+'/automation',
  ROOT+'/automation/pc-maintenance']){
  const st=fs.lstatSync(folder);
  need(st.isDirectory()&&!st.isSymbolicLink(),
   'C_READONLY_ORIGINAL_ROOT_UNVERIFIED');
 }
 const exe=fs.lstatSync(NODE);
 need(exe.isFile()&&!exe.isSymbolicLink(),
  'C_READONLY_ORIGINAL_NODE_UNVERIFIED');
}

// Output fields intentionally omit owner PID, nonce, raw ledger/Issue or keys.
export function summarize996InterruptedReadonly(r){
 need(r?.schema==='ZGMINI_CONTROLLER_996_INTERRUPTED_OBSERVATION_V1'&&
  [ 'READONLY_INTERRUPTED_PHASE_CONSISTENT',
    'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE' ].includes(r.status)&&
  r.executionAuthorized===false&&r.operationalWrites===0&&
  r.issuePosts===0&&r.pcRetries===0,
  'C_READONLY_OBSERVER_RESULT_UNVERIFIED');
 const success=r.status==='READONLY_INTERRUPTED_PHASE_CONSISTENT';
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_READONLY_CLI_V1',
  requestId:REQ,status:r.status,
  code:/^[A-Z0-9_]{3,100}$/.test(r.code??'')?r.code:
   'C_READONLY_OBSERVER_CODE_UNVERIFIED',
  checksPassed:success?r.checksPassed:null,
  checksTotal:success?r.checksTotal:null,
  backlogSha256:success&&SHA64.test(r.backlogSha256)?r.backlogSha256:null,
  pausedAt:success?r.pausedAt:null,resumedAt:success?r.resumedAt:null,
  workflowState:success?r.workflowState:null,
  originalLeasePresent:success?r.originalLeasePresent:null,
  cClaimPresent:success?r.cClaimPresent:null,
  laterArchiveMarkersPresent:success?r.laterArchiveMarkersPresent:null,
  claimProvenanceExternallyPinned:false,
  fullSourceBytePostcheckVerified:false,executionAuthorized:false,
  operationalWrites:0,issuePosts:0,pcRetries:0,
 });
}

const stop=code=>({
 schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_READONLY_CLI_V1',
 requestId:REQ,status:'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE',
 code:/^C_READONLY_[A-Z0-9_]{3,100}$/.test(code??'')?
  code:'C_READONLY_ENTRY_FAILURE',
 claimProvenanceExternallyPinned:false,
 fullSourceBytePostcheckVerified:false,executionAuthorized:false,
 operationalWrites:0,issuePosts:0,pcRetries:0,
});

export async function main(args=process.argv.slice(2)){
 need(args.length===0,'C_READONLY_FIXED_USAGE');
 originalWindowsOnly();
 verify996InterruptedReadonlyPackage();
 const {collect996InterruptedEvidence}=await import(
  './controller-996-interrupted-observer.mjs');
 return summarize996InterruptedReadonly(collect996InterruptedEvidence());
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().then(result=>{
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='READONLY_INTERRUPTED_PHASE_CONSISTENT')process.exitCode=2;
 }).catch(e=>{
  console.log(JSON.stringify(stop(e?.code),null,2));
  process.exitCode=2;
 });
}
