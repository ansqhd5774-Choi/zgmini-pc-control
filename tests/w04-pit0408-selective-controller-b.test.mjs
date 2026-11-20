import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateUpdateRequest,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY
} from '../tools/maintenance-contract.mjs';

const target='f896b2fd05ca6df845e446497ddc71b076fa3ab0';
const installed='6d84dbfaaf8344069ea131b226385bdae3632c35';
const root=path.join(import.meta.dirname,'..','approvals');
const raw=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
const manifest=JSON.parse(raw);
const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=['controller/common.mjs','controller/employment-r6-candidate-readonly.mjs'];

test('PIT0408 one-child two-file B manifest is source and CAS pinned',()=>{
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),files);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(manifest.selectiveSource.branch,'codex/w04-pit0408-selective-overlay-20261120');
 assert.equal(manifest.selectiveSource.mainSha,'41940e10c1e58312028ef74899abc80a7643c01a');
 assert.deepEqual(manifest.selectiveSource.customPaths,files);
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(validateControllerOnlyInstallDelta(files,manifest.allowFiles),true);
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0408-controller-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(raw)};
 const checked=validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,pin),true);
});

test('PIT0408 B refuses wrong installed SHA and unrelated file effects',()=>{
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0408-controller-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(raw)};
 assert.throws(()=>validateUpdateRequest(issue,raw,{
  actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)
 }),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([...files,'controller/operations.mjs'],
  manifest.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});


test('PIT0407 one-file ETA539 raw Current parity B pin is CAS-safe and PR-bound',()=>{
 const target='cb7ed62e4e5288c683c07297995c5ba2cfe0ace6';
 const installed='f896b2fd05ca6df845e446497ddc71b076fa3ab0';
 const file='controller/employment-r6-collection-evidence-readonly.mjs';
 const approval=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
 const manifest=JSON.parse(approval);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2417');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.deepEqual(manifest.allowFiles,[{path:file,sha256:'d4290b61f4dc25c3264e6ef0f554808549f6906b85cc2a245ec72956c9e148ad'}]);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.selectiveSource.branch,'codex/w04-pit0407-selective-controller-b-20261120');
 assert.equal(manifest.selectiveSource.mainSha,'5cc453954618b1e6ab3e10b1ef92b6f1cb0733a8');
 assert.deepEqual(manifest.selectiveSource.customPaths,[file]);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([file],manifest.allowFiles),true);
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0407-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(approval)};
 assert.equal(validateUpdateRequest(issue,approval,{
  actor:'ansqhd5774-Choi',installedSha:installed
 }).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(issue,approval,{
  actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)
 }),/UPDATE_INSTALLED_SOURCE_DRIFT/);
});

test('PIT0407 installed-W03 56d0 exact successor B pin is CAS-safe and PR-bound',()=>{
 const target='ebf48dd930437d0e9347ebb74ec13a6342205061';
 const installed='56d0b9619f78e034283111b94dcc37f0c4b2a498';
 const file='controller/employment-r6-collection-evidence-readonly.mjs';
 const approval=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
 const manifest=JSON.parse(approval);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2420');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.deepEqual(manifest.allowFiles,[{path:file,sha256:'d4290b61f4dc25c3264e6ef0f554808549f6906b85cc2a245ec72956c9e148ad'}]);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.selectiveSource.branch,'codex/w04-pit0407-controller-b-after-w03-20261120');
 assert.equal(manifest.selectiveSource.mainSha,'5cc453954618b1e6ab3e10b1ef92b6f1cb0733a8');
 assert.deepEqual(manifest.selectiveSource.customPaths,[file]);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([file],manifest.allowFiles),true);
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0407-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(approval)};
 assert.equal(validateUpdateRequest(issue,approval,{
  actor:'ansqhd5774-Choi',installedSha:installed
 }).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(issue,approval,{
  actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)
 }),/UPDATE_INSTALLED_SOURCE_DRIFT/);
});


test('PIT0407 metadata-bound one-file Controller B retains installed-ebf48 CAS and exact PR pin',()=>{
 const target='41158ac40aae7eb5093aee13e379fe3d4d1b0963';
 const installed='ebf48dd930437d0e9347ebb74ec13a6342205061';
 const file='controller/employment-r6-collection-evidence-readonly.mjs';
 const approval=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
 const manifest=JSON.parse(approval);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2431');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.deepEqual(manifest.allowFiles,[{path:file,sha256:'49cb1ec2da88d84b6812be1d7d0f5bc314cb77bfa0b465204791e9f976ada1d8'}]);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.selectiveSource.branch,'codex/w04-pit0407-eta539-metadata-bound-b-20261120');
 assert.equal(manifest.selectiveSource.mainSha,'131882ddd378f377b9d891f69358f43dacbec6e0');
 assert.deepEqual(manifest.selectiveSource.customPaths,[file]);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([file],manifest.allowFiles),true);
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0407-meta-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(approval)};
 assert.equal(validateUpdateRequest(issue,approval,{
  actor:'ansqhd5774-Choi',installedSha:installed
 }).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(issue,approval,{
  actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)
 }),/UPDATE_INSTALLED_SOURCE_DRIFT/);
});
