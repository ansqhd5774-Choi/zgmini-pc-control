import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUPS,selectGroups} from '../tools/controller-ci-scope.mjs';
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
