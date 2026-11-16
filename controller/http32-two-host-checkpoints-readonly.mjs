// Exact-file, read-only supplements to the observed HTTP cohort. These
// checkpoints show collector/cache state; they do NOT prove a provider GET
// after a release or authorize a green connectivity status.
// No raw JSON, query, credential, path or user-supplied filename is emitted.
import fs from 'node:fs';
import path from 'node:path';

const ROOT='E:/ZGmini/data/pc-writer';
const MAX_BYTES=16384;
const ALLOWED_ROOT_FILES=Object.freeze({
 alpacaReport:['local-asset-bubble-r10-alpaca-collection.json'],
 alpacaCheckpoint:['asset-r10-alpaca','incremental-checkpoint.json'],
 monthlyBackfill:['local-monthly-one-year-backfill-last-run.json']
});
const isDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'));
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?
 new Date(x).toISOString():null;
const safeInteger=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const reportStatus=(x,allowed)=>typeof x==='string'&&allowed.includes(x)?x:'UNVERIFIED';
function safeJson(root,parts,fileSystem){
 try{
  let current=root;
  for(const part of parts.slice(0,-1)){
   current=path.join(current,part);
   const st=fileSystem.lstatSync(current);
   if(!st.isDirectory()||st.isSymbolicLink())return {state:'UNSAFE_PATH',value:null};
  }
  const full=path.join(root,...parts),st=fileSystem.lstatSync(full);
  if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>MAX_BYTES)
   return {state:'UNSAFE_FILE',value:null};
  const first=fileSystem.readFileSync(full),second=fileSystem.readFileSync(full);
  const after=fileSystem.lstatSync(full);
  if(!Buffer.isBuffer(first)||!Buffer.isBuffer(second)||!first.equals(second)||
    first.length!==st.size||after.size!==st.size||after.mtimeMs!==st.mtimeMs)
   return {state:'CHANGED_DURING_READ',value:null};
  const val=JSON.parse(first.toString('utf8'));
  if(!val||typeof val!=='object'||Array.isArray(val))
   return {state:'INVALID_JSON',value:null};
  return {state:'READ_VERIFIED',value:val};
 }catch(e){return {state:e?.code==='ENOENT'?'FILE_ABSENT':'FILE_UNREADABLE',value:null};}
}
export function inspectHttp32TwoHostCheckpoints({
 root=ROOT,fileSystem=fs,now=Date.now()
}={}){
 const empty=reason=>({schema:'ZGMINI_HTTP32_TWO_HOST_CHECKPOINTS_RO_V1',
  status:'UNVERIFIED',reason,observedAt:null,hosts:[],
  sourceOnly:true,providerCalls:0,operationalWrites:0,d1Writes:0,
  sqliteOpened:false});
 if(typeof root!=='string'||!path.isAbsolute(root)||
    !Number.isSafeInteger(now)||now<0)return empty('UNVERIFIED_INPUT');
 const ar=safeJson(root,ALLOWED_ROOT_FILES.alpacaReport,fileSystem);
 const ac=safeJson(root,ALLOWED_ROOT_FILES.alpacaCheckpoint,fileSystem);
 const br=safeJson(root,ALLOWED_ROOT_FILES.monthlyBackfill,fileSystem);
 const a=ar.value??{},c=ac.value??{},b=br.value??{},chart=b.chart??{};
 const checked=time(a.checkedAt);
 const age=checked?now-Date.parse(checked):null;
 const aligned=isDate(a.requestEnd)&&isDate(c.through)&&a.requestEnd===c.through;
 const alpacaEvidence=ar.state==='READ_VERIFIED'&&ac.state==='READ_VERIFIED'&&
  checked!==null&&age!==null&&age>=0&&age<=20*3600000&&
  aligned&&a.storageVerified===true&&a.status==='COLLECTED_PENDING_VALIDATION';
 const result={
  schema:'ZGMINI_HTTP32_TWO_HOST_CHECKPOINTS_RO_V1',
  status:'READ_ONLY_COLLECTED',reason:null,observedAt:new Date(now).toISOString(),
  hosts:[
   {host:'data.alpaca.markets',source:'R10_ALPACA_INCREMENTAL_LOCAL',
    reportReadState:ar.state,checkpointReadState:ac.state,
    reportStatus:reportStatus(a.status,['COLLECTED_PENDING_VALIDATION','DEFERRED_QUOTA','BLOCKED','CACHED']),
    checkedAt:checked,requestEnd:isDate(a.requestEnd)?a.requestEnd:null,
    checkpointThrough:isDate(c.through)?c.through:null,
    cacheWindowHours:20,withinCacheWindow:age===null||age<0?null:age<=20*3600000,
    storageVerified:a.storageVerified===true,checkpointAligned:aligned,
    cacheEvidenceVerified:alpacaEvidence,
    runRequests:safeInteger(a.runRequests),
    note:'R10_CACHE_NOT_PROOF_OF_ALL_ALPACA_COLLECTORS'},
   {host:'cdn.www.census.gov',source:'PC_MONTHLY_ONE_YEAR_BACKFILL_LOCAL',
    reportReadState:br.state,
    reportStatus:reportStatus(b.status,['RUNNING','STORED','PARTIAL','FAILED']),
    lastBackfillAt:time(b.at),asOf:isDate(b.asOf)?b.asOf:null,
    chartStatus:reportStatus(chart.status,['READY','STORED','SKIPPED_DB_UNAVAILABLE']),
    chartTarget:isDate(chart.target)?chart.target:null,
    chartRecordCount:safeInteger(chart.recordCount),
    chartRowsWritten:safeInteger(chart.rowsWritten),
    note:'PC_BACKFILL_NOT_CLOUDFLARE_D1_OR_POST_RELEASE_HTTP_PROOF'}
  ],sourceOnly:true,providerCalls:0,operationalWrites:0,d1Writes:0,
  sqliteOpened:false
 };
 return result;
}
