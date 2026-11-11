// #996 source-only RSA-PSS handoff evidence check. NO C execution port.
// NEVER signs an Owner grant, chooses a trusted Owner key, reads original PC
// files, or treats an OS clock/caller-provided public key as authenticated.
// The actual selected WinPE image needs a separate native CNG verifier.
import {constants,createHash,createPublicKey,verify} from 'node:crypto';
import {plan996SingleBootRecovery} from './controller-996-windows-archive-adapter.mjs';

const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const SCHEMA='ZGMINI_CONTROLLER_996_SIGNED_OFFLINE_HANDOFF_V1';
const ALGORITHM='RSA_PSS_SHA256_SALT32';
const SCOPE='ARCHIVE_OLD_C_THEN_CONTINUATION_THEN_INSTALL_NO_REPLACE';
const MAX_WINDOW_MS=30*60*1000; // Candidate bound, NOT an Owner-approved TTL.
const H64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const H32=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
const H16=x=>typeof x==='string'&&/^[a-f0-9]{16}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const UTC=x=>typeof x==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&
  Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===
    x.replace('Z','.000Z');
const sha=x=>createHash('sha256').update(x).digest('hex');
const FIELDS=Object.freeze([
  'schema','algorithm','scope','originalRequestId','continuationId',
  'winpeBootCount','existingPcName','queuePcName','ownerKeySpkiSha256',
  'ownerNonce','bootEpoch','machineBindingSha256','volumeGuid',
  'volumeSerial','sourceSha256','bootImageSha256','nativeMoverSha256',
  'workflowSha256','protectedStateSha256','runnerAdmissionSha256',
  'originalJobsSha256','issuedAt','expiresAt','moves',
]);
const MOVE_FIELDS=Object.freeze([
  'name','source','destination','sourceFileId','sourceVolumeSerial',
]);
const exact=(obj,fields)=>obj&&typeof obj==='object'&&
  !Array.isArray(obj)&&Object.keys(obj).length===fields.length&&
  fields.every(k=>Object.hasOwn(obj,k));
const reorder=(obj,fields)=>Object.fromEntries(fields.map(k=>[k,obj[k]]));
const blocked=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_HANDOFF_CRYPTO_REVIEW_V1',
  status:'SOURCE_ONLY_BLOCKED',code,
  signatureCryptographicallyVerified:false,
  evidenceAuthenticated:false,ownerApprovalVerified:false,
  trustedOwnerKeyEstablished:false,offlineClockTrusted:false,
  winpeNativeVerifierProven:false,executionAuthorized:false,
  productionExecutable:false,operationalWrites:0,automaticRetry:false,
});

// Fixed exact-byte manifest serialization. Rejects unknown fields, alternate
// ordering/whitespace, duplicate JSON keys, non-UTC timestamps, and paths not
// matching the existing #996 one-boot source-only recovery plan.
export function encode996CanonicalOfflineHandoff(data){
  if(!exact(data,FIELDS)||data.schema!==SCHEMA||
    data.algorithm!==ALGORITHM||data.scope!==SCOPE||
    data.originalRequestId!==ORIGINAL||!UUID(data.continuationId)||
    data.winpeBootCount!==1||data.existingPcName!=='기존 ZGMINI PC'||
    data.queuePcName!=='공통 대기열 PC'||
    !UUID(data.ownerNonce)||!UUID(data.bootEpoch)||
    !H64(data.ownerKeySpkiSha256)||!H64(data.machineBindingSha256)||
    !H64(data.sourceSha256)||!H64(data.bootImageSha256)||
    !H64(data.nativeMoverSha256)||!H64(data.workflowSha256)||
    !H64(data.protectedStateSha256)||!H64(data.runnerAdmissionSha256)||
    !H64(data.originalJobsSha256)||!H16(data.volumeSerial)||
    typeof data.volumeGuid!=='string'||
    !/^\\\\\?\\Volume\{[a-f0-9-]{36}\}\\$/.test(data.volumeGuid)||
    !UTC(data.issuedAt)||!UTC(data.expiresAt)||
    Date.parse(data.expiresAt)-Date.parse(data.issuedAt)<=0||
    Date.parse(data.expiresAt)-Date.parse(data.issuedAt)>MAX_WINDOW_MS||
    !Array.isArray(data.moves)||data.moves.length!==3)
    throw Object.assign(Error('C996_SIGNED_HANDOFF_MANIFEST_INVALID'),{
      code:'C996_SIGNED_HANDOFF_MANIFEST_INVALID'});
  const steps=plan996SingleBootRecovery(data.continuationId).phases[1].moves;
  const moves=data.moves.map((move,i)=>{
    if(!exact(move,MOVE_FIELDS)||move.name!==steps[i].name||
      move.source!==steps[i].source||
      move.destination!==steps[i].destination||
      !H32(move.sourceFileId)||
      move.sourceVolumeSerial!==data.volumeSerial)
      throw Object.assign(Error('C996_SIGNED_HANDOFF_MOVES_INVALID'),{
        code:'C996_SIGNED_HANDOFF_MOVES_INVALID'});
    return reorder(move,MOVE_FIELDS);
  });
  const canonical={...reorder(data,FIELDS),moves};
  const out=Buffer.from(JSON.stringify(canonical),'utf8');
  if(out.length>8192)
    throw Object.assign(Error('C996_SIGNED_HANDOFF_SIZE_INVALID'),{
      code:'C996_SIGNED_HANDOFF_SIZE_INVALID'});
  return out;
}

/**
 * Confirms only *cryptographic self-consistency* against a caller-provided
 * key/pin. The actual Owner trust anchor, genuine clock and WinPE runtime
 * evidence are absent; even a valid signature NEVER authorizes C execution.
 */
export function review996SignedOfflineHandoff({rawManifest,signature,
  ownerPublicKeyPem,expectedOwnerSpkiSha256,observedAt}={}){
  if(!Buffer.isBuffer(rawManifest)||rawManifest.length===0||
    rawManifest.length>8192||!Buffer.isBuffer(signature)||
    signature.length===0||signature.length>1024)
    return blocked('C996_SIGNED_HANDOFF_INPUT_INVALID');
  let data,canonical;
  try{
    // Round-trip strict UTF-8: replacement characters or alternate bytes fail.
    const utf8=rawManifest.toString('utf8');
    if(!Buffer.from(utf8,'utf8').equals(rawManifest))
      return blocked('C996_SIGNED_HANDOFF_UTF8_INVALID');
    data=JSON.parse(utf8);
    canonical=encode996CanonicalOfflineHandoff(data);
    if(!canonical.equals(rawManifest))
      return blocked('C996_SIGNED_HANDOFF_NONCANONICAL');
  }catch(e){return blocked(e?.code||'C996_SIGNED_HANDOFF_MANIFEST_INVALID');}
  if(!H64(expectedOwnerSpkiSha256)||
    expectedOwnerSpkiSha256!==data.ownerKeySpkiSha256)
    return blocked('C996_SIGNED_HANDOFF_KEY_PIN_MISMATCH');
  let publicKey;
  try{
    publicKey=createPublicKey(ownerPublicKeyPem);
    if(publicKey.asymmetricKeyType!=='rsa'||
      publicKey.asymmetricKeyDetails.modulusLength<2048)
      return blocked('C996_SIGNED_HANDOFF_KEY_TYPE_INVALID');
    const observedSpki=sha(publicKey.export({type:'spki',format:'der'}));
    if(observedSpki!==expectedOwnerSpkiSha256)
      return blocked('C996_SIGNED_HANDOFF_KEY_PIN_MISMATCH');
    if(!verify('sha256',rawManifest,{
      key:publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32,
    },signature))return blocked('C996_SIGNED_HANDOFF_SIGNATURE_INVALID');
  }catch{return blocked('C996_SIGNED_HANDOFF_SIGNATURE_INVALID');}
  if(!UTC(observedAt)||Date.parse(observedAt)<Date.parse(data.issuedAt)||
    Date.parse(observedAt)>=Date.parse(data.expiresAt))
    return blocked('C996_SIGNED_HANDOFF_WINDOW_INVALID');
  return Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_HANDOFF_CRYPTO_REVIEW_V1',
    status:'CRYPTO_SIGNATURE_REVIEWED_ONLY',
    originalRequestId:ORIGINAL,continuationId:data.continuationId,
    rawManifestSha256:sha(rawManifest),signedMoveCount:3,
    signedWindowSeconds:(Date.parse(data.expiresAt)-Date.parse(data.issuedAt))/1000,
    signatureCryptographicallyVerified:true,
    evidenceAuthenticated:false,ownerApprovalVerified:false,
    trustedOwnerKeyEstablished:false,offlineClockTrusted:false,
    winpeNativeVerifierProven:false,executionAuthorized:false,
    productionExecutable:false,operationalWrites:0,automaticRetry:false,
  });
}
