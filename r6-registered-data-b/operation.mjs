#!/usr/bin/env node
// Exact, owner-approved R6 registered-BLS one-shot. The existing PC collector,
// SQLite store, quota guard and publisher own all data effects. No shell input.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const R6_B_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const R6_B_TITLE='pc-employment-r6-registered-data-once';
export const R6_B_LABEL='pc-writer-b-install';
export const R6_B_SCHEMA='ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1';
export const R6_B_APPROVAL='ZGMINI_R6_REGISTERED_DATA_B_APPROVAL_V1';
export const R6_B_APPROVAL_V2='ZGMINI_R6_REGISTERED_DATA_B_APPROVAL_V2';
export const R6_B_APPROVAL_V3='ZGMINI_R6_REGISTERED_DATA_B_APPROVAL_V3';
const R6_B_DELTA_OVERLAY_PATH='approvals/writer-updates/employment-r6-2015-600-onefile-20261109.json';
const R6_B_PROVIDER_PATH='lib/market-score/employment-r6-provider.mjs';
const R6_B_COLLECTOR_DELTA_PATH='approvals/writer-updates/employment-r6-backfill-window-collector-20261109.json';
const R6_B_COLLECTOR_PATH='lib/market-score/employment-r6-collector.mjs';
export const R6_B_RESULT='r6-registered-data-result.json';
export const R6_B_SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const R6_B_HOME=String.raw`E:\ZGmini\data\pc-writer`;
const OWNER='ansqhd5774-Choi';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const CODES=/^[A-Z][A-Z0-9_]{0,95}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const error=code=>Object.assign(new Error(code),{code});
const need=(ok,code)=>{if(!ok)throw error(code);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
const same=(a,b)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const safeCode=x=>CODES.test(x??'')&&x.length<=80?
 (x.startsWith('R6_B_')?x:`R6_B_${x}`):'R6_B_UNCLASSIFIED_STOP';

export function authorizeR6RegisteredB({event,env,approvalBytes,overlayBytes,
 deltaOverlayBytes=null,collectorDeltaOverlayBytes=null}={}){
 need(env?.GITHUB_REPOSITORY===R6_B_REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&event.repository?.full_name===R6_B_REPO&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  event.issue?.user?.login===OWNER&&!event.issue.pull_request&&
  event.issue.title===R6_B_TITLE&&
  event.issue.labels?.some(x=>x.name===R6_B_LABEL),
 'R6_B_OWNER_EVENT_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{throw error('R6_B_REQUEST_JSON_STOP');}
 need(exact(request,['schema','requestId','chatId','operation','approvalManifestSha256'])&&
  request.schema===R6_B_SCHEMA&&request.operation==='employment-r6-registered-data-once'&&
  UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
  SHA64.test(request.approvalManifestSha256??''),
 'R6_B_REQUEST_SCOPE_STOP');
 need(Buffer.isBuffer(approvalBytes)&&approvalBytes.length>0&&approvalBytes.length<16384&&
  sha(approvalBytes)===request.approvalManifestSha256,'R6_B_APPROVAL_HASH_STOP');
 let approval,overlay;
 try{approval=JSON.parse(approvalBytes.toString('utf8'));
  overlay=JSON.parse(overlayBytes.toString('utf8'));}
 catch{throw error('R6_B_MANIFEST_JSON_STOP');}
 const v2=approval?.schema===R6_B_APPROVAL_V2;
 const v3=approval?.schema===R6_B_APPROVAL_V3;
 const approvalKeys=['schema','status','scope','mode','sourceRepository',
  'installedSourceSha','overlayManifestPath','overlayManifestSha256',
  'sourceRoot','pcHome','maxBlsCalls','maxDolCalls','effects'];
 need(exact(approval,v3?[...approvalKeys,'deltaOverlayManifestPath',
  'deltaOverlayManifestSha256','collectorDeltaOverlayManifestPath',
  'collectorDeltaOverlayManifestSha256']:
  v2?[...approvalKeys,'deltaOverlayManifestPath','deltaOverlayManifestSha256']:
  approvalKeys)&&
  (approval.schema===R6_B_APPROVAL||v2||v3)&&approval.status==='APPROVED_B'&&
  approval.scope==='EMPLOYMENT_R6_REGISTERED_DATA_SQLITE_D1_ONCE'&&
  ['ONE_YEAR','BACKFILL'].includes(approval.mode)&&
  approval.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  SHA40.test(approval.installedSourceSha??'')&&
  same(approval.sourceRoot,R6_B_SOURCE)&&same(approval.pcHome,R6_B_HOME)&&
  approval.overlayManifestPath==='approvals/writer-updates/bls-registered-v2-13-writer-b-20261109.json'&&
  SHA64.test(approval.overlayManifestSha256??'')&&
  approval.overlayManifestSha256===sha(overlayBytes)&&
  approval.maxBlsCalls===(approval.mode==='ONE_YEAR'?7:14)&&
  approval.maxDolCalls===2&&
  exact(approval.effects,['registeredBlsCalls','dolCalls','sqliteWrites',
   'd1ReadOnlyPreflight','d1PublicSnapshot','taskWrites','sourceWrites'])&&
  approval.effects.registeredBlsCalls===true&&approval.effects.dolCalls===true&&
  approval.effects.sqliteWrites===true&&approval.effects.d1ReadOnlyPreflight===true&&
  approval.effects.d1PublicSnapshot===true&&
  approval.effects.taskWrites===false&&approval.effects.sourceWrites===false&&
  overlay?.schema==='ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1'&&
  overlay.status==='APPROVED_B'&&overlay.candidateSourceSha&&
  overlay.files?.length===13&&overlay.allowProviderCalls===false&&
  overlay.allowDbChanges===false&&overlay.allowD1Writes===false&&
  same(overlay.sourceRoot,R6_B_SOURCE),
 'R6_B_EFFECT_APPROVAL_STOP');
 let effectiveOverlay=overlay;
 if(v2||v3){
  need(approval.deltaOverlayManifestPath===R6_B_DELTA_OVERLAY_PATH&&
   SHA64.test(approval.deltaOverlayManifestSha256??'')&&
   Buffer.isBuffer(deltaOverlayBytes)&&deltaOverlayBytes.length>0&&
   deltaOverlayBytes.length<16384&&
   sha(deltaOverlayBytes)===approval.deltaOverlayManifestSha256,
   'R6_B_DELTA_APPROVAL_STOP');
  let delta;
  try{delta=JSON.parse(deltaOverlayBytes.toString('utf8'));}
  catch{throw error('R6_B_DELTA_JSON_STOP');}
  const prior=overlay.files.filter(file=>file.path===R6_B_PROVIDER_PATH);
  const changed=delta?.files?.[0];
  need(delta?.schema==='ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1'&&
   delta.status==='APPROVED_B'&&
   delta.scope==='PC_WRITER_APPROVED_FILE_OVERLAY_ONLY'&&
   delta.sourceRepository===approval.sourceRepository&&
   delta.sourceBranch===overlay.sourceBranch&&
   SHA40.test(delta.candidateSourceSha??'')&&
   same(delta.sourceRoot,R6_B_SOURCE)&&
   delta.runCount===1&&
   delta.allowProviderCalls===false&&delta.allowDbChanges===false&&
   delta.allowD1Writes===false&&delta.allowTaskDefinitionChanges===false&&
   delta.allowOtherSourceChanges===false&&
   Array.isArray(delta.files)&&delta.files.length===1&&
   prior.length===1&&changed?.path===R6_B_PROVIDER_PATH&&
   changed.change==='M'&&SHA64.test(changed.beforeSha256??'')&&
   SHA64.test(changed.afterSha256??'')&&
   changed.beforeSha256===prior[0].afterSha256&&
   changed.afterSha256!==changed.beforeSha256,
   'R6_B_DELTA_SCOPE_STOP');
  effectiveOverlay={...overlay,files:overlay.files.map(file=>
   file.path===R6_B_PROVIDER_PATH?{...file,afterSha256:changed.afterSha256}:file)};
 }else need(deltaOverlayBytes===null,'R6_B_DELTA_SCOPE_STOP');
 if(v3){
  need(approval.collectorDeltaOverlayManifestPath===R6_B_COLLECTOR_DELTA_PATH&&
   SHA64.test(approval.collectorDeltaOverlayManifestSha256??'')&&
   Buffer.isBuffer(collectorDeltaOverlayBytes)&&collectorDeltaOverlayBytes.length>0&&
   collectorDeltaOverlayBytes.length<16384&&
   sha(collectorDeltaOverlayBytes)===approval.collectorDeltaOverlayManifestSha256,
   'R6_B_COLLECTOR_DELTA_APPROVAL_STOP');
  let collectorDelta;
  try{collectorDelta=JSON.parse(collectorDeltaOverlayBytes.toString('utf8'));}
  catch{throw error('R6_B_COLLECTOR_DELTA_JSON_STOP');}
  const original=overlay.files.filter(file=>file.path===R6_B_COLLECTOR_PATH);
  const changed=collectorDelta?.files?.[0];
  need(collectorDelta?.schema==='ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1'&&
   collectorDelta.status==='APPROVED_B'&&
   collectorDelta.scope==='PC_WRITER_APPROVED_FILE_OVERLAY_ONLY'&&
   collectorDelta.sourceRepository===approval.sourceRepository&&
   collectorDelta.sourceBranch===overlay.sourceBranch&&
   SHA40.test(collectorDelta.candidateSourceSha??'')&&
   same(collectorDelta.sourceRoot,R6_B_SOURCE)&&
   collectorDelta.runCount===1&&
   collectorDelta.allowProviderCalls===false&&collectorDelta.allowDbChanges===false&&
   collectorDelta.allowD1Writes===false&&collectorDelta.allowTaskDefinitionChanges===false&&
   collectorDelta.allowOtherSourceChanges===false&&
   Array.isArray(collectorDelta.files)&&collectorDelta.files.length===1&&
   original.length===1&&changed?.path===R6_B_COLLECTOR_PATH&&
   changed.change==='M'&&SHA64.test(changed.beforeSha256??'')&&
   SHA64.test(changed.afterSha256??'')&&
   changed.beforeSha256===original[0].afterSha256&&
   changed.afterSha256!==changed.beforeSha256,
   'R6_B_COLLECTOR_DELTA_SCOPE_STOP');
  effectiveOverlay={...effectiveOverlay,files:effectiveOverlay.files.map(file=>
   file.path===R6_B_COLLECTOR_PATH?{...file,afterSha256:changed.afterSha256}:file)};
 }else need(collectorDeltaOverlayBytes===null,'R6_B_COLLECTOR_DELTA_SCOPE_STOP');
 return Object.freeze({request,approval,overlay:effectiveOverlay});
}

export function verifyInstalledR6Overlay({sourceRoot,pcHome,approvedSha,overlay,
 read=fs.readFileSync,exists=fs.existsSync,
 git=(args)=>execFileSync('git',args,{cwd:sourceRoot,encoding:'utf8',windowsHide:true,stdio:'pipe'}).trim()}={}){
 need(process.platform==='win32'&&same(sourceRoot,R6_B_SOURCE)&&same(pcHome,R6_B_HOME),
  'R6_B_WINDOWS_PATH_STOP');
 need(exists(path.join(pcHome,'storage','core.sqlite')),
  'R6_B_EXISTING_CORE_DB_REQUIRED');
 const config=JSON.parse(read(path.join(pcHome,'config.json'),'utf8'));
 need(config.enabled===true&&config.collectionTarget==='pc'&&
  config.employmentR6AutoCollection===true&&
  config.employmentR6OneYearAutoPublication===true&&
  config.source===approvedSha&&git(['rev-parse','HEAD'])===approvedSha,
  'R6_B_INSTALLED_SOURCE_STOP');
 git(['diff','--quiet','HEAD','--','lib','worker','scripts/pc-writer']);
 for(const file of overlay.files){
  need(/^(?:lib\/market-score|scripts\/pc-writer)\/[a-zA-Z0-9_.-]+\.mjs$/.test(file.path)&&
    SHA64.test(file.afterSha256??'')&&
    sha(read(path.join(sourceRoot,...file.path.split('/'))))===file.afterSha256,
  'R6_B_INSTALLED_OVERLAY_DRIFT_STOP');
 }
 return config;
}

function withCoreLock(pcHome,requestId){
 const file=path.join(pcHome,'local-cycle.lock');
 const bytes=JSON.stringify({pid:process.pid,at:Date.now(),owner:'R6_REGISTERED_DATA_B',
  requestId,nonce:randomUUID()});
 let fd;
 try{fd=fs.openSync(file,'wx',0o600);}
 catch(cause){throw error(cause?.code==='EEXIST'?
  'R6_B_CORE_LOCK_OCCUPIED':'R6_B_CORE_LOCK_CREATE_STOP');}
 let original;
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
  original=fs.statSync(file);
  need(fs.readFileSync(file,'utf8')===bytes,'R6_B_CORE_LOCK_READBACK_STOP');}
 catch{if(fd!==undefined&&fd!==null)try{fs.closeSync(fd);}catch{}
  throw error('R6_B_CORE_LOCK_UNKNOWN');}
 const held=()=>{try{const actual=fs.statSync(file);
  return actual.dev===original.dev&&actual.ino===original.ino&&
   fs.readFileSync(file,'utf8')===bytes;}catch{return false;}};
 return {held,release(){if(!held())return false;
  try{fs.unlinkSync(file);return true;}catch{return false;}}};
}

// Active Core runs release their own lock naturally. Give the 5-minute Core
// cadence a bounded five-minute idle opportunity; never inspect/delete someone
// else's lock or retry unexpected/unknown lock-ownership errors.
export async function acquireCoreLockBounded(pcHome,requestId,{
 createLock=withCoreLock,now=()=>performance.now(),sleep=delay}={}){
 const started=now();
 const maxWaitMs=5*60_000,maxRetries=maxWaitMs/5_000;
 let lastOccupied=null;
 for(let retry=0;;retry++){
  // A delayed timer must not let a resumed process acquire beyond the bound.
  if(retry>0&&now()-started>maxWaitMs)throw lastOccupied;
  try{return await createLock(pcHome,requestId);}
  catch(cause){
   if(cause?.code!=='R6_B_CORE_LOCK_OCCUPIED')throw cause;
   lastOccupied=cause;
   const remaining=maxWaitMs-(now()-started);
   if(retry>=maxRetries||!Number.isFinite(remaining)||remaining<=0)throw cause;
   await sleep(Math.min(5_000,remaining));
  }
 }
}

function claimOnce(pcHome,{requestId,approvalManifestSha256},mode){
 // An already consumed legacy date claim must never become replayable after
 // switching to per-request claims. Read-only lookup; preserve all old files.
 let existing;
 try{existing=fs.readdirSync(pcHome);}
 catch{throw error('R6_B_LEGACY_CLAIM_READ_STOP');}
 for(const name of existing){
  if(!/^employment-r6-registered-(?:one_year|backfill)-\d{4}-\d{2}-\d{2}\.claim\.json$/.test(name))continue;
  let legacy;
  try{legacy=JSON.parse(fs.readFileSync(path.join(pcHome,name),'utf8'));}
  catch{throw error('R6_B_LEGACY_CLAIM_STATE_UNKNOWN');}
  need(typeof legacy?.requestId==='string'&&UUID.test(legacy.requestId),
   'R6_B_LEGACY_CLAIM_STATE_UNKNOWN');
  if(legacy.requestId===requestId)throw error('R6_B_REQUEST_ALREADY_CLAIMED');
 }
 // A new manually approved request may run the same day. Still one-shot per ID.
 need(UUID.test(requestId),'R6_B_REQUEST_ID_STOP');
 const file=path.join(pcHome,`employment-r6-registered-request-${requestId}.claim.json`);
 let fd;
 try{fd=fs.openSync(file,'wx',0o600);}
 catch(cause){throw error(cause?.code==='EEXIST'?
  'R6_B_REQUEST_ALREADY_CLAIMED':'R6_B_CLAIM_CREATE_STOP');}
 const value=JSON.stringify({schema:'R6_REGISTERED_ONE_SHOT_CLAIM_V1',
  requestId,approvalManifestSha256,mode,claimedAt:new Date().toISOString()})+'\n';
 try{fs.writeFileSync(fd,value);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
  need(fs.readFileSync(file,'utf8')===value,'R6_B_CLAIM_READBACK_STOP');}
 catch{if(fd!==undefined&&fd!==null)try{fs.closeSync(fd);}catch{}
  throw error('R6_B_CLAIM_STATE_UNKNOWN');}
 return {file};
}

function safeGroups(rows){
 return rows.map(row=>({groupName:/^[A-Z][A-Z0-9_]{1,60}$/.test(row.groupName??'')?
  row.groupName:'INVALID_GROUP',
  status:['SUCCESS','PARTIAL','FAIL','SKIPPED_BLS_BUDGET','SKIPPED_LOCKED'].includes(row.status)?
   row.status:'UNKNOWN',
  providerRequests:Number.isSafeInteger(row.providerRequests)&&row.providerRequests>=0?
   row.providerRequests:null,
  ...(CODES.test(row.failureCode??'')?{failureCode:row.failureCode}:{})}));
}

async function loadInstalledProviderFields({sourceRoot,pcHome}){
 const envURL=pathToFileURL(path.join(sourceRoot,'scripts','pc-writer','local-env.mjs'));
 const {loadLocalProviders}=await import(envURL.href);
 return loadLocalProviders(pcHome);
}

async function probeExistingD1Read({sourceRoot,config}){
 try{
  const {client,credential}=await import(pathToFileURL(
   path.join(sourceRoot,'scripts','pc-writer','d1.mjs')).href);
  // Reuse the PC Writer's existing official credential resolver. Do not
  // create, extract, print or transport any Cloudflare credential.
  const remote=client(config,()=>credential(sourceRoot));
  const row=(await remote.query(config.core,'SELECT 1 AS r6_b_read_probe',[]))?.results?.[0];
  need(Number(row?.r6_b_read_probe)===1,'R6_B_D1_AUTH_UNAVAILABLE');
  return true;
 }catch{throw error('R6_B_D1_AUTH_UNAVAILABLE');}
}

export async function performR6RegisteredOnce({auth,sourceRoot=R6_B_SOURCE,
 pcHome=R6_B_HOME,lockFactory=acquireCoreLockBounded,claim=claimOnce,
 verifyOverlay=verifyInstalledR6Overlay,
 providerFieldsLoader=loadInstalledProviderFields,
 d1ReadProbe=probeExistingD1Read,run=null}={}){
 const base={schema:'ZGMINI_R6_REGISTERED_DATA_B_RESULT_V1',
  requestId:auth.request.requestId,sourceSha:auth.approval.installedSourceSha,
  mode:auth.approval.mode,status:'STATE_UNKNOWN',code:'R6_B_NOT_STARTED',
  providerRequests:null,blsRequests:null,dolRequests:null,groupResults:[],
  sqlite:'UNVERIFIED',publication:'UNVERIFIED',sourceStoredAt:null,
  sourceFeatures:null,chartReadyFeatures:null,retry:'NO_AUTO_RETRY'};
 let lock=null,claimed=false,claimAttempted=false,lastPass='SOURCE_VERIFIED';
 let outcome;
 try{
  const config=verifyOverlay({sourceRoot,pcHome,
   approvedSha:auth.approval.installedSourceSha,overlay:auth.overlay});
  // Missing credentials are a read-only preflight failure, not a consumed
  // one-shot. Inspect presence only, before creating the durable claim.
  const providerFields=await providerFieldsLoader({sourceRoot,pcHome});
  need(Boolean(providerFields.BLS_API_KEY?.trim()||
   providerFields.BLS_REGISTRATION_KEY?.trim()),'R6_B_REGISTERED_KEY_MISSING');
  lastPass='REGISTERED_KEY_PRESENT';
  lock=await lockFactory(pcHome,auth.request.requestId);
  need(lock.held(),'R6_B_CORE_LOCK_LOST');
  // The Actions Runner may have a different Windows user than scheduled Core.
  // Fail before the no-retry claim and BLS calls if its existing Wrangler/D1
  // read credential is unavailable. SELECT 1 is strictly read-only.
  need(await d1ReadProbe({sourceRoot,pcHome,config})===true,
   'R6_B_D1_AUTH_UNAVAILABLE');
  need(lock.held(),'R6_B_CORE_LOCK_LOST');
  lastPass='D1_READONLY_PREFLIGHT';
  const execute=run??runInstalledR6;
  // A persistent request/mode claim precedes every SQLite or provider effect.
  claimAttempted=true;
  claim(pcHome,{requestId:auth.request.requestId,
   approvalManifestSha256:auth.request.approvalManifestSha256},auth.approval.mode);
  claimed=true;lastPass='ONE_SHOT_CLAIMED';
  const value=await execute({auth,sourceRoot,pcHome,config,lock});
  outcome={...base,...value,lastPass:'PUBLISH_READBACK',firstFail:null};
 }catch(cause){
  const code=safeCode(cause?.code??cause?.message);
  // A claim may have reached persistent storage before the exception; do not
  // call such an outcome a harmless preflight stop or permit an automatic retry.
  const unknown=claimed||code==='R6_B_CORE_LOCK_UNKNOWN'||
   (claimAttempted&&!['R6_B_REQUEST_ALREADY_CLAIMED',
    'R6_B_CLAIM_CREATE_STOP'].includes(code));
  outcome={...base,status:unknown?'STATE_UNKNOWN':'BLOCKED',code,
   lastPass,firstFail:claimed?'COLLECT_OR_PUBLISH':'PREFLIGHT',
   retry:'READ_EXISTING_CLAIM_AND_DB_NO_RETRY'};
 }finally{if(lock){const released=lock.release();if(!released){
  // Source effects may already have completed, but an unresolved Core lock
  // can block ordinary cycles. Preserve it for an authorized read-only review.
  outcome={...base,status:'STATE_UNKNOWN',
   code:'R6_B_CORE_LOCK_RELEASE_UNVERIFIED',lastPass:outcome?.lastPass??lastPass,
   firstFail:'CORE_LOCK_RELEASE',retry:'READ_EXISTING_CORE_LOCK_NO_AUTO_RETRY'};
 }}}
 return outcome;
}

async function runInstalledR6({auth,sourceRoot,pcHome,config,lock}){
 const rootURL=pathToFileURL(path.join(sourceRoot,'scripts','pc-writer')+path.sep);
 const mod=async name=>import(new URL(name,rootURL).href);
 const {loadLocalProviders,installLocalRuntime}=await mod('local-env.mjs');
 const {localDatabase}=await mod('local-db.mjs');
 const {createQuotaFetch}=await mod('quota-fetch.mjs');
 const {runEmploymentR6CollectionStep}=await import(pathToFileURL(
  path.join(sourceRoot,'lib','market-score','employment-r6-collector.mjs')).href);
 const {runEmploymentR6AutoPublication}=await mod('employment-r6-auto-publication.mjs');
 const {client,credential}=await mod('d1.mjs');
 need(lock.held(),'R6_B_CORE_LOCK_LOST');
 const providerEnv=loadLocalProviders(pcHome);
 need(Boolean(providerEnv.BLS_API_KEY?.trim()||providerEnv.BLS_REGISTRATION_KEY?.trim()),
  'R6_B_REGISTERED_KEY_MISSING');
 const originalFetch=globalThis.fetch;
 const quota=createQuotaFetch({base:pcHome,originalFetch,mode:'enforce'});
 const db=localDatabase(path.join(pcHome,'storage','core.sqlite'));
 const hooks=installLocalRuntime({DB:db,BLS_API_KEY:providerEnv.BLS_API_KEY,
  BLS_REGISTRATION_KEY:providerEnv.BLS_REGISTRATION_KEY});
 let result;
 try{
  result=await runEmploymentR6CollectionStep({db,env:{DB:db,
   BLS_API_KEY:providerEnv.BLS_API_KEY,BLS_REGISTRATION_KEY:providerEnv.BLS_REGISTRATION_KEY},
   fetchImpl:(input,init)=>quota.fetch(input,init),mode:auth.approval.mode,
   approvedManualRequestId:auth.request.requestId});
 }finally{hooks.deregister();db.close();}
 need(lock.held(),'R6_B_CORE_LOCK_LOST');
 const groups=safeGroups(result.groupResults??[]);
 const dol=groups.filter(x=>x.groupName==='DOL_UI_WEEKLY_CLAIMS')
  .reduce((a,x)=>a+(x.providerRequests??0),0);
 const bls=groups.filter(x=>x.groupName!=='DOL_UI_WEEKLY_CLAIMS')
  .reduce((a,x)=>a+(x.providerRequests??0),0);
 need(bls<=auth.approval.maxBlsCalls&&dol<=auth.approval.maxDolCalls&&
  groups.length<=6&&groups.every(x=>x.providerRequests!==null)&&
  bls+dol===result.providerRequests,'R6_B_PROVIDER_SCOPE_STOP');
 if(result.status==='NOOP')return {status:'NOOP',code:'R6_B_ALREADY_COLLECTED',
  providerRequests:0,blsRequests:0,dolRequests:0,groupResults:groups,
  sqlite:'UNCHANGED',publication:'NOT_ATTEMPTED'};
 need(['SUCCESS','PARTIAL','FAIL'].includes(result.status),
  'R6_B_COLLECTION_STATUS_STOP');
 // Preserve incomplete groups as PARTIAL; publisher reads only existing PIT
 // records and cannot invent a missing observation or change score formulas.
 const remote=client(config,()=>credential(sourceRoot),{fetchImpl:originalFetch});
 let published;
 try{published=await runEmploymentR6AutoPublication({enabled:true,pcHome,
  approvedSource:auth.approval.installedSourceSha,
  runningSource:auth.approval.installedSourceSha,remote,dbId:config.core,
  now:Date.now()});}
 catch(e){throw error(/^([A-Z][A-Z0-9_]{0,95})$/.test(e?.message??'')?
  e.message:'R6_B_D1_PUBLICATION_FAILED');}
 need(['VERIFIED','UNCHANGED'].includes(published.status),
  'R6_B_D1_READBACK_STOP');
 const complete=result.status==='SUCCESS'&&groups.every(x=>x.status==='SUCCESS');
 return {status:complete?'SUCCESS':'PARTIAL',
  code:complete?'R6_B_COLLECT_PUBLISH_VERIFIED':'R6_B_PARTIAL_PUBLISH_VERIFIED',
  providerRequests:result.providerRequests,blsRequests:bls,dolRequests:dol,
  groupResults:groups,sqlite:'COLLECTOR_RECORDED',publication:published.status,
  sourceStoredAt:published.sourceStoredAt,
  sourceFeatures:published.sourceFeatures,
  chartReadyFeatures:published.chartReadyFeatures};
}

export async function runR6RegisteredOnce({env=process.env}={}){
 need(process.platform==='win32','R6_B_WINDOWS_ONLY_STOP');
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const controlRoot=path.join(env.GITHUB_WORKSPACE,'r6-registered-control');
 const request=JSON.parse(event.issue.body);
 need(SHA64.test(request?.approvalManifestSha256??''),'R6_B_REQUEST_HASH_STOP');
 const relative=`approvals/employment-r6-registered-data/${request.approvalManifestSha256}.json`;
 const git=(args)=>execFileSync('git',args,{cwd:controlRoot,windowsHide:true,stdio:'pipe'});
 need(git(['rev-parse','HEAD']).toString('utf8').trim()===env.GITHUB_SHA,
  'R6_B_CONTROL_PIN_STOP');
 const approvalBytes=git(['show',`HEAD:${relative}`]);
 need(sha(approvalBytes)===request.approvalManifestSha256&&
  sha(fs.readFileSync(path.join(controlRoot,...relative.split('/'))))===sha(approvalBytes),
  'R6_B_APPROVAL_WORKTREE_STOP');
 const overlayPath='approvals/writer-updates/bls-registered-v2-13-writer-b-20261109.json';
 const overlayBytes=git(['show',`HEAD:${overlayPath}`]);
 const parsedApproval=JSON.parse(approvalBytes.toString('utf8'));
 const deltaOverlayBytes=[R6_B_APPROVAL_V2,R6_B_APPROVAL_V3]
  .includes(parsedApproval?.schema)?
  git(['show',`HEAD:${R6_B_DELTA_OVERLAY_PATH}`]):null;
 const collectorDeltaOverlayBytes=parsedApproval?.schema===R6_B_APPROVAL_V3?
  git(['show',`HEAD:${R6_B_COLLECTOR_DELTA_PATH}`]):null;
 const auth=authorizeR6RegisteredB({event,env,approvalBytes,overlayBytes,
  deltaOverlayBytes,collectorDeltaOverlayBytes});
 return performR6RegisteredOnce({auth});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{result=await runR6RegisteredOnce();}
 catch(cause){result={schema:'ZGMINI_R6_REGISTERED_DATA_B_RESULT_V1',
  status:'BLOCKED',code:safeCode(cause?.code??cause?.message),
  requestId:null,retry:'NO_AUTO_RETRY'};}
 try{need(typeof process.env.RUNNER_TEMP==='string'&&path.isAbsolute(process.env.RUNNER_TEMP),
  'R6_B_TEMP_REQUIRED');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,R6_B_RESULT),
   JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(`R6_B_${result.status} ${result.code}\n`);
 if(!['SUCCESS','PARTIAL','NOOP'].includes(result.status))process.exitCode=1;
}
