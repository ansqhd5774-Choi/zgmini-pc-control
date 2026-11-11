import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {
  build996OwnerArchiveFixtureScript,
  require996OwnerArchiveReceipt,
} from '../tools/controller-996-c-native-owner-operator.mjs';

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

for (const {start, competing} of [
  {start:'old',competing:false}, {start:'old',competing:true},
  {start:'continuation',competing:true},
  {start:'install',competing:false},
]) {
  test('Operator preserves install barrier with locked files: ' + start + ' competing=' + competing,
    windowsOnly, () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-handle-fixture-'));
      const steps = ['old', 'continuation', 'install'];
      const nonce = 'fixture-owner';
      const bytes = JSON.stringify({pid: process.pid, nonce});
      const sha = createHash('sha256').update(bytes).digest('hex');
      for (const step of steps) {
        fs.mkdirSync(path.join(root, step));
        fs.writeFileSync(path.join(root, step, 'owner.json'), bytes);
      }
      // Simulate a process interruption with an earlier archive already present.
      const preceding=steps.slice(0,steps.indexOf(start));
      for(const step of preceding)fs.renameSync(path.join(root,step),path.join(root,step+'-archive'));
      const attempted = [];
      const run = () => {
        for (const step of steps.slice(steps.indexOf(start))) {
          attempted.push(step);
          const result = spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', build996OwnerArchiveFixtureScript()], {
              input: JSON.stringify({
                operation: 'move', root, source: path.join(root, step),
                destination: path.join(root, step + '-archive'), pins: {'owner.json': sha},
                ownerMode: 'LIVE_NEW', actorPid: process.pid, nonce,
                simulateContentDrift: competing,
              }),
              encoding: 'utf8', timeout: 30000, windowsHide: true,
            });
          assert.equal(result.status, 0, result.error?.message ?? result.stderr);
          const receipt = JSON.parse(result.stdout);
          assert.equal(receipt.moveOccurred, false);
          require996OwnerArchiveReceipt(receipt);
        }
      };
      assert.throws(run, {code: competing?'C996_NATIVE_COMPETING_WRITE_BLOCKED':'C996_NATIVE_LOCKED_MOVE_UNSUPPORTED'});
      assert.deepEqual(attempted, [start]);
      assert.equal(fs.existsSync(path.join(root, 'install-archive')), false);
      assert.equal(fs.readFileSync(path.join(root, 'install', 'owner.json'), 'utf8'), bytes);
      assert.equal(fs.readFileSync(path.join(root, start, 'owner.json'), 'utf8'), bytes);
      assert.equal(fs.existsSync(path.join(root, start + '-archive')), false);
      for(const step of preceding)assert.equal(fs.readFileSync(path.join(root,step+'-archive','owner.json'),'utf8'),bytes);
    });
}


test('native TEMP fixture proves sibling insertion remains possible under pinned file handles',windowsOnly,()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-handle-fixture-'));
  const source=path.join(root,'source'),destination=path.join(root,'archive');
  fs.mkdirSync(source);
  const nonce='fixture-owner';
  const bytes=JSON.stringify({pid:process.pid,nonce});
  fs.writeFileSync(path.join(source,'owner.json'),bytes);
  const pin=createHash('sha256').update(bytes).digest('hex');
  const x=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoProfile','-NonInteractive','-Command',build996OwnerArchiveFixtureScript()],{
      input:JSON.stringify({operation:'move',root,source,destination,
        pins:{'owner.json':pin},ownerMode:'LIVE_NEW',
        actorPid:process.pid,nonce,simulateNamespaceInsert:true}),
      encoding:'utf8',timeout:30000,windowsHide:true,
    });
  assert.equal(x.status,0,x.error?.message??x.stderr);
  const receipt=JSON.parse(x.stdout);
  assert.equal(receipt.ok,false);
  assert.equal(receipt.code,'C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED');
  assert.equal(receipt.moveOccurred,false);
  assert.equal(fs.existsSync(destination),false);
  assert.equal(fs.readFileSync(path.join(source,'owner.json'),'utf8'),bytes);
  assert.equal(fs.readFileSync(path.join(source,'competing.json'),'utf8'),'{}');
});
