// CI-only readback proof; no private volume identifiers are logged or copied.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {plan996SingleBootRecovery}
  from '../tools/controller-996-windows-archive-adapter.mjs';
import {review996OnlineVolumePinsForHandoff}
  from '../tools/controller-996-signed-offline-handoff.mjs';

const observation=JSON.parse(fs.readFileSync(
  new URL('../results/pc-volume-identity-43124923743-1-operating.json',import.meta.url),
  'utf8'));
const continuationId='70a4c347-25ea-4fc6-83d2-c0c670115249';
function candidate(){
  return {
    schema:'ZGMINI_CONTROLLER_996_SIGNED_OFFLINE_HANDOFF_V1',
    algorithm:'RSA_PSS_SHA256_SALT32',
    scope:'ARCHIVE_OLD_C_THEN_CONTINUATION_THEN_INSTALL_NO_REPLACE',
    originalRequestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
    continuationId,winpeBootCount:1,
    existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
    ownerKeySpkiSha256:'a'.repeat(64),
    ownerNonce:'11111111-1111-4111-8111-111111111111',
    bootEpoch:'22222222-2222-4222-8222-222222222222',
    machineBindingSha256:'b'.repeat(64),
    volumeGuid:observation.volumeGuid,
    volumeSerial:observation.volumeSerial,
    sourceSha256:'c'.repeat(64),
    bootImageSha256:'d'.repeat(64),
    nativeMoverSha256:'e'.repeat(64),
    workflowSha256:'f'.repeat(64),
    protectedStateSha256:'1'.repeat(64),
    runnerAdmissionSha256:'2'.repeat(64),
    originalJobsSha256:'3'.repeat(64),
    issuedAt:'2026-11-12T00:00:00Z',
    expiresAt:'2026-11-12T00:20:00Z',
    moves:plan996SingleBootRecovery(continuationId).phases[1].moves.map((step,i)=>({
      name:step.name,source:step.source,destination:step.destination,
      sourceFileId:i===0?observation.directories.OLD_C.fileId128:
        i===2?observation.directories.INSTALL.fileId128:'2'.repeat(32),
      sourceVolumeSerial:observation.volumeSerial,
    })),
  };
}
test('actual #1265 original PC readback binds only old C and install source IDs',()=>{
  const out=review996OnlineVolumePinsForHandoff({
    onlineObservation:observation,signedManifest:candidate(),
  });
  assert.equal(out.status,'SOURCE_ONLY_TWO_ORIGINAL_PINS_MATCH',out.code);
  assert.equal(out.matchedSignedMoveCount,2);
  assert.equal(out.continuationClaimIdVerified,false);
  assert.equal(out.onlineEvidenceAuthenticated,false);
  assert.equal(out.signatureCryptographicallyVerified,false);
  assert.equal(out.offlineVolumeVerified,false);
  assert.equal(out.executionAuthorized,false);
  assert.equal(out.operationalWrites,0);
});
test('real online observation rejects mismatched signed root, oldC and install identities',()=>{
  for(const change of [
    x=>{x.volumeSerial='0'.repeat(16);},
    x=>{x.volumeGuid=x.volumeGuid.replace('Volume{','volume{');},
    x=>{x.moves[0].sourceFileId='f'.repeat(32);},
    x=>{x.moves[2].sourceFileId='f'.repeat(32);},
  ]){
    const m=candidate();change(m);
    const result=review996OnlineVolumePinsForHandoff({
      onlineObservation:observation,signedManifest:m,
    });
    assert.equal(result.status,'SOURCE_ONLY_BLOCKED');
    assert.equal(result.executionAuthorized,false);
  }
});
