import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
 R54_TASK,R54_ACTION,readR54TaskDefinition,parseWmiProcessCsv,
 activeR54ProcessTree,inspectR54BReadonly,createR54ReadOnlyWindowsPorts,
} from '../tools/r54-win-readonly-preflight.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const taskXml=(enabled=true,action=R54_ACTION)=>Buffer.from(
 `<?xml version="1.0"?><Task><Settings><Enabled>${enabled}</Enabled></Settings>`+
 `<Actions><Exec><Command>${action}</Command></Exec></Actions></Task>`);
const wmi=(rows=[])=>Buffer.from(['Node,CommandLine,ExecutablePath,Name,ParentProcessId,ProcessId',
 ...rows].join('\r\n')+'\r\n');

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-readonly-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const cmdRel='scripts/pc-writer/THEME_NINE_R54_PUBLIC_CYCLE.cmd';
 const cmdBytes=Buffer.from('@echo off\r\nnode --version\r\n');
 fs.mkdirSync(path.dirname(path.join(root,cmdRel)),{recursive:true});
 fs.writeFileSync(path.join(root,cmdRel),cmdBytes);
 const six=[];
 for(let i=0;i<6;i++){
  const rel=i===5?`worker/support-${i}.mjs`:`scripts/pc-writer/support-${i}.mjs`;
  const content=Buffer.from('fixed source '+i);
  fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});
  fs.writeFileSync(path.join(root,rel),content);
  six.push([rel,sha(content)]);
 }
 let query=0,scan=0;
 const ports={taskXml:()=>{query++;return taskXml();},
  processCsv:()=>{scan++;return wmi();},volumeInfo:()=> 'File System Name : NTFS'};
 const opts={root,six,action: R54_ACTION,actionSha:sha(cmdBytes),
  lock:path.join(root,'R54_B_SOURCE_EXCLUSIVE.lock'),ports};
 return {root,six,cmdRel,cmdBytes,opts,ports,
  counts:()=>({query,scan})};
}

test('Task XML validates exact action and original CMD hash',()=>{
 const bytes=Buffer.from('cmd bytes');
 const a=readR54TaskDefinition(taskXml(),bytes,{actionSha:sha(bytes)});
 assert.equal(a.enabled,true);
 assert.equal(a.actionPath,R54_ACTION);
 assert.equal(a.actionSha256,sha(bytes));
 assert.throws(()=>readR54TaskDefinition(taskXml(false,R54_ACTION+'-drift'),bytes,
  {actionSha:sha(bytes)}),/R54_READ_TASK_ACTION_DRIFT/);
 assert.throws(()=>readR54TaskDefinition(taskXml(),Buffer.from('drift'),
  {actionSha:sha(bytes)}),/R54_READ_ACTION_SHA_DRIFT/);
});

test('Task duplicate Enabled or missing Command fails closed',()=>{
 const bytes=Buffer.from('cmd bytes');
 const xml=Buffer.from(taskXml().toString().replace('</Settings>',
  '<Enabled>false</Enabled></Settings>'));
 assert.throws(()=>readR54TaskDefinition(xml,bytes,{actionSha:sha(bytes)}),
  /R54_READ_TASK_ENABLED_UNKNOWN/);
 assert.throws(()=>readR54TaskDefinition(Buffer.from(taskXml().toString().replace(
  '</Actions>','<ComHandler><ClassId>unsafe</ClassId></ComHandler></Actions>')),
  bytes,{actionSha:sha(bytes)}),/R54_READ_TASK_EXTRA_ACTION_OR_ARGUMENTS/);
 assert.throws(()=>readR54TaskDefinition(Buffer.from(taskXml().toString().replace(
  '</Command>','</Command><Arguments>/unsafe</Arguments>')),
  bytes,{actionSha:sha(bytes)}),/R54_READ_TASK_EXTRA_ACTION_OR_ARGUMENTS/);
 assert.throws(()=>readR54TaskDefinition(Buffer.from('<Task><Settings><Enabled>true</Enabled></Settings><Actions/></Task>'),
  bytes,{actionSha:sha(bytes)}),/R54_READ_TASK_ACTIONS_INVALID/);
});

test('WMI CSV parser preserves quoted commas and parent-child information',()=>{
 const rows=parseWmiProcessCsv(wmi([
  'PC,"node.exe ""E:\\ZGmini\\data\\pc-writer\\theme-nine-r54\\script,one.mjs""",C:\\node.exe,node.exe,999,1000',
  'PC,child.exe,C:\\child.exe,child.exe,1000,1001',
 ]));
 assert.equal(rows.length,2);
 assert.equal(rows[0].pid,1000);
 assert.match(rows[0].cmd,/script,one/);
 assert.deepEqual(activeR54ProcessTree(rows).active,[1000,1001]);
});

test('WMI malformed rows and unknown process columns cannot be trusted',()=>{
 assert.throws(()=>parseWmiProcessCsv(wmi(['PC,x,y,node.exe,100'])),
  /R54_READ_WMI_ROW_MALFORMED/);
 assert.throws(()=>parseWmiProcessCsv(Buffer.from('Pid,Cmd\r\n100,abc\r\n')),
  /R54_READ_WMI_HEADER_MISSING/);
});

test('unknown or redacted possible launcher command line is rejected',()=>{
 const rows=parseWmiProcessCsv(wmi(['PC,,C:\\node.exe,node.exe,0,1000']));
 assert.throws(()=>activeR54ProcessTree(rows),
  /R54_READ_WMI_REDACTED_POTENTIAL_LAUNCHER/);
});

test('six SHA + Task XML + WMI stable twice yields observation only',t=>{
 const {opts,counts}=fixture(t);
 const result=inspectR54BReadonly(opts);
 assert.equal(result.status,'OBSERVED_ONLY_NEEDS_INDEPENDENT_FREEZE');
 assert.equal(result.originalSix.length,6);
 assert.equal(result.task.enabled,true);
 assert.equal(result.ntfsVerified,true);
 assert.equal(result.independentManualFreezeVerified,false);
 assert.equal(result.exclusiveBLeaseHeld,false);
 assert.deepEqual(counts(),{query:2,scan:2});
});

test('preflight refuses a held or orphaned shared source lease',t=>{
 const {opts,root}=fixture(t);
 fs.mkdirSync(path.join(root,'R54_B_SOURCE_EXCLUSIVE.lock'));
 assert.throws(()=>inspectR54BReadonly(opts),/R54_READ_LOCK_ALREADY_PRESENT/);
});

test('preflight refuses changed live source before the first OS query',t=>{
 const {opts,root,six,counts}=fixture(t);
 fs.appendFileSync(path.join(root,six[3][0]),'unexpected');
 assert.throws(()=>inspectR54BReadonly(opts),/R54_READ_ORIGINAL_SOURCE_SHA_DRIFT/);
 assert.equal(counts().query,0);
});

test('preflight refuses TOCTOU source drift between two observations',t=>{
 const {opts,root,six}=fixture(t);
 opts.ports.taskXml=()=>{fs.appendFileSync(path.join(root,six[2][0]),'raced');return taskXml();};
 assert.throws(()=>inspectR54BReadonly(opts),/R54_READ_ORIGINAL_SOURCE_SHA_DRIFT/);
});

test('preflight refuses active R54 descendant, no force exit',t=>{
 const {opts}=fixture(t);
 opts.ports.processCsv=()=>wmi([
  'PC,E:\\ZGmini\\data\\pc-writer\\theme-nine-r54\\scripts\\pc-writer\\theme-nine-r54-public-connect.mjs,C:\\node.exe,node.exe,0,1000',
  'PC,child.exe,C:\\child.exe,child.exe,1000,1001',
 ]);
 assert.throws(()=>inspectR54BReadonly(opts),/R54_READ_ACTIVE_R54_PROCESS_PRESENT/);
});

test('preflight refuses unverified file system and source symlink',t=>{
 const {opts,root,six}=fixture(t);
 opts.ports.volumeInfo=()=> 'File System Name : ReFS';
 assert.throws(()=>inspectR54BReadonly(opts),/R54_READ_VOLUME_NOT_VERIFIED_NTFS/);
 opts.ports.volumeInfo=()=> 'NTFS';
 const target=path.join(root,six[0][0]);
 const redirected=path.join(root,'redirected.mjs');
 fs.renameSync(target,redirected);
 fs.symlinkSync(redirected,target);
 assert.throws(()=>inspectR54BReadonly(opts),/R54_READ_JUNCTION_OR_SYMLINK_DENIED/);
});

test('native adapter restricts commands to fixed schtasks/wmic/fsutil reads',()=>{
 const calls=[];
 const spawn=(exe,args,options)=>{
  calls.push({exe,args,options});
  return {status:0,stdout:Buffer.from('NTFS')};
 };
 const native=createR54ReadOnlyWindowsPorts({platform:'win32',systemRoot:'C:\\Windows',spawn});
 native.taskXml();native.processCsv();native.volumeInfo();
 assert.equal(calls.length,3);
 assert.deepEqual(calls.map(x=>path.win32.basename(x.exe)),
  ['schtasks.exe','wmic.exe','fsutil.exe']);
 assert.deepEqual(calls[0].args,['/Query','/TN',R54_TASK,'/XML']);
 assert.ok(calls.every(x=>x.options.shell===false));
 assert.throws(()=>createR54ReadOnlyWindowsPorts({platform:'linux'}),
  /R54_READ_NATIVE_WINDOWS_REQUIRED/);
});

test('unknown native command failure never becomes a successful observation',()=>{
 const native=createR54ReadOnlyWindowsPorts({platform:'win32',systemRoot:'C:\\Windows',
  spawn:()=>({status:1,stdout:Buffer.from('')})});
 assert.throws(()=>native.taskXml(),/R54_READ_FIXED_OS_COMMAND_FAILED/);
});
