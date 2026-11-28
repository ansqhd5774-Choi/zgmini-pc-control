// Build a deterministic request preview from an existing exact B manifest.
// No POST, approval issuance, actor impersonation, or operational authorization.
// Retain the original requestId; the existing submission/claim contract owns IO.
import {createHash} from 'node:crypto';
import {inspectPinnedManifestScope} from './pinned-manifest-scope.mjs';
import {verifyNativeInstalledProof} from './native-publisher-entry.mjs';
import {ISSUE_TITLE,ISSUE_LABEL,EXTENDED_DRAIN_LABEL,DRAIN_1200_LABEL} from '../writer-b/contract.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
const digest=b=>createHash('sha256').update(b).digest('hex');
export function prepareScopedRequestPreview(input){
 try{
  // Snapshot caller data so the bytes inspected and the request serialized agree.
  const snapshot=structuredClone(input);
  if(!Buffer.isBuffer(input?.observation?.bytes))return out('INVALID','SOURCE_BYTES_REQUIRED');
  snapshot.observation.bytes=Buffer.from(input.observation.bytes);
  if(input.selectiveObservation!==undefined){
   if(!Buffer.isBuffer(input.selectiveObservation?.bytes))return out('INVALID','SELECTIVE_SOURCE_BYTES_REQUIRED');
   snapshot.selectiveObservation.bytes=Buffer.from(input.selectiveObservation.bytes);
  }
  if(snapshot.effect!=='B_CONTROLLER_INSTALL'&&(snapshot.selectivePin!==undefined||snapshot.selectiveObservation!==undefined))
   return out('REJECTED','UNEXPECTED_SELECTIVE_PIN');
  const checked=inspectPinnedManifestScope(snapshot);
  const selective=checked.state==='SELECTIVE_MANIFEST_PIN_MATCH_ONLY';
  if(!selective&&checked.state!=='EXACT_MANIFEST_SCOPE_MATCH_ONLY')return out(checked.state,checked.reason);
  const writer=snapshot.effect==='B_WRITER_SOURCE';
  const labels=writer?[ISSUE_LABEL]:['pc-maintenance'];
  if(writer){
   const m=JSON.parse(snapshot.observation.bytes.toString('utf8'));
   if(m.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_2400S_V1')labels.push(EXTENDED_DRAIN_LABEL);
   if(m.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_1200S_V1')labels.push(DRAIN_1200_LABEL);
  }
  const body=JSON.stringify(snapshot.request);
  const preview=Object.freeze({repository_full_name:repo,title:writer?ISSUE_TITLE:'pc-controller-update',labels:Object.freeze(labels),body});
  // A selective preview is deliberately distinguishable from ordinary B.
  // Neither preview constitutes permission to submit, and the selective tree,
  // immutable main lineage and independent authority still require verification.
  return out(selective?'SELECTIVE_REQUEST_PREVIEW_ONLY':'REQUEST_PREVIEW_ONLY',
   selective?'SELECTIVE_TREE_AUTHORITY_AND_ONE_SHOT_SUBMISSION_REQUIRED':'TRUSTED_ISSUANCE_AND_ONE_SHOT_SUBMISSION_REQUIRED',{
   ...(selective?{selectivePinSha256:checked.selectivePinSha256,approvalRevision:checked.revision}:{}),
   requestId:checked.requestId,manifestSha256:checked.manifestSha256,targetSha:checked.targetSha,
   bodySha256:digest(body),preview});
 }catch{return out('INVALID','PREVIEW_INPUT_INVALID')}
}

// Convert a preallocated request identity into the existing exact envelope.
// The identity must come from the existing durable request/claim, not the CI
// run number or a newly generated UUID on each retry. This is preparation only;
// the trusted submitter still owns authority, live CAS and the one-shot ledger.
export function prepareExistingApprovalRequest(input){
 try{
  if(!input||Object.hasOwn(input,'request'))return out('INVALID','AMBIGUOUS_REQUEST_IDENTITY');
  const {requestIdentity,...scope}=input;
  if(!requestIdentity||Object.keys(requestIdentity).length!==2||
     !Object.hasOwn(requestIdentity,'requestId')||!Object.hasOwn(requestIdentity,'chatId'))
   return out('EVIDENCE_MISSING','EXISTING_REQUEST_IDENTITY_REQUIRED');
  if(!['B_CONTROLLER_INSTALL','B_WRITER_SOURCE'].includes(scope.effect))
   return out('OUT_OF_SCOPE','EFFECT_NOT_IN_PILOT');
  if(scope.requestState==='CONSUMED'||scope.requestState==='UNKNOWN')
   return out('WAIT_RESOURCE','RECONCILE_EXISTING_REQUEST');
  if(!Buffer.isBuffer(scope.observation?.bytes)||!scope.pin)
   return out('EVIDENCE_MISSING','SOURCE_BYTES_REQUIRED');
  const {requestId,chatId}=requestIdentity;
  const writer=scope.effect==='B_WRITER_SOURCE';
  const request=writer?{
   schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',requestId,chatId,
   operation:'pc-writer-source-install',controlRepository:repo,
   approvalManifestPath:scope.pin.path,approvalManifestSha256:scope.pin.sha256
  }:{
   schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId,chatId,
   operation:'controller-update',controlRepository:repo,
   targetControllerSha:scope.targetSha,approvalManifestSha256:scope.pin.sha256
  };
  return prepareScopedRequestPreview({...scope,request});
 }catch{return out('INVALID','EXISTING_APPROVAL_REQUEST_INVALID')}
}


// Prepare the exact #4135 native Public Writer scope using the existing
// approval preview. This is NOT an installed policy, proof or permission to
// write trusted roots. In particular, the final merged main SHA and the
// future first-attempt source CI HEAD are distinct pins; do not reuse an
// already completed PR event or the consumed original Writer request.
export const PUBLIC_WRITER_4135=Object.freeze({
 manifestPath:'approvals/writer-updates/us-breadth-paid-r2-guarded-fourfile-natural-idle-20261127.json',
 manifestSha256:'c4f58408f4360f7d03b9c359cda78ce4602c447d86ff15ad538cdb57d820acda',
 candidateSourceSha:'f7ea89305df8471ffb1827d974fc2e0c223d0b09',
 originalRequestId:'d1e33802-9e86-4b4b-ae20-6cfdb0c2c2b8',
 sourceWorkflowId:416355595,
 sourceWorkflowPath:'.github/workflows/controller-maintenance-source-tests.yml',
 receiverWorkflowPath:'.github/workflows/ci-approved-writer-b-once.yml',
 adapterPath:'ci-approval/native-writer-b-execute.mjs'
});
export function preparePublicWriter4135PolicyPreview({requestInput,sourceHeadSha,
 controlHead,installedControllerSha,sourceWorkflow,receiverWorkflow,adapter}={}){
 try{
  const fixed=PUBLIC_WRITER_4135,hex=(v,n)=>typeof v==='string'&&
   v.length===n&&/^[a-f0-9]+$/.test(v);
  const reject=reason=>out('REJECTED',reason);
  if(requestInput?.effect!=='B_WRITER_SOURCE'||
     requestInput?.pin?.path!==fixed.manifestPath||
     requestInput.pin.sha256!==fixed.manifestSha256||
     requestInput.targetSha!==fixed.candidateSourceSha||
     requestInput.requestIdentity?.requestId===fixed.originalRequestId)
   return reject('PUBLIC_WRITER_4135_SCOPE_MISMATCH');
  const request=prepareExistingApprovalRequest(requestInput);
  if(request.state!=='REQUEST_PREVIEW_ONLY')return request;
  if(![sourceHeadSha,controlHead,installedControllerSha].every(v=>hex(v,40))||
     sourceHeadSha===controlHead)
   return out('EVIDENCE_MISSING','PUBLIC_WRITER_EXACT_SOURCE_PINS_REQUIRED');
  const blob=bytes=>createHash('sha1')
   .update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  const pinned=(file,revision,path)=>file?.repository===repo&&
   file.revision===revision&&file.path===path&&hex(file.blobSha,40)&&
   Buffer.isBuffer(file.bytes)&&file.bytes.length>0&&file.bytes.length<=1048576&&
   blob(file.bytes)===file.blobSha;
  if(!pinned(sourceWorkflow,sourceHeadSha,fixed.sourceWorkflowPath)||
     !pinned(receiverWorkflow,controlHead,fixed.receiverWorkflowPath)||
     !pinned(adapter,controlHead,fixed.adapterPath))
   return out('EVIDENCE_MISSING','PUBLIC_WRITER_REVIEWED_BYTES_REQUIRED');
  const proposedPolicy=Object.freeze({
   schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,effect:'B_WRITER_SOURCE',
   repositoryVisibility:'public',sourceRunMode:'EVENT_COMPLETION_V1',
   sourceAttempt:1,sourceWorkflowId:fixed.sourceWorkflowId,
   sourceHeadSha,sourceWorkflowPath:fixed.sourceWorkflowPath,
   sourceWorkflowBlobSha:sourceWorkflow.blobSha,
   receiverWorkflowPath:fixed.receiverWorkflowPath,
   receiverWorkflowBlobSha:receiverWorkflow.blobSha,
   businessApprovalSha256:fixed.manifestSha256,approvedRequestSha256:request.bodySha256,
   policyRevision:controlHead,installedControllerSha,
   nativeWriterBExecutionEnabled:true,nativeWriterBControlSha:controlHead,
   nativeWriterBAdapterSha256:digest(adapter.bytes)
  });
  // No installed-proof construction and no file/variable/dispatch IO here.
  // The independent deployment must prove actual main lineage, fresh CI
  // event, current host CAS/ACLs, and exact one-shot scope installation.
  return out('PUBLIC_WRITER_POLICY_PREVIEW_ONLY',
   'INDEPENDENT_INSTALLATION_AND_FRESH_CI_EVENT_REQUIRED',{
    canInstall:false,operationalWrites:0,requestId:request.requestId,
    body:request.preview.body,bodySha256:request.bodySha256,
    proposedPolicy,proposedPolicySha256:digest(JSON.stringify(proposedPolicy))});
 }catch{return out('INVALID','PUBLIC_WRITER_POLICY_PREVIEW_INVALID')}
}


// Prepare *only* the two fixed local files required by the already existing
// Native Writer B readers. No local IO, policy installation, variable change,
// dispatch, or authority. Must be called by a trusted Owner adapter with an
// authenticated GitHub Contents read from the actual B maintenance receipt.
// The caller must still apply separate per-host CAS/ACL, backup/rollback and
// independent durable one-shot claim checks. Never log or publish file bytes.
export async function preparePublicWriter4135LocalBundleCandidate({
 preview,approvedManifestBytes,installationRequestId,getJson
}={}){
 const reject=reason=>out('REJECTED',reason,{canInstall:false,operationalWrites:0});
 const missing=reason=>out('EVIDENCE_MISSING',reason,{canInstall:false,operationalWrites:0});
 const fixed=PUBLIC_WRITER_4135,p=preview?.proposedPolicy;
 const pin=(v,n)=>typeof v==='string'&&v.length===n&&
  new RegExp('^[a-f0-9]{'+n+'}$').test(v);
 if(preview?.state!=='PUBLIC_WRITER_POLICY_PREVIEW_ONLY'||
   preview.mode!=='SHADOW_ONLY'||preview.canInstall!==false||
   preview.operationalWrites!==0||
   p?.schema!=='ZGMINI_CI_NATIVE_DISPATCH_V1'||p.enabled!==true||
   p.effect!=='B_WRITER_SOURCE'||p.repositoryVisibility!=='public'||
   p.sourceRunMode!=='EVENT_COMPLETION_V1'||p.sourceAttempt!==1||
   Object.hasOwn(p,'sourceRunId')||p.nativeWriterBExecutionEnabled!==true||
   p.sourceWorkflowId!==fixed.sourceWorkflowId||
   p.sourceWorkflowPath!==fixed.sourceWorkflowPath||
   p.receiverWorkflowPath!==fixed.receiverWorkflowPath||
   p.nativeWriterBControlSha!==p.policyRevision||
   !pin(p.installedControllerSha,40)||!pin(p.policyRevision,40)||
   p.businessApprovalSha256!==fixed.manifestSha256||
   !pin(p.approvedRequestSha256,64)||
   preview.proposedPolicySha256!==digest(JSON.stringify(p)))
  return reject('PUBLIC_WRITER_LOCAL_PREVIEW_SCOPE_DENIED');
 let requestBytes,request;
 try{
  requestBytes=Buffer.from(preview.body,'utf8');
  request=JSON.parse(requestBytes.toString('utf8'));
 }catch{return reject('PUBLIC_WRITER_LOCAL_REQUEST_INVALID');}
 if(request?.schema!=='ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1'||
   request.requestId!==preview.requestId||
   request.requestId===fixed.originalRequestId||
   request.operation!=='pc-writer-source-install'||
   request.controlRepository!==repo||
   request.approvalManifestPath!==fixed.manifestPath||
   request.approvalManifestSha256!==fixed.manifestSha256||
   digest(requestBytes)!==p.approvedRequestSha256||
   requestBytes.length<2||requestBytes.length>32768)
  return reject('PUBLIC_WRITER_LOCAL_REQUEST_MISMATCH');
 if(!Buffer.isBuffer(approvedManifestBytes)||
   approvedManifestBytes.length<2||approvedManifestBytes.length>65536||
   digest(approvedManifestBytes)!==fixed.manifestSha256)
  return reject('PUBLIC_WRITER_LOCAL_APPROVAL_BYTES_MISMATCH');
 if(!/^pc-update-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
   installationRequestId??'')||typeof getJson!=='function')
  return missing('PUBLIC_WRITER_LOCAL_INSTALL_RECEIPT_PORT_REQUIRED');
 const receiptPath='results/maintenance-'+installationRequestId+'.json';
 const route='contents/'+receiptPath+'?ref=main';
 let receiptBytes,receipt,file;
 try{
  file=await getJson(route);
  const raw=file?.content;
  if(file?.type!=='file'||file.path!==receiptPath||
     file.encoding!=='base64'||typeof raw!=='string'||
     raw.length<4||raw.length>Math.ceil(65536/3)*4+4||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))
   throw Error('RECEIPT_FORMAT');
  receiptBytes=Buffer.from(raw,'base64');
  if(receiptBytes.length<2||receiptBytes.length>65536||
     receiptBytes.toString('base64')!==raw)throw Error('RECEIPT_SIZE');
  receipt=JSON.parse(receiptBytes.toString('utf8'));
 }catch{return missing('PUBLIC_WRITER_LOCAL_INSTALLED_RECEIPT_UNVERIFIED');}
 // A Controller B receipt without the independently approved native effect
 // (including #4356) must not grant anything, even if Controller SHA matches.
 if(receipt?.requestId!==installationRequestId||
   receipt.ciNativeEffect!=='B_WRITER_SOURCE'||
   receipt.ciNativePolicySha256!==preview.proposedPolicySha256||
   receipt.status!=='SUCCEEDED'||receipt.protectedStateUnchanged!==true||
   receipt.actualControllerSha!==p.installedControllerSha||
   receipt.targetControllerSha!==p.installedControllerSha)
  return reject('PUBLIC_WRITER_LOCAL_INSTALL_EFFECT_UNVERIFIED');
 const proof={
  schema:'ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1',
  effect:'B_WRITER_SOURCE',policy:p,
  nativePolicySha256:preview.proposedPolicySha256,
  installationRequestId,installationReceiptPath:receiptPath,
  installationReceiptSha256:digest(receiptBytes),
  actualControllerSha:p.installedControllerSha
 };
 try{
  // Reuse the exact production publisher verifier; the only supplied
  // Contents response is bound to the fixed independently verified path.
  const checked=await verifyNativeInstalledProof('B_WRITER_SOURCE',proof,{
   getJson:async actualRoute=>{
    if(actualRoute!==route)throw Error('RECEIPT_ROUTE');
    return file;
   }
  });
  if(JSON.stringify(checked)!==JSON.stringify(p))
   throw Error('POLICY_MISMATCH');
 }catch{return reject('PUBLIC_WRITER_LOCAL_INSTALLED_PROOF_UNVERIFIED');}
 const scope={
  schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',policy:p,
  approvalBytesBase64:approvedManifestBytes.toString('base64'),
  requestBytesBase64:requestBytes.toString('base64')
 };
 const scopeBytes=Buffer.from(JSON.stringify(scope)+'\n');
 const proofBytes=Buffer.from(JSON.stringify(proof)+'\n');
 return out('PUBLIC_WRITER_LOCAL_BUNDLE_CANDIDATE_ONLY',
  'INDEPENDENT_HOST_CAS_ACL_INSTALL_AND_READBACK_REQUIRED',{
   canInstall:false,operationalWrites:0,
   nativePolicySha256:proof.nativePolicySha256,
   installationReceiptSha256:proof.installationReceiptSha256,
   scopeFile:Object.freeze({name:'ci-native-writer-b-approved.json',
    sha256:digest(scopeBytes),bytes:scopeBytes}),
   proofFile:Object.freeze({name:'ci-native-writer-b-installed-proof.json',
    sha256:digest(proofBytes),bytes:proofBytes})
  });
}
