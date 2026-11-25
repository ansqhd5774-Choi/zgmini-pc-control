import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {manifestFingerprint,validateControllerSelectivePin,
 validateUpdateRequest} from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const target='58114a0b053e7ffac7c76862c45ed3d6aea47561';
const installed='83679b013ac9a9820331d93311ec97e572b18e13';
const sourceMain='bfe06c08667767bf2a11e6b4a4851c39d44d171f';
const overlayBranch='codex/er1-dec31-empty-selective-installed83679-20261125';
const approvalRef='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3553';
const files=Object.freeze([
 {path:'controller/market-calendar-er1-dec31-evidence-readonly.mjs',
  sha256:'de9314fe3e65159b6b95fac8a64aa301c20f216ef03c98ab1ec581fc83940fb0'},
 {path:'controller/writer-publication-evidence-readonly.mjs',
  sha256:'206f90f4753b1146f40e9e9c9be2791f8c6958eafe05492cb54fc045f909c3b2'},
]);
const mp='approvals/controller-updates/'+target+'.json';
const pp='approvals/controller-selective-targets/'+target+'.json';
const gitRaw=rel=>execFileSync('git',['show','HEAD:'+rel],
 {cwd:root,encoding:'buffer',maxBuffer:1_000_000});

test('corrected empty-archive selective B uses only exactly two merged Controller bytes',()=>{
 for(const item of files)
  assert.equal(sha(fs.readFileSync(path.join(root,item.path))),item.sha256);
 assert.notEqual(target,'90f2bdca223ebb6b031d60b28bcd879f72bae2ff');
});

test('replacement B manifest and pin preserve exact installed SHA, rollback and scope',()=>{
 const raw=gitRaw(mp),pinRaw=gitRaw(pp);
 const m=JSON.parse(raw.toString('utf8')),p=JSON.parse(pinRaw.toString('utf8'));
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(p.schema,'ZGMINI_CONTROLLER_SELECTIVE_PIN_V1');
 for(const item of [m,p]){
  assert.equal(item.installedSha,installed);
  assert.equal(item.targetSha,target);
  assert.deepEqual(item.allowFiles,files);
 }
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.selectiveSource,{schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
  branch:overlayBranch,mainSha:sourceMain,customPaths:[]});
 assert.equal(p.targetBranch,overlayBranch);
 assert.equal(p.sourceMainSha,sourceMain);
 assert.deepEqual(p.customPaths,[]);
 assert.equal(p.approvalRef,approvalRef);
 assert.deepEqual(m.approval,{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:approvalRef});
 assert.equal(m.checks.targetSha,target);
 assert.equal(m.checks.status,'PASS');
 assert.equal(m.checks.manifestSha256,manifestFingerprint(files).sha256);
 assert.deepEqual(m.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.postSourceBranch,'main');
 assert.equal(m.postSourceSha,sourceMain);
 const req={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  chatId:'chat-er1-dec31-empty-selective-fixture',operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:target,approvalManifestSha256:sha(raw)};
 const result=validateUpdateRequest(req,raw,
  {actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(result.manifest,p),true);
 assert.throws(()=>validateUpdateRequest({...req,
  approvalManifestSha256:'0'.repeat(64)},raw,
  {actor:'ansqhd5774-Choi',installedSha:installed}),/UPDATE_MANIFEST_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(result.manifest,
  {...p,allowFiles:p.allowFiles.slice(1)}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateUpdateRequest(req,raw,
  {actor:'ansqhd5774-Choi',installedSha:'0'.repeat(40)}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
});

test('new B approval bytes are LF Git objects, never mutable checkout authority',()=>{
 const rules=fs.readFileSync(path.join(root,'.gitattributes'),'utf8').split(/\r?\n/);
 for(const rel of [mp,pp]){
  assert.ok(rules.includes(rel+' text eol=lf'));
  const raw=gitRaw(rel);
  assert.equal(raw.includes(Buffer.from('\r\n')),false);
  assert.equal(raw.at(-1),10);
  const checkout=fs.readFileSync(path.join(root,rel));
  if(checkout.includes(Buffer.from('\r\n')))
   assert.notEqual(sha(checkout),sha(raw));
 }
});
