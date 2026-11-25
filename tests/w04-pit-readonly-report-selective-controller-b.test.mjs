import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,validateUpdateRequest,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';

const target='4c9a85d04497466f4773bff8ead9da91a30a68b3';
const installed='ce5add72af3e55e34a4f6c215b31aed74750516f';
const pathOnly='controller/employment-r6-candidate-readonly.mjs';
const root=path.join(import.meta.dirname,'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('W04 one-file Controller report projection B preserves exact CAS and scope',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const m=JSON.parse(raw);
 const p=JSON.parse(fs.readFileSync(path.join(root,'approvals/controller-selective-targets',target+'.json')));
 assert.equal(m.installedSha,installed);
 assert.equal(m.targetSha,target);
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.allowFiles.map(x=>x.path),[pathOnly]);
 assert.equal(m.allowFiles[0].sha256,sha(fs.readFileSync(path.join(root,pathOnly))));
 assert.equal(m.checks.manifestSha256,manifestFingerprint(m.allowFiles).sha256);
 assert.equal(m.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(m.selectiveSource.branch,'codex/w04-pit-controller-selective-ce5-20261125');
 assert.equal(m.selectiveSource.mainSha,'13182de9a46f7501dffafb0b54d344200e5c05eb');
 assert.deepEqual(m.selectiveSource.customPaths,[pathOnly]);
 assert.equal(m.backup.rollback.sha,installed);
 assert.equal(m.approval.ref,p.approvalRef);
 assert.equal(validateControllerSelectivePin(m,p),true);
 assert.equal(validateControllerOnlyInstallDelta([pathOnly],m.allowFiles),true);
 const req={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-8f8f9b9f-828e-42cd-a8ce-178c3f65a9ae',
  chatId:'chat-w04-pit-report-controller-b-20261125',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:sha(raw)};
 assert.equal(validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)}),
  /UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([pathOnly,'controller/operations.mjs'],m.allowFiles),
  /ALLOWFILE_DIFF_MISMATCH/);
});
