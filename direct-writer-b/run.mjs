#!/usr/bin/env node
// Candidate independent Windows Writer B lane. No installed maintainer needed.
// Runtime intentionally BLOCKS until the fixed, reviewed native bridge exists.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {BEA_B_MODE,runBeaNativeSourceOnce}
  from './bea-native-source-once.mjs';
import {dispatchConfiguredRuntimeB}
  from '../writer-b/approved-versioned-bundle/configured-runtime-b-dispatcher.mjs';

// Approval authentication and pinned source checks live in an independent
// module. Re-export for existing callers; the fixed receiver never imports
// this CLI entry point while it is evaluating top-level await.
import {loadApprovedRaw,verifyPinnedSourceCheckout,DIRECT_B_RESULT}
  from './approval-contract.mjs';
export {CONFIGURED_B_SCHEMA,CONFIGURED_B_SCOPE,isApprovedConfiguredRuntime,
  DIRECT_B_TITLE,DIRECT_B_OPERATION,DIRECT_B_REQUEST_SCHEMA,
  verifyOpenedOwnerIssue,approvalPathFor,authorizeApprovedRaw,
  loadApprovedRaw,verifyPinnedSourceCheckout,DIRECT_B_RESULT}
  from './approval-contract.mjs';
const CONFIGURED_B_EFFECT='CONFIGURED_THEMES_REPEAT_UPGRADE';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};

export async function applyApprovedOnce(auth,{makeApprovedNativeAdapter=null,
  pinRunner=null,bundleRunner=null,
  configuredRunner=dispatchConfiguredRuntimeB,
  beaRunner=runBeaNativeSourceOnce,beaCandidateRoot=null}={}){
  // The installed configured-theme runtime has its own reviewed, recoverable
  // preflight -> one-shot -> repeat-upgrade engine. Do not wrap it in the
  // incompatible generic bundle CAS transaction.
  if(auth.mode===CONFIGURED_B_EFFECT){
    const outcome=await configuredRunner({requestId:auth.request.requestId,
      sourceSha:auth.manifest.sourceSha,
      approvalSha256:sha(auth.raw),
      packageManifestSha256:auth.manifest.packageManifestSha256,
      runtimePreimage:auth.manifest.runtimePreimage});
    const verified=outcome?.status==='DONE'&&
      outcome.sourceSha===auth.manifest.sourceSha&&
      outcome.verified==='PC_RUNTIME_SOURCE_TASK_MANUAL_ACTIVE_ROLLBACK';
    // Preserve a sanitized first-fail in the immutable result pair so an
    // operator can distinguish proof-pending from a failed Windows install.
    const configuredReason=/^B_[A-Z0-9_]{3,80}$/.test(outcome?.reason??'')?
      'DIRECT_'+outcome.reason:null;
    const compatibilityProof=/^[a-f0-9]{64}$/.test(
      outcome?.compatibilityEvidenceSha256??'')&&
      outcome.compatibilityDirections===2&&
      outcome.compatibilitySharedLockVerified===true?{
        compatibilityEvidenceSha256:outcome.compatibilityEvidenceSha256,
        compatibilityDirections:2,
        compatibilitySharedLockVerified:true}:{};
    return {status:verified?'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED':
      ['STATE_UNKNOWN','PASS'].includes(outcome?.status)?'DIRECT_B_EFFECT_UNKNOWN':
      'DIRECT_B_EFFECT_BLOCKED',
      code:verified?'DIRECT_B_LOCAL_EFFECT_PASS':
        configuredReason??(outcome?.status==='STATE_UNKNOWN'?
          'DIRECT_B_STATE_UNKNOWN':'DIRECT_B_EFFECT_STOP'),
      requestId:auth.request.requestId,manifestSha256:sha(auth.raw),
      controlSha:auth.controlSha,sourceSha:auth.manifest.sourceSha,
      mode:auth.mode,reportStatus:'INCOMPLETE',operationSucceeded:verified,
      ...compatibilityProof};
  }
  if(auth.mode===BEA_B_MODE){
    const outcome=await beaRunner(auth,{candidateRoot:beaCandidateRoot});
    const ok=outcome?.status==='PASS'&&outcome.providerRequests===1&&
      /^[a-f0-9]{64}$/.test(outcome.sourceVersion??'')&&
      /^[a-f0-9]{64}$/.test(outcome.sourceHttpSha256??'')&&
      Number.isSafeInteger(outcome.sourceStoredAt)&&
      /^20\d{2}-(?:03-31|06-30|09-30|12-31)$/.test(outcome.observedThrough??'');
    return {status:ok?'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED':
      outcome?.status==='STATE_UNKNOWN'?'DIRECT_B_EFFECT_UNKNOWN':
      'DIRECT_B_EFFECT_BLOCKED',
      code:ok?'DIRECT_B_LOCAL_EFFECT_PASS':
        outcome?.code??'DIRECT_B_BEA_ARCHIVE_READBACK_STOP',
      requestId:auth.request.requestId,manifestSha256:sha(auth.raw),
      controlSha:auth.controlSha,sourceSha:auth.manifest.sourceSha,
      mode:BEA_B_MODE,reportStatus:'INCOMPLETE',operationSucceeded:ok,
      ...(ok?{sourceVersion:outcome.sourceVersion,
        sourceHttpSha256:outcome.sourceHttpSha256,
        sourceStoredAt:outcome.sourceStoredAt,
        observedThrough:outcome.observedThrough}:{} )};
  }
  // No default OS adapter: using an uninstalled B source must not grant effects.
  need(typeof makeApprovedNativeAdapter==='function',
    'DIRECT_B_NATIVE_BRIDGE_NOT_INSTALLED');
  const capability=await makeApprovedNativeAdapter({auth});
  need(capability?.originVerified===true&&
    capability?.effect===auth.mode&&capability?.sourceSha===auth.manifest.sourceSha&&
    typeof capability.adapter==='object',
    'DIRECT_B_NATIVE_BRIDGE_UNVERIFIED');
  let outcome;
  if(auth.mode==='PIN_REGISTRY_CAS'){
    const selected=pinRunner??(await import(
      '../writer-b/approved-versioned-bundle/approved-registry-cas.mjs'))
      .runApprovedRegistryCas;
    outcome=await selected({approvalRaw:auth.raw,
      pinnedApproval:{requestId:auth.request.requestId,
        profileId:auth.manifest.profileId,sourceSha:auth.manifest.sourceSha,
        rawApprovalSha256:sha(auth.raw)},adapter:capability.adapter});
  }else{
    need(capability.trustedProfiles!==undefined,'DIRECT_B_REGISTRY_PIN_NOT_INSTALLED');
    const selected=bundleRunner??(await import(
      '../writer-b/approved-versioned-bundle/versioned-bundle-transaction.mjs'))
      .runVersionedBundleTransaction;
    outcome=await selected({rawManifest:auth.raw,
      pinnedApproval:{requestId:auth.request.requestId,
        rawManifestSha256:sha(auth.raw),approvalRef:auth.approvalPath,
        sourceSha:auth.manifest.sourceSha,profileId:auth.manifest.profileId},
      trustedProfiles:capability.trustedProfiles,adapter:capability.adapter});
  }
  // A local effect may have applied, but its JSON/TXT ledger may be incomplete.
  // Preserve UNKNOWN; do not claim success or automatically retry.
  const ledgerComplete=outcome?.status==='PASS'&&
    outcome?.endToEndDone===true&&outcome?.reportStatus==='JSON_TXT_2_OF_2';
  const ledgerIncomplete=outcome?.status==='PASS'&&!ledgerComplete;
  return {status:ledgerComplete?'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED':
    outcome?.status==='STATE_UNKNOWN'||ledgerIncomplete?
      'DIRECT_B_EFFECT_UNKNOWN':'DIRECT_B_EFFECT_BLOCKED',
    code:ledgerIncomplete?'DIRECT_B_LEDGER_INCOMPLETE':
      outcome?.status==='STATE_UNKNOWN'?'DIRECT_B_STATE_UNKNOWN':
      ledgerComplete?'DIRECT_B_LOCAL_EFFECT_PASS':'DIRECT_B_EFFECT_STOP',
    requestId:auth.request.requestId,manifestSha256:sha(auth.raw),
    controlSha:auth.controlSha,sourceSha:auth.manifest.sourceSha,
    mode:auth.mode,reportStatus:outcome?.reportStatus??'INCOMPLETE',
    operationSucceeded:ledgerComplete};
}

async function main(){
  need(process.platform==='win32','DIRECT_B_WINDOWS_REQUIRED');
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const controlRoot=path.join(env.GITHUB_WORKSPACE??'','generic-b-control');
  const auth=loadApprovedRaw({event,env,controlRoot});
  // The sole native factory is code in the fixed reviewed checkout. Issue body
  // cannot select modules, paths, commands, targets or bridge capabilities.
  const fixedBridge=new URL('./native-adapter.mjs',import.meta.url);
  if(auth.mode===BEA_B_MODE){
    const candidateRoot=path.join(env.GITHUB_WORKSPACE??'',
      'configured-feature-source');
    verifyPinnedSourceCheckout(auth,{sourceRoot:candidateRoot});
    return applyApprovedOnce(auth,{beaCandidateRoot:candidateRoot});
  }
  if(auth.mode===CONFIGURED_B_EFFECT){
    verifyPinnedSourceCheckout(auth,{sourceRoot:path.join(
      env.GITHUB_WORKSPACE??'','configured-feature-source')});
    return applyApprovedOnce(auth);
  }
  // PIN/BUNDLE are not installed by this configured-only checkout workflow.
  // Report the true missing native bridge, without pretending a candidate
  // checkout was attempted. If installed later, require that exact SHA too.
  if(!fs.existsSync(fileURLToPath(fixedBridge)))return applyApprovedOnce(auth);
  verifyPinnedSourceCheckout(auth,{sourceRoot:path.join(
    env.GITHUB_WORKSPACE??'','generic-b-approved-source')});
  const native=await import(fixedBridge.href);
  need(typeof native.makeApprovedNativeAdapter==='function',
    'DIRECT_B_NATIVE_BRIDGE_INCOMPLETE');
  return applyApprovedOnce(auth,{
    makeApprovedNativeAdapter:native.makeApprovedNativeAdapter});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let result;
  try{result=await main();}catch(error){
    result={status:'DIRECT_B_PREFLIGHT_STOP',
      code:/^DIRECT_B_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
        error.code:'DIRECT_B_UNEXPECTED_STOP',requestId:null};
  }
  try{
    need(typeof process.env.RUNNER_TEMP==='string'&&
      path.isAbsolute(process.env.RUNNER_TEMP),'DIRECT_B_TEMP_STOP');
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP,DIRECT_B_RESULT),
      JSON.stringify(result)+'\n',{flag:'wx'});
  }catch{process.exitCode=1;}
  process.stdout.write(`${result.status} ${result.code}\n`);
  if(result.status!=='DIRECT_B_EFFECT_PASS_NOT_PUBLISHED')process.exitCode=1;
}
