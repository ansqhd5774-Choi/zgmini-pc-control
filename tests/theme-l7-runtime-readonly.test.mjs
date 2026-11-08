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
  assert.equal(out.ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic.status,'UNKNOWN');
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
  assert.equal(out.ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic.status,'UNKNOWN');
  assert.equal(JSON.stringify(out).includes('SECRET'),false);
 }finally{f.close();}
});

test('fixed ledgers expose bounded safe cause codes, stages, dates and version',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),JSON.stringify({
   status:'STOP',reasonCode:'SOURCE_FETCH_FAILED',
   failure:{firstFail:'COLLECT_SOURCE',errorCode:'SOURCE_TIMEOUT',
    message:'Authorization: Bearer VERY_SECRET_TOKEN',url:'https://private.example/token'},
   observedDate:'2026-11-07',modelVersion:'R181',
   token:'VERY_SECRET_TOKEN',price:197.50}));
  fs.writeFileSync(path.join(f.l7,'ZGMINI_R179_PUBLICATION_LAST_RUN.json'),JSON.stringify({
   status:'PUBLIC_API_ROLLING_MISMATCH',
   comparison:{expectedObservationDate:'2026-11-07',
    actualObservationDate:'2026-11-06',
    expectedModelVersion:'R179',actualModelVersion:'R178',
    mismatchCode:'PUBLIC_API_ROLLING_MISMATCH',
    expected:123.45,actual:118.11},
   error:'SECRET_TOKEN_AND_URL'}));
  fs.writeFileSync(path.join(f.l7,'R183_PUBLICATION_RETRY_LAST_RUN.json'),JSON.stringify({
   status:'PUBLISHER_CHILD_FAILED_REVIEW',
   publisher:{child:{failedStage:'PUBLISH_READBACK',
    failureCode:'PUBLISHER_CHILD_FAILED_REVIEW',
    reason:'https://secret.example/?api_key=VERY_SECRET_TOKEN'}}}));
  const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot});
  const a=out.ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  const b=out.ledgers['ZGMINI_R179_PUBLICATION_LAST_RUN.json'].diagnostic;
  const c=out.ledgers['R183_PUBLICATION_RETRY_LAST_RUN.json'].diagnostic;
  assert.equal(a.status,'SAFE_VALUES_FOUND');
  assert.ok(a.values.some(x=>x.path==='reasonCode'&&x.value==='SOURCE_FETCH_FAILED'));
  assert.ok(a.values.some(x=>x.path==='failure.firstFail'&&x.value==='COLLECT_SOURCE'));
  assert.ok(a.values.some(x=>x.path==='modelVersion'&&x.value==='R181'));
  assert.ok(b.values.some(x=>x.path==='comparison.expectedObservationDate'&&x.value==='2026-11-07'));
  assert.ok(b.values.some(x=>x.path==='comparison.actualObservationDate'&&x.value==='2026-11-06'));
  assert.ok(c.values.some(x=>x.path==='publisher.child.failedStage'&&x.value==='PUBLISH_READBACK'));
  assert.ok(c.values.some(x=>x.path==='publisher.child.failureCode'&&x.value==='PUBLISHER_CHILD_FAILED_REVIEW'));
  const json=JSON.stringify(out);
  for(const secret of ['VERY_SECRET_TOKEN','secret.example','private.example','123.45','118.11','197.5'])
   assert.equal(json.includes(secret),false,secret);
  assert.equal(out.providerCalls,0);
  assert.equal(out.operationalWrites,0);
 }finally{f.close();}
});

test('malformed fields show only safe path and type, not arbitrary strings',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),JSON.stringify({
   status:'STOP',reason:'SECRET_TOKEN',reasonCode:'https://secret.example/path',
   failure:{firstFail:'any freeform source key=SECRET',
    expectedDate:'2026-02-30',modelVersion:'PRIVATE_TOKEN',
    errorCode:'SOURCE_FAILED_SECRET_TOKEN',failedStage:'PUBLISH_SECRET'},
   diagnostic:{lastPass:33,actualDate:['2026-11-07']}}));
  const d=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
   .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  assert.equal(d.status,'CANDIDATES_WITHOUT_SAFE_VALUE');
  assert.ok(d.fields.some(f=>f.path==='reason'&&f.type==='string'));
  assert.ok(d.fields.some(f=>f.path==='diagnostic.lastPass'&&f.type==='number'));
  assert.ok(d.fields.some(f=>f.path==='diagnostic.actualDate'&&f.type==='array'));
  assert.deepEqual(d.values,[]);
  const json=JSON.stringify(d);
  assert.equal(json.includes('SECRET'),false);
  assert.equal(json.includes('https://'),false);
 }finally{f.close();}
});

test('snake_case allowlisted aliases are inspected without scanning arbitrary names',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),JSON.stringify({
   status:'STOP',reason_code:'SOURCE_FETCH_FAILED',
   failure:{error_code:'SOURCE_TIMEOUT',last_success_stage:'COLLECT_SOURCE',
    failed_stage:'PUBLISH_READBACK',unexpected_payload:'PRIVATE_SECRET'},
   expected_observation_date:'2026-11-07',
   actual_observation_date:'2026-11-06',model_version:'R181'}));
  const d=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
   .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  assert.ok(d.values.some(x=>x.path==='reason_code'&&x.value==='SOURCE_FETCH_FAILED'));
  assert.ok(d.values.some(x=>x.path==='failure.last_success_stage'&&x.value==='COLLECT_SOURCE'));
  assert.ok(d.values.some(x=>x.path==='failure.failed_stage'&&x.value==='PUBLISH_READBACK'));
  assert.ok(d.values.some(x=>x.path==='expected_observation_date'&&x.value==='2026-11-07'));
  assert.equal(JSON.stringify(d).includes('PRIVATE_SECRET'),false);
 }finally{f.close();}
});

test('candidate list and nested search remain bounded for large malformed structures',()=>{
 const f=fixture();try{
  const failure={};for(let i=0;i<70;i++)failure['untrusted'+i]='PRIVATE_SECRET_'+i;
  const root={status:'STOP',failure,diagnostic:{}};
  for(let i=0;i<60;i++)root['untrusted'+i]='PRIVATE_SECRET_'+i;
  root.diagnostic.failure={failureStage:'PUBLISH_READBACK'};
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),JSON.stringify(root));
  const d=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
   .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  assert.equal(d.truncated,true);
  assert.ok(d.fields.length<=24);
  assert.ok(d.values.length<=16);
  assert.equal(JSON.stringify(d).includes('PRIVATE_SECRET'),false);
 }finally{f.close();}
});

test('legacy freeform R181 STOP reason yields only a fixed safe category hint',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),JSON.stringify({
   status:'STOP',reason:'fetch failed after timeout',
   observedDate:'2026-11-07',token:'DO_NOT_EXPOSE_TOKEN',
   other:{rawPrices:[123.45,789.01]}}));
  const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
   .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  assert.equal(out.status,'SAFE_VALUES_FOUND');
  assert.ok(out.values.some(v=>v.path==='reason.categoryHint'&&
   v.value==='L7_HINT_NETWORK_FAILURE'));
  const json=JSON.stringify(out);
  for(const secret of ['fetch failed after timeout','DO_NOT_EXPOSE_TOKEN','123.45','789.01'])
   assert.equal(json.includes(secret),false);
 }finally{f.close();}
});

test('freeform secrets and ambiguous causes stay unclassified',()=>{
 const f=fixture();try{
  for(const reason of [
   'https://secret.example?api_key=PRIVATE 429',
   'Authorization Bearer token 403',
   'fetch failed due to HTTP 429 quota exceeded',
   'private user id ABC123',
   'Authorization Bearer PRIVATE_SECRET_TOKEN',
  ]){
   fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),
    JSON.stringify({status:'STOP',reason}));
   const result=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
    .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
   assert.deepEqual(result.values,[],reason);
   assert.equal(JSON.stringify(result).includes(reason),false);
  }
 }finally{f.close();}
});
