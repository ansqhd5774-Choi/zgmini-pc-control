// #996 offline pc-job intake review. PURE, SOURCE-ONLY, NO PC/GITHUB EFFECTS.
// Caller-supplied runner and GitHub observations are NEVER authenticated here.
// Real C-grade approval and a trusted runtime evidence collector are required.
import {createHash} from 'node:crypto';

const ORIGINAL_PC='기존 ZGMINI PC';
const QUEUE_PC='공통 대기열 PC';
const ROUTE_LABEL='zgmini-pc-control';
const REQUIRED_RUNNERS=Object.freeze(Array.from({length:6},(_,n)=>
  `zgmini-pc-${String(n+1).padStart(2,'0')}`));
const EXPECTED_PC_JOB_WORKFLOW_SHA256=
  '76621ee9180d01a2a82e68ed35ffb0f86f5e51474d4f1aae008377aab5f81232';
const QUEUE_MAX_MS=24*60*60*1000; // GitHub self-hosted Actions queue limit.
const codes=Object.freeze({
  workflow:'C996_ADMISSION_WORKFLOW_NOT_ACTIVE_OR_CHANGED',
  routing:'C996_ADMISSION_WORKFLOW_ROUTING_CHANGED',
  inventory:'C996_ADMISSION_RUNNER_INVENTORY_INCOMPLETE',
  foreign:'C996_ADMISSION_MATCHING_RUNNER_ON_OTHER_PC',
  local:'C996_ADMISSION_LOCAL_RUNNER_IDENTITY_UNVERIFIED',
  online:'C996_ADMISSION_RUNNER_NOT_OFFLINE',
  running:'C996_ADMISSION_RUNNER_OR_JOB_NOT_DRAINED',
  startup:'C996_ADMISSION_WINDOWS_RESTART_NOT_FENCED',
  window:'C996_ADMISSION_QUEUE_24H_BOUND_NOT_PROVEN',
  resume:'C996_ADMISSION_POSTCHECK_BEFORE_RESUME_NOT_PROVEN',
});
const denied=(code,stage)=>Object.freeze({
  schema:'ZGMINI_996_PC_JOB_OFFLINE_ADMISSION_REVIEW_V1',
  status:'SYNTHETIC_BLOCKED',stage,code,
  executionAuthorized:false,productionExecutable:false,
  workflowPuts:0,issuePosts:0,pcWrites:0,automaticRetry:false,
});

// No regex parser is an OS/GitHub attestation. Source changes must STOP until
// the exact installed workflow bytes and run routing are independently checked.
export function review996PcJobWorkflowSource(workflowText){
  return typeof workflowText==='string'&&
    createHash('sha256').update(workflowText).digest('hex')===
      EXPECTED_PC_JOB_WORKFLOW_SHA256&&
    /^on:\s*\r?\n\s+issues:\s*\r?\n\s+types:\s*\[opened\]/m.test(workflowText)&&
    /runs-on:\s*\[self-hosted,\s*Windows,\s*X64,\s*zgmini-pc-control\]/.test(workflowText)&&
    /github\.actor\s*==\s*'ansqhd5774-Choi'/.test(workflowText)&&
    /contains\(github\.event\.issue\.labels\.\*\.name,\s*'pc-job'\)/.test(workflowText);
}

/**
 * A source-only review of the existing-GitHub-queue alternative. It does not
 * shut down runners, disable workflows, hold Windows startup, or reserve C.
 * At PRE_OFFLINE, require the real Owner-authorized maintenance drain before
 * the WinPE boot. At BEFORE_RESUME, ensure nothing restarted before readback.
 */
export function review996OfflinePcJobAdmission({
  stage='PRE_OFFLINE',workflowText,workflowState,
  workflowMutationCount,runnerInventoryComplete,runnerRows,
  localRunnerBindings,localRunnerBindingsVerified,
  runningJobs,drainConfirmed,windowsAutoStartHeld,
  offlineStartAt,plannedResumeAt,oldestQueuedAt,
  postReadbackVerified,runnerResumeOccurred,
}={}){
  const deny=code=>denied(code,stage);
  if(!['PRE_OFFLINE','BEFORE_RESUME'].includes(stage))
    return deny('C996_ADMISSION_STAGE_INVALID');
  if(!review996PcJobWorkflowSource(workflowText))return deny(codes.routing);
  if(workflowState!=='active'||workflowMutationCount!==0)
    return deny(codes.workflow);
  if(runnerInventoryComplete!==true||!Array.isArray(runnerRows))
    return deny(codes.inventory);
  const matching=runnerRows.filter(row=>
    Array.isArray(row?.labels)&&row.labels.includes(ROUTE_LABEL));
  const ids=new Set(matching.map(row=>row.id));
  if(matching.length===0||ids.size!==matching.length||
    matching.some(row=>!Number.isSafeInteger(row.id)||row.id<=0||
      !['self-hosted','Windows','X64'].every(tag=>row.labels.includes(tag))))
    return deny(codes.inventory);
  // The GitHub runners endpoint does NOT return a physical PC identity.
  // Unexpected matching runner names could execute jobs from another PC.
  if(matching.length!==REQUIRED_RUNNERS.length||
    matching.some(row=>!REQUIRED_RUNNERS.includes(row.name))||
    new Set(matching.map(row=>row.name)).size!==REQUIRED_RUNNERS.length)
    return deny(codes.foreign);
  // Local installed .runner / Supervisor IDs require their own trusted OS
  // observation; NEVER infer machine ownership from GitHub's names alone.
  if(localRunnerBindingsVerified!==true||!Array.isArray(localRunnerBindings)||
    localRunnerBindings.length!==REQUIRED_RUNNERS.length||
    !REQUIRED_RUNNERS.every(name=>{
      const matches=localRunnerBindings.filter(binding=>binding?.name===name);
      const remote=matching.find(row=>row.name===name);
      return matches.length===1&&matches[0].id===remote?.id;
    }))return deny(codes.local);
  if(matching.some(row=>row.status!=='offline'))return deny(codes.online);
  if(matching.some(row=>row.busy!==false)||runningJobs!==0||
    drainConfirmed!==true)return deny(codes.running);
  if(windowsAutoStartHeld!==true)return deny(codes.startup);
  const start=Date.parse(offlineStartAt),end=Date.parse(plannedResumeAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
    end-start>=QUEUE_MAX_MS)return deny(codes.window);
  if(stage==='BEFORE_RESUME'){
    const oldest=oldestQueuedAt==null?start:Date.parse(oldestQueuedAt);
    if(!Number.isFinite(oldest)||end-oldest>=QUEUE_MAX_MS||end<oldest)
      return deny(codes.window);
    if(postReadbackVerified!==true||runnerResumeOccurred!==false)
      return deny(codes.resume);
  }
  return Object.freeze({
    schema:'ZGMINI_996_PC_JOB_OFFLINE_ADMISSION_REVIEW_V1',
    status:'SYNTHETIC_CONTRACT_REVIEWED_ONLY',stage,
    matchedRunnerCount:matching.length,
    pcTopology:Object.freeze({physicalPcCount:2,existingPcName:ORIGINAL_PC,
      queuePcName:QUEUE_PC,additionalPcRequired:false}),
    workflowStateExpected:'active',
    strategy:'GITHUB_EXISTING_QUEUE_WITH_MATCHING_RUNNERS_OFFLINE',
    maxQueuedHours:24,executionAuthorized:false,productionExecutable:false,
    workflowPuts:0,issuePosts:0,pcWrites:0,automaticRetry:false,
    evidenceAuthenticated:false,
  });
}
