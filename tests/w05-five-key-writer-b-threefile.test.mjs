import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateWriterBManifest,isScopedWriterPath} from '../writer-b/contract.mjs';

const manifestPath='../approvals/writer-updates/w05-five-key-audit-threefile-20261124.json';
const bytes=readFileSync(new URL(manifestPath,import.meta.url));
const manifest=JSON.parse(bytes);
const hash=x=>createHash('sha256').update(x).digest('hex');
const expectedPaths=[
 'lib/w05-audit/compare-five-public-readbacks-r1.mjs',
 'lib/w05-audit/five-key-inplace-readback-prework-r12.mjs',
 'lib/w05-audit/five-key-public-api-reader-r1.mjs',
];
const expectedHash=[
 'cac1611e66c552152909dae0962e953aaa50b473975a55f916f4e364ed7a634f',
 '63db7e32a2ff6bea20931a58e8aa31d88e642a76e264bb07cb1befa935dd7e6a',
 '5bf4403527658647cf07244fb8c2e45e347a7d58c20cea185e1ef781a28b818f'
];
test('W05 shared Writer B accepts exactly three new canonical libs and the real Writer CAS',()=>{
 assert.doesNotThrow(()=>validateWriterBManifest(manifest));
 assert.equal(manifest.schema,'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1');
 assert.equal(manifest.sourceRepository,'ansqhd5774-Choi/zgmini');
 assert.equal(manifest.sourceBranch,'main');
 assert.equal(manifest.candidateSourceSha,'a0735cac4a4dc56f0da0d3d0f82a93fd5b4486c7');
 assert.equal(manifest.baseHead,'24077edc2fb4196e83ba202fdd9681b1fe841447');
 assert.equal(manifest.baseConfigSourceSha,manifest.baseHead);
 assert.deepEqual(manifest.files.map(f=>f.path),expectedPaths);
 assert.deepEqual(manifest.files.map(f=>f.afterSha256),expectedHash);
 assert.ok(manifest.files.every(f=>f.change==='A'&&f.beforeSha256===null&&isScopedWriterPath(f.path)));
 assert.equal(manifest.sourceRoot,'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release');
 assert.equal(manifest.configPath,'E:\\ZGmini\\data\\pc-writer\\config.json');
 assert.equal(manifest.coreTask,'ZGMINI-PC-Local-Core');
 assert.equal(manifest.runCount,1);
 assert.deepEqual(manifest.runtimeDependencies,{taskXmlSha256:null,consumers:[]});
 for(const prop of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[prop],false);
});
test('W05 B preserves the 12 original protected dependencies including all three D1 clients',()=>{
 assert.equal(manifest.protectedFiles.length,12);
 assert.equal(new Set(manifest.protectedFiles.map(f=>f.path.toLowerCase())).size,12);
 assert.equal(manifest.protectedFiles.every(f=>isScopedWriterPath(f.path)&&
  /^[a-f0-9]{64}$/.test(f.sha256)),true);
 assert.deepEqual(manifest.protectedFiles.slice(-3).map(f=>f.path),[
  'scripts/pc-writer/d1.mjs','scripts/pc-writer/d1-transient.mjs',
  'scripts/pc-writer/d1-diagnostics.mjs']);
 assert.ok(manifest.protectedFiles.every(f=>!expectedPaths.includes(f.path)));
 assert.equal(manifest.protectedFiles.find(x=>x.path==='scripts/pc-writer/d1.mjs').sha256,
  '10beefecc524b569eba9abf826036fc8e069b4b6f0c3b3340a7bd6a5ab6353a5');
});
test('W05 B rejects path escape, extra writer mutations and historical source drift',()=>{
 const change=fn=>{const x=structuredClone(manifest);fn(x);return x;};
 for(const bad of [
  change(x=>{x.files[0].path='scripts/api-site/compare-five-public-readbacks-r1.mjs';}),
  change(x=>{x.files.push({path:'scripts/pc-writer/run-local.mjs',change:'A',
   beforeSha256:null,afterSha256:'f'.repeat(64)});}),
  change(x=>{x.baseConfigSourceSha='a'.repeat(40);}),
  change(x=>{x.allowOtherSourceChanges=true;}),
  change(x=>{x.runtimeDependencies.consumers=[{}];}),
 ])assert.throws(()=>validateWriterBManifest(bad));
});
test('W05 B manifest has no credentials, URLs, raw values or operational directives',()=>{
 assert.ok(bytes.length>200&&bytes.length<65_536);
 assert.equal(hash(bytes).length,64);
 assert.doesNotMatch(bytes.toString('utf8'),/https?:\/\/|authorization|password|secret|token|PRIVATE_/i);
 assert.deepEqual(Object.keys(manifest.files[0]),['path','change','beforeSha256','afterSha256']);
});
