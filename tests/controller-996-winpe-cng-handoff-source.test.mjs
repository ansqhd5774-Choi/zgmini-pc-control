import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {derive996CngRsaPublicBlob}
  from '../tools/controller-996-signed-offline-handoff.mjs';

const sourcePath=new URL('../tools/controller-996-winpe-cng-handoff-verify.c',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');

test('CNG primitive uses raw manifest SHA256 and RSA-PSS with EXACTLY 32-byte salt',()=>{
  for(const token of [
    'BCryptOpenAlgorithmProvider','BCRYPT_SHA256_ALGORITHM',
    'BCryptHash(hashAlg,NULL,0,(PUCHAR)manifest,manifestLength',
    'BCRYPT_RSA_ALGORITHM','BCryptImportKeyPair',
    'BCRYPT_RSAPUBLIC_BLOB','BCRYPT_PAD_PSS',
    'BCryptVerifySignature','BCRYPT_PSS_PADDING_INFO padding = {BCRYPT_SHA256_ALGORITHM, 32}',
    'BCryptDestroyKey','BCryptCloseAlgorithmProvider',
  ])assert.ok(source.includes(token),`missing ${token}`);
  assert.match(source,/BCryptVerifySignature\(rsaKey,&padding,manifestSha256,32,/);
});
test('native function has no runtime mutation, C Operator entry point or Owner approval port',()=>{
  assert.match(source,/#error C996_CNG_SOURCE_ONLY_NOT_AN_OPERATIONAL_C_APPROVAL_PORT/);
  assert.match(source,/c996_source_only_verify_pss_sha256/);
  assert.match(source,/c996_cng_crypto_review review = \{0\}/);
  assert.doesNotMatch(source,/^\s*(?:int|void)\s+main\s*\(/m);
  assert.doesNotMatch(source,/\b(CreateFile|SetFileInformationByHandle|MoveFile|DeleteFile|RemoveDirectory|CreateProcess|ShellExecute|system|WinExec)\s*\(/);
  assert.doesNotMatch(source,/E:\\ZGmini/i);
});
test('SPKI public key derives exact little-endian CNG RSA1 header and big-endian exponent/modulus',()=>{
  const {publicKey}=generateKeyPairSync('rsa',{
    modulusLength:2048,publicExponent:0x10001,
  });
  const pem=publicKey.export({type:'spki',format:'pem'});
  const out=derive996CngRsaPublicBlob(pem),blob=out.rsaPublicBlob;
  assert.equal(blob.readUInt32LE(0),0x31415352);
  assert.equal(blob.readUInt32LE(4),2048);
  assert.equal(blob.readUInt32LE(8),3);
  assert.equal(blob.readUInt32LE(12),256);
  assert.equal(blob.readUInt32LE(16),0);
  assert.equal(blob.readUInt32LE(20),0);
  assert.deepEqual(blob.subarray(24,27),Buffer.from([1,0,1]));
  const modulus=Buffer.from(publicKey.export({format:'jwk'}).n,'base64url');
  assert.deepEqual(blob.subarray(27),modulus);
  assert.equal(out.spkiSha256,createHash('sha256').update(
    publicKey.export({type:'spki',format:'der'})).digest('hex'));
  assert.equal(out.rsaPublicBlobSha256,createHash('sha256').update(blob).digest('hex'));
  assert.notEqual(out.spkiSha256,out.rsaPublicBlobSha256);
  assert.equal(out.ownerTrustAuthenticated,false);
  assert.equal(out.executionAuthorized,false);
});
test('RSA public blob converter refuses non-RSA, malformed and short keys',()=>{
  const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const ecPem=ec.publicKey.export({type:'spki',format:'pem'});
  assert.throws(()=>derive996CngRsaPublicBlob(ecPem),/C996_CNG_PUBLIC_KEY_INVALID/);
  const weak=generateKeyPairSync('rsa',{modulusLength:1024});
  assert.throws(()=>derive996CngRsaPublicBlob(
    weak.publicKey.export({type:'spki',format:'pem'})),/C996_CNG_PUBLIC_KEY_INVALID/);
  assert.throws(()=>derive996CngRsaPublicBlob('not-a-key'),
    /C996_CNG_PUBLIC_KEY_INVALID/);
});
test('non-Windows stub is syntactically valid and never claims native CNG verification',t=>{
  const cc=spawnSync('cc',['-std=c11','-Wall','-Wextra','-pedantic',
    '-fsyntax-only',sourcePath.pathname],{encoding:'utf8',timeout:10000});
  if(cc.error?.code==='ENOENT'){t.skip('host C compiler unavailable');return;}
  assert.equal(cc.status,0,cc.stderr);
  assert.match(source,/#else\s*\n\s*\(void\)manifest/);
  assert.match(source,/if \(valid\) review\.signatureCryptographicallyVerified = 1/);
});
