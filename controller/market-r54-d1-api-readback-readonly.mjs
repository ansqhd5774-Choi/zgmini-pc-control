// Fixed A-grade W04 R54 public readback. Only PC-local saved result,
// D1 current/day snapshots, and the public GET. No collection or mutations.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {inspectSourceInventory} from './source-inventory-runtime-readonly.mjs';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';

const URL='https://zgmini.kr/api/market-score';
const SQL='SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?';
const METHOD='EMPLOYMENT_R54_STORED_4FACTOR_R1';
const EVENT='R54_STORED_CALCULATION_EVENT_R1';
const DAY=/^20[0-9]{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/;
const SHA40=/^[a-f0-9]{40}$/;
const MAX=2_000_000;
const resultBase=()=>({status:'STATE_UNKNOWN',code:'R54_PUBLIC_READBACK_NOT_VERIFIED',
 local:null,d1:{status:'NOT_CHECKED',currentStoredAt:null,dayStoredAt:null,
  currentMatched:false,dayMatched:false},api:{status:'NOT_CHECKED',httpStatus:null,
  asOfDate:null,score:null,methodologyVersion:null,trendLastDate:null,matched:false},
 providerCalls:0,d1Writes:0,operationalWrites:0});
const epoch=n=>Number.isSafeInteger(Number(n))&&Number(n)>0?Number(n):null;
const validDay=s=>typeof s==='string'&&DAY.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;

// Parse without revealing raw payloads, identifiers, credentials, or input bodies.
export function summarizeR54PublicRow(row){
 const out={valid:false,storedAt:epoch(row?.stored_at),asOfDate:null,
  score:null,methodologyVersion:null,calculatedAt:null,trendLastDate:null};
 if(typeof row?.body!=='string'||Buffer.byteLength(row.body,'utf8')>MAX||!out.storedAt)return out;
 let body;try{body=JSON.parse(row.body);}catch{return out;}
 return summarizeR54PublicBody(body,{storedAt:out.storedAt});
}
export function summarizeR54PublicBody(body,{storedAt=null}={}){
 const out={valid:false,storedAt,asOfDate:null,score:null,
  methodologyVersion:null,calculatedAt:null,trendLastDate:null};
 if(!body||typeof body!=='object'||!validDay(body.asOfDate)||
  body.status!=='SUCCESS'||!Array.isArray(body.domains))return out;
 const domains=body.domains.filter(d=>d?.id==='employment');
 if(domains.length!==1)return out;
 const d=domains[0],event=d?.lastCalculationEvent,last=Array.isArray(d?.trend)?d.trend.at(-1):null;
 const score=d?.score;
 const valid=d?.status==='READY'&&d?.methodologyVersion===METHOD&&
  d?.asOfDate===body.asOfDate&&typeof score==='number'&&Number.isFinite(score)&&
  score>=0&&score<=100&&event?.kind===EVENT&&
  event?.methodologyVersion===METHOD&&
  typeof event?.calculatedAt==='string'&&
  Number.isFinite(Date.parse(event.calculatedAt))&&
  new Date(event.calculatedAt).toISOString()===event.calculatedAt&&
  event.calculatedAt===body.updatedAt&&
  event.calculatedAt.slice(0,10)===body.asOfDate&&
  Array.isArray(d.indicators)&&d.indicators.length===4&&
  Array.isArray(event.factorObservationDates)&&event.factorObservationDates.length===4&&
  last?.label===body.asOfDate&&last?.pointKind===EVENT&&
  last?.value===score&&last?.calculatedAt===event.calculatedAt;
 return {...out,valid,asOfDate:body.asOfDate,
  score:valid?score:null,methodologyVersion:valid?METHOD:null,
  calculatedAt:valid?event.calculatedAt:null,
  trendLastDate:valid?last.label:null};
}
const same=(a,local)=>a?.valid===true&&local?.eventVerified===true&&
 a.asOfDate===local.asOfDate&&a.score===local.score&&
 a.methodologyVersion===local.methodologyVersion&&
 a.calculatedAt===local.eventCalculatedAt&&
 a.trendLastDate===local.trendLastDate&&a.storedAt===local.currentStoredAt;
export function compareR54PublicEvidence(local,rows,apiResponse){
 const out=resultBase();out.local=local??null;
 if(local?.eventVerified!==true||!validDay(local.asOfDate))
  return {...out,code:'R54_LOCAL_EVENT_UNVERIFIED'};
 const current=summarizeR54PublicRow(rows?.current);
 const day=summarizeR54PublicRow(rows?.day);
 const currentMatched=same(current,local),dayMatched=same(day,local);
 const remoteNewer=current.storedAt!==null&&current.storedAt>local.currentStoredAt;
 out.d1={status:currentMatched&&dayMatched?'VERIFIED':remoteNewer?'REMOTE_NEWER':'MISMATCH_OR_MISSING',
  currentStoredAt:current.storedAt,dayStoredAt:day.storedAt,
  currentMatched,dayMatched};
 const api=apiResponse;
 const parsed=summarizeR54PublicBody(api?.body??null);
 const matched=parsed.valid&&parsed.asOfDate===local.asOfDate&&
  parsed.score===local.score&&parsed.methodologyVersion===local.methodologyVersion&&
  parsed.calculatedAt===local.eventCalculatedAt&&
  parsed.trendLastDate===local.trendLastDate;
 out.api={status:matched?'VERIFIED':api?.httpStatus===200?'MISMATCH_OR_UNVERIFIED':'UNAVAILABLE',
  httpStatus:Number.isInteger(api?.httpStatus)?api.httpStatus:null,
  asOfDate:parsed.asOfDate,score:parsed.score,
  methodologyVersion:parsed.methodologyVersion,trendLastDate:parsed.trendLastDate,
  matched:Boolean(matched)};
 const complete=currentMatched&&dayMatched&&matched;
 return {...out,status:complete?'PASS':'PARTIAL',
  code:complete?'R54_PUBLIC_D1_API_MATCHED':
   !currentMatched||!dayMatched?'R54_D1_LOCAL_MISMATCH':'R54_API_D1_MISMATCH'};
}
const configSafe=c=>c&&SHA40.test(c.source??'')&&
 /^[a-f0-9]{32}$/.test(c.account??'')&&
 /^[a-f0-9-]{36}$/.test(c.core??'');
export async function inspectR54PublicReadback(dataRoot,{
 localProbe=inspectSourceInventory,queryFixed=null,fetchFixed=null,fileSystem=fs,
}={}){
 const out=resultBase();
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return {...out,code:'R54_DATA_ROOT_INVALID'};
 let local;
 try{local=localProbe(dataRoot)?.core?.r54StoredEvent;}
 catch{return {...out,code:'R54_LOCAL_READ_FAILED'};}
 if(local?.eventVerified!==true)return {...out,code:'R54_LOCAL_EVENT_UNVERIFIED',local:local??null};
 let rows;
 try{
  if(queryFixed)rows=await queryFixed(local.asOfDate);
  else{
   const configFile=path.join(dataRoot,'pc-writer','config.json');
   const c=readFixedReadonlyBytes(configFile,
    {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
   if(!c.ok)return {...out,code:'R54_WRITER_CONFIG_MISSING',local};
   let config;try{config=JSON.parse(c.bytes.toString('utf8'));}
   catch{return {...out,code:'R54_WRITER_CONFIG_INVALID',local};}
   if(!configSafe(config))return {...out,code:'R54_D1_CONFIG_UNAPPROVED',local};
   const checkout=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
   const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(checkout);
   const module=path.join(real,'scripts','pc-writer','d1.mjs');
   if(!fileSystem.statSync(module).isFile())
    return {...out,code:'R54_APPROVED_D1_CLIENT_MISSING',local};
   const binary=selectR6GitBinary({exists:fileSystem.existsSync});
   if(!binary)return {...out,code:'R54_GIT_NOT_INSTALLED',local};
   const git=args=>execFileSync(binary,
    ['--no-optional-locks','-c','core.fsmonitor=false',
     '-c','core.untrackedCache=false','-C',real,...args],
    {encoding:'utf8',timeout:10000,maxBuffer:65536,windowsHide:true,
     env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
     stdio:['ignore','pipe','ignore']}).trim();
   if(git(['rev-parse','HEAD'])!==config.source)
    return {...out,code:'R54_D1_CLIENT_SOURCE_MISMATCH',local};
   for(const p of ['scripts/pc-writer/d1.mjs',
    'scripts/pc-writer/d1-transient.mjs','scripts/pc-writer/d1-diagnostics.mjs']){
    git(['ls-files','--error-unmatch','--',p]);
    git(['diff','--quiet','HEAD','--',p]);
   }
   const {client,credential}=await import(pathToFileURL(module).href);
   const remote=client(config,()=>credential(real));
   const current=(await remote.query(config.core,SQL,['current'])).results?.[0]??null;
   const day=(await remote.query(config.core,SQL,[local.asOfDate])).results?.[0]??null;
   rows={current,day};
  }
 }catch{return {...out,code:'R54_D1_READ_FAILED',local};}
 let apiResponse={httpStatus:null,body:null};
 try{
  if(fetchFixed)apiResponse=await fetchFixed();
  else{
   const response=await fetch(URL,{method:'GET',redirect:'error',
    headers:{accept:'application/json','cache-control':'no-cache'},
    signal:AbortSignal.timeout(12000)});
   apiResponse.httpStatus=response.status;
   const headerSize=Number(response.headers.get('content-length')??'0');
   if(response.ok&&headerSize<=MAX&&response.body){
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{
     while(size<=MAX){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>MAX)break;chunks.push(value);
     }
     if(size<=MAX)apiResponse.body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }finally{await reader.cancel().catch(()=>{});}
   }
  }
 }catch{apiResponse={httpStatus:null,body:null};}
 return compareR54PublicEvidence(local,rows,apiResponse);
}
