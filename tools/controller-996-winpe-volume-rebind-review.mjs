// #996 WinPE volume rebind candidate: pure comparison only.
// The actual WinPE native handle reader and trusted evidence source are NOT
// implemented or authorized by this code. Caller-supplied offline observations
// can be forged. It cannot change a C-grade STOP or authorize any archive.
import {review996OnlineVolumePinsForHandoff} from
  './controller-996-signed-offline-handoff.mjs';
import {review996WinpeVolumeRelativeMoves} from
  './controller-996-windows-archive-adapter.mjs';

const ROOTS=Object.freeze([
  'VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE','LEASES','OLD_C','INSTALL',
]);
const ALL=Object.freeze([...ROOTS,'CONTINUATION']);
const H16=x=>typeof x==='string'&&/^[a-f0-9]{16}$/.test(x);
const H32=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
const blocked=(code,matchedFixedCount=0)=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_WINPE_REBIND_REVIEW_V1',
  status:'SOURCE_ONLY_BLOCKED',code,matchedFixedCount,
  matchedSignedMoveCount:0,continuationClaimFileIdCompared:false,
  winpeObservationAuthenticated:false,offlineBootVerified:false,
  ownerTrustAnchorVerified:false,signatureCryptographicallyVerified:false,
  offlineTimeVerified:false,executionAuthorized:false,
  operationalWrites:0,automaticRetry:false,
});
/**
 * Compare a pre-boot A readback and independently *supplied* WinPE handle
 * observations. Do NOT use this as a WinPE attestation: inputs are untrusted.
 * Eight fixed native directory file IDs are required; a missing, reparse,
 * duplicated, wrong-volume, or replaced entry is an unconditional STOP.
 *
 * This deliberately does not accept drive letters or caller-chosen paths.
 */
export function review996WinpeVolumeRebind({
  onlineObservation,signedManifest,offlineObservation,
}={}){
  const original=review996OnlineVolumePinsForHandoff({
    onlineObservation,signedManifest,
  });
  if(original.status!=='SOURCE_ONLY_TWO_ORIGINAL_PINS_MATCH')
    return blocked('C996_WINPE_PREBOOT_PINS_INVALID');
  const relative=review996WinpeVolumeRelativeMoves({
    continuationId:signedManifest.continuationId,
    volumeGuid:signedManifest.volumeGuid,
    volumeSerial:signedManifest.volumeSerial,
    moves:signedManifest.moves,
  });
  if(relative.status!=='SOURCE_ONLY_RELATIVE_PATHS_REVIEWED')
    return blocked('C996_WINPE_SIGNED_RELATIVE_PATH_DRIFT');
  const a=offlineObservation;
  if(!a||a.schema!=='ZGMINI_CONTROLLER_996_WINPE_HANDLE_IDS_V1'||
    a.source!=='WINPE_NATIVE_HANDLES_NO_REPARSE'||
    a.volumeGuid!==onlineObservation.volumeGuid||
    a.volumeSerial!==onlineObservation.volumeSerial||
    !H16(a.volumeSerial)||a.parentPathVerified!==true||
    !a.directories||typeof a.directories!=='object'||
    Array.isArray(a.directories)||
    Object.keys(a.directories).sort().join('|')!==[...ALL].sort().join('|'))
    return blocked('C996_WINPE_OFFLINE_VOLUME_OBSERVATION_INVALID');
  const ids=[];
  for(const key of ALL){
    const entry=a.directories[key];
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||
       Object.keys(entry).sort().join('|')!=='fileId128|isReparse|volumeSerial'||
       !H32(entry.fileId128)||!H16(entry.volumeSerial)||
       entry.isReparse!==false||entry.volumeSerial!==a.volumeSerial)
      return blocked('C996_WINPE_NATIVE_DIRECTORY_ID_INVALID');
    ids.push(entry.fileId128);
  }
  if(new Set(ids).size!==ALL.length)
    return blocked('C996_WINPE_NATIVE_DIRECTORY_ID_COLLISION');
  let matched=0;
  for(const key of ROOTS){
    if(a.directories[key].fileId128!==onlineObservation.directories[key].fileId128)
      return blocked('C996_WINPE_ORIGINAL_DIRECTORY_REPLACED',matched);
    matched++;
  }
  // Continuation is not in the pre-boot A receipt. Its file ID must match
  // the independently signed manifest before a real native operator may
  // even consider it. This comparison is still NOT signature verification.
  if(a.directories.CONTINUATION.fileId128!==
      signedManifest.moves[1].sourceFileId)
    return blocked('C996_WINPE_CONTINUATION_FILE_ID_MISMATCH',matched);
  return Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_WINPE_REBIND_REVIEW_V1',
    status:'SOURCE_ONLY_EIGHT_NATIVE_IDS_COMPARED',
    originalReadbackRunId:String(onlineObservation.runId),
    matchedFixedCount:matched,matchedSignedMoveCount:3,
    continuationClaimFileIdCompared:true,
    winpeObservationAuthenticated:false,offlineBootVerified:false,
    ownerTrustAnchorVerified:false,signatureCryptographicallyVerified:false,
    offlineTimeVerified:false,executionAuthorized:false,
    operationalWrites:0,automaticRetry:false,
  });
}
