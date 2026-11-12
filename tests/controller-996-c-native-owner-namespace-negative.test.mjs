// Exact native candidate negative proof: only the separate queue-PC TEMP tree.
// It intentionally creates a competing JSON in a synthetic fixture and MUST
// stop before SetFileInformationByHandle. Never call the production C operator.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build996OwnerArchiveFixtureScript} from '../tools/controller-996-c-native-owner-operator.mjs';

const hostAllowed = process.platform==='win32' &&
  process.env.GITHUB_ACTIONS==='true' &&
  process.env.COMPUTERNAME==='DESKTOP-N62L0NG' &&
  process.env.RUNNER_NAME==='zgmini-handoff-ci-spare-01' &&
  !fs.existsSync('E:/ZGmini');

test('native TEMP fixture demonstrates insertion can race pinned file handles without any move', {
  skip: !hostAllowed && 'Only on the existing isolated handoff Windows runner',
}, () => {
  const tmp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(tmp).root.toLowerCase(),'c:\\');
  const dir=fs.mkdtempSync(path.join(tmp,'zgmini-996-handle-fixture-'));
  const src=path.join(dir,'source');
  const dst=path.join(dir,'would-have-moved');
  assert.equal(path.dirname(dir).toLowerCase(),tmp.toLowerCase());
  const nonce=randomUUID();
  const bytes=Buffer.from(JSON.stringify({pid:process.pid,nonce})+'\n');
  try {
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src,'owner.json'),bytes,{flag:'wx'});
    const powershell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
    assert.equal(fs.existsSync(powershell),true);
    const input={operation:'move',root:dir,source:src,destination:dst,
      pins:{'owner.json':createHash('sha256').update(bytes).digest('hex')},
      ownerMode:'LIVE_NEW',actorPid:process.pid,nonce,simulateNamespaceInsert:true};
    // Fixture=true is fixed in the generated C# and prevents production roots.
    const script=build996OwnerArchiveFixtureScript();
    assert.match(script,/static readonly bool Fixture = true;/);
    assert.match(script,/C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED/);
    assert.match(script,/Need\(Fixture,"C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN"\);/);
    const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',script],{
      input:JSON.stringify(input),encoding:'utf8',windowsHide:true,timeout:25000,
      maxBuffer:100000,
    });
    assert.equal(result.error,undefined,result.error?.message);
    assert.equal(result.status,0,
      'Native fixture unavailable: '+String(result.stderr).slice(-1500));
    const report=JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
    assert.equal(report.ok,false);
    assert.equal(report.code,'C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED');
    assert.equal(report.moveOccurred,false);
    assert.deepEqual(fs.readFileSync(path.join(src,'owner.json')),bytes);
    assert.equal(fs.readFileSync(path.join(src,'competing.json'),'utf8'),'{}');
    assert.equal(fs.existsSync(dst),false);
  } finally {
    // Only remove the unique TEMP fixture created by this test.
    assert.ok(path.basename(dir).startsWith('zgmini-996-handle-fixture-'));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
