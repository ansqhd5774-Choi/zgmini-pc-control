import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validateControllerImportClosure,controllerModuleSpecifiers} from '../tools/maintenance-contract.mjs';

test('valid local import graph including transitive paths',()=>{
 const sources={
  'controller/operations.mjs':"import {x} from './helper.mjs';",
  'controller/helper.mjs':"export {x} from './leaf.mjs';",
  'controller/leaf.mjs':'export const x=1;',
 };
 assert.deepEqual(validateControllerImportClosure(Object.keys(sources),
  ['controller/operations.mjs'],name=>sources[name]),
  {status:'VERIFIED',checkedModules:3});
});
test('missing direct and transitive imports are rejected before installation',()=>{
 const sources={
  'controller/operations.mjs':"import './helper.mjs';",
  'controller/helper.mjs':"export {x} from './missing.mjs';",
 };
 assert.throws(()=>validateControllerImportClosure(Object.keys(sources),
  ['controller/operations.mjs'],name=>sources[name]),/CONTROLLER_IMPORT_MISSING/);
 assert.throws(()=>validateControllerImportClosure(
  ['controller/operations.mjs'],['controller/operations.mjs'],
  ()=>"import './r54-runtime-binding-readonly.mjs';"),/CONTROLLER_IMPORT_MISSING/);
});
test('literal dynamic imports are checked, external packages ignored',()=>{
 const files=['controller/entry.mjs','controller/read.mjs'];
 const read=p=>p.endsWith('entry.mjs')?
  "import fs from 'node:fs'; const x=import('./read.mjs');":
  "export const good=true;";
 assert.equal(validateControllerImportClosure(files,['controller/entry.mjs'],read).checkedModules,2);
});
test('W04 PIT-08-01 bad selective target 0f1effad is blocked (historical regression)',()=>{
 const target='0f1effad0c58e8b7bd684aa638521180183ca902';
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
 // Exact immutable approved target, not current main, is the acceptance unit.
 const files=git('ls-tree','-r','--name-only',target,'--','controller','config').split(/\r?\n/);
 assert.throws(()=>validateControllerImportClosure(files,['controller/operations.mjs'],
  rel=>git('show',target+':'+rel)),/CONTROLLER_IMPORT_MISSING/);
});

test('patch text, comments and regex literals cannot invent module imports',()=>{
 const backtick=String.fromCharCode(96);
 const text=[
  'import {real} from "./real.mjs";',
  '/* import "./not-real-comment.mjs"; */',
  '// export {x} from "./not-real-line.mjs";',
  "const patch=\"diff --git ... await import('./not-real-quoted.mjs')\";",
  "const regex=/from '.\\/not-real-regex.mjs'/;",
  'const template='+backtick+'import("./not-real-template.mjs")'+backtick+';',
 ].join('\n');
 assert.deepEqual(controllerModuleSpecifiers(text),['./real.mjs']);
 assert.equal(validateControllerImportClosure(['controller/operations.mjs','controller/real.mjs'],
  ['controller/operations.mjs'],p=>p.endsWith('operations.mjs')?text:'export const real=1;').status,'VERIFIED');
});
test('genuine re-exports, bare imports and literal import calls still fail closed',()=>{
 const cases=[
  "export {X} from './missing.mjs';",
  "import './missing.mjs';",
  "await import('./missing.mjs');",
 ];
 for(const source of cases)
  assert.throws(()=>validateControllerImportClosure(['controller/operations.mjs'],
   ['controller/operations.mjs'],()=>source),/CONTROLLER_IMPORT_MISSING/);
});
