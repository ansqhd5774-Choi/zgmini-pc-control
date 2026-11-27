#!/usr/bin/env node
// A GitHub-hosted, READ-ONLY observer of successful source CI in the Public
// control repository. No approval issuance, Issue POST, workflow dispatch,
// self-hosted Runner access, local policy input or Controller/Writer execution.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control',REPO_ID=1442936296;
const OWNER='ansqhd5774-Choi',OWNER_ID=327938088;
const SOURCE_WORKFLOW_ID=416355595;
const SOURCE_PATH='.github/workflows/controller-maintenance-source-tests.yml';
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

export async function observePublicSourceCompletion({event,env,getRun}={}){
 if(env?.GITHUB_EVENT_NAME!=='workflow_run'||
    env.GITHUB_REPOSITORY!==REPO||env.GITHUB_REF!=='refs/heads/main'||
    env.RUNNER_ENVIRONMENT!=='github-hosted'||!isSha(env.GITHUB_SHA)|| 
    event?.action!=='completed'||!isPublicRepo(event.repository)||
    !validRun(event.workflow_run))
  return result('IGNORED','PUBLIC_CI_COMPLETION_EVENT_NOT_ELIGIBLE');
 if(typeof getRun!=='function')
  return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_READ_PORT_MISSING');
 const expected=event.workflow_run;
 try{
  const run=await getRun(expected.id);
  if(!validRun(run)||run.id!==expected.id||
     run.run_attempt!==expected.run_attempt||run.head_sha!==expected.head_sha)
   return result('EVIDENCE_MISSING','PUBLIC_CI_COMPLETION_API_MISMATCH');
  // Exact event/API comparison is still NOT trust in the PR, approval scope,
  // installed policy, receiver identity or a license to submit a B request.
  return result('OBSERVED_ONLY','PUBLIC_CI_COMPLETION_SOURCE_OBSERVED',{
   runId:run.id,attempt:run.run_attempt,headSha:run.head_sha,
   workflowId:SOURCE_WORKFLOW_ID
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
 return observePublicSourceCompletion({event,env,getRun:async id=>{
  if(!isId(id))throw Error('RUN_ID_DENIED');
  const url='https://api.github.com/repos/'+REPO+'/actions/runs/'+id;
  const reply=await fetch(url,{method:'GET',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28'}});
  if(!reply.ok)throw Error('GITHUB_READ_FAILED');
  const body=await reply.text();
  if(body.length>150000)throw Error('GITHUB_READ_SIZE');
  return JSON.parse(body);
 }});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outcome=await runPublicSourceCompletion();
 process.stdout.write(JSON.stringify(outcome)+'\n');
 // A failed read never becomes an authorizing approval or a successful proof.
 if(outcome.state!=='OBSERVED_ONLY')process.exitCode=1;
}
