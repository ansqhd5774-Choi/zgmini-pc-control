// Read-only event intake, not a trust root or approval. Never execute candidate
// code here. The follow-up must independently establish authority, tested tree,
// exact effect and live preconditions before any operational submission.
import {createHash} from 'node:crypto';
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

// Approval records may be merged after source CI completes. Observe the
// actual main publication as a second input to the SAME pipeline. Neither
// publication nor CI success is authority by itself. No request IDs or POSTs.
export async function observePublishedControllerApprovals(event,{getJson}={}){
 if(!sameRepo(event?.repository)||event.ref!=='refs/heads/main'||event.deleted!==false||
    event.forced!==false||!sha(event.before)||!sha(event.after)||event.before===event.after||
    /^0{40}$/.test(event.before)||/^0{40}$/.test(event.after))
  return out('IGNORED','NOT_ELIGIBLE_MAIN_PUBLICATION');
 if(typeof getJson!=='function')return out('EVIDENCE_MISSING','AUTHENTICATED_READ_PORT_REQUIRED');
 const before=event.before,after=event.after;
 try{
  const diff=await getJson('compare/'+before+'...'+after);
  if(diff?.status!=='ahead'||diff.behind_by!==0||diff.base_commit?.sha!==before||
     diff.merge_base_commit?.sha!==before||!Array.isArray(diff.files)||diff.files.length>=300)
   return out('EVIDENCE_MISSING','PUBLICATION_DIFF_INCOMPLETE');
  const entries=[];
  for(const file of diff.files){
   const match=typeof file?.filename==='string'&&file.filename.match(/^approvals\/controller-updates\/([a-f0-9]{40})\.json$/);
   if(!match)continue;
   const item={path:file.filename,targetSha:match[1],revision:after};
   if(file.status!=='added'||!sha(file.sha)){
    entries.push({...item,state:'EXISTING_APPROVAL_CHANGE_REQUIRES_REVIEW'});continue;
   }
   try{
    const found=await getJson('contents/'+file.filename+'?ref='+after);
    if(found?.type!=='file'||found.path!==file.filename||found.sha!==file.sha||
       found.encoding!=='base64'||typeof found.content!=='string'||found.content.length>100000)
     throw Error('APPROVAL_BYTES_UNAVAILABLE');
    const bytes=Buffer.from(found.content,'base64');
    const blob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
    const manifest=JSON.parse(bytes.toString('utf8'));
    if(bytes.length===0||bytes.length>65536||blob!==file.sha||
       manifest?.schema!=='ZGMINI_PC_UPDATE_V1'||manifest.targetSha!==match[1])
     throw Error('APPROVAL_BYTES_MISMATCH');
    entries.push({...item,state:'EXISTING_MANIFEST_OBSERVED_ONLY',blobSha:blob,
     manifestSha256:createHash('sha256').update(bytes).digest('hex')});
   }catch{entries.push({...item,state:'APPROVAL_READ_UNVERIFIED'});}
  }
  return out(entries.length?'APPROVAL_PUBLICATION_OBSERVED_ONLY':'IGNORED',
   entries.length?'MATCH_SOURCE_CI_AND_EXISTING_EXECUTION_CONTRACT':'NO_CONTROLLER_APPROVAL_CHANGE',{entries});
 }catch{return out('EVIDENCE_MISSING','PUBLICATION_READ_FAILED')}
}

export async function main({eventPath=process.env.GITHUB_EVENT_PATH,token=process.env.GITHUB_TOKEN}={}){
 const eventName=process.env.GITHUB_EVENT_NAME;
 if(!eventPath||!token||!['workflow_run','push'].includes(eventName)||process.env.GITHUB_REPOSITORY!==repo)
  return out('EVIDENCE_MISSING','WORKFLOW_CONTEXT_UNVERIFIED');
 let event;
 try{event=JSON.parse(readFileSync(eventPath,'utf8'));}catch{return out('EVIDENCE_MISSING','EVENT_READ_FAILED')}
 const getJson=async route=>{
  const res=await fetch('https://api.github.com/repos/'+repo+'/'+route,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}});
  if(!res.ok)throw Error('READ_HTTP_FAILED');
  return res.json();
 };
 if(eventName==='push')return observePublishedControllerApprovals(event,{getJson});
 return observeCompletedRun(event,{getRun:async runId=>{
  if(!id(runId))throw Error('RUN_ID_INVALID');
  return getJson('actions/runs/'+runId);
 }});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await main();
 console.log(JSON.stringify(result));
 if(result.state==='EVIDENCE_MISSING')process.exitCode=1;
}
