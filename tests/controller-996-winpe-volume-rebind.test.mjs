// Real ONLINE #1265 file IDs vs SYNTHETIC OFFLINE WinPE observations.
// No WinPE runtime, Owner trust key, C effects or production authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {plan996SingleBootRecovery}
  from '../tools/controller-996-windows-archive-adapter.mjs';
import {review996WinpeVolumeRebind}
  from '../tools/controller-996-winpe-volume-rebind-review.mjs';

const onlineObservation=JSON.parse(fs.readFileSync(new URL(
  '../results/pc-volume-identity-43124923743-1-operating.json',import.meta.url),'utf8'));
const ID='70a4c347-25ea-4fc6-83d2-c0c670115249'; // synthetic only
const fakeManifest=()=>({
  schema:'ZGMINI_CONTROLLER_996_SIGNED_OFFLINE_HANDOFF_V1',
  algorithm:'RSA_PSS_SHA256_SALT32',
  scope:'ARCHIVE_OLD_C_THEN_CONTINUATION_THEN_INSTALL_NO_REPLACE',
  originalRequestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
  continuationId:ID,winpeBootCount:1,
  existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
  ownerKeySpkiSha256:'a'.repeat(64),
  ownerNonce:'11111111-1111-4111-8111-111111111111',
  bootEpoch:'22222222-2222-4222-8222-222222222222',
  machineBindingSha256:'b'.repeat(64),volumeGuid:onlineObservation.volumeGuid,
  volumeSerial:onlineObservation.volumeSerial,
  sourceSha256:'c'.repeat(64),bootImageSha256:'d'.repeat(64),
  nativeMoverSha256:'e'.repeat(64),workflowSha256:'f'.repeat(64),
  protectedStateSha256:'1'.repeat(64),runnerAdmissionSha256:'2'.repeat(64),
  originalJobsSha256:'3'.repeat(64),
  issuedAt:'2026-11-12T00:00:00Z',expiresAt:'2026-11-12T00:20:00Z',
  moves:plan996SingleBootRecovery(ID).phases[1].moves.map((s,i)=>({
    name:s.name,source:s.source,destination:s.destination,
    sourceFileId:i===0?onlineObservation.directories.OLD_C.fileId128:
      i===2?onlineObservation.directories.INSTALL.fileId128:'9'.repeat(32),
    sourceVolumeSerial:onlineObservation.volumeSerial,
  })),
});
const fakeWinpe=()=>({
  schema:'ZGMINI_CONTROLLER_996_WINPE_HANDLE_IDS_V1',
  source:'WINPE_NATIVE_HANDLES_NO_REPARSE',
  volumeGuid:onlineObservation.volumeGuid,
  volumeSerial:onlineObservation.volumeSerial,parentPathVerified:true,
  directories:Object.fromEntries([
    ...Object.entries(onlineObservation.directories).map(([k,v])=>
      [k,{fileId128:v.fileId128,volumeSerial:onlineObservation.volumeSerial,isReparse:false}]),
    ['CONTINUATION',{fileId128:'9'.repeat(32),volumeSerial:onlineObservation.volumeSerial,
      isReparse:false}],
  ]),
});
const review=(observation=fakeWinpe(),manifest=fakeManifest(),online=onlineObservation)=>
  review996WinpeVolumeRebind({onlineObservation:online,signedManifest:manifest,
    offlineObservation:observation});

test('seven actual online directory IDs can be compared with synthetic WinPE IDs only',()=>{
  const proof=review();
  assert.equal(proof.status,'SOURCE_ONLY_EIGHT_NATIVE_IDS_COMPARED',proof.code);
  assert.equal(proof.matchedFixedCount,7);
  assert.equal(proof.matchedSignedMoveCount,3);
  assert.equal(proof.continuationClaimFileIdCompared,true);
  for(const k of ['winpeObservationAuthenticated','offlineBootVerified',
    'ownerTrustAnchorVerified','signatureCryptographicallyVerified',
    'offlineTimeVerified','executionAuthorized','automaticRetry'])
    assert.equal(proof[k],false);
  assert.equal(proof.operationalWrites,0);
});
test('offline wrong physical root, missing path, spoofed source or altered serial STOP',()=>{
  for(const mutation of [
    a=>{a.volumeGuid=a.volumeGuid.replace('Volume{','volume{');},
    a=>{a.volumeSerial='0'.repeat(16);},
    a=>{a.parentPathVerified=false;},
    a=>{a.source='CALLER_SUPPLIED_WINPE_LETTER';},
    a=>{delete a.directories.AUTOMATION;},
    a=>{a.directories.OTHER={...a.directories.ZGMINI};},
  ]){
    const observation=fakeWinpe();mutation(observation);
    const out=review(observation);
    assert.equal(out.status,'SOURCE_ONLY_BLOCKED');
    assert.equal(out.executionAuthorized,false);
  }
});
test('offline reparse, altered fixed ID, changed continuation and duplicate IDs STOP',()=>{
  for(const [mutation,code] of [
    [a=>{a.directories.OLD_C.isReparse=true;},'C996_WINPE_NATIVE_DIRECTORY_ID_INVALID'],
    [a=>{a.directories.LEASES.fileId128='a'.repeat(32);},
      'C996_WINPE_ORIGINAL_DIRECTORY_REPLACED'],
    [a=>{a.directories.CONTINUATION.fileId128='b'.repeat(32);},
      'C996_WINPE_CONTINUATION_FILE_ID_MISMATCH'],
    [a=>{a.directories.CONTINUATION.fileId128=a.directories.INSTALL.fileId128;},
      'C996_WINPE_NATIVE_DIRECTORY_ID_COLLISION'],
  ]){
    const observation=fakeWinpe();mutation(observation);
    const out=review(observation);
    assert.equal(out.code,code);
    assert.equal(out.executionAuthorized,false);
  }
});
test('preboot A receipt tampering or invalid signed move blocks before WinPE comparison',()=>{
  const online=structuredClone(onlineObservation);
  online.directories.OLD_C.fileId128='f'.repeat(32);
  assert.equal(review(fakeWinpe(),fakeManifest(),online).code,
    'C996_WINPE_PREBOOT_PINS_INVALID');
  const m=fakeManifest();m.moves[2].sourceFileId='a'.repeat(32);
  assert.equal(review(fakeWinpe(),m).code,'C996_WINPE_PREBOOT_PINS_INVALID');
  assert.equal(review(undefined,null).executionAuthorized,false);
});
