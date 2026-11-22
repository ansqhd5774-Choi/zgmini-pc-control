// W01 fixed-key D1 summary read: reuses the existing approved Writer D1 client.
// No provider call, SQL injection, raw credentials, operational data mutations,
// or remote request/response body output. Git checkout and client integrity are checked.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';

export const INFL7_D1_KEY='detail:inflation-causal-candidates-7:r1';
const SQL='SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?';
const IDS=['2','16','22','23','24','28','29'];
const HEX40=/^[0-9a-f]{40}$/;
const validTime=n=>Number.isSafeInteger(n)&&n>0;
const digest=b=>createHash('sha256').update(b).digest('hex');
const result=(status,code,extra={})=>({status,code,key:INFL7_D1_KEY,
  providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false,...extra});

export function verifyInflation7D1Row(row,{now=Date.now()}={}){
  if(!row)return result('PARTIAL','INFL7_D1_ROW_ABSENT');
  if(typeof row.body!=='string'||Buffer.byteLength(row.body,'utf8')>45000||
      !validTime(Number(row.stored_at)))
    return result('STATE_UNKNOWN','INFL7_D1_ROW_INVALID');
  let saved;
  try{saved=JSON.parse(row.body);}catch{return result('STATE_UNKNOWN','INFL7_D1_JSON_INVALID');}
  const p=saved?.payload,cp=saved?.projection;
  if(p?.schemaVersion!=='inflation-causal-candidates-7-r1-v1'||
      !['READY','PARTIAL'].includes(p.status)||p.score!==null||
      typeof p.sourceVersion!=='string'||p.sourceVersion.length<8||
      !validTime(p.sourceStoredAt)||p.sourceStoredAt>now||
      !Array.isArray(p.indicators)||p.indicators.length!==7||
      cp?.status!=='READY'||!validTime(cp.builtAt)||cp.builtAt>now||
      Number(row.stored_at)!==cp.builtAt||cp.builtAt<p.sourceStoredAt||
      cp.sourceVersion!==p.sourceVersion||cp.sourceStoredAt!==p.sourceStoredAt)
    return result('STATE_UNKNOWN','INFL7_D1_CONTRACT_INVALID');
  let ready=0,stale=0,latest=0;
  const indicators=[];
  for(let i=0;i<IDS.length;i++){
    const x=p.indicators[i];
    if(x?.id!==IDS[i]||!['READY','PENDING','STALE'].includes(x.status)||
        typeof x.series!=='string'||typeof x.unit!=='string'||
        !Array.isArray(x.history)||x.history.length>13)
      return result('STATE_UNKNOWN','INFL7_D1_INDICATOR_INVALID');
    if(x.status==='PENDING'){
      if(x.value!==null||x.observationDate!==null||x.sourceStoredAt!==null||
          x.history.length!==0)
        return result('STATE_UNKNOWN','INFL7_D1_PENDING_LEAK');
    }else{
      if(typeof x.value!=='number'||!Number.isFinite(x.value)||
          typeof x.observationDate!=='string'||!/^20\d\d-\d\d(?:-\d\d)?$/.test(x.observationDate)||
          typeof x.sourceStoredAt!=='string'||!Number.isFinite(Date.parse(x.sourceStoredAt))||
          Date.parse(x.sourceStoredAt)>now||
          !x.history.length||x.history.at(-1)?.date!==x.observationDate||
          x.history.at(-1)?.value!==x.value)
        return result('STATE_UNKNOWN','INFL7_D1_READY_INVALID');
      latest=Math.max(latest,Date.parse(x.sourceStoredAt));
      if(x.status==='READY')ready++;else stale++;
    }
    indicators.push({id:x.id,status:x.status,series:x.series,unit:x.unit,
      value:x.value,observationDate:x.observationDate,sourceStoredAt:x.sourceStoredAt});
  }
  if(latest!==p.sourceStoredAt||(ready===7)!==(p.status==='READY'))
    return result('STATE_UNKNOWN','INFL7_D1_SOURCE_MISMATCH');
  return result('PASS','INFL7_D1_READBACK_VERIFIED',{
    d1StoredAt:Number(row.stored_at),d1BodySha256:digest(row.body),
    sourceStoredAt:p.sourceStoredAt,sourceVersion:p.sourceVersion,ready,stale,
    indicators});
}

export async function inspectInflation7D1Readback(dataRoot,{
 fileSystem=fs,queryFixed=null,now=Date.now()}={}){
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
    return result('STATE_UNKNOWN','INFL7_DATA_ROOT_INVALID');
  const root=path.join(dataRoot,'pc-writer');
  const checked=readFixedReadonlyBytes(path.join(root,'config.json'),{
    fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
  if(!checked.ok)return result('STATE_UNKNOWN','INFL7_WRITER_CONFIG_MISSING');
  let config;
  try{config=JSON.parse(checked.bytes.toString('utf8'));}
  catch{return result('STATE_UNKNOWN','INFL7_WRITER_CONFIG_INVALID');}
  if(!HEX40.test(config?.source??'')||
      !/^[a-f0-9]{32}$/.test(config?.account??'')||
      !/^[a-f0-9-]{36}$/.test(config?.core??''))
    return result('STATE_UNKNOWN','INFL7_D1_AUTH_CONFIG_UNVERIFIED');
  if(queryFixed){
    try{return verifyInflation7D1Row(await queryFixed(SQL,[INFL7_D1_KEY]),{now});}
    catch{return result('STATE_UNKNOWN','INFL7_D1_QUERY_FAILED');}
  }
  let phase='CHECKOUT_RESOLVE';
  try{
    const fixed=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
    const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(fixed);
    const module=path.join(real,'scripts','pc-writer','d1.mjs');
    phase='CLIENT_FILE';
    if(!fileSystem.statSync(module).isFile())
      return result('STATE_UNKNOWN','INFL7_D1_CLIENT_MISSING');
    const gitBinary=selectR6GitBinary({exists:fileSystem.existsSync});
    if(!gitBinary)return result('STATE_UNKNOWN','INFL7_D1_GIT_UNAVAILABLE');
    const runGit=args=>execFileSync(gitBinary,
      ['--no-optional-locks','-c','core.fsmonitor=false',
       '-c','core.untrackedCache=false','-C',real,...args],
      {encoding:'utf8',timeout:10000,maxBuffer:65536,windowsHide:true,
       env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
       stdio:['ignore','pipe','ignore']}).trim();
    phase='CHECKOUT_HEAD';
    if(runGit(['rev-parse','HEAD'])!==config.source)
      return result('STATE_UNKNOWN','INFL7_D1_SOURCE_MISMATCH');
    phase='CLIENT_INTEGRITY';
    for(const file of ['scripts/pc-writer/d1.mjs',
      'scripts/pc-writer/d1-transient.mjs','scripts/pc-writer/d1-diagnostics.mjs']){
      runGit(['ls-files','--error-unmatch','--',file]);
      runGit(['diff','--quiet','HEAD','--',file]);
    }
    phase='CLIENT_IMPORT';
    const {client,credential}=await import(pathToFileURL(module).href);
    phase='D1_SELECT';
    const row=(await client(config,()=>credential(real)).query(config.core,SQL,[INFL7_D1_KEY]))
      .results?.[0]??null;
    return verifyInflation7D1Row(row,{now});
  }catch{return result('STATE_UNKNOWN','INFL7_D1_'+phase+'_FAILED');}
}
