// Independent Owner policy deployment. No Controller/Writer/provider execution.
import {createHash} from 'node:crypto';
export const POLICY_INSTALL = Object.freeze({
 requestId:'db6a4814-d8ea-5343-9539-cf797835c231',
 requestSha256:'15fe91a91915e10551698de38200ff7c1f354fdae61ce117248b31182c8f35fa',
 approvalSha256:'c4f58408f4360f7d03b9c359cda78ce4602c447d86ff15ad538cdb57d820acda',
 approvalPath:'approvals/writer-updates/us-breadth-paid-r2-guarded-fourfile-natural-idle-20261127.json',
 hosts:['PC','DESKTOP-N62L0NG'],
});
export const policyDigest=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Error(c)};
export function makeIndependentPolicyScope({policy,approvalBytes,requestBytes}){
 const f=POLICY_INSTALL;
 need(Buffer.isBuffer(approvalBytes)&&policyDigest(approvalBytes)===f.approvalSha256,
  'NATIVE_POLICY_APPROVAL_BYTES_STOP');
 need(Buffer.isBuffer(requestBytes)&&policyDigest(requestBytes)===f.requestSha256,
  'NATIVE_POLICY_REQUEST_BYTES_STOP');
 const request=JSON.parse(requestBytes);
 need(request.requestId===f.requestId&&request.approvalManifestPath===f.approvalPath&&
  request.approvalManifestSha256===f.approvalSha256,'NATIVE_POLICY_REQUEST_SCOPE_STOP');
 need(policy?.schema==='ZGMINI_CI_NATIVE_DISPATCH_V1'&&policy.enabled===true&&
  policy.effect==='B_WRITER_SOURCE'&&policy.repositoryVisibility==='public'&&
  policy.nativeWriterBExecutionEnabled===true&&
  (policy.nativeWriterBControlMode===undefined||policy.nativeWriterBControlMode==='PINNED_CHECKOUT_V1')&&policy.sourceAttempt===1&&
  policy.sourceRunMode==='EVENT_COMPLETION_V1'&&!Object.hasOwn(policy,'sourceRunId')&&
  policy.sourceWorkflowId===416355595&&
  policy.sourceWorkflowPath==='.github/workflows/controller-maintenance-source-tests.yml'&&
  policy.receiverWorkflowPath==='.github/workflows/ci-approved-writer-b-once.yml'&&
  policy.businessApprovalSha256===f.approvalSha256&&
  policy.approvedRequestSha256===f.requestSha256&&
  policy.policyRevision===policy.nativeWriterBControlSha&&
  ['policyRevision','sourceHeadSha','installedControllerSha','sourceWorkflowBlobSha',
   'receiverWorkflowBlobSha'].every(k=>/^[a-f0-9]{40}$/.test(policy[k]??''))&&
  /^[a-f0-9]{64}$/.test(policy.nativeWriterBAdapterSha256??''),
  'NATIVE_POLICY_EFFECT_SCOPE_STOP');
 return Buffer.from(JSON.stringify({schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',policy,
  approvalBytesBase64:approvalBytes.toString('base64'),
  requestBytesBase64:requestBytes.toString('base64')})+'\n');
}
export function verifyIndependentPolicyReceipt(receipt,policy){
 need(receipt?.schema==='ZGMINI_NATIVE_POLICY_INSTALL_RECEIPT_V1'&&
  receipt.effect==='B_WRITER_SOURCE'&&receipt.requestId===POLICY_INSTALL.requestId&&
  receipt.status==='POLICY_INSTALLED_VERIFIED'&&
  receipt.nativePolicySha256===policyDigest(JSON.stringify(policy))&&
  receipt.actualControllerSha===policy.installedControllerSha&&
  receipt.approvalSha256===POLICY_INSTALL.approvalSha256&&
  receipt.requestSha256===POLICY_INSTALL.requestSha256&&
  receipt.controllerChanged===false&&receipt.writerChanged===false&&
  receipt.variablesEnabled===false&&receipt.dispatched===false&&
  Array.isArray(receipt.hosts)&&receipt.hosts.length===2,
  'NATIVE_POLICY_INSTALL_RECEIPT_SCOPE_STOP');
 for(const host of POLICY_INSTALL.hosts){
  const observations=receipt.hosts.filter(x=>x.host===host);
  need(observations.length===1,'NATIVE_POLICY_INSTALL_HOST_STOP');
  const x=observations[0];
  need(x.status==='SCOPE_INSTALLED_VERIFIED'&&x.aclVerified===true&&
   x.independentOperatorVerified===true&&x.reservedClaimAbsent===true&&
   x.policySha256===receipt.nativePolicySha256&&
   /^[a-f0-9]{64}$/.test(x.scopeSha256??'')&&
   /^[a-f0-9]{64}$/.test(x.aclSha256??'')&&
   typeof x.observedAt==='string'&&Number.isFinite(Date.parse(x.observedAt)),
   'NATIVE_POLICY_INSTALL_HOST_PROOF_STOP');
 }
 need(receipt.hosts[0].scopeSha256===receipt.hosts[1].scopeSha256,
  'NATIVE_POLICY_INSTALL_HOST_BYTES_STOP');
 return receipt;
}
export function makeIndependentPolicyProof({policy,receipt,receiptBytes,installationRequestId}){
 verifyIndependentPolicyReceipt(receipt,policy);
 need(Buffer.isBuffer(receiptBytes)&&JSON.stringify(JSON.parse(receiptBytes))===JSON.stringify(receipt)&&
  /^native-policy-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installationRequestId??''),
  'NATIVE_POLICY_INSTALL_RECEIPT_BYTES_STOP');
 return {schema:'ZGMINI_CI_NATIVE_POLICY_INSTALLED_PROOF_V1',effect:'B_WRITER_SOURCE',policy,
  nativePolicySha256:policyDigest(JSON.stringify(policy)),installationRequestId,
  installationReceiptPath:'results/'+installationRequestId+'.json',
  installationReceiptSha256:policyDigest(receiptBytes),actualControllerSha:policy.installedControllerSha};
}
