import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactFiles=Object.freeze([
 {path:'controller/market-calendar-er1-dec31-evidence-readonly.mjs',
  sha256:'0b93d41303b366c9204f84bbeeada10aae2c02ada6c61932af5755f2f7444590'},
 {path:'controller/writer-publication-evidence-readonly.mjs',
  sha256:'206f90f4753b1146f40e9e9c9be2791f8c6958eafe05492cb54fc045f909c3b2'},
]);

test('ER1 December selective overlay two paths match merged read-only source bytes',()=>{
 assert.equal(exactFiles.length,2);
 for(const file of exactFiles){
  assert.equal(digest(fs.readFileSync(path.join(root,file.path))),file.sha256);
 }
});

import {manifestFingerprint,validateControllerSelectivePin,validateUpdateRequest}
 from '../tools/maintenance-contract.mjs';

const target='90f2bdca223ebb6b031d60b28bcd879f72bae2ff';
const installed='83679b013ac9a9820331d93311ec97e572b18e13';
const sourceMain='e1651b7f764415f4fffa29ba2eeb72a8ced743be';
const approvedRef='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3542';

function evidence(){
 const f=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(f);
 const pin=JSON.parse(fs.readFileSync(path.join(root,
   'approvals/controller-selective-targets',target+'.json'),'utf8'));
 const issue={
  schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  chatId:'chat-er1-dec31-selective-fixture',
  operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:target,
  approvalManifestSha256:digest(f),
 };
 return {manifest,pin,issue,raw:f};
}

test('exact selective B manifest and reviewed pin agree on source and rollback',()=>{
 const {manifest,pin,issue,raw}=evidence();
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.approval.grade,'B');
 assert.equal(manifest.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(manifest.approval.ref,approvedRef);
 assert.equal(manifest.selectiveSource.mainSha,sourceMain);
 assert.equal(manifest.selectiveSource.branch,
  'codex/er1-dec31-selective-installed83679-20261125');
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.deepEqual(manifest.allowFiles,exactFiles);
 assert.equal(manifest.checks.manifestSha256,
  manifestFingerprint(exactFiles).sha256);
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.postSourceBranch,'main');
 assert.equal(manifest.postSourceSha,sourceMain);
 const {manifest:normalized}=validateUpdateRequest(issue,raw,
  {actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(normalized,pin),true);
});

test('source or approval hash tampering cannot authorize B',()=>{
 const {manifest,pin,issue,raw}=evidence();
 const v=validateUpdateRequest(issue,raw,
  {actor:'ansqhd5774-Choi',installedSha:installed});
 assert.throws(()=>validateControllerSelectivePin(v.manifest,
  {...pin,allowFiles:pin.allowFiles.slice(1)}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(v.manifest,
  {...pin,sourceMainSha:'0'.repeat(40)}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateUpdateRequest({...issue,
  approvalManifestSha256:'0'.repeat(64)},raw,
  {actor:'ansqhd5774-Choi',installedSha:installed}),/UPDATE_MANIFEST_PIN_MISMATCH/);
 assert.throws(()=>validateUpdateRequest(issue,raw,
  {actor:'ansqhd5774-Choi',installedSha:'0'.repeat(40)}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.notEqual(manifest.installedSha,manifest.targetSha);
});

const exactApprovalPaths=Object.freeze([
 'approvals/controller-updates/90f2bdca223ebb6b031d60b28bcd879f72bae2ff.json',
 'approvals/controller-selective-targets/90f2bdca223ebb6b031d60b28bcd879f72bae2ff.json',
]);
const approvedRawManifestSha256=
 '01e0b9231a9fbf222602635f879a136a8c827f2de5cea613246afc54b43bcbac';

test('exact December B Git blob bytes retain LF independently of reused Windows worktrees',()=>{
 const attrs=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');
 const rules=attrs.split(/\r?\n/);
 for(const pathname of exactApprovalPaths){
  assert.ok(rules.includes(pathname+' text eol=lf'),
   'missing exact LF checkout attribute for '+pathname);
  // B approval hashes are pinned to the immutable raw Git object, not the
  // mutable Windows checkout, which may predate a changed .gitattributes.
  const gitBytes=execFileSync('git',['show','HEAD:'+pathname],
   {cwd:root,encoding:'buffer',maxBuffer:2_000_000});
  assert.equal(gitBytes.includes(Buffer.from('\r\n')),false,
   'approved Git blob cannot contain CRLF');
  assert.equal(gitBytes.at(-1),10,'Git object ends with LF');
  const checkout=fs.readFileSync(path.join(root,pathname));
  if(checkout.includes(Buffer.from('\r\n')))
   assert.notEqual(digest(checkout),digest(gitBytes),
    'transformed worktree must never be treated as approval pin');
 }
 const manifest=execFileSync('git',['show','HEAD:'+exactApprovalPaths[0]],
  {cwd:root,encoding:'buffer',maxBuffer:2_000_000});
 assert.equal(manifest.length,1478);
 assert.equal(digest(manifest),approvedRawManifestSha256);
 const transformed=Buffer.from(manifest.toString('utf8').replace(/\n/g,'\r\n'));
 assert.notEqual(digest(transformed),approvedRawManifestSha256,
  'Windows CRLF must not authorize exact B request pin');
});
