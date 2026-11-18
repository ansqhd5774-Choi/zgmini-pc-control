import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {previewWriterInsertions,PREVIEW_SCHEMA} from './insert-preview-readonly.mjs';
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
