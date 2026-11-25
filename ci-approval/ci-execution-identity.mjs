// Durable workload receipt for the existing asynchronous maintenance receiver.
// Trust is the authenticated GitHub read port and independently installed pin
// of the reviewed workflow (including pinned transitive code), not an Issue
// author name, a caller-supplied workflow pin, or an expiring bearer token.
// Identity alone does not confer business approval or bypass manifest/CAS/lease.
import {createHash} from 'node:crypto';
const REPO='ansqhd5774-Choi/zgmini-pc-control',REPO_ID=1442936296;
const WORKFLOW='.github/workflows/ci-approval-controller-b.yml';
const JOB='submit-controller-b',STEP='Record Controller B request receipt';
const MARKER='ZGMINI_CI_CONTROLLER_B_RECEIPT=';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytesOk=b=>Buffer.isBuffer(b)&&b.length>0&&b.length<=32768;
const out=(state,code,extra={})=>Object.freeze({state,code,canPublish:false,canExecute:false,...extra});
export function controllerBReceiptMarker(issueNumber,requestBytes){
 if(!id(issueNumber)||!bytesOk(requestBytes))throw Error('CI_RECEIPT_INPUT_INVALID');
 return MARKER+issueNumber+':'+hash(requestBytes);
}
// Only the fixed reviewed workflow emits the marker after creating and reading
// back the exact Issue. The receiver reads the historical attempt, not a later
// rerun. A pending attempt is queued, not considered an authentication failure.
export async function verifyControllerBIdentity({issueNumber,requestBytes,runId,attempt,policy,getJson,readJobLogs}={}){
 if(!id(policy?.workflowId)||!sha(policy?.workflowBlobSha))
  return out('DISABLED','CI_IDENTITY_POLICY_NOT_CONFIGURED');
 if(!id(runId)||!id(attempt)||!id(issueNumber)||!bytesOk(requestBytes)||
    typeof getJson!=='function'||typeof readJobLogs!=='function')
  return out('REJECTED','CI_RECEIPT_INPUT_INVALID');
 const expected=controllerBReceiptMarker(issueNumber,requestBytes),route='actions/runs/'+runId+'/attempts/'+attempt;
 try{
  const run=await getJson(route);
  if(run?.id!==runId||run.run_attempt!==attempt||run.workflow_id!==policy.workflowId||
     run.path!==WORKFLOW||run.repository?.id!==REPO_ID||run.repository?.full_name!==REPO||
     run.repository?.private!==true||run.head_repository?.id!==REPO_ID||
     run.head_branch!=='main'||!sha(run.head_sha)||!['push','workflow_run'].includes(run.event))
   return out('REJECTED','CI_RUN_IDENTITY_MISMATCH');
  if(run.status!=='completed')return out('QUEUED','CI_RUN_NOT_COMPLETED');
  if(run.conclusion!=='success')return out('REJECTED','CI_RUN_NOT_SUCCESS');
  // Independently read the caller workflow at its immutable run revision.
  // The installed pin must cover a workflow that only checks out fixed reviewed
  // source and never executes a candidate or accepts arbitrary marker text.
  const file=await getJson('contents/'+WORKFLOW+'?ref='+run.head_sha);
  if(file?.type!=='file'||file.path!==WORKFLOW||file.sha!==policy.workflowBlobSha||
     file.encoding!=='base64'||typeof file.content!=='string'||file.content.length>131072)
   return out('REJECTED','CI_WORKFLOW_PIN_MISMATCH');
  const bytes=Buffer.from(file.content,'base64');
  const blob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
  if(blob!==policy.workflowBlobSha)return out('REJECTED','CI_WORKFLOW_BYTES_MISMATCH');
  const jobs=await getJson(route+'/jobs?per_page=100');
  if(!Array.isArray(jobs?.jobs)||!id(jobs.total_count)||jobs.total_count!==jobs.jobs.length)
   return out('EVIDENCE_MISSING','CI_JOBS_INCOMPLETE');
  const matched=jobs.jobs.filter(j=>j?.name===JOB);
  if(matched.length!==1)return out('REJECTED','CI_JOB_IDENTITY_MISMATCH');
  const job=matched[0];
  if(!id(job.id)||job.run_id!==runId||job.run_attempt!==attempt||job.head_sha!==run.head_sha||
     job.status!=='completed'||job.conclusion!=='success')
   return out('REJECTED','CI_JOB_IDENTITY_MISMATCH');
  const steps=Array.isArray(job.steps)?job.steps.filter(s=>s?.name===STEP):[];
  if(steps.length!==1||steps[0].status!=='completed'||steps[0].conclusion!=='success')
   return out('REJECTED','CI_RECEIPT_STEP_NOT_SUCCESS');
  const logs=await readJobLogs(job.id);
  if(typeof logs!=='string'||!logs.length||logs.length>16000000)
   return out('EVIDENCE_MISSING','CI_RECEIPT_LOG_UNAVAILABLE');
  const marks=logs.split(/\r?\n/).flatMap(line=>{
   const m=line.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z (ZGMINI_CI_CONTROLLER_B_RECEIPT=[1-9]\d*:[a-f0-9]{64})$/);
   return m?[m[1]]:[];
  });
  if(!marks.includes(expected))return out('REJECTED','CI_RECEIPT_ISSUE_OR_BYTES_MISMATCH');
  return out('CI_WORKLOAD_IDENTITY_VERIFIED_ONLY','CI_RECEIPT_MATCH',{runId,attempt,jobId:job.id,
    issueNumber,requestSha256:hash(requestBytes),workflowBlobSha:blob,runHeadSha:run.head_sha});
 }catch{return out('EVIDENCE_MISSING','CI_IDENTITY_READ_FAILED')}
}
