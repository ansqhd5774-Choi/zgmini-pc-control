import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyApprovedInsertions} from './insert-only-patch.mjs';
import {validatePreviewSpec} from './insert-preview-readonly.mjs';

const file='approvals/writer-previews/w01-r2-stored-payload-two-branch-20261119.json';
const spec=JSON.parse(readFileSync(file,'utf8'));
// The real operating preimage is not available in GitHub and is deliberately
// not fabricated here. Only the existing approved A preview can attest it.
const source=[
 "  const p=envelope?.projection;",
 "  if(p?.status!=='READY'||p.sourceVersion!==checkpoint.sourceVersion){",
 "   const payload=r10?.status==='READY'?r10.payload:await builders[id](input);",
 "   await projectionWriter(core).write(id,payload,Date.now(),checkpoint);",
 "  }",
].join('\n')+'\n';

test('W01 R2 candidate covers existing checkpoint and newly rebuilt payload',()=>{
 assert.strictEqual(validatePreviewSpec(spec),spec);
 assert.equal(spec.insertions.length,2);
 const before=Buffer.from(source);
 const after=applyApprovedInsertions(before,spec.insertions,{filePath:spec.filePath}).toString();
 assert.equal(before.toString(),source,'preview cannot mutate original bytes');
 assert.equal(after.match(/inflationR2AsOfTrendCompatibility/g).length,4);
 const oldPath=after.indexOf('inflationR2AsOfTrendCompatibility(envelope?.payload)');
 const freshPath=after.indexOf('inflationR2AsOfTrendCompatibility(payload)');
 const regenerated=after.indexOf("const payload=r10?.status");
 const legacyWrite=after.lastIndexOf('await projectionWriter(core).write(id,payload');
 assert.ok(oldPath>0&&oldPath<regenerated,'unchanged checkpoint is fixed first');
 assert.ok(freshPath>regenerated&&freshPath<legacyWrite,
  'changed checkpoint is fixed before legacy builder payload is stored');
 assert.ok(after.includes("if(repaired!==payload){"),'no synthetic rewrite for valid input');
 assert.ok(after.includes("report.projections.push({id,status:'LOCAL_READY'});"));
 assert.ok(after.includes('return;'), 'repaired payload skips old writer call');
 assert.equal(spec.sourceRoot,'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release');
});

test('W01 R2 missing/duplicate old-PC anchor fails closed rather than guessing',()=>{
 const base=Buffer.from(source);
 const missing=Buffer.from(source.replace(spec.insertions[1].anchor,'NOT_PRESENT'));
 const duplicate=Buffer.concat([base,Buffer.from(spec.insertions[1].anchor+'\n')]);
 for(const bad of [missing,duplicate])
  assert.throws(()=>applyApprovedInsertions(bad,spec.insertions,{filePath:spec.filePath}),
   {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});

test('W01 R2 two-branch preview preserves CRLF source and has no PC effects',()=>{
 const sourceWin=Buffer.from(source.replaceAll('\n','\r\n'));
 const patched=applyApprovedInsertions(sourceWin,spec.insertions,{filePath:spec.filePath});
 const text=patched.toString();
 assert.ok(text.includes('\r\n'));
 assert.ok(!/(?<!\r)\n/.test(text));
 assert.ok(patched.length>sourceWin.length);
});
