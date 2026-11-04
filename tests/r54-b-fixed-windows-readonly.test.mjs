import test from 'node:test';
import assert from 'node:assert/strict';
import {
 observeR54BWindowsReadOnly,parseR54BProcessCsv,classifyR54BProcessTree,
} from '../tools/update.mjs';

const CSV='Node,CommandLine,ExecutablePath,Name,ParentProcessId,ProcessId\r\n'+
 'PC,C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,explorer.exe,0,1200\r\n';
const fakeSource=()=>({status:'R54_B_ORIGINAL_NINE_SHA_VERIFIED',
 files:Array.from({length:9},(_,i)=>({path:`p${i}`,actual:'0'.repeat(64)}))});
const fakeTask=()=>({xmlSha256:'a'.repeat(64),definitionDigest:'b'.repeat(64),enabled:true});

function makeProbe(processCsv=CSV){
 const calls=[];
 const run=(binary,args,options)=>{
  calls.push({binary,args,options});
  return {status:0,stdout:Buffer.from(binary.endsWith('wmic.exe')
   ?processCsv:'not-real-task-xml')};
 };
 return {calls,options:{platform:'win32',systemRoot:'C:\\Windows',run,
  inspectSource:fakeSource,inspectTask:fakeTask,readAction:()=>Buffer.alloc(0),
  now:()=> '2026-11-05T06:30:00+09:00'}};
}

test('no native Windows means hard STOP before any Windows call',()=>{
 const fixture=makeProbe();
 assert.throws(()=>observeR54BWindowsReadOnly({...fixture.options,platform:'linux'}),
  /R54_B_FIXED_NATIVE_WINDOWS_REQUIRED/);
 assert.equal(fixture.calls.length,0);
});

test('fixed read-only Windows ports observe twice but never claim START FROZEN',()=>{
 const fixture=makeProbe();
 const out=observeR54BWindowsReadOnly(fixture.options);
 assert.equal(out.status,'OBSERVED_ONLY_NEEDS_INDEPENDENT_FREEZE');
 assert.equal(out.manualEntrypointFreezeVerified,false);
 assert.equal(out.exclusiveStartFenceHeld,false);
 assert.equal(out.taskChanges,0);
 assert.equal(out.sourceChanges,0);
 assert.equal(fixture.calls.length,4);
 for(const call of fixture.calls){
  assert.equal(call.options.shell,false);
  assert.equal(call.options.windowsHide,true);
  assert.ok(['C:\\Windows\\System32\\schtasks.exe',
   'C:\\Windows\\System32\\wmic.exe'].includes(call.binary));
  assert.ok(!call.args.some(arg=>/Change|Disable|Enable|Terminate/i.test(arg)));
 }
});

test('WMIC unavailable fails closed with its own exact diagnostic code',()=>{
 const fixture=makeProbe();
 fixture.options.run=(binary,args)=>binary.endsWith('wmic.exe')
  ?{status:null,error:Object.assign(new Error('missing'),{code:'ENOENT'})}
  :{status:0,stdout:Buffer.from('xml')};
 assert.throws(()=>observeR54BWindowsReadOnly(fixture.options),
  /R54_B_FIXED_WMIC_UNAVAILABLE/);
});

test('even one R54 Node process or descendant prevents safe observation',()=>{
 const csv=CSV+
  'PC,node scripts\\pc-writer\\theme-nine-r54-public-connect.mjs,E:\\ZGmini\\runtime\\node.exe,node.exe,0,2400\r\n'+
  'PC,child,E:\\ZGmini\\runtime\\node.exe,node.exe,2400,2401\r\n';
 const items=parseR54BProcessCsv(Buffer.from(csv));
 assert.deepEqual(classifyR54BProcessTree(items),{
  roots:1,descendants:1,active:[2400,2401]});
 const fixture=makeProbe(csv);
 assert.throws(()=>observeR54BWindowsReadOnly(fixture.options),
  /R54_B_FIXED_ACTIVE_WRITER_PRESENT/);
});

test('redacted process list is UNKNOWN rather than no active writer',()=>{
 const csv=CSV+'PC,,E:\\ZGmini\\runtime\\node.exe,node.exe,0,2400\r\n';
 assert.throws(()=>classifyR54BProcessTree(parseR54BProcessCsv(Buffer.from(csv))),
  /R54_B_FIXED_PROCESS_LAUNCHER_REDACTED/);
});

test('WMIC UTF-16LE BOM and UTF-8 BOM decode safely; unsupported encoding stops',()=>{
 const expected=parseR54BProcessCsv(Buffer.from(CSV,'utf8'));
 assert.deepEqual(parseR54BProcessCsv(Buffer.from('\uFEFF'+CSV,'utf16le')),expected);
 assert.deepEqual(parseR54BProcessCsv(Buffer.concat([
  Buffer.from([0xef,0xbb,0xbf]),Buffer.from(CSV,'utf8')])),expected);
 assert.throws(()=>parseR54BProcessCsv(Buffer.from([0xfe,0xff,0,65])),
  /R54_B_FIXED_PROCESS_ENCODING_UNKNOWN/);
 assert.throws(()=>parseR54BProcessCsv(Buffer.from([0xc3,0x28])),
  /R54_B_FIXED_PROCESS_ENCODING_UNKNOWN/);
});
