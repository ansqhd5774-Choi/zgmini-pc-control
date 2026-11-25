// Writer-specific shadow review. Remote source ancestry is not local PC ancestry.
// Existing Writer B authority, issue authentication and transaction are unchanged.
import {createHash} from 'node:crypto';
import {buildWriterCandidate} from './contract-adapter.mjs';
import {collectDelegatedScope} from './delegation-evidence-reader.mjs';
const repo='ansqhd5774-Choi/zgmini',workflow='.github/workflows/node.js.yml';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const hash=b=>createHash('sha256').update(b).digest('hex');
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export function inspectWriterPushCI({expected,run,job,logs,workflowBlobSha}={}){
 if(!expected||!id(expected.runId)||!id(expected.jobId)||!id(expected.attempt)||!sha(expected.targetSha)||!sha(expected.workflowBlobSha)||typeof expected.branch!=='string')return out('INVALID','WRITER_CI_PIN_INVALID');
 if(run?.id!==expected.runId||run.run_attempt!==expected.attempt||run.workflow_id!==377770281||run.path!==workflow||run.event!=='push'||run.head_branch!==expected.branch||run.head_sha!==expected.targetSha||run.repository?.id!==1398455648||run.repository?.full_name!==repo||run.status!=='completed'||run.conclusion!=='success')return out('REJECTED','WRITER_CI_RUN_MISMATCH');
 if(job?.id!==expected.jobId||job.run_id!==run.id||job.run_attempt!==expected.attempt||job.head_sha!==expected.targetSha||job.name!=='check'||job.status!=='completed'||job.conclusion!=='success'||!Array.isArray(job.steps))return out('REJECTED','WRITER_CI_JOB_MISMATCH');
 const required=['Run actions/checkout@v4','Install locked dependencies','Build','Type check','Regression tests','PC publication recovery tests','Lint changed source (ESLint)','Audit production dependency vulnerabilities (high or critical)'];
 if(!required.every(name=>{const hits=job.steps.filter(s=>s?.name===name);return hits.length===1&&hits[0].status==='completed'&&hits[0].conclusion==='success'}))return out('REJECTED','WRITER_CI_REQUIRED_STEP_MISSING');
 if(typeof logs!=='string'||!logs.length||logs.length>16000000)return out('EVIDENCE_MISSING','WRITER_CI_LOG_MISSING');
 const lines=logs.split(/\r?\n/),matches=[];
 for(let i=0;i<lines.length-1;i++){
  if(/^\S+Z \[command\]\/usr\/bin\/git log -1 --format=%H$/.test(lines[i])){
   const m=lines[i+1].match(/^\S+Z ([a-f0-9]{40})$/);matches.push(m?.[1]??null);
  }
 }
 if(matches.length!==1||matches[0]!==expected.targetSha||workflowBlobSha!==expected.workflowBlobSha)return out('REJECTED','WRITER_CHECKOUT_OR_WORKFLOW_MISMATCH');
 return out('WRITER_PUSH_CI_MATCH_ONLY','NOT_AUTHORITY',{targetSha:expected.targetSha,runId:run.id,jobId:job.id});
}
export async function reviewWriterCandidate({plan,delegation,ci,live,getJson,readFileBytes}={}){
 try{
  const proposed=buildWriterCandidate(plan);
  if(proposed.state!=='CANDIDATE_ONLY')return out(proposed.state,proposed.reason);
  const candidate=proposed.candidate,p=candidate.plan;
  // Only full-file, naturally idle overlay pilot. Existing extended-drain and
  // insertion approvals continue through their original paths.
  if(Object.hasOwn(p,'coreMaintenance')||p.files.some(f=>Object.hasOwn(f,'insertions')))return out('OUT_OF_SCOPE','SPECIAL_OVERLAY_REQUIRES_EXISTING_ROUTE');
  // Source checks do not need a current operating-PC snapshot. Actual
  // submission and the existing combined review retain live preconditions.
  const sourceOnly=live===undefined;
  if(!sourceOnly){
   if(live?.requestState==='CONSUMED'||live?.requestState==='UNKNOWN'||live?.resourceState==='BUSY')return out('WAIT_RESOURCE','RECONCILE_OR_WAIT');
   if(live?.requestState!=='NEW'||live?.resourceState!=='READY'||live?.observedHead!==p.baseHead||live?.observedConfigSha!==p.baseConfigSourceSha||live?.rollbackVerified!==true||live?.runtimeDependenciesVerified!==true||!Array.isArray(live?.files))return out('EVIDENCE_MISSING','WRITER_LIVE_PRECONDITIONS_UNVERIFIED');
  }
  if(delegation?.scope?.effect!=='B_WRITER_SOURCE'||delegation.scope.sourceRepository!==p.sourceRepository||delegation.scope.sourceBranch!==p.sourceBranch||delegation.scope.purpose!==p.scope||delegation.scope.targetSha!==p.candidateSourceSha||delegation.scope.scopeDigest!==candidate.planSha256)return out('REJECTED','WRITER_DELEGATION_BINDING_MISMATCH');
  const tested=inspectWriterPushCI(ci);
  if(tested.state!=='WRITER_PUSH_CI_MATCH_ONLY')return out(tested.state,tested.reason);
  if(tested.targetSha!==p.candidateSourceSha||ci.expected.branch!==p.sourceBranch)return out('REJECTED','WRITER_CI_CANDIDATE_MISMATCH');
  if(typeof getJson!=='function'||typeof readFileBytes!=='function')return out('EVIDENCE_MISSING','READ_ADAPTER_MISSING');
  const observed=await collectDelegatedScope({...delegation,getJson});
  if(observed.state!=='DELEGATED_DIFF_OBSERVED_ONLY')return out(observed.state,observed.reason);
  if(JSON.stringify(p.files.map(f=>f.path).sort())!==JSON.stringify(observed.changedPaths))return out('REJECTED','WRITER_DIFF_PATH_MISMATCH');
  if(!sourceOnly){
   if(live.files.length!==p.files.length+p.protectedFiles.length)return out('EVIDENCE_MISSING','WRITER_LIVE_FILE_ROSTER_INCOMPLETE');
   for(const f of [...p.files,...p.protectedFiles]){
    const hits=live.files.filter(x=>x?.path===f.path);
    const expected=Object.hasOwn(f,'change')?f.beforeSha256:f.sha256;
    if(hits.length!==1||hits[0].sha256!==expected||hits[0].exists!==(expected!==null))return out('REJECTED','WRITER_LIVE_FILE_PREIMAGE_MISMATCH');
   }
  }
  for(const f of p.files){
   const bytes=await readFileBytes(repo,p.candidateSourceSha,f.path);
   if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>2*1024*1024)return out('EVIDENCE_MISSING','WRITER_FILE_BYTES_MISSING');
   if(hash(bytes)!==f.afterSha256)return out('REJECTED','WRITER_TARGET_BYTES_MISMATCH');
  }
  return out(sourceOnly?'WRITER_SOURCE_REVIEW_MATCH_ONLY':'WRITER_CANDIDATE_REVIEW_MATCH_ONLY',sourceOnly?'LIVE_CHECKS_DEFERRED_TO_EXECUTION':'INDEPENDENT_AUTHORITY_AND_LIVE_CLAIM_REQUIRED',{candidate,runId:tested.runId,jobId:tested.jobId,remoteBaseSha:observed.baseSha,localBaseSha:p.baseHead,delegationSha256:observed.delegationSha256});
 }catch{return out('EVIDENCE_MISSING','WRITER_REVIEW_READ_FAILED')}
}
