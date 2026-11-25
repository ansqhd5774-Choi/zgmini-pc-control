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
 assert.match(GRAPHQL_QUERY,/requestPath_in: \["\/", "\/economic-indicators\/"\]/);
 assert.match(GRAPHQL_QUERY,/bot: 0/);
 assert.match(GRAPHQL_QUERY,/dimensions \{requestHost requestPath deviceType\}/);
 assert.doesNotMatch(GRAPHQL_QUERY,/dimensions\s*\{[^}]*\bbot\b/);
 // Cloudflare's Analytics schema uses the custom lowercase `string` scalar.
 assert.match(GRAPHQL_QUERY,/\$account: string!/);
 assert.doesNotMatch(GRAPHQL_QUERY,/\$account: String!/);
 assert.match(GRAPHQL_QUERY,/rumWebVitalsEventsAdaptiveGroups/);
 assert.match(GRAPHQL_QUERY,/largestContentfulPaintP75/);
 assert.match(GRAPHQL_QUERY,/sum \\{lcpTotal inpTotal clsTotal\\}/);
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
  requestPath:'/',deviceType:'mobile',bot:0}});
 rows.push({...row(),dimensions:{requestHost:RUM_HOST,
  requestPath:'/admin/private',deviceType:'mobile',bot:0}});
 rows.push({...row(),dimensions:{requestHost:RUM_HOST,
  requestPath:'/',deviceType:'tablet',bot:0}});
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

test('real Cloudflare grouped rows omit bot dimension and must retain P75 values',()=>{
 const rows=all();
 assert(rows.every(r=>!Object.hasOwn(r.dimensions,'bot')));
 const x=parse(from(rows));
 assert.equal(x.fieldP75ValuesPresent,true);
 assert.equal(x.code,'CF_RUM_ALL_SCOPED_METRICS_WITHIN_REFERENCE');
 assert.equal(x.observations.length,4);
 assert(x.observations.every(o=>o.groupEventCount===1234));
 assert(x.observations.every(o=>o.metrics.inpMs.p75===180));
});
test('bot-classified events never influence field P75 even if API returns them',()=>{
 const observed=parse(from([...all(),{...row('/other','mobile'),
  dimensions:{requestHost:RUM_HOST,requestPath:'/',deviceType:'tablet',bot:1}}]));
 assert.equal(observed.observations.length,4);
 assert.equal(observed.code,'CF_RUM_ALL_SCOPED_METRICS_WITHIN_REFERENCE');
 const botOnly=parse(from([row('/', 'mobile',undefined,1234)]));
 assert.equal(botOnly.observations[0].metrics.lcpMs.p75,2400);
 const allBot=all().map(x=>({...x,dimensions:{...x.dimensions,bot:1}}));
 const denied=parse(from(allBot));
 assert.equal(denied.fieldP75ValuesPresent,false);
 assert.equal(denied.code,'CF_RUM_FIELD_INCOMPLETE');
});

test('zero page views never turn quantiles into a verified Good reading',()=>{
 const zero=all().map(x=>({...x,count:0}));
 const out=parse(from(zero));
 assert.equal(out.status,'FIELD_VALUES_INCOMPLETE');
 assert.equal(out.fieldP75ValuesPresent,false);
 assert(out.observations.every(o=>o.groupEventCount===0));
 assert(out.observations.every(o=>o.metrics.cls.p75===null));
});

test('non-target device groups are visible as bounded aggregate diagnostics only',()=>{
 const tablet=row('/','tablet',undefined,17);
 const unknown=row('/economic-indicators/','unknown',undefined,5);
 const emptyTablet=row('/economic-indicators/','tablet',undefined,0);
 const foreign={...row('/','tablet'),dimensions:{
  requestHost:'other.example',requestPath:'/',deviceType:'tablet'}};
 const bot={...row('/','tablet'),dimensions:{
  requestHost:RUM_HOST,requestPath:'/',deviceType:'tablet',bot:1}};
 const out=parse(from([row('/','desktop'),tablet,unknown,emptyTablet,foreign,bot]));
 assert.deepEqual(out.nonTargetDeviceGroups,{tablet:1,unrecognized:1});
 assert.equal(out.observations.length,4);
 assert.equal(out.observations.find(o=>o.route==='/'&&o.device==='mobile')
  .groupEventCount,0);
 assert.equal(out.fieldP75ValuesPresent,false);
 assert.equal(out.siteGoodCertified,false);
 assert.equal(JSON.stringify(out).includes('other.example'),false);
 assert.equal(JSON.stringify(out).includes('"unknown"'),false);
});

test('missing metric origin stays distinct from real zero without claiming a cause',()=>{
 const rows=[
  row('/','mobile',{largestContentfulPaintP75:0,
   interactionToNextPaintP75:-1,cumulativeLayoutShiftP75:null},2),
  row('/','desktop',{largestContentfulPaintP75:1200000,
   cumulativeLayoutShiftP75:0.01},3),
  row('/economic-indicators/','mobile',{
   largestContentfulPaintP75:0,interactionToNextPaintP75:0,
   cumulativeLayoutShiftP75:0},0)
 ];
 const x=parse(from(rows));
 const at=(route,device)=>x.observations.find(o=>o.route===route&&o.device===device);
 const mobile=at('/','mobile').metrics;
 assert.equal(mobile.inpMs.p75,null);
 assert.equal(mobile.inpMs.missingKind,'PROVIDER_NEGATIVE');
 assert.equal(mobile.cls.p75,null);
 assert.equal(mobile.cls.missingKind,'PROVIDER_NULL');
 assert.equal(mobile.lcpMs.p75,0);
 assert.equal(mobile.lcpMs.state,'AT_OR_BELOW_GOOD_REFERENCE');
 assert.equal(Object.hasOwn(mobile.lcpMs,'missingKind'),false);
 const desktop=at('/','desktop').metrics;
 assert.equal(desktop.inpMs.p75,null);
 assert.equal(desktop.inpMs.missingKind,'FIELD_OMITTED');
 const zero=at('/economic-indicators/','mobile').metrics;
 assert.equal(zero.inpMs.p75,null);
 assert.equal(zero.inpMs.missingKind,'ZERO_GROUP_EVENTS');
 const absent=at('/economic-indicators/','desktop').metrics;
 assert.equal(absent.inpMs.p75,null);
 assert.equal(absent.inpMs.missingKind,'NO_MATCHING_GROUP');
 assert.equal(x.fieldP75ValuesPresent,false);
 assert.equal(x.siteGoodCertified,false);
 assert.equal(x.metricSampleSizesVerified,false);
});

test('Cloudflare metric totals distinguish no INP observations from page view count',()=>{
 const data=all().map(r=>({...r,sum:{lcpTotal:2,inpTotal:1,clsTotal:2}}));
 data[2]={...data[2],count:2,
  quantiles:{largestContentfulPaintP75:712000,
   interactionToNextPaintP75:-1,cumulativeLayoutShiftP75:0.002},
  sum:{lcpTotal:2,inpTotal:0,clsTotal:2}};
 const x=parse(from(data));
 const mobile=x.observations.find(o=>
  o.route==='/economic-indicators/'&&o.device==='mobile');
 assert.equal(mobile.groupEventCount,2);
 assert.deepEqual(mobile.metricReportedTotals,{lcpMs:2,inpMs:0,cls:2});
 assert.equal(mobile.metrics.inpMs.p75,null);
 assert.equal(mobile.metrics.inpMs.missingKind,'PROVIDER_NEGATIVE');
 assert.equal(mobile.metricSpecificSampleCounts,'UNAVAILABLE');
 assert.equal(x.metricSampleSizesVerified,false);
 assert.equal(x.siteGoodCertified,false);
 assert.equal(x.fieldP75ValuesPresent,false);
 assert.equal(x.observations[0].metricReportedTotals.inpMs,1);
});
test('provider metric totals never turn negative P75 into Good or certified samples',()=>{
 const withTotal={...row(),quantiles:{
  largestContentfulPaintP75:1500000,interactionToNextPaintP75:-1,
  cumulativeLayoutShiftP75:0.01},sum:{lcpTotal:30,inpTotal:5,clsTotal:30}};
 const observed=parse(from([withTotal]));
 assert.equal(observed.observations[0].metricReportedTotals.inpMs,5);
 assert.equal(observed.observations[0].metrics.inpMs.p75,null);
 assert.equal(observed.observations[0].metrics.inpMs.missingKind,
  'PROVIDER_NEGATIVE');
 assert.equal(observed.siteGoodCertified,false);
 assert.equal(observed.metricSampleSizesVerified,false);
 for(const sum of [{lcpTotal:1,inpTotal:-1,clsTotal:2},
  {lcpTotal:1,inpTotal:'2',clsTotal:2},
  {lcpTotal:1,clsTotal:2},{lcpTotal:NaN,inpTotal:2,clsTotal:2}]){
  assert.throws(()=>parse(from([{...row(),sum}])),
   /CF_RUM_METRIC_TOTALS_INVALID/);
 }
 const legacy=parse(from([row()]));
 assert.equal(legacy.observations[0].metricReportedTotals,'UNAVAILABLE');
 assert.equal(legacy.siteGoodCertified,false);
});
test('normal four-group response has zero non-target device groups',()=>{
 const out=parse(from(all()));
 assert.deepEqual(out.nonTargetDeviceGroups,{tablet:0,unrecognized:0});
 assert.equal(out.fieldP75ValuesPresent,true);
});
