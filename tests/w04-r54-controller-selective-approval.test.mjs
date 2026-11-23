import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {manifestFingerprint,validateControllerSelectivePin} from '../tools/maintenance-contract.mjs';

const target='d996f2c666955c6659c233d8840d13181571f02a';
const manifest=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
const path='controller/source-inventory-runtime-readonly.mjs';

test('W04 R54 Controller onefile B scope and existing rollback remain pinned',()=>{
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,'523fb6ec8138311977c24eb5a352c3175fbf2354');
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.deepEqual(manifest.allowFiles,[{path,
  sha256:'549eea141fa83f8e591fdd724ae17137a6f2d140c7ca6fac41d297613560cf2e'}]);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.deepEqual(manifest.backup.rollback,{kind:'RESTORE_INSTALLED_SHA',
  sha:manifest.installedSha});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.selectiveSource.mainSha,'edb103721b642c59d260daed052529ea3d93c5bd');
 assert.deepEqual(manifest.selectiveSource.customPaths,[path]);
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2787');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
});
test('onefile pin cannot authorize unrelated Controller changes',()=>{
 assert.throws(()=>validateControllerSelectivePin(manifest,{
  ...pin,allowFiles:[...pin.allowFiles,{path:'controller/operations.mjs',
   sha256:'a'.repeat(64)}]
 }),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(manifest,{
  ...pin,targetSha:'f'.repeat(40)
 }),/SELECTIVE_PIN_MISMATCH/);
});
