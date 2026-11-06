// Real isolated Git simulation: no approved E: source, DB or Task touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('two-approved-overlay synthetic commit becomes clean and restores exact owner bytes',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-cf43-synthetic-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 function git(...args){
  const r=spawnSync('git',args,{cwd:dir,encoding:'utf8',
   env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'}});
  assert.equal(r.status,0,`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
 }
 git('init','-b','main');git('config','user.name','ZGMINI test');
 git('config','user.email','cf43-sim@localhost');
 const changes=['lib/release-calendar.mjs','scripts/pc-writer/release-calendar.mjs'];
 const r17=['lib/market-breadth/us-premarket-sip-r1.mjs',
  'scripts/pc-writer/us-breadth-provisional-cycle.mjs',
  'scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs'];
 for(const file of [...changes,...r17,'README.md']){
  const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,'baseline '+file+'\n');
 }
 git('add','--',...changes,...r17,'README.md');git('commit','-m','cf43 synthetic baseline');
 const base=git('rev-parse','HEAD');
 const priorR17=Object.fromEntries(r17.map(p=>[p,git('rev-parse',`HEAD:${p}`)]));
 for(const file of changes)fs.writeFileSync(path.join(dir,file),'approved '+file+'\n');
 fs.writeFileSync(path.join(dir,'README.md'),'user-owned docs, do not overwrite\n');
 git('switch','-c','calendar-cf43-b/pc-calendar-rollback-sim');
 git('add','--',...changes);
 assert.deepEqual(git('diff','--cached','--name-only').split('\n'),changes);
 git('commit','-m','approved two-file source commit');
 assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r','HEAD^','HEAD')
  .split('\n'),changes);
 assert.equal(git('diff','--name-only','HEAD','--','lib','scripts/pc-writer'),'');
 for(const file of r17)assert.equal(git('rev-parse',`HEAD:${file}`),priorR17[file]);
 const committed=git('rev-parse','HEAD');assert.notEqual(committed,base);
 git('switch','main');assert.equal(git('rev-parse','HEAD'),base);
 for(const file of changes)fs.writeFileSync(path.join(dir,file),'approved '+file+'\n');
 assert.equal(fs.readFileSync(path.join(dir,'README.md'),'utf8'),
  'user-owned docs, do not overwrite\n');
 assert.deepEqual(git('diff','--name-only').split('\n').sort(),
  ['README.md',...changes].sort());
});
