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

/**
 * Deterministic PUBLIC-key representation for the future WinPE Bcrypt import.
 * This only establishes SPKI <-> RSA public BLOB consistency on the caller's
 * key. It neither pins a real Owner trust anchor nor exports a private key.
 */
export function derive996CngRsaPublicBlob(ownerPublicKeyPem){
  if(typeof ownerPublicKeyPem!=='string'||
    ownerPublicKeyPem.length===0||ownerPublicKeyPem.length>8192)
    throw Error('C996_CNG_PUBLIC_KEY_INVALID');
  let key,jwk;
  try{
    key=createPublicKey(ownerPublicKeyPem);
    jwk=key.export({format:'jwk'});
  }catch{throw Error('C996_CNG_PUBLIC_KEY_INVALID');}
  if(key.asymmetricKeyType!=='rsa'||jwk.kty!=='RSA'||
    typeof jwk.n!=='string'||typeof jwk.e!=='string'||
    !/^[A-Za-z0-9_-]+$/.test(jwk.n)||
    !/^[A-Za-z0-9_-]+$/.test(jwk.e))
    throw Error('C996_CNG_PUBLIC_KEY_INVALID');
  const modulus=Buffer.from(jwk.n,'base64url');
  const exponent=Buffer.from(jwk.e,'base64url');
  if(modulus.length<256||modulus.length>1024||
    (modulus[0]&0x80)===0||
    !exponent.equals(Buffer.from([0x01,0x00,0x01])))
    throw Error('C996_CNG_PUBLIC_KEY_INVALID');
  const blob=Buffer.alloc(24+exponent.length+modulus.length);
  blob.writeUInt32LE(0x31415352,0); // BCRYPT_RSAPUBLIC_MAGIC (RSA1)
  blob.writeUInt32LE(modulus.length*8,4);
  blob.writeUInt32LE(exponent.length,8);
  blob.writeUInt32LE(modulus.length,12);
  // cbPrime1 and cbPrime2 remain zero for a PUBLIC-only key.
  exponent.copy(blob,24);
  modulus.copy(blob,24+exponent.length);
  return Object.freeze({
    rsaPublicBlob:blob,spkiSha256:sha(key.export({type:'spki',format:'der'})),
    rsaPublicBlobSha256:sha(blob),
    ownerTrustAuthenticated:false,executionAuthorized:false,
  });
}

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

// The #1265 fixed A-grade observation is the first real ORIGINAL Windows
// E: GUID/serial/FILE_ID_INFO readback, NOT signed preboot Owner evidence.
// This comparison never reads a PC or the network and does not authenticate
// GitHub delivery, an offline WinPE rebind, or the continuation C claim.
// The immutable receipt is intentionally referenced, NOT copied, here.
const ORIGINAL_VOLUME_READBACK=Object.freeze({
  issueNumber:1265,runId:'43124923743',
  requestId:'e741024c-47c5-40ca-b9d1-fbb250e79e42',
});
const ONLINE_DIR_KEYS=Object.freeze([
  'VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE','LEASES','OLD_C','INSTALL',
]);
export function review996OnlineVolumePinsForHandoff({
  onlineObservation,signedManifest,
}={}){
  const block=code=>Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_ONLINE_VOLUME_PIN_REVIEW_V1',
    status:'SOURCE_ONLY_BLOCKED',code,
    matchedSignedMoveCount:0,continuationClaimIdVerified:false,
    onlineEvidenceAuthenticated:false,signatureCryptographicallyVerified:false,
    offlineVolumeVerified:false,ownerApprovalVerified:false,
    executionAuthorized:false,operationalWrites:0,automaticRetry:false,
  });
  const v=onlineObservation;
  if(!v||v.schema!=='ZGMINI_PC_VOLUME_IDENTITY_PROBE_V1'||
    v.status!=='PASS'||v.code!=='VOLUME_IDS_READONLY_OBSERVED'||
    v.issueNumber!==ORIGINAL_VOLUME_READBACK.issueNumber||
    String(v.runId)!==ORIGINAL_VOLUME_READBACK.runId||
    v.requestId!==ORIGINAL_VOLUME_READBACK.requestId||
    String(v.attempt)!=='1'||String(v.host).toUpperCase()!=='PC'||
    !/^zgmini-pc-0[1-6]$/.test(v.runnerName||'')||
    v.source!=='WIN32_GET_VOLUME_NAME_AND_FILE_ID_INFO'||
    v.cExecutionAuthorized!==false||v.offlineVolumeVerified!==false||
    v.operationalWrites!==0||v.automaticRetries!==0)
    return block('C996_PREBOOT_ONLINE_RECEIPT_INVALID');
  const observed=v.directories;
  if(!H16(v.volumeSerial)||typeof v.volumeGuid!=='string'||
    !/^\\\\\?\\Volume\{[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\}\\$/.test(v.volumeGuid)||
    !observed||typeof observed!=='object'||Array.isArray(observed)||
    Object.keys(observed).sort().join('|')!==[...ONLINE_DIR_KEYS].sort().join('|')||
    ONLINE_DIR_KEYS.some(k=>observed[k]?.state!=='PRESENT'||
      !H32(observed[k]?.fileId128))||
    new Set(ONLINE_DIR_KEYS.map(k=>observed[k].fileId128)).size!==ONLINE_DIR_KEYS.length)
    return block('C996_PREBOOT_VOLUME_FILE_IDS_INVALID');
  if(!signedManifest||typeof signedManifest!=='object')
    return block('C996_PREBOOT_SIGNED_MANIFEST_MISSING');
  try{encode996CanonicalOfflineHandoff(signedManifest);}
  catch{return block('C996_PREBOOT_SIGNED_MANIFEST_INVALID');}
  if(signedManifest.volumeGuid!==v.volumeGuid||
    signedManifest.volumeSerial!==v.volumeSerial)
    return block('C996_PREBOOT_SIGNED_VOLUME_MISMATCH');
  // Move 0 (old C) and move 2 (install lease) are the only currently
  // observed signed source identities. The continuation claim is absent
  // from this original A-grade readback and MUST NOT be inferred.
  if(signedManifest.moves[0].sourceFileId!==observed.OLD_C.fileId128||
     signedManifest.moves[2].sourceFileId!==observed.INSTALL.fileId128)
    return block('C996_PREBOOT_SIGNED_SOURCE_ID_MISMATCH');
  return Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_ONLINE_VOLUME_PIN_REVIEW_V1',
    status:'SOURCE_ONLY_TWO_ORIGINAL_PINS_MATCH',
    originalReadbackRunId:ORIGINAL_VOLUME_READBACK.runId,
    matchedOriginalDirectoryCount:ONLINE_DIR_KEYS.length,
    matchedSignedMoveCount:2,
    continuationClaimIdVerified:false,
    onlineEvidenceAuthenticated:false,signatureCryptographicallyVerified:false,
    offlineVolumeVerified:false,ownerApprovalVerified:false,
    executionAuthorized:false,operationalWrites:0,automaticRetry:false,
  });
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
