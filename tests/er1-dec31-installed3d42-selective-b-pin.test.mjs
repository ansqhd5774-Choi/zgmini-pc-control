import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {manifestFingerprint,validateControllerSelectivePin,validateUpdateRequest}
 from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const installed='3d42f226fcffde1f09885da552f9b003ea30e57e';
const target='502aac841475fa94b7cc9d56c028fd38b0554831';
const source='3a3aa9bc511048c122ddf72a388c04531a54108f';
const branch='codex/er1-dec31-selective-installed3d42-20261125';
const digest=buf=>createHash('sha256').update(buf).digest('hex');
const exactFiles=[
 {path:'controller/market-calendar-er1-dec31-evidence-readonly.mjs',sha256:'de9314fe3e65159b6b95fac8a64aa301c20f216ef03c98ab1ec581fc83940fb0'},
 {path:'controller/writer-publication-evidence-readonly.mjs',sha256:'206f90f4753b1146f40e9e9c9be2791f8c6958eafe05492cb54fc045f909c3b2'},
];

test('ER1 3d42 overlay is exactly two approved read-only source files',()=>{
 for(const f of exactFiles)
  assert.equal(digest(fs.readFileSync(path.join(root,f.path))),f.sha256,f.path);
});

test('ER1 new selective manifest pin and installed CAS are immutable and consistent',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'approvals/controller-selective-targets',target+'.json'),'utf8'));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.selectiveSource.mainSha,source);
 assert.equal(manifest.selectiveSource.branch,branch);
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.deepEqual(manifest.allowFiles,exactFiles);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(exactFiles).sha256);
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.postOperation,'core-status');
 const issue={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId:'pc-update-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  chatId:'chat-er1-dec31-cas-fixture',operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',targetControllerSha:target,
  approvalManifestSha256:digest(raw)};
 const validated=validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(validated.manifest,pin),true);
 assert.throws(()=>validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',installedSha:'83679b013ac9a9820331d93311ec97e572b18e13'}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerSelectivePin(validated.manifest,{...pin,installedSha:'83679b013ac9a9820331d93311ec97e572b18e13'}),/SELECTIVE_PIN_MISMATCH/);
});
