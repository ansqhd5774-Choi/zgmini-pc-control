// D05 S01-S11: fixed PC local -> D1 current -> public confirmed API evidence.
// No arbitrary SQL, feed parameters, raw bodies, secrets, provider calls or mutations.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';
import {inspectSectorR3DatedLedger,sectorR3StoredDisplayDigest} from './sector-r3-dated-ledger-readonly.mjs';

const FEED='sector-fear-greed-r3';
const SQL="SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key='current' LIMIT 1";
const URL='https://zgmini.kr/api/sector-fear-greed';
const LIMIT=1_800_000;
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const hex=s=>createHash('sha256').update(s).digest('hex');
const time=n=>Number.isSafeInteger(n)&&n>0&&Number.isFinite(new Date(n).getTime());
const initial=(code,extra={})=>({
 status:'STATE_UNKNOWN',code,evidenceLevel:'SAME_EVENT_NOT_VERIFIED',
 localStatus:'NOT_CHECKED',d1:{status:'NOT_CHECKED'},api:{status:'NOT_CHECKED'},
 sameEventVerified:false,oneYearPitVerified:false,inputLineage:'NOT_ATTESTED',
 providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false,...extra
});
const safeSummary=(row)=>{
 if(!row)return {status:'MISSING'};
 if(typeof row.body!=='string'||Buffer.byteLength(row.body,'utf8')>LIMIT||
  !time(Number(row.stored_at)))return {status:'INVALID'};
 let body;try{body=JSON.parse(row.body);}catch{return {status:'INVALID'};}
 const displayDigestSha256=sectorR3StoredDisplayDigest(body);
 if(!displayDigestSha256)return {status:'INVALID'};
 return {status:'READ',storedAt:Number(row.stored_at),
  observationDate:body.observationDate,bodySha256:hex(Buffer.from(row.body,'utf8')),
  displayDigestSha256};
};
const isoHeaderAt=v=>{
 if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v))
  return null;
 const ms=Date.parse(v);
 return time(ms)&&new Date(ms).toISOString()===v?ms:null;
};

// Compares only already-stored public-derived evidence. History length 252
// validates a recalculated trend, NOT 252 point-in-time source vintages.
export function compareSectorR3D1ApiReadback(local,rawD1,apiResponse){
 const base=initial('SECTOR_R3_LOCAL_UNVERIFIED',{
  localStatus:local?.status??'UNKNOWN',sqliteOpened:local?.sqliteOpened===true
 });
 if(local?.status!=='PASS'||local.localCurrentMatchesDate!==true||
  local.pcDate?.status!=='READ'||local.localCurrent?.status!=='READ'||
  !time(local.pcDate.storedAt)||local.pcDate.storedAt!==local.localCurrent.storedAt||
  local.pcDate.bodySha256!==local.localCurrent.bodySha256||
  local.pcDate.displayDigestSha256!==local.localCurrent.displayDigestSha256)
  return base;
 const pc=local.pcDate;
 const d1=safeSummary(rawD1);
 const d1Matches=d1.status==='READ'&&d1.storedAt===pc.storedAt&&
  d1.bodySha256===pc.bodySha256&&
  d1.observationDate===pc.observationDate&&
  d1.displayDigestSha256===pc.displayDigestSha256;
 const d1Status=d1Matches?'MATCHED':d1.status!=='READ'?d1.status:
  d1.storedAt>pc.storedAt?'REMOTE_NEWER':'MISMATCH';
 const apiBody=apiResponse?.body;
 const httpStatus=Number.isInteger(apiResponse?.httpStatus)?apiResponse.httpStatus:null;
 const phase=apiBody?.phase==='CONFIRMED'?'CONFIRMED':
  apiBody?.phase==='PROVISIONAL'?'PROVISIONAL':'UNVERIFIED';
 const apiDigest=phase==='CONFIRMED'?sectorR3StoredDisplayDigest(apiBody):null;
 const headerAt=isoHeaderAt(apiResponse?.snapshotAt);
 const apiMatched=Boolean(httpStatus===200&&phase==='CONFIRMED'&&
  apiBody?.confirmedObservationDate===pc.observationDate&&
  apiBody?.observationDate===pc.observationDate&&
  SHA64.test(apiDigest??'')&&apiDigest===pc.displayDigestSha256&&
  headerAt===pc.storedAt);
 const apiStatus=apiMatched?'MATCHED':phase==='PROVISIONAL'?'PROVISIONAL':
  httpStatus!==200?'UNAVAILABLE':'MISMATCH_OR_UNVERIFIED';
 const complete=d1Matches&&apiMatched;
 return {
  ...base,status:complete?'PASS':'PARTIAL',
  code:complete?'SECTOR_R3_PC_D1_API_CONFIRMED_MATCH':
   !d1Matches?'SECTOR_R3_D1_CURRENT_NOT_SAME_EVENT':
   'SECTOR_R3_PUBLIC_API_NOT_SAME_CONFIRMED_EVENT',
  evidenceLevel:complete?'SAME_EVENT_DISPLAY_READBACK_ONLY':'SAME_EVENT_NOT_VERIFIED',
  local:{snapshotKey:pc.snapshotKey,storedAt:pc.storedAt,
   observationDate:pc.observationDate,bodySha256:pc.bodySha256,
   displayDigestSha256:pc.displayDigestSha256},
  d1:{status:d1Status,storedAt:d1.storedAt??null,
   observationDate:d1.observationDate??null,
   bodySha256:d1.bodySha256??null,displayDigestSha256:d1.displayDigestSha256??null},
  api:{status:apiStatus,httpStatus,phase,confirmedObservationDate:
   typeof apiBody?.confirmedObservationDate==='string'?apiBody.confirmedObservationDate:null,
   snapshotAt:headerAt,displayDigestSha256:apiDigest},
  sameEventVerified:complete
 };
}

const configSafe=c=>SHA40.test(c?.source??'')&&
 /^[a-f0-9]{32}$/.test(c?.account??'')&&
 /^[a-f0-9-]{36}$/.test(c?.core??'');

async function readFixedD1(dataRoot,fileSystem){
 const f=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer','config.json'),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!f.ok)throw Error('WRITER_CONFIG_READ_DENIED');
 let c;try{c=JSON.parse(f.bytes.toString('utf8'))}catch{throw Error('WRITER_CONFIG_INVALID')}
 if(!configSafe(c))throw Error('WRITER_CONFIG_CONTRACT_INVALID');
 const checkout=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
 const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(checkout);
 if(!fileSystem.statSync(path.join(real,'scripts','pc-writer','d1.mjs')).isFile())
  throw Error('D1_CLIENT_MISSING');
 const binary=selectR6GitBinary({exists:fileSystem.existsSync});
 if(!binary)throw Error('GIT_BINARY_UNAVAILABLE');
 const git=args=>execFileSync(binary,
  ['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false',
   '-C',real,...args],{encoding:'utf8',windowsHide:true,timeout:10000,
    maxBuffer:65536,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',
    GIT_TERMINAL_PROMPT:'0'},stdio:['ignore','pipe','ignore']}).trim();
 if(git(['rev-parse','HEAD'])!==c.source)throw Error('D1_CLIENT_SOURCE_DRIFT');
 for(const p of ['scripts/pc-writer/d1.mjs','scripts/pc-writer/d1-transient.mjs',
   'scripts/pc-writer/d1-diagnostics.mjs']){
  git(['ls-files','--error-unmatch','--',p]);
  git(['diff','--quiet','HEAD','--',p]);
 }
 const {client,credential}=await import(pathToFileURL(path.join(real,'scripts','pc-writer','d1.mjs')).href);
 return (await client(c,()=>credential(real)).query(c.core,SQL,[FEED])).results?.[0]??null;
}

async function readFixedApi(){
 const response=await fetch(URL,{method:'GET',redirect:'error',headers:{
  accept:'application/json','cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
 const status=response.status, snapshotAt=response.headers.get('x-data-snapshot-at');
 if(!response.ok||Number(response.headers.get('content-length')??0)>LIMIT)
  return {httpStatus:status,snapshotAt,body:null};
 const reader=response.body?.getReader();
 if(!reader)return {httpStatus:status,snapshotAt,body:null};
 let size=0,bytes=[];
 try{
  while(size<=LIMIT){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>LIMIT)break;bytes.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});}
 if(size>LIMIT)return {httpStatus:status,snapshotAt,body:null};
 try{return {httpStatus:status,snapshotAt,
  body:JSON.parse(Buffer.concat(bytes).toString('utf8'))};}
 catch{return {httpStatus:status,snapshotAt,body:null};}
}

export async function inspectSectorR3D1ApiReadback(dataRoot,{fileSystem=fs,
 localProbe=inspectSectorR3DatedLedger,queryFixed=null,fetchFixed=null}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return initial('SECTOR_R3_DATA_ROOT_INVALID');
 let local;
 try{local=localProbe(dataRoot)}catch{return initial('SECTOR_R3_LOCAL_READ_FAILED');}
 if(local?.status!=='PASS'||!local.localCurrentMatchesDate)
  return initial('SECTOR_R3_LOCAL_UNVERIFIED',{
   localStatus:local?.status??'UNKNOWN',sqliteOpened:local?.sqliteOpened===true});
 let row;
 try{row=queryFixed?await queryFixed(SQL,[FEED]):await readFixedD1(dataRoot,fileSystem)}
 catch{return initial('SECTOR_R3_D1_READ_UNVERIFIED',{localStatus:local.status,
  sqliteOpened:local.sqliteOpened===true});}
 let api;
 try{api=fetchFixed?await fetchFixed():await readFixedApi()}
 catch{api={httpStatus:null,body:null,snapshotAt:null};}
 return compareSectorR3D1ApiReadback(local,row,api);
}
