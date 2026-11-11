// Generates PUBLIC one-time CNG test vectors for a temporary ZIP package.
// The RSA private key exists ONLY in this process's memory, never in the ZIP.
// This is not a production Owner signing or trusted-key provisioning tool.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {constants,generateKeyPairSync,sign} from 'node:crypto';
import {encode996CanonicalOfflineHandoff,derive996CngRsaPublicBlob}
  from '../tools/controller-996-signed-offline-handoff.mjs';
import {plan996SingleBootRecovery}
  from '../tools/controller-996-windows-archive-adapter.mjs';

const target=process.argv[2];
const tmp=path.resolve(os.tmpdir());
const root=typeof target==='string'?path.resolve(target):null;
if(!root||!root.startsWith(tmp+path.sep)||
  !path.basename(root).startsWith('zgmini-996-cng-bundle-')||
  !fs.lstatSync(root).isDirectory()||
  !fs.lstatSync(path.join(root,'tests')).isDirectory())
  throw Error('C996_CNG_TEMP_BUNDLE_ROOT_REQUIRED');
const out=path.join(root,'tests','c996_cng_test_vectors.h');
if(fs.existsSync(out))throw Error('C996_CNG_VECTOR_ALREADY_EXISTS');
const continuationId='70a4c347-25ea-4fc6-83d2-c0c670115249';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{
  modulusLength:2048,publicExponent:0x10001,
});
const publicPem=publicKey.export({type:'spki',format:'pem'});
const blobInfo=derive996CngRsaPublicBlob(publicPem);
const steps=plan996SingleBootRecovery(continuationId).phases[1].moves;
const manifest=encode996CanonicalOfflineHandoff({
  schema:'ZGMINI_CONTROLLER_996_SIGNED_OFFLINE_HANDOFF_V1',
  algorithm:'RSA_PSS_SHA256_SALT32',
  scope:'ARCHIVE_OLD_C_THEN_CONTINUATION_THEN_INSTALL_NO_REPLACE',
  originalRequestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
  continuationId,winpeBootCount:1,
  existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
  ownerKeySpkiSha256:blobInfo.spkiSha256,
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
const signature=options=>sign('sha256',manifest,{key:privateKey,...options});
const sigPss=signature({padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32});
const sigBadSalt=signature({padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:0});
const sigPkcs1=signature({padding:constants.RSA_PKCS1_PADDING});
const vec=(name,value)=>{
  const b=Buffer.from(value);
  const lines=[];
  for(let i=0;i<b.length;i+=16)
    lines.push('  '+Array.from(b.subarray(i,i+16),v=>
      '0x'+v.toString(16).padStart(2,'0')).join(', ')+',');
  return `static const unsigned char ${name}[] = {\n${lines.join('\n')}\n};`;
};
const content=[
  '/* PUBLIC test vectors only. Ephemeral private signing key is NOT included. */',
  '/* This is a CRYPTO-only test, not actual Owner approval or a live expiry. */',
  vec('c996_manifest',manifest),
  vec('c996_public_blob',blobInfo.rsaPublicBlob),
  vec('c996_public_blob_sha256',Buffer.from(blobInfo.rsaPublicBlobSha256,'hex')),
  vec('c996_signature',sigPss),
  vec('c996_wrong_salt_signature',sigBadSalt),
  vec('c996_pkcs1_signature',sigPkcs1),
].join('\n\n')+'\n';
fs.writeFileSync(out,content,{encoding:'utf8',flag:'wx',mode:0o600});
process.stdout.write('C996_PUBLIC_TEST_VECTORS_CREATED_NO_PRIVATE_KEY\n');
