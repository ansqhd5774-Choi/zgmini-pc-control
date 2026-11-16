import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {authorize,compareD1Seed,execute,REPO,TITLE,SCHEMA,OUTPUT}
 from '../tools/w03-gmh-seven-d1-seed-a.mjs';
import {APPROVED_SOURCE_SHA} from '../tools/w03-gmh-seven-manual-once.mjs';
import {MANIFEST_SHA,PRIVATE_SHA}
 from '../tools/w03-gmh-seven-public-compat-a.mjs';
import {sanitize} from '../tools/w03-gmh-seven-d1-seed-report.mjs';
const HEAD='b'.repeat(40);
const ID='537b096e-2ba0-42e1-a1a5-163a99b28045';
const NAMES=[
 ['로봇·자동화',['BOTZ','ROBO']],['클라우드·SaaS',['SKYY','CLOU']],
 ['자율주행',['DRIV','BOTZ']],['원전·SMR',['NLR','URA']],
 ['방산',['ITA','SHLD']],['핀테크',['FINX','ARKF']],
 ['사이버보안',['CIBR','BUG']]
];
const days=Array.from({length:252},(_,i)=>
 new Date(Date.parse('2026-11-13T00:00:00Z')+(i-251)*86400000)
  .toISOString().slice(0,10));
const themes=()=>NAMES.map(([theme,etfs])=>({
 theme,etfs:[...etfs],history:days.map(date=>({date,score:50}))
}));
const candidate=()=>({schema:'ZGMINI_W03_GMH_SEVEN_PRIVATE_252_V1',
 status:'PRIVATE_GMH_ONLY_7X252_NOT_PUBLISHED',
 inputProvider:'GETMARKETHISTORY_FREE_HOURLY_ONLY',
 rawManifestSha256:MANIFEST_SHA,
 methodologyVersion:'ETF_ONLY_T40_R20_V40_PAIR50',
 publicationAuthorized:false,providerCalls:0,d1Writes:0,publicWrites:0,
 observationDate:'2026-11-13',commonSessionCount:679,themes:themes()});
const seed=()=>({status:'READY',version:'THEME_ETF_ONLY_R144_252_PUBLIC_V1',
 methodologyVersion:'ETF_ONLY_T40_R20_V40_PAIR50',
 observationDate:'2026-11-13',themes:themes()});
const hashSeed=s=>createHash('sha256').update(JSON.stringify(s.themes.map(t=>({
 theme:t.theme,etfs:t.etfs,history:t.history})))).digest('hex');
const rolling=s=>({status:'READY',version:'THEME_ETF_ROLLING_R178',
 observationDate:'2026-11-13',baseHash:hashSeed(s),
 lineage:{primarySource:'GETMARKETHISTORY_1H_CLOSE',secondarySource:null}});
const row=(body,at=1794888888000)=>({body:JSON.stringify(body),stored_at:at});
const request=()=>({schema:SCHEMA,operation:TITLE,requestId:ID,
 chatId:'d1e8d55b-c797-48cc-9751-0db70b41a610',
 controlRepository:REPO,controlSourceSha:HEAD,
 candidateSourceSha:APPROVED_SOURCE_SHA,
 expectedManifestSha256:MANIFEST_SHA,
 expectedPrivateOutputSha256:PRIVATE_SHA});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:1723,title:TITLE,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(request())}});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:HEAD,
 GITHUB_RUN_ID:'43888880001'});
test('only one owner-opened read-only D1 request with exact output pins is allowed',()=>{
 assert.equal(authorize(event(),env()).requestId,ID);
 for(const mutate of [
  x=>x.repository.private=false,
  x=>x.issue.labels=[],
  x=>x.issue.title='w03-gmh-seven-private-score-once',
  x=>{const a=JSON.parse(x.issue.body);a.extra='WRONG';x.issue.body=JSON.stringify(a);},
  x=>{const a=JSON.parse(x.issue.body);a.expectedPrivateOutputSha256='f'.repeat(64);
   x.issue.body=JSON.stringify(a);}
 ]){const e=event();mutate(e);
  assert.throws(()=>authorize(e,env()),{code:/W03_GMH_D1_/});
 }
});
test('D1 base and rolling seed compare 7x252 and emit no score or raw bar values',()=>{
 const s=seed(),roll=rolling(s);
 const result=compareD1Seed(candidate(),row(s),row(roll));
 assert.equal(result.seedPresent,true);
 assert.equal(result.seedSchemaValid,true);
 assert.equal(result.overlapDates,252);
 assert.equal(result.comparedScores,1764);
 assert.equal(result.mismatchedScores,0);
 assert.equal(result.rollingBaseHashMatches,true);
 assert.equal(result.rollingPrimaryGmh,true);
 assert.equal(result.rollingSecondaryNone,true);
 assert.equal(result.d1Writes,0);
 assert.equal(result.publicationAuthorized,false);
 assert.ok(!JSON.stringify(result).includes('"score":50'));
 const x=seed();x.themes[0].history[5].score=47;
 const diff=compareD1Seed(candidate(),row(x),row(rolling(x)));
 assert.equal(diff.mismatchedScores,1);
 assert.equal(diff.maxScoreDifference,3);
});
test('stale or absent D1 base cannot be described as compatible and never writes',()=>{
 const a=compareD1Seed(candidate(),null,null);
 assert.equal(a.seedPresent,false);
 assert.equal(a.seedSchemaValid,false);
 assert.equal(a.comparedScores,0);
 assert.equal(a.rollingPresent,false);
 assert.equal(a.rollingBaseHashMatches,null);
 assert.equal(a.d1Writes,0);
 const b=compareD1Seed(candidate(),row({status:'STALE'}),row({version:'INVALID'}));
 assert.equal(b.seedPresent,true);
 assert.equal(b.seedSchemaValid,false);
 assert.equal(b.comparedScores,0);
 assert.equal(b.rollingSchema,'OTHER_OR_UNKNOWN');
});
test('isolated Windows compute/data read-only plan cannot leak D1 raw content',async()=>{
 assert.equal(process.platform,'win32','run fixture in isolated Windows CI');
 const value=await execute({event:event(),env:env(),sourceRoot:'E:\\approved',
  load:candidate,query:async({sourceRoot})=>{
   assert.equal(sourceRoot,'E:\\approved');
   const s=seed();return{seed:row(s),rolling:row(rolling(s))};
  }});
 assert.equal(value.status,'PASS');
 assert.equal(value.facts.comparedScores,1764);
 assert.equal(value.publicWrites,0);
 assert.equal(value.d1Writes,0);
 const safe=sanitize(value,request(),env());
 assert.equal(safe.status,'PASS');
 assert.equal(safe.facts.seedSchemaValid,true);
 assert.equal(safe.facts.mismatchedScores,0);
 const bad={...value,facts:{...value.facts,d1Writes:1}};
 assert.equal(sanitize(bad,request(),env()).status,'STATE_UNKNOWN');
 assert.ok(!JSON.stringify(safe).includes('"score":50'));
});
test('D1 source reads two fixed SELECTs and never issues credential refresh',()=>{
 const s=readFileSync(new URL('../tools/w03-gmh-seven-d1-seed-a.mjs',
  import.meta.url),'utf8');
 assert.ok(s.includes('SELECT body,stored_at FROM market_public_snapshots_v1'));
 assert.ok(s.includes('SELECT body,stored_at FROM public_feed_snapshots_v1'));
 assert.ok(s.includes('apiToken:null'));
 assert.ok(s.includes('W03_GMH_D1_OAUTH_REFRESH_FORBIDDEN_STOP'));
 assert.ok(s.includes('mod.client(binding,token).request(binding.core,statements)'));
 const w=readFileSync(new URL('../.github/workflows/pc-writer-b-source-once.yml',
  import.meta.url),'utf8');
 for(const file of [TITLE,'w03-gmh-seven-d1-seed-preflight.mjs',
  'w03-gmh-seven-d1-seed-a.mjs','w03-gmh-seven-d1-seed-report.mjs'])
  assert.ok(w.includes(file),file);
});
