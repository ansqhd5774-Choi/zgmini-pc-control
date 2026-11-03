#!/usr/bin/env node
// Separate B-grade one-shot checked-out entry. NEVER called by pc-job/maintainer.
// Both Git trees must be pinned at trusted, reviewed immutable commit SHAs.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
 validateIssue,validateApprovalBytes,validateBundleHashes,safeCandidateResult,
 fail,SOURCE_FILES,ER1_SOURCE_SHA,CONTROL_REPO,GLOBAL_RESERVATION_PATH,
} from './er1-b-contract.mjs';
import {V2_EDITION} from './er1-b-contract-v2.mjs';

export const LEDGER_ROOT=String.raw`E:\ZGmini\automation\er1-one-shot`;
export const HOST_ROOT=LEDGER_ROOT; // compatibility alias for fixture consumers
const PACKAGE_FOLDER='er1_once_candidate';
const APPROVAL_NAME='ER1_PC_OPERATION_APPROVAL.json';
const CANDIDATE_SCRIPT=path.join('tools','market-calendar-er1','ER1_PC_OPERATION_ONCE.mjs');
const DEFAULT_EDITION=Object.freeze({
 validateApprovalBytes,validateBundleHashes,sourceFiles:SOURCE_FILES,
 candidateScript:CANDIDATE_SCRIPT,privateOperator:path.join('operator','ER1_PC_OPERATION_ONCE.mjs'),
});
const ATTEMPT_MARKER='ER1_B_ONE_SHOT_ATTEMPTED.json';
const LOCK_FILE='ER1_B_ONE_SHOT.lock';
export const resultFileName=requestId=>
 /^pc-er1-[a-f0-9-]{36}$/.test(requestId??'')?
  `ER1_B_WORKFLOW_RESULT_${requestId}.json`:
  `ER1_B_WORKFLOW_RESULT_invalid_${/^\d{1,18}$/.test(process.env.GITHUB_RUN_ID??'')?process.env.GITHUB_RUN_ID:'unknown'}.json`;
const NODE_BINARY=String.raw`E:\ZGmini\runtime\node.exe`;
const CONTROL_CHECKOUT='er1-control';
const SOURCE_CHECKOUT='er1-source';
const PRIVATE_APPROVAL=path.join('approval',APPROVAL_NAME);
const PRIVATE_OPERATOR=path.join('operator','ER1_PC_OPERATION_ONCE.mjs');
const SHA40=/^[a-f0-9]{40}$/;
const coded=e=>/^ER1_[A-Z0-9_]+$/.test(String(e?.code??e?.message??''))?
 String(e?.code??e?.message):'ER1_B_UNEXPECTED_FAILURE';

export function sanitizedEnv(env){
 const kept=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec',
  'USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP'];
 return Object.fromEntries(kept.filter(x=>typeof env?.[x]==='string').map(x=>[x,env[x]]));
}

/** GitHub Contents create-only is a cross-host single attempt reservation.
 *  Never send GitHub credentials to the candidate scorer/publisher child.
 */
export async function reserveGlobalOnce({request,issueNumber,env,
 apiFetch=fetch}={}){
 const token=env?.GITHUB_TOKEN;
 if(typeof token!=='string'||token.length<20)
  fail('ER1_B_GLOBAL_RESERVATION_AUTH_STOP');
 const payload={schema:'ZGMINI_ER1_B_GLOBAL_ONESHOT_V1',
  requestId:request.requestId,issueNumber,
  candidateSourceSha:request.candidateSourceSha,
  approvalManifestSha256:request.approvalManifestSha256,
  state:'EXECUTION_STARTED_NO_RETRY'};
 const url=`https://api.github.com/repos/${CONTROL_REPO}/contents/${GLOBAL_RESERVATION_PATH}`;
 let response;
 try{response=await apiFetch(url,{method:'PUT',headers:{
  accept:'application/vnd.github+json',authorization:`Bearer ${token}`,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-er1-b-once',
 },body:JSON.stringify({message:'chore(er1): reserve approved global B one-shot',
  content:Buffer.from(JSON.stringify(payload),'utf8').toString('base64')})})}
 catch{fail('ER1_B_GLOBAL_RESERVATION_STATE_UNKNOWN_STOP')}
 if(response?.status===201)return true;
 if(response?.status===409||response?.status===422)
  fail('ER1_B_GLOBAL_ONESHOT_ALREADY_OR_CONFLICT_STOP');
 fail('ER1_B_GLOBAL_RESERVATION_UNVERIFIED_STOP');
}

function assertFixedPaths(ledgerRoot,packageRoot,workspace){
 if(process.platform!=='win32')fail('ER1_B_WINDOWS_ONLY_STOP');
 const realHost=fs.realpathSync.native(ledgerRoot).toLowerCase();
 const allowed=fs.realpathSync.native(String.raw`E:\ZGmini`).toLowerCase()+path.sep;
 if(!realHost.startsWith(allowed))fail('ER1_B_HOST_REALPATH_OUTSIDE_E_STOP');
 const realPackage=fs.realpathSync.native(packageRoot).toLowerCase();
 const realWorkspace=fs.realpathSync.native(workspace).toLowerCase();
 if(!realPackage.startsWith(realWorkspace+path.sep))
  fail('ER1_B_PACKAGE_OUTSIDE_GITHUB_WORKSPACE_STOP');
}

function regularFile(base,file){
 const full=path.join(base,file);
 const s=fs.lstatSync(full);
 if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>2_000_000)
  fail('ER1_B_PACKAGE_FILE_SHAPE_STOP');
 const real=fs.realpathSync.native(full).toLowerCase();
 if(!real.startsWith(fs.realpathSync.native(base).toLowerCase()+path.sep))
  fail('ER1_B_PACKAGE_REALPATH_STOP');
 return fs.readFileSync(full);
}

function fixedGit(){
 if(process.platform!=='win32')fail('ER1_B_WINDOWS_ONLY_STOP');
 const candidates=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files (x86)\Git\cmd\git.exe`];
 const git=candidates.find(fs.existsSync);
 if(!git)fail('ER1_B_GIT_UNAVAILABLE_STOP');
 return git;
}
function checkedOutSha(root){
 return execFileSync(fixedGit(),['-c','core.fsmonitor=false','-C',root,'rev-parse','HEAD'],
  {windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:1000}).trim();
}
function trackedDirty(root){
 return execFileSync(fixedGit(),['-c','core.fsmonitor=false','-C',root,
  'status','--porcelain','--untracked-files=no'],
  {windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:1000}).trim();
}

/**
 * Uses only checkout commits and fixed files. No checked-out candidate imports
 * or data writes occur before both source and manifest digests are validated.
 * The approved operator is an exact-byte copy of the existing ER1 ZIP candidate.
 */
export function prepareCheckoutWorkspace({event,env=process.env,workRoot=env.GITHUB_WORKSPACE,
 fileSystem=fs,gitSha=checkedOutSha,gitDirty=trackedDirty,
 strictPlatform=true,edition=DEFAULT_EDITION}={}){
 const request=validateIssue(event,env);
 if(typeof workRoot!=='string'||!path.isAbsolute(workRoot)||
  !SHA40.test(env.ER1_APPROVED_CONTROL_SHA??'')||
  env.ER1_APPROVED_SOURCE_SHA!==ER1_SOURCE_SHA)
  fail('ER1_B_WORKSPACE_OR_COMMIT_PIN_STOP');
 const controlRoot=path.join(workRoot,CONTROL_CHECKOUT);
 const sourceRoot=path.join(workRoot,SOURCE_CHECKOUT);
 if(strictPlatform){
  if(process.platform!=='win32')fail('ER1_B_WINDOWS_ONLY_STOP');
  const w=fileSystem.realpathSync.native(workRoot).toLowerCase()+path.sep;
  for(const child of [controlRoot,sourceRoot]){
   if(!fileSystem.realpathSync.native(child).toLowerCase().startsWith(w))
    fail('ER1_B_CHECKOUT_ESCAPE_STOP');
  }
 }
 if(gitSha(controlRoot)!==env.ER1_APPROVED_CONTROL_SHA||
  gitSha(sourceRoot)!==ER1_SOURCE_SHA||gitDirty(controlRoot)||gitDirty(sourceRoot))
  fail('ER1_B_CHECKOUT_SHA_OR_DIRTY_STOP');

 const approvalPath=path.join(controlRoot,PRIVATE_APPROVAL);
 const operatorPath=path.join(controlRoot,edition.privateOperator);
 if(strictPlatform){regularFile(controlRoot,PRIVATE_APPROVAL);
  regularFile(controlRoot,edition.privateOperator);}
 const bytes=fileSystem.readFileSync(approvalPath);
 const manifest=edition.validateApprovalBytes(bytes,request);
 const staged=path.join(sourceRoot,edition.candidateScript);
 // Verify all five approved bytes first, including the private-only operator.
 edition.validateBundleHashes({manifest,root:sourceRoot,pathJoin:path.join,
  readFile:p=>{
   const relative=path.relative(sourceRoot,p).replaceAll(path.sep,'/');
   const extra=edition.privateExtraStage?.[relative];
   return fileSystem.readFileSync(path.resolve(p)===path.resolve(staged)?operatorPath:
    extra?path.join(controlRoot,extra):p);
  }});
 if(strictPlatform)for(const relative of edition.sourceFiles.filter(x=>
  x!==edition.candidateScript.replaceAll(path.sep,'/')&&
  !Object.hasOwn(edition.privateExtraStage??{},x)))
  regularFile(sourceRoot,relative);
 if(fileSystem.existsSync(staged)||fileSystem.existsSync(path.join(sourceRoot,APPROVAL_NAME)))
  fail('ER1_B_STAGING_OVERWRITE_STOP');
 for(const [relative,privateRelative] of Object.entries(edition.privateExtraStage??{})){
  const target=path.join(sourceRoot,...relative.split('/'));
  if(fileSystem.existsSync(target))fail('ER1_B_STAGING_OVERWRITE_STOP');
  fileSystem.copyFileSync(path.join(controlRoot,privateRelative),target,
   fileSystem.constants.COPYFILE_EXCL);
 }
 // Only isolated runner checkout is modified, never the installed PC project.
 fileSystem.copyFileSync(operatorPath,staged,fileSystem.constants.COPYFILE_EXCL);
 fileSystem.copyFileSync(approvalPath,path.join(sourceRoot,APPROVAL_NAME),
  fileSystem.constants.COPYFILE_EXCL);
 return {sourceRoot,controlRoot,manifest};
}

/** Dependency injection is tests-only; the real CLI binds all paths and code. */
export async function executeOnce({event,env=process.env,root=HOST_ROOT,
 packageRoot=path.join(root,PACKAGE_FOLDER),workspace=env.GITHUB_WORKSPACE,
 fileSystem=fs,preflight,spawnCandidate,
 reserveGlobal=reserveGlobalOnce,strictPlatform=true,edition=DEFAULT_EDITION}={}){
 const request=validateIssue(event,env);
 const approvalPath=path.join(packageRoot,APPROVAL_NAME);
 const candidatePath=path.join(packageRoot,edition.candidateScript);
 const bytes=fileSystem.readFileSync(approvalPath);
 const manifest=edition.validateApprovalBytes(bytes,request);
 if(strictPlatform){
  if(typeof workspace!=='string'||!path.isAbsolute(workspace))
   fail('ER1_B_WORKSPACE_OR_COMMIT_PIN_STOP');
  fileSystem.mkdirSync(root,{recursive:true});
  assertFixedPaths(root,packageRoot,workspace);
  regularFile(packageRoot,APPROVAL_NAME);
  for(const relative of Object.keys(manifest.sourceSha256))regularFile(packageRoot,relative);
 }
 edition.validateBundleHashes({manifest,root:packageRoot,
  pathJoin:path.join,readFile:p=>fileSystem.readFileSync(p)});
 if(fileSystem.existsSync(path.join(root,ATTEMPT_MARKER)))
  fail('ER1_B_ALREADY_ATTEMPTED_STOP');

 const lockPath=path.join(root,LOCK_FILE);
 const markerPath=path.join(root,ATTEMPT_MARKER);
 let lock;
 try{lock=fileSystem.openSync(lockPath,'wx')}
 catch{fail('ER1_B_LEASE_BUSY_STOP')}
 let launched=false;
 try{
  if(fileSystem.existsSync(markerPath))fail('ER1_B_ALREADY_ATTEMPTED_STOP');
  // SHA validation MUST precede any import of candidate code.
  const fixedPreflight=preflight??(async()=>{
   const mod=await import(pathToFileURL(candidatePath).href);
   await mod.preflight({manifest});
  });
  await fixedPreflight({manifest}); // Read-only source, D1 SHA, Reader gate.

  // A persisted, create-only GitHub control ledger makes one-shot global even
  // if the six registered Runner labels map to different physical machines.
  await reserveGlobal({request,issueNumber:event.issue.number,env});

  // Irrevocable one-shot marker before the first operational side effect.
  // Failure / timeout after this point requires inspection, never retry.
  fileSystem.writeFileSync(markerPath,JSON.stringify({
   requestId:request.requestId,issueNumber:event.issue.number,
   candidateSourceSha:request.candidateSourceSha,
   approvalManifestSha256:request.approvalManifestSha256,
   globalReservation:'GITHUB_CONTENTS_CREATE_ONLY_201',
   state:'EXECUTION_STARTED_NO_AUTO_RETRY',
  }),{flag:'wx'});

  launched=true;
  const result=(spawnCandidate??((script)=>spawnSync(NODE_BINARY,[script],{
   cwd:packageRoot,windowsHide:true,shell:false,timeout:360_000,
   env:sanitizedEnv(env),encoding:'utf8',maxBuffer:16_384,
  })))(candidatePath);
  // Never accept a stdout-only PASS. The candidate itself writes this report.
  const reportPath=path.join(packageRoot,'ER1_PC_OPERATION_RESULT.txt');
  let candidateText='';
  try{candidateText=fileSystem.readFileSync(reportPath,'utf8')}
  catch{return {requestId:request.requestId,status:'STATE_UNKNOWN',
   code:'ER1_B_CANDIDATE_REPORT_MISSING',d1Writes:'UNKNOWN'}}
  const checked=safeCandidateResult(candidateText,result?.status??null);
  return {requestId:request.requestId,...checked,
   d1Writes:checked.d1Writes??'UNKNOWN'};
 }catch(error){
  const reservationUnknown=coded(error)==='ER1_B_GLOBAL_RESERVATION_STATE_UNKNOWN_STOP';
  return {requestId:request.requestId,status:launched||reservationUnknown?
   'STATE_UNKNOWN':'BLOCKED',
   code:coded(error),d1Writes:launched?'UNKNOWN':0};
 }finally{
  try{fileSystem.closeSync(lock)}catch{}
  try{fileSystem.unlinkSync(lockPath)}catch{}
 }
}

export function saveResult(result,{root=HOST_ROOT,fileSystem=fs}={}){
 const report={schema:'ZGMINI_ER1_PC_B_RESULT_V1',...result,
  operationalWrites:result.status==='PASS'?result.d1Writes:
   (result.status==='BLOCKED'?0:'UNKNOWN'),
  providerCalls:0,rawEarningsExported:false};
 fileSystem.mkdirSync(root,{recursive:true});
 fileSystem.writeFileSync(path.join(root,resultFileName(result.requestId)),
  JSON.stringify(report,null,2)+'\n',{
  flag:'wx'}); // A prior result must not be overwritten.
 return report;
}

async function main(){
 let response={status:'BLOCKED',code:'ER1_B_EVENT_OR_APPROVAL_STOP',
  requestId:null,d1Writes:0};
 try{
  const eventPath=process.env.GITHUB_EVENT_PATH;
  if(!eventPath||!path.isAbsolute(eventPath))fail('ER1_B_EVENT_PATH_STOP');
  const event=JSON.parse(fs.readFileSync(eventPath,'utf8'));
  // Production CLI selects only the separately approved independent V2 lane.
  // V1 default on exported fixture helpers remains for non-operational tests.
  const {sourceRoot}=prepareCheckoutWorkspace({event,edition:V2_EDITION});
  response=await executeOnce({event,packageRoot:sourceRoot,edition:V2_EDITION});
 }catch(e){response={...response,code:coded(e)}}
 try{const report=saveResult(response);
  process.stdout.write(`STATUS=${report.status} CODE=${report.code}\n`);
  if(report.status!=='PASS')process.exitCode=1;
 }catch{process.stderr.write('ER1_B_REPORT_WRITE_BLOCKED\n');process.exitCode=1}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
