import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUPS,selectGroups} from '../tools/controller-ci-scope.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('integration checkout contains newly required base tests and proposed feature together',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-consistent-tree-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
 git(['init','-q']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);
 fs.writeFileSync(path.join(root,'base.txt'),'base');git(['add','base.txt']);git(['commit','-qm','base']);const base=git(['rev-parse','HEAD']);
 git(['switch','-qc','feature']);fs.writeFileSync(path.join(root,'feature.mjs'),'export const proposed=true;');
 git(['add','feature.mjs']);git(['commit','-qm','feature']);const head=git(['rev-parse','HEAD']);
 git(['switch','-qc','advanced-base',base]);fs.writeFileSync(path.join(root,'required.test.mjs'),'export const check=true;');
 git(['add','required.test.mjs']);git(['commit','-qm','new required base check']);git(['merge','--no-edit','feature']);
 assert.throws(()=>git(['cat-file','-e',head+':required.test.mjs']));
 assert.equal(git(['show','HEAD:required.test.mjs']),'export const check=true;');
 assert.equal(git(['show','HEAD:feature.mjs']),'export const proposed=true;');
 const workflow=fs.readFileSync(new URL('../.github/workflows/controller-maintenance-source-tests.yml',import.meta.url),'utf8');
 assert.match(workflow,/ref: \$\{\{ github\.sha \}\}/);
 assert.match(workflow,/CI_TESTED_INTEGRATION_SHA=%GITHUB_SHA%/);
});
test('shared contracts and unclassified changes never skip families',()=>{
  for (const p of ['controller/operations.mjs','config/operations.json',
    '.github/workflows/controller-maintenance-source-tests.yml','unknown/shared.mjs']) {
    assert.deepEqual(selectGroups([p]),GROUPS);
  }
  assert.deepEqual(selectGroups([]),GROUPS);
});
test('scoped regression families and mixed changes',()=>{
  assert.deepEqual(selectGroups(['tests/w03-r48-private-readback.test.mjs']),['w03']);
  assert.deepEqual(selectGroups(['writer-b/w01-r2-two-branch-preview.test.mjs']),['w01']);
  assert.deepEqual(selectGroups(['tests/earnings-c-checkpoint-readonly.test.mjs']),['w05']);
  assert.deepEqual(selectGroups(['watchdog-b/contract.mjs']),['core','watchdog']);
  assert.deepEqual(selectGroups(['tests/runner-watchdog.test.mjs']),['core','watchdog']);
  assert.deepEqual(selectGroups(['tests/http32-two-host-checkpoints-readonly.test.mjs']),['w01']);
  assert.deepEqual(selectGroups(['tools/maintenance-contract.mjs']),GROUPS);
  assert.deepEqual(selectGroups(['tools/r181-protected-b-entry.mjs',
    'tests/w01-inflation7-writer-ledger-existing-a.test.mjs']),['w03','w01']);
});

test('optional W05 receipt fixture executes on installed-base trees that contain it',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/controller-maintenance-source-tests.yml',import.meta.url),'utf8');
 assert.match(workflow,/name: Verify W05 independent operator receipt without operational access\s+#[^\n]*\n\s*#[^\n]*\n\s*if: hashFiles\('tests\/w05-2821-operator-readonly-receipt\.test\.mjs'\) != ''\s+run: node --test --test-concurrency=1 tests\/w05-2821-operator-readonly-receipt\.test\.mjs/);
 // Only fixture existence is optional. No operative protection assertion is removed.
 assert.match(workflow,/name: Run scoped maintenance and Controller runtime safety regressions/);
});

test('Controller integration workflow triggers for owning source edits',()=>{
 const y=fs.readFileSync(new URL('../.github/workflows/controller-maintenance-source-tests.yml',import.meta.url),'utf8');
 const trigger=y.slice(0,y.indexOf('\npermissions:'));
 const required=[
  'tools/maintenance-agent.mjs',
  'tools/source-bundle-register.mjs',
  'controller/engine.mjs',
  'controller/memory-admission.mjs'
 ];
 for(const p of required){
  assert.ok(trigger.includes("      - '"+p+"'"),'missing PR trigger: '+p);
  assert.deepEqual(selectGroups([p]),p==='tools/source-bundle-register.mjs'?['core']:GROUPS);
 }
 assert.match(y,/tests\/maintenance-agent\.test\.mjs/);
 assert.match(y,/tests\/source-bundle-register\.test\.mjs/);
 assert.match(y,/tests\/engine\.test\.mjs/);
 assert.match(y,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 assert.doesNotMatch(trigger,/schedule:|workflow_dispatch:/);
});
