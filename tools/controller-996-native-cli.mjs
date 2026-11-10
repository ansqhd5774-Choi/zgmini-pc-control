// #996 one-shot original-Windows C operator entrypoint. No side effects on
// import. No GitHub Actions, runner or remote command execution route.
// This is source-only until the exact operator evidence readers and the
// original-PC package have been independently verified and deployed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isBuiltin} from 'node:module';
import os from 'node:os';
import {createInterface} from 'node:readline/promises';

const COMMIT='7cff08ec6b27410baf10d8dc7130edb57b2de8c4';
// SHA256 of the exact immutable 17-module source lock JSON. After updating
// dependency sources, a new reviewed release must re-seal lock -> CLI -> CMD.
const LOCK_SHA256='1761f67e0bf26175b13979692961cbcdff34d6f83a9cf9a5d585ca13a366e653';
const ROOT='E:/ZGmini';
const NODE='E:/ZGmini/runtime/node.exe';
const MANIFEST='E:/ZGmini/automation/pc-maintenance/MAINTENANCE_INSTALL.json';
const MAINTAINER='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const CONFIRM='996 실행';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const MODULES=Object.freeze([
 'controller-996-backlog-plan.mjs',
 'controller-996-backlog-readback.mjs',
 'controller-996-c-consent-verifier.mjs',
 'controller-996-c-transaction.mjs',
 'controller-996-native-approval-readiness.mjs',
 'controller-996-native-backlog.mjs',
 'controller-996-native-claims.mjs',
 'controller-996-native-consent-reader.mjs',
 'controller-996-native-fresh-preflight.mjs',
 'controller-996-native-github-readonly.mjs',
 'controller-996-native-operator.mjs',
 'controller-996-native-postcheck.mjs',
 'controller-996-native-workflow.mjs',
 'controller-996-native-writer-gate.mjs',
 'controller-996-protection-attestation.mjs',
 'controller-996-r2-evidence-review.mjs',
 'controller-996-windows-observer.mjs',
 'controller-996-native-source-lock-r1.json',
]);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const sha256=x=>createHash('sha256').update(x).digest('hex');
const SHA64=/^[a-f0-9]{64}$/;
const safeCode=e=>/^C_[A-Z0-9_]{4,100}$/.test(e?.code??'')?
 e.code:'C_CLI_UNVERIFIED_ERROR';
const failure=(code,untouched)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_NATIVE_CLI_V1',
 status:untouched?'C_CLI_BLOCKED_UNTOUCHED':'STATE_UNKNOWN_REVIEW_ORIGINAL_PC',
 code,executionAuthorized:false,retryAuthorized:false,
 next:untouched?'REVIEW_SOURCE_AND_ORIGINAL_PC_BEFORE_ANY_EXECUTION':
  'READ_ONLY_INSPECT_C_CLAIM_ORIGINAL_LEASE_WORKFLOW_BACKLOG',
});

function originalWindowsOnly(){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME,'C_CLI_ORIGINAL_WINDOWS_REQUIRED');
 need(path.win32.normalize(process.execPath).toLowerCase()===
  path.win32.normalize(NODE).toLowerCase(),
  'C_CLI_ORIGINAL_NODE_REQUIRED');
 for(const folder of [ROOT,ROOT+'/automation',
  ROOT+'/automation/pc-maintenance']){
  const stat=fs.lstatSync(folder);
  need(stat.isDirectory()&&!stat.isSymbolicLink(),
   'C_CLI_ORIGINAL_ROOT_UNVERIFIED');
 }
 const stat=fs.lstatSync(MANIFEST);
 need(stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size>0&&stat.size<=200_000,
  'C_CLI_ORIGINAL_MAINTAINER_UNVERIFIED');
 let installed;
 try{installed=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));}
 catch{need(false,'C_CLI_ORIGINAL_MAINTAINER_UNVERIFIED');}
 need(installed?.schema==='ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&
  installed.sourceSha===MAINTAINER,
  'C_CLI_ORIGINAL_MAINTAINER_UNVERIFIED');
 need(process.stdin.isTTY===true&&process.stdout.isTTY===true,
  'C_CLI_INTERACTIVE_CONSOLE_REQUIRED');
}

function readSafe(folder,filename){
 need(MODULES.includes(filename), 'C_CLI_PACKAGE_UNLISTED_FILE');
 const dir=fs.lstatSync(folder),file=path.join(folder,filename);
 need(dir.isDirectory()&&!dir.isSymbolicLink(),
  'C_CLI_PACKAGE_DIRECTORY_REDIRECT');
 let stat;
 try{stat=fs.lstatSync(file);}
 catch{need(false,'C_CLI_PACKAGE_FILE_MISSING');}
 need(stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size>0&&stat.size<=2_000_000,
  'C_CLI_PACKAGE_FILE_UNSAFE');
 return fs.readFileSync(file);
}

function sourceImports(bytes){
 const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 need(!/\bimport\s*\(/.test(body)&&!/\brequire\s*\(/.test(body),
  'C_CLI_DYNAMIC_IMPORT_FORBIDDEN');
 const decl=(body.match(/(?:^|\n)\s*import\s+(?!\()/g)??[]).length;
 const source=/(?:^|\n)\s*import\s+(?:[\s\S]{0,450}?\s+from\s+)?(['"])([^'"]+)\1\s*;/g;
 const all=[...body.matchAll(source)].map(match=>match[2]);
 need(all.length===decl,'C_CLI_IMPORT_DECLARATION_UNVERIFIED');
 const refs=[];
 for(const spec of all){
  if(spec.startsWith('node:')){
   need(isBuiltin(spec),'C_CLI_UNVERIFIED_NODE_IMPORT');continue;
  }
  need(/^\.\/controller-996-[a-z0-9-]+\.mjs$/.test(spec),
   'C_CLI_PACKAGE_IMPORT_NOT_ALLOWED');
  refs.push(spec.slice(2));
 }
 return refs.sort();
}

/** Read-only source verification. A test fixture may supply a synthetic
 * expected lock digest, but production always uses this module's own path
 * and the immutable lock SHA constant above. Never imports a source file. */
export function verify996NativeSourcePackage({folder=DIR,
 expectedLockSha256=LOCK_SHA256,testOnly=false}={}){
 if(testOnly){
  need(process.platform!=='win32'&&path.isAbsolute(folder)&&
   path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)&&
   path.basename(folder).startsWith('zgmini-996-test-')&&
   SHA64.test(expectedLockSha256),
   'C_CLI_TEST_SOURCE_ROOT_REJECTED');
 }else{
  need(folder===DIR&&expectedLockSha256===LOCK_SHA256&&
   process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME,
   'C_CLI_SOURCE_LOCATION_OR_ENVIRONMENT_UNVERIFIED');
  const pack=path.win32.resolve(folder).toLowerCase();
  const original=path.win32.resolve(ROOT).toLowerCase();
  need(path.win32.isAbsolute(folder)&&!pack.startsWith('\\\\')&&
   pack!==original&&!pack.startsWith(original+'\\'),
   'C_CLI_PACKAGE_INSIDE_ORIGINAL_INSTALL_ROOT');
  const real=path.win32.normalize(fs.realpathSync.native(folder)).toLowerCase();
  need(real===path.win32.normalize(folder).toLowerCase(),
   'C_CLI_PACKAGE_DIRECTORY_REDIRECT');
 }
 const lockBytes=readSafe(folder,'controller-996-native-source-lock-r1.json');
 need(sha256(lockBytes)===expectedLockSha256,
  'C_CLI_SOURCE_LOCK_SHA_DRIFT');
 let lock;
 try{lock=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(lockBytes));}
 catch{need(false,'C_CLI_SOURCE_LOCK_JSON_INVALID');}
 const names=MODULES.filter(n=>n.endsWith('.mjs')).sort();
 const local=fs.readdirSync(folder)
  .filter(n=>/^controller-996-.*\.mjs$/.test(n)).sort();
 need(local.join('|')===
  ['controller-996-native-cli.mjs',...names].sort().join('|'),
  'C_CLI_PACKAGE_EXTRA_OR_MISSING_MODULE');
 need(lock?.schema==='ZGMINI_CONTROLLER_996_NATIVE_SOURCE_LOCK_R1'&&
  lock.manifestCommitSha===COMMIT&&
  lock.entry==='controller-996-native-operator.mjs'&&
  lock.files&&typeof lock.files==='object'&&!Array.isArray(lock.files)&&
  Object.keys(lock.files).sort().join('|')===names.join('|'),
  'C_CLI_SOURCE_LOCK_SCOPE_UNVERIFIED');
 const imports={};
 for(const name of names){
  const file=lock.files[name],bytes=readSafe(folder,name);
  need(file&&SHA64.test(file.sha256)&&
   file.sha256===sha256(bytes)&&Array.isArray(file.imports)&&
   file.imports.every(n=>typeof n==='string'&&names.includes(n)),
   'C_CLI_PACKAGE_SOURCE_SHA_DRIFT');
  imports[name]=sourceImports(bytes);
  need(file.imports.slice().sort().join('|')===imports[name].join('|'),
   'C_CLI_SOURCE_IMPORT_CLOSURE_DRIFT');
 }
 const seen=new Set(),pending=[lock.entry];
 while(pending.length){
  const name=pending.pop();
  if(seen.has(name))continue;
  need(names.includes(name),'C_CLI_SOURCE_IMPORT_OUTSIDE_PACKAGE');
  seen.add(name);pending.push(...imports[name]);
 }
 need(seen.size===names.length,'C_CLI_SOURCE_UNUSED_OR_MISSING_MODULE');
 return Object.freeze({status:'C_CLI_SOURCE_PACKAGE_17_DEPS_VERIFIED',
  modulesVerified:seen.size,sha256:expectedLockSha256,
  executionAuthorized:false});
}

/** Only immutable status/count fields are displayed, never internal errors,
 * owner/claim nonce, raw evidence, secrets or original Issue contents. */
export function summarize996NativeCliResult(result){
 const allowed=new Set(['C_NOT_STARTED',
  'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE',
  'STATE_UNKNOWN_CHECK_ARCHIVED_ORIGINAL_LEASE',
  'STATE_UNKNOWN_CHECK_ARCHIVED_C_CLAIM',
  'C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED']);
 need(result?.schema==='ZGMINI_CONTROLLER_996_NATIVE_OPERATOR_V1'&&
  allowed.has(result.status),'C_CLI_OPERATOR_RESULT_UNVERIFIED');
 const success=result.status==='C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED';
 if(success)need(result.physicalPostcheckVerified===true&&
  result.simulated===false&&result.retryAuthorized===false&&
  result.controllerInstalls===0&&result.originalPcJobRetries===0&&
  result.issuePosts===0&&
  Number.isSafeInteger(result.ownerReplanRequired)&&
  result.ownerReplanRequired>=0,
  'C_CLI_OPERATOR_SUCCESS_RECEIPT_UNVERIFIED');
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_CLI_V1',
  status:result.status,
  code:/^[A-Z0-9_]{3,100}$/.test(result.code??'')?
   result.code:'C_CLI_OPERATOR_CODE_UNVERIFIED',
  failedStep:/^[A-Z0-9_]{3,100}$/.test(result.failedStep??'')?
   result.failedStep:null,
  workflowPutAttempts:count(result.workflowPutAttempts),
  backlogCloseAttempts:count(result.backlogCloseAttempts),
  originalLeaseArchiveAttempts:count(result.originalLeaseArchiveAttempts),
  ownClaimArchiveAttempts:count(result.ownClaimArchiveAttempts),
  ownerReplanRequired:success?result.ownerReplanRequired:null,
  retryAuthorized:false,executionAuthorized:false,
  next:success?'OWNER_REPLAN_UNVERIFIED_OR_FAILED_ORIGINAL_JOBS':
   result.status==='C_NOT_STARTED'?
    'REVIEW_BLOCKER_AND_AUTHORITY_BEFORE_ANY_NEW_EXECUTION':
    'READ_ONLY_INSPECT_C_CLAIM_ORIGINAL_LEASE_WORKFLOW_BACKLOG',
 });
}

/** No test-only production escape hatch. Returns a bounded JSON receipt.
 * Any uncertain outcome after confirmation is preserved, never retried. */
export async function main(args=process.argv.slice(2)){
 let accepted=false;
 try{
  need(Array.isArray(args)&&args.length===0,'C_CLI_ARGUMENTS_FORBIDDEN');
  originalWindowsOnly();
  verify996NativeSourcePackage();
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let answer;
  try{
   answer=await rl.question(
    '원본 Windows #996 단회 C 복구를 실행합니다. 진행하려면 "996 실행" 입력: ');
  }finally{rl.close();}
  if(answer?.trim()!==CONFIRM)return Object.freeze({
   schema:'ZGMINI_CONTROLLER_996_NATIVE_CLI_V1',
   status:'C_CLI_CANCELLED_UNTOUCHED',code:'C_CLI_USER_DID_NOT_CONFIRM',
   retryAuthorized:false,executionAuthorized:false,
   next:'NO_OPERATION_PERFORMED',
  });
  accepted=true;
  // Another read immediately before import catches changes during the
  // interactive confirmation. This is not an OS-level atomic filesystem CAS.
  verify996NativeSourcePackage();
  const {create996NativeOperator}=await import(
   './controller-996-native-operator.mjs');
  const result=await create996NativeOperator().run({manifestCommitSha:COMMIT});
  return summarize996NativeCliResult(result);
 }catch(e){return failure(safeCode(e),!accepted);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===
 fileURLToPath(import.meta.url)){
 main().then(result=>{
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=result.status==='C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED'||
   result.status==='C_CLI_CANCELLED_UNTOUCHED'?0:2;
 }).catch(()=>{
  process.stdout.write(JSON.stringify(failure('C_CLI_UNVERIFIED_ERROR',false))+'\n');
  process.exitCode=2;
 });
}
