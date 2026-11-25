// End-to-end Controller B shadow orchestration. No publisher or execution adapter.
// Independent read provenance, semantic review, and live authorization remain
// requirements. Never turn this receipt into an APPROVED_B manifest.
import {createHash} from 'node:crypto';
import {buildControllerCandidate} from './contract-adapter.mjs';
import {collectDelegatedScope} from './delegation-evidence-reader.mjs';
import {inspectIntegrationTree} from './integration-tree-evidence.mjs';
import {resolveControllerApprovalCI} from '../tools/maintenance-request.mjs';
import {prepareControllerUpdateRequest,validateControllerSelectivePin,validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export async function reviewControllerCandidate({plan,delegation,ci,live,getJson,readFileBytes}={}){
 try{
  const proposed=buildControllerCandidate(plan);
  if(proposed.state!=='CANDIDATE_ONLY')return out(proposed.state,proposed.reason);
  const candidate=proposed.candidate,p=candidate.plan;
  if(p.purpose!=='pc-controller-maintenance')return out('OUT_OF_SCOPE','PURPOSE_NOT_IN_DELEGATION_PILOT');
  // Source-only preparation is independent of the operating PC. The existing
  // combined review keeps all live checks when a live context is provided.
  const sourceOnly=live===undefined;
  if(!sourceOnly){
   if(live?.requestState==='CONSUMED'||live?.requestState==='UNKNOWN')return out('WAIT_RESOURCE','RECONCILE_EXISTING_REQUEST');
   if(live?.resourceState==='BUSY')return out('WAIT_RESOURCE','RESOURCE_BUSY');
   if(live?.requestState!=='NEW'||live?.resourceState!=='READY'||live?.installedSha!==p.installedSha||live?.rollbackVerified!==true||live?.postcheckBound!==true)return out('EVIDENCE_MISSING','LIVE_PRECONDITIONS_UNVERIFIED');
  }
  if(typeof readFileBytes!=='function'||typeof getJson!=='function'||!delegation?.scope||!ci?.expected)return out('EVIDENCE_MISSING','READ_ADAPTER_OR_EVIDENCE_MISSING');
  if(delegation.scope.effect!=='B_CONTROLLER_INSTALL'||delegation.scope.purpose!==p.purpose||delegation.scope.targetSha!==p.targetSha||delegation.scope.scopeDigest!==candidate.fileManifestSha256||delegation.baseSha!==p.installedSha)return out('REJECTED','DELEGATION_CANDIDATE_BINDING_MISMATCH');
  const tree=inspectIntegrationTree(ci);
  if(tree.state!=='INTEGRATION_TREE_MATCH_ONLY')return out(tree.state,tree.reason);
  if(tree.headSha!==p.targetSha||!sha(tree.testedSha))return out('REJECTED','CI_CANDIDATE_BINDING_MISMATCH');
  const observed=await collectDelegatedScope({...delegation,getJson});
  if(observed.state!=='DELEGATED_DIFF_OBSERVED_ONLY')return out(observed.state,observed.reason);
  const paths=p.allowFiles.map(f=>f.path).sort();
  if(JSON.stringify(paths)!==JSON.stringify(observed.changedPaths))return out('REJECTED','DIFF_MANIFEST_PATH_MISMATCH');
  // Both the candidate and the actually tested integration tree must contain
  // the exact approved candidate file bytes. This is not full semantic proof.
  const repo=delegation.scope.sourceRepository;
  for(const f of p.allowFiles){
   for(const revision of [p.targetSha,tree.testedSha]){
    const bytes=await readFileBytes(repo,revision,f.path);
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>2*1024*1024)return out('EVIDENCE_MISSING','FILE_BYTES_UNAVAILABLE');
    if(digest(bytes)!==f.sha256)return out('REJECTED','FILE_BYTES_MISMATCH');
   }
  }
  return out(sourceOnly?'SOURCE_REVIEW_MATCH_ONLY':'CANDIDATE_REVIEW_MATCH_ONLY',sourceOnly?'LIVE_CHECKS_DEFERRED_TO_EXECUTION':'INDEPENDENT_AUTHORITY_AND_LIVE_CLAIM_REQUIRED',{candidate,delegationSha256:observed.delegationSha256,testedSha:tree.testedSha,runId:tree.runId,jobId:tree.jobId});
 }catch{return out('EVIDENCE_MISSING','REVIEW_INPUT_OR_READ_FAILED')}
}

// Materialize the existing two-file selective installation contract from
// authenticated, independently pinned business scope and source CI. This
// prepares exact publication bytes, not an approval publication or a PC write.
// sourcePr and approvalPr are intentionally different roles: the former is the
// tested source; the latter will carry the manifest and pin. No new grant is
// inferred from a green CI or an approval PR number.
export async function prepareSelectiveApprovalPublication({
 plan,delegation,sourcePrNumber,approvalPrNumber,sourceMainSha,policy,
 getJson,readFileBytes,readJobLogs
}={}){
 const repo='ansqhd5774-Choi/zgmini-pc-control',root='repos/'+repo;
 const id=x=>Number.isSafeInteger(x)&&x>0;
 const fail=(state,reason)=>({state,reason,canPublish:false,canExecute:false});
 const ancestor=(v,a,b)=>v?.base_commit?.sha===a&&v.merge_base_commit?.sha===a&&v.behind_by===0&&
  (a===b?v.status==='identical':v.status==='ahead');
 const compare=(a,b)=>getJson(root+'/compare/'+a+'...'+b);
 try{
  const proposed=buildControllerCandidate(plan);
  if(proposed.state!=='CANDIDATE_ONLY')return fail(proposed.state,proposed.reason);
  const candidate=proposed.candidate,p=candidate.plan,scope=delegation?.scope;
  if(p.purpose!=='pc-controller-maintenance'||p.postOperation!=='core-status'||
     !p.allowFiles.every(f=>/^controller\/[a-z][a-z0-9-]*\.mjs$/.test(f.path)))
   return fail('OUT_OF_SCOPE','SELECTIVE_PUBLICATION_SCOPE_DENIED');
  if(!id(sourcePrNumber)||!id(approvalPrNumber)||sourcePrNumber===approvalPrNumber||!sha(sourceMainSha)||
     !sha(policy?.sourceWorkflowBlobSha)||!policy?.delegationPin||
     JSON.stringify(policy.delegationPin)!==JSON.stringify(delegation?.pin)||
     typeof getJson!=='function'||typeof readFileBytes!=='function'||typeof readJobLogs!=='function')
   return fail('EVIDENCE_MISSING','INDEPENDENT_PUBLICATION_POLICY_REQUIRED');
  if(scope?.effect!=='B_CONTROLLER_INSTALL'||scope.sourceRepository!==repo||scope.purpose!==p.purpose||
     scope.targetSha!==p.targetSha||scope.scopeDigest!==candidate.fileManifestSha256||
     delegation.baseSha!==p.installedSha||scope.businessApprovalSha256!==policy.businessApprovalSha256)
   return fail('REJECTED','SELECTIVE_PUBLICATION_DELEGATION_MISMATCH');
  // The existing owner delegation reader authenticates the direct owner
  // comment and pinned bytes. The independent policy links that grant to
  // the original approved business effect; a candidate cannot set policy.
  const observed=await collectDelegatedScope({...delegation,getJson});
  if(observed.state!=='DELEGATED_DIFF_OBSERVED_ONLY')return fail(observed.state,observed.reason);
  const paths=p.allowFiles.map(f=>f.path).sort();
  if(JSON.stringify(paths)!==JSON.stringify(observed.changedPaths))
   return fail('REJECTED','SELECTIVE_PUBLICATION_DIFF_MISMATCH');
  validateControllerOnlyInstallDelta(paths,p.allowFiles);
  const overlay=await getJson(root+'/git/commits/'+p.targetSha);
  if(overlay?.sha!==p.targetSha||!Array.isArray(overlay.parents)||overlay.parents.length!==1||
     overlay.parents[0]?.sha!==p.installedSha)
   return fail('REJECTED','SELECTIVE_PUBLICATION_PARENT_MISMATCH');
  const pr=await getJson(root+'/pulls/'+sourcePrNumber);
  const sourceCI=await resolveControllerApprovalCI('https://github.com/'+repo+'/pull/'+sourcePrNumber,{
   readApprovalPr:async()=>pr,
   listRuns:h=>getJson(root+'/actions/workflows/416355595/runs?head_sha='+h+'&event=pull_request&status=success&per_page=100'),
   readRun:n=>getJson(root+'/actions/runs/'+n)});
  if(!sha(pr.merge_commit_sha)||!ancestor(await compare(pr.merge_commit_sha,sourceMainSha),pr.merge_commit_sha,sourceMainSha))
   return fail('REJECTED','SELECTIVE_PUBLICATION_SOURCE_LINEAGE_MISMATCH');
  const main=await getJson(root+'/branches/main');
  if(!sha(main?.commit?.sha)||!ancestor(await compare(sourceMainSha,main.commit.sha),sourceMainSha,main.commit.sha))
   return fail('REJECTED','SELECTIVE_PUBLICATION_SOURCE_NOT_ON_MAIN');
  const run=await getJson(root+'/actions/runs/'+sourceCI.runId);
  if(!id(run?.run_attempt))return fail('EVIDENCE_MISSING','SELECTIVE_PUBLICATION_CI_ATTEMPT_MISSING');
  const jobs=await getJson(root+'/actions/runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs?per_page=100');
  if(!Array.isArray(jobs?.jobs)||jobs.total_count!==jobs.jobs.length)
   return fail('EVIDENCE_MISSING','SELECTIVE_PUBLICATION_CI_JOBS_INCOMPLETE');
  const selected=jobs.jobs.filter(j=>j?.name==='source-only');
  if(selected.length!==1||!id(selected[0].id))return fail('REJECTED','SELECTIVE_PUBLICATION_CI_JOB_MISMATCH');
  const job=selected[0],logs=await readJobLogs(job.id);
  if(typeof logs!=='string'||logs.length>16000000)return fail('EVIDENCE_MISSING','SELECTIVE_PUBLICATION_CI_LOG_MISSING');
  const markers=logs.split(/\r?\n/).flatMap(line=>{
   const m=line.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z CI_TESTED_INTEGRATION_SHA=([a-f0-9]{40})$/);
   return m?[m[1]]:[];
  });
  if(markers.length!==1)return fail('REJECTED','SELECTIVE_PUBLICATION_CI_TREE_MISMATCH');
  const tested=await getJson(root+'/git/commits/'+markers[0]);
  const baseSha=tested?.parents?.[0]?.sha;
  const workflow=await readFileBytes(repo,markers[0],'.github/workflows/controller-maintenance-source-tests.yml');
  if(!Buffer.isBuffer(workflow))return fail('EVIDENCE_MISSING','SELECTIVE_PUBLICATION_CI_WORKFLOW_MISSING');
  const workflowBlobSha=createHash('sha1').update(Buffer.from('blob '+workflow.length+'\0')).update(workflow).digest('hex');
  const tree=inspectIntegrationTree({expected:{runId:sourceCI.runId,jobId:job.id,attempt:run.run_attempt,
   headSha:sourceCI.headSha,baseSha,workflowBlobSha:policy.sourceWorkflowBlobSha},run,job,logs,commit:tested,workflowBlobSha});
  if(tree.state!=='INTEGRATION_TREE_MATCH_ONLY')return fail(tree.state,tree.reason);
  // Selective target, merged source, and actual CI-tested tree can have
  // different commit IDs. Only the exact approved file bytes may match.
  for(const f of p.allowFiles){
   for(const revision of [p.targetSha,sourceMainSha,tree.testedSha]){
    const bytes=await readFileBytes(repo,revision,f.path);
    if(!Buffer.isBuffer(bytes)||!bytes.length||digest(bytes)!==f.sha256)
     return fail('REJECTED','SELECTIVE_PUBLICATION_FILE_BYTES_MISMATCH');
   }
  }
  const approvalRef='https://github.com/'+repo+'/pull/'+approvalPrNumber;
  const manifest={schema:'ZGMINI_PC_UPDATE_V1',installedSha:p.installedSha,targetSha:p.targetSha,
   allowFiles:p.allowFiles,purpose:p.purpose,approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:approvalRef},
   checks:{targetSha:p.targetSha,status:'PASS',manifestSha256:candidate.fileManifestSha256},
   backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:p.installedSha}},
   postOperation:p.postOperation,postSourceBranch:p.postSourceBranch,postSourceSha:p.postSourceSha,
   controllerOnlyInstall:true,selectiveSource:{schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
    branch:scope.sourceBranch,mainSha:sourceMainSha,customPaths:[]}};
  const pin={schema:'ZGMINI_CONTROLLER_SELECTIVE_PIN_V1',installedSha:p.installedSha,targetSha:p.targetSha,
   sourceMainSha,targetBranch:scope.sourceBranch,customPaths:[],allowFiles:p.allowFiles,approvalRef};
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  // Existing validators check the exact installation schema; no owner Issue
  // or authorized runtime result is created by this preparation step.
  prepareControllerUpdateRequest(manifestBytes,{installedSha:p.installedSha});
  validateControllerSelectivePin(manifest,pin);
  const pinBytes=Buffer.from(JSON.stringify(pin,null,2)+'\n');
  return {state:'SELECTIVE_APPROVAL_FILES_PREPARED',reason:'PUBLICATION_AND_RECEIVER_AUTHORITY_REQUIRED',
   canPublish:false,canExecute:false,sourcePrNumber,approvalPrNumber,sourceRunId:tree.runId,
   testedSha:tree.testedSha,targetSha:p.targetSha,delegationSha256:observed.delegationSha256,
   files:[{path:'approvals/controller-updates/'+p.targetSha+'.json',bytes:manifestBytes,sha256:digest(manifestBytes)},
    {path:'approvals/controller-selective-targets/'+p.targetSha+'.json',bytes:pinBytes,sha256:digest(pinBytes)}]};
 }catch(error){
  return fail('EVIDENCE_MISSING',/^(?:MAINTENANCE|UPDATE|SELECTIVE)_[A-Z0-9_]+$/.test(error?.message??'')?
   error.message:'SELECTIVE_PUBLICATION_PREPARATION_FAILED');
 }
}
