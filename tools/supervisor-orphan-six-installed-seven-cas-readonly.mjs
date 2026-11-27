// Source-only local byte/CAS observation for the existing independent maintainer.
// This cannot attest Windows receiver ancestry, claim a lease, approve an OS
// signal, install a module, start/stop a Runner or mutate any operating file.
// It intentionally does NOT return the PRIVATE_INDEPENDENT_B_MAINTAINER origin
// that the separate operational admission receiver requires.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nextRuntimeFiles} from './handoff-maintenance.mjs';

const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const sha=x=>createHash('sha256').update(x).digest('hex');
const denied=code=>Object.freeze({
 status:'BLOCKED',code,origin:'SOURCE_ONLY_LOCAL_CAS_READ',
 installedRuntimeVerified:false,verifiedNinePinnedMaintainerFiles:false,
 receiverAncestryVerified:false,controllerBPolicyUnchangedVerified:false,
 effectAuthorized:false,runnerStopAuthorized:false,operationalWrites:0
});
function regular(file,maxBytes){
 const before=fs.lstatSync(file);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||
    before.size<1||before.size>maxBytes)throw Error('CAS_FILE_TYPE_DENIED');
 const bytes=fs.readFileSync(file);
 const after=fs.lstatSync(file);
 if(after.ino!==before.ino||after.size!==before.size||
    after.mtimeMs!==before.mtimeMs||bytes.length!==before.size)
  throw Error('CAS_CHANGED_DURING_READ');
 return bytes;
}
const exact=(actual,expected)=>Array.isArray(actual)&&
 actual.length===expected.length&&actual.every((x,i)=>x===expected[i]);

// Canonical digest definition is explicit: the UTF-8 JSON representation of
// the seven ordered [path,sha256] tuples, followed by ONE LF. It is NOT the
// SHA of HTTP raw bytes, a Git tree, an unordered object, or the nine-file
// source-only policy proposal. These byte domains must never be conflated.
export function digestOrphanSevenInstalledRuntimeFiles(files){
 if(!files||typeof files!=='object'||Array.isArray(files)||
    !exact(Object.keys(files).sort(),[...nextRuntimeFiles].sort())||
    nextRuntimeFiles.some(p=>!SHA64.test(files[p])))
  throw Error('ORPHAN_SIX_SEVEN_FILE_SET_INVALID');
 const ordered=[...nextRuntimeFiles].sort().map(p=>[p,files[p]]);
 return sha(Buffer.from(JSON.stringify(ordered)+'\n','utf8'));
}

export function inspectOrphanInstalledSevenCasReadOnly({
 root,expectedInstalledManifestRawSha256,expectedMaintainerSourceSha,
 expectedSevenRuntimeFilesSha256
}={}){
 if(typeof root!=='string'||!path.isAbsolute(root)||root.length>512||
    !SHA64.test(expectedInstalledManifestRawSha256??'')||
    !SHA40.test(expectedMaintainerSourceSha??'')||
    !SHA64.test(expectedSevenRuntimeFilesSha256??''))
  return denied('ORPHAN_SIX_INSTALLED_CAS_INPUT_INVALID');
 try{
  const actualRoot=path.resolve(root);
  // The trusted installed B must separately pin the same-host fixed root and
  // its OS ancestry; this read-only function never grants such identity.
  for(const dir of [actualRoot,path.join(actualRoot,'tools')]){
   const stat=fs.lstatSync(dir);
   if(!stat.isDirectory()||stat.isSymbolicLink())
    return denied('ORPHAN_SIX_INSTALLED_CAS_DIRECTORY_ALIAS');
  }
  const raw=regular(path.join(actualRoot,'MAINTENANCE_INSTALL.json'),131072);
  if(sha(raw)!==expectedInstalledManifestRawSha256)
   return denied('ORPHAN_SIX_INSTALLED_MANIFEST_RAW_CAS_MISMATCH');
  let manifest;
  try{manifest=JSON.parse(raw.toString('utf8'));}catch{
   return denied('ORPHAN_SIX_INSTALLED_MANIFEST_JSON_INVALID');
  }
  if(manifest?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'||
     manifest.sourceSha!==expectedMaintainerSourceSha)
   return denied('ORPHAN_SIX_INSTALLED_MAINTAINER_SHA_MISMATCH');
  let digest;
  try{digest=digestOrphanSevenInstalledRuntimeFiles(manifest.files);}catch{
   return denied('ORPHAN_SIX_INSTALLED_FILES_MANIFEST_INVALID');
  }
  if(digest!==expectedSevenRuntimeFilesSha256)
   return denied('ORPHAN_SIX_INSTALLED_FILES_PIN_MISMATCH');
  for(const rel of nextRuntimeFiles){
   const file=path.join(actualRoot,rel);
   if(sha(regular(file,2000000))!==manifest.files[rel])
    return denied('ORPHAN_SIX_INSTALLED_FILE_BYTES_MISMATCH');
  }
  return Object.freeze({
   ...denied('ORPHAN_SIX_INSTALLED_SEVEN_FILES_SOURCE_ONLY'),
   status:'CANDIDATE_ONLY',
   installedRuntimeVerified:true,
   installedMaintainerSha:manifest.sourceSha,
   installedManifestRawSha256:sha(raw),
   sevenRuntimeFilesSha256:digest,
   // These boundaries require genuine independent same-host B attestation.
   verifiedNinePinnedMaintainerFiles:false,
   receiverAncestryVerified:false,
   controllerBPolicyUnchangedVerified:false,
   nextAction:'PRIVATE_INDEPENDENT_B_ANCESTRY_POLICY_LEASE_WATCHDOG_CAS_REQUIRED'
  });
 }catch{
  // Omit paths, source bytes and private runtime details from error output.
  return denied('ORPHAN_SIX_INSTALLED_CAS_READBACK_UNKNOWN');
 }
}
