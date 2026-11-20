import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL('../approvals/writer-updates/'+name+'.json',import.meta.url),'utf8'));

test('W04 PIT0405 BED HTTP body hash B retains original one-file approval and current CAS',()=>{
  const prior=read('w04-r6-bed-http-body-hash-onefile-20261117');
  const current=read('w04-r6-bed-body-hash-current-cas-20261120');
  assert.equal(validateWriterBManifest(current),current);
  assert.equal(current.baseHead,'51beb04b42b7b0ef9c264ddd65273b325072e7b7');
  assert.equal(current.baseConfigSourceSha,current.baseHead);
  assert.equal(current.candidateSourceSha,'c3f60a3ce2eb1015f91545cbe94745d23c8aef18');
  assert.deepEqual(current.files,prior.files);
  assert.deepEqual(current.protectedFiles,prior.protectedFiles);
  assert.equal(current.files.length,1);
  assert.equal(current.files[0].path,'lib/market-score/employment-r6-provider.mjs');
  assert.equal(current.files[0].beforeSha256,'9a41a73e8cca84ae6ced6998f88c5dadc6fd5f12e6d09b7542748a5b187ddb12');
  assert.equal(current.files[0].afterSha256,'b94cd97208bc5ea19be4068a170e3c45b051639c5ee3d1ec2156c1ed18c587d6');
  assert.equal(current.runtimeDependencies.taskXmlSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
  assert.equal(current.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
  assert.equal(current.runCount,1);
  for(const guard of ['allowProviderCalls','allowDbChanges','allowD1Writes',
    'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(current[guard],false);
});
