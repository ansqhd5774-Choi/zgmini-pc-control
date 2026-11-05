// Source-only B admission adapter. No PC operations, filesystem writes or network calls.
// The host MUST use a single, durable, atomic lane claim and trusted GitHub-main
// approval readback. The current maintainer still revalidates before installation.
import {validateMaintenanceRequest,validateUpdateRequest} from './maintenance-contract.mjs';

export const CONTROLLER_ADMISSION_LANE='controller-install';
export const CONTROLLER_ADMISSION_SCHEMA='ZGMINI_CONTROLLER_ADMISSION_ITEM_V1';
const QUEUE_ID=/^[a-z0-9][a-z0-9-]{7,79}$/;
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const safeCode=value=>/^[A-Z][A-Z0-9_]{0,79}$/.test(String(value??''))
 ?String(value):'QUEUE_VALIDATION_FAILED';
const result=(status,code,extra={})=>Object.freeze({status,code,...extra});

function checkItem(item){
 if(!item||typeof item!=='object'||Array.isArray(item)
   ||item.schema!==CONTROLLER_ADMISSION_SCHEMA
   ||!QUEUE_ID.test(String(item.queueId??''))
   ||item.resourceLane!==CONTROLLER_ADMISSION_LANE
   ||!item.request||typeof item.request!=='object'||Array.isArray(item.request))
  return 'QUEUE_ITEM_INVALID';
 if(item.status!=='READY')return 'QUEUE_NOT_READY';
 if(item.dependencies!==undefined&&(!Array.isArray(item.dependencies)
   ||item.dependencies.some(x=>!QUEUE_ID.test(String(x)))))return 'QUEUE_DEPENDENCIES_INVALID';
 return null;
}

function priorOutcome(prior,key,request,allowedActors){
 if(prior===null)return null;
 if(!prior||typeof prior!=='object'||!Number.isSafeInteger(prior.issueNumber)
   ||prior.issueNumber<1)return result('STATE_UNKNOWN','QUEUE_EXISTING_UNVERIFIED',{key});
 try{
  // `readExisting` must return the trusted server's full Issue metadata, not
  // a caller-supplied `key` or a naked issue number. A wrong search hit is
  // uncertain; it never authorizes a new submission.
  if(prior.title!=='pc-controller-update'
    ||!Array.isArray(prior.labels)||!prior.labels.includes('pc-maintenance'))
   throw Error('QUEUE_EXISTING_UNVERIFIED');
  validateMaintenanceRequest(prior.request,{actor:prior.author,allowedActors});
  if(prior.request.targetControllerSha!==request.targetControllerSha
    ||prior.request.approvalManifestSha256!==request.approvalManifestSha256
    ||prior.request.requestId!==request.requestId)
   throw Error('QUEUE_EXISTING_IDENTITY_MISMATCH');
 }catch{return result('STATE_UNKNOWN','QUEUE_EXISTING_UNVERIFIED',{key});}
 const status=String(prior.status??'UNKNOWN');
 if(['SUBMITTING','UNKNOWN','STATE_UNKNOWN'].includes(status))
  return result('STATE_UNKNOWN','QUEUE_EXISTING_UNCERTAIN',
   {key,issueNumber:prior.issueNumber});
 return result('EXISTING','QUEUE_ALREADY_SUBMITTED',
  {key,issueNumber:prior.issueNumber,existingStatus:status});
}

/**
 * At most one Controller B Issue candidate may be admitted per resource lane.
 * `claimLane` MUST atomically reserve the WHOLE lane (not merely the request
 * fingerprint) until a trusted maintainer terminal result is recorded. A simple
 * GitHub search-then-create sequence is NOT a valid implementation of claimLane.
 *
 * `loadApprovedManifest` MUST read the fixed approvals/ path from authenticated
 * control-repo `main`, verify its merge/approval reference and return
 * `{bytes,sourceRef:'main',approvalRefConfirmed:true}`. Untrusted #68 comments
 * and Issue payloads must never be used as manifest bytes or approval proof.
 * `readExisting` MUST return null only after a successful authoritative lookup;
 * existing results require server title/labels/author and full seven-key
 * validated request. Errors and ambiguous responses must throw.
 * A host must settle a lane claim via trusted maintainer terminal evidence;
 * it may NOT clear it on an unresolved create/lookup or install outcome.
 * Before enabling this host, any pre-existing manually submitted, nonterminal
 * B Issue MUST be adopted into the whole-lane claim or remain visible to
 * `readLanePending`. A PC install lease alone does not cover queued Issues.
 * Issue creation is a separate,
 * existing authorized maintainer integration, never performed inside this file.
 */
export async function admitApprovedControllerOnce({
 item,installedSha,actor,allowedActors=['ansqhd5774-Choi'],
 completedDependencies=[],activeInstallLease,
 loadApprovedManifest,readExisting,readLanePending,claimLane,submitIssue,
}={}){
 const problem=checkItem(item);
 if(problem==='QUEUE_NOT_READY')return result('WAITING_APPROVAL',problem);
 if(problem)return result('BLOCKED',problem);
 if(item.dependencies?.some(id=>!completedDependencies.includes(id)))
  return result('WAITING_DEPENDENCY','QUEUE_DEPENDENCY_PENDING');
 if(typeof activeInstallLease!=='boolean')
  return result('STATE_UNKNOWN','QUEUE_INSTALL_LEASE_UNVERIFIED');
 if(activeInstallLease)return result('WAITING_RESOURCE','QUEUE_INSTALL_LEASE_HELD');
 const request=item.request;
 if(!SHA40.test(String(request.targetControllerSha??''))
   ||!SHA256.test(String(request.approvalManifestSha256??'')))
  return result('BLOCKED','QUEUE_REQUEST_PIN_INVALID');
 const key=`${CONTROLLER_ADMISSION_LANE}:${request.targetControllerSha}:${request.approvalManifestSha256}`;
 if([loadApprovedManifest,readExisting,readLanePending,claimLane,submitIssue]
   .some(fn=>typeof fn!=='function'))
  return result('BLOCKED','QUEUE_TRUSTED_ADAPTER_MISSING',{key});
 let approved;
 try{
  approved=await loadApprovedManifest(
   `approvals/controller-updates/${request.targetControllerSha}.json`);
 }catch{return result('STATE_UNKNOWN','QUEUE_APPROVAL_READ_UNCERTAIN',{key});}
 if(approved?.sourceRef!=='main'||approved?.approvalRefConfirmed!==true
   ||!(typeof approved.bytes==='string'||Buffer.isBuffer(approved.bytes)))
  return result('WAITING_APPROVAL','QUEUE_APPROVAL_NOT_VERIFIED',{key});
 try{
  validateUpdateRequest(request,approved.bytes,
   {actor,allowedActors,installedSha});
 }catch(error){
  return result('BLOCKED',safeCode(error?.message),{key});
 }
 const lookup=async()=>{
  try{return priorOutcome(await readExisting({key,request}),key,request,allowedActors);}
  catch{return result('STATE_UNKNOWN','QUEUE_EXISTING_LOOKUP_UNCERTAIN',{key});}
 };
 const before=await lookup();
 if(before)return before;
 // The legacy manual queue can already contain a different target while the
 // PC installation lease is idle. `readLanePending` must reconcile all known
 // nonterminal pc-maintenance Issue/ledger entries, not just the current key.
 const pendingLane=async()=>{
  let observed;
  try{observed=await readLanePending({lane:CONTROLLER_ADMISSION_LANE,key});}
  catch{return result('STATE_UNKNOWN','QUEUE_LANE_READ_UNCERTAIN',{key});}
  if(observed?.authoritative!==true)
   return result('STATE_UNKNOWN','QUEUE_LANE_READ_UNVERIFIED',{key});
  if(observed.pending===true)
   return result('WAITING_RESOURCE','QUEUE_PRIOR_B_PENDING',{key});
  if(observed.pending!==false)
   return result('STATE_UNKNOWN','QUEUE_LANE_READ_UNVERIFIED',{key});
  return null;
 };
 const existingLane=await pendingLane();
 if(existingLane)return existingLane;
 let claim;
 try{claim=await claimLane({lane:CONTROLLER_ADMISSION_LANE,key,queueId:item.queueId});}
 catch{return result('STATE_UNKNOWN','QUEUE_LANE_CLAIM_UNCERTAIN',{key});}
 if(claim?.acquired===false)return result('WAITING_RESOURCE','QUEUE_LANE_OCCUPIED',{key});
 if(claim?.acquired!==true)return result('STATE_UNKNOWN','QUEUE_LANE_CLAIM_UNVERIFIED',{key});
 // Re-read under the durable lane claim. Never submit on an uncertain lookup.
 const afterClaim=await lookup();
 if(afterClaim)return Object.freeze({...afterClaim,claimHeld:true,
  needsClaimReconciliation:true});
 const changedLane=await pendingLane();
 if(changedLane)return Object.freeze({...changedLane,claimHeld:true,
  needsClaimReconciliation:true});
 const envelope={
  schema:request.schema,requestId:request.requestId,chatId:request.chatId,
  operation:request.operation,controlRepository:request.controlRepository,
  targetControllerSha:request.targetControllerSha,
  approvalManifestSha256:request.approvalManifestSha256,
 };
 const issue={title:'pc-controller-update',labels:['pc-maintenance'],
  body:JSON.stringify(envelope),key};
 let createdNumber=null;
 try{
  const created=await submitIssue(issue);
  if(Number.isSafeInteger(created?.issueNumber)&&created.issueNumber>0)
   createdNumber=created.issueNumber;
 }catch{/* A timeout may have committed; always re-read, never resubmit. */}
 const recovered=await lookup();
 if(recovered){
  if(recovered.status==='EXISTING'&&createdNumber===recovered.issueNumber)
   return result('ADMITTED','QUEUE_SUBMITTED_ONCE',
    {key,issueNumber:createdNumber,claimHeld:true});
  return Object.freeze({...recovered,claimHeld:true,
   needsClaimReconciliation:true});
 }
 // Preserve the lane claim for operator/maintainer resolution, including when
 // create returned an incomplete response. This helper intentionally has no retry.
 return result('STATE_UNKNOWN','QUEUE_SUBMISSION_UNCERTAIN',
  {key,claimHeld:true,needsClaimReconciliation:true});
}
