import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Isolated source-prep Git hook regression. This test never touches the
// operating Windows checkout, Controller, Writer, maintainer, or install lease.
test('#3409: worktree checkout can invoke a hook; an empty pinned hooksPath must not',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-3409-hook-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const repo=path.join(root,'repo'),empty=path.join(root,'empty-hooks');
 fs.mkdirSync(repo);fs.mkdirSync(empty);
 const env={...process.env,HOME:root,GIT_CONFIG_NOSYSTEM:'1',
  GIT_CONFIG_GLOBAL:path.join(root,'nonexistent-global-config'),
  GIT_TERMINAL_PROMPT:'0'};
 for(const key of ['GIT_CONFIG_COUNT','GIT_CONFIG_KEY_0','GIT_CONFIG_VALUE_0',
  'GIT_CONFIG_PARAMETERS','GIT_CONFIG','GIT_TEMPLATE_DIR'])delete env[key];
 const git=(args)=>execFileSync('git',args,{
  cwd:repo,env,windowsHide:true,timeout:15000,stdio:'pipe'});
 git(['init','-q']);git(['config','user.name','ZGMINI Test']);
 git(['config','user.email','test@example.invalid']);
 fs.writeFileSync(path.join(repo,'source.txt'),'fixture\n');
 git(['add','source.txt']);git(['commit','-qm','fixture']);
 const hooks=path.join(repo,'.git','hooks');
 fs.writeFileSync(path.join(hooks,'post-checkout'),
  '#!/bin/sh\nprintf triggered > hook-triggered.txt\n',{mode:0o755});
 fs.chmodSync(path.join(hooks,'post-checkout'),0o755);
 const unprotected=path.join(root,'unprotected');
 git(['worktree','add','--detach',unprotected,'HEAD']);
 assert.equal(fs.readFileSync(path.join(unprotected,'hook-triggered.txt'),'utf8'),'triggered');
 const protectedTree=path.join(root,'protected');
 git(['-c','core.hooksPath='+empty,'worktree','add','--detach',protectedTree,'HEAD']);
 assert.equal(fs.existsSync(path.join(protectedTree,'hook-triggered.txt')),false);
 assert.equal(fs.readFileSync(path.join(protectedTree,'source.txt'),'utf8'),'fixture\n');
});
