// ER1 D+30 fixed-scope read-only Windows preview entrypoint for an existing,
// authenticated PC host. NOT an Issue receiver, scheduler, installer or CLI.
// The host supplies only trusted read operations; no operational write method
// is accepted. Three-way scratch work is confined to the caller's TEMP root.
import path from 'node:path';
import {D30_INSTALL_CONTRACT,coreSourceIdentity} from './contract.mjs';
import {previewD30ThreeFiles} from './windows-stage.mjs';

export const D30_WINDOWS_SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const PATHS=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
const BASE=D30_INSTALL_CONTRACT.historicPublicSourceSha;
const TARGET=D30_INSTALL_CONTRACT.sourceHead;
const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
const SHA40=/^[0-9a-f]{40}$/;
const STOP=/^ER1_D30_[A-Z0-9_]+$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

/**
 * Required host methods are read-only and must be implemented by the existing
 * approved Windows host, not from an Issue-body-supplied function or command:
 * inspectTrustedControl() -> {repository,head,authenticated,readOnlyAuthorized}
 * inspectCandidateCheckout() -> {head,repository,objectsAvailable}
 * readGitBlob(commit,relPath) -> Buffer; fixed commits/paths only
 * readWindowsFile(absPath) -> Buffer; fixed E: sourceRoot, lstat/realpath guarded
 * inspectSourceProvenance() -> activeCore A-grade evidence or null
 *
 * Source provenance is an INDEPENDENT read-only inquiry. Lack of runtime/task
 * corroboration doesn't suppress a useful hash-only preview, but cannot be
 * represented as permission to perform a later B-grade write.
 */
export async function runD30WindowsReadOnlyPreview({host,gitExe='git',tempRoot}={}){
  const blocked=code=>({status:'READ_ONLY_PREVIEW_BLOCKED',code,
    sourceWrites:0,dbWrites:0,taskChanges:0});
  try{
    for(const name of ['inspectTrustedControl','inspectCandidateCheckout',
      'readGitBlob','readWindowsFile','inspectSourceProvenance'])
      need(typeof host?.[name]==='function','ER1_D30_PREVIEW_HOST_INCOMPLETE');
    const trusted=await host.inspectTrustedControl();
    need(trusted?.repository===CONTROL_REPO&&SHA40.test(trusted?.head??'')&&
      trusted?.authenticated===true&&trusted?.readOnlyAuthorized===true,
    'ER1_D30_PREVIEW_CONTROL_SOURCE_UNVERIFIED');
    const checkout=await host.inspectCandidateCheckout();
    need(checkout?.repository===D30_INSTALL_CONTRACT.sourceRepository&&
      checkout.head===TARGET&&checkout.objectsAvailable===true,
    'ER1_D30_PREVIEW_CANDIDATE_CHECKOUT_STOP');

    const publicBases={},candidateTargets={},windowsPreimages={};
    for(const rel of PATHS){
      // Neither the user request nor a manifest controls these revisions,
      // relative paths, or the absolute PC source root.
      publicBases[rel]=await host.readGitBlob(BASE,rel);
      candidateTargets[rel]=await host.readGitBlob(TARGET,rel);
      windowsPreimages[rel]=await host.readWindowsFile(
        path.win32.join(D30_WINDOWS_SOURCE_ROOT,...rel.split('/')));
    }
    const preview=previewD30ThreeFiles({publicBases,windowsPreimages,
      candidateTargets,gitExe,tempRoot});
    const evidence=await host.inspectSourceProvenance();
    const beforeSourceSha=evidence?.sourceRoot===D30_WINDOWS_SOURCE_ROOT?
      coreSourceIdentity(evidence):null;
    const result={status:'READ_ONLY_PREVIEW_VERIFIED',
      sourceProvenance:beforeSourceSha?'CORROBORATED':'PENDING',
      ...(beforeSourceSha?{beforeSourceSha}:{}),
      baseSourceSha:BASE,candidateSourceSha:TARGET,
      files:PATHS.map(rel=>({path:rel,
        beforeSha256:preview.files[rel].beforeSha256,
        baseSha256:preview.files[rel].baseSha256,
        candidateSha256:preview.files[rel].candidateSha256,
        candidateBlob:preview.files[rel].candidateBlob,
        afterSha256:preview.files[rel].afterSha256,
        mergeRequired:preview.files[rel].mergeRequired,
        preservedVerified:preview.files[rel].preservedVerified})),
      sourceWrites:0,dbWrites:0,taskChanges:0};
    // Only exact fixed paths, digests and statuses leave this function. No
    // original/merged bytes, E: inventory, token, environment or raw errors.
    need(Buffer.byteLength(JSON.stringify(result),'utf8')<32_768,
      'ER1_D30_PREVIEW_REPORT_SIZE_STOP');
    return result;
  }catch(error){
    return blocked(STOP.test(error?.code??'')?error.code:
      'ER1_D30_PREVIEW_READ_STOP');
  }
}
