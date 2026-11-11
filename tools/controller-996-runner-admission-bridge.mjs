// #996 combine the EXISTING original-PC read-only GitHub/local evidence ports.
// This observes an admission baseline only: NO Runner, PC, GitHub or C effects.
import {create996InstalledGhGetReadOnly} from
  './controller-996-c-installed-gh-get-readonly.mjs';
import {inspect996LocalRunnerReadOnly} from
  './controller-996-local-runner-readonly.mjs';

const REQUIRED=Object.freeze(Array.from({length:6},(_,n)=>
  `zgmini-pc-${String(n+1).padStart(2,'0')}`));
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const isCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=2000;

/** Pure, fail-closed receipt comparison. Synthetic ports grant NO C authority. */
export function review996RunnerAdmissionReceipts({workflowState,
  remoteRunners,remoteRuns,localRunner}={}){
  need(workflowState==='active',
    'C996_ADMISSION_BRIDGE_WORKFLOW_UNVERIFIED');
  need(remoteRunners?.schema==='ZGMINI_996_PC_JOB_RUNNER_GET_V1'&&
    remoteRunners.status==='RUNNER_INVENTORY_GET_ONLY'&&
    Array.isArray(remoteRunners.runners)&&
    remoteRunners.runners.length===remoteRunners.totalCount&&
    isCount(remoteRunners.totalCount),
  'C996_ADMISSION_BRIDGE_REMOTE_INVENTORY_INVALID');
  need(remoteRuns?.schema==='ZGMINI_996_PC_JOB_RUNS_GET_V1'&&
    remoteRuns.status==='WORKFLOW_RUNS_GET_ONLY'&&
    ['queued','in_progress','waiting'].every(k=>
      isCount(remoteRuns.counts?.[k])),
  'C996_ADMISSION_BRIDGE_WORKFLOW_RUNS_INVALID');
  need(localRunner?.schema==='ZGMINI_996_LOCAL_RUNNER_IDENTITY_READONLY_V1'&&
    localRunner.status==='LOCAL_RUNNER_REGISTRATION_OBSERVED_ONLY'&&
    localRunner.pcName==='기존 ZGMINI PC'&&
    localRunner.startupAndWatchdogHashesMatch===true&&
    Array.isArray(localRunner.bindings)&&
    localRunner.bindings.length===REQUIRED.length,
  'C996_ADMISSION_BRIDGE_LOCAL_INVENTORY_INVALID');
  const matched=remoteRunners.runners.filter(row=>
    Array.isArray(row?.labels)&&row.labels.includes('zgmini-pc-control'));
  need(matched.length===REQUIRED.length&&
    new Set(matched.map(row=>row.id)).size===REQUIRED.length&&
    new Set(matched.map(row=>row.name)).size===REQUIRED.length&&
    REQUIRED.every(name=>{
      const a=matched.filter(row=>row.name===name),
        b=localRunner.bindings.filter(row=>row.name===name);
      return a.length===1&&b.length===1&&
        a[0].id===b[0].id&&Number.isSafeInteger(a[0].id)&&
        ['online','offline'].includes(a[0].status)&&
        typeof a[0].busy==='boolean'&&
        ['self-hosted','Windows','X64'].every(label=>
          a[0].labels.includes(label));
    }),
  'C996_ADMISSION_BRIDGE_LOCAL_REMOTE_RUNNER_MISMATCH');
  const allOffline=matched.every(row=>row.status==='offline'&&row.busy===false);
  const noRunning=remoteRuns.counts.in_progress===0&&
    remoteRuns.counts.waiting===0;
  const markersObserved=localRunner.watchdogPausePresent===true&&
    localRunner.controllerDrainPresent===true;
  return Object.freeze({
    schema:'ZGMINI_996_RUNNER_ADMISSION_BASELINE_V1',
    status:'BASELINE_OBSERVED_READ_ONLY',
    physicalPcCount:2,existingPcName:'기존 ZGMINI PC',
    queuePcName:'공통 대기열 PC',
    matchingRunnerCount:matched.length,
    bindings:Object.freeze(matched.map(row=>Object.freeze({
      id:row.id,name:row.name,status:row.status,busy:row.busy}))),
    counts:Object.freeze({queued:remoteRuns.counts.queued,
      inProgress:remoteRuns.counts.in_progress,
      waiting:remoteRuns.counts.waiting}),
    allOffline,noRunning,markersObserved,
    admissionEligible:false,
    // PAUSE/DRAIN do not stop already-running Supervisor/Runner processes.
    processExitProven:false,readbackAfterWindowsBootProven:false,
    sourceAuthenticatedExternally:false,
    ownerApprovalVerified:false,
    executionAuthorized:false,productionExecutable:false,
    pcWrites:0,workflowPuts:0,issuePosts:0,automaticRetry:false,
  });
}

/** Ignore GitHub pagination/order changes, but reject any material drift. */
export function verify996RunnerAdmissionSnapshotStable(first,second){
  const normalized=snapshot=>{
    const checked=review996RunnerAdmissionReceipts(snapshot);
    return JSON.stringify({
      workflowState:snapshot.workflowState,
      totalCount:snapshot.remoteRunners.totalCount,
      runners:snapshot.remoteRunners.runners.map(row=>({
        id:row.id,name:row.name,status:row.status,busy:row.busy,
        labels:[...row.labels].sort(),
      })).sort((a,b)=>a.id-b.id),
      counts:checked.counts,
      localBindings:[...snapshot.localRunner.bindings].sort((a,b)=>a.id-b.id),
      markersObserved:checked.markersObserved,
      pausePresent:snapshot.localRunner.watchdogPausePresent,
      drainPresent:snapshot.localRunner.controllerDrainPresent,
      hashesMatch:snapshot.localRunner.startupAndWatchdogHashesMatch,
    });
  };
  need(normalized(first)===normalized(second),
    'C996_ADMISSION_BRIDGE_SNAPSHOT_DRIFT');
  return true;
}

/** Production uses only fixed existing trusted readers, with no injected I/O. */
export function collect996RunnerAdmissionBaselineReadOnly(){
  const gh=create996InstalledGhGetReadOnly();
  const read=()=>({
    workflowState:gh.readWorkflowStateReadOnly(),
    remoteRunners:gh.readPcJobRunnersReadOnly(),
    remoteRuns:gh.readPcJobRunsReadOnly(),
    localRunner:inspect996LocalRunnerReadOnly(),
  });
  const first=read(),second=read();
  verify996RunnerAdmissionSnapshotStable(first,second);
  return Object.freeze({...review996RunnerAdmissionReceipts(second),
    // Diagnostic clock only, never proof of an atomic GitHub snapshot.
    observedAtUtc:new Date().toISOString(),
    stableConsecutiveReads:2,admissionEligible:false});
}
