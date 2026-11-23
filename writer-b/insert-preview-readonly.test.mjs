import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {previewWriterInsertions,PREVIEW_SCHEMA,validatePreviewSpec} from './insert-preview-readonly.mjs';
import {applyApprovedInsertions} from './insert-only-patch.mjs';
import fs from 'node:fs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const before=Buffer.from("const alpha=1;\nconst omega=2;\n");
const spec={schema:PREVIEW_SCHEMA,
 sourceRoot:String.raw`E:\ZGmini\projects\zgmini-release`,
 baseHead:'a'.repeat(40),filePath:'scripts/pc-writer/run-local.mjs',
 beforeSha256:sha(before),insertions:[
  {anchor:'const alpha=1;',position:'after',text:'const approved=true;\n'}]};
const env={canonicalize:x=>x,head:()=>spec.baseHead,
 configSource:()=>spec.baseHead,isTargetClean:()=>true,
 readTarget:()=>before,taskXml:()=>Buffer.from('<Task></Task>')};
test('read-only preview returns exact digests, no source text or writes',()=>{
 const out=previewWriterInsertions(spec,env);
 assert.equal(out.status,'PASS_READONLY');
 assert.equal(out.afterSha256,sha(Buffer.from(
  'const alpha=1;\nconst approved=true;\nconst omega=2;\n')));
 assert.equal(JSON.stringify(out).includes('alpha'),false);
 assert.equal(out.pcSourceWrites,0);
});
test('wrong checkout, dirty target, or drift stops before preview',()=>{
 assert.throws(()=>previewWriterInsertions(spec,{...env,head:()=> 'b'.repeat(40)}),
  /WRITER_B_PREVIEW_SOURCE_HEAD_STOP/);
 assert.throws(()=>previewWriterInsertions(spec,{...env,isTargetClean:()=>false}),
  /WRITER_B_PREVIEW_DIRTY_TARGET_STOP/);
 assert.throws(()=>previewWriterInsertions(spec,{...env,readTarget:()=>Buffer.from('different')}),
  /WRITER_B_PREVIEW_PREIMAGE_SHA_STOP/);
});
test('invalid source root and unsupported file path rejected',()=>{
 assert.throws(()=>previewWriterInsertions({...spec,sourceRoot:'C:\\tmp'},env),
  /WRITER_B_PREVIEW_SPEC_STOP/);
 assert.throws(()=>previewWriterInsertions({...spec,filePath:'../secret.mjs'},env),
  /WRITER_B_PREVIEW_SPEC_STOP/);
});

test('missing versus whitespace-drift anchors report bounded counts without revealing code',()=>{
 const source=Buffer.from("const alpha=1;\n  const omega=2;\n");
 const miss={...spec,beforeSha256:sha(source),insertions:[
  {anchor:'const alpha=1;',position:'after',text:'const added=1;\n'},
  {anchor:'const omega=2;',position:'before',text:'const added=2;\n'}
 ]};
 let taskRead=0;
 const out=previewWriterInsertions(miss,{...env,readTarget:()=>source,
  taskXml:()=>{taskRead++;return Buffer.from('<Task/>');}});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.code,'WRITER_B_INSERT_ANCHOR_MATCH_STOP');
 assert.deepEqual(out.anchorEvidence,[
  {index:0,exactCount:1,trimmedCount:1},
  {index:1,exactCount:0,trimmedCount:1}
 ]);
 assert.equal(out.pcSourceWrites,0);
 assert.equal(taskRead,0);
 assert.equal(JSON.stringify(out).includes('omega'),false);
 assert.equal(JSON.stringify(out).includes('alpha'),false);
});
test('ambiguous anchor reports at most three matches and never grants an insertion',()=>{
 const source=Buffer.from(Array(5).fill('const alpha=1;').join('\n')+'\n');
 const out=previewWriterInsertions({...spec,beforeSha256:sha(source)},
  {...env,readTarget:()=>source});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.anchorEvidence[0].exactCount,3);
 assert.equal(out.anchorEvidence[0].trimmedCount,3);
});

// Approved source-only Alpaca retirement for the existing PC synthetic checkout.
const load=name=>JSON.parse(fs.readFileSync(
 new URL('../approvals/writer-previews/paid-alpaca-retire-'+name+'-20261123.json',
 import.meta.url),'utf8'));
const entry=load('local-cycle'),collector=load('collect-local');

test('Alpaca runtime retirement retains exact PC synthetic HEAD and byte CAS',()=>{
 for(const spec of [entry,collector]){
  assert.equal(validatePreviewSpec(spec),spec);
  assert.equal(spec.baseHead,'c62bd5aac3353d7e146d930dbb033b82d89010cd');
  assert.equal(spec.insertions.every(x=>x.text.includes('if (false)')||
   x.text.includes('RETIRED_LEGACY_ALPACA')),true);
  assert.ok(spec.insertions.every(x=>!x.text.includes('fetch(')));
 }
 assert.equal(entry.beforeSha256,'0cb4a9834c466d778415a12a4f8bdb62e66596dbd39ea2dd1b7550e982a0708d');
 assert.equal(collector.beforeSha256,'dd2ec67a4a26860215c4e94e4df9b0f4d4fdeb4532e0775600a810f6a966c706');
 assert.deepEqual([entry.filePath,collector.filePath],[
  'scripts/pc-writer/local-cycle.mjs','scripts/pc-writer/collect-local.mjs']);
});

test('insertions preserve all original lines; only retired Alpaca calls are inert',async()=>{
 const spawn=entry.insertions[0].anchor;
 const x=applyApprovedInsertions(Buffer.from('const live=42;\n'+spawn+'\nconst done=1;\n'),
  entry.insertions,{filePath:entry.filePath}).toString('utf8');
 assert.ok(x.includes('const live=42;\n'));
 assert.ok(x.includes('const done=1;\n'));
 assert.match(x,/if \(false\)[^\n]*\n\s*spawnSync/);
 const spawnCalls=[];
 const mock = {execPath:'node'};
 const simulatedSpawn= new Function('spawnSync','process','path','here',
  x.replace('const live=42;','').replace('const done=1;',''));
 simulatedSpawn((...args)=>spawnCalls.push(args),mock,{join:()=>'/tmp/legacy.mjs'},'/tmp');
 assert.equal(spawnCalls.length,0);
 const source=Buffer.from('const lane="core";\n'+collector.insertions[0].anchor+
  '\ntry{\n'+collector.insertions[1].anchor+'\n}catch(error){ }\n');
 const y=applyApprovedInsertions(source,collector.insertions,
  {filePath:collector.filePath}).toString('utf8');
 assert.match(y,/if \(false\)[^\n]*\n\s*sectorFearGreedEtf=await/);
 assert.match(y,/RETIRED_LEGACY_ALPACA/);
 const collectorCalls=[];
 const evaluate=new Function('collectSectorFearGreedR3EtfIncremental','base',
  'globalThis','Date','return (async()=>{'+y+'return sectorFearGreedEtf;})()');
 const result=await evaluate(async(...args)=>collectorCalls.push(args),'/tmp',
  {fetch:()=>{throw Error('unexpected provider call');}},Date);
 assert.equal(collectorCalls.length,0);
 assert.deepEqual(result,{status:'RETIRED_LEGACY_ALPACA',providerRequests:0});
});
