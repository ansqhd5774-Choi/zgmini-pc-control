import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 applyApprovedInsertions,validateInsertions,insertionAnchorIndices,
 materializeApprovedWriterFile
} from '../writer-b/insert-only-patch.mjs';
import {previewWriterInsertions,PREVIEW_SCHEMA} from '../writer-b/insert-preview-readonly.mjs';

const PATH='scripts/pc-writer/collect-local.mjs';
const ROOT='E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release';
const HEAD='8254045340877b3f96e9fd9bae41b7a17d24cc8b';
const ENTRY='@zgmini:sec-core:entry';
const QUOTA='@zgmini:sec-core:quota';
const digest=b=>createHash('sha256').update(b).digest('hex');
const inserts=[
 {anchor:ENTRY,position:'after',text:
  " const {attachSecSharedPermitToQuota}=await import('./sec-legacy-quota-bridge.mjs');\n"+
  " const {secGuardOptionsFromEnv}=await import('./sec-guard-runtime-config.mjs');\n"+
  ' const secGuardOptions=secGuardOptionsFromEnv();\n'},
 {anchor:QUOTA,position:'after',text:' attachSecSharedPermitToQuota(quota,secGuardOptions);\n'}
];
const source=(newline='\n',variant='spaced')=>[
 "export async function collectLocal(base,{lane='core',importOnly=false,job=null}={}){",
 ' const core=localDatabase(base);',
 variant==='spaced'?'  const quota = createQuotaFetch({base, originalFetch});':
 ' const quota=createQuotaFetch({base,originalFetch});',
 ' return quota;',
 '}',''].join(newline);

test('A preview selectors find exactly two distinct semantic anchors',()=>{
 const lines=source().split('\n');
 assert.deepEqual(insertionAnchorIndices(lines,ENTRY,{filePath:PATH}),[0]);
 assert.deepEqual(insertionAnchorIndices(lines,QUOTA,{filePath:PATH}),[2]);
});
test('CRLF PC source is preserved byte-for-byte except approved insertions',()=>{
 const original=Buffer.from(source('\r\n'));
 const after=applyApprovedInsertions(original,inserts,{filePath:PATH});
 assert.ok(after.length>original.length);
 assert.equal(after.toString().replace(/\r\n/g,'').includes('\n'),false);
 assert.ok(after.toString().includes('const quota = createQuotaFetch'));
 assert.ok(after.toString().includes('attachSecSharedPermitToQuota(quota,secGuardOptions);'));
 assert.ok(after.toString().includes(' const core=localDatabase(base);\r\n'));
});
test('regular exact-string insertion remains backward compatible',()=>{
 const original=Buffer.from('const a=1;\nconst quota=createQuotaFetch({base,originalFetch});\n');
 const op=[{anchor:'const a=1;',position:'after',text:'const b=2;\n'}];
 assert.equal(applyApprovedInsertions(original,op).toString(),
 'const a=1;\nconst b=2;\nconst quota=createQuotaFetch({base,originalFetch});\n');
});
test('Core selectors cannot be applied to any other Writer B target',()=>{
 assert.throws(()=>applyApprovedInsertions(Buffer.from(source()),inserts,
 {filePath:'scripts/pc-writer/quota-fetch.mjs'}),{code:'WRITER_B_INSERT_SELECTOR_TARGET_STOP'});
});
test('unknown structural selectors are denied before inspecting PC content',()=>{
 const other=[{anchor:'@zgmini:sec-core:arbitrary',position:'after',text:'noop();\n'}];
 assert.throws(()=>validateInsertions(other),{code:'WRITER_B_INSERT_SELECTOR_UNKNOWN_STOP'});
});
test('duplicate candidate quota lines fail closed with no partial patch',()=>{
 const original=Buffer.from(source().replace(' return quota;',
 ' const quota=createQuotaFetch({base,originalFetch});\n return quota;'));
 assert.throws(()=>applyApprovedInsertions(original,inserts,{filePath:PATH}),
 {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});
test('missing function anchor fails closed',()=>{
 const original=Buffer.from(source().replace('function collectLocal','function differentJob'));
 assert.throws(()=>applyApprovedInsertions(original,inserts,{filePath:PATH}),
 {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});
test('preview computes exact post-insertion SHA without returning source bytes',()=>{
 const original=Buffer.from(source('\r\n'));
 const expected=applyApprovedInsertions(original,inserts,{filePath:PATH});
 const spec={schema:PREVIEW_SCHEMA,sourceRoot:ROOT,baseHead:HEAD,
 filePath:PATH,beforeSha256:digest(original),insertions:inserts};
 const out=previewWriterInsertions(spec,{
  canonicalize:()=>ROOT,head:()=>HEAD,configSource:()=>HEAD,
  isTargetClean:()=>true,readTarget:()=>original,taskXml:()=>Buffer.from('<Task/>')
 });
 assert.equal(out.status,'PASS_READONLY');
 assert.equal(out.afterSha256,digest(expected));
 assert.equal(out.beforeSha256,digest(original));
 assert.equal(out.pcSourceWrites,0);
 assert.equal(out.taskWrites,0);
 assert.equal(JSON.stringify(out).includes('const quota'),false);
});
test('exact PC preimage SHA mismatch fails before any insertion',()=>{
 const original=Buffer.from(source());
 const spec={schema:PREVIEW_SCHEMA,sourceRoot:ROOT,baseHead:HEAD,
 filePath:PATH,beforeSha256:digest(Buffer.from('different')),insertions:inserts};
 assert.throws(()=>previewWriterInsertions(spec,{
  canonicalize:()=>ROOT,head:()=>HEAD,configSource:()=>HEAD,
  isTargetClean:()=>true,readTarget:()=>original,taskXml:()=>Buffer.from('<Task/>')
 }),{code:'WRITER_B_PREVIEW_PREIMAGE_SHA_STOP'});
});
test('approved B materialization verifies before, candidate, and after hashes',()=>{
 const original=Buffer.from(source());
 const candidate=Buffer.from('candidate source file');
 const after=applyApprovedInsertions(original,inserts,{filePath:PATH});
 const entry={path:PATH,change:'M',beforeSha256:digest(original),
  candidateSha256:digest(candidate),afterSha256:digest(after),insertions:inserts};
 assert.deepEqual(materializeApprovedWriterFile(entry,candidate,original),after);
 assert.throws(()=>materializeApprovedWriterFile({...entry,afterSha256:digest('bad')},candidate,original),
 {code:'WRITER_B_INSERT_AFTER_SHA_STOP'});
});
test('source with both anchors on one line is denied for overlapping indices',()=>{
 const original=Buffer.from("export async function collectLocal() { const quota=createQuotaFetch({base,originalFetch});\n");
 assert.throws(()=>applyApprovedInsertions(original,inserts,{filePath:PATH}),
 {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});
test('ambiguous entry function declaration never selects one silently',()=>{
 const original=Buffer.from(source()+'\n'+source());
 assert.throws(()=>applyApprovedInsertions(original,inserts,{filePath:PATH}),
 {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});


test('synchronous Core function is refused before inserting awaited import',()=>{
 const original=Buffer.from(source().replace('export async function','export function'));
 assert.throws(()=>applyApprovedInsertions(original,inserts,{filePath:PATH}),
 {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});
