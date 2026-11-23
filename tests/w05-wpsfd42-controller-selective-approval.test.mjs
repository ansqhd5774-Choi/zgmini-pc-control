import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin} from '../tools/maintenance-contract.mjs';

const installed='d996f2c666955c6659c233d8840d13181571f02a';
const target='87dbb9841fe8dd03a88b1f65578ab49b2678c38d';
const manifest=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL(
 '../approvals/controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
const paths=['config/operations.json','controller/operations.mjs',
 'controller/w05-wpsfd42-service-readonly.mjs'];
const checks={
 'config/operations.json':'5b42ef2bcb1cd765cdced2341d2a1e5350a283e6a87dfe29e0ee43a6194c9eb0',
 'controller/operations.mjs':'44a3f2ac25df3043007a3387c392a63985df523e8d4602f9ac35253160404d8e',
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
  'codex/issues-w05-2794-selective-d996-20261123');
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
