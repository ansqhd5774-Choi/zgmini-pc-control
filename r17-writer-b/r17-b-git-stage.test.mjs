import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,realpathSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {commitExactOverlay} from './r17-b-git-stage.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const REF='refs/heads/r17-writer-b/pc-r17-550e8400-e29b-41d4-a716-446655440000';
const g=(dir,...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();
const raw=(dir,args,{stdin,env}={})=>execFileSync('git',['-C',dir,...args],{
  input:stdin,env:{...process.env,...env},encoding:null,
});
function fixture(){
  const dir=mkdtempSync(path.join(os.tmpdir(),'r17-git-test-'));
  const baseRepo=path.join(dir,'source');const scratch=path.join(dir,'stage');
  mkdirSync(baseRepo);mkdirSync(scratch);
  g(baseRepo,'init','-q');g(baseRepo,'config','user.name','Unit');
  g(baseRepo,'config','user.email','unit@example.invalid');
  writeFileSync(path.join(baseRepo,'old.txt'),'before\n');
  g(baseRepo,'add','old.txt');g(baseRepo,'commit','-q','-m','base');
  const base=g(baseRepo,'rev-parse','HEAD');
  const baseBefore=readFileSync(path.join(baseRepo,'old.txt'));
  g(scratch,'init','-q');
  const objectPath=realpathSync(path.join(baseRepo,'.git','objects'));
  writeFileSync(path.join(scratch,'.git','objects','info','alternates'),objectPath+'\n');
  g(scratch,'read-tree',base);
  return {baseRepo,scratch,base,baseBefore};
}
test('isolated Git stage materializes a child commit with precisely 1 modified + 1 added file',()=>{
  const f=fixture();const old=Buffer.from('after\n');const added=Buffer.from('new\n');
  const expectedSha256={'old.txt':hash(old),'new.txt':hash(added)};
  const overlay=new Map([['old.txt',old],['new.txt',added]]);
  const result=commitExactOverlay({stage:f.scratch,base:f.base,overlay,expectedSha256,
    expectedDiff:[{status:'M',path:'old.txt'},{status:'A',path:'new.txt'}],
    requestRef:REF,run:g,runRaw:raw});
  assert.notEqual(result.sha,f.base);
  assert.deepEqual(result.diff,[{status:'A',path:'new.txt'},{status:'M',path:'old.txt'}]);
  assert.equal(g(f.scratch,'rev-parse',REF),result.sha);
  assert.equal(result.sourceRef,REF);
  assert.equal(g(f.scratch,'cat-file','-t',REF),'commit');
  g(f.baseRepo,'fetch','--no-tags','--no-write-fetch-head',f.scratch,`${REF}:${REF}`);
  assert.equal(g(f.baseRepo,'rev-parse',REF),result.sha);
  assert.equal(g(f.baseRepo,'rev-parse','HEAD'),f.base);
  assert.deepEqual(readFileSync(path.join(f.baseRepo,'old.txt')),f.baseBefore);
});

test('wrong content/hash aborts before writing Git commit, leaves live base unchanged',()=>{
  const f=fixture();const bad=Buffer.from('wrong\n');
  assert.throws(()=>commitExactOverlay({stage:f.scratch,base:f.base,
    overlay:new Map([['old.txt',bad]]),expectedSha256:{'old.txt':hash('expected\n')},
    expectedDiff:[{status:'M',path:'old.txt'}],requestRef:REF,run:g,runRaw:raw}),
    /R17_B_OVERLAY_HASH_STOP/);
  assert.equal(g(f.baseRepo,'rev-parse','HEAD'),f.base);
});

test('injected commit-tree failure never modifies source HEAD or worktree',()=>{
  const f=fixture();const after=Buffer.from('after\n');
  const broken=(dir,args,opts)=>{
    if(args[0]==='commit-tree')throw new Error('simulated Git commit failure');
    return raw(dir,args,opts);
  };
  assert.throws(()=>commitExactOverlay({stage:f.scratch,base:f.base,
    overlay:new Map([['old.txt',after]]),expectedSha256:{'old.txt':hash(after)},
    expectedDiff:[{status:'M',path:'old.txt'}],requestRef:REF,run:g,runRaw:broken}),
    /simulated Git commit failure/);
  assert.equal(g(f.baseRepo,'rev-parse','HEAD'),f.base);
  assert.deepEqual(readFileSync(path.join(f.baseRepo,'old.txt')),f.baseBefore);
});
