#!/usr/bin/env node
// #3409: exact, operator-only first source delivery and one-shot recovery.
// The independent Windows user must launch this outside GitHub Actions/Runner.
// No Controller/Writer overwrite, no DB/D1/provider I/O, no lease deletion.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const FIXED=Object.freeze({
 repository:'ansqhd5774-Choi/zgmini-pc-control',
 root:'E:/ZGmini/projects/zgmini-pc-control',
 maintenance:'E:/ZGmini/automation/pc-maintenance',
 node:'E:/ZGmini/runtime/node.exe',
 gh:'C:/Program Files/GitHub CLI/gh.exe',
 release:'b80eccfe05f2d94528c3b0fba6353373ff41762e',
 approvedSource:'23d04ff8e4687b46e93aa7dd80cca58520816fed',
 original:'pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0',
 controller:'6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4',
 bootstrap:'E:/ZGmini/automation/pc-maintenance/recovery-source/w04-3409-bootstrap',
 staged:'E:/ZGmini/automation/pc-maintenance/recovery-source/w04-3409',
 approval:'approvals/maintenance-recoveries/pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0.post-writer.json'
});
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const normalized=p=>String(p??'').replaceAll('\\','/').replace(/\/+$/,'').toLowerCase();
const reportPath=env=>path.join(env.TEMP??'', 'ZGMINI_W04_3409_RECOVERY_ONCE_V1.txt');
const lease=FIXED.maintenance+'/leases/controller-install';
const outputDir=FIXED.maintenance+'/recovery';
const safeCode=e=>/^[A-Z][A-Z0-9_]{1,79}$/.test(e?.code??'')?e.code:'OPERATOR_OUTCOME_UNVERIFIED';

export function assertOperatorScope({platform=process.platform,env=process.env}={}){
 need(platform==='win32'&&!env.GITHUB_ACTIONS&&!env.RUNNER_NAME,
   'OPERATOR_INTERACTIVE_WINDOWS_REQUIRED');
 need(typeof env.TEMP==='string'&&path.win32.isAbsolute(env.TEMP),
   'OPERATOR_TEMP_UNAVAILABLE');
 return true;
}
export function assertOrigin(origin){
 need(/^(?:https:\/\/github\.com\/|git@github\.com:)ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?$/.test(origin),
  'OPERATOR_GIT_ORIGIN_MISMATCH');
 return true;
}
export function validateSourceReceipt(r){
 need(r?.status==='SOURCE_PREPARED_ONLY'&&
   r.code==='EXACT_RELEASE_WORKTREE_CAS_VERIFIED'&&
   r.requestId===FIXED.original&&r.sourceSha===FIXED.approvedSource&&
   /^[a-f0-9]{40}$/.test(r.stagedHead??'')&&
   r.recoveryExecuted===false&&r.controllerWrites===0&&r.leaseWrites===0,
   'OPERATOR_SOURCE_PREP_RESULT_INVALID');
 return true;
}
export function validateRecoveryResult(r,approved){
 need(approved?.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V2'&&
   approved.approved===true&&approved.sourceSha===FIXED.approvedSource&&
   approved.requestId===FIXED.original&&
   approved.targetControllerSha===FIXED.controller,
   'OPERATOR_APPROVAL_SCOPE_INVALID');
 const expected=approved.casDigests;
 need(expected&&Object.keys(expected).length===7&&
   r?.status==='RECOVERED_INSTALLED_STATE'&&
   r.code==='INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN'&&
   r.requestId===FIXED.original&&r.sourceSha===FIXED.approvedSource&&
   r.installedSha===FIXED.controller&&r.leaseArchived===true&&
   r.historicalPostcheck==='OUTCOME_UNKNOWN'&&r.historicalLedgerPreserved===true&&
   r.originalRequestRetried===false&&r.controllerChanged===false&&
   r.writerChanged===false&&r.workflowChanged===false&&r.dbD1Writes===0&&
   r.casDigests&&Object.keys(r.casDigests).length===7&&
   Object.keys(expected).every(k=>expected[k]===r.casDigests[k]),
   'OPERATOR_RECOVERY_RESULT_UNVERIFIED');
 return true;
}
const readStrict=(file,max=131072)=>{
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size>0&&st.size<=max,
  'OPERATOR_FILE_UNSAFE');
 return fs.readFileSync(file);
};
const runExe=(bin,args,{timeout=60000,maxBuffer=8_000_000}={})=>{
 try{
  return execFileSync(bin,args,{encoding:null,windowsHide:true,shell:false,timeout,maxBuffer,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
 }catch(error){
  // Existing tools return bounded JSON error codes; never print raw child output.
  for(const raw of [error?.stdout,error?.stderr]){
   try{
    const receipt=JSON.parse(String(raw??'').trim());
    if(/^[A-Z][A-Z0-9_]{1,79}$/.test(receipt?.code??''))error.code=receipt.code;
   }catch{/* Opaque failures remain unverified; no automatic retry. */}
  }
  throw error;
 }
};
const git=(args)=>runExe('git',['--no-optional-locks','-C',FIXED.root,...args]);
const show=(rev,rel)=>git(['show',rev+':'+rel]);

function verifyInstalledOperator(){
 const manifest=JSON.parse(readStrict(FIXED.maintenance+'/MAINTENANCE_INSTALL.json',32768));
 need(manifest.schema==='ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&
   manifest.files&&typeof manifest.files==='object'&&!Array.isArray(manifest.files)&&
   Object.keys(manifest.files).length>=6&&Object.keys(manifest.files).length<=9,
   'OPERATOR_INSTALLED_MAINTENANCE_INVALID');
 need(Object.keys(manifest.files).includes('tools/maintenance-ancestry.vbs')&&
   Object.keys(manifest.files).includes('tools/update.mjs'),
   'OPERATOR_OPERATOR_PROOF_NOT_INSTALLED');
 for(const [rel,expected] of Object.entries(manifest.files)){
  need(/^tools\/[a-z0-9.-]+$/.test(rel)&&/^[a-f0-9]{64}$/.test(expected)&&
    sha(readStrict(path.join(FIXED.maintenance,rel)))===expected,
    'OPERATOR_MAINTENANCE_SELF_DRIFT');
 }
 const whoami=String(runExe('C:/Windows/System32/whoami.exe',['/groups'],
  {timeout:12000,maxBuffer:65536}));
 need(whoami.includes('S-1-16-8192')&&!whoami.includes('S-1-16-12288'),
   'OPERATOR_MEDIUM_INTEGRITY_REQUIRED');
 const verified=String(runExe('cscript.exe',['//NoLogo',
   path.join(FIXED.maintenance,'tools/maintenance-ancestry.vbs'),
   'OPERATOR',String(process.pid),'0'],{timeout:12000,maxBuffer:4096})).trim();
 need(verified==='INDEPENDENT_OPERATOR','OPERATOR_WINDOWS_ORIGIN_UNVERIFIED');
}
function verifyGitCheckout(){
 const root=git(['rev-parse','--show-toplevel']).toString().trim();
 need(normalized(root)===normalized(FIXED.root),'OPERATOR_GIT_ROOT_MISMATCH');
 assertOrigin(git(['remote','get-url','origin']).toString().trim());
 const customHooks=(()=>{
  try{return git(['config','--get','core.hooksPath']).toString().trim();}
  catch(e){if(e?.status===1)return '';fail('OPERATOR_GIT_HOOKS_UNVERIFIED');}
 })();
 need(!customHooks,'OPERATOR_GIT_CUSTOM_HOOKS_FORBIDDEN');
 const hookRoot=git(['rev-parse','--git-path','hooks']).toString().trim();
 const dir=path.isAbsolute(hookRoot)?hookRoot:path.resolve(FIXED.root,hookRoot);
 if(fs.existsSync(dir)){
  need(fs.lstatSync(dir).isDirectory(),'OPERATOR_GIT_HOOKS_UNVERIFIED');
  need(fs.readdirSync(dir).every(n=>n.endsWith('.sample')),
    'OPERATOR_GIT_ACTIVE_HOOKS_FORBIDDEN');
 }
 const head=git(['rev-parse','HEAD']).toString().trim();
 need(/^[a-f0-9]{40}$/.test(head),'OPERATOR_HEAD_UNVERIFIED');
 return head;
}
function parseOutput(buf,code){
 let r;try{r=JSON.parse(String(buf).trim());}catch{fail(code);}
 return r;
}
function verifyArchive(result,approval){
 need(!fs.existsSync(lease),'OPERATOR_ORIGINAL_LEASE_NOT_ARCHIVED');
 const files=fs.readdirSync(outputDir).filter(n=>
  n.startsWith(FIXED.original+'-installed-')&&n.endsWith('.complete.json'));
 need(files.length===1,'OPERATOR_RECOVERY_COMPLETION_NOT_UNIQUE');
 const name=files[0],stem=name.slice(0,-'.complete.json'.length);
 const stored=JSON.parse(readStrict(path.join(outputDir,name),32768));
 validateRecoveryResult(stored,approval);
 need(JSON.stringify(stored)===JSON.stringify(result),'OPERATOR_RECOVERY_READBACK_DIFFERENT');
 const dir=path.join(outputDir,stem+'.lease');
 const stat=fs.lstatSync(dir);
 need(stat.isDirectory()&&!stat.isSymbolicLink(),'OPERATOR_ARCHIVE_DIRECTORY_UNVERIFIED');
 need(sha(readStrict(path.join(dir,'owner.json'),4096))===approval.casDigests.ownerSha256&&
   sha(readStrict(path.join(dir,'RECOVERY_REQUIRED.json'),4096))===approval.casDigests.markerSha256,
   'OPERATOR_ARCHIVE_BYTES_MISMATCH');
 return true;
}
function append(file,lines){
 fs.appendFileSync(file,lines.join('\n')+'\n',{encoding:'utf8'});
}
function uploadOnce(file){
 if(!fs.existsSync(FIXED.gh))return 'GH_UNAVAILABLE_LOCAL_RECEIPT_PRESERVED';
 try{
  runExe(FIXED.gh,['issue','comment','3409','--repo',FIXED.repository,
    '--body-file',file],{timeout:30000,maxBuffer:10240});
  return 'COMMENT_SUBMITTED_VERIFY_REMOTELY';
 }catch{return 'COMMENT_OUTCOME_UNKNOWN_NO_RETRY';}
}
export async function runOnce({platform=process.platform,env=process.env}={}){
 assertOperatorScope({platform,env});
 need(fs.existsSync(FIXED.node)&&fs.existsSync(FIXED.root)&&fs.existsSync(lease),
  'OPERATOR_REQUIRED_HOST_OR_LEASE_ABSENT');
 need(!fs.existsSync(FIXED.bootstrap)&&!fs.existsSync(FIXED.staged),
  'OPERATOR_PREVIOUS_SOURCE_STAGE_RECONCILE_FIRST');
 verifyInstalledOperator();
 const oldHead=verifyGitCheckout();
 const report=reportPath(env);
 need(!fs.existsSync(report),'OPERATOR_PREVIOUS_ATTEMPT_RECONCILE_FIRST');
 fs.writeFileSync(report,[
  '<!-- W04_3409_INDEPENDENT_OPERATOR_ONCE_V1 -->',
  'SCHEMA=ZGMINI_W04_3409_OPERATOR_ONCE_V1',
  'ORIGINAL_ISSUE=3409',
  'REQUEST_ID='+FIXED.original,
  'APPROVED_SOURCE='+FIXED.approvedSource,
  'RELEASE='+FIXED.release,
  'CHECKOUT_BEFORE='+oldHead,
  'OPERATOR_ORIGIN=INDEPENDENT_VERIFIED',
  'PHASE=SOURCE_DELIVERY_STARTED',
  'CONTROLLER_WRITES_BY_PACKET=0',
  'WRITER_WRITES_BY_PACKET=0'].join('\n')+'\n',{flag:'wx',mode:0o600});
 let outcome='BLOCKED';
 try{
  // Source first delivery only: no checkout/reset of the operating worktree.
  git(['fetch','--no-tags','origin','main']);
  need(git(['rev-parse','HEAD']).toString().trim()===oldHead,
    'OPERATOR_ORIGINAL_HEAD_MOVED');
  git(['merge-base','--is-ancestor',FIXED.release,'refs/remotes/origin/main']);
  git(['merge-base','--is-ancestor',FIXED.approvedSource,FIXED.release]);
  const bootstrapParent=path.dirname(FIXED.bootstrap);
  const maintStat=fs.lstatSync(FIXED.maintenance);
  need(maintStat.isDirectory()&&!maintStat.isSymbolicLink(),
    'OPERATOR_MAINTENANCE_ROOT_UNSAFE');
  if(!fs.existsSync(bootstrapParent))fs.mkdirSync(bootstrapParent);
  const parentStat=fs.lstatSync(bootstrapParent);
  need(parentStat.isDirectory()&&!parentStat.isSymbolicLink(),
    'OPERATOR_BOOTSTRAP_PARENT_UNSAFE');
  git(['worktree','add','--detach',FIXED.bootstrap,FIXED.release]);
  need(git(['-C',FIXED.bootstrap,'rev-parse','HEAD']).toString().trim()===FIXED.release,
    'OPERATOR_BOOTSTRAP_SOURCE_UNVERIFIED');
  const prep='tools/w04-3409-independent-source-prep.mjs';
  need(sha(readStrict(path.join(FIXED.bootstrap,prep)))===sha(show(FIXED.release,prep)),
    'OPERATOR_BOOTSTRAP_FILE_DRIFT');
  // Reuse the already-reviewed V2 approval, CAS and four-file validators,
  // but stage the immutable approved release rather than a moving origin/main.
  const module=await import(pathToFileURL(path.join(FIXED.bootstrap,prep)).href);
  module.assertIndependentOperator();
  const original='approvals/maintenance-recoveries/'+FIXED.original+'.installed.json';
  const originalRaw=show(FIXED.release,original);
  need(sha(originalRaw)==='e9707741bb4a39cc933b2cb8b5e04ec27242992aa7d974d0fb1af89d21fd9005',
    'OPERATOR_ORIGINAL_V1_APPROVAL_DRIFT');
  const pinnedRaw=show(FIXED.release,FIXED.approval);
  const approval=JSON.parse(pinnedRaw);
  const oldApproval=JSON.parse(originalRaw);
  module.validateApproval(approval);
  need(Object.keys(oldApproval.casDigests??{}).length===7&&
   Object.keys(oldApproval.casDigests).filter(k=>k!=='writerSha256')
    .every(k=>approval.casDigests[k]===oldApproval.casDigests[k])&&
   approval.casDigests.writerSha256!==oldApproval.casDigests.writerSha256,
   'OPERATOR_ORIGINAL_SIX_CAS_CHANGED');
  module.verifyCas(approval);
  git(['worktree','add','--detach',FIXED.staged,FIXED.release]);
  need(git(['-C',FIXED.staged,'rev-parse','HEAD']).toString().trim()===FIXED.release,
    'OPERATOR_STAGED_HEAD_UNVERIFIED');
  need(sha(readStrict(path.join(FIXED.staged,FIXED.approval),32768))===sha(pinnedRaw),
    'OPERATOR_STAGED_APPROVAL_CHANGED');
  module.verifyStagedFiles(approval,git);
  module.verifyCas(approval);
  const prepared={status:'SOURCE_PREPARED_ONLY',
   code:'EXACT_RELEASE_WORKTREE_CAS_VERIFIED',requestId:FIXED.original,
   sourceSha:FIXED.approvedSource,stagedHead:FIXED.release,
   controllerWrites:0,leaseWrites:0,recoveryExecuted:false};
  validateSourceReceipt(prepared);
  append(report,['PHASE=SOURCE_PREPARED_ONLY','STAGED_HEAD='+prepared.stagedHead]);
  const stagedSha=git(['-C',FIXED.staged,'rev-parse','HEAD']).toString().trim();
  need(stagedSha===prepared.stagedHead,'OPERATOR_STAGED_HEAD_CHANGED');
  append(report,['PHASE=RECOVERY_INVOCATION_STARTED','RECOVERY_ATTEMPTS=1']);
  // Only the already-approved independent operator may execute this B effect.
  const result=parseOutput(runExe(FIXED.node,[
    path.join(FIXED.staged,'tools/maintenance-recovery.mjs'),
    'reconcile-installed','--request-id',FIXED.original,
    '--source-sha',FIXED.approvedSource
   ],{timeout:240000,maxBuffer:32768}),'OPERATOR_RECOVERY_OUTPUT_INVALID');
  validateRecoveryResult(result,approval);
  verifyArchive(result,approval);
  append(report,[
   'STATUS=RECOVERED_INSTALLED_STATE',
   'CODE=INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
   'CONTROLLER_SHA='+FIXED.controller,
   'ORIGINAL_LEASE_ARCHIVED=true',
   'ARCHIVE_BYTES_READBACK=PASS',
   'RECOVERY_RESULT_RECORD_VERIFIED=true',
   'HISTORICAL_POSTCHECK=OUTCOME_UNKNOWN',
   'ORIGINAL_REQUEST_RETRIED=false',
   'DB_D1_WRITES=0']);
  outcome='RECOVERED_INSTALLED_STATE';
 }catch(error){
  append(report,['STATUS=BLOCKED_OR_OUTCOME_UNKNOWN','CODE='+safeCode(error),
   'NEXT=INSPECT_EXISTING_STAGES_LEASE_CLAIM_AND_COMPLETION_BEFORE_ANY_RETRY']);
  outcome='BLOCKED_OR_OUTCOME_UNKNOWN';
 }
 const upload=uploadOnce(report);
 append(report,['ISSUE_REPORT='+upload]);
 return {status:outcome,code:outcome==='RECOVERED_INSTALLED_STATE'
  ?'OPERATOR_ARCHIVE_READBACK_VERIFIED':'OPERATOR_NO_AUTOMATIC_RETRY',
  reportPath:report,issueReport:upload};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 if(process.argv.length!==3||process.argv[2]!=='--once'){
  process.stdout.write('OPERATOR_USAGE_INVALID\n');process.exitCode=2;
 }else{
  runOnce().then(r=>{process.stdout.write(JSON.stringify(r)+'\n');
    if(r.status!=='RECOVERED_INSTALLED_STATE')process.exitCode=2;
  }).catch(e=>{process.stdout.write(JSON.stringify({status:'BLOCKED',
    code:safeCode(e),recoveryAttempted:false})+'\n');process.exitCode=2;});
 }
}
