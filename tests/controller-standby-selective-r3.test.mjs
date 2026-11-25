// R3 exact six-file selective Controller B regression; source-only, no PC I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 validateUpdateRequest,validateControllerSelectivePin,manifestFingerprint,
 MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY,CONTROL_ACTOR,
 controllerImportScanRoots,validateControllerImportClosure,
 validateControllerOnlyInstallDelta
} from '../tools/maintenance-contract.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target='b91340d5047daf753e1c17a5c966e4d2aecea586';
const installed='53fe24e22446d21a9fd4ee308d12b7cba7f37e25';
const manifestPath=path.join(root,'approvals/controller-updates',target+'.json');
const pinPath=path.join(root,'approvals/controller-selective-targets',target+'.json');
const load=()=>({
 raw:fs.readFileSync(manifestPath),
 manifest:JSON.parse(fs.readFileSync(manifestPath,'utf8')),
 pin:JSON.parse(fs.readFileSync(pinPath,'utf8'))
});
const request=raw=>({
 schema:MAINTENANCE_ISSUE_SCHEMA,
 requestId:'pc-update-12345678-abcd-4123-8234-abcdef012345',
 chatId:'chat-r3-standby-20261126',
 operation:'controller-update',
 controlRepository:CONTROL_REPOSITORY,
 targetControllerSha:target,
 approvalManifestSha256:createHash('sha256').update(raw).digest('hex')
});
const admit=(m)=>validateUpdateRequest(request(m),m,{
 actor:CONTROL_ACTOR,installedSha:installed
});
const files=[
 'controller/common.mjs','controller/engine.mjs','controller/entry.mjs',
 'controller/operations.mjs','controller/standby.mjs','controller/supervisor.mjs'
];
test('R3 selective Controller B reuses exact installed-base pin and existing contract',()=>{
 const {raw,manifest,pin}=load();
 const validated=admit(raw);
 assert.equal(validated.manifest.targetSha,target);
 assert.equal(validated.manifest.installedSha,installed);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),files);
 assert.equal(manifest.allowFiles.find(x=>x.path==='controller/operations.mjs')?.sha256,
  'd4a76910806cba861b3253f5fd24eccc8968fcbaa66133999483034b2f661cd3');
 assert.deepEqual([...manifest.selectiveSource.customPaths].sort(),files);
 assert.equal(pin.sourceMainSha,'f09f5a5510bd11e6e6f869ea1728d940939a5e59');
 assert.equal(pin.targetBranch,'codex/controller-standby-selective-r3-minimal-20261126');
 assert.equal(pin.approvalRef,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3752');
});
test('R3 selective manifest refuses extra operations, SHA, and unapproved files',()=>{
 const {manifest,pin}=load();
 const patches=[
  m=>{m.installedSha='0'.repeat(40);},
  m=>{m.controllerOnlyInstall=false;},
  m=>{m.allowFiles.push({path:'config/operations.json',sha256:'0'.repeat(64)});},
  m=>{m.allowFiles[0].sha256='0'.repeat(64);},
  m=>{m.selectiveSource.customPaths=['controller/entry.mjs','controller/entry.mjs'];},
  m=>{m.postOperation='run-shell';},
  m=>{m.approval.scope='WRITER_UPDATE';},
 ];
 for(const patch of patches){
  const m=structuredClone(manifest);patch(m);
  assert.throws(()=>admit(Buffer.from(JSON.stringify(m))),/UPDATE_|SELECTIVE_|POST_|APPROVAL_|CONTROLLER_/);
 }
 const altered=structuredClone(pin);
 altered.targetBranch='codex/unapproved';
 assert.throws(()=>validateControllerSelectivePin(manifest,altered),/SELECTIVE_PIN_MISMATCH/);
});
test('R3 overlay does not approve Watchdog or mutate six-seat operating policy',()=>{
 const {manifest,pin}=load();
 assert.equal(manifest.allowFiles.some(x=>x.path.startsWith('tools/')||
  x.path.startsWith('config/')||x.path.startsWith('watchdog-b/')),false);
 assert.equal(pin.customPaths.length,6);
 const installedOps=JSON.parse(fs.readFileSync(
  path.join(root,'config/operations.json'),'utf8'));
 assert.equal(installedOps.seats,6);
 assert.equal(installedOps.mutationsEnabled,false);
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
});

const gitBytes=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,
 timeout:15000,maxBuffer:8*1024*1024});
const git=(...args)=>gitBytes(...args).toString('utf8').trim();

test('R3 immutable target has installed parent, six exact bytes and full import closure',()=>{
 const {manifest,pin}=load();
 assert.equal(git('cat-file','-t',target),'commit');
 assert.equal(git('rev-parse','refs/remotes/origin/'+pin.targetBranch),target);
 assert.equal(git('rev-list','--parents','-n','1',target),target+' '+installed);
 const changed=git('diff','--name-only',installed,target,'--').split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,files);
 assert.equal(validateControllerOnlyInstallDelta(changed,manifest.allowFiles),true);
 for(const x of manifest.allowFiles){
  const bytes=gitBytes('show',target+':'+x.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),x.sha256,x.path);
 }
 assert.deepEqual(gitBytes('show',target+':config/operations.json'),
  gitBytes('show',installed+':config/operations.json'));
 const full=git('ls-tree','-r','--name-only',target,'--','controller','config')
  .split(/\r?\n/).filter(x=>x&&!x.endsWith('.test.mjs'));
 const scan=validateControllerImportClosure(full,controllerImportScanRoots(changed),
  rel=>gitBytes('show',target+':'+rel).toString('utf8'));
 assert.equal(scan.status,'VERIFIED');
 assert.ok(scan.checkedModules>=6);
});

test('R3 operations overlay is only the minimal constant export, no R6/other behavior',()=>{
 const previous=gitBytes('show',installed+':controller/operations.mjs').toString('utf8');
 const next=gitBytes('show',target+':controller/operations.mjs').toString('utf8');
 const exact=\`// R3 engine optional Worker timeout stage names; preserve installed operation behavior.
export const CORE_STATUS_STAGES=Object.freeze([
 'CORE_STATUS_ENTERED','CORE_LOCK_READ','CORE_CHECKPOINT_CYCLE',
 'CORE_CHECKPOINT_COLLECTION','CORE_CHECKPOINT_WRITER','CORE_CONFIG',
 'CORE_TASK_HASHES','CORE_STATUS_DONE'
]);
\`;
 assert.ok(next.includes(exact));
 assert.equal(next.replace(exact,''),previous);
});
