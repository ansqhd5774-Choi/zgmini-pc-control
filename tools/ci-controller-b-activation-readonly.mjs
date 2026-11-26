// Sanitized, owner-scoped isolated-Runner A observation.
// Configuration shape is NOT an owner delegation, authorization, or an
// installed Controller B effect. Never emit configured source values.
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const branch=x=>typeof x==='string'&&/^codex\/[a-z0-9][a-z0-9-]{3,94}$/.test(x);
const report=(status,code,extra={})=>Object.freeze({
 schema:'ZGMINI_CI_CONTROLLER_B_ACTIVATION_READONLY_V1',status,code,
 variableEnabledVerified:false,policyConfigured:false,policyShapeVerified:false,
 independentOwnerGrantVerified:false,installedReceiverPolicyVerified:false,
 actualBusinessApprovalVerified:false,activationAuthorized:false,
 controllerBPublished:false,operationalWrites:0,providerCalls:0,d1Writes:0,
 automaticRetries:0,...extra
});
export function inspectCiControllerBActivationReadonly({enabled,policy}={}){
 const disabled=enabled==='false',configured=typeof policy==='string'&&policy.length>0;
 const common={variableEnabledVerified:disabled,policyConfigured:configured};
 if(enabled==='true')return report('BLOCKED','CI_CONTROLLER_B_ALREADY_ENABLED_STOP',common);
 if(!disabled)return report('PARTIAL','CI_CONTROLLER_B_FLAG_NOT_EXPLICITLY_DISABLED',common);
 if(!configured)return report('PARTIAL','CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED',common);
 if(Buffer.byteLength(policy,'utf8')>32768)
  return report('BLOCKED','CI_CONTROLLER_B_AUTO_POLICY_SIZE_DENIED',common);
 let p;
 try{p=JSON.parse(policy);}catch{return report('BLOCKED','CI_CONTROLLER_B_AUTO_POLICY_JSON_INVALID',common);}
 if(!p||typeof p!=='object'||Array.isArray(p)||
    !sha40(p.targetSha)||!id(p.sourcePrNumber)||!sha40(p.sourceWorkflowBlobSha)||
    !sha40(p.policyRevision)||!sha64(p.businessApprovalSha256)||
    !branch(p.sourceBranch)||p.authorityChangesExcluded!==true||
    !id(p.delegationPin?.issueNumber)||!id(p.delegationPin?.commentId)||
    !sha64(p.delegationPin?.bodySha256))
  return report('BLOCKED','CI_CONTROLLER_B_AUTO_POLICY_FORMAT_DENIED',common);
 const plan=p.installPlan;
 if(plan!==undefined){
  if(!sha40(p.sourceMainSha)||!plan||typeof plan!=='object'||
     plan.targetSha!==p.targetSha||!sha40(plan.installedSha)||
     plan.installedSha===p.targetSha||
     plan.purpose!=='pc-controller-maintenance'||plan.postOperation!=='core-status'||
     !Array.isArray(plan.allowFiles)||plan.allowFiles.length<1||plan.allowFiles.length>32||
     !plan.allowFiles.every(f=>f&&typeof f.path==='string'&&
       /^controller\/[a-z][a-z0-9-]*\.mjs$/.test(f.path)&&sha64(f.sha256))||
     new Set(plan.allowFiles.map(f=>f.path.toLowerCase())).size!==plan.allowFiles.length)
   return report('BLOCKED','CI_CONTROLLER_B_AUTO_POLICY_FORMAT_DENIED',common);
 }else if(!id(p.approvalPrNumber)||p.approvalPrNumber===p.sourcePrNumber)
  return report('BLOCKED','CI_CONTROLLER_B_AUTO_POLICY_FORMAT_DENIED',common);
 // This deliberately does not query a mutable Issue or authorize anything.
 // Runtime publisher independently resolves owner grant bytes, CI, current CAS
 // and exact approval/receiver. A format-only result cannot turn the switch on.
 return report('PARTIAL','CI_CONTROLLER_B_AUTO_POLICY_FORMAT_OBSERVED_ONLY',{
  ...common,policyShapeVerified:true
 });
}
