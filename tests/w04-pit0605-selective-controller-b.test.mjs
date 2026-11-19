import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateUpdateRequest,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY
} from '../tools/maintenance-contract.mjs';

const target='6d84dbfaaf8344069ea131b226385bdae3632c35';
const installed='6e52999aeb7dda5975464a78780559ba5cd46895';
const root=path.join(import.meta.dirname,'..','approvals');
const raw=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
const manifest=JSON.parse(raw);
const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
const sha=x=>createHash('sha256').update(x).digest('hex');

test('PIT0605 two-file selective Controller B is exact, source-pinned, CAS-safe',()=>{
 const files=['controller/common.mjs','controller/employment-r6-candidate-readonly.mjs'];
 assert.equal(manifest.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),files);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(manifest.selectiveSource.branch,'codex/w04-pit0605-selective-overlay-20261120');
 assert.equal(manifest.selectiveSource.mainSha,'ae81e9721d782174bc87eeca08e49ded7f7c18ae');
 assert.deepEqual(manifest.selectiveSource.customPaths,files);
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2375');
 assert.equal(validateControllerOnlyInstallDelta(files,manifest.allowFiles),true);
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0605-controller-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(raw)};
 const validated=validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(validated.manifest,pin),true);
 assert.equal(pin.sourceMainSha,manifest.selectiveSource.mainSha);
});

test('PIT0605 B stops on wrong installed version or unlisted controller effect',()=>{
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-pit0605-controller-b-20261120',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(raw)};
 assert.throws(()=>validateUpdateRequest(issue,raw,{
  actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)
 }),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([...manifest.allowFiles.map(x=>x.path),
  'controller/operations.mjs'],manifest.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});
