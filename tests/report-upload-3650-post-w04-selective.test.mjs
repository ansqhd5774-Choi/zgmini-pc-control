import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,validateUpdateRequest,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';

test('#3650 after W04: approved overlay changes only verified uploader and uses live installed SHA',()=>{
 const installed='2e0506fd63ea40b47171af8ea3ef8d017fe2ce5a';
 const target='42ff41296ab5f4ac635d80991642ea932af198df';
 const branch='codex/report-upload-3650-selective-2e05-20261126';
 const main='f75ad5adc7a1c30b32d9a2160fc45d6a516fbaf1';
 const file='controller/report-upload-verified.mjs';
 const raw=fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url)));
 const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(manifest.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(manifest.selectiveSource.branch,branch);
 assert.equal(manifest.selectiveSource.mainSha,main);
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),[file]);
 assert.equal(manifest.allowFiles[0].sha256,sha256(fs.readFileSync(new URL('../'+file,import.meta.url))));
 assert.equal(manifest.allowFiles[0].sha256,'65639a1281c1a39bf35bed773c1814aa973c38cd88bdb45a87f0081730887585');
 assert.equal(manifest.checks.targetSha,target);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.equal(manifest.backup.rollback.kind,'RESTORE_INSTALLED_SHA');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.postSourceBranch,'main');
 assert.equal(manifest.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validateControllerOnlyInstallDelta([file],manifest.allowFiles),true);
 assert.throws(()=>validateControllerOnlyInstallDelta([file,'controller/operations.mjs'],manifest.allowFiles),
  /ALLOWFILE_DIFF_MISMATCH/);
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-8d34d94a-9e68-4d35-8f91-b79b8e340f66',
  chatId:'chat-report-upload-3650-post-w04-b-20261126',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha256(raw)};
 assert.equal(validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:'0'.repeat(40)}),
  /UPDATE_INSTALLED_SOURCE_DRIFT/);
});
