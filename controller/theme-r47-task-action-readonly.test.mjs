import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectR47TaskActionReadonly,R47_TARGET,R47_TASK,
 R47_BEFORE_SHA} from './theme-r47-task-action-readonly.mjs';

const xml=(command,argumentsText='',extra='',workingDirectory='')=>
 Buffer.from('<?xml version="1.0" encoding="UTF-8"?>'+
  '<Task><Actions><Exec><Command>'+command+'</Command>'+
  (argumentsText?'<Arguments>'+argumentsText+'</Arguments>':'')+
  (workingDirectory?'<WorkingDirectory>'+workingDirectory+'</WorkingDirectory>':'')+
  '</Exec>'+extra+'</Actions></Task>');
const inspect=(bytes,hash=R47_BEFORE_SHA)=>
 inspectR47TaskActionReadonly({platform:'win32',
  queryTask:name=>{assert.equal(name,R47_TASK);return bytes;},
  installedHash:name=>{assert.equal(name,R47_TARGET);return hash;}});

const PRIVATE_R48=String.raw`E:\ZGmini\data\pc-writer\theme-nine-r48\THEME_NINE_R48_PRIVATE_CYCLE.cmd`;
const PRIVATE_R73=String.raw`E:\ZGmini\data\pc-writer\theme-nine-r48\THEME_NINE_R73_SCHEDULED_PRIVATE.cmd`;
test('R48 direct scheduled private CMD entry is recognized without B authorization',()=>{
 const r=inspect(xml(PRIVATE_R48));
 assert.equal(r.status,'PASS');
 assert.equal(r.commandKind,'OTHER'); // Retain legacy Command classification.
 assert.equal(r.privateTaskActionKind,'R48_PRIVATE_CYCLE');
 assert.equal(r.privateTaskActionVerified,true);
 assert.equal(r.argumentsPresent,false);
 assert.equal(r.directActionVerified,false);
 assert.equal(r.authorizesB,false);
});
test('R73 direct scheduled private CMD entry is recognized without trusting the nested chain',()=>{
 const r=inspect(xml(PRIVATE_R73));
 assert.equal(r.privateTaskActionKind,'R73_SCHEDULED_PRIVATE');
 assert.equal(r.privateTaskActionVerified,true);
 assert.equal(r.commandKind,'OTHER');
 assert.equal(r.authorizesB,false);
});
test('exact cmd.exe /d /c R48 Task wrapper is recognized, not promoted to direct',()=>{
 const r=inspect(xml('cmd.exe','/d /c &quot;&quot;'+PRIVATE_R48+'&quot;&quot;'));
 assert.equal(r.commandKind,'KNOWN_LAUNCHER');
 assert.equal(r.privateTaskActionKind,'R48_PRIVATE_CYCLE');
 assert.equal(r.directActionVerified,false);
 assert.equal(r.authorizesB,false);
});
test('unknown private CMD, suffix, or arbitrary runner cannot match a fixed action',()=>{
 for(const [command,args] of [
  [PRIVATE_R48+'.bak',''],[PRIVATE_R73+'-evil',''],
  ['C:\\Unsafe\\cmd.exe','/d /c ""'+PRIVATE_R48+'""'],
  ['cmd.exe','/d /c ""'+PRIVATE_R48+'"" & echo extra'],
  ['C:\\Temp\\unapproved.cmd','']
 ]){
  const r=inspect(xml(command,args));
  assert.equal(r.privateTaskActionKind,null);
  assert.equal(r.privateTaskActionVerified,false);
  assert.equal(r.authorizesB,false);
 }
});
test('approved Task+R47 preimage yields only fixed R48 installed hash, not chain execution PASS',()=>{
 const query=xml(PRIVATE_R48),observed=[],digest='b'.repeat(64);
 
 const expected=createHash('sha256').update(query).digest('hex');
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>query,installedHash:()=>R47_BEFORE_SHA,expectedTaskSha:expected,
  fixedFileHash:file=>{observed.push(file);return digest;}});
 assert.equal(r.status,'PASS');
 assert.equal(r.privateTaskActionKind,'R48_PRIVATE_CYCLE');
 assert.equal(r.privateChainEvidence,'HASHES_OBSERVED_NOT_CHAIN_PROOF');
 assert.deepEqual(r.privateChainFiles,[{role:'R48_CYCLE_CMD',status:'READ',sha256:digest}]);
 assert.deepEqual(observed,[PRIVATE_R48]);
 assert.equal(r.authorizesB,false);
});
test('approved R73 Task returns exactly 3 bounded hash roles, no raw source',()=>{
 const query=xml(PRIVATE_R73),hash='c'.repeat(64),seen=[];
 
 const expected=createHash('sha256').update(query).digest('hex');
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>query,installedHash:()=>R47_BEFORE_SHA,expectedTaskSha:expected,
  fixedFileHash:file=>{seen.push(file);return hash;}});
 assert.equal(r.privateTaskActionKind,'R73_SCHEDULED_PRIVATE');
 assert.equal(r.privateChainFiles.length,3);
 assert.deepEqual(r.privateChainFiles.map(x=>x.role),['R73_ENTRY_CMD','R73_RETRY_MJS','R48_CYCLE_CMD']);
 assert.equal(seen[0],PRIVATE_R73);
 assert.equal(seen[2],PRIVATE_R48);
 assert.ok(seen[1].endsWith('theme-nine-r73-auto-http502-private-retry.mjs'));
 assert.equal(r.privateChainEvidence,'HASHES_OBSERVED_NOT_CHAIN_PROOF');
 assert.equal(JSON.stringify(r).includes(PRIVATE_R73),false);
 assert.equal(r.authorizesB,false);
});
test('changed Task XML SHA never reads fixed chain files',()=>{
 let called=false;
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>xml(PRIVATE_R48),installedHash:()=>R47_BEFORE_SHA,
  fixedFileHash:()=>{called=true;return 'a'.repeat(64);}});
 assert.equal(called,false);
 assert.equal(r.taskXmlSha256MatchesApproved,false);
 assert.equal(r.privateChainEvidence,'PREIMAGE_UNVERIFIED');
 assert.deepEqual(r.privateChainFiles,[]);
});
test('preimage R47 drift leaves chain unobserved even if Task hash matches',()=>{
 const query=xml(PRIVATE_R48);
 
 let called=false;
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>query,installedHash:()=> 'f'.repeat(64),
  expectedTaskSha:createHash('sha256').update(query).digest('hex'),
  fixedFileHash:()=>{called=true;return 'a'.repeat(64);}});
 assert.equal(called,false);
 assert.equal(r.installedCmdSha256MatchesBefore,false);
 assert.equal(r.privateChainEvidence,'PREIMAGE_UNVERIFIED');
 assert.equal(r.authorizesB,false);
});
test('missing fixed installed wrapper is explicit INCOMPLETE with redacted detail',()=>{
 const query=xml(PRIVATE_R48);
 
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>query,installedHash:()=>R47_BEFORE_SHA,
  expectedTaskSha:createHash('sha256').update(query).digest('hex'),
  fixedFileHash:()=>{throw Error('private path and secret');}});
 assert.equal(r.status,'PASS');
 assert.equal(r.privateChainEvidence,'INCOMPLETE');
 assert.equal(r.privateChainFiles[0].status,'UNAVAILABLE');
 assert.equal(JSON.stringify(r).includes('private path'),false);
 assert.equal(r.authorizesB,false);
});
test('exact fixed R47 Task direct CMD is classified but does not approve B',()=>{
 const r=inspect(xml(R47_TARGET));
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'R47_TASK_ACTION_READONLY_CLASSIFIED');
 assert.equal(r.commandKind,'DIRECT_TARGET');
 assert.equal(r.directActionVerified,true);
 assert.equal(r.targetReferencedCanonical,true);
 assert.equal(r.installedCmdSha256MatchesBefore,true);
 assert.equal(r.taskXmlSha256MatchesApproved,false);
 assert.equal(r.authorizesB,false);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.sqliteOpened,false);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
});
test('fixed cmd.exe wrapper is identified but not asserted as direct execution',()=>{
 const r=inspect(xml('C:\\Windows\\System32\\cmd.exe',
  '/D /C &quot;'+R47_TARGET+'&quot;','',R47_TARGET));
 assert.equal(r.status,'PASS');
 assert.equal(r.commandKind,'KNOWN_LAUNCHER');
 assert.equal(r.argumentsPresent,true);
 assert.equal(r.workingDirectoryPresent,true);
 assert.equal(r.targetLiteralInArguments,true);
 assert.equal(r.directActionVerified,false);
 assert.equal(r.targetReferencedCanonical,'UNKNOWN');
});
test('partial path or suffix in arguments never implies exact literal CMD target',()=>{
 const r=inspect(xml('cmd.exe','/C '+R47_TARGET+'.bak'));
 assert.equal(r.commandKind,'KNOWN_LAUNCHER');
 assert.equal(r.targetLiteralInArguments,false);
 assert.equal(r.targetReferencedCanonical,'UNKNOWN');
});
test('unrecognized launcher remains OTHER instead of relaxed authorization',()=>{
 const r=inspect(xml('C:\\Tmp\\unapproved.exe','/C '+R47_TARGET));
 assert.equal(r.commandKind,'OTHER');
 assert.equal(r.directActionVerified,false);
 assert.equal(r.authorizesB,false);
});
test('drifted installed before-SHA is returned as false, never hidden',()=>{
 const r=inspect(xml(R47_TARGET),'a'.repeat(64));
 assert.equal(r.status,'PASS');
 assert.equal(r.installedCmdSha256MatchesBefore,false);
 assert.equal(r.authorizesB,false);
});
test('missing fixed CMD returns unknown and no unsafe success',()=>{
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>xml(R47_TARGET),installedHash:()=>{throw Error('private path');}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R47_CMD_PREIMAGE_UNVERIFIED');
 assert.equal(r.installedCmdSha256MatchesBefore,null);
 assert.equal(JSON.stringify(r).includes('private path'),false);
});
test('multiple actions or malformed task fail closed and remain sanitized',()=>{
 const twice=xml(R47_TARGET,'','<Exec><Command>secret</Command></Exec>');
 const r=inspect(twice);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R47_TASK_XML_UNVERIFIED');
 assert.equal(r.commandKind,'UNKNOWN');
 assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('XML containing secret arbitrary raw text is not echoed in result',()=>{
 const r=inspect(Buffer.from('<?xml version="1.0"?><Task><Secrets>secret</Secrets>'+
  '<Actions><Exec><Command>'+R47_TARGET+'</Command></Exec></Actions></Task>'));
 assert.equal(r.status,'PASS');
 assert.equal(JSON.stringify(r).includes('secret'),false);
 assert.equal(JSON.stringify(r).includes('<Task>'),false);
});
test('UTF-16LE Scheduler XML decodes to the same fixed direct-target classification',()=>{
 const utf8=xml(R47_TARGET).toString('utf8');
 const raw=Buffer.concat([Buffer.from([255,254]),Buffer.from(utf8,'utf16le')]);
 const r=inspect(raw);
 assert.equal(r.status,'PASS');
 assert.equal(r.commandKind,'DIRECT_TARGET');
 assert.equal(r.directActionVerified,true);
 assert.equal(r.authorizesB,false);
});
test('non-Windows cannot access Task probe and cannot claim an observation',()=>{
 let called=false;
 const r=inspectR47TaskActionReadonly({platform:'linux',
  queryTask:()=>{called=true;return xml(R47_TARGET);}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R47_WINDOWS_REQUIRED');
 assert.equal(called,false);
});
test('missing Task XML returns UNKNOWN with no raw exception or writes',()=>{
 const r=inspectR47TaskActionReadonly({platform:'win32',
  queryTask:()=>{throw Error('sensitive scheduler failure');}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R47_TASK_XML_UNVERIFIED');
 assert.equal(r.operationalWrites,0);
 assert.equal(JSON.stringify(r).includes('sensitive'),false);
});
