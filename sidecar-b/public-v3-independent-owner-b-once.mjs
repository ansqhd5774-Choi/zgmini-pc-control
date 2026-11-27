#!/usr/bin/env node
// W06 V3 Public independent Windows operator: SOURCE CANDIDATE ONLY.
// No B effect is authorized until an explicit owner-merged exact-effect
// approval PR is independently pinned in a reviewed subsequent source change.
// Never runs in GitHub Actions or any Runner descendant. Does not alter the
// existing Private-only Sidecar B admission/Workflow or Controller.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
// Local preflight is dynamically imported only AFTER its source CAS check.

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='E:/ZGmini/projects/zgmini-pc-control';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const ENTRY='sidecar-b/public-v3-independent-owner-b-once.mjs';
const APPROVAL='approvals/sidecar-b/w06-cnn-v2-to-v3-20261128.json';
// Keep the gate disabled until owner independently approves the exact
// one-file effect (candidate SHA, current CAS, backup/rollback, zero D1/DB/Task
// changes) and a separate reviewed PR pins that approval's merge commit.
const APPROVAL_PR=0;
const APPROVAL_MERGE=null;
const FIXED={
 schema:'ZGMINI_CNN_SIDECAR_ONEFILE_B_V3',
 target:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\archive-run.mjs',
 beforeSha256:'eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b',
 afterSha256:'894411dea16462c4ee305f7ec80102d81662063f5f76c8a8384f04977e860ac3',
 approvedSourceSha:'42ab63b28e0c2617486a7b7dba550101960e5cf7',
 installedHead:'c8ed53a3991212dd1778742cda8a86ac133e0796',
 taskDefinitionSha256:'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
 wrapperSha256:'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c'
};
const CANDIDATE='sidecar-b/approved/archive-run-w06-v3.mjs';
const SOURCES=[ENTRY,'sidecar-b/windows-file-adapter.mjs',
 'sidecar-b/natural-idle-window.mjs','r17-writer-b/r17-b-claim.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(x,code)=>{if(!x)stop(code);};
const hex40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);

const out=(status,code,extra={})=>({
 schema:'ZGMINI_W06_V3_PUBLIC_OWNER_B_ONCE_V1',status,code,
 exactTarget:FIXED.target,effectAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0,
 ...extra
});

// Pure effect boundary: an approved manifest alone never verifies local
// ancestry, current CAS, free lease or gives this code automatic authority.
export function classifyW06PublicBEffect(e) {
 if(e?.approvedMergePinned!==true)
  return out('BLOCKED','W06_PUBLIC_B_EFFECT_NOT_APPROVED');
 if(e?.ownerApprovalVerified!==true)
  return out('BLOCKED','W06_PUBLIC_B_OWNER_APPROVAL_UNVERIFIED');
 if(e?.trustedMainSource!==true)
  return out('BLOCKED','W06_PUBLIC_B_SOURCE_UNVERIFIED');
 if(e?.candidateBytesVerified!==true)
  return out('BLOCKED','W06_PUBLIC_B_CANDIDATE_UNVERIFIED');
 const m=e?.manifest;
 if(!m||m.schema!==FIXED.schema||m.status!=='APPROVED_B'||
    m.target!==FIXED.target||m.beforeSha256!==FIXED.beforeSha256||
    m.afterSha256!==FIXED.afterSha256||
    m.approvedContentSha256!==FIXED.afterSha256||
    m.approvedSourceSha!==FIXED.approvedSourceSha||
    m.installedHead!==FIXED.installedHead||
    m.installedConfigSource!==FIXED.installedHead||
    m.taskDefinitionSha256!==FIXED.taskDefinitionSha256||
    m.wrapperSha256!==FIXED.wrapperSha256||
    !hex40(m.installedHead)||m.runCount!==1||
    !['allowProviderCalls','allowDbChanges','allowD1Writes',
      'allowTaskChanges'].every(k=>m[k]===false))
  return out('BLOCKED','W06_PUBLIC_B_EFFECT_SCOPE_MISMATCH');
 if(e?.independentWindowsOwner!==true)
  return out('BLOCKED','W06_PUBLIC_B_INDEPENDENT_OWNER_UNVERIFIED');
 if(e?.liveCasValidated!==true)
  return out('STATE_UNKNOWN','W06_PUBLIC_B_LIVE_CAS_UNVERIFIED');
 return out('READY','W06_PUBLIC_B_EFFECT_PREFLIGHT_READY_ONLY');
}

const api=route=>JSON.parse(execFileSync(GH,['api',route],{
 encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:500000
}));
function readRemote(relative,revision) {
 const obj=api('repos/'+REPO+'/contents/'+relative+'?ref='+revision);
 need(obj?.type==='file'&&obj?.encoding==='base64'&&
  typeof obj?.content==='string',
  'W06_PUBLIC_B_REMOTE_SOURCE_UNAVAILABLE');
 return Buffer.from(obj.content,'base64');
}
function readLocal(relative) {
 const file=path.join(ROOT,...relative.split('/')),st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
  st.size>0&&st.size<262144,'W06_PUBLIC_B_LOCAL_SOURCE_TYPE_STOP');
 need(path.win32.normalize(fs.realpathSync.native(file)).toLowerCase()===
  path.win32.normalize(file).toLowerCase(),
  'W06_PUBLIC_B_LOCAL_SOURCE_REDIRECT_STOP');
 return fs.readFileSync(file);
}
function verifyNewDependencyClosure() {
 // The imported read-only checker validates its own 7-file transitive closure
 // and trusted owner/Explorer ancestry before this is called.
 for(const relative of SOURCES)
  need(sha(readLocal(relative))===sha(readRemote(relative,'main')),
   'W06_PUBLIC_B_SOURCE_DRIFT_STOP');
}

// Preserve the distinction between a pre-replacement rejection, a verified
// rollback and an unknown result after the atomic replacement was attempted.
// This is a report classification only; it grants no new execution authority.
export function classifyW06BTerminalFailure({
 errorCode,replacementAttempted=false,rollbackVerified=false,
 leaseReleaseFailed=false
}={}) {
 // A failed lease release must not be described as a clean BLOCKED or
 // ROLLED_BACK result even if the original bytes were restored.
 if(leaseReleaseFailed===true)
  return out('RECOVERY_REQUIRED','W06_PUBLIC_B_LEASE_OUTCOME_UNVERIFIED',{
   operationalWrites:replacementAttempted===true?null:0,
   changedFileCount:null,requiresOwnerReconcile:true
  });
 if(replacementAttempted===true&&rollbackVerified===true&&
    errorCode!=='SIDECAR_B_RECOVERY_UNVERIFIED_STOP')
  return out('ROLLED_BACK','W06_PUBLIC_B_ROLLBACK_VERIFIED',{
   operationalWrites:null,changedFileCount:0,rollbackVerified:true
  });
 if(replacementAttempted===true)
  return out('RECOVERY_REQUIRED','W06_PUBLIC_B_EFFECT_OUTCOME_UNVERIFIED',{
   operationalWrites:null,changedFileCount:null,requiresOwnerReconcile:true
  });
 const code=/^W06_PUBLIC_B_[A-Z0-9_]{2,80}$/.test(errorCode??'')?
  errorCode:'W06_PUBLIC_B_UNVERIFIED_STOP';
 return out('BLOCKED',code);
}

// Separates an owner-merged source PR from explicit approval of these
// exact effect bytes. A PR merge alone is never B execution consent.
export function matchesExactW06OwnerEffectComment(comment,expected,mergedAt) {
 const posted=Date.parse(comment?.created_at??''),merged=Date.parse(mergedAt??'');
 return comment?.user?.id===327938088&&
  typeof comment?.body==='string'&&comment.body.trim()===expected&&
  Number.isFinite(posted)&&Number.isFinite(merged)&&posted>=merged;
}
function verifyFixedOwnerApproval() {
 need(Number.isSafeInteger(APPROVAL_PR)&&APPROVAL_PR>0&&
  hex40(APPROVAL_MERGE),
  'W06_PUBLIC_B_EFFECT_APPROVAL_REQUIRED');
 const pr=api('repos/'+REPO+'/pulls/'+APPROVAL_PR);
 need(pr?.number===APPROVAL_PR&&pr?.merged===true&&
  pr?.merge_commit_sha===APPROVAL_MERGE&&
  pr?.user?.id===327938088&&pr?.head?.repo?.full_name===REPO&&
  pr?.base?.ref==='main'&&pr?.base?.repo?.full_name===REPO,
  'W06_PUBLIC_B_OWNER_APPROVAL_UNVERIFIED');
 const comparison=api('repos/'+REPO+'/compare/'+APPROVAL_MERGE+'...main');
 need(comparison?.behind_by===0&&
  comparison?.merge_base_commit?.sha===APPROVAL_MERGE,
  'W06_PUBLIC_B_APPROVAL_ANCESTRY_STOP');
 const merged=readRemote(APPROVAL,APPROVAL_MERGE),
  current=readRemote(APPROVAL,'main');
 need(merged.equals(current),'W06_PUBLIC_B_APPROVAL_BYTES_CHANGED_STOP');
 const consent='ZGMINI_W06_V3_B_EFFECT_APPROVED_V1 '+
  'manifestSha256='+sha(merged)+' '+
  'beforeSha256='+FIXED.beforeSha256+' '+
  'afterSha256='+FIXED.afterSha256+' '+
  'oneFile=true provider=false db=false d1=false task=false';
 const comments=api('repos/'+REPO+'/issues/'+APPROVAL_PR+'/comments?per_page=100');
 need(Array.isArray(comments)&&comments.some(c=>
  matchesExactW06OwnerEffectComment(c,consent,pr.merged_at)),
  'W06_PUBLIC_B_EXPLICIT_OWNER_EFFECT_CONSENT_STOP');
 const manifest=JSON.parse(current.toString('utf8'));
 const scope=classifyW06PublicBEffect({
  approvedMergePinned:true,ownerApprovalVerified:true,
  trustedMainSource:true,candidateBytesVerified:true,
  independentWindowsOwner:true,liveCasValidated:true,manifest
 });
 need(scope.status==='READY','W06_PUBLIC_B_MANIFEST_SCOPE_STOP');
 return manifest;
}
function candidate() {
 const approved=readRemote(CANDIDATE,FIXED.approvedSourceSha);
 const onMain=readRemote(CANDIDATE,'main');
 need(approved.equals(onMain)&&sha(approved)===FIXED.afterSha256,
  'W06_PUBLIC_B_CANDIDATE_BYTES_CHANGED_STOP');
 return approved;
}
export async function main(args=process.argv.slice(2)) {
 need(args.length===1&&(args[0]==='inspect'||args[0]==='apply'),
  'W06_PUBLIC_B_ARGS_STOP');
 need(path.win32.normalize(path.resolve(fileURLToPath(import.meta.url))).toLowerCase()===
  path.win32.normalize(path.resolve(ROOT,ENTRY)).toLowerCase(),
  'W06_PUBLIC_B_OPERATOR_PATH_STOP');
 // Before evaluating a local dependent module, verify both the operator
 // source and its first imported preflight against authenticated Public main.
 // The preflight then checks its own transitive closure before OS probes.
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME&&!process.env.GITHUB_RUN_ID,
  'W06_PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED');
 const preflightSource='sidecar-b/public-v3-independent-preimage-readonly.mjs';
 for(const relative of [ENTRY,preflightSource])
  need(sha(readLocal(relative))===sha(readRemote(relative,'main')),
   'W06_PUBLIC_B_SOURCE_DRIFT_STOP');
 const {main:inspectIndependent}=
  await import('./public-v3-independent-preimage-readonly.mjs');
 // The verified preflight independently proves owner Explorer ancestry,
 // reviewed source lineage, current real-PC CAS and its 7 trusted modules.
 const current=await inspectIndependent();
 need(current?.status==='PASS'||(
  current?.status==='DEFERRED'&&
  current.code==='W06_V3_NATURAL_CORE_ACTIVE'),
  'W06_PUBLIC_B_CURRENT_PREIMAGE_STOP');
 verifyNewDependencyClosure();
 const manifest=verifyFixedOwnerApproval(); // intentionally never passes yet
 const verifiedCandidate=candidate();
 const {validateManifest,verifyCandidateBytes,applyOneFile,TARGET,sha256}=
  await import('./contract.mjs');
 const {createWindowsSidecarIO}=
  await import('./windows-file-adapter.mjs');
 const {createOperatingSidecarProbe}=await import('./operating-probe.mjs');
 const {awaitNaturalSidecarIdle}=await import('./natural-idle-window.mjs');
 validateManifest(manifest);
 verifyCandidateBytes(manifest,verifiedCandidate);
 const ready=classifyW06PublicBEffect({
  approvedMergePinned:true,ownerApprovalVerified:true,trustedMainSource:true,
  candidateBytesVerified:true,independentWindowsOwner:true,
  liveCasValidated:true,manifest
 });
 need(ready.status==='READY','W06_PUBLIC_B_PREFLIGHT_STOP');
 if(args[0]==='inspect')return out('PASS','W06_PUBLIC_B_OWNER_PREFLIGHT_ONLY');
 // Direct operator action only; no scheduled/Issue/Runner dispatch. Recheck
 // idle and full protected CAS under the existing shared Writer install lock.
 await awaitNaturalSidecarIdle();
 const observeProtected=createOperatingSidecarProbe({
  manifest,requestId:manifest.requestId,sourceApproved:true
 });
 const io=createWindowsSidecarIO({
  requestId:manifest.requestId,observeProtected
 });
 const tx={replacementAttempted:false,rollbackVerified:false,
  verifiedReadback:false,leaseReleaseFailed:false};
 const trackedIO={...io,
  async atomicReplace(...args) {
   tx.replacementAttempted=true;
   return io.atomicReplace(...args);
  },
  // The existing applyOneFile verifies these bytes WHILE IT HOLDS THE LEASE.
  // Do not read TARGET again after its finally block releases that lease.
  async readbackSha256(...args) {
   const observed=await io.readbackSha256(...args);
   if(tx.replacementAttempted&&observed===FIXED.afterSha256)
    tx.verifiedReadback=true;
   return observed;
  },
  async restoreBackup(...args) {
   const restored=await io.restoreBackup(...args);
   tx.rollbackVerified=true;
   return restored;
  },
  async release(...args) {
   try{return await io.release(...args);}
   catch(error){tx.leaseReleaseFailed=true;throw error;}
  }
 };
 try {
  const installed=await applyOneFile(manifest,verifiedCandidate,trackedIO);
  need(installed.status==='APPLIED_SOURCE_ONLY'&&
   installed.afterSha256===FIXED.afterSha256&&
   tx.verifiedReadback===true,
   'W06_PUBLIC_B_PROTECTED_READBACK_UNVERIFIED');
  return out('PASS','W06_PUBLIC_B_V3_ONE_FILE_INSTALLED_VERIFIED',{
   effectAuthorized:true,operationalWrites:1,
   beforeSha256:FIXED.beforeSha256,afterSha256:FIXED.afterSha256,
   changedFileCount:1,requestId:manifest.requestId
  });
 }catch(error) {
  const classified=classifyW06BTerminalFailure({
   errorCode:error?.code,
   replacementAttempted:tx.replacementAttempted,
   rollbackVerified:tx.rollbackVerified,
   leaseReleaseFailed:tx.leaseReleaseFailed
  });
  throw Object.assign(new Error(classified.code),{
   code:classified.code,terminalReport:classified
  });
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try{console.log(JSON.stringify(await main()));}
 catch(error){
  const result=error?.terminalReport??
   classifyW06BTerminalFailure({errorCode:error?.code});
  console.log(JSON.stringify(result));
  process.exitCode=2;
 }
}
