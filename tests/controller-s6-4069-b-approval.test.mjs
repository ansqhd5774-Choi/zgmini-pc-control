import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {manifestFingerprint,validateControllerSelectivePin,validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
const target='66b8a66c6112441576917e0ac9fbe4d39cbd5eea';
const candidate=JSON.parse(fs.readFileSync(new URL('../drafts/controller-s6-4069-selective-20261128.json',import.meta.url),'utf8'));
const manifest=JSON.parse(fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
test('S6 exact B manifest and pin cover only verified candidate, not runtime CAS',()=>{
 assert.equal(manifest.installedSha,candidate.installedSha);
 assert.equal(manifest.targetSha,candidate.targetSha);
 assert.deepEqual(manifest.allowFiles,candidate.allowFiles);
 assert.deepEqual(manifest.backup,candidate.backup);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.checks.targetSha,target);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.selectiveSource.mainSha,candidate.sourceMainSha);
 assert.equal(manifest.selectiveSource.branch,candidate.targetBranch);
 assert.deepEqual(manifest.selectiveSource.customPaths,candidate.customPaths);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta(manifest.allowFiles.map(f=>f.path),manifest.allowFiles),true);
 for(const patch of [x=>x.targetSha='a'.repeat(40),x=>x.installedSha='a'.repeat(40),x=>x.sourceMainSha='a'.repeat(40),x=>x.targetBranch='codex/other',x=>x.approvalRef='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4302',x=>x.allowFiles.push({path:'controller/entry.mjs',sha256:'a'.repeat(64)})]){
  const changed=structuredClone(pin);patch(changed);
  assert.throws(()=>validateControllerSelectivePin(manifest,changed));
 }
});
