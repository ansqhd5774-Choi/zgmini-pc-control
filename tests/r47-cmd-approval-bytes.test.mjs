import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../task-cmd-b/approval-intake.mjs';
import {validateR47CmdBManifest,R47_CMD_B} from '../task-cmd-b/r47-onefile-cas.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const relative='approvals/task-cmd-b/w03-r47-cmd-onefile-go-20261117.json';
test('approved manifest exact tracked Git bytes are platform EOL invariant',()=>{
 const raw=execFileSync('git',['-C',root,'cat-file','blob',
  'HEAD:'+relative],{shell:false,maxBuffer:16384});
 assert.equal(raw.length,946);
 assert.equal(digest(raw),
  '2b2f5a2f5884b3321f09ce85bb23e797143a2c996e20605afb61679e7f959df5');
 assert.equal(raw.toString('utf8').includes('\r'),false);
 const m=JSON.parse(raw.toString('utf8'));
 assert.equal(validateR47CmdBManifest(m),m);
 assert.equal(m.targetPath,R47_CMD_B.targetPath);
 assert.equal(m.sourceSha,'8970d2324e7a917dd0da0e7004e3fc8f8f2d1fae');
});
