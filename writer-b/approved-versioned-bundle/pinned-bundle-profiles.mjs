// INTERNAL B projection from the ONE A/B shared approved capability registry.
// Uses A's parser for the same raw PIN, then an independent B-side validation.
// Does not open files, access the PC, run code, or report private profile data.
import {selectPinnedCapabilityProfiles} from
 '../../controller/approved-runtime-inventory-readonly.mjs';
import {buildVersionedBundlePlan} from './versioned-bundle-plan.mjs';

const fail=code=>{const e=Error(code);e.code=code;throw e;};
const need=(ok,code)=>{if(!ok)fail(code);};

/**
 * The caller MUST be the installed approved B receiver. It obtains
 * approvedManifestSha256 from the live, authenticated host PIN (NEVER Issue),
 * and manifestBytes from the fixed pre-approved local registry file.
 * The returned map stays internal and is not part of any JSON/TXT result.
 */
export function selectPinnedBundleProfiles({
 manifestBytes,approvedManifestSha256,requestIdentity,
}={}){
 const selected=selectPinnedCapabilityProfiles({
  manifestBytes,approvedManifestSha256,requestIdentity});
 const trustedProfiles=Object.create(null);
 let count=0;
 for(const profile of selected.approvedProfiles){
  if(profile.bundleProfile===undefined)continue; // A-only profile.
  const bundle=profile.bundleProfile;
  need(profile.id===bundle.id&&
   profile.binding.sourceSha===requestIdentity.sourceSha&&
   profile.binding.sourceRepository===requestIdentity.sourceRepository&&
   profile.binding.sourceBranch===requestIdentity.sourceBranch,
   'B_PROFILE_SOURCE_IDENTITY_DRIFT');
  need(!Object.hasOwn(trustedProfiles,bundle.id),
   'B_PROFILE_DUPLICATE');
  const candidate={
   id:bundle.id,home:bundle.home,taskName:bundle.taskName,
   taskTime:bundle.taskTime,requiredLaunchers:bundle.requiredLaunchers,
   optionalLaunchers:bundle.optionalLaunchers,activeRecord:bundle.activeRecord,
   maxFiles:bundle.maxFiles,maxBundleBytes:bundle.maxBundleBytes,
  };
  // Validate B-specific path/Task/launcher semantics without inventing an
  // Issue-driven permission. A's syntax validation alone is insufficient:
  // the actual approved bundle manifest must separately pass the full B plan.
  need(/^E:\\ZGmini\\data\\pc-writer\\[a-z0-9_-]+$/i.test(candidate.home)&&
   /^ZGMINI-PC-[A-Za-z0-9-]{1,100}$/.test(candidate.taskName)&&
   /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate.taskTime),
   'B_PROFILE_TARGET_DENIED');
  need(candidate.requiredLaunchers.every(name=>/^[a-z0-9_.-]+\.(?:cmd|vbs)$/i.test(name))&&
   candidate.optionalLaunchers.every(name=>/^[a-z0-9_.-]+\.(?:cmd|vbs)$/i.test(name))&&
   /^[a-z0-9_.-]+\.json$/i.test(candidate.activeRecord),
   'B_PROFILE_LAUNCHER_DENIED');
  trustedProfiles[bundle.id]=Object.freeze(candidate);
  count++;
 }
 need(count>0,'B_PROFILE_NO_APPROVED_B_ENTRY');
 return Object.freeze({registrySha256:selected.registrySha256,trustedProfiles});
}

/** Immutable-approval plan using the same A/B PIN; no separate profile map.
 * Exact approval source identity MUST match the authenticated request identity.
 */
export function buildPinnedVersionedBundlePlan({
 approval,manifestBytes,approvedManifestSha256,requestIdentity,
}={}){
 need(approval?.sourceRepository===requestIdentity?.sourceRepository&&
  approval?.sourceBranch===requestIdentity?.sourceBranch&&
  approval?.sourceSha===requestIdentity?.sourceSha,
  'B_APPROVAL_SOURCE_IDENTITY_DRIFT');
 const selection=selectPinnedBundleProfiles({
  manifestBytes,approvedManifestSha256,requestIdentity});
 const plan=buildVersionedBundlePlan(approval,selection.trustedProfiles);
 return Object.freeze({...plan,registrySha256:selection.registrySha256});
}
