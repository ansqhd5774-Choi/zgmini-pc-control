import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorize,comparePrivateToSite,execute,REPO,TITLE,SCHEMA,OUTPUT,
 MANIFEST_SHA,PRIVATE_SHA,BASE_URL,PUBLIC_URL}
 from '../tools/w03-gmh-seven-public-compat-a.mjs';
import {sanitize} from '../tools/w03-gmh-seven-public-compat-report.mjs';
const REQUEST_ID='6a27b83f-f6c5-4a96-b85f-45c70bb7f24d';
const CONTROL='a'.repeat(40);
const NAMES=[
 ['로봇·자동화',['BOTZ','ROBO']],['클라우드·SaaS',['SKYY','CLOU']],
 ['자율주행',['DRIV','BOTZ']],['원전·SMR',['NLR','URA']],
 ['방산',['ITA','SHLD']],['핀테크',['FINX','ARKF']],
 ['사이버보안',['CIBR','BUG']]
];
const days=Array.from({length:252},(_,i)=>{
 const stamp=Date.parse('2026-11-13T00:00:00Z')+(i-251)*86400000;
 return new Date(stamp).toISOString().slice(0,10);
});
const scoreRows=()=>days.map(date=>({date,score:50}));
const themes=()=>NAMES.map(([theme,etfs])=>({theme,etfs:[...etfs],history:scoreRows()}));
const candidate=()=>({schema:'ZGMINI_W03_GMH_SEVEN_PRIVATE_252_V1',
 status:'PRIVATE_GMH_ONLY_7X252_NOT_PUBLISHED',
 observationDate:'2026-11-13',
 inputProvider:'GETMARKETHISTORY_FREE_HOURLY_ONLY',
 rawManifestSha256:MANIFEST_SHA,
 methodologyVersion:'ETF_ONLY_T40_R20_V40_PAIR50',
 publicationAuthorized:false,providerCalls:0,
 commonSessionCount:679,d1Writes:0,publicWrites:0,themes:themes(),
 privateSecret:'PRICE_789123_NOT_RETURN'});
const response=(status='READY')=>({httpStatus:status==='READY'?200:503,
 body:status==='READY'?{status:'READY',observationDate:'2026-11-13',
  themes:themes()}:{status:'UNAVAILABLE',reason:'STORED_DATA_PENDING'}});
const req=()=>({schema:SCHEMA,requestId:REQUEST_ID,
 chatId:'7f1c6a91-0dc7-44a8-a1c1-d810a5fb27aa',operation:TITLE,
 controlRepository:REPO,controlSourceSha:CONTROL,
 expectedManifestSha256:MANIFEST_SHA,
 expectedPrivateOutputSha256:PRIVATE_SHA});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:1712,title:TITLE,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req())}});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:CONTROL,
 GITHUB_RUN_ID:'43877770001'});
test('exact owner/immutable SHA one-shot is required before public GET',()=>{
 assert.equal(authorize(event(),env()).requestId,REQUEST_ID);
 for(const alter of [
  x=>x.repository.private=false,x=>x.issue.labels=[],
  x=>x.issue.title='w03-gmh-seven-history-manual-once',
  x=>{const v=JSON.parse(x.issue.body);v.extra='wrong';x.issue.body=JSON.stringify(v);},
  x=>{const v=JSON.parse(x.issue.body);v.expectedManifestSha256='f'.repeat(64);
   x.issue.body=JSON.stringify(v);},
  x=>{const v=JSON.parse(x.issue.body);v.controlSourceSha='f'.repeat(40);
   x.issue.body=JSON.stringify(v);}
 ]){
  const e=event();alter(e);
  assert.throws(()=>authorize(e,env()),{code:/W03_GMH_COMPAT_/});
 }
});
test('real-shape private score vs base and R32 public API has bounded results only',()=>{
 const first=response(),view=response();
 first.body.themes[0].history[0].score=51;
 view.body.themes[0].history[0].score=52;
 const stats=comparePrivateToSite(candidate(),first,view);
 assert.equal(stats.baseState,'READY');
 assert.equal(stats.publicState,'READY');
 assert.equal(stats.sharedDates,252);
 assert.equal(stats.comparedScores,1764);
 assert.equal(stats.mismatchedScores,1);
 assert.equal(stats.publicR32DifferentScores,1);
 assert.equal(stats.maxDiff,1);
 assert.equal(stats.publicationAuthorized,false);
 assert.equal(stats.d1SeedCasVerified,false);
 assert.equal(stats.r32NonRegressionVerified,false);
 assert.equal(stats.d1Writes,0);
 assert.ok(!JSON.stringify(stats).includes('PRICE_789123_NOT_RETURN'));
 const unavailable=comparePrivateToSite(candidate(),response('UNAVAILABLE'),response());
 assert.equal(unavailable.baseState,'UNAVAILABLE');
 assert.equal(unavailable.baseReason,'STORED_DATA_PENDING');
 assert.equal(unavailable.comparedScores,0);
 assert.equal(unavailable.baseStructureValid,false);
});
test('only fixed two public GETs, never provider or local mutation',async()=>{
 assert.equal(process.platform,'win32','isolated Windows CI required');
 const visited=[];
 const fakeFetch=async url=>{
  visited.push(url);
  const resp=response();
  return new Response(JSON.stringify(resp.body),{status:200,
   headers:{'content-type':'application/json'}});
 };
 const actual=await execute({event:event(),env:env(),load:candidate,fetchImpl:fakeFetch});
 assert.deepEqual(visited,[BASE_URL,PUBLIC_URL]);
 assert.equal(actual.status,'PASS');
 assert.equal(actual.facts.mismatchedScores,0);
 assert.equal(actual.providerCalls,0);
 assert.equal(actual.d1Writes,0);
 assert.equal(actual.publicWrites,0);
 assert.equal(actual.rawPriceExposed,false);
 const safe=sanitize(actual,req(),env());
 assert.equal(safe.status,'PASS');
 assert.equal(safe.facts.comparedScores,1764);
 assert.ok(!JSON.stringify(safe).includes('PRICE_789123_NOT_RETURN'));
 const tampered={...actual,facts:{...actual.facts,d1Writes:1}};
 assert.equal(sanitize(tampered,req(),env()).status,'STATE_UNKNOWN');
});
test('saved candidate first-fail on missing exact SHA provenance and 252 date alignment',()=>{
 const cases=[
  x=>x.rawManifestSha256='f'.repeat(64),
  x=>x.publicationAuthorized=true,
  x=>x.commonSessionCount=600,
  x=>x.themes[0].etfs=['OTHER','ROBO'],
  x=>x.themes[3].history=x.themes[3].history.slice(1),
  x=>x.themes[2].history[0].score=NaN
 ];
 for(const alter of cases){
  const x=candidate();alter(x);
  assert.throws(()=>comparePrivateToSite(x,response(),response()),
   {code:/W03_GMH_COMPAT_/});
 }
});
test('workflow uses only exact read-only route and has no publisher/collector invocation',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/pc-writer-b-source-once.yml',
  import.meta.url),'utf8');
 for(const str of [TITLE,'w03-gmh-seven-public-compat-a.mjs',
  'w03-gmh-seven-public-compat-report.mjs'])
  assert.ok(workflow.includes(str),str);
});
