import test from 'node:test';
import assert from 'node:assert/strict';
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
