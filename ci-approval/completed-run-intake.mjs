// Read-only event intake, not a trust root or approval. Never execute candidate
// code here. The follow-up must independently establish authority, tested tree,
// exact effect and live preconditions before any operational submission.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {resolveControllerApprovalCI,createCiEffectReceiptStore,submitExistingControllerApprovalFromCi,mergeAndSubmitPreparedControllerApproval} from '../tools/maintenance-request.mjs';
import {manifestFingerprint} from '../tools/maintenance-contract.mjs';
import {prepareSelectiveApprovalPublication} from './controller-candidate-review.mjs';
import {publishExactControllerApprovalPair} from './approval-pr-publisher.mjs';

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
    const observed={...item,state:'EXISTING_MANIFEST_OBSERVED_ONLY',blobSha:blob,
     manifestSha256:createHash('sha256').update(bytes).digest('hex')};
    // Match the approval's own merged PR to its successful CI; no execution
    // identity, request allocation, or write access is needed for this step.
    try{
     observed.sourceCI=await resolveControllerApprovalCI(manifest.approval?.ref,{
      readApprovalPr:n=>getJson('pulls/'+n),
      listRuns:head=>getJson('actions/workflows/'+workflowId+'/runs?head_sha='+head+'&event=pull_request&status=success&per_page=100'),
      readRun:n=>getJson('actions/runs/'+n)});
     observed.ciState='SOURCE_CI_MATCH_ONLY';
    }catch(error){
     observed.ciState='SOURCE_CI_UNVERIFIED';
     observed.ciCode=/^MAINTENANCE_CI_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'SOURCE_CI_READ_FAILED';
    }
    entries.push(observed);
   }catch{entries.push({...item,state:'APPROVAL_READ_UNVERIFIED'});}
  }
  return out(entries.length?'APPROVAL_PUBLICATION_OBSERVED_ONLY':'IGNORED',
   entries.length?'MATCH_SOURCE_CI_AND_EXISTING_EXECUTION_CONTRACT':'NO_CONTROLLER_APPROVAL_CHANGE',{entries});
 }catch{return out('EVIDENCE_MISSING','PUBLICATION_READ_FAILED')}
}

// Connect the existing approval publication intake to the existing submitter.
// The production workflow must pin this code and separately configure its
// durable receipt root and the installed receiver policy. No candidate code,
// arbitrary request input, new business approval, or PC-side write here.
// Read the original, independently configured delegation pin. This configuration
// is never obtained from the candidate PR, manifest, event payload or Issue.
// The existing delegation validator still authenticates the direct owner and
// exact grant bytes; this adapter is not an approval issuer.
export function createAutoApprovalContextReader({policy,getJson,readJobLogs}={}){
 const validDigest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const root='repos/'+repo+'/';
 const config=structuredClone(policy);
 if(!config||!sha(config.targetSha)||!id(config.approvalPrNumber)||!id(config.sourcePrNumber)||
    config.approvalPrNumber===config.sourcePrNumber||!sha(config.sourceWorkflowBlobSha)||
    !validDigest(config.businessApprovalSha256)||!sha(config.policyRevision)||
    !id(config.delegationPin?.issueNumber)||!id(config.delegationPin?.commentId)||
    !validDigest(config.delegationPin?.bodySha256)||
    typeof config.sourceBranch!=='string'||!/^codex\/[a-z0-9][a-z0-9-]{3,94}$/.test(config.sourceBranch)||
    typeof getJson!=='function'||typeof readJobLogs!=='function')
  throw Error('CI_PUBLICATION_AUTO_POLICY_UNVERIFIED');
 const readFileBytes=async(repository,revision,path)=>{
  if(repository!==repo||!(revision==='main'||sha(revision))||typeof path!=='string'||
     !(/^(?:controller\/[a-z][a-z0-9-]*\.mjs|approvals\/(?:controller-updates|controller-selective-targets)\/[a-f0-9]{40}\.json|\.github\/workflows\/controller-maintenance-source-tests\.yml)$/.test(path)))
   throw Error('CI_PUBLICATION_SOURCE_INVALID');
  const f=await getJson('contents/'+path+'?ref='+revision);
  if(f?.type!=='file'||f.path!==path||f.encoding!=='base64'||typeof f.content!=='string'||
     f.content.length>3000000||!sha(f.sha))throw Error('CI_PUBLICATION_SOURCE_UNVERIFIED');
  const bytes=Buffer.from(f.content,'base64');
  if(!bytes.length||bytes.length>2*1024*1024||
     createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')!==f.sha)
   throw Error('CI_PUBLICATION_SOURCE_UNVERIFIED');
  return bytes;
 };
 return async(targetSha,approvalPrNumber)=>{
  if(targetSha!==config.targetSha||approvalPrNumber!==config.approvalPrNumber)
   throw Error('CI_PUBLICATION_AUTO_POLICY_SCOPE_MISMATCH');
  const pr=await getJson('pulls/'+approvalPrNumber);
  if(pr?.number!==approvalPrNumber||pr.base?.ref!=='main'||pr.base?.repo?.full_name!==repo||
     pr.head?.repo?.full_name!==repo||!sha(pr.head?.sha))throw Error('CI_PUBLICATION_PR_INVALID');
  const bytes=await readFileBytes(repo,pr.head.sha,'approvals/controller-updates/'+targetSha+'.json');
  const m=JSON.parse(bytes.toString('utf8'));
  if(m.targetSha!==targetSha||m.purpose!=='pc-controller-maintenance'||
     m.selectiveSource?.branch!==config.sourceBranch||!sha(m.installedSha))
   throw Error('CI_PUBLICATION_AUTO_POLICY_SCOPE_MISMATCH');
  const fp=manifestFingerprint(m.allowFiles);
  const delegation={pin:structuredClone(config.delegationPin),baseSha:m.installedSha,
   scope:{effect:'B_CONTROLLER_INSTALL',businessApprovalSha256:config.businessApprovalSha256,
    policyRevision:config.policyRevision,sourceRepository:repo,sourceBranch:config.sourceBranch,
    purpose:m.purpose,changedPaths:fp.files.map(f=>f.path),targetSha,scopeDigest:fp.sha256,
    // This flag is supplied by the independently configured business scope,
    // not inferred from the path names or candidate-provided evidence.
    authorityChangesExcluded:config.authorityChangesExcluded===true}};
  return {policy:structuredClone(config),delegation,readFileBytes,readJobLogs,
   getJson:route=>{
    if(route==='repos/'+repo)return getJson('');
    if(typeof route!=='string'||!route.startsWith(root)||
       !/^(?:issues\/\d+|issues\/comments\/\d+|branches\/(?:main|codex%2F[a-z0-9-]+)|compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}|git\/commits\/[a-f0-9]{40}|pulls\/\d+|actions\/runs\/\d+(?:\/attempts\/\d+\/jobs\?per_page=100)?|actions\/workflows\/416355595\/runs\?head_sha=[a-f0-9]{40}&event=pull_request&status=success&per_page=100)$/.test(route.slice(root.length)))
     throw Error('CI_PUBLICATION_SOURCE_INVALID');
    return getJson(route.slice(root.length));
   }};
 };
}
// Until the exact approval PR number is allocated, the initial event port
// cannot use the approval-PR reconstruction context. It is created only
// after staging has revalidated the independent owner grant and actual PR.
export function initialControllerPublicationPolicy(policy){
 return policy?.installPlan ? null : policy;
}
export function createControllerPublicationPorts({getJson,postIssue,store,autoApprovalPolicy,readJobLogs,putMerge}){
 const readBytes=async(target,revision)=>{
  if(!sha(target)||!(revision==='main'||sha(revision)))throw Error('CI_PUBLICATION_SOURCE_INVALID');
  const path='approvals/controller-updates/'+target+'.json';
  const f=await getJson('contents/'+path+'?ref='+revision);
  if(f?.type!=='file'||f.path!==path||f.encoding!=='base64'||typeof f.content!=='string'||f.content.length>65536)
   throw Error('CI_PUBLICATION_SOURCE_UNVERIFIED');
  const bytes=Buffer.from(f.content,'base64');
  const blob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
  if(!bytes.length||bytes.length>32768||blob!==f.sha)throw Error('CI_PUBLICATION_SOURCE_UNVERIFIED');
  return bytes;
 };
 return {
  readRepository:()=>getJson(''),readManifest:target=>readBytes(target,'main'),
  readMergedManifest:readBytes,readApprovalPr:n=>{if(!id(n))throw Error('CI_PUBLICATION_PR_INVALID');return getJson('pulls/'+n);},
  listRuns:head=>{if(!sha(head))throw Error('CI_PUBLICATION_SOURCE_INVALID');return getJson('actions/workflows/'+workflowId+'/runs?head_sha='+head+'&event=pull_request&status=success&per_page=100');},
  readRun:n=>{if(!id(n))throw Error('CI_PUBLICATION_RUN_INVALID');return getJson('actions/runs/'+n);},
  readIssue:n=>{if(!id(n))throw Error('CI_PUBLICATION_ISSUE_INVALID');return getJson('issues/'+n);},
  async readApprovalPrFiles(n){
   if(!id(n))throw Error('CI_PUBLICATION_PR_INVALID');
   const rows=await getJson('pulls/'+n+'/files?per_page=100');
   if(!Array.isArray(rows)||rows.length>=100)throw Error('CI_PUBLICATION_PR_FILES_UNVERIFIED');
   return rows;
  },
  async findPriorRequests(target){
   if(!sha(target))throw Error('CI_PUBLICATION_SOURCE_INVALID');
   const matches=[];
   // Direct paginated issue inventory avoids search-index lag. Only return
   // relevant request envelopes; incomplete reads stop new submissions.
   for(let page=1;page<=100;page++){
    const rows=await getJson('issues?state=all&labels=pc-maintenance&per_page=100&page='+page);
    if(!Array.isArray(rows))throw Error('CI_PUBLICATION_PRIOR_READ_UNVERIFIED');
    for(const row of rows){
     if(row?.pull_request||row?.title!=='pc-controller-update')continue;
     try{if(JSON.parse(row.body).targetControllerSha===target)matches.push(row);}catch{}
    }
    if(rows.length<100)return matches;
   }
   throw Error('CI_PUBLICATION_PRIOR_READ_INCOMPLETE');
  },
  createIssue:expected=>postIssue({title:expected.title,body:expected.body,labels:expected.labels}),
  loadReceipt:store.loadReceipt,saveReceipt:store.saveReceipt,
  ...(autoApprovalPolicy&&typeof putMerge==='function'?{mergeApprovalPr:(n,head)=>{
   if(!id(n)||n!==autoApprovalPolicy.approvalPrNumber||!sha(head))
    throw Error('CI_PUBLICATION_PR_INVALID');
   return putMerge(n,{sha:head,merge_method:'merge'});
  }}:{}),
  ...(autoApprovalPolicy?{readAutoApprovalContext:createAutoApprovalContextReader({policy:autoApprovalPolicy,getJson,readJobLogs})}:{}),
 };
}
export async function publishExistingControllerApprovals(event,{getJson,ports,runId,attempt,emitReceipt}={}){
 if(!id(runId)||!id(attempt)||typeof emitReceipt!=='function')throw Error('CI_PUBLICATION_RUN_INVALID');
 const seen=await observePublishedControllerApprovals(event,{getJson});
 if(seen.state!=='APPROVAL_PUBLICATION_OBSERVED_ONLY')return {state:seen.state,code:seen.reason,results:[]};
 const results=[];
 for(const entry of seen.entries){
  if(entry.state!=='EXISTING_MANIFEST_OBSERVED_ONLY'||entry.ciState!=='SOURCE_CI_MATCH_ONLY'){
   results.push({targetSha:entry.targetSha,status:'NOT_SUBMITTED',code:entry.ciCode??entry.state});continue;
  }
  try{
   const outcome=await submitExistingControllerApprovalFromCi({targetSha:entry.targetSha,
    approvalSha256:entry.manifestSha256,runId,attempt},ports);
   if(outcome.status==='REQUEST_READBACK_VERIFIED')emitReceipt(outcome.receiptMarker);
   const {receiptMarker,...result}=outcome;results.push({targetSha:entry.targetSha,...result});
  }catch(error){
   const code=/^(?:MAINTENANCE|CI_PUBLICATION)_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'CI_PUBLICATION_ADAPTER_FAILED';
   results.push({targetSha:entry.targetSha,status:'STATE_UNKNOWN',code});
  }
 }
 // A per-effect failure must not erase another successfully emitted receipt.
 // This is the outcome of the publishing step, not a PC execution PASS.
 return {state:'PUBLICATION_PROCESSED',results};
}
// A single independently configured prepared effect, not a free-form event
// target. Source completion and source merge can arrive in either order.
// No subsequent bot-generated PR CI or push event is required for submission.

// Construct publication evidence exclusively from independently configured
// business scope. This path is used BEFORE allocating an approval PR number.
// Candidate branches, event bodies and candidate manifest text cannot supply
// or enlarge any of these parameters.
export function createConfiguredSelectivePreparer({policy,getJson,readJobLogs}={}){
 const cfg=structuredClone(policy);
 const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const plan=cfg?.installPlan;
 if(!cfg||!sha(cfg.targetSha)||!sha(cfg.sourceMainSha)||!id(cfg.sourcePrNumber)||
    !sha(cfg.sourceWorkflowBlobSha)||!sha(cfg.policyRevision)||
    !digest(cfg.businessApprovalSha256)||!id(cfg.delegationPin?.issueNumber)||
    !id(cfg.delegationPin?.commentId)||!digest(cfg.delegationPin?.bodySha256)||
    typeof cfg.sourceBranch!=='string'||!/^codex\/[a-z0-9][a-z0-9-]{3,94}$/.test(cfg.sourceBranch)||
    !plan||plan.targetSha!==cfg.targetSha||!sha(plan.installedSha)||
    plan.installedSha===cfg.targetSha||plan.purpose!=='pc-controller-maintenance'||
    plan.postOperation!=='core-status'||!Array.isArray(plan.allowFiles)||
    plan.allowFiles.length===0||plan.allowFiles.length>32||
    typeof getJson!=='function'||typeof readJobLogs!=='function')
  throw Error('CI_APPROVAL_STAGING_POLICY_INVALID');
 const fp=manifestFingerprint(plan.allowFiles);
 const branch='codex/ci-controller-b-'+cfg.targetSha;
 const delegation={pin:cfg.delegationPin,baseSha:plan.installedSha,
  scope:{effect:'B_CONTROLLER_INSTALL',businessApprovalSha256:cfg.businessApprovalSha256,
   policyRevision:cfg.policyRevision,sourceRepository:repo,sourceBranch:cfg.sourceBranch,
   purpose:plan.purpose,changedPaths:fp.files.map(x=>x.path),
   targetSha:cfg.targetSha,scopeDigest:fp.sha256,
   authorityChangesExcluded:cfg.authorityChangesExcluded===true}};
 const readFileBytes=async(repository,revision,path)=>{
  if(repository!==repo||!sha(revision)||typeof path!=='string'||!/^controller\/[a-z][a-z0-9-]*\.mjs$|^\.github\/workflows\/controller-maintenance-source-tests\.yml$/.test(path))
   throw Error('CI_APPROVAL_STAGE_SOURCE_INVALID');
  const item=await getJson('contents/'+path+'?ref='+revision);
  if(item?.type!=='file'||item.path!==path||item.encoding!=='base64'||!sha(item.sha)||
     typeof item.content!=='string'||item.content.length>3000000)
   throw Error('CI_APPROVAL_STAGE_SOURCE_UNVERIFIED');
  const bytes=Buffer.from(item.content,'base64');
  if(!bytes.length||bytes.length>2*1024*1024||
     createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')!==item.sha)
   throw Error('CI_APPROVAL_STAGE_SOURCE_UNVERIFIED');
  return bytes;
 };
 const root='repos/'+repo+'/';
 const rootRead=route=>{
  if(route==='repos/'+repo)return getJson('');
  if(typeof route!=='string'||!route.startsWith(root)||!/^(?:issues\/\d+|issues\/comments\/\d+|branches\/(?:main|codex%2F[a-z0-9-]+)|compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}|git\/commits\/[a-f0-9]{40}|pulls\/\d+|actions\/runs\/\d+(?:\/attempts\/\d+\/jobs\?per_page=100)?|actions\/workflows\/416355595\/runs\?head_sha=[a-f0-9]{40}&event=pull_request&status=success&per_page=100)$/.test(route.slice(root.length)))
   throw Error('CI_APPROVAL_STAGE_ROUTE_DENIED');
  return getJson(route.slice(root.length));
 };
 return {
  branch,plan:Object.freeze(plan),policy:cfg,
  // The original owner grant has an explicit validity window. Re-evaluate
  // UTC now on every attempt, including after a PR-number bootstrap.
  // Never take time from an event, candidate, PR or configuration.
  prepare:n=>prepareSelectiveApprovalPublication({
   plan,delegation:{...delegation,now:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')},
   sourcePrNumber:cfg.sourcePrNumber,
   approvalPrNumber:n,sourceMainSha:cfg.sourceMainSha,policy:cfg,getJson:rootRead,
   readFileBytes,readJobLogs})
 };
}
// REST ports are limited to one target-derived branch and a fixed two-file PR;
// no arbitrary path, branch, API token, shell or repository setting is supplied
// by the event or candidate PR. GitHub's normal PR merge protection still
// applies after publication.
export function createControllerPrPublicationIo({getJson,github,targetSha}={}){
 if(!sha(targetSha)||typeof getJson!=='function'||typeof github!=='function')
  throw Error('CI_APPROVAL_PR_PORTS_INVALID');
 const branch='codex/ci-controller-b-'+targetSha,paths=[
  'approvals/controller-updates/'+targetSha+'.json',
  'approvals/controller-selective-targets/'+targetSha+'.json'];
 const branchRoute='git/ref/heads/'+encodeURIComponent(branch);
 const checkTree=v=>{
  if(!Array.isArray(v?.tree)||v.tree.length<1||v.tree.length>2||v.tree.some(f=>
     !paths.includes(f.path)||f.mode!=='100644'||f.type!=='blob'||typeof f.content!=='string'))
   throw Error('CI_APPROVAL_PR_TREE_DENIED');
  return v;
 };
 return {
  readRepository:()=>getJson(''),
  readMain:()=>getJson('branches/main'),
  readCommit:sha40=>{if(!sha(sha40))throw Error('CI_APPROVAL_PR_SHA_INVALID');
   return getJson('git/commits/'+sha40);},
  async readBranch(name){
   if(name!==branch)throw Error('CI_APPROVAL_PR_BRANCH_DENIED');
   try{return await getJson(branchRoute);}
   catch(e){if(e?.status===404)return null;throw e;}
  },
  async readPrs(name){
   if(name!==branch)throw Error('CI_APPROVAL_PR_BRANCH_DENIED');
   const rows=await getJson('pulls?state=all&head=ansqhd5774-Choi:'+branch+'&per_page=100');
   if(!Array.isArray(rows)||rows.length>=100)throw Error('CI_APPROVAL_PR_INVENTORY_UNVERIFIED');
   return rows;
  },
  readPr:n=>{if(!id(n))throw Error('CI_APPROVAL_PR_ID_INVALID');return getJson('pulls/'+n);},
  readPrFiles:n=>{if(!id(n))throw Error('CI_APPROVAL_PR_ID_INVALID');
   return getJson('pulls/'+n+'/files?per_page=100');},
  async readBytes(revision,path){
   if(!sha(revision)||!paths.includes(path))throw Error('CI_APPROVAL_PR_SOURCE_DENIED');
   const item=await getJson('contents/'+path+'?ref='+revision);
   if(item?.type!=='file'||item.path!==path||item.encoding!=='base64'||
      !sha(item.sha)||typeof item.content!=='string'||item.content.length>65536)
    throw Error('CI_APPROVAL_PR_BYTES_UNVERIFIED');
   const bytes=Buffer.from(item.content,'base64');
   if(!bytes.length||bytes.length>32768||
     createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')!==item.sha)
    throw Error('CI_APPROVAL_PR_BYTES_UNVERIFIED');
   return bytes;
  },
  createTree:v=>github('git/trees',checkTree(v),'POST'),
  createCommit:v=>{
   if(!sha(v?.tree)||!Array.isArray(v.parents)||v.parents.length!==1||!sha(v.parents[0]))
    throw Error('CI_APPROVAL_PR_COMMIT_DENIED');
   return github('git/commits',v,'POST');
  },
  createBranch:v=>{
   if(v?.ref!=='refs/heads/'+branch||!sha(v.sha))throw Error('CI_APPROVAL_PR_BRANCH_DENIED');
   return github('git/refs',v,'POST');
  },
  createPr:v=>{
   if(v?.head!==branch||v.base!=='main'||v.draft!==false)
    throw Error('CI_APPROVAL_PR_INPUT_DENIED');
   return github('pulls',v,'POST');
  },
  updateBranch:(name,v)=>{
   if(name!==branch||!sha(v?.sha)||v.force!==false)
    throw Error('CI_APPROVAL_PR_BRANCH_DENIED');
   return github(branchRoute,v,'PATCH');
  }
 };
}

export async function publishConfiguredControllerApproval(event,{getJson,ports,policy,runId,attempt,emitReceipt,stageApprovalPr}={}){
 if(!policy||!sha(policy.targetSha)||!id(policy.sourcePrNumber)||
    !(id(policy.approvalPrNumber)||typeof stageApprovalPr==='function')||
    !id(runId)||!id(attempt)||typeof emitReceipt!=='function')
  throw Error('CI_PUBLICATION_AUTO_POLICY_UNVERIFIED');
 const source=await getJson('pulls/'+policy.sourcePrNumber);
 if(source?.number!==policy.sourcePrNumber||source.base?.ref!=='main'||
    source.base?.repo?.full_name!==repo||source.head?.repo?.full_name!==repo||
    !sha(source.head?.sha))
  return {state:'EVIDENCE_MISSING',code:'CONFIGURED_SOURCE_PR_UNVERIFIED',results:[]};
 if(source.merged!==true||!sha(source.merge_commit_sha))
  return {state:'IGNORED',code:'CONFIGURED_SOURCE_NOT_MERGED',results:[]};
 let matched=false;
 if(event?.action==='completed'){
  const seen=await observeCompletedRun(event,{getRun:n=>getJson('actions/runs/'+n)});
  if(seen.state==='EVIDENCE_MISSING')return {state:seen.state,code:seen.reason,results:[]};
  matched=seen.state==='CI_COMPLETION_OBSERVED_ONLY'&&seen.headSha===source.head.sha;
 }else if(sameRepo(event?.repository)&&event.ref==='refs/heads/main'&&event.deleted===false&&event.forced===false&&
   sha(event.before)&&sha(event.after)&&event.before!==event.after){
  // Observe source merge becoming reachable on main, not an arbitrary push.
  const [before,after]=await Promise.all([getJson('compare/'+source.merge_commit_sha+'...'+event.before),
   getJson('compare/'+source.merge_commit_sha+'...'+event.after)]);
  const contains=(v,h)=>v?.base_commit?.sha===source.merge_commit_sha&&v.merge_base_commit?.sha===source.merge_commit_sha&&
   v.behind_by===0&&(h===source.merge_commit_sha?v.status==='identical':v.status==='ahead');
  matched=!contains(before,event.before)&&contains(after,event.after);
 }
 if(!matched)return {state:'IGNORED',code:'CONFIGURED_SOURCE_EVENT_NOT_MATCHED',results:[]};
 try{
  let selected={approvalPrNumber:policy.approvalPrNumber,ports};
  if(typeof stageApprovalPr==='function'){
   selected=await stageApprovalPr();
   if(selected?.state!=='EXACT_APPROVAL_PR_READY'||!id(selected.approvalPrNumber)||
      !selected.ports)throw Error('CI_APPROVAL_PR_PUBLICATION_UNVERIFIED');
  }
  const result=await mergeAndSubmitPreparedControllerApproval({targetSha:policy.targetSha,
   approvalPrNumber:selected.approvalPrNumber,runId,attempt},selected.ports);
  if(result.status==='REQUEST_READBACK_VERIFIED')emitReceipt(result.receiptMarker);
  const {receiptMarker,...safe}=result;
  return {state:'PUBLICATION_PROCESSED',results:[{targetSha:policy.targetSha,...safe}]};
 }catch(error){
  const code=/^(?:MAINTENANCE|CI_PUBLICATION)_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'CI_PUBLICATION_ADAPTER_FAILED';
  return {state:'PUBLICATION_PROCESSED',results:[{targetSha:policy.targetSha,status:'STATE_UNKNOWN',code}]};
 }
}
export async function main({eventPath=process.env.GITHUB_EVENT_PATH,token=process.env.GITHUB_TOKEN,publish=false}={}){
 const eventName=process.env.GITHUB_EVENT_NAME;
 if(!eventPath||!token||!['workflow_run','push'].includes(eventName)||process.env.GITHUB_REPOSITORY!==repo)
  return out('EVIDENCE_MISSING','WORKFLOW_CONTEXT_UNVERIFIED');
 let event;
 try{event=JSON.parse(readFileSync(eventPath,'utf8'));}catch{return out('EVIDENCE_MISSING','EVENT_READ_FAILED')}
 const github=async(route,body,method=body?'POST':'GET')=>{
  const res=await fetch('https://api.github.com/repos/'+repo+(route?'/'+route:''),{
   method,redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok){
   const error=Error(body?'CI_PUBLICATION_POST_FAILED':'READ_HTTP_FAILED');
   error.status=res.status;throw error;
  }
  return res.json();
 };
 const getJson=route=>github(route);
 if(publish){
  if(process.env.ZGMINI_CI_CONTROLLER_B_ENABLED!=='true'||
     process.env.GITHUB_REF!=='refs/heads/main'||(eventName==='push'&&process.env.GITHUB_SHA!==event.after)||
     process.env.RUNNER_NAME!=='zgmini-handoff-ci-spare-01'||os.hostname().toUpperCase()!=='DESKTOP-N62L0NG')
   return {state:'DISABLED',code:'CI_PUBLICATION_CONTEXT_DENIED',results:[]};
  const store=createCiEffectReceiptStore(process.env.ZGMINI_CI_CONTROLLER_B_RECEIPT_ROOT);
  let policy;
  try{if(process.env.ZGMINI_CI_CONTROLLER_B_POLICY)policy=JSON.parse(process.env.ZGMINI_CI_CONTROLLER_B_POLICY);}
  catch{return {state:'EVIDENCE_MISSING',code:'CI_PUBLICATION_AUTO_POLICY_UNVERIFIED',results:[]};}
  // GitHub supplies a temporary signed log URL. Fetch follows the standard
  // cross-origin redirect without forwarding the Authorization header.
  const readJobLogs=async n=>{
   if(!id(n))throw Error('CI_PUBLICATION_RUN_INVALID');
   const response=await fetch('https://api.github.com/repos/'+repo+'/actions/jobs/'+n+'/logs',{
    method:'GET',redirect:'follow',signal:AbortSignal.timeout(60000),
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}});
   if(!response.ok)throw Error('CI_PUBLICATION_CI_LOG_UNVERIFIED');
   const bytes=await response.text();
   if(bytes.length>16000000)throw Error('CI_PUBLICATION_CI_LOG_UNVERIFIED');
   return bytes;
  };
  const ports=createControllerPublicationPorts({getJson,postIssue:body=>github('issues',body),store,
   autoApprovalPolicy:initialControllerPublicationPolicy(policy),readJobLogs,
   putMerge:(n,body)=>github('pulls/'+n+'/merge',body,'PUT')});
  const opts={getJson,ports,runId:Number(process.env.GITHUB_RUN_ID),
   attempt:Number(process.env.GITHUB_RUN_ATTEMPT),emitReceipt:marker=>console.log(marker)};
  if(policy){
   const stageApprovalPr=policy.installPlan?async()=>{
    const prepared=createConfiguredSelectivePreparer({policy,getJson,readJobLogs});
    const io=createControllerPrPublicationIo({getJson,github,targetSha:policy.targetSha});
    const staged=await publishExactControllerApprovalPair({targetSha:policy.targetSha,
     sourcePrNumber:policy.sourcePrNumber,sourceMainSha:policy.sourceMainSha,
     prepare:prepared.prepare,io});
    if(staged.state!=='EXACT_APPROVAL_PR_READY')return staged;
    const readyPolicy={...policy,approvalPrNumber:staged.prNumber};
    return {state:staged.state,approvalPrNumber:staged.prNumber,
     ports:createControllerPublicationPorts({getJson,postIssue:body=>github('issues',body),
      store,autoApprovalPolicy:readyPolicy,readJobLogs,
      putMerge:(n,body)=>github('pulls/'+n+'/merge',body,'PUT')})};
   }:undefined;
   const result=await publishConfiguredControllerApproval(event,{...opts,policy,stageApprovalPr});
   if(result.state!=='IGNORED')return result;
  }
  if(eventName==='push')return publishExistingControllerApprovals(event,opts);
  return {state:'IGNORED',code:'NO_CONFIGURED_SOURCE_EVENT',results:[]};
 }
 if(eventName==='push')return observePublishedControllerApprovals(event,{getJson});
 return observeCompletedRun(event,{getRun:async runId=>{
  if(!id(runId))throw Error('RUN_ID_INVALID');
  return getJson('actions/runs/'+runId);
 }});
}
// Keep CI's exit status aligned with the individual submission outcomes.
// A completed step is not a successful request when an eligible effect was
// withheld or its creation/readback remains unknown. Never retry the POST.
export function ciPublicationExitCode(result,{publish=false}={}){
 // An explicitly invoked submission on an untrusted host or without its
 // configured identity must fail, not produce an apparently green CI job.
 if(result?.state==='EVIDENCE_MISSING'||(publish&&result?.state==='DISABLED'))return 1;
 if(result?.state!=='PUBLICATION_PROCESSED')return 0;
 if(!Array.isArray(result.results)||result.results.length===0)return 1;
 return result.results.every(item=>item?.status==='REQUEST_READBACK_VERIFIED'||
  item?.status==='EXISTING_REQUEST_REUSED')?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await main({publish:process.argv[2]==='--publish-existing'});
 console.log(JSON.stringify(result));
 process.exitCode=ciPublicationExitCode(result,{publish:process.argv[2]==='--publish-existing'});
}
