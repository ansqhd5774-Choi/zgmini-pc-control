import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../tools/TEST_996_WINDOWS_HANDLE_BOUND_ARCHIVE.ps1', import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-handle-fixture-'));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'archive');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'owner.json'), '{"fixture":true}\n');
  const invoke = (operation, expected) => {
    const result = spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
      ['-NoProfile', '-NonInteractive', '-File', script], {
        input: JSON.stringify({root, source, destination, operation, expected}),
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
      });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return JSON.parse(result.stdout);
  };
  const observed = invoke('snapshot');
  assert.equal(observed.ok, true, JSON.stringify(observed));
  return {root, source, destination, invoke, expected: observed.snapshot};
}

const windowsOnly = {skip: process.platform !== 'win32'};
test('native archive preserves the same directory and file identity through readback', windowsOnly, () => {
  const {source, destination, invoke, expected} = fixture();
  const receipt = invoke('move', expected);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));
  assert.equal(receipt.sourceHandleBound, true);
  assert.equal(receipt.competingRenameBlocked, true);
  assert.deepEqual(receipt.snapshot, expected);
  assert.equal(fs.existsSync(source), false);
  assert.equal(fs.readFileSync(path.join(destination, 'owner.json'), 'utf8'), '{"fixture":true}\n');
});

test('native archive rejects a replaced source even with identical child bytes', windowsOnly, () => {
  const {root, source, destination, invoke, expected} = fixture();
  fs.renameSync(source, path.join(root, 'saved'));
  fs.mkdirSync(source);
  fs.copyFileSync(path.join(root, 'saved', 'owner.json'), path.join(source, 'owner.json'));
  assert.equal(invoke('move', expected).code, 'C996_NATIVE_SOURCE_IDENTITY_DRIFT');
  assert.equal(fs.existsSync(source), true);
  assert.equal(fs.existsSync(destination), false);
});

test('native archive rejects changed child bytes before the move', windowsOnly, () => {
  const {source, destination, invoke, expected} = fixture();
  fs.appendFileSync(path.join(source, 'owner.json'), ' ');
  assert.equal(invoke('move', expected).code, 'C996_NATIVE_SOURCE_CONTENT_DRIFT');
  assert.equal(fs.existsSync(source), true);
  assert.equal(fs.existsSync(destination), false);
});

for (const type of ['directory', 'file']) {
  test('native archive preserves an existing destination ' + type, windowsOnly, () => {
    const {root, source, destination, invoke, expected} = fixture();
    if (type === 'directory') fs.mkdirSync(destination);
    const marker = type === 'directory' ? path.join(destination, 'marker') : destination;
    fs.writeFileSync(marker, 'preserve');
    const before = fs.lstatSync(destination, {bigint: true});
    assert.equal(invoke('move', expected).code, 'C996_NATIVE_DESTINATION_EXISTS');
    assert.deepEqual(invoke('snapshot').snapshot, expected);
    assert.equal(fs.lstatSync(destination, {bigint: true}).ino, before.ino);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'preserve');
    assert.deepEqual(fs.readdirSync(root).sort(), ['archive', 'source']);
    assert.equal(fs.existsSync(source), true);
  });
}
