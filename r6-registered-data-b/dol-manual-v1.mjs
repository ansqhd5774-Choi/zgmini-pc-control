// W04 DOL-only, owner-approved manual collection. Reuses the installed R6
// collector/store and existing one-shot workflow; never creates a scheduled job.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
// No dependency on the entrypoint: it awaits this module at top-level.
const R6_B_REPO='ansqhd5774-Choi/zgmini-pc-control';
const R6_B_TITLE='pc-employment-r6-registered-data-once';
const R6_B_LABEL='pc-writer-b-install';
const R6_B_SCHEMA='ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1';
const R6_B_SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const R6_B_HOME=String.raw`E:\ZGmini\data\pc-writer`;

export const DOL_MANUAL_SCHEMA='ZGMINI_R6_DOL_MANUAL_B_APPROVAL_V1';
const GROUP='DOL_UI_WEEKLY_CLAIMS';
const FILES=[
 'lib/market-score/employment-r6-provider.mjs',
 'lib/market-score/employment-r6-collector.mjs',
 'lib/market-score/employment-r6-scheduler.mjs',
];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const CODE=/^[A-Z][A-Z0-9_]{0,95}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
const error=code=>Object.assign(new Error(code),{code});
const need=(condition,code)=>{if(!condition)throw error(code);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
 path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();

export function authorizeDolManual({event,env,approvalBytes}={}){
 need(env?.GITHUB_REPOSITORY===R6_B_REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&event.repository?.full_name===R6_B_REPO&&
  event.repository.private===true&&event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&!event.issue.pull_request&&
  event.issue.title===R6_B_TITLE&&
  event.issue.labels?.some(x=>x.name===R6_B_LABEL),'R6_DOL_OWNER_EVENT_STOP');
 let request,approval;
 try{request=JSON.parse(event.issue.body);
  approval=JSON.parse(approvalBytes.toString('utf8'));}
 catch{throw error('R6_DOL_APPROVAL_JSON_STOP');}
 need(exact(request,['schema','requestId','chatId','operation','approvalManifestSha256'])&&
  request.schema===R6_B_SCHEMA&&request.operation==='employment-r6-registered-data-once'&&
  UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
  SHA64.test(request.approvalManifestSha256??'')&&
  Buffer.isBuffer(approvalBytes)&&hash(approvalBytes)===request.approvalManifestSha256,
  'R6_DOL_APPROVAL_HASH_STOP');
 const keys=['schema','status','scope','mode','sourceRepository','installedSourceSha',
  'sourceRoot','pcHome','groupName','maxDolCalls','fileHashes','effects'];
 need(exact(approval,keys)&&approval.schema===DOL_MANUAL_SCHEMA&&
  approval.status==='APPROVED_B'&&
  approval.scope==='EMPLOYMENT_R6_DOL_MANUAL_SQLITE_ONCE'&&
  approval.mode==='ONE_YEAR'&&approval.groupName===GROUP&&
  approval.sourceRepository==='ansqhd5774-Choi/zgmini'&&
  SHA40.test(approval.installedSourceSha??'')&&
  same(approval.sourceRoot,R6_B_SOURCE)&&same(approval.pcHome,R6_B_HOME)&&
  approval.maxDolCalls===2,'R6_DOL_SCOPE_STOP');
 need(exact(approval.fileHashes,FILES)&&
  FILES.every(p=>SHA64.test(approval.fileHashes[p]??'')),
  'R6_DOL_FILE_SCOPE_STOP');
 need(exact(approval.effects,['dolProviderCalls','sqliteWrites','rawSnapshotReadback',
  'blsProviderCalls','d1Writes','taskWrites','sourceWrites'])&&
  approval.effects.dolProviderCalls===true&&
  approval.effects.sqliteWrites===true&&
  approval.effects.rawSnapshotReadback===true&&
  approval.effects.blsProviderCalls===false&&
  approval.effects.d1Writes===false&&approval.effects.taskWrites===false&&
  approval.effects.sourceWrites===false,'R6_DOL_EFFECT_SCOPE_STOP');
 return {request,approval};
}

export async function runInstalledDolManual({auth,pcHome=R6_B_HOME,
 sourceRoot=R6_B_SOURCE,lock}={}){
 need(lock.held(),'R6_DOL_CORE_LOCK_LOST');
 const root=pathToFileURL(path.join(sourceRoot,'scripts','pc-writer')+path.sep);
 const mod=name=>import(new URL(name,root).href);
 const {localDatabase}=await mod('local-db.mjs');
 const {createQuotaFetch}=await mod('quota-fetch.mjs');
 const {installLocalRuntime}=await mod('local-env.mjs');
 const {runEmploymentR6CollectionStep}=await import(pathToFileURL(path.join(
  sourceRoot,'lib','market-score','employment-r6-collector.mjs')).href);
 const originalFetch=globalThis.fetch;
 const quota=createQuotaFetch({base:pcHome,originalFetch,mode:'enforce'});
 const db=localDatabase(path.join(pcHome,'storage','core.sqlite'));
 const start=new Date().toISOString();
 let output;
 const hooks=installLocalRuntime({DB:db});
 try{
  output=await runEmploymentR6CollectionStep({
   db,env:{DB:db},fetchImpl:(url,init)=>quota.fetch(url,init),
   mode:'ONE_YEAR',groups:[GROUP],
  });
  need(lock.held(),'R6_DOL_CORE_LOCK_LOST');
  const groups=output.groupResults??[];
  need(groups.length<=1&&groups.every(x=>x.groupName===GROUP)&&
   Number.isSafeInteger(output.providerRequests)&&
   output.providerRequests>=0&&output.providerRequests<=2,
   'R6_DOL_PROVIDER_SCOPE_STOP');
  const core=await db.prepare(`
   SELECT COUNT(DISTINCT c.logical_series_id) AS n,
    COUNT(*) AS rows
   FROM market_score_employment_r4_shadow_current_v1 c
   WHERE c.provider='DOL_ETA' AND c.geography_type='NATIONAL'
    AND c.retrieved_at>=? AND c.logical_series_id IN
      ('INITIAL_CLAIMS','INITIAL_CLAIMS_4W','CONTINUED_CLAIMS','INSURED_UNEMPLOYMENT_RATE')
    AND EXISTS (
      SELECT 1 FROM market_score_employment_r6_raw_snapshot_v1 s
      WHERE s.body_sha256=json_extract(c.provenance_json,'$.responseHash')
       AND s.release_group='DOL_UI_WEEKLY_CLAIMS'
       AND s.request_key LIKE 'DOL_NATIONAL:%'
    )`).bind(start).first();
  const state=await db.prepare(`
   SELECT COUNT(*) AS n FROM market_score_employment_r4_shadow_current_v1
   WHERE provider='DOL_ETA' AND geography_type='STATE'
    AND logical_series_id='STATE_INITIAL_CLAIMS' AND retrieved_at>=?`
  ).bind(start).first();
  const nationalSeries=Number(core?.n??0);
  const nationalRows=Number(core?.rows??0);
  const stateRows=Number(state?.n??0);
  need(Number.isSafeInteger(nationalSeries)&&nationalSeries>=0&&nationalSeries<=4&&
   Number.isSafeInteger(nationalRows)&&nationalRows>=0&&
   Number.isSafeInteger(stateRows)&&stateRows>=0&&stateRows<=35000,
   'R6_DOL_READBACK_INVALID');
  const safeGroups=groups.map(x=>({
   groupName:GROUP,status:x.status,providerRequests:x.providerRequests,
   ...(CODE.test(x.failureCode??'')?{failureCode:x.failureCode}:{}),
  }));
  if(output.status==='NOOP')return {status:'NOOP',code:'R6_B_ALREADY_COLLECTED',
   providerRequests:0,blsRequests:0,dolRequests:0,groupResults:[],
   sqlite:'UNCHANGED',publication:'NOT_ATTEMPTED',
   nationalSeriesSaved:0,nationalRowsSaved:0,stateRowsSaved:0};
  need(['SUCCESS','PARTIAL','FAIL'].includes(output.status),'R6_DOL_RESULT_INVALID');
  return {
   status:output.status==='FAIL'?'STATE_UNKNOWN':output.status,
   code:output.status==='SUCCESS'?'R6_DOL_MANUAL_COLLECTED':
     output.status==='PARTIAL'?'R6_DOL_MANUAL_PARTIAL':'R6_DOL_MANUAL_COLLECT_FAILED',
   providerRequests:output.providerRequests,blsRequests:0,dolRequests:output.providerRequests,
   groupResults:safeGroups,
   sqlite:'COLLECTOR_RECORDED',publication:'NOT_ATTEMPTED',
   nationalSeriesSaved:nationalSeries,nationalRowsSaved:nationalRows,
   stateRowsSaved:stateRows,
  };
 }finally{hooks.deregister();db.close();}
}

export async function performDolManual({auth,sourceRoot=R6_B_SOURCE,
 pcHome=R6_B_HOME,verify,acquire,claim,run=runInstalledDolManual}={}){
 need(typeof verify==='function'&&typeof acquire==='function'&&
  typeof claim==='function','R6_DOL_ADAPTER_MISSING');
 const base={schema:'ZGMINI_R6_REGISTERED_DATA_B_RESULT_V1',
  requestId:auth.request.requestId,sourceSha:auth.approval.installedSourceSha,
  mode:'ONE_YEAR',status:'STATE_UNKNOWN',code:'R6_DOL_NOT_STARTED',
  providerRequests:null,blsRequests:null,dolRequests:null,groupResults:[],
  sqlite:'UNVERIFIED',publication:'NOT_ATTEMPTED',sourceStoredAt:null,
  sourceFeatures:null,chartReadyFeatures:null,nationalSeriesSaved:null,
  nationalRowsSaved:null,stateRowsSaved:null,retry:'NO_AUTO_RETRY'};
 let lock=null,claimed=false,claimAttempted=false,lastPass='SOURCE_UNVERIFIED',outcome;
 try{
  const overlay={files:FILES.map(p=>({path:p,afterSha256:auth.approval.fileHashes[p]}))};
  verify({sourceRoot,pcHome,approvedSha:auth.approval.installedSourceSha,overlay});
  lastPass='SOURCE_VERIFIED';
  lock=await acquire(pcHome,auth.request.requestId);
  need(lock.held(),'R6_DOL_CORE_LOCK_LOST');
  claimAttempted=true;
  claim(pcHome,{requestId:auth.request.requestId,
   approvalManifestSha256:auth.request.approvalManifestSha256},'ONE_YEAR');
  claimed=true;lastPass='ONE_SHOT_CLAIMED';
  const value=await run({auth,sourceRoot,pcHome,lock});
  outcome={...base,...value,lastPass:'COLLECT_READBACK',
   firstFail:value.status==='STATE_UNKNOWN'?'COLLECT_OR_PUBLISH':null};
 }catch(cause){
  const code=CODE.test(cause?.code??'')?cause.code:'R6_DOL_UNCLASSIFIED_STOP';
  const unknown=claimed||code==='R6_B_CORE_LOCK_UNKNOWN'||
   (claimAttempted&&!['R6_B_REQUEST_ALREADY_CLAIMED',
    'R6_B_CLAIM_CREATE_STOP'].includes(code));
  outcome={...base,status:unknown?'STATE_UNKNOWN':'BLOCKED',code,
   lastPass,firstFail:claimed?'COLLECT_OR_PUBLISH':'PREFLIGHT',
   retry:'READ_EXISTING_CLAIM_AND_DB_NO_RETRY'};
 }finally{if(lock&&!lock.release()){
  outcome={...base,status:'STATE_UNKNOWN',code:'R6_DOL_LOCK_RELEASE_UNVERIFIED',
   lastPass:outcome?.lastPass??lastPass,firstFail:'CORE_LOCK_RELEASE',
   retry:'READ_EXISTING_CORE_LOCK_NO_AUTO_RETRY'};
 }}
 return outcome;
}

export async function runDolManualOnce({
 event,env,approvalBytes,verify,acquire,claim
}={}){
 const auth=authorizeDolManual({event,env,approvalBytes});
 return performDolManual({auth,verify,acquire,claim});
}
