// Standalone, local Windows verification of the #917 follow-up Writer source.
// This never authorizes a C-grade recovery, starts a Core task, mutates a lease,
// posts to GitHub or exports the private Writer configuration bytes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {INCIDENT, WRITER_FOLLOWUP_CANDIDATE, WRITER_TRANSITION}
  from './controller-postswitch-approval.mjs';
import {analyzeWriterFollowupSourceCandidate,
  inspectWriterFollowupProtectionCandidate}
  from './controller-postswitch-evidence.mjs';

export const WRITER_CONFIG_PATH='E:/ZGmini/data/pc-writer/config.json';
export const PROTECTED_BASELINE_PATH=`E:/ZGmini/automation/pc-control/backups/controller-update-${INCIDENT.requestId}/PROTECTED_BEFORE.json`;
const GH='C:/Program Files/GitHub CLI/gh.exe';
const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
const repoRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceClosure=Object.freeze([
  'tools/controller-postswitch-writer-readonly.mjs',
  'tools/controller-postswitch-approval.mjs',
  'tools/controller-postswitch-evidence.mjs',
  'tools/update.mjs',
  'tools/maintenance-apply.mjs',
  'tools/maintenance-contract.mjs',
  'tools/maintenance-lock.mjs',
  'tools/source-bundle-register.mjs',
]);
const expectedSources=[WRITER_TRANSITION.priorApprovedSourceSha,
  ...WRITER_FOLLOWUP_CANDIDATE.sourceSequence].reverse();
const fail=code=>({schema:'ZGMINI_CONTROLLER_917_WRITER_LOCAL_READONLY_V1',
  status:'READONLY_SOURCE_CANDIDATE_UNVERIFIED',code,
  operationalWrites:0,cApprovalAuthorized:false,liveCoreSourceVerified:false});

/** Reject a different checkout, uncommitted local edits or substituted imports. */
export function verifyLocalWriterSourcePin(source){
  if(typeof source!=='string' || !/^[a-f0-9]{40}$/.test(source))return false;
  const git=args=>execFileSync('git',args,{cwd:repoRoot,windowsHide:true,
    timeout:30000,maxBuffer:8e6});
  try {
    if(git(['rev-parse','HEAD']).toString('utf8').trim()!==source)return false;
    const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
    return sourceClosure.every(file=>sha256(fs.readFileSync(path.join(repoRoot,file)))===
      sha256(git(['show',`${source}:${file}`])));
  }catch{return false;}
}

/** Read only the fixed local file, then emit a narrowly allowlisted digest report. */
export function inspectLocalWriterSourceOnly({
  readConfigRaw=fs.readFileSync,
  analyze=analyzeWriterFollowupSourceCandidate,
}={}) {
  if(typeof readConfigRaw!=='function' || typeof analyze!=='function')
    return fail('WRITER_SOURCE_ONLY_INSPECTION_PORT_INVALID');
  let analysis;
  try {
    const raw=readConfigRaw(WRITER_CONFIG_PATH);
    if(!Buffer.isBuffer(raw))return fail('WRITER_SOURCE_ONLY_RAW_NOT_BUFFER');
    analysis=analyze(raw);
  } catch {
    // Never return an exception message, which could contain private paths
    // or contents of config.json.
    return fail('WRITER_SOURCE_ONLY_LOCAL_READ_FAILED');
  }
  if(analysis?.status!=='SOURCE_ONLY_CHAIN_CANDIDATE_VERIFIED' ||
      analysis.code!=='WRITER_CHAIN_PINNED_ENDPOINTS_MATCH' ||
      analysis.cApprovalAuthorized!==false ||
      analysis.liveCoreSourceVerified!==false ||
      analysis.intermediate4ecIndependentlyObserved!==false ||
      !Array.isArray(analysis.stages) ||
      analysis.stages.length!==expectedSources.length ||
      analysis.stages.some((stage,index)=>
        stage?.sourceSha!==expectedSources[index] ||
        typeof stage.configSha256!=='string' ||
        !/^[a-f0-9]{64}$/.test(stage.configSha256) ||
        stage.evidenceLevel!==(index===3 ? 'DERIVED_ONLY' :
          'PINNED_DIGEST_MATCH')))
    return fail('WRITER_SOURCE_ONLY_PINNED_BYTES_UNVERIFIED');
  return {
    schema:'ZGMINI_CONTROLLER_917_WRITER_LOCAL_READONLY_V1',
    status:'READONLY_SOURCE_CANDIDATE_VERIFIED',
    code:'WRITER_SOURCE_ONLY_PINNED_BYTES_MATCH',
    // No raw JSON, source object values or exception text are returned.
    digestStages:analysis.stages.map(stage=>({
      sourceSha:stage.sourceSha,configSha256:stage.configSha256,
      evidenceLevel:stage.evidenceLevel,
    })),
    intermediate4ecIndependentlyObserved:false,
    remoteBReceiptsVerifiedHere:false,
    operationalWrites:0,cApprovalAuthorized:false,liveCoreSourceVerified:false,
    next:'INDEPENDENT_LIVE_CORE_AND_EXACT_C_GRADE_APPROVAL_STILL_REQUIRED',
  };
}

const blobDigest=raw=>createHash('sha1')
  .update(Buffer.from(`blob ${raw.length}\0`,'utf8')).update(raw).digest('hex');

function fetchPinnedResult(pathName){
  const row=JSON.parse(execFileSync(GH,['api',`repos/${CONTROL_REPO}/contents/${pathName}`],
    {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4e6}));
  if(row?.type!=='file' || row.path!==pathName || row.encoding!=='base64' ||
      typeof row.content!=='string' || !/^[a-f0-9]{40}$/.test(row.sha))
    throw new Error('WRITER_READONLY_REMOTE_BLOB_UNAVAILABLE');
  return {path:pathName,blobSha:row.sha,
    raw:Buffer.from(row.content.replace(/\s/g,''),'base64')};
}

/** This A proves the post-B config digest; it never proves a live Core process. */
export function verifyWriterFollowupAReadOnlyReceipt(row){
  const expected=WRITER_FOLLOWUP_CANDIDATE.aObservations.atDeReadOnly;
  if(!Buffer.isBuffer(row?.raw) || row.path!==expected.path ||
      row.blobSha!==expected.blobSha || blobDigest(row.raw)!==expected.blobSha)
    return false;
  try {
    const rawText=row.raw.toString('utf8');
    if(!Buffer.from(rawText,'utf8').equals(row.raw))return false;
    const result=JSON.parse(rawText);
    return result.schema==='ZGMINI_PC_RESULT_V1' &&
      result.requestId===expected.requestId &&
      result.jobId==='run-42722662159-1-seat-2' &&
      result.operation==='writer-install-preimage-readonly' &&
      result.status==='PASS' && result.code==='WRITER_FIXED_PREIMAGE_READONLY' &&
      result.operationalWrites===0 && result.providerCalls===0 &&
      result.d1Writes===0 && result.sqliteOpened===false &&
      result.protectedStateUnchanged===true &&
      result.result?.status==='PASS' &&
      result.result?.sourceHead===expected.sourceSha &&
      result.result?.approvedConfigSource===expected.sourceSha &&
      result.result?.checkpointSource===expected.sourceSha &&
      result.result?.sourceIdentityConsistent===true &&
      result.result?.runtimeSourceVerified===false &&
      result.result?.r6Config?.status==='PASS' &&
      result.result.r6Config.configSha256===expected.configSha256;
  }catch{return false;}
}

/**
 * Local, explicitly invoked Windows-only proof. No C recovery/lease/replay
 * caller imports this command; it never emits raw protected files or tokens.
 */
export async function inspectLocalWriterProtectionReadOnly({
  readConfigRaw=fs.readFileSync,
  readBaseline=()=>JSON.parse(fs.readFileSync(PROTECTED_BASELINE_PATH,'utf8')),
  readCurrent=async()=>{
    const {protectedSnapshot}=await import('./update.mjs');
    return protectedSnapshot();
  },
  fetchResult=fetchPinnedResult,
  inspect=inspectWriterFollowupProtectionCandidate,
}={}){
  let currentConfigRaw,baseline,current,writerBReceipts,writerAReadOnlyReceipt;
  try {
    currentConfigRaw=readConfigRaw(WRITER_CONFIG_PATH);
    if(!Buffer.isBuffer(currentConfigRaw))
      return fail('WRITER_PROTECTION_CONFIG_BYTES_INVALID');
    baseline=await readBaseline();
    current=await readCurrent();
    writerBReceipts=await Promise.all(WRITER_FOLLOWUP_CANDIDATE.writerB
      .map(entry=>fetchResult(entry.path)));
    writerAReadOnlyReceipt=await fetchResult(
      WRITER_FOLLOWUP_CANDIDATE.aObservations.atDeReadOnly.path);
  }catch{return fail('WRITER_PROTECTION_READONLY_INPUT_UNAVAILABLE');}
  if(!verifyWriterFollowupAReadOnlyReceipt(writerAReadOnlyReceipt))
    return fail('WRITER_PROTECTION_POST_B_A_PROOF_UNVERIFIED');
  let result;
  try {result=inspect({baseline,current,writerBReceipts,currentConfigRaw});}
  catch{return fail('WRITER_PROTECTION_COMBINED_CHECK_FAILED');}
  if(result?.status!=='READONLY_WRITER_FOLLOWUP_PROTECTION_CANDIDATE_VERIFIED' ||
      result.code!=='WRITER_FOLLOWUP_PINNED_READONLY_EVIDENCE_MATCH' ||
      result.operationalWrites!==0 || result.cApprovalAuthorized!==false ||
      result.liveCoreSourceVerified!==false ||
      result.historicalCConsentVerifiedHere!==false ||
      !Array.isArray(result.digestStages) ||
      result.digestStages.length!==expectedSources.length ||
      result.digestStages.some((stage,index)=>
        stage.sourceSha!==expectedSources[index] ||
        typeof stage.configSha256!=='string' ||
        !/^[a-f0-9]{64}$/.test(stage.configSha256) ||
        stage.evidenceLevel!==(index===3?'DERIVED_ONLY':'PINNED_DIGEST_MATCH')))
    return fail('WRITER_PROTECTION_COMBINED_EVIDENCE_UNVERIFIED');
  return {schema:'ZGMINI_CONTROLLER_917_WRITER_PROTECTION_READONLY_V1',
    status:'READONLY_WRITER_PROTECTION_CANDIDATE_VERIFIED',
    code:'WRITER_PROTECTION_PINNED_EVIDENCE_MATCH',
    digestStages:result.digestStages,writerBReceiptCount:writerBReceipts.length,
    historicalCConsentVerifiedHere:false,liveCoreSourceVerified:false,
    operationalWrites:0,cApprovalAuthorized:false,
    next:'EXPLICIT_NEW_C_CONSENT_AND_LIVE_CORE_PROOF_REQUIRED'};
}

/** Deliberately outside the existing post-switch C operator and A allowlist. */
export function main(args=process.argv.slice(2),{
  platform=process.platform,githubActions=process.env.GITHUB_ACTIONS,
  runnerName=process.env.RUNNER_NAME,inspect=inspectLocalWriterSourceOnly,
}={}){
  if(platform!=='win32' || githubActions || runnerName)
    return fail('WRITER_SOURCE_ONLY_INTERACTIVE_WINDOWS_REQUIRED');
  if(args.length!==1 || args[0]!=='--verify-local-writer-source')
    return fail('WRITER_SOURCE_ONLY_FIXED_USAGE_REQUIRED');
  return inspect();
}

export async function mainAsync(args=process.argv.slice(2),ports={}){
  if(args[0]==='--verify-local-writer-protection'){
    if((ports.platform??process.platform)!=='win32' ||
        (ports.githubActions??process.env.GITHUB_ACTIONS) ||
        (ports.runnerName??process.env.RUNNER_NAME))
      return fail('WRITER_PROTECTION_INTERACTIVE_WINDOWS_REQUIRED');
    if(args.length!==3 || args[1]!=='--source-sha' ||
        !/^[a-f0-9]{40}$/.test(args[2]))
      return fail('WRITER_PROTECTION_FIXED_SOURCE_REQUIRED');
    try {
      if(!(ports.verifySourcePin??verifyLocalWriterSourcePin)(args[2]))
        return fail('WRITER_PROTECTION_SOURCE_PIN_FAILED');
    }catch{return fail('WRITER_PROTECTION_SOURCE_PIN_FAILED');}
    return (ports.inspectProtection??inspectLocalWriterProtectionReadOnly)();
  }
  return main(args,ports);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await mainAsync();
  console.log(JSON.stringify(result));
  if(!['READONLY_SOURCE_CANDIDATE_VERIFIED',
    'READONLY_WRITER_PROTECTION_CANDIDATE_VERIFIED'].includes(result.status))
    process.exitCode=2;
}
