// A/Writer B CI-native wake-up transport. This is NOT an approval source,
// receiver authorization, PC runner or owner-impersonation mechanism.
// GITHUB_TOKEN-created Issues do not start an issues-triggered workflow;
// a pinned, independently installed receiver may instead be called with
// workflow_dispatch. The receiver MUST revalidate approval, CI provenance,
// local installed policy, effect claim and current runtime preimage.
import {createHash} from 'node:crypto';

const REPO='ansqhd5774-Choi/zgmini-pc-control', REPO_ID=1442936296;
const RECEIVERS=Object.freeze({
 A_READONLY:'.github/workflows/ci-approved-a-once.yml',
 B_WRITER_SOURCE:'.github/workflows/ci-approved-writer-b-once.yml'
});
const hex=(v,n)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const id=n=>Number.isSafeInteger(n)&&n>0;
const hash=b=>createHash('sha256').update(b).digest('hex');
const blobHash=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const denied=(state,code,extra={})=>Object.freeze({state,code,dispatched:false,executed:false,...extra});

/**
 * Transport only. policy MUST come from a trusted, independently installed
 * per-effect source (never PR contents or the triggered event). A successful
 * dispatch is not an approval or evidence of PC execution.
 *
 * Ports require independently authenticated REST reads, an installed receiver
 * readback, and an exclusive durable effect receipt store. No blind retries.
 */
export async function dispatchApprovedCiEffect({policy,requestBytes,ports}={}){
 if(!policy||policy.enabled!==true)return denied('DISABLED','CI_NATIVE_DISPATCH_POLICY_DISABLED');
 const effect=policy.effect,receiver=RECEIVERS[effect];
 if(!receiver||policy.schema!=='ZGMINI_CI_NATIVE_DISPATCH_V1'||
   policy.receiverWorkflowPath!==receiver||!hex(policy.receiverWorkflowBlobSha,40)||
   !id(policy.sourceRunId)||!id(policy.sourceAttempt)||!id(policy.sourceWorkflowId)||
   !hex(policy.sourceHeadSha,40)||!hex(policy.businessApprovalSha256,64)||
   !hex(policy.approvedRequestSha256,64)||!hex(policy.policyRevision,40)||
   typeof policy.sourceWorkflowPath!=='string'||
   !/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(policy.sourceWorkflowPath)||
   !Buffer.isBuffer(requestBytes)||!requestBytes.length||requestBytes.length>32768||
   hash(requestBytes)!==policy.approvedRequestSha256)
  return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_SCOPE_UNVERIFIED');
 const methods=['readSourceRun','readReceiverWorkflow','readInstalledReceiver','loadReceipt','saveReceipt','dispatchWorkflow'];
 if(!ports||methods.some(k=>typeof ports[k]!=='function'))
  return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_PORT_UNAVAILABLE');
 // An approval effect stays the same across policy or receiver revisions.
 // Excluding those transport versions from the claim key prevents reposts.
 const key=hash(JSON.stringify([effect,policy.businessApprovalSha256,
   policy.approvedRequestSha256]));
 let run,receiverFile,installed;
 try{
  [run,receiverFile,installed]=await Promise.all([
   ports.readSourceRun(policy.sourceRunId,policy.sourceAttempt),
   ports.readReceiverWorkflow(receiver,'main'),ports.readInstalledReceiver(effect)
  ]);
 }catch{return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_READ_UNVERIFIED',{effectKey:key});}
 if(run?.id!==policy.sourceRunId||run.run_attempt!==policy.sourceAttempt||
   run.workflow_id!==policy.sourceWorkflowId||run.path!==policy.sourceWorkflowPath||
   run.head_sha!==policy.sourceHeadSha||run.status!=='completed'||run.conclusion!=='success'||
   run.event!=='pull_request'||run.repository?.id!==REPO_ID||
   run.repository.full_name!==REPO||run.repository.private!==true||
   run.head_repository?.id!==REPO_ID)
  return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_RUN_UNVERIFIED',{effectKey:key});
 if(receiverFile?.type!=='file'||receiverFile.path!==receiver||
   receiverFile.encoding!=='base64'||receiverFile.sha!==policy.receiverWorkflowBlobSha||
   typeof receiverFile.content!=='string'||receiverFile.content.length>131072)
  return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_RECEIVER_PIN_UNVERIFIED',{effectKey:key});
 const receiverBytes=Buffer.from(receiverFile.content,'base64');
 if(!receiverBytes.length||receiverBytes.length>65536||
   blobHash(receiverBytes)!==policy.receiverWorkflowBlobSha)
  return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_RECEIVER_BYTES_UNVERIFIED',{effectKey:key});
 // Installed readback is separate from a repository blob or candidate claim.
 if(installed?.effect!==effect||installed?.enabled!==true||
   installed.receiverWorkflowBlobSha!==policy.receiverWorkflowBlobSha||
   installed.policyRevision!==policy.policyRevision||
   installed.approvedRequestSha256!==policy.approvedRequestSha256)
  return denied('EVIDENCE_MISSING','CI_NATIVE_DISPATCH_RECEIVER_NOT_ATTESTED',{effectKey:key});
 let prior;
 try{prior=await ports.loadReceipt(key);}catch{return denied('STATE_UNKNOWN','CI_NATIVE_DISPATCH_RECEIPT_READ_UNKNOWN',{effectKey:key});}
 if(prior!==null&&prior!==undefined){
  // Even a pending/unknown previous POST consumes the effect until a separate
  // verified reconciliation. Never issue a second dispatch from this function.
  return denied('STATE_UNKNOWN','CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST',{effectKey:key});
 }
 const inputs=Object.freeze({effect,source_run_id:String(policy.sourceRunId),
   source_attempt:String(policy.sourceAttempt),approval_sha256:policy.businessApprovalSha256,
   request_sha256:policy.approvedRequestSha256,effect_key:key});
 const record={schema:'ZGMINI_CI_NATIVE_DISPATCH_RECEIPT_V1',phase:'CREATING',
   effect,effectKey:key,receiver,ref:'main',inputs};
 try{await ports.saveReceipt(key,record,{exclusive:true});}
 catch{return denied('STATE_UNKNOWN','CI_NATIVE_DISPATCH_RECEIPT_CLAIM_UNKNOWN',{effectKey:key});}
 try{
  const accepted=await ports.dispatchWorkflow(receiver,{ref:'main',inputs});
  if(accepted?.status!==204)throw Error('CI_NATIVE_DISPATCH_RESPONSE_UNVERIFIED');
 }catch{
  try{await ports.saveReceipt(key,{...record,phase:'DISPATCH_OUTCOME_UNKNOWN'});}catch{}
  return denied('STATE_UNKNOWN','CI_NATIVE_DISPATCH_POST_OUTCOME_UNKNOWN',{effectKey:key});
 }
 try{await ports.saveReceipt(key,{...record,phase:'DISPATCH_ACCEPTED_NOT_EXECUTED'});}catch{
  return denied('STATE_UNKNOWN','CI_NATIVE_DISPATCH_RECEIPT_WRITE_UNKNOWN',{effectKey:key});
 }
 // GitHub returns no downstream Run ID from workflow_dispatch. Neither this
 // response nor a GITHUB_TOKEN API success establishes receiver execution.
 return Object.freeze({state:'DISPATCH_ACCEPTED_NOT_EXECUTED',code:'CI_NATIVE_DISPATCH_WAKEUP_ONLY',
  dispatched:true,executed:false,effectKey:key});
}
