import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {manifestFingerprint} from '../tools/maintenance-contract.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const cwd=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const installed='b9099839df1a7cc6b3b166a139f7fac6938ada66';
const target='310d777f06e51448bf0d863f52a21a1af2c086fc';
const mainPin='4311757ce617cf6cab20683c933668bd0aa594c3';
const paths=[
 'config/operations.json',
 'controller/common.mjs',
 'controller/employment-r6-candidate-readonly.mjs',
 'controller/inflation-a401-private23-readonly.mjs',
 'controller/inflation-a407-integrity-readonly.mjs',
 'controller/inflation19-runtime-readonly.mjs',
 'controller/operations.mjs',
];
const custom=['config/operations.json','controller/operations.mjs'];
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true}).trimEnd();
const show=(sha,rel)=>git('show',sha+':'+rel);

test('target Controller has exactly one installed parent and exactly seven changed files',()=>{
 assert.equal(git('rev-list','--parents','-n','1',target),target+' '+installed);
 assert.deepEqual(git('diff','--name-only',installed,target,'--').split(/\r?\n/),paths);
 const names=git('ls-tree','-r','--name-only',target,'--','controller','config').split(/\r?\n/);
 const oldNames=git('ls-tree','-r','--name-only',installed,'--','controller','config').split(/\r?\n/);
 assert.deepEqual(names.filter(x=>!oldNames.includes(x)),['controller/inflation-a407-integrity-readonly.mjs']);
 assert.deepEqual(oldNames.filter(x=>!names.includes(x)),[]);
});

test('five noncustom paths retain exact reviewed main source bytes, no additional main modules',()=>{
 for(const rel of paths.filter(x=>!custom.includes(x)))
  assert.equal(show(target,rel),show(mainPin,rel),rel);
 const present=git('ls-tree','-r','--name-only',target,'--','controller').split(/\r?\n/);
 for(const rel of ['controller/r54-runtime-binding-readonly.mjs',
  'controller/inflation-causal-saved-readonly.mjs',
  'controller/earnings-bea-mfg-archive-readonly.mjs'])
  assert.ok(!present.includes(rel),rel);
});

test('operations add only W01 A407 import and dispatch to installed source',()=>{
 const before=show(installed,'controller/operations.mjs');
 const after=show(target,'controller/operations.mjs');
 const additionImport="\n import {inspectA407IntegrityReadonly} from './inflation-a407-integrity-readonly.mjs';";
 const additionDispatch="\n if(request.operation==='inflation-a407-integrity-readonly')return inspectA407IntegrityReadonly(request,context);";
 assert.ok(after.includes(additionImport));
 assert.ok(after.includes(additionDispatch));
 assert.equal(after.replace(additionImport,'').replace(additionDispatch,''),before);
});

test('config adds only approved A407 readonly operation and never modifies protected policy',()=>{
 const a=JSON.parse(show(installed,'config/operations.json'));
 const b=JSON.parse(show(target,'config/operations.json'));
 assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort());
 for(const key of Object.keys(a).filter(x=>x!=='operations'))
  assert.deepEqual(b[key],a[key]);
 const added=Object.keys(b.operations).filter(x=>!Object.hasOwn(a.operations,x));
 assert.deepEqual(added,['inflation-a407-integrity-readonly']);
 for(const [key,definition] of Object.entries(a.operations))
  assert.deepEqual(b.operations[key],definition);
 assert.deepEqual(b.operations['inflation-a407-integrity-readonly'],
  {grade:'A',timeoutSeconds:60,resource:'light'});
});

test('new and changed module imports resolve within exact installed Controller source tree',()=>{
 const names=new Set(git('ls-tree','-r','--name-only',target,'--').split(/\r?\n/));
 for(const rel of paths.filter(p=>p.endsWith('.mjs'))){
  const source=show(target,rel);
  const imports=[...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
    .map(m=>m[1]).filter(x=>x.startsWith('.'));
  for(const imp of imports){
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),imp));
   assert.ok(names.has(resolved),rel+' imports missing '+resolved);
  }
 }
 assert.match(show(target,'controller/common.mjs'),/pit04Offset/);
 assert.match(show(target,'controller/employment-r6-candidate-readonly.mjs'),/pit04Offset/);
 assert.match(show(target,'controller/inflation-a401-private23-readonly.mjs'),/export const A407_ENTRY=/);
});

test('seven actual target SHA256 bytes match the exact approval-manifest fingerprint',t=>{
 const allowFiles=paths.map(rel=>({
  path:rel,
  sha256:createHash('sha256').update(
   execFileSync('git',['show',target+':'+rel],{cwd,encoding:null,windowsHide:true})
  ).digest('hex')
 }));
 const pin=manifestFingerprint(allowFiles);
 assert.deepEqual(pin.files,allowFiles);
 assert.match(pin.sha256,/^[a-f0-9]{64}$/);
 t.diagnostic('SELECTIVE_ALLOW_FILES='+JSON.stringify(allowFiles));
 t.diagnostic('SELECTIVE_MANIFEST_SHA256='+pin.sha256);
});
