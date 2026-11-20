import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validateControllerImportClosure,controllerModuleSpecifiers,controllerImportScanRoots} from '../tools/maintenance-contract.mjs';

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

test('C2505 exact target has three unresolved runtime imports, not only the first observed failure',()=>{
 const target='0f1effad0c58e8b7bd684aa638521180183ca902';
 const previous='5e805bc907a4fb9e8d2fb2d53432bfec7b7cea59';
 const sourceMain='a464fad6834c6ef545bdb5ea8666d63209b1156d';
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
 const oldPaths=new Set(git('ls-tree','-r','--name-only',previous,'--','controller').split(/\r?\n/));
 const targetPaths=new Set(git('ls-tree','-r','--name-only',target,'--','controller').split(/\r?\n/));
 const targetOps=git('show',target+':controller/operations.mjs');
 const allImports=controllerModuleSpecifiers(targetOps).filter(s=>s.startsWith('./'))
  .map(s=>'controller/'+s.slice(2));
 const missing=[...new Set(allImports.filter(p=>!targetPaths.has(p)))].sort();
 const expected=[
  'controller/earnings-bea-mfg-archive-readonly.mjs',
  'controller/inflation-causal-saved-readonly.mjs',
  'controller/r54-runtime-binding-readonly.mjs',
 ];
 assert.deepEqual(missing,expected,'any omitted direct import requires an independently approved target fix');
 for(const p of expected){
  assert.equal(oldPaths.has(p),false,'previous installed tree must not be misrepresented');
  assert.doesNotThrow(()=>git('cat-file','-e',sourceMain+':'+p),
   'source-main presence does not imply the approved selective overlay installed it');
 }
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

test('operator-joined regex literals with quotes do not corrupt module scan',()=>{
 const sample="if(/[\\s\\\"'(]/.test(a)&&/[\\s\\\"')]/.test(b)){return import('./real.mjs');}";
 assert.deepEqual(controllerModuleSpecifiers(sample),['./real.mjs']);
});
test('historic R47 task module parses without false imports from regex literals',()=>{
 const target='f20004d4b784db1cc5e823bb3cde7b925aadcab3';
 const source=execFileSync('git',['show',target+':controller/theme-r47-task-action-readonly.mjs'],{
  encoding:'utf8',windowsHide:true});
 const modules=controllerModuleSpecifiers(source);
 assert.ok(modules.includes('./pc-source-readonly.mjs'));
 assert.ok(!modules.some(x=>x.includes('not-real')));
});

test('unchanged runtime roots must be checked in config-only and adapter-only overlays',()=>{
 const files=['controller/entry.mjs','controller/operations.mjs','controller/new-adapter.mjs'];
 const src={
  'controller/entry.mjs':'export const start=true;',
  'controller/operations.mjs':"import './r54-runtime-binding-readonly.mjs';",
  'controller/new-adapter.mjs':'export const safe=true;'
 };
 for(const changed of [['config/operations.json'],['controller/new-adapter.mjs']]){
  const roots=controllerImportScanRoots(changed);
  assert.ok(roots.includes('controller/entry.mjs'));
  assert.ok(roots.includes('controller/operations.mjs'));
  assert.throws(()=>validateControllerImportClosure(files,roots,p=>src[p]),
   /CONTROLLER_IMPORT_MISSING/);
 }
 const good={...src,'controller/operations.mjs':'export const ready=true;'};
 assert.equal(validateControllerImportClosure(files,controllerImportScanRoots(['config/operations.json']),
  p=>good[p]).status,'VERIFIED');
 assert.deepEqual(controllerImportScanRoots(['config/operations.json','controller/entry.mjs']),
  ['controller/entry.mjs','controller/operations.mjs']);
});
