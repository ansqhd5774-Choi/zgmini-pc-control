// Read-only event intake, not a trust root or approval. Never execute candidate
// code here. The follow-up must independently establish authority, tested tree,
// exact effect and live preconditions before any operational submission.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const repositoryId=1442936296;
const workflowId=416355595;
const workflowPath='.github/workflows/controller-maintenance-source-tests.yml';
const id=x=>Number.isSafeInteger(x)&&x>0;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const sameRepo=x=>x?.id===repositoryId&&x.full_name===repo&&x.private===true;
const out=(state,reason,extra={})=>Object.freeze({mode:'READ_ONLY_EVENT_INTAKE',state,reason,canPublish:false,canExecute:false,...extra});
const validRun=r=>id(r?.id)&&id(r.run_attempt)&&r.workflow_id===workflowId&&
 r.path===workflowPath&&r.event==='pull_request'&&sameRepo(r.repository)&&sameRepo(r.head_repository)&&
 sha(r.head_sha)&&r.status==='completed'&&r.conclusion==='success';

export async function observeCompletedRun(event,{getRun}={}){
 if(event?.action!=='completed'||!sameRepo(event.repository)||!validRun(event.workflow_run))
  return out('IGNORED','NOT_ELIGIBLE_COMPLETED_SOURCE_RUN');
 if(typeof getRun!=='function')return out('EVIDENCE_MISSING','AUTHENTICATED_READ_PORT_REQUIRED');
 const e=event.workflow_run;
 try{
  const r=await getRun(e.id);
  if(!validRun(r)||r.id!==e.id||r.run_attempt!==e.run_attempt||r.head_sha!==e.head_sha)
   return out('EVIDENCE_MISSING','RUN_EVENT_API_MISMATCH');
  // A current PR association may have moved since the run. Do not infer
  // historical checkout or business authority from pull_requests[] here.
  return out('CI_COMPLETION_OBSERVED_ONLY','INDEPENDENT_APPROVAL_AND_EXECUTION_EVIDENCE_REQUIRED',
   {repositoryId,workflowId,runId:r.id,attempt:r.run_attempt,headSha:r.head_sha});
 }catch{return out('EVIDENCE_MISSING','RUN_READ_FAILED')}
}

export async function main({eventPath=process.env.GITHUB_EVENT_PATH,token=process.env.GITHUB_TOKEN}={}){
 if(!eventPath||!token||process.env.GITHUB_EVENT_NAME!=='workflow_run'||process.env.GITHUB_REPOSITORY!==repo)
  return out('EVIDENCE_MISSING','WORKFLOW_CONTEXT_UNVERIFIED');
 let event;
 try{event=JSON.parse(readFileSync(eventPath,'utf8'));}catch{return out('EVIDENCE_MISSING','EVENT_READ_FAILED')}
 return observeCompletedRun(event,{getRun:async runId=>{
  if(!id(runId))throw Error('RUN_ID_INVALID');
  const res=await fetch('https://api.github.com/repos/'+repo+'/actions/runs/'+runId,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}});
  if(!res.ok)throw Error('RUN_HTTP_FAILED');
  return res.json();
 }});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await main();
 console.log(JSON.stringify(result));
 if(result.state==='EVIDENCE_MISSING')process.exitCode=1;
}
