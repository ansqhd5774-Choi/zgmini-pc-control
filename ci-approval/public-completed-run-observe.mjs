#!/usr/bin/env node
// A GitHub-hosted, READ-ONLY observer of successful source CI in the Public
// control repository. No approval issuance, Issue POST, workflow dispatch,
// self-hosted Runner access, local policy input or Controller/Writer execution.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control',REPO_ID=1442936296;
const OWNER='ansqhd5774-Choi',OWNER_ID=327938088;
const SOURCE_WORKFLOW_ID=416355595;
const SOURCE_PATH='.github/workflows/controller-maintenance-source-tests.yml';
// Reviewed main workflow Git blob. A PR editing the CI workflow cannot silently
// redefine which check steps count as success. Updating this pin requires review.
const SOURCE_WORKFLOW_BLOB='a8f49337200d2e7ce902ab3ecf23d42c811fabe2';
const REQUIRED_STEPS=Object.freeze([
 'Verify exact public source-only event origin',
 'Verify public source/runner isolation and deferred B approval'
]);
const isSha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const isId=v=>Number.isSafeInteger(v)&&v>0;
const isPublicRepo=r=>r?.id===REPO_ID&&r.full_name===REPO&&
  r.private===false&&r.owner?.id===OWNER_ID&&r.owner.login===OWNER;
const result=(state,code,extra={})=>Object.freeze({
 schema:'ZGMINI_CI_PUBLIC_SOURCE_COMPLETION_READONLY_V1',state,code,
 sourceOnly:true,approvalVerified:false,canPublish:false,canExecute:false,
 selfHostedAuthorized:false,controllerBAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0,...extra
});
const validRun=r=>isId(r?.id)&&isId(r.run_attempt)&&
  r.workflow_id===SOURCE_WORKFLOW_ID&&r.path===SOURCE_PATH&&
  r.event==='pull_request'&&isSha(r.head_sha)&&
  r.status==='completed'&&r.conclusion==='success'&&
  isPublicRepo(r.repository)&&r.head_repository?.id===REPO_ID&&
  r.head_repository.full_name===REPO;

function exactPublicJobProof(data,runId){
 if(!data||data.total_count!==2||!Array.isArray(data.jobs)||data.jobs.length!==2)
  return false; // First-page truncation or unexpected new jobs is not proof.
 const publicJobs=data.jobs.filter(j=>j?.name==='public-source-only');
 const privateJobs=data.jobs.filter(j=>j?.name==='source-only');
 if(publicJobs.length!==1||privateJobs.length!==1)return false;
 const [job]=publicJobs,[privateJob]=privateJobs;
 if(!isId(job.id)||job.run_id!==runId||job.status!=='completed'||
    job.conclusion!=='success'||!Array.isArray(job.steps)||
    !isId(privateJob.id)||privateJob.run_id!==runId||
    privateJob.status!=='completed'||privateJob.conclusion!=='skipped')return false;
 for(const name of REQUIRED_STEPS){
  const steps=job.steps.filter(x=>x?.name===name);
  if(steps.length!==1||steps[0].status!=='completed'||steps[0].conclusion!=='success')
   return false;
 }
 return true;
}
function exactReviewedWorkflowBlob(file){
 if(file?.type!=='file'||file.path!==SOURCE_PATH||file.encoding!=='base64'||
    file.sha!==SOURCE_WORKFLOW_BLOB||typeof file.content!=='string'||
    file.content.length>200000)return false;
 const bytes=Buffer.from(file.content,'base64');
 if(bytes.length<1||bytes.length>120000)return false;
 const gitBlob=createHash('sha1').update(Buffer.from('blob '+bytes.length)).update(Buffer.from([0]))
  .update(bytes).digest('hex');
 return gitBlob===SOURCE_WORKFLOW_BLOB;
}

export async function observePublicSourceCompletion({event,env,getRun,getJobs,getWorkflow}={}){
 if(env?.GITHUB_EVENT_NAME!=='workflow_run'||
    env.GITHUB_REPOSITORY!==REPO||env.GITHUB_REF!=='refs/heads/main'||
    env.RUNNER_ENVIRONMENT!=='github-hosted'||!isSha(env.GITHUB_SHA)|| 
    event?.action!=='completed'||!isPublicRepo(event.repository)||
    !validRun(event.workflow_run))
  return result('IGNORED','PUBLIC_CI_COMPLETION_EVENT_NOT_ELIGIBLE');
 if(typeof getRun!=='function'||typeof getJobs!=='function'||typeof getWorkflow!=='function')
  return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_READ_PORT_MISSING');
 const expected=event.workflow_run;
 try{
  const run=await getRun(expected.id);
  if(!validRun(run)||run.id!==expected.id||
     run.run_attempt!==expected.run_attempt||run.head_sha!==expected.head_sha)
   return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_API_MISMATCH');
  const [jobs,workflow]=await Promise.all([
   getJobs(run.id,run.run_attempt),getWorkflow(SOURCE_PATH,run.head_sha)
  ]);
  if(!exactPublicJobProof(jobs,run.id))
   return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_JOB_EVIDENCE_UNVERIFIED');
  if(!exactReviewedWorkflowBlob(workflow))
   return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_WORKFLOW_BLOB_UNVERIFIED');
  // Pinned source workflow and actual hosted checks are now observed.
  // Approval, provenance of a reviewed business change, installed policy and
  // execution authority are separate and remain explicitly false.
  return result('OBSERVED_ONLY','PUBLIC_CI_COMPLETION_SOURCE_OBSERVED',{
   runId:run.id,attempt:run.run_attempt,headSha:run.head_sha,
   workflowId:SOURCE_WORKFLOW_ID,sourceJobId:jobs.jobs.find(j=>j.name==='public-source-only').id,
   reviewedWorkflowBlobSha:SOURCE_WORKFLOW_BLOB
  });
 }catch{return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_API_READ_FAILED');}
}

export async function runPublicSourceCompletion(env=process.env){
 let event;
 try{
  const loc=env.GITHUB_EVENT_PATH;
  if(typeof loc!=='string'||!loc)throw Error('NO_EVENT');
  const stat=fs.lstatSync(loc);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>1_000_000)
   throw Error('EVENT_FORMAT');
  event=JSON.parse(fs.readFileSync(loc,'utf8'));
 }catch{return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_EVENT_FILE_UNAVAILABLE');}
 const token=env.GITHUB_TOKEN;
 if(typeof token!=='string'||!token||token.length>2048)
  return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_READ_TOKEN_UNAVAILABLE');
 const fetchJson=async route=>{
  const reply=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
   method:'GET',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28'}});
  if(!reply.ok)throw Error('GITHUB_READ_FAILED');
  const body=await reply.text();
  if(body.length>400000)throw Error('GITHUB_READ_SIZE');
  return JSON.parse(body);
 };
 return observePublicSourceCompletion({event,env,
  getRun:async id=>{
   if(!isId(id))throw Error('RUN_ID_DENIED');
   return fetchJson('actions/runs/'+id);
  },
  getJobs:async(id,attempt)=>{
   if(!isId(id)||!isId(attempt))throw Error('JOB_LOOKUP_ID_DENIED');
   return fetchJson('actions/runs/'+id+'/attempts/'+attempt+'/jobs?per_page=100');
  },
  getWorkflow:async(path,revision)=>{
   if(path!==SOURCE_PATH||!isSha(revision))throw Error('WORKFLOW_LOOKUP_DENIED');
   return fetchJson('contents/'+path+'?ref='+revision);
  }
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outcome=await runPublicSourceCompletion();
 process.stdout.write(JSON.stringify(outcome)+'\n');
 // A failed read never becomes an authorizing approval or a successful proof.
 if(outcome.state!=='OBSERVED_ONLY')process.exitCode=1;
}
