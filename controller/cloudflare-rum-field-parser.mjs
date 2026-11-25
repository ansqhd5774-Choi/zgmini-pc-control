// #8 candidate: pure, credential-free Cloudflare RUM field-response contract.
// NOT registered in Controller/Runner. No network, authentication or writes.
// GraphQL field shape is provisional until an authorized real response is read.
export const RUM_HOST='zgmini.kr';
export const RUM_PATHS=Object.freeze(['/','/economic-indicators/']);
export const RUM_DEVICES=Object.freeze(['mobile','desktop']);
export const GOOD=Object.freeze({lcpMs:2500,inpMs:200,cls:0.1});
export const GRAPHQL_ENDPOINT='https://api.cloudflare.com/client/v4/graphql';
export const GRAPHQL_QUERY=[
 'query ZgminiRumP75($account: string!, $start: Time!, $end: Time!) {',
 'viewer { accounts(filter: {accountTag: $account}) {',
 'rumWebVitalsEventsAdaptiveGroups(limit: 30,',
 'filter: {datetime_geq: $start, datetime_leq: $end, requestHost: "zgmini.kr",',
 'requestPath_in: ["/", "/economic-indicators/"], bot: 0}) {',
 'count dimensions {requestHost requestPath deviceType}',
 'quantiles {largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75}',
 '} } } }'
].join(' ');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const utc=v=>typeof v==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v)&&
 Number.isFinite(Date.parse(v));
const validWindow=(s,e)=>utc(s)&&utc(e)&&Date.parse(e)>Date.parse(s)&&
 Date.parse(e)-Date.parse(s)<=7*86400000;
export function buildRumQuery({accountTag,startUtc,endUtc}={}){
 if(!/^[a-f0-9]{32}$/.test(accountTag??''))fail('CF_RUM_ACCOUNT_INVALID');
 if(!validWindow(startUtc,endUtc)||Date.parse(endUtc)>Date.now()+60000)
  fail('CF_RUM_WINDOW_INVALID');
 return {endpoint:GRAPHQL_ENDPOINT,method:'POST',query:GRAPHQL_QUERY,
  variables:{account:accountTag,start:startUtc,end:endUtc},
  registeredOperation:false,networkExecuted:false};
}
const metric=(value,limit,scale)=>{
 if(value!==undefined&&value!==null&&
  (typeof value!=='number'||!Number.isFinite(value)))
  fail('CF_RUM_METRIC_SHAPE_INVALID');
 // Preserve the provider representation; an absent field, explicit null,
 // and negative no-value marker are different observations, not INP causes.
 const missingKind=value===undefined?'FIELD_OMITTED':
  value===null?'PROVIDER_NULL':value<0?'PROVIDER_NEGATIVE':null;
 const raw=missingKind===null?value/scale:null;
 const p75=raw===null?null:Math.round(raw*1e5)/1e5;
 // Compare ORIGINAL values: rounding a CLS 0.100001 must not yield Good.
 return {p75,goodLimit:limit,state:raw===null?'UNVERIFIED':
   raw<=limit?'AT_OR_BELOW_GOOD_REFERENCE':'EXCEEDS_GOOD_REFERENCE',
  ...(missingKind===null?{}:{missingKind})};
};
const empty=(route,device,missingKind='NO_MATCHING_GROUP')=>({route,device,groupEventCount:0,
 metricSpecificSampleCounts:'UNAVAILABLE',
 metrics:Object.fromEntries(Object.entries(GOOD).map(([k,limit])=>[
  k,{p75:null,goodLimit:limit,state:'UNVERIFIED',missingKind}]))});
export function parseRumGraphql(response,{startUtc,endUtc}={}){
 if(!validWindow(startUtc,endUtc))fail('CF_RUM_WINDOW_INVALID');
 if(!obj(response))fail('CF_RUM_RESPONSE_INVALID');
 // HTTP 200 is not success if GraphQL returned errors.
 if(response.errors!==undefined&&response.errors!==null&&
  (!Array.isArray(response.errors)||response.errors.length>0))
  return {status:'UNVERIFIED',code:'CF_RUM_GRAPHQL_ERRORS',
   fieldP75ValuesPresent:false,observations:[],window:{startUtc,endUtc}};
 const accounts=response.data?.viewer?.accounts;
 if(!Array.isArray(accounts)||accounts.length!==1)
  fail('CF_RUM_ACCOUNT_SCOPE_INVALID');
 const rows=accounts[0]?.rumWebVitalsEventsAdaptiveGroups;
 if(!Array.isArray(rows)||rows.length>30)fail('CF_RUM_GROUPS_INVALID');
 const seen=new Map();
 // Count only non-empty, in-scope non-target device GROUPS; never expose
 // raw non-target metrics or reclassify them as mobile/desktop observations.
 const nonTargetDeviceGroups={tablet:0,unrecognized:0};
 for(const row of rows){
  if(!obj(row)||!obj(row.dimensions)||!obj(row.quantiles)||
   !Number.isSafeInteger(row.count)||row.count<0)
   fail('CF_RUM_GROUP_SHAPE_INVALID');
  const {requestHost,requestPath,deviceType}=row.dimensions;
  // Never expose another host/path or an untrusted URL in a public result.
  if(requestHost!==RUM_HOST||!RUM_PATHS.includes(requestPath))continue;
  // `bot: 0` is a filter, NOT a selected RUM dimension. Standard GraphQL
  // responses omit dimensions.bot; reject unexpected explicitly nonzero bots.
  if(row.dimensions.bot!==undefined&&row.dimensions.bot!==0)continue;
  const device=typeof deviceType==='string'?deviceType.toLowerCase():null;
  if(!RUM_DEVICES.includes(device)){
   if(row.count>0){
    if(device==='tablet')nonTargetDeviceGroups.tablet++;
    else nonTargetDeviceGroups.unrecognized++;
   }
   continue;
  }
  const key=requestPath+'|'+device;
  if(seen.has(key))fail('CF_RUM_DUPLICATE_GROUPS_UNVERIFIED');
  const q=row.quantiles;
  const metrics=row.count===0?empty(requestPath,device,'ZERO_GROUP_EVENTS').metrics:{
   lcpMs:metric(q.largestContentfulPaintP75,GOOD.lcpMs,1000),
   inpMs:metric(q.interactionToNextPaintP75,GOOD.inpMs,1000),
   cls:metric(q.cumulativeLayoutShiftP75,GOOD.cls,1)};
  seen.set(key,{route:requestPath,device,groupEventCount:row.count,
   metricSpecificSampleCounts:'UNAVAILABLE',metrics});
 }
 const observations=RUM_PATHS.flatMap(route=>RUM_DEVICES.map(device=>
  seen.get(route+'|'+device)??empty(route,device)));
 const missing=observations.some(o=>Object.values(o.metrics).some(m=>m.state==='UNVERIFIED'));
 const exceed=observations.some(o=>Object.values(o.metrics).some(m=>m.state==='EXCEEDS_GOOD_REFERENCE'));
 return {status:missing?'FIELD_VALUES_INCOMPLETE':'P75_VALUES_PRESENT',
  code:exceed?'CF_RUM_REFERENCE_EXCEEDED':missing?'CF_RUM_FIELD_INCOMPLETE':
  'CF_RUM_ALL_SCOPED_METRICS_WITHIN_REFERENCE',
  source:'CLOUDFLARE_RUM_FIELD_GROUPS_PROVISIONAL',host:RUM_HOST,
  window:{startUtc,endUtc},fieldP75ValuesPresent:!missing,
  siteGoodCertified:false,cruxEquivalent:false,
  metricSampleSizesVerified:false,mergeBlocking:false,
  nonTargetDeviceGroups,observations};
}
