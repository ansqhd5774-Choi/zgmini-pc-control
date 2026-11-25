import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,validateUpdateRequest,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';

const target='2e0506fd63ea40b47171af8ea3ef8d017fe2ce5a';
const installed='60f37de24cbad4adc0b6ee9eee3c98a43160443d';
const pathOnly='controller/employment-r6-candidate-readonly.mjs';
const root=path.join(import.meta.dirname,'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('W04 one-file Controller repair selection B preserves exact CAS and scope',()=>{
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
 assert.equal(m.selectiveSource.branch,'codex/w04-history-repair-selective-60f-20261126');
 assert.equal(m.selectiveSource.mainSha,'41890d67f928f0fad808590efdd951098e3071ed');
 assert.deepEqual(m.selectiveSource.customPaths,[pathOnly]);
 assert.equal(m.backup.rollback.sha,installed);
 assert.equal(m.approval.ref,p.approvalRef);
 assert.equal(validateControllerSelectivePin(m,p),true);
 assert.equal(validateControllerOnlyInstallDelta([pathOnly],m.allowFiles),true);
 const req={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-a765ca59-5e0f-4ec0-adcb-8c0657c43030',
  chatId:'chat-w04-history-repair-selection-b-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:sha(raw)};
 assert.equal(validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)}),
  /UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([pathOnly,'controller/operations.mjs'],m.allowFiles),
  /ALLOWFILE_DIFF_MISMATCH/);
});
