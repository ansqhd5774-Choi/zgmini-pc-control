import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTaskXmlBytes,coreQuietFromProbe} from './windows-guards.mjs';

const XML='<?xml version="1.0"?><Task><Settings><Enabled>true</Enabled></Settings></Task>';
const quiet=()=>({enabled:false,state:3,instances:0,
 relatedProcesses:0,unknownProcessLines:0});

test('Windows Task XML decoder preserves UTF-8/UTF-8 BOM/UTF-16LE identities',()=>{
 assert.equal(decodeTaskXmlBytes(Buffer.from(XML)),XML);
 assert.equal(decodeTaskXmlBytes(Buffer.concat([
  Buffer.from([0xef,0xbb,0xbf]),Buffer.from(XML)])),XML);
 assert.equal(decodeTaskXmlBytes(Buffer.concat([
  Buffer.from([0xff,0xfe]),Buffer.from(XML,'utf16le')])),XML);
 assert.equal(decodeTaskXmlBytes(Buffer.from(XML,'utf16le')),XML);
});

test('malformed Task XML bytes and unsupported UTF-16BE reject read-only',()=>{
 assert.throws(()=>decodeTaskXmlBytes(Buffer.from([0xfe,0xff,0,60,0,0])),
  {code:'WRITER_B_TASK_XML_ENCODING_STOP'});
 assert.throws(()=>decodeTaskXmlBytes(Buffer.from('not-xml')),
  {code:'WRITER_B_TASK_XML_STOP'});
 assert.throws(()=>decodeTaskXmlBytes(Buffer.from([0xff,0xfe,0x3c,0,0x3e])),
  {code:'WRITER_B_TASK_XML_ENCODING_STOP'});
});

test('Core drain requires disabled Task, no active instance/process, no cycle lock',()=>{
 assert.equal(coreQuietFromProbe(quiet(),false),true);
 for(const delta of [{enabled:true},{state:4},{instances:1},
  {relatedProcesses:1},{unknownProcessLines:1}])
  assert.equal(coreQuietFromProbe({...quiet(),...delta},false),false);
 assert.equal(coreQuietFromProbe(quiet(),true),false);
});
