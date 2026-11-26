import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {validateWriterBManifest} from '../writer-b/contract.mjs';

const root=path.join(import.meta.dirname,'..');
const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
const approval='approvals/writer-updates/w06-cnn-minute-ninefile-20261126.json';
const paths=[
 'lib/cnn-observed-history-r1.mjs',
 'scripts/pc-writer/cnn-observed-archive-publication-r1.mjs',
 'scripts/pc-writer/collect-local.mjs',
 'scripts/pc-writer/collection-publication-policy.mjs',
 'scripts/pc-writer/local-cycle.mjs',
 'scripts/pc-writer/quota-ledger.mjs',
 'scripts/pc-writer/run-local.mjs',
 'worker/public-feed-refresh.mjs',
 'worker/public-feed-store.mjs',
];

test('W06 nine-file B approval retains exact PC A / preview CAS and no extra effects',()=>{
 const m=read(approval);
 assert.equal(validateWriterBManifest(m),m);
 assert.equal(m.baseHead,'d8ac245003e7b8e006c2345382d5c639c6d5f18b');
 assert.equal(m.candidateSourceSha,'75a9d6777b59ea6e7f54ff7e77e4e79821521972');
 assert.deepEqual(m.files.map(x=>x.path),paths);
 assert.deepEqual(m.files.filter(x=>x.change==='A').map(x=>x.path),
  ['lib/cnn-observed-history-r1.mjs']);
 assert.equal(m.files.find(x=>x.path===paths[0]).beforeSha256,null);
 assert.equal(m.files.find(x=>x.path===paths[0]).afterSha256,
  'bb8e1692e4a49c28b747804f365c0576328d042ac9616df2a5a7e4c207be5e74');
 const specPairs=[
  ['scripts/pc-writer/collect-local.mjs','w06-cnn-minute-collect-local-20261126.json',
   '6a750c854b18e419a5a44e6805c409a19efe9c6a9f8a416d76ea59ffa4dbdf43'],
  ['scripts/pc-writer/local-cycle.mjs','w06-cnn-minute-local-cycle-20261126.json',
   '486536024cc0bf78f449594fbe31b762cf0578545502a17dbfce1bd12c73c484'],
  ['scripts/pc-writer/quota-ledger.mjs','w06-cnn-minute-quota-compat-20261126.json',
   '68ee9e869c8bac308731c3748a67c644f37700dd038bc841ec06584fd064b2a9'],
  ['scripts/pc-writer/run-local.mjs','w06-cnn-minute-run-local-cas-r2-20261126.json',
   '92d98c3cbc115ddef3773e19c3cd200653d35c2f6d16caee495fe08e68d8a13f'],
 ];
 for(const [file,specName,after] of specPairs){
  const expected=read('approvals/writer-previews/'+specName);
  const entry=m.files.find(x=>x.path===file);
  assert.equal(entry.beforeSha256,expected.beforeSha256,file);
  assert.deepEqual(entry.insertions,expected.insertions,file);
  assert.equal(entry.afterSha256,after,file);
  assert.equal(expected.baseHead,m.baseHead,file);
 }
 assert.equal(m.protectedFiles.length,15);
 const ts=Object.fromEntries(m.protectedFiles.filter(x=>x.path.endsWith('.ts'))
  .map(x=>[x.path,x.sha256]));
 assert.deepEqual(ts,{
  'worker/feed-collectors/fear-greed.ts':
   'd0422e663218ba113fb5ec2ad0167236f58337f8d6d896f8e7028b9b983fbdcb',
  'worker/public-feed-collectors.ts':
   'cd36fe7e754604d7df9404418e9d0dd480afd09a4d55ede937dd27dea6ca9373',
 });
 assert.equal(m.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.equal(m.runtimeDependencies.consumers.length,3);
 assert.equal(m.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])
  assert.equal(m[key],false,key);
});

test('W06 B rejects widened source file scope or changed protected TS preimage',()=>{
 const base=read(approval);
 const widened=structuredClone(base);
 widened.files.push({path:'app/fear-greed/usa/cnn-panel.tsx',change:'A',
  beforeSha256:null,afterSha256:'a'.repeat(64)});
 assert.throws(()=>validateWriterBManifest(widened),
  /WRITER_B_FILE_CONTRACT_STOP/);
 const overlap=structuredClone(base);
 overlap.files.push({path:'worker/feed-collectors/fear-greed.ts',change:'M',
  beforeSha256:'a'.repeat(64),afterSha256:'b'.repeat(64)});
 assert.throws(()=>validateWriterBManifest(overlap),
  /WRITER_B_PROTECTED_OVERLAP_STOP/);
});
