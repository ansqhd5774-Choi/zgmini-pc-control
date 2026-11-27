#!/usr/bin/env node
// Draft exact, one-shot independent Windows owner entry for proposed PR #4303.
// No execution until explicit effect approval and immutable merge SHA pin.
// Public maintenance Issue polling remains B-denied. This is a C/operator-run
// source path, not a GitHub Actions/Runner job and not a general B dispatcher.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
// No local static imports: origin/CAS checks MUST precede module evaluation.

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const CHECKOUT='E:/ZGmini/projects/zgmini-pc-control';
const CONTROL='E:/ZGmini/automation/pc-control';
const MAINT='E:/ZGmini/automation/pc-maintenance';
const TARGET='f03febc06f32a553676622ecf049e7dd90e2b7d5';
const INSTALLED='cde1dd372210e4658ae348cb9e2577967cb11634';
const APPROVAL_MERGE=null; // Must be pinned after separate owner approval.
const SOURCE_PR=4303;
const GH='C:/Program Files/GitHub CLI/gh.exe';
const PATHS=Object.freeze([
 'controller/operations.mjs'
]);
const SOURCE=Object.freeze([
 'tools/controller-audit-sha-repair-public-b-operator-once.mjs','tools/update.mjs',
 'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'
]);
const claimPath=path.join(MAINT,'operator-public-b-'+TARGET+'.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const api=(route,{method='GET',data}={})=>{
 const args=['api',route];
 if(method!=='GET')args.push('--method',method,'--input','-');
 const raw=execFileSync(GH,args,{windowsHide:true,encoding:'utf8',
  timeout:60000,maxBuffer:3000000,...(data?{input:JSON.stringify(data)}:{})});
 return JSON.parse(raw);
};
const readRevision=(p,revision)=>{
 const f=api('repos/'+REPO+'/contents/'+p+'?ref='+revision);
 need(f?.type==='file'&&f?.encoding==='base64'&&typeof f.content==='string',
  'PUBLIC_B_MAIN_SOURCE_MISSING');
 return Buffer.from(f.content,'base64');
};
const readMain=p=>readRevision(p,'main');
const isRegular=p=>{
 const st=fs.lstatSync(p);
 return st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size>0&&st.size<=3000000;
};
const exactPaths=items=>Array.isArray(items)&&
 JSON.stringify(items.map(x=>x.path).sort())===JSON.stringify([...PATHS].sort());
export function classifyPublicBPreflight(input){
 if(input?.owner!==true)return 'PUBLIC_B_OWNER_UNVERIFIED';
 if(input?.operator!==true)return 'PUBLIC_B_INDEPENDENT_OPERATOR_UNVERIFIED';
 if(input?.source!==true)return 'PUBLIC_B_SOURCE_DRIFT';
 if(input?.manifest!==true)return 'PUBLIC_B_APPROVAL_UNVERIFIED';
 if(input?.installed!==true)return 'PUBLIC_B_INSTALLED_CAS_UNVERIFIED';
 if(input?.leaseFree!==true)return 'PUBLIC_B_INSTALL_LEASE_BUSY';
 if(input?.previousAttempt!==false)return 'PUBLIC_B_PREVIOUS_ATTEMPT_RECONCILE';
 return 'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY';
}
// Verify every statically imported local module, including transitive imports,
// before evaluating ANY local module. Tests inject trusted bytes with no PC I/O.
export function verifyOperatorSourceClosure(readLocal,readTrusted){
 const sources={};
 for(const rel of SOURCE){
  const local=readLocal(rel),trusted=readTrusted(rel);
  need(Buffer.isBuffer(local)&&Buffer.isBuffer(trusted)&&
   sha(local)===sha(trusted),'PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED');
  sources[rel]=local.toString('utf8');
 }
 const expected=new Set(SOURCE);
 for(const [rel,code] of Object.entries(sources)){
  const specifiers=code.matchAll(/\b(?:from\s+|import\s+)(['"])([^'"]+)\1/g);
  for(const item of specifiers){
   const spec=item[2];
   if(spec.startsWith('node:'))continue;
   need(spec.startsWith('./')||spec.startsWith('../'),
    'PUBLIC_B_OPERATOR_IMPORT_NOT_PINNED');
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec));
   need(expected.has(resolved),'PUBLIC_B_OPERATOR_IMPORT_NOT_PINNED');
  }
 }
 return true;
}
export async function withPublicBInstallLease(lock,run){
 let safe=false;
 try{
  const result=await run();
  safe=(result?.status==='PASS'&&result.actualInstalledSha===TARGET&&
    result.postcheck?.protectedStateUnchanged===true&&
    result.postcheck?.runnerSetVerified===true&&
    result.postcheck?.postSourceVerified===true)||
   (result?.status==='BLOCKED'&&result.actualInstalledSha===INSTALLED&&
    result.workflowEnabled===true)||
   (result?.status==='ROLLED_BACK'&&result.actualInstalledSha===INSTALLED&&
    result.workflowEnabled===true&&result.protectedStateUnchanged===true);
  return result;
 }finally{
  // Throws in persist(), switch, rollback, postcheck or the final claim
  // writer may have an unknown effect: hold the owned lease, never release it.
  if(safe)lock.release();
  else lock.holdForRecovery();
 }
}
async function sourceAndOwner(){
 need(process.platform==='win32'&&os.hostname().toUpperCase()==='PC'&&
  !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&!process.env.GITHUB_RUN_ID,
  'PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED');
 need(path.resolve(fileURLToPath(import.meta.url)).toLowerCase()===
  path.resolve(CHECKOUT,SOURCE[0]).toLowerCase(),
  'PUBLIC_B_OPERATOR_ENTRY_PATH_DRIFT');
 const user=api('user'),repo=api('repos/'+REPO);
 need(user?.login==='ansqhd5774-Choi'&&user?.id===327938088&&
  repo?.id===1442936296&&repo?.owner?.id===327938088&&
  repo?.full_name===REPO&&repo?.private===false,
  'PUBLIC_B_GITHUB_OWNER_OR_REPOSITORY_UNVERIFIED');
 need(/^[a-f0-9]{40}$/.test(APPROVAL_MERGE??''),
  'PUBLIC_B_APPROVAL_NOT_PINNED');
 const pr=api('repos/'+REPO+'/pulls/4303');
 need(pr?.merged===true&&pr?.merge_commit_sha===APPROVAL_MERGE,
  'PUBLIC_B_APPROVAL_NOT_MERGED');
 const chain=api('repos/'+REPO+'/compare/'+APPROVAL_MERGE+'...main');
 need(chain?.behind_by===0&&chain?.merge_base_commit?.sha===APPROVAL_MERGE,
  'PUBLIC_B_APPROVAL_NOT_ON_MAIN');
 // Never trust a moving main as executable source authority. Bind every
 // runtime dependency to the *merged* reviewed source PR and check main still
 // serves those immutable bytes, even if unrelated main commits advance.
 const sourcePr=api('repos/'+REPO+'/pulls/'+SOURCE_PR);
 need(SOURCE_PR>0&&sourcePr?.number===SOURCE_PR&&sourcePr?.merged===true&&
  sourcePr?.user?.id===327938088&&
  sourcePr?.base?.ref==='main'&&sourcePr?.base?.repo?.full_name===REPO&&
  sourcePr?.head?.repo?.full_name===REPO&&
  /^[a-f0-9]{40}$/.test(sourcePr?.merge_commit_sha??''),
  'PUBLIC_B_OPERATOR_SOURCE_PR_NOT_MERGED');
 const sourceMerge=sourcePr.merge_commit_sha;
 const sourceLineage=api('repos/'+REPO+'/compare/'+sourceMerge+'...main');
 need(sourceLineage?.behind_by===0&&
  sourceLineage?.merge_base_commit?.sha===sourceMerge,
  'PUBLIC_B_OPERATOR_SOURCE_PR_NOT_ON_MAIN');
 verifyOperatorSourceClosure(rel=>{
  const local=path.join(CHECKOUT,rel);
  need(isRegular(local)&&fs.realpathSync(local).toLowerCase()===
    path.resolve(local).toLowerCase(),'PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED');
  return fs.readFileSync(local);
 },rel=>{
  const approved=readRevision(rel,sourceMerge);
  need(approved.equals(readMain(rel)),'PUBLIC_B_OPERATOR_MAIN_SOURCE_DRIFT');
  return approved;
 });
 // All local static imports are now verified against authenticated main bytes.
 const [contract,updater,apply,lock]=await Promise.all([
  import('./maintenance-contract.mjs'),import('./update.mjs'),
  import('./maintenance-apply.mjs'),import('./maintenance-lock.mjs')]);
 // Preinstalled checker rejects Runner/Worker ancestry and requires an
 // independent same-user Explorer chain before any operational request.
 updater.verifyRecoveryOperator();
 return {...contract,...updater,...apply,...lock};
}
function approvedManifest(deps){
 const manifestPath='approvals/controller-updates/'+TARGET+'.json';
 const bytes=readMain(manifestPath),manifest=JSON.parse(bytes.toString('utf8'));
 const pin=JSON.parse(readMain('approvals/controller-selective-targets/'+TARGET+'.json').toString('utf8'));
 need(manifest.installedSha===INSTALLED&&manifest.targetSha===TARGET&&
  manifest.purpose==='pc-controller-maintenance'&&
  manifest.controllerOnlyInstall===true&&exactPaths(manifest.allowFiles)&&
  manifest.approval?.ref==='https://github.com/'+REPO+'/pull/4303'&&
  manifest.approval?.grade==='B'&&manifest.postOperation==='core-status'&&
  pin.targetSha===TARGET&&pin.installedSha===INSTALLED,
  'PUBLIC_B_APPROVAL_SCOPE_INVALID');
 need(manifest.checks?.manifestSha256===deps.manifestFingerprint(manifest.allowFiles).sha256,
  'PUBLIC_B_APPROVED_FILE_FINGERPRINT_MISMATCH');
 deps.validateControllerSelectivePin(manifest,pin);
 return {bytes,manifest};
}
function installedCas(deps){
 const hostPath=path.join(CONTROL,'host.json');
 need(isRegular(hostPath),'PUBLIC_B_HOST_MANIFEST_UNVERIFIED');
 const host=JSON.parse(fs.readFileSync(hostPath,'utf8'));
 need(host.controllerSourceSha===INSTALLED&&deps.prevalidationInventory(host)!==null,
  'PUBLIC_B_INSTALLED_CONTROLLER_NOT_PINNED');
 for(const [rel,digest] of Object.entries(host.controllerFiles)){
  need(/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel),
   'PUBLIC_B_HOST_FILE_PATH_INVALID');
  const filename=path.join(CONTROL,rel);
  need(isRegular(filename)&&sha(fs.readFileSync(filename))===digest,
   'PUBLIC_B_INSTALLED_FILE_CAS_MISMATCH');
 }
 need(deps.INSTALLABLE_FILES.every(rel=>typeof host.controllerFiles[rel]==='string'),
  'PUBLIC_B_INSTALLED_FILES_INCOMPLETE');
 return true;
}
async function preflight(){
 const deps=await sourceAndOwner();
 const approved=approvedManifest(deps);
 installedCas(deps);
 const lease=deps.maintenanceLockStatus(MAINT,'controller-install');
 need(lease?.held===false,'PUBLIC_B_INSTALL_LEASE_NOT_FREE');
 need(!fs.existsSync(claimPath),'PUBLIC_B_PREVIOUS_ATTEMPT_RECONCILE');
 const data={actor:'ansqhd5774-Choi',manifest:approved.manifest,
  issue:{operation:'controller-update',controlRepository:REPO,targetControllerSha:TARGET}};
 deps.validatePublicOwnerBExactScope(data);
 return {approved,deps};
}
function durableClaim(data){
 // The unique claim is never deleted. Failed or unknown execution is reconciled
 // from the existing controller-install ledger, not restarted with a new Issue.
 need(isRegular(path.join(MAINT,'MAINTENANCE_INSTALL.json')),
  'PUBLIC_B_MAINTAINER_MANIFEST_UNAVAILABLE');
 const before={schema:'ZGMINI_PUBLIC_B_OPERATOR_ONCE_V1',targetSha:TARGET,
  requestId:data.requestId,phase:'ISSUE_SUBMISSION_ATTEMPTED',
  createdAt:new Date().toISOString(),issueNumber:null};
 fs.writeFileSync(claimPath,JSON.stringify(before)+'\n',{flag:'wx',mode:0o600});
}
function record(data){
 const tmp=claimPath+'.next';
 fs.writeFileSync(tmp,JSON.stringify(data)+'\n',{flag:'wx',mode:0o600});
 fs.renameSync(tmp,claimPath);
}
export async function main(args=process.argv.slice(2)){
 need(args.length===1&&['inspect','apply'].includes(args[0]),
  'PUBLIC_B_OPERATOR_ARGS_INVALID');
 const {approved,deps}=await preflight();
 const {prepareControllerUpdateRequest,validateUpdateRequest,
  validatePublicOwnerBExactScope,makePorts,acquireMaintenanceLock,
  applyApprovedUpdate}=deps;
 if(args[0]==='inspect')return {status:'PASS',code:'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY',
  targetSha:TARGET,operationalWrites:0,issueCreated:false,installed:false};
 // Only explicit interactive 'apply', after source, Owner, WMI, approved bytes,
 // installed files and free lease all matched, may create the original Issue.
 const request=prepareControllerUpdateRequest(approved.bytes,{installedSha:INSTALLED});
 const checked=validateUpdateRequest(request,approved.bytes,{actor:'ansqhd5774-Choi',
  installedSha:INSTALLED});
 const data={actor:'ansqhd5774-Choi',issue:request,manifest:checked.manifest,
  manifestRawBase64:approved.bytes.toString('base64')};
 validatePublicOwnerBExactScope(data);
 durableClaim(request);
 let number=null;
 try{
  const issue=api('repos/'+REPO+'/issues',{method:'POST',
   data:{title:'pc-controller-update',body:JSON.stringify(request),labels:['pc-maintenance']}});
  number=issue?.number;
  need(Number.isSafeInteger(number)&&number>0&&issue?.user?.id===327938088,
   'PUBLIC_B_OWNER_ISSUE_CREATION_UNVERIFIED');
  record({schema:'ZGMINI_PUBLIC_B_OPERATOR_ONCE_V1',targetSha:TARGET,
   requestId:request.requestId,phase:'OWNER_ISSUE_CREATED',
   createdAt:new Date().toISOString(),issueNumber:number});
  // Revalidate the exact owner Issue and WMI origin inside updater ports,
  // once under the controller-install lease, and again before Supervisor stop.
  const {request:job,ports}=makePorts(data,number,{publicOwnerBOperator:true});
  await ports.capturePrevalidationBaseline();
  const lock=acquireMaintenanceLock(MAINT,'controller-install');
  return await withPublicBInstallLease(lock,async()=>{
   const result=await applyApprovedUpdate(job,ports);
   record({schema:'ZGMINI_PUBLIC_B_OPERATOR_ONCE_V1',targetSha:TARGET,
    requestId:job.requestId,issueNumber:number,phase:'FINAL_RESULT',
    status:result.status,code:result.code,actualInstalledSha:result.actualInstalledSha??null});
   return {...result,requestId:job.requestId,issueNumber:number};
  });
 }catch(error){
  // A GitHub POST or updater outcome may already have taken effect. No retry.
  return {status:'STATE_UNKNOWN',code:'PUBLIC_B_OPERATOR_RECONCILE_NO_RETRY',
   requestId:request.requestId,issueNumber:number,
   errorCode:/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'UNVERIFIED'};
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main()));}
 catch(e){console.log(JSON.stringify({status:'BLOCKED',
  code:/^[A-Z][A-Z0-9_]{1,79}$/.test(e?.code??'')?e.code:'PUBLIC_B_PREFLIGHT_FAILED',
  operationalWrites:0}));process.exitCode=2;}
}
