// Standalone, local Windows verification of the #917 follow-up Writer source.
// This never authorizes a C-grade recovery, starts a Core task, mutates a lease,
// posts to GitHub or exports the private Writer configuration bytes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WRITER_FOLLOWUP_CANDIDATE, WRITER_TRANSITION}
  from './controller-postswitch-approval.mjs';
import {analyzeWriterFollowupSourceCandidate}
  from './controller-postswitch-evidence.mjs';

export const WRITER_CONFIG_PATH='E:/ZGmini/data/pc-writer/config.json';
const expectedSources=[WRITER_TRANSITION.priorApprovedSourceSha,
  ...WRITER_FOLLOWUP_CANDIDATE.sourceSequence].reverse();
const fail=code=>({schema:'ZGMINI_CONTROLLER_917_WRITER_LOCAL_READONLY_V1',
  status:'READONLY_SOURCE_CANDIDATE_UNVERIFIED',code,
  operationalWrites:0,cApprovalAuthorized:false,liveCoreSourceVerified:false});

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
      !Array.isArray(analysis.stages) || analysis.stages.length!==5 ||
      analysis.stages.some((stage,index)=>
        stage?.sourceSha!==expectedSources[index] ||
        typeof stage.configSha256!=='string' ||
        !/^[a-f0-9]{64}$/.test(stage.configSha256) ||
        stage.evidenceLevel!==(index===2 ? 'DERIVED_ONLY' :
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

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=main();
  console.log(JSON.stringify(result));
  if(result.status!=='READONLY_SOURCE_CANDIDATE_VERIFIED')process.exitCode=2;
}
