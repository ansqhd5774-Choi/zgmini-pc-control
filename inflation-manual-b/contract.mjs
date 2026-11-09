// Fixed-scope, source-only authorization for a future one-shot Windows B
// receiver. This module never downloads data or writes a PC file.
import {createHash} from 'node:crypto';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const ISSUE_TITLE='pc-inflation-official-manual-once';
export const ISSUE_LABEL='pc-writer-b-install';
export const OPERATION='inflation-official-manual';
export const REQUEST_SCHEMA='ZGMINI_INFLATION_OFFICIAL_MANUAL_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_INFLATION_OFFICIAL_MANUAL_B_APPROVAL_V1';
export const SCOPE='INFLATION_OFFICIAL_STATIC_TWO_RAW_JSON_ONLY';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const DATA_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
export const SOURCE_FILES=Object.freeze([
 'scripts/pc-writer/inflation-causal-candidate-manual-official-r1.mjs',
 'scripts/pc-writer/inflation-causal-candidate-manual-official-store-r1.mjs',
 'lib/diagnostic-layer/xlsx-lite.mjs',
 'scripts/pc-writer/local-cycle.mjs',
]);
export const URLS=Object.freeze({
 bls:'https://download.bls.gov/pub/time.series/cu/cu.data.12.USHousing',
 census:'https://www.census.gov/manufacturing/m3/prel/historical_data/histshts/naics/naicsinvp.xlsx',
});
export const TARGETS=Object.freeze({
 bls:String.raw`E:\ZGmini\data\pc-writer\inflation-causal-candidates-r1\bls-cpi-ppi3.json`,
 census:String.raw`E:\ZGmini\data\pc-writer\inflation-causal-candidates-r1\census-m3-manufacturing-inventories.json`,
});
export const MAX_BYTES=Object.freeze({bls:8_000_000,census:6_000_000});

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH=/^approvals\/inflation-manual-b\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','sourceRoot','sourceSha',
 'sourceFiles','providerUrls','targetFiles','maxBytes','timeoutMs','runCount',
 'coreLeaseMode',
 'allowDbWrites','allowD1Writes','allowTaskChanges','allowSourceChanges',
 'allowOtherWrites'];
const authenticated=new WeakSet();
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(condition,code)=>{if(!condition)fail(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
 keys.every(key=>Object.hasOwn(x,key));
const fixed=(actual,expected)=>exact(actual,Object.keys(expected))&&
 Object.entries(expected).every(([key,value])=>actual[key]===value);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function validateApprovalManifest(m){
 need(exact(m,APPROVAL_KEYS),'INFL_MANUAL_B_MANIFEST_FIELDS_STOP');
 need(m.schema===APPROVAL_SCHEMA&&m.status==='APPROVED_B'&&
  m.scope===SCOPE&&m.sourceRoot===SOURCE_ROOT&&
  SHA40.test(m.sourceSha??'')&&m.runCount===1&&
  m.coreLeaseMode==='EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK'&&
  m.timeoutMs===40_000&&fixed(m.providerUrls,URLS)&&
  fixed(m.targetFiles,TARGETS)&&fixed(m.maxBytes,MAX_BYTES)&&
  ['allowDbWrites','allowD1Writes','allowTaskChanges',
   'allowSourceChanges','allowOtherWrites'].every(key=>m[key]===false),
  'INFL_MANUAL_B_MANIFEST_SCOPE_STOP');
 need(Array.isArray(m.sourceFiles)&&m.sourceFiles.length===SOURCE_FILES.length&&
  m.sourceFiles.every((entry,i)=>exact(entry,['path','sha256'])&&
   entry.path===SOURCE_FILES[i]&&SHA64.test(entry.sha256??'')),
  'INFL_MANUAL_B_SOURCE_FILES_STOP');
 return m;
}

export function verifyIssueEvent(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===OWNER&&env.GITHUB_RUN_ATTEMPT==='1'&&
  SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&
  event?.repository?.full_name===CONTROL_REPO&&
  event.repository.private===true&&event?.sender?.login===OWNER&&
  event?.issue?.user?.login===OWNER&&!event.issue.pull_request&&
  event.issue.title===ISSUE_TITLE&&
  event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'INFL_MANUAL_B_EVENT_AUTH_STOP');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{fail('INFL_MANUAL_B_REQUEST_JSON_STOP');}
 need(exact(req,REQUEST_KEYS)&&req.schema===REQUEST_SCHEMA&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  req.operation===OPERATION&&req.controlRepository===CONTROL_REPO&&
  PATH.test(req.approvalManifestPath??'')&&
  SHA64.test(req.approvalManifestSha256??''),
  'INFL_MANUAL_B_REQUEST_SCOPE_STOP');
 return req;
}

export function authorizeManualReceiver({event,env,manifestBytes}){
 const request=verifyIssueEvent(event,env);
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=250&&
  manifestBytes.length<=8192&&
  sha256(manifestBytes)===request.approvalManifestSha256,
  'INFL_MANUAL_B_MANIFEST_HASH_STOP');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{fail('INFL_MANUAL_B_MANIFEST_JSON_STOP');}
 validateApprovalManifest(manifest);
 const auth=Object.freeze({request:Object.freeze(request),
  manifest:Object.freeze(manifest),controlSha:env.GITHUB_SHA,
  issueNumber:event.issue.number});
 authenticated.add(auth);
 return auth;
}

export function assertAuthorizedManualReceiver(auth){
 need(object(auth)&&authenticated.has(auth),
  'INFL_MANUAL_B_AUTH_OBJECT_STOP');
 return auth;
}
