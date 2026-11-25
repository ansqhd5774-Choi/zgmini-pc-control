import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,validateUpdateRequest,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY} from '../tools/maintenance-contract.mjs';

const installed='f50de351af0ef1502aeca99a913a6a9153fd3f10';
const target='3238ea9bd89f250938b658c407131322693e14cd';
const sourceMain='56cccf6dd73003d82fdda9e5e559a863d48df594';
const sourceBranch='codex/rum-browser-evidence-selective-f50-one-20261126';
const paths=['controller/cloudflare-rum-field-parser.mjs',
 'controller/w05-cloudflare-rum-readonly.mjs'];
const root=path.join(import.meta.dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

test('browser diagnostic B installs only two approved files after f50 Controller',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const m=JSON.parse(raw);
 const p=JSON.parse(fs.readFileSync(path.join(root,
  'approvals/controller-selective-targets',target+'.json')));
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.installedSha,installed);
 assert.equal(m.targetSha,target);
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.allowFiles.map(x=>x.path),paths);
 for(const item of m.allowFiles)assert.equal(item.sha256,
  hash(fs.readFileSync(path.join(root,item.path))));
 assert.equal(m.checks.manifestSha256,
  manifestFingerprint(m.allowFiles).sha256);
 assert.equal(m.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(m.selectiveSource.branch,sourceBranch);
 assert.equal(m.selectiveSource.mainSha,sourceMain);
 assert.deepEqual(m.selectiveSource.customPaths,[]);
 assert.equal(m.backup.rollback.sha,installed);
 assert.equal(m.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.equal(m.approval.grade,'B');
 assert.equal(m.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(m.approval.ref,p.approvalRef);
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.postSourceBranch,'main');
 assert.equal(m.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(validateControllerSelectivePin(m,p),true);
 assert.equal(validateControllerOnlyInstallDelta(paths,m.allowFiles),true);
 const req={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-75979c07-41aa-43ba-b5cf-57c969fbf652',
  chatId:'chat-rum-browser-evidence-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:hash(raw)};
 assert.equal(validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',
  installedSha:installed}).manifest.targetSha,target);
 assert.throws(()=>validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',
  installedSha:'0'.repeat(40)}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([
  ...paths,'controller/report-upload-verified.mjs'],m.allowFiles),
  /ALLOWFILE_DIFF_MISMATCH/);
});


test('re-pinned RUM browser evidence B preserves prior installed 0353 and exactly two files',()=>{
 const previousTarget=target;
 const nextTarget='f04f7c58b878432ea4b037ac8da8ae803e6dcb0e';
 const installed0353='0353e09059d6c8d483afbffb20d7f795e138f581';
 const branch0353='codex/rum-browser-evidence-selective-0353-20261126';
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',nextTarget+'.json'));
 const m=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(path.join(root,
  'approvals/controller-selective-targets',nextTarget+'.json')));
 assert.equal(m.installedSha,installed0353);
 assert.equal(m.targetSha,nextTarget);
 assert.notEqual(m.targetSha,previousTarget);
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.allowFiles.map(f=>f.path),paths);
 for(const item of m.allowFiles)assert.equal(item.sha256,
  hash(fs.readFileSync(path.join(root,item.path))));
 assert.equal(manifestFingerprint(m.allowFiles).sha256,m.checks.manifestSha256);
 assert.equal(m.selectiveSource.branch,branch0353);
 assert.equal(m.selectiveSource.mainSha,sourceMain);
 assert.deepEqual(m.selectiveSource.customPaths,[]);
 assert.deepEqual(m.backup.rollback,
  {kind:'RESTORE_INSTALLED_SHA',sha:installed0353});
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.approval.ref,pin.approvalRef);
 assert.equal(m.approval.grade,'B');
 assert.equal(validateControllerSelectivePin(m,pin),true);
 assert.equal(validateControllerOnlyInstallDelta(paths,m.allowFiles),true);
 const req={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-298dba7b-4eab-423b-98a4-0e54d799d7c7',
  chatId:'chat-rum-browser-evidence-post3695-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:nextTarget,approvalManifestSha256:hash(raw)};
 assert.equal(validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',
  installedSha:installed0353}).manifest.targetSha,nextTarget);
 assert.throws(()=>validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',
  installedSha:installed}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
});


test('RUM e4bf one-parent replacement preserves report recovery and only two RUM files',()=>{
 const current='e4bfd955ec06b6eecd4d67213309ec8f4e028af5';
 const targetE4='53fe24e22446d21a9fd4ee308d12b7cba7f37e25';
 const sourceE4='codex/rum-browser-evidence-selective-e4bf-20261126';
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',targetE4+'.json'));
 const m=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(path.join(root,
  'approvals/controller-selective-targets',targetE4+'.json')));
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.installedSha,current);
 assert.equal(m.targetSha,targetE4);
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.allowFiles.map(f=>f.path),paths);
 for(const f of m.allowFiles)assert.equal(f.sha256,
  hash(fs.readFileSync(path.join(root,f.path))));
 assert.equal(m.checks.status,'PASS');
 assert.equal(m.checks.manifestSha256,manifestFingerprint(m.allowFiles).sha256);
 assert.equal(m.selectiveSource.branch,sourceE4);
 assert.equal(m.selectiveSource.mainSha,sourceMain);
 assert.deepEqual(m.selectiveSource.customPaths,[]);
 assert.equal(m.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.deepEqual(m.backup.rollback,{kind:'RESTORE_INSTALLED_SHA',sha:current});
 assert.equal(m.approval.grade,'B');
 assert.equal(m.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(m.approval.ref,pin.approvalRef);
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.postSourceBranch,'main');
 assert.equal(m.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(validateControllerSelectivePin(m,pin),true);
 assert.equal(validateControllerOnlyInstallDelta(paths,m.allowFiles),true);
 const req={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-57c4f1b6-3e76-4cf0-a861-3cfe6296bd84',
  chatId:'chat-rum-browser-e4bf-20261126',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:targetE4,approvalManifestSha256:hash(raw)};
 assert.equal(validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',
  installedSha:current}).manifest.targetSha,targetE4);
 assert.throws(()=>validateUpdateRequest(req,raw,{actor:'ansqhd5774-Choi',
  installedSha:'0353e09059d6c8d483afbffb20d7f795e138f581'}),
  /UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([
  ...paths,'controller/report-recovery-3650-once.mjs'],m.allowFiles),
  /ALLOWFILE_DIFF_MISMATCH/);
});
