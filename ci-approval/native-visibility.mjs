// Source-only boundary: only independently installed Writer B public policy.
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
export function nativeVisibilityMatches(policy,effect,isPrivate){
 if(isPrivate===true)
  return policy?.repositoryVisibility===undefined||
   policy.repositoryVisibility==='private';
 return isPrivate===false&&effect==='B_WRITER_SOURCE'&&
  policy?.effect===effect&&policy.enabled===true&&
  policy.repositoryVisibility==='public'&&
  policy.nativeWriterBExecutionEnabled===true&&
  SHA40.test(policy.installedControllerSha??'')&&
  SHA40.test(policy.nativeWriterBControlSha??'')&&
  SHA64.test(policy.nativeWriterBAdapterSha256??'');
}
export function publicWriterEventOptIn(effect,env,isPrivate){
 return isPrivate===false&&effect==='B_WRITER_SOURCE'&&
  env?.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED==='true';
}
