// Build a deterministic request preview from an existing exact B manifest.
// No POST, approval issuance, actor impersonation, or operational authorization.
// Retain the original requestId; the existing submission/claim contract owns IO.
import {createHash} from 'node:crypto';
import {inspectPinnedManifestScope} from './pinned-manifest-scope.mjs';
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
