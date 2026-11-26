import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,validateUpdateRequest,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';

const root=path.join(import.meta.dirname,'..');
const installed='b91340d5047daf753e1c17a5c966e4d2aecea586';
const target='182bb46f2838306ba40d8b4ec32bac40ab75b69a';
const changed='controller/preimage-manifest-contract.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('W06 A preimage selective B pins one exact file and installed predecessor',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'approvals/controller-selective-targets',target+'.json')));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),[changed]);
 assert.equal(manifest.allowFiles[0].sha256,
  digest(fs.readFileSync(path.join(root,changed))));
 assert.equal(manifest.checks.manifestSha256,
  manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.selectiveSource.branch,
  'codex/issues-lifecycle-manager-20261118-63-w06-a-b913-selective');
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.deepEqual(manifest.backup.rollback,{kind:'RESTORE_INSTALLED_SHA',sha:installed});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3783');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([changed],manifest.allowFiles),true);
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-315693a7-5f0e-4c72-b06b-779c3579ef09',
  chatId:'chat-w06-controller-preimage-selective-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 assert.equal(validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',
  installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',
  installedSha:'0'.repeat(40)}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta(
  [changed,'controller/entry.mjs'],manifest.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});
