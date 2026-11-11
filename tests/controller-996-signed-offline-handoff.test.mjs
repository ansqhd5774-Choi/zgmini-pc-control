import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,constants,generateKeyPairSync,sign} from 'node:crypto';
import {plan996SingleBootRecovery}
  from '../tools/controller-996-windows-archive-adapter.mjs';
import {encode996CanonicalOfflineHandoff,review996SignedOfflineHandoff}
  from '../tools/controller-996-signed-offline-handoff.mjs';

// Ephemeral memory-only TEST key. Never store or accept it as Owner trust.
const {privateKey,publicKey}=generateKeyPairSync('rsa',{
  modulusLength:2048,publicExponent:0x10001,
});
const publicPem=publicKey.export({type:'spki',format:'pem'});
const keyPin=createHash('sha256').update(
  publicKey.export({type:'spki',format:'der'})).digest('hex');
const continuationId='70a4c347-25ea-4fc6-83d2-c0c670115249';
const steps=plan996SingleBootRecovery(continuationId).phases[1].moves;
const makeManifest=()=>({
  schema:'ZGMINI_CONTROLLER_996_SIGNED_OFFLINE_HANDOFF_V1',
  algorithm:'RSA_PSS_SHA256_SALT32',
  scope:'ARCHIVE_OLD_C_THEN_CONTINUATION_THEN_INSTALL_NO_REPLACE',
  originalRequestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
  continuationId,winpeBootCount:1,
  existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
  ownerKeySpkiSha256:keyPin,
  ownerNonce:'11111111-1111-4111-8111-111111111111',
  bootEpoch:'22222222-2222-4222-8222-222222222222',
  machineBindingSha256:'a'.repeat(64),
  volumeGuid:'\\\\?\\Volume{33333333-3333-4333-8333-333333333333}\\',
  volumeSerial:'1'.repeat(16),
  sourceSha256:'b'.repeat(64),bootImageSha256:'c'.repeat(64),
  nativeMoverSha256:'d'.repeat(64),workflowSha256:'e'.repeat(64),
  protectedStateSha256:'f'.repeat(64),runnerAdmissionSha256:'2'.repeat(64),
  originalJobsSha256:'3'.repeat(64),
  issuedAt:'2026-11-11T12:00:00Z',expiresAt:'2026-11-11T12:20:00Z',
  moves:steps.map((step,i)=>({
    name:step.name,source:step.source,destination:step.destination,
    sourceFileId:String(i+1).repeat(32),sourceVolumeSerial:'1'.repeat(16),
  })),
});
const signature=raw=>sign('sha256',raw,{
  key:privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32,
});
const review=(raw,options={})=>review996SignedOfflineHandoff({
  rawManifest:raw,signature:signature(raw),ownerPublicKeyPem:publicPem,
  expectedOwnerSpkiSha256:keyPin,observedAt:'2026-11-11T12:10:00Z',
  ...options,
});

test('RSA-PSS SHA256 exact-byte check is real crypto, but never authenticates the Owner or C',()=>{
  const raw=encode996CanonicalOfflineHandoff(makeManifest());
  const result=review(raw);
  assert.equal(result.status,'CRYPTO_SIGNATURE_REVIEWED_ONLY');
  assert.equal(result.signatureCryptographicallyVerified,true);
  assert.equal(result.rawManifestSha256,
    createHash('sha256').update(raw).digest('hex'));
  assert.equal(result.signedWindowSeconds,1200);
  assert.equal(result.signedMoveCount,3);
  for(const field of ['evidenceAuthenticated','ownerApprovalVerified',
    'trustedOwnerKeyEstablished','offlineClockTrusted',
    'winpeNativeVerifierProven','executionAuthorized',
    'productionExecutable','automaticRetry'])assert.equal(result[field],false);
  assert.equal(result.operationalWrites,0);
});
test('changing any signed executable hash or source byte fails signature verification',()=>{
  const raw=encode996CanonicalOfflineHandoff(makeManifest());
  const sig=signature(raw);
  const changed=makeManifest();changed.nativeMoverSha256='0'.repeat(64);
  const tampered=encode996CanonicalOfflineHandoff(changed);
  const result=review(tampered,{signature:sig});
  assert.equal(result.code,'C996_SIGNED_HANDOFF_SIGNATURE_INVALID');
  assert.equal(result.executionAuthorized,false);
  const broken=Buffer.from(sig);broken[0]^=0x40;
  assert.equal(review(raw,{signature:broken}).code,
    'C996_SIGNED_HANDOFF_SIGNATURE_INVALID');
});
test('RSA-PSS signatures with the wrong salt or PKCS1 v1.5 padding are rejected',()=>{
  const raw=encode996CanonicalOfflineHandoff(makeManifest());
  const badSalt=sign('sha256',raw,{
    key:privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:0,
  });
  const legacy=sign('sha256',raw,{
    key:privateKey,padding:constants.RSA_PKCS1_PADDING,
  });
  for(const sig of [badSalt,legacy]){
    const r=review(raw,{signature:sig});
    assert.equal(r.code,'C996_SIGNED_HANDOFF_SIGNATURE_INVALID');
    assert.equal(r.executionAuthorized,false);
  }
});
test('caller key-pin mismatch and a substituted public key reject',()=>{
  const raw=encode996CanonicalOfflineHandoff(makeManifest());
  assert.equal(review(raw,{expectedOwnerSpkiSha256:'0'.repeat(64)}).code,
    'C996_SIGNED_HANDOFF_KEY_PIN_MISMATCH');
  const second=generateKeyPairSync('rsa',{modulusLength:2048});
  assert.equal(review(raw,{ownerPublicKeyPem:second.publicKey.export({
    type:'spki',format:'pem',
  })}).code,'C996_SIGNED_HANDOFF_KEY_PIN_MISMATCH');
});
test('noncanonical whitespace, duplicate/unknown fields and invalid UTF8 are rejected',()=>{
  const raw=encode996CanonicalOfflineHandoff(makeManifest());
  const padded=Buffer.from(raw.toString('utf8').replace(',"algorithm"',', "algorithm"'));
  assert.equal(review(padded).code,'C996_SIGNED_HANDOFF_NONCANONICAL');
  const duplicated=Buffer.from(raw.toString('utf8').replace(
    '"winpeBootCount":1,','"winpeBootCount":1,"winpeBootCount":1,'));
  assert.equal(review(duplicated).code,'C996_SIGNED_HANDOFF_NONCANONICAL');
  const unknown={...makeManifest(),unsafeOverride:true};
  assert.throws(()=>encode996CanonicalOfflineHandoff(unknown),
    /C996_SIGNED_HANDOFF_MANIFEST_INVALID/);
  assert.equal(review(Buffer.from([0xc3,0x28])).code,
    'C996_SIGNED_HANDOFF_UTF8_INVALID');
});
test('wrong move order, destination, File ID or volume serial blocks the contract',()=>{
  for(const change of [
    m=>m.moves.reverse(),
    m=>{m.moves[0].destination=m.moves[1].destination;},
    m=>{m.moves[1].sourceFileId='invalid';},
    m=>{m.moves[2].sourceVolumeSerial='0'.repeat(16);},
  ]){
    const m=makeManifest();change(m);
    assert.throws(()=>encode996CanonicalOfflineHandoff(m),
      /C996_SIGNED_HANDOFF_MOVES_INVALID/);
  }
});
test('expiry, future issuance and oversized window all fail with no execution capability',()=>{
  const raw=encode996CanonicalOfflineHandoff(makeManifest());
  for(const observedAt of ['2026-11-11T12:20:00Z',
    '2026-11-11T12:21:00Z','2026-11-11T11:59:59Z',
    'untrusted-time']){
    const result=review(raw,{observedAt});
    assert.equal(result.code,'C996_SIGNED_HANDOFF_WINDOW_INVALID');
    assert.equal(result.executionAuthorized,false);
  }
  const m=makeManifest();m.expiresAt='2026-11-11T12:31:00Z';
  assert.throws(()=>encode996CanonicalOfflineHandoff(m),
    /C996_SIGNED_HANDOFF_MANIFEST_INVALID/);
});
