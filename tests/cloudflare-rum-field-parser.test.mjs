import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRumQuery,parseRumGraphql,GRAPHQL_QUERY,GRAPHQL_ENDPOINT,
 RUM_HOST,GOOD} from '../controller/cloudflare-rum-field-parser.mjs';
const startUtc='2026-11-24T00:00:00Z',endUtc='2026-11-25T00:00:00Z';
const from=rows=>({data:{viewer:{accounts:[{rumWebVitalsEventsAdaptiveGroups:rows}]}}});
const row=(path='/',device='mobile',q={
 largestContentfulPaintP75:2400000,interactionToNextPaintP75:180000,
 cumulativeLayoutShiftP75:0.08},count=1234)=>({count,dimensions:{
 requestHost:RUM_HOST,requestPath:path,deviceType:device},quantiles:q});
const all=()=>['/','/economic-indicators/'].flatMap(path=>
 ['mobile','desktop'].map(device=>row(path,device)));
const parse=r=>parseRumGraphql(r,{startUtc,endUtc});
test('static query is host-scoped, account-scoped, bounded, and not executable itself',()=>{
 const x=buildRumQuery({accountTag:'a'.repeat(32),startUtc,endUtc});
 assert.equal(x.endpoint,GRAPHQL_ENDPOINT);assert.equal(x.method,'POST');
 assert.equal(x.networkExecuted,false);assert.equal(x.registeredOperation,false);
 assert.match(GRAPHQL_QUERY,/requestHost: "zgmini.kr"/);
 // Cloudflare's Analytics schema uses the custom lowercase `string` scalar.
 assert.match(GRAPHQL_QUERY,/\$account: string!/);
 assert.doesNotMatch(GRAPHQL_QUERY,/\$account: String!/);
 assert.match(GRAPHQL_QUERY,/rumWebVitalsEventsAdaptiveGroups/);
 assert.match(GRAPHQL_QUERY,/largestContentfulPaintP75/);
 assert.doesNotMatch(GRAPHQL_QUERY,/mutation|subscription/i);
});
test('invalid account, windows, dates and future horizon are rejected',()=>{
 assert.throws(()=>buildRumQuery({accountTag:'bad',startUtc,endUtc}),/CF_RUM_ACCOUNT_INVALID/);
 for(const window of [{endUtc:startUtc},{startUtc:'2026-11-01T00:00:00Z'},
  {startUtc:'2026-11-24'},{endUtc:'2099-01-01T00:00:00Z'}]){
  assert.throws(()=>buildRumQuery({accountTag:'a'.repeat(32),startUtc,endUtc,...window}),
   /CF_RUM_WINDOW_INVALID/);
 }
});
test('P75 units: LCP and INP microseconds to ms, CLS unitless',()=>{
 const x=parse(from(all()));
 assert.equal(x.status,'P75_VALUES_PRESENT');
 assert.equal(x.code,'CF_RUM_ALL_SCOPED_METRICS_WITHIN_REFERENCE');
 assert.deepEqual(Object.fromEntries(Object.entries(x.observations[0].metrics).map(
  ([k,v])=>[k,v.p75])),{lcpMs:2400,inpMs:180,cls:0.08});
 assert.equal(x.observations[0].groupEventCount,1234);
 assert.equal(x.observations.length,4);
 assert.equal(x.siteGoodCertified,false);
 assert.equal(x.metricSampleSizesVerified,false);
 assert.equal(x.cruxEquivalent,false);
 assert.equal(x.mergeBlocking,false);
});
test('exact reference boundaries remain Good but tiny excess CLS does not',()=>{
 const q={largestContentfulPaintP75:2500000,interactionToNextPaintP75:200000,
  cumulativeLayoutShiftP75:0.1};
 assert.equal(parse(from(all().map(x=>({...x,quantiles:q})))).code,
 'CF_RUM_ALL_SCOPED_METRICS_WITHIN_REFERENCE');
 const bad={...q,cumulativeLayoutShiftP75:0.100001};
 const o=parse(from(all().map(x=>({...x,quantiles:bad}))));
 assert.equal(o.observations[0].metrics.cls.p75,GOOD.cls);
 assert.equal(o.observations[0].metrics.cls.state,'EXCEEDS_GOOD_REFERENCE');
 assert.equal(o.code,'CF_RUM_REFERENCE_EXCEEDED');
});
test('missing and negative metrics are null; real zero CLS stays zero',()=>{
 const rows=all();
 rows[0].quantiles={largestContentfulPaintP75:-1,
 interactionToNextPaintP75:null,cumulativeLayoutShiftP75:0};
 const o=parse(from(rows));
 assert.equal(o.status,'FIELD_VALUES_INCOMPLETE');
 assert.equal(o.fieldP75ValuesPresent,false);
 assert.deepEqual(Object.fromEntries(Object.entries(o.observations[0].metrics).map(
  ([k,v])=>[k,v.p75])),{lcpMs:null,inpMs:null,cls:0});
});
test('partial device coverage cannot become site certificate',()=>{
 const x=parse(from([row()]));
 assert.equal(x.observations.length,4);
 assert.equal(x.observations.filter(z=>z.groupEventCount===0).length,3);
 assert.equal(x.fieldP75ValuesPresent,false);
 assert.equal(x.siteGoodCertified,false);
});
test('GraphQL HTTP 200 carrying errors is UNVERIFIED even with measurements',()=>{
 const x=parse({...from(all()),errors:[{message:'not authorized'}]});
 assert.equal(x.status,'UNVERIFIED');
 assert.equal(x.code,'CF_RUM_GRAPHQL_ERRORS');
 assert.equal(x.observations.length,0);
});
test('untrusted other-host, path, device fields cannot enter the report',()=>{
 const rows=all();
 rows.push({...row(),dimensions:{requestHost:'attacker.example',
  requestPath:'/',deviceType:'mobile'}});
 rows.push({...row(),dimensions:{requestHost:RUM_HOST,
  requestPath:'/admin/private',deviceType:'mobile'}});
 rows.push({...row(),dimensions:{requestHost:RUM_HOST,
  requestPath:'/',deviceType:'tablet'}});
 const x=parse(from(rows));
 assert.equal(x.observations.length,4);
 assert(x.observations.every(y=>['/','/economic-indicators/'].includes(y.route)));
});
test('duplicate path+device groups fail instead of recomputing percentiles',()=>{
 assert.throws(()=>parse(from([row(),row()])),/CF_RUM_DUPLICATE_GROUPS_UNVERIFIED/);
});
test('bad shape or nonnumeric metrics fail closed',()=>{
 assert.throws(()=>parse({data:{viewer:{accounts:[]}}}),/CF_RUM_ACCOUNT_SCOPE_INVALID/);
 assert.throws(()=>parse(from([{...row(),count:-1}])),/CF_RUM_GROUP_SHAPE_INVALID/);
 assert.throws(()=>parse(from([{...row(),quantiles:{largestContentfulPaintP75:'abc'}}])),
  /CF_RUM_METRIC_SHAPE_INVALID/);
});
test('missing all field observations remains UNVERIFIED, never synthetic Good',()=>{
 const x=parse(from([]));
 assert.equal(x.observations.length,4);
 assert.equal(x.code,'CF_RUM_FIELD_INCOMPLETE');
 assert(x.observations.every(z=>z.metrics.inpMs.p75===null));
});
