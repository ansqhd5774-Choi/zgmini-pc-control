import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {manifestFingerprint,validateControllerSelectivePin} from '../tools/maintenance-contract.mjs';

const old='d996f2c666955c6659c233d8840d13181571f02a';
const target='2f3ebcf3518a5e9b694bafbb7e6331840a6a4a25';
const manifest=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
const paths=['config/operations.json',
 'controller/market-r54-d1-api-readback-readonly.mjs',
 'controller/operations.mjs'];
const sha=['578e8a46f8daf2a1919701271ea7abddec48f1dc440f05aa80caf84a0f481c8c',
 '6936bf4ee7a610c549e007ac48c3da0b6bcfc86f54ae561b0f6fdc3ae95bfada',
 '30d699af9eeed7417b38aa922986ff16f27184abb9c46e889a486bd602f814be'];
test('W04 public R54 Controller manifest is exact threefile B with rollback',()=>{
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,old);assert.equal(manifest.targetSha,target);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.deepEqual(manifest.allowFiles,paths.map((path,i)=>({path,sha256:sha[i]})));
 assert.equal(manifest.checks.targetSha,target);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.checks.manifestSha256,
  manifestFingerprint(manifest.allowFiles).sha256);
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:old}});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2800');
 assert.deepEqual(manifest.selectiveSource.customPaths,paths);
 assert.equal(manifest.selectiveSource.mainSha,
  'f9b4c9df37f5892123d51365d55862cdf575327f');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
});
test('any extra file or divergent approval cannot reuse the pin',()=>{
 assert.throws(()=>validateControllerSelectivePin(manifest,
  {...pin,allowFiles:[...pin.allowFiles,{path:'controller/maintenance.mjs',
   sha256:'f'.repeat(64)}]}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(manifest,
  {...pin,approvalRef:'https://github.com/other/unauthorized'}),
  /SELECTIVE_PIN_MISMATCH/);
});
