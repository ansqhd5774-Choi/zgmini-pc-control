import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {classifyR181SourceForFixture,classifyPinnedR181Source,
 authenticateR181InspectEvent,OPERATION,REQUEST_SCHEMA,PIN}
 from '../tools/r181-source-shape-readonly.mjs';
import {runR181SourceShapeOnce}
 from '../tools/r181-source-shape-run.mjs';
import {sanitizeR181ShapeResult}
 from '../tools/r181-source-shape-report.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const fixture=()=>{
  const request={schema:REQUEST_SCHEMA,operation:OPERATION,
    controlRepository:REPO,beforeSha256:PIN,
    requestId:'00000000-0000-4000-8000-000000000001',
    chatId:'00000000-0000-4000-8000-000000000002'};
  const event={repository:{full_name:REPO,private:true},
    sender:{login:'ansqhd5774-Choi'},
    issue:{number:1555,title:OPERATION,
      user:{login:'ansqhd5774-Choi'},
      labels:[{name:'pc-writer-b-install'}],
      body:JSON.stringify(request)}};
  const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
    GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
    GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ID:'438000000001'};
  return {request,event,env};
};
const source=()=>{
  return ["const domain='https://getmarkethistory.com';",
    "const buildUrl=(ticker,start,end)=>domain+'/api/v1/bars/stocks/'+ticker+'/1h';",
    "const SPY='SPY';",
    "async function collect(){return fetch(buildUrl(SPY));}",
    "const secret='AUTHORIZATION_BEARER_EVERYTHING_PRIVATE';"].join('\n');
};
test('static classifier distinguishes one, absent, multiple old-route literals',()=>{
  const original=source();
  const one=classifyR181SourceForFixture(original);
  assert.equal(one.legacyRouteCountBucket,'ONE');
  assert.equal(one.literalHints.OLD_EXACT,true);
  assert.equal(one.runtimeUrlVerified,false);
  assert.equal(one.providerCalls,0);
  for(const [variant,expected] of [
    [original.replace('/api/v1/bars/stocks/',"'/api/v1/bars/' + 'stocks/'"),'ZERO'],
    [original+"\nconst backup='/api/v1/bars/stocks/';",'MULTIPLE']]){
    assert.equal(classifyR181SourceForFixture(variant).legacyRouteCountBucket,expected);
  }
});
test('malicious identifiers and literals never appear in de-identified output',()=>{
  const code=source()+"\nconst API_TOKEN_SUPER_SECRET='sk-special';";
  const v=classifyR181SourceForFixture(code);
  const out=JSON.stringify(v);
  for(const secret of ['AUTHORIZATION_BEARER_EVERYTHING_PRIVATE',
      'API_TOKEN_SUPER_SECRET','sk-special','getmarkethistory.com',
      '/api/v1/bars/stocks/'])assert.equal(out.includes(secret),false);
});
test('import-path discovery and URL parts expose only fixed masked evidence',()=>{
  const body=[
    "import {urlBuilder} from './r167-cycle.mjs';",
    "import fs from 'node:fs';",
    "const root='https://getmarkethistory.com';",
    "const request='?source=stocks&symbol=SPY';",
    "const API_SECRET_ACCESS='the-private-token-must-not-appear';",
  ].join('\n');
  const report=classifyR181SourceForFixture(body);
  assert.ok(report.importFiles.some(x=>
    x.basename==='r167-cycle.mjs'&&x.kind==='RELATIVE_MODULE'));
  assert.ok(report.literalSignalsByLine.some(x=>
    x.signals.includes('HOST_GMH')));
  assert.ok(report.literalSignalsByLine.some(x=>
    x.signals.includes('SOURCE_PARAM')&&
    x.signals.includes('SYMBOL_PARAM')));
  const serialized=JSON.stringify(report);
  assert.equal(serialized.includes('the-private-token-must-not-appear'),false);
  assert.equal(serialized.includes('https://getmarkethistory.com'),false);
});
test('pinned real classifier refuses synthetic and unexpected bytes',()=>{
  assert.throws(()=>classifyPinnedR181Source(Buffer.from(source())),
    e=>e.code==='R181_INSPECT_SOURCE_SIZE_STOP');
  assert.throws(()=>classifyPinnedR181Source(Buffer.alloc(7089,0x61)),
    e=>e.code==='R181_INSPECT_SOURCE_PIN_STOP');
});
test('fixed event identity and pinned source SHA are mandatory',()=>{
  const x=fixture();
  assert.equal(authenticateR181InspectEvent(x.event,x.env).requestId,x.request.requestId);
  x.event.issue.title='custom-shell';
  assert.throws(()=>authenticateR181InspectEvent(x.event,x.env),
    e=>e.code==='R181_INSPECT_EVENT_DENIED');
  x.event.issue.title=OPERATION;
  x.request.beforeSha256='b'.repeat(64);
  x.event.issue.body=JSON.stringify(x.request);
  assert.throws(()=>authenticateR181InspectEvent(x.event,x.env),
    e=>e.code==='R181_INSPECT_REQUEST_DENIED');
});
test('one valid readonly run yields only sanitized result; no provider call',async()=>{
  const x=fixture(),shape=classifyR181SourceForFixture(source());
  const r=await runR181SourceShapeOnce({...x,inspect:()=>shape});
  assert.equal(r.status,'PASS');
  assert.equal(r.code,'R181_SOURCE_SHAPE_READONLY');
  const clean=sanitizeR181ShapeResult(r,x.request,x.env);
  assert.equal(clean.status,'PASS');
  assert.equal(clean.shape.classification,'ONE');
  assert.equal(clean.operationalWrites,0);
  assert.equal(JSON.stringify(clean).includes('AUTHORIZATION_BEARER'),false);
});
test('reporter rejects forged source text in shape token field',()=>{
  const x=fixture(),shape=classifyR181SourceForFixture(source());
  const r={schema:'ZGMINI_R181_SHAPE_RESULT_V1',status:'PASS',
    code:'R181_SOURCE_SHAPE_READONLY',
    requestId:x.request.requestId,shape};
  const malicious={...r,shape:{...shape,safeShapeLines:[
    {line:1,shape:'PRIVATE_SECRET_TOKEN=sk-secret'}]}};
  assert.equal(sanitizeR181ShapeResult(malicious,x.request,x.env).status,
    'STATE_UNKNOWN');
});
test('imported R181 primary module is sanitized, never returns executable source',()=>{
  const x=fixture(),shape={...classifyR181SourceForFixture(source())};
  const dependencySource=[
    "const secret='GMH_API_KEY_PRIVATE_xxxxx';",
    "function buildUrl(ticker){return 'https://getmarkethistory.com/api/v1/foo/'+ticker;}",
    "export {buildUrl};",
  ].join('\n');
  shape.dependency={filename:'r181-primary.mjs',sha256:'a'.repeat(64),
    bytes:dependencySource.length,shape:classifyR181SourceForFixture(dependencySource)};
  const r={schema:'ZGMINI_R181_SHAPE_RESULT_V1',status:'PASS',
    code:'R181_SOURCE_SHAPE_READONLY',requestId:x.request.requestId,shape};
  const clean=sanitizeR181ShapeResult(r,x.request,x.env);
  assert.equal(clean.status,'PASS');
  assert.equal(clean.shape.dependency.sha256,'a'.repeat(64));
  assert.equal(JSON.stringify(clean).includes('GMH_API_KEY_PRIVATE'),false);
  assert.equal(JSON.stringify(clean).includes('https://getmarkethistory.com'),false);
  const invalid={...r,shape:{...shape,dependency:{...shape.dependency,
    filename:'custom-unapproved.mjs'}}};
  assert.equal(sanitizeR181ShapeResult(invalid,x.request,x.env).status,
    'STATE_UNKNOWN');
});
test('existing B workflow routes only explicit source-shape title',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const workflow=fs.readFileSync(path.join(here,'..','.github','workflows',
    'pc-writer-b-source-once.yml'),'utf8');
  assert.match(workflow,/r181-source-shape-readonly/);
  assert.match(workflow,/r181-source-shape-run\.mjs/);
  assert.match(workflow,/r181-source-shape-report\.mjs/);
  assert.match(workflow,/github\.event\.issue\.title == 'pc-writer-source-install'/);
});
