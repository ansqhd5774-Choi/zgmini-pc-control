import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';

const target='d3764580fdb08ecddd5f9b1064051eec30f90492';
const installed='cde1dd372210e4658ae348cb9e2577967cb11634';
const root='../approvals/';
const manifest=JSON.parse(fs.readFileSync(new URL(root+'controller-updates/'+target+'.json',import.meta.url),'utf8'));
const pin=JSON.parse(fs.readFileSync(new URL(root+'controller-selective-targets/'+target+'.json',import.meta.url),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));

test('lineage B candidate is one-file pinned, protected and explicitly not yet approved',()=>{
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.checks.status,'PROPOSED_NOT_APPROVED');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4302');
 assert.deepEqual(manifest.allowFiles,[{path:'controller/operations.mjs',
  sha256:'6c0441108c244d1d5dd58e7793b785a371169a9d96b69e606200d905e8f59966'}]);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta(['controller/operations.mjs'],manifest.allowFiles),true);
 assert.throws(()=>validateControllerOnlyInstallDelta(
  ['controller/entry.mjs','controller/operations.mjs'],manifest.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});
test('lineage approval pin rejects cross-target or broadened paths',()=>{
 for(const change of [
  p=>p.installedSha='a'.repeat(40),
  p=>p.targetSha='a'.repeat(40),
  p=>p.sourceMainSha='a'.repeat(40),
  p=>p.targetBranch='codex/other',
  p=>p.approvalRef='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4283',
  p=>p.customPaths=['controller/entry.mjs'],
  p=>p.allowFiles.push({path:'controller/entry.mjs',sha256:'0'.repeat(64)})
 ]){const changed=clone(pin);change(changed);
  assert.throws(()=>validateControllerSelectivePin(manifest,changed),/SELECTIVE_PIN_MISMATCH/);
 }
});
