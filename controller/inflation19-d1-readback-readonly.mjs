// W01 fixed-key Inflation19 D1 readback; public projection only.
// Reuses the approved Writer D1 client, checkout integrity and protected fixed-byte reads.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';

export const INFL19_D1_KEY='detail:inflation-causal-public-19:r1';
const SQL='SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?';
const IDS=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^INFL19_PRESENTATION_[a-f0-9]{64}$/;
const safeTime=x=>Number.isSafeInteger(x)&&x>0;
const digest=x=>createHash('sha256').update(x).digest('hex');
const report=(status,code,rest={})=>({status,code,key:INFL19_D1_KEY,
 providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false,...rest});
const validDate=x=>typeof x==='string'&&/^20\d\d-\d\d(?:-\d\d)?$/.test(x)&&
 !Number.isNaN(Date.parse(x.length===7?x+'-01T00:00:00Z':x+'T00:00:00Z'))&&
 new Date(Date.parse(x.length===7?x+'-01T00:00:00Z':x+'T00:00:00Z')).toISOString().slice(0,x.length)===x;
const validIso=x=>typeof x==='string'&&x.length>=20&&x.length<=35&&Number.isFinite(Date.parse(x))&&
 new Date(x).toISOString()===x;
const validValue=x=>typeof x==='number'&&Number.isFinite(x);

export function verifyInflation19D1Row(row,{now=Date.now(),localPayload=null}={}){
 if(!row)return report('PARTIAL','INFL19_D1_ROW_ABSENT');
 if(typeof row.body!=='string'||Buffer.byteLength(row.body,'utf8')>45000||
  !safeTime(Number(row.stored_at)))return report('STATE_UNKNOWN','INFL19_D1_ROW_INVALID');
 let saved;
 try{saved=JSON.parse(row.body);}catch{return report('STATE_UNKNOWN','INFL19_D1_JSON_INVALID');}
 const p=saved?.payload,cp=saved?.projection;
 if(p?.schemaVersion!=='inflation-causal-public-19-r1-v1'||p.status!=='READY'||
  p.score!==null||!SHA64.test(p.sourceVersion)||!safeTime(p.sourceStoredAt)||
  p.sourceStoredAt>now||!Array.isArray(p.indicators)||p.indicators.length!==19||
  cp?.status!=='READY'||!safeTime(cp.builtAt)||cp.builtAt>now||
  Number(row.stored_at)!==cp.builtAt||cp.builtAt<p.sourceStoredAt||
  cp.sourceVersion!==p.sourceVersion||cp.sourceStoredAt!==p.sourceStoredAt)
  return report('STATE_UNKNOWN','INFL19_D1_CONTRACT_INVALID');
 const indicators=[];
 for(let i=0;i<IDS.length;i++){
  const x=p.indicators[i];
  if(x?.id!==IDS[i]||x.status!=='READY'||!validValue(x.value)||
   !validDate(x.observationDate)||!validIso(x.sourceStoredAt)||
   Date.parse(x.sourceStoredAt)>now||typeof x.series!=='string'||
   typeof x.unit!=='string'||!Array.isArray(x.history)||x.history.length>13||
   x.history.some((h,j)=>!validDate(h?.date)||!validValue(h?.value)||
    h.date>x.observationDate||(j>0&&h.date<=x.history[j-1].date)))
   return report('STATE_UNKNOWN','INFL19_D1_INDICATOR_INVALID',{firstMismatchId:IDS[i]});
  indicators.push({id:x.id,status:x.status,series:x.series,unit:x.unit,
   value:x.value,observationDate:x.observationDate,sourceStoredAt:x.sourceStoredAt});
 }
 if(localPayload!==null){
  if(localPayload?.schemaVersion!==p.schemaVersion||
    localPayload.status!==p.status||localPayload.score!==null||
    localPayload.sourceStoredAt!==p.sourceStoredAt||
    localPayload.sourceVersion!==p.sourceVersion||
    !Array.isArray(localPayload.indicators)||localPayload.indicators.length!==19)
   return report('PARTIAL','INFL19_D1_LOCAL_METADATA_DIFF',{
    d1StoredAt:Number(row.stored_at),d1BodySha256:digest(row.body),
    sourceVersion:p.sourceVersion,sourceStoredAt:p.sourceStoredAt});
  for(let i=0;i<19;i++){
   const a=p.indicators[i],b=localPayload.indicators[i];
   for(const key of ['id','status','series','unit','value','observationDate','sourceStoredAt']){
    if(a[key]!==b?.[key])
     return report('PARTIAL','INFL19_D1_LOCAL_VALUE_DIFF',{firstMismatchId:IDS[i],firstMismatchField:key});
   }
  }
 }
 return report('PASS','INFL19_D1_READBACK_VERIFIED',{
  d1StoredAt:Number(row.stored_at),d1BodySha256:digest(row.body),
  sourceVersion:p.sourceVersion,sourceStoredAt:p.sourceStoredAt,
  ready:indicators.length,localMatches:localPayload!==null,indicators});
}

export async function inspectInflation19D1Readback(dataRoot,{
 fileSystem=fs,queryFixed=null,now=Date.now()}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return report('STATE_UNKNOWN','INFL19_DATA_ROOT_INVALID');
 const home=path.join(dataRoot,'pc-writer');
 const configRead=readFixedReadonlyBytes(path.join(home,'config.json'),{
  fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!configRead.ok)return report('STATE_UNKNOWN','INFL19_WRITER_CONFIG_MISSING');
 let config;
 try{config=JSON.parse(configRead.bytes.toString('utf8'));}
 catch{return report('STATE_UNKNOWN','INFL19_WRITER_CONFIG_INVALID');}
 if(!SHA40.test(config?.source??'')||!/^[a-f0-9]{32}$/.test(config?.account??'')||
   !/^[a-f0-9-]{36}$/.test(config?.core??''))
  return report('STATE_UNKNOWN','INFL19_D1_AUTH_CONFIG_UNVERIFIED');
 const stageRead=readFixedReadonlyBytes(
  path.join(home,'inflation-causal-r1','public-19-summary-projection-r1.json'),{
   fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:65536});
 if(!stageRead.ok)return report('STATE_UNKNOWN','INFL19_STAGED_SUMMARY_UNAVAILABLE');
 let stage;
 try{stage=JSON.parse(stageRead.bytes.toString('utf8'));}
 catch{return report('STATE_UNKNOWN','INFL19_STAGED_SUMMARY_INVALID');}
 if(stage?.payload?.schemaVersion!=='inflation-causal-public-19-r1-v1'||
   stage.sourceVersion!==stage.payload.sourceVersion||
   stage.sourceStoredAt!==stage.payload.sourceStoredAt)
  return report('STATE_UNKNOWN','INFL19_STAGED_CONTRACT_INVALID');
 if(queryFixed){
  try{return verifyInflation19D1Row(await queryFixed(SQL,[INFL19_D1_KEY]),
   {now,localPayload:stage.payload});}
  catch{return report('STATE_UNKNOWN','INFL19_D1_QUERY_FAILED');}
 }
 let phase='CHECKOUT_RESOLVE';
 try{
  const fixed=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
  const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(fixed);
  const module=path.join(real,'scripts','pc-writer','d1.mjs');
  phase='CLIENT_FILE';
  if(!fileSystem.statSync(module).isFile())
   return report('STATE_UNKNOWN','INFL19_D1_CLIENT_MISSING');
  const gitBinary=selectR6GitBinary({exists:fileSystem.existsSync});
  if(!gitBinary)return report('STATE_UNKNOWN','INFL19_D1_GIT_UNAVAILABLE');
  const git=args=>execFileSync(gitBinary,
   ['--no-optional-locks','-c','core.fsmonitor=false',
    '-c','core.untrackedCache=false','-C',real,...args],
   {encoding:'utf8',timeout:10000,maxBuffer:65536,windowsHide:true,
    env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
    stdio:['ignore','pipe','ignore']}).trim();
  phase='CHECKOUT_HEAD';
  if(git(['rev-parse','HEAD'])!==config.source)
   return report('STATE_UNKNOWN','INFL19_D1_SOURCE_MISMATCH');
  phase='CLIENT_INTEGRITY';
  for(const f of ['scripts/pc-writer/d1.mjs',
    'scripts/pc-writer/d1-transient.mjs','scripts/pc-writer/d1-diagnostics.mjs']){
   git(['ls-files','--error-unmatch','--',f]);
   git(['diff','--quiet','HEAD','--',f]);
  }
  phase='CLIENT_IMPORT';
  const {client,credential}=await import(pathToFileURL(module).href);
  phase='D1_SELECT';
  const row=(await client(config,()=>credential(real))
   .query(config.core,SQL,[INFL19_D1_KEY])).results?.[0]??null;
  return verifyInflation19D1Row(row,{now,localPayload:stage.payload});
 }catch{return report('STATE_UNKNOWN','INFL19_D1_'+phase+'_FAILED');}
}
