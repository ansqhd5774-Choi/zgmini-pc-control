// #1378 isolated-clone prework ONLY: source package proof; no Git clone/fetch/sync or PC writes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const HANDOFF_TARGET='c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7';
export const HANDOFF_APPROVAL_SHA256='458bd775e2f50fef4212713f859bc601205159fe503d4cdb697786256663c4cb';
export const HANDOFF_ORIGINAL_ISSUE=1378;
export const HANDOFF_REQUEST='pc-handoff-51fbf9ee-18ae-4f66-9dd5-737b355223aa';
export const HANDOFF_PRIOR_SHA='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
export const HANDOFF_APPROVAL_REL='approvals/maintenance-handoffs/'+HANDOFF_TARGET+'.json';
export const HANDOFF_FILE_SET=Object.freeze([
 'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
 'tools/source-bundle-register.mjs','tools/bootstrap-maintenance.mjs',
 'tools/handoff-maintenance.mjs'
]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const sha64=/^[a-f0-9]{64}$/;
const sameKeys=(a,keys)=>a&&typeof a==='object'&&!Array.isArray(a)
 &&Object.keys(a).length===keys.length&&keys.every(k=>Object.hasOwn(a,k));
const isolatedCheckout=path.join(os.tmpdir(),'zgmini-watchdog-handoff-checkouts',HANDOFF_REQUEST);
const exactOrigins=Object.freeze([
 'https://github.com/ansqhd5774-Choi/zgmini-pc-control.git',
 'https://github.com/ansqhd5774-Choi/zgmini-pc-control',
 'git@github.com:ansqhd5774-Choi/zgmini-pc-control.git',
 'git@github.com:ansqhd5774-Choi/zgmini-pc-control'
]);
function blob(root,rel,io){
 const full=path.join(root,rel);
 const st=io.lstatSync(full);
 if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1)throw Error('SOURCE_ALIAS');
 const bytes=io.readFileSync(full);
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>3000000)
  throw Error('SOURCE_LENGTH');
 return bytes;
}
const defaultGit=(root,args)=>{
 const result=execFileSync('git',['--no-optional-locks',...args],
  {cwd:root,encoding:args[0]==='show'?null:'utf8',windowsHide:true,
   timeout:15000,maxBuffer:3000000,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
 return args[0]==='show'?result:String(result).trim();
};
export function classifyKnown1378(result){
 if(result?.schema!=='ZGMINI_WATCHDOG_HANDOFF_FIRSTFAIL_A_RESULT_V1'
   ||result.requestId!=='pc-watchdog-handoff-a-0b27cd23-0d35-4cf0-8bf1-d583713d9a5d'
   ||result.handoffIssueNumber!==HANDOFF_ORIGINAL_ISSUE
   ||result.code!=='WATCHDOG_HANDOFF_A_READ_ONLY'||result.operationalWrites!==0
   ||result.watchdog!=='HEALTHY_NEW_SCOPE')return 'A_EVIDENCE_NOT_APPLICABLE';
 if(result.claim!=='NOT_CLAIMED'||result.receiverSource!=='PRIOR'
   ||result.receiverState!=='LISTENING')
  return 'EXISTING_CLAIM_OR_RECEIVER_CHANGE_OWNER_RECONCILE';
 if(result.bridgeStatus==='BLOCKED'&&result.bridgeCode==='ENOENT'
   &&result.checkout==='MAIN_TARGET_NOT_ANCESTOR')
  return 'PRIORITIZE_ISOLATED_SOURCE_STAGE';
 return 'FIRST_FAIL_CHANGED_OWNER_RECONCILE';
}
// One-pass fixed-source result. Does NOT authorize an install or handoff.
export function inspectHandoff1378Source({root=isolatedCheckout,io=fs,runGit=defaultGit}={}){
 const failures=[],add=(code,rel=null)=>{
  if(!failures.some(f=>f.code===code&&f.file===rel))
   failures.push({code,...(rel?{file:rel}:{})});
 };
 let branch='UNREADABLE',targetAncestor=false,checkoutClean=false;
 try{branch=String(runGit(root,['branch','--show-current'])).trim();}
 catch{add('GIT_BRANCH_UNREADABLE');}
 if(branch!=='main')add('CHECKOUT_NOT_MAIN');
 let originVerified=false;
 try{
  const origin=String(runGit(root,['remote','get-url','origin'])).trim();
  originVerified=exactOrigins.includes(origin);
  if(!originVerified)add('ISOLATED_ORIGIN_DENIED');
 }catch{add('ISOLATED_ORIGIN_UNREADABLE');}
 try{runGit(root,['merge-base','--is-ancestor',HANDOFF_TARGET,'HEAD']);
  targetAncestor=true;
 }catch{add('TARGET_NOT_ANCESTOR');}
 try{
  const dirty=String(runGit(root,['status','--porcelain','--',
   ...HANDOFF_FILE_SET,HANDOFF_APPROVAL_REL])).trim();
  checkoutClean=dirty==='';if(!checkoutClean)add('PINNED_CHECKOUT_DIRTY');
 }catch{add('GIT_SCOPED_STATUS_UNREADABLE');}
 let approval=null,raw=null;
 try{raw=blob(root,HANDOFF_APPROVAL_REL,io);}
 catch(e){add(e?.code==='ENOENT'?'APPROVAL_FILE_MISSING':'APPROVAL_FILE_UNSAFE_OR_UNREADABLE');}
 if(raw){
  if(sha(raw)!==HANDOFF_APPROVAL_SHA256)add('APPROVAL_RAW_SHA256_DRIFT');
  try{approval=JSON.parse(raw.toString('utf8'));}
  catch{add('APPROVAL_JSON_INVALID');}
  if(approval){
   if(approval.schema!=='ZGMINI_MAINTENANCE_HANDOFF_V2'
     ||approval.transition!=='SEVEN_TO_SEVEN'||approval.approved!==true
     ||approval.installedSha!==HANDOFF_PRIOR_SHA
     ||approval.targetSha!==HANDOFF_TARGET
     ||approval.scope!=='COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'
     ||!sameKeys(approval.files,HANDOFF_FILE_SET)
     ||HANDOFF_FILE_SET.some(rel=>!sha64.test(approval.files?.[rel]??'')))
    add('APPROVAL_CONTRACT_DRIFT');
  }
 }
 let verifiedFiles=0,targetFilesVerified=0;
 for(const rel of HANDOFF_FILE_SET){
  let digest=null;
  try{digest=sha(blob(root,rel,io));}
  catch(e){add(e?.code==='ENOENT'?'PINNED_FILE_MISSING':'PINNED_FILE_UNSAFE_OR_UNREADABLE',rel);continue;}
  if(!approval||!sha64.test(approval.files?.[rel]??''))continue;
  if(digest!==approval.files[rel])add('PINNED_FILE_RAW_SHA256_DRIFT',rel);
  else verifiedFiles++;
  try{
   const atTarget=runGit(root,['show',HANDOFF_TARGET+':'+rel]);
   if(!Buffer.isBuffer(atTarget)||sha(atTarget)!==approval.files[rel])
    add('TARGET_COMMIT_BLOB_SHA256_DRIFT',rel);
   else targetFilesVerified++;
  }catch{add('TARGET_COMMIT_BLOB_UNREADABLE',rel);}
 }
 return Object.freeze({
  schema:'ZGMINI_HANDOFF_1378_SOURCE_PREFLIGHT_V1',
  originalIssueNumber:HANDOFF_ORIGINAL_ISSUE,requestId:HANDOFF_REQUEST,
  targetSha:HANDOFF_TARGET,scope:'SOURCE_ONLY_NO_RUNTIME_ATTESTATION',
  status:failures.length===0&&verifiedFiles===HANDOFF_FILE_SET.length
   &&targetFilesVerified===HANDOFF_FILE_SET.length
   ?'SOURCE_BYTES_READY_OWNER_APPROVAL_AND_RUNTIME_REQUIRED':'SOURCE_REPAIR_PREWORK_REQUIRED',
  checkoutBranch:branch,targetAncestor,checkoutClean,isolatedOriginVerified:originVerified,
  approvalVerified:!!raw&&!!approval&&!failures.some(f=>f.code.startsWith('APPROVAL_')),
  verifiedFiles,targetFilesVerified,totalFiles:HANDOFF_FILE_SET.length,failures,operationalWrites:0,
  receiverProcessChanged:false,controllerInstalled:false,handoffClaimCreated:false
 });
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const result=inspectHandoff1378Source();
 console.log(JSON.stringify(result));
 if(result.status!=='SOURCE_BYTES_READY_OWNER_APPROVAL_AND_RUNTIME_REQUIRED')
  process.exitCode=2;
}
