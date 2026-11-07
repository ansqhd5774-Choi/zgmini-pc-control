import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectThemeL7RuntimeReadonly} from '../controller/theme-l7-runtime-readonly.mjs';

const names=['r181-primary-cycle.mjs','r179-publish-core.mjs','r171-publish.mjs'];
function fixture(){
 const dataRoot=fs.mkdtempSync(path.join(os.tmpdir(),'l7-runtime-readonly-'));
 const l7=path.join(dataRoot,'theme-market-history-r131','marketparquet-r167');
 fs.mkdirSync(l7,{recursive:true});
 for(const name of names)fs.writeFileSync(path.join(l7,name),'// a saved fixture');
 fs.writeFileSync(path.join(l7,'R181_PRIMARY_LAST_RUN.json'),JSON.stringify({
  status:'SOURCE_FAILED',observationDate:'2026-11-06',
  finishedAt:'2026-11-07T12:00:00.000Z',secret:'NO_OUTPUT_SECRET'}));
 return {dataRoot,l7,close(){fs.rmSync(dataRoot,{recursive:true,force:true});}};
}

test('reads only fixed L7 source hashes, narrow ledger fields and task metadata',()=>{
 const f=fixture();try{
  const xml='<Task><Actions><Exec><Command>E:\\ZGmini\\runtime\\node.exe</Command>'+
   '<Arguments>E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r181-primary-cycle.mjs --token SECRET_ARGUMENT</Arguments>'+
   '</Exec></Actions><Settings><Enabled>true</Enabled></Settings></Task>';
  const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot,
   queryTask:()=>Buffer.from(xml)});
  assert.equal(out.status,'PASS');
  assert.equal(out.operationalReadiness,'NOT_ASSERTED');
  assert.equal(out.task.enabled,true);
  assert.equal(out.task.referencesKnownCollector,true);
  assert.equal(out.ledgers['R181_PRIMARY_LAST_RUN.json'].status,'SOURCE_FAILED');
  assert.equal(out.ledgers['R181_PRIMARY_LAST_RUN.json'].dates.observationDate,'2026-11-06');
  assert.deepEqual(Object.keys(out.sources).sort(),[...names].sort());
  assert.ok(out.sources[names[0]].sha256.match(/^[a-f0-9]{64}$/));
  assert.equal(out.providerCalls,0);
  assert.equal(out.d1Writes,0);
  assert.equal(out.operationalWrites,0);
  assert.equal(JSON.stringify(out).includes('NO_OUTPUT_SECRET'),false);
  assert.equal(JSON.stringify(out).includes('SECRET_ARGUMENT'),false);
 }finally{f.close();}
});

test('missing installed L7 directory is reported without writing replacement files',()=>{
 const f=fixture();try{
  fs.renameSync(f.l7,f.l7+'-prior');
  const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot});
  assert.equal(out.sourceDirectory,'MISSING');
  assert.equal(out.sources[names[0]].present,false);
  assert.equal(out.ledgers['ZGMINI_R179_PUBLICATION_LAST_RUN.json'].present,false);
  assert.equal(out.task.status,'NOT_QUERIED');
  assert.equal(fs.existsSync(f.l7),false);
 }finally{f.close();}
});

test('Windows UTF-16LE task XML exposes only whitelisted task metadata',()=>{
 const f=fixture();try{
  const xml='<Task><Actions><Exec><Command>E:\\ZGmini\\runtime\\node.exe</Command>'+
   '<Arguments>E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r181-primary-cycle.mjs --secret TEST_SECRET</Arguments>'+
   '</Exec></Actions><Settings><Enabled>false</Enabled></Settings></Task>';
  const bytes=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(xml,'utf16le')]);
  const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot,queryTask:()=>bytes});
  assert.equal(out.task.status,'XML_READ');
  assert.equal(out.task.enabled,false);
  assert.equal(out.task.referencesKnownCollector,true);
  assert.equal(JSON.stringify(out).includes('TEST_SECRET'),false);
 }finally{f.close();}
});

test('symlinks and malformed ledger values cannot escape or leak the boundary',()=>{
 const f=fixture();try{
  const link=path.join(f.l7,names[0]);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),link);
  assert.throws(()=>inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot}),
   {code:'L7_READONLY_ENTRY_NOT_REGULAR'});
  fs.unlinkSync(link);fs.writeFileSync(link,'// a normal source');
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),
   '{"status":"secret","observationDate":"2026-13-99","token":"SECRET"}');
  const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot,
   queryTask:()=>{throw new Error('secret');}});
  assert.equal(out.task.status,'QUERY_UNAVAILABLE');
  assert.equal(out.ledgers['R181_PRIMARY_LAST_RUN.json'].status,'UNREPORTED');
  assert.deepEqual(out.ledgers['R181_PRIMARY_LAST_RUN.json'].dates,{});
  assert.equal(JSON.stringify(out).includes('SECRET'),false);
 }finally{f.close();}
});
