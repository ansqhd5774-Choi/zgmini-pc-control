/** Fixed, one-shot historical SIP readback. No operational source/sidecar/D1 writes.
 * The existing Alpaca quota guard alone persists bounded request reservations.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const BASE=String.raw`E:\ZGmini\data\pc-writer`;
const CONFIG=path.join(BASE,'config.json');
const INSTALLED_SHA='dace6090f61eb0d0319f79422649af312f7b1764';
const OBSERVATION='2026-11-06';
const PRIOR='2026-11-05';
const PREVIOUS_SAVED_UNIVERSE='2026-11-04'; // Diagnostic membership only; SIP bars remain 11/05–11/06.
const SESSION_START='2026-11-06T09:00:00.000Z'; // 04:00 New York EST.
const SESSION_END='2026-11-06T14:30:00.000Z'; // 09:30 New York EST.
const EARLIEST=Date.parse(SESSION_END)+16*60_000;
const REQUEST_ID=/^r17-sip-historical-[a-f0-9]{32}$/;
const SHA256=/^[a-f0-9]{64}$/;
const BUDGET=24;
const FILES=Object.freeze({
  'scripts/pc-writer/us-breadth-provisional-cycle.mjs':'acaf0e46c532c49dc5a571718c2f91ddcd3dd57dbd0b50d1fb9ee350a7538cd1',
  'scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs':'bf0d4858679295a19c0a35c2a704899d28cbef9e7874efe38d0f71a337b3a959',
  'lib/market-breadth/us-premarket-sip-r1.mjs':'a14cbad48d97895f6e4d2961e74af8ab657cd453a691552ab9f6ff675e7e7c6f',
});

const CODE=/^[A-Z][A-Z0-9_]{1,90}$/;
const failure=(code)=>Object.assign(Error(code),{safeCode:code});
const requireThat=(condition,code)=>{if(!condition)throw failure(code);};
const regular=(file,max=2_000_000)=>{
  const s=fs.lstatSync(file);
  requireThat(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max,'SIP_PROBE_SOURCE_FILE_STOP');
  return fs.readFileSync(file);
};
const fileAt=relative=>path.join(SOURCE,...relative.split('/'));
const jsonObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function authorize(event,env){
  requireThat(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
    env.GITHUB_RUN_ATTEMPT==='1','SIP_PROBE_EVENT_STOP');
  requireThat(event?.action==='opened'&&event?.repository?.private===true&&
    event.repository.full_name===REPO&&event?.sender?.login==='ansqhd5774-Choi'&&
    event?.issue?.user?.login==='ansqhd5774-Choi'&&
    event?.issue?.title==='pc-r17-sip-historical-probe'&&
    event.issue.labels?.some(x=>x.name==='pc-r17-writer-b-install'),
    'SIP_PROBE_ISSUE_SCOPE_STOP');
  let body;
  try{body=JSON.parse(event.issue.body);}catch{throw failure('SIP_PROBE_BODY_STOP');}
  requireThat(jsonObject(body)&&Object.keys(body).sort().join(',')===
    'expectedInstalledSourceSha,requestId,schema,targetDate'&&
    body.schema==='ZGMINI_R17_SIP_HISTORICAL_REQUEST_V1'&&
    REQUEST_ID.test(body.requestId??'')&&body.targetDate===OBSERVATION&&
    body.expectedInstalledSourceSha===INSTALLED_SHA,'SIP_PROBE_BODY_STOP');
  return body;
}

export function verifyInstalledSource(){
  requireThat(fs.lstatSync(SOURCE).isDirectory()&&
    !fs.lstatSync(SOURCE).isSymbolicLink(),'SIP_PROBE_SOURCE_ROOT_STOP');
  const config=JSON.parse(regular(CONFIG,32768));
  requireThat(config?.source===INSTALLED_SHA,'SIP_PROBE_SOURCE_SHA_STOP');
  for(const [relative,hash] of Object.entries(FILES)){
    requireThat(SHA256.test(hash),'SIP_PROBE_MANIFEST_STOP');
    const bytes=regular(fileAt(relative));
    requireThat(createHash('sha256').update(bytes).digest('hex')===hash,
      'SIP_PROBE_INSTALLED_FILE_DRIFT_STOP');
  }
  return true;
}

export async function probeHistorical({now=Date.now(),base=BASE,
  storedSipPremarketUniverse,loadLocalProviders,createQuotaFetch,fetchIexWindow,
  calculateUsSipPremarket,validUsSipPremarket,fetchImpl=fetch}={}){
  requireThat(now>=EARLIEST,'SIP_PROBE_HISTORICAL_NOT_YET_DELAYED');
  // Use the actual newly installed SIP-only membership selector; this probe
  // must not carry its own fallback implementation or modify the IEX selector.
  let selected;
  try{selected=storedSipPremarketUniverse(base,PRIOR);}catch(error){
    const known=['US_PROVISIONAL_DB_MISSING','US_PROVISIONAL_UNIVERSE_MISSING',
      'US_PROVISIONAL_UNIVERSE_INVALID'];
    throw failure(known.includes(error?.message)?error.message:
      'SIP_PROBE_UNIVERSE_READ_STOP');
  }
  const {members,universeAsOfDate}=selected??{};
  requireThat(universeAsOfDate===PRIOR||universeAsOfDate===PREVIOUS_SAVED_UNIVERSE,
    'SIP_PROBE_UNIVERSE_SELECTION_STOP');
  const universeSelection=universeAsOfDate===PRIOR?
    'EXACT_REQUESTED':'PREVIOUS_SAVED_DIAGNOSTIC';
  requireThat(Array.isArray(members)&&members.length>=490&&members.length<=520,
    'SIP_PROBE_UNIVERSE_STOP');
  if(universeSelection==='PREVIOUS_SAVED_DIAGNOSTIC')
    requireThat(members.length===503,'SIP_PROBE_PREVIOUS_UNIVERSE_COUNT_STOP');
  let auth;
  try{auth=loadLocalProviders(base);}catch{
    throw failure('SIP_PROBE_PROVIDER_ENV_STOP');
  } // Never serialize or log provider tokens.
  requireThat(auth?.APCA_API_KEY_ID&&auth?.APCA_API_SECRET_KEY,
    'SIP_PROBE_CREDENTIALS_MISSING');
  let providerCalls=0;
  let guarded;
  try{guarded=createQuotaFetch({base,mode:'enforce',originalFetch:async(url,init)=>{
      requireThat(providerCalls<BUDGET,'SIP_PROBE_BUDGET_STOP');
      providerCalls++;
      return fetchImpl(url,init);
    }}).fetch;
  }catch{throw failure('SIP_PROBE_QUOTA_INIT_STOP');}
  requireThat(typeof guarded==='function','SIP_PROBE_QUOTA_INIT_STOP');
  try{
    const reference=await fetchIexWindow({symbols:members,timeframe:'1Day',
      feed:'sip',start:PRIOR+'T00:00:00Z',end:OBSERVATION+'T00:00:00Z',
      auth,fetchImpl:guarded,maxRequests:8});
    const current=await fetchIexWindow({symbols:members,timeframe:'15Min',
      feed:'sip',start:SESSION_START,end:SESSION_END,
      auth,fetchImpl:guarded,maxRequests:BUDGET-providerCalls});
    const record=calculateUsSipPremarket({members,priorDate:PRIOR,
      observationDate:OBSERVATION,sessionStartUtc:SESSION_START,
      slotEndUtc:SESSION_END,referenceBars:reference.bars,
      currentBars:current.bars,referencePageComplete:reference.pageComplete,
      currentPageComplete:current.pageComplete,collectedAt:new Date(Date.now()).toISOString()});
    requireThat(validUsSipPremarket(record),'SIP_PROBE_CALCULATION_STOP');
    const complete=record.collectionStatus==='COMPLETE';
    const empty=complete&&record.observedCount===0;
    return {status:!complete?'SIP_HISTORICAL_INCOMPLETE_PAGINATION':
      empty?'SIP_HISTORICAL_EMPTY_OBSERVATION':
        universeSelection==='PREVIOUS_SAVED_DIAGNOSTIC'?
          'SIP_HISTORICAL_FALLBACK_DIAGNOSTIC':'SIP_HISTORICAL_REAL_DATA_PASS',
      code:!complete?'SIP_PROBE_INCOMPLETE':
        empty?'SIP_PROBE_NO_OBSERVATIONS':
          universeSelection==='PREVIOUS_SAVED_DIAGNOSTIC'?
            'SIP_PROBE_PREVIOUS_UNIVERSE_DIAGNOSTIC':'SIP_PROBE_VERIFIED',
      observationDate:OBSERVATION,slotEndUtc:SESSION_END,
      checkedAt:new Date().toISOString(),providerCalls,
      universeAsOfDate,universeSelection,
      source:'ALPACA_SIP_PREMARKET_15MIN_DELAYED_SPLIT',
      expectedCount:record.expectedCount,observedCount:record.observedCount,
      missingCount:record.missingCount,
      risingCount:record.counts.rising,fallingCount:record.counts.falling,
      unchangedCount:record.counts.unchanged,
      referenceObservedCount:record.referenceObservedCount,
      freshWithin30m:record.freshWithin30m,
      collectionStatus:record.collectionStatus};
  }catch(error){
    const err=error?.code==='PROVIDER_QUOTA_GUARD'?
      'SIP_PROBE_QUOTA_GUARD':
      /^US_PROVISIONAL_HTTP_(?:401|403|404|408|429|500|502|503|504)$/.test(error?.message??'')?
        error.message:CODE.test(error?.safeCode??'')?error.safeCode:
          'SIP_PROBE_PROVIDER_OR_VALIDATION_FAILED';
    return {status:'SIP_HISTORICAL_NOT_VERIFIED',code:err,
      observationDate:OBSERVATION,slotEndUtc:SESSION_END,
      checkedAt:new Date().toISOString(),providerCalls,
      universeAsOfDate,universeSelection};
  }
}

export function sanitizeProbeResult(raw,requestId,runId){
  const empty={schema:'ZGMINI_R17_SIP_HISTORICAL_RESULT_V1',requestId,
    runId:/^[0-9]{1,18}$/.test(runId??'')?runId:null,
    status:'SIP_HISTORICAL_NOT_VERIFIED',code:'SIP_PROBE_RESULT_UNVERIFIED',
    observationDate:OBSERVATION,slotEndUtc:SESSION_END,
    checkedAt:null,providerCalls:null,retry:'NO_REEXECUTE_READBACK_ONLY'};
  if(!jsonObject(raw)||!['SIP_HISTORICAL_REAL_DATA_PASS',
    'SIP_HISTORICAL_FALLBACK_DIAGNOSTIC',
    'SIP_HISTORICAL_INCOMPLETE_PAGINATION','SIP_HISTORICAL_EMPTY_OBSERVATION',
    'SIP_HISTORICAL_NOT_VERIFIED']
    .includes(raw.status)||!CODE.test(raw.code??'')||
    raw.observationDate!==OBSERVATION||raw.slotEndUtc!==SESSION_END||
    typeof raw.checkedAt!=='string'||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.checkedAt)||
    !Number.isFinite(Date.parse(raw.checkedAt))||
    !Number.isSafeInteger(raw.providerCalls)||raw.providerCalls<0||
    raw.providerCalls>BUDGET)return empty;
  const core={...empty,status:raw.status,code:raw.code,
    checkedAt:raw.checkedAt,providerCalls:raw.providerCalls};
  const selectionValid=(raw.universeAsOfDate===PRIOR&&
    raw.universeSelection==='EXACT_REQUESTED')||
    (raw.universeAsOfDate===PREVIOUS_SAVED_UNIVERSE&&
    raw.universeSelection==='PREVIOUS_SAVED_DIAGNOSTIC');
  if(raw.status==='SIP_HISTORICAL_NOT_VERIFIED')return selectionValid?
    {...core,universeAsOfDate:raw.universeAsOfDate,
      universeSelection:raw.universeSelection}:core;
  const countNames=['expectedCount','observedCount','missingCount','risingCount',
    'fallingCount','unchangedCount','referenceObservedCount','freshWithin30m'];
  if(!selectionValid||
    countNames.some(k=>!Number.isSafeInteger(raw[k])||raw[k]<0)||
    raw.expectedCount<490||raw.expectedCount>520||
    raw.observedCount+raw.missingCount!==raw.expectedCount||
    raw.risingCount+raw.fallingCount+raw.unchangedCount!==raw.observedCount||
    raw.freshWithin30m>raw.observedCount||raw.referenceObservedCount>raw.expectedCount||
    raw.source!=='ALPACA_SIP_PREMARKET_15MIN_DELAYED_SPLIT'||
    !['COMPLETE','INCOMPLETE_PAGINATION'].includes(raw.collectionStatus)||
    (raw.status==='SIP_HISTORICAL_REAL_DATA_PASS'&&
      (raw.collectionStatus!=='COMPLETE'||raw.observedCount===0||
        raw.universeSelection!=='EXACT_REQUESTED'||raw.code!=='SIP_PROBE_VERIFIED'))||
    (raw.status==='SIP_HISTORICAL_FALLBACK_DIAGNOSTIC'&&
      (raw.collectionStatus!=='COMPLETE'||raw.observedCount===0||
        raw.universeSelection!=='PREVIOUS_SAVED_DIAGNOSTIC'||
        raw.code!=='SIP_PROBE_PREVIOUS_UNIVERSE_DIAGNOSTIC'))||
    (raw.status==='SIP_HISTORICAL_EMPTY_OBSERVATION'&&
      (raw.collectionStatus!=='COMPLETE'||raw.observedCount!==0))||
    (raw.status==='SIP_HISTORICAL_INCOMPLETE_PAGINATION'&&
      raw.collectionStatus!=='INCOMPLETE_PAGINATION'))return empty;
  return {...core,source:raw.source,collectionStatus:raw.collectionStatus,
    universeAsOfDate:raw.universeAsOfDate,universeSelection:raw.universeSelection,
    ...Object.fromEntries(countNames.map(k=>[k,raw[k]]))};
}

/** Private GitHub claim is create-only. A missing/ambiguous readback is STOP,
 * not permission to repeat the provider calls or create a second request.
 */
export async function claimOnce({event,env,api=fetch}){
  const auth=authorize(event,env);
  requireThat(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>20,
    'SIP_PROBE_CLAIM_TOKEN_STOP');
  const claim={schema:'ZGMINI_R17_SIP_HISTORICAL_CLAIM_V1',
    requestId:auth.requestId,issueNumber:event.issue.number,
    installedSourceSha:INSTALLED_SHA};
  const content=JSON.stringify(claim)+'\n';
  const filename=`results/r17-sip-historical-claim-${auth.requestId}.json`;
  const url=`https://api.github.com/repos/${REPO}/contents/${filename}`;
  const headers={authorization:`Bearer ${env.GITHUB_TOKEN}`,
    accept:'application/vnd.github+json',
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-r17-sip-historical-once'};
  let first;
  try{first=await api(`${url}?ref=main`,{headers});}
  catch{throw failure('SIP_PROBE_CLAIM_READ_STOP');}
  if(first.status===200)throw failure('SIP_PROBE_DUPLICATE_REQUEST_STOP');
  requireThat(first.status===404,'SIP_PROBE_CLAIM_READ_STOP');
  // No SHA supplied: this is a create-only GitHub Contents write.
  let created=false;
  try{const response=await api(url,{method:'PUT',headers,body:JSON.stringify({
    message:`chore(r17): claim once ${auth.requestId}`,
    content:Buffer.from(content).toString('base64')})});
    created=response.status===201;
  }catch{/* Unknown claim result: do NOT call the provider. */}
  requireThat(created,'SIP_PROBE_CLAIM_WRITE_STOP');
  requireThat(await verifyUploaded(api,url,headers,content),
    'SIP_PROBE_CLAIM_READBACK_STOP');
  return {claimed:true,requestId:auth.requestId};
}

async function verifyUploaded(api,url,headers,expected){
  try{const response=await api(`${url}?ref=main`,{headers});
    if(response.status!==200)return false;
    const body=await response.json();
    return body?.encoding==='base64'&&typeof body.content==='string'&&
      Buffer.from(body.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
  }catch{return false;}
}

export async function uploadProbe({event,env,raw,api=fetch}){
  const auth=authorize(event,env);
  requireThat(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>20,
    'SIP_PROBE_UPLOAD_TOKEN_STOP');
  const report=sanitizeProbeResult(raw,auth.requestId,env.GITHUB_RUN_ID);
  const prefix=`results/r17-sip-historical-${auth.requestId}`;
  const files=[
    [`${prefix}.json`,JSON.stringify(report,null,2)+'\n'],
    [`${prefix}.txt`,[
      `REQUEST_ID=${report.requestId}`,`STATUS=${report.status}`,
      `CODE=${report.code}`,`DATE=${report.observationDate}`,
      `UNIVERSE_AS_OF_DATE=${report.universeAsOfDate??'UNKNOWN'}`,
      `UNIVERSE_SELECTION=${report.universeSelection??'UNKNOWN'}`,
      `SLOT_END_UTC=${report.slotEndUtc}`,`CHECKED_AT=${report.checkedAt??'UNKNOWN'}`,
      `SOURCE=${report.source??'NONE'}`,`EXPECTED=${report.expectedCount??'UNKNOWN'}`,
      `OBSERVED=${report.observedCount??'UNKNOWN'}`,
      `MISSING=${report.missingCount??'UNKNOWN'}`,
      `RISING=${report.risingCount??'UNKNOWN'}`,
      `FALLING=${report.fallingCount??'UNKNOWN'}`,
      `UNCHANGED=${report.unchangedCount??'UNKNOWN'}`,
      `PROVIDER_CALLS=${report.providerCalls??'UNKNOWN'}`,
      `RUN_ID=${report.runId??'UNKNOWN'}`,
      'RETRY=NO_REEXECUTE_READBACK_ONLY'].join('\n')+'\n'],
  ];
  const headers={authorization:`Bearer ${env.GITHUB_TOKEN}`,
    accept:'application/vnd.github+json',
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-r17-sip-historical-once'};
  let created=0,verified=0;
  for(const [filename,content] of files){
    const url=`https://api.github.com/repos/${REPO}/contents/${filename}`;
    try{const response=await api(url,{method:'PUT',headers,body:JSON.stringify({
      message:`chore(r17): historical SIP evidence ${auth.requestId}`,
      content:Buffer.from(content).toString('base64')})});
      if(response.status===201)created++;
    }catch{/* Outcome unknown: read back only, never repeat the PUT. */}
    if(await verifyUploaded(api,url,headers,content))verified++;
  }
  const comment=`<!-- r17-sip-historical:${auth.requestId} -->\n`+
    `R17 historical SIP: **${report.status}** (${report.code}); `+
    `date=${OBSERVATION}; universeAsOf=${report.universeAsOfDate??'UNKNOWN'}; `+
    `universeSelection=${report.universeSelection??'UNKNOWN'}; `+
    `source=${report.source??'UNKNOWN'}.\n`+
    `RESULT_CREATED=${created}/2; RESULT_READBACK=${verified}/2. `+
    `RETRY=NO_REEXECUTE_READBACK_ONLY.\n`;
  const response=await api(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,
    {method:'POST',headers,body:JSON.stringify({body:comment})});
  requireThat(response.status===201,'SIP_PROBE_COMMENT_STOP');
  return {status:report.status,code:report.code,created,verified};
}

export async function loadProbeModules(src){
  let collector,providers,quota,sip,sipCollector;
  try{[collector,providers,quota,sip,sipCollector]=await Promise.all([
      src('scripts/pc-writer/us-breadth-provisional-cycle.mjs'),
      src('scripts/pc-writer/local-env.mjs'),
      src('scripts/pc-writer/quota-fetch.mjs'),
      src('lib/market-breadth/us-premarket-sip-r1.mjs'),
      src('scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs'),
    ]);
  }catch{throw failure('SIP_PROBE_MODULE_IMPORT_STOP');}
  return {collector,providers,quota,sip,sipCollector};
}

export function recheckInstalledSource(verify=verifyInstalledSource){
  try{return verify();}catch(error){
    throw failure(CODE.test(error?.safeCode??'')?
      error.safeCode:'SIP_PROBE_SOURCE_RECHECK_STOP');
  }
}

async function realProbe(){
  recheckInstalledSource();
  const src=async name=>import(pathToFileURL(fileAt(name)).href);
  const {collector,providers,quota,sip,sipCollector}=await loadProbeModules(src);
  return probeHistorical({storedSipPremarketUniverse:sipCollector.storedSipPremarketUniverse,
    fetchIexWindow:collector.fetchIexWindow,
    loadLocalProviders:providers.loadLocalProviders,
    createQuotaFetch:quota.createQuotaFetch,
    calculateUsSipPremarket:sip.calculateUsSipPremarket,
    validUsSipPremarket:sip.validUsSipPremarket});
}

const emptyResult=code=>({status:'SIP_HISTORICAL_NOT_VERIFIED',
  code,observationDate:OBSERVATION,slotEndUtc:SESSION_END,
  checkedAt:new Date().toISOString(),providerCalls:0});

async function main(){
  let result;
  try{
    requireThat(process.platform==='win32','SIP_PROBE_WINDOWS_STOP');
    const event=JSON.parse(regular(process.env.GITHUB_EVENT_PATH,200_000));
    authorize(event,process.env);
    verifyInstalledSource();
    await claimOnce({event,env:process.env});
    result=await realProbe();
  }catch(error){
    result=emptyResult(CODE.test(error?.safeCode??'')?
      error.safeCode:'SIP_PROBE_SETUP_STOP');
  }
  process.stdout.write(JSON.stringify(result)+'\n');
  if(!['SIP_HISTORICAL_REAL_DATA_PASS',
    'SIP_HISTORICAL_FALLBACK_DIAGNOSTIC'].includes(result.status))process.exitCode=1;
}

async function uploadMain(){
  try{
    const event=JSON.parse(regular(process.env.GITHUB_EVENT_PATH,200_000));
    let raw=null;
    try{raw=JSON.parse(regular(path.join(process.env.RUNNER_TEMP,
      'r17-sip-historical-result.json'),32768));}catch{}
    const report=await uploadProbe({event,env:process.env,raw});
    process.stdout.write(`SIP_PROBE_REPORT ${report.status} CREATED=${report.created}/2 `+
      `READBACK=${report.verified}/2\n`);
  }catch{
    process.stderr.write('SIP_PROBE_REPORT_UNVERIFIED_READBACK_ONLY\n');
    process.exitCode=1;
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await (process.argv[2]==='upload'?uploadMain():main());
