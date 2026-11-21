import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {manifestFingerprint,validateUpdateRequest,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta,MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY
} from '../tools/maintenance-contract.mjs';

const installed='5b33787dd32523496cd5a87dca73beb07ffaa409';
const target='2482bd297ef1ed11dbbebf31a21559f00a8f0db7';
const root=path.join(import.meta.dirname,'..','approvals');
const raw=fs.readFileSync(path.join(root,'controller-updates',target+'.json'));
const manifest=JSON.parse(raw);
const pin=JSON.parse(fs.readFileSync(path.join(root,'controller-selective-targets',target+'.json')));
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();

test('092 exact selective B manifest and pin preserve old installed rollback SHA',()=>{
 const files=['controller/core-runtime-source-readonly.mjs','controller/engine.mjs'];
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),files);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.deepEqual(manifest.selectiveSource.customPaths,['controller/engine.mjs']);
 assert.equal(manifest.selectiveSource.mainSha,'f0c238adca5c1eca9b4c300d93979287d6742e45');
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2601');
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-core092-selective-20261121',operation:'controller-update',
  controlRepository:CONTROL_REPOSITORY,targetControllerSha:target,
  approvalManifestSha256:sha(raw)};
 const checked=validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,pin),true);
 assert.throws(()=>validateUpdateRequest(issue,raw,{actor:'ansqhd5774-Choi',
  installedSha:'a'.repeat(40)}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([...files,'controller/operations.mjs'],
  manifest.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});

test('092 exact target is single-parent and no hidden scope or import mismatch',()=>{
 assert.deepEqual(git('rev-list','--parents','-n','1',target).split(' '),[target,installed]);
 assert.equal(git('rev-parse','refs/heads/codex/core-092-selective-from-5b337-20261121'),target);
 const changed=git('diff','--name-only',installed,target).split(/\r?\n/);
 assert.deepEqual(changed,manifest.allowFiles.map(x=>x.path));
 for(const f of manifest.allowFiles){
  const bytes=execFileSync('git',['show',target+':'+f.path],{windowsHide:true});
  assert.equal(sha(bytes),f.sha256);
  if(!manifest.selectiveSource.customPaths.includes(f.path)){
   const source=execFileSync('git',['show',manifest.selectiveSource.mainSha+':'+f.path],{windowsHide:true});
   assert.equal(sha(source),f.sha256);
  }
 }
 const oldEngine=git('show',installed+':controller/engine.mjs');
 const newEngine=git('show',target+':controller/engine.mjs');
 assert.equal(newEngine.replace("'core-runtime-source-readonly',",''),oldEngine,
  'only add isolated readonly operation; do not copy unrelated latest main engine changes');
});
