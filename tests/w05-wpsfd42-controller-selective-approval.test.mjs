import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin} from '../tools/maintenance-contract.mjs';

const installed='2f3ebcf3518a5e9b694bafbb7e6331840a6a4a25';
const target='08f0b656faa9ad5c46a813a0cdda4b43107eefbd';
const manifest=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
const paths=['config/operations.json','controller/operations.mjs',
 'controller/w05-wpsfd42-service-readonly.mjs'];
const checks={
 'config/operations.json':'2f0b61c56334720c079b63f5c3d96f3d9fd0fca333fc7bb84a6d4a3fc2a81cc0',
 'controller/operations.mjs':'6fbb76a91c8682607a890e7dcdb7cff91087cc73804cb0d49b918250e2d98b09',
 'controller/w05-wpsfd42-service-readonly.mjs':'4ab021ee53181a240a54963d98417e1e3acba04b937b7c9d160971893bf1872f',
};

test('W05 fixed threefile Controller selective review is internally exact',()=>{
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.deepEqual(manifest.allowFiles,paths.map(path=>({path,sha256:checks[path]})));
 assert.equal(manifest.checks.targetSha,target);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.deepEqual(manifest.backup.rollback,{kind:'RESTORE_INSTALLED_SHA',sha:installed});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.selectiveSource.mainSha,
  'df7a94c4b5568d259dc13817251da5e423250ab2');
 assert.equal(manifest.selectiveSource.branch,
  'codex/w05-2f3-single-parent-20261123');
 assert.deepEqual(manifest.selectiveSource.customPaths,paths);
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2803');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
});

test('W05 source module remains the immutable source-merged bytes',()=>{
 const content=fs.readFileSync(new URL(
  '../controller/w05-wpsfd42-service-readonly.mjs',import.meta.url));
 const actual=createHash('sha256').update(content).digest('hex');
 assert.equal(actual,checks['controller/w05-wpsfd42-service-readonly.mjs']);
});

test('W05 review pin rejects unrelated or substituted B scope',()=>{
 assert.throws(()=>validateControllerSelectivePin(manifest,{
  ...pin,allowFiles:[...pin.allowFiles,{path:'controller/worker.mjs',
   sha256:'a'.repeat(64)}]}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(manifest,{
  ...pin,installedSha:'f'.repeat(40)}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(manifest,{
  ...pin,approvalRef:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2796'
 }),/SELECTIVE_PIN_MISMATCH/);
});
