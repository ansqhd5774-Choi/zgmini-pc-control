import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  CONTROL_UPDATE_SENSITIVE_PATHS,CONTROLLER_POST_OPERATIONS,
  controllerAdmissionForPurpose,validateControllerConfigTransition,
} from '../tools/maintenance-contract.mjs';
import {analyzeControllerDelta,planFromGit} from '../tools/controller-update-plan.mjs';

const old='a'.repeat(40),next='b'.repeat(40);
const digest=x=>createHash('sha256').update(x).digest('hex');

test('checkout cleanliness checks only active installation, workflows, executable and approvals',()=>{
 for(const p of ['controller','config','.github/workflows','scripts','approvals/controller-updates'])
   assert.ok(CONTROL_UPDATE_SENSITIVE_PATHS.includes(p));
 for(const p of ['results','docs','tests','README.md'])
   assert.ok(!CONTROL_UPDATE_SENSITIVE_PATHS.includes(p));
});

test('postcheck contract includes source-audit without admitting arbitrary operations',()=>{
 assert.deepEqual([...CONTROLLER_POST_OPERATIONS].sort(),
   ['core-status','fear-greed-archive-status','source-audit'].sort());
 assert.ok(!CONTROLLER_POST_OPERATIONS.includes('arbitrary-shell'));
});

test('moderate readonly profile retains single heavy lease policy and rejects unapproved memory reductions',()=>{
 const previous={seats:6,mutationsEnabled:false,maxHeavyJobs:1,
   minimumFreeMiBForHeavy:1536,artifactUploadEnabled:false,
   operations:{'core-status':{grade:'A',resource:'light',timeoutSeconds:60}}};
 const nextPolicy=structuredClone(previous);
 nextPolicy.operations['new-readonly']={grade:'A',resource:'heavy',timeoutSeconds:150,minimumFreeMiB:1024};
 const moderate=controllerAdmissionForPurpose('pc-controller-moderate-readonly');
 assert.equal(moderate.resourceProfile,'MODERATE_READONLY_180_1024');
 assert.equal(validateControllerConfigTransition(previous,nextPolicy,moderate),true);
 assert.throws(()=>validateControllerConfigTransition(previous,nextPolicy,
   controllerAdmissionForPurpose('pc-controller-maintenance')),/CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
 const noLease=structuredClone(nextPolicy);noLease.maxHeavyJobs=2;
 assert.throws(()=>validateControllerConfigTransition(previous,noLease,moderate),
   /CONTROLLER_CONFIG_PROTECTED_POLICY_CHANGED/);
 const insufficient=structuredClone(nextPolicy);insufficient.operations['new-readonly'].minimumFreeMiB=256;
 assert.throws(()=>validateControllerConfigTransition(previous,insufficient,moderate),
   /CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
 const writes=structuredClone(nextPolicy);writes.operations['new-readonly'].grade='B';
 assert.throws(()=>validateControllerConfigTransition(previous,writes,moderate),
   /CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
});

test('read-only planner separates exact byte hashes and never treats them as approval',()=>{
 const values={'controller/new-readonly.mjs':Buffer.from('approved bytes'),
   'config/operations.json':Buffer.from('{"operations":{}}'),
   '.github/workflows/pc-job.yml':Buffer.from('name: safe')};
 const paths=['results/last-run.json','controller/new-readonly.mjs',
   '.github/workflows/pc-job.yml','config/operations.json','docs/change.md','tools/update.mjs'];
 const r=analyzeControllerDelta({installedSha:old,targetSha:next,
   changedPaths:paths,readTargetFile:p=>values[p]});
 assert.equal(r.status,'DRAFT_NOT_APPROVED');
 assert.equal(r.requiresControllerInstall,true);
 assert.equal(r.requiresInfrastructureApproval,true);
 assert.equal(r.requiresSeparateMaintenanceHandoff,true);
 assert.deepEqual(r.allowFiles.map(x=>x.path),
   ['config/operations.json','controller/new-readonly.mjs']);
 assert.equal(r.allowFiles[1].sha256,digest(values['controller/new-readonly.mjs']));
 assert.equal(r.infrastructureFiles.length,1);
 assert.equal(r.otherChanges.length,3);
 assert.ok(!('approved' in r));
});

test('planner fails closed on unknown paths, duplicates, missing target blobs, and invalid SHA',()=>{
 const make=paths=>analyzeControllerDelta({installedSha:old,targetSha:next,
   changedPaths:paths,readTargetFile:()=>Buffer.from('ok')});
 assert.equal(make(['unfamiliar/runtime.bat']).status,'REVIEW_UNCLASSIFIED_CHANGE');
 assert.throws(()=>make(['controller/a.mjs','controller/a.mjs']),/CONTROLLER_PLAN_PATH_INVALID/);
 assert.throws(()=>make(['../escape.mjs']),/CONTROLLER_PLAN_PATH_INVALID/);
 assert.equal(make(['controller/not-a-safe.json']).status,'REVIEW_UNCLASSIFIED_CHANGE');
 assert.throws(()=>analyzeControllerDelta({installedSha:old,targetSha:old,
   changedPaths:[],readTargetFile:()=>Buffer.alloc(0)}),/CONTROLLER_PLAN_SHA_INVALID/);
 assert.throws(()=>analyzeControllerDelta({installedSha:old,targetSha:next,
   changedPaths:['controller/a.mjs'],readTargetFile:()=>{throw Error('missing');}}),
   /CONTROLLER_PLAN_TARGET_FILE_UNAVAILABLE/);
 assert.throws(()=>planFromGit(['--installed-sha',old,'--target-sha','not-sha']),
   /CONTROLLER_PLAN_SHA_INVALID/);
});

test('real Git fixture ignores unrelated dirty files yet pins executable changes to exact commits',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-controller-plan-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 try{
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
  fs.mkdirSync(path.join(root,'controller'));
  fs.writeFileSync(path.join(root,'controller','check.mjs'),'export const check=1;\n');
  git('add','controller/check.mjs');git('commit','-qm','initial');
  const installedSha=git('rev-parse','HEAD');

  fs.mkdirSync(path.join(root,'results'));
  fs.writeFileSync(path.join(root,'results','last.json'),'{"status":"old"}\n');
  const sensitive=['controller','config','.github/workflows','scripts','approvals/controller-updates'];
  assert.equal(git('status','--porcelain','--untracked-files=all','--',...sensitive),'');
  fs.writeFileSync(path.join(root,'controller','check.mjs'),'export const check=2;\n');
  assert.match(git('status','--porcelain','--untracked-files=all','--',...sensitive),
    /controller\/check\.mjs/);

  git('add','controller/check.mjs');git('commit','-qm','controlled change');
  const targetSha=git('rev-parse','HEAD');
  git('update-ref','refs/remotes/origin/main',targetSha);
  const script=fileURLToPath(new URL('../tools/controller-update-plan.mjs',import.meta.url));
  const output=execFileSync(process.execPath,[script,'--installed-sha',installedSha,
    '--target-sha',targetSha],{cwd:root,encoding:'utf8'});
  const result=JSON.parse(output);
  assert.equal(result.status,'DRAFT_NOT_APPROVED');
  assert.deepEqual(result.allowFiles.map(x=>x.path),['controller/check.mjs']);
  assert.equal(result.allowFiles[0].sha256,digest(Buffer.from('export const check=2;\n')));
  assert.equal(result.requiresFreshRemoteAndLivePCCheck,true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
