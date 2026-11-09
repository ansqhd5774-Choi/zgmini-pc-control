import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectThemeL7RuntimeReadonly,safeR181SourceStructure,
 safeR181ErrorFlow,safeR181HttpErrorFlow} from '../controller/theme-l7-runtime-readonly.mjs';

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

test('unknown production-style STOP prose returns fixed lexical signals without raw reason',()=>{
 const f=fixture();try{
  const reason='NO_NEW_COMPLETE_PRIMARY_DATE yet; latest ETF coverage still incomplete #9917';
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),
   JSON.stringify({status:'STOP',reason,irrelevant:'SENSITIVE_OBSERVATIONS'}));
  const d=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
   .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  assert.equal(d.status,'CANDIDATES_WITHOUT_SAFE_VALUE');
  assert.deepEqual(d.values,[]);
  assert.deepEqual(d.reasonProfiles,[{
   path:'reason',status:'FIXED_SIGNALS',
   signals:['COMPLETE','COVERAGE','DATE','ETF','INCOMPLETE','LATEST',
    'NEW','NO','PRIMARY'],
  }]);
  const json=JSON.stringify(d);
  for(const forbidden of [reason,'9917','SENSITIVE_OBSERVATIONS','yet'])
   assert.equal(json.includes(forbidden),false);
 }finally{f.close();}
});

test('freeform reason signals suppress sensitive values and do not emit arbitrary words',()=>{
 const f=fixture();try{
  for(const reason of [
   'unmappedprovidererror_XYZ456898',
   'Private key at C:\\secret\\foo.mjs; NO_NEW_DATE',
   'Bearer abc.def.ghi; MISSING PRIMARY DATA',
   'reason@example.com; MARKET CLOSED',
   'NO_NEW_DATE '.repeat(48),
  ]){
   fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),
    JSON.stringify({status:'STOP',reason}));
   const d=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
    .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
   assert.deepEqual(d.values,[]);
   assert.equal(JSON.stringify(d).includes(reason),false);
   if(reason==='unmappedprovidererror_XYZ456898'){
    assert.deepEqual(d.reasonProfiles,[{
     path:'reason',status:'NO_FIXED_SIGNALS',signals:[],
    }]);
   }else assert.deepEqual(d.reasonProfiles,[]);
  }
 }finally{f.close();}
});

test('lexical signals are bounded, unique and stable for repeated unknown prose',()=>{
 const f=fixture();try{
  const reason='NO NEW NOT READY COMPLETE INCOMPLETE PRIMARY SECONDARY SOURCE PROVIDER GMH MARKETPARQUET ETF ETFS SPY COVERAGE';
  fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),
   JSON.stringify({status:'STOP',reason}));
  const d=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot})
   .ledgers['R181_PRIMARY_LAST_RUN.json'].diagnostic;
  assert.equal(d.reasonProfiles[0].signals.length,12);
  assert.equal(new Set(d.reasonProfiles[0].signals).size,12);
  assert.deepEqual(d.reasonProfiles[0].signals,[...d.reasonProfiles[0].signals].sort());
 }finally{f.close();}
});

test('approved PC source diagnostic never returns source code or credentials',()=>{
 const source=[
  "const secret='supersecret987';",
  "const url='https://provider.example/api?token=private';",
  "const response=await fetch(url,{headers:{Authorization:secret}});",
  "if(response.status!==200)throw Error('R181_SPY_HTTP_'+response.status);",
  "const ledger={status:'STOP',reason:'R181_SPY_HTTP_500'};",
  "try { fail(); } catch(e) { return {reason:e.message}; }",
 ].join('\n');
 const d=safeR181SourceStructure(source);
 assert.equal(d.status,'STRUCTURE_ONLY');
 assert.ok(d.sites.some(x=>x.kinds.includes('REASON_ASSIGNMENT')));
 assert.ok(d.sites.some(x=>x.kinds.includes('R181_SPY_HTTP_MARKER')));
 const json=JSON.stringify(d);
 for(const secret of ['supersecret987','private','Authorization','provider.example','R181_SPY_HTTP_500','response.status'])
  assert.equal(json.includes(secret),false);
 assert.ok(d.sites.every(x=>Number.isInteger(x.line)&&x.line>0&&
  x.kinds.every(k=>/^[A-Z0-9_]+$/.test(k))));
});

test('unapproved R181 source fingerprint is not structurally inspected',()=>{
 const f=fixture();try{
  const result=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot});
  assert.deepEqual(result.sources['r181-primary-cycle.mjs'].safeSourceInspection,
   {status:'SOURCE_PIN_OR_SIZE_MISMATCH',sites:[],truncated:false});
  assert.deepEqual(result.sources['r181-primary-cycle.mjs'].safeHttpErrorFlow,
   {status:'SOURCE_PIN_OR_SIZE_MISMATCH',sites:[],lines:[],truncated:false});
  assert.equal(result.ledgers['R181_PRIMARY_LAST_RUN.json'].safeHttpFailure,null);
 }finally{f.close();}
});

test('fixed R181 SPY HTTP reason extracts only a valid HTTP status',()=>{
 const f=fixture();try{
  for(const [reason,want] of [
   ['R181_SPY_HTTP_503',{source:'R181_SPY_HTTP',status:503,group:'SERVER_5XX'}],
   ['R181_SPY_HTTP_404',{source:'R181_SPY_HTTP',status:404,group:'CLIENT_4XX'}],
   ['R181_SPY_HTTP_429?token=secret',null],
   ['RAW_COUNT_503',null],
   ['R181_SPY_HTTP_999',null],
  ]){
   fs.writeFileSync(path.join(f.l7,'R181_PRIMARY_LAST_RUN.json'),
    JSON.stringify({status:'STOP',reason}));
   const out=inspectThemeL7RuntimeReadonly({dataRoot:f.dataRoot});
   assert.deepEqual(out.ledgers['R181_PRIMARY_LAST_RUN.json'].safeHttpFailure,want);
  }
 }finally{f.close();}
});

test('source diagnostic is bounded on long or hostile source text',()=>{
 const huge='throw new Error("SECRETVALUE")\n'.repeat(400);
 assert.deepEqual(safeR181SourceStructure(huge),
  {status:'UNREADABLE_SOURCE',sites:[],truncated:false});
 const limited=safeR181SourceStructure('throw Error("SECRET")\n'.repeat(30));
 assert.equal(limited.sites.length,16);
 assert.equal(limited.truncated,true);
 assert.equal(JSON.stringify(limited).includes('SECRET'),false);
});

test('R181 error-flow view preserves control structure but strips literals, tokens and identifiers',()=>{
 const source=Array.from({length:105},(_,i)=>{
  if(i===10)return 'if (rsp.status !== 200) throw new Error(`R181_SPY_HTTP_${rsp.status}:${secretApiKey}`);';
  if(i===11)return "const token = 'ghp_letmeinSECRET'; // API key for provider";
  if(i===87)return "} catch (providerError) { const reason = `R181_SPY_HTTP_${providerError.message}`;";
  if(i===88)return '  saveLedger({ status: "STOP", reason, password: process.env.PROVIDER_SECRET });';
  if(i===89)return '  throw providerError;';
  return 'const harmless = 3;';
 }).join('\n');
 const output=safeR181ErrorFlow(source);
 assert.equal(output.status,'REDACTED_ERROR_FLOW');
 assert.deepEqual(output.lines.map(x=>x.line),[
  ...Array.from({length:13},(_,i)=>i+7),
  ...Array.from({length:18},(_,i)=>i+81),
 ]);
 const json=JSON.stringify(output);
 for(const secret of ['ghp_letmeinSECRET','secretApiKey','providerError',
  'process','PROVIDER_SECRET','password','token','API key','R181_SPY_HTTP_',
  'saveLedger','rsp.status','200'])assert.equal(json.includes(secret),false,secret);
 assert.ok(output.lines.find(x=>x.line===88).pattern.includes('catch'));
 assert.ok(output.lines.find(x=>x.line===89).pattern.includes('status'));
 assert.ok(json.length<8500);
});

test('R181 redacted source handles multiline comments, strings and template values',()=>{
 const source=['/* sensitive id API_KEY_123','more private details */',
  'const key = "https://foo/private?key=ghp_testSECRET";',
  'const template = `token=${process.env.GH_SECRET}',
  'private-data-${foo}`;',
  'try { fn(); } catch(ex) { throw ex; }'].join('\n');
 const output=safeR181ErrorFlow(source);
 const json=JSON.stringify(output);
 for(const forbidden of ['API_KEY_123','private','GH_SECRET','ghp_testSECRET',
  'foo','key=','token='])assert.equal(json.includes(forbidden),false,forbidden);
 assert.deepEqual(safeR181ErrorFlow('throw Error("x")\n'.repeat(1000)),
  {status:'UNREADABLE_SOURCE',lines:[]});
});

test('approved middle R181 error branch is selected only from redacted code tokens',()=>{
 const lines=Array.from({length:110},()=> 'const field = "ordinary";');
 lines[34]='const httpResponse = await fetch("https://secret.example/?api_key=PRIVATE_TOKEN");';
 lines[50]='if (httpResponse.status !== 200) throw new Error(`R181_SPY_HTTP_${httpResponse.status}`);';
 lines[62]='// throw fetch R181_SPY_HTTP_502 token=SECRET should never select this line';
 lines[69]='const label="throw fetch response.status R181_SPY_HTTP_503 SECRET";';
 lines[72]='const multiline=`throw fetch';
 lines[73]='response.status SECRET`;';
 lines[78]='const result = await getPublicData();';
 const source=lines.join('\n');
 const out=safeR181HttpErrorFlow(source);
 assert.equal(out.status,'STATIC_SOURCE_FLOW_ONLY');
 assert.deepEqual(out.sites,[35,51]);
 assert.ok(out.lines.some(x=>x.line===35));
 assert.ok(out.lines.some(x=>x.line===51));
 assert.equal(out.lines.some(x=>x.line===63||x.line===70||x.line===74||x.line===79),false);
 assert.ok(out.lines.every(x=>x.line>=20&&x.line<=80&&x.pattern.length<=240));
 const json=JSON.stringify(out);
 for(const secret of ['PRIVATE_TOKEN','secret.example','api_key','R181_SPY_HTTP_','502',
  '503','getPublicData','httpResponse','SECRET','httpResponse.status'])
  assert.equal(json.includes(secret),false,secret);
 assert.ok(json.length<6500);
});

test('R181 error branch inventory is bounded and never claims a runtime failure',()=>{
 const source=Array.from({length:105},()=> 'throw new Error("SECRET_VALUE");').join('\n');
 const out=safeR181HttpErrorFlow(source);
 assert.equal(out.status,'STATIC_SOURCE_FLOW_ONLY');
 assert.equal(out.sites.length,8);
 assert.equal(out.truncated,true);
 assert.ok(out.lines.length<=24);
 assert.ok(out.lines.every(x=>x.line>=20&&x.line<=80));
 assert.equal(JSON.stringify(out).includes('SECRET_VALUE'),false);
 assert.deepEqual(safeR181HttpErrorFlow('throw Error("x")\n'.repeat(1000)),
  {status:'UNREADABLE_SOURCE',sites:[],lines:[],truncated:false});
});
