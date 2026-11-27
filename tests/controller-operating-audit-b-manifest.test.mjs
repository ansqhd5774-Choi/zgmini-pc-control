import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {manifestFingerprint,validateControllerSelectivePin,
  validateControllerConfigTransition,validateUpdateRequest} from '../tools/maintenance-contract.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET='cde1dd372210e4658ae348cb9e2577967cb11634';
const INSTALLED='555f95708984580cd7d5a0fd05a80b718e867710';
const MAIN_SOURCE='89430d68db34716c355f60126a0ed6c1f0753c84';
const URL='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4283';
const branch='codex/controller-operating-audit-selective-one-20261128';
const specPath=path.join(root,'approvals/controller-updates',TARGET+'.json');
const pinPath=path.join(root,'approvals/controller-selective-targets',TARGET+'.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,timeout:10000,encoding:'utf8'}).trim();
const gitBytes=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,windowsHide:true,timeout:10000,maxBuffer:2e6});
const sha256=b=>createHash('sha256').update(b).digest('hex');

test('proposed operating-audit B manifest has two exact immutable source files, not execution approval',()=>{
 const m=read(specPath),pin=read(pinPath);
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.installedSha,INSTALLED);
 assert.equal(m.targetSha,TARGET);
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.approval,{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:URL});
 assert.equal(m.checks.status,'PASS');
 assert.equal(m.checks.targetSha,TARGET);
 assert.equal(m.checks.manifestSha256,manifestFingerprint(m.allowFiles).sha256);
 assert.deepEqual(m.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:INSTALLED}});
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.postSourceBranch,'main');
 assert.equal(m.postSourceSha,'0d7b5bbc82d50b3d9097318d0b016981ac29b006');
 assert.deepEqual(m.selectiveSource,{schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
  branch,mainSha:MAIN_SOURCE,customPaths:m.allowFiles.map(f=>f.path)});
 assert.deepEqual(m.allowFiles.map(x=>x.path),
  ['config/operations.json','controller/operations.mjs']);
 assert.equal(pin.approvalRef,URL);
 assert.equal(validateControllerSelectivePin(m,pin),true);
 assert.equal(git('rev-parse','refs/remotes/origin/'+branch),TARGET);
 assert.deepEqual(git('rev-list','--parents','-n','1',TARGET).split(' '),[TARGET,INSTALLED]);
 assert.deepEqual(git('diff','--name-only',INSTALLED,TARGET,'--').split(/\r?\n/).sort(),
  m.allowFiles.map(f=>f.path));
 for(const f of m.allowFiles)assert.equal(sha256(gitBytes(TARGET,f.path)),f.sha256,f.path);
 const current=JSON.parse(gitBytes(INSTALLED,'config/operations.json'));
 const next=JSON.parse(gitBytes(TARGET,'config/operations.json'));
 assert.equal(validateControllerConfigTransition(current,next),true);
 assert.equal(m.allowFiles.length,2);
 assert.doesNotMatch(JSON.stringify(pin),/secret|token|nonce/i);
});

test('proposed effect cannot silently extend B to another target or extra operation',()=>{
 const manifest=read(specPath),pin=read(pinPath);
 assert.throws(()=>validateControllerSelectivePin({...manifest,targetSha:'a'.repeat(40)},pin),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin({...manifest,allowFiles:[...manifest.allowFiles,
  {path:'controller/common.mjs',sha256:'b'.repeat(64)}]},pin),/SELECTIVE_PIN_MISMATCH/);
 const old=JSON.parse(gitBytes(INSTALLED,'config/operations.json'));
 const newer=JSON.parse(gitBytes(TARGET,'config/operations.json'));
 newer.operations['runner-smoke'].timeoutSeconds=180;
 assert.throws(()=>validateControllerConfigTransition(old,newer),/CONTROLLER_EXISTING_OPERATION_CHANGED/);
});
