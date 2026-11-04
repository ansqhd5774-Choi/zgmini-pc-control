import assert from 'node:assert/strict';
import test from 'node:test';
import {SCHEMA,SOURCE_SHA,TITLE,REPO,API,verifyRequest,
 comparePayloads,readPublic,reportName,sanitizeReport} from './inflation19-public-diff-a-once.mjs';

const uuid='204fba2d-3fc5-4d21-aac1-6ad12859ec52';
const event=()=>({action:'opened',repository:{private:true,full_name:REPO},
 issue:{number:307,user:{login:'ansqhd5774-Choi'},title:TITLE,
  body:JSON.stringify({schema:SCHEMA,operation:'compare-private-pc-to-public-api-readonly-once',
   sourceSha:SOURCE_SHA,requestId:'pc-infl19-diff-'+uuid,chatId:'chat-'+uuid})}});
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'};
const now=Date.parse('2026-11-04T15:00:00Z');
const ids=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const make=(storedAt=now-120000)=>({status:'READY',score:null,
 sourceVersion:'INFL19_PRESENTATION_'+ 'a'.repeat(64),sourceStoredAt:storedAt,
 indicators:ids.map(id=>({id,series:'SERIES'+id,unit:'index',status:'READY',
  value:10,previousValue:9,observationDate:'2026-09-01',
  previousObservationDate:'2026-08-01',availableAt:null,
  sourceStoredAt:'2026-11-04T09:00:00.000Z',history:[{date:'2026-09',value:10}]}))});
const validator=p=>{assert.equal(p.indicators.length,19);assert.equal(p.status,'READY');return p};

test('exact private issue request: UUID pair, actor, attempt, source and no extra fields',()=>{
 assert.equal(verifyRequest(event(),env,{platform:'win32'}).sourceSha,SOURCE_SHA);
 const mismatch=event();let b=JSON.parse(mismatch.issue.body);b.chatId='chat-bb04a97e-4540-44f6-8ab0-86393f9fe701';
 mismatch.issue.body=JSON.stringify(b);
 assert.throws(()=>verifyRequest(mismatch,env,{platform:'win32'}),/REQUEST_DENIED/);
 assert.throws(()=>verifyRequest(event(),{...env,GITHUB_RUN_ATTEMPT:'2'},{platform:'win32'}),/ISSUE_DENIED/);
 assert.throws(()=>verifyRequest(event(),{...env,GITHUB_ACTOR:'other'},{platform:'win32'}),/ISSUE_DENIED/);
 const extra=event();b=JSON.parse(extra.issue.body);b.command='whoami';extra.issue.body=JSON.stringify(b);
 assert.throws(()=>verifyRequest(extra,env,{platform:'win32'}),/REQUEST_DENIED/);
 assert.equal(reportName(307),'INFL19_PC_PUBLIC_DIFF_307.json');
});
test('equal 19 public and PC inputs yield MATCH, no writes',()=>{
 const a=make(),b=structuredClone(a);
 const result=comparePayloads(a,b,{validate:validator,now});
 assert.equal(result.code,'INFLDIFF_MATCH');assert.equal(result.changedIds.length,0);
 assert.equal(result.diffClass,'MATCH');
 assert.equal(result.pcSourceVersion,result.publicSourceVersion);
 assert.equal(result.dbWrites,0);assert.equal(result.d1Writes,0);assert.equal(result.providerCalls,0);
});
test('changed value/history and metadata report only id and field names',()=>{
 const a=make(),b=structuredClone(a);
 a.sourceVersion='INFL19_PRESENTATION_'+'b'.repeat(64);
 a.sourceStoredAt+=30000;
 a.indicators[0].value=11;a.indicators[0].history[0].value=11;
 a.indicators[1].sourceStoredAt='2026-11-04T11:00:00.000Z';
 const result=comparePayloads(a,b,{validate:validator,now});
 assert.deepEqual(result.changedIds,['1','3']);
 assert.deepEqual(result.changedFieldNames['1'],['value','history']);
 assert.deepEqual(result.changedFieldNames['3'],['sourceStoredAt']);
 assert.equal(result.diffClass,'DATA_OR_HISTORY');
 assert.deepEqual(result.topLevelChangedFields,['sourceStoredAt']);
 assert.notEqual(result.pcSourceVersion,result.publicSourceVersion);
 assert.equal(JSON.stringify(result).includes('SERIES'),false);
 assert.equal(JSON.stringify(result).includes('11:00:00'),false);
 assert.equal(result.pcSourceStoredAt,now-90000);
});
test('metadata-only row update is distinguished from top-level checkpoint drift',()=>{
 const a=make(),b=structuredClone(a);a.sourceVersion='INFL19_PRESENTATION_'+'b'.repeat(64);
 a.indicators[0].sourceStoredAt='2026-11-04T09:05:00.000Z';
 const metadata=comparePayloads(a,b,{validate:validator,now});
 assert.equal(metadata.diffClass,'METADATA_ONLY');
 assert.deepEqual(metadata.changedFieldNames['1'],['sourceStoredAt']);
 assert.deepEqual(metadata.topLevelChangedFields,[]);
 const top=make(),prior=structuredClone(top);top.sourceStoredAt+=1000;
 const topOnly=comparePayloads(top,prior,{validate:validator,now});
 assert.equal(topOnly.code,'INFLDIFF_CHANGED');
 assert.equal(topOnly.diffClass,'METADATA_ONLY');
 assert.deepEqual(topOnly.changedIds,[]);
 assert.deepEqual(topOnly.topLevelChangedFields,['sourceStoredAt']);
});
test('same version but different rows or different version with same rows fail closed',()=>{
 const a=make(),b=structuredClone(a);a.indicators[0].value=11;
 assert.throws(()=>comparePayloads(a,b,{validate:validator,now}),/VERSION_COLLISION/);
 a.indicators[0].value=10;a.sourceVersion='INFL19_PRESENTATION_'+'b'.repeat(64);
 assert.throws(()=>comparePayloads(a,b,{validate:validator,now}),/VERSION_UNEXPLAINED/);
});
test('incomplete coverage, invalid public contract and identity mismatch fail closed',()=>{
 const a=make(),b=structuredClone(a);
 b.status='PARTIAL';assert.throws(()=>comparePayloads(a,b,{validate:validator,now}),/PUBLIC_CONTRACT_DENIED/);
 b.status='READY';b.indicators[0].id='invalid';
 assert.throws(()=>comparePayloads(a,b,{validate:validator,now}),/IDENTITY_DENIED/);
 assert.throws(()=>comparePayloads(a,make(),{validate:()=>{throw Error('bad')}}),/PUBLIC_CONTRACT_DENIED/);
});
test('single public GET is fixed, rejects redirect, malformed and oversized response',async()=>{
 const body=JSON.stringify(make());const seen=[];
 const ok=await readPublic(async (url,options)=>{seen.push({url,options});return new Response(body,{status:200,headers:{'content-type':'application/json'}})});
 assert.equal(ok.status,'READY');assert.equal(seen.length,1);assert.equal(seen[0].url,API);
 assert.equal(seen[0].options.redirect,'manual');
 await assert.rejects(()=>readPublic(async()=>new Response('',{status:302})),/PUBLIC_HTTP_DENIED/);
 await assert.rejects(()=>readPublic(async()=>new Response('{bad',{status:200,headers:{'content-type':'application/json'}})),/PUBLIC_BODY_DENIED|PUBLIC_JSON_DENIED/);
 await assert.rejects(()=>readPublic(async()=>new Response('x'.repeat(60001),{status:200,headers:{'content-type':'application/json'}})),/PUBLIC_BODY_DENIED/);
});
test('upload redaction allowlist rejects arbitrary fields and hidden values',()=>{
 const report={schema:SCHEMA,status:'PASS',code:'INFLDIFF_CHANGED',
  issueNumber:308,requestId:'pc-infl19-diff-'+uuid,changedIds:['1'],
  changedFieldNames:{'1':['sourceStoredAt']},topLevelChangedFields:[],
  diffClass:'METADATA_ONLY',pcSourceVersion:'INFL19_PRESENTATION_'+'a'.repeat(64),
  publicSourceVersion:'INFL19_PRESENTATION_'+'b'.repeat(64),
  pcSourceStoredAt:Date.now()-1000,publicSourceStoredAt:Date.now()-2000,
  providerCalls:0,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
 const safe=sanitizeReport(report);
 assert.equal(safe.diffClass,'METADATA_ONLY');
 assert.equal(safe.changedFieldNames['1'][0],'sourceStoredAt');
 assert.equal(Object.hasOwn(safe,'privateValue'),false);
 assert.throws(()=>sanitizeReport({...report,changedFieldNames:{'1':['secret']}}),/REPORT_DENIED/);
 assert.throws(()=>sanitizeReport({...report,changedIds:['1','42']}),/REPORT_DENIED/);
 assert.throws(()=>sanitizeReport({...report,d1Writes:1}),/REPORT_DENIED/);
});
