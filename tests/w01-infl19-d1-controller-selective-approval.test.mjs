import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {manifestFingerprint,validateControllerSelectivePin} from '../tools/maintenance-contract.mjs';
const old='2f3ebcf3518a5e9b694bafbb7e6331840a6a4a25';
const target='1d9277460fa2c4211245ff5bbbafbad666969c36';
const source='af5d7c50b4bc639673cabe1b51c9d56c54780d46';
const manifest=JSON.parse(fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
const files=[{path:'config/operations.json',sha256:'b0cabdc0b23a329c5ea96ef6aecb71fa6b0a0a48a7fb5bd7ae4a3773d560c534'},
 {path:'controller/inflation19-d1-readback-readonly.mjs',sha256:'93e6d83935d49861f09a2b083f0b39ab7385c642e204e0ce672e08c646c74c84'},
 {path:'controller/operations.mjs',sha256:'e6d16207fe9f96b555bbb3964f6606226a131e407b741177a126203130fc3c36'}];
test('W01 19-row readonly target approval is exact selective threefile B, rollback pinned',()=>{
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,old);assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.deepEqual(manifest.allowFiles,files);
 assert.equal(manifest.checks.targetSha,target);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(files).sha256);
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:old}});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2813');
 assert.equal(manifest.selectiveSource.mainSha,source);
 assert.deepEqual(manifest.selectiveSource.customPaths,['config/operations.json','controller/operations.mjs']);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
});
test('W01 pin rejects out-of-scope file and divergent owner approval',()=>{
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,allowFiles:[...pin.allowFiles,{path:'controller/maintenance.mjs',sha256:'f'.repeat(64)}]}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,approvalRef:'https://github.com/other/unauthorized'}),/SELECTIVE_PIN_MISMATCH/);
});
