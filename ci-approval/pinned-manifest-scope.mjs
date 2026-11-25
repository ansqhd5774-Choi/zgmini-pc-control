// Compare a pinned existing B manifest with an exact requested effect.
// This is an observation, not an authorization; independent pin origin,
// live evidence, one-shot claim, and operational authorization remain separate.
import {inspectPinnedApprovalSource} from './approval-source-integrity.mjs';
import {inspectExistingContract} from './contract-adapter.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(v=>Object.hasOwn(x,v));
const sha=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export function inspectPinnedManifestScope({effect,pin,observation,request,context,targetSha,requestState}={}){
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
 return out('EXACT_MANIFEST_SCOPE_MATCH_ONLY','INDEPENDENT_AUTHORITY_AND_LIVE_CLAIM_REQUIRED',{effect,targetSha,requestId:request.requestId,manifestSha256:pin.sha256,revision:pin.revision});
}
