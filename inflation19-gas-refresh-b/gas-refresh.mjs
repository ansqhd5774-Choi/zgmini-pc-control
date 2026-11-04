// Draft only. Fixed single-series B-grade repair using the already approved
// collector. This module is not installed and must not be run against a PC
// until a separate fixed receiver/manifest is reviewed and admitted.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const WRITER_HOME=String.raw`E:\ZGmini\data\pc-writer`;
export const GAS_RELATIVE='inflation-causal-r1/gas-dhhngsp.json';
export const PRIOR_SHA_251='115f6445f7849d17d66645ab91f85c00db9a7b274bbfca48285818ddbd06549f';
export const EXPECTED_DATE='2026-11-03';
export const EXPECTED_VALUE=2.63;
const SOURCE='FRED_DHHNGSP';
const VERSION='INFLATION_CAUSAL_GAS_ELECTRIC_R1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Error(code)};
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;

// Every ancestor must be a real directory rather than a reparse redirection.
// The receiver also checks the fixed checkout identity and pinned file hashes.
function approvedGasFile(base,expectedBase){
 if(typeof base!=='string'||base!==expectedBase||
  !path.isAbsolute(base))stop('GAS_REFRESH_HOME_DENIED');
 const real=fs.realpathSync.native(base);
 if(path.normalize(real).toLowerCase()!==path.normalize(base).toLowerCase())
  stop('GAS_REFRESH_HOME_REDIRECT');
 const folder=path.join(base,'inflation-causal-r1');
 for(const dir of [base,folder,path.join(folder,'raw')]){
  if(!fs.existsSync(dir))continue;
  const info=fs.lstatSync(dir);
  if(!info.isDirectory()||info.isSymbolicLink()||
    path.normalize(fs.realpathSync.native(dir)).toLowerCase()!==
    path.normalize(dir).toLowerCase())stop('GAS_REFRESH_DIR_REDIRECT');
 }
 const file=path.join(base,...GAS_RELATIVE.split('/'));
 const s=fs.lstatSync(file);
 if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>8_000_000||
  path.normalize(fs.realpathSync.native(file)).toLowerCase()!==
  path.normalize(file).toLowerCase())stop('GAS_REFRESH_FILE_DENIED');
 return file;
}

function readExisting(file){
 const bytes=fs.readFileSync(file);
 let doc;try{doc=JSON.parse(bytes.toString('utf8'))}
 catch{stop('GAS_REFRESH_JSON_DENIED')}
 if(doc.schemaVersion!==1||doc.sourceVersion!==VERSION||doc.source!==SOURCE||
  !Array.isArray(doc.observations)||doc.observations.length<20||
  doc.observations.length>10000||
  !date(doc.observations.at(-1)?.date)||
  !Number.isFinite(Date.parse(doc.sourceStoredAt)))
  stop('GAS_REFRESH_CONTRACT_DENIED');
 return {sha256:sha(bytes),latest:doc.observations.at(-1).date,
  count:doc.observations.length,
  expectedObservation:doc.observations.find(x=>x.date===EXPECTED_DATE)?.value??null};
}

// Reuses the pinned existing collectGas implementation exactly as-is; the
// caller supplies the quota-limited GET transport. EIA is never invoked.
export async function runGasRefresh({base=WRITER_HOME,
 expectedBase=WRITER_HOME,expectedPriorSha=PRIOR_SHA_251,
 fredKey,quotaFetch,collector}={}){
 const file=approvedGasFile(base,expectedBase);
 const prior=readExisting(file);
 if(prior.sha256!==expectedPriorSha)stop('GAS_REFRESH_PRIOR_SHA_DRIFT');
 if(typeof fredKey!=='string'||!fredKey.trim())stop('GAS_REFRESH_KEY_MISSING');
 if(typeof quotaFetch!=='function'||typeof collector!=='function')
  stop('GAS_REFRESH_APPROVED_DEPENDENCY_MISSING');
 let calls=0;
 const singleFred=async (url,options)=>{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='api.stlouisfed.org'||
    u.pathname!=='/fred/series/observations'||
    u.searchParams.get('series_id')!=='DHHNGSP'||
    options?.method!=='GET'||options?.redirect!=='manual'||calls>=1)
   stop('GAS_REFRESH_PROVIDER_DENIED');
  calls++;
  return quotaFetch(url,options);
 };
 const saved=await collector({base,fredKey,quotaFetch:singleFred,now:new Date()});
 if(calls!==1||saved?.source!==SOURCE||
   !['SAVED_READBACK','UNCHANGED'].includes(saved?.status)||
   saved.providerRequests!==1||!date(saved.latest)||
   !Number.isInteger(saved.count)||saved.count<prior.count||
   saved.latest<prior.latest)stop('GAS_REFRESH_RESULT_INVALID');
 const after=readExisting(file);
 if(after.latest!==saved.latest||after.count!==saved.count||
   after.latest<prior.latest||after.latest<EXPECTED_DATE||
   after.expectedObservation!==EXPECTED_VALUE||
   (saved.status==='UNCHANGED'&&after.sha256!==prior.sha256)||
   (saved.status==='SAVED_READBACK'&&saved.fileSha256!==after.sha256))
  stop('GAS_REFRESH_READBACK_MISMATCH');
 return {status:'PASS',code:saved.status,providerCalls:1,source:SOURCE,
  priorLatest:prior.latest,latest:after.latest,expectedObservationDate:EXPECTED_DATE,
  expectedObservationValue:after.expectedObservation,priorSha256:prior.sha256,
  newSha256:after.sha256,coreWrites:0,dbWrites:0,d1Writes:0,
  schedulerWrites:0};
}
