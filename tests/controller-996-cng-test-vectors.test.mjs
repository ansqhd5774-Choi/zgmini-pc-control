import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {constants,createHash,createPublicKey,verify} from 'node:crypto';

const script=new URL('./generate-controller-996-cng-vectors.mjs',import.meta.url);
const parse=(header,name)=>{
  const match=header.match(new RegExp(
    `static const unsigned char ${name}\\[\\] = \\{([\\s\\S]*?)\\};`));
  assert.ok(match,`missing ${name}`);
  return Buffer.from(Array.from(match[1].matchAll(/0x([0-9a-f]{2})/g),
    x=>Number.parseInt(x[1],16)));
};

test('ephemeral C test fixture verifies with identical RSA key under Node and rejects two padding variants',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-cng-bundle-'));
  try{
    fs.mkdirSync(path.join(root,'tests'));
    const child=spawnSync(process.execPath,[fileURLToPath(script),root],{
      encoding:'utf8',timeout:15000,
    });
    assert.equal(child.status,0,child.stderr);
    assert.match(child.stdout,/C996_PUBLIC_TEST_VECTORS_CREATED_NO_PRIVATE_KEY/);
    const header=fs.readFileSync(path.join(root,'tests',
      'c996_cng_test_vectors.h'),'utf8');
    const manifest=parse(header,'c996_manifest');
    const blob=parse(header,'c996_public_blob');
    const pin=parse(header,'c996_public_blob_sha256');
    const signature=parse(header,'c996_signature');
    const wrongSalt=parse(header,'c996_wrong_salt_signature');
    const pkcs1=parse(header,'c996_pkcs1_signature');
    assert.deepEqual(createHash('sha256').update(blob).digest(),pin);
    assert.equal(blob.readUInt32LE(0),0x31415352);
    const exponentLength=blob.readUInt32LE(8);
    const modulusLength=blob.readUInt32LE(12);
    assert.equal(blob.length,24+exponentLength+modulusLength);
    const key=createPublicKey({key:{kty:'RSA',
      e:blob.subarray(24,24+exponentLength).toString('base64url'),
      n:blob.subarray(24+exponentLength).toString('base64url'),
    },format:'jwk'});
    const options={key,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32};
    assert.equal(verify('sha256',manifest,options,signature),true);
    assert.equal(verify('sha256',manifest,options,wrongSalt),false);
    assert.equal(verify('sha256',manifest,options,pkcs1),false);
    const tampered=Buffer.from(manifest);tampered[0]^=1;
    assert.equal(verify('sha256',tampered,options,signature),false);
    assert.equal(header.includes('BEGIN PRIVATE KEY'),false);
  }finally{
    // This is only this test's fresh isolated fixture, not user PC evidence.
    fs.rmSync(root,{recursive:true,force:false});
  }
});

