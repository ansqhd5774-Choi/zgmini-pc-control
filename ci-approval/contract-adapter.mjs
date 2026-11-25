// Non-operational adapter. Syntax checks do not authenticate any evidence.
// No publishing, Issue construction/submission, IO, or execution capability.
import {createHash} from 'node:crypto';
import {validateRequest} from '../controller/common.mjs';
import {validateUpdateRequest,manifestFingerprint,CONTROLLER_POST_OPERATIONS} from '../tools/maintenance-contract.mjs';
import {validateWriterBManifest} from '../writer-b/contract.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const out=(state,reason,details={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...details});
const errorCode=e=>/^[A-Z][A-Z0-9_]{1,100}$/.test(e?.code??e?.message??'')?(e.code??e.message):'CONTRACT_REJECTED';
const validBytes=x=>Buffer.isBuffer(x)&&x.length>0&&x.length<=65536;
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const PILOT_PURPOSES=new Set(['pc-controller-maintenance','pc-controller-heavy-readonly','pc-controller-moderate-readonly','pc-controller-safety-fix']);

export function inspectExistingContract(effect,input){
 try{
  if(effect==='A_READONLY'){
   const {request,policy,actor}=input;
   if(policy?.mutationsEnabled!==false||!Array.isArray(policy.allowedActors)||!policy.allowedActors.includes(actor))
    return out('REJECTED','A_POLICY_OR_ACTOR');
   validateRequest(request,policy);
   if(policy.operations[request.operation]?.grade!=='A')return out('REJECTED','A_GRADE_REQUIRED');
   return out('CONTRACT_MATCH','A_SCHEMA_MATCH_ONLY',{scopeDigest:sha(JSON.stringify(request)),targetSha:request.sourceSha});
  }
  if(effect==='B_CONTROLLER_INSTALL'){
   const {request,manifestBytes,context}=input;
   if(!validBytes(manifestBytes)||!context||!sha40(context.installedSha))return out('REJECTED','B_CONTEXT_MISSING');
   const validated=validateUpdateRequest(request,manifestBytes,context);
   return out('CONTRACT_MATCH','CONTROLLER_SCHEMA_MATCH_ONLY',{scopeDigest:sha(manifestBytes),targetSha:validated.manifest.targetSha});
  }
  if(effect==='B_WRITER_SOURCE'){
   const {manifestBytes,expectedDigest,observedHead,observedConfigSha}=input;
   if(!validBytes(manifestBytes)||sha(manifestBytes)!==expectedDigest)return out('REJECTED','WRITER_MANIFEST_HASH_STOP');
   const manifest=validateWriterBManifest(JSON.parse(manifestBytes.toString('utf8')));
   if(observedHead!==manifest.baseHead||observedConfigSha!==manifest.baseConfigSourceSha)
    return out('REJECTED','WRITER_PREIMAGE_DRIFT');
   return out('CONTRACT_MATCH','WRITER_SCHEMA_MATCH_ONLY',{scopeDigest:sha(manifestBytes),targetSha:manifest.candidateSourceSha});
  }
  return out('OUT_OF_SCOPE','EFFECT_NOT_IN_PILOT');
 }catch(e){return out('REJECTED',errorCode(e));}
}

// Controller candidate contains neither an approval record nor a PASS claim.
// This is not an existing maintenance manifest; do not write it under approvals/.
export function buildControllerCandidate(plan){
 try{
  const keys=['installedSha','targetSha','allowFiles','purpose','postOperation','postSourceBranch','postSourceSha'];
  if(!exact(plan,keys)||!sha40(plan.installedSha)||!sha40(plan.targetSha)||plan.installedSha===plan.targetSha||
     !PILOT_PURPOSES.has(plan.purpose)||!CONTROLLER_POST_OPERATIONS.includes(plan.postOperation)||
     typeof plan.postSourceBranch!=='string'||!(/^(?:main|codex\/[a-z0-9][a-z0-9./_-]{2,100})$/.test(plan.postSourceBranch))||
     plan.postSourceBranch.includes('..')||!sha40(plan.postSourceSha))return out('REJECTED','CONTROLLER_PLAN_INVALID');
  const fp=manifestFingerprint(plan.allowFiles);
  const candidate={schema:'ZGMINI_CI_APPROVAL_CANDIDATE_V1',status:'PROPOSED_NOT_APPROVED',effect:'B_CONTROLLER_INSTALL',
   plan:{...plan,allowFiles:fp.files},fileManifestSha256:fp.sha256};
  return out('CANDIDATE_ONLY','AUTHORITY_AND_LIVE_EVIDENCE_REQUIRED',{candidate});
 }catch(e){return out('REJECTED',errorCode(e));}
}

// Use the existing Writer validator for structural checks only. The temporary
// in-memory status is never returned as an operational manifest or authorization.
export function buildWriterCandidate(plan){
 try{
  if(!plan||typeof plan!=='object'||Array.isArray(plan)||Object.hasOwn(plan,'status'))return out('REJECTED','WRITER_PLAN_INVALID');
  const copied=structuredClone(plan);
  validateWriterBManifest({...copied,status:'APPROVED_B'});
  const candidate={schema:'ZGMINI_CI_APPROVAL_CANDIDATE_V1',status:'PROPOSED_NOT_APPROVED',effect:'B_WRITER_SOURCE',plan:copied,planSha256:sha(JSON.stringify(copied))};
  return out('CANDIDATE_ONLY','AUTHORITY_AND_LIVE_EVIDENCE_REQUIRED',{candidate});
 }catch(e){return out('REJECTED',errorCode(e));}
}
