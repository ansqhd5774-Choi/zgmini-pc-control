// W01 R2 D1 exact-key comparison. Reuses the authenticated, installed Writer D1 client.
// Fixed SELECT, no provider calls, arbitrary SQL, credential output or D1 mutations.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';
import {inspectInflationR2Row,inspectInflationR2LocalReadonly,W01_R2_KEY} from './inflation-r2-local-readonly.mjs';

const SQL='SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?';
const result=(code,extra={})=>({status:'STATE_UNKNOWN',code,key:W01_R2_KEY,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false,...extra});
const validHex40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);

export function verifyInflationR2D1Row(row,{expectedLocal=null}={}){
 const measured=inspectInflationR2Row(row);
 const values={d1StoredAt:measured.storedAt??null,
  d1BodySha256:measured.bodySha256??null,
  d1Score:measured.score??null,d1AsOfDate:measured.asOfDate??null,
  d1MethodologyVersion:measured.methodologyVersion??null,
  d1TrendLength:measured.trendLength??null,
  d1LastTrendLabel:measured.lastTrendLabel??null,
  d1LastTrendValue:measured.lastTrendValue??null,
  trendDateMatchesAsOf:measured.trendDateMatchesAsOf===true,
  trendValueMatchesScore:measured.trendValueMatchesScore===true,
  localComparisonAvailable:expectedLocal!==null};
 if(measured.status!=='PASS')return result('W01_R2_D1_'+measured.code,values);
 const localMatches=expectedLocal===null?null:
   expectedLocal.bodySha256===measured.bodySha256&&
   expectedLocal.storedAt===measured.storedAt&&
   expectedLocal.score===measured.score&&expectedLocal.asOfDate===measured.asOfDate;
 return {status:localMatches===false?'PARTIAL':'PASS',
   code:localMatches===false?'W01_R2_D1_LOCAL_MISMATCH':'W01_R2_D1_READBACK_VERIFIED',
   key:W01_R2_KEY,...values,localMatches,
   providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
}

export async function inspectInflationR2D1Readback(dataRoot,{
 fileSystem=fs,queryFixed=null,expectedLocal=null}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return result('W01_R2_D1_ROOT_INVALID');
 const read=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer','config.json'),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!read.ok)return result('W01_R2_D1_WRITER_CONFIG_MISSING');
 let config;
 try{config=JSON.parse(read.bytes.toString('utf8'));}
 catch{return result('W01_R2_D1_WRITER_CONFIG_INVALID');}
 if(!validHex40(config?.source)||!/^[a-f0-9]{32}$/.test(config?.account??'')||
   !/^[a-f0-9-]{36}$/.test(config?.core??''))
  return result('W01_R2_D1_AUTH_CONFIG_UNVERIFIED');
 if(queryFixed){
  try{return verifyInflationR2D1Row(await queryFixed(SQL,[W01_R2_KEY]),{expectedLocal});}
  catch{return result('W01_R2_D1_QUERY_FAILED');}
 }
 let phase='CHECKOUT_RESOLVE';
 try{
  const checkout=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
  const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(checkout);
  const module=path.join(real,'scripts','pc-writer','d1.mjs');
  phase='CLIENT_FILE';
  if(!fileSystem.statSync(module).isFile())
   return result('W01_R2_D1_CLIENT_MISSING');
  const git=selectR6GitBinary({exists:fileSystem.existsSync});
  if(!git)return result('W01_R2_D1_GIT_UNAVAILABLE');
  const run=args=>execFileSync(git,['--no-optional-locks','-c','core.fsmonitor=false',
   '-c','core.untrackedCache=false','-C',real,...args],{encoding:'utf8',
   timeout:10000,maxBuffer:65536,windowsHide:true,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
   stdio:['ignore','pipe','ignore']}).trim();
  phase='CHECKOUT_HEAD';
  if(run(['rev-parse','HEAD'])!==config.source)
   return result('W01_R2_D1_SOURCE_MISMATCH');
  phase='CLIENT_INTEGRITY';
  for(const f of ['scripts/pc-writer/d1.mjs','scripts/pc-writer/d1-transient.mjs',
    'scripts/pc-writer/d1-diagnostics.mjs']){
   run(['ls-files','--error-unmatch','--',f]);
   run(['diff','--quiet','HEAD','--',f]);
  }
  phase='CLIENT_IMPORT';
  const {client,credential}=await import(pathToFileURL(module).href);
  phase='D1_SELECT';
  const row=(await client(config,()=>credential(real)).query(config.core,SQL,[W01_R2_KEY]))
   .results?.[0]??null;
  const local=expectedLocal??inspectInflationR2LocalReadonly(dataRoot);
  const compared=verifyInflationR2D1Row(row,{expectedLocal:local.status==='PASS'?local:null});
  return {...compared,localStatus:local.status,
   localBodySha256:local.bodySha256??null,localStoredAt:local.storedAt??null,
   localScore:local.score??null,localAsOfDate:local.asOfDate??null};
 }catch{return result('W01_R2_D1_'+phase+'_FAILED');}
}
