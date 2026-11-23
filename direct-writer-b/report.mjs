#!/usr/bin/env node
// One-shot create-only evidence reporter. Token is never passed to the B executor.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DIRECT_B_RESULT,verifyOpenedOwnerIssue} from './approval-contract.mjs';
import {DIRECT_B_EXIT_FILE,DIRECT_B_EXIT_SCHEMA}
  from './capture-apply-exit.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const RUN=/^[0-9]{1,18}$/;
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const CODE=/^DIRECT_B_[A-Z0-9_]{1,100}$/;
const VALID=new Set(['DIRECT_B_PREFLIGHT_STOP','DIRECT_B_EFFECT_BLOCKED',
  'DIRECT_B_EFFECT_UNKNOWN','DIRECT_B_EFFECT_PASS_NOT_PUBLISHED']);
const OUTCOMES=new Set(['success','failure','skipped','cancelled']);
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{code});};

const STEP={sourcePin:'CONFIGURED_SOURCE_PIN',
  sourceCheckout:'APPROVED_SOURCE_CHECKOUT',apply:'APPLY_RUNTIME_B_EFFECT',
  control:'CONTROL_SOURCE_CHECKOUT'};
function processProvenance(env,exitEvidence){
  // Actions supplies outcomes as fixed workflow expressions, never Issue text.
  const configured=env?.DIRECT_B_CONFIGURED_OUTCOME;
  const candidate=env?.DIRECT_B_CANDIDATE_OUTCOME;
  const apply=env?.DIRECT_B_APPLY_OUTCOME;
  const stepsKnown=[configured,candidate,apply].every(x=>OUTCOMES.has(x));
  let lastPassStep=null,firstFailStep=null,firstFailCode=null;
  if(stepsKnown){
    lastPassStep=STEP.control;
    if(configured==='failure'||configured==='cancelled'){
      firstFailStep=STEP.sourcePin;
      firstFailCode='DIRECT_B_SOURCE_PIN_STEP_FAILED';
    }else if(configured==='success'){
      lastPassStep=STEP.sourcePin;
      if(candidate==='failure'||candidate==='cancelled'){
        firstFailStep=STEP.sourceCheckout;
        firstFailCode='DIRECT_B_SOURCE_CHECKOUT_STEP_FAILED';
      }else{
        if(candidate==='success')lastPassStep=STEP.sourceCheckout;
        if(apply==='failure'||apply==='cancelled'){
          firstFailStep=STEP.apply;
          firstFailCode='DIRECT_B_APPLY_STEP_FAILED_EXIT_UNKNOWN';
        }
      }
    }
  }
  const jobName=/^[a-z0-9-]{1,80}$/.test(env?.GITHUB_JOB??'')?
    env.GITHUB_JOB:null;
  const validExit=exitEvidence&&typeof exitEvidence==='object'&&
    !Array.isArray(exitEvidence)&&
    Object.keys(exitEvidence).length===5&&
    exitEvidence.schema===DIRECT_B_EXIT_SCHEMA&&
    exitEvidence.runId===env?.GITHUB_RUN_ID&&
    exitEvidence.jobName===jobName&&jobName!==null&&
    exitEvidence.step==='apply'&&
    Number.isSafeInteger(exitEvidence.nodeExitCode)&&
    exitEvidence.nodeExitCode>=0&&exitEvidence.nodeExitCode<=255;
  const nodeExitCode=validExit?exitEvidence.nodeExitCode:null;
  if(firstFailStep===STEP.apply&&nodeExitCode!==null)
    firstFailCode=nodeExitCode===0?'DIRECT_B_APPLY_STEP_STATUS_CONFLICT':
      'DIRECT_B_APPLY_NODE_EXIT_NONZERO';
  return {lastPassStep,firstFailStep,firstFailCode,nodeExitCode,
    jobName,jobId:null,stepOutcomesKnown:stepsKnown,
    applyOutcome:stepsKnown?apply:null,
    applyStepInvoked:stepsKnown&&['success','failure'].includes(apply),
    operationalEffectAttempted:stepsKnown&&['success','failure'].includes(apply)?
      'UNKNOWN':'NOT_STARTED_BY_WORKFLOW'};
}

export function sanitizeDirectBReport(raw,request,env,exitEvidence=null){
  const provenance=processProvenance(env,exitEvidence);
  const base={schema:'ZGMINI_APPROVED_RUNTIME_B_RESULT_R1',
    requestId:request.requestId,status:'DIRECT_B_STATE_UNKNOWN',
    code:'DIRECT_B_RESULT_UNVERIFIED',
    mode:null,manifestSha256:request.approvalManifestSha256,
    controlSha:null,sourceSha:null,operationSucceeded:false,
    runtimeEffectProof:'NOT_ESTABLISHED',
    compatibilityEvidenceSha256:null,
    compatibilityDirections:0,
    compatibilitySharedLockVerified:false,
    beaSourceVersion:null,beaHttpSha256:null,
    beaStoredAt:null,beaObservedThrough:null,
    runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
    ...provenance,retry:'NO_AUTO_RETRY_READ_ONLY_RECONCILE'};
  if(provenance.firstFailStep&&(!raw||!VALID.has(raw.status)||
    !CODE.test(raw.code??'')))
    base.code=provenance.firstFailCode??'DIRECT_B_RESULT_UNVERIFIED';
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !VALID.has(raw.status)||!CODE.test(raw.code??''))return base;
  if(raw.requestId!==request.requestId&&
    !(raw.status==='DIRECT_B_PREFLIGHT_STOP'&&raw.requestId===null))return base;
  // A reported PASS with a failed process, or a failed result with exit 0,
  // must remain UNKNOWN; neither side may manufacture a Windows effect proof.
  if((provenance.nodeExitCode!==null&&
       ((raw.status==='DIRECT_B_EFFECT_PASS_NOT_PUBLISHED')!==
        (provenance.nodeExitCode===0)))||
    (provenance.stepOutcomesKnown&&
       ((raw.status==='DIRECT_B_EFFECT_PASS_NOT_PUBLISHED')!==
        (provenance.applyOutcome==='success')))||
    (provenance.stepOutcomesKnown&&provenance.applyOutcome==='success'&&
      provenance.nodeExitCode===null))
    return {...base,code:'DIRECT_B_RESULT_PROCESS_CONFLICT',
      firstFailStep:STEP.apply,firstFailCode:'DIRECT_B_RESULT_PROCESS_CONFLICT'};
  const compatibility=/^[a-f0-9]{64}$/.test(
    raw.compatibilityEvidenceSha256??'')&&
    raw.compatibilityDirections===2&&
    raw.compatibilitySharedLockVerified===true?{
      compatibilityEvidenceSha256:raw.compatibilityEvidenceSha256,
      compatibilityDirections:2,
      compatibilitySharedLockVerified:true}:{};
  if(raw.status==='DIRECT_B_EFFECT_PASS_NOT_PUBLISHED'){
    if(raw.code!=='DIRECT_B_LOCAL_EFFECT_PASS'||raw.operationSucceeded!==true||
      raw.manifestSha256!==base.manifestSha256||
      !SHA40.test(raw.controlSha??'')||!SHA40.test(raw.sourceSha??'')||
      !['PIN_REGISTRY_CAS','VERSIONED_BUNDLE_ACTIVATE',
        'CONFIGURED_THEMES_REPEAT_UPGRADE',
        'BEA_NIPA_PRIVATE_ARCHIVE_ONCE'].includes(raw.mode)||
      (!['CONFIGURED_THEMES_REPEAT_UPGRADE',
        'BEA_NIPA_PRIVATE_ARCHIVE_ONCE'].includes(raw.mode)&&
        raw.reportStatus!=='JSON_TXT_2_OF_2')||
      (['CONFIGURED_THEMES_REPEAT_UPGRADE',
        'BEA_NIPA_PRIVATE_ARCHIVE_ONCE'].includes(raw.mode)&&
        raw.reportStatus!=='INCOMPLETE')||
      (raw.mode==='BEA_NIPA_PRIVATE_ARCHIVE_ONCE'&&
        (!SHA64.test(raw.sourceVersion??'')||
         !SHA64.test(raw.sourceHttpSha256??'')||
         !Number.isSafeInteger(raw.sourceStoredAt)||raw.sourceStoredAt<=0||
         !/^20\d{2}-(?:03-31|06-30|09-30|12-31)$/.test(raw.observedThrough??''))))return base;
    return {...base,...compatibility,status:raw.status,code:raw.code,mode:raw.mode,
      sourceSha:raw.sourceSha,controlSha:raw.controlSha,operationSucceeded:true,
      ...(raw.mode==='BEA_NIPA_PRIVATE_ARCHIVE_ONCE'?{
        beaSourceVersion:raw.sourceVersion,
        beaHttpSha256:raw.sourceHttpSha256,
        beaStoredAt:raw.sourceStoredAt,
        beaObservedThrough:raw.observedThrough}:{}),
      runtimeEffectProof:'LOCAL_EXECUTOR_PASS_REPORT_PENDING',
      operationalEffectAttempted:'LOCAL_EXECUTOR_PASS'};
  }
  return {...base,...compatibility,status:raw.status,code:raw.code,
    firstFailStep:raw.status==='DIRECT_B_PREFLIGHT_STOP'?
      'APPROVAL_PREFLIGHT':provenance.firstFailStep??STEP.apply,
    firstFailCode:raw.code,
    operationalEffectAttempted:raw.status==='DIRECT_B_PREFLIGHT_STOP'?
      'NOT_STARTED_BY_PREFLIGHT':provenance.operationalEffectAttempted};
}

export function directBTextReport(r){return [
  `REQUEST_ID=${r.requestId}`,`STATUS=${r.status}`,`CODE=${r.code}`,
  `MODE=${r.mode??'NONE'}`,`MANIFEST_SHA256=${r.manifestSha256}`,
  `CONTROL_SHA=${r.controlSha??'UNKNOWN'}`,
  `SOURCE_SHA=${r.sourceSha??'UNKNOWN'}`,
  `BEA_STORED_SHA256=${r.beaSourceVersion??'UNKNOWN'}`,
  `BEA_HTTP_SHA256=${r.beaHttpSha256??'UNKNOWN'}`,
  `BEA_SOURCE_STORED_AT=${r.beaStoredAt??'UNKNOWN'}`,
  `BEA_OBSERVED_THROUGH=${r.beaObservedThrough??'UNKNOWN'}`,
  `OPERATION_SUCCEEDED=${r.operationSucceeded}`,
  `RUNTIME_EFFECT_PROOF=${r.runtimeEffectProof}`,
  `COMPATIBILITY_EVIDENCE_SHA256=${r.compatibilityEvidenceSha256??'UNKNOWN'}`,
  `COMPATIBILITY_DIRECTIONS=${r.compatibilityDirections}`,
  `COMPATIBILITY_SHARED_LOCK_VERIFIED=${r.compatibilitySharedLockVerified}`,
  `RUN_ID=${r.runId??'UNKNOWN'}`,
  `JOB_NAME=${r.jobName??'UNKNOWN'}`,`JOB_ID=${r.jobId??'UNKNOWN'}`,
  `LAST_PASS=${r.lastPassStep??'UNKNOWN'}`,
  `FIRST_FAIL=${r.firstFailStep??'UNKNOWN'}`,
  `FIRST_FAIL_CODE=${r.firstFailCode??'UNKNOWN'}`,
  `NODE_EXIT_CODE=${r.nodeExitCode??'UNKNOWN'}`,
  `APPLY_STEP_INVOKED=${r.applyStepInvoked}`,
  `OPERATIONAL_EFFECT_ATTEMPTED=${r.operationalEffectAttempted}`,
  `RETRY=${r.retry}`,'',
].join('\n');}

async function sameReadback(fetchApi,url,headers,bytes){
  try{
    const response=await fetchApi(url+'?ref=main',{method:'GET',headers});
    if(response.status!==200)return false;
    const body=await response.json();
    return body?.encoding==='base64'&&
      Buffer.from((body.content??'').replace(/\s/g,''),'base64')
        .equals(Buffer.from(bytes));
  }catch{return false;}
}

export async function uploadDirectBReport({event,env,rawResult,
  rawExitEvidence='',fetchApi=fetch}){
  const request=verifyOpenedOwnerIssue(event,env);
  need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
    RUN.test(env.GITHUB_RUN_ID??''),'DIRECT_B_REPORT_AUTH_STOP');
  let parsed;
  try{parsed=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=2048?
    JSON.parse(rawResult):null;}catch{parsed=null;}
  let exitEvidence;
  try{exitEvidence=typeof rawExitEvidence==='string'&&
    Buffer.byteLength(rawExitEvidence)<=512?JSON.parse(rawExitEvidence):null;}
  catch{exitEvidence=null;}
  const r=sanitizeDirectBReport(parsed,request,env,exitEvidence);
  const headers={accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_TOKEN,
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-approved-runtime-b-once'};
  let created=0,verified=0;
  for(const [ext,content] of [['json',JSON.stringify(r,null,2)+'\n'],
    ['txt',directBTextReport(r)]]){
    const url=`https://api.github.com/repos/${REPO}/contents/`+
      `results/approved-runtime-b-${request.requestId}.${ext}`;
    try{
      const res=await fetchApi(url,{method:'PUT',headers,body:JSON.stringify({
        message:'chore(runtime-b): record one-shot sanitized B result',
        content:Buffer.from(content).toString('base64')})});
      if(res.status===201)created++;
    }catch{/* Ambiguous PUT is never retried. */}
    if(await sameReadback(fetchApi,url,headers,content))verified++;
  }
  const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
    'RESULT_DELIVERY_UNVERIFIED';
  const status=verified===2?r.status:'DIRECT_B_STATE_UNKNOWN';
  const comment=`<!-- approved-runtime-b:${request.requestId} -->\n`+
    `Approved runtime B: **${status}** `+
    `(${verified===2?r.code:'DIRECT_B_RESULT_PAIR_UNVERIFIED'})\n`+
    `RESULT DELIVERY: ${delivery}; CREATED: ${created}/2; `+
    `READBACK: ${verified}/2\n`+
    `LOCAL EFFECT: ${r.runtimeEffectProof}; RUN_ID: ${r.runId??'UNKNOWN'}; `+
    `JOB: ${r.jobName??'UNKNOWN'}; `+
    `LAST_PASS: ${r.lastPassStep??'UNKNOWN'}; `+
    `FIRST_FAIL: ${r.firstFailStep??'UNKNOWN'}; `+
    `FIRST_FAIL_CODE: ${r.firstFailCode??'UNKNOWN'}; `+
    `NODE_EXIT: ${r.nodeExitCode??'UNKNOWN'}; `+
    `APPLY_STEP_INVOKED: ${r.applyStepInvoked}; `+
    `OPERATIONAL_EFFECT_ATTEMPTED: ${r.operationalEffectAttempted}; `+
    `CROSS_VERSION: ${r.compatibilityEvidenceSha256??'UNKNOWN'}; `+
    'NO AUTO RE-EXECUTION\n';
  const response=await fetchApi(`https://api.github.com/repos/${REPO}/issues/`+
    `${event.issue.number}/comments`,{method:'POST',headers,
    body:JSON.stringify({body:comment})});
  need(response.status===201,'DIRECT_B_REPORT_COMMENT_STOP');
  // Delivery evidence and local B effect are independent. A comment cannot
  // turn an incomplete 0/2 or 1/2 remote result into a successful report Job.
  need(verified===2,'DIRECT_B_RESULT_PAIR_UNVERIFIED');
  return {status,delivery,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    let local,exitEvidence;
    try{local=fs.readFileSync(path.join(env.RUNNER_TEMP,DIRECT_B_RESULT),'utf8');}
    catch{local='';}
    try{exitEvidence=fs.readFileSync(path.join(env.RUNNER_TEMP,
      DIRECT_B_EXIT_FILE),'utf8');}
    catch{exitEvidence='';}
    const report=await uploadDirectBReport({event,env,rawResult:local,
      rawExitEvidence:exitEvidence});
    process.stdout.write(`DIRECT_B_REPORT ${report.delivery} ${report.verified}/2\n`);
  }catch{
    process.stderr.write('DIRECT_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
    process.exitCode=1;
  }
}
