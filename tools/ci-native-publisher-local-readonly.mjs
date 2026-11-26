// Fixed, redacted read-only A observation on the isolated CI handoff PC.
// Existing publisher and independently installed B proof contracts are reused.
// Never publish original policy, approval/request bytes, secret, root path,
// durable claim content, or grant any native A/Writer B execution authority.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createNativePublisherLocalPolicyPorts} from '../ci-approval/native-publisher-entry.mjs';

const EFFECTS=['A_READONLY','B_WRITER_SOURCE'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const enabled=(env,key)=>env?.[key]==='true'?'ENABLED':
 env?.[key]==='false'?'DISABLED':'UNSET_OR_INVALID';
const configured=value=>typeof value==='string'&&value.length>0;
const effectResult=(code,fields={})=>Object.freeze({
 code,scopeFormatObserved:false,installedProofFormatObserved:false,
 policyBytesMatched:false,localPolicyEnabled:false,
 ...fields
});

/** This observation is NOT an installed grant or a CI dispatch decision. */
export function inspectCiNativePublisherLocalReadonly({
 env=process.env,createPorts=createNativePublisherLocalPolicyPorts
}={}){
 const out={
  schema:'ZGMINI_CI_NATIVE_PUBLISHER_LOCAL_READONLY_V1',
  status:'READ_ONLY_OBSERVED',code:'CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED',
  scopeRootConfigured:configured(env?.ZGMINI_CI_NATIVE_SCOPE_ROOT),
  receiptRootConfigured:configured(env?.ZGMINI_CI_NATIVE_RECEIPT_ROOT),
  publisherAOptIn:enabled(env,'ZGMINI_CI_NATIVE_A_ENABLED'),
  publisherWriterBOptIn:enabled(env,'ZGMINI_CI_NATIVE_WRITER_B_ENABLED'),
  executionAOptIn:enabled(env,'ZGMINI_CI_NATIVE_A_EXEC_ENABLED'),
  executionWriterBOptIn:enabled(env,'ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED'),
  independentRootsVerified:false,
  effects:{
   A_READONLY:effectResult('CI_NATIVE_LOCAL_SCOPE_NOT_OBSERVED'),
   B_WRITER_SOURCE:effectResult('CI_NATIVE_LOCAL_SCOPE_NOT_OBSERVED')
  },
  independentGitHubInstallationReceiptVerified:false,
  canPublish:false,canExecute:false,canInstall:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,automaticRetries:0
 };
 if(!out.scopeRootConfigured||!out.receiptRootConfigured)return Object.freeze(out);
 let local;
 try{
  local=createPorts({
   scopeRoot:env.ZGMINI_CI_NATIVE_SCOPE_ROOT,
   receiptRoot:env.ZGMINI_CI_NATIVE_RECEIPT_ROOT,
   volatileRoots:[env.RUNNER_TEMP,env.TEMP,env.TMP,env.GITHUB_WORKSPACE]
    .filter(value=>typeof value==='string'&&path.isAbsolute(value))
  });
  if(typeof local?.readNativeScope!=='function'||
     typeof local?.readNativeInstalledProof!=='function')
   throw Error('CI_NATIVE_LOCAL_PORTS_INVALID');
 }catch{
  return Object.freeze({...out,code:'CI_NATIVE_LOCAL_ROOTS_UNVERIFIED'});
 }
 const effects={};
 for(const effect of EFFECTS){
  let scope;
  try{scope=local.readNativeScope(effect);}
  catch{effects[effect]=effectResult('CI_NATIVE_LOCAL_SCOPE_UNVERIFIED');continue;}
  const scopeFields={scopeFormatObserved:true,localPolicyEnabled:scope?.policy?.enabled===true};
  let proof;
  try{proof=local.readNativeInstalledProof(effect);}
  catch{
   effects[effect]=effectResult('CI_NATIVE_LOCAL_INSTALLED_PROOF_UNVERIFIED',scopeFields);
   continue;
  }
  const fields={...scopeFields,installedProofFormatObserved:true};
  const matched=scope.policy?.schema==='ZGMINI_CI_NATIVE_DISPATCH_V1'&&
   proof.effect===effect&&
   isDeepStrictEqual(scope.policy,proof.policy)&&
   Buffer.isBuffer(scope.approvalBytes)&&Buffer.isBuffer(scope.requestBytes)&&
   digest(scope.approvalBytes)===scope.policy.businessApprovalSha256&&
   digest(scope.requestBytes)===scope.policy.approvedRequestSha256&&
   digest(Buffer.from(JSON.stringify(scope.policy)))===proof.nativePolicySha256;
  if(!matched){
   effects[effect]=effectResult('CI_NATIVE_LOCAL_POLICY_BYTES_UNVERIFIED',fields);
  }else if(scope.policy.enabled!==true){
   effects[effect]=effectResult('CI_NATIVE_LOCAL_POLICY_DISABLED',
    {...fields,policyBytesMatched:true});
  }else{
   effects[effect]=effectResult('CI_NATIVE_LOCAL_SCOPE_PROOF_FORMAT_MATCH',
    {...fields,policyBytesMatched:true});
  }
 }
 const complete=EFFECTS.every(effect=>
  effects[effect].code==='CI_NATIVE_LOCAL_SCOPE_PROOF_FORMAT_MATCH');
 return Object.freeze({...out,
  code:complete?'CI_NATIVE_LOCAL_SCOPES_FORMAT_OBSERVED':
   'CI_NATIVE_LOCAL_SCOPE_OR_PROOF_UNVERIFIED',
  independentRootsVerified:true,effects:Object.freeze(effects)
 });
}
