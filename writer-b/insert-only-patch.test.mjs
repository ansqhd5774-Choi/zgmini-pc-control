import test from 'node:test';
import assert from 'node:assert/strict';
import {applyApprovedInsertions,validateInsertions} from './insert-only-patch.mjs';

const anchorA="const publish=process.argv.includes('--publish');";
const anchorB='  // Reuse the existing public snapshot table; publish only the bounded display score.';
const insertions=[
 {anchor:anchorA,position:'after',text:'const INFLATION_19_AUTO_PUBLICATION_APPROVED=true;\n'},
 {anchor:anchorB,position:'before',text:"  if(INFLATION_19_AUTO_PUBLICATION_APPROVED){\n   await attemptOutput(report,'inflation-19-publication',async()=>{});\n  }\n"},
];
test('only approved insertion lines are added, preserving unrelated bytes',()=>{
 const original=Buffer.from('const unrelated=1;\n'+anchorA+'\n'+
  '  const preserved=42;\n'+anchorB+'\n');
 const result=applyApprovedInsertions(original,insertions).toString('utf8');
 assert.equal(result,'const unrelated=1;\n'+anchorA+'\n'+
  insertions[0].text+'  const preserved=42;\n'+insertions[1].text+anchorB+'\n');
 assert.equal(original.toString('utf8'),'const unrelated=1;\n'+anchorA+
  '\n  const preserved=42;\n'+anchorB+'\n');
});
test('CRLF preimage remains CRLF without unrelated normalization',()=>{
 const bytes=Buffer.from(anchorA+'\r\n'+anchorB+'\r\n');
 const output=applyApprovedInsertions(bytes,insertions).toString('utf8');
 assert.equal(output.includes('=true;\r\n'),true);
 assert.equal(output.includes('=true;\n'),false);
 assert.equal(output.endsWith(anchorB+'\r\n'),true);
});
test('PC source without final newline preserves original terminal bytes',()=>{
 const bytes=Buffer.from(anchorA+'\nconst untouched=5;\n'+anchorB);
 const output=applyApprovedInsertions(bytes,insertions).toString('utf8');
 assert.ok(output.endsWith(anchorB));
 assert.equal(output.endsWith(anchorB+'\n'),false);
 assert.ok(output.includes('const untouched=5;\n'));
 const lastLineOnly=[{anchor:anchorB,position:'after',text:'const x=1;\n'}];
 assert.throws(()=>applyApprovedInsertions(bytes,lastLineOnly),
  {code:'WRITER_B_INSERT_UNTERMINATED_EOF_APPEND_STOP'});
});
test('missing or ambiguous anchor refuses overlay',()=>{
 assert.throws(()=>applyApprovedInsertions(Buffer.from(anchorA+'\n'),insertions),
  /WRITER_B_INSERT_ANCHOR_MATCH_STOP/);
 assert.throws(()=>applyApprovedInsertions(
  Buffer.from(anchorA+'\n'+anchorA+'\n'+anchorB+'\n'),insertions),
  /WRITER_B_INSERT_ANCHOR_MATCH_STOP/);
});
test('reject mutation-like input, excess, or duplicate anchors',()=>{
 assert.throws(()=>validateInsertions([{anchor:anchorA,position:'replace',text:'x\n'}]),
  /WRITER_B_INSERT_CONTRACT_STOP/);
 assert.throws(()=>validateInsertions([insertions[0],insertions[0]]),
  /WRITER_B_INSERT_DUPLICATE_ANCHOR_STOP/);
 assert.throws(()=>applyApprovedInsertions(Buffer.from('abc'),insertions),
  /WRITER_B_INSERT_ANCHOR_MATCH_STOP/);
});
