// End-to-end Controller B shadow orchestration. No publisher or execution adapter.
// Independent read provenance, semantic review, and live authorization remain
// requirements. Never turn this receipt into an APPROVED_B manifest.
import {createHash} from 'node:crypto';
import {buildControllerCandidate} from './contract-adapter.mjs';
import {collectDelegatedScope} from './delegation-evidence-reader.mjs';
import {inspectIntegrationTree} from './integration-tree-evidence.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export async function reviewControllerCandidate({plan,delegation,ci,live,getJson,readFileBytes}={}){
 try{
  const proposed=buildControllerCandidate(plan);
  if(proposed.state!=='CANDIDATE_ONLY')return out(proposed.state,proposed.reason);
  const candidate=proposed.candidate,p=candidate.plan;
  if(p.purpose!=='pc-controller-maintenance')return out('OUT_OF_SCOPE','PURPOSE_NOT_IN_DELEGATION_PILOT');
  if(live?.requestState==='CONSUMED'||live?.requestState==='UNKNOWN')return out('WAIT_RESOURCE','RECONCILE_EXISTING_REQUEST');
  if(live?.resourceState==='BUSY')return out('WAIT_RESOURCE','RESOURCE_BUSY');
  if(live?.requestState!=='NEW'||live?.resourceState!=='READY'||live?.installedSha!==p.installedSha||live?.rollbackVerified!==true||live?.postcheckBound!==true)return out('EVIDENCE_MISSING','LIVE_PRECONDITIONS_UNVERIFIED');
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
  return out('CANDIDATE_REVIEW_MATCH_ONLY','INDEPENDENT_AUTHORITY_AND_LIVE_CLAIM_REQUIRED',{candidate,delegationSha256:observed.delegationSha256,testedSha:tree.testedSha,runId:tree.runId,jobId:tree.jobId});
 }catch{return out('EVIDENCE_MISSING','REVIEW_INPUT_OR_READ_FAILED')}
}
