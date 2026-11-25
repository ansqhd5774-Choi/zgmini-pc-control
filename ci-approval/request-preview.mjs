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
  const checked=inspectPinnedManifestScope(snapshot);
  if(checked.state!=='EXACT_MANIFEST_SCOPE_MATCH_ONLY')return out(checked.state,checked.reason);
  const writer=snapshot.effect==='B_WRITER_SOURCE';
  const labels=writer?[ISSUE_LABEL]:['pc-maintenance'];
  if(writer){
   const m=JSON.parse(snapshot.observation.bytes.toString('utf8'));
   if(m.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_2400S_V1')labels.push(EXTENDED_DRAIN_LABEL);
   if(m.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_1200S_V1')labels.push(DRAIN_1200_LABEL);
  }
  const body=JSON.stringify(snapshot.request);
  const preview=Object.freeze({repository_full_name:repo,title:writer?ISSUE_TITLE:'pc-controller-update',labels:Object.freeze(labels),body});
  return out('REQUEST_PREVIEW_ONLY','TRUSTED_ISSUANCE_AND_ONE_SHOT_SUBMISSION_REQUIRED',{
   requestId:checked.requestId,manifestSha256:checked.manifestSha256,targetSha:checked.targetSha,
   bodySha256:digest(body),preview});
 }catch{return out('INVALID','PREVIEW_INPUT_INVALID')}
}
