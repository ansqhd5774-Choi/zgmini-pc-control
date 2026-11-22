import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {prepareControllerUpdateRequest,validateUpdateRequest,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
const target='d260aea2513902a77425344629f91575e2d950ef';
const raw=fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url));
const m=JSON.parse(raw),pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url)));
const git=(...a)=>execFileSync('git',a,{windowsHide:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
test('092 hidden-task install is an exact two-path overlay and retains previous runtime rollback',()=>{
 assert.deepEqual(m.allowFiles.map(f=>f.path),['controller/core-runtime-source-readonly.mjs','controller/core-runtime-source-wmi.mjs']);
 assert.deepEqual(git('rev-list','--parents','-n','1',target).toString().trim().split(' '),[target,m.installedSha]);
 assert.deepEqual(git('diff','--name-only',m.installedSha,target).toString().trim().split(/\r?\n/),m.allowFiles.map(f=>f.path));
 assert.equal(m.backup.rollback.sha,m.installedSha);
 assert.equal(m.postOperation,'core-status');
 for(const f of m.allowFiles){
  assert.equal(digest(git('show',target+':'+f.path)),f.sha256);
  assert.equal(digest(git('show',m.selectiveSource.mainSha+':'+f.path)),f.sha256);
 }
});
test('092 approval pin and request reject a stale installed SHA and unrelated path',()=>{
 assert.equal(m.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2651');
 const request=prepareControllerUpdateRequest(raw,{installedSha:m.installedSha,chatId:'chat-core092-hidden-test'});
 const valid=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:m.installedSha});
 assert.equal(validateControllerSelectivePin(valid.manifest,pin),true);
 assert.throws(()=>validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:'a'.repeat(40)}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerOnlyInstallDelta([...m.allowFiles.map(f=>f.path),'controller/engine.mjs'],m.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});
