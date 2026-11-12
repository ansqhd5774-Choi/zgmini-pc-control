// #996 untrusted C native source receipt -> existing signed/online source-only
// comparison. No WinPE runtime/provenance, Owner trust, or C effect is asserted.
// This module has no side effects and cannot authorize C.
import {review996OnlineVolumePinsForHandoff} from
  './controller-996-signed-offline-handoff.mjs';
import {review996WinpeVolumeRelativeMoves} from
  './controller-996-windows-archive-adapter.mjs';

const KEYS=Object.freeze([
  'VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE',
  'LEASES','OLD_C','INSTALL','CONTINUATION',
]);
const FIELD_KEYS=Object.freeze([
  'schema','source','untrustedVolumeGuid','volumeSerial','directories',
  'idsCollected','readOnly','winpeBootAuthenticated',
  'ownerSignatureVerified','offlineClockTrusted',
  'volumeGuidAuthenticated','cExecutionAuthorized','operationalWrites',
]);
const ID=/^[0-9a-f]{32}$/;
const SERIAL=/^[0-9a-f]{16}$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GUID_PREFIX='\\\\?\\Volume{';
const sameFields=(obj,expected)=>Boolean(
  obj && typeof obj==='object' && !Array.isArray(obj) &&
  Object.keys(obj).sort().join('|')===[...expected].sort().join('|'));
const denied=(code)=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_ID_UNTRUSTED_REVIEW_V1',
  status:'SOURCE_ONLY_BLOCKED',code,
  matchedFixedCount:0,matchedSignedMoveCount:0,
  nativeReceiptAuthenticated:false,offlineBootVerified:false,
  ownerTrustAnchorVerified:false,ownerApprovalVerified:false,
  offlineClockTrusted:false,executionAuthorized:false,
  operationalWrites:0,automaticRetry:false,
});

/**
 * The native C formatter emits only a SOURCE_ONLY_UNTRUSTED JSON document.
 * Even a byte-perfect, pinned-ID match is NOT evidence of WinPE boot or
 * provenance. This review intentionally does not fabricate the existing
 * WINPE_NATIVE_HANDLES_NO_REPARSE source discriminator.
 */
export function review996UntrustedNativeIdReceipt({
  rawReceipt,onlineObservation,signedManifest,
}={}){
  if(!Buffer.isBuffer(rawReceipt)||rawReceipt.length<100||
     rawReceipt.length>4096)
    return denied('C996_NATIVE_UNTRUSTED_RECEIPT_BYTES_INVALID');
  const rawText=rawReceipt.toString('utf8');
  if(!Buffer.from(rawText,'utf8').equals(rawReceipt))
    return denied('C996_NATIVE_UNTRUSTED_RECEIPT_UTF8_INVALID');
  let obs;
  try{obs=JSON.parse(rawText);}
  catch{return denied('C996_NATIVE_UNTRUSTED_RECEIPT_JSON_INVALID');}
  if(!sameFields(obs,FIELD_KEYS)||
     JSON.stringify(obs)!==rawText||
     obs.schema!=='ZGMINI_CONTROLLER_996_NATIVE_IDS_UNTRUSTED_V1'||
     obs.source!=='WIN32_NATIVE_SOURCE_ONLY_UNTRUSTED'||
     obs.idsCollected!==8||obs.readOnly!==true||
     obs.winpeBootAuthenticated!==false||
     obs.ownerSignatureVerified!==false||
     obs.offlineClockTrusted!==false||
     obs.volumeGuidAuthenticated!==false||
     obs.cExecutionAuthorized!==false||obs.operationalWrites!==0)
    return denied('C996_NATIVE_UNTRUSTED_RECEIPT_CONTRACT_INVALID');
  const guid=obs.untrustedVolumeGuid;
  if(typeof guid!=='string'||guid.length!==49||
     guid.slice(0,11)!==GUID_PREFIX||guid[47]!=='}'||guid[48]!=='\\'||
     !UUID.test(guid.slice(11,47))||!SERIAL.test(obs.volumeSerial))
    return denied('C996_NATIVE_UNTRUSTED_VOLUME_FORMAT_INVALID');
  if(!sameFields(obs.directories,KEYS))
    return denied('C996_NATIVE_UNTRUSTED_DIRECTORY_SET_INVALID');
  const ids=[];
  for(const key of KEYS){
    const d=obs.directories[key];
    if(!sameFields(d,['fileId128','volumeSerial','isReparse'])||
       !ID.test(d.fileId128)||!SERIAL.test(d.volumeSerial)||
       d.volumeSerial!==obs.volumeSerial||d.isReparse!==false)
      return denied('C996_NATIVE_UNTRUSTED_DIRECTORY_ID_INVALID');
    ids.push(d.fileId128);
  }
  if(new Set(ids).size!==8)
    return denied('C996_NATIVE_UNTRUSTED_DUPLICATED_ID');
  if(!onlineObservation&&!signedManifest)
    return Object.freeze({
      ...denied('C996_NATIVE_ONLY_SHAPE_NO_PIN_COMPARISON'),
      status:'SOURCE_ONLY_UNTRUSTED_RECEIPT_SHAPE_VALID',
      nativeDirectoryCount:8,
    });
  const pin=review996OnlineVolumePinsForHandoff({
    onlineObservation,signedManifest});
  if(pin.status!=='SOURCE_ONLY_TWO_ORIGINAL_PINS_MATCH')
    return denied('C996_NATIVE_UNTRUSTED_ONLINE_PIN_INVALID');
  const moves=review996WinpeVolumeRelativeMoves({
    continuationId:signedManifest.continuationId,
    volumeGuid:signedManifest.volumeGuid,
    volumeSerial:signedManifest.volumeSerial,
    moves:signedManifest.moves,
  });
  if(moves.status!=='SOURCE_ONLY_RELATIVE_PATHS_REVIEWED')
    return denied('C996_NATIVE_UNTRUSTED_SIGNED_PATH_DRIFT');
  if(guid!==onlineObservation.volumeGuid||
     obs.volumeSerial!==onlineObservation.volumeSerial)
    return denied('C996_NATIVE_UNTRUSTED_VOLUME_MISMATCH');
  for(const key of KEYS.slice(0,7))
    if(obs.directories[key].fileId128!==
       onlineObservation.directories[key].fileId128)
      return denied('C996_NATIVE_UNTRUSTED_FIXED_ID_MISMATCH');
  if(obs.directories.CONTINUATION.fileId128!==
     signedManifest.moves[1].sourceFileId)
    return denied('C996_NATIVE_UNTRUSTED_CONTINUATION_ID_MISMATCH');
  return Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_NATIVE_ID_UNTRUSTED_REVIEW_V1',
    status:'SOURCE_ONLY_UNTRUSTED_EIGHT_IDS_MATCH_PINNED_INPUTS',
    code:'C996_UNTRUSTED_NATIVE_ID_SOURCE_ONLY_MATCH',
    matchedFixedCount:7,matchedSignedMoveCount:3,
    nativeDirectoryCount:8,
    nativeReceiptAuthenticated:false,offlineBootVerified:false,
    ownerTrustAnchorVerified:false,ownerApprovalVerified:false,
    offlineClockTrusted:false,executionAuthorized:false,
    operationalWrites:0,automaticRetry:false,
  });
}
