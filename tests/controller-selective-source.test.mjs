import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  UPDATE_SCHEMA,MAINTENANCE_ISSUE_SCHEMA,CONTROL_REPOSITORY,
  manifestFingerprint,validateUpdateRequest,
  validateControllerSelectivePin,validateControllerOnlyInstallDelta,
} from '../tools/maintenance-contract.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
const installedSha='a'.repeat(40),targetSha='b'.repeat(40),mainSha='c'.repeat(40);
const approvalRef='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2252';
const files=[
 {path:'config/operations.json',sha256:digest('config-overlay')},
 {path:'controller/operations.mjs',sha256:digest('operations-overlay')},
 {path:'controller/common.mjs',sha256:digest('common-from-main')},
];
const make=()=>({
 schema:UPDATE_SCHEMA,installedSha,targetSha,allowFiles:files,
 purpose:'pc-controller-maintenance',controllerOnlyInstall:true,
 selectiveSource:{schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
  branch:'codex/controller-selective-w01-w04-20261119',mainSha,
  customPaths:['config/operations.json','controller/operations.mjs']},
 approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:approvalRef},
 checks:{targetSha,status:'PASS',manifestSha256:manifestFingerprint(files).sha256},
 backup:{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installedSha}},
 postOperation:'core-status',postSourceBranch:'main',postSourceSha:mainSha,
});
function validate(manifest){
 const bytes=Buffer.from(JSON.stringify(manifest));
 const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-12345678-1234-4123-8123-123456789abc',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:manifest.targetSha,approvalManifestSha256:digest(bytes)};
 return validateUpdateRequest(issue,bytes,{actor:'ansqhd5774-Choi',installedSha});
}
function pin(manifest){
 return {schema:'ZGMINI_CONTROLLER_SELECTIVE_PIN_V1',
  installedSha:manifest.installedSha,targetSha:manifest.targetSha,
  sourceMainSha:manifest.selectiveSource.mainSha,
  targetBranch:manifest.selectiveSource.branch,
  customPaths:[...manifest.selectiveSource.customPaths].sort(),
  allowFiles:manifest.allowFiles,approvalRef:manifest.approval.ref};
}

test('selective overlay B admission retains exact installed/target identities and reviewed paths',()=>{
 const x=validate(make());
 assert.equal(x.manifest.targetSha,targetSha);
 assert.equal(x.manifest.installedSha,installedSha);
 assert.equal(x.manifest.selectiveSource.mainSha,mainSha);
 assert.deepEqual(x.manifest.selectiveSource.customPaths,
  ['config/operations.json','controller/operations.mjs']);
 assert.equal(validateControllerSelectivePin(x.manifest,pin(x.manifest)),true);
});

test('pin must match merged PR, branch, baseline, target and every approved file hash',()=>{
 const x=validate(make()).manifest;
 const tamper=[
  {targetSha:'d'.repeat(40)},
  {sourceMainSha:'e'.repeat(40)},
  {targetBranch:'codex/controller-fake-branch'},
  {installedSha:'f'.repeat(40)},
  {approvalRef:approvalRef.replace('/2252','/2253')},
  {customPaths:[]},
  {allowFiles:[...x.allowFiles.slice(0,2),{...x.allowFiles[2],sha256:'0'.repeat(64)}]},
 ];
 for(const patch of tamper)assert.throws(
  ()=>validateControllerSelectivePin(x,{...pin(x),...patch}),
  /SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(x,null),/SELECTIVE_PIN_MISSING/);
 assert.throws(()=>validateControllerSelectivePin(x,{...pin(x),rogue:true}),
  /SELECTIVE_PIN_FIELDS_INVALID/);
});

test('only approved controller-only maintenance scope accepts selective source',()=>{
 for(const patch of [
  {controllerOnlyInstall:false},
  {selectiveSource:null},
  {purpose:'pc-controller-heavy-readonly'},
  {infrastructureEvidence:{}},
  {selectiveSource:{...make().selectiveSource,branch:'../bad'}},
  {selectiveSource:{...make().selectiveSource,customPaths:['controller/rogue.mjs']}},
  {selectiveSource:{...make().selectiveSource,customPaths:['controller/operations.mjs','controller/operations.mjs']}},
 ]){
  assert.throws(()=>validate({...make(),...patch}),
   /SELECTIVE_SOURCE_|CONTROLLER_ONLY_INSTALL_SCOPE_INVALID|UPDATE_B_APPROVAL_REQUIRED/);
 }
 assert.equal(validate({...make(),selectiveSource:undefined}).manifest.selectiveSource,undefined);
});

test('exact installed-tree overlay diff is distinct from main-wide delta and preserves baseline',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-selective-controller-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 try{
  git('init','-q');git('config','user.name','Test Fixture');
  git('config','user.email','test@example.invalid');
  fs.mkdirSync(path.join(root,'controller'));
  fs.mkdirSync(path.join(root,'config'));
  fs.writeFileSync(path.join(root,'controller','operations.mjs'),'export const stable=true;\n');
  fs.writeFileSync(path.join(root,'config','operations.json'),'{"operations":{}}\n');
  git('add','controller/operations.mjs','config/operations.json');
  git('commit','-qm','installed baseline');
  const old=git('rev-parse','HEAD');
  git('checkout','-qb','main-candidate');
  fs.writeFileSync(path.join(root,'controller','unapproved.mjs'),'export const unapproved=true;\n');
  git('add','controller/unapproved.mjs');git('commit','-qm','unrelated main feature');
  const main=git('rev-parse','HEAD');
  git('checkout','-qb','selective-target',old);
  fs.writeFileSync(path.join(root,'controller','operations.mjs'),'export const stable=true; export const a407=true;\n');
  fs.writeFileSync(path.join(root,'config','operations.json'),'{"operations":{"a407":{"grade":"A"}}}\n');
  git('add','controller/operations.mjs','config/operations.json');
  git('commit','-qm','exact two approved paths');
  const overlay=git('rev-parse','HEAD');
  assert.equal(git('rev-list','--parents','-n','1',overlay),overlay+' '+old);
  const diff=git('diff','--name-only',old,overlay).split(/\r?\n/);
  assert.deepEqual(diff,['config/operations.json','controller/operations.mjs']);
  assert.equal(validateControllerOnlyInstallDelta(diff,files.slice(0,2)),true);
  assert.throws(()=>validateControllerOnlyInstallDelta(
   git('diff','--name-only',old,main).split(/\r?\n/),files.slice(0,2)),
   /ALLOWFILE_DIFF_MISMATCH/);
  assert.throws(()=>git('show',overlay+':controller/unapproved.mjs'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('W01 W04 seven-path selective review seed is exact and remains unapproved',()=>{
 const draft={
  installedSha:'b9099839df1a7cc6b3b166a139f7fac6938ada66',
  targetSha:'310d777f06e51448bf0d863f52a21a1af2c086fc',
  paths:['config/operations.json','controller/common.mjs',
   'controller/employment-r6-candidate-readonly.mjs',
   'controller/inflation-a401-private23-readonly.mjs',
   'controller/inflation-a407-integrity-readonly.mjs',
   'controller/inflation19-runtime-readonly.mjs','controller/operations.mjs']
 };
 assert.equal(draft.paths.length,7);
 assert.equal(new Set(draft.paths).size,7);
 assert.equal(draft.paths.every(p=>p.startsWith('config/')||p.startsWith('controller/')),true);
 assert.notEqual(draft.installedSha,draft.targetSha);
});

test('reviewed W01 W04 selective pin and B bytes pass exact maintainer admission',()=>{
 const installed='b9099839df1a7cc6b3b166a139f7fac6938ada66';
 const target='310d777f06e51448bf0d863f52a21a1af2c086fc';
 const file='approvals/controller-updates/'+target+'.json';
 const pinFile='approvals/controller-selective-targets/'+target+'.json';
 const raw=fs.readFileSync(file);
 const manifest=JSON.parse(raw.toString('utf8'));
 const pin=JSON.parse(fs.readFileSync(pinFile,'utf8'));
 const paths=['config/operations.json','controller/common.mjs',
  'controller/employment-r6-candidate-readonly.mjs',
  'controller/inflation-a401-private23-readonly.mjs',
  'controller/inflation-a407-integrity-readonly.mjs',
  'controller/inflation19-runtime-readonly.mjs','controller/operations.mjs'];
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.deepEqual(manifest.allowFiles.map(f=>f.path),paths);
 assert.equal(manifest.checks.manifestSha256,
  manifestFingerprint(manifest.allowFiles).sha256);
 assert.deepEqual(manifest.selectiveSource.customPaths,
  ['config/operations.json','controller/operations.mjs']);
 assert.equal(manifest.selectiveSource.mainSha,
  '4311757ce617cf6cab20683c933668bd0aa594c3');
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2275');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-12345678-1234-4123-8123-123456789abc',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const verified=validateUpdateRequest(request,raw,
  {actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(verified.manifest.targetSha,target);
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,
  customPaths:[]}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateUpdateRequest({...request,
  approvalManifestSha256:'0'.repeat(64)},raw,
  {actor:'ansqhd5774-Choi',installedSha:installed}));
});


test('W04 fixed light Raw/Run selective manifest and exact main pin are consistent',()=>{
 const installed='fe1c540302d8bb9768905aaab384324eab2f3ffe';
 const target='bed78dc16e81e257886aa5480705b50192b5cd01';
 const manifestFile=path.join(import.meta.dirname,'..','approvals','controller-updates',target+'.json');
 const pinFile=path.join(import.meta.dirname,'..','approvals','controller-selective-targets',target+'.json');
 const raw=fs.readFileSync(manifestFile);
 const approved=JSON.parse(raw.toString('utf8'));
 const selectedPin=JSON.parse(fs.readFileSync(pinFile,'utf8'));
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-light-raw-audit-20261119',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const checked=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,selectedPin),true);
 assert.equal(checked.manifest.controllerOnlyInstall,true);
 assert.equal(checked.manifest.selectiveSource.mainSha,'77feaf861d45208eb50f0c5b3e384bf23200c967');
 assert.deepEqual(checked.manifest.selectiveSource.customPaths,
  ['config/operations.json','controller/operations.mjs']);
 assert.deepEqual(checked.manifest.allowFiles.map(x=>x.path),[
  'config/operations.json',
  'controller/employment-r6-raw-run-attestation-readonly.mjs',
  'controller/operations.mjs',
 ]);
 assert.equal(checked.manifest.checks.manifestSha256,manifestFingerprint(approved.allowFiles).sha256);
 assert.equal(checked.manifest.postOperation,'core-status');
 assert.equal(checked.manifest.backup.rollback.sha,installed);
});

test('W04 27-reason one-file selective pin and exact B manifest validate',()=>{
 const installed='bed78dc16e81e257886aa5480705b50192b5cd01';
 const target='7b0b87607f8bd7e369f3a1eaa1955b8ca58a20f2';
 const file=path.join(import.meta.dirname,'..','approvals','controller-updates',target+'.json');
 const pinFile=path.join(import.meta.dirname,'..','approvals','controller-selective-targets',target+'.json');
 const raw=fs.readFileSync(file);
 const approved=JSON.parse(raw.toString('utf8'));
 const selectedPin=JSON.parse(fs.readFileSync(pinFile,'utf8'));
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-raw27-reasons-20261119',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const checked=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,selectedPin),true);
 assert.equal(checked.manifest.installedSha,installed);
 assert.equal(checked.manifest.targetSha,target);
 assert.equal(checked.manifest.controllerOnlyInstall,true);
 assert.equal(checked.manifest.selectiveSource.mainSha,'a8f855c979327008f105d7ab15e8b197ed1de679');
 assert.deepEqual(checked.manifest.selectiveSource.customPaths,[]);
 assert.deepEqual(checked.manifest.allowFiles.map(x=>x.path),
  ['controller/employment-r6-raw-run-attestation-readonly.mjs']);
 assert.equal(checked.manifest.allowFiles[0].sha256,
  '36e45cdaa6059b228a19ec9f94de5275be8331738dfd654c79673fcb80829d59');
 assert.equal(checked.manifest.checks.manifestSha256,
  manifestFingerprint(approved.allowFiles).sha256);
 assert.equal(checked.manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2316');
 assert.equal(checked.manifest.backup.rollback.sha,installed);
});

test('R6 protected drift firstFail installed-156 one-file B pin and recovery validate',()=>{
 const installed='156fa7eb85b5020d3167fb92da3edbcccbb54ccc';
 const target='13af1b1e9deb43d3008c521c0a528a51355f6905';
 const file=path.join(import.meta.dirname,'..','approvals','controller-updates',target+'.json');
 const pinFile=path.join(import.meta.dirname,'..','approvals','controller-selective-targets',target+'.json');
 const raw=fs.readFileSync(file);
 const manifest=JSON.parse(raw.toString('utf8'));
 const pin=JSON.parse(fs.readFileSync(pinFile,'utf8'));
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-controller-firstfail-source-review',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const checked=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,pin),true);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.deepEqual(manifest.allowFiles,[{path:'controller/engine.mjs',
  sha256:'6231d4c9db82c7e0dad2cb82454c681fe3d6b6b3a12d97853cfeb520c98d8949'}]);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(manifest.selectiveSource.mainSha,'d674a66f039154f9b7501a4f5f23278216b20853');
 assert.deepEqual(manifest.selectiveSource.customPaths,['controller/engine.mjs']);
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2735');
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,installedSha:target}),
  /SELECTIVE_PIN_MISMATCH/);
});

test('installed-9e354 core Git source identity one-file selective B pin is exact and rollbackable',()=>{
 const installed='9e3542e616f3fa781a2d614294d6bde17c087180';
 const target='6097c7f955363f4651e2a22b69e2b31e98ca24eb';
 const modulePath='controller/core-runtime-source-readonly.mjs';
 const raw=fs.readFileSync(path.join(import.meta.dirname,'..','approvals',
  'controller-updates',target+'.json'));
 const manifest=JSON.parse(raw.toString('utf8'));
 const pin=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'..','approvals',
  'controller-selective-targets',target+'.json'),'utf8'));
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-core-origin-git-source-verification',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const checked=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,pin),true);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.deepEqual(manifest.allowFiles,[{path:modulePath,
  sha256:'07eab3a628f77ab8102d396eb912f011e1910992823987f76608ce64ce54603a'}]);
 assert.equal(digest(fs.readFileSync(path.join(import.meta.dirname,'..',modulePath))),
  manifest.allowFiles[0].sha256);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.deepEqual(manifest.selectiveSource.customPaths,[modulePath]);
 assert.equal(manifest.selectiveSource.mainSha,'eb2c04f91ffea52cde61f2c301e177de708bc883');
 assert.equal(manifest.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2750');
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,installedSha:target}),
  /SELECTIVE_PIN_MISMATCH/);
});

test('D05 sector R3 A exact three-file selective pin is fail-closed and rollbackable',()=>{
 const installed='fe1672fd226d92c31aef52b0978ce043177c2514';
 const target='b5dbe4bfe693458af5ca6f085fa771bba033bb4e';
 const base=path.join(import.meta.dirname,'..','approvals');
 const raw=fs.readFileSync(path.join(base,'controller-updates',target+'.json'));
 const manifest=JSON.parse(raw.toString('utf8'));
 const pin=JSON.parse(fs.readFileSync(path.join(base,'controller-selective-targets',target+'.json'),'utf8'));
 const request={schema:MAINTENANCE_ISSUE_SCHEMA,
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-d05-sector-r3-approved-readback',
  operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const approved=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(approved.manifest,pin),true);
 assert.equal(approved.manifest.controllerOnlyInstall,true);
 assert.equal(approved.manifest.purpose,'pc-controller-maintenance');
 assert.equal(approved.manifest.selectiveSource.branch,'codex/issues-lifecycle-r3-i1228-selective-20261123');
 assert.equal(approved.manifest.selectiveSource.mainSha,'838d03a8412ff3141d02914273ab4429448d30e9');
 assert.deepEqual(approved.manifest.selectiveSource.customPaths,
  ['config/operations.json','controller/operations.mjs']);
 assert.deepEqual(approved.manifest.allowFiles.map(x=>x.path),
  ['config/operations.json','controller/operations.mjs','controller/sector-r3-dated-ledger-readonly.mjs']);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(digest(fs.readFileSync(path.join(import.meta.dirname,'..','controller',
  'sector-r3-dated-ledger-readonly.mjs'))),manifest.allowFiles[2].sha256);
 assert.equal(manifest.backup.rollback.sha,installed);
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2911');
 assert.throws(()=>validateControllerSelectivePin(approved.manifest,{...pin,sourceMainSha:target}),
  /SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:target}),
  /UPDATE_INSTALLED_SOURCE_DRIFT/);
});
