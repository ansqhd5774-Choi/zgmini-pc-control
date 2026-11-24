#!/usr/bin/env node
// W04 #3409: source-only preparation by the existing independent Windows operator.
// Never executes recovery, installs a Controller, or releases an install lease.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const REQUEST_ID='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
export const SOURCE_SHA='fcb098d20fb9a6c48f371786c69f7f1fdf5bc34a';
export const REPO='E:/ZGmini/projects/zgmini-pc-control';
export const MAINT='E:/ZGmini/automation/pc-maintenance';
export const CONTROL='E:/ZGmini/automation/pc-control';
export const STAGE=MAINT+'/recovery-source/w04-3409';
export const APPROVAL='approvals/maintenance-recoveries/'+REQUEST_ID+'.installed.json';
const TARGET='6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=(value,code)=>{if(!value)fail(code);};
const paths={
 ledger:MAINT+'/ledger/'+REQUEST_ID+'.json',
 owner:MAINT+'/leases/controller-install/owner.json',
 marker:MAINT+'/leases/controller-install/RECOVERY_REQUIRED.json',
 backlog:MAINT+'/backlog/'+REQUEST_ID+'.json',
 snapshot:CONTROL+'/backups/controller-update-'+REQUEST_ID+'/snapshot/host.json',
 protection:CONTROL+'/backups/controller-update-'+REQUEST_ID+'/PROTECTED_BEFORE.json',
 writer:'E:/ZGmini/data/pc-writer/config.json'
};
const max={ledger:131072,owner:4096,marker:4096,backlog:131072,snapshot:65536,protection:65536,writer:131072};
export function validateApproval(approval) {
 check(approval?.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1' &&
  approval.approved===true && approval.requestId===REQUEST_ID &&
  approval.issueNumber===3409 && approval.operation==='RECONCILE_INSTALLED' &&
  approval.sourceSha===SOURCE_SHA && approval.targetControllerSha===TARGET,
  'PREP_APPROVAL_IDENTITY_MISMATCH');
 check(approval.casDigests&&Object.keys(approval.casDigests).length===7 &&
  Object.keys(paths).every(k=>/^[a-f0-9]{64}$/.test(approval.casDigests[k+'Sha256']??'')) &&
  approval.approvedCurrentWriterConfigSha256===approval.casDigests.writerSha256,
  'PREP_CAS_CONTRACT_INVALID');
 check(Array.isArray(approval.files)&&approval.files.length===4 &&
  ['tools/maintenance-recovery.mjs','tools/update.mjs','tools/maintenance-contract.mjs',
   'controller/fixed-readonly-bytes.mjs'].every(p=>
     approval.files.filter(f=>f.path===p&&/^[a-f0-9]{64}$/.test(f.sha256??'')).length===1),
   'PREP_FILE_CONTRACT_INVALID');
 return true;
}
export function verifyCas(approval,read=fs.readFileSync,stat=fs.lstatSync) {
 validateApproval(approval);
 for(const [name,file] of Object.entries(paths)) {
  let s,b;
  try { s=stat(file); check(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max[name],
    'PREP_'+name.toUpperCase()+'_UNSAFE'); b=read(file); }
  catch(e) { fail(e?.code?.startsWith('PREP_')?e.code:'PREP_'+name.toUpperCase()+'_UNAVAILABLE'); }
  check(sha(b)===approval.casDigests[name+'Sha256'],'PREP_'+name.toUpperCase()+'_CAS_CHANGED');
 }
 return true;
}
export function verifyStagedFiles(approval,git,read=fs.readFileSync) {
 for(const f of approval.files) {
  const source=git(['show',SOURCE_SHA+':'+f.path]);
  check(sha(source)===f.sha256,'PREP_SOURCE_PIN_DRIFT');
  check(sha(read(path.join(STAGE,f.path)))===f.sha256,'PREP_STAGED_FILE_DRIFT');
 }
 return true;
}
export function run({git,read=fs.readFileSync,stat=fs.lstatSync,exists=fs.existsSync,mkdir=fs.mkdirSync}={}) {
 check(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,
  'PREP_INDEPENDENT_WINDOWS_ONLY');
 check(!exists(STAGE),'PREP_STAGE_ALREADY_EXISTS');
 check(exists(MAINT+'/leases/controller-install'),'PREP_ORIGINAL_LEASE_MISSING');
 const g=git??(args=>execFileSync('git',['-C',REPO,'--no-optional-locks',...args],
  {windowsHide:true,timeout:60000,maxBuffer:8_000_000,env:{...process.env,
   GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}));
 const origin=g(['remote','get-url','origin']).toString().trim();
 check(/^(?:https:\/\/github\.com\/|git@github\.com:)ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?$/.test(origin),
  'PREP_REPO_ORIGIN_MISMATCH');
 const approval=JSON.parse(g(['show',SOURCE_SHA+':'+APPROVAL]).toString());
 validateApproval(approval);
 verifyCas(approval,read,stat);
 // A fetch is only permitted after the old approved object is available.
 // This never moves the active checkout HEAD or any Controller/runtime file.
 const oldHead=g(['rev-parse','HEAD']).toString().trim();
 check(/^[a-f0-9]{40}$/.test(oldHead),'PREP_HEAD_INVALID');
 g(['fetch','--no-tags','origin','main']);
 g(['merge-base','--is-ancestor',SOURCE_SHA,'refs/remotes/origin/main']);
 check(g(['rev-parse','HEAD']).toString().trim()===oldHead,'PREP_HEAD_MOVED');
 verifyCas(approval,read,stat);
 check(!exists(STAGE),'PREP_STAGE_ALREADY_EXISTS');
 mkdir(path.dirname(STAGE),{recursive:true});
 g(['worktree','add','--detach',STAGE,SOURCE_SHA]);
 check(g(['-C',STAGE,'rev-parse','HEAD']).toString().trim()===SOURCE_SHA,
  'PREP_STAGED_HEAD_MISMATCH');
 verifyStagedFiles(approval,g,read);
 verifyCas(approval,read,stat);
 return {status:'SOURCE_PREPARED_ONLY',code:'PINNED_ISOLATED_WORKTREE_VERIFIED',
  requestId:REQUEST_ID,sourceSha:SOURCE_SHA,controllerWrites:0,leaseWrites:0,
  recoveryExecuted:false,next:'INDEPENDENT_OPERATOR_RECONCILE_INSTALLED_WITH_FRESH_CAS'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
 try {
  check(process.argv.length===3&&process.argv[2]==='--prepare','PREP_USAGE');
  process.stdout.write(JSON.stringify(run())+'\n');
 }catch(e){process.stderr.write(JSON.stringify({status:'BLOCKED',
  code:/^PREP_[A-Z0-9_]+$/.test(e?.code??'')?e.code:'PREP_UNVERIFIED'})+'\n');process.exitCode=1;}
}
