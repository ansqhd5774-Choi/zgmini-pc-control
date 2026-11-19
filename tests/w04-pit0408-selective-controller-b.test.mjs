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
