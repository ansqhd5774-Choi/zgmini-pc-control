import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,validateUpdateRequest,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';

const target='717e242d769c9de3ed122b7fb636d38daaef48eb';
const installed='2e0506fd63ea40b47171af8ea3ef8d017fe2ce5a';
const parser='controller/cloudflare-rum-field-parser.mjs';
const mainOrigin='1c080b573a4e55ec4e0183dafabd121a574b09bc';
const root=path.join(import.meta.dirname,'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('RUM event-group metadata uses a single-file selective B with exact CAS',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(
  path.join(root,'approvals/controller-selective-targets',target+'.json')));
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.deepEqual(manifest.allowFiles.map(f=>f.path),[parser]);
 assert.equal(manifest.allowFiles[0].sha256,
  sha(fs.readFileSync(path.join(root,parser))));
 assert.equal(manifest.checks.manifestSha256,
  manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.selectiveSource.schema,
  'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(manifest.selectiveSource.branch,
  'codex/rum-event-scope-selective-2e-20261126');
 assert.equal(manifest.selectiveSource.mainSha,mainOrigin);
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.ref,pin.approvalRef);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([parser],manifest.allowFiles),true);
 const req={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-81ec1c33-2e52-4751-8dcb-28f745a696b2',
  chatId:'chat-rum-event-scope-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:sha(raw)};
 assert.equal(validateUpdateRequest(req,raw,{
  actor:'ansqhd5774-Choi',installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(req,raw,{
  actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)}),
 /UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([parser,'controller/entry.mjs'],
  manifest.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});
