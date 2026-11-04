import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalWindows,sourceRootFromRealScript,parseCoreTaskXml,
 inventoryReadOnly,FILES,SCHEMA} from './inventory.mjs';

const SCRIPT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
const ROOT=String.raw`e:\zgmini\projects\zgmini-earnings-history-pc-release`;
const SOURCE='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
const xml=(script=SCRIPT,command=String.raw`E:\ZGmini\runtime\node.exe`)=>Buffer.from(
 `<?xml version="1.0"?><Task><Actions><Exec><Command>${command}</Command>`+
 `<Arguments>"${script}"</Arguments></Exec></Actions></Task>`);
function fixture(overrides={}){
 const deps={taskXml:()=>xml(),resolveRealPath:()=>SCRIPT,
  readConfig:()=>({source:SOURCE}),gitRoot:()=>ROOT,gitHead:()=>SOURCE,
  targetFilesDirty:()=>false,
  readTargetExists:(_root,rel)=>rel===FILES[0],
  readTarget:()=>Buffer.from('approved existing run-local source')};
 return {...deps,...overrides};
}

test('task Action pins one script and only exposes digest and executable basename',()=>{
 const p=parseCoreTaskXml(xml());
 assert.equal(p.script,SCRIPT);
 assert.equal(p.actionExe,'node.exe');
 assert.match(p.taskXmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(Object.keys(p).length,3);
});

test('task XML UTF-16LE BOM is decoded without running Action',()=>{
 const source=xml().toString('utf8');
 const p=parseCoreTaskXml(Buffer.concat([Buffer.from([0xff,0xfe]),
  Buffer.from(source,'utf16le')]));
 assert.equal(p.script,SCRIPT);
});

test('junction-normalized Windows real path stays under approved E project root',()=>{
 assert.equal(canonicalWindows(String.raw`\\?\E:\ZGmini\projects\abc`),String.raw`e:\zgmini\projects\abc`);
 assert.equal(sourceRootFromRealScript(SCRIPT),ROOT);
 assert.throws(()=>sourceRootFromRealScript(String.raw`C:\ZGmini\projects\abc\scripts\pc-writer\local-cycle.mjs`),
  /INFL19_A_SOURCE_ROOT_DENIED/);
 assert.throws(()=>sourceRootFromRealScript(String.raw`E:\ZGmini\data\pc-writer\scripts\pc-writer\local-cycle.mjs`),
  /INFL19_A_SOURCE_ROOT_DENIED/);
});

test('bounded read-only inventory returns identity and 3 file states',()=>{
 const r=inventoryReadOnly(fixture());
 assert.equal(r.schema,SCHEMA);assert.equal(r.status,'PASS_READONLY');
 assert.equal(r.sourceRoot,ROOT);assert.equal(r.configMatchesHead,true);
 assert.equal(r.targetFilesDirty,false);
 assert.equal(r.files[FILES[0]].status,'PRESENT');
 assert.equal(r.files[FILES[1]].status,'ABSENT');
 assert.equal(r.files[FILES[2]].status,'ABSENT');
 assert.equal(r.pcSourceWrites,0);assert.equal(r.d1Writes,0);
 assert.equal('config' in r,false);assert.equal('args' in r,false);
});

test('mixed config/source SHA is reported without mutation or false runtime assertion',()=>{
 const r=inventoryReadOnly(fixture({gitHead:()=> 'f'.repeat(40)}));
 assert.equal(r.configMatchesHead,false);
 assert.equal(r.evidenceLevel,'TASK_XML_AND_FILESYSTEM_GIT_READONLY_NOT_CORE_RUNTIME');
});

test('ambiguous/missing task Action or non-Writer script stops',()=>{
 assert.throws(()=>parseCoreTaskXml(Buffer.from('<Task/>')),
  /INFL19_A_TASK_ACTION_AMBIGUOUS/);
 assert.throws(()=>parseCoreTaskXml(xml(String.raw`E:\ZGmini\projects\foo\not-writer.mjs`)),
  /INFL19_A_SCRIPT_REFERENCE_UNRESOLVED/);
 assert.throws(()=>parseCoreTaskXml(Buffer.from('<Task><Exec><Command>a</Command></Exec>'+ 
  '<Exec><Command>b</Command></Exec></Task>')),
  /INFL19_A_TASK_ACTION_AMBIGUOUS/);
});

test('unsafe source state and missing entry do not pass',()=>{
 assert.throws(()=>inventoryReadOnly(fixture({gitHead:()=> 'invalid'})),
  /INFL19_A_GIT_HEAD_DENIED/);
 assert.throws(()=>inventoryReadOnly(fixture({readConfig:()=>({source:'invalid'})})),
  /INFL19_A_CONFIG_SOURCE_DENIED/);
 assert.throws(()=>inventoryReadOnly(fixture({readTargetExists:()=>false})),
  /INFL19_A_WRITER_ENTRY_MISSING/);
 assert.throws(()=>inventoryReadOnly(fixture({gitRoot:()=>String.raw`e:\zgmini\projects`})),
  /INFL19_A_NOT_CHECKOUT_ROOT/);
});
