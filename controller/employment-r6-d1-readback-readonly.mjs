// Fixed R6 D1 readback (A/light). Reuses the installed Writer's Wrangler login.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

export const R6_KEY='detail:employment-r6:one-year:v1';
const SQL='SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?';
const REV='EMP-R6-FORMULA-R2-CPS-2025-10';
const FORMULA='sha256:04486846cd6063452d1c764116d3a31209f074d23a8764bf5b6ec8467095210e';
const HEX40=/^[a-f0-9]{40}$/,HEX64=/^[a-f0-9]{64}$/;
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const validTime=n=>Number.isSafeInteger(n)&&n>0;
const baseline=code=>({status:'STATE_UNKNOWN',code,key:R6_KEY,
 d1StoredAt:null,d1BodyHash:null,localResultHash:null,matchedToLocal:false,
 sourceStoredAt:null,asOfDate:null,sourceFeatures:null,chartReadyFeatures:null,
 methodologyVersion:null,formulaHash:null,providerCalls:0,d1Writes:0,
 operationalWrites:0,sqliteOpened:false});

export function verifyR6D1Row(row,checkpoint){
 const out=baseline('R6_D1_ROW_UNKNOWN');
 if(!row||typeof row.body!=='string'||Buffer.byteLength(row.body,'utf8')>8_000_000||
    !validTime(Number(row.stored_at)))return {...out,code:'R6_D1_ROW_INVALID'};
 let body;try{body=JSON.parse(row.body);}catch{return {...out,code:'R6_D1_JSON_INVALID'};}
 if(body?.kind!=='EMPLOYMENT_R6_ONE_YEAR_STORED_DISPLAY_R1'||
    !Array.isArray(body.indicators)||body.indicators.length!==29||
    body.summary?.sourceFeatures!==29||body.methodologyVersion!==REV||
    body.formulaHash!==FORMULA||!validTime(body.sourceStoredAt)||
    body.sourceStoredAt>Number(row.stored_at)||
    !/^\\d{4}-\\d{2}-\\d{2}$/.test(body.asOfDate??''))
    return {...out,code:'R6_D1_CONTRACT_INVALID'};
 const digest=hash(body),localHash=checkpoint?.localResultHash;
 const same=checkpoint?.localResultReadback==='VERIFIED'&&
    HEX64.test(localHash??'')&&localHash===digest&&
    checkpoint?.sourceStoredAt===body.sourceStoredAt&&
    checkpoint?.asOfDate===body.asOfDate;
 return {...out,status:same?'PASS':'PARTIAL',
  code:same?'R6_D1_LOCAL_MATCHED':'R6_D1_LOCAL_MISMATCH',
  matchedToLocal:Boolean(same),d1StoredAt:Number(row.stored_at),
  d1BodyHash:digest,localResultHash:HEX64.test(localHash??'')?localHash:null,
  sourceStoredAt:body.sourceStoredAt,asOfDate:body.asOfDate,
  sourceFeatures:29,chartReadyFeatures:Number.isSafeInteger(body.summary.chartReadyFeatures)?
    body.summary.chartReadyFeatures:null,methodologyVersion:REV,formulaHash:FORMULA};
}

export async function inspectEmploymentR6D1Readback(dataRoot,{fileSystem=fs,queryFixed=null}={}){
 const out=baseline('R6_D1_UNAVAILABLE');
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return out;
 const read=(file,maxBytes)=>readFixedReadonlyBytes(file,{
   fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes});
 const base=path.join(dataRoot,'pc-writer');
 const c=read(path.join(base,'config.json'),131072);
 const w=read(path.join(base,'local-writer-last-run.json'),131072);
 if(!c.ok||!w.ok)return {...out,code:'R6_CONFIG_OR_WRITER_MISSING'};
 let config,checkpoint;
 try{config=JSON.parse(c.bytes.toString('utf8'));
   checkpoint=JSON.parse(w.bytes.toString('utf8')).employmentR6OneYear;
 }catch{return {...out,code:'R6_METADATA_INVALID'};}
 if(config?.employmentR6OneYearAutoPublication!==true||
    !HEX40.test(config.source??'')||
    !/^[a-f0-9]{32}$/.test(config.account??'')||
    !/^[a-f0-9-]{36}$/.test(config.core??'')||
    !/^[a-f0-9-]{36}$/.test(config.history??''))
   return {...out,code:'R6_CONFIG_NOT_APPROVED'};
 try{
   let row;
   if(queryFixed)row=await queryFixed(SQL,[R6_KEY]);
   else{
     const fixed=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
     const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(fixed);
     const module=path.join(real,'scripts','pc-writer','d1.mjs');
     if(!fileSystem.statSync(module).isFile())
       return {...out,code:'R6_D1_CLIENT_MISSING'};
     const {client,credential}=await import(pathToFileURL(module).href);
     const remote=client(config,()=>credential(real));
     row=(await remote.query(config.core,SQL,[R6_KEY])).results?.[0]??null;
   }
   const digest=checkpoint?.localResultHash;
   let verified={...checkpoint,localResultReadback:'MISSING'};
   if(HEX64.test(digest??'')){
     const b=read(path.join(base,'employment-r6-public-results',digest+'.json'),8_000_000);
     if(b.ok)try{
       const local=JSON.parse(b.bytes.toString('utf8'));
       if(hash(local)===digest&&local.asOfDate===checkpoint.asOfDate&&
          local.sourceStoredAt===checkpoint.sourceStoredAt)
         verified={...checkpoint,localResultReadback:'VERIFIED'};
     }catch{}
   }
   return verifyR6D1Row(row,verified);
 }catch{return {...out,code:'R6_D1_READ_FAILED'};}
}
