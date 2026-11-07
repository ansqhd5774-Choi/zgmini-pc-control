import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeModuleReferences,verifyWriterBImportAvailability}
 from './import-availability.mjs';
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
 assert.equal(s.evidenceLevel,'LITERAL_RELATIVE_IMPORTS_ONLY');
 assert.equal(s.approvedFiles,4);
 assert.equal(s.checkedReferences,5);
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
 for(const spec of ['../../../../secret.mjs','./image.png','./evil\\name.mjs']){
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
