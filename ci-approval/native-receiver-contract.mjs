// Read-only, fail-closed A / Writer B workflow_dispatch receiver inspection.
// The event, GitHub hashes, and a synthetic result are NEVER authorization.
// Caller must obtain policy and exact approval/request bytes independently
// from an installed trusted source, not from event inputs or candidate code.
// No receipt writes, network calls, PC execution, or process-local B seal.
import {createHash} from 'node:crypto';
import {nativeVisibilityMatches} from './native-visibility.mjs';
import {validateRequest} from '../controller/common.mjs';
import {validateWriterBRequestManifest,ISSUE_LABEL,EXTENDED_DRAIN_LABEL,DRAIN_1200_LABEL} from '../writer-b/contract.mjs';

const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
const ID=1442936296,BOT_ID=41898282,BOT='github-actions[bot]';
const WORKFLOWS=Object.freeze({
 A_READONLY:'.github/workflows/ci-approved-a-once.yml',
 B_WRITER_SOURCE:'.github/workflows/ci-approved-writer-b-once.yml'
});
const sha=(x,n)=>typeof x==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(x);
const id=n=>Number.isSafeInteger(n)&&n>0;
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const result=(state,code,more={})=>Object.freeze({
 state,code,canPublish:false,canExecute:false,canInstall:false,...more
});
const BOUND=32768,APPROVAL_BOUND=65536;
function checkFile(f,ref,path,expected){
 if(f?.type!=='file'||f.path!==path||f.ref!==ref||f.sha!==expected||
    f.encoding!=='base64'||typeof f.content!=='string'||
    !f.content.length||f.content.length>131072)return false;
 let bytes;try{bytes=Buffer.from(f.content,'base64');}catch{return false;}
 return bytes.length>0&&bytes.length<=APPROVAL_BOUND&&blob(bytes)===expected;
}

/**
 * Source-only inspection. On an operating receiver, policy/approvalBytes/
 * requestBytes must come from the independently installed scope and preimage,
 * while sourceRun and workflow files come from authenticated GitHub REST reads.
 * A match is not permission to call the existing owner-only engine/installer.
 */
export function inspectNativeReceiver({
 event,env,policy,approvalBytes,requestBytes,sourceRun,sourceWorkflow,receiverWorkflow
}={}){
 if(policy?.enabled!==true)return result('DISABLED','CI_NATIVE_RECEIVER_NOT_ENABLED');
 const effect=policy.effect,path=WORKFLOWS[effect];
 if((policy.sourceRunMode!==undefined&&
     policy.sourceRunMode!=='EVENT_COMPLETION_V1')||
    !path||policy.schema!=='ZGMINI_CI_NATIVE_DISPATCH_V1'||
    policy.receiverWorkflowPath!==path||!sha(policy.receiverWorkflowBlobSha,40)||
    !sha(policy.sourceHeadSha,40)||!sha(policy.sourceWorkflowBlobSha,40)||
    !id(policy.sourceRunId)||!id(policy.sourceAttempt)||!id(policy.sourceWorkflowId)||
    typeof policy.sourceWorkflowPath!=='string'||
    !/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(policy.sourceWorkflowPath)||
    !sha(policy.businessApprovalSha256,64)||!sha(policy.approvedRequestSha256,64)||
    !sha(policy.policyRevision,40))
  return result('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_INSTALLED_POLICY_INVALID');
 if(env?.GITHUB_REPOSITORY!==CONTROL||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
    env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||
    !sha(env.GITHUB_SHA,40)||env.GITHUB_ACTOR!==BOT||
    event?.repository?.id!==ID||event.repository.full_name!==CONTROL||
    !nativeVisibilityMatches(policy,effect,event.repository.private)||
    event.sender?.id!==BOT_ID||
    event.sender.login!==BOT||event.sender.type!=='Bot')
  return result('REJECTED','CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED');
 const inKeys=['effect','source_run_id','source_attempt','approval_sha256','request_sha256','effect_key'];
 const input=event.inputs;
 if(!exact(input,inKeys)||input.effect!==effect||
    input.source_run_id!==String(policy.sourceRunId)||
    input.source_attempt!==String(policy.sourceAttempt)||
    input.approval_sha256!==policy.businessApprovalSha256||
    input.request_sha256!==policy.approvedRequestSha256)
  return result('REJECTED','CI_NATIVE_RECEIVER_INPUT_SCOPE_MISMATCH');
 const effectKey=hash(JSON.stringify([effect,policy.businessApprovalSha256,
   policy.approvedRequestSha256]));
 if(input.effect_key!==effectKey)
  return result('REJECTED','CI_NATIVE_RECEIVER_EFFECT_KEY_MISMATCH');
 if(!Buffer.isBuffer(requestBytes)||requestBytes.length<1||requestBytes.length>BOUND||
    hash(requestBytes)!==policy.approvedRequestSha256||
    !Buffer.isBuffer(approvalBytes)||approvalBytes.length<1||
    approvalBytes.length>APPROVAL_BOUND||hash(approvalBytes)!==policy.businessApprovalSha256)
  return result('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_APPROVAL_OR_REQUEST_BYTES_MISSING');
 if(sourceRun?.id!==policy.sourceRunId||sourceRun.run_attempt!==policy.sourceAttempt||
    sourceRun.workflow_id!==policy.sourceWorkflowId||
    sourceRun.path!==policy.sourceWorkflowPath||
    sourceRun.head_sha!==policy.sourceHeadSha||sourceRun.status!=='completed'||
    sourceRun.conclusion!=='success'||sourceRun.event!=='pull_request'||
    sourceRun.repository?.id!==ID||sourceRun.repository.full_name!==CONTROL||
    !nativeVisibilityMatches(policy,effect,sourceRun.repository.private)||
    sourceRun.repository.private!==event.repository.private||
    sourceRun.head_repository?.id!==ID)
  return result('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_SOURCE_RUN_UNVERIFIED');
 if(!checkFile(sourceWorkflow,policy.sourceHeadSha,
   policy.sourceWorkflowPath,policy.sourceWorkflowBlobSha))
  return result('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_SOURCE_WORKFLOW_UNVERIFIED');
 if(!checkFile(receiverWorkflow,env.GITHUB_SHA,path,policy.receiverWorkflowBlobSha))
  return result('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_OWN_WORKFLOW_UNVERIFIED');
 try{
  const body=requestBytes.toString('utf8');
  if(effect==='A_READONLY'){
   const localPolicy=JSON.parse(approvalBytes.toString('utf8'));
   if(localPolicy?.mutationsEnabled!==false||!localPolicy.operations||
      !Array.isArray(localPolicy.allowedActors))
    return result('OUT_OF_SCOPE','CI_NATIVE_RECEIVER_A_POLICY_DENIED');
   const request=validateRequest(JSON.parse(body),localPolicy);
   if(localPolicy.operations[request.operation]?.grade!=='A')
    return result('OUT_OF_SCOPE','CI_NATIVE_RECEIVER_A_GRADE_DENIED');
  }else{
   const manifest=JSON.parse(approvalBytes.toString('utf8'));
   const labels=[{name:ISSUE_LABEL}];
   if(manifest.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_2400S_V1')
    labels.push({name:EXTENDED_DRAIN_LABEL});
   if(manifest.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_1200S_V1')
    labels.push({name:DRAIN_1200_LABEL});
   validateWriterBRequestManifest({body,labels,manifestBytes:approvalBytes});
  }
 }catch{
  return result('OUT_OF_SCOPE','CI_NATIVE_RECEIVER_EXISTING_CONTRACT_REJECTED');
 }
 return result('CONTRACT_MATCH_ONLY','CI_NATIVE_RECEIVER_INDEPENDENT_EVIDENCE_MATCH',{
  effect,effectKey,sourceRunId:policy.sourceRunId,
  requestSha256:policy.approvedRequestSha256,
  approvalSha256:policy.businessApprovalSha256,
  receiverWorkflowBlobSha:policy.receiverWorkflowBlobSha
 });
}
