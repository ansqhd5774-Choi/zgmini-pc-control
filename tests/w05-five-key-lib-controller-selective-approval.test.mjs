import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
const TARGET='ff105611be1bd67bb12e6ecc4abdd93d27464338';
const INSTALLED='03fdedc58e0aadf207f04bc66cb08580dc3d113f';
const m=JSON.parse(readFileSync(new URL(
 '../approvals/controller-updates/'+TARGET+'.json',import.meta.url),'utf8'));
const p=JSON.parse(readFileSync(new URL(
 '../approvals/controller-selective-targets/'+TARGET+'.json',import.meta.url),'utf8'));
test('W05 lib reader is an immutable one-file selective child of installed Controller',()=>{
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.installedSha,INSTALLED);
 assert.equal(m.targetSha,TARGET);
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.equal(m.approval.grade,'B');
 assert.equal(m.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(m.approval.ref,p.approvalRef);
 assert.match(m.approval.ref,/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/[1-9][0-9]*$/);
 assert.equal(m.checks.manifestSha256,manifestFingerprint(m.allowFiles).sha256);
 assert.equal(m.checks.manifestSha256,
  '45bfaff88589ec8e21bd436f1838a8483c8b27998aa47dddc6d16080228ddd7a');
 assert.deepEqual(m.allowFiles.map(x=>x.path),
  ['controller/w05-five-key-d1-api-readback-readonly.mjs']);
 assert.equal(validateControllerOnlyInstallDelta(m.allowFiles.map(x=>x.path),m.allowFiles),true);
 assert.equal(validateControllerSelectivePin(m,p),true);
 assert.deepEqual(m.selectiveSource.customPaths,[]);
 assert.deepEqual(p.customPaths,[]);
 assert.equal(m.selectiveSource.branch,'codex/w05-5key-lib-controller-singleparent-03fd-20261124');
 assert.equal(m.selectiveSource.mainSha,'270733b3468f09f5e528e722eefe4e12b03a79b0');
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.postSourceSha,'a0735cac4a4dc56f0da0d3d0f82a93fd5b4486c7');
 assert.deepEqual(m.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:INSTALLED}});
});
test('one-file selected source matches approved current main reader with no other changes',()=>{
 const code=readFileSync(new URL(
  '../controller/w05-five-key-d1-api-readback-readonly.mjs',import.meta.url));
 const digest=createHash('sha256').update(code).digest('hex');
 assert.equal(digest,m.allowFiles[0].sha256);
 assert.equal(digest,
  '5a4afcf3b617d5e093e5772270b8e2ae7856ca6d53781a3f9e3de498ac3aca93');
 assert.match(code.toString(),/lib\/w05-audit/);
 assert.doesNotMatch(code.toString(),/scripts\/api-site/);
});
test('W05 B pin rejects altered source, extra file and approval provenance',()=>{
 assert.throws(()=>validateControllerSelectivePin(m,{...p,targetSha:'f'.repeat(40)}),
  /SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(m,{...p,approvalRef:
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3247'}),
  /SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(m,{...p,allowFiles:[
  ...p.allowFiles,{path:'controller/operations.mjs',sha256:'f'.repeat(64)}]}),
  /SELECTIVE_PIN_MISMATCH/);
});
