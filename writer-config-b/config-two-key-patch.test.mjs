import test from 'node:test';
import assert from 'node:assert/strict';
import {changeEmploymentOptIns,OPT_IN_KEYS} from './config-two-key-patch.mjs';

const update=body=>changeEmploymentOptIns(Buffer.from(body));
const decode=result=>JSON.parse(result.bytes.toString('utf8'));

test('adds only two boolean fields while preserving unrelated JSON semantics',()=>{
  const original='{\r\n  "enabled": true,\r\n  "source": "a-secret-example-that-is-never-logged",\r\n  "child": {"employmentR6AutoCollection": false},\r\n  "number": 42\r\n}\r\n';
  const p=update(original),out=p.bytes.toString('utf8');
  assert.equal(p.changed,true);
  assert.deepEqual(p.changedKeys,OPT_IN_KEYS);
  assert.equal(decode(p).child.employmentR6AutoCollection,false);
  assert.equal(decode(p).number,42);
  assert.equal(decode(p).source,'a-secret-example-that-is-never-logged');
  assert.equal(decode(p).employmentR6AutoCollection,true);
  assert.equal(decode(p).employmentR6OneYearAutoPublication,true);
  assert.match(out,/\r\n/);
  assert.equal(out.includes('\n')&&out.includes('\r\n'),true);
  assert.deepEqual(update(out).bytes,p.bytes);
});

test('existing false values change to true and no other bytes',()=>{
  const input='{"employmentR6AutoCollection": false,"note": "false, \\\"yes\\\"", "employmentR6OneYearAutoPublication":false}';
  const p=update(input);
  assert.equal(p.bytes.toString('utf8'),input.replace(': false',': true').replace('Publication":false','Publication":true'));
  assert.deepEqual(p.changedKeys,OPT_IN_KEYS);
  assert.equal(update(p.bytes.toString('utf8')).changed,false);
});

test('already true returns exact original bytes and no change',()=>{
  const input=' { "employmentR6AutoCollection" : true, "note": {"b":false}, "employmentR6OneYearAutoPublication":true }\n';
  const p=update(input);
  assert.equal(p.bytes.toString('utf8'),input);
  assert.equal(p.changed,false);
  assert.deepEqual(p.changedKeys,[]);
  assert.equal(p.afterSha256,p.beforeSha256);
});

test('empty object is populated and idempotent',()=>{
  const p=update('{\n}\n');
  assert.equal(decode(p).employmentR6AutoCollection,true);
  assert.equal(decode(p).employmentR6OneYearAutoPublication,true);
  assert.deepEqual(update(p.bytes.toString('utf8')).bytes,p.bytes);
});

test('duplicate top-level keys are refused',()=>{
  assert.throws(()=>update('{"employmentR6AutoCollection":true,"employmentR6AutoCollection":false}'),
    /CONFIG_B_DUPLICATE_KEY_STOP/);
});

test('invalid opt-in types, malformed JSON, encoding and root types are refused',()=>{
  assert.throws(()=>update('{"employmentR6AutoCollection":"true"}'),/CONFIG_B_OPTIN_TYPE_STOP/);
  assert.throws(()=>update('{"employmentR6AutoCollection":1}'),/CONFIG_B_OPTIN_TYPE_STOP/);
  assert.throws(()=>update('{"other":true,}'),/CONFIG_B_JSON_PARSE_STOP/);
  assert.throws(()=>update('[]'),/CONFIG_B_JSON_ROOT_STOP/);
  assert.throws(()=>changeEmploymentOptIns(Buffer.from([0xff,0xfe,0x00])),/CONFIG_B_ENCODING_STOP/);
});

test('nested escaped matching keys do not count as top-level targets',()=>{
  const p=update('{"object":{"employmentR6OneYearAutoPublication":false},"employmentR6AutoCollection":false}');
  assert.equal(decode(p).object.employmentR6OneYearAutoPublication,false);
  assert.equal(decode(p).employmentR6AutoCollection,true);
  assert.equal(decode(p).employmentR6OneYearAutoPublication,true);
});
