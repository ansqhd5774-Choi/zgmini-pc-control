import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {inspectR6BCheckoutFixture,inspectR6BCheckoutOnWindows} from './trusted-windows-git-inspector.mjs';

const git=(root,...args)=>execFileSync('git',['-C',root,...args],
  {encoding:'utf8',windowsHide:true,shell:false,timeout:15000});
function fixture(run) {
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-git-checkout-'));
  try {
    const control=path.join(workspace,'r6-control');
    const source=path.join(workspace,'r6-source');
    for(const root of [control,source]) {
      fs.mkdirSync(root);
      git(root,'init','-q');
      fs.writeFileSync(path.join(root,'contents.txt'),root.endsWith('control')?'control':'source');
      git(root,'add','contents.txt');
      git(root,'-c','user.name=ZGMINI Fixture',
        '-c','user.email=fixture@example.invalid','commit','-q','-m','test only');
    }
    const inspect=(role,root,{execGit=execFileSync,env=process.env}={})=>
      inspectR6BCheckoutFixture({workspace,role,root,execGit,env,platform:process.platform});
    return run({workspace,control,source,inspect});
  } finally {fs.rmSync(workspace,{recursive:true,force:true});}
}

test('fixed control and source checkouts return their own clean Git HEADs',()=>fixture(({control,source,inspect})=>{
  const h=inspect('control',control);
  const s=inspect('source',source);
  assert.match(h.head,/^[a-f0-9]{40}$/);
  assert.match(s.head,/^[a-f0-9]{40}$/);
  assert.equal(h.head,git(control,'rev-parse','HEAD').trim());
  assert.equal(s.head,git(source,'rev-parse','HEAD').trim());
  assert.equal(h.dirty,false);
  assert.equal(s.dirty,false);
  assert.notEqual(h.head,s.head);
}));

test('wrong role or swapped roots stop before Git invocation',()=>fixture(({control,source,inspect})=>{
  let called=0;
  const execGit=()=>{called++;throw Error('must not run');};
  assert.throws(()=>inspect('unexpected',control,{execGit}),
    {code:'R6_B_GIT_ROLE_NOT_APPROVED'});
  assert.throws(()=>inspect('control',source,{execGit}),
    {code:'R6_B_GIT_CHECKOUT_PATH_NOT_APPROVED'});
  assert.equal(called,0);
}));

test('tracked and untracked changes both show dirty, no index.lock generated',()=>fixture(({control,inspect})=>{
  fs.appendFileSync(path.join(control,'contents.txt'),'\nmodified');
  assert.equal(inspect('control',control).dirty,true);
  git(control,'restore','contents.txt');
  fs.writeFileSync(path.join(control,'untracked.txt'),'new');
  assert.equal(inspect('control',control).dirty,true);
  assert.equal(fs.existsSync(path.join(control,'.git','index.lock')),false);
}));

test('caller-provided GIT_DIR/GIT_WORK_TREE and GIT_CONFIG_COUNT cannot change inspected repo',()=>fixture(({control,source,inspect})=>{
  const polluted={...process.env,GIT_DIR:path.join(source,'.git'),
    GIT_WORK_TREE:source,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.fsmonitor',
    GIT_CONFIG_VALUE_0:'echo malicious'};
  const expected=git(control,'rev-parse','HEAD').trim();
  const inspected=inspect('control',control,{env:polluted});
  assert.equal(inspected.head,expected);
  assert.equal(inspected.dirty,false);
}));

test('junction or symlink checkout root is denied before Git inspection',()=>fixture(({workspace,control,inspect})=>{
  const moved=path.join(workspace,'control-original');
  fs.renameSync(control,moved);
  fs.symlinkSync(moved,control,'dir');
  assert.throws(()=>inspect('control',control),
    {code:'R6_B_GIT_JUNCTION_OR_SYMLINK_STOP'});
}));

test('symlink ancestor of workspace is denied even if checkout itself exists',()=>fixture(({workspace,control,inspect})=>{
  const alias=path.join(path.dirname(workspace),'r6-git-alias-'+path.basename(workspace));
  fs.symlinkSync(workspace,alias,'dir');
  try {
    const candidate=path.join(alias,'r6-control');
    assert.throws(()=>inspectR6BCheckoutFixture({workspace:alias,
      role:'control',root:candidate}),{code:'R6_B_GIT_JUNCTION_OR_SYMLINK_STOP'});
  }finally{fs.unlinkSync(alias);}
  assert.equal(inspect('control',control).dirty,false);
}));

test('external Git directory symlink is denied before command execution',()=>fixture(({workspace,source,inspect})=>{
  const alternate=path.join(workspace,'alternate-git');
  fs.renameSync(path.join(source,'.git'),alternate);
  fs.symlinkSync(alternate,path.join(source,'.git'),'dir');
  assert.throws(()=>inspect('source',source),{code:'R6_B_GIT_GIT_DIRECTORY_SHAPE_STOP'});
}));

test('Git result for different top-level root cannot pass even with a plausible HEAD',()=>fixture(({control,source,inspect})=>{
  const replacement=(bin,args,opts)=>{
    if(args.includes('--show-toplevel'))return source;
    return execFileSync(bin,args,opts);
  };
  assert.throws(()=>inspect('control',control,{execGit:replacement}),
    {code:'R6_B_GIT_GIT_TOPLEVEL_MISMATCH'});
}));

test('read-only Git CLI is fixed, shell-free, and contains no Issue-derived arguments',()=>fixture(({control,inspect})=>{
  const calls=[];
  const spy=(bin,args,opts)=>{
    calls.push({bin,args,opts});
    return execFileSync(bin,args,opts);
  };
  inspect('control',control,{execGit:spy});
  assert.equal(calls.length,4);
  assert(calls.every(c=>c.bin==='git'&&c.opts.shell===false&&
    c.args.includes('--no-optional-locks')&&c.args.includes('-C')&&
    c.opts.env.GIT_OPTIONAL_LOCKS==='0'&&c.opts.env.GIT_DIR===undefined));
  assert(calls.every(c=>!c.args.includes('fetch')&&!c.args.includes('checkout')&&
    !c.args.includes('reset')&&!c.args.includes('commit')));
}));

test('production entry refuses Linux before any filesystem or Git probes',()=>{
  if(process.platform==='win32')return;
  assert.throws(()=>inspectR6BCheckoutOnWindows({role:'control',root:'/tmp/arbitrary'}),
    {code:'R6_B_GIT_WINDOWS_ONLY_STOP'});
});
