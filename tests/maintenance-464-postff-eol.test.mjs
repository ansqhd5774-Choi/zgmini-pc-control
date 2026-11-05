import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Model the bounded manifest EOL predicate embedded in the Windows CMD.
// Only JSON CRLF may normalize; the eight executable source files stay raw-pinned.
const original=Buffer.from('{\n  "schema": "ZGMINI_MAINTENANCE_HANDOFF_V1",\n  "approved": true,\n  "targetSha": "abc"\n}\n');
const compare=(local,pinned)=>local.equals(pinned)
  ||Buffer.from(local.toString('utf8').replace(/\r\n/g,'\n'),'utf8').equals(pinned);
const hash=(v)=>crypto.createHash('sha256').update(v).digest('hex');

const text=original.toString('utf8');
const variants=[
  text,
  text.replace(/\n/g,'\r\n'),
  text.replace('\n','\r\n'),
  text.replace(/\n(?=})/,'\r\n'),
  text.replace(/\n/g,(match,offset)=>offset%2?'\r\n':match),
];
for(let i=0;i<variants.length;i++){
  test(`manifest legitimate LF/CRLF variant ${i+1}`,()=>{
    assert.equal(compare(Buffer.from(variants[i]),original),true);
  });
}

const offsets=[...text].map((x,i)=>(/^[A-Za-z0-9:]$/.test(x)?i:-1))
  .filter(i=>i>=0).slice(0,20);
assert.equal(offsets.length,20);
for(let i=0;i<offsets.length;i++){
  test(`manifest content mutation is rejected ${i+1}`,()=>{
    const changed=[...text];changed[offsets[i]]='?';
    assert.equal(compare(Buffer.from(changed.join('').replace(/\n/g,'\r\n')),original),false);
  });
}

const eight=[
  'maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs',
  'maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs',
  'bootstrap-maintenance.mjs','handoff-maintenance.mjs',
];
for(let i=0;i<eight.length;i++){
  test(`raw executable checksum forbids EOL drift ${eight[i]}`,()=>{
    const raw=Buffer.from(`// ${eight[i]}\nconst v=${i};\n`);
    const transformed=Buffer.from(raw.toString('utf8').replace(/\n/g,'\r\n'));
    assert.notEqual(hash(raw),hash(transformed));
  });
}

const cmd=fs.readFileSync(new URL('../tools/operator-packets/MAINTENANCE_464_POSTFF_HANDOFF_V2.cmd',import.meta.url),'utf8');
test('post-FF packet never fetches or merges source',()=>{
  const active=cmd.split(/\r?\n/).filter(s=>!/^(rem |::)/i.test(s.trim()));
  assert.equal(active.some(s=>/^git .* (fetch|pull|reset|checkout|clean)(?:\s|$)|^git .* merge(?:\s|$)/i.test(s.trim())),false);
  assert.match(cmd,/GIT_NETWORK_ATTEMPTED=NO/);
  assert.match(cmd,/SOURCE_FF_ATTEMPTED=NO/);
});
test('post-FF packet isolates failures and validates before invoking helper',()=>{
  for(const code of ['MANIFEST_PINNED_CONTENT_DRIFT','MANIFEST_SCHEMA_OR_APPROVAL_DRIFT',
    'TARGET_RAW_HASH_MISMATCH','CHECKOUT_RAW_HASH_MISMATCH'])assert.ok(cmd.includes(code));
  assert.ok(cmd.indexOf('PHASE=EXACT_MANIFEST_AND_SOURCE_VALIDATION')<cmd.indexOf('PHASE=HANDOFF_INVOCATION_ATTEMPTED'));
  assert.match(cmd,/ZGMINI_MAINTENANCE_464_POSTFF_V2_RESULT\.txt/);
});
