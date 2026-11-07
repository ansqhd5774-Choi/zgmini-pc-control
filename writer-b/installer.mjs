// Reusable Writer B transaction coordinator. Source-only and I/O-free.
// An independently authorized Windows B adapter must implement these exact
// bounded methods; this module is NOT a pc-job handler or remote shell.
import {assertAuthenticatedWriterBIssue,validateWriterBManifest} from './contract.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(test,code)=>{if(!test)stop(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sameKeys=(map,keys)=>object(map)&&Object.keys(map).length===keys.length&&
  keys.every(x=>Object.hasOwn(map,x));
const samePaths=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&
  actual.every(x=>expected.includes(x))&&new Set(actual).size===actual.length;
// Only these exact upstream R17 shared-lock/one-shot claim errors are allowed
// through the generic Writer B result contract. No arbitrary upstream codes
// or untrusted Error.message text may reach GitHub result evidence.
const SHARED_CLAIM_CODES=Object.freeze({
 R17_B_SHARED_INSTALL_BUSY_NOOP_STOP:'WRITER_B_SHARED_INSTALL_BUSY_NOOP_STOP',
 R17_B_REQUEST_ALREADY_CLAIMED_STOP:'WRITER_B_REQUEST_ALREADY_CLAIMED_STOP',
 R17_B_SHARED_INSTALL_LOCK_STOP:'WRITER_B_SHARED_INSTALL_LOCK_STOP',
 R17_B_SHARED_LOCK_DRIFT_STOP:'WRITER_B_SHARED_LOCK_DRIFT_STOP',
 R17_B_CLAIM_INITIALIZATION_STOP:'WRITER_B_CLAIM_INITIALIZATION_STOP',
});
function publicErrorCode(error,fallback){
 const code=error?.code;
 if(typeof code!=='string')return fallback;
 return /^WRITER_B_[A-Z0-9_]+$/.test(code)?code:
  (Object.hasOwn(SHARED_CLAIM_CODES,code)?SHARED_CLAIM_CODES[code]:fallback);
}

export function verifyWriterBPreimage(manifest,preimage){
 validateWriterBManifest(manifest);
 const changed=manifest.files.map(x=>x.path);
 const protectedPaths=manifest.protectedFiles.map(x=>x.path);
 const runtimePaths=manifest.runtimeDependencies.consumers.map(x=>x.path);
 need(object(preimage)&&preimage.sourceRoot===manifest.sourceRoot&&
   preimage.configPath===manifest.configPath&&preimage.coreTask===manifest.coreTask&&
   preimage.head===manifest.baseHead&&
   preimage.configSource===manifest.baseConfigSourceSha&&
   SHA64.test(preimage.originalConfigSha256??'')&&
   SHA64.test(preimage.originalTaskDefinitionSha256??'')&&
   typeof preimage.originalBranch==='string'&&
   /^[a-z0-9][a-z0-9._/-]{0,127}$/i.test(preimage.originalBranch)&&
   !preimage.originalBranch.includes('..')&&
   preimage.coreTaskEnabled===true&&preimage.targetPathsClean===true&&
   sameKeys(preimage.beforeSha256,changed)&&
   sameKeys(preimage.protectedSha256,protectedPaths)&&
   sameKeys(preimage.runtimeConsumerSha256,runtimePaths),
   'WRITER_B_PC_PREIMAGE_STOP');
 for(const item of manifest.files){
  const actual=preimage.beforeSha256[item.path];
  need(item.change==='A'?actual===null:actual===item.beforeSha256,
    'WRITER_B_TARGET_PREIMAGE_SHA_STOP');
 }
 for(const item of manifest.protectedFiles)
  need(preimage.protectedSha256[item.path]===item.sha256,
    'WRITER_B_PROTECTED_SHA_STOP');
 if(manifest.runtimeDependencies.taskXmlSha256!==null)
  need(preimage.originalTaskDefinitionSha256===
   manifest.runtimeDependencies.taskXmlSha256,
   'WRITER_B_TASK_APPROVED_XML_SHA_STOP');
 for(const item of manifest.runtimeDependencies.consumers)
  need(preimage.runtimeConsumerSha256[item.path]===item.sha256,
   'WRITER_B_RUNTIME_CONSUMER_SHA_STOP');
 // Unrelated dirty files are deliberately not an automatic global install gate.
 // The adapter must snapshot them and prove that the switch preserves them.
 return preimage;
}

export function verifyWriterBCandidate(manifest,candidate){
 validateWriterBManifest(manifest);
 const paths=manifest.files.map(x=>x.path);
 need(object(candidate)&&candidate.sourceSha===manifest.candidateSourceSha&&
   candidate.clean===true&&sameKeys(candidate.sha256,paths),
   'WRITER_B_CANDIDATE_SOURCE_STOP');
 for(const item of manifest.files)
  need(candidate.sha256[item.path]===
   (Object.hasOwn(item,'insertions')?item.candidateSha256:item.afterSha256),
    'WRITER_B_CANDIDATE_HASH_STOP');
 return candidate;
}

export function verifyPreparedWriterCommit(manifest,prepared){
 const paths=manifest.files.map(x=>x.path);
 need(object(prepared)&&SHA40.test(prepared.sha??'')&&
   prepared.sha!==manifest.baseHead&&prepared.parent===manifest.baseHead&&
   SHA40.test(prepared.baseTreeOid??'')&&
   SHA40.test(prepared.preparedTreeOid??'')&&
   prepared.baseTreeOid!==prepared.preparedTreeOid&&
   SHA64.test(prepared.provenanceSha256??'')&&
   prepared.mode==='LOCAL_OVERLAY'&&prepared.localOnly===true&&
   prepared.clean===true&&samePaths(prepared.changedPaths,paths)&&
   sameKeys(prepared.sha256,paths),
   'WRITER_B_PREPARED_SCOPE_STOP');
 for(const entry of manifest.files)
  need(prepared.sha256[entry.path]===entry.afterSha256,
    'WRITER_B_PREPARED_HASH_STOP');
 return prepared;
}

const REQUIRED_IO=[
 'acquireSharedWriterLock','readPcPreimage','readCandidate','claimRequest',
 'backupOriginal','prepareIsolatedCommit','pauseCore','waitForCoreDrain',
 'assertCoreQuiet','switchPreparedSource','assertWriterSource','changeConfigSource',
 'assertConfigSource','restoreCore','verifyCoreDefinitionUnchanged',
 'restoreOriginalConfig','restoreOriginalSource','verifyOriginalState',
 'releaseSharedWriterLock',
];

// Failures after a possible Core state transition are never marked harmless
// unless the exact original source/config/task state is proven restored.
export async function performWriterBInstall(auth,io){
 // No caller-supplied boolean can attest a registered B request. The future
 // Windows adapter must use the exact authorization object returned by
 // authorizeWriterBIssue after fetching the immutable approved manifest.
 assertAuthenticatedWriterBIssue(auth);
 const manifest=validateWriterBManifest(auth.manifest);
 need(object(io)&&REQUIRED_IO.every(name=>typeof io[name]==='function'),
   'WRITER_B_ADAPTER_CONTRACT_STOP');
 let acquired=false,claimed=false,taskMayHaveChanged=false;
 let sourceMayHaveChanged=false,configMayHaveChanged=false,retain=false;
 let before=null,prepared=null,result=null;
 try{
  await io.acquireSharedWriterLock(auth.requestId);acquired=true;
  before=verifyWriterBPreimage(manifest,await io.readPcPreimage(manifest));
  verifyWriterBCandidate(manifest,await io.readCandidate(manifest));
  await io.claimRequest(auth.requestId);claimed=true;
  await io.backupOriginal(before,manifest);
  prepared=verifyPreparedWriterCommit(manifest,
    await io.prepareIsolatedCommit(before,manifest));

  // Mark mutation intent before any call that may partially apply its effects.
  taskMayHaveChanged=true;
  await io.pauseCore(before);
  await io.waitForCoreDrain(before);
  await io.assertCoreQuiet();

  sourceMayHaveChanged=true;
  await io.switchPreparedSource(prepared,before);
  await io.assertWriterSource(prepared,manifest);
  configMayHaveChanged=true;
  await io.changeConfigSource(before.configSource,prepared.sha);
  await io.assertConfigSource(prepared.sha);

  await io.restoreCore(before);
  await io.verifyCoreDefinitionUnchanged(before);
  // schtasks /Enable returning zero is not proof the task actually became
  // enabled. Keep rollback eligibility until the readback proves it.
  taskMayHaveChanged=false;
  await io.assertWriterSource(prepared,manifest);
  await io.assertConfigSource(prepared.sha);
  result={status:'WRITER_B_INSTALLED_VERIFIED',sourceSha:prepared.sha,
    requestId:auth.requestId,changedPaths:manifest.files.map(x=>x.path),
    mode:'LOCAL_OVERLAY',localOnly:true,baseHead:manifest.baseHead,
    candidateSourceSha:manifest.candidateSourceSha,
    manifestSha256:auth.manifestSha256,
    baseTreeOid:prepared.baseTreeOid,
    preparedTreeOid:prepared.preparedTreeOid,
    provenanceSha256:prepared.provenanceSha256};
 }catch(error){
  const code=publicErrorCode(error,'WRITER_B_ADAPTER_UNEXPECTED_STOP');
  if(!claimed){
   result={status:'WRITER_B_PREFLIGHT_STOP',code,requestId:auth.requestId};
  }else{
   try{
    if(configMayHaveChanged||sourceMayHaveChanged){
     await io.assertCoreQuiet();
     if(configMayHaveChanged)await io.restoreOriginalConfig(before,prepared);
     if(sourceMayHaveChanged)await io.restoreOriginalSource(before,prepared);
    }
    if(taskMayHaveChanged)await io.restoreCore(before);
    await io.verifyOriginalState(before,manifest);
    result={status:'WRITER_B_INSTALL_STOP_RESTORED',code,
      requestId:auth.requestId,recovery:'ORIGINAL_VERIFIED'};
   }catch{
    retain=true;
    result={status:'WRITER_B_RECOVERY_REQUIRED',code,
      requestId:auth.requestId,recovery:'RECONCILE_EXACT_REQUEST_NO_RETRY'};
   }
  }
 }finally{
  if(acquired){
   try{await io.releaseSharedWriterLock({requestId:auth.requestId,retain});}
   catch(error){
    // A missing release confirmation is never a verified successful install.
    result={status:'WRITER_B_RECOVERY_REQUIRED',
      code:publicErrorCode(error,'WRITER_B_LOCK_FINALIZE_STOP'),requestId:auth.requestId,
      recovery:'READ_ONLY_RECONCILE_LOCK_AND_SOURCE'};
   }
  }
 }
 return result;
}

