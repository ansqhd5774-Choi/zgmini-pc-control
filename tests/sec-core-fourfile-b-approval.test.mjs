import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateWriterBManifest} from '../writer-b/contract.mjs';

const MANIFEST='approvals/writer-updates/sec-core-compatible-fourfile-20261116.json';
const SPEC='approvals/writer-previews/sec-core-structural-insert-20261116.json';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const m=json(MANIFEST),spec=json(SPEC);
test('exact SEC Writer B approval manifest is valid under current contract',()=>{
 assert.equal(validateWriterBManifest(m),m);
 assert.equal(m.files.length,4);
 assert.equal(m.baseHead,'8254045340877b3f96e9fd9bae41b7a17d24cc8b');
 assert.equal(m.baseConfigSourceSha,m.baseHead);
 assert.equal(m.candidateSourceSha,'6c6d0a2bda90771646cb913a4fe226fcc6e47b5e');
});
test('Core A preview before/after hash and exact selectors are pinned without rewrite',()=>{
 const core=m.files[0];
 assert.equal(core.path,spec.filePath);
 assert.equal(core.beforeSha256,spec.beforeSha256);
 assert.equal(core.afterSha256,'82b3a5554d77986985ded9fb4ac9876554757b9699e09c15ac9ffbc08236a9f5');
 assert.deepEqual(core.insertions,spec.insertions);
 assert.equal(core.candidateSha256,'1cd0c12819ea5cb5b2d02d473c3009f35ad655bbecdb49eb872613c848bb5a72');
});
test('SEC requested module dependency closure is exactly three additions',()=>{
 const additional=m.files.slice(1);
 assert.deepEqual(additional.map(x=>x.path),[
  'scripts/pc-writer/sec-request-controls.mjs',
  'scripts/pc-writer/sec-guard-runtime-config.mjs',
  'scripts/pc-writer/sec-legacy-quota-bridge.mjs']);
 assert.ok(additional.every(x=>x.change==='A'&&x.beforeSha256===null));
 assert.ok(additional.every(x=>/^[a-f0-9]{64}$/.test(x.afterSha256)));
});
test('existing legacy quota file is protected, never replaced',()=>{
 assert.equal(m.files.some(x=>x.path==='scripts/pc-writer/quota-fetch.mjs'),false);
 assert.deepEqual(m.protectedFiles,[{path:'scripts/pc-writer/quota-fetch.mjs',
 sha256:'5ff750e1abf607e4a207bed16c20394406ca2ba8fe4ca42e2c514a155c87818b'}]);
});
test('PC Core task XML is attested and all provider/DB/Task writes disabled',()=>{
 assert.equal(m.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.deepEqual(m.runtimeDependencies.consumers,[]);
 for(const flag of ['allowProviderCalls','allowDbChanges','allowD1Writes',
 'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(m[flag],false);
});
test('source approval fails closed on an unauthorized fifth path',()=>{
 const changed=structuredClone(m);
 changed.files.push({...changed.files[1]});
 assert.throws(()=>validateWriterBManifest(changed),{code:'WRITER_B_FILE_DUPLICATE_STOP'});
});
test('pinned manifest is byte-immutable and source-only tests can identify drift',()=>{
 assert.equal(hash(fs.readFileSync(MANIFEST)),
  'a1a358dfdce6571770688a3a01376d7b235300161f131f4791752faa35032337');
});
