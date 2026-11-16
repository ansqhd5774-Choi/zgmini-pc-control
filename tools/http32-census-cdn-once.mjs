// Exact one-shot operating-PC Census BFS CDN transport probe.
// No DB, PC collector/checkpoint/log writes, scheduled task or retry.
// Request metadata stays in stdout only (GitHub run evidence).
import os from 'node:os';
import fs from 'node:fs';

export const ISSUE_TITLE='pc-census-cdn-connectivity-once';
export const SCHEMA='ZGMINI_HTTP32_CENSUS_CDN_ONCE_V1';
export const URL='https://cdn.www.census.gov/econ/bfs/csv/bfs_monthly.csv';
const REQUEST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_LIMIT=Date.parse('2027-01-01T00:00:00Z');
const RESULT_BASE=Object.freeze({schema:'ZGMINI_HTTP32_CENSUS_CDN_RESULT_V1',
 host:'cdn.www.census.gov',scope:'ONE_GET_HEADERS_ONLY',
 source:'OPERATING_WINDOWS_GITHUB_RUNNER',operationalWrites:0,d1Writes:0,
 sqliteOpened:false,collectorRun:false,scheduleChanged:false,automaticRetries:0});
export function verifyExactIssue({event,env,hostname}){
 const raw=event?.issue;
 let input;
 try{input=JSON.parse(raw?.body??'');}catch{return null;}
 if(!raw||raw.title!==ISSUE_TITLE||raw.user?.login!=='ansqhd5774-Choi'||
  event.action!=='opened'||event.repository?.full_name!=='ansqhd5774-Choi/zgmini-pc-control'||
  event.repository?.private!==true||event.sender?.login!=='ansqhd5774-Choi'||
  env.GITHUB_ACTOR!=='ansqhd5774-Choi'||env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'||
  env.GITHUB_EVENT_NAME!=='issues'||String(env.GITHUB_RUN_ATTEMPT)!=='1'||
  hostname!=='PC'||input?.schema!==SCHEMA||input.operation!=='census-cdn-connectivity-once'||
  Object.keys(input).sort().join(',')!=='operation,requestId,schema'||
  !REQUEST_ID.test(input.requestId))
  return null;
 return input.requestId;
}
const isoDate=s=>{
 if(typeof s!=='string'||s.length>70)return null;
 const time=Date.parse(s);
 return Number.isFinite(time)&&time>0&&time<DATE_LIMIT?new Date(time).toISOString():null;
};
export async function probeCensusCdn({fetchImpl=globalThis.fetch,now=()=>new Date(),requestId}={}){
 const initial={...RESULT_BASE,requestId,httpStatus:null,contentType:null,
 lastModified:null,providerCalls:1,observedAt:now().toISOString()};
 let response;
 try{
  response=await fetchImpl(URL,{method:'GET',redirect:'manual',
   headers:{accept:'text/csv'},signal:AbortSignal.timeout(15000)});
  const status=response?.status;
  const contentType=String(response?.headers?.get?.('content-type')??'').toLowerCase();
  const csv=contentType.startsWith('text/csv')||contentType.startsWith('application/csv');
  const code=status===200&&csv?'HTTP_200_CSV_FROM_OPERATING_PC':
   status>=300&&status<400?'REDIRECT_NOT_FOLLOWED':
   status===200?'NOT_CSV_CONTENT_TYPE':'HTTP_NOT_200';
  return {...initial,httpStatus:Number.isSafeInteger(status)?status:null,
   contentType:csv?'CSV':'NOT_CSV',
   lastModified:isoDate(response?.headers?.get?.('last-modified')),
   status:code==='HTTP_200_CSV_FROM_OPERATING_PC'?'PASS':'STATE_UNKNOWN',code};
 }catch{
  return {...initial,status:'STATE_UNKNOWN',code:'NETWORK_OR_TIMEOUT_FAILED'};
 }finally{
  // Headers-only result; do not download the monthly data or write any files.
  try{await response?.body?.cancel?.();}catch{}
 }
}
async function main(){
 const env=process.env;
 let event={};
 try{event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));}
 catch{console.log(JSON.stringify({...RESULT_BASE,status:'BLOCKED',
  code:'EVENT_NOT_READABLE',providerCalls:0}));process.exitCode=4;return;}
 const requestId=verifyExactIssue({event,env,hostname:os.hostname().toUpperCase()});
 if(!requestId){
  console.log(JSON.stringify({...RESULT_BASE,status:'BLOCKED',
   code:'ACTOR_OR_SCOPE_DENIED',providerCalls:0}));
  process.exitCode=4;return;
 }
 const proof=await probeCensusCdn({requestId});
 console.log('HTTP32_CENSUS_CDN_ONCE='+JSON.stringify(proof));
 if(proof.status!=='PASS')process.exitCode=3;
}
if(process.argv[1]&&new URL(import.meta.url).pathname.replace(/\\/g,'/').toLowerCase().endsWith('/'+process.argv[1].replace(/\\/g,'/').split('/').at(-1).toLowerCase())){
 await main();
}
