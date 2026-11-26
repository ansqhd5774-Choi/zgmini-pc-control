// Shadow simulation only. No authority authentication, manifest publishing, request submission or execution.
// All facts are synthetic inputs; never wire this return value to an operational gate.
export function evaluateShadow(request, facts) {
  const result=(state,reason)=>({mode:"SHADOW_ONLY",state,reason,canPublish:false,canExecute:false});
  const sha=x=>typeof x==="string"&&/^[a-f0-9]{40}$/.test(x);
  const digest=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
  const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
  const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
  if(!exact(request,["requestId","effect","targetSha","scopeDigest"])||
     typeof request.requestId!=="string"||!/^[a-z0-9][a-z0-9-]{7,79}$/.test(request.requestId)||
     !sha(request.targetSha)||!digest(request.scopeDigest))return result("INVALID","REQUEST_FORMAT");
  if(!["A_READONLY","B_CONTROLLER_INSTALL","B_WRITER_SOURCE"].includes(request.effect))return result("OUT_OF_SCOPE","EFFECT_NOT_IN_PILOT");
  if(!obj(facts))return result("EVIDENCE_MISSING","EVIDENCE_ABSENT");
  if(facts.prChangesAuthority!==false)return result("EVIDENCE_MISSING","AUTHORITY_CHANGE_NOT_EXCLUDED");
  if(facts.requestState==="CONSUMED"||facts.requestState==="UNKNOWN")return result("WAIT_RESOURCE","RECONCILE_EXISTING_REQUEST");
  if(facts.requestState!=="NEW")return result("EVIDENCE_MISSING","REQUEST_STATE_UNKNOWN");
  const a=facts.authority;
  if(!exact(a,["effect","targetSha","scopeDigest","policySha","requestId","provenance"])||
     a.provenance!=="SIMULATED_TRUSTED_INPUT"||!sha(a.policySha))
    return result("EVIDENCE_MISSING","AUTHORITY_NOT_MODELED");
  if(a.effect!==request.effect||a.targetSha!==request.targetSha||a.scopeDigest!==request.scopeDigest||a.requestId!==request.requestId)
    return result("OUT_OF_SCOPE","AUTHORITY_SCOPE_MISMATCH");
  if(facts.existingContractPass!==true)return result("EVIDENCE_MISSING","EXISTING_CONTRACT_NOT_MODELED_PASS");
  if(request.effect==="A_READONLY"){
    if(facts.readOnly!==true)return result("OUT_OF_SCOPE","READONLY_EFFECT_NOT_PROVEN");
  }else{
    const c=facts.ci;
    if(!exact(c,["targetSha","scopeDigest","conclusion","trustedWorkflow","current"])||
      c.targetSha!==request.targetSha||c.scopeDigest!==request.scopeDigest||
      c.conclusion!=="success"||c.trustedWorkflow!==true||c.current!==true)
      return result("EVIDENCE_MISSING","CI_NOT_BOUND_PASS");
    if(!sha(facts.expectedBaseSha)||facts.currentBaseSha!==facts.expectedBaseSha)
      return result("EVIDENCE_MISSING","PREIMAGE_MISMATCH");
    if(request.effect==="B_WRITER_SOURCE"&&facts.configSourceSha!==facts.currentBaseSha)
      return result("EVIDENCE_MISSING","WRITER_CONFIG_SOURCE_DRIFT");
    if(facts.rollbackVerified!==true||facts.postcheckBound!==true)
      return result("EVIDENCE_MISSING","RECOVERY_OR_POSTCHECK_MISSING");
  }
  if(facts.resourceState==="BUSY")return result("WAIT_RESOURCE","RESOURCE_BUSY");
  if(facts.resourceState!=="READY")return result("EVIDENCE_MISSING","RESOURCE_UNCONFIRMED");
  // A and Writer B owner-opened Issue workflows reject requests created by
  // github-actions[bot]. A valid business approval/manifest alone cannot
  // prove the automated sender is admitted by the actual receiver. Controller
  // B also needs its independent CI receipt/receiver identity verification.
  // This is still a synthetic fact, NEVER a credential or publication grant.
  if(facts.receiverAdmissionVerified!==true)
    return result("EVIDENCE_MISSING","CI_RECEIVER_ADMISSION_NOT_PROVEN");
  return result("WOULD_MATCH_EXISTING_AUTHORITY","SIMULATED_CONDITIONS_MATCH");
}
