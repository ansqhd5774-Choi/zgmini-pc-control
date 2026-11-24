import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeModuleReferences,verifyWriterBImportAvailability,
 safeWriterBImportDiagnostic,safeWriterBImportDiagnosticBatch} from './import-availability.mjs';
const B=s=>Buffer.from(s,'utf8');
const AUTO='scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs';
const PREVIEW='scripts/pc-writer/inflation-causal-public-preview-r1.mjs';
const WORKER='worker/inflation-causal-public-r1.mjs';
const CATALOG='lib/inflation-causal-public-catalog.mjs';
const auto=B("import {x} from './d1.mjs';\n"+
 "const p=await import('./inflation-causal-public-preview-r1.mjs');\n"+
 "const w=await import('../../worker/inflation-causal-public-r1.mjs');\n");
const preview=B("import {y}\n from '../../worker/inflation-causal-public-r1.mjs';\n");
const worker=B("import {z} from '../lib/inflation-causal-public-catalog.mjs';\n");
const catalog=B('export const items=Object.freeze([]);\n');
const existing=f=>f==='scripts/pc-writer/d1.mjs';

test('real 3-file-style hook refuses absent preview before any claim',()=>{
 const beforeClaim=new Map([[AUTO,auto]]);
 assert.throws(()=>verifyWriterBImportAvailability({
  afterFiles:beforeClaim,existing
 }),{code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP'});
});

test('approving preview alone does not hide missing transitive worker',()=>{
 const overlay=new Map([[AUTO,auto],[PREVIEW,preview]]);
 assert.throws(()=>verifyWriterBImportAvailability({afterFiles:overlay,existing}),
  {code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP'});
});

test('worker without catalog still fails, full approved closure passes',()=>{
 const three=new Map([[AUTO,auto],[PREVIEW,preview],[WORKER,worker]]);
 assert.throws(()=>verifyWriterBImportAvailability({afterFiles:three,existing}),
  {code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP'});
 const complete=new Map([...three,[CATALOG,catalog]]);
 const s=verifyWriterBImportAvailability({afterFiles:complete,existing});
 assert.equal(s.status,'PASS');
 assert.equal(s.evidenceLevel,'NEW_LITERAL_RELATIVE_IMPORTS_ONLY');
 assert.equal(s.approvedFiles,4);
 assert.equal(s.checkedReferences,5);
});

test('existing optional imports in modified M are not a new global gate',()=>{
 const file='scripts/pc-writer/run-local.mjs';
 const before=B("import './old-optional.mjs';\nexport const x=1;\n");
 const after=B("import './old-optional.mjs';\nexport const x=2;\n");
 const seen=[];
 const result=verifyWriterBImportAvailability({
  afterFiles:new Map([[file,after]]),
  beforeFiles:new Map([[file,before]]),
  existing:p=>{seen.push(p);return false;}
 });
 assert.equal(result.status,'PASS');
 assert.equal(result.checkedReferences,0);
 assert.deepEqual(seen,[]);
});

test('a newly introduced import in M requires approved overlay or existing PC file',()=>{
 const file='scripts/pc-writer/run-local.mjs';
 const before=B("export const x=1;\n");
 const after=B("export const x=1;\nconst a=import('./new-hook.mjs');\n");
 assert.throws(()=>verifyWriterBImportAvailability({
  afterFiles:new Map([[file,after]]),
  beforeFiles:new Map([[file,before]]),
  existing:()=>false
 }),{code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP'});
 assert.equal(verifyWriterBImportAvailability({
  afterFiles:new Map([[file,after],
   ['scripts/pc-writer/new-hook.mjs',B('export const ok=true;')]]),
  beforeFiles:new Map([[file,before]]),
  existing:()=>false
 }).status,'PASS');
});

test('test-only negative import fixtures do not block real runtime modules',()=>{
 const after=new Map([['lib/core.mjs',B("export const x=1;")],
  ['lib/core.test.mjs',B("import './intentionally-missing.mjs';")]]);
 assert.equal(verifyWriterBImportAvailability({afterFiles:after,
  existing:()=>false}).status,'PASS');
});

test('comments, fake string imports and interpolated templates do not add false Gate',()=>{
 const backtick=String.fromCharCode(96);
 const text="// import('./nonexistent.mjs')\n"+
  "/* import {a} from './nonexistent2.mjs' */\n"+
  'const prose="from '+ "'./nonexistent3.mjs'"+'";\n'+
  'const t=import('+backtick+'./computed.mjs'+backtick+');\n'+
  "import {something}\n from './actually-real.mjs';\n";
 const refs=relativeModuleReferences('lib/new-feature.mjs',B(text));
 assert.deepEqual(refs,['lib/actually-real.mjs']);
});

test('official G17 regexp with a literal quote does not create a syntax Gate',()=>{
 const source='if(/^\\s*"[A-Z0-9]+: /.test(line))break;\n'+
  'const row=line.match(/^\\s*"GMF"\\s+(\\d{4})\\s+(.+?)\\s*$/);\n'+
  "import './actual-collector.mjs';\n";
 assert.deepEqual(relativeModuleReferences('scripts/pc-writer/fed.mjs',B(source)),
  ['scripts/pc-writer/actual-collector.mjs']);
});

test('regexp quote, class and escaped slash cannot forge a relative import',()=>{
 const source="const fake=/import\\(['\\\"]\\.\\/ghost.mjs['\\\"]\\)/;\n"+
  "const another=/[\\\"']from ['\\\"]\\.\\/phantom.mjs/;\n"+
  "const slashes=/[\\/]/;\n"+
  "const matched=await import('./real.mjs');\n";
 assert.deepEqual(relativeModuleReferences('lib/probe.mjs',B(source)),
  ['lib/real.mjs']);
});

test('division remains a binary operator; missing real import still stops',()=>{
 const source='const average=12 / 3;\n'+
  'const value=(8 + 4) / 2;\n'+
  "const pattern=/api\\/v2/;\nimport './required.mjs';\n";
 const file='scripts/pc-writer/probe.mjs',buffer=B(source);
 assert.deepEqual(relativeModuleReferences(file,buffer),
  ['scripts/pc-writer/required.mjs']);
 assert.throws(()=>verifyWriterBImportAvailability({
  afterFiles:new Map([[file,buffer]]),existing:()=>false,
 }),{code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP'});
});

test('W05 QFR arrow-body regexp is not a false import syntax STOP',()=>{
 const source="console.log(lines.filter(line=>/^(MODE|SOURCE_GATES|ERROR|D1_RESULT|RESULT)=/.test(line)).join('\\n'));\n"+
  "const ratio=(a)=>a / 2;\n"+
  "import './required.mjs';\n";
 const file='scripts/pc-writer/EARNINGS_CENSUS_QFR_R4_D1_ONCE.mjs';
 assert.deepEqual(relativeModuleReferences(file,B(source)),['scripts/pc-writer/required.mjs']);
 assert.throws(()=>verifyWriterBImportAvailability({
  afterFiles:new Map([[file,B(source)]]),existing:()=>false,
 }),{code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP'});
 assert.equal(verifyWriterBImportAvailability({
  afterFiles:new Map([[file,B(source)]]),existing:()=>true,
 }).status,'PASS');
 assert.throws(()=>relativeModuleReferences(file,B("const bad=()=>/unterminated;\n")),
  {code:'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP'});
});

test('unterminated regex stays a strict source syntax STOP',()=>{
 assert.throws(()=>relativeModuleReferences('lib/probe.mjs',
  B("const bad=/[\\\"'];\nimport './real.mjs';\n")),
  {code:'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP'});
});

test('side-effect import and require both respect approved-root resolution',()=>{
 const refs=relativeModuleReferences('scripts/pc-writer/new.mjs',
  B("import './other.mjs';\nconst r=require('../../lib/item.json');\n"));
 assert.deepEqual(refs,['scripts/pc-writer/other.mjs','lib/item.json']);
});

test('existing Node TypeScript imports are allowed, never trigger an extra global Gate',()=>{
 const refs=relativeModuleReferences('scripts/pc-writer/run-local.mjs',
  B("const build=await import('../../worker/projection-builders.ts');\n"));
 assert.deepEqual(refs,['worker/projection-builders.ts']);
});

test('escape, unsupported extension and malformed source fail without evaluation',()=>{
 for(const spec of ['../../../../secret.mjs','./no-extension','./evil\\name.mjs']){
  assert.throws(()=>relativeModuleReferences('scripts/pc-writer/new.mjs',
   B("import('"+spec+"');\n")),
   {code:'WRITER_B_IMPORT_PATH_SCOPE_STOP'});
 }
 assert.throws(()=>relativeModuleReferences('lib/new.mjs',
  Buffer.from([0xff,0xfe,0xff])),
  {code:'WRITER_B_IMPORT_SOURCE_UTF8_STOP'});
});

test('existing callback never reads outside approved virtual source path',()=>{
 const touched=[];
 const approved=new Map([['lib/a.mjs',B("import './x.mjs';")]]);
 const a=verifyWriterBImportAvailability({afterFiles:approved,
  existing:p=>{touched.push(p);return p==='lib/x.mjs';}});
 assert.equal(a.status,'PASS');
 assert.deepEqual(touched,['lib/x.mjs']);
});

test('missing import identifies only approved relative paths and bounded reason',()=>{
 const source='scripts/pc-writer/new.mjs';
 const after=new Map([[source,B("import './needed.mjs';")]]);
 let latestFailure;
 for(const reason of ['NOT_FOUND','SYMLINK','NOT_FILE','SIZE',
  'OUTSIDE_ROOT','READ_ERROR','UNAVAILABLE_OR_UNSAFE']){
  let failure=null;
  try{verifyWriterBImportAvailability({afterFiles:after,
   existing:()=>({available:false,reason})});}
  catch(error){failure=error;}
  latestFailure=failure;
  assert.equal(failure?.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
  assert.deepEqual(safeWriterBImportDiagnostic(failure),{
   sourceKind:'APPROVED_AFTER',sourcePath:source,
   dependencyPath:'scripts/pc-writer/needed.mjs',reason});
  assert.equal(Object.keys(failure.diagnostic).length,4);
 }
 const bad={code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',diagnostic:{
  sourceKind:'APPROVED_AFTER',sourcePath:source,
  dependencyPath:'../../sensitive.txt',reason:'NOT_FOUND',secret:'DO_NOT_LOG'}};
 assert.equal(safeWriterBImportDiagnostic(bad),null);
 assert.equal(safeWriterBImportDiagnostic({code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',
  diagnostic:{...bad.diagnostic,dependencyPath:'scripts/pc-writer/needed.mjs',
   reason:'SYSTEM_TOKEN_EXPOSED'}}),null);
 assert.equal(safeWriterBImportDiagnostic({code:'WRITER_B_OTHER_STOP',
  diagnostic:latestFailure.diagnostic}),null);
});

test('legacy false existence check remains fail-closed and gives cautious reason',()=>{
 let error;
 try{verifyWriterBImportAvailability({
  afterFiles:new Map([['lib/new.mjs',B("import './missing.mjs';")]]),
  existing:()=>false});}catch(e){error=e;}
 assert.equal(error?.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
 assert.equal(safeWriterBImportDiagnostic(error)?.reason,'UNAVAILABLE_OR_UNSAFE');
});

test('one approved overlay reports all missing new literal imports in one STOP',()=>{
 const seen=[];
 const afterFiles=new Map([
  ['worker/new-r6.mjs',B("import '../lib/one.mjs';\nimport '../lib/two.mjs';\n")],
  ['scripts/pc-writer/new-r6.mjs',B("import '../../lib/three.mjs';\n")],
 ]);
 let failure;
 try{verifyWriterBImportAvailability({afterFiles,existing:ref=>{
  seen.push(ref);
  return {available:false,reason:ref.endsWith('two.mjs')?'SYMLINK':'NOT_FOUND'};
 }});}catch(error){failure=error;}
 assert.equal(failure?.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
 assert.deepEqual(seen,['lib/one.mjs','lib/two.mjs','lib/three.mjs']);
 assert.deepEqual(failure.diagnostic,{
  sourceKind:'APPROVED_AFTER',sourcePath:'worker/new-r6.mjs',
  dependencyPath:'lib/one.mjs',reason:'NOT_FOUND'});
 const batch=safeWriterBImportDiagnosticBatch(failure);
 assert.equal(batch.diagnostics.length,3);
 assert.deepEqual(batch.diagnostics.map(x=>x.dependencyPath),seen);
 assert.deepEqual(batch.diagnostics.map(x=>x.reason),
  ['NOT_FOUND','SYMLINK','NOT_FOUND']);
 assert.equal(batch.diagnosticsOmitted,0);
});

test('large approved import set stays bounded at eight and counts omitted',()=>{
 const source='lib/new-batch.mjs';
 const text=Array.from({length:13},(_,i)=>`import './dep-${i}.mjs';`).join('\n');
 let failure;
 try{verifyWriterBImportAvailability({
  afterFiles:new Map([[source,B(text)]]),existing:()=>false,
 });}catch(error){failure=error;}
 assert.equal(failure.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
 const batch=safeWriterBImportDiagnosticBatch(failure);
 assert.equal(batch.diagnostics.length,8);
 assert.equal(batch.diagnosticsOmitted,5);
 assert.equal(batch.diagnostics[0].dependencyPath,'lib/dep-0.mjs');
 assert.equal(batch.diagnostics[7].dependencyPath,'lib/dep-7.mjs');
 assert.equal(JSON.stringify(failure).length<8192,true);
});

test('eight maximum-length safe paths fit existing eight-KiB reporter budget',()=>{
 const source=`worker/${'s'.repeat(160)}.mjs`;
 const after=Array.from({length:9},(_,i)=>
  `import './${String(i)}${'d'.repeat(159)}.mjs';`).join('\n');
 let failure;
 try{verifyWriterBImportAvailability({
  afterFiles:new Map([[source,B(after)]]),existing:()=>false,
 });}catch(error){failure=error;}
 assert.equal(failure.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
 const batch=safeWriterBImportDiagnosticBatch(failure);
 assert.equal(batch.diagnostics.length,8);
 assert.equal(batch.diagnosticsOmitted,1);
 assert.equal(JSON.stringify(failure).length<=8192,true);
});

test('M old imports remain exempt while two newly added problems aggregate',()=>{
 const file='scripts/pc-writer/run-local.mjs';
 const old=B("import './optional-old.mjs';\n");
 const after=B("import './optional-old.mjs';\n"+
  "import './new-a.mjs';\nimport './new-b.mjs';\n");
 let failure;const seen=[];
 try{verifyWriterBImportAvailability({
  afterFiles:new Map([[file,after]]),beforeFiles:new Map([[file,old]]),
  existing:ref=>{seen.push(ref);if(ref.endsWith('new-b.mjs'))throw Error('SECRET');
   return {available:false,reason:'SIZE'};},
 });}catch(error){failure=error;}
 assert.deepEqual(seen,['scripts/pc-writer/new-a.mjs',
  'scripts/pc-writer/new-b.mjs']);
 assert.deepEqual(safeWriterBImportDiagnosticBatch(failure).diagnostics
  .map(x=>x.reason),['SIZE','READ_ERROR']);
 assert.equal(JSON.stringify(failure).includes('SECRET'),false);
});

test('malformed batched details never expose paths or arbitrary reasons',()=>{
 const valid={sourceKind:'APPROVED_AFTER',sourcePath:'lib/new.mjs',
  dependencyPath:'lib/one.mjs',reason:'NOT_FOUND'};
 const other={...valid,dependencyPath:'lib/two.mjs',reason:'READ_ERROR'};
 const base={code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',
  diagnostic:valid,diagnostics:[valid,other],diagnosticsOmitted:0};
 assert.equal(safeWriterBImportDiagnosticBatch(base).diagnostics.length,2);
 for(const bad of [
  {...base,diagnostics:[valid,{...other,dependencyPath:'../../private.txt'}]},
  {...base,diagnostics:[valid,{...other,reason:'SECRET'}]},
  {...base,diagnostics:[other,valid]},
  {...base,diagnosticsOmitted:-1},
  {...base,diagnosticsOmitted:1025},
  {...base,diagnostics:Array.from({length:9},()=>valid)},
 ])assert.equal(safeWriterBImportDiagnosticBatch(bad),null);
 assert.equal(safeWriterBImportDiagnosticBatch({code:base.code,
  diagnostic:valid}),null); // Old Writer B results remain single-only.
});
