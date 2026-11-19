import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateUpdateRequest,validateControllerSelectivePin,validateControllerOnlyInstallDelta,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';
const installed='7b0b87607f8bd7e369f3a1eaa1955b8ca58a20f2';
const target='bd5a5e20d1dccdb4f7940828295421d8c29aebe3';
const hash=x=>createHash('sha256').update(x).digest('hex');
test('W04 responseHash selective B exact 1-file manifest and pin validation',()=>{
 const root=path.join(import.meta.dirname,'..','approvals');
 const raw=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
 const manifest=JSON.parse(raw.toString('utf8'));
 const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),['controller/employment-r6-raw-run-attestation-readonly.mjs']);
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.equal(manifest.selectiveSource.mainSha,'b5e40e51e808b352470ca70fdaab05e141325d39');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(validateControllerOnlyInstallDelta(manifest.allowFiles.map(x=>x.path),manifest.allowFiles),true);
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-hash-split-selective-20261119',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:hash(raw)};
 const checked=validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,pin),true);
 assert.equal(hash(raw).length,64);
});
