// Source-only composition of existing public CI evidence and independently
// installed native A approval. No CLI, workflow entry, POST, claim write,
// executor, or new authority. All ports must be supplied by a trusted local
// adapter, never by an event, PR checkout, or public hosted job carrying secrets.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {inspectPublicSourceRunEvidence} from './public-completed-run-observe.mjs';
import {verifyNativeInstalledProof} from './native-publisher-entry.mjs';
import {validateRequest} from '../controller/common.mjs';

const EFFECT='A_READONLY';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SOURCE='.github/workflows/controller-maintenance-source-tests.yml';
const RECEIVER='.github/workflows/ci-approved-a-once.yml';
const hex=(v,n)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const id=v=>Number.isSafeInteger(v)&&v>0;
const digest=b=>createHash('sha256').update(b).digest('hex');
const out=(state,code)=>Object.freeze({state,code,sourceOnly:true,
 canPublish:false,canExecute:false,canInstall:false,selfHostedAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0});

export async function inspectPublicNativeACandidate({sourceRunId,ports}={}){
 if(!id(sourceRunId)||!ports||['readNativeScope','readNativeInstalledProof',
  'getRun','getJobs','getWorkflow','getJson'].some(k=>typeof ports[k]!=='function'))
  return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_READ_PORTS_UNAVAILABLE');
 let scope,proof;
 try{
  scope=await ports.readNativeScope(EFFECT);
  proof=await ports.readNativeInstalledProof(EFFECT);
 }catch{return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_INSTALLED_SCOPE_UNAVAILABLE');}
 const p=scope?.policy;
 // A Private grant is not automatically a Public grant. Explicit visibility
 // must be covered by the independent installation attestation below.
 if(p?.schema!=='ZGMINI_CI_NATIVE_DISPATCH_V1'||p.effect!==EFFECT||
    p.repositoryVisibility!=='public'||p.enabled!==true||
    p.nativeAExecutionEnabled!==true||p.sourceAttempt!==1||
    p.sourceWorkflowPath!==SOURCE||p.receiverWorkflowPath!==RECEIVER||
    !id(p.sourceWorkflowId)||!hex(p.sourceHeadSha,40)||
    !hex(p.sourceWorkflowBlobSha,40)||!hex(p.receiverWorkflowBlobSha,40)||
    !hex(p.policyRevision,40)||!hex(p.installedControllerSha,40)||
    !hex(p.nativeAAdapterSha256,64)||!hex(p.businessApprovalSha256,64)||
    !hex(p.approvedRequestSha256,64)||
    !(p.sourceRunMode==='EVENT_COMPLETION_V1'&&!Object.hasOwn(p,'sourceRunId')||
      p.sourceRunMode===undefined&&p.sourceRunId===sourceRunId))
  return out('OUT_OF_SCOPE','PUBLIC_NATIVE_A_SCOPE_DENIED');
 if(!Buffer.isBuffer(scope.approvalBytes)||scope.approvalBytes.length<1||
    scope.approvalBytes.length>65536||
    !Buffer.isBuffer(scope.requestBytes)||scope.requestBytes.length<1||
    scope.requestBytes.length>32768||
    digest(scope.approvalBytes)!==p.businessApprovalSha256||
    digest(scope.requestBytes)!==p.approvedRequestSha256)
  return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_BYTES_DRIFT');
 try{
  const local=JSON.parse(scope.approvalBytes.toString('utf8'));
  const request=validateRequest(JSON.parse(scope.requestBytes.toString('utf8')),local);
  if(local.controlRepository!==REPO||local.sourceRepository!=='ansqhd5774-Choi/zgmini'||
     local.mutationsEnabled!==false||!Array.isArray(local.allowedActors)||
     !['runner-smoke','core-status'].includes(request.operation)||
     request.operation!==p.nativeAOperation||
     local.operations?.[request.operation]?.grade!=='A'||
     local.operations?.[request.operation]?.resource!=='light')
   return out('OUT_OF_SCOPE','PUBLIC_NATIVE_A_FIXED_OPERATION_DENIED');
 }catch{return out('OUT_OF_SCOPE','PUBLIC_NATIVE_A_FIXED_OPERATION_DENIED');}
 // Reuse the installed Native B proof contract, binding its entire policy,
 // raw receipt digest, exact installation request and pinned Controller SHA.
 if(proof?.schema!=='ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1'||
    proof.effect!==EFFECT||!isDeepStrictEqual(proof.policy,p)||
    proof.nativePolicySha256!==digest(Buffer.from(JSON.stringify(p)))||
    !hex(proof.installationReceiptSha256,64)||
    !/^pc-update-[a-f0-9-]{36}$/.test(proof.installationRequestId??'')||
    proof.installationReceiptPath!=='results/maintenance-'+proof.installationRequestId+'.json'||
    proof.actualControllerSha!==p.installedControllerSha)
  return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_INSTALLED_PROOF_MISMATCH');
 try{
  const attested=await verifyNativeInstalledProof(EFFECT,proof,{getJson:route=>{
   if(route!=='contents/'+proof.installationReceiptPath+'?ref=main')
    throw Error('PUBLIC_NATIVE_A_RECEIPT_ROUTE_DENIED');
   return ports.getJson(route);
  }});
  if(!isDeepStrictEqual(attested,p))
   return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_INSTALLED_PROOF_MISMATCH');
 }catch{return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_INSTALLATION_RECEIPT_UNVERIFIED');}
 try{
  const run=await ports.getRun(sourceRunId,1);
  if(run?.id!==sourceRunId||run.run_attempt!==1||
     run.head_sha!==p.sourceHeadSha||run.workflow_id!==p.sourceWorkflowId)
   return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_SOURCE_RUN_MISMATCH');
  const [jobs,workflow,receiver]=await Promise.all([
   ports.getJobs(sourceRunId,1),ports.getWorkflow(SOURCE,p.sourceHeadSha),
   ports.getWorkflow(RECEIVER,'main')
  ]);
  const source=inspectPublicSourceRunEvidence({run,jobs,workflow});
  if(source.state!=='OBSERVED_ONLY'||source.reviewedWorkflowBlobSha!==p.sourceWorkflowBlobSha)
   return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_SOURCE_EVIDENCE_UNVERIFIED');
  if(receiver?.type!=='file'||receiver.path!==RECEIVER||
     receiver.sha!==p.receiverWorkflowBlobSha||receiver.encoding!=='base64'||
     typeof receiver.content!=='string'||receiver.content.length>131072)
   return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_RECEIVER_PIN_UNVERIFIED');
  const bytes=Buffer.from(receiver.content,'base64');
  const blob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(!bytes.length||bytes.length>65536||blob!==p.receiverWorkflowBlobSha)
   return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_RECEIVER_PIN_UNVERIFIED');
  // Even exact matching evidence does not admit Public workflow dispatch.
  // The existing receiver still rejects Public, and the live execution
  // adapter/Controller preimage and durable claims remain separate.
  return out('CANDIDATE_ONLY','PUBLIC_NATIVE_A_EXACT_EVIDENCE_MATCH');
 }catch{return out('EVIDENCE_MISSING','PUBLIC_NATIVE_A_GITHUB_READ_UNAVAILABLE');}
}
