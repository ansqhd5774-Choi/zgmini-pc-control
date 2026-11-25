// Compare a pinned existing B manifest with an exact requested effect.
// This is an observation, not an authorization; independent pin origin,
// live evidence, one-shot claim, and operational authorization remain separate.
import {createHash} from 'node:crypto';
import {inspectPinnedApprovalSource} from './approval-source-integrity.mjs';
import {inspectExistingContract} from './contract-adapter.mjs';
import {validateUpdateRequest,validateControllerSelectivePin,validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(v=>Object.hasOwn(x,v));
const sha=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export function inspectPinnedManifestScope({effect,pin,observation,request,context,targetSha,requestState,selectivePin,selectiveObservation}={}){
 if(!['B_CONTROLLER_INSTALL','B_WRITER_SOURCE'].includes(effect))return out('OUT_OF_SCOPE','EFFECT_NOT_IN_PILOT');
 if(requestState==='CONSUMED'||requestState==='UNKNOWN')return out('WAIT_RESOURCE','RECONCILE_EXISTING_REQUEST');
 if(requestState!=='NEW')return out('EVIDENCE_MISSING','REQUEST_STATE_UNCONFIRMED');
 if(!sha(targetSha,40)||!request||!context)return out('INVALID','REQUEST_SCOPE_INVALID');
 const integrity=inspectPinnedApprovalSource(pin,observation);
 if(integrity.state!=='PIN_MATCH_ONLY')return out(integrity.state,integrity.reason);
 if(effect==='B_CONTROLLER_INSTALL'&&!/^approvals\/controller-updates\//.test(pin.path))
  return out('OUT_OF_SCOPE','CONTROLLER_MANIFEST_PATH_REQUIRED');
 if(effect==='B_WRITER_SOURCE'&&!/^approvals\/writer-updates\//.test(pin.path))
  return out('OUT_OF_SCOPE','WRITER_MANIFEST_PATH_REQUIRED');
 if(request.approvalManifestSha256!==pin.sha256)return out('REJECTED','REQUEST_MANIFEST_PIN_MISMATCH');
 let checked;
 if(effect==='B_CONTROLLER_INSTALL'){
  checked=inspectExistingContract(effect,{request,manifestBytes:observation.bytes,context});
 }else{
  if(!exact(request,['schema','requestId','chatId','operation','controlRepository','approvalManifestPath','approvalManifestSha256'])||
   request.schema!=='ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1'||request.operation!=='pc-writer-source-install'||
   request.controlRepository!==repo||!uuid(request.requestId)||!uuid(request.chatId)||request.approvalManifestPath!==pin.path)
   return out('REJECTED','WRITER_REQUEST_SCOPE_MISMATCH');
  checked=inspectExistingContract(effect,{manifestBytes:observation.bytes,expectedDigest:pin.sha256,observedHead:context.observedHead,observedConfigSha:context.observedConfigSha});
 }
 if(checked.state!=='CONTRACT_MATCH')return out('REJECTED',checked.reason);
 if(checked.targetSha!==targetSha||checked.scopeDigest!==pin.sha256)return out('REJECTED','TARGET_OR_SCOPE_MISMATCH');
 // Existing selective B approvals require a second immutable source pin.
 // This does not authorize new candidate issuance or expand the delegation pilot.
 if(effect==='B_CONTROLLER_INSTALL'){
  try{
   const {manifest}=validateUpdateRequest(request,observation.bytes,context);
   if(manifest.selectiveSource){
    if(!manifest.allowFiles.every(f=>/^controller\/[a-z][a-z0-9-]*\.mjs$/.test(f.path)))
     return out('OUT_OF_SCOPE','SELECTIVE_PATH_OUTSIDE_PILOT');
    if(!selectivePin||!selectiveObservation)return out('EVIDENCE_MISSING','SELECTIVE_PIN_REQUIRED');
    if(pin.path!=='approvals/controller-updates/'+targetSha+'.json'||selectivePin.path!=='approvals/controller-selective-targets/'+targetSha+'.json'||selectivePin.revision!==pin.revision)
     return out('REJECTED','SELECTIVE_PIN_SOURCE_MISMATCH');
    const second=inspectPinnedApprovalSource(selectivePin,selectiveObservation);
    if(second.state!=='PIN_MATCH_ONLY')return out(second.state,second.reason);
    validateControllerSelectivePin(manifest,JSON.parse(selectiveObservation.bytes.toString('utf8')));
    return out('SELECTIVE_MANIFEST_PIN_MATCH_ONLY','INDEPENDENT_AUTHORITY_TREE_AND_LIVE_CLAIM_REQUIRED',{effect,targetSha,requestId:request.requestId,manifestSha256:pin.sha256,selectivePinSha256:selectivePin.sha256,revision:pin.revision});
   }
   if(selectivePin!==undefined||selectiveObservation!==undefined)return out('REJECTED','UNEXPECTED_SELECTIVE_PIN');
  }catch{return out('REJECTED','SELECTIVE_CONTRACT_REJECTED')}
 }
 return out('EXACT_MANIFEST_SCOPE_MATCH_ONLY','INDEPENDENT_AUTHORITY_AND_LIVE_CLAIM_REQUIRED',{effect,targetSha,requestId:request.requestId,manifestSha256:pin.sha256,revision:pin.revision});
}

// Read-only selective overlay evidence. The ports must have independently
// authenticated provenance; these observations are never approval or live CAS.
export async function inspectSelectiveTree(input,{getJson,readFileBytes}={}){
 try{
  const snapshot=structuredClone(input);
  for(const k of ['observation','selectiveObservation']){
   if(!Buffer.isBuffer(input?.[k]?.bytes))return out('EVIDENCE_MISSING','SELECTIVE_SOURCE_BYTES_REQUIRED');
   snapshot[k].bytes=Buffer.from(input[k].bytes);
  }
  const checked=inspectPinnedManifestScope(snapshot);
  if(checked.state!=='SELECTIVE_MANIFEST_PIN_MATCH_ONLY')return out(checked.state,checked.reason);
  if(typeof getJson!=='function'||typeof readFileBytes!=='function')return out('EVIDENCE_MISSING','SELECTIVE_READ_PORTS_REQUIRED');
  const {manifest:m}=validateUpdateRequest(snapshot.request,snapshot.observation.bytes,snapshot.context);
  const x=m.selectiveSource,root='repos/'+repo,revision=checked.revision;
  const mainPath=root+'/branches/main',branchPath=root+'/branches/'+encodeURIComponent(x.branch);
  const compare=(base,head)=>getJson(root+'/compare/'+base+'...'+head);
  const current=(b,name,head)=>b?.name===name&&b.commit?.sha===head;
  const ancestor=(c,base,head)=>c?.base_commit?.sha===base&&c.merge_base_commit?.sha===base&&c.behind_by===0&&
   (base===head?c.status==='identical'&&c.ahead_by===0:c.status==='ahead'&&Number.isSafeInteger(c.ahead_by)&&c.ahead_by>0);
  const n=Number(m.approval.ref.split('/').at(-1));
  const [main,branch,commit,diff,pr,sourceLineage]=await Promise.all([
   getJson(mainPath),getJson(branchPath),getJson(root+'/git/commits/'+m.targetSha),compare(m.installedSha,m.targetSha),
   getJson(root+'/pulls/'+n),compare(x.mainSha,revision)]);
  if(!current(main,'main',revision)||!current(branch,x.branch,m.targetSha))return out('EVIDENCE_MISSING','SELECTIVE_BRANCH_DRIFT');
  if(commit?.sha!==m.targetSha||!Array.isArray(commit.parents)||commit.parents.length!==1||commit.parents[0]?.sha!==m.installedSha)
   return out('REJECTED','SELECTIVE_TARGET_PARENT_MISMATCH');
  if(!ancestor(diff,m.installedSha,m.targetSha)||diff.total_commits!==1||diff.ahead_by!==1||!Array.isArray(diff.commits)||diff.commits.length!==1||diff.commits[0]?.sha!==m.targetSha||!Array.isArray(diff.files)||diff.files.length<1||diff.files.length>32)
   return out('EVIDENCE_MISSING','SELECTIVE_DIFF_INCOMPLETE');
  if(diff.files.some(f=>!['added','modified'].includes(f?.status)||typeof f.filename!=='string')||new Set(diff.files.map(f=>f.filename.toLowerCase())).size!==diff.files.length)
   return out('REJECTED','SELECTIVE_DIFF_SHAPE');
  const paths=diff.files.map(f=>f.filename).sort(),declared=m.allowFiles.map(f=>f.path).sort();
  if(JSON.stringify(paths)!==JSON.stringify(declared))return out('REJECTED','SELECTIVE_NONSCOPED_DIFF');
  validateControllerOnlyInstallDelta(paths,m.allowFiles);
  if(!ancestor(sourceLineage,x.mainSha,revision))return out('REJECTED','SELECTIVE_SOURCE_NOT_ON_MAIN');
  if(pr?.number!==n||pr.merged!==true||pr.base?.ref!=='main'||pr.base?.repo?.full_name!==repo||!sha(pr.merge_commit_sha,40))
   return out('REJECTED','SELECTIVE_APPROVAL_PR_NOT_MERGED');
  if(!ancestor(await compare(pr.merge_commit_sha,revision),pr.merge_commit_sha,revision))
   return out('REJECTED','SELECTIVE_APPROVAL_NOT_ON_MAIN');
  const mergedPin=await readFileBytes(repo,pr.merge_commit_sha,snapshot.selectivePin.path);
  if(!Buffer.isBuffer(mergedPin)||!mergedPin.equals(snapshot.selectiveObservation.bytes))
   return out('REJECTED','SELECTIVE_APPROVAL_PIN_BYTES_MISMATCH');
  validateControllerSelectivePin(m,JSON.parse(mergedPin.toString('utf8')));
  for(const f of m.allowFiles){
   const revisions=x.customPaths.includes(f.path)?[m.targetSha]:[m.targetSha,x.mainSha];
   for(const rev of revisions){
    const bytes=await readFileBytes(repo,rev,f.path);
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>2*1024*1024)return out('EVIDENCE_MISSING','SELECTIVE_FILE_BYTES_MISSING');
    if(createHash('sha256').update(bytes).digest('hex')!==f.sha256)return out('REJECTED','SELECTIVE_FILE_HASH_MISMATCH');
   }
  }
  const [lastMain,lastBranch]=await Promise.all([getJson(mainPath),getJson(branchPath)]);
  if(!current(lastMain,'main',revision)||!current(lastBranch,x.branch,m.targetSha))return out('EVIDENCE_MISSING','SELECTIVE_BRANCH_DRIFT');
  return out('SELECTIVE_TREE_MATCH_ONLY','INDEPENDENT_AUTHORITY_CI_AND_LIVE_CLAIM_REQUIRED',{targetSha:m.targetSha,installedSha:m.installedSha,revision,approvalMergeSha:pr.merge_commit_sha,selectivePinSha256:checked.selectivePinSha256,changedPaths:paths});
 }catch{return out('EVIDENCE_MISSING','SELECTIVE_TREE_READ_OR_CONTRACT_FAILED')}
}
