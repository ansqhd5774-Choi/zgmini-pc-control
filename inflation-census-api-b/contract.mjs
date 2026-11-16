// W01 Census #28 API-only B approval boundary. SOURCE_ONLY until a reviewed
// manifest, exactly pinned live PC source and existing Writer/Core leases exist.
// This contract alone never grants permission or performs an API request.
import {createHash} from 'node:crypto';

export const CENSUS_B_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const CENSUS_B_TITLE='w01-census-m3-api-once';
export const CENSUS_B_SCHEMA='ZGMINI_W01_CENSUS_M3_API_ONCE_REQUEST_V1';
export const CENSUS_B_APPROVAL_SCHEMA='ZGMINI_W01_CENSUS_M3_API_ONCE_APPROVAL_V1';
export const CENSUS_B_SCOPE='W01_CENSUS_M3_MTM_TI_RAW_ONLY_2_GET';
export const CENSUS_B_DATA_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
export const CENSUS_B_SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const CENSUS_B_CORE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
export const CENSUS_B_WRITER_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
export const CENSUS_B_ENDPOINT='https://api.census.gov/data/timeseries/eits/m3';
export const CENSUS_B_TARGET=String.raw`E:\ZGmini\data\pc-writer\inflation-causal-candidates-r1\census-m3-manufacturing-inventories.json`;
export const CENSUS_B_SOURCE_FILES=Object.freeze([
 'scripts/pc-writer/inflation-causal-candidate-once.mjs',
 'scripts/pc-writer/inflation-causal-candidate-census-m3.mjs',
 'scripts/pc-writer/local-env.mjs',
 'scripts/pc-writer/quota-fetch.mjs',
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/i,SHA64=/^[a-f0-9]{64}$/i;
const MANIFEST=/^approvals\/inflation-census-api-b\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const REQUEST_FIELDS=['schema','requestId','chatId','operation','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const APPROVAL_FIELDS=['schema','status','scope','operation','controlSourceSha',
 'installedSourceSha','sourceRoot','dataRoot','coreLock','writerLock',
 'sourceFilesSha256','providerEndpoint','selector','targetFile',
 'maxProviderGets','maxRawArchives','maxOutputFiles','coreLeaseMode',
 'allowQuotaLedgerWrites','allowProviderCalls','allowDatabaseWrites','allowD1Writes',
 'allowSourceChanges','allowTaskChanges','allowScheduleChanges','allowOtherWrites'];
const authorized=new WeakSet();
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export const censusBDigest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function validateCensusBManifest(m){
 need(exact(m,APPROVAL_FIELDS),'W01_CENSUS_B_APPROVAL_KEYS_STOP');
 need(m.schema===CENSUS_B_APPROVAL_SCHEMA&&m.status==='APPROVED_B'&&
  m.scope===CENSUS_B_SCOPE&&m.operation===CENSUS_B_TITLE&&
  SHA40.test(m.controlSourceSha??'')&&SHA40.test(m.installedSourceSha??'')&&
  m.sourceRoot===CENSUS_B_SOURCE_ROOT&&m.dataRoot===CENSUS_B_DATA_ROOT&&
  m.coreLock===CENSUS_B_CORE_LOCK&&m.writerLock===CENSUS_B_WRITER_LOCK&&
  exact(m.sourceFilesSha256,CENSUS_B_SOURCE_FILES)&&
  Object.values(m.sourceFilesSha256).every(x=>SHA64.test(x))&&
  m.providerEndpoint===CENSUS_B_ENDPOINT&&m.selector==='MTM/TI/SA/US'&&
  m.targetFile===CENSUS_B_TARGET&&
  m.maxProviderGets===2&&m.maxRawArchives===2&&m.maxOutputFiles===1&&
  m.coreLeaseMode==='EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK_VERIFIED_OWNER'&&
  m.allowProviderCalls===true&&m.allowQuotaLedgerWrites===true&&
  m.allowDatabaseWrites===false&&m.allowD1Writes===false&&
  m.allowSourceChanges===false&&m.allowTaskChanges===false&&
  m.allowScheduleChanges===false&&m.allowOtherWrites===false,
  'W01_CENSUS_B_APPROVAL_SCOPE_STOP');
 return m;
}

export function authorizeCensusB({event,env,manifestBytes}){
 need(env?.GITHUB_REPOSITORY===CENSUS_B_REPO&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&event?.repository?.full_name===CENSUS_B_REPO&&
  event.repository.private===true&&event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&
  !event.issue.pull_request&&event.issue.title===CENSUS_B_TITLE&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'W01_CENSUS_B_EVENT_STOP');
 let request;try{request=JSON.parse(event.issue.body);}catch{
  stop('W01_CENSUS_B_REQUEST_JSON_STOP');}
 need(exact(request,REQUEST_FIELDS)&&request.schema===CENSUS_B_SCHEMA&&
  request.operation===CENSUS_B_TITLE&&request.controlRepository===CENSUS_B_REPO&&
  UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
  MANIFEST.test(request.approvalManifestPath??'')&&
  SHA64.test(request.approvalManifestSha256??''),
  'W01_CENSUS_B_REQUEST_SCOPE_STOP');
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>200&&
  manifestBytes.length<=4096&&
  censusBDigest(manifestBytes)===request.approvalManifestSha256,
  'W01_CENSUS_B_MANIFEST_DIGEST_STOP');
 let manifest;try{manifest=JSON.parse(manifestBytes);}catch{
  stop('W01_CENSUS_B_MANIFEST_JSON_STOP');}
 validateCensusBManifest(manifest);
 need(manifest.controlSourceSha===env.GITHUB_SHA,
  'W01_CENSUS_B_CONTROL_SHA_STOP');
 const proof=Object.freeze({request:Object.freeze(request),
  manifest:Object.freeze({...manifest,sourceFilesSha256:Object.freeze({...manifest.sourceFilesSha256})}),
  controlSha:env.GITHUB_SHA});
 authorized.add(proof);
 return proof;
}

export function assertCensusBAuthorized(proof){
 need(obj(proof)&&authorized.has(proof),'W01_CENSUS_B_PROOF_REQUIRED');
 return proof;
}
